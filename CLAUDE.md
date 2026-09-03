# Alcohol Verification App

AI-assisted alcohol-label verification for TTB compliance agents. A take-home
prototype built on a 7-day plan; the full spec is in `docs/build-plan.md` —
read §01 (hidden requirements) and §03 (matching rules) before touching the
matching engine or the UI.

## Stack

- Python 3.13 (`.python-version`), FastAPI + Jinja2 templates + HTMX, served by uvicorn. One service, no build step.
- Virtualenv at `.venv/`; install with `pip install -r requirements-dev.txt`. Run with `.venv/bin/uvicorn app.main:app --reload`.
- Label extraction: one Claude vision call via the `anthropic` SDK (1.x) with `client.messages.parse` into the `LabelExtraction` pydantic model (`app/extract/`). Model: `claude-opus-5`. Load the `claude-api` skill before writing SDK code.
- Matching engine: pure Python in `app/matchers/`, one function per field, tested with pytest (`.venv/bin/pytest`).
- Lint: `ruff check .` (config in `pyproject.toml`).
- Deploy: Render from GitHub `main` via `render.yaml`. No database in the MVP.

## Non-negotiables (from the interviews)

- Upload → verdict in under 5 seconds. Time every extraction call.
- Three result states, never two: `pass` | `review` | `fail`. Overall = worst field (`app.models.overall_status`).
- Every non-pass field carries a one-line plain-English reason, never a raw diff.
- Government warning is strict-exact (statutory text, ALL CAPS "GOVERNMENT WARNING:"); brand/class/address are fuzzy; ABV is ±0.3; country of origin only for imports.
- UI for the least tech-comfortable user: every icon has a word, color is paired with shape (✓ ! ✗), no nested menus, two clicks to any answer.
- The tool recommends; the agent decides. Nothing auto-rejects.
- Poor-quality images: honest "we couldn't read this" state, never a silent wrong verdict.

## Conventions

- Shared models live in `app/models.py`; don't redefine field lists elsewhere — iterate `LabelField`.
- Matchers take `(application, extraction)` and return a `FieldResult`. No I/O in `app/matchers/`.
- Pages are Jinja2 templates in `app/templates/`, styled by `app/static/style.css` (no CSS framework, no bundler). HTMX for progressive interactivity.
- Fixtures: `fixtures/applications/<id>.json` paired with `fixtures/labels/<id>.*`.
- Secrets only in `.env.local` (git-ignored, read by `app/config.py`); `.env.example` documents them.
- Commit incrementally with clear messages — "committed incrementally" is a graded deliverable.
- Keep the README's Setup / Approach / Assumptions & trade-offs sections current as decisions are made.
- **Documentation for the author is mandatory.** The user needs to explain every part of this project themselves. At the end of every working session, append a dated entry to `docs/devlog.md` covering what was done and *why*, in plain language with the reasoning, and update `docs/how-it-works.md` whenever the architecture or request flow changes. Explain concepts (not just steps) the first time they appear.
