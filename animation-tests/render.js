// Frame-exact exporter: node render.js <page.html> <out.mp4> <seconds> [fps=30] [w=1920] [h=1080] [startFrame] [endFrame]
// The page must expose async window.__render(t) drawing into <canvas id="c">.
const { chromium } = require('playwright');
const { spawn } = require('child_process'); const path = require('path');
const [page, out, secs, fps = 30, W = 1920, H = 1080, f0, f1] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: +W, height: +H } });
  p.on('console', m => console.log('[page]', m.text())); p.on('pageerror', e => console.error('[err]', e.message));
  await p.goto('file://' + path.resolve(page) + `?w=${W}&h=${H}&${process.env.Q || ""}`);
  await p.waitForFunction(() => window.__ready === true);
  const N = Math.round(secs * fps), a = f0 ? +f0 : 0, z = f1 ? +f1 : N;
  const still = out.endsWith('.png');
  const seq = out.endsWith('/');   // resumable: one JPEG per frame, existing frames are skipped
  if (seq) require('fs').mkdirSync(out, { recursive: true });
  const ff = (still || seq) ? null : spawn('ffmpeg', ['-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '16', '-preset', 'slow', '-tune', 'animation', '-movflags', '+faststart', out],
    { stdio: ['pipe', 'ignore', 'inherit'] });
  const t0 = Date.now();
  for (let f = a; f < z; f++) {
    const fname = seq ? `${out}${String(f).padStart(5, '0')}.jpg` : null;
    if (seq && require('fs').existsSync(fname)) continue;
    const d = await p.evaluate(async ([t, jpg]) => { await window.__render(t); return document.getElementById('c').toDataURL(jpg ? 'image/jpeg' : 'image/png', 0.95); }, [f / fps, seq]);
    const buf = Buffer.from(d.split(',')[1], 'base64');
    if (seq) { require('fs').writeFileSync(fname + '.tmp', Buffer.from(d.split(',')[1], 'base64')); require('fs').renameSync(fname + '.tmp', fname); if (f % 30 === 0) console.log(`frame ${f}`); continue; }
    if (still) { require('fs').writeFileSync(out.replace('.png', `_${f}.png`), buf); continue; }
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (f % 30 === 0) console.log(`frame ${f}/${z}  ${((Date.now() - t0) / 1000 / (f - a + 1)).toFixed(2)}s/frame`);
  }
  if (ff) { ff.stdin.end(); await new Promise(r => ff.on('close', r)); }
  await b.close(); console.log('done', out, ((Date.now() - t0) / 1000).toFixed(0) + 's');
})();
