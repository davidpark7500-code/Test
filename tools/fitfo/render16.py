"""FITFO satire ad, 16:9 1920x1080 edit using MAGI-2 clips.
usage: render16.py <scratch> <poster.png> <clipdir> <out.mp4> [preview_times]"""
import sys, math, subprocess, numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance, ImageChops

S, SRC, CLIPS, OUT = sys.argv[1:5]
PREVIEW = [float(x) for x in sys.argv[5].split(',')] if len(sys.argv) > 5 else None
W, H, FPS, DUR = 1920, 1080, 30, 60.0
NAVY = (14, 42, 92); RED = (200, 16, 30); WHITE = (255, 255, 255)
FD = "/usr/share/fonts/opentype/inter/"
_fc = {}
def F(name, size):
    k = (name, size)
    if k not in _fc: _fc[k] = ImageFont.truetype(FD + name, size)
    return _fc[k]
src = Image.open(SRC).convert("RGB")
BOX = src.crop((60, 920, 470, 1240))

def ease(x): x = min(1, max(0, x)); return x * x * (3 - 2 * x)
def fadein(t, a, b): return ease((t - a) / max(1e-6, b - a))

y_, x_ = np.mgrid[0:H, 0:W]
_d = np.sqrt(((x_ - W / 2) / (W / 2)) ** 2 + ((y_ - H / 2) / (H / 2)) ** 2)
VIG = (1 - 0.5 * np.clip(_d - 0.6, 0, 1) ** 1.5)[..., None].astype(np.float32)

# ---------- clip reader: sequential ffmpeg pipe, frame-at-time with speed ----------
class Clip:
    def __init__(self, path):
        self.path = path; self.p = None; self.idx = -1; self.cur = None
        info = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-count_packets",
                               "-show_entries", "stream=nb_read_packets,r_frame_rate", "-of", "csv=p=0", path],
                              capture_output=True, text=True).stdout.strip().split(",")
        num, den = info[0].split("/"); self.fps = float(num) / float(den); self.n = int(info[1])
    def _open(self):
        if self.p is not None:
            self.p.stdout.close(); self.p.kill(); self.p.wait()
        self.p = subprocess.Popen(["ffmpeg", "-loglevel", "error", "-i", self.path, "-vf", f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H}",
                                   "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
        self.idx = -1
    def at(self, lt, speed=1.0, offset=0.0):
        want = min(self.n - 1, max(0, int((offset + lt * speed) * self.fps)))
        if self.p is None or want < self.idx: self._open()
        while self.idx < want:
            b = self.p.stdout.read(W * H * 3)
            if len(b) < W * H * 3: break
            self.cur = b; self.idx += 1
        return Image.frombytes("RGB", (W, H), self.cur)
import os
C = {i: Clip(f"{CLIPS}/clip{i}.mp4") for i in range(18) if os.path.exists(f"{CLIPS}/clip{i}.mp4")}

def grade(im, mode):
    if mode == "cold":
        im = ImageEnhance.Color(im).enhance(0.3)
        im = ImageEnhance.Brightness(im).enhance(0.78)
        a = np.asarray(im).astype(np.float32); a[..., 0] *= 0.9; a[..., 2] = a[..., 2] * 1.07 + 8
    else:
        im = ImageEnhance.Color(im).enhance(1.08)
        a = np.asarray(im).astype(np.float32); a[..., 0] = a[..., 0] * 1.05 + 5; a[..., 2] *= 0.94
        small = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).resize((480, 270)).filter(ImageFilter.GaussianBlur(8)).resize((W, H))
        g = np.asarray(small).astype(np.float32)
        a = a + (255 - a) * g / 255 * 0.28
    a *= VIG
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))

def ov_draw(im):
    ov = Image.new("RGBA", im.size, (0, 0, 0, 0)); return ov, ImageDraw.Draw(ov)
