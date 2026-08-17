import { Readable } from "stream";
import { google, drive_v3 } from "googleapis";

// The "ACORDs" folder containing the blank fillable templates. Found once
// via Drive search during development - if the folder is ever recreated,
// this needs to be updated to the new folder's ID.
export const TEMPLATES_FOLDER_ID = "1gAsdcPE7Ej207x79nfeT0QEUS7ulkZLq";

let cachedClient: drive_v3.Drive | undefined;

/**
 * Authenticates as the Cloud Function's own runtime service account
 * (Application Default Credentials - no key file needed). That service
 * account must be shared as an Editor on the ACORDs folder, and on each
 * industry's output folder (see functions/src/industries.ts), from the
 * Google Drive UI - the same way you'd share a folder with any other
 * Google account.
 */
export async function getDriveClient(): Promise<drive_v3.Drive> {
  if (cachedClient) return cachedClient;
  const auth = new google.auth.GoogleAuth({ scopes: ["https://www.googleapis.com/auth/drive"] });
  cachedClient = google.drive({ version: "v3", auth });
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
