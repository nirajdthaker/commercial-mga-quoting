// Placeholder Hotel extraction schema. This is intentionally a plain data
// structure (not hardcoded per-industry logic) so it's the single source of
// truth for: the Claude extraction tool's input schema, the XLSX/CSV column
// mapping, and what the Review screen renders. Adjust field keys/labels here
// once the real Hotel data sheet template is finalized — nothing else needs
// to change.

export interface FieldDef {
  key: string;
  label: string;
  type: "string" | "number" | "boolean";
  description: string;
}

// Scalar, one-per-submission fields (maps toward the ACORD application).
export const PROFILE_FIELDS: FieldDef[] = [
  { key: "namedInsured", label: "Named Insured", type: "string", description: "Legal name of the insured business/entity" },
  { key: "mailingAddress", label: "Mailing Address", type: "string", description: "Insured's mailing address" },
  { key: "propertyAddress", label: "Property Address", type: "string", description: "Address of the hotel property" },
  { key: "yearBuilt", label: "Year Built", type: "number", description: "Year the primary building was constructed" },
  { key: "numberOfStories", label: "Number of Stories", type: "number", description: "Number of floors/stories" },
  { key: "squareFootage", label: "Square Footage", type: "number", description: "Total building square footage" },
  { key: "constructionType", label: "Construction Type", type: "string", description: "e.g. Frame, Joisted Masonry, Non-Combustible, Fire Resistive" },
  { key: "protectionClass", label: "Protection Class", type: "string", description: "ISO protection class rating, if present" },
  { key: "sprinklered", label: "Sprinklered", type: "boolean", description: "Whether the property has a sprinkler system" },
  { key: "roofType", label: "Roof Type", type: "string", description: "Roof covering material" },
  { key: "roofYear", label: "Roof Year", type: "number", description: "Year the roof was installed or last replaced" },
  { key: "numberOfRooms", label: "Number of Rooms", type: "number", description: "Total number of guest rooms" },
  { key: "occupancyPercentage", label: "Occupancy %", type: "number", description: "Average occupancy rate, if provided" },
];

// Repeating, one-row-per-location fields (maps toward the SOV schedule).
export const LOCATION_FIELDS: FieldDef[] = [
  { key: "locationNumber", label: "Location #", type: "string", description: "Location or building number/identifier" },
  { key: "address", label: "Address", type: "string", description: "Address of this specific location/building" },
  { key: "buildingValue", label: "Building Value", type: "number", description: "Insured value of the building" },
  { key: "contentsValue", label: "Contents Value", type: "number", description: "Insured value of contents" },
  { key: "businessIncomeValue", label: "Business Income Value", type: "number", description: "Insured business income/BI value" },
  { key: "constructionType", label: "Construction Type", type: "string", description: "Construction type for this location" },
  { key: "yearBuilt", label: "Year Built", type: "number", description: "Year this location was built" },
  { key: "squareFootage", label: "Square Footage", type: "number", description: "Square footage of this location" },
];

export type FieldValue = string | number | boolean | null;
export type ProfileData = Record<string, FieldValue>;
export type LocationRow = Record<string, FieldValue>;

export interface ExtractedData {
  profile: ProfileData;
  locations: LocationRow[];
}

function emptyRecord(fields: FieldDef[]): Record<string, FieldValue> {
  return Object.fromEntries(fields.map((f) => [f.key, null]));
}

export function emptyExtractedData(): ExtractedData {
  return { profile: emptyRecord(PROFILE_FIELDS), locations: [] };
}
