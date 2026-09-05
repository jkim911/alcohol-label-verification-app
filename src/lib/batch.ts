/**
 * Batch review: pure helpers for turning a CSV plus a pile of images into
 * per-label reviews. Browser and server safe (no DOM, no fetch here).
 */
import { parseApplication } from "@/lib/application-schema";
import { toCsv } from "@/lib/csv";
import { LABEL_FIELDS, LABEL_FIELD_NAMES, type Application, type FieldStatus, type LabelExtraction, type ReviewVerdict } from "@/lib/types";

/** Column order for the CSV template and export. Matches the Application type. */
export const BATCH_COLUMNS = [
  "id",
  "productType",
  "brandName",
  "classType",
  "alcoholContent",
  "netContents",
  "bottlerNameAddress",
  "isImport",
  "countryOfOrigin",
] as const;

export const TEMPLATE_EXAMPLE_ROW: Record<(typeof BATCH_COLUMNS)[number], string> = {
  id: "stones-throw-ok",
  productType: "spirits",
  brandName: "STONE'S THROW",
  classType: "Kentucky Straight Bourbon Whiskey",
  alcoholContent: "45",
  netContents: "750 mL",
  bottlerNameAddress: "Stone's Throw Distilling Co., 412 River Road, Bardstown, KY 40004",
  isImport: "no",
  countryOfOrigin: "",
};

export function templateCsv(): string {
  return toCsv([[...BATCH_COLUMNS], BATCH_COLUMNS.map((c) => TEMPLATE_EXAMPLE_ROW[c])]);
}

const TRUE_WORDS = new Set(["true", "yes", "y", "1", "import", "imported"]);

/** One CSV row → Application, with a plain-English error naming the row. */
export function rowToApplication(row: Record<string, string>, rowNumber: number): { application: Application } | { error: string } {
  const id = (row.id ?? "").trim();
  if (!id) return { error: `Row ${rowNumber}: the id column is empty. Each row needs an id that matches an image file name.` };
  const parsed = parseApplication({
    id,
    productType: (row.productType ?? "").trim().toLowerCase(),
    brandName: row.brandName ?? "",
    classType: row.classType ?? "",
    alcoholContent: (row.alcoholContent ?? "").trim() === "" ? null : row.alcoholContent,
    netContents: row.netContents ?? "",
    bottlerNameAddress: row.bottlerNameAddress ?? "",
    isImport: TRUE_WORDS.has((row.isImport ?? "").trim().toLowerCase()),
    countryOfOrigin: (row.countryOfOrigin ?? "").trim() || null,
  });
  if ("error" in parsed) return { error: `Row ${rowNumber} (${id}): ${parsed.error}` };
  return parsed;
}

/** "IMG_0042.JPG" → "img_0042"; "stones-throw-ok.png" → "stones-throw-ok". */
export function fileStem(name: string): string {
  return name
    .split(/[\\/]/)
    .pop()!
    .replace(/\.[^.]+$/, "")
    .trim()
    .toLowerCase();
}

export interface Pairing<F extends { name: string }> {
  byId: Map<string, F>;
  /** Image files whose name matched no row. */
  unmatchedFiles: string[];
  /** Row ids with no image. */
  missingIds: string[];
}

/** Pair images to rows by file-name stem, case-insensitively. */
export function pairImages<F extends { name: string }>(ids: string[], files: F[]): Pairing<F> {
  const byStem = new Map<string, F>();
  for (const f of files) byStem.set(fileStem(f.name), f);
  const byId = new Map<string, F>();
  const missingIds: string[] = [];
  const used = new Set<string>();
  for (const id of ids) {
    const stem = id.trim().toLowerCase();
    const f = byStem.get(stem);
    if (f) {
      byId.set(id, f);
      used.add(stem);
    } else {
      missingIds.push(id);
    }
  }
  const unmatchedFiles = files.filter((f) => !used.has(fileStem(f.name))).map((f) => f.name);
  return { byId, unmatchedFiles, missingIds };
}

/**
 * Run `worker` over `items` with at most `limit` in flight. Results keep
 * the input order. `onSettled` fires as each finishes, for a live count.
 */
export async function runPool<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
  onSettled?: (done: number, total: number, result: R, index: number) => void,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  let done = 0;
  const lanes = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (next < items.length) {
      const i = next++;
      const r = await worker(items[i], i);
      results[i] = r;
      done++;
      onSettled?.(done, items.length, r, i);
    }
  });
  await Promise.all(lanes);
  return results;
}

export type BatchStatus = FieldStatus | "unreadable" | "error";

export interface BatchResult {
  id: string;
  application: Application;
  status: BatchStatus;
  /** Present when status is pass/review/fail. */
  verdict?: ReviewVerdict;
  /** Present when status is unreadable. */
  extraction?: LabelExtraction;
  /** Plain-English reason for unreadable/error, or the first non-pass field reason. */
  note: string;
  durationMs: number;
}

export const BATCH_STATUS_LABEL: Record<BatchStatus, string> = {
  pass: "Pass",
  review: "Needs review",
  fail: "Fail",
  unreadable: "Unreadable",
  error: "Error",
};

/** Short summary line for a table cell: the first non-pass field, or "all fields match". */
export function summarizeVerdict(v: ReviewVerdict): string {
  const first = v.fields.find((f) => !f.notApplicable && f.status !== "pass");
  if (!first) return "All fields match.";
  return `${LABEL_FIELD_NAMES[first.field]}: ${first.reason}`;
}

/** Results → CSV for the agent's records: one row per label, one column per field status. */
export function resultsToCsv(results: BatchResult[]): string {
  const header = ["id", "brandName", "overall", "durationMs", ...LABEL_FIELDS.map((f) => LABEL_FIELD_NAMES[f]), "notes"];
  const rows = results.map((r) => [
    r.id,
    r.application.brandName,
    BATCH_STATUS_LABEL[r.status],
    r.durationMs,
    ...LABEL_FIELDS.map((f) => {
      const fr = r.verdict?.fields.find((x) => x.field === f);
      if (!fr) return "";
      return fr.notApplicable ? "N/A" : fr.status;
    }),
    r.verdict
      ? r.verdict.fields
          .filter((f) => !f.notApplicable && f.status !== "pass")
          .map((f) => `${LABEL_FIELD_NAMES[f.field]}: ${f.reason}`)
          .join(" | ")
      : r.note,
  ]);
  return toCsv([header, ...rows]);
}
