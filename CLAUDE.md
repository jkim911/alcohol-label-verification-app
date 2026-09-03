@AGENTS.md

# Alcohol Verification App

AI-assisted alcohol-label verification for TTB compliance agents. A take-home
prototype built on a 7-day plan; the full spec is in `docs/build-plan.md` —
read §01 (hidden requirements) and §03 (matching rules) before touching the
matching engine or the UI.

## Stack

- Next.js 16 (App Router, `src/` dir) + TypeScript + Tailwind v4, npm, Node 22 (`.nvmrc`).
- Label extraction: one Claude vision call via `@anthropic-ai/sdk` with a zod schema (`src/lib/extract/`). Load the `claude-api` skill before writing SDK code.
- Matching engine: pure TypeScript in `src/lib/matchers/`, one function per field, tested with vitest (`npm test`).
- Deploy: Vercel from GitHub `main`. No database in the MVP.

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
- Matchers take `(application, extraction)` and return a `FieldResult`. No I/O in `src/lib/matchers/`.
- Fixtures: `fixtures/applications/<id>.json` paired with `fixtures/labels/<id>.*`.
- Secrets only in `.env.local` (git-ignored); `.env.example` documents them.
- Commit incrementally with clear messages — "committed incrementally" is a graded deliverable.
- Keep the README's Setup / Approach / Assumptions & trade-offs sections current as decisions are made.
