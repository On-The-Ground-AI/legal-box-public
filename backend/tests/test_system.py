# test_system.py — resource dashboard + data-wipe endpoints

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="module")
def client():
    import main
    return TestClient(main.app)


def test_system_usage_shape(client):
    resp = client.get("/api/system/usage")
    assert resp.status_code == 200
    body = resp.json()
    for key in ("cpu_percent", "cpu_count", "ram_percent", "ram_used_gb",
                "ram_total_gb", "disk_percent", "disk_free_gb", "gpu",
                "loaded_models"):
        assert key in body, f"missing {key}"
    assert 0 <= body["ram_percent"] <= 100
    assert body["gpu"]["type"] in ("nvidia", "apple_silicon", "none")


def test_wipe_requires_explicit_confirmation(client):
    resp = client.post("/api/system/wipe", json={})
    assert resp.status_code == 400
    resp = client.post("/api/system/wipe", json={"confirm": "yes"})
    assert resp.status_code == 400


def test_wipe_erases_data_dir(client, tmp_path, monkeypatch):
    import config
    # Point DATA_DIR at a throwaway directory with fake user data in it
    fake_data = tmp_path / "legalbox-data"
    (fake_data / "cases").mkdir(parents=True)
    (fake_data / "cases" / "secret.pdf").write_text("client secrets")
    (fake_data / "settings.json").write_text("{}")
    monkeypatch.setattr(config, "DATA_DIR", str(fake_data))

    resp = client.post("/api/system/wipe", json={"confirm": "ERASE"})
    assert resp.status_code == 200
    assert resp.json()["success"] is True
    # The directory itself remains but must be empty
    assert list(fake_data.iterdir()) == []


def test_health_reports_confidentiality_state(client):
    body = client.get("/api/health").json()
    assert "egress_locked" in body
    assert "pii_engine" in body
    assert "pii_ner_active" in body
    assert body["version"] == "1.0.0"


def test_redline_docx_export_has_tracked_changes(client, tmp_path):
    import io
    import zipfile
    from docx import Document

    def docx_bytes(text):
        buf = io.BytesIO()
        d = Document()
        for line in text.split("\n"):
            d.add_paragraph(line)
        d.save(buf)
        return buf.getvalue()

    mime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    resp = client.post(
        "/api/redline/export-docx",
        files={
            "file_a": ("v1.docx", docx_bytes("Clause 1. The seller shall deliver.\nClause 2. Payment in 30 days."), mime),
            "file_b": ("v2.docx", docx_bytes("Clause 1. The seller shall deliver promptly.\nClause 2. Payment in 14 days."), mime),
        },
    )
    assert resp.status_code == 200
    assert "wordprocessingml" in resp.headers["content-type"]
    # A .docx is a zip; the document body must contain real revision marks
    with zipfile.ZipFile(io.BytesIO(resp.content)) as z:
        body = z.read("word/document.xml").decode("utf-8")
    assert "<w:ins " in body
    assert "<w:del " in body
    assert "OTG Legal Box" in body


def test_bundle_pdf_assembly(client):
    import io
    import json as _json
    from pypdf import PdfReader
    from reportlab.pdfgen import canvas as _canvas

    def make_pdf(text, pages=2):
        buf = io.BytesIO()
        c = _canvas.Canvas(buf)
        for i in range(pages):
            c.drawString(72, 720, f"{text} — page {i + 1}")
            c.showPage()
        c.save()
        return buf.getvalue()

    # Get a real bundle structure from /generate (no LLM: relevance off)
    gen = client.post("/api/bundles/generate", json={
        "matter_title": "Test Matter",
        "hearing_type": "Trial",
        "generate_relevance": False,
        "items": [
            {"title": "Beta v. Gamma [2025] SGHC 2", "type": "case",
             "relevance_hint": "On damages."},
            {"title": "Alpha Act 2020, s 5", "type": "statute",
             "relevance_hint": "The governing provision."},
        ],
    })
    assert gen.status_code == 200
    manifest = gen.json()

    resp = client.post(
        "/api/bundles/assemble-pdf",
        data={"manifest": _json.dumps(manifest)},
        files=[
            ("files", ("statute.pdf", make_pdf("Alpha Act"), "application/pdf")),
            ("files", ("case.pdf", make_pdf("Beta v Gamma"), "application/pdf")),
        ],
    )
    assert resp.status_code == 200, resp.text
    assert resp.headers["content-type"] == "application/pdf"

    reader = PdfReader(io.BytesIO(resp.content))
    # cover + >=1 TOC page + 2 tabs x 2 pages
    assert len(reader.pages) >= 6
    outline_titles = [o.title for o in reader.outline if hasattr(o, "title")]
    assert any("Tab 1" in t for t in outline_titles)
    assert any("Tab 2" in t for t in outline_titles)
    # Continuous page numbers stamped
    assert "Page 1 of" in reader.pages[0].extract_text()


def test_bundle_pdf_assembly_wrong_file_count(client):
    import json as _json
    gen = client.post("/api/bundles/generate", json={
        "matter_title": "Test",
        "generate_relevance": False,
        "items": [{"title": "A v. B", "type": "case"}],
    })
    resp = client.post(
        "/api/bundles/assemble-pdf",
        data={"manifest": _json.dumps(gen.json())},
        files=[],
    )
    assert resp.status_code in (400, 422)
