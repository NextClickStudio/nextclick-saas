# yeppo's server embeds, second take: a black banner on top, then one sober embed with clickable channel links
import json, subprocess, sys, time
D = sys.argv[1]
TOKEN = open(f"{D}/.token").read().strip()
N = json.load(open(f"{D}/new.json"))
BOT = "1505933699911385098"
C = 0x16151D  # the embed's edge: near black
SITE = "https://yeppo.it"
ch = lambda k: f"<#{N[k]}>"
def api(m, p, body=None):
    for _ in range(5):
        out = subprocess.run([f"{D}/api.sh", m, p] + ([json.dumps(body)] if body is not None else []), capture_output=True, text=True).stdout
        j = json.loads(out) if out.strip() else {}
        if isinstance(j, dict) and j.get("retry_after"): time.sleep(float(j["retry_after"]) + .2); continue
        return j
def clear(channel):
    for m in api("GET", f"/channels/{channel}/messages?limit=50") or []:
        if m["author"]["id"] == BOT: api("DELETE", f"/channels/{channel}/messages/{m['id']}"); time.sleep(.4)
def post(key, img, embed, buttons=None):
    channel = N[key]
    payload = {"embeds": [{"color": C, "image": {"url": f"attachment://{img}.png"}}, {"color": C, **embed}],
               "attachments": [{"id": 0, "filename": f"{img}.png"}]}
    if buttons: payload["components"] = [{"type": 1, "components": buttons}]
    out = subprocess.run(["curl", "-s", "-X", "POST", f"https://discord.com/api/v10/channels/{channel}/messages",
                          "-H", f"Authorization: Bot {TOKEN}", "-H", "User-Agent: DiscordBot (yeppo, 1.0)",
                          "--form-string", f"payload_json={json.dumps(payload)}", "-F", f"files[0]=@{D}/img2/{img}.png;type=image/png"],
                         capture_output=True, text=True).stdout
    j = json.loads(out); print(key, j.get("id"), j.get("message", ""), j.get("errors", "")); time.sleep(.6)
def link(label, url, emoji=None):
    return {"type": 2, "style": 5, "label": label, "url": url, **({"emoji": {"name": emoji}} if emoji else {})}
FOOT = {"text": "yeppo.it · short-term read, not financial advice"}

for k in ["👋│welcome", "📜│rules", "📢│announcements", "🧠│how-it-works", "⚡│why-yeppo", "💳│pricing", "🏆│record", "🔗│links", "🔑│get-pro"]:
    clear(N[k])

post("👋│welcome", "welcome", {
    "title": "Welcome to Yeppo",
    "description": "The pump.fun scanner that reads every coin in about a second: **who holds it, who launched it, and whether to get in.**\n\n"
                   "**Verify to open the server**\nOne click on **✅ Verify** below unlocks every channel. Read "
                   f"{ch('📜│rules')} first — it takes ten seconds.\n\n"
                   "**Then**\n"
                   f"› {ch('🧠│how-it-works')} — what Yeppo reads on a coin\n"
                   f"› {ch('💳│pricing')} — plans from 0.2 SOL\n"
                   f"› {ch('💬│chat')} — say hi",
    "footer": FOOT,
}, [{"type": 2, "style": 3, "label": "Verify", "emoji": {"name": "✅"}, "custom_id": "yeppo:enter"}, link("yeppo.it", SITE, "🌐")])

post("📜│rules", "rules", {
    "title": "Server rules",
    "description": "**01 · Respect** — disagree with the coin, not the person. No insults, no hate.\n\n"
                   f"**02 · No shilling** — no paid promos or referral spam. Coins go in {ch('📈│calls')} with the CA and what Yeppo said.\n\n"
                   "**03 · Nobody from Yeppo DMs you first** — we never ask for a seed phrase, a wallet or a payment outside **yeppo.it**. Anyone who does is a scammer: block and report.\n\n"
                   "**04 · Not financial advice** — Yeppo reads the chain and gives a call; the trade is yours. Memecoins can go to zero in seconds.\n\n"
                   "**05 · English or Italian** — keep it readable for everyone.",
    "footer": {"text": "The mods have the last word."},
})

post("📢│announcements", "announce", {
    "title": "Yeppo is live",
    "description": "This server is now Yeppo's home.\n\n"
                   f"› Start from {ch('🧠│how-it-works')} and {ch('⚡│why-yeppo')}\n"
                   f"› Share coins in {ch('📈│calls')}, wins in {ch('🏆│wins')}\n"
                   f"› Have a Pro key? Unlock the Pro room in {ch('🔑│get-pro')}\n\n"
                   "News, updates and launches land here — hit **Follow** to get them in your own server.",
    "footer": FOOT,
}, [link("Open yeppo.it", SITE, "🌐")])

