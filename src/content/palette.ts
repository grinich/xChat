// ⌘K command palette. Self-contained in a shadow root so X's CSS can't leak in/out.

import { paletteCommands, type Command } from './commands';
import { fuzzyRank } from '../lib/fuzzy';

let hostEl: HTMLDivElement | null = null;
let shadow: ShadowRoot | null = null;
let open = false;
let items: Command[] = [];
let active = 0;

export function paletteOpen(): boolean {
  return open;
}

const CSS = `
  :host { all: initial; }
  .overlay { position: fixed; inset: 0; z-index: 2147483646; display: flex;
    align-items: flex-start; justify-content: center; background: rgba(0,0,0,.4); }
  .box { margin-top: 12vh; width: min(560px, 92vw); background: #15202b; color: #fff;
    border-radius: 14px; box-shadow: 0 20px 60px rgba(0,0,0,.5); overflow: hidden;
    font: 14px/1.4 -apple-system, system-ui, sans-serif; }
  input { all: unset; box-sizing: border-box; width: 100%; padding: 16px 18px; font-size: 16px;
    color: #fff; border-bottom: 1px solid rgba(255,255,255,.1); }
  input::placeholder { color: #8899a6; }
  ul { list-style: none; margin: 0; padding: 6px; max-height: 50vh; overflow: auto; }
  li { display: flex; justify-content: space-between; align-items: center; gap: 12px;
    padding: 10px 12px; border-radius: 8px; cursor: pointer; }
  li[aria-selected='true'] { background: rgba(29,155,240,.18); }
  .hint { color: #8899a6; font-size: 12px; font-variant-numeric: tabular-nums; }
  .empty { padding: 16px 18px; color: #8899a6; }
`;

function ensure(): ShadowRoot {
  if (shadow) return shadow;
  hostEl = document.createElement('div');
  hostEl.id = 'tchat-palette-host';
  document.documentElement.appendChild(hostEl);
  shadow = hostEl.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = CSS;
  shadow.appendChild(style);
  return shadow;
}

export function openPalette(): void {
  if (open) return;
  open = true;
  const root = ensure();
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.innerHTML = `
    <div class="box" role="dialog" aria-label="Command palette">
      <input type="text" placeholder="Type a command…" autocomplete="off" spellcheck="false" />
      <ul></ul>
    </div>`;
  root.appendChild(overlay);

  const input = overlay.querySelector('input') as HTMLInputElement;
  const list = overlay.querySelector('ul') as HTMLUListElement;

  const refresh = () => {
    const q = input.value;
    items = q
      ? fuzzyRank(q, paletteCommands(), (c) => c.title).map((r) => r.item)
      : paletteCommands();
    active = 0;
    render(list);
  };

  input.addEventListener('input', refresh);
  overlay.addEventListener('mousedown', (e) => {
    if (e.target === overlay) closePalette();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closePalette();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      active = Math.min(active + 1, items.length - 1);
      render(list);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      active = Math.max(active - 1, 0);
      render(list);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      runActive();
    }
  });
  list.addEventListener('click', (e) => {
    const li = (e.target as HTMLElement).closest('li');
    if (!li) return;
    active = Number(li.dataset.idx);
    runActive();
  });

  refresh();
  input.focus();
}

function render(list: HTMLUListElement): void {
  if (!items.length) {
    list.innerHTML = `<div class="empty">No commands</div>`;
    return;
  }
  list.innerHTML = items
    .map(
      (c, i) =>
        `<li data-idx="${i}" aria-selected="${i === active}"><span>${escapeHtml(
          c.title,
        )}</span>${c.hint ? `<span class="hint">${escapeHtml(c.hint)}</span>` : ''}</li>`,
    )
    .join('');
  const sel = list.querySelector('li[aria-selected="true"]');
  sel?.scrollIntoView({ block: 'nearest' });
}

function runActive(): void {
  const cmd = items[active];
  closePalette();
  cmd?.run();
}

export function closePalette(): void {
  if (!open || !shadow) return;
  open = false;
  const overlay = shadow.querySelector('.overlay');
  overlay?.remove();
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}
