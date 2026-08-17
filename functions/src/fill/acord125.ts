import type * as mupdf from "mupdf";
import { ProfileData } from "../schema";
import { isYes, loadMupdf, setCheckbox, setText, setYesNoText } from "./pdfHelpers";

const FORM = "ACORD 125";

function splitContact(contact: string | null | undefined): { name: string | null; email: string | null; phone: string | null } {
  if (!contact) return { name: null, email: null, phone: null };
  const parts = contact.split("—").map((p) => p.trim());
  return { name: parts[0] ?? null, email: parts[1] ?? null, phone: parts[2] ?? null };
}

/**
 * Source documents often give the premises address as literally "Same" (as
 * in "same as mailing address") rather than repeating the address - writing
 * that word into a physical-address field would be wrong, so treat it as
 * unset and fall back to the mailing address instead.
 */
function resolveOrFallback(value: string | null | undefined, fallback: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed || /^same\b/i.test(trimmed)) return (fallback as string | null) ?? null;
  return trimmed;
}

function entityCheckboxFor(entityType: string | null | undefined): string | null {
  if (!entityType) return null;
  const t = entityType.toLowerCase();
  if (t.includes("corp") && t.includes("sub")) return "F[0].P1[0].NamedInsured_LegalEntity_SubchapterSCorporationIndicator_A[0]";
  if (t.includes("joint")) return "F[0].P1[0].NamedInsured_LegalEntity_JointVentureIndicator_A[0]";
  if (t.includes("not for profit") || t.includes("non-profit") || t.includes("nonprofit")) return "F[0].P1[0].NamedInsured_LegalEntity_NotForProfitIndicator_A[0]";
  if (t.includes("corp")) return "F[0].P1[0].NamedInsured_LegalEntity_CorporationIndicator_A[0]";
  if (t.includes("llc") || t.includes("limited liability")) return "F[0].P1[0].NamedInsured_LegalEntity_LimitedLiabilityCorporationIndicator_A[0]";
  if (t.includes("partnership")) return "F[0].P1[0].NamedInsured_LegalEntity_PartnershipIndicator_A[0]";
  if (t.includes("trust")) return "F[0].P1[0].NamedInsured_LegalEntity_TrustIndicator_A[0]";
  if (t.includes("individual")) return "F[0].P1[0].NamedInsured_LegalEntity_IndividualIndicator_A[0]";
  return null;
}

