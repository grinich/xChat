import '../src/content/style.css';
import { start } from '../src/content/boot';

// Injected on ALL of x.com so it survives SPA navigation (content scripts don't re-inject
// on client-side route changes). boot's route watcher activates the DM enhancer only on
// DM routes and deactivates elsewhere. CSS is manifest-injected so the reskin auto-applies
// to X's React re-renders without JS.
export default defineContentScript({
  matches: ['*://x.com/*'],
  runAt: 'document_idle',
  cssInjectionMode: 'manifest',
  main() {
    start();
  },
});
