// Assembles CONTINUE? v2: cuts the AI clips per the EDL in continue/v2/film.html, re-pixelates them
// (clips are used at native 1080p; the game-UI layer is drawn at 384x216 and scaled nearest-neighbour), overlays the game-UI layer, and muxes the audio mix.
// Shots without a rendered clip yet fall back to their start image (slow push-in), so rough cuts work.
// Usage: node tools/assemble-v2.js <out.mp4> [--from S --to E]
const { chromium } = require('playwright'); const { spawn, spawnSync } = require('child_process');
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const ROOT = path.resolve(__dirname, '..'), V2 = path.join(ROOT, 'continue/v2'), OUT = path.resolve(process.argv[2] || path.join(V2, 'continue-v2.mp4'));
const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? +process.argv[i + 1] : null; };
const FPS = 30, PIX = 'scale=384:216:flags=area,scale=1920:1080:flags=neighbor';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.mp3': 'audio/mpeg' };
const find = (dir, id, ext) => { const f = fs.readdirSync(path.join(V2, dir)).find(n => n.startsWith(id + '-') && n.endsWith(ext)); return f && path.join(V2, dir, f); };
const ff = (args) => { const r = spawnSync('ffmpeg', ['-loglevel', 'error', '-y', ...args]); if (r.status) throw new Error(r.stderr.toString()); };
const dur = f => +spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).stdout.toString();
const srv = http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); if (!f.startsWith(ROOT) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
srv.listen(0, async () => {
  const b = await chromium.launch(), p = await b.newPage();
  p.on('pageerror', e => console.error('PAGE', e.message));
  await p.goto(`http://127.0.0.1:${srv.address().port}/continue/v2/film.html`); await p.waitForFunction(() => window.__ready);
  const EDL = await p.evaluate(() => window.__EDL), TOTAL = await p.evaluate(() => window.__TOTAL);
  const FROM = arg('--from') ?? 0, TO = arg('--to') ?? TOTAL;
  const SP = fs.mkdtempSync(path.join(os.tmpdir(), 'asm-')), list = [];
  let missing = [];
  for (const [i, s] of EDL.entries()) {
    if (s.t0 + s.d <= FROM || s.t0 >= TO) continue;
    const N = Math.round(s.d * FPS), seg = path.join(SP, `seg${String(i).padStart(3, '0')}.mp4`);
    const grade = s.grade === 'memory' ? ',hue=s=0.12,colorchannelmixer=.95:.05:0:0:.05:.9:.05:0:0:.1:.8:0,eq=brightness=0.03:contrast=0.9' : '';
    const enc = ['-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '14', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-frames:v', String(N), seg];
    if (s.id === 'BLACK') ff(['-f', 'lavfi', '-i', `color=black:s=1920x1080:r=${FPS}`, ...enc]);
    else {
      const clip = find('clips', s.id, '.mp4');
      if (clip) { const k = Math.max(1, s.d / (dur(clip) - 0.05)); ff(['-i', clip, '-vf', `setpts=PTS*${k.toFixed(4)},fps=${FPS},scale=1920:1080:flags=lanczos${grade},tpad=stop_mode=clone:stop_duration=${s.d}`, ...enc]); }
      else { missing.push(s.id); const img = find('plates', s.id, '.png'); ff(['-loop', '1', '-i', img, '-vf', `scale=2400:-2,zoompan=z='1+0.08*on/${N}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${N}:s=1920x1080:fps=${FPS},${PIX}${grade}`, ...enc]); }
    }
    list.push(`file '${seg}'`);
  }
  fs.writeFileSync(path.join(SP, 'list.txt'), list.join('\n'));
  ff(['-f', 'concat', '-safe', '0', '-i', path.join(SP, 'list.txt'), '-c', 'copy', path.join(SP, 'base.mp4')]);
  const t0 = EDL.find(s => s.t0 + s.d > FROM).t0;
  fs.writeFileSync(path.join(SP, 'a.wav'), Buffer.from(await p.evaluate(() => window.__renderAudio()), 'base64'));
  const span = dur(path.join(SP, 'base.mp4'));
  const enc = spawn('ffmpeg', ['-loglevel', 'error', '-y', '-i', path.join(SP, 'base.mp4'), '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-', '-ss', String(t0), '-t', String(span), '-i', path.join(SP, 'a.wav'),
    '-filter_complex', '[1]scale=1920:1080:flags=neighbor[o];[0][o]overlay=format=auto[v]', '-map', '[v]', '-map', '2:a', '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-tune', 'animation', '-pix_fmt', 'yuv420p',
    '-af', 'alimiter=limit=0.89:level=false', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', OUT], { stdio: ['pipe', 'ignore', 'inherit'] });
  const NF = Math.round(span * FPS);
  for (let f = 0; f < NF; f++) { const d = await p.evaluate(t => window.__overlay(t), t0 + f / FPS); if (!enc.stdin.write(Buffer.from(d.split(',')[1], 'base64'))) await new Promise(r => enc.stdin.once('drain', r)); }
  enc.stdin.end(); await new Promise(r => enc.on('close', r)); await b.close(); srv.close();
  console.log('done', OUT, 'span', t0, '->', (t0 + span).toFixed(1), missing.length ? `| stills used for: ${missing.join(' ')}` : '| all clips present');
});
