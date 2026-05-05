# HyperXP BPR Extraction POC — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a web app where a user uploads a 4-page BPR PDF and downloads a 2-sheet Excel file with all header and raw material data extracted via GPT-4o Vision.

**Architecture:** FastAPI backend converts PDF pages to PNG images, sends them to GPT-4o Vision with a strict JSON schema prompt, validates/normalizes the response, then builds an openpyxl Excel workbook. React+Vite frontend handles file upload, shows processing status, and provides a download link.

**Tech Stack:** Python 3.11+, FastAPI 0.115, PyMuPDF 1.24, openai 1.51, openpyxl 3.1, pytest 8.3; React 18, Vite 5, axios 1.7

---

## File Map

```
HyperXP/
├── backend/
│   ├── main.py            ← FastAPI app: /extract + /download endpoints
│   ├── pdf_converter.py   ← PyMuPDF: PDF bytes → list of PNG bytes
│   ├── extractor.py       ← GPT-4o Vision: images → structured JSON dict
│   ├── validator.py       ← Date normalization, flag parsing, field validation
│   ├── excel_gen.py       ← openpyxl: build .xlsx from header + materials dicts
│   ├── requirements.txt
│   ├── pytest.ini
│   └── tests/
│       ├── conftest.py
│       ├── test_pdf_converter.py
│       ├── test_validator.py
│       ├── test_excel_gen.py
│       ├── test_extractor.py
│       └── test_main.py
├── frontend/
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   └── src/
│       ├── main.jsx
│       └── App.jsx
└── .env.example
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/pytest.ini`
- Create: `backend/tests/conftest.py`
- Create: `.env.example`
- Create: `frontend/package.json`
- Create: `frontend/vite.config.js`
- Create: `frontend/index.html`
- Create: `frontend/src/main.jsx`

- [ ] **Step 1: Create backend scaffold**

```
# Run from HyperXP/
mkdir backend
mkdir backend/tests
mkdir -p frontend/src
```

- [ ] **Step 2: Write requirements.txt**

Create `backend/requirements.txt`:
```
fastapi==0.115.0
uvicorn[standard]==0.30.0
python-multipart==0.0.9
pymupdf==1.24.11
openai==1.51.0
openpyxl==3.1.5
python-dotenv==1.0.1
pytest==8.3.3
httpx==0.27.2
```

- [ ] **Step 3: Write pytest.ini**

Create `backend/pytest.ini`:
```ini
[pytest]
testpaths = tests
```

- [ ] **Step 4: Write conftest.py**

Create `backend/tests/conftest.py`:
```python
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
```

- [ ] **Step 5: Write .env.example**

Create `.env.example` in project root:
```
OPENAI_API_KEY=sk-...
```

Also create `.env` with your actual key (never commit this).

- [ ] **Step 6: Write frontend package.json**

Create `frontend/package.json`:
```json
{
  "name": "hyperxp-frontend",
  "version": "0.1.0",
  "scripts": {
    "dev": "vite",
    "build": "vite build"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "axios": "^1.7.7"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.1",
    "vite": "^5.4.8"
  }
}
```

- [ ] **Step 7: Write vite.config.js**

Create `frontend/vite.config.js`:
```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
```

- [ ] **Step 8: Write index.html**

Create `frontend/index.html`:
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>HyperXP</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 9: Write src/main.jsx**

Create `frontend/src/main.jsx`:
```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

- [ ] **Step 10: Install dependencies**

```bash
# Backend
cd backend
pip install -r requirements.txt

# Frontend
cd ../frontend
npm install
```

- [ ] **Step 11: Commit**

```bash
git init
git add .
git commit -m "chore: project scaffold for HyperXP BPR extraction POC"
```

---

## Task 2: PDF Converter

**Files:**
- Create: `backend/pdf_converter.py`
- Create: `backend/tests/test_pdf_converter.py`

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_pdf_converter.py`:
```python
import fitz
from pdf_converter import pdf_to_images


def _make_pdf(page_count: int = 2) -> bytes:
    doc = fitz.open()
    for i in range(page_count):
        page = doc.new_page()
        page.insert_text((72, 72), f"Test page {i + 1}")
    buf = fitz.BytesIO()
    doc.save(buf)
    return buf.getvalue()


def test_returns_correct_page_count():
    pdf = _make_pdf(4)
    images = pdf_to_images(pdf)
    assert len(images) == 4


def test_returns_png_bytes():
    pdf = _make_pdf(1)
    images = pdf_to_images(pdf)
    # PNG magic bytes: \x89PNG
    assert images[0][:4] == b'\x89PNG'


def test_single_page_pdf():
    pdf = _make_pdf(1)
    images = pdf_to_images(pdf)
    assert len(images) == 1


def test_returns_list_of_bytes():
    pdf = _make_pdf(2)
    images = pdf_to_images(pdf)
    assert isinstance(images, list)
    assert all(isinstance(img, bytes) for img in images)
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd backend
pytest tests/test_pdf_converter.py -v
```

