// Animation engine. Every frame is a pure function of time t (seconds), so the
// browser preview and the frame-by-frame MP4 render always match.
// Text and numbers come from content.js; nothing here should need editing to
// change wording.
(() => {
const C = window.CONTENT;
const W = 1920, H = 1080, FPS = C.fps || 30;
const COL = {
  cream: '#F5F1EE', card: '#FFFDFB', blue: '#385299', navy: '#1D2955',
  text: '#3F3F3F', soft: '#5A5A66', amber: '#F2B045', light: '#D5DCF0',
  // Illustration-only colors (Sarah, props). Not used for text.
  skin: '#D9A07E', skinShade: '#C48A69', hair: '#3B2A22', top: '#E07A5F', topShade: '#C9654C',
  pants: '#4A5A8F', pantsShade: '#3C4A78', shoe: '#FFFDFB', fridge: '#E6E9F2',
};
const SERIF = '"DM Serif Display", Georgia, serif';
const SANS = 'Carlito, Calibri, Arial, sans-serif';
const X0 = 160, CW = 1600;           // left margin, content width
const XF = 0.6;                       // crossfade between scenes (s)
const ARR = 0.7, STAG = 0.14;         // fade-up duration and stagger

let ctx;

// ── timing ──────────────────────────────────────────────────────────────────
const scenes = C.scenes;
let acc = 0;
const starts = scenes.map(s => { const a = acc; acc += s.dur; return a; });
const DUR = acc;

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const prog = (t, a, d) => clamp((t - a) / d);
const eOut = x => 1 - Math.pow(1 - x, 3);
const eIO = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const lerp = (a, b, k) => a + (b - a) * k;

function fmt(v, dec = 0) {
  const s = v.toFixed(dec);
  const [i, d] = s.split('.');
  return i.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (d ? '.' + d : '');
}
function countStr(o, t, at, d = 1.5) {
  const v = o.count * eOut(prog(t, at, d));
  return (o.prefix || '') + fmt(v, o.decimals || 0) + (o.suffix || '');
}

// Fade-up arrival: runs fn with alpha and vertical offset applied.
function arrive(t, at, fn, dist = 30, d = ARR) {
  const k = eOut(prog(t, at, d));
  if (k <= 0) return;
  ctx.save(); ctx.globalAlpha *= k; ctx.translate(0, dist * (1 - k)); fn(k); ctx.restore();
}
function fade(t, at, fn, d = ARR) {
  const k = eOut(prog(t, at, d)); if (k <= 0) return;
  ctx.save(); ctx.globalAlpha *= k; fn(k); ctx.restore();
}

// ── text ────────────────────────────────────────────────────────────────────
// text(str, x, y, opts) draws wrapped text (top baseline) and returns its height.
// opts: size, fam ('serif'|'sans'), weight, color, align, maxW, lh, spacing,
//       hl (substring to highlight), hlColor, hlWeight, dry (measure only)
// Words inside [square brackets] get a "to confirm" marker behind them.
function fontStr(fam, weight, size) { return `${weight} ${size}px ${fam === 'serif' ? SERIF : SANS}`; }
function text(str, x, y, o = {}) {
  const size = o.size || 40, fam = o.fam || 'sans', weight = o.weight || 400;
  const color = o.color || COL.text, align = o.align || 'left', lh = o.lh || 1.25;
  const hlW = o.hlWeight || weight, hlC = o.hlColor || color;
  ctx.save();
  ctx.textBaseline = 'top';
  ctx.letterSpacing = (o.spacing || 0) + 'px';
  // tag words
  let hlA = -1, hlB = -1;
  if (o.hl) { hlA = str.indexOf(o.hl); if (hlA >= 0) hlB = hlA + o.hl.length; }
  const marks = []; str.replace(/\[[^\]]*\]/g, (m, i) => { marks.push([i, i + m.length]); return m; });
  const words = []; let pos = 0;
  for (const w of str.split(' ')) {
    const isHl = pos >= hlA && pos < hlB;
    const isMark = marks.some(([a, b]) => pos >= a && pos < b);
    const f = fontStr(fam, isHl ? hlW : weight, size);
    ctx.font = f;
    words.push({ w, f, c: isHl ? hlC : color, mark: isMark, width: ctx.measureText(w).width });
    pos += w.length + 1;
  }
  ctx.font = fontStr(fam, weight, size);
  const sp = ctx.measureText(' ').width;
  const lines = []; let cur = [], cw = 0;
  for (const wd of words) {
    const add = (cur.length ? sp : 0) + wd.width;
    if (o.maxW && cur.length && cw + add > o.maxW) { lines.push({ ws: cur, w: cw }); cur = [wd]; cw = wd.width; }
    else { cur.push(wd); cw += add; }
  }
  if (cur.length) lines.push({ ws: cur, w: cw });
  if (!o.dry) {
    lines.forEach((ln, li) => {
      let lx = align === 'center' ? x - ln.w / 2 : align === 'right' ? x - ln.w : x;
      const ly = y + li * size * lh;
      ln.ws.forEach((wd, wi) => {
        if (wd.mark) {
          ctx.fillStyle = 'rgba(242,176,69,0.38)';
          ctx.beginPath(); ctx.roundRect(lx - 6, ly - size * 0.08, wd.width + 12 + (wi < ln.ws.length - 1 && ln.ws[wi + 1].mark ? sp : 0), size * 1.16, 6); ctx.fill();
        }
        ctx.font = wd.f; ctx.fillStyle = wd.c; ctx.textAlign = 'left';
        ctx.fillText(wd.w, lx, ly);
        lx += wd.width + sp;
      });
    });
  }
  ctx.restore();
  return lines.length * size * lh;
}
const eyebrow = (str, x, y, color, align = 'left') =>
  text(str, x, y, { size: 24, weight: 700, color, spacing: 4.5, align });

// ── shapes ──────────────────────────────────────────────────────────────────
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
function card(x, y, w, h, o = {}) {
  ctx.save();
  if (o.shadow !== false) {
    ctx.shadowColor = o.dark ? 'rgba(0,0,0,0.28)' : 'rgba(29,41,85,0.10)';
    ctx.shadowBlur = 44; ctx.shadowOffsetY = 16;
  }
  rr(x, y, w, h, o.r ?? 28); ctx.fillStyle = o.fill || COL.card; ctx.fill();
  ctx.restore();
  if (o.stroke) { ctx.save(); rr(x, y, w, h, o.r ?? 28); ctx.strokeStyle = o.stroke; ctx.lineWidth = 2; ctx.stroke(); ctx.restore(); }
}
function glassCard(x, y, w, h) { card(x, y, w, h, { fill: 'rgba(255,255,255,0.06)', stroke: 'rgba(213,220,240,0.20)', shadow: false }); }
function circle(x, y, r, fill) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); }

