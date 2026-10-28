"""Block 7: installed as a package, the `redpencil` command works like review.py."""
import pathlib, shutil, subprocess, urllib.request

from conftest import HERE, free_port, up

ROOT = HERE.parent


def test_installed_command(tmp_path):
    subprocess.run(["uv", "build", "--wheel", "--out-dir", str(tmp_path / "dist"), str(ROOT)], check=True, capture_output=True)
    wheel = next((tmp_path / "dist").glob("redpencil-*.whl"))
    run = ["uvx", "--isolated", "--from", str(wheel), "redpencil"]
    assert "--site" in subprocess.run([*run, "--help"], capture_output=True, text=True, check=True).stdout
    shutil.copytree(HERE / "page", tmp_path / "page")
    port = free_port()
    p = subprocess.Popen([*run, str(tmp_path / "page"), "--port", str(port)], stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    try:
        url = f"http://127.0.0.1:{port}/"
        up(url + "__status", p)
        assert "/__review.js" in urllib.request.urlopen(url).read().decode()
        assert b"rv-side" in urllib.request.urlopen(url + "__review.js").read()
    finally:
        p.terminate()
        p.wait()
