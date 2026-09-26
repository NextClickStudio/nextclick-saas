// MAISON — market update (every 10 minutes).
//
// For each active trend we read search interest over the last 7 days and turn it
// into a "signal" = interest of the last 24h / average interest of the week
// (smoothed). The index moves with the signal: index_now = index_prev × signal_now / signal_prev.
// Keywords are requested 5 at a time, grouped by family so their volumes are comparable
// (the last-24h / week ratio does not depend on Google's shared 0–100 scale).
// Runs every 10 minutes and refreshes the 2 stalest batches, so every trend moves about
// once an hour with ~12 requests/hour. If Google answers 429 the run stops: no fake moves.
//
// Data source:
//   - SERPAPI_KEY set  → SerpApi Google Trends (reliable, paid)
//   - otherwise        → Google Trends public endpoints (free, may be rate-limited)
// If Google has too little data for a keyword (very niche search) and MARKET_FALLBACK is
// not "none", that trend takes a small random step marked source = 'sim' ("est." in the app).
import { createClient } from "npm:@supabase/supabase-js@2";

const MIN_MINUTES_BETWEEN_RUNS = 8;
const BATCH = 5;
const BATCHES_PER_RUN = 2;
const MAX_MOVE = 0.08;
const SMOOTHING = 0.4; // weight of the new reading
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

type Series = Map<string, number[]>;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const avg = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);

async function googleSeries(keywords: string[], cookie: string): Promise<Series> {
  const req = {
    comparisonItem: keywords.map((k) => ({ keyword: k, geo: "", time: "now 7-d" })),
    category: 0,
    property: "",
  };
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
    out.set(k, data.default.timelineData.map((p: { value: number[] }) => Number(p.value[i]) || 0)),
  );
  return out;
}

async function serpSeries(keywords: string[], key: string): Promise<Series> {
  const url =
    `https://serpapi.com/search.json?engine=google_trends&data_type=TIMESERIES&date=${encodeURIComponent("now 7-d")}` +
    `&q=${encodeURIComponent(keywords.join(","))}&api_key=${key}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`serpapi ${res.status}`);
  const json = await res.json();
  const timeline = json?.interest_over_time?.timeline_data ?? [];
  const out: Series = new Map();
  keywords.forEach((k, i) =>
    out.set(k, timeline.map((p: { values: { extracted_value: number }[] }) => Number(p.values?.[i]?.extracted_value) || 0)),
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
  const { data: run } = await supabase.from("maison_market_runs").insert({ source }).select("id").single();

  const { data: trends, error } = await supabase
    .from("maison_trends")
    .select("id, family, query, value, signal, updated_at, source")
    .eq("active", true)
    .order("updated_at", { ascending: true });
  if (error || !trends) return Response.json({ error: error?.message }, { status: 500, headers: CORS });

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
  const errors: string[] = [];

  // Batches of the same family, stalest first.
  const batches: (typeof trends)[] = [];
  const byFamily = new Map<string, typeof trends>();
  for (const t of trends) byFamily.set(t.family, [...(byFamily.get(t.family) ?? []), t]);
  for (const list of byFamily.values()) for (let i = 0; i < list.length; i += BATCH) batches.push(list.slice(i, i + BATCH));
  const oldest = (b: typeof trends) => Math.min(...b.map((t) => new Date(t.updated_at).getTime()));
  batches.sort((a, b) => oldest(a) - oldest(b));
  let processed = 0;

  for (const batch of batches.slice(0, BATCHES_PER_RUN)) {
    let series: Series;
    try {
      series = serpKey ? await serpSeries(batch.map((t) => t.query), serpKey) : await googleSeries(batch.map((t) => t.query), cookie);
    } catch (e) {
      errors.push(String(e));
      break; // rate-limited or down: stop, try again next run
    }
    for (const t of batch) {
      processed++;
      const raw = signalOf(series.get(t.query) ?? []);
      let value = Number(t.value);
      let src = source;
      let signal = t.signal === null ? null : Number(t.signal);
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
      value = Math.max(1, Math.round(value * 10) / 10);
      await supabase.from("maison_trends").update({ value, signal, source: src, updated_at: new Date().toISOString() }).eq("id", t.id);
      await supabase
        .from("maison_trend_points")
        .upsert({ trend_id: t.id, ts: hour.toISOString(), value, source: src }, { onConflict: "trend_id,ts" });
    }
    if (!serpKey) await sleep(2500); // be gentle with the public endpoint
  }

  await supabase
    .from("maison_market_runs")
    .update({ ok, failed, note: errors.slice(0, 3).join(" | ") || null })
    .eq("id", run?.id);

  return Response.json({ source, processed, ok, failed, errors: errors.slice(0, 3) }, { headers: CORS });
});
