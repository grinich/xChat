// Thin wrappers that drive X's own DM controls. We never fabricate data or bypass X;
// we click the elements a user would click and type into the real composer.

import { SEL, $, conversationRows } from './selectors';
import { convIdFromItemTestid, routeFor, toColon } from '../lib/id-parse';

/** Find a rendered conversation row by id (colon form). */
export function rowFor(id: string): HTMLElement | null {
  const want = toColon(id);
  for (const row of conversationRows()) {
    if (convIdFromItemTestid(row.getAttribute('data-testid')) === want) return row;
  }
  return null;
}

/** Open a conversation via focus-free SPA navigation (pushState + popstate). We deliberately
 *  do NOT click the row's anchor: clicking focuses it and X flashes a blue focus ring. The
 *  History API drives X's router without moving focus onto any row, so no outline ever shows. */
export function openConversation(id: string): void {
  navigate(routeFor(id));
}

/** SPA-friendly navigation: push state + popstate so X's router reacts without a reload. */
export function navigate(path: string): void {
  history.pushState(null, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function focusComposer(): boolean {
  const ta = $(SEL.composerTextarea) as HTMLTextAreaElement | null;
  if (!ta) return false;
  ta.focus();
  return true;
}

/** Set composer text via React-safe native setter + input event. */
export function setComposerText(text: string): boolean {
  const ta = $(SEL.composerTextarea) as HTMLTextAreaElement | null;
  if (!ta) return false;
  const proto = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
  proto?.set?.call(ta, text);
  ta.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
}

/** Submit the composer (send). Prefer a native form submit; fall back to Enter keypress. */
export function sendComposer(): boolean {
  const form = $(SEL.composerForm) as HTMLFormElement | null;
  const ta = $(SEL.composerTextarea) as HTMLTextAreaElement | null;
  if (!ta || !(ta.value && ta.value.trim())) return false;
  if (form && typeof form.requestSubmit === 'function') {
    form.requestSubmit();
    return true;
  }
  // Fallback: dispatch Enter on the textarea (X sends on Enter).
  const opts = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true } as const;
  ta.dispatchEvent(new KeyboardEvent('keydown', opts));
  ta.dispatchEvent(new KeyboardEvent('keyup', opts));
  return true;
}

export function newChat(): void {
  ($(SEL.newChatButton) as HTMLElement | null)?.click();
}

const PANEL_INPUT = '[data-testid="dm-inbox-panel"] input, [data-testid="dm-inbox-panel"] textarea';

/** Reveal + activate X's DM search and focus its input. X's search bar is a placeholder that
 *  mounts a real <input> only on a genuine pointer interaction (a plain .click() isn't enough),
 *  after which X focuses it; we simulate the full pointer sequence and wire close-on-blur. */
export function focusSearch(): boolean {
  document.documentElement.classList.add('xchat-search-open');

  // Already active? just focus the mounted input.
  const existing = $(PANEL_INPUT) as HTMLElement | null;
  if (existing) {
    existing.focus();
    return true;
  }

  const bar = $(SEL.searchBar);
  if (!bar) return false;
  for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
    bar.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
  }

  setTimeout(() => {
    const inp = $(PANEL_INPUT) as HTMLInputElement | null;
    if (!inp) return;
    if (document.activeElement !== inp) inp.focus();
    if (!inp.dataset.xchatWired) {
      inp.dataset.xchatWired = '1';
      // Collapse back to the header button when the user leaves an empty search.
      inp.addEventListener('blur', () => {
        if (!inp.value) document.documentElement.classList.remove('xchat-search-open');
      });
    }
  }, 40);
  return true;
}

export function openRequests(): void {
  ($(SEL.requestsButton) as HTMLElement | null)?.click();
}

export function openInboxFilter(): void {
  ($(SEL.inboxDropdownTrigger) as HTMLElement | null)?.click();
}

/** Open the conversation info/settings panel (where mute/block/delete live). */
export function openConversationMenu(): void {
  ($(SEL.conversationMoreButton) as HTMLElement | null)?.click();
}

/** The conversation id of the currently open thread, from the URL. */
export function currentConversationId(): string | null {
  const m = location.pathname.match(/\/i\/chat\/([^/?#]+)/);
  return m ? toColon(m[1]) : null;
}
