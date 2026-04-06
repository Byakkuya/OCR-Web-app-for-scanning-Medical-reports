import re
from datetime import datetime
from typing import Optional


# ── Reference ranges for common blood test markers ──────────────────────────
REFERENCE_RANGES = {
    "glucose":        {"min": 70,   "max": 100,  "unit": "mg/dL"},
    "hemoglobin":     {"min": 12.0, "max": 17.5, "unit": "g/dL"},
    "hematocrit":     {"min": 36,   "max": 52,   "unit": "%"},
    "wbc":            {"min": 4.0,  "max": 11.0, "unit": "10³/µL"},
    "rbc":            {"min": 4.2,  "max": 5.9,  "unit": "10⁶/µL"},
    "platelets":      {"min": 150,  "max": 400,  "unit": "10³/µL"},
    "sodium":         {"min": 136,  "max": 145,  "unit": "mEq/L"},
    "potassium":      {"min": 3.5,  "max": 5.1,  "unit": "mEq/L"},
    "chloride":       {"min": 98,   "max": 107,  "unit": "mEq/L"},
    "creatinine":     {"min": 0.6,  "max": 1.2,  "unit": "mg/dL"},
    "urea":           {"min": 7,    "max": 20,   "unit": "mg/dL"},
    "bun":            {"min": 7,    "max": 20,   "unit": "mg/dL"},
    "cholesterol":    {"min": 0,    "max": 200,  "unit": "mg/dL"},
    "triglycerides":  {"min": 0,    "max": 150,  "unit": "mg/dL"},
    "hdl":            {"min": 40,   "max": 999,  "unit": "mg/dL"},
    "ldl":            {"min": 0,    "max": 100,  "unit": "mg/dL"},
    "alt":            {"min": 7,    "max": 56,   "unit": "U/L"},
    "ast":            {"min": 10,   "max": 40,   "unit": "U/L"},
    "tsh":            {"min": 0.4,  "max": 4.0,  "unit": "mIU/L"},
    "calcium":        {"min": 2.1,  "max": 2.6,  "unit": "mmol/L"},
    "albumin":        {"min": 3.5,  "max": 5.0,  "unit": "g/dL"},
    "bilirubin":      {"min": 0.1,  "max": 1.2,  "unit": "mg/dL"},
    "ferritin":       {"min": 12,   "max": 300,  "unit": "ng/mL"},
    "iron":           {"min": 60,   "max": 170,  "unit": "µg/dL"},
    "vitamin d":      {"min": 20,   "max": 50,   "unit": "ng/mL"},
    "vitamin b12":    {"min": 200,  "max": 900,  "unit": "pg/mL"},
    "hba1c":          {"min": 0,    "max": 5.7,  "unit": "%"},
    "mcv":            {"min": 80,   "max": 100,  "unit": "fL"},
    "mch":            {"min": 27,   "max": 33,   "unit": "pg"},
    "mchc":           {"min": 32,   "max": 36,   "unit": "g/dL"},
    "esr":            {"min": 0,    "max": 20,   "unit": "mm/hr"},
    "crp":            {"min": 0,    "max": 1.0,  "unit": "mg/dL"},
    "uric acid":      {"min": 3.5,  "max": 7.2,  "unit": "mg/dL"},
    "phosphorus":     {"min": 0.8,  "max": 1.5,  "unit": "mmol/L"},
    "magnesium":      {"min": 0.7,  "max": 1.0,  "unit": "mmol/L"},
    "bicarbonate":    {"min": 22,   "max": 28,   "unit": "mmol/L"},
}

