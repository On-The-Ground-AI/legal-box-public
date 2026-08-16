# quote_verify.py — check that a quote the model attributes to a document
# actually appears in that document.
#
# The redline tool asks the model to "quote the exact text to delete" and
# renders the result as a strikethrough. If the model paraphrases the clause
# instead of quoting it, the lawyer sees a redline striking wording that is
# not in their contract — and there is no way to tell that from the output.
# This module locates each quote in the source and reports what it found.
#
# Two deliberate choices:
#
#   * Correction is by SUBSTITUTION, not by re-prompting. When a quote is
#     located but drifted, the exact source text is swapped in. Re-asking the
#     model costs another local inference pass and can drift again.
#
#   * "We could not check" is never reported as "we checked and it is
#     absent". An empty or unreadable source yields UNVERIFIABLE, so a
#     missing document can't masquerade as a fabricated quote.
#
# Design informed by the published behaviour of Mike OSS's citation verifier
# (github.com/Open-Legal-Products/mike, AGPL-3.0). Independently implemented;
# no code was copied. See NOTICE.md.

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field
from enum import Enum
from typing import List, Optional, Tuple


class QuoteStatus(str, Enum):
    """Outcome of checking one quote against its source."""

    VERIFIED = "verified"          # found, character-for-character
    DRIFTED = "drifted"            # found, but the model's wording differs
    NOT_FOUND = "not_found"        # source was readable; the quote is not in it
    UNVERIFIABLE = "unverifiable"  # no usable source — we could not check


class MatchTier(str, Enum):
    """Which matcher found the quote. Ordered from strictest to loosest."""

    EXACT = "exact"
    NORMALIZED = "normalized"      # whitespace + case
    PUNCTUATION = "punctuation"    # whitespace + case + punctuation/quote marks


@dataclass
class QuoteVerification:
    quote: str                          # what the model wrote
    status: QuoteStatus
    source_excerpt: Optional[str] = None  # the real text, when located
    start: Optional[int] = None           # offsets into the source passed in
    end: Optional[int] = None
    tier: Optional[MatchTier] = None

    @property
    def verified(self) -> bool:
        return self.status is QuoteStatus.VERIFIED

    @property
    def located(self) -> bool:
        """Found in the source, whether or not the wording drifted."""
        return self.status in (QuoteStatus.VERIFIED, QuoteStatus.DRIFTED)

    def to_dict(self) -> dict:
        return {
            "quote": self.quote,
            "status": self.status.value,
            "verified": self.verified,
            "source_excerpt": self.source_excerpt,
            "start": self.start,
            "end": self.end,
            "tier": self.tier.value if self.tier else None,
        }


@dataclass
class VerificationSummary:
    quotes: List[QuoteVerification] = field(default_factory=list)

    def _count(self, status: QuoteStatus) -> int:
        return sum(1 for q in self.quotes if q.status is status)

    def to_dict(self) -> dict:
        return {
            "checked": len(self.quotes),
            "verified": self._count(QuoteStatus.VERIFIED),
            "drifted": self._count(QuoteStatus.DRIFTED),
            "not_found": self._count(QuoteStatus.NOT_FOUND),
            "unverifiable": self._count(QuoteStatus.UNVERIFIABLE),
            "quotes": [q.to_dict() for q in self.quotes],
        }


# ── Normalization ─────────────────────────────────────────────────────────────

# Word processors emit curly quotes, en/em dashes and non-breaking spaces that
# a model routinely retypes as their ASCII equivalents. Folding these is what
# separates "the model paraphrased" from "the model retyped the same clause".
_UNICODE_FOLD = {
    "‘": "'", "’": "'", "‚": "'", "‛": "'",
    "“": '"', "”": '"', "„": '"', "‟": '"',
    "‐": "-", "‑": "-", "‒": "-", "–": "-",
    "—": "-", "―": "-", "−": "-",
    " ": " ", " ": " ", " ": " ", " ": " ",
    "​": "", "‌": "", "‍": "", "﻿": "",
}

_PUNCTUATION = re.compile(r"[^\w\s]", re.UNICODE)


def _fold_char(ch: str) -> str:
    return _UNICODE_FOLD.get(ch, ch)


def _normalize_with_map(
    text: str, *, strip_punctuation: bool = False
) -> Tuple[str, List[int]]:
    """Normalize `text`, keeping a map from each output char to its source index.

    The map is what lets a match found in normalized space be reported as the
    ORIGINAL substring — so a drifted quote is corrected with the document's
    real wording (curly quotes, casing and all), not a flattened version of it.

    Normalization: unicode fold -> casefold -> collapse whitespace runs to a
    single space -> optionally drop punctuation. Leading whitespace is
    dropped rather than emitted, so offsets never point at padding.
    """
    out: List[str] = []
    idx_map: List[int] = []
    prev_space = True  # True at the start, so leading whitespace is skipped

    for i, raw in enumerate(text):
        ch = _fold_char(raw)
        if not ch:
            continue

        if ch.isspace():
            if not prev_space:
                out.append(" ")
                idx_map.append(i)
                prev_space = True
            continue

        if strip_punctuation and _PUNCTUATION.match(ch):
            continue

        # NFKD then casefold: ligatures and compatibility forms collapse the
        # same way on both sides of the comparison.
        folded = unicodedata.normalize("NFKD", ch).casefold()
        folded = "".join(c for c in folded if not unicodedata.combining(c))
        if not folded:
            continue

        for c in folded:
            out.append(c)
            idx_map.append(i)
        prev_space = False

    return "".join(out), idx_map


