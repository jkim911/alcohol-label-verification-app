import { describe, expect, it } from "vitest";
import { csvToObjects, parseCsv, toCsv } from "./csv";

describe("parseCsv", () => {
  it("handles quoted commas, doubled quotes, and CRLF", () => {
    const text = 'id,name\r\n1,"Stone\'s Throw Distilling Co., 412 River Road"\r\n2,"He said ""hi"""\r\n';
    expect(parseCsv(text)).toEqual([
      ["id", "name"],
      ["1", "Stone's Throw Distilling Co., 412 River Road"],
      ["2", 'He said "hi"'],
    ]);
  });
  it("strips a BOM and ignores blank trailing lines", () => {
    expect(parseCsv("\uFEFFa,b\n1,2\n\n")).toEqual([["a", "b"], ["1", "2"]]);
  });
  it("keeps embedded newlines inside quotes", () => {
    expect(parseCsv('a\n"line1\nline2"')).toEqual([["a"], ["line1\nline2"]]);
  });
});

describe("csvToObjects", () => {
  it("maps rows onto trimmed headers", () => {
    const { headers, rows } = csvToObjects(" id , brandName \nx, Harbor Light ");
    expect(headers).toEqual(["id", "brandName"]);
    expect(rows).toEqual([{ id: "x", brandName: "Harbor Light" }]);
  });
});

describe("toCsv", () => {
  it("round-trips through parseCsv", () => {
    const rows = [["id", "note"], ["1", 'has, comma and "quotes"'], ["2", "multi\nline"]];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
});
