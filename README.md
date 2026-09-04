# Alcohol Verification App

**Live:** https://main.dhvxptf4pufyq.amplifyapp.com/ (AWS Amplify Hosting, deploys from `main`)

AI-assisted alcohol-label verification for TTB compliance review. Give it what
the applicant submitted and a photo of the physical label; it tells an agent,
field by field, whether they agree — **Pass**, **Needs review**, or **Fail** —
with a plain-English reason for each. The agent makes the final call.

> Status: Day 1 scaffold. Placeholder UI, typed domain model, matcher and
> extraction stubs. See `docs/build-plan.md` for the full 7-day plan,
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
npm test        # matching-engine unit tests (vitest)
npm run lint
npm run build
```

## Approach

- **Next.js App Router + TypeScript + Tailwind** — one repo, one deploy target; API routes are the backend, so there is no second service to stand up.
- **One multimodal Claude call for extraction** (`src/lib/extract/`) with a strict JSON schema. A single structured-output call beats an OCR-then-NLP pipeline on both latency and accuracy against stylized label fonts, and it's one thing to time against the 5-second budget.
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

## Sample fixtures

`fixtures/` holds sample applications paired with label images by id, including
deliberate mismatch cases (casing-only brand difference, ABV off by 0.2 vs 1.0,
reworded and title-case warnings, address mismatch, import with no country of
origin). See `fixtures/README.md`.
