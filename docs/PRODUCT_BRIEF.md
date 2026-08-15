# OTG Legal Box — Product Brief

> For managing partners, IT heads, and procurement | April 2026

---

## At a Glance

| | |
|---|---|
| **Product** | OTG Legal Box — a fully local AI assistant for Singapore law firms |
| **Core capability** | 10 built-in legal tools powered by Gemma 4, running entirely on-premises |
| **Data residency** | All processing occurs on the firm's own hardware; no data leaves the device |
| **Privacy** | Automatic PII Shield anonymises names, NRICs, UENs, phones, emails, and bank accounts before the AI processes any text |
| **Compliance** | Supports PDPA accountability obligations; no third-party data processing agreement required |
| **Deployment** | Desktop (per device) or Server mode (shared Mac Mini/Mac Studio for 5–15 users) |
| **AI model** | Google DeepMind Gemma 4 — three tiers (E4B, 26B, 31B) |
| **Connectivity** | No internet required after initial setup; offline-first by design |
| **Updates** | USB delivery available for fully air-gapped environments |

---

## The Problem: Cloud AI and Legal Confidentiality

Large language models offer significant productivity gains for legal work — summarising judgments, reviewing contracts, and drafting correspondence in minutes rather than hours. However, mainstream AI tools are cloud-based: text is transmitted to remote servers, processed by third parties, and may be stored or used for training.

For Singapore law firms, this creates three interlocking risks:

- **Legal professional privilege** — uploading privileged documents to a cloud AI raises genuine questions about waiver of privilege through third-party disclosure.
- **PDPA obligations** — transferring personal data to an overseas data intermediary requires comparable protection standards, which are difficult to verify and maintain with large cloud AI providers.
- **Data residency** — clients (particularly financial institutions, government-linked entities, and MNCs) increasingly require that their data not leave Singapore.

**The result:** firms that use cloud AI expose themselves to risk; firms that ban AI entirely forgo a significant competitive advantage.

---

## The Solution: OTG Legal Box

OTG Legal Box resolves this dilemma by running the entire AI stack on the firm's own hardware. The Gemma 4 model is downloaded once and stored locally. All inference happens on-device. No query, document, or response is transmitted over the internet.

### 10 Built-In Legal Tools

| Tool | Description |
|---|---|
| **Legal Chat** | Conversational AI for legal research, statutory interpretation, and procedural questions |
| **Summarize** | Structured summaries of contracts, judgments, affidavits, and correspondence |
| **Upload Cases** | Index PDF/Word documents into a searchable local case library |
| **Search Cases** | Semantic search across indexed documents using natural language |
| **Contract Review** | Risk analysis identifying unusual clauses and missing protections |
| **Redlining** | Tracked-changes comparison with plain-English summary |
| **Bundle Creator** | Automated court bundle assembly — bookmarked, paginated PDFs |
| **Chronology** | Multi-document timeline extraction into an editable chronology |
| **Drafting** | First-draft generation for letters, billing narratives, and pleadings |
| **Prompt Library** | Reusable AI instruction templates to standardise firm workflows |

### PII Shield — Automatic Anonymisation

Before any text reaches the AI model, the PII Shield replaces sensitive data with neutral placeholders:

- Names → `[PERSON_1]`, NRICs → `[NRIC_1]`, Phone numbers → `[PHONE_1]`
- Emails → `[EMAIL_1]`, UENs → `[UEN_1]`, Bank accounts → `[BANK_ACCT_1]`

After the AI responds, placeholders are restored to original values. The model never processes real client identifiers.

### Audit Log

Every action is recorded in a tamper-evident local audit log — timestamps, user identity, tool used, PII detection status, and network status (`local_only`). Exportable as CSV or PDF for compliance reviews.

---

## Data Security & PDPA Compliance

