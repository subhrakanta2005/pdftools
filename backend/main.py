import os
import io
import json
import shutil
import tempfile
import zipfile
import subprocess
from contextlib import asynccontextmanager
from pathlib import Path
from typing import List, Optional

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware

from .core.database import connect_db, close_db
from .core.config import settings
from .core.deps import get_optional_user
from .core.limits import check_file_size, check_tool_access, check_and_increment_ops
from .core.background import start_background_tasks, cleanup_temp_files
from .routers import auth as auth_router
from .routers import payments as payments_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    await cleanup_temp_files()  # clean stale files on startup
    app_url = os.getenv("RENDER_EXTERNAL_URL", "")
    start_background_tasks(app_url)
    yield
    await close_db()


app = FastAPI(title="PDFTools API", version="2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router)
app.include_router(payments_router.router)

UPLOAD_DIR = Path(tempfile.gettempdir()) / "pdftools"
UPLOAD_DIR.mkdir(exist_ok=True)


async def save_upload_checked(file: UploadFile, user=None, tool_id: str = "") -> Path:
    """Save upload after checking file size, tool access, and rate limits."""
    data = await file.read()
    await check_file_size(len(data), user)
    await check_tool_access(tool_id, user)
    db_ref = None
    try:
        from .core.database import get_db
        db_ref = get_db()
    except Exception:
        pass
    if db_ref is not None:
        await check_and_increment_ops(user, db_ref, tool_id)
    dest = UPLOAD_DIR / file.filename
    dest.write_bytes(data)
    return dest


def stream_file(path: Path, media_type: str = "application/pdf", filename: str = None):
    filename = filename or path.name
    return FileResponse(
        path,
        media_type=media_type,
        filename=filename,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def save_upload(file: UploadFile) -> Path:
    """Sync helper for endpoints not yet using auth checks."""
    dest = UPLOAD_DIR / file.filename
    dest.write_bytes(file.file.read())
    return dest


# ─── MERGE ──────────────────────────────────────────────────────────────────
@app.post("/merge")
async def merge_pdfs(files: List[UploadFile] = File(...), user=Depends(get_optional_user)):
    from pypdf import PdfWriter, PdfReader
    writer = PdfWriter()
    for i, f in enumerate(files):
        data = await f.read()
        if i == 0:
            await check_file_size(len(data), user)
            await check_tool_access("merge", user)
            try:
                from .core.database import get_db
                await check_and_increment_ops(user, get_db(), "merge")
            except Exception:
                pass
        path = UPLOAD_DIR / f.filename
        path.write_bytes(data)
        reader = PdfReader(str(path))
        for page in reader.pages:
            writer.add_page(page)
    out = UPLOAD_DIR / "merged.pdf"
    with open(out, "wb") as fp:
        writer.write(fp)
    return stream_file(out, filename="merged.pdf")


# ─── SPLIT ──────────────────────────────────────────────────────────────────
@app.post("/split")
async def split_pdf(file: UploadFile = File(...), pages: str = Form(...)):
    from pypdf import PdfReader, PdfWriter
    path = save_upload(file)
    reader = PdfReader(str(path))
    total = len(reader.pages)

    # Parse page ranges e.g. "1-3,5,7-9"
    selected = set()
    for part in pages.split(","):
        part = part.strip()
        if "-" in part:
            a, b = part.split("-")
            selected.update(range(int(a) - 1, min(int(b), total)))
        else:
            selected.add(int(part) - 1)

    zip_buf = io.BytesIO()
    with zipfile.ZipFile(zip_buf, "w") as zf:
        for i, idx in enumerate(sorted(selected)):
            if 0 <= idx < total:
                writer = PdfWriter()
                writer.add_page(reader.pages[idx])
                buf = io.BytesIO()
                writer.write(buf)
                zf.writestr(f"page_{idx+1}.pdf", buf.getvalue())
    zip_buf.seek(0)
    return StreamingResponse(
        zip_buf,
        media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="split_pages.zip"'},
    )


# ─── COMPRESS ────────────────────────────────────────────────────────────────
@app.post("/compress")
async def compress_pdf(file: UploadFile = File(...)):
    import fitz
    path = save_upload(file)
    out = UPLOAD_DIR / "compressed.pdf"
    doc = fitz.open(str(path))
    doc.save(str(out), deflate=True, garbage=4, clean=True)
    doc.close()
    return stream_file(out, filename="compressed.pdf")


# ─── ROTATE ──────────────────────────────────────────────────────────────────
@app.post("/rotate")
async def rotate_pdf(file: UploadFile = File(...), angle: int = Form(90)):
    from pypdf import PdfReader, PdfWriter
    path = save_upload(file)
    reader = PdfReader(str(path))
    writer = PdfWriter()
    for page in reader.pages:
        page.rotate(angle)
        writer.add_page(page)
    out = UPLOAD_DIR / "rotated.pdf"
    with open(out, "wb") as fp:
        writer.write(fp)
    return stream_file(out, filename="rotated.pdf")


# ─── REMOVE PAGES ────────────────────────────────────────────────────────────
@app.post("/remove-pages")
async def remove_pages(file: UploadFile = File(...), pages: str = Form(...)):
    from pypdf import PdfReader, PdfWriter
    path = save_upload(file)
    reader = PdfReader(str(path))
    total = len(reader.pages)

    to_remove = set()
    for part in pages.split(","):
        part = part.strip()
        if "-" in part:
            a, b = part.split("-")
            to_remove.update(range(int(a) - 1, min(int(b), total)))
        else:
            to_remove.add(int(part) - 1)

    writer = PdfWriter()
    for i, page in enumerate(reader.pages):
        if i not in to_remove:
            writer.add_page(page)

    out = UPLOAD_DIR / "removed_pages.pdf"
    with open(out, "wb") as fp:
        writer.write(fp)
    return stream_file(out, filename="removed_pages.pdf")


# ─── REORDER / ORGANIZE PAGES ────────────────────────────────────────────────
@app.post("/reorder")
async def reorder_pages(file: UploadFile = File(...), order: str = Form(...)):
    from pypdf import PdfReader, PdfWriter
    path = save_upload(file)
    reader = PdfReader(str(path))
    indices = [int(x.strip()) - 1 for x in order.split(",")]
    writer = PdfWriter()
    for idx in indices:
        if 0 <= idx < len(reader.pages):
            writer.add_page(reader.pages[idx])
    out = UPLOAD_DIR / "reordered.pdf"
    with open(out, "wb") as fp:
        writer.write(fp)
    return stream_file(out, filename="reordered.pdf")


# ─── CROP ────────────────────────────────────────────────────────────────────
@app.post("/crop")
async def crop_pdf(
    file: UploadFile = File(...),
    x1: float = Form(0), y1: float = Form(0),
    x2: float = Form(595), y2: float = Form(842),
):
    import fitz
    path = save_upload(file)
    doc = fitz.open(str(path))
    out_doc = fitz.open()
    clip = fitz.Rect(x1, y1, x2, y2)
    for page in doc:
        page.set_cropbox(clip)
        out_doc.insert_pdf(doc, from_page=page.number, to_page=page.number)
    out = UPLOAD_DIR / "cropped.pdf"
    out_doc.save(str(out))
    out_doc.close()
    return stream_file(out, filename="cropped.pdf")


# ─── WATERMARK ───────────────────────────────────────────────────────────────
@app.post("/watermark")
async def watermark_pdf(
    file: UploadFile = File(...),
    text: str = Form("WATERMARK"),
    opacity: float = Form(0.3),
):
    import fitz
    path = save_upload(file)
    doc = fitz.open(str(path))
    for page in doc:
        w, h = page.rect.width, page.rect.height
        page.insert_text(
            fitz.Point(w * 0.15, h * 0.55),
            text,
            fontsize=60,
            color=(0.5, 0.5, 0.5),
            rotate=45,
            overlay=True,
        )
    out = UPLOAD_DIR / "watermarked.pdf"
    doc.save(str(out))
    return stream_file(out, filename="watermarked.pdf")


# ─── PROTECT ────────────────────────────────────────────────────────────────
@app.post("/protect")
async def protect_pdf(file: UploadFile = File(...), password: str = Form(...)):
    from pypdf import PdfReader, PdfWriter
    path = save_upload(file)
    reader = PdfReader(str(path))
    writer = PdfWriter()
    for page in reader.pages:
        writer.add_page(page)
    writer.encrypt(password)
    out = UPLOAD_DIR / "protected.pdf"
    with open(out, "wb") as fp:
        writer.write(fp)
    return stream_file(out, filename="protected.pdf")


# ─── UNLOCK ─────────────────────────────────────────────────────────────────
@app.post("/unlock")
async def unlock_pdf(file: UploadFile = File(...), password: str = Form(...)):
    from pypdf import PdfReader, PdfWriter
    path = save_upload(file)
    reader = PdfReader(str(path))
    if reader.is_encrypted:
        reader.decrypt(password)
    writer = PdfWriter()
    for page in reader.pages:
        writer.add_page(page)
    out = UPLOAD_DIR / "unlocked.pdf"
    with open(out, "wb") as fp:
        writer.write(fp)
    return stream_file(out, filename="unlocked.pdf")


# ─── EXTRACT TEXT ───────────────────────────────────────────────────────────
@app.post("/extract-text")
async def extract_text(file: UploadFile = File(...)):
    import pdfplumber
    path = save_upload(file)
    text_parts = []
    with pdfplumber.open(str(path)) as pdf:
        for i, page in enumerate(pdf.pages):
            text_parts.append(f"=== Page {i+1} ===\n{page.extract_text() or ''}")
    full_text = "\n\n".join(text_parts)
    out = UPLOAD_DIR / "extracted_text.txt"
    out.write_text(full_text, encoding="utf-8")
    return FileResponse(
        out,
        media_type="text/plain",
        filename="extracted_text.txt",
        headers={"Content-Disposition": 'attachment; filename="extracted_text.txt"'},
    )


# ─── ADD PAGE NUMBERS ────────────────────────────────────────────────────────
@app.post("/page-numbers")
async def add_page_numbers(
    file: UploadFile = File(...),
    position: str = Form("bottom-center"),
    start: int = Form(1),
):
    import fitz
    path = save_upload(file)
    doc = fitz.open(str(path))
    for i, page in enumerate(doc):
        num = start + i
        w, h = page.rect.width, page.rect.height
        if position == "bottom-center":
            pt = fitz.Point(w / 2 - 10, h - 20)
        elif position == "top-center":
            pt = fitz.Point(w / 2 - 10, 30)
        elif position == "bottom-right":
            pt = fitz.Point(w - 50, h - 20)
        else:
            pt = fitz.Point(20, h - 20)
        page.insert_text(pt, str(num), fontsize=11, color=(0, 0, 0))
    out = UPLOAD_DIR / "numbered.pdf"
    doc.save(str(out))
    return stream_file(out, filename="numbered.pdf")


# ─── PDF → JPG ───────────────────────────────────────────────────────────────
@app.post("/pdf-to-jpg")
async def pdf_to_jpg(file: UploadFile = File(...), dpi: int = Form(150)):
    import fitz
    path = save_upload(file)
    doc = fitz.open(str(path))
    zip_buf = io.BytesIO()
    with zipfile.ZipFile(zip_buf, "w") as zf:
        for i, page in enumerate(doc):
            mat = fitz.Matrix(dpi / 72, dpi / 72)
            pix = page.get_pixmap(matrix=mat)
            zf.writestr(f"page_{i+1}.jpg", pix.tobytes("jpeg"))
    zip_buf.seek(0)
    return StreamingResponse(
        zip_buf,
        media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="pdf_pages.zip"'},
    )


# ─── JPG → PDF ───────────────────────────────────────────────────────────────
@app.post("/jpg-to-pdf")
async def jpg_to_pdf(files: List[UploadFile] = File(...)):
    import fitz
    doc = fitz.open()
    for f in files:
        path = save_upload(f)
        img_doc = fitz.open(str(path))
        rect = img_doc[0].rect
        pdfbytes = img_doc.convert_to_pdf()
        img_doc.close()
        img_pdf = fitz.open("pdf", pdfbytes)
        doc.insert_pdf(img_pdf)
    out = UPLOAD_DIR / "images.pdf"
    doc.save(str(out))
    return stream_file(out, filename="images.pdf")


# ─── PDF → WORD ──────────────────────────────────────────────────────────────
@app.post("/pdf-to-word")
async def pdf_to_word(file: UploadFile = File(...)):
    import pdfplumber
    from docx import Document
    path = save_upload(file)
    doc = Document()
    doc.add_heading("Extracted from PDF", 0)
    with pdfplumber.open(str(path)) as pdf:
        for i, page in enumerate(pdf.pages):
            doc.add_heading(f"Page {i+1}", level=1)
            text = page.extract_text() or ""
            for line in text.split("\n"):
                doc.add_paragraph(line)
    out = UPLOAD_DIR / "converted.docx"
    doc.save(str(out))
    return FileResponse(
        out,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        filename="converted.docx",
    )


# ─── PDF → EXCEL ─────────────────────────────────────────────────────────────
@app.post("/pdf-to-excel")
async def pdf_to_excel(file: UploadFile = File(...)):
    import pdfplumber
    import openpyxl
    path = save_upload(file)
    wb = openpyxl.Workbook()
    with pdfplumber.open(str(path)) as pdf:
        for i, page in enumerate(pdf.pages):
            ws = wb.create_sheet(title=f"Page {i+1}")
            tables = page.extract_tables()
            if tables:
                for table in tables:
                    for row in table:
                        ws.append([cell or "" for cell in row])
            else:
                text = page.extract_text() or ""
                for line in text.split("\n"):
                    ws.append([line])
    if "Sheet" in wb.sheetnames:
        del wb["Sheet"]
    out = UPLOAD_DIR / "converted.xlsx"
    wb.save(str(out))
    return FileResponse(
        out,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename="converted.xlsx",
    )


# ─── PDF → POWERPOINT ────────────────────────────────────────────────────────
@app.post("/pdf-to-pptx")
async def pdf_to_pptx(file: UploadFile = File(...)):
    import fitz
    from pptx import Presentation
    from pptx.util import Inches, Pt
    path = save_upload(file)
    doc = fitz.open(str(path))
    prs = Presentation()
    prs.slide_width = Inches(10)
    prs.slide_height = Inches(7.5)
    blank_layout = prs.slide_layouts[6]
    for i, page in enumerate(doc):
        mat = fitz.Matrix(1.5, 1.5)
        pix = page.get_pixmap(matrix=mat)
        img_path = UPLOAD_DIR / f"slide_{i}.png"
        pix.save(str(img_path))
        slide = prs.slides.add_slide(blank_layout)
        slide.shapes.add_picture(str(img_path), 0, 0, prs.slide_width, prs.slide_height)
    out = UPLOAD_DIR / "converted.pptx"
    prs.save(str(out))
    return FileResponse(
        out,
        media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
        filename="converted.pptx",
    )


# ─── WORD → PDF ──────────────────────────────────────────────────────────────
@app.post("/word-to-pdf")
async def word_to_pdf(file: UploadFile = File(...)):
    path = save_upload(file)
    result = subprocess.run(
        ["libreoffice", "--headless", "--convert-to", "pdf", "--outdir", str(UPLOAD_DIR), str(path)],
        capture_output=True, text=True, timeout=60
    )
    out_name = path.stem + ".pdf"
    out = UPLOAD_DIR / out_name
    if not out.exists():
        raise HTTPException(500, f"Conversion failed: {result.stderr}")
    return stream_file(out, filename="converted.pdf")


# ─── EXCEL → PDF ─────────────────────────────────────────────────────────────
@app.post("/excel-to-pdf")
async def excel_to_pdf(file: UploadFile = File(...)):
    path = save_upload(file)
    result = subprocess.run(
        ["libreoffice", "--headless", "--convert-to", "pdf", "--outdir", str(UPLOAD_DIR), str(path)],
        capture_output=True, text=True, timeout=60
    )
    out_name = path.stem + ".pdf"
    out = UPLOAD_DIR / out_name
    if not out.exists():
        raise HTTPException(500, f"Conversion failed: {result.stderr}")
    return stream_file(out, filename="converted.pdf")


# ─── PPTX → PDF ──────────────────────────────────────────────────────────────
@app.post("/pptx-to-pdf")
async def pptx_to_pdf(file: UploadFile = File(...)):
    path = save_upload(file)
    result = subprocess.run(
        ["libreoffice", "--headless", "--convert-to", "pdf", "--outdir", str(UPLOAD_DIR), str(path)],
        capture_output=True, text=True, timeout=60
    )
    out_name = path.stem + ".pdf"
    out = UPLOAD_DIR / out_name
    if not out.exists():
        raise HTTPException(500, f"Conversion failed: {result.stderr}")
    return stream_file(out, filename="converted.pdf")


# ─── HTML → PDF ──────────────────────────────────────────────────────────────
@app.post("/html-to-pdf")
async def html_to_pdf(file: UploadFile = File(...)):
    path = save_upload(file)
    out = UPLOAD_DIR / "converted.pdf"
    result = subprocess.run(
        ["libreoffice", "--headless", "--convert-to", "pdf", "--outdir", str(UPLOAD_DIR), str(path)],
        capture_output=True, text=True, timeout=60
    )
    out_name = path.stem + ".pdf"
    out = UPLOAD_DIR / out_name
    if not out.exists():
        # fallback: wkhtmltopdf if available
        result2 = subprocess.run(
            ["wkhtmltopdf", str(path), str(UPLOAD_DIR / "converted.pdf")],
            capture_output=True, text=True, timeout=60
        )
        out = UPLOAD_DIR / "converted.pdf"
        if not out.exists():
            raise HTTPException(500, "HTML to PDF conversion failed")
    return stream_file(out, filename="converted.pdf")


# ─── OCR ────────────────────────────────────────────────────────────────────
@app.post("/ocr")
async def ocr_pdf(file: UploadFile = File(...), user=Depends(get_optional_user)):
    import fitz
    import pytesseract
    from PIL import Image
    from .core.limits import get_limits
    path = await save_upload_checked(file, user, "ocr")
    limits = get_limits(user)
    page_limit = limits["ocr_page_limit"]
    doc = fitz.open(str(path))
    text_parts = []
    for i, page in enumerate(doc):
        if page_limit is not None and i >= page_limit:
            text_parts.append(f"=== Page {i+1} === [upgrade to Pro to OCR all pages]")
            continue
        mat = fitz.Matrix(2, 2)
        pix = page.get_pixmap(matrix=mat)
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        txt = pytesseract.image_to_string(img)
        text_parts.append(f"=== Page {i+1} ===\n{txt}")
    out = UPLOAD_DIR / "ocr_output.txt"
    out.write_text("\n\n".join(text_parts), encoding="utf-8")
    return FileResponse(out, media_type="text/plain", filename="ocr_output.txt")


# ─── EXTRACT IMAGES ──────────────────────────────────────────────────────────
@app.post("/extract-images")
async def extract_images(file: UploadFile = File(...)):
    import fitz
    path = save_upload(file)
    doc = fitz.open(str(path))
    zip_buf = io.BytesIO()
    count = 0
    with zipfile.ZipFile(zip_buf, "w") as zf:
        for i, page in enumerate(doc):
            for j, img_info in enumerate(page.get_images(full=True)):
                xref = img_info[0]
                base_image = doc.extract_image(xref)
                zf.writestr(f"page{i+1}_img{j+1}.{base_image['ext']}", base_image["image"])
                count += 1
    if count == 0:
        raise HTTPException(404, "No images found in PDF")
    zip_buf.seek(0)
    return StreamingResponse(
        zip_buf,
        media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="extracted_images.zip"'},
    )


# ─── PAGE COUNT / INFO ───────────────────────────────────────────────────────
@app.post("/info")
async def pdf_info(file: UploadFile = File(...)):
    from pypdf import PdfReader
    path = save_upload(file)
    reader = PdfReader(str(path))
    meta = reader.metadata or {}
    return {
        "pages": len(reader.pages),
        "title": meta.get("/Title", ""),
        "author": meta.get("/Author", ""),
        "subject": meta.get("/Subject", ""),
        "creator": meta.get("/Creator", ""),
        "encrypted": reader.is_encrypted,
    }


@app.get("/health")
def health():
    return {"status": "ok"}
