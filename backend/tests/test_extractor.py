import json
from unittest.mock import MagicMock
from extractor import extract_bpr

_MOCK_RESULT = {
    "header": {
        "product_name": "ETC-4 compound",
        "product_code": "ETC-4",
        "stage_code": "ETC-4",
        "batch_no": "ETC-4/00425",
        "batch_size": "13.00 Kg of ETC-3",
        "start_date": "06/10/2025",
        "start_time": "07:40",
        "end_date": "11/10/2025",
        "end_time": "13:05",
        "duration": "125/25 hrs",
        "bpr_checked_after_execution": "11/10/2025",
        "qa_issue_date": "29/09/2025",
        "qa_issue_time": "11:20",
        "prepared_by_pd_signed": True,
        "prepared_by_pd_date": "24/09/2025",
        "reviewed_by_pd_signed": True,
        "reviewed_by_pd_date": "24/09/2025",
        "reviewed_by_rd_signed": True,
        "reviewed_by_rd_date": "26/09/2025",
        "approved_by_qa_signed": True,
        "approved_by_qa_date": "24/09/2025",
        "form_no": "FM03/QA/SOP/005-01/27/08/2024",
        "effective_date": "24/09/2025",
    },
    "materials": [
        {
            "sno": 1, "material_name": "ETC-3", "uom": "Kg",
            "standard_qty": "13.00", "charged_qty": "13.00",
            "ar_no": "EtC-3/00625", "weighing_eq_id": "EBLIPD001",
            "remarks": None,
            "performed_by_signed": True, "performed_by_date": "06/10/2025",
            "checked_by_signed": True, "checked_by_date": "06/10/2025",
            "flag": "", "confidence": "high",
        }
    ],
}


def _mock_client(content: str) -> MagicMock:
    client = MagicMock()
    client.chat.completions.create.return_value = MagicMock(
        choices=[MagicMock(message=MagicMock(content=content))]
    )
    return client


def test_returns_header_and_materials():
    result = extract_bpr([b"fake_png"], client=_mock_client(json.dumps(_MOCK_RESULT)))
    assert "header" in result
    assert "materials" in result


def test_header_batch_no_correct():
    result = extract_bpr([b"fake_png"], client=_mock_client(json.dumps(_MOCK_RESULT)))
    assert result["header"]["batch_no"] == "ETC-4/00425"


def test_materials_count_correct():
    result = extract_bpr([b"fake_png"], client=_mock_client(json.dumps(_MOCK_RESULT)))
    assert len(result["materials"]) == 1


def test_strips_markdown_json_fence():
    fenced = f"```json\n{json.dumps(_MOCK_RESULT)}\n```"
    result = extract_bpr([b"fake_png"], client=_mock_client(fenced))
    assert result["header"]["product_code"] == "ETC-4"


def test_strips_plain_code_fence():
    fenced = f"```\n{json.dumps(_MOCK_RESULT)}\n```"
    result = extract_bpr([b"fake_png"], client=_mock_client(fenced))
    assert result["header"]["product_code"] == "ETC-4"


def test_retries_on_malformed_json_then_raises():
    bad_client = MagicMock()
    bad_client.chat.completions.create.return_value = MagicMock(
        choices=[MagicMock(message=MagicMock(content="not json at all"))]
    )
    import pytest
    with pytest.raises(ValueError, match="GPT-4o returned invalid JSON"):
        extract_bpr([b"fake_png"], client=bad_client)
    assert bad_client.chat.completions.create.call_count == 2
