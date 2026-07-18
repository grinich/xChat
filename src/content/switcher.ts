// ⌘J quick-switcher: fuzzy jump to a conversation. Matches over currently-rendered rows
// (virtualized list), and offers "Search X for …" as a fallback that routes the query to
// X's own server-side DM search for threads not currently in the DOM.

import { conversationRows, SEL } from './selectors';
import { convIdFromItemTestid } from '../lib/id-parse';
import { fuzzyRank } from '../lib/fuzzy';
import { openConversation, focusSearch } from './actions';

interface Entry {
  id: string;
  label: string;
  haystack: string;
}

let hostEl: HTMLDivElement | null = null;
let shadow: ShadowRoot | null = null;
let open = false;
let results: Entry[] = [];
let active = 0;

export function switcherOpen(): boolean {
  return open;
}

const CSS = `
  :host { all: initial; }
  .overlay { position: fixed; inset: 0; z-index: 2147483646; display: flex;
    align-items: flex-start; justify-content: center; background: rgba(0,0,0,.4); }
  .box { margin-top: 12vh; width: min(520px, 92vw); background: #15202b; color: #fff;
    border-radius: 14px; box-shadow: 0 20px 60px rgba(0,0,0,.5); overflow: hidden;
    font: 14px/1.4 -apple-system, system-ui, sans-serif; }
  input { all: unset; box-sizing: border-box; width: 100%; padding: 16px 18px; font-size: 16px;
    color: #fff; border-bottom: 1px solid rgba(255,255,255,.1); }
  input::placeholder { color: #8899a6; }
  ul { list-style: none; margin: 0; padding: 6px; max-height: 50vh; overflow: auto; }
  li { padding: 10px 12px; border-radius: 8px; cursor: pointer; white-space: nowrap;
    overflow: hidden; text-overflow: ellipsis; }
  li[aria-selected='true'] { background: rgba(29,155,240,.18); }
  .search { color: #8899a6; }
`;

function collect(): Entry[] {
  const out: Entry[] = [];
  const seen = new Set<string>();
  for (const row of conversationRows()) {
    const id = convIdFromItemTestid(row.getAttribute('data-testid'));
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const text = (row.innerText || '').trim();
    const label = text.split('\n').map((s) => s.trim()).filter(Boolean)[0] || id;
    out.push({ id, label, haystack: text.replace(/\s+/g, ' ') });
  }
  return out;
}

function ensure(): ShadowRoot {
  if (shadow) return shadow;
  hostEl = document.createElement('div');
  hostEl.id = 'tchat-switcher-host';
  document.documentElement.appendChild(hostEl);
  shadow = hostEl.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = CSS;
  shadow.appendChild(style);
  return shadow;
}

export function openSwitcher(): void {
  if (open) return;
  open = true;
  const root = ensure();
  const all = collect();
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.innerHTML = `
    <div class="box" role="dialog" aria-label="Quick switcher">
      <input type="text" placeholder="Jump to conversation…" autocomplete="off" spellcheck="false" />
      <ul></ul>
    </div>`;
  root.appendChild(overlay);
  const input = overlay.querySelector('input') as HTMLInputElement;
  const list = overlay.querySelector('ul') as HTMLUListElement;

  const refresh = () => {
    const q = input.value;
    const matched = q ? fuzzyRank(q, all, (e) => e.haystack).map((r) => r.item) : all;
    results = matched.slice(0, 50);
    active = 0;
    render(list, q);
  };

  input.addEventListener('input', refresh);
  overlay.addEventListener('mousedown', (e) => {
    if (e.target === overlay) closeSwitcher();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeSwitcher();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      active = Math.min(active + 1, list.children.length - 1);
      render(list, input.value, false);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      active = Math.max(active - 1, 0);
      render(list, input.value, false);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(input.value);
    }
  });
  list.addEventListener('click', (e) => {
    const li = (e.target as HTMLElement).closest('li');
    if (!li) return;
    active = Number(li.dataset.idx);
    choose(input.value);
  });

  refresh();
  input.focus();
}

function render(list: HTMLUListElement, query: string, rebuild = true): void {
  if (rebuild) {
    const rows = results.map(
      (e, i) =>
        `<li data-idx="${i}" data-kind="conv" aria-selected="${i === active}">${escapeHtml(
          e.label,
        )}</li>`,
    );
    // Fallback item: hand off to X's server-side search.
    if (query.trim()) {
      rows.push(
        `<li data-idx="${results.length}" data-kind="search" aria-selected="${
          results.length === active
        }" class="search">Search X for “${escapeHtml(query.trim())}”</li>`,
      );
    }
    list.innerHTML = rows.join('') || `<li class="search">No matches — type to search</li>`;
  } else {
    Array.from(list.children).forEach((li, i) =>
      (li as HTMLElement).setAttribute('aria-selected', String(i === active)),
    );
  }
  list.children[active]?.scrollIntoView({ block: 'nearest' });
}

function choose(query: string): void {
  const el = shadow?.querySelector(`li[data-idx="${active}"]`) as HTMLElement | null;
  const kind = el?.dataset.kind;
  closeSwitcher();
  if (kind === 'search') {
    if (focusSearch()) typeIntoSearch(query.trim());
  } else if (results[active]) {
    openConversation(results[active].id);
  }
}

function typeIntoSearch(text: string): void {
  const bar = document.querySelector(SEL.searchBar);
  const input = bar?.querySelector('input,textarea') as HTMLInputElement | null;
  if (!input) return;
  const proto = Object.getOwnPropertyDescriptor(
    input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
    'value',
  );
  proto?.set?.call(input, text);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

export function closeSwitcher(): void {
  if (!open || !shadow) return;
  open = false;
  shadow.querySelector('.overlay')?.remove();
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}
