# Amway Membership Training: "A Story Worth More Than $20"

A 3:24 animated explainer, 1920×1080 at 30 fps, with music and soft sound effects.
It's drawn on an HTML canvas and rendered frame by frame to MP4.

- `build/amway-membership.html` is a self-contained player. Click or press Space to play with sound; the arrow keys step through it.
- `build/amway-membership.mp4` is the finished video.

## Editing
- **All wording, numbers and scene lengths:** `src/content.js`. This is the only file you need to edit.
- **Logo:** put the official files at `assets/logo-blue.png` and `assets/logo-white.png` (or `.svg`), then rebuild. Until then, dashed "LOGO" placeholder boxes show (top-left on the cover, small bottom-right everywhere else).
- **Voiceover (optional):** script in `voiceover/script.md`.

## Rebuild
```
node build.mjs                      # HTML
node render.mjs                     # MP4 (needs Playwright + ffmpeg)
node render.mjs --stills 10,60,120  # quick preview frames -> build/stills/sheet.jpg
```

## Before the final cut
- `[CONFIRM TERMS]` on "Buy 4, get 1 free" (bundle scene) and `Dates: [CONFIRM]` on the Ada trip show with an amber highlight on screen so they can't ship by accident. Edit them in `src/content.js`.
- Scenes 11 rows 3–4 ("Room for her goals", "Money that stays close") and scene 15 (close) are drafts. The brief was cut off at scene 11.
