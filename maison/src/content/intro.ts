/**
 * Intro texts, shown before sign-in. Rewrite freely: the screens follow this file.
 */
export const INTRO = [
  {
    kind: "type",
    eyebrow: "",
    title: "Every great maison started with a name.",
    body: "",
  },
  {
    kind: "cards",
    eyebrow: "The cards",
    title: "Trends are your currency.",
    body: "Every card is a real trend: a piece, a colour, a fabric, a detail, a mood. Its value follows what the world is searching for, live.",
  },
  {
    kind: "pack",
    eyebrow: "Every day",
    title: "One free pack. Five cards.",
    body: "Open it, flip them one by one. Come back tomorrow and your odds of a legendary go up.",
  },
  {
    kind: "market",
    eyebrow: "The market",
    title: "Hold, or take the profit.",
    body: "Put five cards on your runway. When their trend rises, your maison gets richer. Sell whenever you want, before the trend turns.",
  },
  {
    kind: "cta",
    eyebrow: "Daily duel",
    title: "Create your maison.",
    body: "Every day you face another maison. The sharper eye wins.",
  },
] as const;

export const INTRO_CTA = "Continue with Google";
