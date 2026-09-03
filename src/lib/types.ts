/**
 * Shared domain types for Alcohol Verification App.
 *
 * The seven fields come from the TTB reference section of the brief; the
 * three-state result and per-field tolerance policy come from the interviews
 * (see docs/build-plan.md §01 and §03).
 */

/** The seven label fields TTB agents verify. */
export const LABEL_FIELDS = [
  "brandName",
  "classType",
  "alcoholContent",
  "netContents",
  "bottlerNameAddress",
  "countryOfOrigin",
  "governmentWarning",
] as const;

export type LabelField = (typeof LABEL_FIELDS)[number];

/** Human-readable labels for the UI. Every icon gets a word next to it. */
export const LABEL_FIELD_NAMES: Record<LabelField, string> = {
  brandName: "Brand name",
  classType: "Class / type",
  alcoholContent: "Alcohol content",
  netContents: "Net contents",
  bottlerNameAddress: "Bottler name & address",
  countryOfOrigin: "Country of origin",
  governmentWarning: "Government warning",
};

export type ProductType = "beer" | "wine" | "spirits";

/**
 * What the applicant submitted. Stands in for COLA application data; the
 * prototype is standalone and never talks to COLA (Marcus Williams).
 */
export interface Application {
  /** Pairs a CSV row with a label image in batch mode. */
  id: string;
  productType: ProductType;
  brandName: string;
  classType: string;
  /** Alcohol by volume as a percentage, e.g. 40 for "40% ALC/VOL". */
  alcoholContent: number | null;
  /** Free text as submitted, e.g. "750 mL" or "12 fl oz". */
  netContents: string;
  bottlerNameAddress: string;
  /** True when the product is imported; country of origin is only checked then. */
  isImport: boolean;
  /** Required when isImport is true. */
  countryOfOrigin: string | null;
}

/**
 * What the vision model read off the physical label. Every field is
 * nullable: "not found" is its own state, never a guess.
 */
export interface LabelExtraction {
  brandName: string | null;
  classType: string | null;
  /** Percentage as printed, parsed to a number when possible. */
  alcoholContent: number | null;
  netContents: string | null;
  bottlerNameAddress: string | null;
  countryOfOrigin: string | null;
  /** Verbatim warning text as printed, including original casing. */
  governmentWarning: string | null;
  /** Model's own read-quality signal, 0–1. Low values surface as "review". */
  confidence: number;
  /** Set when the image was too poor to read; carries a plain-English reason. */
  unreadableReason?: string;
}

/** Three states, never two — Dave's whole complaint was a binary tool. */
export type FieldStatus = "pass" | "review" | "fail";

/** Outcome for one field, always with a one-line plain-English reason. */
export interface FieldResult {
  field: LabelField;
  status: FieldStatus;
  /** Value from the application, as displayed. */
  expected: string | null;
  /** Value read from the label, as displayed. */
  actual: string | null;
  /** Never a raw diff. e.g. "Label says 'Stone's Throw'; application says 'STONE'S THROW' — same name, different casing." */
  reason: string;
  /** True when the field does not apply (e.g. country of origin on a domestic product). */
  notApplicable?: boolean;
}

/** The overall call for one label. The tool recommends; the agent decides. */
export interface ReviewVerdict {
  applicationId: string;
  /** Worst status among all applicable fields. */
  overall: FieldStatus;
  fields: FieldResult[];
  extraction: LabelExtraction;
  /** Wall-clock milliseconds from upload to verdict. Budget is 5000. */
  durationMs: number;
}
