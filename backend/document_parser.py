# document_parser.py — Pluggable document text-extraction pipeline
#
# Legal Box lets the user pick an extraction engine (Settings → Document
# Processing), trading speed for layout fidelity, with automatic fallback.
# No AGPL dependencies: PyMuPDF (AGPL) has been removed in favour of
# permissively-licensed engines.
#
#   Engine    PDF backend        Other formats         License      Weight
#   ───────   ────────────────   ───────────────────   ──────────   ──────
#   fast      pdfplumber         MarkItDown (docx,      MIT          light
#   (default)                    pptx, xlsx, html…)
#   accurate  Docling            Docling                MIT          heavy*
#                                                                    (*model
#                                                                     weights)
#
# OCR (scanned/image-only PDFs) is an opt-in toggle backed by Tesseract
# (Apache 2.0); off by default, and image-only PDFs are detected so the UI
# can prompt the user to enable it instead of failing.
#
# Credits (see NOTICE.md):
#   - MarkItDown — Microsoft, MIT — https://github.com/microsoft/markitdown
#   - Docling — IBM, MIT — https://github.com/docling-project/docling
#   - pdfplumber — MIT — https://github.com/jsvine/pdfplumber
#   - Tesseract — Apache 2.0 — https://github.com/tesseract-ocr/tesseract
#
# Usage:
#   from document_parser import parse_document
#   result = parse_document("/path/to/file.pdf")          # -> ParseResult
#   text = parse_document("/path/to/file.pdf").text       # convenience

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional

# Engine identifiers
ENGINE_FAST = "fast"
ENGINE_ACCURATE = "accurate"
DEFAULT_ENGINE = ENGINE_FAST

SUPPORTED_EXTENSIONS = {".pdf", ".docx", ".pptx", ".xlsx", ".html", ".htm", ".txt", ".md"}


class ScannedPDFError(RuntimeError):
    """Raised when a PDF has no extractable text (likely scanned images).

    The caller should suggest enabling OCR rather than showing a raw error.
    """


class LegacyDocError(ValueError):
    """Raised for legacy binary .doc files, which need re-saving as .docx."""


@dataclass
class ParseResult:
    text: str
    engine: str                      # engine that actually produced the text
    ocr_used: bool = False
    warnings: List[str] = field(default_factory=list)

    def __str__(self) -> str:        # so existing `str(parse_document(...))` still works
        return self.text


# ──────────────────────────────────────────────
# PUBLIC ENTRY POINT
# ──────────────────────────────────────────────

def parse_document(
    file_path: str,
    engine: Optional[str] = None,
    ocr: Optional[bool] = None,
) -> ParseResult:
    """Extract text from a document with the chosen engine and auto-fallback.

    engine: "fast" | "accurate" | None (None → the user's saved setting).
    ocr:    True/False/None (None → the user's saved setting; only used for
            image-only PDFs).

    Raises LegacyDocError for .doc, ValueError for unsupported types,
    ScannedPDFError when a PDF has no text and OCR is off.
    """
    path = Path(file_path)
    ext = path.suffix.lower()

    if ext == ".doc":
        raise LegacyDocError(
            "Legacy .doc files are not supported. Please open the file in "
            "Word and re-save it as .docx, then upload again."
        )
    if ext not in SUPPORTED_EXTENSIONS:
        raise ValueError(
            f"Unsupported file type: '{ext}'. Supported: "
            f"{', '.join(sorted(SUPPORTED_EXTENSIONS))}."
        )

    engine = engine or _configured_engine()
    ocr = _configured_ocr() if ocr is None else ocr

    if ext in (".txt", ".md"):
        return ParseResult(text=path.read_text(encoding="utf-8", errors="replace"),
                           engine="plain")

    if ext == ".pdf":
        return _parse_pdf(file_path, engine=engine, ocr=ocr)

    # docx / pptx / xlsx / html
    return _parse_office(file_path, engine=engine)


# ──────────────────────────────────────────────
# CONFIG (reads the user's saved Document Processing setting)
# ──────────────────────────────────────────────

def _configured_engine() -> str:
    try:
        import config
        val = getattr(config, "DOC_ENGINE", None)
        if val in (ENGINE_FAST, ENGINE_ACCURATE):
            return val
    except Exception:
        pass
    return os.environ.get("LEGALBOX_DOC_ENGINE", DEFAULT_ENGINE)


def _configured_ocr() -> bool:
    try:
        import config
        if getattr(config, "DOC_OCR", None) is not None:
            return bool(config.DOC_OCR)
    except Exception:
        pass
    return os.environ.get("LEGALBOX_DOC_OCR", "0") == "1"


# ──────────────────────────────────────────────
# PDF
# ──────────────────────────────────────────────

