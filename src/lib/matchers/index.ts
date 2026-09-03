/**
 * Matching engine: one pure function per label field, each with its own
 * tolerance policy (docs/build-plan.md §03). No framework, no I/O, no
 * network — this is where correctness is graded, so keep it trivially
 * unit-testable.
 *
 * Every matcher returns a FieldResult with a three-state status and a
 * plain-English reason. Implemented on Day 3.
 */
import type { Application, FieldResult, LabelExtraction, LabelField } from "@/lib/types";

export type Matcher = (application: Application, extraction: LabelExtraction) => FieldResult;

function notImplemented(field: LabelField): Matcher {
  return () => {
    throw new Error(`Matcher for "${field}" is not implemented yet (Day 3).`);
  };
}

/** Fuzzy: normalized similarity ≥ 90% passes; 70–90% or extra/missing words → review. */
export const matchBrandName: Matcher = notImplemented("brandName");

/** Fuzzy: token-set similarity ≥ 90% after normalization; reordered/dropped qualifier → review. */
export const matchClassType: Matcher = notImplemented("classType");

/** Numeric: parsed % within ±0.3 ABV passes; absent where required and not exempt → review. */
export const matchAlcoholContent: Matcher = notImplemented("alcoholContent");

/** Numeric, unit-normalized: mL/L/fl oz converted to one unit, exact equivalence; unparseable unit → review. */
export const matchNetContents: Matcher = notImplemented("netContents");

/** Fuzzy, segment-aware: name ≥ 85%; city/state/ZIP exact; street may differ by common abbreviations only. */
export const matchBottlerNameAddress: Matcher = notImplemented("bottlerNameAddress");

/** Exact, conditional: only checked when the application flags an import; otherwise N/A. */
export const matchCountryOfOrigin: Matcher = notImplemented("countryOfOrigin");

/** Strict exact: whitespace/line-break normalized only; wording, punctuation, and ALL-CAPS "GOVERNMENT WARNING:" must match verbatim. */
export const matchGovernmentWarning: Matcher = notImplemented("governmentWarning");

export const MATCHERS: Record<LabelField, Matcher> = {
  brandName: matchBrandName,
  classType: matchClassType,
  alcoholContent: matchAlcoholContent,
  netContents: matchNetContents,
  bottlerNameAddress: matchBottlerNameAddress,
  countryOfOrigin: matchCountryOfOrigin,
  governmentWarning: matchGovernmentWarning,
};
