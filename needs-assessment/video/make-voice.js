// Generates the voiceover with ElevenLabs: one MP3 per scene in ./audio.
// Usage: ELEVENLABS_API_KEY=... [ELEVENLABS_VOICE_ID=...] node make-voice.js
// Then run: node render.js
// Requires Node 18+ (built-in fetch). Never commit your API key.
const fs = require("fs"), path = require("path");
const { SCENES } = require("./scenes.js");
const KEY = process.env.ELEVENLABS_API_KEY;
const VOICE = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM"; // replace with the voice you pick in ElevenLabs
const MODEL = process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2";
if (!KEY) { console.error("Set ELEVENLABS_API_KEY first."); process.exit(1); }

(async () => {
  const dir = path.join(__dirname, "audio");
  fs.mkdirSync(dir, { recursive: true });
  for (const [i, s] of SCENES.entries()) {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": KEY, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({
        text: s.narration,
        model_id: MODEL,
        voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.2, use_speaker_boost: true },
        // Context from neighbouring lines keeps the delivery consistent across clips.
        previous_text: SCENES[i - 1]?.narration,
        next_text: SCENES[i + 1]?.narration,
      }),
    });
    if (!res.ok) { console.error(`Scene ${i + 1}: ${res.status} ${await res.text()}`); process.exit(1); }
    const out = path.join(dir, `scene-${String(i + 1).padStart(2, "0")}.mp3`);
    fs.writeFileSync(out, Buffer.from(await res.arrayBuffer()));
    console.log("Wrote", path.basename(out));
  }
})();
