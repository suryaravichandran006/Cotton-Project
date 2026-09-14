"""Generate synthetic, clearly-labelled placeholder images for development/testing.

    python scripts/make_sample_images.py [--out data/samples] [--count 4]

These are procedurally drawn fibre-like textures, NOT photographs of cotton and
NOT training data. They exist only so the upload -> predict -> history flow can
be exercised (and e2e tests can run) before real images are available.
"""

from __future__ import annotations

import argparse
import csv
import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


def draw_fibre_texture(size: int, seed: int, label_text: str | None = None) -> Image.Image:
    rng = random.Random(seed)
    base = 235 + rng.randint(-8, 8)
    img = Image.new("RGB", (size, size), (base, base - 2, base - 8))
    draw = ImageDraw.Draw(img)
    for _ in range(900):
        x, y = rng.uniform(0, size), rng.uniform(0, size)
        angle = rng.uniform(0, math.pi)
        length = rng.uniform(size * 0.05, size * 0.35)
        curve = rng.uniform(-0.6, 0.6)
        shade = rng.randint(150, 225)
        pts = []
        for t in range(12):
            f = t / 11
            a = angle + curve * f
            pts.append((x + math.cos(a) * length * f, y + math.sin(a) * length * f))
        draw.line(pts, fill=(shade, shade - 3, shade - 10), width=rng.choice([1, 1, 2]))
    img = img.filter(ImageFilter.GaussianBlur(0.6))
    draw = ImageDraw.Draw(img)
    label = label_text or f"SYNTHETIC SAMPLE #{seed} - NOT REAL COTTON"
    draw.rectangle([(8, size - 30), (8 + 7 * len(label), size - 8)], fill=(30, 30, 30))
    draw.text((14, size - 26), label, fill=(255, 255, 255))
    return img


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--out", default="data/samples")
    p.add_argument("--count", type=int, default=4)
    p.add_argument("--size", type=int, default=512)
    p.add_argument("--hero-out", default="frontend/public/images/cotton-fibre-hero.jpg")
    p.add_argument("--public-samples-dir", default="frontend/public/images/samples")
    args = p.parse_args()

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    # 1. Flat sample images in data/samples
    for i in range(1, args.count + 1):
        img = draw_fibre_texture(args.size, i)
        fmt = ["png", "jpg", "webp"][i % 3]
        path = out / f"synthetic_sample_{i:02d}.{fmt}"
        img.save(path, quality=92)
        print(f"wrote {path}")

    # 2. Class sub-directories in data/samples for auditing and demonstration
    demo_classes = ["Giza_86", "Giza_87", "Giza_90", "Giza_94", "Giza_96"]
    meta_rows = []
    seed_counter = 100
    for cls_name in demo_classes:
        cls_dir = out / cls_name
        cls_dir.mkdir(parents=True, exist_ok=True)
        for j in range(1, 4):
            seed_counter += 1
            sample_id = f"sample_{cls_name.lower()}_{j:02d}"
            img = draw_fibre_texture(args.size, seed_counter, f"DEMO {cls_name} #{j}")
            img_filename = f"{sample_id}.jpg"
            img_path = cls_dir / img_filename
            img.save(img_path, quality=92)
            meta_rows.append(
                {
                    "image_path": f"{cls_name}/{img_filename}",
                    "class_name": cls_name,
                    "sample_id": sample_id,
                    "batch_id": "demo_batch_01",
                    "source": "synthetic_generator",
                    "capture_device": "procedural_pil",
                }
            )
    print(f"wrote demo class folders for {len(demo_classes)} classes in {out}")

    # Write metadata.csv in data/samples
    meta_csv = out / "metadata.csv"
    with open(meta_csv, "w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(
            fh,
            fieldnames=["image_path", "class_name", "sample_id", "batch_id", "source", "capture_device"],
        )
        writer.writeheader()
        writer.writerows(meta_rows)
    print(f"wrote demo metadata: {meta_csv}")

    # 3. Hero image for frontend
    hero_path = Path(args.hero_out)
    hero_path.parent.mkdir(parents=True, exist_ok=True)
    hero_img = draw_fibre_texture(1200, seed=42, label_text="Cotton Grade Synthetic Demo Hero")
    hero_img.save(hero_path, quality=95)
    print(f"wrote hero visual: {hero_path}")

    # 4. Frontend public samples for gallery/demo
    pub_samples = Path(args.public_samples_dir)
    pub_samples.mkdir(parents=True, exist_ok=True)
    for i in range(1, 5):
        sample_img = draw_fibre_texture(args.size, 200 + i, f"Gallery Synthetic Sample #{i}")
        s_path = pub_samples / f"sample_{i}.jpg"
        sample_img.save(s_path, quality=92)
        print(f"wrote public sample visual: {s_path}")


if __name__ == "__main__":
    main()
