from io import BytesIO
from typing import List

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill
from openpyxl.utils import get_column_letter

_YELLOW = PatternFill("solid", fgColor="FFFF00")
_RED = PatternFill("solid", fgColor="FF6B6B")
_BOLD = Font(bold=True)

_HEADER_COLUMNS = [
    ("product_name", "Product Name"),
    ("product_code", "Product Code"),
    ("stage_code", "Stage Code"),
    ("batch_no", "Batch No"),
    ("batch_size", "Batch Size"),
    ("start_date", "Start Date"),
    ("start_time", "Start Time"),
    ("end_date", "End Date"),
    ("end_time", "End Time"),
    ("duration", "Duration"),
    ("bpr_checked_after_execution", "BPR Checked After Execution"),
    ("qa_issue_date", "QA Issue Date"),
    ("qa_issue_time", "QA Issue Time"),
    ("prepared_by_pd_signed", "Prepared by PD Signed"),
    ("prepared_by_pd_date", "Prepared by PD Date"),
    ("reviewed_by_pd_signed", "Reviewed by PD Signed"),
    ("reviewed_by_pd_date", "Reviewed by PD Date"),
    ("reviewed_by_rd_signed", "Reviewed by R&D Signed"),
    ("reviewed_by_rd_date", "Reviewed by R&D Date"),
    ("approved_by_qa_signed", "Approved by QA Signed"),
    ("approved_by_qa_date", "Approved by QA Date"),
    ("form_no", "Form No"),
    ("effective_date", "Effective Date"),
]

_MATERIAL_COLUMNS = [
    ("sno", "S.No"),
    ("material_name", "Material Name / Code"),
    ("uom", "UOM"),
    ("standard_qty", "Standard Quantity"),
    ("charged_qty", "Charged Quantity"),
    ("ar_no", "AR No. / In-house B.No."),
    ("weighing_eq_id", "Weighing Eq. ID No."),
    ("remarks", "Remarks"),
    ("performed_by_signed", "Performed By Signed"),
    ("performed_by_date", "Performed By Date"),
    ("checked_by_signed", "Checked By Signed"),
    ("checked_by_date", "Checked By Date"),
    ("flag", "Flag"),
    ("confidence", "Confidence"),
]


def _write_bold_header(ws, labels: List[str]) -> None:
    for col_idx, label in enumerate(labels, 1):
        cell = ws.cell(row=1, column=col_idx, value=label)
        cell.font = _BOLD


def _auto_fit_columns(ws) -> None:
    for col in ws.columns:
        max_len = max((len(str(c.value or "")) for c in col), default=8)
        ws.column_dimensions[get_column_letter(col[0].column)].width = min(max_len + 4, 60)


def _bool_to_str(val):
    if isinstance(val, bool):
        return "Yes" if val else "No"
    return val


def generate_workbook(header: dict, materials: List[dict], missing_fields: List[str]) -> bytes:
    wb = Workbook()

    # Sheet 1: BPR Header
    ws_h = wb.active
    ws_h.title = "BPR Header"
    _write_bold_header(ws_h, [label for _, label in _HEADER_COLUMNS])
    ws_h.freeze_panes = "A2"

    row = [_bool_to_str(header.get(key)) for key, _ in _HEADER_COLUMNS]
    ws_h.append(row)

    for col_idx, (key, _) in enumerate(_HEADER_COLUMNS, 1):
        if key in missing_fields:
            ws_h.cell(row=2, column=col_idx).fill = _RED

    _auto_fit_columns(ws_h)

    # Sheet 2: Raw Materials
    ws_m = wb.create_sheet("Raw Materials")
    _write_bold_header(ws_m, [label for _, label in _MATERIAL_COLUMNS])
    ws_m.freeze_panes = "A2"

    for row_idx, mat in enumerate(materials, 2):
        for col_idx, (key, _) in enumerate(_MATERIAL_COLUMNS, 1):
            cell = ws_m.cell(row=row_idx, column=col_idx, value=_bool_to_str(mat.get(key)))
            if mat.get("confidence") == "low":
                cell.fill = _YELLOW

    _auto_fit_columns(ws_m)

    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()
