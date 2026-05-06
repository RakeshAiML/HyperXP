import base64
import json
import logging
import os
import re
from typing import List, Optional

from openai import OpenAI

_SYSTEM_PROMPT = """You are a document extraction assistant. Read all pages and extract every table.

Rules:
- Use null for blank, dash (—), or unfilled cells
- Set confidence "low" for ambiguous or hard-to-read handwriting; "high" otherwise
- Normalize all dates to DD/MM/YYYY (e.g. "06|10|25" → "06/10/2025", "24 SEP 2025" → "24/09/2025")
- Column names must exactly match the printed column headers in the document
- Create one sheet entry per distinct table found
- Name sheets descriptively based on what the table contains

Return ONLY valid JSON matching the schema below. No markdown fences, no explanations."""

_SCHEMA = """{
  "document_type": "<one-line description of the document>",
  "sheets": [
    {
      "name": "<table name>",
      "columns": ["<col1>", "<col2>"],
      "rows": [
        {
          "<col1>": { "value": "<string|null>", "confidence": "<high|low>" },
          "<col2>": { "value": "<string|null>", "confidence": "<high|low>" }
        }
      ]
    }
  ]
}"""


def _encode(png_bytes: bytes) -> str:
    return base64.b64encode(png_bytes).decode("utf-8")


def _parse_response(raw: str) -> dict:
    text = raw.strip()
    m = re.search(r"```(?:json)?\s*(\{.*\})\s*```", text, re.DOTALL)
    if m:
        text = m.group(1).strip()
    return json.loads(text)


def _call_api(images: List[bytes], client: OpenAI) -> dict:
    content = [
        {"type": "text", "text": f"Extract all tables from these {len(images)} document pages using this schema:\n\n{_SCHEMA}"},
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
        max_tokens=16384,
        temperature=0,
    )
    return _parse_response(response.choices[0].message.content)


def extract_generic(images: List[bytes], client: Optional[OpenAI] = None) -> dict:
    """Extract all tables from PDF page images. Returns {document_type, sheets}."""
    if not images:
        raise ValueError("images must be non-empty")
    if client is None:
        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY environment variable is not set")
        client = OpenAI(api_key=api_key)
    try:
        return _call_api(images, client)
    except (json.JSONDecodeError, KeyError, IndexError, AttributeError) as e:
        logging.warning("GPT-4o first attempt failed (%s), retrying…", e)
    try:
        return _call_api(images, client)
    except (json.JSONDecodeError, KeyError, IndexError, AttributeError) as e:
        raise ValueError(f"GPT-4o returned invalid JSON after retry: {e}") from e
