# How it works (under the hood)

The current state of the app, explained from the moment a request arrives.
Updated whenever the architecture changes; see `docs/devlog.md` for history.

## The pieces

```
Browser ──HTTP──▶ uvicorn ──ASGI──▶ FastAPI app ──▶ route function
                                                     │
                                  ┌──────────────────┼──────────────────┐
                                  ▼                  ▼                  ▼
                            Jinja2 template     app.extract        app.matchers
                            (HTML page)         (Claude vision)    (pure Python)
                                                     │                  │
                                                     ▼                  ▼
                                              LabelExtraction ──▶ list[FieldResult]
                                                                        │
                                                                        ▼
                                                                  ReviewVerdict
```

- **uvicorn** is the server process. It opens a TCP port, speaks HTTP, and
  converts each request into an ASGI event.
- **ASGI** (Asynchronous Server Gateway Interface) is the contract between a
  Python async server and a framework. It's why route functions are
  `async def` and why one process can handle many slow API calls at once.
- **FastAPI** matches the URL + method to a decorated function, validates the
  inputs, calls the function, and serialises the return value.
- **Jinja2** turns a template plus a context dict into HTML.
- **pydantic models** (`app/models.py`) are the data contracts every layer
  shares.

## What happens on `GET /`

1. uvicorn receives the request and passes it to FastAPI.
2. FastAPI finds `home()` in `app/main.py`.
3. `home()` calls `templates.TemplateResponse(request, "index.html")`.
4. Jinja2 loads `index.html`, sees `{% extends "base.html" %}`, renders the
   shell and fills the `content` block.
5. The HTML references `/static/style.css`; the browser fetches it, and the
   `StaticFiles` mount serves the file from `app/static/`.

## What happens on `POST /api/extract` (today)

Returns HTTP 501 with `{"error": "Label extraction is not implemented yet."}`.
The route exists so the API's shape is fixed before Day 2.

## What will happen on `POST /api/extract` (Day 2 design)

1. The upload arrives as multipart form data (`python-multipart` parses it).
2. `app.extract.extract_label(image_bytes, media_type)` base64-encodes the
   image and sends one request to Claude (`claude-opus-5`) with the image and
   an instruction to read the seven fields. The SDK's `messages.parse` returns
   a `LabelExtraction` directly, so there's no hand-written JSON parsing.
3. The call is timed. The target is under ~3 s so the full verdict fits the
   5 s budget.
4. If the model reports low confidence, `unreadable_reason` is set and the UI
   shows "we couldn't read this clearly" instead of a verdict.

## What will happen on a full review (Day 3 design)

1. `Application` comes from the form (or a fixture, or a CSV row in batch).
2. `LabelExtraction` comes from the step above.
3. `app.matchers.match_all(application, extraction)` runs the seven matchers
   in `LabelField` order. Each returns a `FieldResult`.
4. `overall_status(fields)` takes the worst status among applicable fields.
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

`app/config.py` → `Settings` reads, in priority order: real environment
variables, then `.env.local`, then `.env`. Locally you put
`ANTHROPIC_API_KEY=...` in `.env.local` (git-ignored). On Render you set it in
the dashboard. The code never contains a key.

## How tests work

`pytest` discovers `tests/test_*.py`. `TestClient` (from Starlette, FastAPI's
foundation) drives the app in-process — no server, no network — so the app
tests run in milliseconds. Matcher tests are pure function calls.

## How deployment works

Render reads `render.yaml`, runs `pip install -r requirements.txt`, then
starts `uvicorn app.main:app` on the port it assigns. It polls `/health`;
if that stops returning 200 the deploy is marked failed. Every push to
`main` triggers a new deploy.

## Glossary

- **ABV** — alcohol by volume, the percentage on the label.
- **COLA** — Certificate of Label Approval, TTB's real application system. We mock its data; we don't integrate.
- **TTB** — Alcohol and Tobacco Tax and Trade Bureau, the agency whose agents are the users.
- **Endpoint / route** — a URL + HTTP method that maps to one Python function.
- **Fixture** — a sample input checked into the repo so anyone can test without their own data.
- **Fuzzy match** — comparing strings by similarity score rather than exact equality.
- **Multipart form** — the HTTP encoding browsers use to upload files.
- **Stub** — a placeholder function whose signature is final but whose body isn't written yet.
