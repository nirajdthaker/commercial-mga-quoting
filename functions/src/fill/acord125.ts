import { PDFDocument } from "pdf-lib";
import { ProfileData } from "../schema";
import { setCheckbox, setText, setYesNo } from "./pdfHelpers";

const FORM = "ACORD 125";

function splitContact(contact: string | null | undefined): { name: string | null; email: string | null; phone: string | null } {
  if (!contact) return { name: null, email: null, phone: null };
  const parts = contact.split("—").map((p) => p.trim());
  return { name: parts[0] ?? null, email: parts[1] ?? null, phone: parts[2] ?? null };
}

function entityCheckboxFor(entityType: string | null | undefined): string | null {
  if (!entityType) return null;
  const t = entityType.toLowerCase();
  if (t.includes("corp") && t.includes("sub")) return "ni1_ent_SUBCHAPTER";
  if (t.includes("joint")) return "ni1_ent_JOINT";
  if (t.includes("not for profit") || t.includes("non-profit") || t.includes("nonprofit")) return "ni1_ent_NOT";
  if (t.includes("corp")) return "ni1_ent_CORPORATION";
  if (t.includes("individual")) return "ni1_ent2_INDIVIDUAL";
  if (t.includes("llc")) return "ni1_ent2_LLC";
  if (t.includes("partnership")) return "ni1_ent2_PARTNERSHIP";
  if (t.includes("trust")) return "ni1_ent2_TRUST";
  return null;
}

export async function fillAcord125(templateBytes: Buffer, profile: ProfileData): Promise<Uint8Array> {
  const doc = await PDFDocument.load(templateBytes);
  const form = doc.getForm();

  const contact = splitContact(profile.producerContact as string | null);

  setText(form, FORM, "agency_name_address", profile.producer);
  setText(form, FORM, "naic_code", profile.naicCode);
  setText(form, FORM, "contact_name", contact.name);
  setText(form, FORM, "contact_email", contact.email);
  setText(form, FORM, "contact_phone", contact.phone);
  setText(form, FORM, "underwriter", profile.underwriterContact);

  const insuredName = [profile.firstNamedInsured, profile.dba ? `DBA ${profile.dba}` : null]
    .filter(Boolean)
    .join(" ");
  const ni1 = [insuredName || null, profile.mailingAddress].filter(Boolean).join("\n");
  setText(form, FORM, "ni1_name_address", ni1 || null);
  setText(form, FORM, "ni2_name_address", profile.otherNamedInsured);
  setText(form, FORM, "ni1_website", profile.website);
  setText(form, FORM, "ni1_phone", profile.businessPhone);
  setText(form, FORM, "ni1_fein", profile.feinNamedInsured1);
  setText(form, FORM, "ni2_fein", profile.feinNamedInsured2);
  setText(form, FORM, "ni1_sic", profile.sicCode);
  setText(form, FORM, "ni1_naics", profile.naicsCode);
  setText(form, FORM, "date_business_started", profile.dateBusinessStartedInsured1);

  const entityField = entityCheckboxFor(profile.entityType as string | null);
  if (entityField) setCheckbox(form, FORM, entityField, true);

  setText(form, FORM, "primary_ops_desc", profile.descriptionOfOperations);
  setText(form, FORM, "prem1_ops_desc", profile.descriptionOfOperations);

  const premisesAddress = (profile.premisesAddress as string | null) || (profile.mailingAddress as string | null);
  setText(form, FORM, "prem1_street", premisesAddress);
  setText(form, FORM, "prem1_revenue", profile.totalAnnualRevenue);
  setText(form, FORM, "prem1_ft_empl", profile.fullTimeEmployees);
  setText(form, FORM, "prem1_pt_empl", profile.partTimeEmployees);

  setText(form, FORM, "proposed_eff_date", profile.proposedEffectiveDate);
  setText(form, FORM, "proposed_exp_date", profile.proposedExpirationDate);

  const billingPlan = String(profile.billingPlan ?? "").toLowerCase();
  if (billingPlan.includes("direct")) setCheckbox(form, FORM, "billing_direct", true);
  else if (billingPlan.includes("agency") || billingPlan.includes("agcy")) setCheckbox(form, FORM, "billing_agency", true);

  setText(form, FORM, "payment_plan", profile.paymentPlan);
  setText(form, FORM, "audit", profile.auditBasis);

  setText(form, FORM, "prior_PROP_carrier", profile.priorCarrier);
  setText(form, FORM, "prior_PROP_policy_num", profile.expiringPolicyNumber);
  setText(form, FORM, "prior_PROP_premium", profile.expiringPremium);

  setYesNo(form, FORM, "q1b_Y", "q1b_N", profile.subsidiariesOrRelatedEntities);
  setYesNo(form, FORM, "q2_Y", "q2_N", profile.safetyProgramInPlace);
  setYesNo(form, FORM, "q8_Y", "q8_N", profile.fireSafetyCodeViolations);
  setYesNo(form, FORM, "q9_Y", "q9_N", profile.bankruptcyHistory);
  setYesNo(form, FORM, "q12_Y", "q12_N", profile.foreignOperations);

  form.updateFieldAppearances();
  return doc.save();
}
