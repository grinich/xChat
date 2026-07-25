# Releasing

Cutting a release is one command. CI builds it, publishes a GitHub Release, and submits the
update to the Chrome Web Store for review:

```bash
npm version patch      # or minor / major
```

That runs typecheck + tests (`preversion`), bumps `package.json`, commits, tags `vX.Y.Z`, and
pushes the tag (`postversion`). The tag fires
[`.github/workflows/release.yml`](../.github/workflows/release.yml):

1. **build** — `npm ci`, sets the manifest version from the tag, typecheck, tests,
   `wxt zip` → `dist/xchat-<version>-chrome.zip`, uploads it as a build artifact, and creates
   the GitHub Release with generated notes.
2. **publish-chrome** — downloads that same zip, uploads it to the store, and submits it for
   review. Once Google approves (hours to a few days), the update rolls out to users
   automatically; nobody has to click anything.

The extension version always comes from the tag, so the tag is the single source of truth —
never edit `manifest.json`'s version by hand.

## Store credentials

**Already configured** — `CWS_CLIENT_ID`, `CWS_CLIENT_SECRET`, and `CWS_REFRESH_TOKEN` are set
as repo secrets and verified against the live listing (2026-07-25). The section below is the
record of how, for when a token needs rotating or a fork needs its own. The extension id isn't
secret and is baked into the workflow.

What exists today, all under **mgrinich@gmail.com** (the account that manages the listing):

| Thing | Value |
|---|---|
| Cloud project | `xchat-releases` |
| Auth app | "xChat Releases", user type **External**, publishing status **In production** |
| OAuth client | `xchat-ci`, type **Desktop app** |
| Scope granted | `https://www.googleapis.com/auth/chromewebstore` (nothing else) |

If the secrets are ever missing the publish job fails loudly rather than skipping — a silent
skip would look like a successful release that never reached the store.

### Redoing it from scratch

Signed in as the account that manages the listing:

**1. Create a Cloud project and enable the API.** At
<https://console.cloud.google.com/projectcreate>, then enable the Chrome Web Store API:
<https://console.cloud.google.com/apis/library/chromewebstore.googleapis.com>

**2. Configure the auth app** — now called **Google Auth Platform**, not "OAuth consent
screen" (`/auth/overview` → Get started): app name, support email, user type **External**,
contact email, and Google's User Data Policy checkbox.

Then, on the **Audience** page (`/auth/audience`), click **Publish app** → Confirm so the
status reads **In production**. This is the step everyone skips and the one that breaks
releases a week later: while the app is in *Testing*, Google expires its refresh tokens after
**7 days** and CI starts failing with `invalid_grant`. Production needs no verification review
for a single non-sensitive scope — you just click through an "unverified app" warning in step 4
(Advanced → "Go to … (unsafe)"; it names you as the developer).

**3. Create the OAuth client** (`/auth/clients` → Create client) with application type
**Desktop app** — not "Chrome Extension", which is for OAuth *inside* an extension.

> **Grab the secret in the creation dialog.** Google no longer lets you view or download a
> client secret afterwards — the client page shows only `****abcd`. If you miss it, use
> **Add secret** on the client page (max 2 per client) and copy the new one immediately, then
> delete the stale one.

**4. Mint the refresh token and install the secrets:**

```bash
npm run cws-token -- --set-secrets
```

It starts a loopback listener, opens Google sign-in, exchanges the authorization code for a
refresh token, verifies that token can actually read the store item, then writes all three
secrets with `gh secret set`. Nothing touches disk. Useful flags: `--no-open` prints the auth
URL instead of launching a browser (for SSH, or when you want to open it in a specific
profile), and dropping `--set-secrets` prints the token masked (`--print` reveals it) so you
can set the secrets yourself.

> Don't use `wxt submit init` for this. It requests an out-of-band redirect
> (`urn:ietf:wg:oauth:2.0:oob`) that Google disabled in 2022, and omits
> `access_type=offline`, so it can't produce a working refresh token.

**5. Verify without releasing** — the workflow's manual trigger does a credentials-only dry
run (auth check, no upload):

```bash
gh workflow run Release -f dry_run=true && gh run watch
```

A green `publish-chrome` job whose log shows "Getting an access token" followed by
"DRY RUN: Skipped upload and publishing" means the credentials work end to end.

## When it breaks

| Symptom | Cause and fix |
|---|---|
| `invalid_grant` on the token step | Refresh token died. Most often the consent screen is still in *Testing* (7-day expiry — see step 2); also caused by revoking access, rotating the client secret, or ~6 months unused. Re-run `npm run cws-token -- --set-secrets`. |
| `invalid_client` / 401 | Client id/secret mismatch, or the secrets were pasted with trailing whitespace. Remember the secret can't be re-read from the console — add a new one and re-run `npm run cws-token -- --set-secrets`. |
| `ITEM_NOT_UPDATABLE` | A previous submission is still in review. Wait for it to clear, or cancel it in the [dashboard](https://chrome.google.com/webstore/devconsole) — the store won't take a new upload while one is pending. |
| "Version number is too low" | The tag must be greater than the version already in the store. Check the store version badge in the README, then tag above it. |
| 403 reading the item | The authorized Google account has no access to the listing, or the Chrome Web Store API isn't enabled on that Cloud project. |
| Publish job fails, GitHub Release exists | Expected split — the release is independent. Fix the credentials, then re-run just the failed job (`gh run rerun <id> --failed`); the build artifact is reused. |

Rejections from review arrive by email to the developer account, not through CI — CI only
reports that the submission was accepted for review.

## Adding another store later

`wxt submit` also speaks Firefox Add-ons and Edge. Adding one means another set of secrets and
another `--firefox-*`/`--edge-*` flag group in the publish job — the zip is already built and
uploaded, so nothing else changes. (Firefox additionally wants a sources zip for review.)
