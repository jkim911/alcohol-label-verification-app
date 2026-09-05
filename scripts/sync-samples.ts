/**
 * Copy fixture images to public/samples/ and write the batch CSVs:
 *   public/batch-template.csv       — headers + one example row
 *   public/samples/batch-sample.csv — all fixtures, for "Try a sample batch"
 * Run with: npm run samples:sync
 */
import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { BATCH_COLUMNS, templateCsv } from "../src/lib/batch";
import { toCsv } from "../src/lib/csv";
import type { Application } from "../src/lib/types";

const ROOT = path.resolve(__dirname, "..");
const LABELS = path.join(ROOT, "fixtures", "labels");
const APPS = path.join(ROOT, "fixtures", "applications");
const OUT = path.join(ROOT, "public", "samples");

mkdirSync(OUT, { recursive: true });
let copied = 0;
for (const f of readdirSync(LABELS)) {
  if (/\.(png|jpe?g|webp)$/i.test(f)) {
    copyFileSync(path.join(LABELS, f), path.join(OUT, f));
    copied++;
  }
}

const apps: Application[] = readdirSync(APPS)
  .filter((f) => f.endsWith(".json"))
  .sort()
  .map((f) => JSON.parse(readFileSync(path.join(APPS, f), "utf8")));

const rows = apps.map((a) =>
  BATCH_COLUMNS.map((c) => {
    const v = a[c as keyof Application];
    if (c === "isImport") return v ? "yes" : "no";
    return v == null ? "" : String(v);
  }),
);
writeFileSync(path.join(OUT, "batch-sample.csv"), toCsv([[...BATCH_COLUMNS], ...rows]));
writeFileSync(path.join(ROOT, "public", "batch-template.csv"), templateCsv());
console.log(`copied ${copied} images; wrote batch-sample.csv (${rows.length} rows) and batch-template.csv`);