Expected: `ModuleNotFoundError: No module named 'pdf_converter'`

- [ ] **Step 3: Implement pdf_converter.py**

Create `backend/pdf_converter.py`:
```python
import fitz
from typing import List


def pdf_to_images(pdf_bytes: bytes, dpi: int = 300) -> List[bytes]:
    """Convert each page of a PDF to PNG bytes at the given DPI."""
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    scale = dpi / 72
    mat = fitz.Matrix(scale, scale)
    images = []
    for page in doc:
        pix = page.get_pixmap(matrix=mat)
        images.append(pix.tobytes("png"))
    doc.close()
    return images
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
pytest tests/test_pdf_converter.py -v
```

Expected: 4 passed

- [ ] **Step 5: Commit**

```bash
git add backend/pdf_converter.py backend/tests/test_pdf_converter.py
git commit -m "feat: PDF to PNG converter using PyMuPDF"
```

---

## Task 3: Validator

**Files:**
- Create: `backend/validator.py`
- Create: `backend/tests/test_validator.py`

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_validator.py`:
```python
from validator import normalize_date, parse_flag, validate_header, validate_materials


# --- normalize_date ---

def test_normalize_date_slash_short():
    assert normalize_date("06/10/25") == "06/10/2025"


def test_normalize_date_slash_long():
    assert normalize_date("24/09/2025") == "24/09/2025"


def test_normalize_date_pipe_separator():
    assert normalize_date("06|10|25") == "06/10/2025"


def test_normalize_date_text_month_upper():
    assert normalize_date("24 SEP 2025") == "24/09/2025"


def test_normalize_date_text_month_lower():
    assert normalize_date("24 sep 2025") == "24/09/2025"


def test_normalize_date_none():
    assert normalize_date(None) is None


def test_normalize_date_empty_string():
    assert normalize_date("") is None


def test_normalize_date_dash_returns_none():
    assert normalize_date("—") is None


# --- parse_flag ---

def test_parse_flag_double_star():
    name, flag = parse_flag("Hyflo/HYP Lot-1**")
    assert name == "Hyflo/HYP Lot-1"
    assert flag == "**"


def test_parse_flag_single_star():
    name, flag = parse_flag("Ethyl acetate/D-113 Lot-3*")
    assert name == "Ethyl acetate/D-113 Lot-3"
    assert flag == "*"


def test_parse_flag_no_star():
    name, flag = parse_flag("ETC-3")
    assert name == "ETC-3"
    assert flag == ""


# --- validate_header ---

def test_validate_header_returns_missing_fields():
    header = {"product_code": "ETC-4", "batch_no": "ETC-4/00425"}
    missing = validate_header(header)
    assert "start_date" in missing
    assert "end_date" in missing


def test_validate_header_all_present():
    header = {
        "product_code": "ETC-4",
        "batch_no": "ETC-4/00425",
        "start_date": "06/10/2025",
        "end_date": "11/10/2025",
    }
    assert validate_header(header) == []


def test_validate_header_null_value_counts_as_missing():
    header = {
        "product_code": "ETC-4",
        "batch_no": None,
        "start_date": "06/10/2025",
        "end_date": "11/10/2025",
    }
    assert "batch_no" in validate_header(header)


# --- validate_materials ---

def test_validate_materials_normalizes_performed_date():
    rows = [{"material_name": "ETC-3", "performed_by_date": "06|10|25",
             "checked_by_date": None, "flag": ""}]
    result = validate_materials(rows)
    assert result[0]["performed_by_date"] == "06/10/2025"


def test_validate_materials_normalizes_checked_date():
    rows = [{"material_name": "ETC-3", "performed_by_date": None,
             "checked_by_date": "06/10/25", "flag": ""}]
    result = validate_materials(rows)
    assert result[0]["checked_by_date"] == "06/10/2025"


