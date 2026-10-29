// Read-only wallet link: the player signs a message to prove the wallet is theirs.
// Nothing is ever sent on-chain and yeppo never asks for a transaction.
import { SITE_URL, SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";
import { rpc } from "./supabase";

type Signed = { signature: Uint8Array } | Uint8Array;
type Provider = {
  connect(): Promise<{ publicKey?: { toString(): string } } | void>;
  publicKey?: { toString(): string } | null;
  signMessage(message: Uint8Array, display?: string): Promise<Signed>;
};

type WalletWindow = {
  phantom?: { solana?: Provider & { isPhantom?: boolean } };
  solflare?: Provider & { isSolflare?: boolean };
  backpack?: Provider;
  solana?: Provider;
};

export type WalletOption = { id: string; name: string; get: () => Provider | undefined };

export const WALLETS: WalletOption[] = [
  { id: "phantom", name: "Phantom", get: () => (window as unknown as WalletWindow).phantom?.solana ?? (window as unknown as WalletWindow).solana },
  { id: "solflare", name: "Solflare", get: () => (window as unknown as WalletWindow).solflare },
  { id: "backpack", name: "Backpack", get: () => (window as unknown as WalletWindow).backpack },
];

export function installedWallets() {
  if (typeof window === "undefined") return [];
  return WALLETS.filter((w) => !!w.get());
}

/** on phones without an extension: open yeppo inside Phantom's browser */
export function phantomBrowseLink(path = "/real") {
  const url = encodeURIComponent(`${SITE_URL}${path}`);
  return `https://phantom.app/ul/browse/${url}?ref=${encodeURIComponent(SITE_URL)}`;
}

function toBase64(bytes: Uint8Array) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

/** connect, sign the nonce message, and let the server check the signature */
export async function verifyWallet(secret: string, option: WalletOption): Promise<string> {
  const p = option.get();
  if (!p) throw new Error(`${option.name} is not installed`);
  const res = await p.connect();
  const address = (res && "publicKey" in res && res.publicKey ? res.publicKey : p.publicKey)?.toString();
  if (!address) throw new Error("The wallet did not share an address");
  const { message } = await rpc<{ message: string }>("yr_wallet_nonce", { p_secret: secret });
  const signed = await p.signMessage(new TextEncoder().encode(message), "utf8");
  const sig = signed instanceof Uint8Array ? signed : signed.signature;
  const r = await fetch(`${SUPABASE_URL}/functions/v1/yr-real`, {
    method: "POST",
    headers: { "content-type": "application/json", apikey: SUPABASE_ANON_KEY, authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    body: JSON.stringify({ action: "verify", secret, address, signature: toBase64(sig) }),
  });
  const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
  if (!r.ok || !j.ok) throw new Error(j.error || "Could not verify the wallet");
  return address;
}

export const short = (a: string | null | undefined) => (a ? `${a.slice(0, 4)}…${a.slice(-4)}` : "");
export const solscanTx = (sig: string) => `https://solscan.io/tx/${sig}`;
export const solscanAccount = (a: string) => `https://solscan.io/account/${a}`;
