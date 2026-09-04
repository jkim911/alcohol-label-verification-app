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
  `next dev` runs it locally; on Vercel each route becomes a serverless
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

## What happens on `POST /api/extract` (today)

App Router resolves the URL to `src/app/api/extract/route.ts` and calls its
exported `POST` function. It returns `Response.json({...}, {status: 501})`:
HTTP 501 Not Implemented with a JSON body. The route exists so the API's
shape is fixed before Day 2.

## What will happen on `POST /api/extract` (Day 2 design)

1. The upload arrives as multipart form data; the handler reads it with
   `await request.formData()`.
2. `src/lib/extract` base64-encodes the image and sends one request to
   Claude (`claude-opus-5`) via `@anthropic-ai/sdk`, with the image and an
   instruction to read the seven fields. The response is validated against
   a zod schema that mirrors `LabelExtraction`, so malformed output is
   rejected rather than trusted.
3. The call is timed. Target: under ~3 s so the full verdict fits the 5 s
   budget.
4. If the model reports low confidence, `unreadableReason` is set and the UI
   shows "we couldn't read this clearly" instead of a verdict.

The API key lives in `process.env.ANTHROPIC_API_KEY` on the server. Route
handlers never ship to the browser, so the key never does either.

## What will happen on a full review (Day 3 design)

1. `Application` comes from the form (or a fixture, or a CSV row in batch).
2. `LabelExtraction` comes from the step above.
3. Each matcher in `MATCHERS` runs in `LABEL_FIELDS` order and returns a
   `FieldResult`.
4. The overall status is the worst among applicable fields
   (`fail` > `review` > `pass`), skipping any marked `notApplicable`.
5. The `ReviewVerdict` is rendered as a checklist: icon + word + reason per
   field, and a banner with the overall call. The agent confirms or overrides.

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
at startup. Locally you put `ANTHROPIC_API_KEY=...` there. On Vercel you set
it under Project → Settings → Environment Variables. The code never contains
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

## How deployment will work

Vercel connects to the GitHub repo. Every push to `main` triggers a build
with the same `npm run build`; pages are served from a CDN and route
handlers run as serverless functions. Preview deployments are created for
other branches automatically.

## Glossary

- **ABV** — alcohol by volume, the percentage on the label.
- **App Router** — Next.js's folder-based routing under `src/app/`.
- **COLA** — Certificate of Label Approval, TTB's real application system. We mock its data; we don't integrate.
- **TTB** — Alcohol and Tobacco Tax and Trade Bureau, the agency whose agents are the users.
- **Route handler** — a `route.ts` file exporting `GET`/`POST` functions; Next.js's way to write a JSON API.
- **Server component** — a React component that runs on the server and sends HTML, not JavaScript, to the browser.
- **Fixture** — a sample input checked into the repo so anyone can test without their own data.
- **Fuzzy match** — comparing strings by similarity score rather than exact equality.
- **Stub** — a placeholder function whose signature is final but whose body isn't written yet.
- **zod** — a library for declaring a data shape and validating unknown input against it.