// ── backgrounds ─────────────────────────────────────────────────────────────
function bgCream(t) {
  ctx.fillStyle = COL.cream; ctx.fillRect(0, 0, W, H);
  const d = Math.sin(t * 0.12) * 30;
  circle(W - 80 + d, 120, 360, 'rgba(56,82,153,0.045)');
  circle(-60, H + 40 - d, 300, 'rgba(56,82,153,0.035)');
}
function blob(x, y, r, rgb, a) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function bgDark(t) {
  ctx.fillStyle = COL.navy; ctx.fillRect(0, 0, W, H);
  const s = t * 0.18;
  blob(380 + Math.sin(s) * 90, 260 + Math.cos(s * .8) * 60, 900, '70,104,200', 0.42);
  blob(1560 + Math.cos(s * .7) * 80, 300 + Math.sin(s) * 70, 820, '120,84,180', 0.34);
  blob(1300 + Math.sin(s * .6) * 110, 1080 + Math.cos(s * .9) * 40, 760, '232,138,60', 0.22);
  blob(200, 1000, 600, '29,41,85', 0.5);
}

// ── logo slot ───────────────────────────────────────────────────────────────
// Uses assets/logo-blue.png and assets/logo-white.png when present (embedded by
// build.mjs). Otherwise draws an empty placeholder box. Never draws a logo.
const LOGO = {};
for (const k of ['blue', 'white']) if (window.LOGO_SRC && window.LOGO_SRC[k]) { LOGO[k] = new Image(); LOGO[k].src = window.LOGO_SRC[k]; }
function logo(big, dark) {
  const box = big ? [120, 84, 280, 96] : [W - 120 - 170, H - 56 - 52, 170, 52];
  const img = dark ? LOGO.white : LOGO.blue;
  const [x, y, w, h] = box;
  if (img && img.complete && img.naturalWidth) {
    const k = Math.min(w / img.naturalWidth, h / img.naturalHeight);
    const iw = img.naturalWidth * k, ih = img.naturalHeight * k;
    ctx.drawImage(img, big ? x : x + w - iw, y + (h - ih) / 2, iw, ih);
    return;
  }
  ctx.save();
  rr(x, y, w, h, 12); ctx.setLineDash([8, 7]); ctx.lineWidth = 2;
  ctx.strokeStyle = dark ? 'rgba(213,220,240,0.45)' : 'rgba(56,82,153,0.40)'; ctx.stroke();
  ctx.restore();
  text('LOGO', x + w / 2, y + h / 2 - (big ? 11 : 8), { size: big ? 22 : 16, weight: 700, spacing: 4, align: 'center', color: dark ? 'rgba(213,220,240,0.6)' : 'rgba(56,82,153,0.55)' });
}

// ── icons (24-unit line icons, Lucide-style) ────────────────────────────────
const ICONS = {
  package: 'M21 8l-9-5-9 5v8l9 5 9-5z M3 8l9 5 9-5 M12 13v8 M7.5 5.5l9 5',
  pill: 'M8 2h8v4H8z M7 6h10a1 1 0 0 1 1 1v13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7a1 1 0 0 1 1-1z M6 11h12 M6 17h12',
  shirt: 'M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z',
  message: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z M8 9h8 M8 13h5',
  tag: 'M3 3h8l10 10-8 8L3 11z M7.5 7.5m-1.4 0a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0-2.8 0',
  truck: 'M2 5h12v11H2z M14 9h4l4 4v3h-8 M6.5 18m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0 M17.5 18m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0',
  gift: 'M3 8h18v4H3z M5 12v9h14v-9 M12 8v13 M12 8c-3 0-5-1-5-2.6S8.8 3 12 8 M12 8c3 0 5-1 5-2.6S15.2 3 12 8',
  heart: 'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7z',
  phone: 'M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z M11 18h2',
  star: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z',
  clock: 'M12 12m-10 0a10 10 0 1 0 20 0a10 10 0 1 0-20 0 M12 6v6l4 2',
  refresh: 'M3 12a9 9 0 0 1 15-6.7L21 8 M21 3v5h-5 M21 12a9 9 0 0 1-15 6.7L3 16 M3 21v-5h5',
  target: 'M12 12m-10 0a10 10 0 1 0 20 0a10 10 0 1 0-20 0 M12 12m-6 0a6 6 0 1 0 12 0a6 6 0 1 0-12 0 M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 7m-4 0a4 4 0 1 0 8 0a4 4 0 1 0-8 0 M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
  user: 'M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2 M12 7m-4 0a4 4 0 1 0 8 0a4 4 0 1 0-8 0',
  plane: 'M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z',
  dollar: 'M12 2v20 M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  trophy: 'M6 9H4.5a2.5 2.5 0 0 1 0-5H6 M18 9h1.5a2.5 2.5 0 0 0 0-5H18 M4 22h16 M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22 M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22 M18 2H6v7a6 6 0 0 0 12 0V2z',
  building: 'M4 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18 M16 10h2a2 2 0 0 1 2 2v10 M2 22h20 M8 6h4 M8 10h4 M8 14h4 M8 18h4',
  check: 'M5 12l5 5L20 7',
};
const P2D = {};
function icon(name, cx, cy, size, color, lw = 2) {
  const p = P2D[name] || (P2D[name] = new Path2D(ICONS[name]));
  ctx.save(); ctx.translate(cx - size / 2, cy - size / 2); ctx.scale(size / 24, size / 24);
  ctx.lineWidth = lw; ctx.strokeStyle = color; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.stroke(p); ctx.restore();
}
function badge(name, cx, cy, r, dark) {
  circle(cx, cy, r, dark ? 'rgba(242,176,69,0.16)' : 'rgba(56,82,153,0.10)');
  icon(name, cx, cy, r * 1.05, dark ? COL.amber : COL.blue, 2);
}

