# PDFTools – Full Stack PDF Website

An iLovePDF-style website with **25+ working PDF tools**, React frontend, and FastAPI backend.

## Tools Included

### Organize PDF
- ✅ Merge PDF – combine multiple PDFs
- ✅ Split PDF – extract specific pages
- ✅ Organize Pages – reorder pages
- ✅ Remove Pages – delete specific pages
- ✅ Rotate PDF – 90°/180°/270°

### Optimize PDF
- ✅ Compress PDF – reduce file size (PyMuPDF)
- ✅ Crop PDF – trim margins
- ✅ Add Page Numbers

### PDF Security
- ✅ Protect PDF – add password
- ✅ Unlock PDF – remove password
- ✅ Watermark PDF – text watermark

### Convert from PDF
- ✅ PDF to Word (.docx)
- ✅ PDF to Excel (.xlsx) – with table extraction
- ✅ PDF to PowerPoint (.pptx) – page screenshots
- ✅ PDF to JPG – all pages as images
- ✅ Extract Text
- ✅ Extract Images

### Convert to PDF
- ✅ JPG to PDF
- ✅ Word to PDF (LibreOffice)
- ✅ Excel to PDF (LibreOffice)
- ✅ PowerPoint to PDF (LibreOffice)
- ✅ HTML to PDF (LibreOffice)

### Advanced
- ✅ OCR PDF – extract text from scanned PDFs (Tesseract)
- ✅ Redact PDF – permanently strip sensitive text/areas (PyMuPDF real redaction, not a visual cover-up)
- ✅ Edit PDF – add text, rectangles, circles or lines directly onto a page
- ✅ Sign PDF – stamp a signature image at a chosen position
- ✅ Compare PDF – text-diff report between two versions of a document
- ✅ Scan to PDF – assemble cleaned-up photos into a multi-page PDF
- ✅ PDF to PDF/A – convert to the ISO archival format (Ghostscript)
- ✅ Repair PDF – recover data from a corrupted PDF (pypdf, falls back to Ghostscript)

## Local Development

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**System dependencies (Ubuntu/Debian):**
```bash
sudo apt install libreoffice tesseract-ocr poppler-utils ghostscript
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env      # set VITE_API_URL=http://localhost:8000
npm run dev
```

## Deployment

### Backend → Render
1. Connect repo to Render
2. Build: `pip install -r backend/requirements.txt`
3. Start: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`
4. Set env var: `PYTHON_VERSION=3.11`
5. Add `apt` packages in Render dashboard: `libreoffice tesseract-ocr poppler-utils ghostscript`
   (ghostscript is new — needed by PDF to PDF/A and by Repair PDF's fallback path)

### Frontend → Vercel
1. Connect `frontend/` folder to Vercel
2. Set env var: `VITE_API_URL=https://your-render-url.onrender.com`
3. Deploy – `vercel.json` handles SPA routing automatically

## Tech Stack
- **Frontend:** React 18 + Vite (no extra UI libraries)
- **Backend:** FastAPI + Uvicorn
- **PDF Processing:** PyMuPDF (fitz), pypdf, pdfplumber, python-docx, openpyxl, python-pptx, reportlab
- **System Tools:** LibreOffice, Tesseract OCR, poppler-utils, Ghostscript
