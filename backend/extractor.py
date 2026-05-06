import base64
import json
import os
from typing import List, Optional

from openai import OpenAI

_SYSTEM_PROMPT = """You are a pharmaceutical document extraction assistant specializing in Batch Production Records (BPRs).

Rules:
- Use null for any cell with a dash (—), left blank, or not filled in
- Set confidence to "low" for any field where the handwriting is ambiguous or hard to read
- Normalize all dates to DD/MM/YYYY format (e.g. "06|10|25" → "06/10/2025", "24 SEP 2025" → "24/09/2025")
- Signatures: return true if a handwritten mark is present, false if the field is blank
- Quantities like "BX5", "BX1", "B": extract exactly as written, do not interpret
- Strip * and ** from material names; record them in the flag field as "*", "**", or ""

Return ONLY valid JSON matching the schema. No markdown fences, no explanations, no extra text."""

_HEADER_SCHEMA = """{
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
  "effective_date": "<string|null>",
  "confidence": {
    "product_name": "<'high'|'low'>",
    "product_code": "<'high'|'low'>",
    "stage_code": "<'high'|'low'>",
    "batch_no": "<'high'|'low'>",
    "batch_size": "<'high'|'low'>",
    "start_date": "<'high'|'low'>",
    "start_time": "<'high'|'low'>",
    "end_date": "<'high'|'low'>",
    "end_time": "<'high'|'low'>",
    "duration": "<'high'|'low'>",
    "bpr_checked_after_execution": "<'high'|'low'>",
    "qa_issue_date": "<'high'|'low'>",
    "qa_issue_time": "<'high'|'low'>",
    "prepared_by_pd_signed": "<'high'|'low'>",
    "prepared_by_pd_date": "<'high'|'low'>",
    "reviewed_by_pd_signed": "<'high'|'low'>",
    "reviewed_by_pd_date": "<'high'|'low'>",
    "reviewed_by_rd_signed": "<'high'|'low'>",
    "reviewed_by_rd_date": "<'high'|'low'>",
    "approved_by_qa_signed": "<'high'|'low'>",
    "approved_by_qa_date": "<'high'|'low'>",
    "form_no": "<'high'|'low'>",
    "effective_date": "<'high'|'low'>"
  }
}"""

_MATERIALS_SCHEMA = """[
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
]"""


def _encode(png_bytes: bytes) -> str:
    return base64.b64encode(png_bytes).decode("utf-8")


def _image_content(png_bytes: bytes) -> dict:
    return {
        "type": "image_url",
        "image_url": {"url": f"data:image/png;base64,{_encode(png_bytes)}", "detail": "high"},
    }


def _parse_response(raw: str):
    text = raw.strip()
    if text.startswith("```"):
        parts = text.split("```")
        text = parts[1]
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()
    return json.loads(text)


def _call_header(images: List[bytes], client: OpenAI) -> dict:
    content = [
        {"type": "text", "text": f"Extract the BPR header block from page 1 of these {len(images)} images using this schema:\n\n{_HEADER_SCHEMA}"},
    ]
    for png in images:
        content.append(_image_content(png))
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": content},
        ],
        max_tokens=2048,
        temperature=0,
    )
    result = _parse_response(response.choices[0].message.content)
    if not isinstance(result, dict):
        return {}, {}
    confidence = result.pop("confidence", {})
    return result, confidence


def _call_materials(images: List[bytes], client: OpenAI) -> list:
    content = [
        {"type": "text", "text": f"Extract ALL rows from the Raw Materials table spanning all {len(images)} pages using this schema for each row:\n\n{_MATERIALS_SCHEMA}\n\nReturn a JSON array of all material rows. Include every row even if partially filled."},
    ]
    for png in images:
        content.append(_image_content(png))
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": content},
        ],
        max_tokens=16384,
        temperature=0,
    )
    result = _parse_response(response.choices[0].message.content)
    return result if isinstance(result, list) else []


def extract_bpr(images: List[bytes], client: Optional[OpenAI] = None) -> dict:
    """Send page images to GPT-4o Vision and return structured extraction dict."""
    if client is None:
        client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])

    try:
        header, header_confidence = _call_header(images, client)
    except (json.JSONDecodeError, KeyError, IndexError) as e:
        raise ValueError(f"GPT-4o returned invalid JSON for header: {e}") from e

    try:
        materials = _call_materials(images, client)
    except (json.JSONDecodeError, KeyError, IndexError) as e:
        raise ValueError(f"GPT-4o returned invalid JSON after retry: {e}") from e

    return {"header": header, "header_confidence": header_confidence, "materials": materials}
