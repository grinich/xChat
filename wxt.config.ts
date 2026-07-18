import { defineConfig } from 'wxt';
import { fileURLToPath } from 'node:url';

const srcDir = fileURLToPath(new URL('./src', import.meta.url));

// xchat — an in-page enhancer for X (Twitter) DMs.
// One content script on the DM routes + a tiny background worker.
// No cookies / API / declarativeNetRequest: X does all data/crypto/realtime/sending;
// we only enhance the rendered page. Minimal permission footprint.
export default defineConfig({
  outDir: 'dist',
  outDirTemplate: '.',
  manifest: {
    name: 'xChat — X DMs, keyboard-first',
    description:
      'A fast, full-screen, keyboard-driven layer on top of X (Twitter) Direct Messages.',
    // version comes from package.json (WXT default) so a release tag drives it — see the
    // "Set version from tag" step in .github/workflows/release.yml.
    host_permissions: ['https://x.com/*'],
    // Clickable toolbar icon (no popup) — background.ts handles onClicked to open X DMs.
    action: {
      default_title: 'Open X DMs (xChat)',
      default_icon: {
        16: 'icon/16.png',
        32: 'icon/32.png',
        48: 'icon/48.png',
        128: 'icon/128.png',
      },
    },
  },
  alias: { '@': srcDir },
  webExt: {
    // Don't auto-open a browser in this environment; load dist/ manually.
    disabled: true,
  },
});
