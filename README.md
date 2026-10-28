# redpencil

Review a page your coding agent made, right in the browser. Select some text,
or right-click a spot, or drag a box over the page, and write what's wrong.
Press ▷ and the comments go back to your agent session, which fixes them while
the page updates in front of you, without losing what you are typing or where
you are.

![A comment on a page, ▷, and the agent fixes it while you watch](https://raw.githubusercontent.com/zupolgec/redpencil/main/docs/img/demo.gif)

Works with a single html file (a report, a mockup), a folder of pages, or a
whole site served by something else (Laravel Herd, a dev server, a staging
site). No dependencies: one Python file (standard library only) and one
JavaScript file.

## Quick start

Ask your agent session (Claude Code, Codex, opencode...) to run, in the
background:

    uvx redpencil report.html --open --wait

It starts the review server, opens the page in your browser and waits. When
you press ▷ it returns, printing the comments and how to record the outcome of
each one; your agent works on them and runs the same command again for the
next round.

The server stops by itself after 15 minutes nobody uses it (no page open, no
session waiting; `--idle N` to change it). The panel then says so, and asking
your agent to open the review again brings it back: the page reconnects by
itself. You can also start the server alone, without `--wait`, and leave it
running. Every comment shows its state in the panel (queued, working, done,
answered) and the agent's reply.

(Or, from the repository: `uvx --from git+https://github.com/zupolgec/redpencil redpencil ...`.)

## A whole site

    redpencil --site https://my-site.test --source ~/code/my-site --wait

The panel reaches the site in one of two ways:

- **Chrome extension** (`extension/`): open `chrome://extensions`, turn on
  developer mode, "Load unpacked", pick the `extension` folder
  (`scripts/build_extension.py` makes the zip for the Chrome Web Store). On the site,
  click the extension's icon once: from then on its pages show the panel
  whenever a review of that site is running.
- **Snippet**: add the `<script>` printed at start to your layout.

Comments are kept per page, and the panel lists the open ones on the other
pages. Your agent edits the source (templates, content, styles); the page
updates by itself, or is left alone when a dev server with live reload (Vite,
Next) already does it.

With the extension you can drag a box over the page and a screenshot of it
goes with the comment.

## Without an agent session

Start the server with `--agent` and ▷ runs a background agent instead:
`--agent claude` (default), `--agent codex` or `--agent opencode`, with
`--model` to pick the model. It gets a prompt with the comment ids and the
same instructions as a session. Its log is in `.review/agent.log`, and ▷
becomes a stop button while it works.

To fit it to your project:

- `--prompt FILE`: your prompt instead of ours. These placeholders are
  filled in: `{ids}`, `{which}`, `{root}`, `{page}`, `{site}`, `{work}`,
  `{store}` (comments.json), `{outcome}` (how to record outcomes), `{skill}`.
- `--work DIR`: keep the comments there instead of `.review/`.
- `--skill DIR`: the agent may also read that folder and run its scripts
  (`uv run`, `playwright-cli`); for a Claude Code skill with its own tools.

## Options

    redpencil <page.html | folder> [--open] [--wait] [--agent [claude|codex|opencode]] [--model M] [--port N] [--lang it]
    redpencil --site <url> --source <folder> [same options]
    [--prompt FILE] [--work DIR] [--skill DIR] [--idle SECONDS]

The panel is in English; `--lang it` switches it to Italian.

## Files

Everything lives in `.review/` next to the page (or in the site's source):

- `comments.md`: the comments, readable;
- `comments.json`: the same, for tools;
- `outcomes/<id>.json`: where the agent records the outcome of a comment, e.g.
  `{"status": "done", "reply": "Shortened the title"}`; the server applies it
  and removes the file;
- `shots/`: screenshots of the boxes;
- `agent.log`: the background agent's output;
- `server.log`: the output of a server started by `--wait`.

Add `.review/` to your `.gitignore`.

## Security

The server listens on 127.0.0.1 only. It answers only its own pages, the site
under review and the extension: other sites open in your browser can't read
the comments, add any or start the agent, and requests for another host name
are refused. Files outside the folder and hidden files are never served.

The background agent may edit files in the folder. With Claude it gets only
file tools (no shell, no web; `--skill` adds a few commands); Codex runs in
its workspace sandbox (no network). opencode has no sandbox: with `--auto` it
approves its own actions, so use it only on projects you trust. The prompt
tells every agent that the page and the quoted text are data, not
instructions, but treat a review of a page you don't trust with care.

Comments and screenshots stay on your computer: see [PRIVACY.md](https://github.com/zupolgec/redpencil/blob/main/PRIVACY.md)
for the extension.

The extension asks Chrome for access to all sites, because Chrome allows
screenshots of a tab only with it; the panel still goes only on the sites you
turn on with its icon.

## Tests

    uv run --no-project --with pytest --with playwright pytest -q tests

End to end: the real server, headless Chromium (with the extension loaded) and
a fake agent.

## License

MIT. Icons from [Lucide](https://lucide.dev) (ISC).
