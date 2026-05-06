import os
import re
import uuid
from pathlib import Path

from dotenv import load_dotenv
from fastapi import Body, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from excel_gen import generate_workbook
from extractor import extract_generic
from pdf_converter import pdf_to_images

load_dotenv()

app = FastAPI(title="HyperXP Document Extraction")

_ALLOWED_ORIGINS = [o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173").split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

_OUTPUT_DIR = Path("outputs")
_OUTPUT_DIR.mkdir(exist_ok=True)


def _make_filename(document_type: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", document_type.lower()).strip("_")[:40]
    return f"{slug}_{uuid.uuid4().hex[:6]}.xlsx"


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
        result = extract_generic(images)
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"OpenAI API error: {exc}") from exc

    sheets = result.get("sheets", [])
    if not sheets:
        raise HTTPException(status_code=502, detail="No tables found in document")

    xlsx_bytes = generate_workbook(sheets)
    filename = _make_filename(result.get("document_type", "document"))
    (_OUTPUT_DIR / filename).write_bytes(xlsx_bytes)

    return {
        "status": "complete",
        "excel_url": f"/download/{filename}",
        "document_type": result.get("document_type", ""),
        "sheets": sheets,
    }


@app.post("/save")
async def save(body: dict = Body(...)):
    sheets = body.get("sheets", [])
    if not sheets:
        raise HTTPException(status_code=400, detail="No sheets provided")
    xlsx_bytes = generate_workbook(sheets)
    filename = _make_filename(body.get("document_type", "document"))
    (_OUTPUT_DIR / filename).write_bytes(xlsx_bytes)
    return {"excel_url": f"/download/{filename}"}


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
