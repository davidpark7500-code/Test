#!/usr/bin/env python3
"""Seamless "traveling icon" carousel: one road spans all 5 slides and a little car drives
off each slide and onto the next as you swipe. The car picks up 'Just Married' cans and later
a 'Baby on board' sign.

Usage: python3 build_road.py <photo_2015.jpg> <photo_2026.jpg> [out_dir]
"""
import math, os, sys
from PIL import Image, ImageDraw, ImageFilter, ImageOps
from build import (W, H, FPS, CREAM, INK, GOLD, font, prog, ease, ease_io, clamp, Layer, comp, heart,
                   polaroid, grade_2015, grade_2026, add_grain, render)

N = 5
GW = W * N
LOOP = 4.5            # seconds per slide video (Instagram loops it)
ENTER, EXIT = 0.5, 3.6  # car crosses the slide between these times
CORAL = (226, 88, 98)
ROAD = (226, 212, 190)
TAN = (166, 120, 52)


def road_y(gx):
    return 1215 + 24 * math.sin(2 * math.pi * gx / 1350)


def road_slope(gx):
    return 24 * 2 * math.pi / 1350 * math.cos(2 * math.pi * gx / 1350)


# ---------- static panorama ----------
def panorama():
    g = Image.new("RGB", (GW, H), CREAM)
    d = ImageDraw.Draw(g, "RGBA")
    pts = [(x, road_y(x)) for x in range(-20, GW + 21, 6)]
    d.polygon([(x, y - 42) for x, y in pts] + [(x, y + 42) for x, y in reversed(pts)], fill=ROAD)
    # dashed centre line
    for x in range(0, GW, 60):
        seg = [(xx, road_y(xx)) for xx in range(x, x + 32, 4)]
        d.line(seg, fill=(255, 255, 255, 230), width=6)
    # doodles that straddle the seams so the slides read as one picture
    for k in range(1, N):
        sx = k * W
        heart(d, sx, 1090, 24, CORAL + (255,))
        for (dx, dy, r) in ((-60, 1060, 9), (55, 1100, 7)):
            sparkle(d, sx + dx, dy, r)
    return g


def sparkle(d, x, y, r, color=GOLD):
    d.polygon([(x, y - r * 2), (x + r * 0.5, y - r * 0.5), (x + r * 2, y), (x + r * 0.5, y + r * 0.5),
               (x, y + r * 2), (x - r * 0.5, y + r * 0.5), (x - r * 2, y), (x - r * 0.5, y - r * 0.5)], fill=color)


# ---------- the car ----------
AX, AY = 375, 228  # anchor = bottom centre between the wheels


