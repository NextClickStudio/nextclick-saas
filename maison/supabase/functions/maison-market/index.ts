// MAISON — market update (every 10 minutes).
//
// Live prices. For each listed trend we read search interest over the last 7 days and turn it
// into a "signal" = interest of the last 24h / average interest of the week (smoothed).
// The price moves with the signal: price_now = price_prev × signal_now / signal_prev.
// Keywords are requested 5 at a time, grouped by family (the last-24h / week ratio does
// not depend on Google's shared 0–100 scale). Trends in today's forecast and trends that
// players hold are refreshed first. If Google answers 429 the run stops: no fake moves.
//
// Listing. A new trend has no price yet. We read its last 30 days of daily interest and
// build a real 30-day history (price = 100 × interest / 30-day average), then list it.
// Trends already listed keep their price: only the shape of their history is replaced.
// Keywords with too little search volume are delisted (active = false).
//
// Data source:
//   - SERPAPI_KEY set  → SerpApi Google Trends (reliable, paid)
//   - otherwise        → Google Trends public endpoints (free, may be rate-limited)
import { createClient } from "npm:@supabase/supabase-js@2";

const MIN_MINUTES_BETWEEN_RUNS = 8;
const BATCH = 5;
const REQUESTS_PER_RUN = 2;
const MAX_MOVE = 0.08;
const SMOOTHING = 0.4; // weight of the new reading
const PRIORITY_BOOST = 4; // held / forecast trends age 4× faster
const MIN_VOLUME = 2; // average 0–100 interest below this = too niche to price
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

