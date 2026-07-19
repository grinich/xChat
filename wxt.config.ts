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
    // Pin the extension ID to the Chrome Web Store item so unpacked/dev builds load with the
    // same ID (oaejnakkgghcgpekgdoffnpobkhnmlfm). This is the store item's PUBLIC key (base64
    // DER) — public by design (it ships in every .crx). The store still signs releases with its
    // private key; this only makes local builds' derived ID match.
    key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEArNFqaQUET0zt3s6SsD2qJxyrjgCwIlnVqTdkgIQ52Un5Rpk8K7WHDLEYVhxz3Wxr3EUfr05+VQXGYjW/BKV0lWcM0hSVmkB0y1sQLx/UlNMjmzwXgBOZtN7pjLtSP86Cr1teF/UGd96P+Fm6mgEwwT9yUd7mngsBFMH7uDom5JCO7BAu5spAb09q9yyf3XipUrbdfAzEXv9o5iIW/HBFfNXRZhuD1uBBWvKhmreVP0mMac1bp/gstDXuk4agIJDKJWlQupiHauOlKtL9tv8J4afa0PDMo9f5KWoAohnVuzWaleIhJdFPtQVEXlW35CXeRdeV7d/dle+z6Gw31HHLowIDAQAB',
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
