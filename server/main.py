import uvicorn
from fastapi import FastAPI, File, UploadFile, HTTPException
from pydantic import BaseModel
from pathlib import Path
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
import io

from ocr import extract_text_from_image
from parser import parse_lab_results

app = FastAPI(
    title="Medical OCR API",
    description="Extract structured lab results from medical images using Tesseract OCR",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict in production to your webapp's domain
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"status": "ok", "message": "Medical OCR API is running"}


@app.get("/health")
def health():
    return {"status": "healthy"}


class FilePathRequest(BaseModel):
    path: str


@app.post("/ocr/lab-results-from-path")
def ocr_from_path(body: FilePathRequest):
    """
    Provide a local file path to a blood test image.
    Useful for testing without a frontend.
    Example body: { "path": "C:/Users/Administrator/Desktop/lab.jpg" }
    """
    file_path = Path(body.path)

    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"File not found: {body.path}")

    if not file_path.suffix.lower() in (".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".tif", ".webp"):
        raise HTTPException(status_code=400, detail="File must be an image (jpg, png, bmp, tiff, webp)")

    try:
        image = Image.open(file_path)
    except Exception:
        raise HTTPException(status_code=400, detail="Could not open image file")

    raw_text = extract_text_from_image(image)

    if not raw_text.strip():
        raise HTTPException(status_code=422, detail="No text could be extracted from the image")

    result = parse_lab_results(raw_text)
    result["raw_text"] = raw_text

    return result


@app.post("/ocr/lab-results")
async def ocr_lab_results(file: UploadFile = File(...)):
    """
    Upload an image of a blood test report.
    Returns a structured JSON with patient info and lab values.
    """
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image (JPEG, PNG, etc.)")

    contents = await file.read()
    try:
        image = Image.open(io.BytesIO(contents))
    except Exception:
        raise HTTPException(status_code=400, detail="Could not open image file")

    raw_text = extract_text_from_image(image)

    if not raw_text.strip():
        raise HTTPException(status_code=422, detail="No text could be extracted from the image")

    result = parse_lab_results(raw_text)
    result["raw_text"] = raw_text  # include for debugging; remove in production if desired

    return result