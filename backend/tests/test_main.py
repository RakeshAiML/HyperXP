import json
from unittest.mock import patch
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

_MOCK_EXTRACT_RESULT = {
    "document_type": "Batch Production Record",
    "sheets": [
        {
            "name": "Raw Materials",
            "columns": ["S.No", "Material Name"],
            "rows": [
                {
                    "S.No":          {"value": "1",     "confidence": "high"},
                    "Material Name": {"value": "ETC-3", "confidence": "high"},
                }
            ],
        }
    ],
}


def _make_pdf_bytes() -> bytes:
    import fitz
    doc = fitz.open()
    doc.new_page()
    buf = doc.tobytes()
    doc.close()
    return buf


def test_extract_rejects_non_pdf():
    response = client.post("/extract", files={"file": ("doc.txt", b"hello", "text/plain")})
    assert response.status_code == 400


def test_extract_returns_document_type_and_sheets():
    with patch("main.extract_generic", return_value=_MOCK_EXTRACT_RESULT):
        pdf = _make_pdf_bytes()
        response = client.post("/extract", files={"file": ("bpr.pdf", pdf, "application/pdf")})
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "complete"
    assert data["document_type"] == "Batch Production Record"
    assert len(data["sheets"]) == 1
    assert "excel_url" in data


def test_extract_returns_502_on_empty_sheets():
    with patch("main.extract_generic", return_value={"document_type": "x", "sheets": []}):
        pdf = _make_pdf_bytes()
        response = client.post("/extract", files={"file": ("bpr.pdf", pdf, "application/pdf")})
    assert response.status_code == 502


def test_save_returns_excel_url():
    response = client.post("/save", json={
        "document_type": "Test Doc",
        "sheets": _MOCK_EXTRACT_RESULT["sheets"],
    })
    assert response.status_code == 200
    assert "excel_url" in response.json()


def test_save_rejects_empty_sheets():
    response = client.post("/save", json={"sheets": []})
    assert response.status_code == 400


def test_download_404_for_unknown_file():
    response = client.get("/download/nonexistent_abc123.xlsx")
    assert response.status_code == 404


def test_download_rejects_path_traversal():
    response = client.get("/download/../../../etc/passwd")
    assert response.status_code in (400, 404)


def test_make_filename_slug():
    from main import _make_filename
    name = _make_filename("Batch Production Record — Raw Materials")
    assert name.endswith(".xlsx")
    assert " " not in name
    assert "—" not in name
