# take-2 frames -> WebP for the site, plus the anchors
import glob, json, os
from PIL import Image
SRC, DST = "/root/render/f2", "/home/user/nextclick-saas/yeppo-oracle/public/film2"
os.makedirs(DST, exist_ok=True)
tot = 0
for p in sorted(glob.glob(f"{SRC}/[is]*.png")):
    name = os.path.basename(p)[:-4]
    Image.open(p).convert("RGB").save(f"{DST}/{name}.webp", "WEBP", quality=76, method=6)
    tot += os.path.getsize(f"{DST}/{name}.webp")
anch = {}
for j in glob.glob(f"{SRC}/anchors_scroll_*.json"):
    anch.update(json.load(open(j)))
json.dump(anch, open(f"{DST}/anchors.json", "w"), separators=(",", ":"))
print(round(tot / 1e6, 2), "MB;", len(anch), "anchor frames")
