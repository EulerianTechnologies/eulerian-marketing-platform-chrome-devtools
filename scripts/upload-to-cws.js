#!/usr/bin/env node
/**
 * upload-to-cws.js
 *
 * Uploads dist/eulerian-devtools.zip to the Chrome Web Store
 * and optionally publishes it.
 *
 * Required environment variables:
 *   CHROME_EXTENSION_ID    — The extension's ID in the CWS dashboard
 *   CHROME_CLIENT_ID       — OAuth2 client ID
 *   CHROME_CLIENT_SECRET   — OAuth2 client secret
 *   CHROME_REFRESH_TOKEN   — OAuth2 refresh token
 *   CWS_PUBLISH            — Set to "true" to auto-publish after upload
 *                            (default: upload only, manual publish via dashboard)
 */

const fs              = require('fs');
const path            = require('path');
const chromeWebstore  = require('chrome-webstore-upload');

const ZIP_PATH = path.resolve(__dirname, '../eulerian-devtools.zip');

// ── Guard ─────────────────────────────────────────────────────────────────
const required = ['CHROME_EXTENSION_ID', 'CHROME_CLIENT_ID', 'CHROME_CLIENT_SECRET', 'CHROME_REFRESH_TOKEN'];
const missing  = required.filter(k => !process.env[k]);
if (missing.length) {
  console.error('\n❌ Missing required environment variables:\n');
  missing.forEach(k => console.error('   •', k));
  console.error('\nSet these as GitHub Actions secrets or in your .env file.\n');
  process.exit(1);
}

if (!fs.existsSync(ZIP_PATH)) {
  console.error(`❌ ZIP not found at ${ZIP_PATH}. Run "npm run build" first.`);
  process.exit(1);
}

const store = chromeWebstore({
  extensionId:   process.env.CHROME_EXTENSION_ID,
  clientId:      process.env.CHROME_CLIENT_ID,
  clientSecret:  process.env.CHROME_CLIENT_SECRET,
  refreshToken:  process.env.CHROME_REFRESH_TOKEN
});

(async () => {
  console.log('\n📤 Uploading to Chrome Web Store…');
  const zipStream = fs.createReadStream(ZIP_PATH);

  try {
    const uploadResult = await store.uploadExisting(zipStream);
    if (uploadResult.uploadState === 'SUCCESS') {
      console.log('✅ Upload successful.');
    } else {
      console.error('❌ Upload failed:', JSON.stringify(uploadResult, null, 2));
      process.exit(1);
    }

    const shouldPublish = process.env.CWS_PUBLISH === 'true';
    if (shouldPublish) {
      console.log('🚀 Publishing extension…');
      const pubResult = await store.publish();
      if (pubResult.status?.includes('OK')) {
        console.log('✅ Extension published successfully.');
      } else {
        console.error('⚠️  Publish response:', JSON.stringify(pubResult, null, 2));
      }
    } else {
      console.log('ℹ️  CWS_PUBLISH is not "true" — skipping publish. Review in the Chrome Web Store dashboard.');
    }
  } catch (err) {
    console.error('❌ CWS API error:', err.message);
    process.exit(1);
  }
})();
