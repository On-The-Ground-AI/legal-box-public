"""
prompt_library.py — Parse and serve the legal AI prompt library.

Parses all markdown files under backend/prompts/ and builds an in-memory
index of prompts. Handles multiple source formats from the library.

Prompt data structure:
  {
    "id": str,          — unique identifier (e.g. "V7-SCP-001")
    "volume": str,      — volume folder name
    "volume_label": str — human-readable volume name
    "category": str,    — section/file topic
    "title": str,       — prompt title
    "text": str,        — the prompt body (copy-paste ready)
    "context": str,     — when to use it
    "difficulty": str,  — Beginner / Intermediate / Advanced
    "follow_up": str,   — suggested next step
    "placeholders": list[str] — extracted [PLACEHOLDER] tokens
    "tags": list[str]   — searchable keywords
  }
"""

import re
import os
from pathlib import Path
from typing import Optional

PROMPTS_DIR = Path(__file__).parent / "prompts"

VOLUME_LABELS = {
    "volume-1-foundations": "Foundations & Techniques",
    "volume-2-transactional": "Transactional Practice",
    "volume-3-disputes": "Dispute Resolution",
    "volume-4-regulatory": "Regulatory & Compliance",
    "volume-5-practice-areas": "Practice Area Specialisms",
    "volume-6-inhouse-legal-ops": "In-house & Legal Ops",
    "volume-7-singapore-apac": "Singapore & APAC",
    "volume-8-ai-practice": "AI in Legal Practice",
    # Adapted from Anthropic's claude-for-legal (Apache 2.0) for Singapore
    # practice and the local model — see NOTICE.md
    "volume-9-claude-for-legal": "Practice-Area Skills (Claude for Legal)",
    "quick-start-packs": "Quick-Start Packs",
}

# ── Parsing ────────────────────────────────────────────────────────────────────

def _extract_placeholders(text: str) -> list[str]:
    """Extract all [PLACEHOLDER] tokens from prompt text."""
    found = re.findall(r'\[([A-Z][A-Z0-9 _/\-]{2,})\]', text)
    seen = set()
    unique = []
    for p in found:
        if p not in seen:
            seen.add(p)
            unique.append(p)
    return unique


def _clean_text(text: str) -> str:
    return text.strip()


def _parse_difficulty(text: str) -> str:
    m = re.search(r'\b(Beginner|Intermediate|Advanced)\b', text, re.IGNORECASE)
    return m.group(1).capitalize() if m else ""


def _derive_tags(volume: str, category: str, title: str, text: str) -> list[str]:
    tags = set()
    # Add volume-derived tags
    label = VOLUME_LABELS.get(volume, "")
    for word in label.lower().split():
        if len(word) > 3:
            tags.add(word)
    # Add category words
    for word in re.split(r'[\s_\-]+', category.lower()):
        if len(word) > 3:
            tags.add(word)
    # Singapore-specific
    if "singapore" in text.lower() or volume == "volume-7-singapore-apac":
        tags.add("singapore")
    # Difficulty area detection
    for keyword in ["contract", "litigation", "compliance", "corporate", "employment",
                    "property", "ip", "intellectual property", "arbitration",
                    "mediation", "family", "criminal", "tax", "privacy", "data",
                    "immigration", "probate", "wills", "banking", "finance",
                    "drafting", "review", "pleading", "affidavit", "discovery"]:
        if keyword in text.lower() or keyword in title.lower():
            tags.add(keyword.split()[0])
    return sorted(tags)


def _make_id(volume: str, category: str, index: int) -> str:
    # Create a stable ID from volume abbreviation + category hash + index
    vol_abbr = ''.join(w[0].upper() for w in volume.replace('-', ' ').split() if w)
    cat_slug = re.sub(r'[^a-z0-9]', '', category.lower())[:8]
    return f"{vol_abbr}-{cat_slug}-{index:04d}"


