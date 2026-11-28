# CONTINUE? Music rework plan

Approved picture: commit `4842492` (4K master + 1080p preview). The current score is kept as `audio/score-v1.mp3`; the new one will be `score-v2.mp3`.

## What's wrong with score v1 (measured)
- Its loudness is almost flat: -17 to -20 dB RMS from 0:00 to 2:05. Childhood, ambition, success and collapse all sit at the same level.
- The CONTINUE return at 2:50 is no louder than the opening, so the payoff isn't bigger than the setup.
- The music ends at 3:55, which leaves the FINAL SCORE card (3:54–4:10) without score.
- It was composed from a prompt for an older cut, so its turns are not on the picture's turns.

## Principles
1. **One theme, transformed.** One four-bar lullaby theme. It is heard whole and resolved only twice: in 1994 and after CONTINUE. Everywhere else it is fragmented, slowed, or missing its last note. That missing note is the declined call, in music.
2. **An arc of loudness.** The quietest moment is the voicemail and the loudest is "MEMORIES". Nothing in act one should approach the ending.
3. **Silence as a cue.** The music cuts dead at GAME OVER. Dad's voicemail plays with almost nothing under it.
4. **Hit the picture.** Changes land on the cut points listed below.
5. **The 8-bit voice is a character.** The chip melody doubles the theme while he is "playing", vanishes in grief, and returns at CONTINUE.
6. **Bookends.** 1994 and 2052 use the same music box and piano arrangement.
7. **Restraint over sadness.** Major keys with suspensions, not wall-to-wall minor. Don't tell the audience to cry.

## Cue sheet (film time)
| # | Time | Picture | Music |
|---|---|---|---|
| 1 | 0–8 | Title | Music box states the theme once, alone |
| 2 | 8–34 | 1994 stand, coin 16.8, "Kiddo" 28–34 | Waltz 3/4, piano + music box + chip doubling. Small lift on the coin, held suspension under "Kiddo" |
| 3 | 34–66 | Garage, Maya born | Pulse enters, chip arpeggios, strings build, theme up a step |
| 4 | 66–77 | Tower, $40M | Fast and bright but cold: high strings, no warmth in the low end |
| 5 | 77–93 | Declined call 80.7, recital 87.6 | Pulse drops on the decline. Lone piano plays the theme without its last note |
| 6 | 93–104.5 | Collapse | Low strings swell, dissonant, then a hard cut on GAME OVER |
| 7 | 104.5–137 | Voicemail | Near silence: one low sustained note at most |
| 8 | 137–160 | Grave, rain, Maya 144 | Solo piano, theme very slow, wide gaps |
| 9 | 160–170 | Countdown | Silence (heartbeat SFX only) |
| 10 | 170–205 | CONTINUE, recital, graduation, June | Theme returns complete for the first time since 1994. Chip voice back. Grows across the montage |
| 11 | 205–220 | 2052 stand, coin 209.6, "Kiddo" 213.8 | Strip back to the 1994 arrangement (bookend) |
| 12 | 220–234 | Ending text, MEMORIES ~230 | Climax: the full theme, the loudest point of the film |
| 13 | 234–250 | Final score | Music box alone, final note on THANKS FOR PLAYING |

## How to generate it
- **A (recommended): direct ElevenLabs Music API with a `composition_plan`.** One generation, sections locked to the cut in milliseconds (3–120 s each), per-section positive and negative styles, and a shared key, tempo and theme across sections. Needs an ElevenLabs API key (saved as a network secret) and `api.elevenlabs.io` allowed.
- **B: Higgsfield `elevenlabs_music_v2_5`.** Prompt and duration only, with no sections. That means generating cues per act and crossfading them at the hard cuts (GAME OVER, CONTINUE), with a risk that the theme and key drift between cues.
- Either way, generate 3–4 variations per pass and pick by ear against picture.
- Don't name composers or films in prompts. Describe instrumentation, tempo, key and feel instead.
