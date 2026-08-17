import Anthropic from "@anthropic-ai/sdk";
import {
  ExtractedData,
  FieldDef,
  LOCATION_FIELDS,
  PROFILE_FIELDS,
  emptyExtractedData,
} from "../schema";

const EXTRACTION_MODEL = "claude-sonnet-5";
const TOOL_NAME = "record_hotel_extraction";

function jsonSchemaProperty(field: FieldDef): Record<string, unknown> {
  const jsonType = field.type === "boolean" ? "boolean" : field.type === "number" ? "number" : "string";
  return {
    type: [jsonType, "null"],
    description: field.description,
  };
}

function buildToolSchema() {
  const profileProperties = Object.fromEntries(PROFILE_FIELDS.map((f) => [f.key, jsonSchemaProperty(f)]));
  const locationProperties = Object.fromEntries(LOCATION_FIELDS.map((f) => [f.key, jsonSchemaProperty(f)]));

  return {
    name: TOOL_NAME,
    description: "Records the hotel underwriting data extracted from the submitted document.",
    input_schema: {
      type: "object" as const,
      properties: {
        profile: {
          type: "object",
          description: "Scalar, one-per-submission risk details.",
          properties: profileProperties,
        },
        locations: {
          type: "array",
          description: "One entry per physical building/location covered by this submission, for the Statement of Values - always include an entry for every location, including a single one described only in a premises/property section rather than a separate multi-location schedule. Only an empty array if the document genuinely gives no location-level property details at all (e.g. it names no address or building specs anywhere).",
          items: {
            type: "object",
            properties: locationProperties,
          },
        },
      },
      required: ["profile", "locations"],
    },
  };
}

function coerceExtractedData(raw: unknown): ExtractedData {
  const result = emptyExtractedData();
  if (typeof raw !== "object" || raw === null) return result;
  const obj = raw as Record<string, unknown>;

  if (typeof obj.profile === "object" && obj.profile !== null) {
    const profile = obj.profile as Record<string, unknown>;
    for (const field of PROFILE_FIELDS) {
      const v = profile[field.key];
      result.profile[field.key] = v === undefined ? null : (v as ExtractedData["profile"][string]);
    }
  }

  if (Array.isArray(obj.locations)) {
    result.locations = obj.locations.map((row) => {
      const rowObj = typeof row === "object" && row !== null ? (row as Record<string, unknown>) : {};
      return Object.fromEntries(
        LOCATION_FIELDS.map((f) => [f.key, rowObj[f.key] === undefined ? null : rowObj[f.key]])
      ) as ExtractedData["locations"][number];
    });
  }

  return result;
}

async function callClaude(
  client: Anthropic,
  content: Anthropic.MessageParam["content"]
): Promise<ExtractedData> {
  const tool = buildToolSchema();

  const response = await client.messages.create({
    model: EXTRACTION_MODEL,
    max_tokens: 4096,
    tools: [tool],
    tool_choice: { type: "tool", name: TOOL_NAME },
    messages: [
      {
        role: "user",
        content,
      },
    ],
  });

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
  );
  if (!toolUse) {
    throw new Error("Claude did not return the expected extraction tool call.");
  }
  return coerceExtractedData(toolUse.input);
}

const instructions =
  "Extract hotel commercial insurance underwriting data from the attached document into the " +
  `${TOOL_NAME} tool. Use null for any field not present in the document. Do not guess or ` +
  "fabricate values that aren't actually stated in the document.\n\n" +
  "IMPORTANT: the `locations` array feeds a Statement of Values, and must include one entry " +
  "for every physical building/location this submission covers - including a single property " +
  "described only in a premises/property information section, not just ones listed in a " +
  "separate multi-location schedule. A typical single-property hotel submission should produce " +
  "exactly one entry in `locations`, built from whatever address/building details the document " +
  "gives (leave individual location fields null if that specific detail isn't stated - but still " +
  "create the entry). Only return an empty `locations` array if the document truly gives no " +
  "location-level property details anywhere.";

export async function extractFromPdf(client: Anthropic, pdfBuffer: Buffer): Promise<ExtractedData> {
  return callClaude(client, [
    {
      type: "document",
      source: {
        type: "base64",
        media_type: "application/pdf",
        data: pdfBuffer.toString("base64"),
      },
    },
    { type: "text", text: instructions },
  ]);
}

export async function extractFromText(client: Anthropic, text: string): Promise<ExtractedData> {
  return callClaude(client, [
    { type: "text", text: `${instructions}\n\nDocument content:\n\n${text}` },
  ]);
}