def comp(im, ov): return Image.alpha_composite(im.convert("RGBA"), ov).convert("RGB")

def super_(im, txt, alpha=1.0, y=H - 70, size=26):
    ov, d = ov_draw(im); f = F("Inter-Medium.otf", size)
    d.text((62, y + 2), txt, font=f, fill=(0, 0, 0, int(140 * alpha)))
    d.text((60, y), txt, font=f, fill=(255, 255, 255, int(235 * alpha)))
    return comp(im, ov)

def caption(im, txt, alpha, x=None, y=820, size=56, font="Inter-SemiBold.otf", anchor="ma"):
    if alpha <= 0: return im
    ov, d = ov_draw(im); f = F(font, size); x = W / 2 if x is None else x
    for i, ln in enumerate(txt.split("\n")):
        yy = y + i * int(size * 1.25)
        d.text((x + 3, yy + 3), ln, font=f, fill=(0, 0, 0, int(160 * alpha)), anchor=anchor)
        d.text((x, yy), ln, font=f, fill=WHITE + (int(255 * alpha),), anchor=anchor)
    return comp(im, ov)

def logo(scale=1.0, wipe=1.0, sub=1.0):
    w, h = int(900 * scale), int(330 * scale)
    L = Image.new("RGBA", (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(L)
    f = F("Inter-BlackItalic.otf", int(200 * scale)); cx = w // 2 - int(30 * scale)
    d.text((cx, int(10 * scale)), "FITFO", font=f, fill=NAVY + (255,), anchor="ma")
    bb = d.textbbox((cx, int(10 * scale)), "FITFO", font=f, anchor="ma")
    d.text((bb[2] + int(4 * scale), bb[1] + int(8 * scale)), "™", font=F("Inter-Bold.otf", int(48 * scale)), fill=NAVY + (255,))
    sw = (bb[2] - bb[0]) * wipe
    if sw > 2:
        d.polygon([(bb[0] + 10 * scale, bb[3] + 22 * scale), (bb[0] + sw, bb[3] + 12 * scale),
                   (bb[0] + sw, bb[3] + 20 * scale), (bb[0] + 10 * scale, bb[3] + 28 * scale)], fill=RED + (255,))
    if sub > 0:
        d.text((w // 2, bb[3] + int(48 * scale)), "for Emotional Dysfunction", font=F("Inter-MediumItalic.otf", int(52 * scale)),
               fill=(30, 40, 60, int(255 * sub)), anchor="ma")
    return L

# ---------- ISI crawl ----------
ISI_TXT = ("IMPORTANT SAFETY INFORMATION  •  Do not take FITFO™ if you are allergic to responsibility or are currently "
 "\"waiting for the right time.\" FITFO™ may cause accountability, action bias, increased ownership, improved "
 "follow-through, stronger decision-making, and a sudden intolerance for excuses. Stop taking FITFO™ and call your "
 "doctor if you experience finishing things, returning emails the same day, or saying \"I'll handle it\" and then "
 "handling it. Some patients reported an urge to delete the word \"someday\" from their vocabulary. Do not operate "
 "heavy machinery, a group chat, or a vision board while taking FITFO™. FITFO™ has not been shown to work in people "
 "who are only reading this text to avoid doing their work. Tell your doctor about all excuses you are currently "
 "taking, including \"the economy,\" \"my schedule,\" and \"I'm just not a numbers person.\" FITFO™ is a fictional "
 "product. This video is satire and is not medical advice.")
def wrap(txt, font, maxw):
    dd = ImageDraw.Draw(Image.new("RGB", (1, 1))); lines, cur = [], ""
    for w_ in txt.split(" "):
        t = (cur + " " + w_).strip()
        if dd.textlength(t, font=font) > maxw: lines.append(cur); cur = w_
        else: cur = t
    return lines + [cur]
ISI_F = F("Inter-Regular.otf", 24); LH = 32
ISI_LINES = wrap(ISI_TXT, ISI_F, W - 120)
ISI_H = 190
ISI_STRIP = Image.new("RGB", (W, 30 + len(ISI_LINES) * LH + 20), (248, 248, 250))
_d = ImageDraw.Draw(ISI_STRIP)
for i, ln in enumerate(ISI_LINES): _d.text((60, 20 + i * LH), ln, font=ISI_F, fill=(40, 45, 60))
def isi(im, p, alpha):
    off = int(max(0, ISI_STRIP.height - ISI_H) * p)
    panel = ISI_STRIP.crop((0, off, W, off + ISI_H)); im = im.copy()
    region = im.crop((0, H - ISI_H, W, H)); im.paste(Image.blend(region, panel, 0.93 * alpha), (0, H - ISI_H))
    if alpha > 0.5: ImageDraw.Draw(im).line([(0, H - ISI_H), (W, H - ISI_H)], fill=NAVY, width=4)
    return im

# ---------- scenes ----------
def sc_problem1(t):
    im = grade(C[0].at(t, 0.95, 0.8), "cold")
    im = caption(im, "Day 1,094 of “researching.”", fadein(t, 1.0, 1.6) * (1 - fadein(t, 4.9, 5.4)), y=880, size=52, font="Inter-Medium.otf")
    return super_(im, "Dramatization.", 0.9)

def sc_problem2(t):
    lt = t - 5.4
    im = Image.new("RGB", (W, H), (214, 218, 224)); d = ImageDraw.Draw(im)
    d.rounded_rectangle((460, 80, W - 460, 1000), 24, fill=(244, 245, 247), outline=(170, 176, 186), width=3)
    d.text((520, 120), "THIS WEEK", font=F("Inter-Bold.otf", 42), fill=(70, 78, 92))
    rows = [("MON", "Start the business. For real this time.", None), ("TUE", "Watch 4 hrs of startup videos", None),
            ("WED", "Reorganize desk", None), ("THU", "Buy domain name (#7)", None), ("FRI", "Start the business next Monday", RED)]
    for i, (day, task, col) in enumerate(rows):
        y = 230 + i * 150; a = fadein(lt, 0.25 + i * 0.75, 0.6 + i * 0.75)
        if a <= 0: continue
        mix = lambda c: tuple(int(244 - (244 - v) * a) for v in c)
        d.text((520, y), day, font=F("Inter-Bold.otf", 38), fill=mix((110, 118, 132)))
        d.text((660, y + 2), task, font=F("Inter-Regular.otf", 38), fill=mix(col or (60, 66, 78)))
        d.line([(520, y + 100), (W - 520, y + 100)], fill=(222, 225, 230), width=2)
        if i == 0 and lt > 4.3:
            tw = d.textlength(task, font=F("Inter-Regular.otf", 38))
            d.line([(660, y + 24), (660 + tw * ease((lt - 4.3) / 0.4), y + 24)], fill=RED, width=5)
    a = np.asarray(im).astype(np.float32) * VIG
    return super_(Image.fromarray(a.astype(np.uint8)), "Dramatization.", 0.9)

def sc_define(t):
    lt = t - 10.9
    im = Image.new("RGB", (W, H), (22, 34, 58)); d = ImageDraw.Draw(im)
    lerp = lambda a, c1: tuple(int(c0 + (c - c0) * a) for c0, c in zip((22, 34, 58), c1))
    d.text((W / 2, 330), "Emotional Dysfunction", font=F("Inter-Bold.otf", 92), fill=lerp(fadein(lt, .1, .6), WHITE), anchor="ma")
    d.text((W / 2, 460), "(ED)", font=F("Inter-Regular.otf", 54), fill=lerp(fadein(lt, .7, 1.3), (150, 160, 180)), anchor="ma")
    for i, ln in enumerate(["A common condition marked by chronic excuse-making,", "overthinking, and an inability to figure it out."]):
        d.text((W / 2, 600 + i * 66), ln, font=F("Inter-Regular.otf", 46), fill=lerp(fadein(lt, 1.4, 2.0), (190, 200, 220)), anchor="ma")
    return im

def sc_reveal(t):
    lt = t - 14.6
    im = Image.new("RGB", (W, H), WHITE)
    s = 1.05 * (0.92 + 0.08 * ease(lt / 2.6))
    L = logo(1.0, wipe=ease((lt - 0.35) / 0.5), sub=fadein(lt, 0.7, 1.2))
    L = L.resize((int(L.width * s), int(L.height * s)), Image.LANCZOS)
    a = fadein(lt, 0, 0.35); L.putalpha(L.getchannel("A").point(lambda v: int(v * a)))
    im.paste(L, ((W - L.width) // 2, (H - L.height) // 2), L)
    return im

def sc_life1(t):
    lt = t - 17.2
    im = grade(C[10].at(lt, 0.95), "warm")
    ca = fadein(t, 17.7, 18.3) * (1 - fadein(t, 21.7, 22.2))
    if ca > 0:
        a = np.asarray(im).astype(np.float32)
        ramp = np.clip((np.arange(W) - 1150) / 400, 0, 1)[None, :, None] * 0.45 * ca
        im = Image.fromarray((a * (1 - ramp)).astype(np.uint8))
    im = caption(im, "Chronic excuse-making\nBusiness paralysis\nSoft mentality\nRecurring life losses",
                 fadein(t, 17.9, 18.4) * (1 - fadein(t, 21.7, 22.2)), x=W - 110, y=330, size=50, anchor="ra")
    return super_(im, "Actor portrayal.")

def sc_moa(t):
    lt = t - 22.1; cx, cy = W / 2, H / 2 + 20
    im = Image.new("RGB", (W, H), (8, 22, 48)); d = ImageDraw.Draw(im, "RGBA")
    for r in range(600, 0, -50): d.ellipse((cx - r * 1.4, cy - r, cx + r * 1.4, cy + r), fill=(30, 80, 160, 6))
    n = 14
    for i in range(n):
        ang = i / n * 2 * math.pi + lt * 0.12; rad = 300 + 30 * math.sin(i * 1.7 + lt)
        x = cx + rad * 1.5 * math.cos(ang); y = cy + rad * math.sin(ang) * 0.95
        hit = fadein(lt, 1.6 + i * 0.12, 2.2 + i * 0.12); rr = 58 * (1 - hit)
        if rr > 2:
            d.ellipse((x - rr, y - rr, x + rr, y + rr), fill=(180, 60, 70, 210), outline=(255, 140, 140, 255), width=3)
            if rr > 40: d.text((x, y), "EXCUSE", font=F("Inter-Bold.otf", 17), fill=(255, 230, 230, 255), anchor="mm")
        pp = ease((lt - 0.8 - i * 0.12) / 1.0)
        if 0 < pp < 1:
            px = cx + (x - cx) * pp; py = cy + (y - cy) * pp
            d.ellipse((px - 9, py - 9, px + 9, py + 9), fill=(255, 255, 255, 230))
    pr = 1 + 0.04 * math.sin(lt * 3)
    d.rounded_rectangle((cx - 120 * pr, cy - 50 * pr, cx + 120 * pr, cy + 50 * pr), 50, fill=WHITE + (255,))
    d.rounded_rectangle((cx, cy - 50 * pr, cx + 120 * pr, cy + 50 * pr), 50, fill=NAVY + (255,))
    d.rectangle((cx, cy - 50 * pr, cx + 60 * pr, cy + 50 * pr), fill=NAVY + (255,))
    d.text((W / 2, 70), "How FITFO™ is thought to work", font=F("Inter-SemiBold.otf", 54), fill=(255, 255, 255, int(255 * fadein(lt, .1, .6))), anchor="ma")
    d.text((W / 2, 930), "FITFO™ targets excuse receptors before they reach the decision center.*", font=F("Inter-Regular.otf", 38),
           fill=(200, 215, 240, int(255 * fadein(lt, 1.2, 1.8))), anchor="ma")
    return super_(im, "*The exact mechanism of action is unknown. Illustration only.", 0.85, y=H - 55, size=22)

def sc_face(t):
    lt = t - 27.2
    im = grade(C[11].at(lt, 1.0), "warm")
    im = caption(im, "Stop waiting. Start doing.", fadein(t, 28.2, 28.8) * (1 - fadein(t, 32.2, 32.7)), y=900, size=58)
    return super_(im, "Actor portrayal.")

def sc_side(t):
    lt = t - 32.7
    segs = [(0.0, 12, 0.92, 0.0), (4.9, 13, 0.92, 0.0), (9.8, 17, 1.0, 0.2), (14.7, 15, 0.95, 0.0)]
    def shot(k, l): return grade(C[segs[k][1]].at(l - segs[k][0], segs[k][2], segs[k][3]), "warm")
    k = max(i for i, sg in enumerate(segs) if lt >= sg[0])
    im = shot(k, lt)
    if k + 1 < len(segs) and segs[k + 1][0] - 0.35 < lt:
        im = Image.blend(im, shot(k + 1, segs[k + 1][0]), ease((lt - (segs[k + 1][0] - 0.35)) / 0.35))
    im = isi(im, min(1, max(0, (lt - 0.5) / 18.5)), fadein(lt, 0, 0.5))
    return super_(im, "Actor portrayal.", 1.0, y=H - ISI_H - 50)

def sc_end(t):
    lt = t - 52.1
    a = np.full((H, W, 3), 255, np.float32)
    a *= (1 - 0.10 * np.clip((np.arange(H)[:, None] - 600) / 480, 0, 1))[..., None]
    im = Image.fromarray(a.astype(np.uint8))
    s = 1.95 * (0.96 + 0.04 * ease(lt / 7))
    bx = BOX.resize((int(BOX.width * s), int(BOX.height * s)), Image.LANCZOS)
    bxx = 150; by = 170 + int(40 * (1 - ease(lt / 1.0)))
    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(sh).ellipse((bxx + 30, by + bx.height - 35, bxx + bx.width - 30, by + bx.height + 35), fill=(0, 0, 0, 90))
    im = Image.alpha_composite(im.convert("RGBA"), sh.filter(ImageFilter.GaussianBlur(25))).convert("RGB")
    m = Image.new("L", bx.size, 0); ImageDraw.Draw(m).rounded_rectangle((0, 0, bx.width, bx.height), 18, fill=255)
    im.paste(bx, (bxx, by), m)
    L = logo(0.8, 1, 1); RX = 1000
    im.paste(L, (RX + (W - RX - L.width) // 2, 150), L)
    d = ImageDraw.Draw(im, "RGBA"); a1 = fadein(lt, 0.3, 0.8); rc = RX + (W - RX) / 2
    d.text((rc, 520), "Ask your doctor if FITFO™", font=F("Inter-SemiBold.otf", 52), fill=(25, 30, 45, int(255 * a1)), anchor="ma")
    d.text((rc, 586), "is right for you.", font=F("Inter-SemiBold.otf", 52), fill=(25, 30, 45, int(255 * a1)), anchor="ma")
    pb = ease((lt - 3.8) / 0.45)
    if pb > 0:
        x1 = int(RX - 40 + (W - RX + 40) * (1 - pb))
        d.polygon([(x1 + 60, 720), (W + 10, 720), (W + 10, 830), (x1, 830)], fill=RED + (255,))
        d.text((x1 + 90, 742), "Figure It The Frick Out.", font=F("Inter-ExtraBoldItalic.otf", 58), fill=(255, 255, 255, 255))
    a3 = fadein(lt, 4.2, 4.8)
    d.text((W / 2, 975), "FITFO™ is a fictional product. This video is satire. Not medical advice. Results may vary. Mostly upward.",
           font=F("Inter-Italic.otf", 26), fill=(90, 95, 110, int(255 * a3)), anchor="ma")
    return im

# ===== all-video overrides =====
def darken(im, k):
    return Image.fromarray((np.asarray(im).astype(np.float32) * k).astype(np.uint8))
def grad_left(im, strength, x0=0, x1=1100):
    a = np.asarray(im).astype(np.float32)
    ramp = (1 - np.clip((np.arange(W) - x0) / (x1 - x0), 0, 1))[None, :, None] * strength
    return Image.fromarray((a * (1 - ramp)).astype(np.uint8))

def sc_problem2(t):
    lt = t - 5.4
    im = grade(C[5].at(lt, 0.95), "cold")
    im = grad_left(im, 0.5)
    ov, d = ov_draw(im)
    rows = [("MONDAY", "Start the business.", 0.4), ("FRIDAY", "Start the business next Monday.", 2.6)]
    for i, (day, task, t0) in enumerate(rows):
        a = fadein(lt, t0, t0 + 0.5) * (1 - fadein(lt, 5.2, 5.6))
        if a <= 0: continue
        y = 640 + i * 130
        d.text((110, y), day, font=F("Inter-Bold.otf", 30), fill=(170, 185, 210, int(255 * a)))
        f = F("Inter-SemiBold.otf", 54)
        col = (255, 120, 120) if i == 1 else (255, 255, 255)
        d.text((112, y + 40), task, font=f, fill=(0, 0, 0, int(140 * a)))
        d.text((110, y + 38), task, font=f, fill=col + (int(255 * a),))
        if i == 0 and lt > 1.9:
            tw = d.textlength(task, font=f)
            d.line([(110, y + 72), (110 + tw * ease((lt - 1.9) / 0.4), y + 72)], fill=(230, 40, 50, int(255 * a)), width=6)
    im = comp(im, ov)
    return super_(im, "Dramatization.", 0.9)

def sc_define(t):
    lt = t - 10.9
    im = darken(grade(C[6].at(lt, 0.9, 0.3), "cold"), 0.72)
    ov, d = ov_draw(im)
    a1 = fadein(lt, .2, .7); a2 = fadein(lt, .8, 1.3); a3 = fadein(lt, 1.4, 2.0)
    d.text((W / 2, 300), "Emotional Dysfunction", font=F("Inter-Bold.otf", 92), fill=(255, 255, 255, int(255 * a1)), anchor="ma")
    d.text((W / 2, 430), "(ED)", font=F("Inter-Regular.otf", 54), fill=(200, 210, 230, int(255 * a2)), anchor="ma")
    for i, ln in enumerate(["A common condition marked by chronic excuse-making,", "overthinking, and an inability to figure it out."]):
        d.text((W / 2, 560 + i * 66), ln, font=F("Inter-Regular.otf", 46), fill=(220, 228, 240, int(255 * a3)), anchor="ma")
    return super_(comp(im, ov), "Dramatization.", 0.9)

def sc_reveal(t):
    lt = t - 14.6
    bg = np.asarray(C[7].at(lt, 0.8)).astype(np.float32)
    bg = bg + (255 - bg) * 0.62
    im = Image.fromarray(bg.astype(np.uint8))
    s = 1.05 * (0.92 + 0.08 * ease(lt / 2.6))
    L = logo(1.0, wipe=ease((lt - 0.35) / 0.5), sub=fadein(lt, 0.7, 1.2))
    L = L.resize((int(L.width * s), int(L.height * s)), Image.LANCZOS)
    a = fadein(lt, 0, 0.35); L.putalpha(L.getchannel("A").point(lambda v: int(v * a)))
    im.paste(L, ((W - L.width) // 2, (H - L.height) // 2), L)
    return im

def sc_moa(t):
    lt = t - 22.1
    im = C[8].at(lt, 0.95)
    a = np.asarray(im).astype(np.float32)
    yy = np.arange(H)[:, None, None]
    band = np.maximum(np.clip((160 - yy) / 120, 0, 1), np.clip((yy - 850) / 110, 0, 1)) * 0.6
    im = Image.fromarray((a * (1 - band)).astype(np.uint8))
    ov, d = ov_draw(im)
    d.text((W / 2, 70), "How FITFO™ is thought to work", font=F("Inter-SemiBold.otf", 54), fill=(255, 255, 255, int(255 * fadein(lt, .1, .6))), anchor="ma")
    d.text((W / 2, 930), "FITFO™ targets excuse receptors before they reach the decision center.*", font=F("Inter-Regular.otf", 38),
           fill=(220, 230, 245, int(255 * fadein(lt, 1.2, 1.8))), anchor="ma")
    return super_(comp(im, ov), "*The exact mechanism of action is unknown. Illustration only.", 0.85, y=H - 55, size=22)

def sc_end(t):
    lt = t - 52.1
    im = C[9].at(lt, 0.4)
    a = np.asarray(im).astype(np.float32)
    ramp = np.clip((np.arange(H) - 860) / 60, 0, 1)[:, None, None] * 0.94 * fadein(lt, 0.2, 0.8)
    a = a + (255 - a) * ramp
    im = Image.fromarray(a.astype(np.uint8)); d = ImageDraw.Draw(im, "RGBA")
    a1 = fadein(lt, 0.3, 0.8)
    d.text((110, 922), "Ask your doctor if FITFO™ is right for you.", font=F("Inter-SemiBold.otf", 50), fill=(25, 30, 45, int(255 * a1)))
    pb = ease((lt - 3.8) / 0.45)
    if pb > 0:
        x1 = int(1150 + (W - 1150) * (1 - pb))
        d.polygon([(x1 + 50, 900), (W + 10, 900), (W + 10, 995), (x1, 995)], fill=RED + (255,))
        d.text((x1 + 75, 918), "Figure It The Frick Out.", font=F("Inter-ExtraBoldItalic.otf", 50), fill=(255, 255, 255, 255))
    a3 = fadein(lt, 4.2, 4.8)
    d.text((W / 2, 1030), "FITFO™ is a fictional product. This video is satire. Not medical advice. Results may vary. Mostly upward.",
           font=F("Inter-Italic.otf", 26), fill=(90, 95, 110, int(255 * a3)), anchor="ma")
    return im

SCENES = [(0.0, 5.6, sc_problem1), (5.4, 11.1, sc_problem2), (10.9, 14.8, sc_define), (14.6, 17.4, sc_reveal),
          (17.2, 22.3, sc_life1), (22.1, 27.4, sc_moa), (27.2, 32.9, sc_face), (32.7, 52.3, sc_side), (52.1, 60.01, sc_end)]
def frame(t):
    act = [s for s in SCENES if s[0] <= t < s[1]]
    if len(act) == 1: im = act[0][2](t)
    else:
        (s1, e1, f1), (s2, e2, f2) = act[0], act[1]
        im = Image.blend(f1(t), f2(t), ease((t - s2) / (e1 - s2)))
    g = min(1, t / 0.4, (DUR - t) / 0.5)
    if g < 1: im = Image.blend(Image.new("RGB", (W, H)), im, max(0, g))
    return im

if PREVIEW:
    for t in PREVIEW: frame(t).resize((640, 360)).save(f"{S}/p16_{t:05.1f}.png")
    sys.exit()
ff = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
                       "-i", "-", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", OUT], stdin=subprocess.PIPE)
for i in range(int(DUR * FPS)):
    ff.stdin.write(frame(i / FPS).tobytes())
    if i % 300 == 0: print(i, flush=True)
ff.stdin.close(); ff.wait(); print("done")
