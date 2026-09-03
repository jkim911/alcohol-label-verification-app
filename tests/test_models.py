from app.models import FieldResult, LabelField, overall_status


def _result(status: str, not_applicable: bool = False) -> FieldResult:
    return FieldResult(
        field=LabelField.BRAND_NAME,
        status=status,
        expected="x",
        actual="x",
        reason="test",
        not_applicable=not_applicable,
    )


def test_overall_is_worst_field_status():
    assert overall_status([_result("pass"), _result("review"), _result("pass")]) == "review"
    assert overall_status([_result("pass"), _result("fail"), _result("review")]) == "fail"


def test_not_applicable_fields_are_ignored():
    assert overall_status([_result("pass"), _result("fail", not_applicable=True)]) == "pass"


def test_all_pass():
    assert overall_status([_result("pass"), _result("pass")]) == "pass"
