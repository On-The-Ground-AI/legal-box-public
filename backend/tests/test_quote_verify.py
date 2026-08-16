# Tests for quote_verify — the guard that stops the redline tool showing a
# strikethrough over wording that is not in the lawyer's contract.

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from quote_verify import (  # noqa: E402
    MatchTier,
    QuoteStatus,
    extract_deletion_quotes,
    locate_quote,
    verify_quote,
    verify_redline_markup,
)


CONTRACT = (
    "1. The Supplier shall indemnify the Customer against all losses.\n"
    "2. Liability is capped at the fees paid in the preceding 12 months.\n"
    "3. This Agreement is governed by the laws of Singapore.\n"
)


# ── Locating ──────────────────────────────────────────────────────────────────


def test_exact_quote_is_verified():
    quote = "Liability is capped at the fees paid in the preceding 12 months."
    result = verify_quote(CONTRACT, quote)
    assert result.status is QuoteStatus.VERIFIED
    assert result.verified
    assert result.tier is MatchTier.EXACT
    assert result.source_excerpt == quote
    assert CONTRACT[result.start:result.end] == quote


def test_whitespace_drift_is_located_and_corrected():
    # The model collapsed the spacing but the clause is genuinely there.
    result = verify_quote(CONTRACT, "Liability   is capped\nat the fees paid")
    assert result.status is QuoteStatus.DRIFTED
    assert not result.verified
    assert result.located
    assert result.tier is MatchTier.NORMALIZED
    assert result.source_excerpt == "Liability is capped at the fees paid"


def test_case_drift_is_located():
    result = verify_quote(CONTRACT, "THE SUPPLIER SHALL INDEMNIFY THE CUSTOMER")
    assert result.status is QuoteStatus.DRIFTED
    # The correction carries the document's real casing, not the model's.
    assert result.source_excerpt == "The Supplier shall indemnify the Customer"


def test_punctuation_drift_is_located_at_the_loosest_tier():
    source = "The Seller's liability, howsoever arising, shall be limited."
    result = verify_quote(source, "The Sellers liability howsoever arising")
    assert result.status is QuoteStatus.DRIFTED
    assert result.tier is MatchTier.PUNCTUATION
    assert result.source_excerpt == "The Seller's liability, howsoever arising"


def test_curly_quotes_and_dashes_fold_to_ascii():
    # Word emits typographic characters; models retype them as ASCII.
    source = "The “Effective Date” means 1 January 2026 — as agreed."
    result = verify_quote(source, 'The "Effective Date" means 1 January 2026 - as agreed.')
    assert result.located
    assert result.source_excerpt == source


def test_fabricated_quote_is_not_found():
    result = verify_quote(CONTRACT, "The Supplier waives all rights to arbitration.")
    assert result.status is QuoteStatus.NOT_FOUND
    assert not result.verified
    assert result.source_excerpt is None


def test_exact_match_wins_over_looser_tiers():
    source = "Payment terms: 30 days. payment terms: 60 days."
    result = verify_quote(source, "payment terms: 60 days.")
    assert result.tier is MatchTier.EXACT
    assert result.status is QuoteStatus.VERIFIED
    # Must land on the exact occurrence, not the case-insensitive earlier one.
    assert result.start == source.index("payment terms: 60 days.")


# ── Honest failure modes ──────────────────────────────────────────────────────


@pytest.mark.parametrize("source", ["", "   ", "\n\t "])
def test_unreadable_source_is_unverifiable_not_missing(source):
    # "We could not check" must never be reported as "we checked and it's absent".
    result = verify_quote(source, "any clause at all")
    assert result.status is QuoteStatus.UNVERIFIABLE
    assert result.status is not QuoteStatus.NOT_FOUND


@pytest.mark.parametrize("quote", ["", "   "])
def test_empty_quote_is_unverifiable(quote):
    assert verify_quote(CONTRACT, quote).status is QuoteStatus.UNVERIFIABLE


def test_quote_spanning_the_truncation_boundary_is_not_found():
    # The router verifies against the 14k excerpt the model saw, so text past
    # the cut must not silently verify.
    full = "A" * 13_990 + " the indemnity survives termination of this Agreement."
    excerpt = full[:14_000]
    result = verify_quote(excerpt, "the indemnity survives termination of this Agreement.")
    assert result.status is QuoteStatus.NOT_FOUND


# ── Offset integrity ──────────────────────────────────────────────────────────


def test_offsets_index_the_original_text_through_loose_tiers():
    source = "Clause 4.2:  The   Buyer,  acting reasonably,  may terminate."
    hit = locate_quote(source, "the buyer acting reasonably may terminate")
    assert hit is not None
    start, end, tier = hit
    assert tier is MatchTier.PUNCTUATION
    # Slicing the ORIGINAL with these offsets must reproduce the real wording.
    assert source[start:end] == "The   Buyer,  acting reasonably,  may terminate"


