"""Block 5: sites that are not plain files: client side navigation, live reload of the
framework, tokens that change at every request, scripts that are only data."""
import re, time

from playwright.sync_api import expect

from conftest import A1, Site
from test_panel import mark_page, still_marked


def edit(f, old, new):
    f.write_text(f.read_text().replace(old, new))


def test_client_side_navigation(tmp_path, page):
    def prepare(src):
        edit(src / "index.html", "</body>", '<button id="go" onclick="history.pushState({}, \'\', \'/team\'); '
             'document.getElementById(\'title\').textContent = \'Team\'">Team</button></body>')
    s = Site(tmp_path, snippet=True, prepare=prepare)
    try:
        s.comments([dict(A1, page="/team", text="Team comment")])
        page.goto(s.site)
        expect(page.locator("#rv-items .other")).to_have_count(1)
        page.locator("#go").click()
        expect(page.locator('#rv-items .it[data-id="a1"]')).to_be_visible(timeout=6000)
        page.locator("#p2").click(button="right")
        page.locator("#rv-dlg textarea").fill("On the team page")
        page.locator("#rv-dlg textarea").press("Enter")
        expect(page.locator("#rv-items .it")).to_have_count(2)
        assert s.comments()[1]["page"] == "/team"
    finally:
        s.stop()


def test_tokens_do_not_count_as_changes(tmp_path, page):
    def prepare(src):
        (src / "style.css").write_text("h1{color:black}")
        edit(src / "index.html", "<head>", '<head><meta name="csrf-token" content="{{token}}"><link rel="stylesheet" href="style.css">')
        edit(src / "index.html", "</body>", '<form><input type="hidden" name="_token" value="{{token}}"></form></body>')
    s = Site(tmp_path, snippet=True, prepare=prepare, tokens=True)
    try:
        page.goto(s.site)
        expect(page.locator("#rv-side")).to_be_visible()
        page.wait_for_timeout(1500)
        page.evaluate("document.getElementById('p1').dataset.mark = 'x'")  # gone if the body is replaced
        (s.source / "style.css").write_text("h1{color:red}")
        expect(page.locator("link[rel=stylesheet]")).to_have_attribute("href", re.compile(r"style\.css\?v="), timeout=8000)
        assert page.evaluate("document.getElementById('p1').dataset.mark") == "x"
        edit(s.source / "index.html", "Old title", "New title")
        expect(page.locator("#title")).to_have_text("New title", timeout=8000)
    finally:
        s.stop()


def test_live_reload_of_the_framework_is_left_alone(tmp_path, page):
    def prepare(src):
        edit(src / "index.html", "<head>", '<head><script type="module" src="/@vite/client"></script>')
    s = Site(tmp_path, snippet=True, prepare=prepare)
    try:
        page.goto(s.site)
        expect(page.locator("#rv-side")).to_be_visible()
        page.wait_for_timeout(1500)
        mark_page(page)
        edit(s.source / "index.html", "Old title", "New title")
        page.wait_for_timeout(5000)
        assert still_marked(page)  # no reload of ours: the framework updates the page itself
        expect(page.locator("#title")).to_have_text("Old title")
    finally:
        s.stop()


def test_data_scripts_do_not_force_a_reload(server, page):
    edit(server.report / "index.html", "</body>", '<script type="application/ld+json">{"@type": "Thing"}</script></body>')
    server.comments([A1])
    page.goto(server.url)
    page.wait_for_timeout(1000)
    mark_page(page)
    edit(server.report / "index.html", "Old title", "New title")
    expect(page.locator("#title")).to_have_text("New title", timeout=8000)
    assert still_marked(page)
