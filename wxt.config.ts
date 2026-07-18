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
    // same ID (ibabhioecolanneglccnolncaaanonll). This is the store item's PUBLIC key (base64
    // DER) — public by design (it ships in every .crx). The store still signs releases with its
    // private key; this only makes local builds' derived ID match.
    key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAuChTVIHWVg0mfgfG1f/Yn1F+a17DCHkZAMcPJ0dBnMJjuCf1EHbM/ZDJhpNB/j5wBDV6GxxR43mSTAWct+uJ05PxgyXuCB7E4lKO2ZvSRV8owe0QbLvQTREQZDqbwISbdOHD0ji8Uct3GSTFL78iE4Kp17X2z3/F/h/Jr8eFlykPhVlWguzqsVxkdWB//prhBVADxuCOMNqmwuMoWpn+VGz/a/dPN2oYUTsw4UYUOdaTwaWny3QmkDP+AjC+IpjxWiTTi5T5lks7ueM81kyRZpjy4mnc9mDp54E66TLZ8ExmPJgpWx/lzjvQPGvNB9c8/IbWKZPvuyiHmkaa/rz73QIDAQAB',
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
