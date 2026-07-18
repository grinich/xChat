// j/k selection cursor over the (virtualized) conversation list.
// We track the selected conversation by ID and anchor moves on the selected row ELEMENT,
// so rows mounting/unmounting as the list virtualizes can't make us skip.

import { SEL, conversationRows } from './selectors';
import { convIdFromItemTestid } from '../lib/id-parse';
import { openConversation, currentConversationId } from './actions';

const SELECTED_CLASS = 'tchat-selected';

let selectedId: string | null = null;

export function getSelectedId(): string | null {
  return selectedId;
}

function renderedIds(): string[] {
  return conversationRows()
    .map((r) => convIdFromItemTestid(r.getAttribute('data-testid')))
    .filter((x): x is string => !!x);
}

/** Re-apply the highlight class to the selected row (called by the MutationObserver too). */
export function applyHighlight(): void {
  for (const row of conversationRows()) {
    const id = convIdFromItemTestid(row.getAttribute('data-testid'));
    row.classList.toggle(SELECTED_CLASS, !!id && id === selectedId);
  }
}

function scrollSelectedIntoView(): void {
  for (const row of conversationRows()) {
    if (convIdFromItemTestid(row.getAttribute('data-testid')) === selectedId) {
      // 'instant' so the cursor never lags behind the keypress, even if X sets
      // scroll-behavior: smooth on the list.
      row.scrollIntoView({ block: 'nearest', behavior: 'instant' as ScrollBehavior });
      return;
    }
  }
}

export function select(id: string | null): void {
  selectedId = id;
  applyHighlight();
  if (id) scrollSelectedIntoView();
}

let openTimer = 0;

/** Select immediately (highlight + scroll), and open the thread on a short debounce.
 *  Opening marks the conversation read, which makes X reorder the list — doing that on every
 *  keystroke desyncs the highlight and causes multi-row jumps. A short debounce keeps single
 *  presses feeling instant while coalescing a held/repeated key so it doesn't churn the list. */
function selectAndOpen(id: string): void {
  select(id);
  clearTimeout(openTimer);
  openTimer = window.setTimeout(() => {
    if (selectedId) openConversation(selectedId);
  }, 70);
}

const idOf = (el: HTMLElement) => convIdFromItemTestid(el.getAttribute('data-testid'));

/** Move the cursor AND open the newly-selected thread (j/k browses threads directly).
 *  Anchors on the selected ROW ELEMENT (not an index into a freshly-queried array) so the
 *  virtualized list re-rendering mid-move can't make us skip rows. */
export function move(dir: 1 | -1): void {
  const rows = conversationRows();
  if (!rows.length) return;

  const curIdx = rows.findIndex((r) => idOf(r) === selectedId);
  if (curIdx === -1) {
    // No selection (or it scrolled out of view): pick the first/last visible.
    const id = idOf(dir === 1 ? rows[0] : rows[rows.length - 1]);
    if (id) selectAndOpen(id);
    return;
  }

  const nextEl = rows[curIdx + dir];
  if (nextEl) {
    const id = idOf(nextEl);
    if (id) selectAndOpen(id);
    return;
  }

  // At the rendered edge: scroll the CURRENT row to the viewport edge so it stays mounted
  // and the adjacent row renders, then step to that neighbor. Keeping the current element
  // as the anchor is what prevents skips when virtualization recycles rows.
  rows[curIdx].scrollIntoView({ block: dir === 1 ? 'start' : 'end' });
  requestAnimationFrame(() => {
    const rows2 = conversationRows();
    const i2 = rows2.findIndex((r) => idOf(r) === selectedId);
    const target = i2 >= 0 ? rows2[i2 + dir] : undefined;
    if (target) {
      const id = idOf(target);
      if (id) selectAndOpen(id);
    }
    // If still nothing rendered in that direction, stay put — never skip.
  });
}

export function openSelected(): void {
  clearTimeout(openTimer);
  if (selectedId) openConversation(selectedId);
}

export function selectFirst(): void {
  const ids = renderedIds();
  if (ids.length) select(ids[0]);
}

/** Sync the cursor to a mouse-clicked row WITHOUT scrolling (the row is already visible). */
function syncSelectionFromClick(id: string): void {
  selectedId = id;
  applyHighlight();
}

/** When the user clicks a conversation, keep our cursor in step so j/k continues from there
 *  (and the highlight doesn't jump back to the previous selection). */
export function installClickSync(): void {
  document.addEventListener(
    'click',
    (e) => {
      const row = (e.target as HTMLElement | null)?.closest?.(SEL.conversationItems);
      if (!row) return;
      const id = convIdFromItemTestid(row.getAttribute('data-testid'));
      if (id) syncSelectionFromClick(id);
    },
    true,
  );
}

/** Highlight the currently-open thread's row once the list renders. On the bare inbox
 *  (no thread open) we select nothing — the cursor appears only once you open a thread or
 *  press j/k, so a fresh load doesn't show a phantom selection on the first row. */
export function selectInitialWhenReady(attempts = 20): void {
  const cur = currentConversationId();
  if (!cur) return; // nothing open → no selection
  if (renderedIds().includes(cur)) {
    select(cur);
    return;
  }
  if (attempts > 0) setTimeout(() => selectInitialWhenReady(attempts - 1), 200);
}
