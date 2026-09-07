# Build journal

A running log of everything done on this project, in order, with the
reasoning. Written so you can explain any step if asked. Newest entries at the
bottom. `docs/how-it-works.md` explains the *current* state of the app;
this file explains *how it got there*.

---

## Day 1 — 2026-09-03 — Setup

### 1. Understanding the brief

The starting point was the "Label Verification Build Plan" (saved as
`docs/build-plan.md`). It reads the take-home's four interview transcripts and
turns them into concrete acceptance criteria. The three that shape every
technical decision:

- **Under 5 seconds** from upload to verdict, or agents won't use it.
- **Three outcomes, not two** (Pass / Needs review / Fail), because a
  binary match/no-match tool can't tell "different casing" from "different brand".
- **Built for the least tech-comfortable user**, not the median one.

Everything below is in service of those three.

### 2. Tooling installed on this Mac

| Tool | What it is | Why we needed it |
|---|---|---|
| **Homebrew** (already present) | macOS package manager | Installs command-line tools |
| **Node.js 22 + npm** (already present) | JavaScript runtime and its package manager | Runs Next.js and installs libraries |
| **GitHub CLI (`gh`)** | Official command-line client for GitHub | Create the repo and push without touching the website. Installed with `brew install gh`. |

**Logging in to GitHub.** `gh auth login --web` uses GitHub's *device flow*:
the terminal prints a one-time code, you paste it at github.com/login/device,
and GitHub hands the CLI a token. The token is stored in the macOS keychain.
You never typed a password into a terminal, and the token has limited scopes
(`repo`, `read:org`, `gist`).

### 3. Scaffolding the app

