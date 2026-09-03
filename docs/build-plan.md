# Old Tom Verify — Build Plan (7 days)

Source: the "Label Verification Build Plan" artifact. Reference this while
implementing. Hard numbers: **<5s** result latency, **200–300** labels per
batch, **7** fields per label, **7 days** including docs and deploy.

## 00 · Mission

Given what an applicant submitted and what's printed on the physical label,
tell a compliance agent — in one glance — whether they agree.

Application data → Label image → Extraction (one fast vision call) → Field
matching (one tolerance rule per field) → Verdict (Pass / Needs review / Fail,
with a plain-English reason per field).

The brief's "Technical Requirements" says nothing concrete on purpose. The
real spec is in four interview transcripts; §01 pulls it out. "Attention to
requirements" is a named grading criterion.

## 01 · Hidden requirements (acceptance criteria)

Cite these back in the README's assumptions section.

| # | Requirement | Source |
|---|-------------|--------|
| 1 | **Sub-5-second response, non-negotiable.** "If we can't get results back in about 5 seconds, nobody's going to use it." The scanning-vendor pilot died at 30–40s. | Sarah Chen |
| 2 | **Interface for the least tech-comfortable user.** "Something my mother could figure out… clean, obvious, no hunting for buttons." Half the review team is over 50. | Sarah Chen |
| 3 | **Batch upload for 200–300 labels.** A named, wanted feature, not a stretch goal. | Sarah Chen |
| 4 | **Standalone prototype — no COLA integration.** Mock the application-data input. | Marcus Williams |
| 5 | **Prototype-grade security is fine — say so explicitly.** No auth/PII handling required; document as a production gap. | Marcus Williams |
| 6 | **Fuzzy tolerance on most fields.** "STONE'S THROW" vs "Stone's Throw" is "technically a mismatch… but obviously the same thing. You need judgment." | Dave Morrison |
| 7 | **Government warning must be exact.** Word-for-word, ALL CAPS, "GOVERNMENT WARNING:" bold. Applicants "try to get creative… smaller font, different wording, burying it in tiny text." | Jenny Park |
| 8 | **Poor-quality images out of MVP scope, but a named stretch.** Skew, bad lighting, glare. | Jenny Park |
| 9 | **Seven label fields, not three.** Brand name, class/type, ABV (with wine/beer exceptions), net contents, bottler name/address, country of origin (imports only), government warning. | TTB reference |

## 02 · Architecture & stack

Fewest moving parts to deploy; fewest network hops between upload and verdict.

| Concern | Choice | Why |
|---------|--------|-----|
| Frontend + API | Next.js (App Router) + TypeScript + Tailwind | One repo, one deploy target; API routes are the backend. |
| Label extraction | One multimodal LLM call (Claude) with a JSON-schema prompt | Beats OCR-then-NLP on latency and accuracy against stylized fonts; one thing to time. |
| Matching engine | Pure TypeScript, one matcher per field, unit-tested | Zero network cost, deterministic; where correctness is graded. |
| Batch processing | Client-triggered fan-out, server concurrency cap ~8 | No queue/worker infra; a capped promise pool avoids rate limits. |
| Storage | None for MVP | Stateless is a feature here. |
| Deploy | Vercel from GitHub `main` | Push-to-deploy; deploy a placeholder on Day 1. |

Marcus's firewall story is context for a future production rollout, not a
constraint on this prototype. Use the cloud vision API and name the dependency
as a documented trade-off.

## 03 · Data & matching rules

One field, one comparison strategy. Three states, never two. Overall verdict
is the worst field status. Every non-pass field ships a one-line plain-English
reason, never a raw diff.

