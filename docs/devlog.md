# Build journal

A running log of everything done on this project, in order, with the
reasoning. Written so you can explain any step if asked. Newest entries at the
bottom. `docs/how-it-works.md` explains the *current* state of the app;
this file explains *how it got there*.

---

## Day 1 — 2026-09-03 — Setup

### 1. Understanding the brief

The starting point was the "Label Verification Build Plan" (now saved as
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
| **GitHub CLI (`gh`)** | Official command-line client for GitHub | Create the repo and push without touching the website. Installed with `brew install gh`. |
| **Python 3.13** (already present) | Installed from python.org, at `/Library/Frameworks/Python.framework` | The app's language |

**Logging in to GitHub.** `gh auth login --web` uses GitHub's *device flow*:
the terminal prints a one-time code, you paste it at github.com/login/device,
and GitHub hands the CLI a token. The token is stored in the macOS keychain.
This matters because you never typed a password into a terminal, and the
token has limited scopes (`repo`, `read:org`, `gist`).

### 3. Creating the repository

```bash
gh repo create alcohol-verification-app --private --source=. --remote=origin --push
```

That single command (a) created a private repo under your account, (b) added
it as the `origin` remote of the local git repo, and (c) pushed `main`.
"Remote" is git's name for a copy of the repo somewhere else; `origin` is the
conventional name for the main one.

The repo was first created as `old-tom-verify` (the plan's working title) and
renamed with `gh repo rename`. GitHub keeps a redirect from the old name.

### 4. A false start: the TypeScript scaffold

The plan specified Next.js + TypeScript, so the first scaffold used that. You
asked for Python instead, so the whole Next.js tree was deleted (`git rm`) and
rebuilt. The git history still shows those commits — that's fine and normal;
the history is honest about the change of direction. If asked: "The plan
suggested a JavaScript stack. I chose Python because it's the language I'm
strongest in, and the app's core, the matching engine, is pure logic where
language choice doesn't affect the user."

### 5. The Python project layout

```
alcohol-verification-app/
├── app/                    # the application package
│   ├── __init__.py         # makes `app` importable as a package
│   ├── main.py             # FastAPI app: routes for pages and JSON API
│   ├── config.py           # settings loaded from .env.local / environment
│   ├── models.py           # the data shapes everything else agrees on
│   ├── matchers/           # field-by-field comparison logic (Day 3)
│   ├── extract/            # the Claude vision call (Day 2)
│   ├── templates/          # HTML pages (Jinja2)
│   └── static/             # CSS (and later JS/images)
├── tests/                  # pytest tests
├── fixtures/               # sample applications + label images
├── docs/                   # this file, the build plan, how-it-works
├── requirements.txt        # runtime dependencies (what Render installs)
├── requirements-dev.txt    # runtime + test/lint tools (what you install locally)
├── pyproject.toml          # project metadata + ruff/pytest config
├── render.yaml             # deploy blueprint for Render
├── .python-version         # "3.13" — which Python this expects
├── .env.example            # documents the secrets; the real .env.local is git-ignored
└── .venv/                  # virtual environment (git-ignored, machine-local)
```

### 6. The virtual environment

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt
```

A **virtual environment** is a private copy of Python plus its own
`site-packages` folder, so this project's libraries don't collide with any
other project's. `.venv/bin/python` is the interpreter; `.venv/bin/pip`
installs into it. It's git-ignored because it's machine-specific and
rebuildable from `requirements*.txt` in seconds.

**Why two requirements files?** `requirements.txt` is the minimum needed to
*run* the app — Render installs exactly this. `requirements-dev.txt` starts
with `-r requirements.txt` and adds pytest, httpx (needed by FastAPI's test
client), and ruff. Production stays lean; developers get the tools.

**What each runtime dependency does:**

| Package | Role |
|---|---|
| `fastapi` | The web framework: turns Python functions into HTTP endpoints |
| `uvicorn` | The server that actually listens on a port and hands requests to FastAPI |
| `jinja2` | Template engine: HTML files with `{{ variables }}` and `{% blocks %}` |
| `python-multipart` | Lets FastAPI parse file uploads (needed for label images) |
| `pydantic` | Data validation: define a class, get parsing + type checking for free |
| `pydantic-settings` | Reads settings from environment variables and `.env` files into a pydantic class |
| `anthropic` | Official Claude SDK, used for the vision extraction call |
| `python-dotenv` | Loads `.env` files; pydantic-settings uses it under the hood |

### 7. `app/models.py` — the shared vocabulary

This is the most important file to understand, because every other module
imports from it.

- **`LabelField`** is a `StrEnum` of the seven fields TTB checks. Using an
  enum instead of loose strings means a typo like `"brand_nmae"` is an error
  at import time, not a silent bug.
- **`Application`** is what the applicant submitted. It stands in for COLA
  data (the brief says explicitly not to integrate with COLA).
- **`LabelExtraction`** is what the vision model read off the label. Every
  field is `Optional` (`str | None`) on purpose: "not found on the label" must
  be representable, distinct from an empty string. It also carries a
  `confidence` score and an `unreadable_reason` so a bad photo produces an
  honest "we couldn't read this", never a guess.
- **`FieldResult`** is one row of the verdict: the field, its `status`, what
  was expected, what was found, and a `reason` in plain English. The `reason`
  is the thing agents actually read.
- **`ReviewVerdict`** bundles the seven `FieldResult`s with an `overall`
  status and `duration_ms`, so every response records whether it met the
  5-second budget.
- **`FieldStatus`** is `Literal["pass", "review", "fail"]` — three values,
  enforced by the type. **`overall_status()`** picks the worst one across the
  applicable fields, skipping any marked `not_applicable` (e.g. country of
  origin on a domestic product).

All of these are pydantic `BaseModel`s. That gives us: validation when data
comes in (a string where a float belongs is rejected), `.model_dump()` to turn
them into JSON, and automatic OpenAPI docs at `/docs`.

### 8. `app/matchers/` — the comparison engine (stubbed)

One function per field, all with the same signature:
`(application, extraction) -> FieldResult`. Today each raises
`NotImplementedError`, but the *policy* for each is written in a comment,
straight from the plan's §03 table. The `MATCHERS` dict maps each
`LabelField` to its function, and `match_all()` runs them in order.

Design rules for this module, and why they matter in an interview:

- **Pure functions.** No network, no file I/O, no global state. Input in,
  result out. That's what makes them trivially testable.
- **Different tolerance per field.** Brand names are fuzzy ("STONE'S THROW"
  equals "Stone's Throw"), ABV allows ±0.3, but the government warning is
  exact because applicants try to sneak changes past reviewers. A single
  global "similarity threshold" would be wrong for at least one field.

### 9. `tests/` — what's tested and what's parked

- `test_models.py` — three real tests for `overall_status()`. They pass.
- `test_app.py` — uses FastAPI's `TestClient` to hit `/`, `/health`, and
  `/api/extract` without starting a server. They pass.
- `test_matchers.py` — 25 test cases, each named for a specific edge case from
  the plan (e.g. `test_title_case_heading_fails`), all marked
  `@pytest.mark.skip` until Day 3. This is deliberate: the test names *are*
  the spec, so implementing a matcher means turning its skips into asserts.

Run with `.venv/bin/pytest`. Today: **6 passed, 25 skipped**.

### 10. `app/main.py` — the web app

- `app = FastAPI(...)` creates the application object.
- `app.mount("/static", StaticFiles(...))` serves `app/static/` as files.
- `templates = Jinja2Templates(...)` points at `app/templates/`.
- `@app.get("/")` renders `index.html`. `@app.get("/health")` returns
  `{"status": "ok"}` — Render pings this to know the service is alive.
- `@app.post("/api/extract")` returns HTTP **501 Not Implemented** with a JSON
  error. The route exists now so the deployed URL has an API surface and the
  URL is fixed before the real implementation lands.

The functions are `async def` because FastAPI runs on an *asynchronous*
server (ASGI). That's what will let batch mode process ~8 labels
concurrently later without threads.

### 11. Templates and CSS

- `base.html` is the page shell: `<head>`, the stylesheet link, and the HTMX
  script tag. Every page `{% extends "base.html" %}` and fills the
  `content` block.
- `index.html` is the Day 1 placeholder with the two review modes disabled.
- `style.css` is hand-written, no framework. Large base font (18px), high
  contrast, and a small palette with named `--pass` / `--review` / `--fail`
  colours, matching the plan's "built for Sarah's mother" rule.
- **HTMX** is a small JS library that lets HTML elements make requests and
  swap in the response (`hx-post`, `hx-target`). It's loaded from a CDN but
  not used yet; it will drive the upload → verdict flow without writing a
  JavaScript app.

### 12. Configuration and secrets

`app/config.py` defines a `Settings` class (pydantic-settings). On startup it
reads `.env` then `.env.local`, then real environment variables, into typed
fields: `anthropic_api_key`, `verdict_budget_ms` (5000), `batch_concurrency`
(8). `.env.example` shows what to fill in; `.gitignore` blocks every `.env*`
file *except* `.env.example`, so a key can't be committed by accident. On
Render the key is set in the dashboard and arrives as an environment variable.

### 13. Linting and formatting

**ruff** is both a linter and a formatter. Config lives in `pyproject.toml`:
100-character lines, rules for errors (E/F), import order (I), modern syntax
(UP), and common bugs (B). `ruff check .` reports; `ruff format .` rewrites.
Both are clean as of this entry.

### 14. Deployment plan

`render.yaml` is a **blueprint**: when you import the repo on Render it reads
this file and creates a web service with `pip install -r requirements.txt` as
the build step and `uvicorn app.main:app --host 0.0.0.0 --port $PORT` as the
start command. `$PORT` is provided by Render. `ANTHROPIC_API_KEY` is marked
`sync: false`, meaning "prompt me for it in the dashboard, don't store it in
the repo". Still to do: the actual import, which needs your Render login.

### 15. Commits so far

```
03f02ac Rebuild scaffold in Python: FastAPI + Jinja2/HTMX, pytest, Render
73cf83d Rename project to Alcohol Verification App
f865aea Track .env.example and make vitest config ESM-clean   (TS era)
d9e2be4 Scaffold domain model, matcher stubs, API route...    (TS era)
9f3574a Add Anthropic SDK, zod, vitest, and env/tooling config (TS era)
0a4bf1c Initial commit from Create Next App                    (TS era)
```

Commits are small and descriptive on purpose: "committed incrementally" is a
graded deliverable.

### Open items after Day 1

- Import the repo on Render and add the API key.
- Generate 8–12 fixture label images with paired application JSON
  (`fixtures/README.md` lists the scenarios).
- Create `.env.local` with your Anthropic key before Day 2.
