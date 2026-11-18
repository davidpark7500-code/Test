// Renders build/amway-membership.html frame by frame to MP4 with parallel
// headless Chromium workers, then adds the soundtrack at -16 LUFS.
//   node render.mjs                     full video -> build/amway-membership.mp4
//   node render.mjs --stills 2,30,95    stills -> build/stills/ + sheet.jpg
//   node render.mjs --from 60 --to 90   a section only
//   node render.mjs --scale 0.5         half-size draft
//   node render.mjs --workers 4
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(require.resolve('playwright', { paths: ['/opt/node22/lib/node_modules', process.cwd()] }))); }

const D = path.dirname(new URL(import.meta.url).pathname);
const B = path.join(D, 'build');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const PAGE = 'file://' + path.join(B, 'amway-membership.html') + '?render';
const FF = process.env.FFMPEG || 'ffmpeg';
const scale = parseFloat(arg('scale', '1'));
const run = (cmd, args) => new Promise((res, rej) => { const p = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'inherit'] }); p.on('close', c => c ? rej(new Error(cmd + ' exited ' + c)) : res()); });

async function openPage(browser) {
  const p = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await p.goto(PAGE); await p.evaluate(() => window.__ready);
  return p;
}
const grab = (p, t) => p.evaluate(t => { window.__render(t); return document.getElementById('c').toDataURL('image/jpeg', 0.93); }, t)
  .then(d => Buffer.from(d.split(',')[1], 'base64'));

const browser = await chromium.launch({ args: ['--disable-gpu-vsync'] });
const probe = await openPage(browser);
const { DUR, FPS } = await probe.evaluate(() => ({ DUR: window.ENGINE.DUR, FPS: window.ENGINE.FPS }));

if (arg('stills')) {
  const dir = path.join(B, 'stills'); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const ts = arg('stills').split(',').map(Number);
  for (const [i, t] of ts.entries()) fs.writeFileSync(path.join(dir, `s${String(i).padStart(3, '0')}_${t}.jpg`), await grab(probe, t));
  const cols = Math.min(4, ts.length);
  await run(FF, ['-y', '-loglevel', 'error', '-pattern_type', 'glob', '-i', path.join(dir, 's*.jpg'), '-vf', `scale=640:-1,tile=${cols}x${Math.ceil(ts.length / cols)}:padding=6`, '-frames:v', '1', path.join(dir, 'sheet.jpg')]);
  console.log('stills ->', dir); await browser.close(); process.exit(0);
}

const from = parseFloat(arg('from', '0')), to = Math.min(DUR, parseFloat(arg('to', String(DUR))));
const f0 = Math.round(from * FPS), f1 = Math.round(to * FPS), N = f1 - f0;
const workers = parseInt(arg('workers', String(Math.max(1, Math.min(6, (await import('node:os')).cpus().length)))));
const tmp = path.join(B, 'tmp'); fs.rmSync(tmp, { recursive: true, force: true }); fs.mkdirSync(tmp, { recursive: true });
const vf = scale !== 1 ? ['-vf', `scale=${Math.round(1920 * scale / 2) * 2}:-2:flags=lanczos`] : [];

console.log(`rendering ${N} frames (${(N / FPS).toFixed(1)}s) with ${workers} workers…`);
const audioP = probe.evaluate(() => window.__audioB64()).then(b => fs.writeFileSync(path.join(tmp, 'audio.wav'), Buffer.from(b, 'base64')));
let done = 0; const tStart = Date.now();
const chunk = Math.ceil(N / workers);
await Promise.all([...Array(workers)].map(async (_, w) => {
  const a = f0 + w * chunk, b = Math.min(f1, a + chunk); if (a >= b) return;
  const p = await openPage(browser);
  const ff = spawn(FF, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', ...vf,
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'medium', '-r', String(FPS), path.join(tmp, `seg${w}.mp4`)], { stdio: ['pipe', 'ignore', 'inherit'] });
  const closed = new Promise(r => ff.on('close', r));
  for (let f = a; f < b; f++) {
    const jpg = await grab(p, f / FPS);
    if (!ff.stdin.write(jpg)) await new Promise(r => ff.stdin.once('drain', r));
    if (++done % 150 === 0) { const s = (Date.now() - tStart) / 1000; console.log(`  ${done}/${N} frames, ${(done / s).toFixed(1)} fps, ~${Math.round((N - done) / (done / s))}s left`); }
  }
  ff.stdin.end(); await closed; await p.close();
}));
await audioP; await browser.close();

fs.writeFileSync(path.join(tmp, 'list.txt'), [...Array(workers).keys()].filter(w => fs.existsSync(path.join(tmp, `seg${w}.mp4`))).map(w => `file 'seg${w}.mp4'`).join('\n'));
const out = path.join(B, from === 0 && to === DUR ? 'amway-membership.mp4' : `section-${from}-${to}.mp4`);
await run(FF, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(tmp, 'list.txt'), '-ss', String(from), '-t', String(to - from), '-i', path.join(tmp, 'audio.wav'),
  '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-shortest', '-movflags', '+faststart', out]);

// contact sheets: one tile per second, 30 tiles per sheet
const rev = path.join(B, 'review'); fs.rmSync(rev, { recursive: true, force: true }); fs.mkdirSync(rev, { recursive: true });
await run(FF, ['-y', '-loglevel', 'error', '-i', out, '-vf', 'fps=1,scale=384:-1,drawtext=text=\'%{pts\\:hms}\':x=6:y=6:fontsize=16:fontcolor=white:box=1:boxcolor=black@0.5,tile=6x5:padding=4', '-vsync', 'vfr', path.join(rev, 'contact-%02d.jpg')]).catch(async () => {
  await run(FF, ['-y', '-loglevel', 'error', '-i', out, '-vf', 'fps=1,scale=384:-1,tile=6x5:padding=4', '-vsync', 'vfr', path.join(rev, 'contact-%02d.jpg')]);
});
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`done -> ${out} in ${Math.round((Date.now() - tStart) / 1000)}s`);
