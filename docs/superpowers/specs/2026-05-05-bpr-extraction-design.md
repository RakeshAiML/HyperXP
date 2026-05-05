# BPR Extraction POC — Design Spec

**Date:** 2026-05-05
**Status:** Approved
**Company:** A.R. Life Sciences Private Limited

---

## Overview

A web application that accepts a scanned Batch Production Record (BPR) PDF and produces a structured Excel workbook. The POC is scoped to the first 4 pages of a BPR — the header block and raw material input section. The document is a mix of printed template fields and handwritten values (quantities, lot numbers, dates, signatures).

---

## Problem

BPRs are 87-page GMP documents filled out by hand. Extracting data from them today is manual — someone reads the physical form and types values into a system. This POC validates that GPT-4o Vision can read the handwriting accurately enough to automate extraction into a structured Excel output.

---

## Scope (POC)

- **Input:** 4-page BPR PDF (pages 1–4 of BPR/ETC-4/01-01)
- **Output:** 2-sheet Excel workbook (.xlsx)
- **Users:** Internal (QA / data team uploading BPR scans)
- **No database, no authentication, no persistence** — upload → extract → download

---

## Tech Stack

| Layer | Technology | Reason |
|---|---|---|
| Frontend | React + Vite | Simple file upload and download UI |
| Backend | Python FastAPI | Lightweight REST API, easy async |
| PDF → Image | PyMuPDF (fitz) | Fast, accurate 300 DPI PNG conversion |
| AI Extraction | OpenAI GPT-4o Vision | Existing subscription; best-in-class handwriting reading |
| Excel generation | openpyxl | Full control over cell formatting and highlighting |

---

## Pipeline

```
User uploads PDF
      ↓
FastAPI receives file
      ↓
PyMuPDF converts 4 pages → 4 PNG images (300 DPI)
      ↓
GPT-4o Vision: all 4 images + schema prompts → JSON
      ↓
Validator: normalize dates, handle nulls, parse flags
      ↓
openpyxl: build .xlsx workbook
      ↓
User downloads Excel file
```

### Step-by-step

**1. Upload**
- `POST /extract` accepts multipart PDF upload
- File size limit: 20 MB for POC
- Runs synchronously — response returned when extraction and Excel generation are complete (typically 10–30 seconds for 4 pages)

**2. PDF → Image**
- PyMuPDF renders each page at 300 DPI to PNG
- All 4 pages converted before API call

**3. GPT-4o Vision Extraction**
- All 4 page images sent in a single API call (GPT-4o supports multi-image)
- Two JSON schemas embedded in the system prompt:
  - **Header schema** — extracts the top-level BPR fields from page 1
  - **Raw materials schema** — extracts all table rows across pages 1–4
- Model instructions:
  - Use `null` for any cell containing a dash (—) or left blank
  - Set `confidence: "low"` for any field where handwriting is ambiguous
  - Normalize all dates to `DD/MM/YYYY` format
  - Signatures: return `true` if a signature mark is present, `false` if blank
  - Quantities like `BX5` (batch × 5) extracted as-is, not interpreted
- On malformed JSON response: retry once, then return error

**4. Validation**
- Required header fields must not be null: `product_code`, `batch_no`, `start_date`, `end_date`
- Numeric quantity fields (`standard_qty`, `charged_qty`) must be numeric or null
- Dates must parse under common BPR formats (`DD/MM/YY`, `DD|MM|YY`, `DD/MM/YYYY`, `DD MMM YYYY`)
- Flag column: strip `*` and `**` from material names, store in separate `flag` field (`*`, `**`, or `""`)

**5. Excel Generation**
- Single .xlsx workbook with 2 sheets (see schema below)
- Low-confidence cells (`confidence: "low"`) highlighted yellow (`FFFF00`)
- Header row bold, frozen (freeze pane at row 2)
- Column widths auto-fitted

---

## Excel Output Schema

### Sheet 1 — BPR Header

One row per BPR document.

