"""Manage ``models/registry.json``.

python -m ml.register_model --export-dir models/exports/convnext_tiny_v1 --activate
python -m ml.register_model --list
python -m ml.register_model --set-active convnext_tiny_v1
python -m ml.register_model --remove old_model
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from ml.registry import ModelEntry, ModelRegistry
from ml.utils.paths import read_json, resolve_path


def register_export(
    export_dir: Path,
    activate: bool,
    registry_path: str | None,
    unknown_threshold: float | None,
    replace: bool = True,
    validate: bool = True,
) -> ModelEntry:
    """Read ``metadata.json`` produced by ``ml.export_model`` and add it to the registry."""
    meta_path = Path(export_dir) / "metadata.json"
    if not meta_path.is_file():
        raise FileNotFoundError(f"{meta_path} not found — run `python -m ml.export_model` first")

    if validate and activate:
        from ml.validate_artifact import validate_artifact

        report = validate_artifact(artifact_dir=export_dir, registry_path=registry_path)
        if not report.is_valid:
            err_msg = "; ".join(report.errors)
            raise ValueError(f"Artifact validation failed for {export_dir}: {err_msg}")

    meta = read_json(meta_path)
    entry = ModelEntry.from_dict(meta)
    entry.registered_at = datetime.now(timezone.utc).isoformat()
    if unknown_threshold is not None:
        entry.ood = {"strategy": "confidence_threshold", "threshold": float(unknown_threshold)}
    registry = ModelRegistry(registry_path)
    registry.add(entry, replace=replace)
    if activate or registry.active_model is None:
        registry.set_active(entry.name)
    registry.save()
    print(f"Registered '{entry.name}' v{entry.version} ({entry.architecture}, {len(entry.class_names)} classes). Active: {registry.active_model}")
    return entry


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Manage the Cotton Grade model registry")
    p.add_argument("--registry", default=None, help="Path to registry.json (default models/registry.json)")
    p.add_argument("--export-dir", default=None, help="models/exports/<name> directory to register")
    p.add_argument("--activate", action="store_true")
    p.add_argument("--unknown-threshold", type=float, default=None)
    p.add_argument("--set-active", default=None)
    p.add_argument("--skip-validation", action="store_true", help="Skip artifact validation before activation")
    p.add_argument("--remove", default=None)
    p.add_argument("--list", action="store_true")
    args = p.parse_args(argv)

    if args.export_dir:
        register_export(
            resolve_path(args.export_dir),
            args.activate,
            args.registry,
            args.unknown_threshold,
            validate=not args.skip_validation,
        )
    registry = ModelRegistry(args.registry)
    if args.set_active:
        if not args.skip_validation:
            from ml.validate_artifact import validate_artifact

            report = validate_artifact(model_name=args.set_active, registry_path=args.registry)
            if not report.is_valid:
                print(f"ERROR: Cannot activate '{args.set_active}' - validation failed: {report.errors}", file=sys.stderr)
                return 1
        registry.set_active(args.set_active)
        registry.save()
        print(f"Active model: {registry.active_model}")

    if args.remove:
        registry.remove(args.remove)
        registry.save()
        print(f"Removed '{args.remove}'. Active model: {registry.active_model}")
    if args.list or not (args.export_dir or args.set_active or args.remove):
        print(
            json.dumps(
                {
                    "registry": str(registry.path),
                    "active_model": registry.active_model,
                    "models": [
                        {"name": m.name, "version": m.version, "architecture": m.architecture, "classes": len(m.class_names), "checkpoint": m.checkpoint}
                        for m in registry.models
                    ],
                },
                indent=2,
            )
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
