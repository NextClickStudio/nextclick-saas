# posts one embed with its banner image uploaded alongside (attachment://), and optional link buttons
import json, subprocess, sys
D = sys.argv[1]
TOKEN = open(f"{D}/.token").read().strip()
C = 0xff5fd2
def post(channel, img, embed, buttons=None, content=None):
    embed = {**embed, "color": embed.get("color", C), "image": {"url": f"attachment://{img}.png"}}
    payload = {"embeds": [embed], "attachments": [{"id": 0, "filename": f"{img}.png"}]}
    if content: payload["content"] = content
    if buttons:
        payload["components"] = [{"type": 1, "components": buttons}]
    out = subprocess.run(["curl", "-s", "-X", "POST", f"https://discord.com/api/v10/channels/{channel}/messages",
                          "-H", f"Authorization: Bot {TOKEN}", "-H", "User-Agent: DiscordBot (yeppo, 1.0)",
                          "--form-string", f"payload_json={json.dumps(payload)}", "-F", f"files[0]=@{D}/img/{img}.png;type=image/png"], capture_output=True, text=True).stdout
    j = json.loads(out)
    print(channel, img, j.get("id"), j.get("message", ""), j.get("errors", ""))
    return j
def link(label, url, emoji=None):
    b = {"type": 2, "style": 5, "label": label, "url": url}
    if emoji: b["emoji"] = {"name": emoji}
    return b
N = json.load(open(f"{D}/new.json"))
SITE = "https://yeppo.it"
post(N["📜│rules"], "rules", {
    "title": "📜 Server rules",
    "description": "Short and simple. Break them and you're out.",
    "fields": [
        {"name": "1 · Respect", "value": "No insults, no harassment, no hate. Disagree with the coin, not with the person."},
        {"name": "2 · No scams, no shilling", "value": "No paid promos, no referral spam, no DMs to sell anything. Coins go in **#calls** with the CA and what Yeppo said."},
        {"name": "3 · Nobody from Yeppo DMs you first", "value": "We never ask for your seed phrase, your wallet or a payment outside **yeppo.it**. Anyone who does is a scammer: block and report."},
        {"name": "4 · Not financial advice", "value": "Yeppo reads the chain and gives you a call; you make the trade. Memecoins can go to zero in seconds."},
        {"name": "5 · English or Italian", "value": "Keep it readable for everyone."},
    ],
    "footer": {"text": "Yeppo · the mods have the last word"},
})
post(N["🧠│how-it-works"], "how", {
    "title": "🧠 How Yeppo works",
    "description": "Open a coin, and in about a second Yeppo tells you what's really inside it.",
    "fields": [
        {"name": "1 · Add the extension", "value": "One click from **yeppo.it/extension**. It opens a side panel on pump.fun, Axiom, GMGN, Photon, BullX, DexScreener and more."},
        {"name": "2 · Open any coin", "value": "Yeppo spots the coin on the page and reads it live from the Solana chain, every few seconds."},
        {"name": "3 · See who holds it", "value": "**Creator · launch bundle · snipers · everyone else**, on real balances. Insiders under 20% = safe zone. The launch bundle (who bought in the first 2 blocks) is read straight from the chain."},
        {"name": "4 · Know who launched it", "value": "The creator's past coins and where their money came from, the X post the coin was born from, and how that author's coins usually end."},
        {"name": "5 · Get one word", "value": "🟢 **Momentum** · 🟢 **Opportunity** · 🟡 **Wait** · 🔴 **Don't buy**, with the real odds of a ×2. When the big holders start selling you get an **Exit**."},
        {"name": "Hot on X", "value": "Connect J7 and Yeppo shows the posts that matter right now, with the fresh coins born from them, to catch them early."},
    ],
    "footer": {"text": "Short-term read, not advice."},
}, [link("Get the extension", f"{SITE}/extension", "🧩"), link("Open yeppo.it", SITE, "🌐")])
post(N["⚡│why-yeppo"], "why", {
    "title": "⚡ Why Yeppo",
    "color": 0x1fd47c,
    "fields": [
        {"name": "🔍 It sees what charts hide", "value": "Bundled launches, snipers, a creator who rugged 10 coins before: Yeppo reads them from the chain before you buy."},
        {"name": "⚡ It's fast", "value": "One second to read a coin, live updates every few seconds, trades straight from the chain."},
        {"name": "🎯 One clear call", "value": "No 40 numbers to decode: one word and the reason behind it, plus an Exit when holders dump."},
        {"name": "📊 Honest numbers", "value": "Every call Yeppo shows is recorded with what the coin did next, wins and misses: **yeppo.it/record**."},
        {"name": "🐦 Born on X", "value": "See the post a coin came from, how fast it spreads, and the fresh coins named after it."},
        {"name": "💸 Cheap", "value": "From 0.2 SOL a month. One avoided rug pays for a year."},
    ],
}, [link("See the record", f"{SITE}/record", "🏆"), link("Pricing", f"{SITE}/pricing", "💳")])
post(N["💳│pricing"], "pricing", {
    "title": "💳 Pricing",
    "color": 0xffb23e,
    "description": "Pay in SOL straight from your wallet: the key arrives in seconds, and works in the extension and on the site.",
    "fields": [
        {"name": "Pro · 30 days", "value": "## 0.2 SOL", "inline": True},
        {"name": "Pro · 90 days", "value": "## 0.5 SOL\n-17%", "inline": True},
        {"name": "Everything included", "value": "Every coin, every check · live call + Exit · launch bundle from the chain · creator and money trail · X origin and author scorecard · Hot on X with J7 · the 💎 Pro room here on Discord"},
        {"name": "Renewing", "value": "Buy again from the same browser: the same key keeps working, the days add up."},
    ],
    "footer": {"text": "One key: 3 devices and 1 Discord account."},
}, [link("Get Pro", f"{SITE}/pricing", "💎")])
post(N["🏆│record"], "record", {
    "title": "🏆 The record",
    "color": 0x1fd47c,
    "description": "Every call Yeppo shows on a coin is saved with what the coin did next: how many went ×2 after a **Momentum**, how many **Don't buy** coins then lost half. Nothing left out, updated every hour.",
}, [link("Open the record", f"{SITE}/record", "📊")])
post(N["🔗│links"], "welcome", {
    "title": "🔗 Yeppo links",
    "description": "**Site** · yeppo.it\n**Extension** · yeppo.it/extension\n**Record** · yeppo.it/record\n**Instagram** · @getyeppo\n\nThese are the only official links. Anything else is fake.",
}, [link("yeppo.it", SITE, "🌐"), link("Extension", f"{SITE}/extension", "🧩"), link("Instagram", "https://instagram.com/getyeppo", "📸"), link("Record", f"{SITE}/record", "🏆")])
post(N["📢│announcements"], "welcome", {
    "title": "🚀 Welcome to the new Yeppo server",
    "description": "This is Yeppo's home now: the pump.fun scanner that reads every coin in a second.\n\n"
                   "• Check **#how-it-works** and **#why-yeppo**\n• Share coins in **#calls**, wins in **#wins**\n"
                   "• Pro holders: unlock the 💎 Pro room in **#get-pro**\n\nNews, updates and launches land here.",
}, [link("Open yeppo.it", SITE, "🌐")])
