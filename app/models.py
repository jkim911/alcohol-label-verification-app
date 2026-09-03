"""Shared domain models.

The seven fields come from the TTB reference section of the brief; the
three-state result and per-field tolerance policy come from the interviews
(see docs/build-plan.md §01 and §03).
"""

from __future__ import annotations

from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, Field


class LabelField(StrEnum):
    """The seven label fields TTB agents verify."""

    BRAND_NAME = "brand_name"
    CLASS_TYPE = "class_type"
    ALCOHOL_CONTENT = "alcohol_content"
    NET_CONTENTS = "net_contents"
    BOTTLER_NAME_ADDRESS = "bottler_name_address"
    COUNTRY_OF_ORIGIN = "country_of_origin"
    GOVERNMENT_WARNING = "government_warning"


LABEL_FIELDS: tuple[LabelField, ...] = tuple(LabelField)

# Human-readable labels for the UI. Every icon gets a word next to it.
LABEL_FIELD_NAMES: dict[LabelField, str] = {
    LabelField.BRAND_NAME: "Brand name",
    LabelField.CLASS_TYPE: "Class / type",
    LabelField.ALCOHOL_CONTENT: "Alcohol content",
    LabelField.NET_CONTENTS: "Net contents",
    LabelField.BOTTLER_NAME_ADDRESS: "Bottler name & address",
    LabelField.COUNTRY_OF_ORIGIN: "Country of origin",
    LabelField.GOVERNMENT_WARNING: "Government warning",
}

ProductType = Literal["beer", "wine", "spirits"]

# Three states, never two — Dave's whole complaint was a binary tool.
FieldStatus = Literal["pass", "review", "fail"]

# Worst-first ordering used to roll fields up into an overall verdict.
STATUS_SEVERITY: dict[str, int] = {"pass": 0, "review": 1, "fail": 2}


class Application(BaseModel):
    """What the applicant submitted.

    Stands in for COLA application data; the prototype is standalone and
    never talks to COLA (Marcus Williams).
    """

    id: str = Field(description="Pairs a CSV row with a label image in batch mode.")
    product_type: ProductType
    brand_name: str
    class_type: str
    alcohol_content: float | None = Field(
        default=None, description="ABV as a percentage, e.g. 40 for '40% ALC/VOL'."
    )
    net_contents: str = Field(description="Free text as submitted, e.g. '750 mL' or '12 fl oz'.")
    bottler_name_address: str
    is_import: bool = Field(
        default=False, description="Country of origin is only checked when True."
    )
    country_of_origin: str | None = Field(default=None, description="Required when is_import.")


class LabelExtraction(BaseModel):
    """What the vision model read off the physical label.

    Every field is nullable: "not found" is its own state, never a guess.
    """

    brand_name: str | None = None
    class_type: str | None = None
    alcohol_content: float | None = Field(default=None, description="Percentage as printed.")
    net_contents: str | None = None
    bottler_name_address: str | None = None
    country_of_origin: str | None = None
    government_warning: str | None = Field(
        default=None, description="Verbatim warning text as printed, original casing."
    )
    confidence: float = Field(
        ge=0, le=1, description="Model's own read-quality signal. Low values surface as review."
    )
    unreadable_reason: str | None = Field(
        default=None, description="Set when the image was too poor to read; plain English."
    )


class FieldResult(BaseModel):
    """Outcome for one field, always with a one-line plain-English reason."""

    field: LabelField
    status: FieldStatus
    expected: str | None = Field(description="Value from the application, as displayed.")
    actual: str | None = Field(description="Value read from the label, as displayed.")
    reason: str = Field(
        description=(
            "Never a raw diff. e.g. \"Label says 'Stone's Throw'; application says "
            "'STONE'S THROW' — same name, different casing.\""
        )
    )
    not_applicable: bool = Field(
        default=False,
        description="True when the field does not apply (e.g. origin on a domestic product).",
    )


class ReviewVerdict(BaseModel):
    """The overall call for one label. The tool recommends; the agent decides."""

    application_id: str
    overall: FieldStatus = Field(description="Worst status among all applicable fields.")
    fields: list[FieldResult]
    extraction: LabelExtraction
    duration_ms: int = Field(description="Wall-clock ms from upload to verdict. Budget is 5000.")


def overall_status(fields: list[FieldResult]) -> FieldStatus:
    """Roll field results up to the label verdict: worst applicable status wins."""
    applicable = [f.status for f in fields if not f.not_applicable]
    if not applicable:
        return "pass"
    return max(applicable, key=lambda s: STATUS_SEVERITY[s])
