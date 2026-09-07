/**
 * Named edge cases from docs/build-plan.md §03, now real assertions.
 */
import { describe, expect, it } from "vitest";
import type { Application, LabelExtraction } from "@/lib/types";
import {
  matchAlcoholContent,
  matchBottlerNameAddress,
  matchBrandName,
  matchClassType,
  matchCountryOfOrigin,
  matchGovernmentWarning,
  matchNetContents,
  normalizeCountry,
} from "./index";
import { STATUTORY_WARNING } from "./warning";
import { parseVolume } from "./units";
import { parseAddress, normalizeStreet } from "./address";

const app = (over: Partial<Application> = {}): Application => ({
  id: "t",
  productType: "spirits",
  brandName: "STONE'S THROW",
  classType: "Kentucky Straight Bourbon Whiskey",
  alcoholContent: 45,
  netContents: "750 mL",
  bottlerNameAddress: "Stone's Throw Distilling Co., 412 River Road, Bardstown, KY 40004",
  isImport: false,
  countryOfOrigin: null,
  ...over,
});

const label = (over: Partial<LabelExtraction> = {}): LabelExtraction => ({
  brandName: "Stone's Throw",
  classType: "Kentucky Straight Bourbon Whiskey",
  alcoholContent: 45,
  netContents: "750 mL",
  bottlerNameAddress: "Stone's Throw Distilling Co., 412 River Road, Bardstown, KY 40004",
  countryOfOrigin: null,
  governmentWarning: STATUTORY_WARNING,
  confidence: 0.97,
  ...over,
});

describe("matchBrandName (fuzzy)", () => {
  it('"STONE\'S THROW" vs "Stone\'s Throw" → pass (casing only)', () => {
    const r = matchBrandName(app(), label());
    expect(r.status).toBe("pass");
    expect(r.reason).toMatch(/different casing/);
  });
  it("extra whitespace and trailing spaces → pass", () => {
    expect(matchBrandName(app(), label({ brandName: "  Stone's   Throw " })).status).toBe("pass");
  });
  it('one word missing ("Stone\'s Throw Reserve" vs "Stone\'s Throw") → review', () => {
    const r = matchBrandName(app({ brandName: "Stone's Throw Reserve" }), label());
    expect(r.status).toBe("review");
    expect(r.reason).toMatch(/missing 'reserve'/);
  });
  it("entirely different brand → fail", () => {
    expect(matchBrandName(app(), label({ brandName: "Copper Fox Gin" })).status).toBe("fail");
  });
  it("absent on label → fail", () => {
    expect(matchBrandName(app(), label({ brandName: null })).status).toBe("fail");
  });
});

describe("matchClassType (fuzzy, token-set)", () => {
  it('"Chardonnay White Wine" reordered as "White Wine, Chardonnay" → review', () => {
    const r = matchClassType(app({ classType: "Chardonnay White Wine" }), label({ classType: "White Wine, Chardonnay" }));
    expect(r.status).toBe("review");
    expect(r.reason).toMatch(/different order/);
  });
  it('"Straight" dropped from "Kentucky Straight Bourbon Whiskey" → review', () => {
    const r = matchClassType(app(), label({ classType: "Kentucky Bourbon Whiskey" }));
    expect(r.status).toBe("review");
    expect(r.reason).toMatch(/drops 'straight'/);
  });
  it("identical after normalization → pass", () => {
    expect(matchClassType(app(), label({ classType: "KENTUCKY STRAIGHT BOURBON WHISKEY" })).status).toBe("pass");
  });
  it("unrelated designation → fail", () => {
    expect(matchClassType(app(), label({ classType: "Distilled Gin" })).status).toBe("fail");
  });
});

describe("matchAlcoholContent (numeric ± 0.3)", () => {
  it("40.0 vs 40.2 → pass (within tolerance)", () => {
    const r = matchAlcoholContent(app({ alcoholContent: 40 }), label({ alcoholContent: 40.2 }));
    expect(r.status).toBe("pass");
    expect(r.reason).toMatch(/tolerance/);
  });
  it("40.0 vs 41.0 → fail (outside tolerance)", () => {
    const r = matchAlcoholContent(app({ alcoholContent: 40 }), label({ alcoholContent: 41 }));
    expect(r.status).toBe("fail");
    expect(r.reason).toMatch(/1\.0-point/);
  });
  it("absent on label for spirits → review", () => {
    expect(matchAlcoholContent(app(), label({ alcoholContent: null })).status).toBe("review");
  });
  it("absent on label for beer → not applicable", () => {
    const r = matchAlcoholContent(app({ productType: "beer", alcoholContent: 5 }), label({ alcoholContent: null }));
    expect(r.notApplicable).toBe(true);
    expect(r.status).toBe("pass");
  });
});

describe("matchNetContents (unit-normalized)", () => {
  it('"750 mL" vs "750ml" → pass', () => {
    expect(matchNetContents(app(), label({ netContents: "750ml" })).status).toBe("pass");
  });
  it('"750 mL" vs "0.75 L" → pass (unit conversion)', () => {
    const r = matchNetContents(app(), label({ netContents: "0.75 L" }));
    expect(r.status).toBe("pass");
    expect(r.reason).toMatch(/different units/);
  });
  it('"12 fl oz" vs "355 mL" → pass (within rounding)', () => {
    expect(matchNetContents(app({ netContents: "12 fl oz" }), label({ netContents: "355 mL" })).status).toBe("pass");
  });
  it('"750 mL" vs "1 L" → fail', () => {
    expect(matchNetContents(app(), label({ netContents: "1 L" })).status).toBe("fail");
  });
  it("unit present but unparseable → review", () => {
    expect(matchNetContents(app(), label({ netContents: "one bottle" })).status).toBe("review");
  });
  it("parseVolume handles the common label spellings", () => {
    expect(parseVolume("12 FL OZ")?.millilitres).toBeCloseTo(354.9, 0);
    expect(parseVolume("1.75L")?.millilitres).toBe(1750);
    expect(parseVolume("750 mL")?.millilitres).toBe(750);
    expect(parseVolume("750")).toBeNull();
  });
});

