"""Illustrated placeholder photos for the demo scenario (no faces, no plates). Real photos can replace them.
Run: uv run --no-project --with pillow python scripts/gen-placeholder-photos.py
Writes supabase/seed/photos/{report,proof}-<category>.png; upload with `npm run demo:reset`."""

from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parents[1] / "supabase/seed/photos"
W, H = 800, 600
BLUE, WATER, PIPE = "#2f6f9f", "#6fa8d6", "#5f6f7a"


def street(d):
    d.rectangle([0, 0, W, 330], fill="#bfe0ee")
    for x, h, c in [(20, 170, "#e8c9a0"), (190, 220, "#d9b38c"), (560, 190, "#e3cfae"), (680, 240, "#cfa57d")]:
        d.rectangle([x, 330 - h, x + 140, 330], fill=c)
        for wy in range(330 - h + 20, 310, 45):
            d.rectangle([x + 20, wy, x + 50, wy + 25], fill="#7a9cb0")
            d.rectangle([x + 85, wy, x + 115, wy + 25], fill="#7a9cb0")
    d.rectangle([0, 330, W, H], fill="#9a9a94")
    d.rectangle([0, 330, W, 360], fill="#c9c3b5")
    for x in range(30, W, 120):
        d.rectangle([x, 470, x + 60, 478], fill="#f2f0e6")


def issue(d, cat, fixed):
    if cat == "water_leak":
        d.rectangle([0, 395, W, 415], fill=PIPE)
        if not fixed:
            d.ellipse([280, 420, 560, 520], fill=WATER)
            for i in range(6):
                d.line([400, 400, 360 + i * 18, 340], fill="#8cc4ee", width=6)
    elif cat == "no_water_supply":
        d.rectangle([340, 250, 380, 400], fill=PIPE)
        d.rectangle([380, 250, 440, 270], fill=PIPE)
        if fixed:
            d.line([430, 272, 430, 360], fill=WATER, width=10)
        for x in (300, 470):
            d.rectangle([x, 360, x + 50, 420], outline=BLUE, width=6, fill=WATER if fixed else None)
    elif cat == "garbage_not_collected":
        d.rectangle([90, 340, 190, 440], fill="#3d7a4f")
        if not fixed:
            for i, c in enumerate(["#7c5a3a", "#c0392b", "#556b2f", "#8e6e53", "#d4a017"]):
                d.ellipse([200 + i * 40, 380 - i % 2 * 25, 300 + i * 40, 450], fill=c)
    elif cat == "streetlight_out":
        if not fixed:
            d.rectangle([0, 0, W, 330], fill="#1f2a44a0")  # dusk, lamp dark
        d.rectangle([380, 120, 392, 360], fill="#4a4a4a")
        d.rectangle([392, 120, 470, 132], fill="#4a4a4a")
        d.ellipse([450, 128, 490, 152], fill="#ffe680" if fixed else "#555")
        if fixed:
            d.polygon([(470, 150), (400, 360), (560, 360)], fill="#fff3b080")
    elif cat == "pothole":
        d.ellipse([280, 420, 520, 520], fill="#6e6e69" if fixed else "#4b4740")
        if not fixed:
            d.ellipse([310, 440, 490, 505], fill="#2f2c28")
    elif cat == "drainage_overflow":
        d.rectangle([340, 370, 460, 395], fill="#3a3a3a")
        for x in range(345, 460, 18):
            d.line([x, 372, x, 393], fill="#777", width=4)
        if not fixed:
            d.ellipse([220, 380, 600, 560], fill="#6b7a55c0")
    elif cat == "stray_animals":
        for i in range(0 if fixed else 3):  # dog silhouettes
            x = 220 + i * 150
            d.ellipse([x, 420, x + 90, 470], fill="#8b5a2b")
            d.ellipse([x + 70, 395, x + 115, 435], fill="#8b5a2b")
            for lx in (x + 10, x + 70):
                d.rectangle([lx, 460, lx + 10, 500], fill="#8b5a2b")
    elif not fixed:  # other: fallen branch
        d.line([200, 300, 520, 420], fill="#5b3a1e", width=18)


def caption(d, fixed):
    d.rectangle([0, H - 44, W, H], fill="#00000099")
    d.text((16, H - 30), "Placeholder illustration - fictional Navnagar", fill="white")
    if fixed:
        d.ellipse([W - 110, 20, W - 20, 110], fill="#2e7d32")
        d.line([(W - 92, 66), (W - 70, 88), (W - 38, 44)], fill="white", width=10)


CATS = ["water_leak", "no_water_supply", "garbage_not_collected", "streetlight_out", "pothole",
        "drainage_overflow", "stray_animals", "other"]
OUT.mkdir(parents=True, exist_ok=True)
for cat in CATS:
    for kind in ("report", "proof"):
        img = Image.new("RGB", (W, H))
        d = ImageDraw.Draw(img, "RGBA")
        street(d)
        issue(d, cat, kind == "proof")
        caption(d, kind == "proof")
        img.save(OUT / f"{kind}-{cat}.png", optimize=True)
print("wrote", len(CATS) * 2, "files to", OUT)