def _parse_volume_format(content: str, volume: str, category: str, start_index: int) -> list[dict]:
    """
    Parse Volume 7-style format:
      ### PROMPT 001 - TITLE
      **PROMPT ID:** ...
      **Full Text:**
      ...text...
      **Context:** ...
      **Difficulty:** ...
      **Follow-up:** ...
    """
    prompts = []
    # Split on prompt headers (### PROMPT NNN or ### SECTION LETTER)
    blocks = re.split(r'\n(?=###\s)', content)

    for block in blocks:
        lines = block.strip().splitlines()
        if not lines:
            continue
        header = lines[0].strip()
        if not header.startswith('###'):
            continue

        # Extract title from header line
        title = re.sub(r'^###\s*', '', header)
        title = re.sub(r'^PROMPT\s+\d+[\s\-–]+', '', title).strip()
        if not title:
            continue

        body = '\n'.join(lines[1:])

        # Try structured format first (Full Text field)
        full_text_m = re.search(
            r'\*\*Full Text:\*\*\s*\n(.*?)(?=\n\*\*(?:Context|Difficulty|Follow-up):\*\*|\Z)',
            body, re.DOTALL
        )
        if full_text_m:
            prompt_text = _clean_text(full_text_m.group(1))
        else:
            # Unstructured: take everything before Context: or Difficulty:
            text_m = re.search(
                r'^(.*?)(?=\n(?:Context:|Difficulty:|Follow-up:|\*\*Context|\*\*Difficulty|\*\*Follow-up))',
                body, re.DOTALL
            )
            prompt_text = _clean_text(text_m.group(1)) if text_m else _clean_text(body)
            # Strip any bolded field names from the start
            prompt_text = re.sub(r'^\*\*(?:PROMPT ID|Prompt ID):[^*]+\*\*\s*', '', prompt_text).strip()

        if not prompt_text or len(prompt_text) < 20:
            continue

        # Extract context
        ctx_m = re.search(
            r'\*\*Context:\*\*\s*(.*?)(?=\n\*\*(?:Difficulty|Follow-up):\*\*|\Z)',
            body, re.DOTALL
        )
        context = _clean_text(ctx_m.group(1)) if ctx_m else ""

        # Extract difficulty
        diff_m = re.search(r'\*\*Difficulty:\*\*\s*([^\n]+)', body)
        difficulty = _parse_difficulty(diff_m.group(1)) if diff_m else ""

        # Extract follow-up
        fu_m = re.search(
            r'\*\*Follow-up:\*\*\s*(.*?)(?=\n\*\*|\Z)',
            body, re.DOTALL
        )
        follow_up = _clean_text(fu_m.group(1)) if fu_m else ""

        index = start_index + len(prompts)
        prompts.append({
            "id": _make_id(volume, category, index),
            "volume": volume,
            "volume_label": VOLUME_LABELS.get(volume, volume),
            "category": category,
            "title": title,
            "text": prompt_text,
            "context": context,
            "difficulty": difficulty,
            "follow_up": follow_up,
            "placeholders": _extract_placeholders(prompt_text),
            "tags": _derive_tags(volume, category, title, prompt_text),
        })

    return prompts


def _parse_simple_format(content: str, volume: str, category: str, start_index: int) -> list[dict]:
    """
    Parse simple section format (V2 contracts, quick-start packs):
      ### A.1 — TITLE
      prompt text here...
      Context: ...
      Difficulty: ...
      Follow-up: ...

    Also handles bold-ID format:
      **PROMPT L-A1 — TITLE**
      prompt text...
    """
    prompts = []

    # Normalize: replace bold prompt IDs to section headers
    content = re.sub(
        r'\*\*PROMPT\s+([A-Z0-9\-]+)\s*[—\-]+\s*([^*\n]+)\*\*',
        r'### \1 — \2',
        content
    )

    blocks = re.split(r'\n(?=###\s)', content)

    for block in blocks:
        lines = block.strip().splitlines()
        if not lines:
            continue
        header = lines[0].strip()
        if not header.startswith('###'):
            continue

        # Title from header
        title = re.sub(r'^###\s*', '', header)
        title = re.sub(r'^[A-Z0-9\.\-]+\s*[—\-]+\s*', '', title).strip()
        if not title:
            continue

        body = '\n'.join(lines[1:]).strip()

        # Split on Context: / Difficulty: / Follow-up:
        text_m = re.split(r'\n(?:Context:|Difficulty:|Follow-up:)', body, maxsplit=1)
        prompt_text = _clean_text(text_m[0])

        # Strip copilot tips from text
        prompt_text = re.sub(r'\*Copilot Tip:.*?\*', '', prompt_text, flags=re.DOTALL).strip()

        if not prompt_text or len(prompt_text) < 20:
            continue

        # Extract fields from remainder
        remainder = body[len(text_m[0]):]
        ctx_m = re.search(r'Context:\s*(.*?)(?=\nDifficulty:|\nFollow-up:|\Z)', remainder, re.DOTALL)
        diff_m = re.search(r'Difficulty:\s*([^\n]+)', remainder)
        fu_m = re.search(r'Follow-up:\s*(.*?)(?=\n###|\Z)', remainder, re.DOTALL)

        context = _clean_text(ctx_m.group(1)) if ctx_m else ""
        difficulty = _parse_difficulty(diff_m.group(1)) if diff_m else ""
        follow_up = _clean_text(fu_m.group(1)) if fu_m else ""

        index = start_index + len(prompts)
        prompts.append({
            "id": _make_id(volume, category, index),
            "volume": volume,
            "volume_label": VOLUME_LABELS.get(volume, volume),
            "category": category,
            "title": title,
            "text": prompt_text,
            "context": context,
            "difficulty": difficulty,
            "follow_up": follow_up,
            "placeholders": _extract_placeholders(prompt_text),
            "tags": _derive_tags(volume, category, title, prompt_text),
        })

    return prompts


