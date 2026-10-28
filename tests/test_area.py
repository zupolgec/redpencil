"""Block 6: a box dragged over the page, with a screenshot of it when the extension is there."""
import pathlib

from playwright.sync_api import expect

from conftest import SRC, Server, Site
from test_site import chrome  # noqa: F401  (fixture)


def drag(page, x1, y1, x2, y2):
    page.locator("#rv-area").click()
    page.mouse.move(x1, y1)
    page.mouse.down()
    page.mouse.move((x1 + x2) / 2, (y1 + y2) / 2)
    page.mouse.move(x2, y2)
    page.mouse.up()


def comment(page, text):
    page.locator("#rv-dlg textarea").fill(text)
    page.locator("#rv-dlg textarea").press("Enter")
    expect(page.locator("#rv-dlg")).to_have_count(0)


def test_box_on_the_page(server, page):
    page.goto(server.url)
    box = page.locator("#photo").bounding_box()
    drag(page, box["x"] + 10, box["y"] + 10, box["x"] + 110, box["y"] + 60)
    comment(page, "This corner is too dark")
    c = server.comments()[0]
    a = c["area"]
    assert c["selector"] == "#photo" and all(abs(a[k] - v) <= 1 for k, v in dict(x=10, y=10, w=100, h=50).items())
    assert f"- Area: {a['w']}×{a['h']} px at {a['x']}, {a['y']} inside the element" in (server.work / "comments.md").read_text()
    shown = page.locator("#rv-pins .rv-area")
    expect(shown).to_have_count(1)
    b = shown.bounding_box()
    assert abs(b["x"] - (box["x"] + 10)) < 3 and abs(b["width"] - 100) < 3


def test_box_with_a_screenshot_through_the_extension(tmp_path, chrome):  # noqa: F811
    s = Site(tmp_path)
    try:
        sw = chrome.service_workers[0] if chrome.service_workers else chrome.wait_for_event("serviceworker")
        sw.evaluate("o => enable(o)", s.site.rstrip("/"))
        page = chrome.new_page()
        page.goto(s.site)
        expect(page.locator("#rv-side")).to_be_visible(timeout=5000)
        box = page.locator("#photo").bounding_box()
        drag(page, box["x"], box["y"], box["x"] + 80, box["y"] + 40)
        expect(page.locator("#rv-dlg img")).to_be_visible(timeout=5000)  # the screenshot, shown while writing
        comment(page, "Wrong colour")
        c = s.comments()[0]
        shot = pathlib.Path(c["shot"])
        assert shot.read_bytes()[:8] == b"\x89PNG\r\n\x1a\n" and shot.parent == s.work / "shots"
        assert f"- Screenshot: {shot}" in (s.work / "comments.md").read_text()
        page.reload()  # the screenshot stays in the list, next to its comment
        thumb = page.locator("#rv-items .it img.shot")
        expect(thumb).to_be_visible(timeout=5000)
        page.wait_for_function("() => document.querySelector('#rv-items .it img.shot').naturalWidth > 0")
    finally:
        s.stop()


def test_screenshot_on_a_local_page_through_the_extension(tmp_path, chrome):  # noqa: F811
    s = Server(tmp_path, SRC / "review.py")
    try:
        page = chrome.new_page()
        page.goto(s.url)
        box = page.locator("#photo").bounding_box()
        drag(page, box["x"], box["y"], box["x"] + 80, box["y"] + 40)
        expect(page.locator("#rv-dlg img")).to_be_visible(timeout=5000)
        comment(page, "Wrong colour")
        assert pathlib.Path(s.comments()[0]["shot"]).exists()
    finally:
        s.stop()
