// Builds one self-contained HTML file: build/amway-membership.html
// Embeds fonts, the optional logo files, content.js, engine.js and audio.js.
//   node build.mjs
import fs from 'node:fs';
import path from 'node:path';
const D = path.dirname(new URL(import.meta.url).pathname);
const rd = p => fs.readFileSync(path.join(D, p));
const b64 = p => rd(p).toString('base64');

const fonts = [
  ['DM Serif Display', 400, 'assets/fonts/dmserif-400.woff2'],
  ['Carlito', 400, 'assets/fonts/carlito-400.woff2'],
  ['Carlito', 700, 'assets/fonts/carlito-700.woff2'],
].map(([f, w, p]) => `@font-face{font-family:"${f}";font-weight:${w};font-style:normal;src:url(data:font/woff2;base64,${b64(p)}) format("woff2");}`).join('\n');

// Drop the official files in assets/ to fill the logo slots (PNG or SVG).
const logos = {};
for (const k of ['blue', 'white']) for (const ext of ['png', 'svg']) {
  const p = `assets/logo-${k}.${ext}`;
  if (fs.existsSync(path.join(D, p)) && !logos[k]) logos[k] = `data:image/${ext === 'svg' ? 'svg+xml' : 'png'};base64,${b64(p)}`;
}

const content = rd('src/content.js').toString();
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Amway Membership Training: A Story Worth More Than $20</title>
<style>
${fonts}
*{box-sizing:border-box}
html,body{margin:0;background:#141a33;color:#D5DCF0;font-family:Carlito,Calibri,sans-serif}
body{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px}
.stage{width:100%;max-width:1440px}
canvas{width:100%;aspect-ratio:16/9;display:block;border-radius:10px;box-shadow:0 20px 60px rgba(0,0,0,.45);cursor:pointer;background:#F5F1EE}
.bar{display:flex;gap:10px;align-items:center;margin-top:12px}
button{font:700 15px Carlito,sans-serif;border:0;border-radius:999px;padding:9px 18px;cursor:pointer;background:#F2B045;color:#1D2955}
input[type=range]{flex:1;accent-color:#F2B045}
.time{font:400 15px Carlito,sans-serif;min-width:96px;text-align:right}
.note{font-size:14px;opacity:.75;margin-top:8px}
body.render{padding:0;background:#000}body.render .bar,body.render .note{display:none}
body.render .stage{max-width:none}body.render canvas{width:1920px;height:1080px;border-radius:0;box-shadow:none}
</style></head><body>
<div class="stage">
<canvas id="c" width="1920" height="1080" aria-label="Amway Membership training video"></canvas>
<div class="bar"><button id="play">▶ Play</button><input id="seek" type="range" min="0" step="0.01" value="0" aria-label="Seek"><span class="time" id="time"></span></div>
<div class="note">Click the video or press Space to play or pause, with sound. Left and right arrows step 1 second; Shift+arrow steps 5 seconds.</div>
</div>
<script>window.LOGO_SRC=${JSON.stringify(logos)};</script>
<script>${content}</script>
<script>${rd('src/engine.js')}</script>
<script>${rd('src/audio.js')}</script>
<script>
(() => {
const E = window.ENGINE, cv = document.getElementById('c'); E.init(cv);
if (location.search.includes('render')) document.body.classList.add('render');
const seek = document.getElementById('seek'), tm = document.getElementById('time'), pb = document.getElementById('play');
seek.max = E.DUR;
const mmss = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
let t = 0, playing = false, ac = null, buf = null, src = null, t0 = 0, off = 0;
function draw() { E.render(t); seek.value = t; tm.textContent = mmss(t) + ' / ' + mmss(E.DUR); }
async function play() {
  if (!ac) ac = new AudioContext();
  if (!buf) { pb.textContent = '… preparing sound'; buf = await window.AUDIO.renderAudio(); }
  if (t >= E.DUR - 0.05) t = 0;
  src = ac.createBufferSource(); src.buffer = buf; src.connect(ac.destination);
  off = t; t0 = ac.currentTime; src.start(0, t); playing = true; pb.textContent = '❚❚ Pause'; loop();
}
function pause() { if (src) { try { src.stop(); } catch (e) {} src = null; } playing = false; pb.textContent = '▶ Play'; }
function loop() { if (!playing) return; t = off + (ac.currentTime - t0); if (t >= E.DUR) { t = E.DUR; draw(); pause(); return; } draw(); requestAnimationFrame(loop); }
const toggle = () => playing ? pause() : play();
const jump = v => { const was = playing; pause(); t = Math.max(0, Math.min(E.DUR, v)); draw(); if (was) play(); };
pb.onclick = toggle; cv.onclick = toggle;
seek.oninput = () => jump(parseFloat(seek.value));
addEventListener('keydown', e => {
  if (e.code === 'Space') { e.preventDefault(); toggle(); }
  if (e.code === 'ArrowRight') jump(t + (e.shiftKey ? 5 : 1));
  if (e.code === 'ArrowLeft') jump(t - (e.shiftKey ? 5 : 1));
});
// hooks for render.mjs
window.__ready = E.ready().then(() => { draw(); return true; });
window.__render = x => E.render(x);
window.__audioB64 = async () => {
  const b = window.AUDIO.toWav(await window.AUDIO.renderAudio());
  let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
  return btoa(s);
};
})();
</script></body></html>`;
fs.mkdirSync(path.join(D, 'build'), { recursive: true });
fs.writeFileSync(path.join(D, 'build/amway-membership.html'), html);
const total = window_total(content);
console.log(`built build/amway-membership.html  (${(html.length / 1024).toFixed(0)} KB, ${total}s, logos: ${Object.keys(logos).join(', ') || 'placeholders'})`);
function window_total(src) { const w = {}; new Function('window', src)(w); return w.CONTENT.scenes.reduce((a, s) => a + s.dur, 0); }
