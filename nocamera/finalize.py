#!/usr/bin/env python3
"""Make post-ready files: optional burned-in hook text + an ambient soundtrack, loudness-normalised.

API posting can't add Instagram's text overlays or licensed trending audio, so both are baked in here.

  python3 finalize.py <in.mp4> <out.mp4> [--hook "text"] [--mood ink|chrome|particles|story]

Videos rendered with ?hook= already carry their text; leave --hook out for those.
"""
import argparse, subprocess, sys, tempfile, os, json, textwrap

FONT = "/usr/share/fonts/opentype/inter/Inter-SemiBold.otf"
# Chords (Hz) per mood; every voice gets its own slow swell so the bed breathes instead of droning.
CHORDS = {
    "ink":       [146.83, 220.00, 277.18, 329.63, 440.00],          # D maj9, open and warm
    "chrome":    [110.00, 164.81, 246.94, 261.63, 329.63],          # A min add9, cool
    "particles": [87.31, 130.81, 174.61, 220.00, 329.63],           # F maj7, floating
    "story":     [98.00, 146.83, 196.00, 233.08, 293.66],           # G min, tender
}


def duration(path):
    out = subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", path])
    return float(json.loads(out)["format"]["duration"])


def ambient(dur, mood, wav):
    f = CHORDS[mood]
    # swell period divides the clip length, so the bed loops as cleanly as the picture does
    voices = "+".join(
        f"{0.16 if i == 0 else 0.11}*sin(2*PI*{hz}*t)*(0.55+0.45*sin(2*PI*t*{(i % 3) + 1}/{dur}+{i * 1.3}))"
        for i, hz in enumerate(f))
    expr = f"({voices})*0.8"
    air = "0.012*(random(0)-0.5)"
    subprocess.check_call([
        "ffmpeg", "-nostdin", "-v", "error", "-y",
        "-f", "lavfi", "-i", f"aevalsrc='{expr}|{expr}':s=48000:d={dur}",
        "-f", "lavfi", "-i", f"aevalsrc='{air}|{air}':s=48000:d={dur}",
        "-filter_complex",
        "[1]highpass=f=3000,lowpass=f=9000[a];[0][a]amix=inputs=2:normalize=0,lowpass=f=2200,"
        "aecho=0.8:0.7:120|260:0.25|0.18,afade=t=in:d=0.25,afade=t=out:st=" + f"{max(dur - 0.25, 0)}" + ":d=0.25,"
        "loudnorm=I=-16:TP=-1.5:LRA=7",
        "-ar", "48000", wav])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src"); ap.add_argument("dst")
    ap.add_argument("--hook", default="")
    ap.add_argument("--mood", default="ink", choices=sorted(CHORDS))
    a = ap.parse_args()
    dur = duration(a.src)
    with tempfile.TemporaryDirectory() as td:
        wav = os.path.join(td, "bed.wav")
        ambient(dur, a.mood, wav)
        vf = []
        if a.hook:
            lines = [a.hook]
            if len(a.hook) > 30:   # two balanced lines, never an orphaned word
                sp = [i for i, ch in enumerate(a.hook) if ch == " "]
                cut = min(sp, key=lambda i: abs(i - len(a.hook) / 2))
                lines = [a.hook[:cut], a.hook[cut + 1:]]
            for i, line in enumerate(lines):
                txt = os.path.join(td, f"l{i}.txt")
                open(txt, "w").write(line)
                y = f"h*0.14-{(len(lines) - 1) * 34}+{i * 68}-th/2"
                vf.append(f"drawtext=fontfile={FONT}:textfile={txt}:fontsize=52:fontcolor=white:"
                          f"x=(w-tw)/2:y={y}:shadowcolor=black@0.7:shadowx=0:shadowy=3"
                          f":box=1:boxcolor=black@0.32:boxborderw=14")   # soft backing so light footage stays readable
        cmd = ["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", a.src, "-i", wav]
        if vf:
            cmd += ["-vf", ",".join(vf), "-c:v", "libx264", "-preset", "slow", "-crf", "19",
                    "-maxrate", "14M", "-bufsize", "28M", "-pix_fmt", "yuv420p"]
        else:
            cmd += ["-c:v", "copy"]
        cmd += ["-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", a.dst]
        os.makedirs(os.path.dirname(os.path.abspath(a.dst)), exist_ok=True)
        subprocess.check_call(cmd)
    print("wrote", a.dst)


if __name__ == "__main__":
    sys.exit(main())
