import { AcordFormId } from "./fill/registry";

export interface Industry {
  driveFolderId: string;
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
 * This used to be discovered at runtime (find-or-create a sibling of
 * "ACORDs" by name), but that depended on the service account being able
 * to read the ACORDs folder's own parent to find its siblings - which
 * doesn't reliably work when it's a personal My Drive folder rather than a
 * Shared Drive, since a collaborator with folder-level access isn't
 * guaranteed visibility into the containing folder's own metadata. A
 * hardcoded ID sidesteps that entirely: adding a new industry means
 * creating its Drive folder, sharing it with the service account (see
 * SETUP.md), and pasting its ID in here.
 */
export const INDUSTRIES: Record<string, Industry> = {
  hotel: {
    // "Hotel ACORD Filled"
    driveFolderId: "1gb_OiP1NW32ZMukk348kABSB9TvL6vBj",
    forms: ["125", "126", "140"],
  },
};
