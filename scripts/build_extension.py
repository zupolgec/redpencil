"""Builds the Chrome Web Store zip of the extension: review.js copied from src/ (no links),
the version taken from pyproject.toml. Usage: python -I scripts/build_extension.py [out dir]"""
import json, pathlib, sys, tomllib, zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
EXT = ROOT / "extension"
out = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ROOT / "dist")
version = tomllib.loads((ROOT / "pyproject.toml").read_text())["project"]["version"]
manifest = json.loads((EXT / "manifest.json").read_text())
manifest["version"] = version
out.mkdir(parents=True, exist_ok=True)
zip_path = out / f"redpencil-extension-{version}.zip"
with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as z:
    z.writestr("manifest.json", json.dumps(manifest, indent=2))
    for f in sorted(EXT.rglob("*")):
        rel = f.relative_to(EXT)
        if f.is_dir() or rel.name == "manifest.json" or any(p.startswith(".") for p in rel.parts) or f.suffix == ".svg":
            continue
        z.writestr(str(rel), f.resolve().read_bytes())  # resolve(): the link to src/review.js becomes a file
print(zip_path)