# ── Location ──────────────────────────────────────────────────────────────────


def _locate_normalized(
    source: str, quote: str, *, strip_punctuation: bool
) -> Optional[Tuple[int, int]]:
    norm_source, idx_map = _normalize_with_map(
        source, strip_punctuation=strip_punctuation
    )
    norm_quote, _ = _normalize_with_map(quote, strip_punctuation=strip_punctuation)
    norm_quote = norm_quote.strip()
    if not norm_quote:
        return None

    pos = norm_source.find(norm_quote)
    if pos < 0:
        return None

    start = idx_map[pos]
    last = pos + len(norm_quote) - 1
    # +1 to make the end exclusive over the final matched source character.
    end = idx_map[last] + 1 if last < len(idx_map) else len(source)
    return start, end


def locate_quote(
    source: str, quote: str
) -> Optional[Tuple[int, int, MatchTier]]:
    """Find `quote` in `source`, trying progressively looser matchers.

    Returns (start, end, tier) indexing into `source`, or None. The first
    matcher to hit wins, so an exact match is never reported as a loose one.
    """
    if not source or not quote or not quote.strip():
        return None

    exact = source.find(quote)
    if exact >= 0:
        return exact, exact + len(quote), MatchTier.EXACT

    found = _locate_normalized(source, quote, strip_punctuation=False)
    if found:
        return found[0], found[1], MatchTier.NORMALIZED

    found = _locate_normalized(source, quote, strip_punctuation=True)
    if found:
        return found[0], found[1], MatchTier.PUNCTUATION

    return None


def verify_quote(source: str, quote: str) -> QuoteVerification:
    """Check one quote against the source text it claims to come from."""
    if not source or not source.strip():
        # No source to check against. Not the same as a fabricated quote.
        return QuoteVerification(quote=quote, status=QuoteStatus.UNVERIFIABLE)

    if not quote or not quote.strip():
        return QuoteVerification(quote=quote, status=QuoteStatus.UNVERIFIABLE)

    hit = locate_quote(source, quote)
    if hit is None:
        return QuoteVerification(quote=quote, status=QuoteStatus.NOT_FOUND)

    start, end, tier = hit
    excerpt = source[start:end]
    status = (
        QuoteStatus.VERIFIED if excerpt == quote else QuoteStatus.DRIFTED
    )
    return QuoteVerification(
        quote=quote,
        status=status,
        source_excerpt=excerpt,
        start=start,
        end=end,
        tier=tier,
    )


# ── Redline markup ────────────────────────────────────────────────────────────

# The redline system prompt asks for deletions as ~~struck text~~. Only these
# spans claim to be verbatim document text; **insertions** are the model's own
# proposed wording and must never be "corrected" against the source.
_DELETION_SPAN = re.compile(r"~~(.+?)~~", re.DOTALL)


def extract_deletion_quotes(markup: str) -> List[str]:
    """Pull the ~~struck-through~~ spans out of redline markup, in order."""
    if not markup:
        return []
    return [m.group(1).strip() for m in _DELETION_SPAN.finditer(markup) if m.group(1).strip()]


def verify_redline_markup(markup: str, source: str) -> Tuple[str, VerificationSummary]:
    """Verify every deletion in `markup` against `source`.

    Returns the markup with drifted deletions replaced by the document's real
    wording, plus a summary. Quotes that could not be located are left exactly
    as the model wrote them — rewriting text we could not find would invent a
    correction — and are reported as not_found so the UI can flag them.

    Both arguments must be in the SAME text space. In the redline router that
    means PII-anonymized text on both sides, verified before de-anonymization.
    """
    summary = VerificationSummary()
    if not markup:
        return markup, summary

    def replace(match: re.Match) -> str:
        inner = match.group(1)
        quote = inner.strip()
        if not quote:
            return match.group(0)

        result = verify_quote(source, quote)
        summary.quotes.append(result)

        if result.status is QuoteStatus.DRIFTED and result.source_excerpt:
            # Preserve the model's padding so surrounding markdown still reads
            # correctly; only the quoted text itself is corrected.
            leading = inner[: len(inner) - len(inner.lstrip())]
            trailing = inner[len(inner.rstrip()):]
            return f"~~{leading}{result.source_excerpt}{trailing}~~"

        return match.group(0)

    corrected = _DELETION_SPAN.sub(replace, markup)
    return corrected, summary
