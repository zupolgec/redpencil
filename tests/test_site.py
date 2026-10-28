"""Site mode: the panel on a site served by something else (Herd, a dev server), through the
snippet or the Chrome extension; the agent edits the site's source."""
import json, re, shutil, subprocess, sys, urllib.error, urllib.request

import pytest
from playwright.sync_api import expect

from conftest import A1, C3, HERE, Site, free_port, up
from test_panel import mark_page, row, still_marked

EXT = HERE.parent / "extension"


def test_snippet_on_a_site(site, page):
    """Each page shows its own comments, the others are a click away; the agent edits the source."""
    site.comments([dict(A1, page="/"), C3])
    page.goto(site.site)
    expect(row(page, "a1")).to_be_visible()
    expect(row(page, "c3")).to_have_count(0)
    other = page.locator("#rv-items .other")
    expect(other).to_have_count(1)
    expect(other).to_contain_text("Mockup title")
    other.click()
    expect(page).to_have_url(site.site + "other.html")
    expect(row(page, "c3")).to_be_visible()
    page.locator("#q1").click(button="right")
    page.locator("#rv-dlg textarea").fill("Paragraph too short")
    page.locator("#rv-dlg textarea").press("Enter")
    expect(page.locator("#rv-items .it")).to_have_count(2)
    new = [c for c in site.comments() if c["text"] == "Paragraph too short"][0]
    assert new["page"] == "/other.html" and new["selector"] == "#q1"
    site.script_steps([{"wait": 1}, {"replace": ["other.html", "Old mockup", "New mockup"]},
                       {"outcome": ["c3", "done", "Changed"]}])
    mark_page(page)
    row(page, "c3").locator("button.run").click()
    expect(page.locator("#t2")).to_have_text("New mockup", timeout=10000)
    expect(page.locator("#rv-job")).to_contain_text("Done", timeout=10000)
    assert still_marked(page)
    prompt = (site.work / "prompt.txt").read_text()
    assert site.site.rstrip("/") in prompt and str(site.source.resolve()) in prompt
    assert "- Page: /other.html" in (site.work / "comments.md").read_text()


def test_session_waits_for_a_site(site, page):
    site.comments([dict(A1, page="/")])
    waiting = site.wait()
    try:
        page.goto(site.site)
        expect(page.locator("#rv-run")).to_have_attribute("aria-label", "Send the open comments to your agent session", timeout=5000)
        page.locator("#rv-run").click()
        out, err = waiting.communicate(timeout=10)
        assert waiting.returncode == 0, err
        assert "Write it better" in out and "Page: /" in out and site.site.rstrip("/") in out and "--site" in out
    finally:
        waiting.kill()


def post(url, origin):
    r = urllib.request.Request(url + "__comment", method="POST", headers={"Origin": origin},
                               data=json.dumps({"action": "add", "text": "From elsewhere"}).encode())
    try:
        return urllib.request.urlopen(r).status
    except urllib.error.HTTPError as e:
        return e.code


def test_other_sites_cannot_write(site):
    assert post(site.url, "https://evil.example") == 403
    assert post(site.url, site.site.rstrip("/")) == 200
    assert [c["text"] for c in site.comments()] == ["From elsewhere"]
    try:
        urllib.request.urlopen(urllib.request.Request(site.url + "__comments", headers={"Origin": "https://evil.example"}))
        assert False, "read from another site"
    except urllib.error.HTTPError as e:
        assert e.code == 403


@pytest.fixture
def chrome(tmp_path, pw):
    """Chromium with the extension loaded, as the user's Chrome after accepting its permission
    (a headless browser can't answer the prompt, so the copy has it from the start)."""
    ext = tmp_path / "extension"
    shutil.copytree(EXT, ext, symlinks=False)
    m = json.loads((ext / "manifest.json").read_text())
    m["host_permissions"] += m.pop("optional_host_permissions")
    (ext / "manifest.json").write_text(json.dumps(m))
    ctx = pw.chromium.launch_persistent_context(
        str(tmp_path / "profile"), channel="chromium", headless=True, viewport={"width": 1280, "height": 800},
        args=[f"--disable-extensions-except={ext}", f"--load-extension={ext}"])
    yield ctx
    ctx.close()


def test_extension_on_a_site(tmp_path, chrome):
    s = Site(tmp_path)
    plain = subprocess.Popen([sys.executable, "-I", "-m", "http.server", str(a := free_port()), "--bind", "127.0.0.1",
                              "--directory", str(HERE / "page")], stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    try:
        up(f"http://127.0.0.1:{a}/", plain)
        page = chrome.new_page()
        page.goto(f"http://127.0.0.1:{a}/")  # a site with no review open: nothing changes
        page.wait_for_timeout(1500)
        expect(page.locator("#rv-side")).to_have_count(0)
        page.goto(s.site)  # under review, but not chosen in the extension yet: nothing either
        page.wait_for_timeout(1500)
        expect(page.locator("#rv-side")).to_have_count(0)
        sw = chrome.service_workers[0] if chrome.service_workers else chrome.wait_for_event("serviceworker")
        sw.evaluate("o => enable(o)", s.site.rstrip("/"))  # what the click on the icon does
        page.reload()
        expect(page.locator("#rv-side")).to_be_visible(timeout=5000)
        page.locator("#p2").click(button="right")
        page.locator("#rv-dlg textarea").fill("Too long")
        page.locator("#rv-dlg textarea").press("Enter")
        expect(page.locator("#rv-items .it")).to_have_count(1)
        c = s.comments()
        assert c[0]["page"] == "/" and c[0]["selector"] == "#p2"
        page.reload()
        expect(page.locator("#rv-items .it")).to_have_count(1, timeout=5000)
        expect(page.locator("#rv-side")).to_have_count(1)
        expect(page.locator("#rv-pins .rv-n")).to_have_count(1)
        s.script_steps([{"wait": 1}, {"replace": ["index.html", "Old title", "New title"]},
                        {"outcome": [c[0]["id"], "done", "Shorter"]}])
        mark_page(page)
        page.locator("#rv-run").click()
        expect(page.locator("#title")).to_have_text("New title", timeout=10000)
        expect(page.locator("#rv-job")).to_contain_text("Done", timeout=10000)
        assert still_marked(page)
    finally:
        plain.terminate()
        s.stop()
