"""Dataset audit: ``python -m ml.audit_dataset [--data-dir data/raw] [--metadata-csv ...]``.

Reports class counts, image sizes/modes, corrupt files, exact & near duplicates,
imbalance, invalid extensions and leakage indicators. Writes
``reports/dataset_audit/audit.json`` and ``class_distribution.png``.
"""

from __future__ import annotations

import argparse
import hashlib
import logging
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image, ImageOps

from ml.data.discovery import DatasetIndex, ImageRecord, discover_dataset
from ml.utils.paths import resolve_path, write_json

logger = logging.getLogger("ml.audit")
NEAR_DUP_HAMMING = 4  # bits (of 64) — conservative near-duplicate threshold


def average_hash(img: Image.Image, size: int = 8) -> int:
    g = np.asarray(ImageOps.exif_transpose(img).convert("L").resize((size, size), Image.Resampling.LANCZOS), dtype=np.float32)
    bits = (g > g.mean()).flatten()
    return int("".join("1" if b else "0" for b in bits), 2)


def hamming(a: int, b: int) -> int:
    return bin(a ^ b).count("1")


def inspect_image(rec: ImageRecord) -> dict[str, Any]:
    path = Path(rec.image_path)
    info: dict[str, Any] = {"path": str(path), "class": rec.class_name, "bytes": path.stat().st_size if path.exists() else 0}
    try:
        with open(path, "rb") as fh:
            data = fh.read()
        info["md5"] = hashlib.md5(data).hexdigest()  # noqa: S324 - duplicate detection, not security
        with Image.open(path) as im:
            im.verify()
        with Image.open(path) as im:
            im = ImageOps.exif_transpose(im) or im
            info.update({"width": im.size[0], "height": im.size[1], "mode": im.mode, "format": im.format})
            info["ahash"] = average_hash(im)
        info["ok"] = True
    except Exception as exc:  # corrupt / unreadable
        info.update({"ok": False, "error": f"{type(exc).__name__}: {exc}"})
    return info


def find_near_duplicates(items: list[dict[str, Any]], max_bits: int = NEAR_DUP_HAMMING) -> list[tuple[int, int, int]]:
    """Multi-index bucketing on 16-bit hash quarters: any pair within ``max_bits`` (<=4)
    shares at least one identical quarter, so we only compare within buckets."""
    buckets: dict[tuple[int, int], list[int]] = defaultdict(list)
    for i, it in enumerate(items):
        h = it["ahash"]
        for q in range(4):
            buckets[(q, (h >> (16 * q)) & 0xFFFF)].append(i)
    seen: set[tuple[int, int]] = set()
    pairs = []
    for members in buckets.values():
        if len(members) < 2 or len(members) > 2000:
            continue
        for a_i in range(len(members)):
            for b_i in range(a_i + 1, len(members)):
                a, b = members[a_i], members[b_i]
                key = (min(a, b), max(a, b))
                if key in seen:
                    continue
                seen.add(key)
                d = hamming(items[a]["ahash"], items[b]["ahash"])
                if d <= max_bits and items[a]["md5"] != items[b]["md5"]:
                    pairs.append((a, b, d))
    return pairs


