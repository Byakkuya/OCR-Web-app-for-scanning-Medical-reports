# Electrolytes Analyzer Setup Guide

This guide installs the tools and dependencies needed to run both parts of the project on Windows:

- Frontend: [Front/](Front)
- Backend: [server/](server)

## 1. Prerequisites

Install these first:

- Node.js LTS 18 or newer
- Python 3.10 or newer
- Tesseract OCR for Windows
- Git

## 2. Install Tesseract OCR

The backend uses `pytesseract`, but it also needs the Tesseract executable installed on your machine.

1. Download and install Tesseract OCR for Windows.
2. Make sure the executable is available at:

   `C:\Program Files\Tesseract-OCR\tesseract.exe`

3. If you install it somewhere else, update the path in [server/ocr.py](server/ocr.py) so it matches your system.

## 3. Install Frontend Dependencies

Open PowerShell in the repository root and run:

```powershell
cd Front
npm install
```

This installs the frontend dependencies used by the React app:

- `react`
- `react-dom`
- `react-router-dom`
- `lucide-react`
- `jspdf`
- `jspdf-autotable`
- `vite`
- `tailwindcss`
- `postcss`
- `autoprefixer`
- `eslint`
- `prettier`

## 4. Install Backend Dependencies

Create and activate a virtual environment first:

```powershell
cd server
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

Then install the Python packages:

```powershell
pip install -r requirements.txt
```

The backend currently uses these Python packages:

- `fastapi`
- `uvicorn[standard]`
- `pytesseract`
- `Pillow`
- `python-multipart`
- `numpy`

Recommended extra package:

- `pydantic` is imported in [server/main.py](server/main.py) and is usually installed transitively by FastAPI, but you can install it explicitly if you want the environment to be fully explicit:

```powershell
pip install pydantic
```

## 5. Run the Backend

Stay inside the `server` folder and run:

```powershell
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

If Tesseract is installed in a different location, confirm that [server/ocr.py](server/ocr.py) points to the correct executable path.

## 6. Run the Frontend

Open a second terminal and run:

```powershell
cd Front
npm run dev
```

The Vite app will start locally, usually at `http://localhost:5173`.

## 7. Connect Frontend to Backend

By default, the frontend sends requests to:

`http://127.0.0.1:8000`

If you want to change it, set `VITE_API_BASE_URL` before starting the frontend.

Example in PowerShell:

```powershell
$env:VITE_API_BASE_URL = 'http://127.0.0.1:8000'
npm run dev
```

## 8. Quick Verification

After both apps are running:

1. Open the frontend in your browser.
2. Upload a blood test image.
3. Confirm the backend returns OCR results.
4. Check the doctor page at `/doctor` if you want to review saved reports.

## 9. Troubleshooting

- If image OCR fails, verify that Tesseract is installed and the path in [server/ocr.py](server/ocr.py) is correct.
- If `pip install -r requirements.txt` fails, upgrade pip first:

  ```powershell
  python -m pip install --upgrade pip
  ```

- If the frontend cannot reach the backend, make sure both servers are running and CORS is allowed in [server/main.py](server/main.py).
