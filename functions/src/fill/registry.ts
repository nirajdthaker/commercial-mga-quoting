import { ProfileData } from "../schema";
import { fillAcord125 } from "./acord125";
import { fillAcord126 } from "./acord126";
import { fillAcord130 } from "./acord130";
import { fillAcord140 } from "./acord140";

type FillFn = (templateBytes: Buffer, profile: ProfileData) => Promise<Uint8Array>;

/** Every ACORD PDF form this project knows how to fill, keyed by form number. */
export const ACORD_FORMS = {
  "125": { templateName: "ACORD_125_fillable.pdf", fill: fillAcord125 },
  "126": { templateName: "ACORD_126_fillable.pdf", fill: fillAcord126 },
  "130": { templateName: "ACORD_130_fillable.pdf", fill: fillAcord130 },
  "140": { templateName: "ACORD_140_fillable.pdf", fill: fillAcord140 },
} satisfies Record<string, { templateName: string; fill: FillFn }>;

export type AcordFormId = keyof typeof ACORD_FORMS;
