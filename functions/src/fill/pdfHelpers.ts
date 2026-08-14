import { PDFForm } from "pdf-lib";
import { logger } from "firebase-functions";
import { FieldValue } from "../schema";

function warnMissing(formName: string, fieldName: string): void {
  logger.warn(`${formName}: expected form field "${fieldName}" not found, skipping`);
}

/** Sets a text field. No-ops on null/undefined so unmapped data leaves the field blank rather than writing "null". */
export function setText(form: PDFForm, formName: string, fieldName: string, value: FieldValue): void {
  if (value === null || value === undefined || value === "") return;
  try {
    form.getTextField(fieldName).setText(String(value));
  } catch {
    warnMissing(formName, fieldName);
  }
}

export function setCheckbox(form: PDFForm, formName: string, fieldName: string, checked: boolean): void {
  try {
    const box = form.getCheckBox(fieldName);
    if (checked) box.check();
  } catch {
    warnMissing(formName, fieldName);
  }
}

const YES_WORDS = ["y", "yes", "true"];
const NO_WORDS = ["n", "no", "false"];

/**
 * Parses a Yes/No-ish string (possibly with extra explanatory text, e.g.
 * "Yes — Fake Kitchen Ventures LLC...") and checks the matching box. Leaves
 * both unchecked if the value doesn't clearly start with yes/no, rather
 * than guessing.
 */
export function setYesNo(
  form: PDFForm,
  formName: string,
  yesField: string,
  noField: string,
  value: FieldValue
): void {
  if (value === null || value === undefined) return;
  const firstWord = String(value).trim().toLowerCase().split(/[\s—-]/)[0];
  if (YES_WORDS.includes(firstWord)) setCheckbox(form, formName, yesField, true);
  else if (NO_WORDS.includes(firstWord)) setCheckbox(form, formName, noField, true);
}

/** Splits a "A / B" or "A — B" compound value into two parts. Falls back to putting the whole value in `first` if the delimiter isn't present. */
export function splitPair(value: FieldValue, delimiter: RegExp): [string | null, string | null] {
  if (value === null || value === undefined || value === "") return [null, null];
  const parts = String(value).split(delimiter);
  if (parts.length < 2) return [String(value).trim(), null];
  return [parts[0].trim(), parts.slice(1).join(delimiter.source.includes("/") ? "/" : "—").trim()];
}

/** Extracts a trailing 4-digit year (e.g. "Flat/built-up, replaced 2018" -> "2018") and the remaining text with it removed. */
export function extractTrailingYear(value: FieldValue): { text: string | null; year: string | null } {
  if (value === null || value === undefined || value === "") return { text: null, year: null };
  const str = String(value);
  const match = str.match(/(19|20)\d{2}/);
  if (!match) return { text: str.trim(), year: null };
  const year = match[0];
  const text = (str.slice(0, match.index) + str.slice((match.index ?? 0) + year.length))
    .replace(/[,.\s]+$/, "")
    .replace(/^[,.\s]+/, "")
    .trim();
  return { text: text || null, year };
}
