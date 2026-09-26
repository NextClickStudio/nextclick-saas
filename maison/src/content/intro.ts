/**
 * Intro texts, shown before sign-in. Rewrite freely: the screens follow this file.
 */
export const INTRO = [
  {
    kind: "type",
    eyebrow: "",
    title: "Fashion is a market.",
    body: "",
  },
  {
    kind: "cards",
    eyebrow: "The cards",
    title: "Every trend has a price.",
    body: "Butter yellow, ballet flats, quiet luxury: hundreds of real trends. Their prices follow what the world searches on Google, live.",
  },
  {
    kind: "market",
    eyebrow: "Trade",
    title: "Buy early. Sell at the peak.",
    body: "A free pack of five cards every day. Buy the trends you believe in, sell them before they fade.",
  },
  {
    kind: "call",
    eyebrow: "Every day",
    title: "Call it.",
    body: "Five trends a day: will they rise or fall? Every right call pays 500 credits.",
  },
  {
    kind: "cta",
    eyebrow: "Weekly seasons",
    title: "Build the richest maison.",
    body: "Everyone starts with 10,000 credits. The richest maison on Sunday night wins the season. Then it starts again.",
  },
] as const;

export const INTRO_CTA = "Continue with Google";
