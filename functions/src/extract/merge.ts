import {
  ConflictMap,
  ExtractedData,
  FieldValue,
  LOCATION_FIELDS,
  LocationRow,
  PROFILE_FIELDS,
  ProfileData,
} from "../schema";

export interface SourcedExtraction {
  data: ExtractedData;
  source: string;
}

export interface MergedExtraction {
  profile: ProfileData;
  locations: LocationRow[];
  profileConflicts: ConflictMap;
  /** Parallel to `locations` - one conflict map per merged location row. */
  locationConflicts: ConflictMap[];
}

function normalizeAddress(value: FieldValue): string {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Merges one field across several candidate {value, source} pairs. A single
 * distinct value (however many sources agree on it) is used outright. Two or
 * more distinct non-null values can't be resolved automatically - the field
 * is left null and every distinct value is recorded so the reviewer can pick.
 */
function mergeField(
  candidates: Array<{ value: FieldValue; source: string }>
): { value: FieldValue; conflict?: ConflictMap[string] } {
  const nonNull = candidates.filter((c) => c.value !== null && c.value !== undefined && c.value !== "");
  if (nonNull.length === 0) return { value: null };

  const distinct: ConflictMap[string] = [];
  for (const c of nonNull) {
    if (!distinct.some((d) => d.value === c.value)) distinct.push({ value: c.value, source: c.source });
  }

  if (distinct.length === 1) return { value: distinct[0].value };
  return { value: null, conflict: distinct };
}

function mergeProfiles(sources: SourcedExtraction[]): { profile: ProfileData; conflicts: ConflictMap } {
  const profile: ProfileData = {};
  const conflicts: ConflictMap = {};

  for (const field of PROFILE_FIELDS) {
    const candidates = sources.map((s) => ({ value: s.data.profile[field.key] ?? null, source: s.source }));
    const { value, conflict } = mergeField(candidates);
    profile[field.key] = value;
    if (conflict) conflicts[field.key] = conflict;
  }

  return { profile, conflicts };
}

/**
 * Groups location rows across sources by normalized address so the same
 * building described in two different documents becomes one merged row
 * (with per-field conflicts, same as the profile) instead of a duplicate.
 * Rows with no address at all can't be matched to anything, so each stays
 * its own row.
 */
function mergeLocations(sources: SourcedExtraction[]): { locations: LocationRow[]; conflicts: ConflictMap[] } {
  const groups: Array<{ rows: Array<{ row: LocationRow; source: string }> }> = [];
  const groupByAddress = new Map<string, number>();

  for (const s of sources) {
    for (const row of s.data.locations) {
      const key = normalizeAddress(row.address);
      if (key && groupByAddress.has(key)) {
        groups[groupByAddress.get(key)!].rows.push({ row, source: s.source });
      } else {
        const index = groups.length;
        groups.push({ rows: [{ row, source: s.source }] });
        if (key) groupByAddress.set(key, index);
      }
    }
  }

  const locations: LocationRow[] = [];
  const conflicts: ConflictMap[] = [];

  for (const group of groups) {
    const merged: LocationRow = {};
    const rowConflicts: ConflictMap = {};
    for (const field of LOCATION_FIELDS) {
      const candidates = group.rows.map((r) => ({ value: r.row[field.key] ?? null, source: r.source }));
      const { value, conflict } = mergeField(candidates);
      merged[field.key] = value;
      if (conflict) rowConflicts[field.key] = conflict;
    }
    locations.push(merged);
    conflicts.push(rowConflicts);
  }

  return { locations, conflicts };
}

/** Combines extraction results from several uploaded documents into one profile + one SOV, flagging anything the sources disagree on rather than silently picking a value. */
export function mergeExtractions(sources: SourcedExtraction[]): MergedExtraction {
  const { profile, conflicts: profileConflicts } = mergeProfiles(sources);
  const { locations, conflicts: locationConflicts } = mergeLocations(sources);
  return { profile, locations, profileConflicts, locationConflicts };
}
