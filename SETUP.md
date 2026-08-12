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

## 4. Deploy

Pick one. Both publish `web/dist` to Hosting and push `storage.rules` so
uploaded files stay private to the uploading user.

### Option A — from your own machine

```bash
npm install -g firebase-tools
firebase login   # must be an account with access to commercial-mga-quoting
cd web
npm install
npm run build
cd ..
firebase deploy --only hosting,storage
```

`firebase deploy` picks up the project from `.firebaserc` (already set to
`commercial-mga-quoting`). Firebase prints the Hosting URL when it finishes
(`https://commercial-mga-quoting.web.app` by default).

### Option B — GitHub Actions (deploys automatically)

`.github/workflows/deploy.yml` is already set up: it builds `web/` and runs
`firebase deploy --only hosting,storage` on every push to `main`, or on
demand from the Actions tab. One-time setup, all in GitHub/Google Cloud —
no local CLI needed:

1. **Create a deploy service account.** [Google Cloud Console](https://console.cloud.google.com/iam-admin/serviceaccounts)
   → select project `commercial-mga-quoting` → **Create service account**
   (e.g. `github-actions-deploy`). Grant it these two roles:
   - **Firebase Hosting Admin** (`roles/firebasehosting.admin`)
   - **Firebase Rules Admin** (`roles/firebaserules.admin`)

   (If deploys fail with a permissions error, granting the broader
   **Firebase Admin** role instead is the simpler fallback.)

2. **Create a JSON key** for that service account (its page → **Keys** →
   **Add key** → **Create new key** → JSON) and download it.

3. **Add it as a GitHub secret.** In the repo: **Settings** → **Secrets and
   variables** → **Actions** → **Secrets** tab → **New repository secret** →
   name it `FIREBASE_SERVICE_ACCOUNT`, paste the entire JSON file contents.
   Then delete the downloaded key file from your machine.

4. **Add the web config as GitHub variables** (not secrets — this is the
   same non-sensitive config from step 3 above, just kept out of git).
   Same **Secrets and variables** → **Actions** page, **Variables** tab →
   add one repository variable for each:
   `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`,
   `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`,
   `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`.

5. **Trigger it.** Push/merge to `main`, or go to the **Actions** tab →
   **Deploy to Firebase** → **Run workflow** to deploy on demand from any
   branch.

## 5. (Recommended) Auto-expire uploaded files

Right now, submitted files are uploaded to Storage under
`uploads/{uid}/...` and just sit there — there's no extraction step yet to
consume and delete them. As a safety net until that step exists, set a
bucket lifecycle rule so anything under `uploads/` auto-deletes after a few
days:

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
- **Storage rules** (`storage.rules`): a user can only read/write files
  under their own `uploads/{their-uid}/` path. No public access.
- **Industries** (`web/src/config/industries.ts`): a plain data array. To
  add a new industry once its intake flow is built, add one entry with
  `enabled: true` — no other code changes needed.

## What's next

This step only builds the intake page: login, industry picker, file
upload, and a "Received" confirmation. No extraction or form-filling logic
exists yet — that's the next piece.
