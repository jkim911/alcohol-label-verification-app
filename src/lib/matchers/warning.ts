/**
 * The health warning statement required by 27 CFR 16.21, verbatim.
 * The heading must be capitalized (and bold on the label); the text must
 * appear exactly as written here.
 */
export const STATUTORY_WARNING =
  "GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.";

export const WARNING_HEADING = "GOVERNMENT WARNING:";

/** Whitespace and line-break normalization only — never casing. */
export function normalizeWarningWhitespace(text: string): string {
  return text
    .replace(/[‘’ʼ]/g, "'")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.:;)])/g, "$1")
    .replace(/\(\s+/g, "(")
    .trim();
}

/** First word or two, up to and including the colon, exactly as printed. */
export function warningHeadingAsPrinted(text: string): string | null {
  const m = normalizeWarningWhitespace(text).match(/^(government\s+warning\s*:?)/i);
  return m ? m[1] : null;
}
