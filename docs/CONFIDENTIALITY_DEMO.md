# Confidentiality Demo — proving nothing leaves the machine

A scripted five-minute walkthrough for showing a client that OTG Legal Box
processes their documents entirely on their own computer, and that personal
information is masked before the AI ever sees it. Every claim below is
something you can demonstrate live.

---

## The promise

1. **Nothing leaves the computer.** After the one-time model download, the
   app makes no outbound internet connections. This is enforced in code, not
   just documented.
2. **PII is masked before the AI sees it.** Names, NRICs, company names,
   phone numbers, addresses, and more are replaced with placeholders
   (`[PERSON_1]`, `[NRIC_1]`…) before any text reaches the model, then the
   real values are restored in the result.

PII detection is powered by [Presidio](https://github.com/data-privacy-stack/presidio)
(the open-source framework originally built by Microsoft, MIT-licensed) with
Singapore-specific recognizers added for NRIC/FIN, UEN, court case numbers,
postal codes, and local phone formats.

---

## Before the meeting

- Install the app and complete the first-run model download (needs internet
  once).
- Have a sample document ready. `backend/tests/fixtures/letter_of_demand.txt`
  is a synthetic letter of demand with no real client data — safe to use.

---

## The demo

### 1. Turn off Wi-Fi, then use every tool (2 min)

Physically disconnect: turn off Wi-Fi / unplug the ethernet cable **before**
opening the app.

- Open **Chat** and ask a legal question — it answers.
- Open **Contract Review** and upload the sample document — it produces a
  report.
- Open **Summarize**, **Drafting**, **Chronology** — all work.

Nothing needs the internet. The AI model runs on the CPU/GPU of this very
machine.

### 2. Show the masking, live (1 min)

Go to **Settings → Confidentiality**. The panel shows:

- **PII shield active — Powered by Presidio + Singapore recognizers**
- **Egress locked — the app can only reach this computer**

Paste any text into the box (or edit the sample) and click **Show what the AI
sees**. The masked version appears: real names and NRICs are replaced with
`[PERSON_1]`, `[NRIC_1]`, etc. Point out that this masked text is *exactly*
what is sent to the model — the real values never leave the shield until the
answer comes back.

### 3. Prove the network is silent (1 min)

Open a terminal and show that the app only ever talks to itself:

**macOS / Linux:**
```
lsof -i -P | grep -E 'legalbox|ollama|Legal'
```
Every connection is to `127.0.0.1` / `localhost` (loopback). There are no
connections to any external host.

For an even stronger demonstration, run a network monitor (Little Snitch on
macOS, GlassWire on Windows) during step 1 and show that the app generates no
outbound traffic.

The backend enforces this in code: it installs a guard at startup that makes
any non-loopback network connection raise an error (`backend/egress_guard.py`).
`GET /api/health` reports `"egress_locked": true` to confirm the guard is
active.

### 4. Walk through the audit log (1 min)

Open **Audit Log**. Every action is recorded locally with:

- what was done and when,
- how many PII items were masked (counts only — never the values themselves),
- `"network": "local_only"` on every entry.

The log is metadata only: it proves what happened without ever storing the
client's confidential content.

---

## Frequently asked questions

**"Does the AI provider see our documents?"**
There is no AI provider. The model (Gemma, via Ollama) runs on this computer.
No account, no API key, no cloud service is involved.

**"Is our data used to train the AI?"**
No. Local models do not learn from your usage; there is no telemetry and no
data ever leaves the machine to be collected.

**"What about the data stored on disk?"**
Case files and the search index are stored in the app's local data folder and
never leave the machine. The PII masking keeps raw personal data out of the
search index. For defence-in-depth on the raw files, enable full-disk
encryption (FileVault on macOS, BitLocker on Windows) — see INSTALL.md.

**"What if the masking misses something?"**
The Confidentiality panel lets you (or the lawyer) preview the masked text for
any document, so coverage is verifiable. As with all AI output, a qualified
lawyer reviews the result — the tool is an assistant, not a substitute.
