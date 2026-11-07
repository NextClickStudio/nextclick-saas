# gives every human member of the server the Member role, respecting Discord's rate limits
import json, subprocess, sys, time
D = sys.argv[1]; G = "1015622182438699070"; ROLE = "1567486969636982886"
TOKEN = open(f"{D}/.token").read().strip()
def req(m, p):
    while True:
        r = subprocess.run(["curl", "-s", "-o", "-", "-w", "\n%{http_code}", "-X", m, f"https://discord.com/api/v10{p}",
                            "-H", f"Authorization: Bot {TOKEN}", "-H", "User-Agent: DiscordBot (yeppo, 1.0)", "-H", "X-Audit-Log-Reason: yeppo member role"],
                           capture_output=True, text=True).stdout
        body, code = r.rsplit("\n", 1)
        if code == "429":
            time.sleep(float(json.loads(body).get("retry_after", 1)) + .3); continue
        return int(code), body
members, after = [], "0"
while True:
    code, body = req("GET", f"/guilds/{G}/members?limit=1000&after={after}")
    page = json.loads(body)
    if not page: break
    members += page; after = page[-1]["user"]["id"]
    if len(page) < 1000: break
todo = [m["user"]["id"] for m in members if not m["user"].get("bot") and ROLE not in m["roles"]]
print(f"members {len(members)}, to give the role {len(todo)}", flush=True)
done = fail = 0
for i, u in enumerate(todo):
    code, _ = req("PUT", f"/guilds/{G}/members/{u}/roles/{ROLE}")
    if code < 300: done += 1
    else: fail += 1
    if i % 250 == 0: print(f"{i}/{len(todo)} done={done} fail={fail}", flush=True)
print(f"FINISHED done={done} fail={fail}", flush=True)
