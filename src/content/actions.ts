// Thin wrappers that drive X's own DM controls. We never fabricate data or bypass X;
// we click the elements a user would click and type into the real composer.

import { SEL, $, conversationRows } from './selectors';
import { convIdFromItemTestid, convIdFromPath, routeFor, toColon } from '../lib/id-parse';
import { requestComposerFocus } from './composer-focus';
import { toast } from './toast';

/** Find a rendered conversation row by id (colon form). */
export function rowFor(id: string): HTMLElement | null {
  const want = toColon(id);
  for (const row of conversationRows()) {
    if (convIdFromItemTestid(row.getAttribute('data-testid')) === want) return row;
  }
  return null;
}

/** Open a conversation by clicking the inbox row's OWN anchor. X attaches a React onClick to
 *  that <a> that does a router PUSH — instant, in-place, no page reload and no slide. The
 *  focus side effects are handled elsewhere so this stays focus-free in practice: X's auto-
 *  focus of the composer is blurred by the composer focus guard, and the inbox panel suppresses
 *  the anchor's focus outline in CSS. Falls back to the History API only if the row isn't
 *  currently rendered (virtualized off-screen). */
export function openConversation(id: string): void {
  const row = rowFor(id);
  // Inbox rows are a <div> wrapping the thread <a>; message-request rows ARE the <a>
  // (their first inner anchor is the sender's profile link — clicking it would leave DMs).
  const anchor = row?.matches('a[href]') ? row : (row?.querySelector('a[href]') as HTMLElement | null);
  if (anchor) {
    anchor.click();
    return;
  }
  historyNavigate(routeFor(id, onRequestsView()));
}

/** Are we on the message-requests view (list or an open request thread)? */
export function onRequestsView(): boolean {
  return location.pathname.startsWith('/i/chat/requests');
}

/** SPA navigation that matches how X's own links behave — a router PUSH (no reload, no slide).
 *
 *  We used to do `history.pushState` + a synthetic `popstate`, but X's router reads a popstate
 *  as a *backward* navigation and plays a vertical slide transition — the "weird animation"
 *  seen flipping between the main app and chat. And a throwaway <a> we build ourselves isn't
 *  wired to X's router, so clicking it triggers the browser's default full-page load. The only
 *  clean path is to click one of X's OWN nav anchors, whose React onClick does an in-place
 *  push. Those anchors stay in the DOM even though our reskin hides X's nav rail (display:none
 *  still dispatches a programmatic .click() to React), so we find the anchor for this route and
 *  click it. Falls back to the History API if X has no anchor for the path. */
export function navigate(path: string): void {
  const anchor =
    (document.querySelector(`a[href="${path}"]`) as HTMLElement | null) ??
    (path === '/home' ? (document.querySelector('a[aria-label="Home"]') as HTMLElement | null) : null);
  if (anchor) {
    anchor.click();
    return;
  }
  historyNavigate(path);
}

/** Last-resort navigation when no real X anchor is available for the route. Uses the History
 *  API + popstate so X's router reacts without a reload; this is the only path that can still
 *  show X's slide transition, so we reach it only when a real-anchor click isn't possible. */
function historyNavigate(path: string): void {
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

/** One send mechanism, attempted against the live composer. Callers (the WebMCP send
 *  tool) escalate through mechanisms and verify each one by watching X clear the
 *  textarea — none of these can confirm delivery on their own, so this function only
 *  reports whether the attempt had a present, armed target. (form.requestSubmit() was
 *  the old approach; X's send handler ignores it, which made "sends" silently no-op.) */
export type SendAttempt = 'button-click' | 'button-pointer' | 'enter-key';

export function attemptComposerSend(how: SendAttempt): boolean {
  const ta = $(SEL.composerTextarea) as HTMLTextAreaElement | null;
  if (!ta || !ta.value.trim()) return false;
  if (how === 'enter-key') {
    // X sends on Enter. Synthetic keydowns don't insert text, so a failed attempt
    // can't corrupt the draft.
    const opts = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true } as const;
    ta.dispatchEvent(new KeyboardEvent('keydown', opts));
    ta.dispatchEvent(new KeyboardEvent('keyup', opts));
    return true;
  }
  const btn = $(SEL.composerSendButton) as HTMLButtonElement | null;
  if (!btn || btn.disabled) return false;
  if (how === 'button-click') btn.click();
  else synthPointerClick(btn);
  return true;
}

export function newChat(): void {
  ($(SEL.newChatButton) as HTMLElement | null)?.click();
}

/** Synthesize a full pointer interaction. Some X controls (the radix filter dropdown, the
 *  search-bar placeholder) ignore a bare .click() and only react to real pointer events. */
