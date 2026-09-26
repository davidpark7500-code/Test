const { chromium } = require('playwright');
const { spawn } = require('child_process'); const fs = require('fs');
// Usage: node tools/export-video.js <ffmpeg-path> [out.mp4]
const path = require('path'), os = require('os');
const FF = process.argv[2] || 'ffmpeg', OUT = process.argv[3] || 'david-park-promo.mp4';
const SP = fs.mkdtempSync(path.join(os.tmpdir(), 'promo-'));
const PAGE = 'file://' + path.resolve(__dirname, '..', 'david-park-promo.html');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  await p.goto(PAGE);
  await p.waitForTimeout(1000);
  fs.writeFileSync(`${SP}/audio.wav`, Buffer.from(await p.evaluate(() => window.__renderAudio()), 'base64'));
  const ff = spawn(FF, ['-y', '-f', 'image2pipe', '-framerate', '30', '-c:v', 'mjpeg', '-i', '-', '-i', `${SP}/audio.wav`,
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '23', '-preset', 'medium', '-af', 'alimiter=limit=0.89:level=false', '-c:a', 'aac', '-b:a', '160k',
    '-shortest', '-movflags', '+faststart', OUT], { stdio: ['pipe', 'ignore', 'inherit'] });
  for (let f = 0; f < 1800; f++) {
    const d = await p.evaluate(t => { window.__render(t); return document.getElementById('c').toDataURL('image/jpeg', .9); }, f / 30);
    if (!ff.stdin.write(Buffer.from(d.split(',')[1], 'base64'))) await new Promise(r => ff.stdin.once('drain', r));
  }
  ff.stdin.end(); await new Promise(r => ff.on('close', r)); await b.close(); console.log('done');
})();
