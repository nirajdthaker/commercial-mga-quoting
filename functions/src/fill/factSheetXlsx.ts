import ExcelJS from "exceljs";
import { FieldDef, LOCATION_FIELDS, LocationRow, PROFILE_FIELDS, ProfileData } from "../schema";

// The columns whose TOTAL row cell should sum the data rows above it, same
// convention as fill/sov.ts's SOV Commercial.xlsx output.
const NUMERIC_TOTAL_FIELDS = new Set(["buildingValue", "bppValue", "businessIncomeValue", "tiv"]);

function groupBySection(fields: FieldDef[]): Array<[string, FieldDef[]]> {
  const groups: Array<[string, FieldDef[]]> = [];
  for (const field of fields) {
    const last = groups[groups.length - 1];
    if (last && last[0] === field.section) last[1].push(field);
    else groups.push([field.section, [field]]);
  }
  return groups;
}

/**
 * Writes a brand-new flat "label, value" sheet plus one SOV table - the
 * exact layout extract/xlsxCsv.ts already reads back in by matching label
 * text, not fixed positions. That symmetry is what lets a generated Fact
 * Sheet be re-uploaded straight into the ACORD intake with no new parsing
 * code on that side.
 */
export async function buildFactSheetXlsx(profile: ProfileData, locations: LocationRow[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Fact Sheet");
  sheet.columns = [{ width: 40 }, { width: 40 }];

  for (const [section, fields] of groupBySection(PROFILE_FIELDS)) {
    const sectionRow = sheet.addRow([section]);
    sectionRow.font = { bold: true };
    for (const field of fields) {
      const value = profile[field.key];
      sheet.addRow([field.label, value === null || value === undefined ? "" : value]);
    }
  }

  sheet.addRow([]);

  const headerRow = sheet.addRow(LOCATION_FIELDS.map((f) => f.label));
  headerRow.font = { bold: true };
  const firstDataRowNum = headerRow.number + 1;

  locations.forEach((location, i) => {
    const row = sheet.getRow(firstDataRowNum + i);
    LOCATION_FIELDS.forEach((field, colIndex) => {
      const value = location[field.key];
      if (value !== null && value !== undefined) row.getCell(colIndex + 1).value = value as string | number;
    });
    row.commit();
  });

  const totalRowNum = firstDataRowNum + locations.length;
  const totalRow = sheet.getRow(totalRowNum);
  totalRow.getCell(1).value = "TOTAL";
  if (locations.length > 0) {
    LOCATION_FIELDS.forEach((field, colIndex) => {
      if (!NUMERIC_TOTAL_FIELDS.has(field.key)) return;
      const colLetter = sheet.getColumn(colIndex + 1).letter;
      totalRow.getCell(colIndex + 1).value = {
        formula: `SUM(${colLetter}${firstDataRowNum}:${colLetter}${totalRowNum - 1})`,
      };
    });
  }
  totalRow.commit();

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