def _category_from_filename(filename: str) -> str:
    """Derive human-readable category name from a filename."""
    name = Path(filename).stem
    # Remove version prefix like V2_01_, V7_03_
    name = re.sub(r'^V\d+_\d+_', '', name)
    # Replace underscores with spaces
    return name.replace('_', ' ')


def _parse_file(path: Path, volume: str, start_index: int) -> list[dict]:
    try:
        content = path.read_text(encoding='utf-8')
    except Exception:
        return []

    # Skip README and index files
    if path.name.startswith('00_') or 'README' in path.name.upper() or 'INDEX' in path.name.upper():
        return []

    # Extract file-level category from first H1 heading or filename
    h1_m = re.search(r'^#\s+(.+)$', content, re.MULTILINE)
    if h1_m:
        category = h1_m.group(1).strip()
        # Strip version suffixes
        category = re.sub(r'\s*[-–]\s*(AI Prompt Library|Deep Supplement|Prompts).*$', '', category, flags=re.IGNORECASE).strip()
    else:
        category = _category_from_filename(path.name)

    # Detect format: volume format has **Full Text:** fields
    if '**Full Text:**' in content or '**PROMPT ID:**' in content:
        return _parse_volume_format(content, volume, category, start_index)
    else:
        return _parse_simple_format(content, volume, category, start_index)


# ── In-memory store ────────────────────────────────────────────────────────────

_ALL_PROMPTS: list[dict] = []
_LOADED = False


def load_all_prompts() -> list[dict]:
    global _ALL_PROMPTS, _LOADED
    if _LOADED:
        return _ALL_PROMPTS

    if not PROMPTS_DIR.exists():
        _LOADED = True
        return _ALL_PROMPTS

    all_prompts = []
    index = 0

    for volume_dir in sorted(PROMPTS_DIR.iterdir()):
        if not volume_dir.is_dir():
            continue
        volume = volume_dir.name
        if volume not in VOLUME_LABELS:
            continue

        for md_file in sorted(volume_dir.glob('*.md')):
            file_prompts = _parse_file(md_file, volume, index)
            all_prompts.extend(file_prompts)
            index += len(file_prompts)

    _ALL_PROMPTS = all_prompts
    _LOADED = True
    return _ALL_PROMPTS


def search_prompts(
    query: str = "",
    volume: str = "",
    difficulty: str = "",
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[dict], int]:
    """Search prompts. Returns (results, total_count)."""
    prompts = load_all_prompts()
    query_lower = query.lower()

    results = []
    for p in prompts:
        # Filter by volume
        if volume and p["volume"] != volume:
            continue
        # Filter by difficulty
        if difficulty and p["difficulty"].lower() != difficulty.lower():
            continue
        # Filter by query (title, category, text, tags)
        if query_lower:
            searchable = " ".join([
                p["title"], p["category"], p["text"][:200],
                " ".join(p["tags"])
            ]).lower()
            if query_lower not in searchable:
                continue
        results.append(p)

    total = len(results)
    return results[offset:offset + limit], total


def get_prompt_by_id(prompt_id: str) -> Optional[dict]:
    prompts = load_all_prompts()
    for p in prompts:
        if p["id"] == prompt_id:
            return p
    return None


def get_volumes() -> list[dict]:
    """Return volume list with prompt counts."""
    prompts = load_all_prompts()
    counts: dict[str, int] = {}
    for p in prompts:
        counts[p["volume"]] = counts.get(p["volume"], 0) + 1

    return [
        {
            "id": vol_id,
            "label": label,
            "count": counts.get(vol_id, 0),
        }
        for vol_id, label in VOLUME_LABELS.items()
    ]