def test_validate_materials_strips_double_star_flag():
    rows = [{"material_name": "Hyflo/HYP Lot-1**",
             "performed_by_date": None, "checked_by_date": None, "flag": ""}]
    result = validate_materials(rows)
    assert result[0]["material_name"] == "Hyflo/HYP Lot-1"
    assert result[0]["flag"] == "**"


def test_validate_materials_strips_single_star_flag():
    rows = [{"material_name": "DMF Lot-3*",
             "performed_by_date": None, "checked_by_date": None, "flag": ""}]
    result = validate_materials(rows)
    assert result[0]["material_name"] == "DMF Lot-3"
    assert result[0]["flag"] == "*"


def test_validate_materials_preserves_existing_flag():
    rows = [{"material_name": "ETC-3",
             "performed_by_date": None, "checked_by_date": None, "flag": "*"}]
    result = validate_materials(rows)
    assert result[0]["flag"] == "*"
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
pytest tests/test_validator.py -v
```

Expected: `ModuleNotFoundError: No module named 'validator'`

- [ ] **Step 3: Implement validator.py**

Create `backend/validator.py`:
```python
from datetime import datetime
from typing import List, Optional, Tuple

_DATE_FORMATS = [
    "%d/%m/%Y",
    "%d/%m/%y",
    "%d %b %Y",
    "%d %B %Y",
]

_REQUIRED_HEADER_FIELDS = ["product_code", "batch_no", "start_date", "end_date"]


def normalize_date(raw: Optional[str]) -> Optional[str]:
    if not raw or not raw.strip() or raw.strip() in ("—", "-", "–"):
        return None
    cleaned = raw.strip().replace("|", "/").replace("\\", "/")
    for fmt in _DATE_FORMATS:
        try:
            dt = datetime.strptime(cleaned.title(), fmt)
            return dt.strftime("%d/%m/%Y")
        except ValueError:
            continue
    return raw.strip()


def parse_flag(material_name: str) -> Tuple[str, str]:
    """Return (clean_name, flag) stripping trailing * or ** from material name."""
    name = material_name.strip()
    if name.endswith("**"):
        return name[:-2].strip(), "**"
    if name.endswith("*"):
        return name[:-1].strip(), "*"
    return name, ""


def validate_header(header: dict) -> List[str]:
    """Return list of required field names that are missing or null."""
    return [f for f in _REQUIRED_HEADER_FIELDS if not header.get(f)]


def validate_materials(materials: List[dict]) -> List[dict]:
    """Normalize dates and flags on each material row. Returns new list."""
    result = []
    for row in materials:
        clean_name, parsed_flag = parse_flag(row.get("material_name") or "")
        existing_flag = row.get("flag") or ""
        result.append({
            **row,
            "material_name": clean_name,
            "flag": parsed_flag or existing_flag,
            "performed_by_date": normalize_date(row.get("performed_by_date")),
            "checked_by_date": normalize_date(row.get("checked_by_date")),
        })
    return result
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
pytest tests/test_validator.py -v
```

Expected: 17 passed

- [ ] **Step 5: Commit**

```bash
git add backend/validator.py backend/tests/test_validator.py
git commit -m "feat: date normalization and field validation"
```

---

## Task 4: Excel Generator

**Files:**
- Create: `backend/excel_gen.py`
- Create: `backend/tests/test_excel_gen.py`

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_excel_gen.py`:
```python
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
    assert fill.fgColor.rgb == "FFFF00"


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
    assert fill.fgColor.rgb == "FF6B6B"


def test_header_row_is_bold():
    wb = load_workbook(BytesIO(generate_workbook(_HEADER, _MATERIALS, [])))
    ws = wb["BPR Header"]
    assert ws.cell(row=1, column=1).font.bold is True


def test_returns_bytes():
    result = generate_workbook(_HEADER, _MATERIALS, [])
    assert isinstance(result, bytes)
    assert len(result) > 0
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
pytest tests/test_excel_gen.py -v
```

Expected: `ModuleNotFoundError: No module named 'excel_gen'`

- [ ] **Step 3: Implement excel_gen.py**

Create `backend/excel_gen.py`:
```python
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


def _bool_to_str(val) -> str:
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
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
pytest tests/test_excel_gen.py -v
```

