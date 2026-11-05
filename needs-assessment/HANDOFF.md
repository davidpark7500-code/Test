# Handoff: Customer Needs Assessment

Context for a Claude Code session picking up this project. Read this first, then `README.md` and `PORTFOLIO.md`.

## What this is
A mobile web app David uses at a first appointment with a potential customer for his Amway business. It's needs-first: learn what the customer uses and what's not working, recommend nothing that day, and schedule a follow-up with a short list of recommendations based on their answers.

- Branch: `claude/customer-needs-assessment` in `davidpark7500-code/Test`. The repo's default branch is an unrelated promo-video branch, and nothing has been merged yet.
- Static site with no build step. Open `needs-assessment/index.html`. Data lives in the browser's localStorage.

## Files
| Path | What it does |
|---|---|
| `index.html`, `styles.css`, `app.js` | The app: hash router, views, scoring, save/restore, CSV |
| `catalog.js` | **Editable config:** categories, questions, frustrations, product lines, wellness goals, Avellum partner settings |
| `PORTFOLIO.md` | Need → Amway brand map with confidence tags, plus wellness-conversation rules |
| `video/scenes.js` | Training-video script and on-screen text (one entry per scene) |
| `video/how-it-works.html` | Canvas animation of the video (open it to preview) |
| `video/render.js` | Renders the MP4 (Playwright + ffmpeg). Uses `video/audio/scene-NN.mp3` if present |
| `video/make-voice.js` | Generates the ElevenLabs voiceover, one MP3 per scene |
| `screenshots/` | Reference screenshots |

## Flow (14 steps)
Intro (tell your story → explain today's goal → notes consent) → Household → Home cleaning → Laundry → Dishes → Personal care → Skin care → Health & lifestyle → Wellness goals → Avellum Health → Vitamins/supplements/drinks → Water & air → Kitchen → Wrap-up → client thank-you screen → IBO summary.

## Decisions David made (don't undo without asking)
- **Name:** "Customer Needs Assessment" (plural "Needs").
- **Intro:** no IBO name and no spoken "I'm an Amway Business Owner" line, because clients already know. The only gate is "They're OK with me taking notes". Don't mention how or where data is stored to the client.
- **Health questions are wanted:** energy, sleep, stress, diet, and so on. Guardrails stay in place: no diagnosing, no claims that a product treats a condition, and a yes/no safety flag (meds, pregnancy, or condition) with no details recorded.
- **Avellum Health** (Amway's partner store; telehealth, clinician-reviewed **compounded peptide therapy, not FDA-approved**) is its **own questionnaire section**, not a per-product option. It's framed as a referral to a blood panel or clinician consult, never a specific peptide. The question names Ozempic and GLP-1s only to open the conversation. David removed the "not FDA-approved" line from the app's on-screen note because that gets covered later. Link: https://www.amway.com/en_US/avellum-health
- **Design:** based on a reference David liked: white, mint `#bde3da`, Montserrat, solid black rectangular buttons, underline-only fields, mint diagonal shapes. No emoji, cards, or pills (they read as "AI-made").
- **Save to phone:** each assessment saves as a readable `.html` file with the data embedded (share sheet → Files, Drive, or Dropbox). "Load saved files" restores them.
- **Training video:** covers the mindset and 4-step process. David had the income-promises line removed from the story step, in the app and the video.

## To do (in priority order)
1. **ElevenLabs voiceover.** David wants AI narration.
   - In Chrome, help him create an API key (Text to Speech permission) at elevenlabs.io and pick or clone a voice. Get the Voice ID.
   - Run `ELEVENLABS_API_KEY=... ELEVENLABS_VOICE_ID=... node needs-assessment/video/make-voice.js`, then `node needs-assessment/video/render.js needs-assessment/video/how-it-works.mp4`. Listen to it, then re-make `video/poster.jpg` (frame at ~4s).
   - Never commit the key. `video/audio/` is gitignored, so commit only the final MP4.
2. **Host it on GitHub Pages** so David has a real link. In GitHub (Chrome): repo Settings → Pages → Deploy from branch → `claude/customer-needs-assessment`, `/ (root)`. The URL should be `https://davidpark7500-code.github.io/Test/needs-assessment/`. Then test "Add to Home Screen" and "Save to phone" on his phone.
3. **Avellum details.** Read avellumhealth.com and the Amway Avellum page for the protocol list, prices, states served, and eligibility. Update `catalog.js` (`partner`) and `PORTFOLIO.md`.
4. **Verify Amway product lines** against David's current US catalog (his Amway account, Spring 2026 Wellness Catalog). Flagged [Verify]: Satinique, G&H, and iCook US availability. Replace generic lines in `catalog.js` with exact product names and the catalog's support wording.
5. **Optional:** open a PR to merge the branch, add a direct Dropbox upload (needs a Dropbox developer app), and tune the scoring weights after 5–10 real appointments.

## Testing
No test suite. Drive the app with Playwright (headless Chromium): walk the steps, check the summary buckets, and check that save → clear localStorage → load restores the same data. Take screenshots at 390×844.

## Preview
A private claude.ai preview with a sample client exists (owned by David): https://claude.ai/artifact/76fN53cV7sNnA7tFrCKKAZ. Once GitHub Pages is live, the Pages link replaces it.
