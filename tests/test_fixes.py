"""Problems found in the review of 28 October: each test reproduces one."""
import json, re, socket, threading, time, urllib.error, urllib.request

from playwright.sync_api import expect

from conftest import A1, B2, SRC, Server
from test_panel import row


def get(url, headers=None):
    try:
        return urllib.request.urlopen(urllib.request.Request(url, headers=headers or {}), timeout=5).status
    except urllib.error.HTTPError as e:
        return e.code


def test_two_quick_clicks_start_one_agent(server):
    server.comments([A1])
    server.script_steps([{"wait": 1}, {"outcome": ["a1", "done", "Ok"]}])
    go = lambda: urllib.request.urlopen(urllib.request.Request(server.url + "__work", method="POST", data=b"{}"))
    ts = [threading.Thread(target=go) for _ in range(4)]
    [t.start() for t in ts]
    [t.join() for t in ts]
    time.sleep(2.5)
    assert (server.work / "runs.txt").read_text().count("run") == 1


def test_a_reply_closes_the_comment(server, page):
    server.comments([A1])
    page.goto(server.url)
    server.outcome("a1", "answered", "It's fine as it is")
    expect(row(page, "a1")).to_have_class(re.compile(r"\bdone\b"), timeout=5000)
    expect(row(page, "a1").locator(".ans p")).to_have_text("It's fine as it is")
    assert server.comments()[0]["done"] is True


def test_comments_belong_to_their_page(server, page):
    server.comments([dict(A1, page="index.html")])
    page.goto(server.url + "other.html")
    expect(page.locator("#rv-items .other")).to_have_count(1)
    expect(page.locator("#rv-items .it")).to_have_count(0)
    page.locator("#q1").click(button="right")
    page.locator("#rv-dlg textarea").fill("Too short")
    page.locator("#rv-dlg textarea").press("Enter")
    expect(page.locator("#rv-items .it")).to_have_count(1)
    assert server.comments()[1]["page"] == "other.html"
    assert "- Page: other.html" in (server.work / "comments.md").read_text()
    page.locator("#rv-items .other").click()
    expect(row(page, "a1")).to_be_visible()


def test_comment_kept_when_saving_fails(server, page):
    page.goto(server.url)
    page.route(re.compile(r"/__comment$"), lambda r: r.abort())
    page.locator("#p2").click(button="right")
    page.locator("#rv-dlg textarea").fill("Important remark")
    page.locator("#rv-dlg textarea").press("Enter")
    expect(page.locator("#rv-dlg .err")).to_be_visible()
    expect(page.locator("#rv-dlg textarea")).to_have_value("Important remark")
    page.unroute(re.compile(r"/__comment$"))
    page.locator("#rv-dlg textarea").press("Enter")
    expect(page.locator("#rv-dlg")).to_have_count(0)
    assert [c["text"] for c in server.comments()] == ["Important remark"]


def test_image_keeps_its_query(server, page):
    f = server.report / "index.html"
    f.write_text(f.read_text().replace('src="img/a.svg"', 'src="img/a.svg?id=42"'))
    server.comments([A1])
    page.goto(server.url)
    page.wait_for_timeout(500)
    (server.report / "img" / "a.svg").write_text('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="10"/>')
    expect(page.locator("#photo")).to_have_attribute("src", re.compile(r"img/a\.svg\?id=42&v="), timeout=8000)


def test_id_with_special_characters(server, page):
    f = server.report / "index.html"
    f.write_text(f.read_text().replace('id="p2"', 'id="p:2"'))
    server.comments([dict(A1, selector="#p\\:2", quote="")])
    page.goto(server.url)
    page.locator('[id="p:2"]').click(button="right")
    page.locator("#rv-dlg textarea").fill("Here")
    page.locator("#rv-dlg textarea").press("Enter")
    expect(page.locator("#rv-pins .rv-n")).to_have_count(2)


def test_only_the_page_folder_is_served(server, tmp_path):
    secret = tmp_path / "secret.txt"
    secret.write_text("secret")
    (server.report / "link.txt").symlink_to(secret)
    server.comments([A1])
    assert get(server.url + "link.txt") == 404
    assert get(server.url + ".review/comments.json") == 404
    assert get(server.url + "index.html") == 200


def test_other_hosts_and_pages_are_refused(server):
    port = server.url.split(":")[2].strip("/")
    assert get(server.url + "__comments", {"Host": "evil.example"}) == 403  # DNS rebinding
    assert get(server.url + "__next", {"Sec-Fetch-Site": "cross-site"}) == 403  # an <img> on another site
    assert get(server.url + "__comments", {"Origin": f"http://evil.127.0.0.1.nip.io:{port}"}) == 403
    assert get(server.url + "__comments", {"Host": f"localhost:{port}"}) == 200


def test_a_session_that_stopped_waiting_gets_nothing(tmp_path, page):
    s = Server(tmp_path, SRC / "review.py", agent=False)
    try:
        s.comments([A1])
        waiting = s.wait()
        page.goto(s.url)
        expect(page.locator("#rv-run")).to_have_attribute("aria-label", "Send the open comments to your agent session", timeout=8000)
        waiting.kill()
        waiting.wait()
        page.locator("#rv-run").click()
        expect(page.locator("#rv-job")).to_contain_text("isn't listening", timeout=10000)
        expect(row(page, "a1").locator(".st")).to_be_hidden()
        assert not (s.work / "prompt.txt").exists()
        assert s.comments()[0].get("status") in (None, "todo")
    finally:
        s.stop()


def test_without_a_session_and_without_agent_nothing_starts(tmp_path, page):
    s = Server(tmp_path, SRC / "review.py", agent=False)
    try:
        s.comments([A1])
        page.goto(s.url)
        page.locator("#rv-run").click()
        expect(page.locator("#rv-job")).to_contain_text("isn't listening")
        page.wait_for_timeout(1000)
        assert not (s.work / "prompt.txt").exists()
    finally:
        s.stop()