// ── Sarah (original, simple illustrated composite customer) ─────────────────
// Origin at her feet; about 600 units tall at scale 1.
function seg2(x, y, a1, l1, a2, l2, w, color) {
  const x2 = x + Math.sin(a1) * l1, y2 = y + Math.cos(a1) * l1;
  const x3 = x2 + Math.sin(a2) * l2, y3 = y2 + Math.cos(a2) * l2;
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.stroke();
  return [x3, y3, Math.atan2(Math.sin(a2), Math.cos(a2))];
}
function sarahPose(pose, t) {
  const P = { bob: 0, lean: 0, back: [0.07, 0.07], front: [-0.07, -0.07], bArm: [-0.14, -0.06], fArm: [0.14, 0.06], pony: Math.sin(t * 1.3) * 0.05 };
  if (pose === 'think') { P.fArm = [0.28, Math.PI + 0.02]; }
  if (pose === 'wave') { P.fArm = [Math.PI - 0.55, Math.PI - 0.15 + Math.sin(t * 7) * 0.32]; }
  if (pose === 'cheer') {
    const w = Math.sin(t * 5) * 0.12;
    P.fArm = [Math.PI - 0.45 + w, Math.PI - 0.25 + w]; P.bArm = [Math.PI + 0.45 - w, Math.PI + 0.25 - w];
    P.bob = -Math.abs(Math.sin(t * 5)) * 8;
  }
  if (pose === 'run') {
    const ph = t * Math.PI * 2 * 1.35, s = Math.sin(ph);
    const th = 0.62 * s;
    P.front = [th, th - (0.25 + 0.95 * Math.max(0, -Math.cos(ph)))];
    P.back = [-th, -th - (0.25 + 0.95 * Math.max(0, Math.cos(ph)))];
    P.fArm = [-0.7 * s, -0.7 * s + 1.5]; P.bArm = [0.7 * s, 0.7 * s + 1.5];
    P.bob = -Math.abs(Math.cos(ph)) * 14; P.lean = 0.12;
    P.pony = -0.35 + Math.sin(ph * 2) * 0.12;
  }
  return P;
}
function sarah(x, y, s, pose, t, dir = 1) {
  const P = sarahPose(pose, t);
  ctx.save(); ctx.translate(x, y); ctx.scale(s * dir, s);
  // ground shadow
  ctx.save(); ctx.scale(1, 0.18); circle(0, 30, 120, 'rgba(29,41,85,0.12)'); ctx.restore();
  ctx.translate(0, P.bob); ctx.rotate(P.lean);
  const hip = [0, -268], sh = [0, -462];
  const foot = (pt, a) => { ctx.save(); ctx.translate(pt[0], pt[1]); ctx.rotate(-a + Math.PI / 2 - Math.PI / 2); rr(-14, -8, 44, 20, 10); ctx.fillStyle = COL.shoe; ctx.fill(); ctx.restore(); };
  // back leg + arm
  const bf = seg2(hip[0] - 10, hip[1], P.back[0], 132, P.back[1], 132, 40, COL.pantsShade); foot(bf, 0);
  seg2(sh[0] - 22, sh[1] + 12, P.bArm[0], 108, P.bArm[1], 98, 26, COL.topShade);
  // torso
  ctx.beginPath();
  ctx.moveTo(-50, -478); ctx.quadraticCurveTo(0, -494, 50, -478);
  ctx.lineTo(46, -262); ctx.quadraticCurveTo(0, -250, -46, -262); ctx.closePath();
  ctx.fillStyle = COL.top; ctx.fill();
  rr(-48, -300, 96, 46, 18); ctx.fillStyle = COL.pants; ctx.fill();
  // front leg
  const ff = seg2(hip[0] + 10, hip[1], P.front[0], 132, P.front[1], 132, 40, COL.pants); foot(ff, 0);
  // neck + head
  rr(-12, -506, 24, 36, 10); ctx.fillStyle = COL.skinShade; ctx.fill();
  ctx.save(); ctx.translate(-34, -566); ctx.rotate(P.pony);
  ctx.beginPath(); ctx.ellipse(-24, 22, 22, 46, 0.35, 0, Math.PI * 2); ctx.fillStyle = COL.hair; ctx.fill(); ctx.restore();
  circle(0, -552, 52, COL.hair);
  circle(6, -544, 45, COL.skin);
  ctx.beginPath(); ctx.ellipse(0, -584, 50, 24, -0.12, Math.PI, Math.PI * 2.08); ctx.fillStyle = COL.hair; ctx.fill();
  circle(-8, -546, 4.5, COL.hair); circle(22, -546, 4.5, COL.hair);
  ctx.beginPath(); ctx.arc(9, -530, 11, 0.25 * Math.PI, 0.75 * Math.PI); ctx.strokeStyle = COL.hair; ctx.lineWidth = 3.5; ctx.lineCap = 'round'; ctx.stroke();
  circle(-20, -530, 6, 'rgba(224,122,95,0.35)'); circle(34, -530, 6, 'rgba(224,122,95,0.35)');
  // front arm
  const hand = seg2(sh[0] + 22, sh[1] + 12, P.fArm[0], 108, P.fArm[1], 98, 26, COL.top);
  circle(hand[0], hand[1], 14, COL.skin);
  ctx.restore();
}

// ── scenes ──────────────────────────────────────────────────────────────────
// Each type: draw(t, s) and cues(s) (sound-effect times in local seconds).
const S = {};

