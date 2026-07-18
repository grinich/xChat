// Reflects X's unread-DM count onto the extension's toolbar icon as a badge.
//
// Same principle as the rest of xChat: we only READ X's own rendered indicator — the unread
// badge X mounts inside its global "Direct Messages" nav link (present in the DOM on every
// x.com page, even when our reskin hides the nav rail) — and report it to the background
// worker, which owns the toolbar badge. No API calls, no polling of X's servers. When no x.com
// tab is open we have no source, so the badge just stops updating (background clears it once the
// last x.com tab closes).

import { SEL, $ } from './selectors';

let last = -1; // last reported numeric count, to dedupe messages

/** Read X's unread-DM count from its nav link. Returns count -1 when we can't read it. */
function readUnread(): { count: number; text: string } {
  const link = $(SEL.dmNavLink);
  if (!link) return { count: -1, text: '' };
  // The count is a small numeric badge inside the link. Match the leaf element whose text is a
  // pure number (optionally "9+"); the label and icon aren't numeric so they're ignored.
  let text = '';
  for (const el of Array.from(link.querySelectorAll<HTMLElement>('*'))) {
    if (el.children.length === 0) {
      const t = (el.textContent || '').trim();
      if (/^\d+\+?$/.test(t)) {
        text = t;
        break;
      }
    }
  }
  return { count: text ? parseInt(text, 10) : 0, text };
}

function report(): void {
  const { count, text } = readUnread();
  if (count === -1) return; // couldn't read (nav not in DOM yet) — leave badge as-is
  if (count === last) return; // no change
  last = count;
  try {
    chrome.runtime?.sendMessage({ type: 'xchat:unread', count, text: count > 0 ? text : '' });
  } catch {
    // Background may be asleep or the context invalidated during reload; next change re-sends.
  }
}

let scheduled = false;
function schedule(): void {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    report();
  });
}

/** Watch X's unread indicator and keep the toolbar badge in sync. Safe to run on any x.com page. */
export function startUnreadBadge(): void {
  const obs = new MutationObserver(schedule);
  obs.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  // Cheap backstop poll (deduped by `last`) in case a badge update slips past the observer.
  setInterval(report, 3000);
  report();
}
