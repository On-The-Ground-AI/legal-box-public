# bundle_pdf.py — assemble a real, filing-ready court bundle PDF.
#
# Takes the sorted bundle structure (see routers/bundles.py) plus the
# authority PDFs and produces one document with:
#   - a cover page (matter, hearing date/type)
#   - a table of contents with tab numbers and relevance statements
#   - the authorities merged in tab order
#   - a PDF bookmark per tab
#   - continuous page numbering, bottom-right, across the whole bundle
#
# Built with pypdf (BSD) for merging/bookmarks and reportlab (BSD) for the
# cover/TOC/page-number layers. The feature bar is set by Stirling-PDF
# (design reference — see NOTICE.md); the Singapore formatting rules come
# from routers/bundles.py.

import io
from typing import Dict, List

from pypdf import PdfReader, PdfWriter
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.pdfgen import canvas

PAGE_W, PAGE_H = A4


def _cover_and_toc_pdf(bundle: Dict) -> bytes:
    """Render the cover page + table of contents with reportlab."""
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)

    # ── Cover page ──
    cover = bundle["cover_page"]
    c.setFont("Times-Bold", 22)
    c.drawCentredString(PAGE_W / 2, PAGE_H - 7 * cm, cover["title"])
    c.setFont("Times-Roman", 14)
    c.drawCentredString(PAGE_W / 2, PAGE_H - 9 * cm, cover["matter"])
    c.setFont("Times-Roman", 12)
    y = PAGE_H - 11 * cm
    if cover.get("hearing_type"):
        c.drawCentredString(PAGE_W / 2, y, f"Hearing: {cover['hearing_type']}")
        y -= 0.8 * cm
    c.drawCentredString(PAGE_W / 2, y, f"Hearing date: {cover.get('hearing_date', 'To be confirmed')}")
    c.setFont("Times-Italic", 9)
    c.drawCentredString(PAGE_W / 2, 2.5 * cm, "Prepared with OTG Legal Box")
    c.showPage()

    # ── Table of contents ──
    c.setFont("Times-Bold", 16)
    c.drawString(2.5 * cm, PAGE_H - 2.5 * cm, "TABLE OF CONTENTS")
    y = PAGE_H - 4 * cm

    def wrap(text: str, width: int) -> List[str]:
        words, lines, cur = text.split(), [], ""
        for w in words:
            if len(cur) + len(w) + 1 > width:
                lines.append(cur)
                cur = w
            else:
                cur = f"{cur} {w}".strip()
        if cur:
            lines.append(cur)
        return lines or [""]

    toc = bundle["table_of_contents"]
    for part_key in ("part_1_statutes", "part_2_cases", "part_3_secondary"):
        part = toc[part_key]
        if not part["items"]:
            continue
        if y < 5 * cm:
            c.showPage()
            y = PAGE_H - 2.5 * cm
        c.setFont("Times-Bold", 12)
        c.drawString(2.5 * cm, y, part["heading"])
        y -= 0.9 * cm
        for item in part["items"]:
            if y < 4 * cm:
                c.showPage()
                y = PAGE_H - 2.5 * cm
            c.setFont("Times-Bold", 10)
            c.drawString(2.5 * cm, y, f"Tab {item['tab']}")
            c.setFont("Times-Roman", 10)
            for i, line in enumerate(wrap(item["title"], 78)):
                c.drawString(4.3 * cm, y, line)
                y -= 0.5 * cm
            c.setFont("Times-Italic", 9)
            for line in wrap(item.get("relevance", ""), 84):
                c.drawString(4.3 * cm, y, line)
                y -= 0.45 * cm
            y -= 0.35 * cm
        y -= 0.5 * cm

    c.showPage()
    c.save()
    return buf.getvalue()


def _page_number_overlay(total_pages: int) -> PdfReader:
    """One A4 page per bundle page with 'Page N of M' at the top right
    (Singapore practice: page numbers top-right)."""
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    for n in range(1, total_pages + 1):
        c.setFont("Times-Roman", 10)
        c.drawRightString(PAGE_W - 1.8 * cm, PAGE_H - 1.4 * cm, f"Page {n} of {total_pages}")
        c.showPage()
    c.save()
    buf.seek(0)
    return PdfReader(buf)


def assemble_bundle_pdf(bundle: Dict, tab_files: List[Dict], out_path: str) -> Dict:
    """Merge everything into the final bundle.

    bundle:    the structure from routers/bundles._build_bundle_output
    tab_files: [{"tab": "1", "title": ..., "path": "/tmp/xxx.pdf"}, ...]
               in tab order
    Returns {"total_pages": int, "tabs": int}.
    """
    writer = PdfWriter()

    # Cover + TOC
    front = PdfReader(io.BytesIO(_cover_and_toc_pdf(bundle)))
    for page in front.pages:
        writer.add_page(page)
    writer.add_outline_item("Cover", 0)
    writer.add_outline_item("Table of Contents", 1)

    # Authorities, in tab order, each with a bookmark at its first page
    for tf in tab_files:
        reader = PdfReader(tf["path"])
        start = len(writer.pages)
        for page in reader.pages:
            writer.add_page(page)
        writer.add_outline_item(f"Tab {tf['tab']} — {tf['title']}"[:120], start)

    # Continuous page numbers over every page
    total = len(writer.pages)
    overlay = _page_number_overlay(total)
    for i, page in enumerate(writer.pages):
        page.merge_page(overlay.pages[i])

    with open(out_path, "wb") as f:
        writer.write(f)

    return {"total_pages": total, "tabs": len(tab_files)}
