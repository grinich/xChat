// Re-applies tchat's DOM decorations after X re-renders the DM list.
// X owns the list; it re-mounts rows on scroll/route changes, wiping our classes/attrs.
// A debounced MutationObserver re-applies the selection highlight and triage augmentation.

import { SEL, $ } from './selectors';
import { applyHighlight } from './selection';
import { applyComposerHint } from './composer-hint';
import { applyHeader } from './header';

let scheduled = false;

function reapply(): void {
  applyHighlight();
  applyComposerHint();
  applyHeader();
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
  const target = $(SEL.dmContainer) ?? document.body;
  const obs = new MutationObserver(schedule);
  obs.observe(target, { childList: true, subtree: true });
  reapply();
}
