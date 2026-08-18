import Anthropic from "@anthropic-ai/sdk";
import mammoth from "mammoth";
import { ExtractedData, emptyExtractedData } from "../schema";
import { extractFromText } from "./claude";

/** Parses a Word (.docx) file by pulling its plain text and running the same text-extraction path as an EML body. */
export async function extractFromDocx(client: Anthropic, docxBuffer: Buffer): Promise<ExtractedData> {
  const { value: text } = await mammoth.extractRawText({ buffer: docxBuffer });
  const trimmed = text.trim();
  if (!trimmed) return emptyExtractedData();
  return extractFromText(client, trimmed);
}
