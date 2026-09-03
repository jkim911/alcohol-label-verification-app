"""Matching engine: one pure function per label field.

Each field has its own tolerance policy (docs/build-plan.md §03). No
framework, no I/O, no network — this is where correctness is graded, so
keep it trivially unit-testable.

Every matcher takes (application, extraction) and returns a FieldResult with
a three-state status and a plain-English reason. Implemented on Day 3.
"""

from __future__ import annotations

from collections.abc import Callable

from app.models import Application, FieldResult, LabelExtraction, LabelField

Matcher = Callable[[Application, LabelExtraction], FieldResult]


def _not_implemented(field: LabelField) -> Matcher:
    def matcher(application: Application, extraction: LabelExtraction) -> FieldResult:
        raise NotImplementedError(f"Matcher for {field.value!r} is not implemented yet (Day 3).")

    matcher.__name__ = f"match_{field.value}"
    return matcher


# Fuzzy: normalized similarity ≥ 90% passes; 70–90% or extra/missing words → review.
match_brand_name: Matcher = _not_implemented(LabelField.BRAND_NAME)

# Fuzzy: token-set similarity ≥ 90% after normalization; reordered/dropped qualifier → review.
match_class_type: Matcher = _not_implemented(LabelField.CLASS_TYPE)

# Numeric: parsed % within ±0.3 ABV passes; absent where required and not exempt → review.
match_alcohol_content: Matcher = _not_implemented(LabelField.ALCOHOL_CONTENT)

# Numeric, unit-normalized: mL/L/fl oz to one unit, exact equivalence; unparseable → review.
match_net_contents: Matcher = _not_implemented(LabelField.NET_CONTENTS)

# Fuzzy, segment-aware: name ≥ 85%; city/state/ZIP exact; street may differ by abbreviation only.
match_bottler_name_address: Matcher = _not_implemented(LabelField.BOTTLER_NAME_ADDRESS)

# Exact, conditional: only checked when the application flags an import; otherwise N/A.
match_country_of_origin: Matcher = _not_implemented(LabelField.COUNTRY_OF_ORIGIN)

# Strict exact: whitespace normalized only; wording, punctuation, ALL-CAPS "GOVERNMENT WARNING:".
match_government_warning: Matcher = _not_implemented(LabelField.GOVERNMENT_WARNING)

MATCHERS: dict[LabelField, Matcher] = {
    LabelField.BRAND_NAME: match_brand_name,
    LabelField.CLASS_TYPE: match_class_type,
    LabelField.ALCOHOL_CONTENT: match_alcohol_content,
    LabelField.NET_CONTENTS: match_net_contents,
    LabelField.BOTTLER_NAME_ADDRESS: match_bottler_name_address,
    LabelField.COUNTRY_OF_ORIGIN: match_country_of_origin,
    LabelField.GOVERNMENT_WARNING: match_government_warning,
}


def match_all(application: Application, extraction: LabelExtraction) -> list[FieldResult]:
    """Run every matcher in field order."""
    return [MATCHERS[field](application, extraction) for field in LabelField]
