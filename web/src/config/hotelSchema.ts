// Mirrors functions/src/schema.ts. The two projects don't share a package,
// so field keys/labels/order/section must be kept in sync manually here —
// this only drives what the Review screen renders, not the extraction
// itself.

export interface FieldDef {
  key: string;
  label: string;
  type: "string" | "number" | "boolean";
  section: string;
}

function field(section: string, label: string, key: string): FieldDef {
  return { section, label, key, type: "string" };
}

export const PROFILE_FIELDS: FieldDef[] = [
  // ACORD 125 — Producer
  field("Producer", "Producer", "producer"),
  field("Producer", "Contact", "producerContact"),
  field("Producer", "NAIC Code", "naicCode"),
  field("Producer", "Underwriter / Carrier Contact", "underwriterContact"),

  // ACORD 125 — Applicant Information
  field("Applicant Information", "First Named Insured", "firstNamedInsured"),
  field("Applicant Information", "DBA", "dba"),
  field("Applicant Information", "Other Named Insured (related entity)", "otherNamedInsured"),
  field("Applicant Information", "Mailing Address", "mailingAddress"),
  field("Applicant Information", "Premises Address (if different)", "premisesAddress"),
  field("Applicant Information", "Website", "website"),
  field("Applicant Information", "Business Phone", "businessPhone"),
  field("Applicant Information", "Entity Type", "entityType"),
  field("Applicant Information", "FEIN — Named Insured 1", "feinNamedInsured1"),
  field("Applicant Information", "FEIN — Named Insured 2 (if applicable)", "feinNamedInsured2"),
  field("Applicant Information", "Date Business Started — Insured 1", "dateBusinessStartedInsured1"),
  field("Applicant Information", "Date Business Started — Insured 2", "dateBusinessStartedInsured2"),
  field("Applicant Information", "SIC Code", "sicCode"),
  field("Applicant Information", "NAICS Code", "naicsCode"),
  field("Applicant Information", "Description of Primary Operations", "descriptionOfOperations"),

  // ACORD 125 — Policy Information
  field("Policy Information", "Proposed Effective Date", "proposedEffectiveDate"),
  field("Policy Information", "Proposed Expiration Date", "proposedExpirationDate"),
  field("Policy Information", "Billing Plan (Agency / Direct)", "billingPlan"),
  field("Policy Information", "Payment Plan", "paymentPlan"),
  field("Policy Information", "Audit Basis", "auditBasis"),
  field("Policy Information", "Lines Requested", "linesRequested"),
  field("Policy Information", "Prior/Expiring Carrier", "priorCarrier"),
  field("Policy Information", "Expiring Policy #", "expiringPolicyNumber"),
  field("Policy Information", "Expiring Premium", "expiringPremium"),
  field("Policy Information", "Reason for Leaving", "reasonForLeaving"),

  // ACORD 125 — Nature of Business / Financials
  field("Nature of Business / Financials", "Total Annual Revenue", "totalAnnualRevenue"),
  field("Nature of Business / Financials", "Total Annual Payroll", "totalAnnualPayroll"),
  field("Nature of Business / Financials", "Full-Time Employees", "fullTimeEmployees"),
  field("Nature of Business / Financials", "Part-Time Employees", "partTimeEmployees"),
  field("Nature of Business / Financials", "Subcontractors Used? Y/N — Annual Cost", "subcontractorsUsed"),

  // ACORD 125 — General Information (Yes/No Questions)
  field("General Information", "Any subsidiaries or related entities?", "subsidiariesOrRelatedEntities"),
  field("General Information", "GL claims/losses last 3 years?", "glClaimsLast3Years"),
  field("General Information", "WC claims/losses last 3 years?", "wcClaimsLast3Years"),
  field("General Information", "Cyber breaches/claims?", "cyberBreachesClaims"),
  field("General Information", "Any uncorrected fire/safety code violations?", "fireSafetyCodeViolations"),
  field("General Information", "Bankruptcy history (last 5 yrs)?", "bankruptcyHistory"),
  field("General Information", "Foreign operations?", "foreignOperations"),
  field("General Information", "Safety program in place?", "safetyProgramInPlace"),

  // ACORD 125 — Attachments Checklist
  field("Attachments Checklist", "Loss runs attached?", "lossRunsAttached"),
  field("Attachments Checklist", "Financials attached?", "financialsAttached"),
  field("Attachments Checklist", "SOV attached? (see SOV schedule below)", "sovAttached"),

  // ACORD 126 — Classifications
  field("GL — Classifications", "Classification 1", "glClassification1"),
  field("GL — Classifications", "Classification 2", "glClassification2"),
  field("GL — Classifications", "Exact ISO classification codes", "isoClassificationCodes"),

  // ACORD 126 — Limits
  field("GL — Limits", "General Aggregate / Each Occurrence", "glGeneralAggregateEachOccurrence"),
  field("GL — Limits", "Damage to Premises Rented", "damageToPremisesRented"),
  field("GL — Limits", "Medical Payments", "glMedicalPayments"),
  field("GL — Limits", "Personal & Advertising Injury", "personalAdvertisingInjury"),
  field("GL — Limits", "Products-Completed Operations Aggregate", "productsCompletedOperationsAggregate"),
  field("GL — Limits", "Deductible / SIR", "glDeductibleSir"),
  field("GL — Limits", "Coverage Trigger", "glCoverageTrigger"),
  field("GL — Limits", "Occurrence vs. Claims-Made", "occurrenceVsClaimsMade"),
  field("GL — Limits", "Retroactive Date (if claims-made)", "retroactiveDate"),

  // ACORD 126 — Additional Coverages
  field("GL — Additional Coverages", "Stop Gap (monopolistic states)", "stopGapCoverage"),
  field("GL — Additional Coverages", "Employee Benefits Liability", "employeeBenefitsLiability"),
  field("GL — Additional Coverages", "Liquor Liability Limit", "liquorLiabilityLimit"),
  field("GL — Additional Coverages", "Hired & Non-Owned Auto", "hiredNonOwnedAuto"),

  // ACORD 126 — Exposures
  field("GL — Exposures", "Subcontracted Work", "subcontractedWork"),
  field("GL — Exposures", "Vendor COI on file?", "vendorCoiOnFile"),
  field("GL — Exposures", "Additional Insureds / Certificate Holders", "additionalInsuredsCertHolders"),
  field("GL — Exposures", "Waiver of Subrogation Requested?", "glWaiverOfSubrogation"),

  // ACORD 126 — GL Underwriting Questions
  field("GL — Underwriting Questions", "Prior GL cancellations/non-renewals?", "priorGlCancellations"),
  field("GL — Underwriting Questions", "Products recall exposure?", "productsRecallExposure"),
  field("GL — Underwriting Questions", "Professional services offered?", "professionalServicesOffered"),
  field("GL — Underwriting Questions", "Watercraft / pools on premises?", "watercraftPoolsOnPremises"),

  // ACORD 803 — Liquor Liability Detail
  field("Liquor Liability Detail", "Permit Structure", "liquorPermitStructure"),
  field(
    "Liquor Liability Detail",
    "Hours of service / ID-check / safe-ride / prior claims / % revenue from alcohol",
    "liquorServiceDetails"
  ),

  // ACORD 140 — Location
  field("Property — Location", "Address", "propertyAddress"),
  field("Property — Location", "Building # (if multiple on one location)", "buildingNumber"),
  field("Property — Location", "Building Description", "buildingDescription"),
  field("Property — Location", "Occupancy", "occupancy"),
  field("Property — Location", "Number of Stories", "numberOfStories"),
  field("Property — Location", "Total Area", "totalArea"),
  field("Property — Location", "Year Built", "yearBuilt"),
  field("Property — Location", "Year Renovated", "yearRenovated"),
  field("Property — Location", "Construction Type", "constructionType"),
  field("Property — Location", "Roof Type & Age", "roofTypeAge"),

  // ACORD 140 — Protective Devices
  field("Property — Protective Devices", "Sprinklered", "sprinklered"),
  field("Property — Protective Devices", "Fire Alarm", "fireAlarm"),
  field("Property — Protective Devices", "Protection Class", "protectionClass"),
  field("Property — Protective Devices", "Distance to Fire Hydrant/Station", "distanceToFireHydrantStation"),

  // ACORD 140 — Coverage Values
  field("Property — Coverage Values", "Building Value", "buildingValue"),
  field("Property — Coverage Values", "Business Personal Property (BPP)", "bppValue"),
  field("Property — Coverage Values", "Business Income / Extra Expense", "businessIncomeExtraExpense"),
  field("Property — Coverage Values", "Land Value (reference only)", "landValue"),

  // ACORD 140 — Coverage Terms
  field("Property — Coverage Terms", "Deductible — AOP / Wind-Hail", "deductibleAopWindHail"),
  field("Property — Coverage Terms", "Named Storm Deductible (if separate)", "namedStormDeductible"),
  field("Property — Coverage Terms", "Flood Deductible", "floodDeductible"),
  field("Property — Coverage Terms", "Coinsurance %", "coinsurancePercent"),
  field("Property — Coverage Terms", "Valuation Method (RC / ACV)", "valuationMethod"),
  field("Property — Coverage Terms", "Causes of Loss Form", "causesOfLossForm"),
  field("Property — Coverage Terms", "Ordinance or Law Coverage %", "ordinanceOrLawCoveragePercent"),
  field("Property — Coverage Terms", "Equipment Breakdown Coverage?", "equipmentBreakdownCoverage"),
  field("Property — Coverage Terms", "Spoilage Coverage?", "spoilageCoverage"),
  field("Property — Coverage Terms", "Outdoor Property / Signage", "outdoorPropertySignage"),

  // ACORD 140 — Wind Mitigation (FL-specific)
  field("Property — Wind Mitigation", "Roof Covering Type", "windMitRoofCoveringType"),
  field("Property — Wind Mitigation", "Roof Deck Attachment", "windMitRoofDeckAttachment"),
  field("Property — Wind Mitigation", "Roof-to-Wall Connection", "windMitRoofToWallConnection"),
  field("Property — Wind Mitigation", "Secondary Water Resistance", "windMitSecondaryWaterResistance"),
  field("Property — Wind Mitigation", "Opening Protection (impact glass/shutters)", "windMitOpeningProtection"),

  // ACORD 140 — Flood
  field("Property — Flood", "Flood Zone", "floodZone"),
  field("Property — Flood", "Flood Insurance", "floodInsurance"),
  field("Property — Flood", "Elevation Certificate on File?", "elevationCertificateOnFile"),

  // ACORD 140 — Other
  field("Property — Other", "4-Point Inspection on File", "fourPointInspectionOnFile"),
  field("Property — Other", "Prior Losses at This Location", "priorLossesAtLocation"),
  field("Property — Other", "Vacancy Status", "vacancyStatus"),
  field("Property — Other", "Plumbing / Electrical / HVAC Updates", "plumbingElectricalHvacUpdates"),

  // ACORD 130 — Workers' Compensation
  field("Workers' Compensation", "State(s) of Operation", "wcStatesOfOperation"),
  field("Workers' Compensation", "Class Code 1 — Description / Payroll", "wcClassCode1"),
  field("Workers' Compensation", "Class Code 2 — Description / Payroll", "wcClassCode2"),
  field("Workers' Compensation", "Class Code 3 — Description / Payroll", "wcClassCode3"),
  field("Workers' Compensation", "Experience Modification Factor", "experienceModificationFactor"),
  field("Workers' Compensation", "Employers Liability Limits (std 100/500/100 unless noted)", "employersLiabilityLimits"),
  field("Workers' Compensation", "Waiver of Subrogation Requested? (Blanket or Specific)", "wcWaiverOfSubrogation"),
  field("Workers' Compensation", "Officers Included / Excluded / Elected", "officersIncludedExcludedElected"),
  field("Workers' Compensation", "Officer Names & % Ownership", "officerNamesOwnership"),
  field("Workers' Compensation", "Prior WC Carrier", "priorWcCarrier"),
  field("Workers' Compensation", "Prior WC Policy #", "priorWcPolicyNumber"),
  field("Workers' Compensation", "WC Loss History (3-5 yr)", "wcLossHistory"),
  field("Workers' Compensation", "Safety Program in Place? (describe)", "wcSafetyProgramDescribe"),
  field("Workers' Compensation", "USL&H / Maritime Exposure?", "uslhMaritimeExposure"),

  // ACORD 823/825 — Cyber Liability
  field("Cyber Liability", "Revenue for Cyber Rating", "cyberRevenue"),
  field("Cyber Liability", "# of Records Held (PII / PCI / PHI)", "recordsHeldCount"),
  field("Cyber Liability", "Industry Type / NAICS for Cyber", "cyberIndustryType"),
  field("Cyber Liability", "Prior Cyber Incidents / Breaches?", "priorCyberIncidents"),
  field("Cyber Liability", "Multi-Factor Authentication (MFA) Enabled?", "mfaEnabled"),
  field("Cyber Liability", "Data Encryption (at rest / in transit)?", "dataEncryption"),
  field("Cyber Liability", "Backup Frequency", "backupFrequency"),
  field("Cyber Liability", "EDR / Antivirus in Place?", "edrAntivirusInPlace"),
  field("Cyber Liability", "Employee Security Training?", "employeeSecurityTraining"),
  field("Cyber Liability", "Incident Response Plan in Place?", "incidentResponsePlan"),
  field("Cyber Liability", "Third-Party Vendors Handling Data", "thirdPartyVendorsHandlingData"),
  field("Cyber Liability", "Aggregate Limit", "cyberAggregateLimit"),
  field("Cyber Liability", "Ransomware Sublimit", "ransomwareSublimit"),
  field("Cyber Liability", "Business Interruption Sublimit", "cyberBusinessInterruptionSublimit"),
  field("Cyber Liability", "Notification Costs Sublimit", "notificationCostsSublimit"),
  field("Cyber Liability", "PCI Fines Sublimit", "pciFinesSublimit"),
  field("Cyber Liability", "Retention / Deductible", "cyberRetentionDeductible"),
];

