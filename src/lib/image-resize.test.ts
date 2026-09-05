import { describe, expect, it } from "vitest";
import { canPassThrough, fitWithin } from "./image-resize";

describe("fitWithin", () => {
  it("leaves small images alone", () => {
    expect(fitWithin(1000, 1400)).toEqual({ width: 1000, height: 1400 });
  });
  it("scales a landscape phone photo down to the cap on its long edge", () => {
    expect(fitWithin(4032, 3024)).toEqual({ width: 1800, height: 1350 });
  });
  it("scales a portrait photo by its height", () => {
    expect(fitWithin(3000, 4000)).toEqual({ width: 1350, height: 1800 });
  });
  it("respects a custom cap", () => {
    expect(fitWithin(4000, 4000, 1000)).toEqual({ width: 1000, height: 1000 });
  });
});

describe("canPassThrough", () => {
  it("passes a small PNG through untouched (keeps fixture text crisp)", () => {
    expect(canPassThrough({ type: "image/png", size: 60_000 }, 1000, 1400)).toBe(true);
  });
  it("re-encodes when the long edge is over the cap", () => {
    expect(canPassThrough({ type: "image/jpeg", size: 400_000 }, 4032, 3024)).toBe(false);
  });
  it("re-encodes big files even if the dimensions fit", () => {
    expect(canPassThrough({ type: "image/png", size: 5_000_000 }, 1700, 1200)).toBe(false);
  });
  it("re-encodes types the server won't accept", () => {
    expect(canPassThrough({ type: "image/heic", size: 100 }, 800, 600)).toBe(false);
  });
});
