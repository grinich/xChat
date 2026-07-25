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

## One-time setup: store credentials

The publish job needs three repo secrets — `CWS_CLIENT_ID`, `CWS_CLIENT_SECRET`,
`CWS_REFRESH_TOKEN`. Until they exist the job fails loudly (by design: a silent skip would
look like a successful release that never reached the store). The extension id isn't secret
and is baked into the workflow.

Do all of this signed in as **the Google account that manages the store listing**.

**1. Create a Cloud project and enable the API.** At
<https://console.cloud.google.com/projectcreate> make a project (e.g. `xchat-releases`), then
enable the Chrome Web Store API:
<https://console.cloud.google.com/apis/library/chromewebstore.googleapis.com>

**2. Configure the OAuth consent screen** (APIs & Services → OAuth consent screen):

- User type **External**.
- Fill in app name + support email, and add your own address as the developer contact.
- **Set publishing status to "In production."** This is the step everyone skips, and it's
  the one that breaks releases a week later: while the app is in *Testing*, Google expires
  its refresh tokens after **7 days**, so CI starts failing with `invalid_grant`. Production
  status for your own single-scope app needs no Google verification review — you'll just click
  through an "unverified app" warning during step 4.

**3. Create the OAuth client** (APIs & Services → Credentials → Create credentials → OAuth
client ID) with application type **Desktop app**. Keep the client id and secret handy.

**4. Mint the refresh token and install the secrets:**

```bash
npm run cws-token -- --set-secrets
```

It starts a loopback listener, opens Google sign-in, exchanges the authorization code for a
refresh token, verifies that token can actually read the store item, then writes all three
secrets with `gh secret set`. Nothing touches disk. Drop `--set-secrets` to print the token
(masked; add `--print` to reveal) and set the secrets yourself.

> Don't use `wxt submit init` for this. It requests an out-of-band redirect
> (`urn:ietf:wg:oauth:2.0:oob`) that Google disabled in 2022, and omits
> `access_type=offline`, so it can't produce a working refresh token.

**5. Verify without releasing** — the workflow's manual trigger does a credentials-only dry
run (auth check, no upload):

```bash
gh workflow run Release -f dry_run=true && sleep 5 && gh run watch
```

## When it breaks

| Symptom | Cause and fix |
|---|---|
| `invalid_grant` on the token step | Refresh token died. Most often the consent screen is still in *Testing* (7-day expiry — see step 2); also caused by revoking access, rotating the client secret, or ~6 months unused. Re-run `npm run cws-token -- --set-secrets`. |
| `invalid_client` / 401 | Client id/secret mismatch, or the secrets were pasted with trailing whitespace. |
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
