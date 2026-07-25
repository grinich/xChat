#!/usr/bin/env node
// Mint a Chrome Web Store API refresh token and (optionally) install it as repo secrets,
// so CI can submit store updates on its own. See docs/RELEASING.md for the one-time
// Google Cloud setup that produces the client id/secret this script consumes.
//
//   node scripts/cws-token.mjs --set-secrets
//
// Why this exists instead of `wxt submit init`: that walkthrough asks Google for an
// out-of-band code (redirect_uri=urn:ietf:wg:oauth:2.0:oob), a flow Google shut off in
// 2022, and it omits access_type=offline/prompt=consent so it may not return a refresh
// token at all. This uses the loopback redirect Google now requires for desktop clients.
//
// Nothing is written to disk: the token goes to your terminal (masked unless --print) or
// straight into GitHub secrets via `gh`.

import { createServer } from 'node:http';
import { createHash, randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline/promises';

const SCOPE = 'https://www.googleapis.com/auth/chromewebstore';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
// The published xChat item. Public (it's in every store URL); override for a fork.
const DEFAULT_EXTENSION_ID = 'oaejnakkgghcgpekgdoffnpobkhnmlfm';

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  console.log(`Usage: node scripts/cws-token.mjs [options]

  --client-id <id>          OAuth client id      (or env CWS_CLIENT_ID; prompts otherwise)
  --client-secret <secret>  OAuth client secret  (or env CWS_CLIENT_SECRET; prompts otherwise)
  --extension-id <id>       Store item to verify against (default ${DEFAULT_EXTENSION_ID})
  --set-secrets             Upload CWS_CLIENT_ID/SECRET/REFRESH_TOKEN via \`gh secret set\`
  --print                   Print the refresh token instead of masking it
  --port <n>                Loopback port for the OAuth redirect (default: ephemeral)
  --no-open                 Don't launch a browser; just print the URL to open yourself
`);
  process.exit(0);
}

const clientId = args['client-id'] ?? process.env.CWS_CLIENT_ID ?? (await ask('OAuth client id: '));
const clientSecret =
  args['client-secret'] ?? process.env.CWS_CLIENT_SECRET ?? (await ask('OAuth client secret: '));
const extensionId = args['extension-id'] ?? DEFAULT_EXTENSION_ID;

if (!clientId || !clientSecret) fail('client id and client secret are both required');
if (!clientId.endsWith('.apps.googleusercontent.com')) {
  warn(`client id doesn't look like a Google one (expected …apps.googleusercontent.com)`);
}

// --- 1. authorize (loopback redirect, PKCE) --------------------------------------------
let port; // assigned once the loopback server binds; part of the redirect_uri
const state = randomBytes(16).toString('base64url');
const verifier = randomBytes(32).toString('base64url');
const challenge = createHash('sha256').update(verifier).digest('base64url');

const code = await authorize().catch((e) => fail(e.message));

// --- 2. exchange the code for a refresh token ------------------------------------------
const redirectUri = `http://localhost:${port}`;
const tokens = await postForm(TOKEN_URL, {
  client_id: clientId,
  client_secret: clientSecret,
  code,
  grant_type: 'authorization_code',
  redirect_uri: redirectUri,
  code_verifier: verifier,
});

const refreshToken = tokens.refresh_token;
if (!refreshToken) {
  fail(
    'Google returned no refresh_token. This happens when the grant is reused — revoke the\n' +
      "app's access at https://myaccount.google.com/permissions and run this again.",
  );
}

// --- 3. prove the token can actually reach the store item ------------------------------
console.log('\nVerifying the token against the store item…');
const refreshed = await postForm(TOKEN_URL, {
  client_id: clientId,
  client_secret: clientSecret,
  refresh_token: refreshToken,
  grant_type: 'refresh_token',
});

const itemRes = await fetch(
  `https://www.googleapis.com/chromewebstore/v1.1/items/${extensionId}?projection=DRAFT`,
  { headers: { Authorization: `Bearer ${refreshed.access_token}`, 'x-goog-api-version': '2' } },
);
const item = await itemRes.json().catch(() => ({}));
if (!itemRes.ok) {
  fail(
    `The token works, but reading item ${extensionId} failed (HTTP ${itemRes.status}):\n` +
      `${JSON.stringify(item, null, 2)}\n\n` +
      'Usual causes: you authorized a Google account that has no access to the item, or the\n' +
      'Chrome Web Store API is not enabled on the Cloud project that owns the OAuth client.',
  );
}
console.log(`  ✓ item ${extensionId} readable — uploadState: ${item.uploadState ?? 'unknown'}`);