S.cover = {
  draw(t, s) {
    bgCream(t);
    arrive(t, 0.9, () => {
      circle(1460, 560, 400, 'rgba(56,82,153,0.07)');
      circle(1460, 560, 300, 'rgba(56,82,153,0.06)');
      sarah(1460, 900, 0.72, t > 3 ? 'wave' : 'stand', t);
    }, 20, 1.0);
    fade(t, 0.2, () => logo(true, false));
    arrive(t, 0.4, () => { ctx.fillStyle = COL.blue; ctx.fillRect(X0, 330, 90 * eOut(prog(t, 0.4, 1)), 5); eyebrow(s.eyebrow, X0, 360, COL.blue); });
    let y = 410;
    const th = text(s.title, X0, y, { size: 112, fam: 'serif', maxW: 1000, lh: 1.06, dry: true });
    arrive(t, 0.4 + STAG, () => text(s.title, X0, y, { size: 112, fam: 'serif', color: COL.blue, maxW: 1000, lh: 1.06 }));
    arrive(t, 0.4 + STAG * 2, () => text(s.sub, X0, y + th + 36, { size: 38, color: COL.soft, maxW: 860, lh: 1.35 }));
  },
  cues: () => [[0.5, 'chime']],
};

S.meet = {
  draw(t, s) {
    bgCream(t); logo(false, false);
    arrive(t, 0.3, () => eyebrow(s.eyebrow, X0, 250, COL.blue));
    arrive(t, 0.44, () => text(s.title, X0, 296, { size: 124, fam: 'serif', color: COL.blue }));
    arrive(t, 1.0, () => text(s.body, X0, 470, { size: 44, color: COL.text, maxW: 860, lh: 1.38 }));
    fade(t, 3.0, () => text(s.note, X0, H - 112, { size: 24, color: COL.soft }));
    // fridge
    arrive(t, 0.6, () => {
      card(1240, 150, 500, 820, { fill: COL.fridge, r: 40 });
      ctx.fillStyle = 'rgba(29,41,85,0.10)'; ctx.fillRect(1240, 420, 500, 4);
      rr(1680, 220, 14, 140, 7); ctx.fillStyle = 'rgba(29,41,85,0.22)'; ctx.fill();
      rr(1680, 480, 14, 200, 7); ctx.fill();
    }, 20);
    // note on fridge
    const k = eOut(prog(t, 2.0, 0.9));
    if (k > 0) {
      ctx.save(); ctx.globalAlpha *= k; ctx.translate(1440, 600); ctx.rotate(-0.06 * k); ctx.scale(0.9 + 0.1 * k, 0.9 + 0.1 * k);
      card(-165, -115, 330, 230, { r: 10 });
      circle(0, -112, 16, COL.blue);
      text(s.fridgeNote, 0, -62, { size: 40, fam: 'serif', color: COL.blue, align: 'center', maxW: 270, lh: 1.12 });
      ctx.restore();
    }
    arrive(t, 1.1, () => sarah(1180, 1010, 0.72, t > 4.2 ? 'think' : 'stand', t), 20);
  },
  cues: () => [[2.0, 'pop']],
};

S.tuesday = {
  draw(t, s) {
    bgCream(t); logo(false, false);
    arrive(t, 0.3, () => text(s.title, X0, 150, { size: 84, fam: 'serif', color: COL.blue, maxW: CW }));
    const w = 370, gap = 40, y = 330, h = 300;
    s.cards.forEach((c, i) => {
      const at = 1.1 + i * 0.55, x = X0 + i * (w + gap);
      const k = eOut(prog(t, at, ARR));
      if (k <= 0) return;
      ctx.save(); ctx.globalAlpha *= k; ctx.translate(x + w / 2, y + h / 2 + 30 * (1 - k)); ctx.scale(0.96 + 0.04 * k, 0.96 + 0.04 * k); ctx.translate(-(x + w / 2), -(y + h / 2));
      card(x, y, w, h);
      badge(c.icon, x + 80, y + 88, 44);
      rr(x + w - 76, y + 40, 32, 32, 8); ctx.strokeStyle = 'rgba(90,90,102,0.45)'; ctx.lineWidth = 2.5; ctx.stroke();
      text(c.text, x + 40, y + 168, { size: 34, weight: 700, color: COL.text, maxW: w - 80, lh: 1.2 });
      ctx.restore();
    });
    arrive(t, 5.2, () => text(s.close, X0, 720, { size: 46, color: COL.soft, maxW: 1450, lh: 1.35, hl: s.close.split('. ')[0] + '.', hlColor: COL.navy, hlWeight: 700 }));
  },
  cues: s => s.cards.map((_, i) => [1.1 + i * 0.55, 'pop']),
};

S.stats = {
  draw(t, s) {
    bgDark(t); logo(false, true);
    arrive(t, 0.3, () => eyebrow(s.eyebrow, X0, 200, COL.amber));
    arrive(t, 0.44, () => text(s.title, X0, 246, { size: 84, fam: 'serif', color: COL.card, maxW: CW }));
    const w = 500, gap = 50, y = 430, h = 380;
    s.stats.forEach((st, i) => {
      const at = 1.2 + i * 0.8, x = X0 + i * (w + gap);
      arrive(t, at, () => {
        glassCard(x, y, w, h);
        text(countStr(st, t, at + 0.15), x + 50, y + 56, { size: 150, fam: 'serif', color: COL.amber });
        text(st.label, x + 50, y + 250, { size: 34, color: COL.light, maxW: w - 100, lh: 1.3 });
      });
    });
    fade(t, 4.0, () => text(s.source, X0, H - 128, { size: 22, color: 'rgba(213,220,240,0.78)', maxW: 1380, lh: 1.35 }));
  },
  cues: s => s.stats.map((_, i) => [1.2 + i * 0.8, 'pop']),
};

