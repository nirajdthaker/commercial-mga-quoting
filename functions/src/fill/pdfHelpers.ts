import type * as mupdf from "mupdf";
import { logger } from "firebase-functions";
import { FieldValue } from "../schema";

/**
 * mupdf is ESM-only, but this project compiles to CommonJS. TypeScript
 * lowers a plain `import("mupdf")` to `require("mupdf")` under the
 * "commonjs" module target, which fails at runtime for an ESM-only
 * package. Going through `new Function` forces Node's real dynamic
 * `import()` instead, bypassing that lowering. The loaded module is
 * cached since it only needs to be resolved once per process.
 */
let mupdfModulePromise: Promise<typeof import("mupdf")> | undefined;
export function loadMupdf(): Promise<typeof import("mupdf")> {
  if (!mupdfModulePromise) {
    const dynamicImport = new Function("specifier", "return import(specifier)") as (
      specifier: string
    ) => Promise<typeof import("mupdf")>;
    mupdfModulePromise = dynamicImport("mupdf");
  }
  return mupdfModulePromise;
}

function findWidget(doc: mupdf.PDFDocument, formName: string, fieldName: string): mupdf.PDFWidget | undefined {
  for (let p = 0; p < doc.countPages(); p++) {
    const widget = doc.loadPage(p).getWidgets().find((w: mupdf.PDFWidget) => w.getName() === fieldName);
    if (widget) return widget;
  }
  logger.warn(`${formName}: expected form field "${fieldName}" not found, skipping`);
  return undefined;
}

/** Sets a text field. No-ops on null/undefined so unmapped data leaves the field blank rather than writing "null". */
export function setText(doc: mupdf.PDFDocument, formName: string, fieldName: string, value: FieldValue): void {
  if (value === null || value === undefined || value === "") return;
  findWidget(doc, formName, fieldName)?.setTextValue(String(value));
}

/**
 * Sets a checkbox to a specific state (not a blind toggle - safe to call
 * regardless of current state). On these official ACORD forms an unchecked
 * box reads back as "" rather than the more typical "Off" until it has been
 * toggled at least once, so both are treated as the unchecked state.
 */
export function setCheckbox(doc: mupdf.PDFDocument, formName: string, fieldName: string, checked: boolean): void {
  const widget = findWidget(doc, formName, fieldName);
  if (!widget) return;
  const value = widget.getValue();
  const isChecked = value !== "" && value !== "Off";
  if (isChecked !== checked) widget.toggle();
}

const YES_WORDS = ["y", "yes", "true"];
const NO_WORDS = ["n", "no", "false"];

/** True if a Yes/No-ish value's first word clearly says "yes" - false for anything else, including null/unclear. */
export function isYes(value: FieldValue): boolean {
  if (value === null || value === undefined) return false;
  return YES_WORDS.includes(String(value).trim().toLowerCase().split(/[\s—-]/)[0]);
}

/**
 * Parses a Yes/No-ish string (possibly with extra explanatory text, e.g.
 * "Yes — Fake Kitchen Ventures LLC...") and checks the matching box. Leaves
 * both unchecked if the value doesn't clearly start with yes/no, rather
 * than guessing.
 */
export function setYesNo(
  doc: mupdf.PDFDocument,
  formName: string,
  yesField: string,
  noField: string,
  value: FieldValue
): void {
  if (value === null || value === undefined) return;
  const firstWord = String(value).trim().toLowerCase().split(/[\s—-]/)[0];
  if (YES_WORDS.includes(firstWord)) setCheckbox(doc, formName, yesField, true);
  else if (NO_WORDS.includes(firstWord)) setCheckbox(doc, formName, noField, true);
}

/**
 * Sets a text field with a plain "Y"/"N" value, used for the official
 * ACORD forms' Y/N questions - answered as text ("Enter Y for a Yes
 * response...") rather than a checkbox pair. When the reviewed data doesn't
 * clearly answer the question (missing, or text that doesn't start with
 * yes/no), falls back to defaultAnswer if one is given - callers should
 * only pass one where the question is the disclosure kind where silence
 * conventionally means "no" (violations, incidents, exposures that would
 * always be flagged if true), never for a genuinely unknowable default.
 */
export function setYesNoText(
  doc: mupdf.PDFDocument,
  formName: string,
  fieldName: string,
  value: FieldValue,
  defaultAnswer?: "Y" | "N"
): void {
  const firstWord = value === null || value === undefined ? "" : String(value).trim().toLowerCase().split(/[\s—-]/)[0];
  if (YES_WORDS.includes(firstWord)) setText(doc, formName, fieldName, "Y");
  else if (NO_WORDS.includes(firstWord)) setText(doc, formName, fieldName, "N");
  else if (defaultAnswer) setText(doc, formName, fieldName, defaultAnswer);
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
