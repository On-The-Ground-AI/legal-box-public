# OTG Legal Box — User Guide

> Version 1.0 | April 2026 | For lawyers and paralegals

---

## 1. What Is OTG Legal Box?

OTG Legal Box is an AI assistant built specifically for Singapore law firms. It helps lawyers and paralegals draft documents, review contracts, search case files, and prepare bundles — all without sending a single word of client data to the internet.

Most AI tools (such as ChatGPT, Copilot, or Claude) run on remote servers operated by technology companies overseas. Every time you paste a client name, a contract clause, or a case summary into one of those tools, that text travels across the internet to a foreign server, where it may be stored, logged, or used to train future models. For a law firm, this creates real risks: potential waiver of legal privilege, breach of client confidentiality, and non-compliance with Singapore's Personal Data Protection Act (PDPA).

OTG Legal Box is different because it is **fully local** — the AI model runs entirely on your own computer or office server, and nothing you type ever leaves your premises.

**What "fully local" means in one sentence:** Your documents, queries, and client data are processed by an AI model stored on your own hard drive; no internet connection is used or required during operation.

### The PII Shield

Before any text reaches the AI model, OTG Legal Box automatically scans it and strips out the following categories of personal and sensitive information:

- **Names** — individual and corporate names
- **NRIC numbers** — Singapore National Registration Identity Card numbers (e.g. S1234567A)
- **Phone numbers** — local and international formats
- **Email addresses**
- **UENs** — Unique Entity Numbers assigned to Singapore-registered businesses
- **Bank account numbers**

These identifiers are replaced with neutral placeholders (e.g. `[PERSON_1]`, `[NRIC_1]`, `[UEN_1]`) before the AI processes your query. The original values are re-inserted into the response after the AI has finished. The AI model itself never sees your client's real identity.

---

## 2. System Requirements

Choose the tier that matches your hardware. You can always start on a lower tier and upgrade the model later.

| | Minimum | Recommended | Professional |
|---|---|---|---|
| **Model** | Gemma 4 E4B | Gemma 4 26B | Gemma 4 31B |
| **RAM** | 8 GB | 16 GB | 32 GB |
| **Free Disk** | 20 GB | 80 GB | 106 GB |
| **Hardware** | Any laptop | Modern laptop | Mac Studio |
| **Context Window** | 128K tokens | 256K tokens | 256K tokens |

The **context window** is the maximum amount of text the AI can consider at once. A larger context window lets you upload longer contracts, more case files, or fuller correspondence threads in a single query.

### How to check your RAM and free disk space

**On a Mac:**
1. Click the Apple menu () at the top-left and select **About This Mac**.
2. Your RAM is shown next to "Memory" (e.g. "16 GB").
3. To check free disk, click **More Info**, scroll to **Storage**, and look at the available space shown on the bar chart.

**On Windows:**
1. Press **Windows + I** to open Settings, then go to **System > About**. Your installed RAM is listed under "Installed RAM".
2. To check free disk, open **File Explorer**, right-click your **C:** drive, and select **Properties**. Free space is shown in the pie chart.

---

## 3. Installation

### 3.1 Mac

1. Download the **LegalBox.dmg** file from the link provided by OTG.
2. Open the downloaded `.dmg` file by double-clicking it.
3. Drag the **LegalBox** icon into your **Applications** folder.
4. Open your **Applications** folder and double-click **LegalBox** to launch it.
5. If macOS shows a security warning ("app from unidentified developer"), go to **System Settings > Privacy & Security** and click **Open Anyway**.

### 3.2 Windows

1. Download the **LegalBox-Setup.exe** file from the link provided by OTG.
2. Double-click the installer and follow the on-screen prompts (Next → Accept License → Install).
3. Once installation is complete, a **LegalBox** shortcut will appear on your Desktop.
4. Double-click the shortcut to launch the app.

### 3.3 The Setup Wizard

When you open OTG Legal Box for the first time, the Setup Wizard will guide you through five steps:

