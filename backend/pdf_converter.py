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
