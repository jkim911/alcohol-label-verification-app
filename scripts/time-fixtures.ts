/**
 * Run label extraction against every fixture and report latency per call.
 *
 *   npm run extract:fixtures            # all fixtures
 *   npm run extract:fixtures -- stones-throw-ok abv-off-by-1
 *
 * Reads ANTHROPIC_API_KEY from .env.local (same file Next.js uses).
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { extractLabel, isSupportedImageType } from "../src/lib/extract";
import type { Application } from "../src/lib/types";

loadDotEnvLocal();

const ROOT = path.resolve(__dirname, "..");
const APPS = path.join(ROOT, "fixtures", "applications");
const LABELS = path.join(ROOT, "fixtures", "labels");
const only = new Set(process.argv.slice(2));

async function main() {
  const ids = readdirSync(APPS)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""))
    .filter((id) => only.size === 0 || only.has(id));

  const rows: Array<Record<string, string | number>> = [];
  for (const id of ids) {
    const app = JSON.parse(readFileSync(path.join(APPS, `${id}.json`), "utf8")) as Application;
    const label = ["png", "jpg", "jpeg", "webp"]
      .map((ext) => path.join(LABELS, `${id}.${ext}`))
      .find(existsSync);
    if (!label) {
      console.warn(`skip ${id}: no label image`);
      continue;
    }
    const mediaType = label.endsWith(".png") ? "image/png" : label.endsWith(".webp") ? "image/webp" : "image/jpeg";
    if (!isSupportedImageType(mediaType)) continue;

    try {
      const { extraction, durationMs, model, usage } = await extractLabel(readFileSync(label), mediaType);
      rows.push({
        id,
        ms: durationMs,
        out: usage.outputTokens,
        conf: extraction.confidence.toFixed(2),
        brand: `${extraction.brandName ?? "∅"}${sameish(extraction.brandName, app.brandName) ? "" : " ≠"}`,
        abv: `${extraction.alcoholContent ?? "∅"}${extraction.alcoholContent === app.alcoholContent ? "" : " ≠"}`,
        net: extraction.netContents ?? "∅",
        origin: extraction.countryOfOrigin ?? "∅",
        warnHead: (extraction.governmentWarning ?? "").slice(0, 19) || "∅",
        unreadable: extraction.unreadableReason ? "yes" : "",
        model,
      });
    } catch (err) {
      rows.push({ id, ms: -1, out: 0, conf: "", brand: `ERROR: ${(err as Error).message}`, abv: "", net: "", origin: "", warnHead: "", unreadable: "", model: "" });
    }
  }

  console.table(rows);
  const times = rows.map((r) => r.ms as number).filter((n) => n >= 0).sort((a, b) => a - b);
  if (times.length) {
    const p50 = times[Math.floor(times.length / 2)];
    const max = times[times.length - 1];
    console.log(`\n${times.length} calls · median ${p50} ms · slowest ${max} ms · budget for extraction ≈ 3000 ms (verdict 5000 ms)`);
  }
}

function sameish(a: string | null, b: string) {
  return (a ?? "").replace(/\s+/g, " ").trim().toLowerCase() === b.replace(/\s+/g, " ").trim().toLowerCase();
}

function loadDotEnvLocal() {
  const file = path.resolve(__dirname, "..", ".env.local");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
