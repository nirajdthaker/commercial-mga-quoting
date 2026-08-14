import { PDFDocument } from "pdf-lib";
import { ProfileData } from "../schema";
import { setCheckbox, setText, setYesNo, splitPair } from "./pdfHelpers";

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

export async function fillAcord126(templateBytes: Buffer, profile: ProfileData): Promise<Uint8Array> {
  const doc = await PDFDocument.load(templateBytes);
  const form = doc.getForm();

  setText(form, FORM, "agency_name", profile.producer);
  setText(form, FORM, "naic_code", profile.naicCode);
  const insuredName = [profile.firstNamedInsured, profile.dba ? `DBA ${profile.dba}` : null].filter(Boolean).join(" ");
  setText(form, FORM, "applicant_name", insuredName || null);
  setText(form, FORM, "effective_date", profile.proposedEffectiveDate);

  const [aggregate, eachOccurrence] = splitPair(profile.glGeneralAggregateEachOccurrence, /\//);
  setText(form, FORM, "limit_general_aggregate", aggregate);
  setText(form, FORM, "limit_each_occurrence", eachOccurrence);
  setText(form, FORM, "limit_damage_rented_premises", profile.damageToPremisesRented);
  setText(form, FORM, "limit_medical_expense", profile.glMedicalPayments);
  setText(form, FORM, "limit_personal_adv_injury", profile.personalAdvertisingInjury);
  setText(form, FORM, "limit_products_comp_ops_agg", profile.productsCompletedOperationsAggregate);
  setText(form, FORM, "ded_property_damage", profile.glDeductibleSir);

  const trigger = String(profile.occurrenceVsClaimsMade ?? "").toLowerCase();
  if (trigger.includes("occurrence")) setCheckbox(form, FORM, "cgl_occurrence", true);
  else if (trigger.includes("claims")) setCheckbox(form, FORM, "cgl_claims_made", true);
  setText(form, FORM, "cm_retro_date", profile.retroactiveDate);

  const class1 = splitClassification(profile.glClassification1 as string | null);
  setText(form, FORM, "hazard1_classification", class1.classification);
  setText(form, FORM, "hazard1_premium_basis", class1.basis);
  setText(form, FORM, "hazard1_exposure", class1.amount);
  setText(form, FORM, "hazard1_class_code", profile.isoClassificationCodes);

  const class2 = splitClassification(profile.glClassification2 as string | null);
  setText(form, FORM, "hazard2_classification", class2.classification);
  setText(form, FORM, "hazard2_premium_basis", class2.basis);
  setText(form, FORM, "hazard2_exposure", class2.amount);

  setYesNo(form, FORM, "p6_Y", "p6_N", profile.productsRecallExposure);
  setText(form, FORM, "con_work_desc", profile.subcontractedWork);
  setText(form, FORM, "addl_interest126_name_address", profile.additionalInsuredsCertHolders);

  const watercraftPools = String(profile.watercraftPoolsOnPremises ?? "").trim().toLowerCase();
  const firstWord = watercraftPools.split(/[\s—-]/)[0];
  if (["y", "yes"].includes(firstWord)) {
    setCheckbox(form, FORM, "g6_Y", true);
    setCheckbox(form, FORM, "g11_Y", true);
  } else if (["n", "no"].includes(firstWord)) {
    setCheckbox(form, FORM, "g6_N", true);
    setCheckbox(form, FORM, "g11_N", true);
  }

  form.updateFieldAppearances();
  return doc.save();
}