type Point = { t: number; v: number };
type Series = Map<string, Point[]>;
type Trend = {
  id: string;
  family: string;
  query: string;
  value: number;
  signal: number | null;
  updated_at: string;
  source: string;
  listed: boolean;
  backfilled: boolean;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const avg = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
const round1 = (v: number) => Math.round(v * 10) / 10;

async function googleSeries(keywords: string[], cookie: string, time: string): Promise<Series> {
  const req = { comparisonItem: keywords.map((k) => ({ keyword: k, geo: "", time })), category: 0, property: "" };
  const ex = await fetch(
    `https://trends.google.com/trends/api/explore?hl=en-US&tz=0&req=${encodeURIComponent(JSON.stringify(req))}`,
    { headers: { "user-agent": UA, cookie } },
  );
  if (!ex.ok) throw new Error(`explore ${ex.status}`);
  const exText = await ex.text();
  const exJson = JSON.parse(exText.slice(exText.indexOf("{")));
  const widget = exJson.widgets.find((w: { id: string }) => w.id === "TIMESERIES");
  if (!widget) throw new Error("no timeseries widget");
  const ml = await fetch(
    `https://trends.google.com/trends/api/widgetdata/multiline?hl=en-US&tz=0&req=${encodeURIComponent(
      JSON.stringify(widget.request),
    )}&token=${widget.token}`,
    { headers: { "user-agent": UA, cookie } },
  );
  if (!ml.ok) throw new Error(`multiline ${ml.status}`);
  const mlText = await ml.text();
  const data = JSON.parse(mlText.slice(mlText.indexOf("{")));
  const out: Series = new Map();
  keywords.forEach((k, i) =>
    out.set(
      k,
      data.default.timelineData.map((p: { time: string; value: number[] }) => ({ t: Number(p.time) * 1000, v: Number(p.value[i]) || 0 })),
    ),
  );
  return out;
}

async function serpSeries(keywords: string[], key: string, time: string): Promise<Series> {
  const url =
    `https://serpapi.com/search.json?engine=google_trends&data_type=TIMESERIES&date=${encodeURIComponent(time)}` +
    `&q=${encodeURIComponent(keywords.join(","))}&api_key=${key}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`serpapi ${res.status}`);
  const json = await res.json();
  const timeline = json?.interest_over_time?.timeline_data ?? [];
  const out: Series = new Map();
  keywords.forEach((k, i) =>
    out.set(
      k,
      timeline.map((p: { timestamp: string; values: { extracted_value: number }[] }) => ({
        t: Number(p.timestamp) * 1000,
        v: Number(p.values?.[i]?.extracted_value) || 0,
      })),
    ),
  );
  return out;
}

/** Signal: last 24h vs whole window (hourly points over 7 days). */
function signalOf(series: number[]): number | null {
  if (series.length < 24) return null;
  const week = avg(series);
  if (week < 1) return null; // too little search volume to read
  return Math.max(0.05, avg(series.slice(-24)) / week);
}

/** Batches of the same family, most overdue first. */
function batchesOf(list: Trend[], score: (t: Trend) => number): Trend[][] {
  const byFamily = new Map<string, Trend[]>();
  for (const t of list) byFamily.set(t.family, [...(byFamily.get(t.family) ?? []), t]);
  const batches: Trend[][] = [];
  for (const fam of byFamily.values()) {
    fam.sort((a, b) => score(b) - score(a));
    for (let i = 0; i < fam.length; i += BATCH) batches.push(fam.slice(i, i + BATCH));
  }
  return batches.sort((a, b) => Math.max(...b.map(score)) - Math.max(...a.map(score)));
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const url = new URL(req.url);
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Admins can force a run; everyone else is rate-limited.
  let force = false;
  if (url.searchParams.get("force") === "1") {
    const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: user } = await supabase.auth.getUser(jwt);
    const { data: cfg } = await supabase.from("maison_config").select("data").eq("id", 1).single();
    const admins: string[] = cfg?.data?.admins ?? [];
    force = !!user?.user?.email && admins.includes(user.user.email);
  }
  if (!force) {
    const { data: last } = await supabase.from("maison_market_runs").select("started_at").order("id", { ascending: false }).limit(1);
    if (last?.[0] && Date.now() - new Date(last[0].started_at).getTime() < MIN_MINUTES_BETWEEN_RUNS * 60_000) {
      return Response.json({ skipped: "too soon" }, { headers: CORS });
    }
  }

  const serpKey = Deno.env.get("SERPAPI_KEY");
  const fallback = (Deno.env.get("MARKET_FALLBACK") ?? "sim") !== "none";
  const source = serpKey ? "serpapi" : "google";
  const fetchSeries = (keywords: string[], time: string, cookie: string) =>
    serpKey ? serpSeries(keywords, serpKey, time) : googleSeries(keywords, cookie, time);
  const { data: run } = await supabase.from("maison_market_runs").insert({ source }).select("id").single();

  const today = new Date().toISOString().slice(0, 10);
  const [{ data: rows, error }, { data: forecast }, { data: held }] = await Promise.all([
    supabase.from("maison_trends").select("id, family, query, value, signal, updated_at, source, listed, backfilled").eq("active", true),
    supabase.from("maison_forecast").select("trend_id").eq("day", today),
    supabase.from("maison_cards").select("trend_id").eq("status", "active"),
  ]);
  if (error || !rows) return Response.json({ error: error?.message }, { status: 500, headers: CORS });
  const trends = (rows as Trend[]).map((t) => ({ ...t, value: Number(t.value), signal: t.signal === null ? null : Number(t.signal) }));
  const priority = new Set([...(forecast ?? []), ...(held ?? [])].map((r: { trend_id: string }) => r.trend_id));

  let cookie = "";
  if (!serpKey) {
    try {
      const home = await fetch("https://trends.google.com/trends/?geo=US", { headers: { "user-agent": UA } });
      cookie = (home.headers.get("set-cookie") ?? "").split(";")[0];
    } catch {
      /* try without cookie */
    }
  }

  const hour = new Date();
  hour.setUTCMinutes(0, 0, 0);
  let ok = 0;
  let failed = 0;
  let listed = 0;
  let delisted = 0;
  const errors: string[] = [];
  let requests = 0;

  // 1. Listing: one batch per run while there are trends without real history (new ones first).
  const pending = trends.filter((t) => !t.backfilled);
  if (pending.length) {
    const batch = batchesOf(pending, (t) => (t.listed ? 0 : 1))[0];
    requests++;
    try {
      const series = await fetchSeries(batch.map((t) => t.query), "today 1-m", cookie);
      for (const t of batch) {
        const pts = series.get(t.query) ?? [];
        const mean = avg(pts.map((p) => p.v));
        if (pts.length < 20 || mean < MIN_VOLUME) {
          await supabase.from("maison_trends").update({ active: false, backfilled: true }).eq("id", t.id);
          delisted++;
          continue;
        }
        // 3-day moving average, so one noisy day doesn't make a spike.
        const smooth = pts.map((_, i) => avg(pts.slice(Math.max(0, i - 2), i + 1).map((p) => p.v)));
        const last = smooth[smooth.length - 1] || mean;
        const scale = t.listed ? t.value / last : 100 / mean;
        const values = smooth.map((v) => Math.max(1, round1(v * scale)));
        const value = values[values.length - 1];
        await supabase.from("maison_trend_points").delete().eq("trend_id", t.id).lte("ts", new Date(pts[pts.length - 1].t).toISOString());
        await supabase.from("maison_trend_points").upsert(
          pts.map((p, i) => ({ trend_id: t.id, ts: new Date(p.t).toISOString(), value: values[i], source })),
          { onConflict: "trend_id,ts" },
        );
        const patch: Record<string, unknown> = { backfilled: true, listed: true, source, updated_at: new Date().toISOString() };
        if (!t.listed) Object.assign(patch, { value, day_open: value, signal: null });
        await supabase.from("maison_trends").update(patch).eq("id", t.id);
        if (!t.listed) listed++;
      }
    } catch (e) {
      errors.push(`listing: ${String(e)}`);
    }
    if (!serpKey) await sleep(2500);
  }

  // 2. Live prices for listed trends, most overdue first.
  const now = Date.now();
  const score = (t: Trend) => (now - new Date(t.updated_at).getTime()) * (priority.has(t.id) ? PRIORITY_BOOST : 1);
  const live = trends.filter((t) => t.listed);
  for (const batch of batchesOf(live, score)) {
    if (requests >= REQUESTS_PER_RUN || errors.length) break;
    requests++;
    let series: Series;
    try {
      series = await fetchSeries(batch.map((t) => t.query), "now 7-d", cookie);
    } catch (e) {
      errors.push(String(e));
      break; // rate-limited or down: stop, try again next run
    }
    for (const t of batch) {
      const raw = signalOf((series.get(t.query) ?? []).map((p) => p.v));
      let value = t.value;
      let src = source;
      let signal = t.signal;
      if (raw !== null) {
        const s = signal ? signal * (1 - SMOOTHING) + raw * SMOOTHING : raw;
        if (signal) {
          const move = Math.max(-MAX_MOVE, Math.min(MAX_MOVE, s / signal - 1));
          value = value * (1 + move);
        }
        signal = s;
        ok++;
      } else if (fallback) {
        value = value * (1 + (Math.random() - 0.48) * 0.012);
        src = "sim";
        failed++;
      } else {
        failed++;
        continue;
      }
      value = Math.max(1, round1(value));
      await supabase.from("maison_trends").update({ value, signal, source: src, updated_at: new Date().toISOString() }).eq("id", t.id);
      await supabase
        .from("maison_trend_points")
        .upsert({ trend_id: t.id, ts: hour.toISOString(), value, source: src }, { onConflict: "trend_id,ts" });
    }
    if (!serpKey) await sleep(2500); // be gentle with the public endpoint
  }

  const note = [listed ? `listed ${listed}` : "", delisted ? `delisted ${delisted}` : "", ...errors.slice(0, 2)].filter(Boolean).join(" | ");
  await supabase.from("maison_market_runs").update({ ok, failed, note: note || null }).eq("id", run?.id);

  return Response.json({ source, ok, failed, listed, delisted, pending: pending.length, errors: errors.slice(0, 3) }, { headers: CORS });
});
