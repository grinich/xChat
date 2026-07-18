// Shows an inflow-style "R" keycap hint inside the DM composer, indicating "press R to
// reply". Hidden once the composer is focused or has text. Re-applied by the observer
// because X re-mounts the composer on thread switches.

import { SEL, $ } from './selectors';

const HINT_CLASS = 'tchat-reply-hint';

export function applyComposerHint(): void {
  const container = $(SEL.composerInputContainer) ?? $(SEL.composerForm);
  const ta = $(SEL.composerTextarea) as HTMLTextAreaElement | null;
  if (!container || !ta) return;

  let hint = container.querySelector<HTMLElement>('.' + HINT_CLASS);
  if (!hint) {
    hint = document.createElement('div');
    hint.className = HINT_CLASS;
    hint.setAttribute('aria-hidden', 'true');
    hint.innerHTML = '<kbd>R</kbd><span>reply</span>';
    container.appendChild(hint);
    // Toggle on the composer's own focus/input events (added once per composer instance).
    ta.addEventListener('focus', () => toggle(hint!, ta));
    ta.addEventListener('blur', () => toggle(hint!, ta));
    ta.addEventListener('input', () => toggle(hint!, ta));
  }
  toggle(hint, ta);
}

function toggle(hint: HTMLElement, ta: HTMLTextAreaElement): void {
  const focused = document.activeElement === ta;
  const empty = !ta.value;
  hint.style.display = !focused && empty ? 'flex' : 'none';
}
