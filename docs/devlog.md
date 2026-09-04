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

### Open items

- Deploy to Vercel (needs your Vercel login) and add `ANTHROPIC_API_KEY` there.
- Generate 8–12 fixture label images with paired application JSON
  (`fixtures/README.md` lists the scenarios).
- Create `.env.local` with your Anthropic key before extraction work begins.
