import sys, math, subprocess, numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance, ImageChops

S = sys.argv[1]; SRC = sys.argv[2]; OUT = sys.argv[3]
PREVIEW = [float(x) for x in sys.argv[4].split(',')] if len(sys.argv) > 4 else None
W, H, FPS, DUR = 1080, 1920, 30, 60.0
NAVY = (14, 42, 92); RED = (200, 16, 30); WHITE = (255, 255, 255)
FD = "/usr/share/fonts/opentype/inter/"
def F(name, size): return ImageFont.truetype(FD + name, size)

src = Image.open(SRC).convert("RGB")

# ---------- grading ----------
def grade(im, mode):
    if mode == "cold":
        im = ImageEnhance.Color(im).enhance(0.25)
        im = ImageEnhance.Brightness(im).enhance(0.72)
        im = ImageEnhance.Contrast(im).enhance(0.9)
        a = np.asarray(im).astype(np.float32)
        a[..., 0] *= 0.88; a[..., 2] = a[..., 2] * 1.08 + 8
        im = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
    else:
        im = ImageEnhance.Color(im).enhance(1.12)
        a = np.asarray(im).astype(np.float32)
        a[..., 0] = a[..., 0] * 1.06 + 6; a[..., 2] *= 0.93
        im = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
        glow = im.filter(ImageFilter.GaussianBlur(28))
        im = Image.blend(im, ImageChops.screen(im, glow), 0.35)
    return im

def vignette(strength):
    y, x = np.mgrid[0:H, 0:W]
    d = np.sqrt(((x - W / 2) / (W / 2)) ** 2 + ((y - H / 2) / (H / 2)) ** 2)
    v = 1 - strength * np.clip(d - 0.55, 0, 1) ** 1.5
    return v[..., None].astype(np.float32)
VIG = vignette(0.55)

def prep(box, mode, scale=1.18):
    c = src.crop(box)
    # cover W x H at given overscale
    r = max(W / c.width, H / c.height) * scale
    c = c.resize((int(c.width * r), int(c.height * r)), Image.LANCZOS)
    c = c.filter(ImageFilter.UnsharpMask(2, 60, 2))
    return grade(c, mode)

MAN = (640, 0, 1122, 857)          # wide
FACE = (660, 40, 1010, 662)        # close-up
DESK = (640, 700, 1122, 1110)       # laptop + mug (letterboxed via cover)
DESK2 = (700, 520, 1122, 1120)
plates = {
    "desk_cold": prep(DESK2, "cold"),
    "man_warm": prep(MAN, "warm"),
    "face_warm": prep(FACE, "warm", 1.12),
    "desk_warm": prep(DESK2, "warm"),
}
BOX = src.crop((60, 920, 470, 1240))

def ease(x): x = min(1, max(0, x)); return x * x * (3 - 2 * x)
def kb(plate, p, z0, z1, dx0=0, dx1=0, dy0=0, dy1=0):
    """Ken Burns: p in 0..1, zoom from z0 to z1 (relative to cover), pan in px of plate"""
    z = z0 + (z1 - z0) * p
    cw, ch = W / z * (plate.width / (W * 1.0)) * (W / plate.width) * (plate.width / W), 0
    # visible window size in plate pixels
    base = min(plate.width / W, plate.height / H)
    cw, ch = W * base / z, H * base / z
    cx = plate.width / 2 + dx0 + (dx1 - dx0) * p
    cy = plate.height / 2 + dy0 + (dy1 - dy0) * p
    cx = min(max(cx, cw / 2), plate.width - cw / 2); cy = min(max(cy, ch / 2), plate.height - ch / 2)
    return plate.resize((W, H), Image.BILINEAR, box=(cx - cw / 2, cy - ch / 2, cx + cw / 2, cy + ch / 2))

def finish(im, vig=True):
    a = np.asarray(im).astype(np.float32)
    if vig: a *= VIG
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))

def text_shadow(d, xy, txt, font, fill=WHITE, anchor="la", sh=3):
    x, y = xy
    d.text((x + sh, y + sh), txt, font=font, fill=(0, 0, 0, 150), anchor=anchor)
    d.text((x, y), txt, font=font, fill=fill, anchor=anchor)

def super_(im, txt, alpha=1.0, y=H - 120, size=30):
    ov = Image.new("RGBA", im.size, (0, 0, 0, 0)); d = ImageDraw.Draw(ov)
    f = F("Inter-Medium.otf", size)
    d.text((62, y + 2), txt, font=f, fill=(0, 0, 0, int(140 * alpha)))
    d.text((60, y), txt, font=f, fill=(255, 255, 255, int(235 * alpha)))
    return Image.alpha_composite(im.convert("RGBA"), ov).convert("RGB")

