// "How it works" training video: scenes, on-screen text, and the voiceover script.
// Edit the narration here; make-voice.js turns each scene's narration into audio,
// and render.js times each scene to its audio clip.
const SCENES = [
  {
    kind: "title",
    kicker: "How it works",
    headline: "Customer Needs Assessment.",
    sub: "The mindset and the process for your first appointment.",
    narration: "Welcome to the Customer Needs Assessment. Here's the mindset, and the four-step process for your first appointment.",
  },
  {
    kind: "statement",
    kicker: "The mindset",
    headline: "It's not a pitch. It's about them.",
    lines: ["Their life.", "Their needs.", "Their goals."],
    narration: "First, the mindset. This isn't a sales pitch. The focus is on them: their life, their needs, and their goals.",
  },
  {
    kind: "step", step: 1,
    headline: "Tell your story.",
    sub: "Share your why. For example:",
    lines: ["Getting out of debt", "Saving up for a house", "Helping Mom retire"],
    narration: "Step one: tell your story. Share your why. Maybe it's getting out of debt, saving up for a house, or helping your mom retire.",
  },
  {
    kind: "step", step: 2,
    headline: "Explain today's goal.",
    quote: "Today I just want to learn what you use day to day, and what could be better.",
    tag: "No recommendations today",
    narration: "Step two: explain today's goal. You're there to find the needs they have in their day-to-day life. You won't be recommending anything today.",
  },
  {
    kind: "step", step: 3,
    headline: "Ask questions. Listen.",
    lines: ["What they use at home", "What bugs them", "Their health and energy", "What they want next"],
    narration: "Step three: ask questions, and really listen. What they use at home, what bugs them, and what they want for their health and their future.",
  },
  {
    kind: "step", step: 4,
    headline: "Schedule the follow-up.",
    card: { top: "Follow-up", big: "Thu · 6:30 PM", small: "A short list built around their answers" },
    narration: "Step four: schedule a follow-up. That's when you bring a short list of recommendations, built around their answers.",
  },
  {
    kind: "winwin",
    kicker: "The goal",
    headline: "A real win-win.",
    left: { title: "Them", text: "Their life genuinely gets better." },
    right: { title: "You", text: "You move closer to your goals." },
    narration: "The goal is a real win-win. You genuinely help make their life better, and they help you reach your goals too.",
  },
  {
    kind: "network",
    kicker: "The long game",
    headline: "Built for the long term.",
    sub: "Do such an amazing job that they introduce you to friends you can help too.",
    narration: "You're filling needs for a long-term relationship. Do such an amazing job that they introduce you to friends you can help too.",
  },
  {
    kind: "close",
    lines: ["Listen first.", "Help second.", "Build for the long term."],
    footer: "Customer Needs Assessment",
    narration: "Listen first. Help second. Build for the long term.",
  },
];

// Without a voiceover, each scene lasts about as long as it takes to read the narration aloud.
function estimateDuration(s) {
  const words = s.narration.split(/\s+/).length;
  return Math.max(4, words / 2.6 + 1.4);
}

if (typeof module !== "undefined") module.exports = { SCENES, estimateDuration };
else { window.SCENES = SCENES; window.estimateDuration = estimateDuration; }
