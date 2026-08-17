import type * as mupdf from "mupdf";
import { ProfileData } from "../schema";
import { loadMupdf, setCheckbox, setText, setYesNoText, splitPair } from "./pdfHelpers";

const FORM = "ACORD 126";

/** "Hotels/Motels — Exposure Basis: Gross Sales — $2,000,000" -> classification / basis / amount */
function splitClassification(value: string | null | undefined): { classification: string | null; basis: string | null; amount: string | null } {
  if (!value) return { classification: null, basis: null, amount: null };
  const parts = value.split("—").map((p) => p.trim());
  return {
    classification: parts[0] ?? null,
    basis: parts[1]?.replace(/^Exposure Basis:\s*/i, "") ?? null,
    amount: parts[2] ?? null,
  };
}

/**
 * A real ISO class code is a short single token (e.g. "16910"). When one
 * hasn't actually been assigned, extraction sometimes captures an
 * explanatory note instead (e.g. "GAP - underwriter assigned") - writing
 * that into the Class Code column is worse than leaving it blank, since the
 * column's too narrow for anything but a real code.
 */
function looksLikeClassCode(value: string | null | undefined): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= 10 && !/\s/.test(trimmed);
}

export async function fillAcord126(templateBytes: Buffer, profile: ProfileData): Promise<Uint8Array> {
  const mu = await loadMupdf();
  const doc = mu.Document.openDocument(templateBytes, "application/pdf") as mupdf.PDFDocument;

  setText(doc, FORM, "F[0].P1[0].Text2[0]", profile.formCompletionDate);
  setText(doc, FORM, "F[0].P1[0].Text3[0]", profile.producer);
  setText(doc, FORM, "F[0].P1[0].Text7[0]", profile.naicCode);
  const insuredName = [profile.firstNamedInsured, profile.dba ? `DBA ${profile.dba}` : null].filter(Boolean).join(" ");
  setText(doc, FORM, "F[0].P1[0].Text8[0]", insuredName || null);
  setText(doc, FORM, "F[0].P1[0].Text5[0]", profile.proposedEffectiveDate);

  const [aggregate, eachOccurrence] = splitPair(profile.glGeneralAggregateEachOccurrence, /\//);
  setText(doc, FORM, "F[0].P1[0].Text14[0]", aggregate);
  setText(doc, FORM, "F[0].P1[0].Text18[0]", eachOccurrence);
  setText(doc, FORM, "F[0].P1[0].Text19[0]", profile.damageToPremisesRented);
  setText(doc, FORM, "F[0].P1[0].Text20[0]", profile.glMedicalPayments);
  setText(doc, FORM, "F[0].P1[0].Text17[0]", profile.personalAdvertisingInjury);
  setText(doc, FORM, "F[0].P1[0].Text16[0]", profile.productsCompletedOperationsAggregate);
  setText(doc, FORM, "F[0].P1[0].Text10[0]", profile.glDeductibleSir);

  const trigger = String(profile.occurrenceVsClaimsMade ?? "").toLowerCase();
  if (trigger.includes("occurrence")) setCheckbox(doc, FORM, "F[0].P1[0].Check3[0]", true);
  else if (trigger.includes("claims")) setCheckbox(doc, FORM, "F[0].P1[0].Check2[0]", true);
  setText(doc, FORM, "F[0].P1[0].Text128[0]", profile.retroactiveDate);

  const class1 = splitClassification(profile.glClassification1 as string | null);
  setText(doc, FORM, "F[0].P1[0].Text31[0]", class1.classification);
  setText(doc, FORM, "F[0].P1[0].Text33[0]", class1.basis);
  setText(doc, FORM, "F[0].P1[0].Text34[0]", class1.amount);
  const isoCode = profile.isoClassificationCodes as string | null;
  setText(doc, FORM, "F[0].P1[0].Text32[0]", looksLikeClassCode(isoCode) ? isoCode : null);

  const class2 = splitClassification(profile.glClassification2 as string | null);
  setText(doc, FORM, "F[0].P1[0].Text42[0]", class2.classification);
  setText(doc, FORM, "F[0].P1[0].Text44[0]", class2.basis);
  setText(doc, FORM, "F[0].P1[0].Text45[0]", class2.amount);

  setYesNoText(doc, FORM, "F[0].P2[0].Text49[0]", profile.productsRecallExposure);
  // No field on this form fits a free-text description of subcontracted
  // work - Text15[0] is a numeric "% of work subcontracted" field, not a
  // description, so subcontractedWork is intentionally left unmapped here
  // rather than writing text into a percentage field.
  setText(doc, FORM, "F[0].P3[0].Text4[0]", profile.additionalInsuredsCertHolders);

  setYesNoText(doc, FORM, "F[0].P3[0].Text28[0]", profile.watercraftPoolsOnPremises);
  setYesNoText(doc, FORM, "F[0].P3[0].Text36[0]", profile.watercraftPoolsOnPremises);

  return doc.saveToBuffer("incremental").asUint8Array();
}
