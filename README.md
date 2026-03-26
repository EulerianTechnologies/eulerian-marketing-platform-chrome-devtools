# Eulerian Marketing Platform Chrome DevTools

Chrome DevTools extension for auditing TCF v2 consent implementation and Eulerian `/misc/` network calls.

---

## Features

| Tab | Status | Description |
|-----|--------|-------------|
| **TCF v2 Detection** | ✅ Live | CMP API check, TC string extraction, decoded header, `/misc/` network monitor |
| **Decoder** | ✅ Live | Paste any TC string and decode it instantly |
| **dataLayer** | 🔜 Roadmap | Browse GTM dataLayer pushes |
| **Tag Auditor** | 🔜 Roadmap | Detect EA.js and verify consent-gated tag firing |

### TCF v2 Detection panel

- Detects `__tcfapi` (CMP API presence)
- Extracts TC string via CMP API → cookies → localStorage
- Decodes the IAB binary header (version, dates, CMP ID, purpose consents P1–P10)
- **`/misc/` network monitor** — intercepts XHR and fetch calls whose path contains `/misc/` and checks:
  - HTTP method (GET / POST) and status code
  - `gdpr_consent=` — compared against the live TC string with a diff on mismatch
  - `gdpr_customvendor=`
  - `pmact=`

---

## Development

```bash
# Install dependencies
npm install

# Run tests with coverage
npm test

# Validate manifest.json
node scripts/validate-manifest.js

# Build (copies src/ → dist/ and creates eulerian-devtools.zip)
npm run build

# Full CI pipeline (lint + validate + test + build)
npm run ci
```

### Load unpacked in Chrome

1. Run `npm run build`
2. Open `chrome://extensions`
3. Enable **Developer mode**
4. Click **Load unpacked** → select the `dist/` folder

---

## Release process

Releases are fully automated via GitHub Actions.

### Step-by-step

1. Update `version` in `src/manifest.json` (e.g. `1.1.0` → `1.2.0`)
2. Commit and push to `main`
3. Create and push a matching semver tag:

```bash
git tag v1.2.0
git push origin v1.2.0
```

The `release.yml` workflow then:
- Verifies the tag matches `manifest.json`
- Runs all tests
- Builds the extension
- Uploads `eulerian-devtools.zip` to the Chrome Web Store
- Creates a GitHub Release with the zip attached

### Auto-publish vs manual review

By default `CWS_AUTO_PUBLISH` is `false` — the workflow uploads to the CWS dashboard but leaves the **Publish** button to you. Set the GitHub Actions variable `CWS_AUTO_PUBLISH` to `true` to publish automatically.

---

## Required secrets

Set these in **GitHub → Settings → Secrets and variables → Actions**:

| Secret | Description |
|--------|-------------|
| `CHROME_EXTENSION_ID` | Your extension ID from the CWS Developer Dashboard |
| `CHROME_CLIENT_ID` | Google OAuth2 client ID |
| `CHROME_CLIENT_SECRET` | Google OAuth2 client secret |
| `CHROME_REFRESH_TOKEN` | OAuth2 refresh token |

### Obtaining OAuth2 credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/) and create a project
2. Enable the **Chrome Web Store API**
3. Create an **OAuth 2.0 Client ID** (Desktop app type)
4. Run the one-time token flow to get a refresh token:

```bash
npx chrome-webstore-upload-keys
```

Follow the prompts — it will print the four values you need to set as secrets.

---

## Project structure

```
.
├── .github/
│   └── workflows/
│       ├── ci.yml          ← runs on every push/PR
│       └── release.yml     ← runs on semver tags (vX.Y.Z)
├── scripts/
│   ├── build.js            ← copies src/ → dist/, creates zip
│   ├── validate-manifest.js← pre-build manifest checks
│   └── upload-to-cws.js   ← Chrome Web Store upload
├── src/
│   ├── manifest.json
│   ├── background.js
│   ├── content.js          ← TCF audit + XHR/fetch interceptor
│   ├── popup.html
│   ├── popup.js            ← UI logic + shared pure functions
│   └── icons/
├── tests/
│   ├── tcstring.test.js
│   ├── misc-network.test.js
│   └── manifest.test.js
├── .gitignore
├── package.json
└── README.md
```

---

## License

MIT
