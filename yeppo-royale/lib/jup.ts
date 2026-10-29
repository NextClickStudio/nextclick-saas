// Real trades from the yeppo terminal. Jupiter's free swap API builds the transaction (it routes
// pump.fun bonding-curve coins straight through the pump.fun program), the player's own wallet signs
// and sends it. yeppo never holds keys or funds and adds no fee.
import { RPC_URL, SOL_MINT, solRpc } from "./pump";
import { WALLETS, type WalletOption } from "./wallet";

const JUP = ["https://lite-api.jup.ag/swap/v1", "https://api.jup.ag/swap/v1"];

export type Priority = "fast" | "turbo" | "ultra";
export const PRIORITY: Record<Priority, { label: string; level: string; max: number }> = {
  fast: { label: "Fast", level: "medium", max: 300_000 },
  turbo: { label: "Turbo", level: "high", max: 1_000_000 },
  ultra: { label: "Ultra", level: "veryHigh", max: 3_000_000 },
};

type Quote = { inAmount: string; outAmount: string; priceImpactPct: string; routePlan: { swapInfo: { label?: string } }[] };

async function jup<T>(path: string, init?: RequestInit): Promise<T> {
  let last: unknown = null;
  for (const base of JUP) {
    try {
      const r = await fetch(`${base}${path}`, init);
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j.error || j.message || `Jupiter ${r.status}`);
      return j as T;
    } catch (e) {
      last = e;
    }
  }
  throw last instanceof Error ? last : new Error("Jupiter is not reachable");
}

export async function quote(side: "buy" | "sell", mint: string, amountRaw: bigint, slipPct: number) {
  const input = side === "buy" ? SOL_MINT : mint;
  const output = side === "buy" ? mint : SOL_MINT;
  const bps = Math.round(Math.min(50, Math.max(0.5, slipPct)) * 100);
  return jup<Quote>(`/quote?inputMint=${input}&outputMint=${output}&amount=${amountRaw.toString()}&slippageBps=${bps}&restrictIntermediateTokens=true`);
}

type SolanaProvider = {
  publicKey?: { toString(): string } | null;
  isConnected?: boolean;
  connect(opts?: { onlyIfTrusted?: boolean }): Promise<{ publicKey?: { toString(): string } } | void>;
  signAndSendTransaction?(tx: unknown, opts?: unknown): Promise<{ signature: string } | string>;
  signTransaction?(tx: unknown): Promise<{ serialize(): Uint8Array }>;
};

export function provider(id: string | null | undefined): SolanaProvider | null {
  const w = WALLETS.find((x) => x.id === id) ?? WALLETS.find((x) => !!x.get());
  return (w?.get() as unknown as SolanaProvider) ?? null;
}

/** silently reconnect a wallet that already trusts yeppo, else ask */
export async function connectWallet(option: WalletOption | null, ask: boolean): Promise<string | null> {
  const p = (option?.get() as unknown as SolanaProvider | undefined) ?? provider(null);
  if (!p) return null;
  try {
    const r = await p.connect(ask ? undefined : { onlyIfTrusted: true });
    return (r && "publicKey" in r && r.publicKey ? r.publicKey : p.publicKey)?.toString() ?? null;
  } catch {
    return null;
  }
}

function fromBase64(s: string) {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function toBase64(b: Uint8Array) {
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s);
}

export type SwapResult = { signature: string; inAmount: number; outAmount: number; route: string };

/** quote → transaction → the wallet signs and sends it; resolves once the chain confirms */
export async function swap(opts: {
  side: "buy" | "sell";
  mint: string;
  amountRaw: bigint;
  slipPct: number;
  priority: Priority;
  owner: string;
  walletId: string | null;
  onStage?: (s: "quote" | "sign" | "send" | "confirm") => void;
}): Promise<SwapResult> {
  const p = provider(opts.walletId);
  if (!p) throw new Error("No wallet found. Install Phantom, Solflare or Backpack.");
  opts.onStage?.("quote");
  const q = await quote(opts.side, opts.mint, opts.amountRaw, opts.slipPct);
  const pr = PRIORITY[opts.priority];
  const { swapTransaction } = await jup<{ swapTransaction: string }>("/swap", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      quoteResponse: q,
      userPublicKey: opts.owner,
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      dynamicSlippage: false,
      prioritizationFeeLamports: { priorityLevelWithMaxLamports: { maxLamports: pr.max, priorityLevel: pr.level } },
    }),
  });
  const { VersionedTransaction } = await import("@solana/web3.js");
  const tx = VersionedTransaction.deserialize(fromBase64(swapTransaction));
  opts.onStage?.("sign");
  let signature: string;
  if (p.signAndSendTransaction) {
    const r = await p.signAndSendTransaction(tx, { skipPreflight: false, maxRetries: 3 });
    signature = typeof r === "string" ? r : r.signature;
  } else if (p.signTransaction) {
    const signed = await p.signTransaction(tx);
    opts.onStage?.("send");
    signature = await solRpc<string>("sendTransaction", [toBase64(signed.serialize()), { encoding: "base64", skipPreflight: false, maxRetries: 3 }]);
  } else throw new Error("This wallet cannot send transactions");
  opts.onStage?.("confirm");
  await confirm(signature);
  return {
    signature,
    inAmount: Number(q.inAmount),
    outAmount: Number(q.outAmount),
    route: q.routePlan.map((r) => r.swapInfo.label).filter(Boolean).join(" → ") || "Jupiter",
  };
}

export async function confirm(sig: string, timeoutMs = 75_000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try {
      const r = await solRpc<{ value: ({ err: unknown; confirmationStatus?: string } | null)[] }>("getSignatureStatuses", [[sig], { searchTransactionHistory: false }]);
      const s = r.value[0];
      if (s?.err) throw new Error("The transaction failed on-chain (slippage or price moved). Nothing was spent but the network fee.");
      if (s && (s.confirmationStatus === "confirmed" || s.confirmationStatus === "finalized")) return;
    } catch (e) {
      if (e instanceof Error && e.message.startsWith("The transaction failed")) throw e;
    }
    await new Promise((r) => setTimeout(r, 1200));
  }
  throw new Error("Not confirmed yet. Check the transaction on Solscan.");
}

export async function solBalance(owner: string) {
  const r = await solRpc<{ value: number }>("getBalance", [owner, { commitment: "confirmed" }]);
  return r.value / 1e9;
}

/** token balance (ui units) and raw amount, over both token programs */
export async function tokenBalance(owner: string, mint: string) {
  const r = await solRpc<{ value: { account: { data: { parsed: { info: { tokenAmount: { amount: string; uiAmount: number | null; decimals: number } } } } } }[] }>(
    "getTokenAccountsByOwner",
    [owner, { mint }, { encoding: "jsonParsed", commitment: "confirmed" }],
  );
  let raw = 0n;
  let ui = 0;
  let decimals = 6;
  for (const a of r.value) {
    const t = a.account.data.parsed.info.tokenAmount;
    raw += BigInt(t.amount);
    ui += t.uiAmount ?? 0;
    decimals = t.decimals;
  }
  return { raw, ui, decimals };
}

export { RPC_URL };
