# Setup & Deployment — Commercial MGA Quoting

Follow these steps once to get the intake page live on the
`commercial-mga-quoting` Firebase project. Steps 1–3 are one-time Firebase
Console setup; step 4 covers deploying, either manually from your machine
or automatically via the GitHub Actions workflow already in this repo.

## 1. Enable Email/Password sign-in

Firebase Console → your project → **Authentication** → **Sign-in method** →
enable **Email/Password**.

## 2. Create team accounts

There's no self-serve sign-up screen on purpose — this is an internal tool.
For each team member: **Authentication** → **Users** → **Add user**, enter
their email and a temporary password. Share the temporary password with
them out of band and have them use "Forgot password" on first login to set
their own.

## 3. Register a Web app and get its config

Firebase Console → **Project settings** (gear icon) → **General** → scroll to
**Your apps** → **Add app** → Web (`</>`). Name it anything (e.g. "web"). You
don't need Firebase Hosting SDK setup or `firebase init` — just copy the
`firebaseConfig` values it shows you.

Then:

```bash
cd web
cp .env.example .env.local
```

Fill in `.env.local` with the `apiKey`, `messagingSenderId`, and `appId`
values from the console (the other fields are already pre-filled to match
this project).

## 4. Enable Firestore

Firebase Console → **Firestore Database** → **Create database**. Any
location is fine (pick one close to your team); start in the default
(production) mode — `firestore.rules` in this repo locks it down once
deployed, so the initial mode doesn't matter much.

## 5. Set the Claude API key

