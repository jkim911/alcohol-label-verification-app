/**
 * Matching engine: one pure function per label field, each with its own
 * tolerance policy (docs/build-plan.md §03). No framework, no I/O, no
 * network — this is where correctness is graded, so keep it trivially
 * unit-testable.
 *
 * Every matcher returns a FieldResult with a three-state status and a
 * plain-English reason (never a raw diff).
 */
import type { Application, FieldResult, LabelExtraction, LabelField } from "@/lib/types";
import { normalizeStreet, parseAddress } from "./address";
import { listWords, normalize, quote, similarity, tokenSetSimilarity, tokens, wordDiff } from "./text";
import { parseAbv, parseVolume, sameVolume } from "./units";
import { STATUTORY_WARNING, WARNING_HEADING, normalizeWarningWhitespace, warningHeadingAsPrinted } from "./warning";

export type Matcher = (application: Application, extraction: LabelExtraction) => FieldResult;

/** Tolerances, in one place so the README and the code can't disagree. */
export const RULES = {
  brandPass: 0.9,
  brandReview: 0.7,
  classReview: 0.5,
  abvTolerance: 0.3,
  volumeTolerance: 0.01,
  bottlerNamePass: 0.85,
  bottlerNameReview: 0.7,
} as const;

// ---------------------------------------------------------------------------
// Brand name — fuzzy
// ---------------------------------------------------------------------------
export const matchBrandName: Matcher = (app, label) => {
  const field: LabelField = "brandName";
  const expected = app.brandName;
  const actual = label.brandName;
  if (!actual) {
    return { field, status: "fail", expected, actual, reason: "No brand name could be found on the label." };
  }
  const a = normalize(expected);
  const b = normalize(actual);
  if (a === b) {
    const reason =
      expected === actual
        ? "Brand name matches exactly."
        : `Label says ${quote(actual)}; application says ${quote(expected)} — same name, different casing or spacing.`;
    return { field, status: "pass", expected, actual, reason };
  }
  const score = similarity(a, b);
  const { missing, extra } = wordDiff(expected, actual);
  if (score >= RULES.brandPass && !missing.length && !extra.length) {
    return {
      field,
      status: "pass",
      expected,
      actual,
      reason: `Label says ${quote(actual)}; application says ${quote(expected)} — minor punctuation difference only.`,
    };
  }
  if (score >= RULES.brandReview || (!missing.length && extra.length) || (!extra.length && missing.length)) {
    const detail = missing.length
      ? `the label is missing ${listWords(missing)}`
      : extra.length
        ? `the label adds ${listWords(extra)}`
        : "the spelling differs";
    return {
      field,
      status: "review",
      expected,
      actual,
      reason: `Label says ${quote(actual)}; application says ${quote(expected)} — close, but ${detail}. Please confirm.`,
    };
  }
  return {
    field,
    status: "fail",
    expected,
    actual,
    reason: `Label says ${quote(actual)}; application says ${quote(expected)} — these look like different brand names.`,
  };
};

// ---------------------------------------------------------------------------
// Class / type — fuzzy on the set of words
// ---------------------------------------------------------------------------
export const matchClassType: Matcher = (app, label) => {
  const field: LabelField = "classType";
  const expected = app.classType;
  const actual = label.classType;
  if (!actual) {
    return { field, status: "fail", expected, actual, reason: "No class or type designation could be found on the label." };
  }
  const ta = tokens(expected);
  const tb = tokens(actual);
  if (ta.join(" ") === tb.join(" ")) {
    return { field, status: "pass", expected, actual, reason: "Class/type matches." };
  }
  const { missing, extra } = wordDiff(expected, actual);
  if (!missing.length && !extra.length) {
    return {
      field,
      status: "review",
      expected,
      actual,
      reason: `Label says ${quote(actual)}; application says ${quote(expected)} — same words in a different order. Please confirm the designation.`,
    };
  }
  if (tokenSetSimilarity(expected, actual) >= RULES.classReview) {
    const parts = [
      missing.length ? `the label drops ${listWords(missing)}` : "",
      extra.length ? `the label adds ${listWords(extra)}` : "",
    ].filter(Boolean);
    return {
      field,
      status: "review",
      expected,
      actual,
      reason: `Label says ${quote(actual)}; application says ${quote(expected)} — ${parts.join(" and ")}. A missing qualifier can change the legal class.`,
    };
  }
  return {
    field,
    status: "fail",
    expected,
    actual,
    reason: `Label says ${quote(actual)}; application says ${quote(expected)} — different class/type.`,
  };
};