# ── Aliases that map OCR label variants → canonical key ─────────────────────
ALIASES = {
    "blood glucose":       "glucose",
    "fasting glucose":     "glucose",
    "fbs":                 "glucose",
    "hgb":                 "hemoglobin",
    "hb":                  "hemoglobin",
    "haemoglobin":         "hemoglobin",
    "haematocrit":         "hematocrit",
    "hct":                 "hematocrit",
    "white blood cells":   "wbc",
    "white blood cell":    "wbc",
    "leukocytes":          "wbc",
    "red blood cells":     "rbc",
    "erythrocytes":        "rbc",
    "plt":                 "platelets",
    "thrombocytes":        "platelets",
    "na":                  "sodium",
    "k":                   "potassium",
    "cl":                  "chloride",
    "cr":                  "creatinine",
    "urea nitrogen":       "urea",
    "blood urea nitrogen": "bun",
    "total cholesterol":   "cholesterol",
    "tg":                  "triglycerides",
    "trigs":               "triglycerides",
    "hdl-c":               "hdl",
    "hdl cholesterol":     "hdl",
    "ldl-c":               "ldl",
    "ldl cholesterol":     "ldl",
    "sgpt":                "alt",
    "sgot":                "ast",
    "thyroid stimulating": "tsh",
    "total calcium":       "calcium",
    "serum albumin":       "albumin",
    "total bilirubin":     "bilirubin",
    "serum ferritin":      "ferritin",
    "serum iron":          "iron",
    "25-oh vitamin d":     "vitamin d",
    "25(oh)d":             "vitamin d",
    "cobalamin":           "vitamin b12",
    "glycated hemoglobin": "hba1c",
    "glycated haemoglobin":"hba1c",
    "a1c":                 "hba1c",
    "mean corpuscular vol":"mcv",
    "mean corpuscular hemo":"mch",
    "erythrocyte sed":     "esr",
    "sed rate":            "esr",
    "c-reactive protein":  "crp",
    "urate":               "uric acid",
    # French aliases
    "magnésium":           "magnesium",
    "magnésie":            "magnesium",
    "glycémie":            "glucose",
    "glycemie":            "glucose",
    "hémoglobine":         "hemoglobin",
    "hemoglobine":         "hemoglobin",
    "globules rouges":     "rbc",
    "globules blancs":     "wbc",
    "plaquettes":          "platelets",
    "cholestérol":         "cholesterol",
    "cholesterol total":   "cholesterol",
    "triglycérides":       "triglycerides",
    "triglycerides":       "triglycerides",
    "créatinine":          "creatinine",
    "creatinine":          "creatinine",
    "urée":                "urea",
    "uree":                "urea",
    "calcium total":       "calcium",
    "fer sérique":         "iron",
    "fer":                 "iron",
    "bilirubine":          "bilirubin",
    "bilirubine totale":   "bilirubin",
    "albumine":            "albumin",
    "potassium":           "potassium",
    "sodium":              "sodium",
    "chlorures":           "chloride",
    "phosphore":           "phosphorus",
    "acide urique":        "uric acid",
    "protéine c réactive": "crp",
    "proteine c reactive": "crp",
    "vitesse sédimentation": "esr",
    "vs":                  "esr",
    "bicarbonates":        "bicarbonate",
    "bicarbonate":         "bicarbonate",
    "chlorure":            "chloride",
    "chlorures":           "chloride",
    "phosphate":           "phosphorus",
    "magnésium":           "magnesium",
    "magnesium":           "magnesium",
}


def normalize_label(label: str) -> str:
    """Lowercase, strip punctuation/spaces for matching. Handle accented chars."""
    label = label.lower()
    # Normalize accented French characters
    replacements = {"é":"e","è":"e","ê":"e","ë":"e","à":"a","â":"a","ô":"o","î":"i","û":"u","ç":"c","ù":"u"}
    for accented, plain in replacements.items():
        label = label.replace(accented, plain)
    return re.sub(r"[^a-z0-9 ]", "", label).strip()


def resolve_marker(raw_label: str) -> Optional[str]:
    """Map a raw OCR label to a canonical marker name."""
    norm = normalize_label(raw_label)
    if norm in REFERENCE_RANGES:
        return norm
    if norm in ALIASES:
        return ALIASES[norm]
    # partial match against aliases and direct keys
    for alias, canonical in ALIASES.items():
        if alias in norm or norm in alias:
            return canonical
    for key in REFERENCE_RANGES:
        if key in norm or norm in key:
            return key
    return None


def flag_value(canonical: str, value: float) -> str:
    """Return H (high), L (low), or N (normal) compared to reference range."""
    ref = REFERENCE_RANGES.get(canonical)
    if not ref:
        return "N/A"
    if value < ref["min"]:
        return "L"
    if value > ref["max"]:
        return "H"
    return "N"


def extract_patient_info(text: str) -> dict:
    """Try to extract patient name, DOB, date from the report header."""
    info = {}

    name_match = re.search(
        r"(?:patient|name|patient name)[:\s]+([A-Za-z ]{3,40})", text, re.IGNORECASE
    )
    if name_match:
        info["patient_name"] = name_match.group(1).strip()

    dob_match = re.search(
        r"(?:dob|date of birth|birth date)[:\s]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})",
        text, re.IGNORECASE,
    )
    if dob_match:
        info["date_of_birth"] = dob_match.group(1).strip()

    date_match = re.search(
        r"(?:date|collected|report date|sample date)[:\s]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})",
        text, re.IGNORECASE,
    )
    if date_match:
        info["report_date"] = date_match.group(1).strip()

    age_match = re.search(r"(?:age)[:\s]+(\d{1,3})\s*(?:y|yr|years)?", text, re.IGNORECASE)
    if age_match:
        info["age"] = int(age_match.group(1))

    gender_match = re.search(
        r"(?:sex|gender)[:\s]+(male|female|m|f)\b", text, re.IGNORECASE
    )
    if gender_match:
        raw = gender_match.group(1).upper()
        info["gender"] = "Male" if raw.startswith("M") else "Female"

    return info


def clean_line(line: str) -> str:
    """Remove common OCR table artifacts: brackets, pipes, underscores."""
    line = re.sub(r"[\[\]|_]", " ", line)
    # Normalize multiple spaces
    line = re.sub(r" {2,}", " ", line)
    return line.strip()