S.gym = {
  draw(t, s) {
    bgCream(t); logo(false, false);
    arrive(t, 0.3, () => eyebrow(s.eyebrow, X0, 150, COL.blue));
    arrive(t, 0.44, () => text(s.title, X0, 196, { size: 80, fam: 'serif', color: COL.blue, maxW: CW }));
    const out = eIO(prog(t, 7.6, 0.8));
    if (out < 1) {
      ctx.save(); ctx.globalAlpha *= 1 - out; ctx.translate(0, -30 * out);
      arrive(t, 1.0, () => {
        card(X0, 380, 760, 440);
        text(countStr(s.stat, t, 1.2), X0 + 56, 420, { size: 220, fam: 'serif', color: COL.blue });
        text(s.statLabel, X0 + 60, 680, { size: 36, color: COL.text, maxW: 640, lh: 1.3 });
      });
      arrive(t, 1.0 + STAG * 3, () => {
        const x = 960, y = 380; card(x, y, 800, 440);
        eyebrow(s.weekLabel.toUpperCase(), x + 56, y + 50, COL.blue);
        const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
        const rows = s.weekRows || ['Goes', 'Pays'];
        rows.forEach((lab, r) => {
          const ry = y + 170 + r * 150;
          text(lab, x + 56, ry - 18, { size: 32, weight: 700, color: COL.text });
          days.forEach((d, i) => {
            const cx = x + 230 + i * 78;
            const on = r === 0 ? (i === 1 && t > 3.0) : t > 3.6 + i * 0.12;
            circle(cx, ry, 30, on ? COL.blue : 'rgba(56,82,153,0.08)');
            if (on && r === 0) icon('check', cx, ry, 30, COL.card, 3);
            else if (on) text('$', cx, ry - 15, { size: 30, weight: 700, color: COL.card, align: 'center' });
            else text(d, cx, ry - 13, { size: 26, weight: 700, color: 'rgba(56,82,153,0.5)', align: 'center' });
          });
        });
      });
      fade(t, 3.0, () => text(s.source, X0, H - 120, { size: 22, color: COL.soft }));
      ctx.restore();
    }
    arrive(t, 8.2, () => text(s.quote, W / 2, 400, { size: 66, fam: 'serif', color: COL.blue, align: 'center', maxW: 1400, lh: 1.15 }));
    arrive(t, 10.6, () => {
      card(X0, 690, CW, 180, { fill: COL.navy });
      text(s.close, W / 2, 742, { size: 40, color: COL.card, align: 'center', maxW: 1400, lh: 1.3 });
    });
  },
  cues: () => [[1.0, 'pop'], [3.0, 'chime'], [8.2, 'whoosh'], [10.6, 'pop']],
};

S.turn = {
  draw(t, s) {
    bgDark(t); logo(false, true);
    arrive(t, 0.3, () => eyebrow(s.eyebrow, W / 2, 160, COL.amber, 'center'));
    arrive(t, 0.44, () => text(s.title, W / 2, 210, { size: 96, fam: 'serif', color: COL.card, align: 'center', maxW: 1400, lh: 1.08 }));
    arrive(t, 1.4, () => text(s.sub, W / 2, 445, { size: 38, color: COL.light, align: 'center', maxW: 1250, lh: 1.35 }));
    const yI = 790, pts = [[560, s.fromLabel, 'building'], [960, 'Sarah', 'user'], [1360, s.toLabel, 'users']];
    const dim = eOut(prog(t, 6.0, 0.8)), glow = eOut(prog(t, 8.0, 0.6));
    pts.forEach(([x, lab, ic], i) => arrive(t, 2.4 + i * STAG, () => {
      ctx.save();
      if (i === 0) ctx.globalAlpha *= 1 - 0.55 * dim;
      if (i === 2 && glow > 0) circle(x, yI, 70 + 16 * glow, `rgba(242,176,69,${0.25 * glow})`);
      circle(x, yI, 70, 'rgba(255,255,255,0.07)');
      ctx.beginPath(); ctx.arc(x, yI, 70, 0, Math.PI * 2); ctx.strokeStyle = i === 2 && glow > 0 ? COL.amber : 'rgba(213,220,240,0.3)'; ctx.lineWidth = 2; ctx.stroke();
      icon(ic, x, yI, 64, i === 2 && glow > 0 ? COL.amber : COL.light, 1.8);
      text(lab, x, yI + 98, { size: 28, weight: 700, color: COL.light, align: 'center' });
      ctx.restore();
    }));
    // the $20 coin
    if (t > 3.6) {
      let cx = 960, cy = yI;
      const a = eIO(prog(t, 4.2, 1.3)), b = eIO(prog(t, 6.2, 1.8));
      if (b <= 0) { cx = lerp(960, 650, a); cy = yI - Math.sin(a * Math.PI) * 60; }
      else { cx = lerp(650, 1270, b); cy = yI - Math.sin(b * Math.PI) * 200; }
      fade(t, 3.6, () => {
        circle(cx, cy, 36, COL.amber);
        text('$20', cx, cy - 13, { size: 26, weight: 700, color: COL.navy, align: 'center' });
      }, 0.4);
    }
  },
  cues: () => [[3.6, 'pop'], [4.2, 'whoosh'], [6.2, 'whoosh'], [8.0, 'chime']],
};

S.perks = {
  draw(t, s) {
    bgCream(t); logo(false, false);
    arrive(t, 0.3, () => eyebrow(s.eyebrow, X0, 120, COL.blue));
    arrive(t, 0.44, () => text(s.title, X0, 162, { size: 58, fam: 'serif', color: COL.blue, maxW: CW }));
    const w = (CW - 80) / 3, h = 280, gap = 36;
    s.perks.forEach((p, i) => {
      const x = X0 + (i % 3) * (w + 40), y = 290 + Math.floor(i / 3) * (h + gap);
      arrive(t, 1.2 + i * 0.85, () => {
        card(x, y, w, h);
        badge(p.icon, x + 76, y + 80, 40);
        text(p.big, x + 136, y + 50, { size: 54, fam: 'serif', color: COL.blue, maxW: w - 160 });
        text(p.text, x + 44, y + 150, { size: 30, color: COL.soft, maxW: w - 88, lh: 1.3 });
      });
    });
    fade(t, 7.0, () => text(s.footnote, X0, 930, { size: 22, color: COL.soft, maxW: 1360, lh: 1.4 }));
  },
  cues: s => s.perks.map((_, i) => [1.2 + i * 0.85, 'pop']),
};

