# creates yeppo's categories and channels with their permissions; writes the new ids to new.json
import json, subprocess, sys, time
D = sys.argv[1]; G = "1015622182438699070"
EVERY, MOD, FONDER, FOUNDER = G, "1499676442164854835", "1499813066664054844", "1505934625950662776"
MEMBER, PRO = "1567486969636982886", "1567486968294678638"
def api(m, p, body=None):
    out = subprocess.run([f"{D}/api.sh", m, p] + ([json.dumps(body)] if body is not None else []), capture_output=True, text=True).stdout
    time.sleep(0.6)
    return json.loads(out) if out else {}
VIEW, SEND, HIST, REACT, ATTACH, EMBED, THREAD, TSEND = 1024, 2048, 65536, 64, 32768, 16384, 34359738368, 274877906944
CONNECT, SPEAK, STREAM, VAD = 1048576, 2097152, 512, 33554432
TALK = VIEW | SEND | HIST | REACT | ATTACH | EMBED | THREAD | TSEND
VOICE = VIEW | CONNECT | SPEAK | STREAM | VAD | SEND | HIST
staff = [{"id": r, "type": 0, "allow": str(TALK | VOICE), "deny": "0"} for r in (MOD, FONDER, FOUNDER)]
def ow(kind):
    if kind == "start":  # everyone reads, nobody writes
        return [{"id": EVERY, "type": 0, "allow": str(VIEW | HIST | REACT), "deny": str(SEND | THREAD | TSEND)}] + staff
    if kind == "info":   # members read
        return [{"id": EVERY, "type": 0, "allow": "0", "deny": str(VIEW)},
                {"id": MEMBER, "type": 0, "allow": str(VIEW | HIST | REACT), "deny": str(SEND | THREAD | TSEND)},
                {"id": PRO, "type": 0, "allow": str(VIEW | HIST | REACT), "deny": str(SEND | THREAD | TSEND)}] + staff
    if kind == "talk":
        return [{"id": EVERY, "type": 0, "allow": "0", "deny": str(VIEW)}, {"id": MEMBER, "type": 0, "allow": str(TALK), "deny": "0"},
                {"id": PRO, "type": 0, "allow": str(TALK), "deny": "0"}] + staff
    if kind == "voice":
        return [{"id": EVERY, "type": 0, "allow": "0", "deny": str(VIEW)}, {"id": MEMBER, "type": 0, "allow": str(VOICE), "deny": "0"},
                {"id": PRO, "type": 0, "allow": str(VOICE), "deny": "0"}] + staff
    if kind == "pro":
        return [{"id": EVERY, "type": 0, "allow": "0", "deny": str(VIEW)}, {"id": MEMBER, "type": 0, "allow": "0", "deny": str(VIEW)},
                {"id": PRO, "type": 0, "allow": str(TALK | VOICE), "deny": "0"}] + staff
PLAN = [
    ("🚪 ─ START HERE", "start", [("👋│welcome", 0, "Start here: what Yeppo is, and the button to get in.", "REUSE:1505944220744155226"),
                                  ("📜│rules", 0, "The few rules of the server.", None),
                                  ("📢│announcements", 5, "Yeppo news, updates and launches.", None)]),
    ("💎 ─ YEPPO", "info", [("🧠│how-it-works", 0, "What Yeppo reads on a coin, and how to use it.", None),
                            ("⚡│why-yeppo", 0, "Why traders use Yeppo.", None),
                            ("💳│pricing", 0, "Plans and how to pay.", None),
                            ("🏆│record", 0, "Every call Yeppo made, and what the coin did next.", None),
                            ("🔗│links", 0, "Site, extension, Instagram.", None),
                            ("🔑│get-pro", 0, "Have a Pro key? Unlock the Pro room here.", None)]),
    ("💬 ─ COMMUNITY", "talk", [("💬│chat", 0, "Talk memecoins. English and Italian welcome.", None),
                                ("📈│calls", 0, "Share a coin you found with Yeppo: ticker, CA, what Yeppo said. 1 post / 30 s.", None),
                                ("🏆│wins", 0, "Post your wins: screenshot + coin + Yeppo's call.", None),
                                ("🆘│help", 0, "Questions about Yeppo, the extension or your key.", None)]),
    ("🔊 ─ VOICE", "voice", [("🔊 Lounge", 2, None, None), ("📞 Call room 1", 2, None, None), ("📞 Call room 2", 2, None, None)]),
    ("💎 ─ PRO ROOM", "pro", [("💎│pro-chat", 0, "Pro members only.", None), ("🎯│pro-calls", 0, "Pro calls: coins Yeppo flags Momentum or Opportunity.", None),
                              ("🔊 Pro voice", 2, None, None)]),
]
new = {}
for pos, (cat, kind, chans) in enumerate(PLAN):
    c = api("POST", f"/guilds/{G}/channels", {"name": cat, "type": 4, "position": pos, "permission_overwrites": ow(kind)})
    print(cat, c.get("id"), c.get("message", "")); new[cat] = c["id"]
    for i, (name, t, topic, reuse) in enumerate(chans):
        body = {"name": name, "parent_id": c["id"], "position": i, "permission_overwrites": ow(kind)}
        if topic: body["topic"] = topic
        if name == "📈│calls": body["rate_limit_per_user"] = 30
        if reuse:
            x = api("PATCH", f"/channels/{reuse.split(':')[1]}", body)
        else:
            body["type"] = t
            x = api("POST", f"/guilds/{G}/channels", body)
        print("   ", name, x.get("id"), x.get("message", ""), x.get("errors", ""))
        new[name] = x.get("id")
json.dump(new, open(f"{D}/new.json", "w"), ensure_ascii=False, indent=1)
