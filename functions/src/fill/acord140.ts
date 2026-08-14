import { PDFDocument } from "pdf-lib";
import { ProfileData } from "../schema";
import { extractTrailingYear, setCheckbox, setText } from "./pdfHelpers";

const FORM = "ACORD 140";

export async function fillAcord140(templateBytes: Buffer, profile: ProfileData): Promise<Uint8Array> {
  const doc = await PDFDocument.load(templateBytes);
  const form = doc.getForm();

  setText(form, FORM, "agency_name", profile.producer);
  setText(form, FORM, "naic_code", profile.naicCode);
  const insuredName = [profile.firstNamedInsured, profile.dba ? `DBA ${profile.dba}` : null].filter(Boolean).join(" ");
  setText(form, FORM, "named_insureds", insuredName || null);
  setText(form, FORM, "effective_date", profile.proposedEffectiveDate);

  setText(form, FORM, "prem1_address", profile.propertyAddress);
  setText(form, FORM, "prem1_bldg_num", profile.buildingNumber);
  setText(form, FORM, "prem1_bldg_desc", profile.buildingDescription ?? profile.occupancy);

  // The property schedule is a repeating "subject of insurance" table -
  // Building / BPP / Business Income each get their own row rather than
  // separate named fields.
  setText(form, FORM, "prem1_soi1", "Building");
  setText(form, FORM, "prem1_amount1", profile.buildingValue);
  setText(form, FORM, "prem1_coins1", profile.coinsurancePercent);
  setText(form, FORM, "prem1_valuation1", profile.valuationMethod);
  setText(form, FORM, "prem1_causes_loss1", profile.causesOfLossForm);
  setText(form, FORM, "prem1_ded1", profile.deductibleAopWindHail);

  if (profile.bppValue !== null && profile.bppValue !== undefined) {
    setText(form, FORM, "prem1_soi2", "Business Personal Property");
    setText(form, FORM, "prem1_amount2", profile.bppValue);
    setText(form, FORM, "prem1_coins2", profile.coinsurancePercent);
    setText(form, FORM, "prem1_valuation2", profile.valuationMethod);
  }

  if (profile.businessIncomeExtraExpense !== null && profile.businessIncomeExtraExpense !== undefined) {
    setText(form, FORM, "prem1_soi3", "Business Income / Extra Expense");
    setText(form, FORM, "prem1_amount3", profile.businessIncomeExtraExpense);
  }

  const spoilage = String(profile.spoilageCoverage ?? "").trim().toLowerCase();
  if (spoilage.startsWith("y")) setCheckbox(form, FORM, "spoilage_coverage_Y", true);
  else if (spoilage.startsWith("n")) setCheckbox(form, FORM, "spoilage_coverage_N", true);

  setText(form, FORM, "constr_type", profile.constructionType);
  setText(form, FORM, "prot_class", profile.protectionClass);
  setText(form, FORM, "num_stories", profile.numberOfStories);
  setText(form, FORM, "year_built", profile.yearBuilt);
  setText(form, FORM, "total_area_sqft", profile.totalArea);

  const roof = extractTrailingYear(profile.roofTypeAge as string | null);
  setText(form, FORM, "roof_type", roof.text);
  setText(form, FORM, "roofing_yr", roof.year);

  const updates = extractTrailingYear(profile.plumbingElectricalHvacUpdates as string | null);
  if (updates.year) {
    setText(form, FORM, "wiring_yr", updates.year);
    setText(form, FORM, "plumbing_yr", updates.year);
    setText(form, FORM, "heating_yr", updates.year);
  }

  const sprinklered = String(profile.sprinklered ?? "").trim().toLowerCase();
  if (sprinklered.startsWith("y")) setText(form, FORM, "pct_sprinklered", "100");
  else if (sprinklered.startsWith("n")) setText(form, FORM, "pct_sprinklered", "0");

  const fireAlarm = String(profile.fireAlarm ?? "").toLowerCase();
  if (fireAlarm.includes("central")) setCheckbox(form, FORM, "fire_alarm_central_station", true);
  else if (fireAlarm.includes("local") || fireAlarm.includes("gong")) setCheckbox(form, FORM, "fire_alarm_local_gong", true);

  setText(form, FORM, "dist_firestation_mi", profile.distanceToFireHydrantStation);

  form.updateFieldAppearances();
  return doc.save();
}