Extraction runs in a Cloud Function that calls the Anthropic API, so it
needs an API key. Get one from the
[Anthropic Console](https://console.anthropic.com/) if you don't have one,
then store it as a Cloud Functions secret (this keeps it out of git and out
of the client entirely — it's never sent to the browser):

```bash
npm install -g firebase-tools
firebase login
firebase use commercial-mga-quoting
firebase functions:secrets:set ANTHROPIC_API_KEY
# paste the key when prompted
```

This is one-time — the deployed function reads it at runtime, and it
doesn't need to be re-set on future deploys unless the key changes.

## 6. Enable the Google Drive API and authorize Drive access

Filling the ACORD forms and SOV happens in a Cloud Function too, which
needs to read the blank templates from your Google Drive "ACORDs" folder
and write the filled copies to each industry's output folder.

This runs as a real Google account via a one-time OAuth authorization,
**not** the Cloud Function's own service account — service accounts have
no Drive storage quota of their own, so while they can read files someone
else owns, they can never create new ones, which breaks every upload this
function makes. Authorizing as a real account sidesteps that: files it
creates are owned by that account, the same as if you'd uploaded them by
hand, and needs no folder-sharing step at all.

1. **Enable the Drive API** for the project: visit
   https://console.cloud.google.com/apis/library/drive.googleapis.com?project=commercial-mga-quoting
   and click **Enable**.
2. **Create an OAuth 2.0 Client ID**: Google Cloud Console →
   [APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials?project=commercial-mga-quoting)
   → **Create Credentials** → **OAuth client ID** → application type
   **Desktop app** → any name. (If prompted to configure an OAuth consent
   screen first, **External** user type is fine — add the Google account
   from step 3 as a **test user**; this app never needs Google's
   verification review since only that one account will ever use it.)
   Note the **Client ID** and **Client Secret** it gives you.
3. **Run the one-time authorization**, from a machine with a browser:
   ```bash
   cd functions
   node scripts/get-drive-refresh-token.js <client-id> <client-secret>
   ```
   It prints a URL — open it, sign in with the Google account that should
   own the filled documents (the templates in "ACORDs" and each industry's
   output folder need to already belong to, or be shared with, this same
   account), and approve access. Paste the resulting authorization code
   back into the script; it prints a **refresh token**.
4. **Store all three as Cloud Functions secrets**:
   ```bash
   firebase functions:secrets:set GOOGLE_OAUTH_CLIENT_ID
   firebase functions:secrets:set GOOGLE_OAUTH_CLIENT_SECRET
   firebase functions:secrets:set GOOGLE_OAUTH_REFRESH_TOKEN
   # paste the respective value at each prompt
   ```
   One-time, like the Anthropic key in step 5 — doesn't need to be re-set
   on future deploys unless it's revoked or rotated.

## 7. Deploy

Pick one. Both publish `web/dist` to Hosting, push `storage.rules` and
`firestore.rules`/indexes, and deploy both Cloud Functions
(`extractSubmission` and `sendSubmission`).

### Option A — from your own machine

```bash
npm install -g firebase-tools
firebase login   # must be an account with access to commercial-mga-quoting
cd web && npm install && npm run build && cd ..
cd functions && npm install && cd ..
firebase deploy --only hosting,storage,firestore,functions
```

`firebase deploy` picks up the project from `.firebaserc` (already set to
`commercial-mga-quoting`). Firebase prints the Hosting URL when it finishes
(`https://commercial-mga-quoting.web.app` by default).

### Option B — GitHub Actions (deploys automatically)

`.github/workflows/deploy.yml` is already set up: it builds `web/`,
installs `functions/`, and runs
`firebase deploy --only hosting,storage,firestore,functions` on every push
to `main`, or on demand from the Actions tab. If you already did the
Hosting/Storage setup from before, only step 1 changes (more roles needed
now) — steps 2–5 are the same as last time:

1. **Service account roles.** On the `github-deployer` service account
   (or whatever you named it) in
   [IAM](https://console.cloud.google.com/iam-admin/iam?project=commercial-mga-quoting),
   make sure it has all of these — deploying a Cloud Function touches more
   Google Cloud services than Hosting/Storage did:
   - **Firebase Admin** (`roles/firebase.admin`) — covers Hosting, Storage
     rules, and Firestore rules/indexes
   - **Cloud Functions Admin** (`roles/cloudfunctions.admin`)
   - **Cloud Run Admin** (`roles/run.admin`) — 2nd-gen functions deploy onto
     Cloud Run under the hood
   - **Eventarc Admin** (`roles/eventarc.admin`) — needed for the
     Firestore-triggered function
   - **Service Account User** (`roles/iam.serviceAccountUser`) — lets the
     deploy act as the function's runtime service account
   - **Cloud Build Editor** (`roles/cloudbuild.builds.editor`) — needed to
     build the function's container image
   - **Secret Manager Admin** (`roles/secretmanager.admin`) — needed once,
     to grant the function's runtime service account access to the
     `ANTHROPIC_API_KEY` secret from step 5 above

   Add them the same way as before: **+ Grant access** → paste the service
   account's email → add a role → repeat (or add several roles in one grant
   using the role picker's search box, selecting one at a time). If a
   deploy still fails on a specific permission, the error names exactly
   which one is missing.

2. **Create a JSON key** for that service account (its page → **Keys** →
   **Add key** → **Create new key** → JSON) and download it. (Skip if you
   already have one from before — you don't need a second key.)

3. **Add it as a GitHub secret.** In the repo: **Settings** → **Secrets and
   variables** → **Actions** → **Secrets** tab → **New repository secret** →
   name it `FIREBASE_SERVICE_ACCOUNT`, paste the entire JSON file contents.
   Then delete the downloaded key file from your machine. (Skip if already
   done.)

4. **Add the web config as GitHub variables** (not secrets — this is the
   same non-sensitive config from step 3 above, just kept out of git).
   Same **Secrets and variables** → **Actions** page, **Variables** tab →
   add one repository variable for each:
   `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`,
   `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`,
   `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`. (Skip if
   already done.)

5. **Trigger it.** Push/merge to `main`, or go to the **Actions** tab →
   **Deploy to Firebase** → **Run workflow** to deploy on demand from any
   branch.

## 8. (Safety net) Auto-expire orphaned uploads

The extraction function deletes each file from Storage itself right after
it finishes processing it — so in the normal case, nothing lingers. The one
gap: if a file finishes uploading but the app fails to create its Firestore
record right after (e.g. the tab closes mid-submit), that file has nothing
watching it and would sit there indefinitely. As a safety net for that
edge case, set a bucket lifecycle rule so anything under `uploads/`
auto-deletes after a few days regardless:

```bash
cat > /tmp/lifecycle.json <<'EOF'
{
  "rule": [
    {
      "action": { "type": "Delete" },
      "condition": { "age": 7, "matchesPrefix": ["uploads/"] }
    }
  ]
}
EOF
gsutil lifecycle set /tmp/lifecycle.json gs://commercial-mga-quoting.firebasestorage.app
```

(Requires the `gsutil` CLI — part of the
[Google Cloud SDK](https://cloud.google.com/sdk).) Adjust the bucket name if
yours differs (check it in `web/.env.local` /
`VITE_FIREBASE_STORAGE_BUCKET`, or Firebase Console → Storage).

## What's already handled

- **Auth**: Email/Password only, no public sign-up. Every route except
  `/login` requires a signed-in user (`src/components/ProtectedRoute.tsx`).
- **Storage rules** (`storage.rules`): any signed-in team member can read a
  file (needed for the shared review queue), but only the uploading user
  can write to their own `uploads/{their-uid}/` path.
- **Firestore rules** (`firestore.rules`): any signed-in team member can
  read/review a submission; only the extraction function (via the Admin
  SDK, which bypasses these rules) can move a submission through the
  extraction states.
- **Industries** (`web/src/config/industries.ts`): a plain data array. To
  add a new industry once its intake flow is built, add one entry with
  `enabled: true` — no other code changes needed.
- **Extraction** (`functions/src/`): runs automatically when a submission
  doc is created. XLSX/CSV are parsed directly (deterministic, no AI);
  PDF/EML go through Claude. Results land in Firestore for a human to
  confirm on the **Review Queue** screen before anything downstream uses
  them. The source file is deleted from Storage right after extraction
  succeeds.
- **Hotel field schema** (`functions/src/schema.ts` /
  `web/src/config/hotelSchema.ts`): matches the real ACORD data sheet
  template (~142 fields across ACORD 125/126/130/823-825 Cyber/140, plus
  an unlimited-row SOV schedule) — update both files (they're not shared,
  so keep them in sync) if the template changes.
- **Industries** (`web/src/config/industries.ts`, `functions/src/industries.ts`):
  the intake dropdown's `id`s (only `hotel` is `enabled` today) map on the
  functions side to which ACORD forms get filled and which Drive folder
  they land in — e.g. `hotel` → 125/126/140 → the "Hotel ACORD Filled"
  folder ID. Each industry gets its own folder (created and shared with the
  service account by hand — see step 6 above — then its ID pasted into
  `driveFolderId`) so a separate Power Automate flow can watch it in
  isolation, with no need to inspect file contents to know whether a drop
  belongs to it. Adding a new industry means creating its Drive folder,
  adding an entry to both config files (and, once its extraction needs
  diverge from the current ~142-field schema, extending
  `functions/src/schema.ts` / `web/src/config/hotelSchema.ts`).
- **Filling + send** (`functions/src/send.ts`, `functions/src/fill/`):
  once a submission is confirmed reviewed, a Cloud Function looks up its
  industry, fills that industry's ACORD forms (PDF form fields, via
  `mupdf` — the official ACORD PDFs are RC4-encrypted, which `mupdf`
  decrypts transparently; `pdf-lib` cannot — form → template/fill-function
  lookup lives in `functions/src/fill/registry.ts`) and the SOV Excel
  template (via `exceljs`), then uploads all of it to that industry's
  Drive folder with the submission ID prefixed onto each filename,
  followed last by a `{submissionId}_READY.json` manifest — uploaded last
  on purpose, so Power Automate's folder-watch trigger only fires once
  every real document is already present. On failure, the Review screen
  shows the error with a **Retry send** button. Liquor Liability (ACORD
  803) and Cyber (823/825) are out of scope until their fillable
  templates are sorted out.

## What's next

Intake, extraction, human review, and filling the ACORD/SOV documents are
done. What's left: finishing the Power Automate flow itself, one per
industry (watch that industry's Drive folder for a `_READY.json` file,
look up that submission's documents by its ID prefix — using the
manifest's `files` list rather than assuming a fixed count, since it
varies by industry — send the underwriter emails, then archive or delete
the files) — that part lives entirely in Power Automate, not in this
repo.
