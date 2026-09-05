# How it works (under the hood)

The current state of the app, explained from the moment a request arrives.
Updated whenever the architecture changes; see `docs/devlog.md` for history.

## The pieces

```
Browser ──HTTP──▶ Next.js server ──▶ App Router matches the URL
                                        │
                     ┌──────────────────┼──────────────────┐
                     ▼                  ▼                  ▼
               page.tsx            route.ts           src/lib/*
               (React → HTML)      (JSON API)         (plain TypeScript)
                                        │                  │
                                        ▼                  ▼
                                  lib/extract         lib/matchers
                                  (Claude vision)     (pure functions)
                                        │                  │
                                        ▼                  ▼
                                 LabelExtraction ──▶ FieldResult[] ──▶ ReviewVerdict
```

- **Next.js** is both the web framework and the server. In development
  `next dev` runs it locally; on AWS Amplify each dynamic route becomes a Lambda
  function.
- **App Router** means the folder structure under `src/app/` *is* the URL
  map: `src/app/page.tsx` → `/`, `src/app/api/extract/route.ts` → `/api/extract`.
- **React** components (`.tsx` files) describe the UI; Next.js renders them
  to HTML on the server and sends that to the browser.
- **`src/lib/`** is framework-free TypeScript: types, matchers, and the
  extraction call. It knows nothing about React or HTTP.

## What happens on `GET /`

1. The request reaches the Next.js server.
2. App Router resolves `/` to `src/app/page.tsx`, wrapped in
   `src/app/layout.tsx`.
3. Both are **server components**: they run on the server, produce HTML,
   and the HTML is sent to the browser. No JavaScript is needed for this
   page yet, so the build marks it *static* and pre-renders it once.
4. Tailwind classes in the JSX were compiled into a CSS file at build time;
   the browser loads that stylesheet.

## What happens on `POST /api/extract`

1. The browser (or `curl`, or the fixture script) sends a multipart form
   with an `image` file. `route.ts` reads it with `request.formData()`.
2. The route validates before spending money: missing file, unsupported
   type (only JPEG/PNG/WebP/GIF), or over 10 MB → HTTP 400 with a
   plain-English `error`.
3. `extractLabel()` in `src/lib/extract` base64-encodes the bytes and makes
   **one** call to Claude (`claude-sonnet-5` by default; `EXTRACTION_MODEL`
   overrides) with the image, a short system prompt of transcription rules,
   and a **structured-output schema** built from the zod
   `LabelExtractionSchema`. The API guarantees the reply matches the schema;
   the SDK's `parse()` hands back a typed object.
4. The call is timed. Typical: ~3.9 s median on the fixtures, which leaves
   room inside the 5-second verdict budget.
5. The route returns `{ extraction, durationMs, model, usage }`. If the
   model says the image is unreadable, `extraction.unreadableReason` is set
   and `confidence` is low; the UI shows "we couldn't read this" instead of
   a verdict.
6. Any failure becomes an `ExtractionError` with a plain-English message
   and a status (500 bad key, 503 rate-limited/unreachable, 422 refused,
   502 malformed). The underlying API error is logged on the server only.

The API key lives in `process.env.ANTHROPIC_API_KEY` on the server. Route
handlers never ship to the browser, so the key never does either.

## What happens on a full review (`POST /api/review`)

1. The `/single` page posts a multipart form: the image file and the
   application details as a JSON string.
2. The route validates the application with a zod schema
   (`src/lib/application-schema.ts`); a missing field returns a 400 with a
   named reason.
3. `extractLabel()` reads the label (same call as `/api/extract`).
4. `isUnreadable()` checks for an `unreadableReason` or confidence below
   0.5. If so, the response is `{ status: "unreadable", reason }` and the
   UI shows "We couldn't read this label clearly" — no verdict.
5. Otherwise `buildVerdict()` runs the seven matchers in `LABEL_FIELDS`
   order. Each returns a `FieldResult`; `overallStatus()` takes the worst
   among applicable fields (`fail` > `review` > `pass`), ignoring any marked
   `notApplicable`.
6. The response is `{ status: "ok", verdict }` with `durationMs` for the
   whole request. The UI renders the banner, the photo, and one card per
   field. The agent confirms or overrides; nothing is stored.

## The screen — `/single`

`src/components/ReviewSingle.tsx` owns the form state (a client
component). It has four phases: `input`, `reviewing` (visible timer),
`verdict`, and `unreadable`, plus an inline error banner. "Try a sample"
loads a fixture's JSON into the form and fetches its image from
`public/samples/` into a `File`, so the sample path and the real-upload
path are identical from that point on. `VerdictView.tsx` renders the
result; `StatusMark.tsx` maps each status to a colour, a glyph (✓ ! ✗ –),
and a word.