def _parse_pdf(file_path: str, engine: str, ocr: bool) -> ParseResult:
    warnings: List[str] = []

    # Accurate first if requested; fall back to fast on any failure.
    if engine == ENGINE_ACCURATE:
        try:
            text = _pdf_docling(file_path, ocr=ocr)
            if text.strip():
                return ParseResult(text=text, engine=ENGINE_ACCURATE, ocr_used=ocr)
        except Exception as e:
            warnings.append(f"Accurate engine unavailable ({e}); used fast engine.")

    text = _pdf_pdfplumber(file_path)
    if text.strip():
        return ParseResult(text=text, engine=ENGINE_FAST, warnings=warnings)

    # No text extracted — likely a scanned/image PDF
    if ocr:
        ocr_text = _pdf_ocr(file_path)
        if ocr_text.strip():
            return ParseResult(text=ocr_text, engine="ocr", ocr_used=True, warnings=warnings)
        raise ScannedPDFError(
            "No text could be extracted from this PDF even with OCR enabled."
        )
    raise ScannedPDFError(
        "This PDF appears to be scanned (image-only) — no selectable text was "
        "found. Enable OCR in Settings → Document Processing to read it."
    )


def _pdf_pdfplumber(file_path: str) -> str:
    """Fast, permissively-licensed PDF text extraction (MIT)."""
    import pdfplumber
    pages = []
    with pdfplumber.open(file_path) as pdf:
        for i, page in enumerate(pdf.pages, start=1):
            text = page.extract_text() or ""
            if text.strip():
                pages.append(f"[Page {i}]\n{text}")
    return "\n\n".join(pages)


def _pdf_docling(file_path: str, ocr: bool) -> str:
    """Layout-aware extraction via Docling (MIT). Heavy; imported lazily."""
    from docling.document_converter import DocumentConverter
    converter = DocumentConverter()
    result = converter.convert(file_path)
    return result.document.export_to_markdown()


def _pdf_ocr(file_path: str) -> str:
    """OCR a scanned PDF with Tesseract (Apache 2.0). Imported lazily."""
    try:
        import pytesseract
        from pdf2image import convert_from_path
    except ImportError as e:
        raise RuntimeError(
            "OCR support is not installed on this machine "
            f"(missing {e.name}). Install Tesseract to read scanned PDFs."
        )
    pages = []
    for i, image in enumerate(convert_from_path(file_path), start=1):
        text = pytesseract.image_to_string(image)
        if text.strip():
            pages.append(f"[Page {i}]\n{text}")
    return "\n\n".join(pages)


# ──────────────────────────────────────────────
# OFFICE FORMATS (docx / pptx / xlsx / html)
# ──────────────────────────────────────────────

def _parse_office(file_path: str, engine: str) -> ParseResult:
    ext = Path(file_path).suffix.lower()

    if engine == ENGINE_ACCURATE:
        try:
            from docling.document_converter import DocumentConverter
            result = DocumentConverter().convert(file_path)
            text = result.document.export_to_markdown()
            if text.strip():
                return ParseResult(text=text, engine=ENGINE_ACCURATE)
        except Exception:
            pass  # fall through to fast

    # Fast path: MarkItDown handles docx/pptx/xlsx/html uniformly (MIT)
    try:
        from markitdown import MarkItDown
        result = MarkItDown().convert(file_path)
        text = result.text_content
        if text.strip():
            return ParseResult(text=text, engine=ENGINE_FAST)
    except Exception:
        pass

    # Last-resort DOCX fallback (python-docx) so we never regress on the
    # most common format if MarkItDown is unavailable.
    if ext == ".docx":
        return ParseResult(text=_docx_python_docx(file_path), engine="python-docx")

    raise RuntimeError(f"Could not extract text from {Path(file_path).name}.")


def _docx_python_docx(file_path: str) -> str:
    from docx import Document
    doc = Document(file_path)
    parts = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
    for table in doc.tables:
        for row in table.rows:
            cells = [c.text.strip() for c in row.cells if c.text.strip()]
            if cells:
                parts.append(" | ".join(cells))
    if not parts:
        raise RuntimeError("No text could be extracted from this DOCX file.")
    return "\n\n".join(parts)


# ──────────────────────────────────────────────
# MISC
# ──────────────────────────────────────────────

def get_file_info(file_path: str) -> dict:
    """Return basic info about a file (size, type, name)."""
    path = Path(file_path)
    size_bytes = path.stat().st_size if path.exists() else 0
    return {
        "filename": path.name,
        "extension": path.suffix.lower(),
        "size_bytes": size_bytes,
        "size_mb": round(size_bytes / 1024 / 1024, 2),
    }


def available_engines() -> dict:
    """Report which engines are installed — surfaced in Settings."""
    def _has(mod):
        import importlib.util
        return importlib.util.find_spec(mod) is not None

    return {
        "fast": True,  # pdfplumber + markitdown are core deps
        "accurate": _has("docling"),
        "ocr": _has("pytesseract") and _has("pdf2image"),
        "default": _configured_engine(),
        "ocr_enabled": _configured_ocr(),
    }