| Column | Source | Example |
|---|---|---|
| Product Name | Page 1 header | Ethyl-2-(7-(4-cyclopentyl-3-(trifluoromethyl)... |
| Product Code | Page 1 header | ETC-4 |
| Stage Code | Page 1 header | ETC-4 |
| Batch No | Page 1 header | ETC-4/00425 |
| Batch Size | Page 1 header | 13.00 Kg of ETC-3 |
| Start Date | Page 1 header | 06/10/2025 |
| Start Time | Page 1 header | 07:40 |
| End Date | Page 1 header | 11/10/2025 |
| End Time | Page 1 header | 13:05 |
| Duration | Page 1 header | 125/25 hrs |
| BPR Checked After Execution | Page 1 header | 11/10/2025 |
| QA Issue Date | Page 1 QA stamp | 29/09/2025 |
| QA Issue Time | Page 1 QA stamp | 11:20 |
| Prepared by PD Signed | Page 1 sign-off | Yes |
| Prepared by PD Date | Page 1 sign-off | 24/09/2025 |
| Reviewed by PD Signed | Page 1 sign-off | Yes |
| Reviewed by PD Date | Page 1 sign-off | 24/09/2025 |
| Reviewed by R&D Signed | Page 1 sign-off | Yes |
| Reviewed by R&D Date | Page 1 sign-off | 26/09/2025 |
| Approved by QA Signed | Page 1 sign-off | Yes |
| Approved by QA Date | Page 1 sign-off | 24/09/2025 |
| Form No | Page 1 footer | FM03/QA/SOP/005-01/27/08/2024 |
| Effective Date | Page 1 footer | 24 SEP 2025 |

### Sheet 2 — Raw Materials

One row per material entry. 35 rows across pages 1–4.

| Column | Notes |
|---|---|
| S.No | Row number from BPR |
| Material Name / Code | Printed text (e.g. "Dimethyl formamide/ DMF Lot-1") |
| UOM | Kg or L |
| Standard Quantity | Printed value; "B", "BX5", "BX1" preserved as-is |
| Charged Quantity | Handwritten; null if dash |
| AR No. / In-house B.No. | Handwritten lot reference |
| Weighing Eq. ID No. | Handwritten equipment ID |
| Remarks | Handwritten; null if dash |
| Performed By Signed | Yes / No |
| Performed By Date | Normalized DD/MM/YYYY |
| Checked By Signed | Yes / No |
| Checked By Date | Normalized DD/MM/YYYY |
| Flag | `*` = may be required · `**` = fixed quantity · blank = neither |
| Confidence | High / Low — Low cells highlighted yellow in Excel |

---

## Project Structure

```
HyperXP/
├── backend/
│   ├── main.py            # FastAPI app, /extract endpoint
│   ├── extractor.py       # GPT-4o Vision API calls + prompt templates
│   ├── excel_gen.py       # openpyxl workbook builder
│   ├── validator.py       # Field validation + date normalization
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   └── App.jsx        # Upload UI, status polling, download button
│   └── package.json
└── docs/
    └── superpowers/
        └── specs/
            └── 2026-05-05-bpr-extraction-design.md
```

---

## API Contract

### `POST /extract`

**Request:** `multipart/form-data` with `file` field (PDF)

**Response (success):**
```json
{
  "status": "complete",
  "excel_url": "/download/bpr_ETC-4_00425.xlsx"
}
```

**Response (error):**
```json
{
  "status": "error",
  "message": "GPT-4o extraction failed after retry"
}
```

### `GET /download/{filename}`

Returns the generated .xlsx file as a binary download.

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| GPT-4o returns malformed JSON | Retry once; if still fails, return error to UI |
| Required header fields missing | Still generate Excel; missing cells left empty and highlighted red |
| PDF has no pages / corrupt file | Return 400 with clear error message |
| OpenAI API rate limit / timeout | Return 503 with retry-after message |

---

## Out of Scope (POC)

- Pages 5–87 of the BPR (process steps, yield, in-process checks)
- Authentication / user accounts
- Database storage of extracted records
- Batch processing of multiple BPRs
- 21 CFR Part 11 compliance / audit trail
- Support for other BPR document types or layouts
