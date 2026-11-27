#!/usr/bin/env python3
"""Render a 5-slide animated Instagram carousel (1080x1350 MP4 slides + PNG fallbacks).

Usage: python3 build.py <photo_2015.jpg> <photo_2026.jpg> [out_dir]
"""
import math, os, subprocess, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance, ImageFont, ImageOps

W, H, FPS = 1080, 1350, 30
HERE = os.path.dirname(os.path.abspath(__file__))
F = os.path.join(HERE, "fonts")

CREAM = (246, 240, 230)
INK = (28, 26, 30)
NAVY = (30, 42, 66)
GOLD = (201, 162, 92)


def font(name, size, weight=None, opsz=None):
    f = ImageFont.truetype(os.path.join(F, name), size)
    if name == "Inter.ttf":
        f.set_variation_by_axes([opsz or 32, weight or 400])
    elif weight:
        f.set_variation_by_axes([weight])
    return f


def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def ease(t):  # easeOutCubic
    t = clamp(t)
    return 1 - (1 - t) ** 3


def ease_io(t):
    t = clamp(t)
    return 4 * t ** 3 if t < 0.5 else 1 - (-2 * t + 2) ** 3 / 2


def prog(t, start, dur):
    return ease((t - start) / dur)


# ---------- image prep ----------
def grade_2015(img):
    """Warm, slightly faded film look; leans into the blur instead of fighting it."""
    img = img.filter(ImageFilter.UnsharpMask(radius=2.2, percent=90, threshold=2))
    img = ImageEnhance.Contrast(img).enhance(1.06)
    a = np.asarray(img).astype(np.float32)
    a[..., 0] = a[..., 0] * 1.04 + 6
    a[..., 2] = a[..., 2] * 0.93
    a = a * 0.94 + 14  # lift blacks
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


def grade_2026(img):
    img = ImageEnhance.Contrast(img).enhance(1.04)
    return ImageEnhance.Color(img).enhance(1.05)


def cover(img, w, h, cx=0.5, cy=0.5):
    """Scale to cover w x h, crop around focal point (cx, cy) in 0..1."""
    s = max(w / img.width, h / img.height)
    nw, nh = math.ceil(img.width * s), math.ceil(img.height * s)
    r = img.resize((nw, nh), Image.LANCZOS)
    x = int(clamp(cx * nw - w / 2, 0, nw - w))
    y = int(clamp(cy * nh - h / 2, 0, nh - h))
    return r.crop((x, y, x + w, y + h))


def kenburns(base, z, fx=0.5, fy=0.5):
    """base is pre-rendered at (W*Z, H*Z); zoom z in [1, Z] about focal point."""
    bw, bh = base.size
    cw, ch = bw / z, bh / z
    x = clamp(fx * bw - cw / 2, 0, bw - cw)
    y = clamp(fy * bh - ch / 2, 0, bh - ch)
    return base.resize((W, H), Image.BICUBIC, box=(x, y, x + cw, y + ch))


rng = np.random.default_rng(7)
GRAIN = [Image.fromarray(rng.normal(128, 22, (H, W)).clip(0, 255).astype(np.uint8)) for _ in range(6)]


def add_grain(img, i, amt=0.10):
    return _overlay(img, GRAIN[i % len(GRAIN)], amt)


def _overlay(img, g, amt):
    a = np.asarray(img).astype(np.int16)
    n = (np.asarray(g).astype(np.int16) - 128)[..., None]
    return Image.fromarray(np.clip(a + n * amt * 2, 0, 255).astype(np.uint8))


def vignette(strength=0.45):
    y, x = np.ogrid[:H, :W]
    d = np.sqrt(((x - W / 2) / (W / 2)) ** 2 + ((y - H / 2) / (H / 2)) ** 2) / math.sqrt(2)
    m = (1 - strength * np.clip(d, 0, 1) ** 2.2)
    return m[..., None].astype(np.float32)


VIG = vignette()


def apply_vig(img):
    return Image.fromarray((np.asarray(img).astype(np.float32) * VIG).astype(np.uint8))


