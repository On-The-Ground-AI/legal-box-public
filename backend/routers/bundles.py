# routers/bundles.py — Singapore Court Bundle Automator
#
# Singapore courts require bundles to be organised in a specific way:
#   Part 1: Statutes and subsidiary legislation (alphabetical)
#   Part 2: Cases (alphabetical)
#   Part 3: Secondary materials (alphabetical)
#
# This module:
#   - Accepts a list of cases and statutes
#   - Sorts them correctly
#   - Generates relevance statements (max 3 sentences each) using the LLM
#   - Returns a structured bundle outline ready for a lawyer to use
#
# Endpoints:
#   POST /api/bundles/generate   → Generate a court bundle outline

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import json
import shutil
import tempfile
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask
from pydantic import BaseModel

import config
from ollama_client import OllamaClient
from pii_shield import anonymize, deanonymize

router = APIRouter(prefix="/api/bundles", tags=["bundles"])
ollama = OllamaClient()


# ── Request / Response Models ─────────────────────────────────────────────────

class BundleItem(BaseModel):
    title: str               # e.g. "Tan v. Lee [2024] SGHC 12"
    type: str                # "case", "statute", or "secondary"
    relevance_hint: str = "" # Optional note from lawyer: "cited for test of negligence"

class BundleRequest(BaseModel):
    matter_title: str                  # e.g. "ABC Pte Ltd v. XYZ Ltd"
    hearing_date: str = ""             # e.g. "15 January 2026"
    hearing_type: str = ""             # e.g. "Summary Judgment", "Trial"
    items: List[BundleItem]
    model: Optional[str] = None
    generate_relevance: bool = True    # Use LLM to generate relevance statements?


# ── System prompt ─────────────────────────────────────────────────────────────

RELEVANCE_SYSTEM_PROMPT = """You are a Singapore litigation lawyer preparing a court bundle.
For each authority listed, write a concise relevance statement (maximum 3 sentences) explaining:
1. What legal principle or proposition it establishes
2. Why it is relevant to the current matter

Be precise and use proper legal language. Each statement should stand alone."""


# ── Sorting logic ─────────────────────────────────────────────────────────────

def _sort_key(item: BundleItem) -> str:
    """Return a sorting key for a bundle item (case-insensitive alphabetical)."""
    return item.title.lower().strip()


def _categorise_items(items: List[BundleItem]):
    """Split items into statutes, cases, and secondary materials."""
    statutes = [i for i in items if i.type == "statute"]
    cases = [i for i in items if i.type == "case"]
    secondary = [i for i in items if i.type == "secondary"]

    # Sort each category alphabetically
    statutes.sort(key=_sort_key)
    cases.sort(key=_sort_key)
    secondary.sort(key=_sort_key)

    return statutes, cases, secondary


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/generate")
async def generate_bundle(request: BundleRequest):
    """
    Generate a structured court bundle outline.

    Takes a list of cases, statutes, and secondary materials,
    sorts them correctly, and optionally generates relevance statements
    using the LLM.
    """
    if not request.items:
        raise HTTPException(status_code=400, detail="Please provide at least one item.")

    use_model = config.resolve_model("heavy", request.model)

    # Sort items into categories
    statutes, cases, secondary = _categorise_items(request.items)

    # Generate relevance statements if requested
    pii_summary = {}
    if request.generate_relevance:
        all_items = statutes + cases + secondary
        items_needing_relevance = [
            item for item in all_items if not item.relevance_hint.strip()
        ]

        if items_needing_relevance:
            try:
                relevance_map, pii_summary = await _generate_relevance_statements(
                    matter_title=request.matter_title,
                    hearing_type=request.hearing_type,
                    items=items_needing_relevance,
                    model=use_model,
                )
                # Merge generated statements back
                for item in all_items:
                    if item.title in relevance_map:
                        item.relevance_hint = relevance_map[item.title]
            except ConnectionError:
                # If Ollama is down, just skip relevance generation
                pass

    # Build the bundle structure
    bundle = _build_bundle_output(
        matter_title=request.matter_title,
        hearing_date=request.hearing_date,
        hearing_type=request.hearing_type,
        statutes=statutes,
        cases=cases,
        secondary=secondary,
    )

    return {
        "matter_title": request.matter_title,
        "hearing_date": request.hearing_date,
        "hearing_type": request.hearing_type,
        "bundle": bundle,
        "pii_detected": pii_summary,
        "summary": {
            "total_items": len(request.items),
            "statutes": len(statutes),
            "cases": len(cases),
            "secondary": len(secondary),
        },
        "disclaimer": config.LEGAL_DISCLAIMER,
    }