post("🧠│how-it-works", "how", {
    "title": "How Yeppo works",
    "description": "**01 · Add the extension**\nOne click from yeppo.it/extension. It opens a side panel on pump.fun, Axiom, GMGN, Photon, BullX and DexScreener.\n\n"
                   "**02 · Open any coin**\nYeppo spots it on the page and reads it live from the Solana chain, every few seconds.\n\n"
                   "**03 · See who holds it**\nCreator · launch bundle · snipers · everyone else, on real balances. Insiders under 20% = safe zone.\n\n"
                   "**04 · Know who launched it**\nThe creator's past coins, where their money came from, and the X post the coin was born from.\n\n"
                   "**05 · Get one word**\n🟢 Momentum · 🟢 Opportunity · 🟡 Wait · 🔴 Don't buy — with the real odds of a ×2, and an **Exit** when the big holders sell.\n\n"
                   f"Questions? Ask in {ch('🆘│help')}.",
    "footer": FOOT,
}, [link("Get the extension", f"{SITE}/extension", "🧩")])

post("⚡│why-yeppo", "why", {
    "title": "Why Yeppo",
    "description": "**It sees what charts hide** — bundled launches, snipers, a creator who rugged ten coins before.\n\n"
                   "**It's fast** — one second to read a coin, live updates straight from the chain.\n\n"
                   "**One clear call** — one word and the reason behind it, not forty numbers to decode.\n\n"
                   f"**Honest numbers** — every call is tracked with what the coin did next, wins and misses: {ch('🏆│record')}.\n\n"
                   "**Born on X** — the post a coin came from, how fast it spreads, and the fresh coins named after it.\n\n"
                   f"**Cheap** — from 0.2 SOL a month. One rug avoided pays for a year. See {ch('💳│pricing')}.",
    "footer": FOOT,
})

post("💳│pricing", "pricing", {
    "title": "Pricing",
    "description": "Pay in SOL straight from your wallet. Your key arrives in seconds and works in the extension and on the site.",
    "fields": [
        {"name": "Pro · 30 days", "value": "```0.2 SOL```", "inline": True},
        {"name": "Pro · 90 days", "value": "```0.5 SOL  -17%```", "inline": True},
        {"name": "Included", "value": "Every coin and every check · live call and Exit · launch bundle from the chain · creator and money trail · X origin and author scorecard · Hot on X · the 💎 Pro room here"},
        {"name": "Renewing", "value": f"Buy again from the same browser: same key, the days add up. Already have one? → {ch('🔑│get-pro')}"},
    ],
    "footer": {"text": "One key · 3 devices · 1 Discord account"},
}, [link("Get Pro", f"{SITE}/pricing", "💎")])

post("🏆│record", "record", {
    "title": "Track record",
    "description": "Every call Yeppo shows on a coin is saved with what the coin did next: how many went ×2 after a **Momentum**, how many **Don't buy** coins then lost half.\n\nNothing left out, updated every hour.\n\n"
                   f"Post your own in {ch('🏆│wins')}.",
    "footer": FOOT,
}, [link("Open the record", f"{SITE}/record", "📊")])

post("🔗│links", "links", {
    "title": "Official links",
    "description": "› **Site** — yeppo.it\n› **Extension** — yeppo.it/extension\n› **Record** — yeppo.it/record\n› **Instagram** — @getyeppo\n\nThese are the only official links. Anything else is fake.",
    "footer": FOOT,
}, [link("yeppo.it", SITE, "🌐"), link("Extension", f"{SITE}/extension", "🧩"), link("Instagram", "https://instagram.com/getyeppo", "📸")])

post("🔑│get-pro", "pro", {
    "title": "Unlock the Pro room",
    "description": f"Have a Pro key? Press **💎 Unlock Pro** and paste it: {ch('💎│pro-chat')}, {ch('🎯│pro-calls')} and the Pro voice room open up right away, and the bot DMs you when your key ends.\n\n"
                   "One key opens one Discord account. No key yet? Plans start at 0.2 SOL.",
    "footer": {"text": "Your key is only checked, never shown to anyone."},
}, [{"type": 2, "style": 1, "label": "Unlock Pro", "emoji": {"name": "💎"}, "custom_id": "yeppo:pro"}, link("Get a key", f"{SITE}/pricing", "🔑")])
