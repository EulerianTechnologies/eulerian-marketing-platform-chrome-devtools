# Eulerian Marketing Platform Chrome DevTools

Chrome DevTools extension for auditing the implementation of a client-side Eulerian Marketing Platform installation

---

## Features

| Tab | Description |
|-----|-------------|
| **TCF v2 Detection** | CMP API check, TC string extraction, decoded header, `/misc/` network monitor |
| **dataLayer** | Show content of dataLayer and/or capture network calls with parameters |
| **Identity Sync** | Show calls for identity /rpset/ calls with parameters |
| **Trafic Source** | Show utm + Eulerian traffic source parameters for click tracking on landing page |

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

## License

MIT