@router.post("/assemble-pdf")
async def assemble_pdf(
    manifest: str = Form(...),          # JSON: output of /generate (or same shape)
    files: List[UploadFile] = File(...),  # authority PDFs, in TAB ORDER
):
    """
    Merge uploaded authority PDFs into one filing-ready bundle:
    cover page, table of contents with relevance statements, bookmarks per
    tab, continuous page numbering. Files must be provided in tab order
    (the order shown in the generated outline).

    Purely local (pypdf + reportlab) — no LLM, no PII exposure.
    """
    from bundle_pdf import assemble_bundle_pdf

    try:
        data = json.loads(manifest)
        bundle = data["bundle"]
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="manifest must be the JSON returned by /api/bundles/generate."
        )

    # Flatten the TOC into tab order
    toc = bundle["table_of_contents"]
    ordered_items = (
        toc["part_1_statutes"]["items"]
        + toc["part_2_cases"]["items"]
        + toc["part_3_secondary"]["items"]
    )
    if len(files) != len(ordered_items):
        raise HTTPException(
            status_code=400,
            detail=f"The bundle has {len(ordered_items)} tabs but {len(files)} "
                   f"PDF files were uploaded. Upload one PDF per tab, in tab order."
        )

    tmp_paths = []
    try:
        tab_files = []
        for item, uploaded in zip(ordered_items, files):
            if Path(uploaded.filename or "").suffix.lower() != ".pdf":
                raise HTTPException(
                    status_code=400,
                    detail=f"Authorities must be PDFs (got: {uploaded.filename})."
                )
            tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
            shutil.copyfileobj(uploaded.file, tmp)
            tmp.close()
            tmp_paths.append(tmp.name)
            tab_files.append({"tab": item["tab"], "title": item["title"], "path": tmp.name})

        out = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
        out.close()
        try:
            stats = assemble_bundle_pdf(bundle, tab_files, out.name)
        except Exception as e:
            os.unlink(out.name)
            raise HTTPException(status_code=422, detail=f"Could not assemble bundle: {e}")

        safe_matter = "".join(
            ch for ch in (data.get("matter_title") or "bundle") if ch.isalnum() or ch in " -_"
        ).strip()[:60] or "bundle"
        return FileResponse(
            out.name,
            media_type="application/pdf",
            filename=f"{safe_matter} - Bundle of Authorities.pdf",
            headers={"X-Bundle-Pages": str(stats["total_pages"])},
            background=BackgroundTask(lambda: os.unlink(out.name)),
        )
    finally:
        for p in tmp_paths:
            try:
                os.unlink(p)
            except Exception:
                pass


async def _generate_relevance_statements(
    matter_title: str,
    hearing_type: str,
    items: List[BundleItem],
    model: str,
) -> tuple:
    """
    Use the LLM to generate one relevance statement per authority.
    Returns (dict mapping title → relevance statement, PII summary).

    The matter title and authority titles contain party names, so the whole
    prompt is passed through the PII shield before it reaches the LLM and
    the response is de-anonymized afterwards — same round-trip as the other
    tools (see routers/contracts.py).
    """
    # Build a single prompt listing all authorities
    items_text = "\n".join([
        f"{i + 1}. {item.title} [{item.type}]"
        + (f" — Hint: {item.relevance_hint}" if item.relevance_hint else "")
        for i, item in enumerate(items)
    ])

    prompt = (
        f"Matter: {matter_title}\n"
        f"Hearing type: {hearing_type or 'Not specified'}\n\n"
        f"For each of the following authorities, write a relevance statement "
        f"(maximum 3 sentences):\n\n{items_text}\n\n"
        f"Format your response exactly as:\n"
        f"1. [relevance statement]\n2. [relevance statement]\netc."
    )

    pii_result = anonymize(prompt)

    try:
        response = await OllamaClient().generate(
            prompt=pii_result.anonymized_text,
            model=model,
            system_prompt=RELEVANCE_SYSTEM_PROMPT,
        )
    except Exception:
        return {}, pii_result.pii_summary

    response = deanonymize(response, pii_result.token_map)

    # Parse numbered responses
    result = {}
    lines = response.strip().split("\n")
    item_index = 0
    for line in lines:
        line = line.strip()
        if not line:
            continue
        # Look for lines starting with a number
        import re
        m = re.match(r"^(\d+)\.\s+(.+)$", line)
        if m:
            idx = int(m.group(1)) - 1
            if 0 <= idx < len(items):
                result[items[idx].title] = m.group(2)
                item_index = idx + 1

    return result, pii_result.pii_summary


def _build_bundle_output(
    matter_title: str,
    hearing_date: str,
    hearing_type: str,
    statutes: List[BundleItem],
    cases: List[BundleItem],
    secondary: List[BundleItem],
) -> dict:
    """Build the final structured bundle dictionary."""

    def format_section(items: List[BundleItem], start_num: int) -> List[dict]:
        entries = []
        for i, item in enumerate(items, start=start_num):
            entries.append({
                "tab": str(i),
                "title": item.title,
                "type": item.type,
                "relevance": item.relevance_hint or "Refer to this authority as cited in submissions.",
            })
        return entries

    # Build table of contents with correct tab numbering
    tab_num = 1
    toc_statutes = format_section(statutes, tab_num)
    tab_num += len(statutes)
    toc_cases = format_section(cases, tab_num)
    tab_num += len(cases)
    toc_secondary = format_section(secondary, tab_num)

    return {
        "cover_page": {
            "title": "BUNDLE OF AUTHORITIES",
            "matter": matter_title,
            "hearing_date": hearing_date or "To be confirmed",
            "hearing_type": hearing_type or "",
            "formatting_note": (
                "Format: Times New Roman 12pt, page numbers top-right. "
                "Tabs to be inserted. Authorities to be separated by dividers."
            ),
        },
        "table_of_contents": {
            "part_1_statutes": {
                "heading": "PART 1 — STATUTES AND SUBSIDIARY LEGISLATION",
                "note": "Listed alphabetically",
                "items": toc_statutes,
            },
            "part_2_cases": {
                "heading": "PART 2 — CASES",
                "note": "Listed alphabetically",
                "items": toc_cases,
            },
            "part_3_secondary": {
                "heading": "PART 3 — SECONDARY MATERIALS",
                "note": "Listed alphabetically",
                "items": toc_secondary,
            },
        },
        "total_tabs": (len(statutes) + len(cases) + len(secondary)),
    }
