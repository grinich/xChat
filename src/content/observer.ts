// Re-applies xchat's DOM decorations (header logo/search, selection highlight, composer hint)
// the instant X mounts or re-renders the DM UI.
//
// We observe the DOCUMENT ROOT: it exists at document_start and is never replaced, so the
// observer fires on first load AND across SPA navigation. Earlier we watched dm-container and
// then main[role=main], but X REPLACES both when moving between home and chat — a stale
// observer then injects our header/logo late (only when the 600ms poll caught up), which is
// what made the X logo pop in a beat after the rest of the header. Watching the root fixes
// that: applyHeader runs in the same frame X's header appears. reapply is idempotent and gated
// on the DM route, so it's a cheap no-op elsewhere.

import { isDmRoute } from './selectors';
import { applyHighlight } from './selection';
import { applyComposerHint } from './composer-hint';
import { applyHeader } from './header';

let scheduled = false;

function reapply(): void {
  if (!isDmRoute()) return;
  applyHeader();
  applyHighlight();
  applyComposerHint();
}

function schedule(): void {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    reapply();
  });
}

export function startObserver(): void {
  const obs = new MutationObserver(schedule);
  obs.observe(document.documentElement, { childList: true, subtree: true });
  reapply();
}
