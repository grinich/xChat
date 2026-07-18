import '../src/content/style.css';
import { start } from '../src/content/boot';

// Injected on ALL of x.com so it survives SPA navigation (content scripts don't re-inject
// on client-side route changes). boot's route watcher activates the DM enhancer only on
// DM routes and deactivates elsewhere. CSS is manifest-injected so the reskin auto-applies
// to X's React re-renders without JS.
export default defineContentScript({
  matches: ['*://x.com/*'],
  // document_start: add the full-screen class before X paints the DM UI, so the reskin is
  // gated on from the first frame (no flash of X's default interface).
  runAt: 'document_start',
  cssInjectionMode: 'manifest',
  main() {
    start();
  },
});