def gradient(top_alpha, bottom_alpha, color=(0, 0, 0), start=0.0, end=1.0):
    a = np.zeros((H, 1), np.float32)
    ys = np.linspace(0, 1, H)
    t = np.clip((ys - start) / max(end - start, 1e-6), 0, 1)
    a[:, 0] = top_alpha + (bottom_alpha - top_alpha) * t
    al = Image.fromarray((a * 255).astype(np.uint8)).resize((W, H))
    layer = Image.new("RGBA", (W, H), color + (0,))
    layer.putalpha(al)
    return layer


# ---------- text helpers ----------
class Layer:
    def __init__(self):
        self.im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        self.d = ImageDraw.Draw(self.im)

    def text(self, xy, s, f, color, alpha=1.0, anchor="la", spacing=0, dy=0):
        if alpha <= 0.002:
            return
        x, y = xy
        if spacing:
            # manual letter-spacing
            widths = [self.d.textlength(c, font=f) for c in s]
            total = sum(widths) + spacing * (len(s) - 1)
            if anchor[0] == "m":
                x -= total / 2
            elif anchor[0] == "r":
                x -= total
            for c, w in zip(s, widths):
                self.d.text((x, y + dy), c, font=f, fill=color + (int(255 * alpha),), anchor="l" + anchor[1])
                x += w + spacing
            return
        self.d.text((x, y + dy), s, font=f, fill=color + (int(255 * alpha),), anchor=anchor)


def comp(base, *layers):
    out = base.convert("RGBA")
    for l in layers:
        out.alpha_composite(l.im if isinstance(l, Layer) else l)
    return out.convert("RGB")


def heart(d, cx, cy, s, color):
    pts = []
    for i in range(80):
        t = i / 80 * 2 * math.pi
        x = 16 * math.sin(t) ** 3
        y = 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)
        pts.append((cx + x * s / 16, cy - y * s / 16))
    d.polygon(pts, fill=color)


def swipe_hint(layer, t, start, color=(255, 255, 255)):
    a = prog(t, start, 0.5)
    if a <= 0:
        return
    f = font("Inter.ttf", 30, 600)
    bob = math.sin((t - start) * 5) * 8
    x, y = W - 70, H - 78
    layer.text((x - 52, y), "SWIPE", f, color, a, anchor="rm", spacing=4)
    d = layer.d
    c = color + (int(255 * a),)
    ax = x - 30 + bob
    d.line([(ax, y), (ax + 34, y)], fill=c, width=4)
    d.line([(ax + 22, y - 12), (ax + 35, y), (ax + 22, y + 12)], fill=c, width=4, joint="curve")


def polaroid(img, w, angle, caption=None, cap_font=None):
    pad, bottom = int(w * 0.06), int(w * 0.22)
    ph = int(w * 1.0)
    card = Image.new("RGBA", (w + 2 * pad, ph + pad + bottom), (252, 250, 245, 255))
    card.paste(cover(img, w, ph, 0.5, 0.42), (pad, pad))
    if caption:
        d = ImageDraw.Draw(card)
        d.text((card.width / 2, ph + pad + bottom / 2), caption, font=cap_font, fill=INK + (255,), anchor="mm")
    shadow = Image.new("RGBA", (card.width + 60, card.height + 60), (0, 0, 0, 0))
    shadow.paste(Image.new("RGBA", card.size, (0, 0, 0, 90)), (30, 38))
    shadow = shadow.filter(ImageFilter.GaussianBlur(14))
    shadow.alpha_composite(card, (30, 30))
    return shadow.rotate(angle, resample=Image.BICUBIC, expand=True)


