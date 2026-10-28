"""Records the README gif: a comment on a page, ▷, the agent fixes it while the page updates.
Headless Chromium and the tests' fake agent. Usage:
  uv run --no-project --with playwright python -I scripts/record_demo.py docs/img/demo.gif"""
import json, os, pathlib, shutil, socket, subprocess, sys, tempfile, time, urllib.request

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
out = pathlib.Path(sys.argv[1]).resolve()
PAGE = """<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Bianchi Bakery</title>
<style>body{font:18px/1.6 Georgia,serif;margin:0;background:#faf7f2;color:#2b2620}
header{padding:18px 48px;border-bottom:1px solid #e7dfd3;font-weight:bold}main{max-width:620px;padding:40px 48px}
h1{font-size:44px;line-height:1.15;margin:0 0 18px}.hours{background:#fff;border:1px solid #e7dfd3;border-radius:10px;padding:14px 20px}</style>
</head><body><header>Bianchi Bakery</header><main>
<h1 id="title">Bread, focaccia and pastries, baked fresh every single morning since 1962</h1>
<p>Stone-ground flour and sourdough, from our oven to your table.</p>
<div class="hours"><b>Opening hours</b><br>Monday to Saturday, 7am to 1pm and 4pm to 7:30pm.</div>
</main></body></html>"""

with tempfile.TemporaryDirectory() as tmp:
    tmp = pathlib.Path(tmp)
    site = tmp / "bakery"
    site.mkdir()
    (site / "index.html").write_text(PAGE)
    (site / ".review").mkdir()
    (site / ".review" / "script.json").write_text(json.dumps([
        {"wait": 2}, {"replace": ["index.html", "Bread, focaccia and pastries, baked fresh every single morning since 1962",
                                  "Fresh bread every morning since 1962"]},
        {"wait": 1}, {"outcome": ["@ID", "done", "Shortened the title to six words."]}]))
    s = socket.socket(); s.bind(("127.0.0.1", 0)); port = s.getsockname()[1]; s.close()
    env = dict(os.environ, REVIEW_AGENT=f"{sys.executable} -I {ROOT / 'tests' / 'fake_agent.py'}")
    srv = subprocess.Popen([sys.executable, "-I", str(ROOT / "src" / "review.py"), str(site), "--port", str(port), "--agent"],
                           env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    url = f"http://127.0.0.1:{port}/"
    for _ in range(50):
        try:
            urllib.request.urlopen(url + "__status"); break
        except OSError:
            time.sleep(0.1)
    try:
        with sync_playwright() as p:
            b = p.chromium.launch()
            ctx = b.new_context(viewport={"width": 1100, "height": 620}, record_video_dir=str(tmp / "video"),
                                record_video_size={"width": 1100, "height": 620})
            page = ctx.new_page()
            page.goto(url)
            page.wait_for_selector("#rv-side")
            page.wait_for_timeout(1200)
            h1 = page.locator("#title").bounding_box()
            page.mouse.move(h1["x"] + 200, h1["y"] + 30, steps=15)
            page.wait_for_timeout(400)
            page.mouse.click(h1["x"] + 200, h1["y"] + 30, button="right")
            page.wait_for_selector("#rv-dlg textarea")
            page.wait_for_timeout(500)
            page.locator("#rv-dlg textarea").press_sequentially("Too long, keep it to a few words", delay=55)
            page.wait_for_timeout(500)
            page.locator("#rv-dlg textarea").press("Enter")
            page.wait_for_timeout(800)
            cid = json.loads((site / ".review" / "comments.json").read_text())[0]["id"]
            f = site / ".review" / "script.json"
            f.write_text(f.read_text().replace("@ID", cid))
            run = page.locator("#rv-run").bounding_box()
            page.mouse.move(run["x"] + 15, run["y"] + 15, steps=20)
            page.wait_for_timeout(300)
            page.locator("#rv-run").click()
            page.wait_for_function("() => document.querySelector('#title').textContent.startsWith('Fresh')", timeout=15000)
            page.wait_for_selector("#rv-items .it .ans:not([hidden]), #rv-items .done", timeout=15000)
            page.wait_for_timeout(2500)
            video = page.video.path()
            ctx.close()
            b.close()
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(video), "-vf",
                        "fps=12,scale=880:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse=dither=bayer:bayer_scale=4",
                        str(out)], check=True)
        print(out, f"{out.stat().st_size // 1024} KB")
    finally:
        srv.terminate()
