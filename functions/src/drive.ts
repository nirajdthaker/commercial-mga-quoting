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
 * account must be shared as an Editor on the ACORDs folder (and its parent,
 * so it can create the sibling "ACORD Filled" folder) from the Google Drive
 * UI, the same way you'd share a folder with any other Google account.
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
  });
  return res.data.files?.[0]?.id ?? undefined;
}

export async function downloadFile(drive: drive_v3.Drive, fileId: string): Promise<Buffer> {
  const res = await drive.files.get({ fileId, alt: "media" }, { responseType: "arraybuffer" });
  return Buffer.from(res.data as ArrayBuffer);
}

export async function findOrCreateSiblingFolder(
  drive: drive_v3.Drive,
  siblingFolderId: string,
  name: string
): Promise<string> {
  const sibling = await drive.files.get({ fileId: siblingFolderId, fields: "parents" });
  const parentId = sibling.data.parents?.[0];
  if (!parentId) throw new Error(`Could not determine parent folder of ${siblingFolderId}`);

  const existing = await findFileByName(drive, parentId, name);
  if (existing) return existing;

  const created = await drive.files.create({
    requestBody: { name, mimeType: "application/vnd.google-apps.folder", parents: [parentId] },
    fields: "id",
  });
  if (!created.data.id) throw new Error(`Failed to create folder "${name}"`);
  return created.data.id;
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
  });
}

function bufferToStream(buffer: Buffer): NodeJS.ReadableStream {
  return Readable.from(buffer);
}
