import { initializeApp } from "firebase-admin/app";
import { FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { defineSecret } from "firebase-functions/params";
import { logger } from "firebase-functions";
import Anthropic from "@anthropic-ai/sdk";

import { extractFromEml } from "./extract/eml";
import { extractFromPdf } from "./extract/claude";
import { parseSpreadsheet } from "./extract/xlsxCsv";
import { ExtractedData } from "./schema";

export { sendSubmission } from "./send";

initializeApp();

const anthropicApiKey = defineSecret("ANTHROPIC_API_KEY");

interface SubmissionDoc {
  filePath: string;
  fileName: string;
  status: string;
}

function extensionOf(fileName: string): string {
  return fileName.toLowerCase().split(".").pop() ?? "";
}

async function runExtraction(client: Anthropic, buffer: Buffer, fileName: string): Promise<ExtractedData> {
  switch (extensionOf(fileName)) {
    case "xlsx":
    case "csv":
      return parseSpreadsheet(buffer, fileName);
    case "pdf":
      return extractFromPdf(client, buffer);
    case "eml":
      return extractFromEml(client, buffer);
    default:
      throw new Error(`Unsupported file type for extraction: ${fileName}`);
  }
}

export const extractSubmission = onDocumentCreated(
  { document: "submissions/{submissionId}", secrets: [anthropicApiKey] },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const submission = snapshot.data() as SubmissionDoc;
    const submissionRef = snapshot.ref;

    try {
      await submissionRef.update({ status: "extracting" });

      const bucket = getStorage().bucket();
      const [buffer] = await bucket.file(submission.filePath).download();

      const client = new Anthropic({ apiKey: anthropicApiKey.value() });
      const extracted = await runExtraction(client, buffer, submission.fileName);

      await submissionRef.update({
        status: "extracted",
        extractedProfile: extracted.profile,
        extractedLocations: extracted.locations,
        extractedAt: FieldValue.serverTimestamp(),
      });

      // The structured data now lives in Firestore — the raw upload has
      // served its purpose. Deleting it here is what actually fulfills
      // "temporary files deleted after processing," not just a bucket
      // lifecycle rule ticking down in the background. A cleanup failure
      // shouldn't flip an otherwise-successful extraction to failed, so
      // it's caught and logged separately rather than falling into the
      // outer catch below.
      try {
        await bucket.file(submission.filePath).delete();
      } catch (cleanupErr) {
        logger.warn("Failed to delete source file after extraction", {
          submissionId: event.params.submissionId,
          filePath: submission.filePath,
          cleanupErr,
        });
      }
    } catch (err) {
      logger.error("Extraction failed", { submissionId: event.params.submissionId, err });
      await submissionRef.update({
        status: "extraction_failed",
        extractionError: err instanceof Error ? err.message : String(err),
      });
    }
  }
);
