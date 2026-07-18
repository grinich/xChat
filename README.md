# xChat

<p align="center">
  <img src="./docs/screenshot.png" alt="xChat — full-screen, keyboard-first X DMs" width="50%">
</p>

A fast, full-screen, **keyboard-first layer on top of X (Twitter) Direct Messages** — inspired
by Superhuman and the `inflow` LinkedIn client. xChat is an in-page Chrome extension: it never
touches X's API or crypto. X does all the fetching, decryption, realtime, and sending; xChat
adds a full-screen reskin, keyboard navigation (`j`/`k`), a command palette (`⌘K`), a
quick-switcher (`⌘J`), quick search, reply-on-`r`, and a toolbar button that jumps straight to
your DMs. Because it rides X's own client, **every conversation works — including
end-to-end-encrypted XChat threads.**

Everything maps to real X DM functionality — nothing is faked. X DMs have no archive / star /
snooze, so xChat doesn't pretend to.

> Unofficial and not affiliated with, endorsed by, or sponsored by X Corp. "X" and "Twitter"
> are trademarks of their respective owners.

## Develop

```bash
npm install       # postinstall runs `wxt prepare`
npm run dev        # WXT dev build with HMR → dist/
npm run build      # production build → dist/
npm test           # unit tests (vitest)
npm run compile    # typecheck (tsc --noEmit)
```

## Load in Chrome (one-time)

The extension can't self-install (Chrome requires a manual step), so:

1. `npm run build`
2. Open `chrome://extensions`
3. Toggle **Developer mode** on (top-right)
4. Click **Load unpacked** and select the **`dist`** folder
5. Open <https://x.com/messages> (or `x.com/i/chat`). xChat activates automatically.

To pick up code changes: `npm run build` again, then click the refresh icon on the xChat card
in `chrome://extensions` and reload the X tab. (`npm run dev` auto-rebuilds.)

## Keyboard shortcuts

| Key | Action |
|---|---|
| `j` / `k` (↓/↑) | Move to next / previous conversation **and open it** |
| `Enter` / `o` | Open selected conversation |
| `r` | Reply — focus the composer (moving never auto-focuses it) |
| `⌘K` / `Ctrl+K` | Command palette |
| `⌘J` / `Ctrl+J` | Quick switcher (fuzzy jump) |
| `/` | Search |
| `c` | New chat |
| `Enter` | Send (in composer) · `Shift+Enter` newline |
| `1` / `2` | Inbox filter / Message requests |
| `g g` / `G` | Top / bottom of list |
| `?` | Command palette (help) |

Every shortcut maps to real X DM functionality — nothing is faked. (X DMs have no
archive/star/snooze, so xChat doesn't pretend to; features that would silently no-op were
removed.)

## How it holds up when X changes its UI

Every DOM hook lives in one file — [`src/content/selectors.ts`](./src/content/selectors.ts) —
and is anchored to `data-testid`/`role`, never to hashed class names. On boot, a self-check
verifies the required hooks exist and shows a small toast if X's markup has drifted, degrading
gracefully instead of breaking the page. The full-screen reskin is pure CSS injected via the
manifest, so it auto-applies across X's React re-renders with no JS.
