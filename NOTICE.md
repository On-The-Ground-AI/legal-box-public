# NOTICE — Third-party software and content

OTG Legal Box is built on outstanding open-source work. This file records
every incorporated project, its license, and exactly how it is used, so the
provenance of the product is transparent to firms and auditors.

## Bundled in the application (runtime dependencies)

| Project | License | How Legal Box uses it |
|---|---|---|
| [Presidio](https://github.com/data-privacy-stack/presidio) | MIT | **The PII detection engine.** The open-source PII framework originally created by Microsoft powers detection of names, organisations, emails, phones, credit cards, and IBANs inside `backend/pii_shield.py`, layered with Legal Box's own Singapore recognizers (NRIC/FIN, UEN, passports, postal codes, addresses, court case numbers). Restoration (de-anonymization) is Legal Box's reversible token map. |
| [spaCy](https://spacy.io) + `en_core_web_lg`/`sm` | MIT | NER model backing Presidio's name/organisation detection. |
| [Ollama](https://github.com/ollama/ollama) | MIT | The local LLM runtime. Bundled in the installer and managed by the app (a user's own Ollama is detected and used instead). |
| Gemma 4 (Google) | [Gemma Terms of Use](https://ai.google.dev/gemma/terms) | The local language model family (e4b/26b/31b), downloaded by the user at first launch via Ollama. |
| [MarkItDown](https://github.com/microsoft/markitdown) (Microsoft) | MIT | "Fast" document engine for DOCX/PPTX/XLSX/HTML in `backend/document_parser.py`. |
| [pdfplumber](https://github.com/jsvine/pdfplumber) | MIT | "Fast" PDF text extraction. |
| [Docling](https://github.com/docling-project/docling) (IBM) | MIT | Optional "Accurate" engine — layout-aware PDF/Office parsing (the same parser used by OpenContracts). |
| [Tesseract](https://github.com/tesseract-ocr/tesseract) (via pytesseract) | Apache 2.0 | Optional OCR for scanned PDFs (Settings toggle, off by default). |
| [pypdf](https://github.com/py-pdf/pypdf) | BSD-3 | PDF merge/bookmarks/page numbering for court-bundle assembly. |
| [python-docx](https://github.com/python-openxml/python-docx) | MIT | DOCX fallback reader and tracked-changes redline export. |
| [ChromaDB](https://github.com/chroma-core/chroma) | Apache 2.0 | Local vector store for case search (telemetry disabled). |
| [sentence-transformers](https://www.sbert.net) + all-MiniLM-L6-v2 | Apache 2.0 | Local embeddings for semantic case search (bundled; never fetched at runtime). |
| FastAPI, uvicorn, pydantic, httpx, psutil | MIT/BSD | Backend framework and system telemetry. |
| Electron, React, Vite, Tailwind CSS, lucide-react | MIT | Desktop shell and UI. |

## Adapted content

| Project | License | How Legal Box uses it |
|---|---|---|
| [claude-for-legal](https://github.com/anthropics/claude-for-legal) (Anthropic) | Apache 2.0 | Selected practice-area skills adapted into the local prompt library (`backend/prompts/volume-9-claude-for-legal/`), rewritten for Singapore practice (PDPA, Employment Act 1968, Rules of Court 2021) and the local model. Its cloud connectors and managed agents are **not** used — Legal Box never calls external AI APIs. Each adapted file carries attribution. |

## Used at development/content time only — never shipped in the product

| Project | License | Boundary |
|---|---|---|
| [legal-sources](https://github.com/worldwidelaw/legal-sources) (worldwidelaw) | **AGPL-3.0** | Its Singapore collectors are run on a development machine to gather public-domain SG judgments for the starter case-law set. **Only the resulting public legal data ships; the AGPL code never enters the application bundle.** See `scripts/content/build-sg-caselaw.md`. |
| [Label Studio](https://github.com/HumanSignal/label-studio) (HumanSignal) | Apache 2.0 | Runs on a development machine to maintain the gold-labelled PII benchmark corpus that gates releases. See `docs/PII_BENCHMARK.md`. |

## Live web demo only — not part of the installed product

The hosted preview at `/demo` (`landing/demo/` + `api/demo/`) is a separate,
sandboxed surface for prospects to try the product in a browser. Unlike
everything else in this file, it makes an outbound network call:

| Service | Terms | How the demo uses it |
|---|---|---|
| [Gemini API](https://ai.google.dev/gemini-api) (Google), model `gemini-2.5-flash-lite` | [Gemini API Additional Terms of Service](https://ai.google.dev/gemini-api/terms) | Answers chat/contract-review/redline/chronology/bundle/search requests submitted through the web demo. Text is anonymized in the browser (`landing/demo/piiShield.js`) before it is sent. Nothing here ships in, or is reachable from, the installed application — see `landing/demo/README.md`. |

## Design references (no code incorporated)

| Project | Notes |
|---|---|
| [Stirling-PDF](https://github.com/Stirling-Tools/Stirling-PDF) | Open-core PDF toolbox whose feature set (merge, bookmarks, TOC, page numbering) defines the bar for Legal Box's bundle-PDF assembly, implemented natively with pypdf. Firms running Server mode may optionally deploy Stirling-PDF alongside. |
| [OpenContracts](https://github.com/Open-Source-Legal/OpenContracts) (MIT) | Document-intelligence platform whose parsing stack (Docling) Legal Box adopted, and whose annotation/citation-graph workspace informs the post-pilot roadmap. |
| [PII-Shield](https://github.com/gregmos/PII-Shield) | The original reference for the PII layer concept (see LegalBox_App_Research_and_Plan.md §10), since superseded by the Presidio-based implementation. |
| [Mike](https://github.com/Open-Legal-Products/mike) (Open Legal Products) | **AGPL-3.0.** Its published citation-verification behaviour — a progressively looser match ladder, correcting a drifted quote by substituting the source text rather than re-prompting, and reporting an unreadable source as unverifiable rather than absent — informed the design of `backend/quote_verify.py`. **Independently implemented from the observable behaviour and its documentation; no code was copied, and no AGPL code enters the application bundle.** |

---

Thank you to all maintainers. If you believe an attribution here is missing
or wrong, please open an issue.
