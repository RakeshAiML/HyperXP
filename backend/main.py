import os
import uuid
from pathlib import Path

from dotenv import load_dotenv
from fastapi import Body, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from excel_gen import generate_workbook
from extractor import extract_bpr
from pdf_converter import pdf_to_images
from validator import validate_header, validate_materials

load_dotenv()

app = FastAPI(title="HyperXP BPR Extraction")


_ALLOWED_ORIGINS = [o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173").split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
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

    return {
        "status": "complete",
        "excel_url": f"/download/{filename}",
        "header": header,
        "header_confidence": data.get("header_confidence", {}),
        "materials": materials,
        "missing_fields": missing,
    }


@app.post("/save")
async def save(body: dict = Body(...)):
    header = body.get("header", {})
    materials = body.get("materials", [])
    missing = validate_header(header)
    xlsx_bytes = generate_workbook(header, materials, missing)
    batch_no = (header.get("batch_no") or "unknown").replace("/", "_")
    filename = f"bpr_{batch_no}_{uuid.uuid4().hex[:6]}.xlsx"
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
