"use client";

// The viewer's own J7Tracker feed, straight from J7's server into this browser (Socket.IO, docs.j7tracker.io/docs/feed):
// the posts of the accounts the viewer tracks there, with the coin addresses J7 finds in them. The token is the
// viewer's J7 session token; it stays in this browser and never reaches yeppo's servers. Posts are kept 30 minutes.
import { useEffect, useState } from "react";
import type { Signal } from "./radar";
import { readLocal, writeLocal } from "./supabase";

const HOST = "https://nyc.j7tracker.io";
const KEEP_MS = 30 * 60_000;
const ADDR = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export type J7Status = "off" | "connecting" | "live" | "denied" | "down";

type Author = { handle?: string; name?: string; followersCount?: number; verified?: boolean };
type Post = {
  id?: string; createdAt?: string | number; author?: Author; text?: string; tweetUrl?: string;
  contractAddress?: string; extraContractAddresses?: string[];
  isRetweet?: boolean; source?: string; isWebhook?: boolean;
};
type TokenMeta = { id?: string; mint?: string; tokenMeta?: { mint?: string } };

export const j7Token = () => readLocal<string | null>("yo:j7", null);
export const setJ7Token = (t: string | null) => writeLocal("yo:j7", t);

/** the feed while a token is set: status and the posts of the last 30 minutes, newest first */
export function useJ7(token: string | null): { status: J7Status; signals: Signal[] } {
  const [status, setStatus] = useState<J7Status>("off");
  const [signals, setSignals] = useState<Signal[]>([]);
  useEffect(() => {
    setSignals([]);
    if (!token) return setStatus("off");
    setStatus("connecting");
    const posts = new Map<string, Signal>();
    const early = new Map<string, string[]>(); // coin addresses that came before their post
    let alive = true;
    let sock: { disconnect: () => void } | null = null;
    const push = () => {
      if (!alive) return;
      const cut = Date.now() - KEEP_MS;
      for (const [id, s] of posts) if (s.at < cut) posts.delete(id);
      setSignals([...posts.values()].sort((a, b) => b.at - a.at));
    };
    const take = (p: Post) => {
      if (!p?.id || typeof p.text !== "string" || p.isRetweet) return;
      const at = typeof p.createdAt === "number" ? p.createdAt : Date.parse(String(p.createdAt ?? "")) || Date.now();
      const cas = [p.contractAddress, ...(p.extraContractAddresses ?? []), ...(early.get(p.id) ?? [])].filter((a): a is string => typeof a === "string" && ADDR.test(a));
      early.delete(p.id);
      posts.set(p.id, {
        id: p.id, at, text: p.text.slice(0, 500), url: p.tweetUrl ?? null, cas: [...new Set(cas)],
        author: (p.author?.handle ?? "?").slice(0, 30), name: p.author?.name?.slice(0, 50) ?? null,
        followers: Number(p.author?.followersCount) || 0, verified: !!p.author?.verified,
      });
    };
    void import("socket.io-client").then(({ io }) => {
      if (!alive) return;
      const s = io(HOST, { transports: ["websocket"], auth: { token }, reconnectionDelayMax: 15_000 });
      sock = s;
      s.on("connect", () => s.emit("user_connected", token));
      s.on("connect_error", () => alive && setStatus("down"));
      s.on("auth_error", () => {
        if (!alive) return;
        setStatus("denied");
        s.disconnect();
      });
      s.on("initialTweets", (list: unknown) => {
        setStatus("live");
        if (Array.isArray(list)) for (const p of list) take(p as Post);
        push();
      });
      s.on("tweet", (p: Post) => {
        setStatus("live");
        take(p);
        push();
      });
      s.on("tweet_update", (p: Post) => {
        take(p);
        push();
      });
      // J7 names the coins it finds in a post separately, sometimes before the post itself
      s.on("token_meta", (m: TokenMeta) => {
        const mint = m?.tokenMeta?.mint ?? m?.mint;
        if (!m?.id || !mint || !ADDR.test(mint)) return;
        const p = posts.get(m.id);
        if (p) {
          if (!p.cas.includes(mint)) p.cas = [...p.cas, mint];
          push();
        } else early.set(m.id, [...(early.get(m.id) ?? []), mint]);
      });
    }, () => alive && setStatus("down"));
    const t = setInterval(push, 30_000);
    return () => {
      alive = false;
      clearInterval(t);
      sock?.disconnect();
    };
  }, [token]);
  return { status, signals };
}
