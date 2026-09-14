"""CLI entrypoint for activating a registered Cotton Grade model: ``python -m ml.activate_model --name <model_name>``.

Validates the model artifact before activation and updates ``models/registry.json``.
"""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

from ml.registry import ModelRegistry
from ml.validate_artifact import validate_artifact

logger = logging.getLogger("ml.activate_model")


def activate_model(
    name: str,
    registry_path: str | Path | None = None,
    validate: bool = True,
    device: str = "cpu",
) -> int:
    registry = ModelRegistry(registry_path)
    entry = registry.get(name)
    if not entry:
        print(f"ERROR: Model '{name}' does not exist in registry at {registry.path}", file=sys.stderr)
        print(f"Available models: {registry.names() or 'none'}", file=sys.stderr)
        return 1

    if validate:
        print(f"Validating model artifact '{name}' before activation...")
        report = validate_artifact(model_name=name, registry_path=registry_path, device=device)
        if not report.is_valid:
            print(f"ERROR: Validation failed for model '{name}':", file=sys.stderr)
            for err in report.errors:
                print(f"  - 🔴 {err}", file=sys.stderr)
            return 1
        print(f"✅ Validation passed for '{name}'. Architecture: {entry.architecture}, Classes: {len(entry.class_names)}")
    else:
        print(f"⚠️ Skipping validation for '{name}' as requested.")

    registry.set_active(name)
    registry.save()
    print(f"🚀 Successfully activated model '{name}' (version {entry.version})")
    print(f"Active model in {registry.path}: {registry.active_model}")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Validate and activate a registered model in Cotton Grade")
    parser.add_argument("--name", required=True, help="Name of registered model to activate")
    parser.add_argument("--registry", default=None, help="Path to registry.json (default: models/registry.json)")
    parser.add_argument("--skip-validation", action="store_true", help="Skip artifact pre-activation validation")
    parser.add_argument("--device", default="cpu", help="Device for validation test inference (default: cpu)")
    args = parser.parse_args(argv)

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    return activate_model(
        name=args.name,
        registry_path=args.registry,
        validate=not args.skip_validation,
        device=args.device,
    )


if __name__ == "__main__":
    sys.exit(main())
