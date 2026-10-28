"""Block 2: the panel says what is going on and nothing gets lost."""
import re, time

from playwright.sync_api import expect

from conftest import A1, B2, SRC, Server
from test_panel import row


def test_draft_survives_a_reload(server, page):
    page.goto(server.url)
    page.locator("#p2").click(button="right")
    page.locator("#rv-dlg textarea").fill("Half a thought")
    page.reload()
    expect(page.locator("#rv-dlg textarea")).to_have_value("Half a thought")
    page.locator("#rv-dlg textarea").press("Enter")
    expect(page.locator("#rv-dlg")).to_have_count(0)
    assert server.comments()[0]["selector"] == "#p2"
    page.reload()
    page.wait_for_timeout(500)
    expect(page.locator("#rv-dlg")).to_have_count(0)


def test_stop_a_job(server, page):
    server.comments([A1])
    server.script_steps([{"wait": 3}, {"outcome": ["a1", "done", "Late"]}])
    page.goto(server.url)
    page.locator("#rv-run").click()
    expect(row(page, "a1").locator(".st")).to_contain_text("working")
    expect(page.locator("#rv-run")).to_have_attribute("aria-label", "Stop")
    page.locator("#rv-run").click()
    expect(page.locator("#rv-job")).to_contain_text("Stopped")
    expect(row(page, "a1").locator(".st")).to_be_hidden()
    time.sleep(3.5)
    assert not server.comments()[0].get("done")  # the agent was really stopped


def test_undo_delete(server, page):
    server.comments([A1, B2])
    page.goto(server.url)
    row(page, "a1").locator("button.del").click()
    expect(page.locator("#rv-items .it")).to_have_count(1)
    page.locator("#rv-undo button").click()
    expect(page.locator("#rv-items .it")).to_have_count(2)
    c = server.comments()
    assert [x["id"] for x in c] == ["a1", "b2"] and c[0]["text"] == "Write it better"


def test_who_gets_the_comments(tmp_path, page):
    s = Server(tmp_path, SRC / "review.py", agent=False)
    try:
        page.goto(s.url)
        expect(page.locator("#rv-run")).to_have_attribute("aria-label", re.compile("isn't listening"))
    finally:
        s.stop()
