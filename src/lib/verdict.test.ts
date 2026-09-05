import { describe, expect, it } from "vitest";
import { STATUTORY_WARNING } from "@/lib/matchers/warning";
import type { Application, LabelExtraction } from "@/lib/types";
import { buildVerdict, isUnreadable, overallStatus } from "./verdict";

const application: Application = {
  id: "stones-throw-ok",
  productType: "spirits",
  brandName: "STONE'S THROW",
  classType: "Kentucky Straight Bourbon Whiskey",
  alcoholContent: 45,
  netContents: "750 mL",
  bottlerNameAddress: "Stone's Throw Distilling Co., 412 River Road, Bardstown, KY 40004",
  isImport: false,
  countryOfOrigin: null,
};

const extraction: LabelExtraction = {
  brandName: "Stone's Throw",
  classType: "Kentucky Straight Bourbon Whiskey",
  alcoholContent: 45,
  netContents: "750 mL",
  bottlerNameAddress: "Stone's Throw Distilling Co., 412 River Road, Bardstown, KY 40004",
  countryOfOrigin: null,
  governmentWarning: STATUTORY_WARNING,
  confidence: 0.97,
};

describe("buildVerdict", () => {
  it("the stones-throw-ok scenario passes overall with seven field results", () => {
    const v = buildVerdict(application, extraction, 3900);
    expect(v.overall).toBe("pass");
    expect(v.fields).toHaveLength(7);
    expect(v.durationMs).toBe(3900);
  });
  it("overall is the worst applicable field", () => {
    const v = buildVerdict(application, { ...extraction, alcoholContent: 46 }, 1);
    expect(v.overall).toBe("fail");
    const v2 = buildVerdict(application, { ...extraction, classType: "Kentucky Bourbon Whiskey" }, 1);
    expect(v2.overall).toBe("review");
  });
  it("not-applicable fields never drag the verdict down", () => {
    expect(
      overallStatus([
        { field: "brandName", status: "pass", expected: "a", actual: "a", reason: "" },
        { field: "countryOfOrigin", status: "fail", expected: null, actual: null, reason: "", notApplicable: true },
      ]),
    ).toBe("pass");
  });
});

describe("isUnreadable", () => {
  it("uses the model's reason when it gives one", () => {
    expect(isUnreadable({ ...extraction, unreadableReason: "Too blurry." })).toBe("Too blurry.");
  });
  it("treats low confidence as unreadable", () => {
    expect(isUnreadable({ ...extraction, confidence: 0.3 })).toMatch(/confident/);
  });
  it("returns null for a readable label", () => {
    expect(isUnreadable(extraction)).toBeNull();
  });
});
