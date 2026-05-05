from io import BytesIO
from openpyxl import load_workbook
from excel_gen import generate_workbook

_HEADER = {
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
}

_MATERIALS = [
    {
        "sno": 1, "material_name": "ETC-3", "uom": "Kg",
        "standard_qty": "13.00", "charged_qty": "13.00",
        "ar_no": "EtC-3/00625", "weighing_eq_id": "EBLIPD001",
        "remarks": None,
        "performed_by_signed": True, "performed_by_date": "06/10/2025",
        "checked_by_signed": True, "checked_by_date": "06/10/2025",
        "flag": "", "confidence": "high",
    },
    {
        "sno": 2, "material_name": "DMF Lot-1", "uom": "L",
        "standard_qty": "3", "charged_qty": "3",
        "ar_no": "DMF/00425", "weighing_eq_id": "BSSCTB-01",
        "remarks": None,
        "performed_by_signed": True, "performed_by_date": "06/10/2025",
        "checked_by_signed": True, "checked_by_date": "06/10/2025",
        "flag": "", "confidence": "low",
    },
]


def test_workbook_has_two_sheets():
    wb = load_workbook(BytesIO(generate_workbook(_HEADER, _MATERIALS, [])))
    assert "BPR Header" in wb.sheetnames
    assert "Raw Materials" in wb.sheetnames


def test_header_sheet_contains_batch_no():
    wb = load_workbook(BytesIO(generate_workbook(_HEADER, _MATERIALS, [])))
    ws = wb["BPR Header"]
    values = [ws.cell(row=2, column=i).value for i in range(1, 30)]
    assert "ETC-4/00425" in values


def test_header_boolean_converted_to_yes_no():
    wb = load_workbook(BytesIO(generate_workbook(_HEADER, _MATERIALS, [])))
    ws = wb["BPR Header"]
    # Column 14 = "Prepared by PD Signed"
    assert ws.cell(row=2, column=14).value == "Yes"


def test_materials_sheet_has_correct_row_count():
    wb = load_workbook(BytesIO(generate_workbook(_HEADER, _MATERIALS, [])))
    ws = wb["Raw Materials"]
    assert ws.max_row == 3  # 1 header + 2 data rows


def test_low_confidence_row_is_yellow():
    wb = load_workbook(BytesIO(generate_workbook(_HEADER, _MATERIALS, [])))
    ws = wb["Raw Materials"]
    # Row 3 = DMF Lot-1 (confidence: low)
    fill = ws.cell(row=3, column=1).fill
    assert fill.fgColor.rgb == "00FFFF00"


def test_high_confidence_row_not_highlighted():
    wb = load_workbook(BytesIO(generate_workbook(_HEADER, _MATERIALS, [])))
    ws = wb["Raw Materials"]
    # Row 2 = ETC-3 (confidence: high)
    fill = ws.cell(row=2, column=1).fill
    assert fill.fgColor.rgb != "FFFF00"


def test_missing_required_field_highlighted_red():
    wb = load_workbook(BytesIO(generate_workbook(_HEADER, _MATERIALS, ["batch_no"])))
    ws = wb["BPR Header"]
    # batch_no = column 4
    fill = ws.cell(row=2, column=4).fill
    assert fill.fgColor.rgb == "00FF6B6B"


def test_header_row_is_bold():
    wb = load_workbook(BytesIO(generate_workbook(_HEADER, _MATERIALS, [])))
    ws = wb["BPR Header"]
    assert ws.cell(row=1, column=1).font.bold is True


def test_returns_bytes():
    result = generate_workbook(_HEADER, _MATERIALS, [])
    assert isinstance(result, bytes)
    assert len(result) > 0