describe("matchBottlerNameAddress (fuzzy, segment-aware)", () => {
  it('"412 River Road" vs "412 River Rd" → pass (common abbreviation)', () => {
    const r = matchBottlerNameAddress(app(), label({ bottlerNameAddress: "Stone's Throw Distilling Co., 412 River Rd, Bardstown, KY 40004" }));
    expect(r.status).toBe("pass");
  });
  it("different city or ZIP → fail", () => {
    const r = matchBottlerNameAddress(
      app({ bottlerNameAddress: "Northbound Brewing Co., 900 Dock St, Seattle, WA 98134" }),
      label({ bottlerNameAddress: "Northbound Brewing Co., 900 Dock St, Tacoma, WA 98402" }),
    );
    expect(r.status).toBe("fail");
    expect(r.reason).toMatch(/Tacoma/);
  });
  it("street differs beyond abbreviation set → review", () => {
    const r = matchBottlerNameAddress(app(), label({ bottlerNameAddress: "Stone's Throw Distilling Co., 88 Summit Ave, Bardstown, KY 40004" }));
    expect(r.status).toBe("review");
  });
  it("'Imported by' prefix doesn't count against the name", () => {
    const r = matchBottlerNameAddress(
      app({ bottlerNameAddress: "Imported by Meridien Imports LLC, 12 Harbor St, Newark, NJ 07102" }),
      label({ bottlerNameAddress: "Meridien Imports LLC, 12 Harbor St, Newark, NJ 07102" }),
    );
    expect(r.status).toBe("pass");
  });
  it("falls back to whole-line comparison when it can't find city/state/ZIP", () => {
    const r = matchBottlerNameAddress(
      app({ bottlerNameAddress: "Chateau Meridien, Bordeaux, France" }),
      label({ bottlerNameAddress: "Chateau Meridien, Bordeaux, France" }),
    );
    expect(r.status).toBe("pass");
  });
  it("address helpers", () => {
    expect(parseAddress("Harbor Light Brewing Co., 220 Wharf St, Portland, ME 04101")).toEqual({
      name: "Harbor Light Brewing Co.",
      street: "220 Wharf St",
      city: "Portland",
      state: "ME",
      zip: "04101",
    });
    expect(normalizeStreet("412 River Road")).toBe(normalizeStreet("412 River Rd."));
  });
});

describe("matchCountryOfOrigin (exact, conditional)", () => {
  it("domestic product with no country on label → not applicable", () => {
    const r = matchCountryOfOrigin(app(), label());
    expect(r.notApplicable).toBe(true);
  });
  it("import with missing country on label → fail", () => {
    const r = matchCountryOfOrigin(app({ isImport: true, countryOfOrigin: "France" }), label({ countryOfOrigin: null }));
    expect(r.status).toBe("fail");
    expect(r.reason).toMatch(/Product of France/);
  });
  it("import with exact match → pass", () => {
    expect(matchCountryOfOrigin(app({ isImport: true, countryOfOrigin: "France" }), label({ countryOfOrigin: "FRANCE" })).status).toBe("pass");
  });
  it("'Product of Italy' on the label matches application 'Italy' (found by the Day 6 fixture)", () => {
    expect(matchCountryOfOrigin(app({ isImport: true, countryOfOrigin: "Italy" }), label({ countryOfOrigin: "Product of Italy" })).status).toBe("pass");
    expect(normalizeCountry("Made in ITALY.")).toBe("italy");
  });
  it("import with a different country → fail", () => {
    expect(matchCountryOfOrigin(app({ isImport: true, countryOfOrigin: "France" }), label({ countryOfOrigin: "Italy" })).status).toBe("fail");
  });
});

describe("matchGovernmentWarning (strict exact)", () => {
  it("statutory text with different line breaks → pass", () => {
    const wrapped = STATUTORY_WARNING.replace("Surgeon General,", "Surgeon\nGeneral,").replace("(2)", "\n(2)");
    const r = matchGovernmentWarning(app(), label({ governmentWarning: wrapped }));
    expect(r.status).toBe("pass");
  });
  it('title-case "Government Warning:" → fail (must be ALL CAPS)', () => {
    const r = matchGovernmentWarning(app(), label({ governmentWarning: STATUTORY_WARNING.replace("GOVERNMENT WARNING:", "Government Warning:") }));
    expect(r.status).toBe("fail");
    expect(r.reason).toMatch(/capital letters/);
  });
  it("one word reworded → fail", () => {
    const r = matchGovernmentWarning(app(), label({ governmentWarning: STATUTORY_WARNING.replace("may cause health problems", "may cause serious health problems") }));
    expect(r.status).toBe("fail");
    expect(r.reason).toMatch(/added 'serious'/);
  });
  it("warning absent → fail", () => {
    expect(matchGovernmentWarning(app(), label({ governmentWarning: null })).status).toBe("fail");
  });
});
