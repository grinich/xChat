// Header tweaks: rename "Chat" → "xChat", and collapse X's full-width search bar into a
// compact search button placed just left of the "All" filter dropdown. Re-applied by the
// observer since X re-renders the header.

import { SEL, $ } from './selectors';
import { focusSearch } from './actions';

const SEARCH_BTN_ID = 'tchat-search-btn';
const SEARCH_OPEN_CLASS = 'tchat-search-open';

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
    btn.className = 'tchat-header-btn';
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">' +
      '<path fill="currentColor" d="M10.25 3.75a6.5 6.5 0 104.02 11.6l4.69 4.69 1.06-1.06-4.69-4.69A6.5 6.5 0 0010.25 3.75zm-5 6.5a5 5 0 1110 0 5 5 0 01-10 0z"/></svg>';
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      toggleSearch();
    });
    dropdown.parentElement.insertBefore(btn, dropdown);
  }

  // Collapse the search back to the button when the user leaves an empty search field.
  const bar = $(SEL.searchBar);
  const input = bar?.querySelector<HTMLInputElement>('input,textarea');
  if (input && !input.dataset.tchatWired) {
    input.dataset.tchatWired = '1';
    input.addEventListener('blur', () => {
      if (!input.value) document.documentElement.classList.remove(SEARCH_OPEN_CLASS);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        input.blur();
        document.documentElement.classList.remove(SEARCH_OPEN_CLASS);
      }
    });
  }
}

function toggleSearch(): void {
  const open = document.documentElement.classList.toggle(SEARCH_OPEN_CLASS);
  if (open) setTimeout(() => focusSearch(), 0);
}