# ---------- slides ----------
def slide1(p15, n):
    """Hook: the 2015 selfie, film look, curiosity gap."""
    Z = 1.14
    base = cover(p15, int(W * Z), int(H * Z), 0.5, 0.45)
    grad = gradient(0, 0.88, start=0.42, end=1.0)
    topg = gradient(0.45, 0, start=0.0, end=0.18)
    f_year = font("Playfair.ttf", 230, 800)
    f_line = font("PlayfairItalic.ttf", 62, 500)
    f_tag = font("Inter.ttf", 28, 600)
    for i in range(n):
        t = i / FPS
        img = kenburns(base, Z - (Z - 1) * ease_io(t / (n / FPS)), 0.5, 0.38)
        img = apply_vig(add_grain(img, i, 0.09))
        L = Layer()
        a = prog(t, 0.2, 0.6)
        L.text((70, 70), "OUR FIRST PHOTO TOGETHER", f_tag, (255, 255, 255), a, spacing=5)
        p = prog(t, 0.4, 0.9)
        L.text((62, 980 + 40 * (1 - p)), "2015", f_year, (255, 255, 255), p, anchor="ls")
        p = prog(t, 1.2, 0.7)
        L.text((70, 1080 + 30 * (1 - p)), "We were just dating.", f_line, (255, 255, 255), p, anchor="ls")
        p = prog(t, 2.0, 0.7)
        L.text((70, 1160 + 30 * (1 - p)), "No idea who'd show up later.", f_line, (238, 214, 170), p, anchor="ls")
        swipe_hint(L, t, 2.8)
        yield comp(img, topg, grad, L)


def slide2(p15, p26, n):
    """Year counter 2015 -> 2026 while the photos cross-fade underneath."""
    a = cover(p15, W, H, 0.5, 0.4).filter(ImageFilter.GaussianBlur(28))
    b = cover(p26, W, H, 0.55, 0.45).filter(ImageFilter.GaussianBlur(28))
    dark = Image.new("RGB", (W, H), (12, 12, 16))
    a = Image.blend(a, dark, 0.55)
    b = Image.blend(b, dark, 0.55)
    f_num = font("Playfair.ttf", 300, 800)
    f_small = font("Inter.ttf", 30, 600)
    f_big = font("PlayfairItalic.ttf", 84, 500)
    count_start, count_dur = 0.5, 2.6
    for i in range(n):
        t = i / FPS
        k = ease_io((t - count_start) / count_dur)
        img = Image.blend(a, b, k)
        img = add_grain(img, i, 0.05)
        L = Layer()
        year = 2015 + int(round(k * 11))
        pop = 1 + 0.05 * max(0, math.sin(((t - count_start) * 11 / count_dur) * math.pi)) if k < 1 else 1
        L.text((W / 2, 300), "FROM DATING TO", f_small, (255, 255, 255), prog(t, 0, 0.5), anchor="mm", spacing=6)
        fn = f_num if abs(pop - 1) < 0.01 else font("Playfair.ttf", int(300 * pop), 800)
        L.text((W / 2, 620), str(year), fn, (255, 255, 255), 1, anchor="mm")
        # timeline: one dot per year
        x0, x1, y = 150, W - 150, 860
        L.d.line([(x0, y), (x1, y)], fill=(255, 255, 255, 70), width=3)
        L.d.line([(x0, y), (x0 + (x1 - x0) * k, y)], fill=GOLD + (255,), width=5)
        for j in range(12):
            x = x0 + (x1 - x0) * j / 11
            on = k * 11 >= j - 0.01
            r = 9 if j in (0, 11) else 6
            L.d.ellipse([x - r, y - r, x + r, y + r], fill=(GOLD if on else (255, 255, 255)) + (255 if on else 90,))
        L.text((x0, y + 50), "2015", f_small, (255, 255, 255), 0.8, anchor="mm")
        L.text((x1, y + 50), "2026", f_small, (255, 255, 255), 0.8, anchor="mm")
        p = prog(t, count_start + count_dur + 0.1, 0.7)
        L.text((W / 2, 1080 + 25 * (1 - p)), "10 years married.", f_big, (255, 255, 255), p, anchor="mm")
        p = prog(t, count_start + count_dur + 0.6, 0.7)
        L.text((W / 2, 1180 + 25 * (1 - p)), "And then there were three.", f_big, (238, 214, 170), p, anchor="mm")
        swipe_hint(L, t, count_start + count_dur + 1.2)
        yield comp(img, L)


