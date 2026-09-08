@AGENTS.md

# Alcohol Verification App

AI-assisted alcohol-label verification for TTB compliance agents. A take-home
prototype built on a 7-day plan (all seven days delivered as of 2026-09-07); the full spec is in `docs/build-plan.md` —
read §01 (hidden requirements) and §03 (matching rules) before touching the
matching engine or the UI.

## Stack

- Next.js 15 (App Router, `src/` dir) + TypeScript + Tailwind v4, npm, Node 22 (`.nvmrc`). Pinned to 15, not 16, because AWS Amplify Hosting officially supports Next.js 12–15 — don't upgrade without checking Amplify's support page.
- Label extraction: one Claude vision call via `@anthropic-ai/sdk` with a zod schema (`src/lib/extract/`). Load the `claude-api` skill before writing SDK code.
- Matching engine: pure TypeScript in `src/lib/matchers/`, one function per field, tested with vitest (`npm test`).
- Deploy: AWS Amplify Hosting from GitHub `main` (`amplify.yml`). No database in the MVP.

## Non-negotiables (from the interviews)

- Upload → verdict in under 5 seconds. Time every extraction call.
- Three result states, never two: `pass` | `review` | `fail`. Overall = worst field.
- Every non-pass field carries a one-line plain-English reason, never a raw diff.
- Government warning is strict-exact (statutory text, ALL CAPS "GOVERNMENT WARNING:"); brand/class/address are fuzzy; ABV is ±0.3; country of origin only for imports.
- UI for the least tech-comfortable user: every icon has a word, color is paired with shape (✓ ! ✗), no nested menus, two clicks to any answer.
- The tool recommends; the agent decides. Nothing auto-rejects.
- Poor-quality images: honest "we couldn't read this" state, never a silent wrong verdict.

## Conventions

- Shared types live in `src/lib/types.ts`; don't redefine field lists elsewhere — use `LABEL_FIELDS`.
- Visual language (2026-09-08): clean compliance SaaS. Public Sans only (no display serif), slate/white tokens with one blue accent (`@theme` in `globals.css`), 0.5rem radii, 1px borders, subtle shadows, 150ms opacity fades only where they accompany a focus move. Icons are `lucide-react` — never emoji — always `aria-hidden` beside a text label. Status = colour + icon + word. Keep every colour pair ≥ 4.5:1.
- Matchers take `(application, extraction)` and return a `FieldResult`. No I/O in `src/lib/matchers/`.
- Fixtures: `fixtures/applications/<id>.json` paired with `fixtures/labels/<id>.*`.
- Secrets only in `.env.local` (git-ignored); `.env.example` documents them.
- Samples for the UI: `fixtures/` is the source; run `npm run samples:sync` after adding a fixture so `public/samples/` (images + batch-sample.csv), `public/batch-template.csv`, and `src/lib/samples.ts` stay in step.
- Every browser upload path must go through `resizeImageForUpload` (src/lib/image-resize.ts) before posting.
- Don't run `npm run build` while the dev server is running — it corrupts the dev cache (page renders but isn't interactive). Stop the server, build, `rm -rf .next`, restart.
- Commit incrementally with clear messages — "committed incrementally" is a graded deliverable.
- Keep the README's Setup / Approach / Assumptions & trade-offs sections current as decisions are made.
- **Documentation for the author is mandatory.** The user needs to explain every part of this project themselves. At the end of every working session, append a dated entry to `docs/devlog.md` covering what was done and *why*, in plain language with the reasoning, and update `docs/how-it-works.md` whenever the architecture or request flow changes. Explain concepts (not just steps) the first time they appear.
