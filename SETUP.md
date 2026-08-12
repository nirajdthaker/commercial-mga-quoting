# Setup & Deployment — Commercial MGA Quoting

This repo isn't deployed automatically — deploying requires *your* Firebase
login, which this environment doesn't have. Follow these steps once, from
your own machine, to get the intake page live on the `commercial-mga-quoting`
Firebase project.

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

## 4. Install the Firebase CLI and log in

```bash
npm install -g firebase-tools
firebase login
```

This must be an account with access to the `commercial-mga-quoting`
Firebase project.

## 5. Build and deploy

```bash
cd web
npm install
npm run build
cd ..
firebase deploy --only hosting,storage
```

`firebase deploy` picks up the project from `.firebaserc` (already set to
`commercial-mga-quoting`), publishes `web/dist` to Hosting, and pushes
`storage.rules` so uploaded files stay private to the uploading user.

Firebase will print the Hosting URL when it finishes
(`https://commercial-mga-quoting.web.app` by default).

## 6. (Recommended) Auto-expire uploaded files

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