| Step | Name | What It Does |
|---|---|---|
| 1 | **Welcome** | Introduces OTG Legal Box and confirms you have read the privacy notice. |
| 2 | **Device Check** | Scans your computer for available RAM and disk space, and recommends the most suitable model tier. |
| 3 | **Ollama Setup** | Installs Ollama, the engine that runs the AI model locally on your device. This is a one-time installation. |
| 4 | **Model Download** | Downloads the Gemma 4 AI model files to your hard drive. Download size ranges from roughly 5 GB (E4B) to 20 GB (31B) depending on the tier you choose. |
| 5 | **Your Profile** | Asks for your name, email, and role (e.g. Solicitor, Paralegal) to personalise the interface and set up your audit log identity. |

---

## 4. Your First Use

When you open OTG Legal Box after completing the Setup Wizard, you will land on the **Home** screen, which shows your recent activity and quick-launch buttons for each tool.

### What to do when the Setup Wizard appears

Work through each step in order. Do not skip the Device Check — it ensures the model you download is compatible with your hardware. If you are unsure which model tier to choose, select the one recommended by the wizard. You can always switch to a larger model later from **Settings > Model**.

### What to do if Ollama won't start

Ollama is the background service that runs the AI model. If the sidebar shows **"Ollama offline"**, try the following in order:

1. Close and reopen OTG Legal Box.
2. Check that no other application is using Ollama (e.g. a separate Ollama window you opened manually).
3. Restart your computer and reopen OTG Legal Box.
4. If the problem persists, go to **Settings > Diagnostics > Restart Ollama** and click the button.

### How to download a model inside the app

You do not need to use the command line. To download or change models:

1. Click **Settings** (gear icon) in the sidebar.
2. Select **Model**.
3. Choose your desired model tier from the list.
4. Click **Download**. Progress is shown with a progress bar. Do not close the app during the download.

---

## 5. Every Tool Explained

OTG Legal Box includes ten tools, each accessible from the left sidebar.

---

### Legal Chat

**What it does:** Legal Chat is a conversational AI assistant that understands Singapore law. You can ask it questions about legislation, legal principles, procedural rules, and general legal research. It responds in clear, structured prose and can cite relevant statutes or cases when asked. Unlike a general-purpose chatbot, Legal Chat is tuned to understand Singapore-specific context such as the Legal Profession Act, the Rules of Court 2021, and common practice in the Singapore courts.

**When to use it:**
- Quick research on a legal point without opening a browser or a database
- Checking procedural requirements (e.g. timelines for filing a Notice of Appeal)
- Getting a plain-English explanation of a statutory provision to share with a client

**Step-by-step:**
1. Click **Legal Chat** in the sidebar.
2. Type your question in the text box and press **Enter** or click **Send**.
3. Read the response. You can ask follow-up questions in the same conversation thread.
4. To start a fresh topic, click **New Chat**.

**Singapore practice example:** You are acting for a creditor in a debt recovery matter. You type: "What is the current threshold for filing a bankruptcy application in Singapore and what procedural steps are required?" Legal Chat will outline the $15,000 threshold under the Insolvency, Restructuring and Dissolution Act, the need to serve a statutory demand, and the 21-day response window — all without you opening the IRDA or any external website.

---

### Summarize

**What it does:** Summarize takes a document — a contract, a judgment, an affidavit, or a lengthy email thread — and produces a concise, structured summary. You can choose the summary length (short, medium, or detailed) and whether you want a bullet-point or prose format. The summary highlights key obligations, dates, parties, and issues.

**When to use it:**
- Getting a quick overview of a long judgment before a hearing
- Summarising a voluminous affidavit for a client update letter
- Reviewing a contract you have received before beginning a full review

**Step-by-step:**
1. Click **Summarize** in the sidebar.
2. Paste text directly into the text box, or click **Upload File** to upload a PDF or Word document.
3. Choose your preferred output format (bullet points or prose) and length (short / medium / detailed).
4. Click **Summarize**.
5. The summary appears on the right. Click **Copy** to copy it to your clipboard.

**Singapore practice example:** You receive a 47-page High Court judgment at 4 pm before a client call at 4:30 pm. You upload the judgment to Summarize, choose "detailed" and "bullet points", and within a minute you have a structured summary covering the key facts, the judge's findings, and the orders made — ready to walk your client through.

---

### Upload Cases

**What it does:** Upload Cases lets you build a personal case library within OTG Legal Box. You upload PDFs or Word documents — judgments, pleadings, research memos, correspondence — and the app indexes them so they can be searched and retrieved later using Search Cases.