def slide3(p26, n):
    """The reveal: 2026 beach photo with an annotation on the son."""
    Z = 1.10
    # focal point: family sits slightly below centre
    CY = 0.0  # keep all the sky for the headline, trim sand instead
    base = cover(p26, int(W * Z), int(H * Z), 0.5, CY)
    f_year = font("Playfair.ttf", 170, 800)
    f_line = font("PlayfairItalic.ttf", 54, 600)
    f_note = font("PlayfairItalic.ttf", 50, 600)
    topg = gradient(0.55, 0, color=(255, 255, 255), start=0.0, end=0.26)
    # son's position in the final (z=1.0 after zoom-in) frame, measured from the source photo
    sw = W * Z
    s = sw / p26.width
    ox = (sw - W * Z) / 2  # 0
    cropy = clamp(CY * p26.height * s - H * Z / 2, 0, p26.height * s - H * Z)
    for i in range(n):
        t = i / FPS
        z = 1 + (Z - 1) * (1 - ease_io(t / (n / FPS)))  # slow zoom out (reveals more family)
        img = kenburns(base, z, 0.5, 0.55)
        L = Layer()
        p = prog(t, 0.2, 0.8)
        L.text((W / 2, 205 + 30 * (1 - p)), "2026", f_year, NAVY, p, anchor="ms")
        p = prog(t, 0.8, 0.7)
        L.text((W / 2, 285 + 20 * (1 - p)), "Same two people. Plus one.", f_line, NAVY, p, anchor="ms")
        # annotation on son (source coords ~ (630, 1180) in a 1717x2576 photo)
        bw, bh = base.size
        cw, ch = bw / z, bh / z
        bx = clamp(0.5 * bw - cw / 2, 0, bw - cw)
        by = clamp(0.55 * bh - ch / 2, 0, bh - ch)
        sx = (630 * s - bx) * (W / cw)
        sy = (1180 * s - cropy - by) * (H / ch)
        p = prog(t, 2.0, 0.9)
        if p > 0:
            lx, ly = 250, 1230
            L.text((lx - 20, ly + 10), "our favorite plot twist", f_note, (255, 255, 255), p, anchor="lm")
            # curved arrow from label up to the son
            pts = []
            steps = 40
            for j in range(int(steps * p) + 1):
                u = j / steps
                cx1, cy1 = lx + 470, ly - 140
                x = (1 - u) ** 2 * (lx + 440) + 2 * (1 - u) * u * cx1 + u ** 2 * 600
                y = (1 - u) ** 2 * (ly - 40) + 2 * (1 - u) * u * cy1 + u ** 2 * 975
                pts.append((x, y))
            if len(pts) > 1:
                L.d.line(pts, fill=(255, 255, 255, int(255 * p)), width=5, joint="curve")
            if p > 0.95:
                ex, ey = pts[-1]
                px, py = pts[-4]
                ang = math.atan2(ey - py, ex - px)
                for da in (2.6, -2.6):
                    L.d.line([(ex, ey), (ex + 26 * math.cos(ang + da), ey + 26 * math.sin(ang + da))], fill=(255, 255, 255, 255), width=5)
        botg = gradient(0, 0.55 * p, start=0.75, end=1.0)
        swipe_hint(L, t, 3.2)
        yield comp(img, topg, botg, L)


def slide4(p15, p26, n):
    """Then / Now split: a divider rises from the bottom, pushing 2015 up and revealing 2026."""
    hh = H // 2
    g15 = grade_2015(p15)
    f_lab = font("Inter.ttf", 30, 700)
    for i in range(n):
        t = i / FPS
        k = ease_io((t - 0.4) / 1.4)
        dy = int(round(H - (H - hh) * k))
        frame = cover(g15, W, dy, 0.5, 0.36 + 0.04 * (1 - k)) if dy > 0 else None
        canvas = Image.new("RGB", (W, H))
        canvas.paste(frame, (0, 0))
        if dy < H:
            canvas.paste(cover(p26, W, H - dy, 0.5, 0.50), (0, dy))
        canvas = add_grain(canvas, i, 0.05)
        L = Layer()
        if dy < H:
            L.d.rectangle([0, dy - 4, W, dy + 4], fill=(255, 255, 255, 255))
        p = prog(t, 1.6, 0.6)
        L.d.rounded_rectangle([50, 50, 310, 110], 30, fill=(0, 0, 0, int(150 * p)))
        L.text((180, 80), "THEN · 2015", f_lab, (255, 255, 255), p, anchor="mm")
        L.d.rounded_rectangle([50, hh + 50, 300, hh + 110], 30, fill=(0, 0, 0, int(150 * p)))
        L.text((175, hh + 80), "NOW · 2026", f_lab, (255, 255, 255), p, anchor="mm")
        swipe_hint(L, t, 2.6)
        yield comp(canvas, L)


