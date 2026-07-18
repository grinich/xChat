// Minimal toast, isolated in a shadow root so X's CSS can't touch it.

let host: HTMLDivElement | null = null;
let shadow: ShadowRoot | null = null;

function ensureHost(): ShadowRoot {
  if (shadow) return shadow;
  host = document.createElement('div');
  host.id = 'xchat-toast-host';
  host.style.cssText = 'position:fixed;z-index:2147483647;bottom:20px;left:50%;transform:translateX(-50%);';
  document.documentElement.appendChild(host);
  shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = `
    .t { display:flex; align-items:center; gap:12px; background:#15202b; color:#fff;
         font:500 13px/1.3 -apple-system,system-ui,sans-serif; padding:10px 14px;
         border-radius:10px; box-shadow:0 6px 24px rgba(0,0,0,.35); margin-top:8px;
         opacity:0; transform:translateY(8px); transition:opacity .15s,transform .15s; }
    .t.show { opacity:1; transform:translateY(0); }
    .t button { all:unset; cursor:pointer; color:#1d9bf0; font-weight:700; }
  `;
  shadow.appendChild(style);
  return shadow;
}

export function toast(
  message: string,
  action?: { label: string; run: () => void },
  ms = 3200,
): void {
  const root = ensureHost();
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
