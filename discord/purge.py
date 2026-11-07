# deletes every message of a channel: in bulk when under 14 days old, one by one otherwise
import json, subprocess, sys, time
from datetime import datetime, timezone, timedelta
D, CH = sys.argv[1], sys.argv[2]
def api(m, p, body=None):
    for _ in range(5):
        r = subprocess.run([f"{D}/api.sh", m, p] + ([json.dumps(body)] if body is not None else []), capture_output=True, text=True).stdout
        j = json.loads(r) if r.strip() else {}
        if isinstance(j, dict) and j.get("retry_after"):
            time.sleep(float(j["retry_after"]) + 0.2); continue
        return j
    return {}
msgs, before = [], None
while True:
    page = api("GET", f"/channels/{CH}/messages?limit=100" + (f"&before={before}" if before else ""))
    if not isinstance(page, list) or not page: break
    msgs += page; before = page[-1]["id"]
    if len(page) < 100: break
print("messages:", len(msgs))
cut = datetime.now(timezone.utc) - timedelta(days=13, hours=20)
young = [m["id"] for m in msgs if datetime.fromisoformat(m["timestamp"]) > cut]
old = [m["id"] for m in msgs if datetime.fromisoformat(m["timestamp"]) <= cut]
for i in range(0, len(young), 100):
    chunk = young[i:i + 100]
    if len(chunk) == 1: api("DELETE", f"/channels/{CH}/messages/{chunk[0]}")
    else: api("POST", f"/channels/{CH}/messages/bulk-delete", {"messages": chunk})
for n, mid in enumerate(old):
    api("DELETE", f"/channels/{CH}/messages/{mid}"); time.sleep(0.25)
print("deleted:", len(young), "recent +", len(old), "old")
