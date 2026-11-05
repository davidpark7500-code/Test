# Customer Need Assessment

A mobile-friendly web app for running a needs-first first appointment and preparing recommendations for the follow-up.

**Open `index.html` in a browser.** There is no build step and no server. All client data stays in that browser's local storage on that device.

## How it works (training video)
`video/how-it-works.mp4` is an 84-second vertical video, shown on the app's home screen. It covers the mindset and the four-step process: tell your story, explain today's goal, ask questions and listen, and schedule the follow-up.
- Edit the wording in `video/scenes.js`, then re-render with `node video/render.js video/how-it-works.mp4` (needs Playwright and ffmpeg).
- **Voiceover (ElevenLabs):** `ELEVENLABS_API_KEY=... ELEVENLABS_VOICE_ID=... node video/make-voice.js` writes one clip per scene to `video/audio/`. Running `render.js` again then times each scene to its clip and mixes in the voice. Without clips, the video is silent with captions.

## Flow
1. **Intro.** A short read-aloud opener that asks if it's OK to take notes. You can't continue until that's ticked.
2. **Household.** Contact details, household size, kids and pets, the client's top 2 priorities (in order), and stated preferences.
3. **Category walk-through.** Home cleaning, laundry, dishes, personal care, skin care, **health & lifestyle**, **wellness goals**, **Avellum Health**, vitamins/supplements/drinks, water & air, and kitchen. For each one: what they use now, satisfaction (1–5), monthly spend, frustrations, and whether they're open to switching. Any category can be skipped.
   - **Health & lifestyle:** energy and stress (1–10), sleep quality and hours, eating pattern, water, caffeine, exercise, digestion, plus a yes/no safety check (prescription meds, pregnancy/nursing, ongoing condition). A "yes" puts a doctor-check banner on the summary.
   - **Wellness goals:** energy, sleep, weight, stress, fitness, and more. They pick their #1 goal, describe it in their own words, say what they've tried, and whether they're open to products. The screen includes a script for when someone brings up a medical condition.
4. **Wrap-up.** Their top 3 pain points in their own words, permission to follow up, the follow-up date, and notes.
5. **Summary.** Up to 3 **Focus** categories, a **Maybe later** list, and an explicit **Keep what works** list. Each focus category shows why it was picked, product lines to look at, a talking point, and a "Products I'll bring" field. The summary can be printed as a prep sheet.

## How recommendations are scored
For each category: `(5 − satisfaction) × 3`, plus 2 per frustration, plus 3 or 2 when a frustration matches the client's #1 or #2 priority, plus 1 for a free-text comment, plus 3 if open to switching ("maybe" adds 1). A score of 8+ means Focus, capped at 3 categories. A score of 3–7 means Maybe later. Anything lower, or "not open to switching", means Keep. You can move categories between lists by hand.

Each wellness goal they name is scored too: 5 points, +4 for their #1 goal, +1 or +2 for each matching lifestyle answer (e.g. energy ≤ 4/10 boosts "More energy", poor sleep boosts "Better sleep", stress ≥ 7/10 boosts "Less stress"), +1 if they've tried something before, +3 if open to products (+1 for maybe).

## Portfolio
See [`PORTFOLIO.md`](PORTFOLIO.md) for the need → brand map and the wellness-conversation rules.

## Avellum Health section
Comes right after Wellness goals. It opens with a read-aloud intro to Amway's partner Avellum Health (clinician-led telehealth: blood panel → clinician decides on any peptide therapy), then asks about recent bloodwork and interest in a blood panel, a telehealth visit, and peptides. If they're interested, the summary shows an **Avellum Health referral** card with the reasons, the Amway Avellum link, and the referral-only guardrails. Configure it under `partner` in `catalog.js`.

## Customizing
Edit `catalog.js` to change categories, wellness goals, questions, frustration options, product lines, and talking points. **Check the product lines against your market's current catalog.**

## Data
- The app keeps everything in this browser on this device.
- **Save to phone:** on each summary (and on **Mark complete & save**), this opens the phone's share sheet. Choose *Save to Files*, Google Drive, or Dropbox (Dropbox shows up when its app is installed). On a computer it downloads instead. The saved `.html` file is a readable copy of the notes, and it also carries the data, so it survives clearing browser data.
- **Load saved files:** pick one or more saved files (or old `.json` backups) to bring assessments back.
- The home screen flags any assessment that isn't saved to the phone, or that has changed since it was last saved.
- **Save all to phone** saves every assessment in one file. **Export follow-ups (CSV)** makes a spreadsheet of clients and follow-up dates.
- Saved files contain clients' health answers. Keep them in a private folder, and delete records for people who don't move forward.