// --- 4. hand off ----------------------------------------------------------------------
if (args['set-secrets']) {
  for (const [name, value] of [
    ['CWS_CLIENT_ID', clientId],
    ['CWS_CLIENT_SECRET', clientSecret],
    ['CWS_REFRESH_TOKEN', refreshToken],
  ]) {
    await ghSecretSet(name, value);
    console.log(`  ✓ set secret ${name}`);
  }
  console.log('\nDone. CI can now submit store updates. Confirm with a dry run:');
  console.log('  gh workflow run Release -f dry_run=true && gh run watch');
} else {
  console.log(`\nRefresh token: ${args.print ? refreshToken : mask(refreshToken)}`);
  console.log('\nAdd it (plus the client id/secret) as repo secrets:');
  console.log('  gh secret set CWS_REFRESH_TOKEN   # paste when prompted, or pipe it in');
  console.log('  gh secret set CWS_CLIENT_ID');
  console.log('  gh secret set CWS_CLIENT_SECRET');
  console.log('\nOr re-run with --set-secrets to do all three automatically.');
}

// --------------------------------------------------------------------------------------

async function authorize() {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url, `http://localhost:${port}`);
      const done = (status, body) => {
        res.writeHead(status, { 'content-type': 'text/html; charset=utf-8' });
        res.end(`<!doctype html><meta charset=utf-8><body style="font:16px system-ui;padding:3rem">
          ${body}</body>`);
      };
      const err = url.searchParams.get('error');
      const gotCode = url.searchParams.get('code');
      if (!err && !gotCode) return done(404, 'Waiting for the Google redirect…');

      if (err) {
        done(400, `<h2>Authorization failed</h2><p>${escapeHtml(err)}</p>`);
        server.close();
        return reject(new Error(`Google returned error=${err}`));
      }
      if (url.searchParams.get('state') !== state) {
        done(400, '<h2>State mismatch</h2><p>Discarding this response.</p>');
        server.close();
        return reject(new Error('state mismatch — possible cross-site request, aborting'));
      }
      done(200, '<h2>xChat: authorized ✓</h2><p>You can close this tab.</p>');
      server.close();
      resolve(gotCode);
    });

    server.on('error', reject);
    server.listen(args.port ? Number(args.port) : 0, '127.0.0.1', () => {
      port = server.address().port;
      const authUrl = `${AUTH_URL}?${new URLSearchParams({
        client_id: clientId,
        redirect_uri: `http://localhost:${port}`,
        response_type: 'code',
        scope: SCOPE,
        access_type: 'offline', // ask for a refresh token
        prompt: 'consent', // …every time, even if already granted
        state,
        code_challenge: challenge,
        code_challenge_method: 'S256',
      })}`;
      console.log('\nOpening Google sign-in. Use the account that manages the store listing.');
      console.log(`If no browser opens, visit:\n\n${authUrl}\n`);
      if (!args['no-open']) openBrowser(authUrl);
      setTimeout(
        () => {
          server.close();
          reject(new Error('timed out after 5 minutes waiting for the redirect'));
        },
        5 * 60_000,
      ).unref();
    });
  });
}

async function postForm(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) fail(`${url} → HTTP ${res.status}\n${JSON.stringify(json, null, 2)}`);
  return json;
}

// Pipe the value through stdin so it never lands in argv (visible to other local processes).
function ghSecretSet(name, value) {
  return new Promise((resolve, reject) => {
    const gh = spawn('gh', ['secret', 'set', name], { stdio: ['pipe', 'inherit', 'inherit'] });
    gh.on('error', (e) =>
      reject(new Error(`could not run \`gh\` (${e.message}); install the GitHub CLI or set secrets by hand`)),
    );
    gh.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`gh secret set ${name} exited ${code}`)),
    );
    gh.stdin.end(value);
  });
}

function openBrowser(url) {
  const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  spawn(cmd, [url], { stdio: 'ignore', detached: true, shell: process.platform === 'win32' }).unref();
}

async function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    if (['set-secrets', 'print', 'help', 'no-open'].includes(key)) out[key] = true;
    else out[key] = argv[++i];
  }
  return out;
}

const mask = (s) => `${s.slice(0, 6)}…${s.slice(-4)} (${s.length} chars)`;
const escapeHtml = (s) => s.replace(/[<>&"]/g, (c) => `&#${c.charCodeAt(0)};`);
const warn = (msg) => console.warn(`warning: ${msg}`);

function fail(msg) {
  console.error(`\nerror: ${msg}`);
  process.exit(1);
}
