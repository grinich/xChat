// Header tweaks: add an X-logo home button at the far left, and collapse X's full-width
// search bar into a compact search button just left of the "All" filter dropdown. We keep
// X's own "Chat" title. Re-applied by the observer + activate() since X re-renders the header.

import { SEL, $ } from './selectors';
import { focusSearch, navigate } from './actions';

const SEARCH_BTN_ID = 'xchat-search-btn';
const HOME_BTN_ID = 'xchat-home-btn';
const ESC_HINT_ID = 'xchat-esc-hint';
const SEARCH_OPEN_CLASS = 'xchat-search-open';

// The X wordmark logo (24x24), used as a home button in the chat header.
const X_LOGO_PATH =
  'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z';

export function applyHeader(): void {
  // We keep X's own "Chat" title text as-is (no in-app rename).
  const title = $(SEL.inboxTitle);

  // X logo (home button) at the far left of the chat header — we hide X's nav rail in the
  // full-screen reskin, so this keeps a way back home. Clicking navigates to /home.
  if (title?.parentElement && !document.getElementById(HOME_BTN_ID)) {
    const logo = document.createElement('button');
    logo.id = HOME_BTN_ID;
    logo.type = 'button';
    logo.setAttribute('aria-label', 'Home');
    logo.className = 'xchat-home-btn';
    logo.innerHTML =
      `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="${X_LOGO_PATH}"/></svg>`;
    logo.addEventListener('click', (e) => {
      e.preventDefault();
      navigate('/home');
    });
    title.parentElement.insertBefore(logo, title);
  }

  // Search button, injected once, immediately before the "All" dropdown.
  const dropdown = $(SEL.inboxDropdownTrigger);
  if (dropdown?.parentElement && !document.getElementById(SEARCH_BTN_ID)) {
    const btn = document.createElement('button');
    btn.id = SEARCH_BTN_ID;
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Search');
    btn.className = 'xchat-header-btn';
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">' +
      '<path fill="currentColor" d="M10.25 3.75a6.5 6.5 0 104.02 11.6l4.69 4.69 1.06-1.06-4.69-4.69A6.5 6.5 0 0010.25 3.75zm-5 6.5a5 5 0 1110 0 5 5 0 01-10 0z"/></svg>';
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      toggleSearch();
    });
    dropdown.parentElement.insertBefore(btn, dropdown);
  }

  // "esc" keycap next to the Message Requests back button (Esc backs out to the inbox).
  // X unmounts the requests header when leaving the view, taking the hint with it, so we
  // only ever need to (re)insert — never remove.
  const back = $(SEL.requestsBackButton);
  if (back?.parentElement && !document.getElementById(ESC_HINT_ID)) {
    const hint = document.createElement('span');
    hint.id = ESC_HINT_ID;
    hint.className = 'xchat-esc-hint';
    hint.setAttribute('aria-hidden', 'true');
    hint.innerHTML = '<kbd>esc</kbd>';
    back.after(hint);
  }

  // Always-visible keycaps on the header buttons (search / filter / requests / new chat).
  addButtonHint('xchat-hint-search', document.getElementById(SEARCH_BTN_ID), '/');
  addButtonHint('xchat-hint-filter', $(SEL.inboxDropdownTrigger), 'tab');
  addButtonHint('xchat-hint-requests', $(SEL.requestsButton), 'Q');
  addButtonHint('xchat-hint-newchat', $(SEL.newChatButton), 'C');
}

/** Insert a small keycap INSIDE a header button, pinned to its bottom-left corner (CSS).
 *  Idempotent; X re-renders take the hint out with the button, so we only ever (re)insert. */
function addButtonHint(id: string, btn: HTMLElement | null, key: string): void {
  if (!btn || document.getElementById(id)) return;
  const hint = document.createElement('span');
  hint.id = id;
  hint.className = 'xchat-btn-hint';
  hint.setAttribute('aria-hidden', 'true');
  hint.innerHTML = `<kbd>${key}</kbd>`;
  btn.appendChild(hint);
}

function toggleSearch(): void {
  if (document.documentElement.classList.contains(SEARCH_OPEN_CLASS)) {
    document.documentElement.classList.remove(SEARCH_OPEN_CLASS);
  } else {
    // focusSearch reveals the bar, mounts X's input, focuses it, and wires close-on-blur.
    focusSearch();
  }
}
