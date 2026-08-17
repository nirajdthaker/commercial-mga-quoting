import { FieldValue } from "firebase-admin/firestore";
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";

import { fillAcord125 } from "./fill/acord125";
import { fillAcord126 } from "./fill/acord126";
import { fillAcord130, hasWcData } from "./fill/acord130";
import { fillAcord140 } from "./fill/acord140";
import { fillSov } from "./fill/sov";
import {
  TEMPLATES_FOLDER_ID,
  downloadFile,
  findFileByName,
  findOrCreateSiblingFolder,
  getDriveClient,
  uploadFile,
} from "./drive";
import { LocationRow, ProfileData } from "./schema";

const PDF_MIME = "application/pdf";
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

interface SubmissionDoc {
  status: string;
  extractedProfile?: ProfileData;
  extractedLocations?: LocationRow[];
}

async function requireTemplate(
  drive: Awaited<ReturnType<typeof getDriveClient>>,
  name: string
): Promise<Buffer> {
  const fileId = await findFileByName(drive, TEMPLATES_FOLDER_ID, name);
  if (!fileId) throw new Error(`Template "${name}" not found in the ACORDs Drive folder`);
  return downloadFile(drive, fileId);
}

export const sendSubmission = onDocumentUpdated("submissions/{submissionId}", async (event) => {
  const after = event.data?.after.data() as (SubmissionDoc & { sendStatus?: string }) | undefined;
  if (!after || !event.data) return;
  // sendStatus only ever holds "sending" | "sent" | "send_failed" once this
  // function has touched a submission - all written by this function
  // itself, never by the client. The client can only ever write it back to
  // undefined (never) or the sentinel "retry". Gating on that (rather than
  // on the status transition) means our own writes below never re-trigger
  // this function, while a client-initiated retry still does.
  if (after.status !== "reviewed") return;
  if (after.sendStatus !== undefined && after.sendStatus !== "retry") return;

  const submissionRef = event.data.after.ref;
  const submissionId = event.params.submissionId;
  const profile = after.extractedProfile ?? {};
  const locations = after.extractedLocations ?? [];

  try {
    await submissionRef.update({ sendStatus: "sending", sendError: FieldValue.delete() });

    const drive = await getDriveClient();

    // ACORD 130 (Workers' Comp) is only part of the package when the
    // submission actually carries WC data - most flows through this folder
    // (e.g. hotel property) won't, and Power Automate shouldn't be handed an
    // all-blank WC form.
    const includeWc = hasWcData(profile);

    const [template125, template126, template140, templateSov, template130] = await Promise.all([
      requireTemplate(drive, "ACORD_125_fillable.pdf"),
      requireTemplate(drive, "ACORD_126_fillable.pdf"),
      requireTemplate(drive, "ACORD_140_fillable.pdf"),
      requireTemplate(drive, "SOV Commercial.xlsx"),
      includeWc ? requireTemplate(drive, "ACORD_130_fillable.pdf") : Promise.resolve(null),
    ]);

    const [filled125, filled126, filled140, filledSov, filled130] = await Promise.all([
      fillAcord125(template125, profile),
      fillAcord126(template126, profile),
      fillAcord140(template140, profile),
      fillSov(templateSov, profile, locations),
      template130 ? fillAcord130(template130, profile) : Promise.resolve(null),
    ]);

    const filledFolderId = await findOrCreateSiblingFolder(drive, TEMPLATES_FOLDER_ID, "ACORD Filled");

    const files: Array<{ name: string; content: Buffer; mimeType: string }> = [
      { name: `${submissionId}_ACORD_125.pdf`, content: Buffer.from(filled125), mimeType: PDF_MIME },
      { name: `${submissionId}_ACORD_126.pdf`, content: Buffer.from(filled126), mimeType: PDF_MIME },
      { name: `${submissionId}_ACORD_140.pdf`, content: Buffer.from(filled140), mimeType: PDF_MIME },
      { name: `${submissionId}_SOV.xlsx`, content: filledSov, mimeType: XLSX_MIME },
    ];
    if (filled130) {
      files.push({ name: `${submissionId}_ACORD_130.pdf`, content: Buffer.from(filled130), mimeType: PDF_MIME });
    }

    // Uploaded sequentially (not in parallel) so they all definitely land
    // before the manifest below - the manifest's arrival is what Power
    // Automate's flow watches for, and by the time it exists every real
    // document is guaranteed already present.
    for (const file of files) {
      await uploadFile(drive, filledFolderId, file.name, file.content, file.mimeType);
    }

    const manifest = {
      submissionId,
      insuredName: profile.firstNamedInsured ?? null,
      effectiveDate: profile.proposedEffectiveDate ?? null,
      insuredAddress: profile.propertyAddress ?? profile.mailingAddress ?? null,
      files: files.map((f) => f.name),
    };
    await uploadFile(
      drive,
      filledFolderId,
      `${submissionId}_READY.json`,
      Buffer.from(JSON.stringify(manifest, null, 2)),
      "application/json"
    );

    await submissionRef.update({ sendStatus: "sent", sentAt: FieldValue.serverTimestamp() });
  } catch (err) {
    logger.error("Send failed", { submissionId, err });
    await submissionRef.update({
      sendStatus: "send_failed",
      sendError: err instanceof Error ? err.message : String(err),
    });
  }
});