- **No outbound connections** — no telemetry, analytics, licence checks, or API calls during operation
- **No third-party processor** — the firm is both data controller and processor for AI work
- **Section 26 (Transfer limitation)** — not engaged, as no data leaves the premises
- **Section 11 (Accountability)** — the audit log provides contemporaneous, exportable evidence of all AI processing, PII handling, and network status
- **No data processing agreement required** — eliminates the operational complexity of cloud AI compliance

---

## System Requirements

All three tiers deliver the same ten tools. The difference is response speed, document capacity, and context window.

| | Minimum | Recommended | Professional |
|---|---|---|---|
| **Model** | Gemma 4 E4B | Gemma 4 26B | Gemma 4 31B |
| **RAM** | 8 GB | 16 GB | 32 GB |
| **Storage** | 20 GB free | 80 GB free | 106 GB free |
| **Hardware** | Any laptop (2017+) | Modern laptop / Mac Mini M4 | Mac Studio M4 Max/Ultra |
| **Context window** | 128K tokens (~90K words) | 256K tokens (~180K words) | 256K tokens (~180K words) |
| **OS** | macOS 14+ / Windows 10+ | macOS 14+ / Windows 10+ | macOS 14+ |
| **GPU** | Not required (CPU mode) | Apple Silicon or NVIDIA RTX 3060+ | Apple Silicon |

**Apple Silicon Macs** (M1/M2/M3/M4) deliver the best performance due to unified memory architecture. **Windows PCs** with NVIDIA GPUs are fully supported via CUDA. Used hardware works — a 16 GB laptop with the E4B model runs all tools comfortably.

---

## Deployment Options

| | Desktop Mode | Server Mode |
|---|---|---|
| **Installation** | `.dmg` (Mac) or `.exe` (Windows) | `.pkg` on Mac Mini or Mac Studio |
| **Users** | 1 per device | 5–15 on office Wi-Fi |
| **Hardware** | Lawyer's own laptop or desktop | Dedicated Mac in office |
| **Access** | Standalone desktop app | Browser-based on office Wi-Fi (no install on individual devices) |
| **User management** | Per-device profiles | Central user management |
| **Shared resources** | Individual only | Shared case library; individual chat histories |

**Desktop Mode** — best for sole practitioners, small firms (< 5 lawyers), or lawyers needing AI when working remotely.

**Server Mode** — best for firms with multiple lawyers sharing a document library, or where centralised IT administration is preferred.

---

## Gemma 4 Model Tiers

**E4B (Minimum)** — 8 GB RAM, ~5 GB storage. Runs on older laptops. Suited to straightforward tasks: document summaries, letter drafting, common research questions. Best entry point for sole practitioners.

**26B (Recommended)** — 16 GB RAM, ~20 GB storage. Substantially improved reasoning and output quality. Handles complex documents comfortably. Best fit for most firms and all Server Mode deployments.

**31B (Professional)** — 32 GB RAM, ~25 GB storage. Highest output quality for complex multi-party pleadings, large transaction documents, and heavy discovery sets. Recommended hardware: Mac Studio. Supports 5–15 concurrent users in Server Mode.

---

## Proof of Concept Offer

For the first five firms, OTG is offering a streamlined POC engagement:

| | |
|---|---|
| **Installation & setup** | 2 man-days on-site |
| **Support** | Up to 10 visits over first 3 months |
| **POC cost** | SGD $2,000 (hardware not included) |
| **Hardware** | Firm purchases own hardware — can start with a Mac Mini; recommended to evaluate upcoming Apple Silicon releases for optimal LLM performance |
| **Scope** | Firm selects tools and workflows to trial |

This POC allows the firm to evaluate OTG Legal Box in a live environment with real workflows before committing to a full deployment.

### Beyond POC

| | |
|---|---|
| **Rate** | SGD $250/hour (SGD $2,000/man-day) |
| **Hardware** | Purchased separately by the firm |
| **Includes** | Installation, configuration, onboarding, and ongoing support |

---

## Contact

*For enquiries, demonstrations, or to reserve a POC slot, contact On The Ground AI.*

*[Contact details to be provided by OTG]*
