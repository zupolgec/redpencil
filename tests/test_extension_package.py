"""The extension as it goes to the Chrome Web Store: one zip, no links, its icons, the package's version;
loaded in Chrome it works like the folder."""
import json, subprocess, sys, tomllib, zipfile

from playwright.sync_api import expect

from conftest import HERE, SRC, Site

ROOT = HERE.parent


def test_extension_zip(tmp_path, pw):
    subprocess.run([sys.executable, "-I", str(ROOT / "scripts" / "build_extension.py"), str(tmp_path / "dist")],
                   check=True, capture_output=True)
    version = tomllib.loads((ROOT / "pyproject.toml").read_text())["project"]["version"]
    z = zipfile.ZipFile(tmp_path / "dist" / f"redpencil-extension-{version}.zip")
    names = z.namelist()
    m = json.loads(z.read("manifest.json"))
    assert m["version"] == version and m["name"] == "redpencil"
    assert all(path in names for path in m["icons"].values()) and m["action"]["default_icon"] == m["icons"]
    assert z.read("review.js") == (SRC / "review.js").read_bytes()
    assert not any(n.startswith(".") or "/." in n for n in names)
    ext = tmp_path / "unpacked"
    z.extractall(ext)
    m["host_permissions"] += m.pop("optional_host_permissions")  # as after accepting the prompt
    (ext / "manifest.json").write_text(json.dumps(m))
    ctx = pw.chromium.launch_persistent_context(
        str(tmp_path / "profile"), channel="chromium", headless=True,
        args=[f"--disable-extensions-except={ext}", f"--load-extension={ext}"])
    s = Site(tmp_path)
    try:
        sw = ctx.service_workers[0] if ctx.service_workers else ctx.wait_for_event("serviceworker")
        sw.evaluate("o => enable(o)", s.site.rstrip("/"))
        page = ctx.new_page()
        page.goto(s.site)
        expect(page.locator("#rv-side")).to_be_visible(timeout=5000)
    finally:
        s.stop()
        ctx.close()