function synthPointerClick(el: HTMLElement): void {
  for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
    el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
  }
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
  synthPointerClick(bar);

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

/** Leave the Message Requests view via its own back button. Returns false when not on it. */
export function closeRequests(): boolean {
  const back = $(SEL.requestsBackButton);
  if (!back) return false;
  back.click();
  return true;
}

export function openInboxFilter(): void {
  const trig = $(SEL.inboxDropdownTrigger);
  if (trig) synthPointerClick(trig);
}

export type InboxFilter = 'all' | 'unread' | 'oneonone' | 'groups';

/** While set on <html>, style.css keeps [role=menu] popovers invisible. Used when we drive
 *  X's menus programmatically — a shortcut should feel like a direct switch, with no menu
 *  flashing open. */
const SILENT_MENU_CLASS = 'xchat-silent-menu';

/** Run a menu-driving interaction with all menus hidden. The `done` callback keeps menus
 *  hidden until the (radix-animated) unmount finishes, then unhides; a safety timer makes
 *  sure we never leave menus invisible if the interaction goes sideways. */
function withSilentMenus(run: (done: () => void) => void): void {
  const html = document.documentElement;
  html.classList.add(SILENT_MENU_CLASS);
  let finished = false;
  const done = () => {
    if (finished) return;
    finished = true;
    let waits = 20;
    const poll = () => {
      if (!document.querySelector('[role="menu"]') || waits-- <= 0) {
        html.classList.remove(SILENT_MENU_CLASS);
      } else {
        setTimeout(poll, 50);
      }
    };
    poll();
  };
  run(done);
  setTimeout(done, 2500);
}

/** Dismiss any open popover menu (radix closes on Escape). */
function closeAnyMenu(): void {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
}

/** Switch the inbox filter (All / Unread / Direct / Groups) by driving X's own dropdown.
 *  The menu is a radix portal that only exists while open, so we open it (invisibly),
 *  then click the item once it mounts. */
export function setInboxFilter(filter: InboxFilter): void {
  const item = () => $(`[data-testid="${SEL.inboxDropdownItemPrefix}${filter}"]`);
  const existing = item();
  if (existing) {
    // The user opened the menu themselves — it's visible; just pick the item.
    synthPointerClick(existing);
    return;
  }
  withSilentMenus((done) => {
    openInboxFilter();
    let tries = 10;
    const tick = () => {
      const el = item();
      if (el) {
        synthPointerClick(el);
        done();
        return;
      }
      if (--tries > 0) setTimeout(tick, 50);
      else done();
    };
    setTimeout(tick, 50);
  });
}

/** A row-context-menu action: which menu entry to click and what to say about it.
 *  X's menu items carry no testids, so entries are matched by label. */
interface RowMenuSpec {
  /** Matches the target entry's label. Mind substrings — e.g. "Unpin conversation" contains
   *  "pin conversation", which is how the pin spec reads the toggle direction. */
  item: RegExp;
  /** Toast for a successful click, given the clicked entry's label. */
  toastFor: (label: string) => string;
  /** Toast when the menu opens without the entry (null = close silently). Message-request
   *  rows have a reduced menu, and "Mark as unread" is absent on already-unread threads. */
  missingToast: string | null;
}

const PIN_SPEC: RowMenuSpec = {
  item: /pin conversation/i, // no \b before "pin" — it must also match "Unpin conversation"
  toastFor: (label) => (/^\s*unpin/i.test(label) ? 'Unpinned conversation' : 'Pinned conversation'),
  missingToast: null,
};

const UNREAD_SPEC: RowMenuSpec = {
  item: /mark as unread/i,
  toastFor: () => 'Marked as unread',
  missingToast: "Can't mark this as unread",
};

/** Toggle pin on a conversation by driving X's row context menu (right-click →
 *  "Pin conversation" / "Unpin conversation"). */
export function togglePin(id: string | null): boolean {
  return rowMenuAction(id, PIN_SPEC);
}

/** Mark a conversation unread via the same row context menu ("Mark as unread"). */
export function markUnread(id: string | null): boolean {
  return rowMenuAction(id, UNREAD_SPEC);
}

/** Run a row-menu action on a conversation. The menu opens for any MOUNTED row — even one
 *  scrolled off-screen — so no scrolling is needed unless virtualization has unmounted the
 *  row entirely. In that case we hunt for it by paging the list with the inbox visually
 *  hidden, then restore the scroll position before unhiding, so the user never sees the
 *  list move. Every terminal outcome shows a toast except a null missingToast bail.
 *  Returns false only when there's no id. */
