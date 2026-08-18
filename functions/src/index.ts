import { initializeApp } from "firebase-admin/app";
import { FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { defineSecret } from "firebase-functions/params";
import { logger } from "firebase-functions";
import Anthropic from "@anthropic-ai/sdk";

import { extractFromEml } from "./extract/eml";
import { extractFromDocx } from "./extract/docx";
import { extractFromPdf, extractFromText } from "./extract/claude";
import { parseSpreadsheet, spreadsheetToText } from "./extract/xlsxCsv";
import { mergeExtractions, SourcedExtraction } from "./extract/merge";
import { ExtractedData } from "./schema";

export { sendSubmission } from "./send";

initializeApp();

const anthropicApiKey = defineSecret("ANTHROPIC_API_KEY");

interface SubmissionFile {
  fileName: string;
  filePath: string;
}

interface SubmissionDoc {
  kind?: "acord" | "factSheet";
  filePath?: string;
  fileName?: string;
  files?: SubmissionFile[];
  status: string;
}

function extensionOf(fileName: string): string {
  return fileName.toLowerCase().split(".").pop() ?? "";
}

/**
 * `preferAi` is true for Fact Sheet uploads: those are arbitrary
 * client-provided documents, so a spreadsheet among them goes straight to
 * AI extraction on its flattened text rather than the label-matching
 * parser. That parser only understands our own field labels (the agency's
 * own data-sheet template, or a Fact Sheet we generated ourselves being
 * re-uploaded to ACORD intake) - a client spreadsheet with generic headers
 * like "Address"/"City"/"State" can coincidentally match just enough of our
 * SOV columns to look like a hit while still missing the real data, so
 * "did the deterministic pass find anything" isn't a safe signal to gate
 * on here.
 */
async function runExtraction(
  client: Anthropic,
  buffer: Buffer,
  fileName: string,
  preferAi: boolean
): Promise<ExtractedData> {
  switch (extensionOf(fileName)) {
    case "xlsx":
    case "csv":
      if (preferAi) {
        return extractFromText(client, `Spreadsheet file: ${fileName}\n\n${spreadsheetToText(buffer)}`);
      }
      return parseSpreadsheet(buffer, fileName);
    case "pdf":
      return extractFromPdf(client, buffer);
    case "eml":
      return extractFromEml(client, buffer);
    case "docx":
      return extractFromDocx(client, buffer);
    default:
      throw new Error(`Unsupported file type for extraction: ${fileName}`);
  }
}

/** Downloads a file, runs extraction on it, and always deletes it afterward - same cleanup contract as the single-file path below. */
async function extractAndCleanup(
  client: Anthropic,
  bucket: ReturnType<ReturnType<typeof getStorage>["bucket"]>,
  file: SubmissionFile,
  submissionId: string
): Promise<ExtractedData> {
  const [buffer] = await bucket.file(file.filePath).download();
  try {
    return await runExtraction(client, buffer, file.fileName, true);
  } finally {
    try {
      await bucket.file(file.filePath).delete();
    } catch (cleanupErr) {
      logger.warn("Failed to delete source file after extraction", {
        submissionId,
        filePath: file.filePath,
        cleanupErr,
      });
    }
  }
}

export const extractSubmission = onDocumentCreated(
  { document: "submissions/{submissionId}", secrets: [anthropicApiKey] },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const submission = snapshot.data() as SubmissionDoc;
    const submissionRef = snapshot.ref;
    const submissionId = event.params.submissionId;

    try {
      await submissionRef.update({ status: "extracting" });

      const bucket = getStorage().bucket();
      const client = new Anthropic({ apiKey: anthropicApiKey.value() });

      if (submission.kind === "factSheet") {
        const files = submission.files ?? [];
        const sources: SourcedExtraction[] = await Promise.all(
          files.map(async (file) => ({
            data: await extractAndCleanup(client, bucket, file, submissionId),
            source: file.fileName,
          }))
        );
        const merged = mergeExtractions(sources);

        await submissionRef.update({
          status: "extracted",
          extractedProfile: merged.profile,
          extractedLocations: merged.locations,
          fieldConflicts: merged.profileConflicts,
          locationConflicts: merged.locationConflicts,
          extractedAt: FieldValue.serverTimestamp(),
        });
        return;
      }

      const buffer = await bucket
        .file(submission.filePath!)
        .download()
        .then(([b]) => b);
      const extracted = await runExtraction(client, buffer, submission.fileName!, false);

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
        await bucket.file(submission.filePath!).delete();
      } catch (cleanupErr) {
        logger.warn("Failed to delete source file after extraction", {
          submissionId,
          filePath: submission.filePath,
          cleanupErr,
        });
      }
    } catch (err) {
      logger.error("Extraction failed", { submissionId, err });
      await submissionRef.update({
        status: "extraction_failed",
        extractionError: err instanceof Error ? err.message : String(err),
      });
    }
  }
);
