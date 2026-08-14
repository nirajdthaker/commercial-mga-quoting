import ExcelJS from "exceljs";
import { LocationRow, ProfileData } from "../schema";

const FORM = "SOV Commercial";

// Maps the SOV template's column headers to our LOCATION_FIELDS keys. Only
// columns we actually collect are mapped - the rest (BLDG#, CITY, ST, ZIP,
// POOL, SIGN, CANOPY, PUMPS, OTHER STRUCTURES, per-system update years,
// DTB) are left blank rather than guessed.
const COLUMN_TO_FIELD: Record<string, string> = {
  "loc#": "locationNumber",
  address: "address",
  yb: "yearBuilt",
  occupancy: "occupancy",
  bldg: "buildingValue",
  bpp: "bppValue",
  "bi/ee": "businessIncomeValue",
  tiv: "tiv",
  "#ofstories": "numberOfStories",
  sf: "squareFootage",
  consttype: "constructionType",
  pcclass: "protectionClass",
  "dtcu/wfield": "distanceToCoast",
};

const NUMERIC_TOTAL_COLUMNS = new Set(["bldg", "bpp", "bi/ee", "tiv"]);

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9#/]/g, "");
}

function findRowByFirstCell(sheet: ExcelJS.Worksheet, matcher: (text: string) => boolean): ExcelJS.Row | undefined {
  let found: ExcelJS.Row | undefined;
  sheet.eachRow((row) => {
    if (found) return;
    const first = row.getCell(1).text?.trim();
    if (first && matcher(first)) found = row;
  });
  return found;
}

export async function fillSov(templateBytes: Buffer, profile: ProfileData, locations: LocationRow[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(templateBytes as unknown as ExcelJS.Buffer);
  const sheet = workbook.worksheets[0];

  const niRow = findRowByFirstCell(sheet, (t) => normalize(t) === "ni");
  if (niRow && profile.firstNamedInsured) niRow.getCell(2).value = String(profile.firstNamedInsured);

  const effDateRow = findRowByFirstCell(sheet, (t) => normalize(t) === "effdate");
  if (effDateRow && profile.proposedEffectiveDate) effDateRow.getCell(2).value = String(profile.proposedEffectiveDate);

  const headerRow = findRowByFirstCell(sheet, (t) => normalize(t) === "loc#");
  if (!headerRow) {
    throw new Error(`${FORM}: could not find the "LOC#" header row in the template`);
  }

  const columnFieldByIndex: Array<string | undefined> = [];
  headerRow.eachCell((cell, colNumber) => {
    const key = COLUMN_TO_FIELD[normalize(String(cell.text ?? ""))];
    if (key) columnFieldByIndex[colNumber] = key;
  });

  const firstDataRowNum = headerRow.number + 1;
  locations.forEach((location, i) => {
    const row = sheet.getRow(firstDataRowNum + i);
    columnFieldByIndex.forEach((fieldKey, colNumber) => {
      if (!fieldKey) return;
      const value = location[fieldKey];
      if (value !== null && value !== undefined) row.getCell(colNumber).value = value as string | number;
    });
    row.commit();
  });

  // Generate a fresh TOTAL row rather than relying on/shifting whatever
  // formula the template originally had - this works correctly regardless
  // of how many locations were written.
  const totalRowNum = firstDataRowNum + locations.length;
  const totalRow = sheet.getRow(totalRowNum);
  totalRow.getCell(1).value = "TOTAL";
  if (locations.length > 0) {
    columnFieldByIndex.forEach((_fieldKey, colNumber) => {
      const headerCell = headerRow.getCell(colNumber);
      const normalizedHeader = normalize(String(headerCell.text ?? ""));
      if (!NUMERIC_TOTAL_COLUMNS.has(normalizedHeader)) return;
      const colLetter = sheet.getColumn(colNumber).letter;
      totalRow.getCell(colNumber).value = {
        formula: `SUM(${colLetter}${firstDataRowNum}:${colLetter}${totalRowNum - 1})`,
      };
    });
  }
  totalRow.commit();

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
