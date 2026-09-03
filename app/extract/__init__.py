"""Label extraction — Day 2.

One multimodal Claude call (model ``claude-opus-5``) with structured output
parsed straight into ``LabelExtraction``. No OCR-then-NLP pipeline: one hop,
one thing to time.

- Target: extraction alone comfortably under ~3s, leaving headroom under the 5s budget.
- Low-confidence / unreadable images return ``unreadable_reason``, never a guess.
- Log latency per call against every fixture in ``fixtures/``.
"""

from __future__ import annotations

from app.models import LabelExtraction


async def extract_label(image_bytes: bytes, media_type: str) -> LabelExtraction:
    raise NotImplementedError("Label extraction is implemented on Day 2.")
