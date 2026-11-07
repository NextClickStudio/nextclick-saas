// the checks yeppo reads on every coin, with the values of the example coin the home takes apart
export type S = "ok" | "warn";
export const CHECKS: [string, string, string, S][] = [
  ["Launch bundle", "3.1% · 4 wallets", "chain", "ok"],
  ["Insiders", "11.2% · real balances", "chain", "ok"],
  ["Snipers", "2.4%", "chain", "ok"],
  ["Silent early group", "none", "chain", "ok"],
  ["Big wallets", "2 · 4.0%", "chain", "ok"],
  ["Linked wallets", "1 group · 4.9%", "chain", "ok"],
  ["Same-amount buys", "none", "chain", "ok"],
  ["Fresh wallets", "3 of top 20", "chain", "ok"],
  ["Top 10 holders", "18.6%", "RugCheck", "ok"],
  ["Creator's past coins", "2nd coin · no rugs", "chain", "ok"],
  ["Serial launcher", "no", "chain", "ok"],
  ["Creator's funder", "an exchange", "chain", "ok"],
  ["Rug network", "none behind the funder", "chain", "ok"],
  ["Mint authority", "revoked", "RugCheck", "ok"],
  ["Freeze authority", "revoked", "RugCheck", "ok"],
  ["Liquidity", "burned", "RugCheck", "ok"],
  ["Hidden bundle", "none", "chain", "ok"],
  ["Ticker copies", "3 · none ran", "chain", "warn"],
  ["X origin", "account 3 years old", "X", "ok"],
  ["Recycled X account", "no", "X", "ok"],
  ["Buyers vs sellers", "61 / 39 · 5 min", "chain", "ok"],
  ["Odds of a 2x", "14%", "record", "ok"],
  ["Top traders in", "2", "chain", "ok"],
  ["Holders selling", "4 of top 20", "chain", "warn"],
];

