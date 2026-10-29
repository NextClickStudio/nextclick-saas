// The player's own Solana wallet. Linking it is read-only: the player signs a free message that proves
// the wallet is theirs. Real-duel trades from the yeppo terminal are signed and sent by the wallet itself.
// Wallets are found through Wallet Standard (how Phantom, Solflare, Backpack and the rest announce
// themselves today) with the older injected providers as a fallback.
import type { VersionedTransaction } from "@solana/web3.js";
import { SITE_URL, SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";
import { rpc } from "./supabase";

export type Wallet = {
  id: string;
  name: string;
  icon?: string;
  /** silent: only reconnect a wallet that already trusts yeppo, never open a popup */
  connect(silent: boolean): Promise<string | null>;
  signMessage(message: Uint8Array): Promise<Uint8Array>;
  /** Sign In With Solana: connect and sign in one popup */
  signIn?(input: SignInInput): Promise<{ address: string; signedMessage: Uint8Array; signature: Uint8Array }>;
  /** returns the transaction signature (base58) */
  signAndSend(tx: VersionedTransaction): Promise<string>;
};

type SignInInput = { domain: string; statement: string; uri: string; version: "1"; chainId: "mainnet"; nonce: string; issuedAt: string };

// ---------- errors ----------
type WalletErr = { code?: number; message?: string; error?: { code?: number; message?: string } };

/** wallet errors in words a player understands */
export function walletError(e: unknown, name = "Your wallet"): Error {
  const x = (e ?? {}) as WalletErr;
  const code = x.code ?? x.error?.code;
  const msg = String(x.message ?? x.error?.message ?? e ?? "");
  if (code === 4001 || /reject|cancel|denied|declined|closed/i.test(msg)) return new Error(`You cancelled the request in ${name}.`);
  if (code === -32002 || /already pending|already processing/i.test(msg)) return new Error(`${name} already has a request open. Check its popup.`);
  if (code === -32603 || /unexpected error|internal error/i.test(msg))
    return new Error(`${name} hit an internal error. Unlock it, pick a Solana account, then try again. Still stuck? Reload the page or restart the browser.`);
  if (code === 4100 || /unauthori[sz]ed/i.test(msg)) return new Error(`${name} has not approved yeppo yet. Connect again.`);
  return e instanceof Error ? e : new Error(msg || `${name} did not respond`);
}

const isCancel = (e: unknown) => {
  const x = (e ?? {}) as WalletErr;
  return (x.code ?? x.error?.code) === 4001 || /reject|cancel|denied|declined|closed/i.test(String(x.message ?? x.error?.message ?? ""));
};
const isInternal = (e: unknown) => {
  const x = (e ?? {}) as WalletErr;
  return (x.code ?? x.error?.code) === -32603 || /unexpected error|internal error/i.test(String(x.message ?? x.error?.message ?? ""));
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------- encoding ----------
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function b58encode(bytes: Uint8Array): string {
  const digits = [0];
  for (const byte of bytes) {
    let carry = byte;
    for (let i = 0; i < digits.length; i++) {
      carry += digits[i] << 8;
      digits[i] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let out = "";
  for (const byte of bytes) {
    if (byte !== 0) break;
    out += "1";
  }
  for (let i = digits.length - 1; i >= 0; i--) out += B58[digits[i]];
  return out;
}

export function toBase64(bytes: Uint8Array) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

// ---------- Wallet Standard ----------
type StdAccount = { address: string; publicKey: Uint8Array; chains: readonly string[]; features: readonly string[] };
type StdWallet = {
  name: string;
  icon: string;
  chains: readonly string[];
  accounts: readonly StdAccount[];
  features: Record<string, unknown>;
};
type StdFeatures = {
  "standard:connect"?: { connect(input?: { silent?: boolean }): Promise<{ accounts: readonly StdAccount[] }> };
  "solana:signMessage"?: { signMessage(...inputs: { account: StdAccount; message: Uint8Array }[]): Promise<{ signedMessage: Uint8Array; signature: Uint8Array }[]> };
  "solana:signIn"?: { signIn(...inputs: SignInInput[]): Promise<{ account: StdAccount; signedMessage: Uint8Array; signature: Uint8Array }[]> };
  "solana:signAndSendTransaction"?: {
    signAndSendTransaction(
      ...inputs: { account: StdAccount; chain: string; transaction: Uint8Array; options?: { skipPreflight?: boolean; maxRetries?: number } }[]
    ): Promise<{ signature: Uint8Array }[]>;
  };
  "solana:signTransaction"?: { signTransaction(...inputs: { account: StdAccount; chain?: string; transaction: Uint8Array }[]): Promise<{ signedTransaction: Uint8Array }[]> };
};

const std: StdWallet[] = [];
const listeners = new Set<() => void>();

function register(...ws: StdWallet[]) {
  let added = false;
  for (const w of ws) {
    if (std.includes(w)) continue;
    std.push(w);
    added = true;
  }
  if (added) listeners.forEach((f) => f());
  return () => {};
}

if (typeof window !== "undefined") {
  const api = Object.freeze({ register });
  try {
    window.addEventListener("wallet-standard:register-wallet", (e) => (e as CustomEvent<(a: typeof api) => void>).detail?.(api));
    window.dispatchEvent(new CustomEvent("wallet-standard:app-ready", { detail: api }));
  } catch {
    /* no Wallet Standard in this browser */
  }
}

/** called whenever a wallet extension announces itself */
export function onWalletsChange(f: () => void) {
  listeners.add(f);
  return () => {
    listeners.delete(f);
  };
}

const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");

function fromStandard(w: StdWallet): Wallet {
  const f = w.features as StdFeatures;
  let account: StdAccount | null = null;
  const pick = (accounts: readonly StdAccount[]) => accounts.find((a) => a.chains.some((c) => c.startsWith("solana:"))) ?? accounts[0] ?? null;
  const need = async () => {
    if (!account) account = pick(w.accounts);
    if (!account) {
      const r = await f["standard:connect"]!.connect();
      account = pick(r.accounts);
    }
    if (!account) throw new Error(`${w.name} did not share an account`);
    return account;
  };
  return {
    id: slug(w.name),
    name: w.name,
    icon: w.icon,
    async connect(silent) {
      const r = await f["standard:connect"]!.connect(silent ? { silent: true } : undefined);
      account = pick(r.accounts) ?? (silent ? null : pick(w.accounts));
      return account?.address ?? null;
    },
    async signMessage(message) {
      const a = await need();
      const [out] = await f["solana:signMessage"]!.signMessage({ account: a, message });
      return out.signature;
    },
    signIn: f["solana:signIn"]
      ? async (input) => {
          const [out] = await f["solana:signIn"]!.signIn(input);
          account = out.account;
          return { address: out.account.address, signedMessage: out.signedMessage, signature: out.signature };
        }
      : undefined,
    async signAndSend(tx) {
      const a = await need();
      const bytes = tx.serialize();
      if (f["solana:signAndSendTransaction"]) {
        const [out] = await f["solana:signAndSendTransaction"].signAndSendTransaction({
          account: a,
          chain: "solana:mainnet",
          transaction: bytes,
          options: { skipPreflight: false, maxRetries: 3 },
        });
        return b58encode(out.signature);
      }
      if (f["solana:signTransaction"]) {
        const [out] = await f["solana:signTransaction"].signTransaction({ account: a, chain: "solana:mainnet", transaction: bytes });
        return sendRaw(out.signedTransaction);
      }
      throw new Error(`${w.name} cannot send transactions`);
    },
  };
}

// ---------- injected providers (older wallets and browsers) ----------
type Signed = { signature: Uint8Array } | Uint8Array;
type Provider = {
  connect(opts?: { onlyIfTrusted?: boolean }): Promise<{ publicKey?: { toString(): string } } | void>;
  publicKey?: { toString(): string } | null;
  signMessage(message: Uint8Array, display?: string): Promise<Signed>;
  signAndSendTransaction?(tx: unknown, opts?: unknown): Promise<{ signature: string } | string>;
  signTransaction?(tx: unknown): Promise<{ serialize(): Uint8Array }>;
};
type WalletWindow = {
  phantom?: { solana?: Provider & { isPhantom?: boolean } };
  solflare?: Provider & { isSolflare?: boolean };
  backpack?: Provider;
  solana?: Provider;
};

const INJECTED: { id: string; name: string; get: () => Provider | undefined }[] = [
  { id: "phantom", name: "Phantom", get: () => (window as unknown as WalletWindow).phantom?.solana ?? (window as unknown as WalletWindow).solana },
  { id: "solflare", name: "Solflare", get: () => (window as unknown as WalletWindow).solflare },
  { id: "backpack", name: "Backpack", get: () => (window as unknown as WalletWindow).backpack },
];

function fromInjected(id: string, name: string, p: Provider): Wallet {
  const addrOf = (r: { publicKey?: { toString(): string } } | void) => (r && "publicKey" in r && r.publicKey ? r.publicKey : p.publicKey)?.toString() ?? null;
  return {
    id,
    name,
    async connect(silent) {
      try {
        return addrOf(await p.connect(silent ? { onlyIfTrusted: true } : undefined));
      } catch (e) {
        // Phantom's background worker sometimes fails the first call after waking up: one more try
        if (silent || !isInternal(e)) throw e;
        await sleep(500);
        return addrOf(await p.connect());
      }
    },
    async signMessage(message) {
      if (!p.publicKey) await p.connect();
      const signed = await p.signMessage(message, "utf8");
      return signed instanceof Uint8Array ? signed : signed.signature;
    },
    async signAndSend(tx) {
      if (!p.publicKey) await p.connect();
      if (p.signAndSendTransaction) {
        const r = await p.signAndSendTransaction(tx, { skipPreflight: false, maxRetries: 3 });
        return typeof r === "string" ? r : r.signature;
      }
      if (p.signTransaction) return sendRaw((await p.signTransaction(tx)).serialize());
      throw new Error(`${name} cannot send transactions`);
    },
  };
}

let sender: ((raw: Uint8Array) => Promise<string>) | null = null;
/** set by the trading module: broadcasts a signed transaction for wallets that only sign */
export function setSender(f: (raw: Uint8Array) => Promise<string>) {
  sender = f;
}
function sendRaw(raw: Uint8Array) {
  if (!sender) throw new Error("This wallet cannot send transactions");
  return sender(raw);
}

// ---------- the list ----------
const cache = new Map<unknown, Wallet>();
const wrap = (key: unknown, make: () => Wallet) => {
  let w = cache.get(key);
  if (!w) {
    w = make();
    cache.set(key, w);
  }
  return w;
};

/** every Solana wallet in this browser, Wallet Standard first, without duplicates */
export function installedWallets(): Wallet[] {
  if (typeof window === "undefined") return [];
  const out: Wallet[] = [];
  for (const w of std) {
    const f = w.features as StdFeatures;
    const solana = w.chains.some((c) => c.startsWith("solana:"));
    if (!solana || !f["standard:connect"] || !(f["solana:signMessage"] || f["solana:signIn"])) continue;
    const x = wrap(w, () => fromStandard(w));
    if (!out.some((o) => o.id === x.id)) out.push(x);
  }
  for (const i of INJECTED) {
    const p = i.get();
    if (!p || out.some((o) => o.id === i.id)) continue;
    out.push(wrap(p, () => fromInjected(i.id, i.name, p)));
  }
  return out;
}

let active: Wallet | null = null;
/** the wallet a player connected last, else the one asked for, else the first one installed */
export function walletById(id: string | null | undefined): Wallet | null {
  const all = installedWallets();
  return all.find((w) => w.id === id) ?? (active && all.includes(active) ? active : null) ?? all[0] ?? null;
}

/** connect a wallet; silent only reconnects one that already trusts yeppo and never throws */
export async function connectWallet(w: Wallet | null, ask: boolean): Promise<string | null> {
  const wallet = w ?? walletById(null);
  if (!wallet) return null;
  try {
    const a = await wallet.connect(!ask);
    if (a) active = wallet;
    return a;
  } catch (e) {
    if (!ask) return null;
    throw walletError(e, wallet.name);
  }
}

/** on phones without an extension: open yeppo inside Phantom's browser */
export function phantomBrowseLink(path = "/real") {
  const url = encodeURIComponent(`${SITE_URL}${path}`);
  return `https://phantom.app/ul/browse/${url}?ref=${encodeURIComponent(SITE_URL)}`;
}

// ---------- verification ----------
async function submit(body: Record<string, string>) {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/yr-real`, {
    method: "POST",
    headers: { "content-type": "application/json", apikey: SUPABASE_ANON_KEY, authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    body: JSON.stringify({ action: "verify", ...body }),
  });
  const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
  if (!r.ok || !j.ok) throw new Error(j.error || "Could not verify the wallet");
}

/** prove the wallet is the player's: Sign In With Solana when the wallet has it, else connect and sign */
export async function verifyWallet(secret: string, w: Wallet): Promise<string> {
  const { message } = await rpc<{ message: string }>("yr_wallet_nonce", { p_secret: secret });
  const nonce = /Nonce: ([A-Za-z0-9]+)/.exec(message)?.[1];
  if (w.signIn && nonce) {
    let out: Awaited<ReturnType<NonNullable<Wallet["signIn"]>>> | null = null;
    try {
      out = await w.signIn({
        domain: window.location.host,
        statement: "Verify this wallet for yeppo 1v1. This free signature only proves you own it. It cannot move funds.",
        uri: window.location.origin,
        version: "1",
        chainId: "mainnet",
        nonce,
        issuedAt: new Date().toISOString(),
      });
    } catch (e) {
      if (isCancel(e)) throw walletError(e, w.name);
      // the wallet's sign-in failed: fall back to the classic connect + sign message below
    }
    if (out) {
      await submit({ secret, address: out.address, signature: toBase64(out.signature), message: toBase64(out.signedMessage) });
      active = w;
      return out.address;
    }
  }
  let address: string | null;
  let sig: Uint8Array;
  try {
    address = await w.connect(false);
    if (!address) throw new Error(`${w.name} did not share an address`);
    sig = await w.signMessage(new TextEncoder().encode(message));
  } catch (e) {
    throw walletError(e, w.name);
  }
  await submit({ secret, address, signature: toBase64(sig) });
  active = w;
  return address;
}

export const short = (a: string | null | undefined) => (a ? `${a.slice(0, 4)}…${a.slice(-4)}` : "");
export const solscanTx = (sig: string) => `https://solscan.io/tx/${sig}`;
export const solscanAccount = (a: string) => `https://solscan.io/account/${a}`;