def slide5(p15, p26, n):
    """Close + share CTA."""
    bg = Image.new("RGB", (W, H), CREAM)
    pol_font = font("PlayfairItalic.ttf", 40, 600)
    pa = polaroid(grade_2015(p15), 380, 7, "2015", pol_font)
    pb = polaroid(p26, 380, -6, "2026", pol_font)
    f_h = font("Playfair.ttf", 96, 800)
    f_hi = font("PlayfairItalic.ttf", 96, 500)
    f_s = font("Inter.ttf", 34, 500)
    f_cta = font("Inter.ttf", 34, 700)
    for i in range(n):
        t = i / FPS
        img = add_grain(bg, i, 0.03)
        L = Layer()
        p = prog(t, 0.1, 0.8)
        L.text((W / 2, 190 + 25 * (1 - p)), "Same two people.", f_h, INK, p, anchor="ms")
        p = prog(t, 0.6, 0.8)
        L.text((W / 2, 300 + 25 * (1 - p)), "Bigger story.", f_hi, (166, 120, 52), p, anchor="ms")
        p = prog(t, 1.1, 0.7)
        L.text((W / 2, 380), "2015 → 10 years married → 1 tiny human", f_s, INK, p * 0.75, anchor="ms")
        # polaroids drop in
        for (pol, x, y, st) in ((pa, 80, 500, 1.4), (pb, 520, 470, 1.8)):
            q = prog(t, st, 0.7)
            if q > 0:
                pl = pol.copy()
                pl.putalpha(pl.getchannel("A").point(lambda v, q=q: int(v * q)))
                L.im.alpha_composite(pl, (x, int(y - 60 * (1 - q))))
        p = prog(t, 2.6, 0.6)
        if p > 0:
            L.d.rounded_rectangle([110, 1150, W - 110, 1250], 50, fill=INK + (int(255 * p),))
            heart(L.d, 205, 1203, 22, (226, 88, 98, int(255 * p)))
            L.text((W / 2 + 30, 1200), "Send this to your person", f_cta, CREAM, p, anchor="mm")
        yield comp(img, L)


def render(frames, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
           "-i", "-", "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p", "-movflags", "+faststart", path]
    pr = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    last = None
    for fr in frames:
        pr.stdin.write(fr.tobytes())
        last = fr
    pr.stdin.close()
    pr.wait()
    last.save(path.replace(".mp4", ".png"))
    print("wrote", path)


def main():
    p15 = ImageOps.exif_transpose(Image.open(sys.argv[1])).convert("RGB")
    p26 = ImageOps.exif_transpose(Image.open(sys.argv[2])).convert("RGB")
    out = sys.argv[3] if len(sys.argv) > 3 else os.path.join(HERE, "output")
    g15, g26 = grade_2015(p15), grade_2026(p26)
    only = os.environ.get("ONLY")
    jobs = {
        "1": lambda: render(slide1(g15, 6 * FPS), f"{out}/slide1.mp4"),
        "2": lambda: render(slide2(g15, g26, 6 * FPS), f"{out}/slide2.mp4"),
        "3": lambda: render(slide3(g26, 6 * FPS), f"{out}/slide3.mp4"),
        "4": lambda: render(slide4(p15, g26, 5 * FPS), f"{out}/slide4.mp4"),
        "5": lambda: render(slide5(p15, g26, 6 * FPS), f"{out}/slide5.mp4"),
    }
    for k, fn in jobs.items():
        if not only or k in only:
            fn()


if __name__ == "__main__":
    main()
