// Header tweaks: rename "Chat" → "xChat", and collapse X's full-width search bar into a
// compact search button placed just left of the "All" filter dropdown. Re-applied by the
// observer since X re-renders the header.

import { SEL, $ } from './selectors';
import { focusSearch } from './actions';

const SEARCH_BTN_ID = 'xchat-search-btn';
const SEARCH_OPEN_CLASS = 'xchat-search-open';

export function applyHeader(): void {
  // "Chat" → "xChat"
  const title = $(SEL.inboxTitle);
  if (title && title.textContent !== 'xChat') title.textContent = 'xChat';

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

}

function toggleSearch(): void {
  if (document.documentElement.classList.contains(SEARCH_OPEN_CLASS)) {
    document.documentElement.classList.remove(SEARCH_OPEN_CLASS);
  } else {
    // focusSearch reveals the bar, mounts X's input, focuses it, and wires close-on-blur.
    focusSearch();
  }
}
