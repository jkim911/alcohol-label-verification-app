import { describe, expect, it } from "vitest";
import { csvToObjects } from "./csv";
import { dedupeApplications, fileStem, pairImages, rowToApplication, runPool, templateCsv } from "./batch";
import type { Application } from "./types";

describe("templateCsv + rowToApplication", () => {
  it("the template's example row parses into a valid application", () => {
    const { rows } = csvToObjects(templateCsv());
    const r = rowToApplication(rows[0], 2);
    expect("application" in r && r.application.brandName).toBe("STONE'S THROW");
    expect("application" in r && r.application.isImport).toBe(false);
  });
  it("reads yes/true/1 as an import and names the row on error", () => {
    const base = { id: "x", productType: "wine", brandName: "B", classType: "C", netContents: "750 mL", bottlerNameAddress: "N, 1 St, Napa, CA 94558" };
    const imp = rowToApplication({ ...base, isImport: "YES", countryOfOrigin: "France" }, 3);
    expect("application" in imp && imp.application.isImport).toBe(true);
    const bad = rowToApplication({ ...base, brandName: "" }, 4);
    expect("error" in bad && bad.error).toMatch(/^Row 4 \(x\): brandName/);
    const noId = rowToApplication({ ...base, id: "" }, 5);
    expect("error" in noId && noId.error).toMatch(/id column is empty/);
  });
});

describe("pairImages", () => {
  it("matches by file-name stem, ignoring case and extension", () => {
    const files = [{ name: "Stones-Throw-OK.PNG" }, { name: "photos/abv-off-by-1.jpeg" }, { name: "stray.jpg" }];
    const p = pairImages(["stones-throw-ok", "abv-off-by-1", "missing-one"], files);
    expect([...p.byId.keys()]).toEqual(["stones-throw-ok", "abv-off-by-1"]);
    expect(p.missingIds).toEqual(["missing-one"]);
    expect(p.unmatchedFiles).toEqual(["stray.jpg"]);
  });
  it("reports duplicate ids and uses only the first occurrence", () => {
    const files = [{ name: "a.png" }, { name: "b.png" }];
    const p = pairImages(["a", "b", "A", "b"], files);
    expect(p.duplicateIds).toEqual(["A", "b"]);
    expect(p.byId.size).toBe(2);
    expect(p.missingIds).toEqual([]);
  });
  it("fileStem strips directories and extensions", () => {
    expect(fileStem("C:\\labels\\IMG_0042.JPG")).toBe("img_0042");
  });
});

describe("dedupeApplications", () => {
  it("keeps the first row per id and names the skipped one", () => {
    const mk = (id: string): Application => ({ id, productType: "beer", brandName: "B", classType: "C", alcoholContent: null, netContents: "12 fl oz", bottlerNameAddress: "x", isImport: false, countryOfOrigin: null });
    const { applications, errors } = dedupeApplications([
      { application: mk("x"), rowNumber: 2 },
      { application: mk("y"), rowNumber: 3 },
      { application: mk("X"), rowNumber: 4 },
    ]);
    expect(applications.map((a) => a.id)).toEqual(["x", "y"]);
    expect(errors).toEqual(["Row 4 (X): duplicate id — row 2 was kept, this one was skipped."]);
  });
});

describe("runPool", () => {
  it("keeps input order, respects the concurrency limit, and reports progress", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const seen: number[] = [];
    const out = await runPool(
      [30, 10, 20, 5],
      2,
      async (ms) => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((r) => setTimeout(r, ms));
        inFlight--;
        return ms * 2;
      },
      (done) => seen.push(done),
    );
    expect(out).toEqual([60, 20, 40, 10]);
    expect(maxInFlight).toBe(2);
    expect(seen).toEqual([1, 2, 3, 4]);
  });
  it("stops pulling new items once the signal is aborted", async () => {
    const ac = new AbortController();
    const started: number[] = [];
    const out = await runPool(
      [1, 2, 3, 4, 5, 6],
      2,
      async (n) => {
        started.push(n);
        await new Promise((r) => setTimeout(r, 10));
        if (n === 2) ac.abort();
        return n;
      },
      undefined,
      { signal: ac.signal },
    );
    expect(started.length).toBeLessThan(6);
    expect(out.filter((r) => r !== undefined).length).toBe(started.length);
  });
});
