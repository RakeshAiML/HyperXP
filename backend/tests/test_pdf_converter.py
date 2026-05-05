import fitz
from io import BytesIO
from pdf_converter import pdf_to_images


def _make_pdf(page_count: int = 2) -> bytes:
    doc = fitz.open()
    for i in range(page_count):
        page = doc.new_page()
        page.insert_text((72, 72), f"Test page {i + 1}")
    buf = BytesIO()
    doc.save(buf)
    return buf.getvalue()


def test_returns_correct_page_count():
    pdf = _make_pdf(4)
    images = pdf_to_images(pdf)
    assert len(images) == 4


def test_returns_png_bytes():
    pdf = _make_pdf(1)
    images = pdf_to_images(pdf)
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
