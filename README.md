# Alcohol Verification App

**Live:** https://main.dhvxptf4pufyq.amplifyapp.com/ (AWS Amplify Hosting, deploys from `main`)

AI-assisted alcohol-label verification for TTB compliance review. Give it what
the applicant submitted and a photo of the physical label; in about four
seconds it tells an agent, field by field, whether they agree — **Pass**,
**Needs review**, or **Fail** — with a plain-English reason for each. The agent
makes the final call. Nothing is stored.

Two flows: **review one label** (upload → compare → verdict) and **review a
batch** (a CSV of applications plus a folder of photos → live progress → a
filterable results table → CSV export). Both have a "try a sample" path, so
you can test without your own images.

> Built as a 7-day take-home. `docs/build-plan.md` is the plan,
> `docs/devlog.md` is the day-by-day journal with every decision and bug,
> and `docs/how-it-works.md` explains the request path under the hood.

## Quick start

Requires Node 22 (`.nvmrc`) and an Anthropic API key.

```bash
npm install
cp .env.example .env.local        # add ANTHROPIC_API_KEY=...
npm run dev                       # http://localhost:3000
```

## Try it

**In the browser:** open http://localhost:3000/single, pick a sample from
"Try a sample" (or drop your own photo and fill in the form), press
**Compare**. For batch, open http://localhost:3000/batch and press **Try a
sample batch**, or download the CSV template, add one row per label with an
`id` matching each photo's file name, and choose the photos.

**From the terminal:**

```bash
# read a label
curl -s -X POST -F "image=@fixtures/labels/warning-lowercase.png" http://localhost:3000/api/extract | python3 -m json.tool

# full review: label + application → verdict
curl -s -X POST -F "image=@fixtures/labels/warning-lowercase.png" \
  -F "application=$(cat fixtures/applications/warning-lowercase.json)" \
  http://localhost:3000/api/review | python3 -m json.tool

# time every fixture through the model
npm run extract:fixtures
```

Swap `http://localhost:3000` for the live URL to hit the deployment.

## How it works

```
browser ──▶ /single or /batch (Next.js, React)
              │  photo shrunk in the browser (canvas, ≤1800px JPEG)
              ▼
         POST /api/review  ──▶  src/lib/extract   one Claude vision call,
              │                                    structured output (zod)
              │                 src/lib/matchers   seven pure functions,
              │                                    one tolerance rule each
              ▼
         { verdict }  ──▶  banner + photo + one card per field
```

- **Extraction** is one multimodal Claude call (`claude-sonnet-5` by default)
  whose reply must match a zod schema, so the label becomes validated data,
  not free text. Every field is nullable: "not on the label" is a real answer.
  Unreadable photos come back with a reason and a low confidence, and the UI
  shows "we couldn't read this" instead of a verdict.
- **Matching** is pure TypeScript with a different tolerance per field
  (table below). Every result is one of three states and carries a sentence
  an agent can read, never a raw diff. The overall recommendation is the
  worst applicable field.
- **Batch** fans out from the browser: rows are paired to photos by file
  name (duplicate ids are reported and skipped), six reviews run at a time
  against the same route, results stream into the table as they finish,
  a run can be stopped part-way, and results export to CSV. No queue to
  operate.
- **Hosting:** AWS Amplify builds on every push (`amplify.yml`); static
  pages go to CloudFront and the API routes run on Lambda.

### The matching rules

| Field | Compared how | Pass | Needs review | Fail |
|---|---|---|---|---|
| Brand name | edit-distance similarity after normalising case/space/quotes | ≥ 90 % | 70–90 %, or one word added/missing | otherwise |
| Class / type | set of words | identical | reordered, or a qualifier added/dropped | otherwise |
| Alcohol content | number | within ±0.3 | absent where required | outside tolerance |
| Net contents | number + unit → mL | equal within 1 % | unparseable | different volume |
| Bottler name / address | name fuzzy; city/state/ZIP exact; street abbreviations normalised | all agree | street or name slightly off | city/state/ZIP differ |
| Country of origin | imports only; "Product of X" → "X" | exact | — | missing or different |
| Government warning | verbatim against 27 CFR 16.21; heading must be ALL CAPS | identical (whitespace aside) | — | any wording or case change |

### Latency

The interviews' hard rule is a result in under five seconds. Measured on the
fixtures: Claude Opus 5 read every label correctly but took ~5.8 s per call;
Claude Sonnet 5 took ~3.9 s and, after one prompt adjustment, matched Opus on
accuracy. Sonnet is the default; `EXTRACTION_MODEL` switches it. A full
single review on the live site typically runs ~4 s; a 14-label batch, six at
a time, finishes in ~12–13 s.

Honest caveat: across three live batch runs (42 calls) the median was
3.8–4.1 s, but about one call in seven exceeded 5 s (worst 7.1 s), and the
first run after a deploy was slower still because of Lambda cold starts.
The budget holds for the typical call, not for every call.

## Tests and checks

```bash
npm test          # 71 unit tests: matchers, verdict, CSV, batch pairing/pool, resize math, route validation
npm run lint
npm run build
```

Fourteen fixtures in `fixtures/` cover every rule and both failure paths
(see `fixtures/README.md`), including three added after the code was written
as untuned edge cases — one of which found a real bug (see the devlog, Day 6).

## Project layout

```
src/app/            pages (/, /single, /batch) and API routes (/api/extract, /api/review)
src/components/     ReviewSingle, BatchReview, VerdictView, StatusMark
src/lib/types.ts    Application, LabelExtraction, FieldResult, ReviewVerdict
src/lib/extract/    the Claude call and its schema
src/lib/matchers/   text, units, address, warning helpers + the seven matchers
src/lib/verdict.ts  roll-up and the unreadable rule
src/lib/csv.ts      CSV parse/serialise;  src/lib/batch.ts  pairing, pool, export
src/lib/image-resize.ts  browser-side downscale used by both uploads
fixtures/           sample applications + label images + generator
scripts/            time-fixtures.ts, sync-samples.ts
docs/               build plan, devlog, how-it-works
```

## Assumptions & trade-offs

- **No COLA integration.** Application data is typed in, loaded from a
  sample, or uploaded as CSV. Standalone proof-of-concept, as the interviews
  asked.
- **Prototype-grade security.** No authentication and no persistence;
  nothing sensitive is stored. Production would need auth, audit logging,
  and a retention policy.
- **External vision API.** Extraction calls a cloud model. A rollout behind
  TTB's firewall would need an on-prem/VPC vision model or an approved API
  allowlist.
- **Model choice favours latency.** Opus 5 was slightly more robust in
  testing but never under five seconds; Sonnet 5 is the default. One
  environment variable swaps them.
- **Government-warning bold weight is not detected.** Text, casing, and
  wording are checked exactly; typographic weight is flagged for a visual
  check rather than guessed.
- **Poor-quality images** are out of MVP scope. The tool says "couldn't
  read this clearly" rather than guessing. Large photos are downscaled in
  the browser before upload.
- **Batch input is CSV + individual photos.** Zip upload isn't implemented;
  multi-select in the file dialog covers the workflow.
- **The report is print-to-PDF**, not a generated file: the browser's print
  dialog does the work, so there's no PDF library to maintain.

## What I'd do next

Zip upload and a failures-only export; per-field confidence shown on each
card; a VPC-hosted model path; bounding boxes on hover; and a small audit
table pairing the tool's recommendation with the agent's decision.
