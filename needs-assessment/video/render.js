// Renders how-it-works.html to an MP4 (1080x1920, 30fps).
// Usage: node render.js [out.mp4]
// If audio/scene-01.mp3 ... exist (from make-voice.js), each scene is timed to its clip
// and the voiceover is mixed in. Otherwise the video is silent with on-screen captions.
const { chromium } = require("playwright");
const { spawn, execFileSync } = require("child_process");
const fs = require("fs"), path = require("path");
const { SCENES, estimateDuration } = require("./scenes.js");
const OUT = path.resolve(process.argv[2] || "how-it-works.mp4");
const FPS = 30, AUDIO = path.join(__dirname, "audio");

const clip = (i) => path.join(AUDIO, `scene-${String(i + 1).padStart(2, "0")}.mp3`);
const hasAudio = SCENES.every((_, i) => fs.existsSync(clip(i)));
const probe = (f) => parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString());
const LEAD = 0.35, TAIL = 0.7; // silence before / after each line
const durations = hasAudio ? SCENES.map((_, i) => LEAD + probe(clip(i)) + TAIL) : SCENES.map(estimateDuration);
const total = durations.reduce((a, b) => a + b, 0);

(async () => {
  console.log(hasAudio ? "Using voiceover clips." : "No voiceover found: rendering silent with captions.", `Length ${total.toFixed(1)}s`);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  await p.goto("file://" + path.join(__dirname, "how-it-works.html") + "?export");
  await p.evaluate(() => window.__ready);
  await p.evaluate((d) => window.__setDurations(d), durations);

  const args = ["-y", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-"];
  if (hasAudio) {
    SCENES.forEach((_, i) => args.push("-i", clip(i)));
    const parts = SCENES.map((_, i) => `[${i + 1}:a]adelay=${Math.round(LEAD * 1000)}:all=1,apad,atrim=0:${durations[i].toFixed(3)}[a${i}]`).join(";");
    args.push("-filter_complex", `${parts};${SCENES.map((_, i) => `[a${i}]`).join("")}concat=n=${SCENES.length}:v=0:a=1[aout]`, "-map", "0:v", "-map", "[aout]", "-c:a", "aac", "-b:a", "160k");
  }
  args.push("-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "22", "-preset", "medium", "-movflags", "+faststart", "-t", total.toFixed(3), OUT);
  const ff = spawn("ffmpeg", args, { stdio: ["pipe", "ignore", "inherit"] });

  const frames = Math.ceil(total * FPS);
  for (let f = 0; f < frames; f++) {
    const d = await p.evaluate((t) => { window.__render(t); return document.getElementById("c").toDataURL("image/jpeg", 0.92); }, Math.min(f / FPS, total - 0.001));
    if (!ff.stdin.write(Buffer.from(d.split(",")[1], "base64"))) await new Promise((r) => ff.stdin.once("drain", r));
    if (f % 300 === 0) process.stdout.write(`frame ${f}/${frames}\n`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on("close", r));
  await b.close();
  console.log("Wrote", OUT);
})();
