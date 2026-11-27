# David Park — 60-Second Promo

An animated, high-energy promo video about David Park, built entirely in JavaScript (Canvas 2D + Web Audio), with the story drawn from his Claude build history.

- **`david-park-promo.html`**: open it in any browser and press **Play** (or Space). Includes a synthesized 120 BPM soundtrack, seek bar, and a **Record .webm** button.
- **`david-park-promo.mp4`**: pre-rendered 1080p/30fps video with audio, ready to share.
- **`tools/export-video.js`**: re-renders the MP4 frame-by-frame with Playwright + ffmpeg:
  `node tools/export-video.js /path/to/ffmpeg david-park-promo.mp4`

## Storyboard (60s)
| Time | Scene |
|---|---|
| 0–6s | **DAVID PARK**: Builder · Dreamer · Shipper |
| 6–12s | It started with one prompt: 25+ Claude sessions, 8+ apps, 5 repos, 67 days |
| 12–18s | **Pulse**: health tracking, Hearth, healthcare docs |
| 18–24s | **Raymore Connect**: community app |
| 24–30s | **Money Moves**: investing roadmap → financial app |
| 30–37s | **Omni Mission Control**: AI workforce, 60-sec lead response |
| 37–43s | **Totally Radimals!**: retro pixel fun |
| 43–49s | And he didn't stop: Sponsor Onboarding, Attest, Back Forty, Claude in Chrome… |
| 49–54s | DREAM IT. PROMPT IT. BUILD IT. SHIP IT. REPEAT. |
| 54–60s | Finale: *Build the future. One prompt at a time.* #KeepShipping |

---

# CONTINUE? : an 8-bit life (4-minute film)

A voxel 3D, 8-bit short film about the beginning, middle and end of an entrepreneur's life, built entirely in code: three.js rendered at 320×180 with an ordered-dither palette shader, a hand-drawn 5×7 bitmap font, and a synthesized chiptune score (Web Audio).

The structure follows two charts: *A Day in the Life of an Entrepreneur* (the overworld map is literally that jagged line) and *The Emotional Cycle of Change* (uninformed optimism → valley of despair → informed optimism).

- **`continue/index.html`**: open in a browser and press **Play** (or Space). Has a seek bar and a **Record .webm** button.
- **`continue/continue.mp4`**: pre-rendered 1080p/30fps with audio.
- **`tools/export-continue.js`**: re-renders the MP4: `node tools/export-continue.js /usr/bin/ffmpeg continue/continue.mp4`

| Stage | Beat |
|---|---|
| 1994 | Kid's lemonade stand. Dad is the first customer: *"I'll make you proud." / "Kiddo... you already do."* |
| 2014–2016 | Quits job, garage, 47 rejections, *Player 2 has joined* (Maya), *"It's working!"* |
| 2019 | $40M tower. Declines Dad's call. Misses Maya's first recital: the empty RESERVED seat. |
| 2020 | Collapse → GAME OVER → Dad's last voicemail → *"I never called back."* |
| 2020 | Grave in the rain. Maya under a yellow umbrella. The quarter. **INSERT COIN TO CONTINUE.** |
| 2023–2052 | Second chance: front row at the recital, home by 6, *Player 3*. Old man buys lemonade from his granddaughter and says Dad's line. |
| End | The whole life as one chart. Final score: *Calls returned: every one.* |

## CONTINUE? v2 (current): every shot is AI video

- **`continue/v2/continue-v2.mp4`**: the film. 1080p, 4:00, 34 AI video clips in a chunky pixel-art style, an ElevenLabs score, and Dad's voicemail voiced with ElevenLabs.
- Pipeline: character sheets (`continue/art/characters/`) → start images (`continue/v2/plates/`) → image-to-video clips (`continue/v2/clips/`) → `continue/v2/film.html` (edit list, game-text layer, audio mix) → `node tools/assemble-v2.js out.mp4`.
- Higgsfield job ids for every image and clip are in `continue/v2/jobs.json`.