function rowMenuAction(id: string | null, spec: RowMenuSpec): boolean {
  if (!id) return false;
  const row = rowFor(id);
  if (row) {
    actViaRowMenu(row, spec);
    return true;
  }
  // Row not mounted (virtualized out): page through the list from the top until it renders.
  const scroller = inboxScroller();
  if (!scroller) {
    toast('Conversation not found in the list', undefined, 2400, 'top');
    return true;
  }
  const restoreTop = scroller.scrollTop;
  // Cover the list with a static snapshot of itself while we page it — the hunt takes
  // ~100-400ms, and both the scroll churn and a blank (opacity-0) list read as a visible
  // flash. The clone is inert pixels: testids are stripped so none of our selectors
  // (rowFor, the observer, scrollListEdge) can match the copy, and pointer-events stay off
  // so clicks and elementFromPoint pass through to the real DOM.
  const cover = scroller.cloneNode(true) as HTMLElement;
  cover.removeAttribute('data-testid');
  for (const el of Array.from(cover.querySelectorAll('[data-testid]'))) el.removeAttribute('data-testid');
  const rect = scroller.getBoundingClientRect();
  const bodyBg = getComputedStyle(document.body).backgroundColor;
  Object.assign(cover.style, {
    position: 'fixed',
    top: `${rect.top}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    overflow: 'hidden',
    margin: '0',
    zIndex: '99999',
    pointerEvents: 'none',
    background: !bodyBg || bodyBg === 'rgba(0, 0, 0, 0)' ? '#000' : bodyBg,
  });
  cover.setAttribute('aria-hidden', 'true');
  document.body.appendChild(cover);
  cover.scrollTop = restoreTop; // overflow:hidden still scrolls programmatically
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    scroller.scrollTop = restoreTop;
    // Lift the cover a beat later: the virtualizer needs a frame or two to re-mount rows
    // at the restored position, and the cover shows exactly those pixels in the meantime.
    setTimeout(() => cover.remove(), 120);
  };
  const safety = window.setTimeout(cleanup, 4000);
  let pages = 30; // safety cap — the bottom of the list lazy-loads forever
  scroller.scrollTop = 0;
  const hunt = () => {
    const found = rowFor(id);
    if (found) {
      actViaRowMenu(found, spec, () => {
        window.clearTimeout(safety);
        cleanup();
      });
      return;
    }
    const atBottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1;
    if (atBottom || --pages <= 0) {
      window.clearTimeout(safety);
      cleanup();
      toast('Conversation not found in the list', undefined, 2400, 'top');
      return;
    }
    scroller.scrollTop += scroller.clientHeight;
    setTimeout(hunt, 50); // give virtualization a beat to mount the next page of rows
  };
  setTimeout(hunt, 50);
  return true;
}

/** The inbox list's scroll container: nearest scrollable ancestor of a rendered row. */
function inboxScroller(): HTMLElement | null {
  let el = conversationRows()[0]?.parentElement ?? null;
  for (; el && el !== document.body; el = el.parentElement) {
    if (el.scrollHeight > el.clientHeight + 1) return el;
  }
  return null;
}

/** Where X's contextmenu handler for a row actually lives, best guess first. Verified live:
 *  it's on the row-body <div> INSIDE the thread <a> (`row > a > div`) — dispatching on the
 *  <a> itself does nothing (the event starts above the handler and never bubbles through
 *  it), and the event coordinates are irrelevant, which is why off-screen rows work. The
 *  elementFromPoint hit is kept as the first candidate for visible rows in case X moves
 *  the handler deeper. */
function rowMenuTargets(row: HTMLElement): HTMLElement[] {
  const r = row.getBoundingClientRect();
  const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  const candidates = [
    row.contains(hit) ? (hit as HTMLElement) : null,
    row.querySelector<HTMLElement>(':scope > a > div'),
    row.querySelector<HTMLElement>('a > div'),
    row.querySelector<HTMLElement>(':scope > div'),
    row,
  ];
  return [...new Set(candidates.filter((el): el is HTMLElement => !!el))];
}

/** Open a (mounted) row's context menu invisibly and click the spec's entry. The menu
 *  reacts to PointerEvents with a real pointerType, not bare MouseEvents. Candidate
 *  targets are tried in turn until one opens the menu; a menu that opens WITHOUT the
 *  entry ends the attempt (spec.missingToast says whether that's worth a toast).
 *  `after` runs once the interaction settles (success or bail). */
function actViaRowMenu(row: HTMLElement, spec: RowMenuSpec, after?: () => void): void {
  withSilentMenus((done) => {
    const finish = () => {
      done();
      after?.();
    };
    const r = row.getBoundingClientRect();
    const base = { bubbles: true, cancelable: true, view: window, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, pointerId: 1, pointerType: 'mouse', isPrimary: true } as const;
    const candidates = rowMenuTargets(row);
    let ci = 0;
    const attempt = () => {
      const target = candidates[ci++];
      if (!target) {
        toast("Couldn't open the conversation menu", undefined, 2400, 'top');
        finish();
        return;
      }
      target.dispatchEvent(new PointerEvent('pointerdown', { ...base, button: 2, buttons: 2 }));
      target.dispatchEvent(new MouseEvent('mousedown', { ...base, button: 2, buttons: 2 }));
      target.dispatchEvent(new PointerEvent('pointerup', { ...base, button: 2, buttons: 0 }));
      target.dispatchEvent(new MouseEvent('contextmenu', { ...base, button: 2 }));
      let tries = 6;
      const tick = () => {
        const menuItem = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]')).find((el) =>
          spec.item.test(el.textContent ?? ''),
        );
        if (menuItem) {
          // Read the label BEFORE clicking — for toggles it tells us which way we went.
          const label = menuItem.textContent ?? '';
          const ir = menuItem.getBoundingClientRect();
          const b = { ...base, clientX: ir.left + 24, clientY: ir.top + ir.height / 2 };
          menuItem.dispatchEvent(new PointerEvent('pointermove', b));
          menuItem.dispatchEvent(new PointerEvent('pointerdown', { ...b, button: 0, buttons: 1 }));
          menuItem.dispatchEvent(new MouseEvent('mousedown', { ...b, button: 0, buttons: 1 }));
          menuItem.dispatchEvent(new PointerEvent('pointerup', { ...b, button: 0, buttons: 0 }));
          menuItem.dispatchEvent(new MouseEvent('mouseup', { ...b, button: 0, buttons: 0 }));
          menuItem.dispatchEvent(new MouseEvent('click', { ...b, button: 0, detail: 1 }));
          toast(spec.toastFor(label), undefined, 1600, 'top');
          finish();
          return;
        }
        if (--tries > 0) {
          setTimeout(tick, 50);
          return;
        }
        if (document.querySelector('[role="menu"]')) {
          // Menu opened but has no matching entry (e.g. a message request) — close and bail.
          closeAnyMenu();
          if (spec.missingToast) toast(spec.missingToast, undefined, 2400, 'top');
          finish();
        } else {
          // This target didn't own the handler; try the next candidate.
          attempt();
        }
      };
      setTimeout(tick, 50);
    };
    attempt();
  });
}

const FILTER_ORDER: InboxFilter[] = ['all', 'unread', 'oneonone', 'groups'];
const FILTER_LABELS: Record<string, InboxFilter> = { all: 'all', unread: 'unread', direct: 'oneonone', groups: 'groups' };

/** Cycle the inbox filter (Tab / Shift+Tab). The current filter is read from the dropdown
 *  trigger's own label — "All" / "Unread" / "Direct" / "Groups" (label-matched like the pin
 *  menu item; falls back to "all" if X renames/localizes them). The trigger also contains
 *  our injected "tab" keycap hint — exclude it from the read, or the label never matches
 *  and Tab gets stuck re-selecting the fallback's neighbor. */
export function cycleInboxFilter(dir: 1 | -1): void {
  const trig = $(SEL.inboxDropdownTrigger);
  const label = Array.from(trig?.childNodes ?? [])
    .filter((n) => !(n instanceof HTMLElement && n.classList.contains('xchat-btn-hint')))
    .map((n) => n.textContent ?? '')
    .join('')
    .trim()
    .toLowerCase();
  const cur = FILTER_LABELS[label] ?? 'all';
  const i = Math.max(0, FILTER_ORDER.indexOf(cur));
  setInboxFilter(FILTER_ORDER[(i + dir + FILTER_ORDER.length) % FILTER_ORDER.length]);
}

/** Accept the currently open message request (X's Accept button). Returns false when no
 *  request thread is open. */
export function acceptRequest(): boolean {
  const btn = $(SEL.requestAcceptButton);
  if (!btn) return false;
  btn.click();
  // Accepting swaps the Accept/Delete banner for the composer; focus it once it mounts so
  // the user can start typing a reply immediately.
  let tries = 20;
  const tick = () => {
    if (requestComposerFocus()) return;
    if (--tries > 0) setTimeout(tick, 100);
  };
  setTimeout(tick, 100);
  return true;
}

/** Open the conversation info/settings panel (where mute/block/delete live). */
export function openConversationMenu(): void {
  ($(SEL.conversationMoreButton) as HTMLElement | null)?.click();
}

/** The conversation id of the currently open thread, from the URL. */
export function currentConversationId(): string | null {
  return convIdFromPath(location.pathname);
}
