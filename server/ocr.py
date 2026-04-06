import pytesseract
from PIL import Image, ImageFilter, ImageEnhance
import numpy as np

pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"


def preprocess_image(image: Image.Image) -> Image.Image:
    if image.mode != "RGB":
        image = image.convert("RGB")
    image = image.convert("L")

    w, h = image.size
    if w < 1800:
        scale = 1800 / w
        image = image.resize((int(w * scale), int(h * scale)), Image.LANCZOS)

    arr = np.array(image, dtype=np.uint8)

    # Invert dark header rows (grey bg + white text)
    row_means = arr.mean(axis=1)
    for i, mean in enumerate(row_means):
        if 60 < mean < 170 and (arr[i] < 100).mean() > 0.15:
            arr[i] = 255 - arr[i]

    image = Image.fromarray(arr)
    image = ImageEnhance.Contrast(image).enhance(2.0)
    image = image.filter(ImageFilter.SHARPEN)
    return image


def find_table_columns(arr: np.ndarray):
    """
    Detect column boundaries by finding vertical dark lines (separators).
    Returns list of (x_start, x_end) for each column.
    """
    col_dark = (arr < 80).mean(axis=0)
    
    # Find separator positions: columns that are mostly dark
    separators = []
    in_sep = False
    sep_start = 0
    for j in range(arr.shape[1]):
        if col_dark[j] > 0.3 and not in_sep:
            in_sep = True
            sep_start = j
        elif col_dark[j] <= 0.3 and in_sep:
            in_sep = False
            sep_mid = (sep_start + j) // 2
            separators.append(sep_mid)

    if len(separators) < 2:
        return None  # can't detect columns

    # Build column ranges from separators
    cols = []
    for i in range(len(separators) - 1):
        cols.append((separators[i], separators[i+1]))
    return cols


def find_table_rows(arr: np.ndarray):
    """
    Detect row boundaries by finding horizontal dark lines.
    Returns list of (y_start, y_end) for each row.
    """
    row_dark = (arr < 80).mean(axis=1)

    separators = []
    in_sep = False
    sep_start = 0
    for i in range(arr.shape[0]):
        if row_dark[i] > 0.3 and not in_sep:
            in_sep = True
            sep_start = i
        elif row_dark[i] <= 0.3 and in_sep:
            in_sep = False
            sep_mid = (sep_start + i) // 2
            separators.append(sep_mid)

    if len(separators) < 2:
        return None

    rows = []
    for i in range(len(separators) - 1):
        rows.append((separators[i], separators[i+1]))
    return rows


def ocr_cell(image: Image.Image, x1: int, y1: int, x2: int, y2: int) -> str:
    """Crop a single cell and run OCR on it."""
    pad = 4
    cell = image.crop((
        max(0, x1 + pad),
        max(0, y1 + pad),
        min(image.width, x2 - pad),
        min(image.height, y2 - pad)
    ))
    # PSM 7 = single line of text, best for individual cells
    text = pytesseract.image_to_string(cell, config=r"--oem 3 --psm 7").strip()
    # Clean up common OCR noise
    text = text.replace("|", "").replace("[", "").replace("]", "").replace("_", "").strip()
    return text


def extract_text_from_image(image: Image.Image) -> str:
    processed = preprocess_image(image)
    arr = np.array(processed, dtype=np.uint8)

    cols = find_table_columns(arr)
    rows = find_table_rows(arr)

    # If we can detect the table grid, read cell by cell
    if cols and rows and len(cols) >= 2 and len(rows) >= 2:
        lines = []
        for y1, y2 in rows:
            row_cells = []
            for x1, x2 in cols:
                cell_text = ocr_cell(processed, x1, y1, x2, y2)
                if cell_text:
                    row_cells.append(cell_text)
            if row_cells:
                lines.append("  ".join(row_cells))
        if lines:
            return "\n".join(lines)

    # Fallback: plain OCR
    return pytesseract.image_to_string(processed, config=r"--oem 3 --psm 6")