# Changelog

All notable changes to OTG Legal Box are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/); this project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Fixed
- Packaged desktop app could not reach its own backend: the frontend used a
  relative `/api` base, which resolves to `file:///api/…` when Electron loads
  the UI from disk. It now targets `http://127.0.0.1:8000` under a `file://`
  origin and keeps the relative base (and Vite proxy) in the dev server.

### Added
- **Windows installer CI**: `.github/workflows/build-windows.yml`, mirroring
  the existing macOS DMG workflow — builds an unsigned `.exe` (NSIS) on a
  Windows GitHub Actions runner, using the Windows Ollama runtime and the
  `legalbox.spec` PyInstaller config that already supported `win32`. Closes
  the gap where only macOS had automated builds; `scripts/build-app.bat` and
  the electron-builder `win` target already existed but had no CI.
- **Live web demo** at `/demo`, linked from the marketing site's top nav:
  a browser-only preview of every tool (Chat, Contract Review, Redlining,
  Bundle Creator, Chronology, Case Search, Prompt Library, PII Shield) with
  downloadable/uploadable sample documents. Deliberately a separate,
  sandboxed surface (`landing/demo/`, `api/demo/`) — it calls the Gemini
  API instead of a local model, since a public web page can't run Ollama,
  and never touches the installed product's data, database, or egress
  guard. PII anonymization still happens client-side before any network
  call. See `landing/demo/README.md`.
- Go-to-market documentation for the free-software / paid-installation model:
  `docs/GO_TO_MARKET.md`, `docs/INSTALL_SERVICE_RUNBOOK.md`, and
  `docs/TECH_LAW_FEST_2026.md`.
- Open-source governance files: `SECURITY.md`, `CONTRIBUTING.md`, this
  changelog, GitHub issue templates, and a pull-request template.

## [1.0.0] — 2026-07-10

First pilot-ready release. All engineering phases of the pilot plan complete.

### Added
- **PII Shield** rebuilt on [Presidio](https://github.com/data-privacy-stack/presidio)
  (MIT) with Singapore recognizers (NRIC/FIN, UEN, passports, postal codes,
  addresses, court case numbers, labelled DOB, Luhn-checked cards,
  context-gated bank accounts); reversible token-map restoration; degradation
  surfaced in `/api/health` and the UI, never silent. First automated test
  suite + per-entity benchmark + CI gate.
- **Provable zero-egress:** socket-level egress guard; ChromaDB telemetry
  disabled; embedding model bundled for fully-offline operation;
  anonymize-at-ingest so the search index stores only masked text; a
  "Confidentiality" panel that previews exactly what the model sees; tightened
  CORS; the scripted client demo in `docs/CONFIDENTIALITY_DEMO.md`.
- **Plug-and-play install/uninstall:** Ollama bundled and lifecycle-managed by
  the desktop app (a user's own Ollama is used if present); single-instance
  lock; in-app "Remove all data…" wipe plus uninstall scripts; CI DMG build
  with GitHub Releases on version tags.
- **Resource dashboard:** live CPU/RAM/disk/GPU endpoint, Settings panel, and
  sidebar meters, with honest reporting on Apple Silicon.
- **Ten built-in tools:** Chat, Summarize, Upload/Search Cases, Contract
  Review, Redlining (with real tracked-changes Word export), Bundle Creator
  (filing-ready assembled PDFs), Chronology, Drafting, and a Prompt Library.
- **Licensing hygiene:** AGPL PyMuPDF removed in favour of a pluggable
  MIT/Apache document pipeline (pdfplumber + MarkItDown fast; Docling
  accurate; optional Tesseract OCR). Every incorporated project credited in
  `NOTICE.md`.

[Unreleased]: https://github.com/On-The-Ground-AI/legal-box/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/On-The-Ground-AI/legal-box/releases/tag/v1.0.0
