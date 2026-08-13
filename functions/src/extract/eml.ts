import Anthropic from "@anthropic-ai/sdk";
import { simpleParser, Attachment } from "mailparser";
import { ExtractedData, emptyExtractedData } from "../schema";
import { extractFromPdf, extractFromText } from "./claude";
import { parseSpreadsheet } from "./xlsxCsv";

function extensionOf(name: string | undefined): string {
  return (name ?? "").toLowerCase().split(".").pop() ?? "";
}

/**
 * Parses an EML file. Real-world submissions are often "here's the data
 * sheet" emails, so if a PDF/XLSX/CSV is attached, that attachment is
 * extracted (spreadsheet attachments preferred, since they're deterministic).
 * Otherwise falls back to extracting from the email body text via Claude.
 */
export async function extractFromEml(client: Anthropic, emlBuffer: Buffer): Promise<ExtractedData> {
  const parsed = await simpleParser(emlBuffer);
  const attachments: Attachment[] = parsed.attachments ?? [];

  const spreadsheetAttachment = attachments.find((a) => ["xlsx", "csv"].includes(extensionOf(a.filename)));
  if (spreadsheetAttachment) {
    return parseSpreadsheet(spreadsheetAttachment.content, spreadsheetAttachment.filename ?? "attachment.xlsx");
  }

  const pdfAttachment = attachments.find(
    (a) => extensionOf(a.filename) === "pdf" || a.contentType === "application/pdf"
  );
  if (pdfAttachment) {
    return extractFromPdf(client, pdfAttachment.content);
  }

  const bodyText = parsed.text?.trim();
  if (!bodyText) return emptyExtractedData();

  const subject = parsed.subject ? `Subject: ${parsed.subject}\n\n` : "";
  return extractFromText(client, `${subject}${bodyText}`);
}
