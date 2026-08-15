# test_pii_shield.py — the PII shield is the product's core promise;
# these tests are the contract it must never break.

import re

import pytest
from hypothesis import given, settings, strategies as st

import pii_shield
from pii_shield import anonymize, deanonymize

from .conftest import all_regex_values, all_ner_values, TOKEN_RE


# ── No-leak: planted PII must never appear in anonymized output ──────────────

def test_no_leak_regex_tier(fixture_doc):
    name, text, manifest = fixture_doc
    result = anonymize(text)
    for value in all_regex_values(manifest):
        assert value not in result.anonymized_text, (
            f"{name}: '{value}' leaked into the anonymized text"
        )


@pytest.mark.skipif(not pii_shield.ner_active(), reason="NER model not installed")
def test_no_leak_ner_tier(fixture_doc):
    """Person/org names. Requires a NER engine (Presidio or spaCy)."""
    name, text, manifest = fixture_doc
    result = anonymize(text)
    leaked = [
        value for value in all_ner_values(manifest)
        if value in result.anonymized_text
    ]
    # NER recall is never 100%; the benchmark harness tracks the exact rate.
    # This test guards against wholesale regressions (e.g. NER silently off):
    # at least half of all planted names must be caught, and the shield must
    # report PERSON/ORG activity.
    assert len(leaked) <= len(all_ner_values(manifest)) / 2, (
        f"{name}: NER tier leaked most names: {leaked}"
    )
    assert any(k in result.pii_summary for k in ("PERSON", "ORG"))


def test_non_pii_survives(fixture_doc):
    """Bare dates, amounts, and reference numbers must NOT be masked."""
    name, text, manifest = fixture_doc
    result = anonymize(text)
    restored = deanonymize(result.anonymized_text, result.token_map)
    for value in manifest.get("must_survive", []):
        assert value in restored, (
            f"{name}: non-PII '{value}' did not survive the round trip"
        )


# ── Round trip: deanonymize(anonymize(x)) == x ───────────────────────────────

def test_round_trip_identity(fixture_doc):
    name, text, manifest = fixture_doc
    result = anonymize(text)
    assert deanonymize(result.anonymized_text, result.token_map) == text


def test_round_trip_identity_with_many_same_type_entities():
    """Regression: [PERSON_1] must never corrupt [PERSON_10]+ during restore.

    The old implementation used sequential str.replace, so once any entity
    type reached double digits the restore step corrupted the output.
    """
    nrics = [f"S{1000000 + i * 111111 % 9000000:07d}{chr(65 + i)}" for i in range(14)]
    phones = [f"9{1000000 + i * 707 % 8999999:07d}" for i in range(14)]
    lines = [
        f"Party {i + 1} holds NRIC {nric} and can be reached at {phone}."
        for i, (nric, phone) in enumerate(zip(nrics, phones))
    ]
    text = "\n".join(lines)

    result = anonymize(text)
    # Every NRIC must be masked and the counter must exceed 9
    assert result.pii_summary.get("NRIC", 0) == 14
    assert "[NRIC_14]" in result.token_map or "[NRIC_14]" in result.anonymized_text

    restored = deanonymize(result.anonymized_text, result.token_map)
    assert restored == text


def test_tokens_restore_individually():
    """Each token in a big map restores to exactly its own value."""
    text = " ".join(f"S{2000000 + i:07d}A" for i in range(12))
    result = anonymize(text)
    for token, original in result.token_map.items():
        assert deanonymize(token, result.token_map) == original


def test_unknown_tokens_left_untouched():
    assert deanonymize("Hello [PERSON_99]", {"[PERSON_1]": "Tan"}) == "Hello [PERSON_99]"


def test_same_value_reuses_same_token():
    text = "NRIC S1234567A appears twice: S1234567A."
    result = anonymize(text)
    assert result.pii_summary["NRIC"] == 1
    assert result.anonymized_text.count("[NRIC_1]") == 2


