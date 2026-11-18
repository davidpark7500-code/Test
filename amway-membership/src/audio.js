// Calm music bed + soft sound effects, rendered offline with Web Audio.
// Music follows the story: reflective (chapter 1), brighter from "The Turn".
(() => {
const SR = 44100;
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

// chords: [bass, pad notes...] (MIDI)
const BRIGHT = [[38, 62, 66, 69, 74], [37, 61, 64, 69, 73], [35, 62, 66, 71, 74], [43, 62, 67, 71, 74]]; // D A/C# Bm G
const REFLECT = [[35, 62, 66, 71, 74], [43, 62, 67, 71, 74], [38, 62, 66, 69, 74], [45, 61, 64, 69, 73]]; // Bm G D A

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

async function renderAudio() {
  const E = window.ENGINE, DUR = E.DUR;
  const ac = new OfflineAudioContext(2, Math.ceil(SR * (DUR + 0.5)), SR);
  const master = ac.createGain(); master.gain.value = 0.9;
  const comp = ac.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3;
  master.connect(comp); comp.connect(ac.destination);
  const music = ac.createGain(); music.connect(master);
  music.gain.setValueAtTime(0, 0); music.gain.linearRampToValueAtTime(1, 1.5);
  music.gain.setValueAtTime(1, DUR - 3); music.gain.linearRampToValueAtTime(0, DUR);
  const sfx = ac.createGain(); sfx.gain.value = 0.8; sfx.connect(master);

  // light reverb from a generated impulse
  const rev = ac.createConvolver(); const ir = ac.createBuffer(2, SR * 2.6, SR); const r = rng(7);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] = (r() * 2 - 1) * Math.pow(1 - i / d.length, 3.2); }
  rev.buffer = ir; const revG = ac.createGain(); revG.gain.value = 0.28; rev.connect(revG); revG.connect(master);

  const brightFrom = (() => { const i = E.scenes.findIndex(s => s.type === 'turn'); return i >= 0 ? E.starts[i] : 0; })();
  const BPM = 84, beat = 60 / BPM, bar = beat * 4;

  function pad(f, t0, dur, vol) {
    const g = ac.createGain(); const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1100; lp.Q.value = 0.3;
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + 1.0); g.gain.setValueAtTime(vol, t0 + dur - 0.2); g.gain.linearRampToValueAtTime(0, t0 + dur + 1.2);
    for (const det of [-6, 6]) { const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det; o.connect(lp); o.start(t0); o.stop(t0 + dur + 1.3); }
    lp.connect(g); g.connect(music); g.connect(rev);
  }
  function keys(f, t0, vol) {
    const g = ac.createGain(); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.006); g.gain.exponentialRampToValueAtTime(0.0008, t0 + 1.6);
    const o1 = ac.createOscillator(); o1.type = 'sine'; o1.frequency.value = f;
    const o2 = ac.createOscillator(); o2.type = 'triangle'; o2.frequency.value = f * 2; const g2 = ac.createGain(); g2.gain.value = 0.18;
    o1.connect(g); o2.connect(g2); g2.connect(g); g.connect(music); g.connect(rev);
    o1.start(t0); o2.start(t0); o1.stop(t0 + 1.7); o2.stop(t0 + 1.7);
  }
  function bass(f, t0, dur, vol) {
    const g = ac.createGain(); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.05); g.gain.setTargetAtTime(vol * 0.6, t0 + 0.1, 0.8); g.gain.linearRampToValueAtTime(0, t0 + dur);
    const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = f; o.connect(g); g.connect(music); o.start(t0); o.stop(t0 + dur + 0.05);
  }

  let ci = 0;
  for (let t0 = 0; t0 < DUR; t0 += bar, ci++) {
    const bright = t0 >= brightFrom;
    const ch = (bright ? BRIGHT : REFLECT)[ci % 4];
    bass(mtof(ch[0]), t0, bar, 0.13);
    for (const n of ch.slice(1, 4)) pad(mtof(n), t0, bar, 0.018);
    const arp = [ch[1], ch[2], ch[3], ch[4], ch[3] + 12, ch[4], ch[3], ch[2]];
    const step = bright ? beat / 2 : beat;
    for (let k = 0; k * step < bar - 1e-6; k++) {
      const tt = t0 + k * step; if (tt > DUR - 2) break;
      keys(mtof(arp[k % arp.length] + 12), tt, (k % 4 === 0 ? 0.075 : 0.05) * (bright ? 1 : 0.85));
    }
  }

  // sound effects on visual cues
  const noise = ac.createBuffer(1, SR, SR); { const d = noise.getChannelData(0); const rr = rng(3); for (let i = 0; i < d.length; i++) d[i] = rr() * 2 - 1; }
  for (const [t, k] of E.cues()) {
    if (k === 'pop' || k === 'tick') {
      const o = ac.createOscillator(), g = ac.createGain(); o.type = 'sine';
      const f0 = k === 'pop' ? 760 : 1500;
      o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 0.55, t + 0.09);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(k === 'pop' ? 0.11 : 0.05, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.16);
      o.connect(g); g.connect(sfx); o.start(t); o.stop(t + 0.2);
    } else if (k === 'chime') {
      for (const [m, v] of [[86, 0.06], [93, 0.035], [98, 0.02]]) {
        const o = ac.createOscillator(), g = ac.createGain(); o.type = 'sine'; o.frequency.value = mtof(m);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0005, t + 2.2);
        o.connect(g); g.connect(sfx); g.connect(rev); o.start(t); o.stop(t + 2.3);
      }
    } else if (k === 'whoosh') {
      const s = ac.createBufferSource(); s.buffer = noise; const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.2;
      bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(2400, t + 0.6);
      const g = ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.07, t + 0.3); g.gain.linearRampToValueAtTime(0, t + 0.75);
      s.connect(bp); bp.connect(g); g.connect(sfx); s.start(t); s.stop(t + 0.8);
    }
  }
  return ac.startRendering();
}

function toWav(buf) {
  const n = buf.length, ch = buf.numberOfChannels, out = new DataView(new ArrayBuffer(44 + n * ch * 2));
  const ws = (o, s) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
  ws(0, 'RIFF'); out.setUint32(4, 36 + n * ch * 2, true); ws(8, 'WAVE'); ws(12, 'fmt ');
  out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, ch, true); out.setUint32(24, buf.sampleRate, true);
  out.setUint32(28, buf.sampleRate * ch * 2, true); out.setUint16(32, ch * 2, true); out.setUint16(34, 16, true); ws(36, 'data'); out.setUint32(40, n * ch * 2, true);
  const data = [...Array(ch)].map((_, c) => buf.getChannelData(c));
  let o = 44; for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { const v = Math.max(-1, Math.min(1, data[c][i])); out.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true); o += 2; }
  return new Uint8Array(out.buffer);
}

window.AUDIO = { renderAudio, toWav };
})();