def audit(index: DatasetIndex) -> dict[str, Any]:
    inspected = [inspect_image(r) for r in index.records]
    ok = [i for i in inspected if i.get("ok")]
    corrupt = [i for i in inspected if not i.get("ok")]
    counts = index.counts_per_class()

    widths = np.array([i["width"] for i in ok]) if ok else np.array([])
    heights = np.array([i["height"] for i in ok]) if ok else np.array([])
    modes = Counter(i["mode"] for i in ok)
    formats = Counter(i["format"] for i in ok)

    by_md5: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for i in ok:
        by_md5[i["md5"]].append(i)
    exact_dups = [{"md5": k, "files": [x["path"] for x in v], "classes": sorted({x["class"] for x in v})} for k, v in by_md5.items() if len(v) > 1]
    near_pairs = find_near_duplicates(ok)
    near_dups = [{"a": ok[a]["path"], "b": ok[b]["path"], "hamming": d, "cross_class": ok[a]["class"] != ok[b]["class"]} for a, b, d in near_pairs]

    min_c, max_c = (min(counts.values()), max(counts.values())) if counts else (0, 0)
    imbalance_ratio = (max_c / min_c) if min_c else None

    leakage: list[str] = []
    cross_exact = [d for d in exact_dups if len(d["classes"]) > 1]
    cross_near = [d for d in near_dups if d["cross_class"]]
    if cross_exact:
        leakage.append(f"{len(cross_exact)} identical file(s) appear under more than one class label")
    if cross_near:
        leakage.append(f"{len(cross_near)} near-duplicate pair(s) span different classes")
    if near_dups and not index.available_group_keys():
        leakage.append(
            f"{len(near_dups)} near-duplicate pair(s) found but no sample_id/batch_id metadata: "
            "photos of the same specimen may be split across train/test. Provide a metadata CSV with sample_id."
        )
    if "sample_id" in index.available_group_keys():
        sample_classes: dict[str, set[str]] = defaultdict(set)
        for r in index.records:
            sample_classes[r.sample_id or ""].add(r.class_name)
        multi = [s for s, c in sample_classes.items() if len(c) > 1]
        if multi:
            leakage.append(f"{len(multi)} sample_id value(s) are labelled with more than one class")

    warnings: list[str] = []
    if imbalance_ratio and imbalance_ratio > 3:
        warnings.append(f"Class imbalance ratio {imbalance_ratio:.1f}:1 — consider class weights or more data")
    small = [c for c, n in counts.items() if n < 50]
    if small:
        warnings.append(f"Classes with < 50 images: {small}")
    if len(modes) > 1:
        warnings.append(f"Mixed colour modes {dict(modes)} — all images are converted to RGB but check grayscale scans")
    if index.invalid_files:
        warnings.append(f"{len(index.invalid_files)} file(s) with unsupported extensions ignored")
    if corrupt:
        warnings.append(f"{len(corrupt)} corrupt/unreadable image(s) — remove them before training")

    return {
        "dataset_root": str(index.root),
        "num_classes": index.num_classes,
        "class_names": index.class_names,
        "total_images": len(index.records),
        "images_per_class": counts,
        "imbalance_ratio": imbalance_ratio,
        "group_metadata_available": index.available_group_keys(),
        "image_dimensions": {
            "width": {"min": int(widths.min()), "max": int(widths.max()), "mean": float(widths.mean())} if len(widths) else None,
            "height": {"min": int(heights.min()), "max": int(heights.max()), "mean": float(heights.mean())} if len(heights) else None,
            "unique_sizes": len({(i["width"], i["height"]) for i in ok}),
        },
        "color_modes": dict(modes),
        "formats": dict(formats),
        "file_size_bytes": {"min": int(min(i["bytes"] for i in ok)), "max": int(max(i["bytes"] for i in ok)), "total": int(sum(i["bytes"] for i in ok))}
        if ok
        else None,
        "corrupt_images": [{"path": c["path"], "error": c["error"]} for c in corrupt],
        "invalid_extension_files": index.invalid_files,
        "exact_duplicates": exact_dups,
        "near_duplicates": near_dups,
        "leakage_indicators": leakage,
        "warnings": warnings,
    }


def plot_class_distribution(counts: dict[str, int], path: Path) -> None:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    names = list(counts)
    fig, ax = plt.subplots(figsize=(max(6, 0.8 * len(names) + 3), 4))
    ax.bar(names, [counts[n] for n in names], color="#3b6e5c")
    ax.set_ylabel("images")
    ax.set_title("Class distribution")
    plt.setp(ax.get_xticklabels(), rotation=45, ha="right")
    fig.tight_layout()
    fig.savefig(path, dpi=150)
    plt.close(fig)


def print_summary(report: dict[str, Any]) -> None:
    print(f"\nDataset: {report['dataset_root']}")
    print(f"Classes ({report['num_classes']}): {', '.join(report['class_names'])}")
    print(f"Total images: {report['total_images']}")
    for c, n in report["images_per_class"].items():
        print(f"  {c:<30} {n}")
    if report["imbalance_ratio"]:
        print(f"Imbalance ratio (max/min): {report['imbalance_ratio']:.2f}")
    dims = report["image_dimensions"]
    if dims["width"]:
        print(f"Width  min/mean/max: {dims['width']['min']}/{dims['width']['mean']:.0f}/{dims['width']['max']}")
        print(f"Height min/mean/max: {dims['height']['min']}/{dims['height']['mean']:.0f}/{dims['height']['max']}")
    print(f"Colour modes: {report['color_modes']}  Formats: {report['formats']}")
    print(f"Corrupt: {len(report['corrupt_images'])}  Exact duplicates: {len(report['exact_duplicates'])}  Near duplicates: {len(report['near_duplicates'])}")
    print(f"Group metadata: {report['group_metadata_available'] or 'none (directory layout)'}")
    for w in report["warnings"]:
        print(f"WARNING: {w}")
    for w in report["leakage_indicators"]:
        print(f"LEAKAGE RISK: {w}")