// ---------------------------------------------------------------------------
// Alcohol content — numeric ± tolerance
// ---------------------------------------------------------------------------
export const matchAlcoholContent: Matcher = (app, label) => {
  const field: LabelField = "alcoholContent";
  const expectedNum = parseAbv(app.alcoholContent);
  const actualNum = parseAbv(label.alcoholContent);
  const expected = expectedNum == null ? null : `${expectedNum}% ABV`;
  const actual = actualNum == null ? null : `${actualNum}% ABV`;

  if (expectedNum == null) {
    return {
      field,
      status: "pass",
      expected,
      actual,
      notApplicable: true,
      reason: "The application doesn't state an alcohol content, so there is nothing to compare.",
    };
  }
  if (actualNum == null) {
    if (app.productType === "beer") {
      return {
        field,
        status: "pass",
        expected,
        actual,
        notApplicable: true,
        reason: "No alcohol content on the label. Federal rules don't require one for malt beverages, so this isn't a mismatch.",
      };
    }
    return {
      field,
      status: "review",
      expected,
      actual,
      reason: `No alcohol content could be found on the label, but the application states ${expected}. ${
        app.productType === "wine" ? "Wine may use a designation like 'table wine' instead — check the label." : "Spirits must state alcohol content."
      }`,
    };
  }
  const diff = Math.abs(expectedNum - actualNum);
  if (diff <= RULES.abvTolerance + 1e-9) {
    return {
      field,
      status: "pass",
      expected,
      actual,
      reason:
        diff === 0
          ? "Alcohol content matches."
          : `Label shows ${actual}; application says ${expected} — within TTB's ±${RULES.abvTolerance}% labeling tolerance.`,
    };
  }
  return {
    field,
    status: "fail",
    expected,
    actual,
    reason: `Label shows ${actual}; application says ${expected} — a ${diff.toFixed(1)}-point difference, outside the ±${RULES.abvTolerance}% tolerance.`,
  };
};

// ---------------------------------------------------------------------------
// Net contents — numeric, unit-normalized
// ---------------------------------------------------------------------------
export const matchNetContents: Matcher = (app, label) => {
  const field: LabelField = "netContents";
  const expected = app.netContents;
  const actual = label.netContents;
  if (!actual) {
    return { field, status: "fail", expected, actual, reason: "No net contents statement could be found on the label." };
  }
  const a = parseVolume(expected);
  const b = parseVolume(actual);
  if (!a || !b) {
    const which = !a && !b ? "either value" : !a ? "the application's value" : "the label's value";
    return {
      field,
      status: "review",
      expected,
      actual,
      reason: `Couldn't read a volume from ${which} (label: ${quote(actual)}, application: ${quote(expected)}). Please compare by eye.`,
    };
  }
  if (sameVolume(a, b, RULES.volumeTolerance)) {
    return {
      field,
      status: "pass",
      expected,
      actual,
      reason:
        normalize(expected) === normalize(actual)
          ? "Net contents match."
          : `Label says ${quote(actual)}; application says ${quote(expected)} — the same volume in different units.`,
    };
  }
  return {
    field,
    status: "fail",
    expected,
    actual,
    reason: `Label says ${quote(actual)} (${Math.round(b.millilitres)} mL); application says ${quote(expected)} (${Math.round(a.millilitres)} mL) — different volumes.`,
  };
};

// ---------------------------------------------------------------------------
// Bottler name / address — fuzzy name, exact city/state/ZIP
// ---------------------------------------------------------------------------
export const matchBottlerNameAddress: Matcher = (app, label) => {
  const field: LabelField = "bottlerNameAddress";
  const expected = app.bottlerNameAddress;
  const actual = label.bottlerNameAddress;
  if (!actual) {
    return { field, status: "fail", expected, actual, reason: "No bottler or producer name and address could be found on the label." };
  }
  const a = parseAddress(expected);
  const b = parseAddress(actual);

  if (a && b) {
    const nameScore = similarity(normalize(a.name), normalize(b.name));
    const placeMatches =
      normalize(a.city) === normalize(b.city) && a.state === b.state && a.zip === b.zip;
    if (!placeMatches) {
      return {
        field,
        status: "fail",
        expected,
        actual,
        reason: `The label's location (${b.city}, ${b.state} ${b.zip}) doesn't match the application (${a.city}, ${a.state} ${a.zip}).`,
      };
    }
    if (nameScore < RULES.bottlerNameReview) {
      return {
        field,
        status: "fail",
        expected,
        actual,
        reason: `The label names ${quote(b.name)}; the application names ${quote(a.name)} — these look like different companies.`,
      };
    }
    const streetSame = normalizeStreet(a.street) === normalizeStreet(b.street);
    if (nameScore >= RULES.bottlerNamePass && streetSame) {
      return {
        field,
        status: "pass",
        expected,
        actual,
        reason:
          normalize(expected) === normalize(actual)
            ? "Bottler name and address match."
            : "Bottler name and address match (differences are abbreviations or casing only).",
      };
    }
    const why = !streetSame
      ? `the street differs (${quote(b.street)} vs ${quote(a.street)}) beyond common abbreviations`
      : `the company name is close but not identical (${quote(b.name)} vs ${quote(a.name)})`;
    return {
      field,
      status: "review",
      expected,
      actual,
      reason: `City, state, and ZIP match, but ${why}. Please confirm.`,
    };
  }

  // Couldn't segment one side — compare the whole line.
  const score = similarity(normalize(expected), normalize(actual));
  if (score >= RULES.bottlerNamePass) {
    return { field, status: "pass", expected, actual, reason: "Bottler name and address match (minor formatting differences only)." };
  }
  if (score >= RULES.bottlerNameReview) {
    return {
      field,
      status: "review",
      expected,
      actual,
      reason: `The bottler line is similar but not identical (label: ${quote(actual)}; application: ${quote(expected)}). Couldn't break it into city/state/ZIP — please compare by eye.`,
    };
  }
  return {
    field,
    status: "fail",
    expected,
    actual,
    reason: `The bottler line on the label (${quote(actual)}) doesn't match the application (${quote(expected)}).`,
  };
};