## The matching rules, one per field

| Field | How it's compared | Pass | Needs review | Fail |
|---|---|---|---|---|
| Brand name | Normalise (trim, collapse spaces, lowercase) then string similarity | ≥ 90% | 70–90%, or extra/missing words | otherwise |
| Class / type | Same, on the *set* of words | ≥ 90% | word order changed, qualifier dropped | otherwise |
| Alcohol content | Parse the number | within ±0.3 | absent where required | outside tolerance |
| Net contents | Parse number + unit, convert to mL | equal | unit unparseable | not equal |
| Bottler name / address | Name fuzzy; city/state/ZIP exact; street allows St/Street etc. | all segments OK | street differs beyond abbreviations | city/state/ZIP differ |
| Country of origin | Only if the application says it's an import | exact match | — | missing or different |
| Government warning | Collapse whitespace only; compare verbatim, incl. ALL-CAPS heading | identical | (bold weight can't be checked → note) | any wording/case change |

The key idea to explain: **each field gets the tolerance that matches how
TTB actually reasons about it.** Brand names vary in casing on real labels;
the health warning is statutory text and must not.

## Where settings and secrets come from

Next.js loads `.env.local` (git-ignored) into `process.env` on the server
at startup. Locally you put `ANTHROPIC_API_KEY=...` there (and optionally `EXTRACTION_MODEL`). On Amplify you set
it under App settings → Environment variables. The code never contains
a key, and `.gitignore` blocks every `.env*` file except `.env.example`.

## How tests work

`npm test` runs vitest, which finds `src/**/*.test.ts`. Matcher tests are
pure function calls: build an `Application` and a `LabelExtraction`, call
the matcher, assert on the `FieldResult`. No server, no network.

## How the build works

`npm run build` type-checks every file, compiles TypeScript and JSX to
JavaScript, compiles Tailwind to CSS, and decides per route whether it can
be pre-rendered (static) or must run on request (dynamic). The output table
it prints is a quick sanity check that every route exists.

## How deployment works (AWS Amplify Hosting)

Live at https://main.dhvxptf4pufyq.amplifyapp.com/ — the `main.` prefix is the branch name; Amplify would give another branch its own URL.

Amplify Hosting is AWS's git-connected hosting service. It's connected to
the GitHub repo; every push to `main` triggers a build following
`amplify.yml`:

1. **preBuild** — switch to Node 22 (matching `.nvmrc`) and run `npm ci`,
   which installs exactly what `package-lock.json` pins.
2. **build** — copy `ANTHROPIC_API_KEY` from Amplify's environment into
   `.env.production` (route handlers read it at request time), then
   `npm run build`.
3. **deploy** — Amplify uploads the `.next/` output. Static pages (like `/`)
   go to **CloudFront**, AWS's CDN. Route handlers (like `/api/extract`) run
   on **Lambda** functions that Amplify manages for you.

So the Day 1 architecture on AWS is: CloudFront in front, Lambda for
anything dynamic, no servers to patch. The first request to a cold Lambda
adds roughly a second; the 5-second budget accounts for that.

What Amplify is *not*: it isn't a container platform (that would be App
Runner or ECS) and it doesn't give you a VPC or a database. For this
prototype that's a feature — nothing to manage.

## Glossary

- **ABV** — alcohol by volume, the percentage on the label.
- **Amplify Hosting** — AWS's git-connected build-and-host service for web apps.
- **App Router** — Next.js's folder-based routing under `src/app/`.
- **CloudFront** — AWS's content delivery network; serves static files from edge locations.
- **Lambda** — AWS's serverless functions; code that runs on demand without a server you manage.
- **COLA** — Certificate of Label Approval, TTB's real application system. We mock its data; we don't integrate.
- **TTB** — Alcohol and Tobacco Tax and Trade Bureau, the agency whose agents are the users.
- **Route handler** — a `route.ts` file exporting `GET`/`POST` functions; Next.js's way to write a JSON API.
- **Server component** — a React component that runs on the server and sends HTML, not JavaScript, to the browser.
- **Fixture** — a sample input checked into the repo so anyone can test without their own data.
- **Structured output** — asking the model for JSON that must match a schema you supply, so the reply is validated data rather than free text.
- **Fuzzy match** — comparing strings by similarity score rather than exact equality.
- **Levenshtein distance** — the number of single-character edits needed to turn one string into another; divided by length it gives a 0–1 similarity.
- **Hydration** — React attaching its event handlers to server-rendered HTML in the browser; until it happens, the page looks right but ignores clicks.
- **Stub** — a placeholder function whose signature is final but whose body isn't written yet.
- **zod** — a library for declaring a data shape and validating unknown input against it.