def car(variant):
    im = Image.new("RGBA", (520, 260), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if variant == "cans":
        for (cx, cy) in ((90, 210), (150, 218), (205, 206)):
            d.line([(272, 175), (cx + 18, cy + 10)], fill=(120, 110, 100), width=3)
            d.rounded_rectangle([cx, cy, cx + 34, cy + 26], 5, fill=(178, 182, 190), outline=(120, 124, 132), width=3)
    d.ellipse([255, 218, 495, 240], fill=(0, 0, 0, 45))  # shadow
    d.rounded_rectangle([308, 60, 432, 130], 28, fill=CORAL)
    d.rounded_rectangle([268, 118, 484, 204], 30, fill=CORAL)
    d.rounded_rectangle([322, 72, 366, 120], 10, fill=(196, 226, 240))
    d.rounded_rectangle([374, 72, 420, 120], 10, fill=(196, 226, 240))
    # passengers
    d.ellipse([382, 80, 410, 108], fill=(70, 52, 40))            # driver
    d.ellipse([330, 80, 358, 108], fill=(28, 24, 26))            # passenger
    if variant == "family":
        d.ellipse([341, 98, 359, 116], fill=(168, 112, 70))      # tiny human
    d.ellipse([468, 140, 484, 158], fill=(255, 214, 120))       # headlight
    for wx in (312, 440):
        d.ellipse([wx - 28, 172, wx + 28, 228], fill=(40, 38, 44))
        d.ellipse([wx - 11, 189, wx + 11, 211], fill=(200, 200, 205))
    sign = {"cans": "JUST MARRIED", "married": "JUST MARRIED", "family": "BABY ON BOARD"}.get(variant)
    if sign:
        d.text((376, 162), sign, font=font("Inter.ttf", 19, 800), fill=(255, 255, 255), anchor="mm")
    return im


CARS = {v: car(v) for v in ("dating", "cans", "married", "family")}


def place_car(layer, variant, x, t, local_off=0):
    """x is the car anchor in slide-local coords; road follows global coords."""
    gx = x + local_off
    y = road_y(gx)
    ang = -math.degrees(math.atan(road_slope(gx)))
    bob = 2.5 * math.sin(t * 22)
    im = CARS[variant].rotate(ang, resample=Image.BICUBIC, center=(AX, AY))
    layer.im.alpha_composite(im, (int(x - AX), int(y - AY - 14 + bob)))
    if variant == "dating":  # floating heart over the roof
        hb = 6 * math.sin(t * 4)
        heart(layer.d, x - 5, y - 245 + hb, 20, CORAL + (255,))


def car_x(t):
    p = clamp((t - ENTER) / (EXIT - ENTER))
    p = 0.5 * p + 0.5 * (p * p * (3 - 2 * p))  # mild ease, keeps speed at the seams
    return -160 + (W + 320) * p


def swipe(layer, t, start=1.0):
    a = prog(t, start, 0.5)
    f = font("Inter.ttf", 26, 700)
    bob = math.sin(t * 5) * 7
    layer.text((W - 118, 92), "SWIPE", f, INK, a * 0.8, anchor="rm", spacing=4)
    c = INK + (int(200 * a),)
    x = W - 100 + bob
    layer.d.line([(x, 92), (x + 34, 92)], fill=c, width=4)
    layer.d.line([(x + 22, 80), (x + 35, 92), (x + 22, 104)], fill=c, width=4)


def drop(layer, im, x, y, t, start):
    q = prog(t, start, 0.7)
    if q <= 0:
        return
    pl = im.copy()
    pl.putalpha(pl.getchannel("A").point(lambda v: int(v * q)))
    layer.im.alpha_composite(pl, (int(x), int(y - 70 * (1 - q))))


def rings(d, cx, cy, r, a):
    c = GOLD + (int(255 * a),)
    d.ellipse([cx - r - 40, cy - r, cx + r - 40, cy + r], outline=c, width=14)
    d.ellipse([cx - r + 40, cy - r, cx + r + 40, cy + r], outline=c, width=14)
    sparkle(d, cx + 40 + r * 0.7, cy - r * 0.8, 10, (255, 214, 120, int(255 * a)))


# ---------- slides ----------
def slides(p15, p26):
    pano = panorama()
    f_lab = font("Inter.ttf", 28, 700)
    f_h = font("Playfair.ttf", 92, 800)
    f_hi = font("PlayfairItalic.ttf", 92, 500)
    f_sub = font("PlayfairItalic.ttf", 50, 500)
    f_cap = font("PlayfairItalic.ttf", 40, 600)
    pol15 = polaroid(p15, 420, -4, "2015 · just dating", f_cap)
    pol26 = polaroid(p26, 440, 3, "2026 · party of three", f_cap)
    pol15s = polaroid(p15, 340, 6, "2015", f_cap)
    pol26s = polaroid(p26, 340, -5, "2026", f_cap)
    n = int(LOOP * FPS)

    def frames(k, draw, variant, parked=False):
        bg = pano.crop((k * W, 0, (k + 1) * W, H))
        for i in range(n):
            t = i / FPS
            L = Layer()
            draw(L, t)
            if parked:
                x = -160 + (W / 2 + 160) * ease(clamp((t - ENTER) / 2.0))
            else:
                x = car_x(t)
            place_car(L, variant, x, t, k * W)
            if parked and t > ENTER + 2.0:
                for j in range(3):
                    u = (t - ENTER - 2.0 - j * 0.35)
                    if u > 0:
                        heart(L.d, W / 2 - 40 + j * 40, road_y(k * W + W / 2) - 290 - u * 120, 16 + j * 3,
                              CORAL + (int(255 * clamp(1.4 - u)),))
            yield comp(add_grain(bg, i, 0.025), L)

    def s1(L, t):
        L.text((70, 92), "OUR LOVE STORY", f_lab, TAN, prog(t, 0, .5), anchor="lm", spacing=5)
        p = prog(t, .1, .7); L.text((70, 260 + 25 * (1 - p)), "It started with", f_h, INK, p, anchor="ls")
        p = prog(t, .4, .7); L.text((70, 360 + 25 * (1 - p)), "one blurry selfie.", f_hi, CORAL, p, anchor="ls")
        drop(L, pol15, 250, 395, t, .5)
        swipe(L, t)

    def s2(L, t):
        L.text((W / 2, 130), "2016", f_lab, TAN, prog(t, 0, .5), anchor="mm", spacing=8)
        p = prog(t, .1, .8); L.text((W / 2, 420 + 30 * (1 - p)), "I do.", font("Playfair.ttf", 230, 800), INK, p, anchor="ms")
        rings(L.d, W / 2, 640, 105, prog(t, .5, .8))
        p = prog(t, .8, .7); L.text((W / 2, 880 + 20 * (1 - p)), "We made it official.", f_sub, INK, p, anchor="ms")
        p = prog(t, 1.1, .7); L.text((W / 2, 950 + 20 * (1 - p)), "(the cans were not optional)", f_cap, TAN, p * .8, anchor="ms")
        swipe(L, t)

    def s3(L, t):
        L.text((W / 2, 130), "10 YEARS MARRIED", f_lab, TAN, prog(t, 0, .5), anchor="mm", spacing=8)
        v = int(3650 * ease_io((t - .2) / 1.8))
        L.text((W / 2, 560), f"{v:,}", font("Playfair.ttf", 250, 800), INK, prog(t, 0, .3), anchor="ms")
        if v >= 3650:
            L.text((W / 2 + 330, 470), "+", font("Playfair.ttf", 140, 800), CORAL, prog(t, 2.0, .4), anchor="ms")
        p = prog(t, 1.2, .7); L.text((W / 2, 690 + 20 * (1 - p)), "days of choosing each other", f_sub, INK, p, anchor="ms")
        p = prog(t, 1.6, .7); L.text((W / 2, 770 + 20 * (1 - p)), "and still picking the same person", f_cap, TAN, p * .85, anchor="ms")
        swipe(L, t)

    def s4(L, t):
        L.text((70, 92), "2026", f_lab, TAN, prog(t, 0, .5), anchor="lm", spacing=8)
        p = prog(t, .1, .7); L.text((70, 250 + 25 * (1 - p)), "And then there", f_h, INK, p, anchor="ls")
        p = prog(t, .4, .7); L.text((70, 350 + 25 * (1 - p)), "were three.", f_hi, CORAL, p, anchor="ls")
        drop(L, pol26, 260, 385, t, .5)
        swipe(L, t)

    def s5(L, t):
        p = prog(t, .1, .7); L.text((W / 2, 200 + 25 * (1 - p)), "Same two people.", f_h, INK, p, anchor="ms")
        p = prog(t, .4, .7); L.text((W / 2, 305 + 25 * (1 - p)), "Bigger story.", f_hi, CORAL, p, anchor="ms")
        drop(L, pol15s, 110, 360, t, .6)
        drop(L, pol26s, 560, 345, t, .9)
        p = prog(t, 1.4, .6)
        if p > 0:
            L.d.rounded_rectangle([150, 905, W - 150, 995], 45, fill=INK + (int(255 * p),))
            heart(L.d, 235, 950, 20, CORAL + (int(255 * p),))
            L.text((W / 2 + 30, 950), "Send this to your person", font("Inter.ttf", 32, 700), CREAM, p, anchor="mm")

    plan = [(s1, "dating", False), (s2, "cans", False), (s3, "married", False), (s4, "family", False), (s5, "family", True)]
    return [(k, frames(k, fn, v, parked)) for k, (fn, v, parked) in enumerate(plan)]


def main():
    p15 = grade_2015(ImageOps.exif_transpose(Image.open(sys.argv[1])).convert("RGB"))
    p26 = grade_2026(ImageOps.exif_transpose(Image.open(sys.argv[2])).convert("RGB"))
    out = sys.argv[3] if len(sys.argv) > 3 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "output_road")
    only = os.environ.get("ONLY")
    for k, fr in slides(p15, p26):
        if not only or str(k + 1) in only:
            render(fr, f"{out}/slide{k + 1}.mp4")


if __name__ == "__main__":
    main()
