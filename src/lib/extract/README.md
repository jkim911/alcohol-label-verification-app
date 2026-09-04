# Label extraction

Day 2. One multimodal Claude call with a strict JSON schema (zod) covering all
seven fields in `src/lib/types.ts` → `LabelExtraction`. No OCR-then-NLP
pipeline: one hop, one thing to time.

- Target: extraction alone comfortably under ~3s, leaving headroom under the 5s budget.
- Low-confidence / unreadable images return `unreadableReason`, never a guess.
- Log latency per call against every fixture in `fixtures/`.
