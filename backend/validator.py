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