def caption(im, txt, alpha, y=1430, size=62, color=WHITE, font="Inter-SemiBold.otf"):
    ov = Image.new("RGBA", im.size, (0, 0, 0, 0)); d = ImageDraw.Draw(ov)
    f = F(font, size)
    lines = txt.split("\n")
    for i, ln in enumerate(lines):
        yy = y + i * int(size * 1.22)
        d.text((W / 2 + 3, yy + 3), ln, font=f, fill=(0, 0, 0, int(160 * alpha)), anchor="ma")
        d.text((W / 2, yy), ln, font=f, fill=color + (int(255 * alpha),), anchor="ma")
    return Image.alpha_composite(im.convert("RGBA"), ov).convert("RGB")

def fadein(t, a, b): return ease((t - a) / max(1e-6, b - a))

# ---------- logo ----------
def logo(scale=1.0, wipe=1.0, sub=1.0):
    w, h = int(900 * scale), int(330 * scale)
    L = Image.new("RGBA", (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(L)
    f = F("Inter-BlackItalic.otf", int(200 * scale))
    d.text((w // 2 - int(30 * scale), int(10 * scale)), "FITFO", font=f, fill=NAVY + (255,), anchor="ma")
    bb = d.textbbox((w // 2 - int(30 * scale), int(10 * scale)), "FITFO", font=f, anchor="ma")
    d.text((bb[2] + int(4 * scale), bb[1] + int(8 * scale)), "™", font=F("Inter-Bold.otf", int(48 * scale)), fill=NAVY + (255,))
    # red swoosh
    sw = int((bb[2] - bb[0]) * wipe)
    if sw > 2:
        d.polygon([(bb[0] + 10 * scale, bb[3] + 22 * scale), (bb[0] + sw, bb[3] + 12 * scale),
                   (bb[0] + sw, bb[3] + 20 * scale), (bb[0] + 10 * scale, bb[3] + 28 * scale)], fill=RED + (255,))
    if sub > 0:
        f2 = F("Inter-MediumItalic.otf", int(52 * scale))
        d.text((w // 2, bb[3] + int(48 * scale)), "for Emotional Dysfunction", font=f2, fill=(30, 40, 60, int(255 * sub)), anchor="ma")
    return L

# ---------- ISI fine print ----------
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
    words, lines, cur = txt.split(" "), [], ""
    dd = ImageDraw.Draw(Image.new("RGB", (1, 1)))
    for w_ in words:
        t = (cur + " " + w_).strip()
        if dd.textlength(t, font=font) > maxw: lines.append(cur); cur = w_
        else: cur = t
    lines.append(cur); return lines
ISI_F = F("Inter-Regular.otf", 27)
ISI_LINES = wrap(ISI_TXT, ISI_F, W - 100)
ISI_H = 330
ISI_STRIP = Image.new("RGB", (W, 60 + len(ISI_LINES) * 36), (248, 248, 250))
d = ImageDraw.Draw(ISI_STRIP)
for i, ln in enumerate(ISI_LINES):
    d.text((50, 30 + i * 36), ln, font=ISI_F if i else F("Inter-Bold.otf", 27), fill=(40, 45, 60))
def isi(im, p, alpha):
    off = int((ISI_STRIP.height - ISI_H) * p)
    panel = ISI_STRIP.crop((0, off, W, off + ISI_H))
    im = im.copy()
    region = im.crop((0, H - ISI_H, W, H))
    im.paste(Image.blend(region, panel, 0.93 * alpha), (0, H - ISI_H))
    dd = ImageDraw.Draw(im)
    if alpha > 0.5: dd.line([(0, H - ISI_H), (W, H - ISI_H)], fill=NAVY, width=4)
    return im

# ---------- scenes (t = global seconds) ----------
def sc_problem1(t):  # 0 - 5.6 desk, cold
    p = t / 5.8
    im = finish(kb(plates["desk_cold"], p, 1.0, 1.12, 0, 30, -40, 10))
    im = caption(im, "Day 1,094 of “researching.”", fadein(t, 1.0, 1.6) * (1 - fadein(t, 4.9, 5.4)), y=1500, size=56, font="Inter-Medium.otf")
    return super_(im, "Dramatization.", 0.9)

def planner(t, t0):
    im = Image.new("RGB", (W, H), (214, 218, 224)); d = ImageDraw.Draw(im)
    lt = t - t0
    d.rounded_rectangle((90, 300, W - 90, 1600), 24, fill=(244, 245, 247), outline=(170, 176, 186), width=3)
    d.text((140, 350), "THIS WEEK", font=F("Inter-Bold.otf", 46), fill=(70, 78, 92))
    rows = [("MON", "Start the business. For real this time.", None),
            ("TUE", "Watch 4 hrs of startup videos", None),
            ("WED", "Reorganize desk", None),
            ("THU", "Buy domain name (#7)", None),
            ("FRI", "Start the business next Monday", RED)]
    for i, (day, task, col) in enumerate(rows):
        y = 480 + i * 210
        a = fadein(lt, 0.25 + i * 0.75, 0.6 + i * 0.75)
        if a <= 0: continue
        c = tuple(int(244 - (244 - v) * a) for v in (110, 118, 132))
        d.text((140, y), day, font=F("Inter-Bold.otf", 40), fill=c)
        d.text((290, y + 2), task, font=F("Inter-Regular.otf", 38), fill=tuple(int(244 - (244 - v) * a) for v in ((col or (60, 66, 78)))))
        d.line([(140, y + 120), (W - 140, y + 120)], fill=(222, 225, 230), width=2)
        if i == 0 and lt > 4.3:  # strike through monday
            s = ease((lt - 4.3) / 0.4)
            tw = d.textlength(task, font=F("Inter-Regular.otf", 38))
            d.line([(290, y + 24), (290 + tw * s, y + 24)], fill=RED, width=5)
    im = im.filter(ImageFilter.GaussianBlur(0.6))
    return finish(im)

def sc_problem2(t): return super_(planner(t, 5.4), "Dramatization.", 0.9)

def sc_define(t):  # 10.9 - 14.8
    lt = t - 10.9
    im = Image.new("RGB", (W, H), (22, 34, 58)); d = ImageDraw.Draw(im)
    a1 = fadein(lt, 0.1, 0.6)
    d.text((W / 2, 690), "Emotional Dysfunction", font=F("Inter-Bold.otf", 76), fill=tuple(int(v * a1) for v in (255, 255, 255)), anchor="ma")
    a2 = fadein(lt, 0.7, 1.3)
    d.text((W / 2, 800), "(ED)", font=F("Inter-Regular.otf", 50), fill=tuple(int(22 + (150 - 22) * a2) for _ in range(3)), anchor="ma")
    a3 = fadein(lt, 1.4, 2.0)
    for i, ln in enumerate(["A common condition marked by",
                            "chronic excuse-making, overthinking,",
                            "and an inability to figure it out."]):
        d.text((W / 2, 960 + i * 64), ln, font=F("Inter-Regular.otf", 44), fill=tuple(int(c0 + (c1 - c0) * a3) for c0, c1 in zip((22, 34, 58), (190, 200, 220))), anchor="ma")
    return finish(im)

def sc_reveal(t):  # 14.6 - 17.4
    lt = t - 14.6
    im = Image.new("RGB", (W, H), WHITE)
    s = 0.92 + 0.08 * ease(lt / 2.6)
    L = logo(1.0, wipe=ease((lt - 0.35) / 0.5), sub=fadein(lt, 0.7, 1.2))
    a = fadein(lt, 0.0, 0.35)
    L = L.resize((int(L.width * s), int(L.height * s)), Image.LANCZOS)
    L.putalpha(L.getchannel("A").point(lambda v: int(v * a)))
    im.paste(L, ((W - L.width) // 2, 760), L)
    return im

def sc_lifestyle1(t):  # 17.2 - 22.2 man wide warm
    p = (t - 17.2) / 5.3
    im = finish(kb(plates["man_warm"], p, 1.0, 1.1, 0, 0, 60, -20))
    im = caption(im, "Chronic excuse-making\nBusiness paralysis\nSoft mentality\nRecurring life losses",
                 fadein(t, 17.9, 18.4) * (1 - fadein(t, 21.7, 22.2)), y=1260, size=52, font="Inter-SemiBold.otf")
    return super_(im, "Actor portrayal.", 1.0)

def sc_moa(t):  # 22.1 - 27.3 mechanism of action
    lt = t - 22.1
    im = Image.new("RGB", (W, H), (8, 22, 48)); d = ImageDraw.Draw(im, "RGBA")
    # soft background glow
    for r in range(700, 0, -50):
        d.ellipse((W / 2 - r, 960 - r, W / 2 + r, 960 + r), fill=(30, 80, 160, 6))
    rng = np.random.default_rng(3)
    n = 14
    for i in range(n):
        ang = i / n * 2 * math.pi + lt * 0.12
        rad = 330 + 40 * math.sin(i * 1.7 + lt)
        x = W / 2 + rad * math.cos(ang); y = 960 + rad * math.sin(ang) * 1.15
        hit = fadein(lt, 1.6 + i * 0.12, 2.2 + i * 0.12)
        rr = 62 * (1 - hit)
        if rr > 2:
            d.ellipse((x - rr, y - rr, x + rr, y + rr), fill=(180, 60, 70, 210), outline=(255, 140, 140, 255), width=3)
            if rr > 40: d.text((x, y), "EXCUSE", font=F("Inter-Bold.otf", 18), fill=(255, 230, 230, 255), anchor="mm")
        # particles flying from center
        pp = ease((lt - 0.8 - i * 0.12) / 1.0)
        if 0 < pp < 1:
            px = W / 2 + (x - W / 2) * pp; py = 960 + (y - 960) * pp
            d.ellipse((px - 10, py - 10, px + 10, py + 10), fill=(255, 255, 255, 230))
        if hit > 0.9:
            d.ellipse((x - 10, y - 10, x + 10, y + 10), fill=(120, 200, 255, int(255 * (1 - min(1, (lt - 2.4 - i * 0.12))))) if lt - 2.4 - i * 0.12 < 1 else (0, 0, 0, 0))
    # pill in center
    pr = 1 + 0.04 * math.sin(lt * 3)
    d.rounded_rectangle((W / 2 - 120 * pr, 960 - 50 * pr, W / 2 + 120 * pr, 960 + 50 * pr), 50, fill=(255, 255, 255, 255))
    d.rectangle((W / 2, 960 - 50 * pr, W / 2 + 70 * pr, 960 + 50 * pr), fill=NAVY + (255,))
    d.rounded_rectangle((W / 2, 960 - 50 * pr, W / 2 + 120 * pr, 960 + 50 * pr), 50, fill=NAVY + (255,))
    d.text((W / 2, 360), "How FITFO™ is thought to work", font=F("Inter-SemiBold.otf", 54), fill=(255, 255, 255, int(255 * fadein(lt, 0.1, 0.6))), anchor="ma")
    d.text((W / 2, 1560), "FITFO™ targets excuse receptors", font=F("Inter-Regular.otf", 42), fill=(200, 215, 240, int(255 * fadein(lt, 1.2, 1.8))), anchor="ma")
    d.text((W / 2, 1618), "before they reach the decision center.*", font=F("Inter-Regular.otf", 42), fill=(200, 215, 240, int(255 * fadein(lt, 1.2, 1.8))), anchor="ma")
    im = super_(im, "*The exact mechanism of action is unknown. Illustration only.", 0.85, y=H - 110, size=26)
    return im

def sc_face(t):  # 27.2 - 32.9
    p = (t - 27.2) / 5.8
    im = kb(plates["face_warm"], p, 1.0, 1.14, 0, 20, -120, -160)
    # light leak
    a = np.asarray(im).astype(np.float32)
    y, x = np.mgrid[0:H, 0:W]
    leak = np.exp(-(((x - W * (0.9 - 0.2 * p)) / 500) ** 2 + ((y - 300) / 700) ** 2))[..., None]
    a = a + leak * np.array([70, 45, 10]) * 0.9
    im = finish(Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)))
    im = caption(im, "Stop waiting. Start doing.", fadein(t, 28.2, 28.8) * (1 - fadein(t, 32.2, 32.7)), y=1500, size=58)
    return super_(im, "Actor portrayal.", 1.0)

def sc_side(t):  # 32.7 - 52.2 three plates + ISI crawl
    lt = t - 32.7
    if lt < 7: im = finish(kb(plates["man_warm"], lt / 7, 1.12, 1.0, 40, -40, -60, 0))
    elif lt < 13.3: im = finish(kb(plates["desk_warm"], (lt - 7) / 6.3, 1.0, 1.15, -30, 30, 0, -30))
    else: im = finish(kb(plates["face_warm"], (lt - 13.3) / 6.3, 1.05, 1.18, -20, 0, -80, -140))
    # crossfades inside segment
    for cut in (7, 13.3):
        if cut - 0.35 < lt < cut:
            pass
    im = isi(im, min(1, max(0, (lt - 0.5) / 18.5)), fadein(lt, 0, 0.5))
    return super_(im, "Actor portrayal.", 1.0, y=H - ISI_H - 60)

def sc_end(t):  # 52.1 - 60
    lt = t - 52.1
    im = Image.new("RGB", (W, H), WHITE)
    # marble-ish floor gradient
    a = np.asarray(im).astype(np.float32)
    y = np.arange(H)[:, None]
    a *= (1 - 0.10 * np.clip((y - 1100) / 820, 0, 1))[..., None]
    im = Image.fromarray(a.astype(np.uint8)); d = ImageDraw.Draw(im, "RGBA")
    # logo top
    L = logo(0.85, 1, 1)
    im.paste(L, ((W - L.width) // 2, 230), L)
    # box pack shot
    s = 2.15 * (0.96 + 0.04 * ease(lt / 7))
    bx = BOX.resize((int(BOX.width * s), int(BOX.height * s)), Image.LANCZOS)
    by = 680 + int(40 * (1 - ease(lt / 1.0)))
    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0)); ImageDraw.Draw(sh).ellipse((W / 2 - bx.width * 0.48, by + bx.height - 40, W / 2 + bx.width * 0.48, by + bx.height + 40), fill=(0, 0, 0, 90))
    im = Image.alpha_composite(im.convert("RGBA"), sh.filter(ImageFilter.GaussianBlur(25))).convert("RGB")
    m = Image.new("L", bx.size, 0); ImageDraw.Draw(m).rounded_rectangle((0, 0, bx.width, bx.height), 18, fill=255)
    im.paste(bx, ((W - bx.width) // 2, by), m)
    d = ImageDraw.Draw(im, "RGBA")
    a1 = fadein(lt, 0.3, 0.8)
    d.text((W / 2, 1450), "Ask your doctor if FITFO™", font=F("Inter-SemiBold.otf", 50), fill=(25, 30, 45, int(255 * a1)), anchor="ma")
    d.text((W / 2, 1512), "is right for you.", font=F("Inter-SemiBold.otf", 50), fill=(25, 30, 45, int(255 * a1)), anchor="ma")
    # red tagline bar slides in
    pb = ease((lt - 3.4) / 0.45)
    if pb > 0:
        x1 = int(W * (1 - pb)) - 20
        d.polygon([(x1 + 60, 1610), (W + 10, 1610), (W + 10, 1720), (x1, 1720)], fill=RED + (255,))
        d.text((x1 + 90, 1630), "Figure It The Frick Out.", font=F("Inter-ExtraBoldItalic.otf", 58), fill=(255, 255, 255, 255))
    a3 = fadein(lt, 4.2, 4.8)
    f = F("Inter-Italic.otf", 25)
    for i, ln in enumerate(["FITFO™ is a fictional product. This video is satire.",
                            "Not medical advice. Results may vary. Mostly upward."]):
        d.text((W / 2, 1790 + i * 36), ln, font=f, fill=(90, 95, 110, int(255 * a3)), anchor="ma")
    return im

SCENES = [  # (start, end, fn)
    (0.0, 5.6, sc_problem1), (5.4, 11.1, sc_problem2), (10.9, 14.8, sc_define),
    (14.6, 17.4, sc_reveal), (17.2, 22.3, sc_lifestyle1), (22.1, 27.4, sc_moa),
    (27.2, 32.9, sc_face), (32.7, 52.3, sc_side), (52.1, 60.01, sc_end),
]
def frame(t):
    act = [(s, e, f) for s, e, f in SCENES if s <= t < e]
    if len(act) == 1: im = act[0][2](t)
    else:
        (s1, e1, f1), (s2, e2, f2) = act[0], act[1]
        a = ease((t - s2) / (e1 - s2))
        im = Image.blend(f1(t), f2(t), a)
    # global fade in/out
    g = min(1, t / 0.4, (DUR - t) / 0.5)
    if g < 1: im = Image.blend(Image.new("RGB", (W, H)), im, max(0, g))
    return im

if PREVIEW:
    for t in PREVIEW: frame(t).resize((540, 960)).save(f"{S}/prev_{t:05.1f}.png")
    sys.exit()

ff = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
                       "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "medium", "-crf", "19",
                       "-pix_fmt", "yuv420p", OUT], stdin=subprocess.PIPE)
nfr = int(DUR * FPS)
for i in range(nfr):
    ff.stdin.write(frame(i / FPS).tobytes())
    if i % 150 == 0: print(i, flush=True)
ff.stdin.close(); ff.wait()
print("done")