def extract_lab_rows(text: str) -> list:
    """
    Parses two line formats:

    Format A — patient result:
        Hemoglobin  13.5  g/dL  12.0 - 17.5

    Format B — reference table (no patient value):
        Sodium  Na+  135 - 145  mmol/L
        Bicarbonates  HCO3-  22 - 28  mmol/L
    """
    results = []

    # Format A: label  value  unit  [ref range]
    pattern_a = re.compile(
        r"^([A-Za-z\xc0-\xff][A-Za-z\xc0-\xff0-9\s]{1,30}?)\s+"
        r"(\d+[.,]\d+|\d+)\s+"
        r"([A-Za-z/%][A-Za-z0-9/%\xb5]*)"
        r"(?:\s+(\d+[.,]?\d*\s*[-\u2013]\s*\d+[.,]?\d*))?"
    )

    pattern_b = re.compile(
        r"^([A-Za-z\xc0-\xff][A-Za-z\xc0-\xff0-9\s]{1,25}?)\s+"
        r"[A-Za-z][A-Za-z0-9\+\-\^]*\s+"
        r"(\d+[.,]?\d*)\s*[-\u2013]\s*(\d+[.,]?\d*)\s*"
        r"([A-Za-z/%][A-Za-z0-9/%\xb5]*)?"
    )

    pattern_c = re.compile(
        r"^([A-Za-z\xc0-\xff][A-Za-z\xc0-\xff0-9\s]{1,25}?)\s+"
        r"[A-Za-z][A-Za-z0-9\+\-\^\\/\x27\u2019\.\*]*\s+"
        r"(\d+[.,]\d+|\d+)\s*"
        r"([A-Za-z/%][A-Za-z0-9/%\xb5]*)?"
    )

    skip_words = [
        "valeurs", "normale", "symbole", "parametre", "paramétre", "paramètre",
        "reference", "résultat", "resultat", "unite", "unité",
        "bilan", "analyse", "examen", "test name", "result", "range"
    ]

    for line in text.splitlines():
        line = clean_line(line)
        if not line or len(line) < 4:
            continue
        if any(s in line.lower() for s in skip_words):
            continue
        # Skip noisy lines (less than 20% alphabetic characters)
        if sum(c.isalpha() for c in line) / len(line) < 0.2:
            continue
        # Skip lines where no single word is longer than 3 chars (pure noise)
        words = line.split()
        if not any(len(w) >= 4 and w.replace("é","e").replace("è","e").replace("à","a").isalpha() for w in words):
            continue

        # Try Format A first (has a single patient value)
        m = pattern_a.match(line)
        if m:
            raw_label = m.group(1).strip()
            value     = float(m.group(2).replace(",", "."))
            unit      = m.group(3).strip()
            ref       = (m.group(4) or "").strip()
            canonical = resolve_marker(raw_label)
            ref_range = REFERENCE_RANGES.get(canonical, {}) if canonical else {}
            results.append({
                "label":           raw_label,
                "canonical_name":  canonical,
                "value":           value,
                "unit":            unit or ref_range.get("unit", ""),
                "reference_range": ref or (f"{ref_range['min']} - {ref_range['max']}" if ref_range else ""),
                "flag":            flag_value(canonical, value) if canonical else "N/A",
            })
            continue

        # Try Format B (reference table — no patient value)
        m = pattern_b.match(line)
        if m:
            raw_label = m.group(1).strip()
            ref_min   = float(m.group(2).replace(",", "."))
            ref_max   = float(m.group(3).replace(",", "."))
            unit      = (m.group(4) or "").strip()
            canonical = resolve_marker(raw_label)
            results.append({
                "label":           raw_label,
                "canonical_name":  canonical,
                "value":           None,
                "unit":            unit,
                "reference_range": f"{ref_min} - {ref_max}",
                "flag":            "N/A",
            })
            continue

        # Try Format C (patient result with symbol column)
        m = pattern_c.match(line)
        if m:
            raw_label = m.group(1).strip()
            value     = float(m.group(2).replace(",", "."))
            unit      = (m.group(3) or "").strip()
            canonical = resolve_marker(raw_label)
            ref_range = REFERENCE_RANGES.get(canonical, {}) if canonical else {}
            results.append({
                "label":           raw_label,
                "canonical_name":  canonical,
                "value":           value,
                "unit":            unit or ref_range.get("unit", ""),
                "reference_range": f"{ref_range['min']} - {ref_range['max']}" if ref_range else "",
                "flag":            flag_value(canonical, value) if canonical else "N/A",
            })

    return results


def parse_lab_results(raw_text: str) -> dict:
    """
    Top-level function: parse OCR text into a structured JSON-ready dict.
    """
    patient_info = extract_patient_info(raw_text)
    lab_values   = extract_lab_rows(raw_text)

    abnormal = [r for r in lab_values if r["flag"] in ("H", "L")]

    return {
        "status":        "success",
        "parsed_at":     datetime.utcnow().isoformat() + "Z",
        "patient_info":  patient_info,
        "lab_results":   lab_values,
        "summary": {
            "total_markers":    len(lab_values),
            "abnormal_count":   len(abnormal),
            "abnormal_markers": [r["canonical_name"] or r["label"] for r in abnormal],
        },
    }