// Statement of Values — one row per building/location. No fixed row count:
// the extraction function reads however many locations are in the source
// document, so the Review screen just renders whatever comes back.
export const LOCATION_FIELDS: FieldDef[] = [
  { section: "SOV", key: "locationNumber", label: "Loc #", type: "string" },
  { section: "SOV", key: "address", label: "Address", type: "string" },
  { section: "SOV", key: "occupancy", label: "Occupancy", type: "string" },
  { section: "SOV", key: "constructionType", label: "Construction", type: "string" },
  { section: "SOV", key: "yearBuilt", label: "Year Built", type: "number" },
  { section: "SOV", key: "numberOfStories", label: "# Stories", type: "number" },
  { section: "SOV", key: "squareFootage", label: "Total Sq Ft", type: "number" },
  { section: "SOV", key: "protectionClass", label: "Protection Class", type: "number" },
  { section: "SOV", key: "sprinklered", label: "Sprinklered?", type: "string" },
  { section: "SOV", key: "buildingValue", label: "Building Value", type: "number" },
  { section: "SOV", key: "bppValue", label: "BPP Value", type: "number" },
  { section: "SOV", key: "businessIncomeValue", label: "BI/EE Value", type: "number" },
  { section: "SOV", key: "tiv", label: "TIV", type: "number" },
  { section: "SOV", key: "distanceToCoast", label: "Distance to Coast", type: "string" },
  { section: "SOV", key: "roofTypeAge", label: "Roof Type/Age", type: "string" },
  { section: "SOV", key: "floodZone", label: "Flood Zone", type: "string" },
];

export type FieldValue = string | number | boolean | null;
export type ProfileData = Record<string, FieldValue>;
export type LocationRow = Record<string, FieldValue>;

export function emptyLocationRow(): LocationRow {
  return Object.fromEntries(LOCATION_FIELDS.map((f) => [f.key, null]));
}
