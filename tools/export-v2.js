// Renders a v2 page (served over local HTTP so the canvas can be read back) to MP4.
// Usage: node tools/export-v2.js <page relative to repo, e.g. continue/v2/test.html> <out.mp4> [ffmpeg] [--frames t1,t2,...]
const { chromium } = require('playwright'); const { spawn } = require('child_process');
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const [PAGE, OUT, FF = 'ffmpeg'] = process.argv.slice(2).filter(a => !a.startsWith('--'));
const fi = process.argv.indexOf('--frames'), STILLS = fi > 0 ? process.argv[fi + 1].split(',').map(Number) : null;
const ROOT = path.resolve(__dirname, '..'), FPS = 30;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg' };
const srv = http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); if (!f.startsWith(ROOT) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
srv.listen(0, async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  p.on('pageerror', e => console.error('PAGE', e.message));
  await p.goto(`http://127.0.0.1:${srv.address().port}/${PAGE}`); await p.waitForFunction(() => window.__ready);
  const grab = t => p.evaluate(t => { window.__render(t); return document.getElementById('c').toDataURL('image/png'); }, t);
  if (STILLS) { for (const t of STILLS) fs.writeFileSync(`${OUT}-${t}.png`, Buffer.from((await grab(t)).split(',')[1], 'base64')); await b.close(); srv.close(); return; }
  const SP = fs.mkdtempSync(path.join(os.tmpdir(), 'v2-')), TOTAL = await p.evaluate(() => window.__TOTAL);
  fs.writeFileSync(`${SP}/a.wav`, Buffer.from(await p.evaluate(() => window.__renderAudio()), 'base64'));
  const ff = spawn(FF, ['-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-', '-i', `${SP}/a.wav`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'medium', '-tune', 'animation',
    '-af', 'alimiter=limit=0.89:level=false', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', OUT], { stdio: ['pipe', 'ignore', 'inherit'] });
  const N = Math.floor(TOTAL * FPS);
  for (let f = 0; f < N; f++) { const d = await grab(f / FPS); if (!ff.stdin.write(Buffer.from(d.split(',')[1], 'base64'))) await new Promise(r => ff.stdin.once('drain', r)); if (f % 150 === 0) console.log(`frame ${f}/${N}`); }
  ff.stdin.end(); await new Promise(r => ff.on('close', r)); await b.close(); srv.close(); console.log('done', OUT);
});
