# Alcohol Verification App

**Live:** https://main.dhvxptf4pufyq.amplifyapp.com/ (AWS Amplify Hosting, deploys from `main`)

AI-assisted alcohol-label verification for TTB compliance review. Give it what
the applicant submitted and a photo of the physical label; it tells an agent,
field by field, whether they agree — **Pass**, **Needs review**, or **Fail** —
with a plain-English reason for each. The agent makes the final call.

> Status: Day 2. Label extraction is live (`POST /api/extract`); the
> matching engine and the review UI are next. See `docs/build-plan.md` for the full 7-day plan,
> `docs/devlog.md` for a step-by-step journal of the build, and
> `docs/how-it-works.md` for how the app works under the hood.

## Setup & run

Requires Node 22 (`.nvmrc`) and npm.

```bash
npm install
cp .env.example .env.local   # add your ANTHROPIC_API_KEY
npm run dev                  # http://localhost:3000
```

Other scripts:

```bash
npm test                  # unit tests (vitest)
npm run lint
npm run build
npm run extract:fixtures  # read every fixture label with Claude and print latency
```

### Try the extraction endpoint

With the dev server running, send any fixture label (or your own photo):

```bash
curl -s -X POST -F "image=@fixtures/labels/stones-throw-ok.png" http://localhost:3000/api/extract | python3 -m json.tool
```

The same call works against the live deployment by swapping the host for
`https://main.dhvxptf4pufyq.amplifyapp.com`.

## Approach

- **Next.js App Router + TypeScript + Tailwind** — one repo, one deploy target; API routes are the backend, so there is no second service to stand up.
- **One multimodal Claude call for extraction** (`src/lib/extract/`) with a strict JSON schema (zod → structured output). A single call beats an OCR-then-NLP pipeline on both latency and accuracy against stylized label fonts, and it's one thing to time against the 5-second budget. Default model is `claude-sonnet-5` (~3.9 s median on the fixtures); `EXTRACTION_MODEL` switches it. `npm run extract:fixtures` times every fixture.
- **Pure-TypeScript matching engine** (`src/lib/matchers/`), one function per field, each with its own tolerance: fuzzy for brand/class/address, ±0.3 ABV, unit-normalized net contents, exact-only for country of origin (imports) and the government warning. Unit-tested, no network.
- **Batch mode** fans out client-side with a server-side concurrency cap (~8) — no queue infrastructure for a prototype.
- **No storage.** The prototype is stateless by design.
- **Deployed on AWS Amplify Hosting** from the `main` branch. Amplify builds the app with `amplify.yml`, serves static pages from CloudFront, and runs the API route handlers on Lambda.

## Assumptions & trade-offs

- **No COLA integration.** Application data is entered in a form, loaded from a sample, or uploaded as CSV. Standalone proof-of-concept, per the interviews.
- **Prototype-grade security.** No authentication and no persistence; nothing sensitive is stored. A production rollout would need auth, audit logging, and a data-retention policy.
- **External vision API.** Extraction calls a cloud model. A production deployment behind TTB's firewall would need an on-prem OCR/vision model or an approved API allowlist.
- **Government-warning bold weight is not detected.** Text, casing, and wording are checked exactly; typographic weight is flagged for manual check rather than guessed.
- **Poor-quality images** (skew, glare, low light) are out of MVP scope. The tool reports "couldn't read this clearly" rather than guessing.
- **Model choice favours latency.** Claude Opus 5 read every fixture correctly but averaged ~5.8 s per label, over the 5-second requirement; Claude Sonnet 5 averaged ~3.9 s and matched it on accuracy after a prompt adjustment. Sonnet is the default; Opus is one environment variable away.

## Sample fixtures

`fixtures/` holds 11 sample applications paired with label images by id, including
deliberate mismatch cases (casing-only brand difference, ABV off by 0.2 vs 1.0,
reworded and title-case warnings, address mismatch, import with no country of
origin) and one deliberately blurry label. See `fixtures/README.md`.