export async function fillAcord125(templateBytes: Buffer, profile: ProfileData): Promise<Uint8Array> {
  const mu = await loadMupdf();
  const doc = mu.Document.openDocument(templateBytes, "application/pdf") as mupdf.PDFDocument;

  const contact = splitContact(profile.producerContact as string | null);

  setText(doc, FORM, "F[0].P1[0].Form_CompletionDate_A[0]", profile.formCompletionDate);
  setText(doc, FORM, "F[0].P1[0].Producer_FullName_A[0]", profile.producer);
  setText(doc, FORM, "F[0].P1[0].Insurer_NAICCode_A[0]", profile.naicCode);
  setText(doc, FORM, "F[0].P1[0].Producer_ContactPerson_FullName_A[0]", contact.name);
  setText(doc, FORM, "F[0].P1[0].Producer_ContactPerson_EmailAddress_A[0]", contact.email);
  setText(doc, FORM, "F[0].P1[0].Producer_ContactPerson_PhoneNumber_A[0]", contact.phone);
  setText(doc, FORM, "F[0].P1[0].Insurer_Underwriter_FullName_A[0]", profile.underwriterContact);

  const insuredName = [profile.firstNamedInsured, profile.dba ? `DBA ${profile.dba}` : null]
    .filter(Boolean)
    .join(" ");
  setText(doc, FORM, "F[0].P1[0].NamedInsured_FullName_A[0]", insuredName || null);
  setText(doc, FORM, "F[0].P1[0].NamedInsured_MailingAddress_LineOne_A[0]", profile.mailingAddress);
  setText(doc, FORM, "F[0].P1[0].NamedInsured_FullName_B[0]", profile.otherNamedInsured);
  setText(doc, FORM, "F[0].P1[0].NamedInsured_Primary_WebsiteAddress_A[0]", profile.website);
  setText(doc, FORM, "F[0].P1[0].NamedInsured_Primary_PhoneNumber_A[0]", profile.businessPhone);
  setText(doc, FORM, "F[0].P1[0].NamedInsured_TaxIdentifier_A[0]", profile.feinNamedInsured1);
  setText(doc, FORM, "F[0].P1[0].NamedInsured_TaxIdentifier_B[0]", profile.feinNamedInsured2);
  setText(doc, FORM, "F[0].P1[0].NamedInsured_SICCode_A[0]", profile.sicCode);
  setText(doc, FORM, "F[0].P1[0].NamedInsured_NAICSCode_A[0]", profile.naicsCode);
  setText(doc, FORM, "F[0].P2[0].NamedInsured_BusinessStartDate_A[0]", profile.dateBusinessStartedInsured1);

  const entityField = entityCheckboxFor(profile.entityType as string | null);
  if (entityField) setCheckbox(doc, FORM, entityField, true);

  setText(doc, FORM, "F[0].P2[0].CommercialPolicy_OperationsDescription_A[0]", profile.descriptionOfOperations);
  setText(doc, FORM, "F[0].P2[0].BuildingOccupancy_OperationsDescription_A[0]", profile.descriptionOfOperations);

  const premisesAddress = resolveOrFallback(profile.premisesAddress as string | null, profile.mailingAddress as string | null);
  setText(doc, FORM, "F[0].P2[0].CommercialStructure_PhysicalAddress_LineOne_A[0]", premisesAddress);
  setText(doc, FORM, "F[0].P2[0].CommercialStructure_AnnualRevenueAmount_A[0]", profile.totalAnnualRevenue);
  setText(doc, FORM, "F[0].P2[0].BusinessInformation_FullTimeEmployeeCount_A[0]", profile.fullTimeEmployees);
  setText(doc, FORM, "F[0].P2[0].BusinessInformation_PartTimeEmployeeCount_A[0]", profile.partTimeEmployees);
  setText(doc, FORM, "F[0].P2[0].Construction_BuildingArea_A[0]", profile.totalArea);

  setText(doc, FORM, "F[0].P1[0].Policy_EffectiveDate_A[0]", profile.proposedEffectiveDate);
  setText(doc, FORM, "F[0].P1[0].Policy_ExpirationDate_A[0]", profile.proposedExpirationDate);

  const billingPlan = String(profile.billingPlan ?? "").toLowerCase();
  if (billingPlan.includes("direct")) setCheckbox(doc, FORM, "F[0].P1[0].Policy_Payment_DirectBillIndicator_A[0]", true);
  else if (billingPlan.includes("agency") || billingPlan.includes("agcy")) setCheckbox(doc, FORM, "F[0].P1[0].Policy_Payment_ProducerBillIndicator_A[0]", true);

  setText(doc, FORM, "F[0].P1[0].Policy_Payment_PaymentScheduleCode_A[0]", profile.paymentPlan);
  setText(doc, FORM, "F[0].P1[0].Policy_Audit_FrequencyCode_A[0]", profile.auditBasis);

  setText(doc, FORM, "F[0].P4[0].PriorCoverage_Property_InsurerFullName_B[0]", profile.priorCarrier);
  setText(doc, FORM, "F[0].P4[0].PriorCoverage_Property_PolicyNumberIdentifier_B[0]", profile.expiringPolicyNumber);
  setText(doc, FORM, "F[0].P4[0].PriorCoverage_Property_TotalPremiumAmount_B[0]", profile.expiringPremium);

  // These are disclosure-style questions - silence in the source document
  // conventionally means "no" (violations, bankruptcies, subsidiaries, and
  // foreign operations are always mentioned when they exist), so an
  // unanswered question defaults to N rather than being left blank.
  setYesNoText(doc, FORM, "F[0].P3[0].CommercialPolicy_Question_AAJCode_A[0]", profile.subsidiariesOrRelatedEntities, "N");
  setYesNoText(doc, FORM, "F[0].P3[0].CommercialPolicy_Question_AAFCode_A[0]", profile.fireSafetyCodeViolations, "N");
  setYesNoText(doc, FORM, "F[0].P3[0].CommercialPolicy_Question_KAKCode_A[0]", profile.bankruptcyHistory, "N");
  setYesNoText(doc, FORM, "F[0].P3[0].CommercialPolicy_Question_KACCode_A[0]", profile.foreignOperations, "N");
  setYesNoText(doc, FORM, "F[0].P3[0].CommercialPolicy_Question_KAACode_A[0]", profile.safetyProgramInPlace, "N");
  // "Any policy/coverage declined, cancelled or non-renewed" - the general
  // (not line-specific) version of this question on the form; our GL
  // cancellation history is a real instance of that if present.
  setYesNoText(doc, FORM, "F[0].P3[0].CommercialPolicy_Question_AACCode_A[0]", profile.priorGlCancellations, "N");

  // Loss History section: "No Prior Losses" is a checkbox, the inverse of
  // a Yes/No answer - checked means no losses. We only have a single
  // Yes/No signal, not itemized per-claim data for the row-by-row table
  // that follows it if there were losses, so that table is intentionally
  // left blank either way (per the "don't fill follow-up detail we don't
  // have data for" rule) - but the checkbox itself still needs a value,
  // defaulting to checked/no-losses like the other disclosure questions.
  setCheckbox(doc, FORM, "F[0].P4[0].LossHistory_NoPriorLossesIndicator_A[0]", !isYes(profile.glClaimsLast3Years));

  return doc.saveToBuffer("incremental").asUint8Array();
}
