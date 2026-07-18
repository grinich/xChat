// Boot + resilient, route-aware activation.
//
// The content script is injected on ALL of x.com (so it survives SPA navigation via the
// side nav — content scripts don't re-inject on client-side route changes). A lightweight
// poll + route hooks activate the DM enhancer whenever the DM UI is on screen and a DM
// route is active, and deactivate (drop the reskin class) elsewhere. There is deliberately
// no "give up" timeout: if the DM UI appears late (slow load, redirect, re-render), we
// still activate. Never throw into the page — degrade gracefully and log.

import { REQUIRED_TESTIDS, $, dmPresent, isDmRoute } from './selectors';
import { installKeyboard } from './keyboard';
import { startObserver } from './observer';
import { selectInitialWhenReady, installClickSync } from './selection';
import { applyComposerHint } from './composer-hint';
import { installComposerFocusGuard } from './composer-focus';

const LOG = '[tchat]';
const FULLSCREEN_CLASS = 'tchat-fullscreen';

let wired = false; // one-time listeners (keyboard, observer, triage)
let active = false; // currently activated on a DM route with the UI present

function wireOnce(): void {
  if (wired) return;
  wired = true;
  const missing = REQUIRED_TESTIDS.filter((sel) => !$(sel));
  if (missing.length) {
    // Console-only: the list often isn't rendered at first activation, so a visible toast
    // here would be a false positive. Selectors are re-tried by the poll anyway.
    console.warn(`${LOG} some selectors not present yet:`, missing);
  }
  installComposerFocusGuard();
  installClickSync();
  installKeyboard();
  startObserver();
  console.info(`${LOG} ready — keyboard-first DMs enabled.`);
}

function activate(): void {
  document.documentElement.classList.add(FULLSCREEN_CLASS);
  wireOnce();
  applyComposerHint();
  if (!active) {
    active = true;
    selectInitialWhenReady();
  }
}

function deactivate(): void {
  document.documentElement.classList.remove(FULLSCREEN_CLASS);
  active = false;
}

/** Called on load, on route changes, and on a cheap interval. Idempotent. */
function tick(): void {
  if (isDmRoute()) {
    if (dmPresent()) activate();
    // else: DM route but UI not rendered yet — wait; the interval will retry.
  } else {
    deactivate();
  }
}

export function start(): void {
  // Singleton guard (a shared DOM marker, visible across content-script instances AND
  // duplicate extension copies): only ever run one xChat per page, so keys aren't handled
  // twice — a double handler would move j/k by 2+ rows per press.
  if (document.documentElement.dataset.xchatActive) {
    console.info(`${LOG} another instance is already active; standing down.`);
    return;
  }
  document.documentElement.dataset.xchatActive = '1';

  // React to SPA route changes immediately.
  (['pushState', 'replaceState'] as const).forEach((name) => {
    const orig = history[name];
    history[name] = function (data: unknown, unused: string, url?: string | URL | null) {
      orig.call(history, data, unused, url);
      tick();
    };
  });
  window.addEventListener('popstate', tick);
  // Reliability backstop: activates whenever the DM UI shows up, however we got there.
  setInterval(tick, 600);
  tick();
}