**When to use it:**
- Building a research library for a specific area of law or a long-running matter
- Storing all documents for a file so they can be queried together
- Preparing for a hearing by indexing all relevant judgments in one place

**Step-by-step:**
1. Click **Upload Cases** in the sidebar.
2. Click **Add Files** and select one or more PDF or Word documents from your computer.
3. Assign a **tag** or **matter number** to the documents to keep them organised (optional but recommended).
4. Click **Upload**. The app will process and index each document. Large documents may take a minute.
5. Once indexed, the documents appear in your Cases Library and are available for searching.

**Singapore practice example:** You are working on an employment dispute involving constructive dismissal. You upload 12 relevant High Court and Court of Appeal judgments to the "Constructive Dismissal" tag. They are now fully searchable by keyword, concept, or question.

---

### Search Cases

**What it does:** Search Cases lets you query the documents you have uploaded using natural language. Rather than searching by keyword alone, you can ask questions and the app will retrieve the most relevant passages across all indexed documents. This is sometimes called semantic search — it finds meaning, not just matching words.

**When to use it:**
- Finding every case in your library that discusses a particular legal principle
- Pulling the most relevant passages from a large set of documents for a research memo
- Quickly locating a specific clause or finding across dozens of uploaded files

**Step-by-step:**
1. Click **Search Cases** in the sidebar.
2. Type your search query in natural language (e.g. "cases where the court found no duty of care in pure economic loss").
3. Filter by tag or matter number if you want to limit results to a specific set of documents.
4. Click **Search**. Results appear as excerpted passages with the source document and page number.
5. Click any result to open the full document at that page.

**Singapore practice example:** You have uploaded 20 negligence judgments. You search "standard of care for directors in financially distressed companies" and instantly get the most relevant paragraphs from across all 20 judgments, ranked by relevance.

---

### Contract Review

**What it does:** Contract Review analyses a contract and produces a structured report identifying key clauses, potential risks, unusual provisions, and missing standard terms. The report is organised by clause type (e.g. limitation of liability, termination, governing law) and flags items that may require negotiation or further instruction from the client.

**When to use it:**
- First-pass review of an incoming contract before detailed analysis
- Checking a counterparty's draft against your firm's preferred positions
- Preparing a client-facing issues list

**Step-by-step:**
1. Click **Contract Review** in the sidebar.
2. Upload the contract as a PDF or Word file, or paste the text directly.
3. Select the contract type from the dropdown (e.g. Service Agreement, Sale and Purchase, Employment Contract, NDA).
4. Click **Review**. The report is generated within 1–2 minutes.
5. Review each flagged clause. You can click on a flag to see the original clause text alongside the commentary.
6. Click **Export** to save the report as a PDF or Word document.

**Singapore practice example:** A client sends you a service agreement from a vendor. You upload it, select "Service Agreement", and the review report flags: (a) a broad indemnity clause with no liability cap, (b) a 3-year automatic renewal term with no break right, and (c) a governing law clause pointing to English law rather than Singapore law — giving you an immediate issues list to discuss with the client.

---

### Redlining

**What it does:** Redlining takes an original contract and a revised version, and produces a tracked-changes comparison document showing every addition, deletion, and modification between the two. It also provides a summary of the substantive changes made, so you can quickly understand what has shifted without reading every line.

**When to use it:**
- Reviewing a counterparty's response to your draft contract
- Checking what changes have been made between two versions of a document
- Producing a clean tracked-changes document to send to a client for review