def export_markdown_report(report: dict[str, Any], path: Path) -> None:
    lines = [
        "# Cotton Grade: Dataset Structural Audit Report",
        "",
        f"**Dataset Root**: `{report['dataset_root']}`  ",
        f"**Total Valid Images**: {report['total_images']}  ",
        f"**Number of Varieties / Classes**: {report['num_classes']}  ",
        f"**Group Metadata Columns**: `{report['group_metadata_available'] or 'None (Folder-based layout only)'}`  ",
        "",
        "## 1. Class Distribution & Imbalance",
        "",
        "| Variety / Class | Image Count | % of Dataset |",
        "| :--- | :---: | :---: |",
    ]
    tot = max(report['total_images'], 1)
    for c, n in report["images_per_class"].items():
        lines.append(f"| `{c}` | {n} | {(n / tot) * 100:.1f}% |")

    imb = report.get("imbalance_ratio")
    if imb:
        lines.extend(["", f"**Imbalance Ratio (Max / Min)**: `{imb:.2f}:1`"])

    lines.extend([
        "",
        "## 2. Image Geometry & Encoding",
        "",
    ])
    dims = report.get("image_dimensions") or {}
    w = dims.get("width")
    h = dims.get("height")
    if w and h:
        lines.extend([
            f"* **Width**: Min {w['min']}px, Mean {w['mean']:.1f}px, Max {w['max']}px",
            f"* **Height**: Min {h['min']}px, Mean {h['mean']:.1f}px, Max {h['max']}px",
            f"* **Unique Dimensions**: {dims.get('unique_sizes', 0)} distinct (width, height) pairs",
        ])
    lines.extend([
        f"* **Colour Modes**: `{report.get('color_modes')}`",
        f"* **File Formats**: `{report.get('formats')}`",
        "",
        "## 3. Data Hygiene & Anomaly Flags",
        "",
        f"* **Corrupt / Unreadable Images**: {len(report.get('corrupt_images', []))}",
        f"* **Exact Duplicate Files (Identical Hash)**: {len(report.get('exact_duplicates', []))}",
        f"* **Perceptual Near-Duplicates**: {len(report.get('near_duplicates', []))}",
        f"* **Files with Invalid Extensions**: {len(report.get('invalid_extension_files', []))}",
        "",
        "## 4. Specimen-Level Leakage Prevention & Academic Data Leakage",
        "",
    ])
    if report["group_metadata_available"]:
        lines.extend([
            "> [!NOTE]",
            "> Group metadata (e.g. `sample_id`) was detected. The dataset supports leakage-safe grouped splitting.",
        ])
    else:
        lines.extend([
            "> [!WARNING]",
            "> **FOLDER-BASED DATASET ONLY**: Without `sample_id` metadata linking multiple photos of the same physical cotton sample, specimen-level data leakage cannot be mathematically guaranteed. For scientific publication, provide a metadata CSV specifying `sample_id`.",
        ])

    leakage = report.get("leakage_indicators", [])
    if leakage:
        lines.extend(["", "### Critical Leakage Indicators Found:"])
        for item in leakage:
            lines.append(f"- 🔴 **LEAKAGE RISK**: {item}")
    else:
        lines.extend(["", "✅ No cross-class file or perceptual hash leakage detected."])

    warnings = report.get("warnings", [])
    if warnings:
        lines.extend(["", "### Advisory Warnings:"])
        for item in warnings:
            lines.append(f"- ⚠️ {item}")

    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return path


def export_csv_summary(report: dict[str, Any], path: Path) -> Path:
    import csv

    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        writer.writerow(["class_name", "image_count", "percent_of_dataset"])
        tot = max(report['total_images'], 1)
        for c, n in report["images_per_class"].items():
            writer.writerow([c, n, round((n / tot) * 100, 2)])
    return path



def run_audit(
    data_dir: str | Path = "data/raw",
    metadata_csv: str | Path | None = None,
    output_dir: str | Path = "reports/dataset_audit",
) -> dict[str, Any]:
    """Execute complete dataset audit and generate JSON, Markdown, CSV, and plot reports."""
    index = discover_dataset(resolve_path(data_dir), str(metadata_csv) if metadata_csv else None)
    report = audit(index)
    out = resolve_path(output_dir)
    out.mkdir(parents=True, exist_ok=True)
    write_json(out / "audit_report.json", report)
    export_markdown_report(report, out / "audit_report.md")
    export_csv_summary(report, out / "classes_summary.csv")
    plot_class_distribution(report["images_per_class"], out / "class_distribution.png")
    return report


def main(argv: list[str] | None = None) -> int:

    parser = argparse.ArgumentParser(description="Audit a Cotton Grade dataset")
    parser.add_argument("--data-dir", default="data/raw")
    parser.add_argument("--metadata-csv", default=None)
    parser.add_argument("--output-dir", default="reports/dataset_audit")
    args = parser.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

    try:
        index = discover_dataset(resolve_path(args.data_dir), args.metadata_csv)
    except (FileNotFoundError, ValueError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2
    report = audit(index)
    out = resolve_path(args.output_dir)
    out.mkdir(parents=True, exist_ok=True)
    write_json(out / "audit.json", report)
    export_markdown_report(report, out / "audit.md")
    export_csv_summary(report, out / "summary.csv")
    plot_class_distribution(report["images_per_class"], out / "class_distribution.png")
    print_summary(report)
    print(f"\nJSON report:     {out / 'audit.json'}")
    print(f"Markdown report: {out / 'audit.md'}")
    print(f"CSV summary:     {out / 'summary.csv'}")
    print(f"Chart:           {out / 'class_distribution.png'}")
    return 1 if report["corrupt_images"] or report["leakage_indicators"] else 0


if __name__ == "__main__":
    sys.exit(main())
