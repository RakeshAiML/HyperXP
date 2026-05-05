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
