import type * as mupdf from "mupdf";
import { ProfileData } from "../schema";
import { loadMupdf, setCheckbox, setText, setYesNoText, splitPair } from "./pdfHelpers";

const FORM = "ACORD 130";

export async function fillAcord130(templateBytes: Buffer, profile: ProfileData): Promise<Uint8Array> {
  const mu = await loadMupdf();
  const doc = mu.Document.openDocument(templateBytes, "application/pdf") as mupdf.PDFDocument;

  setText(doc, FORM, "F[0].P1[0].Text2[0]", profile.producer);
  const insuredName = [profile.firstNamedInsured, profile.dba ? `DBA ${profile.dba}` : null].filter(Boolean).join(" ");
  setText(doc, FORM, "F[0].P1[0].Text19[0]", insuredName || null);
  setText(doc, FORM, "F[0].P1[0].Text22[0]", profile.mailingAddress);
  setText(doc, FORM, "F[0].P1[0].Text63[0]", profile.proposedEffectiveDate);
  setText(doc, FORM, "F[0].P1[0].Text64[0]", profile.proposedExpirationDate);

  // Part 1 "states of operation" is a row of ten single-state boxes, not one
  // free-text field - so a "FL, GA" value gets split across them.
  const states = String(profile.wcStatesOfOperation ?? "")
    .split(/[,/]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const stateFields = ["Text67", "Text68", "Text69", "Text70", "Text71", "Text72", "Text73", "Text74", "Text75", "Text76"];
  states.slice(0, stateFields.length).forEach((state, i) => setText(doc, FORM, `F[0].P1[0].${stateFields[i]}[0]`, state));

  const [elEachAccident, elDiseasePolicy, elDiseaseEachEmployee] = String(profile.employersLiabilityLimits ?? "")
    .split("/")
    .map((s) => s.trim());
  setText(doc, FORM, "F[0].P1[0].Text77[0]", elEachAccident || null);
  setText(doc, FORM, "F[0].P1[0].Text78[0]", elDiseasePolicy || null);
  setText(doc, FORM, "F[0].P1[0].Text79[0]", elDiseaseEachEmployee || null);

  const uslh = String(profile.uslhMaritimeExposure ?? "").trim().toLowerCase();
  if (uslh.startsWith("y")) setCheckbox(doc, FORM, "F[0].P1[0].Check29[0]", true);

  // Officer include/exclude/elect - the form has room for four officers;
  // we only collect one combined name/ownership string, so it goes in the
  // first row.
  setText(doc, FORM, "F[0].P1[0].Text114[0]", profile.officerNamesOwnership);
  setText(doc, FORM, "F[0].P1[0].Text119[0]", profile.officersIncludedExcludedElected);

  // Classification / payroll schedule (state rating worksheet, page 2) -
  // three rows of "Description / Payroll".
  const [desc1, payroll1] = splitPair(profile.wcClassCode1, /\//);
  setText(doc, FORM, "F[0].P2[0].Text8[0]", desc1);
  setText(doc, FORM, "F[0].P2[0].Text13[0]", payroll1);

  const [desc2, payroll2] = splitPair(profile.wcClassCode2, /\//);
  setText(doc, FORM, "F[0].P2[0].Text19[0]", desc2);
  setText(doc, FORM, "F[0].P2[0].Text24[0]", payroll2);

  const [desc3, payroll3] = splitPair(profile.wcClassCode3, /\//);
  setText(doc, FORM, "F[0].P2[0].Text30[0]", desc3);
  setText(doc, FORM, "F[0].P2[0].Text35[0]", payroll3);

  setText(doc, FORM, "F[0].P2[0].Text168[0]", profile.experienceModificationFactor);

  setText(doc, FORM, "F[0].P3[0].Text3[0]", profile.priorWcCarrier);
  setText(doc, FORM, "F[0].P3[0].Text4[0]", profile.priorWcPolicyNumber);

  setYesNoText(doc, FORM, "F[0].P3[0].Text57[0]", profile.wcSafetyProgramDescribe);
  setText(doc, FORM, "F[0].P3[0].Text58[0]", profile.wcSafetyProgramDescribe);

  // No dedicated fields exist on this form for loss history or waiver of
  // subrogation - both go in the WC line's general remarks field.
  const remarks = [
    profile.wcLossHistory ? `Loss History: ${profile.wcLossHistory}` : null,
    profile.wcWaiverOfSubrogation ? `Waiver of Subrogation: ${profile.wcWaiverOfSubrogation}` : null,
  ]
    .filter(Boolean)
    .join("\n");
  setText(doc, FORM, "F[0].P4[0].Text27[0]", remarks || null);

  return doc.saveToBuffer("incremental").asUint8Array();
}