| Field | Strategy | Pass condition | Needs review |
|-------|----------|----------------|--------------|
| Brand name | Fuzzy | Normalized (trim, collapse whitespace, case-fold) similarity ≥ 90%. "STONE'S THROW" = "Stone's Throw". | 70–90% similarity, or extra/missing words |
| Class / type | Fuzzy | Token-set similarity ≥ 90% after normalization | Word order changed, or a qualifier added/dropped ("Straight" missing) |
| Alcohol content | Numeric ± tolerance | Parsed % within ±0.3 ABV (mirrors TTB's labeling tolerance) | Absent on label where the application requires it and the product type isn't exempt |
| Net contents | Numeric, unit-normalized | mL/L/fl oz converted to one unit, exact numeric equivalence | Unit present but unparseable |
| Bottler name / address | Fuzzy, segment-aware | Name similarity ≥ 85%; city/state/ZIP exact even if street abbreviation differs | Street differs beyond common abbreviation set (St/Street, Ave/Avenue) |
| Country of origin | Exact (conditional) | Required and exact only when the application flags an import; otherwise N/A | — |
| Government warning | Strict exact | Whitespace/line-break normalized only; case, wording, punctuation must match the statutory text verbatim; "GOVERNMENT WARNING:" ALL CAPS | Bold-weight detection is a documented limitation — flag for manual check, don't guess |

## 04 · UX spec

Design for Sarah's mother, not for Jenny. Two flows, each ≤ 3 screens; every
screen answers one question.

**Single-label review**
1. Upload: one large drop zone for the label photo + a plain form for the application fields (or "Load sample application").
2. Compare: one big button, disabled until both inputs are present.
3. Verdict: image left, field-by-field checklist right with status icons and a one-line reason each; a large banner states the overall call.

**Batch review**
1. Upload: downloadable CSV template for application data + multi-file/zip drop for images, paired by an ID column.
2. Processing: progress bar with a live count ("134 / 300 reviewed") — never a spinner with no number.
3. Results: sortable/filterable table (status, brand, date); click a row for the single-label detail view; one-click CSV export.

Rules:
- **No icon without a label.** Every button pairs a word with its icon.
- **Color plus shape.** Pass/review/fail read by ✓ ! ✗ as well as color.
- **Agent decides, tool recommends.** Nothing auto-rejects.
- **Honest failure states.** Blurry upload → "We couldn't read this clearly — try a straighter, better-lit photo."
- **Two clicks to any answer.** Home → upload → result. No settings, no nested menus.

## 05 · Roadmap

Deploy on Day 1, not Day 7. Assume ~4–6 focused hours/day.

| Day | Theme | Work | Ship |
|-----|-------|------|------|
| 1 | Setup | Init Next.js + TS + Tailwind; connect Vercel, deploy placeholder. Define shared types (Application, LabelExtraction, FieldResult, ReviewVerdict). Generate 8–12 sample label images across beer/wine/spirits with paired application JSON, including deliberate mismatches (casing, wrong ABV, reworded warning, lowercase warning, address mismatch, missing origin on an import). | Live placeholder URL + fixture set |
| 2 | Extraction | Vision call with strict JSON-schema prompt for all seven fields; `/api/extract`; test against every fixture and log latency; tune until extraction is comfortably under ~3s; unreadable/low-confidence as its own state. | Extraction endpoint, timed against every fixture |
| 3 | Matching + single flow | Each matcher from §03 as a pure testable function; unit-test edge cases by name; single-review UI end to end. | A real label in, a real verdict out |
| 4 | Batch mode | CSV template + parser; multi-file/zip upload paired by ID; concurrency-capped processing with live count; results dashboard with filter/sort, drill-down, CSV export. | 300-row CSV in, full results table out |
| 5 | Polish | Accessibility pass (type scale, contrast, icon+label, touch targets); plain-English error states with a next action; "Try a sample label" on both flows; responsive check. | A version you could hand to Sarah's mother |
| 6 | Test, deploy, one stretch | Full manual pass across fixtures plus 2–3 fresh edge cases; confirm 5s budget under a real batch; promote to production; verify from incognito. Pick exactly one §06 item if time remains. | Production URL, verified cold |
| 7 | Docs + buffer | README: setup, approach, assumptions & trade-offs (no COLA, prototype security, external vision API vs. firewall, warning-boldness unimplemented); optional GIF of both flows; final cold-browser QA; submit. | Repo + README + deployed URL |

## 06 · Stretch goals (pick one, only after the core is solid)

1. **Bounding-box highlight** on the label image per result row.
2. **Basic image preprocessing** for angle/glare (client-side deskew, contrast); reject clearly if confidence stays low.
3. **Confidence scores** surfaced per field in the UI.
4. **PDF compliance report** export per label.
5. **Lightweight history/persistence** — only with real slack on Day 6.

## 07 · Deliverables

**Source repository**
- All source, committed incrementally (not one final commit).
- README with setup + local run instructions; Approach; Assumptions & trade-offs; sample fixtures included.

**Deployed application**
- Live URL verified from a fresh/incognito session.
- Both single and batch flows reachable without setup.
- A "try a sample" path.
- Graceful behavior if the vision API is slow or rate-limited.

> "A working core application with clean code is preferred over ambitious but
> incomplete features. Document any trade-offs or limitations." — the brief.
