import type * as mupdf from "mupdf";
import { ProfileData } from "../schema";
import { extractTrailingYear, loadMupdf, setCheckbox, setText, setYesNoText } from "./pdfHelpers";

const FORM = "ACORD 140";

export async function fillAcord140(templateBytes: Buffer, profile: ProfileData): Promise<Uint8Array> {
  const mu = await loadMupdf();
  const doc = mu.Document.openDocument(templateBytes, "application/pdf") as mupdf.PDFDocument;

  setText(doc, FORM, "F[0].P1[0].Form_CompletionDate_A[0]", profile.formCompletionDate);
  setText(doc, FORM, "F[0].P1[0].Producer_FullName_A[0]", profile.producer);
  setText(doc, FORM, "F[0].P1[0].Insurer_NAICCode_A[0]", profile.naicCode);
  const insuredName = [profile.firstNamedInsured, profile.dba ? `DBA ${profile.dba}` : null].filter(Boolean).join(" ");
  setText(doc, FORM, "F[0].P1[0].NamedInsured_FullName_A[0]", insuredName || null);
  setText(doc, FORM, "F[0].P1[0].Policy_EffectiveDate_A[0]", profile.proposedEffectiveDate);

  setText(doc, FORM, "F[0].P1[0].CommercialStructure_PhysicalAddress_LineOne_A[0]", profile.propertyAddress);
  setText(doc, FORM, "F[0].P1[0].CommercialStructure_Building_ProducerIdentifier_A[0]", profile.buildingNumber);
  setText(doc, FORM, "F[0].P1[0].CommercialStructure_Building_SublocationDescription_A[0]", profile.buildingDescription ?? profile.occupancy);

  // The property schedule is a repeating "subject of insurance" table -
  // Building / BPP / Business Income each get their own lettered row rather
  // than separate named fields.
  setText(doc, FORM, "F[0].P1[0].CommercialProperty_Premises_SubjectOfInsuranceCode_A[0]", "Building");
  setText(doc, FORM, "F[0].P1[0].CommercialProperty_Premises_LimitAmount_A[0]", profile.buildingValue);
  setText(doc, FORM, "F[0].P1[0].CommercialProperty_Premises_CoinsurancePercent_A[0]", profile.coinsurancePercent);
  setText(doc, FORM, "F[0].P1[0].CommercialProperty_Premises_ValuationCode_A[0]", profile.valuationMethod);
  setText(doc, FORM, "F[0].P1[0].CommercialProperty_Premises_CauseOfLossCode_A[0]", profile.causesOfLossForm);
  setText(doc, FORM, "F[0].P1[0].CommercialProperty_Premises_DeductibleAmount_A[0]", profile.deductibleAopWindHail);

  if (profile.bppValue !== null && profile.bppValue !== undefined) {
    setText(doc, FORM, "F[0].P1[0].CommercialProperty_Premises_SubjectOfInsuranceCode_B[0]", "Business Personal Property");
    setText(doc, FORM, "F[0].P1[0].CommercialProperty_Premises_LimitAmount_B[0]", profile.bppValue);
    setText(doc, FORM, "F[0].P1[0].CommercialProperty_Premises_CoinsurancePercent_B[0]", profile.coinsurancePercent);
    setText(doc, FORM, "F[0].P1[0].CommercialProperty_Premises_ValuationCode_B[0]", profile.valuationMethod);
  }

  if (profile.businessIncomeExtraExpense !== null && profile.businessIncomeExtraExpense !== undefined) {
    setText(doc, FORM, "F[0].P1[0].CommercialProperty_Premises_SubjectOfInsuranceCode_C[0]", "Business Income / Extra Expense");
    setText(doc, FORM, "F[0].P1[0].CommercialProperty_Premises_LimitAmount_C[0]", profile.businessIncomeExtraExpense);
  }

  setYesNoText(doc, FORM, "F[0].P1[0].CommercialProperty_Spoilage_YesNoCode_A[0]", profile.spoilageCoverage);

  setText(doc, FORM, "F[0].P1[0].Construction_ConstructionCode_A[0]", profile.constructionType);
  setText(doc, FORM, "F[0].P1[0].BuildingFireProtection_ProtectionClassCode_A[0]", profile.protectionClass);
  setText(doc, FORM, "F[0].P1[0].Construction_StoreyCount_A[0]", profile.numberOfStories);
  setText(doc, FORM, "F[0].P1[0].CommercialStructure_BuiltYear_A[0]", profile.yearBuilt);
  setText(doc, FORM, "F[0].P1[0].Construction_BuildingArea_A[0]", profile.totalArea);

  const roof = extractTrailingYear(profile.roofTypeAge as string | null);
  setText(doc, FORM, "F[0].P1[0].Construction_RoofMaterialCode_A[0]", roof.text);
  setText(doc, FORM, "F[0].P1[0].BuildingImprovement_RoofingYear_A[0]", roof.year);

  const updates = extractTrailingYear(profile.plumbingElectricalHvacUpdates as string | null);
  if (updates.year) {
    setText(doc, FORM, "F[0].P1[0].BuildingImprovement_WiringYear_A[0]", updates.year);
    setText(doc, FORM, "F[0].P1[0].BuildingImprovement_PlumbingYear_A[0]", updates.year);
    setText(doc, FORM, "F[0].P1[0].BuildingImprovement_HeatingYear_A[0]", updates.year);
  }

  const sprinklered = String(profile.sprinklered ?? "").trim().toLowerCase();
  if (sprinklered.startsWith("y")) setText(doc, FORM, "F[0].P1[0].BuildingFireProtection_Alarm_SprinklerPercent_A[0]", "100");
  else if (sprinklered.startsWith("n")) setText(doc, FORM, "F[0].P1[0].BuildingFireProtection_Alarm_SprinklerPercent_A[0]", "0");

  const fireAlarm = String(profile.fireAlarm ?? "").toLowerCase();
  if (fireAlarm.includes("central")) setCheckbox(doc, FORM, "F[0].P1[0].BuildingFireProtection_Alarm_CentralStationIndicator_A[0]", true);
  else if (fireAlarm.includes("local") || fireAlarm.includes("gong")) setCheckbox(doc, FORM, "F[0].P1[0].BuildingFireProtection_Alarm_LocalGongIndicator_A[0]", true);

  setText(doc, FORM, "F[0].P1[0].BuildingFireProtection_FireStationDistanceMileCount_A[0]", profile.distanceToFireHydrantStation);

  return doc.saveToBuffer("incremental").asUint8Array();
}
