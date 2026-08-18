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

function isEffectivelyEmpty(data: ExtractedData): boolean {
  const hasProfileValue = Object.values(data.profile).some((v) => v !== null && v !== undefined && v !== "");
  return !hasProfileValue && data.locations.length === 0;
}

async function runExtraction(client: Anthropic, buffer: Buffer, fileName: string): Promise<ExtractedData> {
  switch (extensionOf(fileName)) {
    case "xlsx":
    case "csv": {
      const deterministic = parseSpreadsheet(buffer, fileName);
      // The deterministic parser only recognizes our own label scheme (the
      // agency's own data-sheet template, or a Fact Sheet we generated
      // ourselves being re-uploaded) - an arbitrary client-provided
      // spreadsheet won't use that vocabulary and comes back empty. Any
      // match it does find is trustworthy (label matching is exact, not
      // fuzzy, so it can't produce a false positive) - only a total miss
      // falls back to AI extraction on the sheet's flattened text.
      if (!isEffectivelyEmpty(deterministic)) return deterministic;
      return extractFromText(client, `Spreadsheet file: ${fileName}\n\n${spreadsheetToText(buffer)}`);
    }
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
    return await runExtraction(client, buffer, file.fileName);
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
      const extracted = await runExtraction(client, buffer, submission.fileName!);

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