def test_leading_whitespace_is_not_included_in_the_match():
    source = "   The Supplier shall deliver."
    result = verify_quote(source, "The Supplier shall deliver.")
    assert result.start == 3
    assert result.source_excerpt == "The Supplier shall deliver."


# ── PII token space ───────────────────────────────────────────────────────────


def test_verification_works_in_anonymized_token_space():
    # The model sees tokens, so it quotes tokens. Both sides must be anonymized.
    anonymized = "The claim by [PERSON_1] against [ORG_1] is time-barred."
    result = verify_quote(anonymized, "The claim by [PERSON_1] against [ORG_1]")
    assert result.status is QuoteStatus.VERIFIED


def test_router_ordering_verify_in_token_space_then_restore():
    """Mirrors routers/redline.py: verify against the anonymized excerpt, then
    de-anonymize. Verifying after restoration would compare a token-length
    quote against a real-value source and spuriously fail."""
    from pii_shield import anonymize, deanonymize

    original = (
        "The Supplier shall notify john.tan@acme.com.sg within 7 days.\n"
        "Liability is capped at the fees paid.\n"
    )
    pii = anonymize(original)
    assert pii.token_map, "fixture must contain detectable PII"

    # Derive the model's quote from the REAL anonymized line, lowercased to
    # simulate casing drift. Hand-assembling it around a token from
    # token_map would depend on which recognizers are active, and that
    # differs between the regex-only fallback and full spaCy NER.
    anon_line = pii.anonymized_text.splitlines()[0]
    assert "[" in anon_line, "first line should carry at least one PII token"
    model_markup = f"~~{anon_line.lower()}~~"

    verified_markup, summary = verify_redline_markup(model_markup, pii.anonymized_text)
    data = summary.to_dict()
    assert data["drifted"] == 1, "should locate the clause despite casing drift"
    assert data["not_found"] == 0

    # Correction restored the source's exact text — including the token's
    # own casing, which the lowercased quote had destroyed.
    assert verified_markup == f"~~{anon_line}~~"

    # Restoration happens after verification, exactly as the router does it.
    # The round trip must reproduce the original line character-for-character.
    final = deanonymize(verified_markup, pii.token_map)
    assert final == f"~~{original.splitlines()[0]}~~"
    assert "john.tan@acme.com.sg" in final


# ── Redline markup ────────────────────────────────────────────────────────────


def test_extract_deletion_quotes_ignores_insertions():
    markup = (
        "~~The Supplier shall indemnify the Customer against all losses.~~\n"
        "**The Supplier shall indemnify the Customer against direct losses only.**\n"
        "> **Why:** caps exposure.\n"
    )
    quotes = extract_deletion_quotes(markup)
    assert quotes == ["The Supplier shall indemnify the Customer against all losses."]


def test_drifted_deletion_is_corrected_in_place():
    markup = "~~the supplier shall indemnify the customer~~\n**revised wording**"
    corrected, summary = verify_redline_markup(markup, CONTRACT)

    assert "~~The Supplier shall indemnify the Customer~~" in corrected
    # The model's own proposed insertion is untouched.
    assert "**revised wording**" in corrected

    data = summary.to_dict()
    assert data["checked"] == 1
    assert data["drifted"] == 1
    assert data["verified"] == 0


def test_fabricated_deletion_is_left_alone_and_flagged():
    markup = "~~The Supplier waives all rights to arbitration.~~"
    corrected, summary = verify_redline_markup(markup, CONTRACT)

    # We could not find it, so we must not invent a correction for it.
    assert corrected == markup
    data = summary.to_dict()
    assert data["not_found"] == 1
    assert data["quotes"][0]["status"] == "not_found"
    assert data["quotes"][0]["source_excerpt"] is None


def test_summary_counts_across_mixed_deletions():
    markup = (
        "~~This Agreement is governed by the laws of Singapore.~~\n"
        "~~liability is CAPPED at the fees paid~~\n"
        "~~The Supplier waives all rights to arbitration.~~\n"
    )
    _, summary = verify_redline_markup(markup, CONTRACT)
    data = summary.to_dict()
    assert data["checked"] == 3
    assert data["verified"] == 1
    assert data["drifted"] == 1
    assert data["not_found"] == 1


def test_markup_without_deletions_is_unchanged():
    markup = "## Summary of Key Changes\n- Nothing needed changing."
    corrected, summary = verify_redline_markup(markup, CONTRACT)
    assert corrected == markup
    assert summary.to_dict()["checked"] == 0


def test_multiline_deletion_span_is_handled():
    markup = "~~The Supplier shall indemnify\nthe Customer against all losses.~~"
    corrected, summary = verify_redline_markup(markup, CONTRACT)
    data = summary.to_dict()
    assert data["checked"] == 1
    assert data["drifted"] == 1
    assert "against all losses." in corrected
