// Global keyboard layer. Single capture-phase keydown handler → command dispatch.
// Typing guards: while a text field or our overlay is focused we only honor a small
// allowlist (send, escape). AZERTY-safe: symbol bindings match e.key without a shift guard.

import { run } from './commands';
import { openPalette, paletteOpen } from './palette';
import { openSwitcher, switcherOpen } from './switcher';
import { requestComposerFocus, hasReplyIntent } from './composer-focus';
import { select, selectFirst } from './selection';
import { closeRequests, acceptRequest } from './actions';
import { SEL, dmPresent } from './selectors';

let lastG = 0; // for the `g g` chord

function inTextField(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return true;
  if ((el as HTMLElement).isContentEditable) return true;
  return false;
}

function inComposer(el: Element | null): boolean {
  return !!el?.closest?.(SEL.composerForm) || !!el?.matches?.(SEL.composerTextarea);
}

function isMod(e: KeyboardEvent): boolean {
  return e.metaKey || e.ctrlKey;
}

export function installKeyboard(): void {
  window.addEventListener(
    'keydown',
    (e) => {
      // Overlays own the keyboard while open (they handle their own Esc/Enter/arrows).
      if (paletteOpen() || switcherOpen()) return;

      // Only act on the DM surface — never hijack keys on the rest of X (e.g. feed j/k).
      if (!dmPresent()) return;

      let active = document.activeElement;

      // --- Composer bindings ---
      if (inComposer(active)) {
        if (hasReplyIntent()) {
          // User is intentionally typing a reply — let X handle all keys (Enter sends, etc.).
          return;
        }
        // X auto-focused the composer (not the user): blur it and treat keys as shortcuts.
        (active as HTMLElement).blur();
        // Re-read focus so the text-field guard below doesn't see the (now-blurred) composer.
        active = document.activeElement;
      }

      // --- Global chords available even from other inputs ---
      if (isMod(e) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        openPalette();
        return;
      }
      if (isMod(e) && (e.key === 'j' || e.key === 'J')) {
        e.preventDefault();
        openSwitcher();
        return;
      }

      // From here down, ignore if focused in a text field (search box, etc.),
      // except Escape which blurs.
      if (inTextField(active)) {
        if (e.key === 'Escape') (active as HTMLElement).blur();
        return;
      }

      if (isMod(e) || e.altKey) return; // leave other browser/OS chords alone

      switch (e.key) {
        case 'j':
        case 'ArrowDown':
          e.preventDefault();
          run('next');
          break;
        case 'k':
        case 'ArrowUp':
          e.preventDefault();
          run('prev');
          break;
        case 'Enter':
          e.preventDefault();
          // On an open message request, Enter accepts it; otherwise it opens the selection.
          if (!acceptRequest()) run('open');
          break;
        case 'o':
          e.preventDefault();
          run('open');
          break;
        case 'r':
          e.preventDefault();
          requestComposerFocus();
          break;
        case 'c':
          e.preventDefault();
          run('compose');
          break;
        case '/':
          e.preventDefault();
          run('search');
          break;
        case 'Tab':
          e.preventDefault();
          run(e.shiftKey ? 'filter-prev' : 'filter-next');
          break;
        case 'q':
          e.preventDefault();
          run('requests');
          break;
        case 'p':
          e.preventDefault();
          run('pin');
          break;
        case 'u':
          e.preventDefault();
          run('unread');
          break;
        case '?':
          e.preventDefault();
          openPalette();
          break;
        case 'G':
          e.preventDefault();
          scrollListEdge(1);
          break;
        case 'g': {
          const now = Date.now();
          if (now - lastG < 500) {
            e.preventDefault();
            scrollListEdge(-1);
            lastG = 0;
          } else {
            lastG = now;
          }
          break;
        }
        case 'Escape':
          // On Message Requests, Esc backs out to the main inbox; the cursor is cleared
          // either way (after backing out, j/k restarts from the top of the inbox list).
          if (closeRequests()) e.preventDefault();
          select(null);
          break;
      }
    },
    true, // capture
  );
}

function scrollListEdge(dir: 1 | -1): void {
  const panel = document.querySelector<HTMLElement>(SEL.inboxPanel);
  if (!panel) return;
  const all = [panel, ...Array.from(panel.querySelectorAll<HTMLElement>('*'))];
  const scroller =
    all.find((el) => {
      const oy = getComputedStyle(el).overflowY;
      return (oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 4;
    }) ?? panel;
  scroller.scrollTo({ top: dir === 1 ? scroller.scrollHeight : 0 });
  if (dir === -1) requestAnimationFrame(() => selectFirst());
}