S.math = {
  draw(t, s) {
    bgCream(t); logo(false, false);
    arrive(t, 0.3, () => eyebrow(s.eyebrow, X0, 140, COL.blue));
    arrive(t, 0.44, () => text(s.title, X0, 186, { size: 80, fam: 'serif', color: COL.blue, maxW: CW }));
    const xs = [520, 960, 1400], cy = 500, r = 150;
    s.items.forEach((it, i) => {
      const at = 1.2 + i * 1.0;
      arrive(t, at, () => {
        ctx.save(); ctx.shadowColor = 'rgba(29,41,85,0.12)'; ctx.shadowBlur = 44; ctx.shadowOffsetY = 16;
        circle(xs[i], cy, r, COL.card); ctx.restore();
        ctx.beginPath(); ctx.arc(xs[i], cy, r - 10, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(56,82,153,0.18)'; ctx.lineWidth = 3; ctx.stroke();
        if (it.top) eyebrow(it.top, xs[i], cy - 88, COL.blue, 'center');
        text(countStr({ prefix: '$', count: it.count }, t, at + 0.1, 1.1), xs[i], cy - 58, { size: 116, fam: 'serif', color: COL.blue, align: 'center' });
        text(it.label, xs[i], cy + r + 26, { size: 32, color: COL.text, align: 'center', maxW: 380 });
      });
      if (i > 0) fade(t, at - 0.2, () => text('+', (xs[i] + xs[i - 1]) / 2, cy - 50, { size: 90, fam: 'serif', color: COL.soft, align: 'center' }));
    });
    arrive(t, 4.6, () => text('= ' + s.total, W / 2, 760, { size: 70, fam: 'serif', color: COL.blue, align: 'center' }));
    arrive(t, 6.2, () => {
      card(X0, 880, CW, 120, { fill: COL.navy });
      text(s.bar, W / 2, 920, { size: 38, color: COL.card, align: 'center', maxW: 1500, hl: s.barHighlight || 'Up to 5×', hlColor: COL.amber, hlWeight: 700 });
    });
  },
  cues: s => [...s.items.map((_, i) => [1.2 + i * 1.0, 'pop']), [4.6, 'chime'], [6.2, 'pop']],
};

S.statement = {
  draw(t, s) {
    bgDark(t); logo(false, true);
    arrive(t, 0.4, () => eyebrow(s.eyebrow, W / 2, 330, COL.amber, 'center'));
    const h1 = text(s.line1, W / 2, 0, { size: 84, fam: 'serif', maxW: 1500, lh: 1.12, dry: true });
    arrive(t, 0.9, () => text(s.line1, W / 2, 390, { size: 84, fam: 'serif', color: COL.light, align: 'center', maxW: 1500, lh: 1.12 }));
    arrive(t, 4.0, () => text(s.line2, W / 2, 390 + h1 + 24, { size: 84, fam: 'serif', color: COL.amber, align: 'center', maxW: 1500, lh: 1.12 }), 24, 1.0);
  },
  cues: () => [[4.0, 'chime']],
};

S.year = {
  draw(t, s) {
    bgCream(t); logo(false, false);
    arrive(t, 0.3, () => eyebrow(s.eyebrow, X0, 140, COL.blue));
    arrive(t, 0.44, () => text(s.title, X0, 186, { size: 72, fam: 'serif', color: COL.blue, maxW: CW, lh: 1.08 }));
    const y = 390, w = 780, h = 380;
    arrive(t, 1.2, () => {
      card(X0, y, w, h);
      eyebrow('SHE PAYS', X0 + 60, y + 50, COL.blue);
      text(countStr({ prefix: '$', count: parseFloat(s.pays.big.replace(/[^\d.]/g, '')) }, t, 1.3), X0 + 56, y + 92, { size: 160, fam: 'serif', color: COL.blue });
      text(s.pays.label, X0 + 60, y + 262, { size: 36, weight: 700, color: COL.text, maxW: w - 120 });
      text(s.pays.detail, X0 + 60, y + 310, { size: 30, color: COL.soft });
    });
    arrive(t, 2.8, () => {
      const x = X0 + w + 40; card(x, y, w, h, { fill: COL.navy, dark: true });
      eyebrow(s.gets.top, x + 60, y + 50, COL.amber);
      text(countStr({ prefix: '$', count: parseFloat(s.gets.big.replace(/[^\d.]/g, '')) }, t, 2.9), x + 56, y + 92, { size: 160, fam: 'serif', color: COL.amber });
      text(s.gets.label, x + 60, y + 262, { size: 34, weight: 700, color: COL.card, maxW: w - 120 });
      text(s.gets.detail, x + 60, y + 306, { size: 28, color: COL.light, maxW: w - 120, lh: 1.3 });
    });
    arrive(t, 6.0, () => text(s.after, X0, 815, { size: 44, weight: 700, color: COL.blue }));
    arrive(t, 8.2, () => text(s.monthly, X0, 878, { size: 40, color: COL.text, maxW: CW, hl: s.monthlyHighlight || 'up to $1,200 in value a year', hlColor: COL.blue, hlWeight: 700 }));
  },
  cues: () => [[1.2, 'pop'], [2.8, 'chime'], [6.0, 'pop'], [8.2, 'pop']],
};

S.bigger = {
  draw(t, s) {
    bgCream(t); logo(false, false);
    arrive(t, 0.3, () => eyebrow(s.eyebrow, X0, 140, COL.blue));
    arrive(t, 0.44, () => text(s.title, X0, 186, { size: 76, fam: 'serif', color: COL.blue, maxW: 1120, lh: 1.1 }));
    s.rows.forEach((r, i) => {
      const y = 420 + i * 128;
      arrive(t, 1.3 + i * 0.9, () => {
        card(X0, y, 1060, 110, { r: 24 });
        badge(r.icon, X0 + 66, y + 55, 34);
        text(r.title, X0 + 128, y + 18, { size: 34, weight: 700, color: COL.text });
        text(r.text, X0 + 128, y + 60, { size: 28, color: COL.soft, maxW: 900 });
      });
    });
    arrive(t, 0.8, () => {
      circle(1520, 610, 270, 'rgba(56,82,153,0.07)');
      ctx.save(); ctx.beginPath(); ctx.arc(1520, 610, 270, 0, Math.PI * 2); ctx.clip();
      ctx.strokeStyle = 'rgba(56,82,153,0.18)'; ctx.lineWidth = 4; ctx.setLineDash([30, 26]); ctx.lineDashOffset = t * 260;
      ctx.beginPath(); ctx.moveTo(1200, 800); ctx.lineTo(1840, 800); ctx.stroke(); ctx.restore();
      sarah(1520, 800, 0.62, 'run', t);
    }, 20);
  },
  cues: s => s.rows.map((_, i) => [1.3 + i * 0.9, 'pop']),
};

S.bundle = {
  draw(t, s) {
    bgCream(t); logo(false, false);
    arrive(t, 0.3, () => eyebrow(s.eyebrow, X0, 120, COL.blue));
    arrive(t, 0.44, () => text(s.title, X0, 162, { size: 72, fam: 'serif', color: COL.blue, maxW: CW }));
    const x = X0, y = 280, w = 1000, h = 660;
    arrive(t, 0.9, () => card(x, y, w, h));
    let ly = y + 50;
    s.lines.forEach((ln, i) => {
      const at = 1.4 + i * 0.75, rowY = ly;
      arrive(t, at, () => {
        text(ln.label, x + 50, rowY, { size: 31, color: COL.text, maxW: 700 });
        const free = /FREE|−/.test(ln.value);
        text(ln.value, x + w - 50, rowY - 2, { size: 34, weight: 700, color: free ? COL.blue : COL.text, align: 'right' });
        if (i === 0 && s.clears) {
          ctx.font = fontStr('sans', 700, 22); ctx.letterSpacing = '1px';
          const pw = ctx.measureText(s.clears).width + 64; ctx.letterSpacing = '0px';
          rr(x + 50, rowY + 46, pw, 38, 19); ctx.fillStyle = 'rgba(56,82,153,0.10)'; ctx.fill();
          icon('check', x + 72, rowY + 65, 20, COL.blue, 3);
          text(s.clears, x + 90, rowY + 54, { size: 22, weight: 700, color: COL.blue, spacing: 1 });
        }
      }, 16);
      ly += i === 0 ? 116 : 76;
    });
    const at2 = 1.4 + s.lines.length * 0.75;
    arrive(t, at2, () => {
      ctx.save(); ctx.setLineDash([10, 8]); ctx.strokeStyle = 'rgba(90,90,102,0.35)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x + 50, ly + 4); ctx.lineTo(x + w - 50, ly + 4); ctx.stroke(); ctx.restore();
      text(s.totalLabel, x + 50, ly + 44, { size: 36, weight: 700, color: COL.navy });
      text(s.totalValue, x + w - 50, ly + 22, { size: 70, fam: 'serif', color: COL.blue, align: 'right' });
    }, 16);
    fade(t, at2 + 0.6, () => text(s.costLine, X0, 966, { size: 24, color: COL.soft }));
    const at3 = at2 + 1.4;
    arrive(t, at3, () => {
      const cx = 1200, cw = 560; card(cx, y, cw, h, { fill: COL.navy, dark: true });
      eyebrow('HER COST', cx + cw / 2, y + 70, COL.amber, 'center');
      text((s.perCan.prefix || '') + fmt(s.perCan.count, s.perCan.decimals || 0) + (s.perCan.suffix || ''), cx + cw / 2, y + 130, { size: 190, fam: 'serif', color: COL.amber, align: 'center' });
      text(s.perCanUnit, cx + cw / 2, y + 340, { size: 42, weight: 700, color: COL.card, align: 'center' });
      text(s.perCanDetail, cx + cw / 2, y + 420, { size: 30, color: COL.light, align: 'center', maxW: 460, lh: 1.35 });
    });
  },
  cues: s => [...s.lines.map((_, i) => [1.4 + i * 0.75, 'tick']), [1.4 + s.lines.length * 0.75, 'pop'], [2.8 + s.lines.length * 0.75, 'chime']],
};

S.pricing = {
  draw(t, s) {
    bgCream(t); logo(false, false);
    arrive(t, 0.3, () => eyebrow(s.eyebrow, X0, 130, COL.blue));
    arrive(t, 0.44, () => text(s.title, X0, 174, { size: 70, fam: 'serif', color: COL.blue, maxW: 1500, lh: 1.1 }));
    const y = 380, w = 780, h = 360;
    const side = (o, x, dark, at) => arrive(t, at, () => {
      card(x, y, w, h, dark ? { fill: COL.navy, dark: true } : {});
      eyebrow(o.tag, x + 60, y + 50, dark ? COL.amber : COL.blue);
      const num = parseFloat(o.big.replace(/[^\d.]/g, ''));
      text(o.big, x + 56, y + 92, { size: 150, fam: 'serif', color: dark ? COL.amber : COL.blue });
      text(o.unit, x + 60, y + 258, { size: 34, weight: 700, color: dark ? COL.card : COL.text });
      text(o.detail, x + 60, y + 302, { size: 28, color: dark ? COL.light : COL.soft, maxW: w - 120 });
    });
    side(s.left, X0, true, 1.2);
    side(s.right, X0 + w + 40, false, 1.2 + STAG * 4);
    arrive(t, 4.2, () => text(s.pv, X0, 790, { size: 38, weight: 700, color: COL.text, maxW: CW }));
    arrive(t, 5.6, () => text(s.why, X0, 850, { size: 36, color: COL.soft, maxW: 1450, lh: 1.35 }));
  },
  cues: () => [[1.2, 'pop'], [1.76, 'pop'], [4.2, 'tick'], [5.6, 'tick']],
};

S.launch = {
  draw(t, s) {
    bgCream(t); logo(false, false);
    arrive(t, 0.3, () => eyebrow(s.eyebrow, X0, 130, COL.blue));
    arrive(t, 0.44, () => text(s.title, X0, 174, { size: 80, fam: 'serif', color: COL.blue, maxW: CW }));
    const w = (CW - 80) / 3, y = 320, h = 600;
    s.cards.forEach((c, i) => {
      const x = X0 + i * (w + 40);
      arrive(t, 1.2 + i * 1.1, () => {
        card(x, y, w, h);
        badge(c.icon, x + 86, y + 92, 46);
        let yy = y + 178;
        yy += text(c.title, x + 50, yy, { size: 44, fam: 'serif', color: COL.blue, maxW: w - 100, lh: 1.1 }) + 18;
        text(c.text, x + 50, yy, { size: 29, color: COL.text, maxW: w - 100, lh: 1.32 });
        text(c.small, x + 50, y + h - 96, { size: 25, weight: 700, color: COL.soft, maxW: w - 100, lh: 1.3 });
      });
    });
  },
  cues: s => s.cards.map((_, i) => [1.2 + i * 1.1, 'pop']),
};

S.close = {
  draw(t, s) {
    bgDark(t); logo(false, true);
    arrive(t, 0.4, () => eyebrow(s.eyebrow, X0, 250, COL.amber));
    const th = text(s.title, X0, 0, { size: 104, fam: 'serif', maxW: 860, lh: 1.06, dry: true });
    arrive(t, 0.54, () => text(s.title, X0, 296, { size: 104, fam: 'serif', color: COL.card, maxW: 860, lh: 1.06 }));
    const sh = text(s.sub, X0, 0, { size: 38, maxW: 820, lh: 1.35, dry: true });
    arrive(t, 1.4, () => text(s.sub, X0, 296 + th + 34, { size: 38, color: COL.light, maxW: 820, lh: 1.35 }));
    arrive(t, 6.4, () => text(s.cta, X0, 296 + th + 34 + sh + 46, { size: 38, weight: 700, color: COL.amber, maxW: 820, lh: 1.3 }));
    // finish line
    const gy = 880, fx = 1600;
    fade(t, 0.6, () => {
      ctx.fillStyle = 'rgba(213,220,240,0.25)'; ctx.fillRect(1060, gy, 780, 3);
      ctx.fillStyle = COL.light; ctx.fillRect(fx - 150, 400, 10, gy - 400); ctx.fillRect(fx + 140, 400, 10, gy - 400);
      rr(fx - 170, 350, 340, 90, 14); ctx.fillStyle = COL.amber; ctx.fill();
      text(s.finish, fx, 366, { size: 60, fam: 'serif', color: COL.navy, align: 'center' });
    });
    const cross = 5.0, runK = prog(t, 0.8, cross - 0.8);
    const sx = t < cross ? lerp(1120, fx, eIO(runK) * 0.75 + runK * 0.25) : lerp(fx, fx + 60, eOut(prog(t, cross, 1.2)));
    // ribbon
    const br = eOut(prog(t, cross, 0.9));
    ctx.save(); ctx.strokeStyle = COL.amber; ctx.lineWidth = 6; ctx.lineCap = 'round';
    if (br <= 0) { ctx.beginPath(); ctx.moveTo(fx - 140, 700); ctx.quadraticCurveTo(fx, 712, fx + 140, 700); ctx.stroke(); }
    else {
      ctx.beginPath(); ctx.moveTo(fx - 140, 700); ctx.quadraticCurveTo(fx - 100, 720 + 60 * br, fx - 80 + 10 * br, 760 + 110 * br); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(fx + 140, 700); ctx.quadraticCurveTo(fx + 100, 720 + 60 * br, fx + 80 - 10 * br, 760 + 110 * br); ctx.stroke();
    }
    ctx.restore();
    if (br > 0) for (let i = 0; i < 14; i++) {
      const a = i / 14 * Math.PI * 2 + 0.3, d = 60 + 220 * br;
      circle(fx + Math.cos(a) * d, 620 + Math.sin(a) * d * 0.7 + 120 * br * br, 6 * (1 - br) + 2, `rgba(242,176,69,${0.8 * (1 - br)})`);
    }
    fade(t, 0.6, () => sarah(sx, gy, 0.6, t < cross + 0.8 ? 'run' : 'cheer', t), 0.5);
    // fade to navy at the very end
    const end = prog(t, s.dur - 1.0, 1.0);
    if (end > 0) { ctx.fillStyle = `rgba(29,41,85,${end})`; ctx.fillRect(0, 0, W, H); }
  },
  cues: () => [[0.6, 'whoosh'], [5.0, 'chime'], [6.4, 'pop']],
};

// ── frame ──────────────────────────────────────────────────────────────────
function sceneAt(t) {
  let i = 0; while (i < scenes.length - 1 && t >= starts[i + 1]) i++;
  return i;
}
function drawScene(i, lt) {
  const s = scenes[i], T = S[s.type];
  if (!T) { ctx.fillStyle = '#f00'; ctx.fillRect(0, 0, W, H); return; }
  ctx.save(); T.draw(lt, s); ctx.restore();
}
function render(t) {
  t = clamp(t, 0, DUR - 1e-6);
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
  const i = sceneAt(t), lt = t - starts[i];
  if (i > 0 && lt < XF) {
    drawScene(i - 1, scenes[i - 1].dur + lt);
    ctx.save(); ctx.globalAlpha = eIO(lt / XF); drawScene(i, lt); ctx.restore();
  } else drawScene(i, lt);
}
function cues() {
  const out = [];
  scenes.forEach((s, i) => { const T = S[s.type]; if (T && T.cues) for (const [lt, k] of T.cues(s)) out.push([starts[i] + lt, k]); });
  return out;
}

window.ENGINE = {
  W, H, FPS, DUR, starts, scenes, cues,
  init(canvas) { ctx = canvas.getContext('2d'); },
  render,
  ready: () => Promise.all([
    document.fonts.load(`400 40px "DM Serif Display"`), document.fonts.load('400 40px Carlito'), document.fonts.load('700 40px Carlito'),
    ...Object.values(LOGO).map(im => im.decode().catch(() => {})),
  ]).then(() => document.fonts.ready),
};
})();
