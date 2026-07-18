# tchat — notes for Claude

**What this is:** an in-page Chrome MV3 extension (WXT + TypeScript) that enhances X (Twitter)
DMs with a full-screen reskin + keyboard-first UX. It is NOT an API client. See `PLAN.md` for
the full architecture and the reverse-engineering findings that justify it.

## Core principle
X does all data/network/crypto/realtime/sending. tchat only **reads the rendered DOM** and
**drives X's own controls**. This is the only way to support end-to-end-encrypted XChat threads
(keys are device-bound and off the main thread). Never add API calls, cookie handling, or
attempts to decrypt — those were investigated and ruled out (see PLAN.md §7).

## Layout
- `entrypoints/dm.content.ts` — content-script entry (matches `x.com/i/chat*`, `/messages*`);
  imports the reskin CSS (manifest-injected) and calls `boot()`.
- `entrypoints/background.ts` — minimal; no networking.
- `src/content/selectors.ts` — **single source of truth for every X DOM hook.** Fix breakage here.
- `src/content/` — `boot`, `keyboard`, `selection`, `commands`, `actions`, `triage`, `palette`,
  `switcher`, `observer`, `toast`, `style.css`.
- `src/lib/` — pure, unit-tested logic: `id-parse`, `fuzzy`, `flags-store`.
- `test/` — vitest (jsdom). Pure logic only; DOM-driving is verified live on x.com.

## Conventions
- Anchor all selectors to `data-testid`/`role`, never hashed classes.
- Overlays (palette, switcher, toast) live in shadow roots to isolate from X's CSS.
- Triage (archive/star/snooze/unread) = local flags in `chrome.storage.local`; reversible.
- Selection is tracked by conversation **id**, not index (the list is virtualized).
- Imports within `src/` use relative paths (the WXT/rolldown build doesn't honor the `@` alias;
  vitest/tsconfig do, so tests may use `@/…`).

## Commands
`npm run build` → `dist/` (load unpacked; flattened via `outDirTemplate: '.'`). `npm test`, `npm run compile`.
Full end-to-end verification requires loading the unpacked extension (manual Chrome step).
