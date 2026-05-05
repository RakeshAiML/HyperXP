import json
from unittest.mock import patch

import fitz
import pytest
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def _make_pdf(pages: int = 1) -> bytes:
    doc = fitz.open()
    for i in range(pages):
        page = doc.new_page()
        page.insert_text((72, 72), f"BPR page {i + 1}")
    return doc.tobytes()


_MOCK_EXTRACTED = {
    "header": {
        "product_name": "ETC-4 compound",
        "product_code": "ETC-4",
        "stage_code": "ETC-4",
        "batch_no": "ETC-4/00425",
        "batch_size": "13.00 Kg",
        "start_date": "06/10/2025",
        "start_time": "07:40",
        "end_date": "11/10/2025",
        "end_time": "13:05",
        "duration": "125/25 hrs",
        "bpr_checked_after_execution": None,
        "qa_issue_date": None,
        "qa_issue_time": None,
        "prepared_by_pd_signed": True,
        "prepared_by_pd_date": "24/09/2025",
        "reviewed_by_pd_signed": True,
        "reviewed_by_pd_date": "24/09/2025",
        "reviewed_by_rd_signed": True,
        "reviewed_by_rd_date": "26/09/2025",
        "approved_by_qa_signed": True,
        "approved_by_qa_date": "24/09/2025",
        "form_no": "FM03/QA/SOP/005-01",
        "effective_date": "24/09/2025",
    },
    "materials": [],
}


def test_extract_returns_200_with_excel_url():
    with patch("main.extract_bpr", return_value=_MOCK_EXTRACTED):
        res = client.post("/extract", files={"file": ("test.pdf", _make_pdf(), "application/pdf")})
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "complete"
    assert body["excel_url"].startswith("/download/")
    assert body["excel_url"].endswith(".xlsx")


def test_extract_rejects_non_pdf():
    res = client.post("/extract", files={"file": ("test.txt", b"hello world", "text/plain")})
    assert res.status_code == 400
    assert "PDF" in res.json()["detail"]


def test_extract_returns_502_on_gpt_failure():
    with patch("main.extract_bpr", side_effect=ValueError("GPT-4o returned invalid JSON")):
        res = client.post("/extract", files={"file": ("test.pdf", _make_pdf(), "application/pdf")})
    assert res.status_code == 502


def test_download_returns_xlsx():
    with patch("main.extract_bpr", return_value=_MOCK_EXTRACTED):
        extract_res = client.post("/extract", files={"file": ("test.pdf", _make_pdf(), "application/pdf")})
    filename = extract_res.json()["excel_url"].split("/download/")[1]
    dl_res = client.get(f"/download/{filename}")
    assert dl_res.status_code == 200
    assert "spreadsheetml" in dl_res.headers["content-type"]


def test_download_missing_file_returns_404():
    res = client.get("/download/does_not_exist.xlsx")
    assert res.status_code == 404