# ── Collision / false-positive guards ────────────────────────────────────────

def test_postal_code_not_tagged_as_bank_account():
    result = anonymize("Deliver to Singapore 560123 by courier.")
    assert "BANK_ACCT" not in result.pii_summary
    assert "[POSTAL_CODE_1]" in result.anonymized_text


def test_bank_account_requires_context_keyword():
    no_context = anonymize("The shipment weighed 123456789 grams.")
    assert "BANK_ACCT" not in no_context.pii_summary

    with_context = anonymize("Transfer the sum to account no. 123456789 today.")
    assert with_context.pii_summary.get("BANK_ACCT") == 1


def test_bare_dates_untouched():
    text = "Signed on 15 August 2026, effective 2026-01-10, order qty 20240115 units."
    result = anonymize(text)
    assert result.anonymized_text == text  # nothing here is PII


def test_labelled_dob_masked_but_label_kept():
    result = anonymize("Date of birth: 12/03/1985.")
    assert "12/03/1985" not in result.anonymized_text
    assert "Date of birth" in result.anonymized_text


def test_luhn_rejects_non_card_numbers():
    # 16 digits failing the Luhn check → not a card, must survive
    result = anonymize("Reference 1234 5678 9012 3457 on file.")
    assert "CREDIT_CARD" not in result.pii_summary


def test_luhn_accepts_valid_card():
    result = anonymize("Charge card 4111 1111 1111 1111 for the fee.")
    assert result.pii_summary.get("CREDIT_CARD") == 1


def test_case_number_beats_generic_patterns():
    result = anonymize("As held in [2024] SGCA 12, the appeal was allowed.")
    assert result.pii_summary.get("CASE_NO") == 1


# ── Degraded mode: regex classes must survive any engine failure ─────────────

def test_regex_classes_survive_engine_failure(monkeypatch):
    monkeypatch.setattr(pii_shield, "_PRESIDIO_STATE", False)
    monkeypatch.setattr(pii_shield, "_SPACY_AVAILABLE", False)
    monkeypatch.setattr(pii_shield, "_NLP", None)

    info = pii_shield.engine_info()
    assert info["engine"] == "regex-fallback"
    assert pii_shield.ner_active() is False

    result = anonymize("NRIC S1234567A, phone 91234567, email a@b.com.sg")
    assert result.pii_summary["NRIC"] == 1
    assert result.pii_summary["PHONE"] == 1
    assert result.pii_summary["EMAIL"] == 1


def test_engine_info_shape():
    info = pii_shield.engine_info()
    assert info["engine"] in ("presidio", "spacy-fallback", "regex-fallback")
    assert isinstance(info["ner_active"], bool)


# ── Property test: random PII in template text always round-trips ────────────

nric_st = st.builds(
    lambda p, d, s: f"{p}{d:07d}{s}",
    st.sampled_from("STFG"),
    st.integers(min_value=0, max_value=9_999_999),
    st.sampled_from("ABCDEFGHIJZ"),
)
phone_st = st.builds(
    lambda p, d: f"{p}{d:07d}",
    st.sampled_from("689"),
    st.integers(min_value=0, max_value=9_999_999),
)
email_st = st.builds(
    lambda a, b: f"{a}@{b}.example.com",
    st.text(alphabet="abcdefghijklmnop", min_size=3, max_size=10),
    st.text(alphabet="abcdefghijklmnop", min_size=3, max_size=10),
)


@settings(max_examples=50, deadline=None)
@given(nric=nric_st, phone=phone_st, email=email_st)
def test_property_round_trip(nric, phone, email):
    text = (
        f"The client (NRIC {nric}) called from {phone} and wrote to "
        f"{email} about the hearing."
    )
    result = anonymize(text)
    assert nric not in result.anonymized_text
    assert phone not in result.anonymized_text
    assert email not in result.anonymized_text
    assert deanonymize(result.anonymized_text, result.token_map) == text
