// Renders continue/index.html to an MP4, frame by frame, with its synthesized soundtrack.
// Usage: node tools/export-continue.js [ffmpeg-path] [out.mp4]
const { chromium } = require('playwright');
const { spawn } = require('child_process'); const fs = require('fs'), path = require('path'), os = require('os');
const FF = process.argv[2] || 'ffmpeg', OUT = process.argv[3] || 'continue/continue.mp4', FPS = 30;
const SP = fs.mkdtempSync(path.join(os.tmpdir(), 'continue-'));
const PAGE = 'file://' + path.resolve(__dirname, '..', 'continue', 'index.html');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  await p.goto(PAGE); await p.waitForTimeout(1500);
  const TOTAL = await p.evaluate(() => window.__TOTAL);
  fs.writeFileSync(`${SP}/audio.wav`, Buffer.from(await p.evaluate(() => window.__renderAudio()), 'base64'));
  const ff = spawn(FF, ['-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-i', `${SP}/audio.wav`,
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-preset', 'medium', '-af', 'alimiter=limit=0.89:level=false', '-c:a', 'aac', '-b:a', '192k',
    '-shortest', '-movflags', '+faststart', OUT], { stdio: ['pipe', 'ignore', 'inherit'] });
  const N = Math.floor(TOTAL * FPS);
  for (let f = 0; f < N; f++) {
    const d = await p.evaluate(t => { window.__render(t); return document.getElementById('c').toDataURL('image/jpeg', .92); }, f / FPS);
    if (!ff.stdin.write(Buffer.from(d.split(',')[1], 'base64'))) await new Promise(r => ff.stdin.once('drain', r));
    if (f % 300 === 0) console.log(`frame ${f}/${N}`);
  }
  ff.stdin.end(); await new Promise(r => ff.on('close', r)); await b.close(); console.log('done', OUT);
})();
