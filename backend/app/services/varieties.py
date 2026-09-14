"""Cotton variety information lookup (config/varieties.yaml). Decorative only — never defines classes."""

from __future__ import annotations

import logging
import re
from pathlib import Path

import yaml

from backend.app.schemas import VarietyInfo

logger = logging.getLogger("backend.varieties")


def normalize_key(name: str) -> str:
    return re.sub(r"[\s_\-]+", "", name).lower()


def humanize(class_name: str) -> str:
    return re.sub(r"[_]+", " ", class_name).strip()


class VarietyCatalog:
    def __init__(self, path: Path) -> None:
        self.path = path
        self._by_key: dict[str, VarietyInfo] = {}
        self.reload()

    def reload(self) -> None:
        self._by_key.clear()
        # Look for data/metadata/varieties.json first, then self.path (config/varieties.yaml)
        candidate_paths = [self.path]
        repo_root = self.path.parent.parent if self.path.is_absolute() else Path(".")
        json_meta = repo_root / "data" / "metadata" / "varieties.json"
        if json_meta.exists():
            candidate_paths.insert(0, json_meta)

        loaded_any = False
        for p in candidate_paths:
            if not p.exists():
                continue
            try:
                if p.suffix == ".json":
                    import json
                    with open(p, encoding="utf-8") as fh:
                        data = json.load(fh)
                else:
                    with open(p, encoding="utf-8") as fh:
                        data = yaml.safe_load(fh) or {}
                for raw in data.get("varieties", []) or []:
                    c_name = str(raw.get("class_id") or raw.get("class_name"))
                    info = VarietyInfo(
                        class_name=c_name,
                        display_name=str(raw.get("display_name") or humanize(c_name)),
                        scientific_name=raw.get("scientific_name"),
                        designation=raw.get("designation"),
                        region=raw.get("region"),
                        staple_category=raw.get("staple_category"),
                        staple_length_mm=float(raw["staple_length_mm"]) if raw.get("staple_length_mm") is not None else None,
                        micronaire=float(raw["micronaire"]) if raw.get("micronaire") is not None else None,
                        strength_g_tex=float(raw["strength_g_tex"]) if raw.get("strength_g_tex") is not None else None,
                        description=raw.get("description"),
                        source=raw.get("source"),
                        characteristics=[str(c) for c in (raw.get("characteristics") or [])],
                        notes=raw.get("notes"),
                        demo_placeholder=bool(raw.get("demo_placeholder", False)),
                        has_info=True,
                    )
                    norm_k = normalize_key(info.class_name)
                    if norm_k not in self._by_key:
                        self._by_key[norm_k] = info
                loaded_any = True
                break
            except Exception as exc:
                logger.warning("Failed loading varieties from %s: %s", p, exc)

        if not loaded_any:
            logger.info("Varieties metadata file not found; class names will be shown without extra info")

    def all_class_names(self) -> list[str]:
        return [v.class_name for v in self._by_key.values()]

    def lookup(self, class_name: str) -> VarietyInfo | None:
        return self._by_key.get(normalize_key(class_name))

    def display_name(self, class_name: str) -> str:
        info = self.lookup(class_name)
        return info.display_name if info else humanize(class_name)

    def describe(self, class_name: str) -> VarietyInfo:
        """Always returns something renderable; ``has_info=False`` when no entry exists."""
        return self.lookup(class_name) or VarietyInfo(class_name=class_name, display_name=humanize(class_name), has_info=False)
