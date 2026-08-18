import { AcordFormId } from "./fill/registry";

export interface Industry {
  driveFolderId: string;
  factSheetFolderId: string;
  forms: AcordFormId[];
}

/**
 * Mirrors the `id`s in web/src/config/industries.ts (the intake dropdown -
 * label/enabled live there since that's UI-only). This side says what
 * actually happens once a submission for that industry is reviewed: which
 * ACORD forms get filled, and which Drive folder the filled package lands
 * in.
 *
 * driveFolderId is a real Drive folder, created once by hand (same pattern
 * as TEMPLATES_FOLDER_ID in drive.ts) - each industry gets its own folder
 * so a separate Power Automate flow can watch it on its own, without
 * needing to inspect file contents to know whether a drop belongs to it.
 * Belongs to (or is shared with) whichever account was used for the
 * one-time Drive authorization in SETUP.md - no separate per-folder
 * sharing needed. Adding a new industry means creating its Drive folder
 * and pasting its ID in here.
 */
export const INDUSTRIES: Record<string, Industry> = {
  hotel: {
    // "Hotel ACORD Filled"
    driveFolderId: "1gb_OiP1NW32ZMukk348kABSB9TvL6vBj",
    // TODO: replace with the real "Hotel Fact Sheets" Drive folder ID once
    // it's created (same one-time step as the ACORD folder above).
    factSheetFolderId: "REPLACE_WITH_HOTEL_FACT_SHEET_FOLDER_ID",
    forms: ["125", "126", "140"],
  },
};
