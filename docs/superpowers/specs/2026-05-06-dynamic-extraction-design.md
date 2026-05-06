# Dynamic PDF Extraction Design

**Goal:** Replace the hard-coded BPR extractor with a single universal extractor that works for any scanned PDF — A.R. Life Sciences BPR header/materials pages, shift incharge logs, process operations pages, or any other document type.

**Architecture:** One GPT-4o Vision call reads all PDF pages and returns a fixed outer envelope (`document_type` + `sheets` array) where the inner content — sheet names, column names, row data — is fully decided by the model. Every cell carries a `value` and `confidence` field, enabling red/yellow highlighting and inline editing for any document. The backend generates Excel dynamically from whatever sheets are returned.

**Tech Stack:** Python/FastAPI backend, GPT-4o Vision API, openpyxl for Excel, React/Vite frontend.

---

## API Response Format

`POST /extract` returns:

```json
{
  "status": "complete",
  "excel_url": "/download/bpr_xxx.xlsx",
  "document_type": "Batch Production Record — Raw Materials",
  "sheets": [
    {
      "name": "Sheet Name",
      "columns": ["Col A", "Col B", "Col C"],
      "rows": [
        {
          "Col A": { "value": "some text", "confidence": "high" },
          "Col B": { "value": null,        "confidence": "low"  },
          "Col C": { "value": "other",     "confidence": "high" }
        }
      ]
    }
  ]
}
```

- `value: null` = AI could not extract the field → red cell in UI
- `confidence: "low"` with non-null value = AI is unsure → yellow cell in UI
- `confidence: "high"` with non-null value = clean extraction → default styling

`POST /save` accepts `{ sheets: [...] }` with the same structure (user edits applied) and returns `{ excel_url }`.

---

## Backend

### `extractor.py` — full rewrite

Single public function:

```python
def extract_generic(images: List[bytes], client=None) -> dict:
    # Returns: { "document_type": str, "sheets": [...] }
```

System prompt rules:
- Return ONLY valid JSON, no markdown fences
- Use `null` for blank/dash cells
- Set `confidence: "low"` for ambiguous handwriting
- Normalize dates to DD/MM/YYYY
- Detect all tables in the document; create one sheet entry per table
- Name sheets descriptively (e.g. "Raw Materials", "Shift Incharge Log")
- Column names should match the printed column headers in the document

Schema instructed to GPT-4o:

```json
{
  "document_type": "<one-line description of the document>",
  "sheets": [
    {
      "name": "<table name>",
      "columns": ["<col1>", "<col2>"],
      "rows": [
        { "<col1>": { "value": "<string|null>", "confidence": "<high|low>" } }
      ]
    }
  ]
}
```

`max_tokens: 16384`, `temperature: 0`.

Single retry on `JSONDecodeError`.

---

### `excel_gen.py` — full rewrite

Single public function:

```python
def generate_workbook(sheets: list) -> bytes:
    # Creates one Excel sheet per item in sheets[]
    # Yellow fill = confidence "low"
    # Red fill    = value is null
    # Returns workbook bytes
```

- Bold, frozen header row per sheet
- Auto-fitted column widths
- No BPR-specific logic

---

### `main.py` — simplified

`POST /extract`:
1. Convert PDF → images (`pdf_to_images`)
2. Call `extract_generic(images)` → `result`
3. Call `generate_workbook(result["sheets"])` → xlsx bytes
4. Save xlsx, build filename from `document_type` slug: lowercase, spaces→underscores, max 40 chars, append 6-char hex suffix (e.g. `bpr_raw_materials_a3f9c1.xlsx`)
5. Return `{ status, excel_url, document_type, sheets }`

`POST /save`:
1. Accept `{ sheets }` body
2. Call `generate_workbook(sheets)` → new xlsx
3. Return `{ excel_url }`

`validator.py` — no longer called. File kept but unused.

---

## Frontend (`App.jsx`)

### DataPane — dynamic mode

Props: `result` (`{ document_type, sheets, excel_url }`), `onSaved(newUrl)`

State:
- `editedSheets` — deep copy of `sheets`, mutated on user edits
- `hasEdits` — boolean, triggers save bar
- `saving` — boolean for save button state

**Rendering:**
- Document type badge at top of right panel
- One `<section>` per sheet, titled with `sheet.name`
- Each section renders a table:
  - Column headers from `sheet.columns`
  - Each cell: red background if `value === null`, yellow if `confidence === "low"`, default otherwise
  - Click any cell → inline `<input>`, blur/Enter commits, Escape cancels
- Legend bar: yellow = low confidence, red = could not extract
- Save bar (sticky, dark) appears when `hasEdits === true`

**Save flow:**
1. POST `{ sheets: editedSheets }` to `/save`
2. On success: call `onSaved(newUrl)`, set `hasEdits = false`

**No BPR-specific components remain** — `FieldCard`, `SigCard`, `HEADER_FIELDS`, `SIGN_FIELDS`, `MAT_COLS` all removed.

---

## What is Removed

| Item | Reason |
|------|--------|
| `validate_header` / `validate_materials` calls | BPR-specific validation |
| `header_confidence` separate field | Confidence now per-cell inside `sheets` |
| `missing_fields` / required fields badge | BPR-specific concept |
| `FieldCard`, `SigCard` components | Replaced by generic `EditableCell` |
| `HEADER_FIELDS`, `SIGN_FIELDS`, `MAT_COLS` constants | Replaced by dynamic column arrays |
| Separate header + materials API calls | One generic call |

---

## Error Handling

- PDF conversion failure → HTTP 422
- GPT-4o JSON parse failure (after retry) → HTTP 502 with message
- Empty sheets array → HTTP 502 "No tables found in document"
- File too large (>20 MB) → HTTP 400
