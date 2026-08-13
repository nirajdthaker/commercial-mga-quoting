// Mirrors functions/src/schema.ts. The two projects don't share a package,
// so field keys/labels/order must be kept in sync manually here — this only
// drives what the Review screen renders, not the extraction itself.

export interface FieldDef {
  key: string;
  label: string;
  type: "string" | "number" | "boolean";
}

export const PROFILE_FIELDS: FieldDef[] = [
  { key: "namedInsured", label: "Named Insured", type: "string" },
  { key: "mailingAddress", label: "Mailing Address", type: "string" },
  { key: "propertyAddress", label: "Property Address", type: "string" },
  { key: "yearBuilt", label: "Year Built", type: "number" },
  { key: "numberOfStories", label: "Number of Stories", type: "number" },
  { key: "squareFootage", label: "Square Footage", type: "number" },
  { key: "constructionType", label: "Construction Type", type: "string" },
  { key: "protectionClass", label: "Protection Class", type: "string" },
  { key: "sprinklered", label: "Sprinklered", type: "boolean" },
  { key: "roofType", label: "Roof Type", type: "string" },
  { key: "roofYear", label: "Roof Year", type: "number" },
  { key: "numberOfRooms", label: "Number of Rooms", type: "number" },
  { key: "occupancyPercentage", label: "Occupancy %", type: "number" },
];

export const LOCATION_FIELDS: FieldDef[] = [
  { key: "locationNumber", label: "Location #", type: "string" },
  { key: "address", label: "Address", type: "string" },
  { key: "buildingValue", label: "Building Value", type: "number" },
  { key: "contentsValue", label: "Contents Value", type: "number" },
  { key: "businessIncomeValue", label: "Business Income Value", type: "number" },
  { key: "constructionType", label: "Construction Type", type: "string" },
  { key: "yearBuilt", label: "Year Built", type: "number" },
  { key: "squareFootage", label: "Square Footage", type: "number" },
];

export type FieldValue = string | number | boolean | null;
export type ProfileData = Record<string, FieldValue>;
export type LocationRow = Record<string, FieldValue>;

export function emptyLocationRow(): LocationRow {
  return Object.fromEntries(LOCATION_FIELDS.map((f) => [f.key, null]));
}
