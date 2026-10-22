"""Draws the app icons in src/site/icons: a gold film reel on the app's dark background."""
import math
from pathlib import Path
from PIL import Image, ImageDraw

BG, REEL = (20, 24, 28), (230, 182, 90)
OUT = Path(__file__).resolve().parent.parent / "src" / "site" / "icons"


def reel(size, scale):
    """scale is the reel's diameter as a share of the icon; maskable icons keep it inside the safe zone."""
    s = size * 4  # draw large, then shrink, for smooth edges
    img = Image.new("RGB", (s, s), BG)
    d = ImageDraw.Draw(img)
    c, r = s / 2, s * scale / 2
    d.ellipse((c - r, c - r, c + r, c + r), fill=REEL)
    hole, ring = r * 0.2, r * 0.56
    for i in range(6):
        a = math.radians(90 + i * 60)
        x, y = c + ring * math.cos(a), c - ring * math.sin(a)
        d.ellipse((x - hole, y - hole, x + hole, y + hole), fill=BG)
    hub = r * 0.1
    d.ellipse((c - hub, c - hub, c + hub, c + hub), fill=BG)
    return img.resize((size, size), Image.LANCZOS)


OUT.mkdir(parents=True, exist_ok=True)
reel(192, 0.72).save(OUT / "icon-192.png")
reel(512, 0.72).save(OUT / "icon-512.png")
reel(512, 0.56).save(OUT / "icon-maskable-512.png")
reel(180, 0.68).save(OUT / "apple-touch-icon.png")
print("wrote", sorted(p.name for p in OUT.iterdir()))
