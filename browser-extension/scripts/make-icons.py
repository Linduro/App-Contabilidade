"""Recorta o Dr. Pitoco e gera ícones 16/48/128/512 para a extensão."""
from pathlib import Path

from PIL import Image

import os

ROOT = Path(__file__).resolve().parent.parent
ICONS = ROOT / "icons"


def find_source() -> Path:
    candidates = [
        ICONS / "dr-pitoco-source.png",
        ICONS / "icon-source.png",
        Path(os.environ["USERPROFILE"])
        / ".cursor"
        / "projects"
        / "c-Users-Notebook-Escrit-rio-licitacoes-advocacia"
        / "assets"
        / "icon-source.png",
    ]
    assets = (
        Path(os.environ["USERPROFILE"])
        / ".cursor"
        / "projects"
        / "c-Users-Notebook-Escrit-rio-licitacoes-advocacia"
        / "assets"
    )
    if assets.is_dir():
        candidates.extend(sorted(assets.glob("*.png")))
    for p in candidates:
        if p.is_file():
            return p
    raise FileNotFoundError("Coloque a foto em browser-extension/icons/dr-pitoco-source.png")


def bbox_non_black(im: Image.Image, threshold: int = 28):
    """Bounding box dos pixels não-pretos (cachorro + gravata)."""
    rgb = im.convert("RGB")
    w, h = rgb.size
    pixels = rgb.load()
    min_x, min_y, max_x, max_y = w, h, 0, 0
    found = False
    for y in range(h):
        for x in range(w):
            r, g, b = pixels[x, y]
            if r > threshold or g > threshold or b > threshold:
                found = True
                min_x = min(min_x, x)
                min_y = min(min_y, y)
                max_x = max(max_x, x)
                max_y = max(max_y, y)
    if not found:
        return (0, 0, w, h)
    return (min_x, min_y, max_x + 1, max_y + 1)


def crop_dog(im: Image.Image) -> Image.Image:
    w, h = im.size
    if w / max(h, 1) > 1.4:
        top_cut = int(h * 0.08)
        bottom_cut = int(h * 0.72)
        strip = im.crop((0, top_cut, w, bottom_cut))
    else:
        strip = im

    x0, y0, x1, y1 = bbox_non_black(strip, threshold=32)
    dog = strip.crop((x0, y0, x1, y1))

    dw, dh = dog.size
    side = int(max(dw, dh) * 1.08)
    square = Image.new("RGBA", (side, side), (0, 0, 0, 255))
    ox = (side - dw) // 2
    oy = (side - dh) // 2
    if dog.mode != "RGBA":
        dog = dog.convert("RGBA")
    square.paste(dog, (ox, oy))
    return square


def save_icons(square: Image.Image):
    ICONS.mkdir(parents=True, exist_ok=True)
    for size in (16, 48, 128, 512):
        out = square.resize((size, size), Image.Resampling.LANCZOS)
        out.save(ICONS / f"icon-{size}.png", optimize=True)
    square.save(ICONS / "icon-source.png", optimize=True)
    print(f"OK: {ICONS}")


def main():
    src = find_source()
    im = Image.open(src)
    print("source", src)
    print("original", im.size)
    cropped = crop_dog(im)
    print("cropped", cropped.size)
    save_icons(cropped)


if __name__ == "__main__":
    main()
