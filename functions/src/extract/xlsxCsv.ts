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

function parseProfileSheet(rows: unknown[][]): ProfileData {
  const profile: ProfileData = Object.fromEntries(PROFILE_FIELDS.map((f) => [f.key, null]));
  for (const row of rows) {
    const [rawLabel, rawValue] = row;
    if (rawLabel === undefined || rawLabel === null) continue;
    const field = matchField(PROFILE_FIELDS, String(rawLabel));
    if (field) profile[field.key] = coerceValue(rawValue, field.type);
  }
  return profile;
}

function parseLocationsTable(rows: unknown[][]): LocationRow[] {
  if (rows.length === 0) return [];
  const [headerRow, ...dataRows] = rows;
  const columns = headerRow.map((h) => (h === undefined || h === null ? undefined : matchField(LOCATION_FIELDS, String(h))));

  return dataRows
    .filter((row) => row.some((cell) => cell !== undefined && cell !== null && cell !== ""))
    .map((row) => {
      const location: LocationRow = Object.fromEntries(LOCATION_FIELDS.map((f) => [f.key, null]));
      row.forEach((cell, i) => {
        const field = columns[i];
        if (field) location[field.key] = coerceValue(cell, field.type);
      });
      return location;
    });
}

function looksLikeLocationsHeader(row: unknown[]): boolean {
  const matches = row.filter((cell) => cell !== undefined && cell !== null && matchField(LOCATION_FIELDS, String(cell)));
  return matches.length >= 2;
}

function findSheet(workbook: XLSX.WorkBook, nameHints: string[]): string | undefined {
  return workbook.SheetNames.find((name) => nameHints.some((hint) => normalize(name).includes(normalize(hint))));
}

function sheetToRows(workbook: XLSX.WorkBook, sheetName: string): unknown[][] {
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false });
}

/**
 * Parses an XLSX or CSV buffer into the extraction schema, purely by reading
 * cells/columns — no AI involved. Looks for a "Risk Profile" sheet (label,
 * value pairs) and a "SOV"/"Locations" sheet (header row + one row per
 * building). CSVs are single-table, so they're classified as a locations
 * table when the header matches multiple location fields, otherwise treated
 * as profile label/value pairs.
 */
export function parseSpreadsheet(buffer: Buffer, fileName: string): ExtractedData {
  const isCsv = fileName.toLowerCase().endsWith(".csv");
  const workbook = XLSX.read(buffer, { type: "buffer", raw: true });
  const result = emptyExtractedData();

  if (isCsv) {
    const rows = sheetToRows(workbook, workbook.SheetNames[0]);
    if (rows.length > 0 && looksLikeLocationsHeader(rows[0])) {
      result.locations = parseLocationsTable(rows);
    } else {
      result.profile = parseProfileSheet(rows);
    }
    return result;
  }

  const profileSheetName = findSheet(workbook, ["risk profile", "profile"]);
  if (profileSheetName) {
    result.profile = parseProfileSheet(sheetToRows(workbook, profileSheetName));
  }

  const locationsSheetName = findSheet(workbook, ["sov", "locations", "schedule"]);
  if (locationsSheetName) {
    result.locations = parseLocationsTable(sheetToRows(workbook, locationsSheetName));
  }

  return result;
}
