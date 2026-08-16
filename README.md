# OTG Legal Box

**A company brain for your law firm.** Every AI legal tool a firm needs — pre-installed on a box the firm owns, running entirely on its own computer. No internet, no cloud, no data leaving the building.

Built on [Ollama](https://ollama.com/) + 50+ open-source LLMs. All client data is protected by a PII Shield — powered by [Presidio](https://github.com/data-privacy-stack/presidio) with Singapore-specific recognizers — that anonymizes names, NRICs, and phone numbers before anything reaches the AI, and a runtime egress guard that makes non-local network connections impossible.

**Free and open source (MIT).**

---

## Download

| Platform | Installer |
|----------|-----------|
| **Mac** (Apple Silicon) | [`…-mac-arm64.dmg`](https://github.com/On-The-Ground-AI/legal-box-public/releases/latest) |
| **Windows** (64-bit) | [`…-win-x64.exe`](https://github.com/On-The-Ground-AI/legal-box-public/releases/latest) |

System requirements: 8 GB RAM minimum, 16 GB recommended · 20 GB free disk · macOS 12+ or Windows 10/11

> **Intel Macs:** no prebuilt DMG — the release is built on an Apple Silicon runner and bundles an arm64 backend. Build from source per [BUILD-GUIDE.md](BUILD-GUIDE.md).

> **Unsigned-build note:** until code signing is in place, the first launch is blocked once per machine. On macOS, open the app, dismiss the warning, then **System Settings → Privacy & Security → Open Anyway**. On Windows, click **More info → Run anyway** on the SmartScreen prompt. See [INSTALL.md](INSTALL.md) for the full walkthrough.

Maintainers: cutting a release is documented in [RELEASING.md](RELEASING.md).

---

## What It Does

| Tool | What it does |
|------|-------------|
| **Chat** | PII-protected legal Q&A with your choice of 50+ local LLMs |
| **Case Search** | Semantic search over your uploaded case PDFs |
| **Contract Review** | Upload a contract → get a structured risk report |
| **Bundle Creator** | Auto-sort authorities + generate relevance statements |
| **Chronology** | Upload litigation docs → extract a sorted event timeline |
| **Drafting** | Draft letters, billing narratives, and pleadings |

---

## AI Models

OTG Legal Box ships with a bundled catalog of **50+ offline-capable models** — all run locally on your hardware, no internet needed after download:

| Tier | Models | RAM |
|------|--------|-----|
| **Basic** | Llama 3.2 3B, Gemma 3 4B, Qwen 2.5 7B, DeepSeek R1 7B, Phi 4 Mini, Mistral Nemo, Granite 3.1, OLMo 3, ... | 8–12 GB |
| **Recommended** | Llama 3.1 8B, Llama 4 17B, Qwen 2.5 14B, DeepSeek R1 14B, Gemma 4 26B, Nemotron 3 Nano, ... | 16–24 GB |
| **Professional** | Llama 3.1 70B, Qwen 2.5 72B, DeepSeek R1 70B, Gemma 4 31B, GPT OSS 120B, ... | 32–64 GB |

Plus **online mode** with OpenAI, Anthropic, Groq, or Google Gemini for when you want cloud AI with the PII shield still active.

---

## Privacy and PII Protection

The PII Shield runs on every piece of text before it reaches the AI:

| What it detects | Replaced with |
|----------------|--------------|
| Singapore NRIC/FIN (e.g. S1234567A) | `[NRIC_1]` |
| Passport numbers | `[PASSPORT_1]` |
| Phone numbers (+65 format and local) | `[PHONE_1]` |
| Email addresses | `[EMAIL_1]` |
| Dates of birth (when labelled) | `[DOB_1]` |
| Credit card numbers (Luhn-verified) | `[CREDIT_CARD_1]` |
| Person names (Presidio NER) | `[PERSON_1]` |
| Organisations | `[ORG_1]` |
| Singapore addresses and postal codes | `[ADDRESS_1]`, `[POSTAL_CODE_1]` |
| UEN company registration numbers | `[UEN_1]` |
| Bank account numbers (context-gated) | `[BANK_ACCT_1]` |

After the AI responds, real values are restored. The AI never sees actual client data.

Three ways to verify this yourself:
1. **Settings → Confidentiality** — paste any text and see exactly what the AI would receive.
2. **The egress lock** — the backend refuses any non-local network connection at the socket level (`backend/egress_guard.py`); `/api/health` reports `egress_locked: true`.
3. **The scripted demo** — [docs/CONFIDENTIALITY_DEMO.md](docs/CONFIDENTIALITY_DEMO.md) walks a skeptical client through a 5-minute live proof.

---

## Building from Source

### Prerequisites
- **Python 3.10+** — Mac: `brew install python3` · Windows: [python.org](https://python.org/downloads/)
- **Node.js 18+** — [nodejs.org](https://nodejs.org/) LTS
- **Ollama** — [ollama.com](https://ollama.com/) (optional — only needed for local models)

### Clone and run

```bash
git clone https://github.com/On-The-Ground-AI/legal-box-public
cd legal-box
```

**Mac / Linux:**
```bash
chmod +x setup.sh
./setup.sh       # one-time: installs Python + Node dependencies
./start.sh       # start the app
```

**Windows:**
```bash
1. Double-click setup.bat
2. Once setup is complete: double-click start.bat
```

In developer mode the app opens at **http://localhost:3000**.

To build DMG/EXE installers yourself:
```bash
./scripts/build-app.sh
```
Artifacts land in `dist-electron/`. See [BUILD-GUIDE.md](BUILD-GUIDE.md) for details.

---

## Contributing

Contributions are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md). The one rule that overrides everything: no change may break the two core promises (nothing leaves the machine; client PII never reaches the model).

Found a security issue? Follow [SECURITY.md](SECURITY.md).

---

## Built with

OTG Legal Box stands on excellent open-source work — every incorporated project, its license, and exactly how it's used is recorded in [NOTICE.md](NOTICE.md). Highlights:

- **[Presidio](https://github.com/data-privacy-stack/presidio)** (MIT) — the PII detection engine
- **[Ollama](https://github.com/ollama/ollama)** (MIT) — the local AI runtime
- **[MarkItDown](https://github.com/microsoft/markitdown)** (MIT), **[Docling](https://github.com/docling-project/docling)** (MIT), **[pdfplumber](https://github.com/jsvine/pdfplumber)** (MIT), **[Tesseract](https://github.com/tesseract-ocr/tesseract)** (Apache 2.0) — document pipeline
- **[ChromaDB](https://github.com/chroma-core/chroma)** (Apache 2.0) + **sentence-transformers** — local semantic search

---

## License

MIT — see [LICENSE](LICENSE). Free for commercial use.
Third-party components are listed with their licenses in [NOTICE.md](NOTICE.md).

---

## Contact

Want an install, or a pilot? Email **haojun@ontheground.agency**.
