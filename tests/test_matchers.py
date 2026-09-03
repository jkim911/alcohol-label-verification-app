"""Named edge cases from docs/build-plan.md §03.

Each is skipped until its matcher lands on Day 3 — turn them into real
assertions as you implement.
"""

import pytest

TODO = pytest.mark.skip(reason="matcher not implemented yet (Day 3)")


class TestBrandNameFuzzy:
    @TODO
    def test_casing_only_difference_passes(self): ...  # "STONE'S THROW" vs "Stone's Throw"

    @TODO
    def test_extra_whitespace_passes(self): ...

    @TODO
    def test_missing_word_needs_review(self): ...  # "Stone's Throw Reserve" vs "Stone's Throw"

    @TODO
    def test_different_brand_fails(self): ...


class TestClassTypeTokenSet:
    @TODO
    def test_reordered_words_need_review(self): ...

    @TODO
    def test_dropped_qualifier_needs_review(self): ...  # "Straight" missing

    @TODO
    def test_identical_after_normalization_passes(self): ...


class TestAlcoholContentTolerance:
    @TODO
    def test_within_0_3_passes(self): ...  # 40.0 vs 40.2

    @TODO
    def test_off_by_1_fails(self): ...  # 40.0 vs 41.0

    @TODO
    def test_absent_on_spirits_needs_review(self): ...

    @TODO
    def test_absent_on_exempt_type_is_not_applicable(self): ...


class TestNetContentsUnits:
    @TODO
    def test_case_and_spacing_passes(self): ...  # "750 mL" vs "750ml"

    @TODO
    def test_liters_to_milliliters_passes(self): ...  # "750 mL" vs "0.75 L"

    @TODO
    def test_fl_oz_to_ml_within_rounding_passes(self): ...  # "12 fl oz" vs "355 mL"

    @TODO
    def test_unparseable_unit_needs_review(self): ...


class TestBottlerNameAddress:
    @TODO
    def test_common_street_abbreviation_passes(self): ...  # St vs Street

    @TODO
    def test_different_city_or_zip_fails(self): ...

    @TODO
    def test_street_differs_beyond_abbreviation_needs_review(self): ...


class TestCountryOfOrigin:
    @TODO
    def test_domestic_is_not_applicable(self): ...

    @TODO
    def test_import_missing_country_fails(self): ...

    @TODO
    def test_import_exact_match_passes(self): ...


class TestGovernmentWarningStrict:
    @TODO
    def test_line_break_differences_pass(self): ...

    @TODO
    def test_title_case_heading_fails(self): ...  # "Government Warning:" must be ALL CAPS

    @TODO
    def test_reworded_fails(self): ...

    @TODO
    def test_absent_fails(self): ...
