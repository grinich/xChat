// Keeps focus OUT of the DM composer unless the user intends it.
//
// X auto-focuses the composer whenever a thread opens, which would trap j/k (and every
// letter shortcut) as typing. We blur any composer focus that we didn't ask for. The user
// opts in explicitly by pressing `r` (requestComposerFocus) or by clicking the composer.

import { SEL, $ } from './selectors';

let allow = false;

function inComposer(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  return !!(el && (el.matches?.(SEL.composerTextarea) || el.closest?.(SEL.composerForm)));
}

/** True only when the user intentionally focused the composer (pressed `r` or clicked it).
 *  Used by the keyboard layer to tell "user is typing a reply" from "X auto-focused". */
export function hasReplyIntent(): boolean {
  return allow;
}

/** Explicit intent to type (press `r`): permit focus, then focus the composer. */
export function requestComposerFocus(): boolean {
  allow = true;
  const ta = $(SEL.composerTextarea) as HTMLTextAreaElement | null;
  if (!ta) {
    allow = false;
    return false;
  }
  ta.focus();
  return true;
}

export function installComposerFocusGuard(): void {
  // A mouse click on the composer is intentional focus.
  document.addEventListener(
    'mousedown',
    (e) => {
      if (inComposer(e.target)) allow = true;
    },
    true,
  );
  // Blur any composer focus we didn't ask for (X's auto-focus on thread open).
  document.addEventListener(
    'focusin',
    (e) => {
      if (inComposer(e.target) && !allow) (e.target as HTMLElement).blur?.();
    },
    true,
  );
  // Leaving the composer resets intent.
  document.addEventListener(
    'focusout',
    (e) => {
      if ((e.target as HTMLElement)?.matches?.(SEL.composerTextarea)) allow = false;
    },
    true,
  );
  // Handle the case where X already focused the composer before the guard installed.
  const ta = $(SEL.composerTextarea) as HTMLTextAreaElement | null;
  if (ta && document.activeElement === ta && !allow) ta.blur();
}
