import { AcordFormId } from "./fill/registry";

export interface Industry {
  driveFolderName: string;
  forms: AcordFormId[];
}

/**
 * Mirrors the `id`s in web/src/config/industries.ts (the intake dropdown -
 * label/enabled live there since that's UI-only). This side says what
 * actually happens once a submission for that industry is reviewed: which
 * ACORD forms get filled, and which Drive folder the filled package lands
 * in. Each industry gets its own sibling folder next to "ACORDs" so a
 * separate Power Automate flow can watch it on its own, without needing to
 * inspect file contents to know whether a drop belongs to it.
 */
export const INDUSTRIES: Record<string, Industry> = {
  hotel: {
    driveFolderName: "Hotel ACORD Filled",
    forms: ["125", "126", "140"],
  },
};
