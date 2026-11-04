# Customer Needs Assessment

A mobile-friendly web app for running a needs-first first appointment and preparing recommendations for the follow-up.

**Open `index.html` in a browser.** There is no build step and no server. All client data stays in that browser's local storage on that device.

## Flow
1. **Intro.** A read-aloud script that discloses you're an Amway Business Owner and asks permission to take notes. You can't continue until both are confirmed.
2. **Household.** Contact details, household size, kids and pets, the client's top 2 priorities (in order), and stated preferences.
3. **Category walk-through.** Home cleaning, laundry, dishes, personal care, skin care, **wellness goals**, vitamins/supplements/drinks, water & air, and kitchen. For each one: what they use now, satisfaction (1–5), monthly spend, frustrations, and whether they're open to switching. Any category can be skipped.
   - **Wellness goals:** energy, sleep, weight, stress, fitness, and more. They pick their #1 goal, describe it in their own words, say what they've tried, and whether they're open to products. The screen includes a script for when someone brings up a medical condition.
4. **Wrap-up.** Their top 3 pain points in their own words, permission to follow up, the follow-up date, and notes.
5. **Summary.** Up to 3 **Focus** categories, a **Maybe later** list, and an explicit **Keep what works** list. Each focus category shows why it was picked, product lines to look at, a talking point, and a "Products I'll bring" field. The summary can be printed as a prep sheet.

## How recommendations are scored
For each category: `(5 − satisfaction) × 3`, plus 2 per frustration, plus 3 or 2 when a frustration matches the client's #1 or #2 priority, plus 1 for a free-text comment, plus 3 if open to switching ("maybe" adds 1). A score of 8+ means Focus, capped at 3 categories. A score of 3–7 means Maybe later. Anything lower, or "not open to switching", means Keep. You can move categories between lists by hand.

Each wellness goal they name is scored too: 5 points, +4 for their #1 goal, +1 if they've tried something before, +3 if open to products (+1 for maybe).

## Portfolio
See [`PORTFOLIO.md`](PORTFOLIO.md) for the need → brand map and the wellness-conversation rules.

## Customizing
Edit `catalog.js` to change categories, wellness goals, questions, frustration options, product lines, and talking points. **Check the product lines against your market's current catalog.**

## Data
- Back up regularly with **Backup (JSON)**. Clearing browser data erases everything.
- Use **Export follow-ups (CSV)** for a spreadsheet of clients and follow-up dates.
- Delete records for people who don't move forward.
