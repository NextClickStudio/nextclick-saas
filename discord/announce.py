# yeppo's launch announcement in #announcements: @everyone, the hero image and one embed. Run with "send" to post.
import json, subprocess, sys
D = sys.argv[1]
TOKEN = open(f"{D}/.token").read().strip()
N = json.load(open(f"{D}/new.json"))
ch = lambda k: f"<#{N[k]}>"
SITE = "https://yeppo.it"
embed = {
    "color": 0xFF5FD2,
    "title": "Yeppo is live — stop buying traps",
    "description": (
        "Yesterday **40,720 coins** launched on pump.fun. Most of them are traps: bundled launches, snipers waiting to "
        "dump, creators who already rugged ten times. A few go ×2, ×5, ×10.\n\n"
        "**Yeppo tells you which is which — in one second, before you buy.**"
    ),
    "fields": [
        {"name": "What you see on every coin", "value":
            "🟢 **One clear call** — Momentum · Opportunity · Wait · Don't buy, plus **Exit** when the big holders sell\n"
            "🧩 **Who holds it** — creator, launch bundle, snipers, read straight from the chain · ✓ Verified\n"
            "🕵️ **Who launched it** — their past coins and where their money came from\n"
            "🐦 **Where it was born** — the X post behind it, and how that author's coins usually end\n"
            "📊 **Real odds** — how often coins like this one went ×2"},
        {"name": "This week", "value":
            "👁️ **164,673 coins** read — every pump.fun launch, live\n"
            "🧨 **12,050 bundled launches** flagged — insiders holding 15%+ from the first blocks\n"
            "🚨 **991 rugs** spotted\n"
            "💎 **3,011 coins went ×10** — the runners are there, you just have to catch them early\n"
            "🚀 **$APU ×2.6** · **$SpaceDuck ×2.5** — after a Momentum / Opportunity call\n"
            f"Every call, wins and misses, is public: {SITE}/record"},
        {"name": "Get in", "value":
            f"**1 ·** Add the extension — {SITE}/extension\n"
            f"**2 ·** Read {ch('🧠│how-it-works')} and share your finds in {ch('📈│calls')}\n"
            f"**3 ·** Go Pro from **0.2 SOL** → {ch('💳│pricing')} · already have a key? {ch('🔑│get-pro')}"},
    ],
    "image": {"url": "attachment://yeppo-live.png"},
    "footer": {"text": "Yeppo · short-term read, not financial advice. Memecoins can go to zero in seconds."},
}
payload = {
    "content": "@everyone **Yeppo is live.** The pump.fun scanner that sees the traps before you buy 👇",
    "allowed_mentions": {"parse": ["everyone"]},
    "embeds": [embed],
    "attachments": [{"id": 0, "filename": "yeppo-live.png"}],
    "components": [{"type": 1, "components": [
        {"type": 2, "style": 5, "label": "Get the extension", "url": f"{SITE}/extension", "emoji": {"name": "🧩"}},
        {"type": 2, "style": 5, "label": "See the record", "url": f"{SITE}/record", "emoji": {"name": "🏆"}},
        {"type": 2, "style": 5, "label": "Pricing", "url": f"{SITE}/pricing", "emoji": {"name": "💎"}},
    ]}],
}
if len(sys.argv) > 2 and sys.argv[2] == "send":
    out = subprocess.run(["curl", "-s", "-X", "POST", f"https://discord.com/api/v10/channels/{N['📢│announcements']}/messages",
                          "-H", f"Authorization: Bot {TOKEN}", "-H", "User-Agent: DiscordBot (yeppo, 1.0)",
                          "--form-string", f"payload_json={json.dumps(payload)}", "-F", f"files[0]=@{D}/launch/hero.png;filename=yeppo-live.png;type=image/png"],
                         capture_output=True, text=True).stdout
    j = json.loads(out); print(j.get("id"), j.get("message", ""), j.get("errors", ""))
else:
    print(payload["content"]); print("—", embed["title"]); print(embed["description"])
    for f in embed["fields"]: print(f"\n[{f['name']}]\n{f['value']}")
