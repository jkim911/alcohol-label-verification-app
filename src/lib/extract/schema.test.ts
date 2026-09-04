import { describe, expect, it } from "vitest";
import { LabelExtractionSchema, isSupportedImageType, toLabelExtraction } from "./index";

describe("LabelExtractionSchema", () => {
  it("accepts a fully-populated label", () => {
    const parsed = LabelExtractionSchema.parse({
      brandName: "Stone's Throw",
      classType: "Kentucky Straight Bourbon Whiskey",
      alcoholContent: 45,
      netContents: "750 mL",
      bottlerNameAddress: "Stone's Throw Distilling Co., 412 River Road, Bardstown, KY 40004",
      countryOfOrigin: null,
      governmentWarning: "GOVERNMENT WARNING: (1) ...",
      confidence: 0.97,
      unreadableReason: null,
    });
    expect(parsed.alcoholContent).toBe(45);
  });

  it("rejects confidence outside 0..1", () => {
    expect(() =>
      LabelExtractionSchema.parse({
        brandName: null, classType: null, alcoholContent: null, netContents: null,
        bottlerNameAddress: null, countryOfOrigin: null, governmentWarning: null,
        confidence: 1.5, unreadableReason: null,
      }),
    ).toThrow();
  });
});

describe("toLabelExtraction", () => {
  it("drops a null unreadableReason so the app type stays optional", () => {
    const out = toLabelExtraction({
      brandName: "X", classType: null, alcoholContent: null, netContents: null,
      bottlerNameAddress: null, countryOfOrigin: null, governmentWarning: null,
      confidence: 0.9, unreadableReason: null,
    });
    expect("unreadableReason" in out).toBe(false);
  });

  it("keeps a real unreadableReason", () => {
    const out = toLabelExtraction({
      brandName: null, classType: null, alcoholContent: null, netContents: null,
      bottlerNameAddress: null, countryOfOrigin: null, governmentWarning: null,
      confidence: 0.2, unreadableReason: "The photo is too blurry to read.",
    });
    expect(out.unreadableReason).toMatch(/blurry/);
  });
});

describe("isSupportedImageType", () => {
  it("accepts the image types Claude vision accepts", () => {
    expect(isSupportedImageType("image/png")).toBe(true);
    expect(isSupportedImageType("image/jpeg")).toBe(true);
    expect(isSupportedImageType("application/pdf")).toBe(false);
  });
});
