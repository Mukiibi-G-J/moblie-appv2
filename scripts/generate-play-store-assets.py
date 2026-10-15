#!/usr/bin/env python3
"""
Generate Google Play listing images from repo logos.

Outputs under store-listing/ (gitignored recommended — add path if you commit assets).

Feature graphic: 1024 x 500 PNG (Play requirement).

Screenshot-sized panels: brand background + logo. Replace with real device
screenshots before publishing; Play expects UI that reflects the app.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
LOGO_COLOR = ROOT / "src" / "assets" / "images" / "logo.png"
LOGO_WHITE = ROOT / "src" / "assets" / "images" / "logo-white.png"
OUT_DIR = ROOT / "store-listing"


def _linear_gradient_rgba(
    size: tuple[int, int],
    top_left: tuple[int, int, int, int],
    bottom_right: tuple[int, int, int, int],
) -> Image.Image:
    w, h = size
    y = np.linspace(0.0, 1.0, h, dtype=np.float32)[:, None]
    x = np.linspace(0.0, 1.0, w, dtype=np.float32)[None, :]
    t = ((x + y) / 2.0)[..., None]
    c0 = np.array(top_left, dtype=np.float32)
    c1 = np.array(bottom_right, dtype=np.float32)
    arr = np.clip(c0 + (c1 - c0) * t, 0, 255).astype(np.uint8)
    return Image.fromarray(arr, "RGBA")


def _fit_logo(logo: Image.Image, max_w: int, max_h: int) -> Image.Image:
    lw, lh = logo.size
    scale = min(max_w / lw, max_h / lh, 1.0)
    nw, nh = max(1, int(lw * scale)), max(1, int(lh * scale))
    return logo.resize((nw, nh), Image.Resampling.LANCZOS)


def _paste_center(canvas: Image.Image, layer: Image.Image) -> None:
    cw, ch = canvas.size
    lw, lh = layer.size
    x = (cw - lw) // 2
    y = (ch - lh) // 2
    canvas.alpha_composite(layer, (x, y))


def load_logo_white_cropped() -> Image.Image:
    """Use tight crop of logo-white (source has large transparent margins)."""
    im = Image.open(LOGO_WHITE).convert("RGBA")
    alpha = im.split()[3]
    bbox = alpha.getbbox()
    if not bbox:
        return im
    return im.crop(bbox)


def make_feature_graphic() -> Image.Image:
    w, h = 1024, 500
    bg = _linear_gradient_rgba(
        (w, h),
        (10, 22, 40, 255),
        (20, 40, 95, 255),
    )
    # Subtle vignette
    vignette = Image.new("L", (w, h), 0)
    vd = ImageDraw.Draw(vignette)
    margin = 40
    vd.rounded_rectangle(
        (margin, margin, w - margin, h - margin),
        radius=48,
        fill=200,
    )
    vignette = vignette.filter(ImageFilter.GaussianBlur(28))
    vcol = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    vpix = vcol.load()
    for y in range(h):
        for x in range(w):
            t = vignette.getpixel((x, y))
            # lighten center slightly
            vpix[x, y] = (255, 255, 255, int((255 - t) * 0.08))
    bg = Image.alpha_composite(bg, vcol)

    logo = load_logo_white_cropped()
    logo = _fit_logo(logo, int(w * 0.78), int(h * 0.62))
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    _paste_center(layer, logo)
    out = Image.alpha_composite(bg, layer)
    return out.convert("RGB")


def make_branded_panel(size: tuple[int, int], light: bool = False) -> Image.Image:
    w, h = size
    if light:
        bg = _linear_gradient_rgba(
            (w, h),
            (240, 248, 255, 255),
            (200, 220, 245, 255),
        )
        logo = Image.open(LOGO_COLOR).convert("RGBA")
    else:
        bg = _linear_gradient_rgba(
            (w, h),
            (8, 18, 36, 255),
            (25, 55, 120, 255),
        )
        logo = load_logo_white_cropped()

    logo = _fit_logo(logo, int(w * 0.72), int(h * 0.22))
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    _paste_center(layer, logo)
    out = Image.alpha_composite(bg, layer)
    return out.convert("RGB")


def main() -> None:
    p = argparse.ArgumentParser(description="Generate Play Store assets from logos.")
    p.add_argument(
        "--out",
        type=Path,
        default=OUT_DIR,
        help="Output directory (default: store-listing/)",
    )
    p.add_argument(
        "--feature-only",
        action="store_true",
        help="Only write the 1024x500 feature graphic.",
    )
    args = p.parse_args()
    out: Path = args.out
    out.mkdir(parents=True, exist_ok=True)

    fg = make_feature_graphic()
    fg_path = out / "feature-graphic-1024x500.png"
    fg.save(fg_path, "PNG", optimize=True)
    print(f"Wrote {fg_path} ({fg.size[0]}x{fg.size[1]})")

    if args.feature_only:
        return

    phone_dir = out / "phone-1080x1920"
    phone_dir.mkdir(parents=True, exist_ok=True)
    for i in range(1, 5):
        panel = make_branded_panel((1080, 1920), light=(i % 2 == 0))
        panel.save(phone_dir / f"branded-panel-{i:02d}.png", "PNG", optimize=True)
    print(f"Wrote 4 panels to {phone_dir}/ (replace with real screenshots)")

    t7 = out / "tablet-7in-1440x2560"
    t7.mkdir(parents=True, exist_ok=True)
    for i in range(1, 5):
        panel = make_branded_panel((1440, 2560), light=False)
        panel.save(t7 / f"branded-panel-{i:02d}.png", "PNG", optimize=True)
    print(f"Wrote 4 panels to {t7}/")

    # 9:16, both sides >= 1080 (Play 10" tablet rules)
    t10 = out / "tablet-10in-1440x2560"
    t10.mkdir(parents=True, exist_ok=True)
    for i in range(1, 5):
        panel = make_branded_panel((1440, 2560), light=(i % 2 == 1))
        panel.save(t10 / f"branded-panel-{i:02d}.png", "PNG", optimize=True)
    print(f"Wrote 4 panels to {t10}/")

    cb = out / "chromebook-1920x1080"
    cb.mkdir(parents=True, exist_ok=True)
    for i in range(1, 5):
        panel = make_branded_panel((1920, 1080), light=True)
        panel.save(cb / f"branded-panel-{i:02d}.png", "PNG", optimize=True)
    print(f"Wrote 4 panels to {cb}/")

    xr = out / "android-xr-1920x1080"
    xr.mkdir(parents=True, exist_ok=True)
    for i in range(1, 5):
        panel = make_branded_panel((1920, 1080), light=False)
        panel.save(xr / f"branded-panel-{i:02d}.png", "PNG", optimize=True)
    print(f"Wrote 4 panels to {xr}/")


if __name__ == "__main__":
    main()
