import * as XLSX from "xlsx";
import {
  ExtractedData,
  FieldDef,
  LocationRow,
  LOCATION_FIELDS,
  PROFILE_FIELDS,
  ProfileData,
  emptyExtractedData,
} from "../schema";

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function matchField(fields: FieldDef[], header: string): FieldDef | undefined {
  const normalizedHeader = normalize(header);
  return fields.find(
    (f) => normalize(f.label) === normalizedHeader || normalize(f.key) === normalizedHeader
  );
}

function coerceValue(raw: unknown, type: FieldDef["type"]): string | number | boolean | null {
  if (raw === undefined || raw === null || raw === "") return null;
  if (type === "number") {
    const n = typeof raw === "number" ? raw : Number(String(raw).replace(/[^0-9.-]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  if (type === "boolean") {
    const s = String(raw).trim().toLowerCase();
    if (["y", "yes", "true", "1"].includes(s)) return true;
    if (["n", "no", "false", "0"].includes(s)) return false;
    return null;
  }
  return String(raw).trim();
}

function isEmptyCell(cell: unknown): boolean {
  return cell === undefined || cell === null || cell === "";
}

/**
 * Scans every row of a sheet for "label, value" pairs matching a known
 * profile field. Section-header rows (a label with no value cell, e.g.
 * "Applicant Information") are naturally skipped since they have nothing in
 * column B to match against.
 */
function scanProfileFields(rows: unknown[][], profile: ProfileData): void {
  for (const row of rows) {
    const [rawLabel, rawValue] = row;
    if (typeof rawLabel !== "string" || isEmptyCell(rawValue)) continue;
    const field = matchField(PROFILE_FIELDS, rawLabel);
    if (field) profile[field.key] = coerceValue(rawValue, field.type);
  }
}

function looksLikeSovHeader(row: unknown[]): boolean {
  const matches = row.filter((cell) => !isEmptyCell(cell) && matchField(LOCATION_FIELDS, String(cell)));
  return matches.length >= 3;
}

/**
 * Reads a Statement of Values schedule starting right after its header row.
 * The real template has no fixed row count ("Add rows as needed — Totals
 * row updates automatically"), so this reads every row until a "TOTAL"
 * marker row or the end of the sheet — never a hardcoded limit. Rows that
 * are just template scaffolding (a location number with no other data, or
 * only a zero total) are skipped rather than surfaced as empty locations.
 */
function parseSovRows(headerRow: unknown[], dataRows: unknown[][]): LocationRow[] {
  const columns = headerRow.map((h) => (isEmptyCell(h) ? undefined : matchField(LOCATION_FIELDS, String(h))));
  const locations: LocationRow[] = [];

  for (const row of dataRows) {
    const firstCell = row[0];
    if (typeof firstCell === "string" && firstCell.trim().toLowerCase() === "total") break;

    const location: LocationRow = Object.fromEntries(LOCATION_FIELDS.map((f) => [f.key, null]));
    row.forEach((cell, i) => {
      const field = columns[i];
      if (field) location[field.key] = coerceValue(cell, field.type);
    });

    const hasRealData = LOCATION_FIELDS.some(
      (f) => f.key !== "locationNumber" && location[f.key] !== null && location[f.key] !== 0
    );
    if (hasRealData) locations.push(location);
  }

  return locations;
}

function sheetToRows(workbook: XLSX.WorkBook, sheetName: string): unknown[][] {
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false });
}

/**
 * Parses an XLSX or CSV buffer into the extraction schema, purely by
 * reading cells — no AI involved. The real data sheet template is a single
 * flat sheet mixing "label, value" rows (grouped under section-header rows
 * that are skipped automatically) with one Statement of Values table
 * (detected by its header row, e.g. "Loc #, Address, ..."). Every sheet in
 * the workbook is scanned the same way and merged, so this works whether
 * the source is one combined sheet (the real template) or split across
 * multiple sheets.
 */
export function parseSpreadsheet(buffer: Buffer, _fileName: string): ExtractedData {
  const workbook = XLSX.read(buffer, { type: "buffer", raw: true });
  const result = emptyExtractedData();

  for (const sheetName of workbook.SheetNames) {
    const rows = sheetToRows(workbook, sheetName);
    scanProfileFields(rows, result.profile);

    const headerIndex = rows.findIndex(looksLikeSovHeader);
    if (headerIndex !== -1) {
      const locations = parseSovRows(rows[headerIndex], rows.slice(headerIndex + 1));
      result.locations.push(...locations);
    }
  }

  return result;
}

/**
 * Flattens every sheet to CSV text, for feeding an arbitrary spreadsheet
 * (one that doesn't use our own label scheme, e.g. a client-provided
 * document rather than the agency's own data-sheet template) through
 * AI extraction instead of the label-matching parser above.
 */
export function spreadsheetToText(buffer: Buffer): string {
  const workbook = XLSX.read(buffer, { type: "buffer", raw: true });
  return workbook.SheetNames.map((name) => `Sheet: ${name}\n${XLSX.utils.sheet_to_csv(workbook.Sheets[name])}`).join(
    "\n\n"
  );
}
