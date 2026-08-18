import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";

import { ACORD_FORMS, AcordFormId } from "./fill/registry";
import { fillSov } from "./fill/sov";
import { INDUSTRIES } from "./industries";
import {
  TEMPLATES_FOLDER_ID,
  downloadFile,
  findFileByName,
  getDriveClient,
  googleOAuthClientId,
  googleOAuthClientSecret,
  googleOAuthRefreshToken,
  uploadFile,
} from "./drive";
import { LocationRow, ProfileData } from "./schema";

const PDF_MIME = "application/pdf";
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

interface SubmissionDoc {
  status: string;
  industryId?: string;
  uploadedAt?: Timestamp;
  extractedProfile?: ProfileData;
  extractedLocations?: LocationRow[];
}

/** ACORD's "date the form was completed" field wants MM/DD/YYYY, not a locale-dependent format. */
function formatMonthDayYear(date: Date): string {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${mm}/${dd}/${date.getFullYear()}`;
}

async function requireTemplate(
  drive: Awaited<ReturnType<typeof getDriveClient>>,
  name: string
): Promise<Buffer> {
  const fileId = await findFileByName(drive, TEMPLATES_FOLDER_ID, name);
  if (!fileId) throw new Error(`Template "${name}" not found in the ACORDs Drive folder`);
  return downloadFile(drive, fileId);
}

export const sendSubmission = onDocumentUpdated(
  // Downloading several templates, filling PDFs via mupdf's WASM module
  // (slow to cold-start), and uploading the results back to Drive
  // sequentially comfortably exceeds the platform's 60s/256MiB defaults -
  // bumped generously so a slow cold start doesn't get the instance killed
  // mid-send, which would leave sendStatus stuck at "sending" forever with
  // no error ever recorded (the kill happens before the catch block runs).
  {
    document: "submissions/{submissionId}",
    timeoutSeconds: 300,
    memory: "512MiB",
    secrets: [googleOAuthClientId, googleOAuthClientSecret, googleOAuthRefreshToken],
  },
  async (event) => {
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
  const locations = after.extractedLocations ?? [];

  // formCompletionDate isn't part of the reviewed schema - it's the ACORD
  // "date this form was completed" field, which every form has near the
  // top and none of them had any data source for. Defaulting it to the
  // submission's own creation date is more useful than leaving it blank.
  const profile: ProfileData = {
    ...(after.extractedProfile ?? {}),
    formCompletionDate: after.uploadedAt ? formatMonthDayYear(after.uploadedAt.toDate()) : null,
  };

  try {
    // sendStartedAt lets both Firestore rules and the Review UI recognize a
    // "sending" that's gone stale (the function got killed mid-flight
    // without ever reaching the catch block below) and offer a retry,
    // rather than leaving the submission stuck forever. Written fresh on
    // every attempt, including retries.
    await submissionRef.update({
      sendStatus: "sending",
      sendStartedAt: FieldValue.serverTimestamp(),
      sendError: FieldValue.delete(),
    });

    const industry = INDUSTRIES[after.industryId ?? ""];
    if (!industry) {
      throw new Error(`Unknown industry "${after.industryId ?? ""}" - no ACORD form/folder mapping configured for it`);
    }

    const drive = await getDriveClient();

    const [templates, templateSov] = await Promise.all([
      Promise.all(
        industry.forms.map(async (formId) => {
          const template = await requireTemplate(drive, ACORD_FORMS[formId].templateName);
          return { formId, template };
        })
      ),
      requireTemplate(drive, "SOV Commercial.xlsx"),
    ]);

    // Filled one at a time, deliberately not in parallel: every fillAcordNNN
    // call shares the same cached mupdf WASM module instance (loadMupdf() in
    // pdfHelpers.ts), and filling multiple PDFs concurrently against shared
    // WASM memory risks one document's output silently corrupting another's
    // - confirmed live, where a 126 came back byte-for-byte the right length
    // but with a garbled, unopenable header despite every local (always
    // sequential) test producing a valid file. The PDF-header check below is
    // a second line of defense in case some other cause produces the same
    // symptom.
    const formOutputs: Array<{ formId: AcordFormId; filled: Uint8Array }> = [];
    for (const { formId, template } of templates) {
      const filled = await ACORD_FORMS[formId].fill(template, profile);
      const header = Buffer.from(filled.slice(0, 5)).toString("latin1");
      if (header !== "%PDF-") {
        throw new Error(`Filled ACORD ${formId} does not look like a valid PDF (got header ${JSON.stringify(header)})`);
      }
      formOutputs.push({ formId, filled });
    }

    const filledSov = await fillSov(templateSov, profile, locations);

    const filledFolderId = industry.driveFolderId;

    const files: Array<{ name: string; content: Buffer; mimeType: string }> = formOutputs.map(
      ({ formId, filled }) => ({
        name: `${submissionId}_ACORD_${formId}.pdf`,
        content: Buffer.from(filled),
        mimeType: PDF_MIME,
      })
    );
    files.push({ name: `${submissionId}_SOV.xlsx`, content: filledSov, mimeType: XLSX_MIME });

    // Uploaded sequentially (not in parallel) so they all definitely land
    // before the manifest below - the manifest's arrival is what Power
    // Automate's flow watches for, and by the time it exists every real
    // document is guaranteed already present.
    for (const file of files) {
      await uploadFile(drive, filledFolderId, file.name, file.content, file.mimeType);
    }

    const manifest = {
      submissionId,
      industryId: after.industryId,
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