```bash
npx create-next-app@latest alcohol-verification-app --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

`npx` runs a package without installing it globally. `create-next-app` is the
official generator for Next.js projects. The flags:

| Flag | Meaning |
|---|---|
| `--ts` | TypeScript instead of plain JavaScript |
| `--tailwind` | Tailwind CSS (utility classes like `flex`, `text-lg`) preconfigured |
| `--eslint` | ESLint (a linter: catches bugs and style issues) preconfigured |
| `--app` | Use the **App Router** (`src/app/` folder-based routing), not the older Pages Router |
| `--src-dir` | Put code under `src/` instead of the repo root |
| `--import-alias "@/*"` | `import x from "@/lib/types"` instead of `../../lib/types` |
| `--use-npm` | Use npm (the only package manager on this Mac) |

It also ran `git init` and made the first commit.

### 4. Creating the repository

```bash
gh repo create alcohol-verification-app --private --source=. --remote=origin --push
```

That single command (a) created a private repo under your account, (b) added
it as the `origin` remote of the local git repo, and (c) pushed `main`.
"Remote" is git's name for a copy of the repo somewhere else; `origin` is the
conventional name for the main one.

The repo was first created as `old-tom-verify` (the plan's working title) and
renamed with `gh repo rename`. GitHub keeps a redirect from the old name.

### 5. The project layout

```
alcohol-verification-app/
├── src/
│   ├── app/                     # App Router: folders = URLs
│   │   ├── layout.tsx           # the HTML shell every page shares
│   │   ├── page.tsx             # the home page  (URL: /)
│   │   ├── globals.css          # Tailwind import + a few CSS variables
│   │   └── api/extract/route.ts # JSON endpoint (URL: /api/extract)
│   └── lib/                     # plain TypeScript, no React
│       ├── types.ts             # the data shapes everything else agrees on
│       ├── matchers/index.ts    # field-by-field comparison logic (Day 3)
│       ├── matchers/matchers.test.ts
│       └── extract/README.md    # where the Claude vision call goes (Day 2)
├── public/                      # static files served as-is
├── fixtures/                    # sample applications + label images
├── docs/                        # build plan, this journal, how-it-works
├── package.json                 # project name, scripts, dependency list
├── package-lock.json            # exact versions installed (commit it)
├── tsconfig.json                # TypeScript compiler settings
├── next.config.ts               # Next.js settings (empty for now)
├── postcss.config.mjs           # wires Tailwind v4 into the CSS pipeline
├── eslint.config.mjs            # lint rules (Next.js defaults)
├── vitest.config.mts            # test runner settings
├── .nvmrc                       # "22" — which Node version this expects
├── .env.example                 # documents the secrets; real .env.local is git-ignored
└── node_modules/                # installed packages (git-ignored, rebuildable)
```

### 6. Dependencies

`npm install <pkg>` downloads a package into `node_modules/` and records it
in `package.json`. `-D` marks it a *dev* dependency: needed to build and test,
not needed at runtime. `package-lock.json` pins the exact version of every
package (including packages' own dependencies) so every machine installs the
same thing.

| Package | Kind | Role |
|---|---|---|
| `next` | runtime | The framework: routing, server rendering, API routes, build tooling |
| `react`, `react-dom` | runtime | The UI library Next.js is built on |
| `@anthropic-ai/sdk` | runtime | Official Claude SDK, used for the vision extraction call |
| `zod` | runtime | Schema validation: define a shape, validate unknown data against it (used for the model's JSON output and API input) |
| `typescript` | dev | The TypeScript compiler / type checker |
| `tailwindcss`, `@tailwindcss/postcss` | dev | Tailwind v4 and its build plugin |
| `eslint`, `eslint-config-next` | dev | Linter and Next.js's rule set |
| `vitest` | dev | Test runner (fast, TypeScript-native) |
| `@types/node`, `@types/react`, `@types/react-dom` | dev | Type definitions so TypeScript understands Node and React APIs |

**A snag worth remembering:** installing vitest failed with a *peer dependency*
conflict — vitest wanted `@types/node` 22+, the scaffold had pinned 20. Fix:
`npm install -D @types/node@^22`, which also matches the Node 22 in `.nvmrc`.

### 7. `src/lib/types.ts` — the shared vocabulary

This is the most important file to understand, because every other module
imports from it.

- **`LABEL_FIELDS`** is a readonly array of the seven field keys (`as const`
  makes TypeScript treat it as exact literals, not just `string[]`).
  **`LabelField`** is the union type derived from it, so a typo like
  `"brandNmae"` is a compile error.
- **`LABEL_FIELD_NAMES`** maps each key to the words shown in the UI.
- **`Application`** is what the applicant submitted. It stands in for COLA
  data (the brief says explicitly not to integrate with COLA).
- **`LabelExtraction`** is what the vision model read off the label. Every
  field is `string | null` on purpose: "not found on the label" must be
  representable, distinct from an empty string. It also carries a
  `confidence` number and an optional `unreadableReason` so a bad photo
  produces an honest "we couldn't read this", never a guess.
- **`FieldStatus`** is `"pass" | "review" | "fail"` — three values, enforced
  by the type.
- **`FieldResult`** is one row of the verdict: field, status, `expected`,
  `actual`, and a `reason` in plain English. The `reason` is what agents read.
- **`ReviewVerdict`** bundles the seven results with an `overall` status and
  `durationMs`, so every response records whether it met the 5-second budget.

### 8. `src/lib/matchers/index.ts` — the comparison engine (stubbed)

One function per field, all with the same signature (the `Matcher` type):
`(application, extraction) => FieldResult`. Today each throws
"not implemented", but the *policy* for each is written in a comment,
straight from the plan's §03 table. `MATCHERS` maps each `LabelField` to its
function.

Design rules for this module, and why they matter in an interview:

- **Pure functions.** No network, no file I/O, no React. Input in, result
  out. That's what makes them trivially testable.
- **Different tolerance per field.** Brand names are fuzzy ("STONE'S THROW"
  equals "Stone's Throw"), ABV allows ±0.3, but the government warning is
  exact because applicants try to sneak changes past reviewers. A single
  global "similarity threshold" would be wrong for at least one field.

### 9. Tests

`src/lib/matchers/matchers.test.ts` holds 25 cases, each named for a specific
edge case from the plan (e.g. `title-case "Government Warning:" → fail`),
all marked `it.todo` until Day 3. This is deliberate: the test names *are*
the spec, so implementing a matcher means turning its todos into asserts.

`vitest.config.mts` tells vitest to run in a plain Node environment (no
browser simulation needed for pure functions) and to understand the `@/`
import alias. The `.mts` extension marks it as an ES module, which vitest
prefers. Run with `npm test`. Today: **25 todo, 0 failing**.

### 10. `src/app/` — pages and the API route

Next.js's App Router turns folders into URLs:

- `src/app/layout.tsx` — the HTML shell (`<html>`, `<body>`, fonts, the
  page `<title>` via `metadata`). Every page renders inside it.
- `src/app/page.tsx` — the home page at `/`. A React component returning
  JSX (HTML-like syntax) styled with Tailwind classes. Today it's the Day 1
  placeholder with the two review modes disabled.
- `src/app/api/extract/route.ts` — the API endpoint at `/api/extract`.
  Exporting a function named `POST` handles POST requests. Today it returns
  HTTP **501 Not Implemented** with a JSON error, so the URL exists and its
  shape is fixed before the real implementation lands.

These route files run on the *server* (Next.js server components and route
handlers), which is why the Claude API key never reaches the browser.

### 11. Styling

Tailwind v4 is imported with one line in `globals.css` (`@import "tailwindcss"`)
and wired in through `postcss.config.mjs`. Components use utility classes
(`text-3xl`, `grid`, `rounded-lg`) instead of separate CSS files. The plan's
UX rules — large type, high contrast, every icon paired with a word — are
applied directly in `page.tsx`.

### 12. Configuration and secrets

`.env.example` documents `ANTHROPIC_API_KEY`. Next.js automatically loads
`.env.local` into `process.env` on the server. `.gitignore` blocks every
`.env*` file *except* `.env.example`, so a key can't be committed by
accident. On Vercel the key is set in the project's Environment Variables.

### 13. Linting, building, testing

- `npm run lint` — ESLint with Next.js's rules. Clean.
- `npm run build` — compiles TypeScript, type-checks, and produces the
  production bundle. Its output lists every route and whether it's static
  (`/`) or server-rendered on demand (`/api/extract`). Clean.
- `npm test` — vitest. 25 todo.

### 14. Commits on Day 1

```
73cf83d Rename project to Alcohol Verification App
f865aea Track .env.example and make vitest config ESM-clean
d9e2be4 Scaffold domain model, matcher stubs, API route, and project docs
9f3574a Add Anthropic SDK, zod, vitest, and env/tooling config
0a4bf1c Initial commit from Create Next App
```

Commits are small and descriptive on purpose: "committed incrementally" is a
graded deliverable.

---

## Day 2 — 2026-09-04 — A detour and back

Late on Day 1 the stack was switched to Python (FastAPI + Jinja2) at your
request, then switched back to this TypeScript version. Both moves are in
the git history (`03f02ac` rebuilt in Python, `cd6167a` added docs, then
this revert). Nothing from the Python version survives in the tree except
these docs, rewritten for TypeScript.

**How the revert was done, in case you're asked:**

```bash
git rm -r app tests pyproject.toml requirements*.txt render.yaml .python-version
git checkout 73cf83d -- .     # restore every file as it was at that commit
npm install                   # rebuild node_modules from package-lock.json
```

`git checkout <commit> -- .` copies the files from an old commit into the
working tree without moving `HEAD`, so the history stays linear and the
restore is just another commit. That's preferable to `git reset --hard`,
which would erase the intervening commits.

**How to talk about it:** "I evaluated a Python backend, but kept the
single Next.js app because the plan's key constraint is latency and
simplicity — one service, one deploy, and API routes mean no second server."

### Switching the deploy target to AWS

You asked for an industry-standard host instead of Vercel. Chosen:
**AWS Amplify Hosting**, because it's the AWS service that understands
Next.js out of the box (static pages to CloudFront, API routes to Lambda),
deploys on every git push, and stays in the free tier. The alternatives
considered: App Runner (Docker container, ~$5–15/month) and ECS Fargate
with a load balancer (the full enterprise pattern, ~$20/month and a day of
setup). Both were rejected as too much infrastructure for a 7-day
prototype whose grading criteria don't mention hosting.

Added `amplify.yml`, the build spec Amplify follows. Two non-obvious lines:

- `nvm install 22 && nvm use 22` — Amplify's build image may default to an
  older Node; this pins it to match `.nvmrc`.
- `env | grep -e ANTHROPIC_API_KEY >> .env.production` — Amplify exposes
  environment variables at *build* time only. Route handlers run later,
  at request time, so the key has to be written into `.env.production`
  during the build for the server code to see it. This is Amplify's
  documented pattern for Next.js server-side secrets.

**How to talk about it:** "It's deployed on AWS Amplify, which fronts the
static pages with CloudFront and runs the API route on Lambda. I chose it
over ECS because the prototype has no long-running process and no
database, so managed serverless was the smallest footprint."

### Downgrading Next.js 16 → 15 for Amplify

Amplify's documentation says it "fully manages server-side rendering (SSR)
for apps built with Next.js versions 12 through 15." The scaffold had
installed Next.js 16 (the newest at the time). Running an unsupported major
version on the host is exactly the kind of surprise you don't want on Day 6,
so the app was moved to 15 now, while it's small:

```bash
npm install next@15 eslint-config-next@15
```

Only one line of code depended on 16: `layout.tsx` used a `LayoutProps<"/">`
helper type that 16 generates. It became the plain
`{ children: React.ReactNode }` props type. Build and tests pass unchanged.

`npm audit` now reports two advisories in a `postcss` copy bundled *inside*
Next.js 15. That's a build-time CSS tool, not code that runs in the deployed
app or touches user input, and the only offered "fix" is upgrading back to
Next 16. Noted as an accepted, documented trade-off; revisit when Amplify
supports 16.

### First deploy — live on AWS

You created the AWS account and connected the repo in the Amplify console
yourself (the embedded browser couldn't complete your passkey MFA prompt,
which is a browser limitation, not an AWS problem). Amplify detected the
Next.js app, used `amplify.yml`, created its own IAM service role for logs,
and built `main`.

**Live URL:** https://main.dhvxptf4pufyq.amplifyapp.com/

Verified from the command line, not just the dashboard:

| Check | Result |
|---|---|
| `GET /` | 200, home page HTML, ~0.2 s |
| `POST /api/extract` | 501 with the JSON error, ~0.14 s |
| Response headers | `x-cache: Hit from cloudfront`, `via: ... cloudfront.net` |

Those headers are the proof of the architecture described in
`docs/how-it-works.md`: the static page is served by CloudFront's cache,
and the API route ran on Amplify's compute layer (Lambda).

**About the API key.** You added `ANTHROPIC_API_KEY` in Amplify's
environment variables. One subtlety worth knowing: `amplify.yml` copies that
variable into `.env.production` *during the build*, so a key added after a
build isn't visible to the running app until the next build. The commit
that added this entry triggered a rebuild, so it's baked in from here on.
Nothing uses the key until Day 2, so there was no gap in behaviour.

**How to talk about the deploy:** "Every push to `main` triggers an Amplify
build. Static pages go to CloudFront; the API route runs on Lambda. Secrets
live in Amplify's environment, never in the repo."

### Open items (as of end of Day 1)

- Generate 8–12 fixture label images with paired application JSON
  (`fixtures/README.md` lists the scenarios). ✅ done at the start of Day 2.
- Create `.env.local` with your Anthropic key before extraction work begins. ✅ done.

---

## Day 2 — 2026-09-04 — Extraction

### 1. Fixture review

You generated ten synthetic labels with `fixtures/generate_fixtures.py`
(Pillow draws each label from the same data that writes the application
JSON, so image and JSON can't drift apart). Review findings:

- All ten matched their manifest scenario, and the JSON field names match
  `src/lib/types.ts` exactly (`brandName`, `isImport`, …).
- **One fix:** the import fixture's bottler address ended in "France", so a
  model could plausibly read a country of origin from the address and the
  test would prove nothing. The address is now a U.S. importer
  ("Imported by Meridien Imports LLC, … Newark, NJ"), so the *only* way to
  get "France" is a "Product of France" line — which the label deliberately
  omits.
- **One addition:** `blurry-unreadable`, the Stone's Throw label with a 4°
  tilt, heavy Gaussian blur, and washed-out contrast. Day 2 needs a fixture
  that exercises the "we couldn't read this" path, not just clean labels.
- The generator now finds fonts on macOS as well as Linux and accepts ids
  on the command line to regenerate only some fixtures.

### 2. The extraction module — `src/lib/extract/index.ts`

One function, `extractLabel(imageBytes, mediaType)`, makes **one** call to
Claude and returns a `LabelExtraction` plus the call's duration and token
usage. Design points worth being able to explain:

- **Structured output, not free text.** `LabelExtractionSchema` is a zod
  schema; `zodOutputFormat(schema)` turns it into a JSON schema the API
  enforces, and `client.beta.messages.parse(...)` gives back
  `parsed_output` already validated. No regex, no hand-written JSON
  parsing, and a malformed answer is rejected rather than trusted.
- **Every field nullable.** "Not on the label" is a real answer. The schema
  descriptions tell the model when to return null, and the system prompt
  says never to guess or "correct" what's printed.
- **The image goes in as base64** in the first user content block, with a
  one-line instruction after it. Supported types are JPEG, PNG, WebP, GIF.
- **`effort: "low"`.** Reading a label is transcription, not reasoning.
  Lower effort means less thinking and faster answers.
- **Server-side fallbacks** (`fallbacks: "default"` with its beta header)
  are sent only to models that support them (Opus 5 tier). If a safety
  classifier declined the request, Anthropic would re-run it on a fallback
  model inside the same call. For labels this is unlikely, but it's the
  recommended default and costs nothing.
- **Errors are mapped to plain English + an HTTP status** in
  `ExtractionError`: bad key → 500, rate limit → 503, bad image → 400,
  network → 503, refusal → 422. The real API error is logged server-side;
  the agent only ever sees the friendly sentence.
- **A 15-second timeout and one retry** on the client, so a hung call fails
  fast instead of leaving the agent staring at a spinner.

### 3. The API route — `src/app/api/extract/route.ts`

`POST /api/extract` now takes a multipart form with an `image` file. It
validates before it spends money: no file → 400, unsupported type → 400,
over 10 MB → 400. Then it calls `extractLabel` and returns
`{ extraction, durationMs, model, usage }`. It runs on the Node runtime
(`export const runtime = "nodejs"`), not the edge runtime, because the SDK
and `Buffer` need Node.

Tests in `route.test.ts` cover every validation branch without touching
the network. `schema.test.ts` covers the zod schema and the null →
undefined normalisation.

### 4. Timing every fixture — `npm run extract:fixtures`

`scripts/time-fixtures.ts` loads `.env.local`, runs every fixture through
`extractLabel`, and prints a table: latency, output tokens, confidence,
and the key fields with a `≠` when they differ from the application (which
is *expected* for the mismatch fixtures). `EXTRACTION_MODEL=… npm run
extract:fixtures` swaps the model. This is the evidence behind the model
decision below.

### 5. Latency experiments and the model decision

The interviews' hard rule is a verdict in under 5 seconds; the plan budgets
~3 s for extraction. Results across all 11 fixtures (first-run numbers,
same prompt, `effort: low`):

| Configuration | Median | Slowest | Read errors |
|---|---|---|---|
| Opus 5 | 5.8 s | 8.1 s | 0 of 11 |
| Opus 5, thinking disabled | 5.8 s | 8.7 s | 0 of 11 |
| Opus 5, fast mode | — | — | rate-limited: this account has a fast-mode limit of 0 tokens/min |
| Opus 5, thinking off + fast mode | 5.1 s | 6.4 s | 0 of 11 |
| **Sonnet 5** | **3.9 s** | **4.4 s** | 1 of 11 on the first run (see below), then 0 |
| Haiku 4.5 | 6.2 s | 10.3 s | read nothing from the blurry label; slower than Sonnet |

Output is only ~230 tokens per call, so the time is mostly the model
itself, not our prompt. Two dead ends were tried and removed from the code
to keep it explainable: disabling thinking (no gain) and fast mode (not
enabled for this account).

**The one accuracy miss.** On its first run Sonnet 5 returned
`GOVERNMENT WARNING:` for the fixture that prints `Government Warning:` in
title case — exactly the field that must be verbatim. Three reruns were
correct, so it was intermittent. The system prompt now carries an explicit
example ("if the label prints 'Government Warning:' in title case, return
exactly that — never convert it to capitals"), and Sonnet then returned the
title-case heading 13 times out of 13.

**Decision (yours): Sonnet 5 by default.** It meets the hard requirement
with about a second to spare for matching and rendering; Opus 5 did not on
any single call. Opus stays one environment variable away
(`EXTRACTION_MODEL=claude-opus-5`) for comparison or if accuracy on real
photos turns out to need it. This is a documented trade-off in the README.

**How to talk about it:** "I measured three models on every fixture. Opus
was the most accurate but never under five seconds; Sonnet met the budget
and, after I tightened the prompt on the one field that must be verbatim,
matched Opus on accuracy. Model choice is an environment variable, so it's
a one-line change if the trade-off shifts."

### 6. Confidence and the unreadable path

The blurry fixture came back with confidence 0.20–0.45 and an
`unreadableReason`, while still returning whatever the model could read.
The UI (Day 3) will treat `unreadableReason`, or confidence below 0.5, as
"We couldn't read this clearly — try a straighter, better-lit photo" and
withhold the verdict, per the plan's honest-failure rule.

### 7. Verified on AWS

After the push, Amplify rebuilt in about four minutes. A real fixture sent
to the live endpoint with `curl -F "image=@fixtures/labels/stones-throw-ok.png"`
returned a full, correct extraction in **3.9 s** end to end (status 200,
`model: claude-sonnet-5`), and a request with no file returned the 400 with
its plain-English message. That proves the key you set in Amplify's
environment is reaching the route handler through the `.env.production`
step in `amplify.yml`.

### Open items (end of Day 2)

- Day 3: implement the seven matchers and the single-label flow. ✅ see below.

---

## Day 3 — 2026-09-05 — Matching engine and the single-label screen

### 1. The matching engine — `src/lib/matchers/`

Split into small files so each idea is easy to point at:

| File | What it holds |
|---|---|
| `text.ts` | `normalize` (trim, collapse spaces, unify curly quotes, lowercase), `tokens`, `similarity` (Levenshtein edit distance turned into a 0–1 score), `wordDiff`, `tokenSetSimilarity` (Jaccard on word sets) |
| `units.ts` | `parseVolume` ("750 mL", "0.75 L", "12 FL OZ" → millilitres), `sameVolume` (1% tolerance, because unit conversions are never exact), `parseAbv` |
| `address.ts` | `parseAddress` splits "Name, Street, City, ST 12345" into parts; `normalizeStreet` maps Street/St, Avenue/Ave, Road/Rd, …; `stripRolePrefix` drops "Imported by", "Bottled by" |
| `warning.ts` | `STATUTORY_WARNING`, the exact text from 27 CFR 16.21; whitespace-only normalization; a helper that returns the heading *as printed* |
| `index.ts` | The seven matchers and the `RULES` constants (thresholds in one place so code and README can't disagree) |

**Why Levenshtein?** It's the simplest similarity measure to explain in an
interview ("how many single-character edits turn one string into the
other, divided by the longer length") and it's plenty for short label
strings. A library would have been faster to type but harder to defend.

**Each matcher's policy, as implemented:**

- **Brand name.** Equal after normalization → pass (the reason says
  "same name, different casing" if only the casing differed — that's
  Dave's "STONE'S THROW" example). Similarity ≥ 0.9 with no word
  differences → pass. Similarity ≥ 0.7, or the only difference is an
  extra/missing word → review, and the reason names the word. Otherwise fail.
- **Class/type.** Same words in the same order → pass. Same words,
  different order → review ("same words in a different order"). A word
  dropped or added with word-set similarity ≥ 0.5 → review, naming the
  word ("the label drops 'straight'… a missing qualifier can change the
  legal class"). Otherwise fail.
- **Alcohol content.** Within ±0.3 → pass (the reason cites TTB's
  tolerance when it isn't exact). Otherwise fail with the point
  difference. Absent on the label: beer → not applicable (federal rules
  don't require it on malt beverages); wine or spirits → review.
  Application blank → not applicable.
- **Net contents.** Both parse → compare in millilitres; equal within 1%
  → pass ("the same volume in different units" when the text differs);
  else fail showing both in mL. Either side unparseable → review.
- **Bottler name/address.** If both sides parse into name/street/city/
  state/ZIP: city, state, or ZIP differ → fail (the reason shows both
  places); company name similarity < 0.7 → fail; name ≥ 0.85 and street
  equal after abbreviation normalization → pass; otherwise review, saying
  whether it's the street or the name that's off. If either side can't be
  segmented, fall back to whole-line similarity (≥ 0.85 pass, ≥ 0.7
  review, else fail) and say so.
- **Country of origin.** Not an import → not applicable. Import with no
  country on the application → review (the application is incomplete).
  Import with nothing on the label → fail, suggesting "Product of X".
  Exact match after normalization → pass; anything else → fail.
- **Government warning.** Compared against the statute, not the
  application (applications don't carry the warning text). Absent → fail.
  Heading not exactly `GOVERNMENT WARNING:` in capitals → fail, quoting how
  it was printed. Whitespace-normalized text equal to the statute → pass,
  with a note that bold weight must be confirmed visually. Any other
  difference → fail, naming the added/missing words.

`src/lib/verdict.ts` runs all seven, takes the worst *applicable* status
as the overall recommendation, and decides when a label is **unreadable**:
the model gave an `unreadableReason`, or its confidence is under 0.5. In
that case no verdict is produced at all.

**Tests:** the 25 todo cases became real assertions in
`matchers.test.ts`, plus helper tests and `verdict.test.ts`. 52 tests
pass. Each test name is the plan's edge case, so the test file doubles as
the spec.

### 2. The review API — `POST /api/review`

Multipart form with `image` and `application` (a JSON string). The
application is validated with a zod schema in `application-schema.ts`, so
a blank brand name comes back as `brandName: Brand name is required`
rather than a crash. The route calls `extractLabel`, checks
`isUnreadable`, and returns either `{ status: "ok", verdict }` or
`{ status: "unreadable", reason, extraction }`. `durationMs` covers the
whole request, which is the number the 5-second rule is about.

### 3. The screen — `/single`

`src/app/single/page.tsx` is a server component that passes the sample
list to `ReviewSingle`, a client component ("use client") holding the
form state. One page, three numbered steps, as the plan's UX spec asks:

1. **The label photo** — a drop zone with a big "Choose a photo" button
   (every icon has a word), a preview once chosen.
2. **What the application says** — product type as three large toggle
   buttons, then the fields, with an "imported" checkbox that reveals
   country of origin.
3. **Compare** — one button, disabled until everything needed is
   present, with a sentence saying exactly what's still missing. While
   reviewing, a visible clock counts up ("Reading the label… 2.3 s") over
   a moving bar, because silence is what killed the last tool's trust.

**Try a sample** in the header loads any of the 11 fixtures into both the
form and the photo. The images are served from `public/samples/`
(`npm run samples:sync` copies them from `fixtures/`), and the
application JSON is imported at build time by `src/lib/samples.ts`.

The **verdict** replaces the form: a banner with the overall call
(colour + a ✓ ! ✗ glyph + the word), counts of pass/review/fail, the
photo on the left, and one card per field on the right with the status
word, the plain-English reason, and "On label" vs "Application" values.
A footer says "This is a recommendation. Nothing is approved or rejected
until you decide", with "Change details" (back to the form, data kept)
and "Review another label".

The **unreadable** state is its own screen: "We couldn't read this label
clearly", the model's reason, and a "Try a different photo" button. Nothing
is compared, so nothing is marked as a mismatch.

**Design choices.** Warm paper background, ink text, an oxblood accent;
Fraunces for headings and Public Sans (the typeface of U.S. government
sites) for everything else; 18 px base font; 52 px minimum button
height. Status is never colour alone. `globals.css` defines the palette as
Tailwind theme tokens and a few shared control classes.

### 4. Two bugs found while testing

- `next/font` refused Fraunces with both `axes` and a fixed `weight`
  list — Fraunces is a variable font, so `weight` must be omitted. The
  page rendered blank until this was fixed.
- After that crash the dev server's build cache was corrupt: the page's
  main JavaScript bundle 404'd, so React never hydrated and nothing was
  interactive even though the HTML looked right. Symptom to remember: a
  page that renders but ignores clicks. Fix: stop the dev server, delete
  `.next`, start again. Running `npm run build` while the dev server is up
  causes the same thing.

### 5. Verified in the browser

- **warning-lowercase** → overall Fail; six fields pass or N/A, government
  warning fails with "The heading is printed as 'Government Warning:'; it
  must read exactly 'GOVERNMENT WARNING:' in capital letters." Read in
  4.4 s.
- **blurry-unreadable** → the unreadable screen, no verdict.
- **class-qualifier-drop** → overall Needs review; the class/type card
  says the label drops 'straight'.

### Open items (end of Day 3)

- Day 4: batch mode. ✅ see below.
- Downscale large phone photos in the browser before upload. ✅ see below.

---

## Day 4 — 2026-09-05 — Client-side resize and batch mode

### 1. Shrinking photos in the browser — `src/lib/image-resize.ts`

You asked for a shared, canvas-based resize used by both upload paths, so
a 12-megapixel phone photo never leaves the phone at full size. How it
works, step by step:

1. `createImageBitmap(file, { imageOrientation: "from-image" })` decodes
   the image **and applies the EXIF orientation**, so a photo taken in
   portrait doesn't arrive sideways. If the browser can't decode the file
   (some HEIC cases), the original is returned untouched and the server's
   "unsupported type" message does the explaining.
2. `canPassThrough()` decides whether to skip the work: if the longest
   edge is already ≤ 1800 px, the file is ≤ 1.5 MB, and the type is one the
   server accepts, the original is used as-is. That keeps the small PNG
   fixtures lossless — re-encoding crisp synthetic text as JPEG would only
   make it worse.
3. Otherwise `fitWithin()` computes the largest size that fits in 1800 px
   on the long edge (pure function, unit-tested), the bitmap is drawn onto
   a canvas of that size over a white background (transparent PNG areas
   would go black in JPEG), and `canvas.toBlob("image/jpeg", 0.85)`
   produces the upload. The result is a `File` named `<original>.jpg`.
4. `describeResize()` builds the caption shown under the preview, e.g.
   "Resized from 4000×5600 (2.1 MB) to 1286×1800 (300 KB)".

Why 1800 px: the Claude API downsizes anything over ~1568 px on the long
edge anyway, so sending more is pure upload time. 1800 leaves a little
margin for the API's own resampling while keeping small label text legible.

Both the single-review drop zone and every batch worker call
`resizeImageForUpload()` before posting. The pure parts have tests in
`image-resize.test.ts`; the canvas part can't run in vitest's Node
environment, so it was verified in the browser by dropping a synthetic
4000×5600 JPEG onto the single-review page and reading the caption:
"Resized from 4000×5600 (724 KB) to 1286×1800 (124 KB)".

### 2. Batch mode — the plan's "feature Sarah named by name"

Everything about a batch runs in the browser except the per-label review
call. There is no queue, no worker, and no upload of the whole batch to a
server — the browser fans out one `POST /api/review` per label, six at a
time, and each of those is an independent serverless call on Amplify.
That's the "fewest moving parts" principle applied to 300 labels.

**Pure helpers, all tested** (`src/lib/csv.ts`, `src/lib/batch.ts`):

- `parseCsv` — a 40-line RFC 4180 parser (quoted fields, doubled quotes,
  embedded commas and newlines, CRLF, BOM). Written rather than installed
  so it can be explained line by line.
- `rowToApplication` — one CSV row → `Application`, using the same zod
  schema as the single form. Errors name the row: "Row 7 (abc): brandName:
  Brand name is required". `isImport` accepts yes/true/1.
- `pairImages` — matches rows to photos by **file-name stem**, case-
  insensitive and ignoring the extension, and reports rows with no photo
  and photos with no row *before* anything runs.
- `runPool` — a concurrency-capped pool: N lanes pull from a shared queue,
  results keep input order, and a callback fires as each finishes to drive
  the live count. Tested to prove it never exceeds the limit.
- `resultsToCsv` — the export: one row per label, overall result, time,
  one column per field's status, and a notes column listing every
  non-pass reason.

**The screen** (`/batch`, `BatchReview.tsx`), three steps then results:

1. **The applications** — download the CSV template
   (`public/batch-template.csv`, headers plus one example row) or choose a
   CSV. Skipped rows are listed under "Why rows were skipped".
2. **The label photos** — select or drop many at once.
3. **Check the pairing, then run** — three counts: labels ready, rows
   with no photo, photos with no row. The button reads "Review 11 labels"
   and estimates the time.

While running: a big "134 / 300 reviewed" count over a real progress bar,
elapsed seconds, and rows appearing in the table as each finishes — never
a spinner with no number. When done: filter chips by result (All, Fail,
Needs review, Unreadable, Error, Pass) with counts, a sort menu (worst
first, brand, ID, slowest), a table with a one-line "what to look at"
summary per label, click-through to the same field-by-field view as the
single flow, **Export CSV**, and "Start another batch".

"Try a sample batch" loads all 11 fixtures from
`public/samples/batch-sample.csv` plus their images. `npm run
samples:sync` (now `scripts/sync-samples.ts`) writes that CSV and the
template from the fixtures so they can't drift.

**Not built, on purpose:** zip upload. Selecting many files in the file
dialog covers the workflow; a zip would need a client-side unzip library
for a convenience gain. Noted as a possible follow-up.

**Verified in the browser:** "Try a sample batch" → 11 labels ready, 0
unpaired → "Review 11 labels" → finished in 8 s with 5 fail, 2 needs
review, 1 unreadable, 3 pass — exactly what `FIXTURE_MANIFEST.json`
predicts for those fixtures. Six at a time, each call 3.6–4.6 s.

### 3. How to talk about batch mode

"The browser does the fan-out: it pairs each spreadsheet row with a photo
by file name, shrinks the photo, and sends six reviews at a time to the
same endpoint the single flow uses. Results stream into a table as they
finish, with a live count, and export to CSV. There's no server-side
queue to operate, which is right for a prototype and easy to replace with
one later because the per-label API is already the unit of work."

### Open items (end of Day 4)

- Day 5 polish, Day 6 hardening + one stretch, Day 7 docs. ✅ all below.

---

## Day 5 — 2026-09-07 — Polish for Dave and for Sarah's mother

The plan's Day 5 is "make it survivable for Dave and legible for Sarah's
mother": accessibility, honest error states, sample paths on both flows,
and a responsive check. What changed and why:

### Accessibility

- **Skip link.** The first Tab press on any page reveals "Skip to main
  content", which jumps past the header. Every page's `<main>` now has
  `id="main"`.
- **Focus follows the work.** After a single review, keyboard and
  screen-reader focus moves to the verdict banner (or the unreadable /
  error box). After a batch finishes, focus moves to the results heading;
  opening a row moves it to the "Back to all results" button. Without
  this, a screen-reader user presses Compare and hears nothing.
- **Keyboard-reachable table rows.** Clicking a row was mouse-only. Each
  row now also has a "View" button with an `aria-label` naming the brand
  and id, so Tab + Enter works and a screen reader announces what opens.
- **Filter chips** declare `aria-pressed` so their state is announced, and
  are at least 44 px tall (touch-target minimum).
- **Hints tied to fields.** Every input's hint ("e.g. 750 mL or 12 FL OZ")
  is linked with `aria-describedby`, so it's read with the field, not as
  stray text.
- **Contrast.** The faint text colour was #8f8677 on cream — about 3:1,
  below the 4.5:1 minimum for small text. It's now #6f675a (about 4.6:1).
  All status colours were already above 4.5:1 on their backgrounds.
- **Already in place from Day 3, kept:** every icon has a word, status is
  colour + glyph + word, live regions on the progress states, reduced-
  motion respected, 18 px base type, 52 px buttons.

### Honest failure states

- `src/app/error.tsx` — if a page throws, the agent sees "This page hit a
  problem it couldn't recover from. Nothing you entered was saved or sent
  anywhere." with Try again / Back to the start. Never a stack trace.
- `src/app/not-found.tsx` — a wrong URL gets the two places the app can
  go, not a blank 404.
- The per-request messages from Days 2–4 (bad key, rate limit, unreadable
  photo, missing field, unsupported file) were re-read as a set for tone.

### Responsive check

Both screens were checked at 375 px wide (an iPhone) and 1280 px. On the
phone the "Try a sample" picker goes full-width, the three product-type
buttons stay on one row, and the results table scrolls sideways inside its
own frame rather than the page.

---

## Day 6 — 2026-09-07 — Harden what exists, then one stretch

### Fresh edge cases the code hadn't seen

Three fixtures were added *after* the matchers were written and deliberately
not tuned against:

| id | scenario | expected | result |
|---|---|---|---|
| `address-abbrev-ok` | "Mill Creek Road" printed as "Mill Creek Rd." | pass | pass |
| `import-with-origin-ok` | import with "Product of Italy" printed | pass | **fail on first run** |
| `brand-extra-word` | label says "Harbor Light Reserve", application "Harbor Light" | review | review |

**The bug.** For the Italian wine the model returned the country field as
`"Product of Italy"` — the whole phrase — and the matcher compared that
literally against the application's `"Italy"`. Two fixes, belt and braces:
the extraction prompt and schema now say "return just the country name
('Product of France' → 'France')", and `normalizeCountry()` in the matcher
strips "Product of / Made in / Produce of / Imported from" before
comparing. A unit test pins it. After the fix the fixture passes and the
model itself returns `"Italy"`.

This is exactly why the plan insists on fresh cases on Day 6: eleven
fixtures had passed cleanly for two days and the bug was still there.

### The full pass and the 5-second budget under load

"Try a sample batch" with all 14 fixtures, six at a time: **14 labels in
12 s** — 5 fail, 3 needs review, 1 unreadable, 5 pass, exactly matching
`FIXTURE_MANIFEST.json`. Individual calls ran 3.5–5.7 s with six in
flight, so the per-label budget holds under concurrency, not just in
isolation. The single flow's end-to-end time on the live site remains
~4.1–4.4 s.

### The one stretch: a printable compliance report

The plan's stretch list, ranked by impressiveness per hour, includes "PDF
compliance report export — one-click per-label PDF an agent could staple
to a physical file." That's the one built, because it costs nothing at
runtime and needs no new dependency:

- A print stylesheet in `globals.css` hides navigation, buttons, and the
  form, removes shadows and animation, keeps the status colours
  (`print-color-adjust: exact`), and prevents a field card from splitting
  across pages.
- The verdict view gains a print-only header — "Alcohol Verification App ·
  Label review report", the application/brand, the image file name, the
  date and time, and "Recommendation only — the reviewing agent decides."
- A **Print or save as PDF** button calls `window.print()`. Every modern
  browser's print dialog offers "Save as PDF", so there is no PDF library
  to ship or explain. It works from the single flow and from any batch row.

Not chosen: bounding boxes (needs coordinates from the model, and the
5-second budget has no room for a second call), image preprocessing (the
client-side resize already covers the cheap part), persistence (the plan
warns it eats the remaining budget).

### Production check

Every push deploys to Amplify. After this day's push, the live site was
checked from a clean session (curl, no cookies): home, `/single`, `/batch`,
the template CSV, the sample CSV, and a real `/api/review` call all return
correctly. See Day 7 for the final cold QA.

---

## Day 7 — 2026-09-07 — Docs and the final look

- The README was rewritten as the front door for a stranger: what it is,
  the live URL, a five-line quick start, how to try it (browser and curl),
  a short architecture section, the matching rules, how to run the tests,
  the full assumptions & trade-offs list, and what would come next.
- `docs/how-it-works.md` was brought up to date (print report,
  accessibility behaviours, country normalisation).
- This journal is the "how it got there"; the README is the "what it is".
- A final cold QA of the deployed URL is recorded at the end of this file.

### What I would do with more time

1. Zip upload for batch (client-side unzip) and a "download failures
   only" export.
2. Per-field confidence from the model, shown as a small bar on each card.
3. An on-prem or VPC-hosted vision model path for a real TTB deployment
   behind the firewall.
4. Bounding boxes: ask the model where it found each field and highlight
   it on hover.
5. A tiny persistence layer (reviewer, timestamp, decision) so the tool's
   recommendation and the agent's decision can be audited together.

---

## Final cold QA — 2026-09-07, deployed build `b1d7b18`

Run with `curl` from a session with no cookies, immediately after Amplify
finished the last deploy:

| Check | Result |
|---|---|
| `/`, `/single`, `/batch` | 200, correct page content |
| `/this-does-not-exist` | 404 with the friendly "nothing at this address" page |
| `/batch-template.csv`, `/samples/batch-sample.csv`, sample images | 200 |
| `POST /api/review` with the `import-with-origin-ok` fixture | 200, overall **pass**, all seven fields pass, country read as "Italy", 4.3 s server-side / 4.6 s round trip |
| `POST /api/review` with a text file | 400, "That file type isn't supported. Upload a JPEG, PNG, or WebP image." |

Then in a browser against the live URL: `/single` → sample
`brand-extra-word` → Compare → **Needs review** banner with focus on it,
the brand card explaining "the label adds 'reserve'", and the Print button
present.

Deliverables at submission: this repository (incremental commits, README,
docs, fixtures), the live URL above, and both flows reachable without
setup via their "try a sample" paths.
