# xChat — notes for Claude

**What this is:** an in-page Chrome MV3 extension (WXT + TypeScript) that enhances X (Twitter)
DMs with a full-screen reskin + keyboard-first UX. It is NOT an API client.

## Core principle
X does all data/network/crypto/realtime/sending. xChat only **reads the rendered DOM** and
**drives X's own controls**. This is the only way to support end-to-end-encrypted XChat threads
(keys are device-bound and off the main thread). Never add API calls, cookie handling, or
attempts to decrypt.

## Layout
- `entrypoints/dm.content.ts` — content-script entry (matches `x.com/i/chat*`, `/messages*`);
  imports the reskin CSS (manifest-injected) and calls `boot()`.
- `entrypoints/webmcp.content.ts` — MAIN-world entry; registers the WebMCP tools
  (`src/webmcp/tools.ts`) on `document.modelContext` so AI agents can drive DMs.
- `entrypoints/background.ts` — toolbar action, unread badge, and the optional bridge's
  WebSocket client. The ONLY networking allowed anywhere is that localhost-only dial-out
  to `xchat-mcp` — never a connection to X or any remote host.
- `src/content/selectors.ts` — **single source of truth for every X DOM hook.** Fix breakage here.
- `src/content/` — `boot`, `keyboard`, `selection`, `commands`, `actions`, `header`,
  `composer-focus`, `composer-hint`, `palette`, `switcher`, `observer`, `toast`,
  `bridge-relay`, `style.css`.
- `src/webmcp/tools.ts` — agent-callable tools wrapping `actions.ts`/`selectors.ts`. Read
  text with its `textFragments()` (leaf textContent), NEVER `innerText` — X render-skips
  offscreen/background-tab content and innerText returns "" there.
- `src/lib/` — pure, unit-tested logic: `id-parse`, `fuzzy`.
- `bridge/` — standalone `xchat-mcp` npm package: stdio MCP server + localhost WebSocket
  that the background worker connects out to (`cd bridge && npm install && npm run build`).
- `test/` — vitest (jsdom). Pure logic only; DOM-driving is verified live on x.com.

## Conventions
- Anchor all selectors to `data-testid`/`role`, never hashed classes.
- Overlays (palette, switcher, toast) live in shadow roots to isolate from X's CSS.
- Selection is tracked by conversation **id**, not index (the list is virtualized).
- Imports within `src/` use relative paths (the WXT/rolldown build doesn't honor the `@` alias;
  vitest/tsconfig do, so tests may use `@/…`).

## Commands
`npm run build` → `dist/` (load unpacked; flattened via `outDirTemplate: '.'`). `npm test`, `npm run compile`.
Full end-to-end verification requires loading the unpacked extension (manual Chrome step).