// ---------------------------------------------------------------------------
// Country of origin — exact, imports only
// ---------------------------------------------------------------------------
/** "Product of Italy", "Made in ITALY", "Produce of Italy" → "italy". */
export function normalizeCountry(value: string): string {
  return normalize(value)
    .replace(/^(product|produce|made|bottled|imported)\s+(of|in|from)\s+/, "")
    .replace(/^(the\s+)/, "")
    .replace(/[.]+$/, "");
}
export const matchCountryOfOrigin: Matcher = (app, label) => {
  const field: LabelField = "countryOfOrigin";
  const expected = app.countryOfOrigin;
  const actual = label.countryOfOrigin;
  if (!app.isImport) {
    return {
      field,
      status: "pass",
      expected,
      actual,
      notApplicable: true,
      reason: "Not an import, so a country of origin isn't required.",
    };
  }
  if (!expected) {
    return {
      field,
      status: "review",
      expected,
      actual,
      reason: "The application marks this as an import but doesn't state a country of origin. Check the application.",
    };
  }
  if (!actual) {
    return {
      field,
      status: "fail",
      expected,
      actual,
      reason: `Imports must state a country of origin (e.g. 'Product of ${expected}'), and none was found on the label.`,
    };
  }
  if (normalizeCountry(actual) === normalizeCountry(expected)) {
    return { field, status: "pass", expected, actual, reason: "Country of origin matches." };
  }
  return {
    field,
    status: "fail",
    expected,
    actual,
    reason: `Label says ${quote(actual)}; application says ${quote(expected)} — country of origin must match exactly.`,
  };
};

// ---------------------------------------------------------------------------
// Government warning — strict exact against the statute
// ---------------------------------------------------------------------------
export const matchGovernmentWarning: Matcher = (_app, label) => {
  const field: LabelField = "governmentWarning";
  const expected = STATUTORY_WARNING;
  const actual = label.governmentWarning;
  if (!actual) {
    return { field, status: "fail", expected, actual, reason: "No government warning could be found on the label. It is required on every container." };
  }
  const printed = normalizeWarningWhitespace(actual);
  const heading = warningHeadingAsPrinted(printed);
  if (heading !== WARNING_HEADING) {
    return {
      field,
      status: "fail",
      expected,
      actual,
      reason: heading
        ? `The heading is printed as ${quote(heading)}; it must read exactly ${quote(WARNING_HEADING)} in capital letters.`
        : `The warning doesn't start with ${quote(WARNING_HEADING)}.`,
    };
  }
  if (printed === expected) {
    return {
      field,
      status: "pass",
      expected,
      actual,
      reason: "Warning text matches the statutory wording. Bold weight of the heading can't be checked from text — confirm it visually.",
    };
  }
  const { missing, extra } = wordDiff(expected, printed);
  const detail = [
    missing.length ? `missing ${listWords(missing.slice(0, 4))}` : "",
    extra.length ? `added ${listWords(extra.slice(0, 4))}` : "",
  ]
    .filter(Boolean)
    .join("; ");
  return {
    field,
    status: "fail",
    expected,
    actual,
    reason: `The warning wording differs from the statute${detail ? ` (${detail})` : " (punctuation or casing)"}. It must appear word for word.`,
  };
};

export const MATCHERS: Record<LabelField, Matcher> = {
  brandName: matchBrandName,
  classType: matchClassType,
  alcoholContent: matchAlcoholContent,
  netContents: matchNetContents,
  bottlerNameAddress: matchBottlerNameAddress,
  countryOfOrigin: matchCountryOfOrigin,
  governmentWarning: matchGovernmentWarning,
};
