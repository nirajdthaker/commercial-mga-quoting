#!/usr/bin/env node
// One-time helper: exchanges a Google OAuth authorization code for a
// refresh token, so sendSubmission (functions/src/drive.ts) can act as a
// real Google account instead of the Cloud Function's own service account
// (which has no Drive storage quota - see SETUP.md for why). Not part of
// the deployed function; run by hand, once, from a machine with a browser.
//
// Usage:
//   node scripts/get-drive-refresh-token.js <client-id> <client-secret>
//
// Prints an authorization URL - open it, sign in with the Google account
// that should own the filled documents, approve access, then paste the
// `code` query parameter from the (broken-looking, that's expected)
// localhost redirect page back into this script.

const { google } = require("googleapis");
const readline = require("readline");

const [, , clientId, clientSecret] = process.argv;

if (!clientId || !clientSecret) {
  console.error("Usage: node scripts/get-drive-refresh-token.js <client-id> <client-secret>");
  process.exit(1);
}

const REDIRECT_URI = "http://localhost";

const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline",
  prompt: "consent", // forces a refresh token even if this account has authorized before
  scope: ["https://www.googleapis.com/auth/drive"],
});

console.log("\n1. Open this URL, sign in with the Google account that should own the filled documents, and approve access:\n");
console.log(authUrl);
console.log(
  '\n2. The browser will land on a page that fails to load (http://localhost/...) - that\'s expected, nothing is running there.'
);
console.log('   Copy the value of the "code" parameter from that page\'s URL.\n');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question("Paste the code here: ", async (code) => {
  rl.close();
  try {
    const { tokens } = await oauth2Client.getToken(code.trim());
    if (!tokens.refresh_token) {
      console.error(
        "\nNo refresh token was returned. This usually means the account already authorized this app before " +
          "without `prompt=consent` taking effect - revoke access at https://myaccount.google.com/permissions " +
          "and run this script again."
      );
      process.exit(1);
    }
    console.log("\nSuccess. Refresh token:\n");
    console.log(tokens.refresh_token);
    console.log(
      "\nStore this with `firebase functions:secrets:set GOOGLE_OAUTH_REFRESH_TOKEN` - see SETUP.md step 6."
    );
  } catch (err) {
    console.error("\nFailed to exchange code for tokens:", err.message ?? err);
    process.exit(1);
  }
});
