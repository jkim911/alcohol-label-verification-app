/**
 * Named edge cases from docs/build-plan.md §03. Each is a `todo` until its
 * matcher lands on Day 3 — turn them into real assertions as you implement.
 */
import { describe, it } from "vitest";

describe("matchBrandName (fuzzy)", () => {
  it.todo('"STONE\'S THROW" vs "Stone\'s Throw" → pass (casing only)');
  it.todo("extra whitespace and trailing spaces → pass");
  it.todo("one word missing (\"Stone's Throw Reserve\" vs \"Stone's Throw\") → review");
  it.todo("entirely different brand → fail");
});

describe("matchClassType (fuzzy, token-set)", () => {
  it.todo('"Kentucky Straight Bourbon Whiskey" reordered → review');
  it.todo('"Straight" dropped from "Straight Bourbon Whiskey" → review');
  it.todo("identical after normalization → pass");
});

describe("matchAlcoholContent (numeric ± 0.3)", () => {
  it.todo("40.0 vs 40.2 → pass (within tolerance)");
  it.todo("40.0 vs 41.0 → fail (outside tolerance)");
  it.todo("absent on label for spirits → review");
  it.todo("absent on label for an exempt product type → pass / N/A");
});

describe("matchNetContents (unit-normalized)", () => {
  it.todo('"750 mL" vs "750ml" → pass');
  it.todo('"750 mL" vs "0.75 L" → pass (unit conversion)');
  it.todo('"12 fl oz" vs "355 mL" → pass (within rounding)');
  it.todo("unit present but unparseable → review");
});

describe("matchBottlerNameAddress (fuzzy, segment-aware)", () => {
  it.todo('"123 Main St" vs "123 Main Street" → pass (common abbreviation)');
  it.todo("different city or ZIP → fail");
  it.todo("street differs beyond abbreviation set → review");
});

describe("matchCountryOfOrigin (exact, conditional)", () => {
  it.todo("domestic product with no country on label → N/A");
  it.todo("import with missing country on label → fail");
  it.todo("import with exact match → pass");
});

describe("matchGovernmentWarning (strict exact)", () => {
  it.todo("statutory text with different line breaks → pass");
  it.todo("title-case \"Government Warning:\" → fail (must be ALL CAPS)");
  it.todo("one word reworded → fail");
  it.todo("warning absent → fail");
});
