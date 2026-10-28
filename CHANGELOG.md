# Changelog

## 0.1.0

First release.

- Comment on a page in the browser: selected text, a spot (right-click) or a
  box dragged over the page, with a screenshot of it through the extension.
- ▷ sends the comments to your agent session waiting with `--wait`, or to a
  background agent (`--agent claude|codex|opencode`).
- The page updates live while the agent works, without losing what you are
  typing; left alone when a dev server with live reload already does it.
- Whole sites (`--site`, `--source`) through the Chrome extension or a
  snippet, with comments kept per page.
- `--wait` starts the review server when it isn't running; a server started
  this way stops after 15 minutes nobody uses it.
- `--prompt`, `--work`, `--skill` to fit the background agent to a project.
- Panel in English, or Italian with `--lang it`.