Expected: 9 passed

- [ ] **Step 5: Commit**

```bash
git add backend/excel_gen.py backend/tests/test_excel_gen.py
git commit -m "feat: Excel workbook generator with yellow/red cell highlighting"
```

---

## Task 5: GPT-4o Extractor

**Files:**
- Create: `backend/extractor.py`
- Create: `backend/tests/test_extractor.py`

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_extractor.py`:
```python
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
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
pytest tests/test_extractor.py -v
```

Expected: `ModuleNotFoundError: No module named 'extractor'`

- [ ] **Step 3: Implement extractor.py**

Create `backend/extractor.py`:
```python
import base64
import json
import os
from typing import List, Optional

from openai import OpenAI

_SYSTEM_PROMPT = """You are a pharmaceutical document extraction assistant specializing in Batch Production Records (BPRs).
Extract all data from the provided BPR page images into the exact JSON schema below.

Rules:
- Use null for any cell with a dash (—), left blank, or not filled in
- Set confidence to "low" for any field where the handwriting is ambiguous or hard to read
- Normalize all dates to DD/MM/YYYY format (e.g. "06|10|25" → "06/10/2025", "24 SEP 2025" → "24/09/2025")
- Signatures: return true if a handwritten mark is present, false if the field is blank
- Quantities like "BX5", "BX1", "B": extract exactly as written, do not interpret
- Strip * and ** from material names; record them in the flag field as "*", "**", or ""

Return ONLY valid JSON matching the schema. No markdown fences, no explanations, no extra text."""

_SCHEMA = """{
  "header": {
    "product_name": "<string|null>",
    "product_code": "<string|null>",
    "stage_code": "<string|null>",
    "batch_no": "<string|null>",
    "batch_size": "<string|null>",
    "start_date": "<DD/MM/YYYY|null>",
    "start_time": "<HH:MM|null>",
    "end_date": "<DD/MM/YYYY|null>",
    "end_time": "<HH:MM|null>",
    "duration": "<string|null>",
    "bpr_checked_after_execution": "<DD/MM/YYYY|null>",
    "qa_issue_date": "<DD/MM/YYYY|null>",
    "qa_issue_time": "<HH:MM|null>",
    "prepared_by_pd_signed": "<boolean>",
    "prepared_by_pd_date": "<DD/MM/YYYY|null>",
    "reviewed_by_pd_signed": "<boolean>",
    "reviewed_by_pd_date": "<DD/MM/YYYY|null>",
    "reviewed_by_rd_signed": "<boolean>",
    "reviewed_by_rd_date": "<DD/MM/YYYY|null>",
    "approved_by_qa_signed": "<boolean>",
    "approved_by_qa_date": "<DD/MM/YYYY|null>",
    "form_no": "<string|null>",
    "effective_date": "<string|null>"
  },
  "materials": [
    {
      "sno": "<number>",
      "material_name": "<string>",
      "uom": "<string|null>",
      "standard_qty": "<string|null>",
      "charged_qty": "<string|null>",
      "ar_no": "<string|null>",
      "weighing_eq_id": "<string|null>",
      "remarks": "<string|null>",
      "performed_by_signed": "<boolean>",
      "performed_by_date": "<DD/MM/YYYY|null>",
      "checked_by_signed": "<boolean>",
      "checked_by_date": "<DD/MM/YYYY|null>",
      "flag": "<'*'|'**'|''>",
      "confidence": "<'high'|'low'>"
    }
  ]
}"""


def _encode(png_bytes: bytes) -> str:
    return base64.b64encode(png_bytes).decode("utf-8")


def _parse_response(raw: str) -> dict:
    text = raw.strip()
    if text.startswith("```"):
        parts = text.split("```")
        text = parts[1]
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()
    return json.loads(text)


def _call_api(images: List[bytes], client: OpenAI) -> dict:
    content = [
        {"type": "text", "text": f"Extract all data from these {len(images)} BPR pages using this schema:\n\n{_SCHEMA}"}
    ]
    for png in images:
        content.append({
            "type": "image_url",
            "image_url": {"url": f"data:image/png;base64,{_encode(png)}", "detail": "high"},
        })
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": content},
        ],
        max_tokens=4096,
        temperature=0,
    )
    return _parse_response(response.choices[0].message.content)


