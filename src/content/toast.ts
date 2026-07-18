// Minimal toast, isolated in a shadow root so X's CSS can't touch it.
// Two anchors: 'bottom' (default; slides up into place) and 'top' (slides down) — quick
// action feedback like pin/unpin uses the top anchor with a short duration.

type ToastPosition = 'bottom' | 'top';

const shadows: Partial<Record<ToastPosition, ShadowRoot>> = {};

function ensureHost(position: ToastPosition): ShadowRoot {
  const existing = shadows[position];
  if (existing) return existing;
  const host = document.createElement('div');
  host.id = `xchat-toast-host-${position}`;
  host.style.cssText = `position:fixed;z-index:2147483647;${position}:20px;left:50%;transform:translateX(-50%);`;
  document.documentElement.appendChild(host);
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  // Enter from the edge it's anchored to: top toasts slide down, bottom toasts slide up.
  const offset = position === 'top' ? '-8px' : '8px';
  style.textContent = `
    .t { display:flex; align-items:center; gap:12px; background:#15202b; color:#fff;
         font:500 13px/1.3 -apple-system,system-ui,sans-serif; padding:10px 14px;
         border-radius:10px; box-shadow:0 6px 24px rgba(0,0,0,.35); margin-top:8px;
         opacity:0; transform:translateY(${offset}); transition:opacity .15s,transform .15s; }
    .t.show { opacity:1; transform:translateY(0); }
    .t button { all:unset; cursor:pointer; color:#1d9bf0; font-weight:700; }
  `;
  shadow.appendChild(style);
  shadows[position] = shadow;
  return shadow;
}

export function toast(
  message: string,
  action?: { label: string; run: () => void },
  ms = 3200,
  position: ToastPosition = 'bottom',
): void {
  const root = ensureHost(position);
  const el = document.createElement('div');
  el.className = 't';
  const span = document.createElement('span');
  span.textContent = message;
  el.appendChild(span);
  if (action) {
    const btn = document.createElement('button');
    btn.textContent = action.label;
    btn.addEventListener('click', () => {
      action.run();
      dismiss();
    });
    el.appendChild(btn);
  }
  root.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  let timer = window.setTimeout(dismiss, ms);
  function dismiss() {
    window.clearTimeout(timer);
    el.classList.remove('show');
    window.setTimeout(() => el.remove(), 180);
  }
}