**Step-by-step:**
1. Click **Redlining** in the sidebar.
2. Upload the **Original** document (your initial draft or the version you sent out).
3. Upload the **Revised** document (the counterparty's response or a later version).
4. Click **Compare**.
5. A redlined document appears showing additions in green and deletions in red (standard tracked-changes format).
6. Below the redlined document, a **Changes Summary** lists each substantive modification in plain English.
7. Click **Export** to download the redlined document as a Word (.docx) file.

**Singapore practice example:** You sent a shareholders' agreement to the other side. They return a revised version. You upload both to Redlining and within 30 seconds you can see that they have changed the drag-along threshold from 75% to 51%, removed the non-compete clause entirely, and amended the governing law from Singapore to the Cayman Islands.

---

### Bundle Creator

**What it does:** Bundle Creator assembles a court bundle or document bundle from multiple source files. You select the documents you want to include, arrange them in the correct order, and the app generates a single, bookmarked PDF with a cover page, table of contents, and sequential pagination.

**When to use it:**
- Preparing a Bundle of Documents (BOD) for a court hearing
- Compiling a due diligence bundle for a transaction
- Assembling an agreed bundle for mediation or arbitration

**Step-by-step:**
1. Click **Bundle Creator** in the sidebar.
2. Click **Add Documents** and select the files you want to include.
3. Drag and drop the documents to set the order.
4. Add a title for each document (this becomes the bookmark label in the PDF).
5. Enter a bundle title and select whether you want a cover page.
6. Click **Build Bundle**. The app merges the documents and applies sequential page numbering.
7. Click **Download** to save the completed bundle as a PDF.

**Singapore practice example:** You are preparing for a trial and need to compile a three-volume Bundle of Documents. You add all affidavits, exhibits, and authorities, arrange them in the order specified in your case plan, and generate all three volumes with a single click — each with a cover page and tab bookmarks matching the document list.

---

### Chronology

**What it does:** Chronology extracts dates and events from uploaded documents and assembles them into a timeline. You can upload multiple documents simultaneously (e.g. correspondence, affidavits, contracts, meeting notes) and the app will identify all dated events and present them in chronological order. You can then annotate, re-order, and export the timeline.

**When to use it:**
- Building a factual chronology for a litigation matter
- Preparing a timeline for a client briefing or mediation statement
- Identifying gaps or inconsistencies in a sequence of events

**Step-by-step:**
1. Click **Chronology** in the sidebar.
2. Upload the documents you want to extract events from.
3. Click **Build Chronology**. The app scans the documents and extracts all dated events.
4. Review the extracted events. You can edit descriptions, delete irrelevant entries, or add events manually.
5. To add a manual entry, click **Add Event**, enter the date and description, and click **Save**.
6. Click **Export** to download the chronology as a Word table or a PDF.

**Singapore practice example:** You are acting in a contract dispute. You upload the contract, 60 emails, and two sets of meeting minutes. The Chronology tool extracts 43 dated events and presents them in order — revealing that the client's first written complaint was sent three days before the alleged breach, a key fact for your pleadings.

---

### Drafting

**What it does:** Drafting helps you produce first drafts of common legal documents — correspondence letters, billing narratives, and pleadings. You provide the key facts and instructions, and the app drafts a document structured to the appropriate format. For letters, it follows Singapore law firm conventions. For billing narratives, it produces entries suitable for a client bill or file note. For pleadings, it drafts in the format required by the Rules of Court 2021.

**When to use it:**
- Drafting a letter of demand or client update letter from a set of facts
- Writing billing narratives from a brief description of work done
- Producing a first draft of a Statement of Claim or Defence before partner review

**Step-by-step:**
1. Click **Drafting** in the sidebar.
2. Select the document type from the menu: **Letter**, **Billing Narrative**, or **Pleading**.
3. Fill in the prompt fields. For a letter, this includes: recipient, subject matter, key facts, and desired tone. For a pleading, this includes: party names, cause of action, key facts, and relief sought.
4. Click **Draft**.
5. The draft appears in the editor. You can edit it directly in the app or click **Export** to open it in Word.

**Singapore practice example (billing narrative):** You spent an afternoon reviewing a share purchase agreement, attending a call with the client, and drafting a mark-up. You type a brief description of these activities, click Draft, and the app produces a structured billing narrative with appropriate time entries and descriptions ready for your time recording system.

---

### Prompt Library

**What it does:** The Prompt Library is a collection of pre-written instructions (prompts) for common legal tasks. Instead of typing the same instructions every time you want the AI to perform a familiar task, you save a prompt once and reuse it with a single click. Prompts can be created by individual users or shared across the firm.

**When to use it:**
- Standardising how the AI approaches recurring tasks (e.g. "always draft letters in our firm's format")
- Saving time on repetitive instructions
- Sharing best-practice prompts across associates and paralegals

**Step-by-step:**
1. Click **Prompt Library** in the sidebar.
2. Browse the built-in prompts or click **My Prompts** to see prompts you have saved.
3. To use a prompt, click **Use** next to it. The prompt will open in the relevant tool with your instructions pre-loaded.
4. To save a new prompt: run any query, then click **Save as Prompt**, give it a name and description, and click **Save**.
5. In **Server Mode**, prompts saved to the shared library are visible to all users on the same server.

**Singapore practice example:** Your firm drafts many litigation update letters. You create a prompt: "Draft a client update letter in formal Singapore law firm style, summarising the procedural step that has just occurred, the next step, the estimated timeline, and any action required from the client." Save it once; use it every time.

---

## 6. Data Privacy & Security

### Nothing leaves your computer

When you send a query to OTG Legal Box, the text travels from the app to a local AI model running on your own device or office server — not to any server on the internet. There is no API call to an external service. Your documents, your client names, and your legal analysis never leave your premises.

To confirm this for yourself, open the **Audit Log** (see Section 7). Every entry contains the field `"network": "local_only"` — meaning the request was handled entirely on your device.

### What the PII Shield strips

Before any text reaches the AI model, the PII Shield scans for and replaces the following:

| Data Type | Example | Replaced With |
|---|---|---|
| Personal names | Tan Ah Kow | [PERSON_1] |
| NRIC numbers | S8712345A | [NRIC_1] |
| Phone numbers | +65 9123 4567 | [PHONE_1] |
| Email addresses | client@example.com | [EMAIL_1] |
| UENs | 202312345A | [UEN_1] |
| Bank account numbers | 123-456789-0 | [BANK_ACCT_1] |

After the AI generates its response, the placeholders are replaced with the original values before the response is shown to you. This means the AI's output still reads naturally — you see real names and numbers in the final response, but the AI itself never processed them.

### What the Audit Log records

The Audit Log records:

- Timestamp of each action
- User identity (name and role as set in Your Profile)
- Which tool was used
- The category of query (e.g. "contract review", "chat")
- Whether PII was detected and anonymised
- Network status (always `local_only`)

The Audit Log does **not** record:

- The full text of any document you uploaded
- The content of your queries or AI responses
- Any client names, NRICs, or other personal data

### PDPA compliance posture

Because all data is processed locally, your firm's use of OTG Legal Box does not involve transferring personal data to a third-party data intermediary. This means:

- No Data Protection Agreement with an overseas cloud provider is required for the AI processing itself.
- Your firm remains the data controller at all times.
- The Audit Log provides the accountability and record-keeping documentation required under the PDPA's accountability obligations.

---

## 7. Audit Log — How to Use It

### How to open the Audit Log

Click **Audit Log** in the left sidebar. If you are in Server Mode, you will see activity for your own user account by default. Administrators can view all users' activity.

### What each column means

| Column | Meaning |
|---|---|
| **Timestamp** | Date and time the action was performed (Singapore Time, UTC+8) |
| **User** | The name and role of the user who performed the action |
| **Tool** | Which tool was used (e.g. Legal Chat, Contract Review) |
| **Action** | A brief description of the action (e.g. "query submitted", "document uploaded") |
| **PII Detected** | Whether the PII Shield detected and anonymised any personal data (Yes / No) |
| **Network** | Always shows `local_only` — confirming no internet connection was used |

### How to export for a compliance review

1. Open the Audit Log.
2. Use the date-range filter at the top to select the period you want to export.
3. Click **Export**.
4. Choose your format: **CSV** (for spreadsheet analysis) or **PDF** (for formal reports).
5. The exported file will include all columns. The `network: local_only` field in every row confirms that no data was transmitted externally during that period.

### What "network: local_only" proves

Every Audit Log entry contains the field `"network": "local_only"`. This is a system-generated value, not a user-entered one, and it is recorded at the point of processing. For compliance purposes, this field is evidence that:

- The AI model was running locally at the time of the query.
- No outbound network connection was made.
- Client data was not transmitted to any external service.

This field can be used in a PDPA compliance review, a client confidentiality audit, or an internal IT security review to demonstrate that your firm's AI workflow does not involve external data transfer.

---

## 8. Multi-User / Server Mode

### Desktop Mode vs Server Mode

**Desktop Mode** is the default. One copy of OTG Legal Box is installed on one device. Only the person using that device can access it. This is appropriate for sole practitioners or for lawyers who want a personal AI assistant on their own laptop.

**Server Mode** is designed for a shared office environment. One copy of OTG Legal Box is installed on a central machine (typically a Mac Mini or Mac Studio kept in the office). Colleagues on the same office Wi-Fi network access the app through their web browser — no installation required on individual laptops. Server Mode supports between 5 and 15 simultaneous users, depending on the hardware.

### How to add a colleague in Server Mode

This is done by the person who manages the server (typically an IT manager or Office Manager):

1. On the server machine, open OTG Legal Box and go to **Settings > Users**.
2. Click **Add User**.
3. Enter the colleague's name, email address, and role.
4. Click **Create**. The system generates a login link and a temporary password.
5. Send the link and password to the colleague. They open the link in their browser on the office Wi-Fi and set their own password.

### How switching users works

In Desktop Mode, the app opens directly to the profile of whoever set it up. To switch to a different user profile, click the profile icon at the bottom of the sidebar and select **Switch User**. Each user's chats, uploaded cases, and prompt library entries are kept separate.

In Server Mode, each user logs in with their own credentials via the browser interface. All users share the same AI model and the same Cases Library (uploads are visible to all), but each user has their own chat history, audit log entries, and saved prompts.

---

## 9. USB Updates (Air-Gapped / Offline Updates)

### Why USB updates exist

OTG Legal Box is designed to work without an internet connection. This means it cannot automatically download updates from the internet. To keep your software current — with security patches, new features, and updated model files — OTG provides updates on USB drives that you apply manually. This also suits firms operating in environments where internet access is restricted or audited.

### Mac: Applying a USB update

1. Insert the USB drive provided by OTG.
2. The USB drive contains a folder called `legalbox-update/`. Copy this folder to your Desktop or any convenient location.
3. Open **Terminal** (found in Applications > Utilities).
4. Navigate to the folder: type `cd ~/Desktop/legalbox-update` and press Enter.
5. Run the update script: type `bash usb-update.sh` and press Enter.
6. Follow the on-screen prompts. The update will take 5–15 minutes depending on the size of the update.
7. Reopen OTG Legal Box when prompted.

### Windows: Applying a USB update

1. Insert the USB drive provided by OTG.
2. Open **File Explorer** and navigate to the USB drive. You will see a folder called `legalbox-update/`.
3. Copy the folder to your Desktop.
4. Double-click `usb-update.bat` to run the update script.
5. If Windows asks for permission, click **Yes** (Run as Administrator).
6. Follow the on-screen prompts. The update will take 5–15 minutes.
7. Reopen OTG Legal Box when prompted.

### What gets updated, what never changes

A USB update may update the following:

- The OTG Legal Box application
- The Ollama engine
- The AI model files (if a newer version is included)
- Built-in prompts and tool templates

A USB update will **never** modify or delete:

- Your Cases Library (uploaded documents and their index)
- Your chat history
- Your saved prompts
- Your audit log
- Your user profiles and settings

Your data folder is always preserved untouched. If you are unsure, check the **What This Update Contains** screen shown at the start of every USB update before confirming.

---

## 10. Troubleshooting & FAQ

### "Ollama offline" appears in the sidebar

This means the Ollama engine — the background service that runs the AI model — is not running. Try the following:

1. Close and reopen OTG Legal Box.
2. Go to **Settings > Diagnostics** and click **Restart Ollama**.
3. If the issue persists after restarting the app, restart your computer.
4. If it still shows "Ollama offline" after a restart, contact OTG support and share the diagnostic log (accessible from Settings > Diagnostics > Export Log).

### "Model not found"

This means the AI model has not been downloaded yet, or the model file has been moved or corrupted. To resolve:

1. Go to **Settings > Model**.
2. If the model shows as "Not Downloaded", click **Download**.
3. If the model shows as "Downloaded" but the error persists, click **Re-download** to replace the model files.

### Responses are very slow

If the AI is taking more than a minute to respond to a short query, the likely causes are:

- **Insufficient RAM**: Your device may not have enough RAM for the model you selected. Go to Settings > Model and try switching to a smaller model (e.g. from 26B to E4B).
- **Other applications using memory**: Close other applications, particularly browsers with many tabs open.
- **Large document in context**: If you have uploaded a very large document, the model takes longer to process it. Try summarising it first before querying.

### PDF won't upload

- Ensure the PDF is not password-protected. OTG Legal Box cannot process encrypted PDFs. Remove the password using your PDF application before uploading.
- Check that the file size is under 100 MB.
- If the PDF is a scanned image (not a text-layer PDF), OTG Legal Box may not be able to extract its text. Convert it using an OCR tool first.

### How to move cases to a new computer

1. On your old computer, go to **Settings > Data > Export Cases Library**.
2. This creates a `.legalbox` archive file. Copy this file to a USB drive or transfer it to the new computer.
3. On the new computer, complete the Setup Wizard first.
4. Go to **Settings > Data > Import Cases Library** and select the `.legalbox` file.
5. Your entire Cases Library — all uploaded documents and their indexes — will be restored.

### How to reset the Setup Wizard

If you need to run the Setup Wizard again (for example, to change the AI model or reconfigure Ollama), you can reset it by clearing the app's local storage:

- **Mac:** Open Terminal and run: `defaults delete com.otg.legalbox`
- **Windows:** Open Registry Editor (regedit), navigate to `HKEY_CURRENT_USER\Software\OTG\LegalBox`, and delete the key.

After clearing, reopen OTG Legal Box and the Setup Wizard will run from the beginning. Your Cases Library and data will not be affected.

---

## 11. Glossary

**LLM (Large Language Model)**
The type of AI technology that powers OTG Legal Box. An LLM is trained on vast amounts of text and learns to generate coherent, contextually relevant responses. Gemma 4 is the LLM used in OTG Legal Box.

**Ollama**
The software engine that runs the AI model locally on your device. Ollama is installed automatically during the Setup Wizard. It operates as a background service and does not require any action from you during normal use.

**NRIC (National Registration Identity Card)**
Singapore's national identification number for citizens and permanent residents. Format: one letter, seven digits, one letter (e.g. S1234567A). The PII Shield detects and anonymises NRICs before they reach the AI model.

**UEN (Unique Entity Number)**
A standard identification number assigned by the Accounting and Corporate Regulatory Authority (ACRA) to all registered business entities in Singapore. Format: nine or ten characters (e.g. 202312345A). The PII Shield detects and anonymises UENs.

**PII (Personally Identifiable Information)**
Any information that can be used to identify a specific individual, directly or indirectly. In the context of OTG Legal Box, PII includes names, NRICs, phone numbers, email addresses, UENs, and bank account numbers.

**RAG (Retrieval-Augmented Generation)**
The technique used by Search Cases. When you submit a query, the app first retrieves the most relevant passages from your indexed documents (retrieval), then passes those passages to the AI model to generate an answer (generation). This allows the AI to answer questions based on your specific documents rather than only its general training.

**JSONL (JSON Lines)**
A file format used by OTG Legal Box for audit log exports and data backups. Each line in a JSONL file is a self-contained JSON record. If you open an audit log export, you will see each action recorded on its own line in this format.

**ChromaDB**
The database that stores the document index created when you upload files in Upload Cases. ChromaDB enables the semantic search functionality in Search Cases. All ChromaDB data is stored locally on your device.

**Gemma 4**
The AI language model used in OTG Legal Box, developed by Google DeepMind. OTG Legal Box offers three variants: E4B (most efficient, 8 GB RAM), 26B (balanced, 16 GB RAM), and 31B (highest capability, 32 GB RAM). All variants run entirely on-device.

**Context window**
The maximum amount of text the AI can process in a single interaction, measured in tokens (a token is roughly three-quarters of a word). A larger context window means you can submit longer documents or longer conversation histories in one query. Gemma 4 E4B supports 128K tokens; Gemma 4 26B and 31B support 256K tokens.

**Embedding**
A mathematical representation of a piece of text, used by the search system to measure how similar two pieces of text are in meaning — not just in the words they share. When you upload a document, OTG Legal Box converts it into embeddings so that Search Cases can find passages that are semantically related to your query, even if they do not share the same keywords.