def extract_bpr(images: List[bytes], client: Optional[OpenAI] = None) -> dict:
    """Send page images to GPT-4o Vision and return structured extraction dict."""
    if client is None:
        client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])

    try:
        return _call_api(images, client)
    except (json.JSONDecodeError, KeyError, IndexError):
        pass

    # Retry once
    try:
        return _call_api(images, client)
    except (json.JSONDecodeError, KeyError, IndexError) as e:
        raise ValueError(f"GPT-4o returned invalid JSON after retry: {e}") from e
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
pytest tests/test_extractor.py -v
```

Expected: 6 passed

- [ ] **Step 5: Commit**

```bash
git add backend/extractor.py backend/tests/test_extractor.py
git commit -m "feat: GPT-4o Vision extractor with retry on malformed JSON"
```

---

## Task 6: FastAPI App

**Files:**
- Create: `backend/main.py`
- Create: `backend/tests/test_main.py`

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_main.py`:
```python
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
    buf = fitz.BytesIO()
    doc.save(buf)
    return buf.getvalue()


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
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
pytest tests/test_main.py -v
```

Expected: `ModuleNotFoundError: No module named 'main'`

- [ ] **Step 3: Implement main.py**

Create `backend/main.py`:
```python
import os
import uuid
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from excel_gen import generate_workbook
from extractor import extract_bpr
from pdf_converter import pdf_to_images
from validator import validate_header, validate_materials

load_dotenv()

app = FastAPI(title="HyperXP BPR Extraction")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_OUTPUT_DIR = Path("outputs")
_OUTPUT_DIR.mkdir(exist_ok=True)


@app.post("/extract")
async def extract(file: UploadFile = File(...)):
    if not (file.filename or "").lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    pdf_bytes = await file.read()
    if len(pdf_bytes) > 20 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 20 MB)")

    try:
        images = pdf_to_images(pdf_bytes)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"PDF conversion failed: {exc}") from exc

    try:
        data = extract_bpr(images)
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"OpenAI API error: {exc}") from exc

    header = data.get("header", {})
    missing = validate_header(header)
    materials = validate_materials(data.get("materials", []))
    xlsx_bytes = generate_workbook(header, materials, missing)

    batch_no = (header.get("batch_no") or "unknown").replace("/", "_")
    filename = f"bpr_{batch_no}_{uuid.uuid4().hex[:6]}.xlsx"
    (_OUTPUT_DIR / filename).write_bytes(xlsx_bytes)

    return {"status": "complete", "excel_url": f"/download/{filename}"}


@app.get("/download/{filename}")
def download(filename: str):
    path = _OUTPUT_DIR / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(
        path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=filename,
    )
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
pytest tests/test_main.py -v
```

Expected: 5 passed

- [ ] **Step 5: Run full test suite**

```bash
pytest -v
```

Expected: all tests pass (pdf_converter + validator + excel_gen + extractor + main)

- [ ] **Step 6: Commit**

```bash
git add backend/main.py backend/tests/test_main.py
git commit -m "feat: FastAPI /extract and /download endpoints"
```

---

## Task 7: React Frontend

**Files:**
- Create: `frontend/src/App.jsx`

- [ ] **Step 1: Write App.jsx**

