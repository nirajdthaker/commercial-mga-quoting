import { Readable } from "stream";
import { google, drive_v3 } from "googleapis";
import { defineSecret } from "firebase-functions/params";

// The "ACORDs" folder containing the blank fillable templates. Found once
// via Drive search during development - if the folder is ever recreated,
// this needs to be updated to the new folder's ID.
export const TEMPLATES_FOLDER_ID = "1gAsdcPE7Ej207x79nfeT0QEUS7ulkZLq";

// Exported so sendSubmission (send.ts) can declare them in its own
// `secrets: [...]` - Cloud Functions only injects a secret's value at
// runtime for functions that explicitly list it.
export const googleOAuthClientId = defineSecret("GOOGLE_OAUTH_CLIENT_ID");
export const googleOAuthClientSecret = defineSecret("GOOGLE_OAUTH_CLIENT_SECRET");
export const googleOAuthRefreshToken = defineSecret("GOOGLE_OAUTH_REFRESH_TOKEN");

let cachedClient: drive_v3.Drive | undefined;

/**
 * Authenticates as a real Google account via a one-time OAuth authorization
 * (see SETUP.md), not the Cloud Function's own service account. Service
 * accounts have no Drive storage quota of their own - they can read files
 * someone else owns (fine for downloading the blank templates) but can
 * never create new ones, which broke every upload this function makes.
 * Files created this way are owned by whoever authorized it, the same as
 * if they'd uploaded them by hand, so this needs no folder-sharing step at
 * all - only the ability to enable the Drive API and grant the one-time
 * consent (see SETUP.md).
 */
export async function getDriveClient(): Promise<drive_v3.Drive> {
  if (cachedClient) return cachedClient;
  const oauth2Client = new google.auth.OAuth2(googleOAuthClientId.value(), googleOAuthClientSecret.value());
  oauth2Client.setCredentials({ refresh_token: googleOAuthRefreshToken.value() });
  cachedClient = google.drive({ version: "v3", auth: oauth2Client });
  return cachedClient;
}

export async function findFileByName(
  drive: drive_v3.Drive,
  folderId: string,
  name: string
): Promise<string | undefined> {
  const escaped = name.replace(/'/g, "\\'");
  const res = await drive.files.list({
    q: `'${folderId}' in parents and name = '${escaped}' and trashed = false`,
    fields: "files(id, name)",
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    corpora: "allDrives",
  });
  return res.data.files?.[0]?.id ?? undefined;
}

export async function downloadFile(drive: drive_v3.Drive, fileId: string): Promise<Buffer> {
  const res = await drive.files.get(
    { fileId, alt: "media", supportsAllDrives: true },
    { responseType: "arraybuffer" }
  );
  return Buffer.from(res.data as ArrayBuffer);
}

export async function uploadFile(
  drive: drive_v3.Drive,
  folderId: string,
  name: string,
  content: Buffer,
  mimeType: string
): Promise<void> {
  await drive.files.create({
    requestBody: { name, parents: [folderId] },
    media: { mimeType, body: bufferToStream(content) },
    fields: "id",
    supportsAllDrives: true,
  });
}

function bufferToStream(buffer: Buffer): NodeJS.ReadableStream {
  return Readable.from(buffer);
}