Create `frontend/src/App.jsx`:
```jsx
import { useState } from 'react'
import axios from 'axios'

const API = 'http://localhost:8000'

const styles = {
  page: { maxWidth: 640, margin: '80px auto', padding: '0 24px', fontFamily: 'system-ui, sans-serif', color: '#111' },
  logo: { fontSize: 32, fontWeight: 700, marginBottom: 4 },
  sub: { color: '#666', marginBottom: 40, fontSize: 15 },
  dropzone: {
    border: '2px dashed #d1d5db', borderRadius: 10, padding: '40px 24px',
    textAlign: 'center', background: '#fafafa', marginBottom: 24, cursor: 'pointer',
  },
  dropzoneActive: { borderColor: '#2563eb', background: '#eff6ff' },
  fileName: { marginTop: 12, fontSize: 14, color: '#374151' },
  btn: {
    padding: '12px 28px', background: '#2563eb', color: '#fff',
    border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 16, fontWeight: 500,
  },
  btnDisabled: { background: '#93c5fd', cursor: 'not-allowed' },
  success: { marginTop: 24, padding: 16, background: '#f0fdf4', borderRadius: 8, border: '1px solid #86efac' },
  error: { marginTop: 24, padding: 16, background: '#fef2f2', borderRadius: 8, border: '1px solid #fca5a5' },
  link: { display: 'inline-block', marginTop: 10, color: '#2563eb', fontWeight: 500, textDecoration: 'none' },
  spinner: { display: 'inline-block', marginRight: 8 },
}

export default function App() {
  const [file, setFile] = useState(null)
  const [status, setStatus] = useState('idle')
  const [downloadUrl, setDownloadUrl] = useState(null)
  const [errorMsg, setErrorMsg] = useState(null)
  const [dragOver, setDragOver] = useState(false)

  const handleFile = (f) => {
    if (f && f.name.endsWith('.pdf')) {
      setFile(f)
      setStatus('idle')
      setErrorMsg(null)
      setDownloadUrl(null)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    handleFile(e.dataTransfer.files[0])
  }

  const handleExtract = async () => {
    if (!file) return
    setStatus('extracting')
    setErrorMsg(null)
    const form = new FormData()
    form.append('file', file)
    try {
      const res = await axios.post(`${API}/extract`, form)
      setDownloadUrl(`${API}${res.data.excel_url}`)
      setStatus('done')
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || 'Extraction failed. Please try again.')
      setStatus('error')
    }
  }

  const busy = status === 'extracting'

  return (
    <div style={styles.page}>
      <div style={styles.logo}>HyperXP</div>
      <p style={styles.sub}>Upload a Batch Production Record PDF to extract structured data into Excel</p>

      <div
        style={{ ...styles.dropzone, ...(dragOver ? styles.dropzoneActive : {}) }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => document.getElementById('file-input').click()}
      >
        <div style={{ fontSize: 36 }}>📄</div>
        <div style={{ marginTop: 8, color: '#6b7280' }}>
          {file ? '' : 'Drag & drop a PDF here, or click to browse'}
        </div>
        {file && <div style={styles.fileName}>{file.name}</div>}
        <input
          id="file-input"
          type="file"
          accept=".pdf"
          style={{ display: 'none' }}
          onChange={(e) => handleFile(e.target.files[0])}
        />
      </div>

      <button
        style={{ ...styles.btn, ...(busy || !file ? styles.btnDisabled : {}) }}
        onClick={handleExtract}
        disabled={busy || !file}
      >
        {busy ? '⏳ Extracting…' : 'Extract to Excel'}
      </button>

      {status === 'done' && (
        <div style={styles.success}>
          <strong style={{ color: '#166534' }}>Extraction complete!</strong>
          <br />
          <a href={downloadUrl} download style={styles.link}>
            ⬇ Download Excel file
          </a>
        </div>
      )}

      {status === 'error' && (
        <div style={styles.error}>
          <strong style={{ color: '#991b1b' }}>Error:</strong>{' '}
          <span style={{ color: '#7f1d1d' }}>{errorMsg}</span>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Start backend and verify it runs**

```bash
cd backend
uvicorn main:app --reload --port 8000
```

Expected: `Uvicorn running on http://127.0.0.1:8000`

- [ ] **Step 3: Start frontend and verify it loads**

In a new terminal:
```bash
cd frontend
npm run dev
```

Expected: `Local: http://localhost:5173/`
Open browser → see HyperXP upload page.

- [ ] **Step 4: End-to-end test with real BPR**

1. Open `http://localhost:5173`
2. Upload the 4-page `BPR.pdf`
3. Click "Extract to Excel"
4. Wait ~15–30 seconds
5. Click "Download Excel file"
6. Open Excel — verify:
   - Sheet 1 "BPR Header": Batch No = `ETC-4/00425`, all sign-off dates present, signed fields = "Yes"
   - Sheet 2 "Raw Materials": 35 rows, Charged Qty column filled for rows with actual values, dashes = empty, * and ** in Flag column, any ambiguous cells highlighted yellow

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.jsx
git commit -m "feat: React upload UI with drag-and-drop and Excel download"
```

---

## Final Checklist

- [ ] All backend tests pass: `cd backend && pytest -v`
- [ ] Backend runs: `uvicorn main:app --reload --port 8000`
- [ ] Frontend runs: `cd frontend && npm run dev`
- [ ] End-to-end: upload BPR.pdf → download populated Excel with 2 sheets
- [ ] Low-confidence cells highlighted yellow in Sheet 2
- [ ] Missing required header fields highlighted red in Sheet 1
