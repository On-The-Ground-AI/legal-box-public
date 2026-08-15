// app.js — Legal Box Live Demo. Vanilla JS, no build step, no framework.
//
// Privacy design: every tool anonymizes text with piiShield.js (in-browser,
// no network call) BEFORE sending anything to /api/demo/*. The token map
// that lets us restore real values never leaves the browser — only the
// anonymized text and the model's anonymized reply cross the network.
"use strict";

(function () {
  const PII = window.LegalBoxPII;

  // ── Small shared utilities ──────────────────────────────────────────────

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function downloadText(filename, content, mime) {
    const blob = new Blob([content], { type: mime || "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function setStatus(el, message, kind) {
    el.textContent = message || "";
    el.className = "status-line" + (kind === "error" ? " error" : "");
  }

  // Minimal markdown-ish renderer for model output: ## headings, - bullets,
  // **bold**, ~~strikethrough~~, > blockquotes. Escapes HTML first so raw
  // model/document text can never inject markup.
  function renderMarkdownish(raw) {
    const escaped = escapeHtml(raw);
    const lines = escaped.split("\n");
    let html = "";
    let inList = false;
    function inline(text) {
      return text
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/~~(.+?)~~/g, "<del>$1</del>");
    }
    for (const line of lines) {
      const heading = line.match(/^(#{2,4})\s+(.*)$/);
      const bullet = line.match(/^[\-\*]\s+(.*)$/);
      const quote = line.match(/^&gt;\s*(.*)$/);
      if (heading) {
        if (inList) { html += "</ul>"; inList = false; }
        const level = Math.min(heading[1].length + 2, 6);
        html += `<h${level}>${inline(heading[2])}</h${level}>`;
      } else if (bullet) {
        if (!inList) { html += "<ul>"; inList = true; }
        html += `<li>${inline(bullet[1])}</li>`;
      } else if (quote) {
        if (inList) { html += "</ul>"; inList = false; }
        html += `<blockquote>${inline(quote[1])}</blockquote>`;
      } else if (line.trim() === "") {
        if (inList) { html += "</ul>"; inList = false; }
        html += "<br/>";
      } else {
        if (inList) { html += "</ul>"; inList = false; }
        html += `<p>${inline(line)}</p>`;
      }
    }
    if (inList) html += "</ul>";
    return html;
  }

  // ── Quota indicator ──────────────────────────────────────────────────────

  const quotaEl = $("#quota-indicator");
  quotaEl.textContent = "Daily AI-call limit: 25 per browser";

  function updateQuota(remaining) {
    quotaEl.textContent = `AI calls left today: ${remaining}`;
    quotaEl.classList.toggle("low", remaining > 0 && remaining <= 5);
    quotaEl.classList.toggle("zero", remaining <= 0);
  }

  async function callDemoApi(path, payload) {
    const resp = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    let data = {};
    try { data = await resp.json(); } catch { /* ignore */ }
    if (!resp.ok) throw new Error(data.error || `Request failed (${resp.status})`);
    if (typeof data.requestsRemainingToday === "number") updateQuota(data.requestsRemainingToday);
    return data;
  }

  // ── Tabs ─────────────────────────────────────────────────────────────────

  function initTabs() {
    $all(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => switchTab(btn.dataset.tab));
    });
  }

  function switchTab(name) {
    $all(".tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
    $all(".tab-panel").forEach((p) => p.classList.toggle("active", p.id === `tab-${name}`));
  }
  window.__legalBoxSwitchTab = switchTab; // used by the prompt library's "Use in chat"

  // ── Sample documents + doc-input widget ─────────────────────────────────

  let manifest = [];
  const sampleTextCache = {};

  async function fetchSampleText(filename) {
    if (sampleTextCache[filename]) return sampleTextCache[filename];
    const resp = await fetch(`/demo/data/sample-docs/${encodeURIComponent(filename)}`);
    if (!resp.ok) throw new Error("Could not load sample document.");
    const text = await resp.text();
    sampleTextCache[filename] = text;
    return text;
  }

  /**
   * Renders a "use a sample / upload / paste" widget into `mountEl`.
   * Returns { getText(), getSourceName(), setText(text, sourceName) }.
   */
  function createDocInput(mountEl, { tools, placeholder } = {}) {
    const wrap = document.createElement("div");
    wrap.className = "doc-input";

    const relevant = tools ? manifest.filter((m) => m.tools.some((t) => tools.includes(t))) : manifest;
    const chipsHtml = relevant
      .map(
        (m) => `
        <div class="sample-chip" data-filename="${escapeHtml(m.filename)}">
          <span class="name">${escapeHtml(m.docType)}: ${escapeHtml(m.filename.replace(/\.txt$/, ""))}</span>
          <span class="desc">${escapeHtml(m.description)}</span>
          <div class="actions">
            <button type="button" class="btn btn-sm load-sample-btn">Load</button>
            <a class="btn btn-sm" download href="/demo/data/sample-docs/${encodeURIComponent(m.filename)}">Download</a>
          </div>
        </div>`
      )
      .join("");

    wrap.innerHTML = `
      <div class="sample-picker">
        <label>Use a sample document</label>
        <div class="sample-chips">${chipsHtml || '<span style="color:var(--text-muted);font-size:0.8rem;">No samples for this tool.</span>'}</div>
      </div>
      <div class="field-row">
        <div class="field">
          <label>Or upload a .txt file</label>
          <input type="file" accept=".txt,.md" class="upload-input" />
        </div>
      </div>
      <div class="field">
        <label>Or paste text</label>
        <textarea class="paste-input" placeholder="${escapeHtml(placeholder || "Paste text here...")}"></textarea>
      </div>
    `;
    mountEl.appendChild(wrap);

    const textarea = $(".paste-input", wrap);
    const fileInput = $(".upload-input", wrap);
    let sourceName = "Pasted text";

    wrap.addEventListener("click", async (e) => {
      const btn = e.target.closest(".load-sample-btn");
      if (!btn) return;
      const chip = btn.closest(".sample-chip");
      const filename = chip.dataset.filename;
      btn.disabled = true;
      btn.textContent = "Loading…";
      try {
        const text = await fetchSampleText(filename);
        textarea.value = text;
        sourceName = filename;
      } catch (err) {
        alert(err.message);
      } finally {
        btn.disabled = false;
        btn.textContent = "Load";
      }
    });

    fileInput.addEventListener("change", () => {
      const file = fileInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        textarea.value = String(reader.result || "");
        sourceName = file.name;
      };
      reader.readAsText(file);
    });

    return {
      el: wrap,
      getText: () => textarea.value,
      getSourceName: () => sourceName,
      setText: (text, name) => { textarea.value = text; sourceName = name || sourceName; },
    };
  }

  // ── Chat ─────────────────────────────────────────────────────────────────

  function initChat() {
    const log = $("#chat-log");
    const input = $("#chat-input");
    const sendBtn = $("#chat-send");
    const clearBtn = $("#chat-clear");
    const status = $("#chat-status");

    let session = PII.createSession();
    let historyAnon = [];

    function addBubble(role, html) {
      const div = document.createElement("div");
      div.className = "chat-bubble " + (role === "user" ? "user" : "model");
      div.innerHTML = html;
      log.appendChild(div);
      log.scrollTop = log.scrollHeight;
    }

    async function send() {
      const message = input.value.trim();
      if (!message) return;
      sendBtn.disabled = true;
      const { anonymizedText, summary } = PII.anonymize(message, session);
      addBubble("user", escapeHtml(message));
      input.value = "";
      setStatus(status, "Thinking…");

      try {
        const data = await callDemoApi("/api/demo/chat", { message: anonymizedText, history: historyAnon });
        const reply = PII.deanonymize(data.reply, session.tokenMap);
        addBubble("model", renderMarkdownish(reply));
        historyAnon.push({ role: "user", text: anonymizedText });
        historyAnon.push({ role: "model", text: data.reply });
        const pieces = [];
        if (Object.keys(summary).length) pieces.push(PII.describeSummary(summary));
        setStatus(status, pieces.join(" "));
      } catch (err) {
        setStatus(status, err.message, "error");
      } finally {
        sendBtn.disabled = false;
      }
    }

    sendBtn.addEventListener("click", send);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
    });
    clearBtn.addEventListener("click", () => {
      session = PII.createSession();
      historyAnon = [];
      log.innerHTML = "";
      setStatus(status, "Conversation cleared.");
    });

    window.__legalBoxSetChatInput = (text) => { input.value = text; input.focus(); };
  }

  // ── Contract Review ──────────────────────────────────────────────────────

  function initContractReview() {
    const docInput = createDocInput($("#contract-doc-input"), {
      tools: ["contract-review"],
      placeholder: "Paste a contract here...",
    });
    const notes = $("#contract-notes");
    const submit = $("#contract-submit");
    const status = $("#contract-status");
    const output = $("#contract-output");
    const actions = $("#contract-output-actions");
    let lastReview = "";

    submit.addEventListener("click", async () => {
      const text = docInput.getText().trim();
      if (text.length < 50) return setStatus(status, "Please provide more contract text (at least 50 characters).", "error");

      submit.disabled = true;
      setStatus(status, "Reviewing contract…");
      actions.style.display = "none";

      const session = PII.createSession();
      const { anonymizedText, summary } = PII.anonymize(text, session);

      try {
        const data = await callDemoApi("/api/demo/contract-review", {
          text: anonymizedText,
          notes: notes.value.trim(),
        });
        const review = PII.deanonymize(data.review, session.tokenMap);
        lastReview = review;
        output.className = "output-box";
        output.innerHTML = renderMarkdownish(review) + (data.truncated ? '<p style="color:var(--warn);">(Document truncated for the demo.)</p>' : "");
        actions.style.display = "flex";
        setStatus(status, Object.keys(summary).length ? PII.describeSummary(summary) : "No PII detected before sending.");
      } catch (err) {
        setStatus(status, err.message, "error");
      } finally {
        submit.disabled = false;
      }
    });

    $("#contract-download").addEventListener("click", () => downloadText("contract-review.txt", lastReview));
  }

  // ── Redlining ─────────────────────────────────────────────────────────────

  function initRedline() {
    const docInput = createDocInput($("#redline-doc-input"), {
      tools: ["contract-review", "redline"],
      placeholder: "Paste a contract here...",
    });
    const role = $("#redline-role");
    const context = $("#redline-context");
    const submit = $("#redline-submit");
    const status = $("#redline-status");
    const output = $("#redline-output");
    const actions = $("#redline-output-actions");
    let lastMarkup = "";

    submit.addEventListener("click", async () => {
      const text = docInput.getText().trim();
      if (text.length < 50) return setStatus(status, "Please provide more contract text (at least 50 characters).", "error");

      submit.disabled = true;
      setStatus(status, "Drafting redlines…");
      actions.style.display = "none";

      const session = PII.createSession();
      const { anonymizedText, summary } = PII.anonymize(text, session);

      try {
        const data = await callDemoApi("/api/demo/redline", {
          text: anonymizedText,
          clientRole: role.value,
          context: context.value.trim(),
        });
        const markup = PII.deanonymize(data.markup, session.tokenMap);
        lastMarkup = markup;
        output.className = "output-box";
        output.innerHTML = renderMarkdownish(markup);
        actions.style.display = "flex";
        setStatus(status, Object.keys(summary).length ? PII.describeSummary(summary) : "No PII detected before sending.");
      } catch (err) {
        setStatus(status, err.message, "error");
      } finally {
        submit.disabled = false;
      }
    });

    $("#redline-download").addEventListener("click", () => downloadText("redline-markup.txt", lastMarkup));

    // Compare (no AI, no PII exposure, entirely client-side)
    const inputA = createDocInput($("#redline-compare-a-input"), { tools: ["contract-review", "redline"] });
    const inputB = createDocInput($("#redline-compare-b-input"), { tools: ["contract-review", "redline"] });
    const compareOutput = $("#redline-compare-output");

    $("#redline-compare-submit").addEventListener("click", () => {
      const a = inputA.getText();
      const b = inputB.getText();
      if (!a.trim() || !b.trim()) {
        compareOutput.className = "output-box empty";
        compareOutput.textContent = "Provide both versions to compare.";
        return;
      }
      const ops = diffLines(a, b);
      let additions = 0, deletions = 0;
      let html = "";
      for (const op of ops) {
        const line = escapeHtml(op.text);
        if (op.type === "delete") { deletions++; html += `<div style="background:rgba(248,113,113,0.15);text-decoration:line-through;">${line}</div>`; }
        else if (op.type === "insert") { additions++; html += `<div style="background:rgba(74,222,128,0.15);">${line}</div>`; }
        else html += `<div>${line}</div>`;
      }
      compareOutput.className = "output-box";
      compareOutput.innerHTML = `<div class="pii-summary-line" style="margin-bottom:0.6rem;">${additions} lines added, ${deletions} lines removed.</div>` + html;
    });
  }

  function diffLines(a, b) {
    const linesA = a.split(/(?<=\n)/);
    const linesB = b.split(/(?<=\n)/);
    const n = linesA.length, m = linesB.length;
    const dp = new Array(n + 1);
    for (let i = 0; i <= n; i++) dp[i] = new Int32Array(m + 1);
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        dp[i][j] = linesA[i] === linesB[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
    const ops = [];
    let i = 0, j = 0;
    while (i < n && j < m) {
      if (linesA[i] === linesB[j]) { ops.push({ type: "equal", text: linesA[i] }); i++; j++; }
      else if (dp[i + 1][j] >= dp[i][j + 1]) { ops.push({ type: "delete", text: linesA[i] }); i++; }
      else { ops.push({ type: "insert", text: linesB[j] }); j++; }
    }
    while (i < n) { ops.push({ type: "delete", text: linesA[i] }); i++; }
    while (j < m) { ops.push({ type: "insert", text: linesB[j] }); j++; }
    return ops;
  }

  // ── Bundle Creator ────────────────────────────────────────────────────────

  function initBundle() {
    const itemsEl = $("#bundle-items");
    const chipsEl = $("#bundle-sample-chips");
    const status = $("#bundle-status");
    const output = $("#bundle-output");
    const actions = $("#bundle-output-actions");
    let lastBundleText = "";
    let rowCount = 0;

    function addRow(prefill) {
      rowCount++;
      const row = document.createElement("div");
      row.className = "bundle-item-row";
      row.innerHTML = `
        <input type="text" class="bundle-title" placeholder="e.g. Tan v. Lee [2024] SGHC 12" value="${escapeHtml(prefill && prefill.title || "")}" />
        <select class="bundle-type">
          <option value="case" ${prefill && prefill.type === "case" ? "selected" : ""}>Case</option>
          <option value="statute" ${prefill && prefill.type === "statute" ? "selected" : ""}>Statute</option>
          <option value="secondary" ${prefill && prefill.type === "secondary" ? "selected" : ""}>Secondary</option>
        </select>
        <button type="button" class="remove-btn" title="Remove">✕</button>
      `;
      $(".remove-btn", row).addEventListener("click", () => row.remove());
      itemsEl.appendChild(row);
    }

    $("#bundle-add-item").addEventListener("click", () => addRow());

    const bundleSampleMeta = [
      { filename: "Case Digest - Ng v Meridian Construction [2025] SGCA 7.txt", type: "case", title: "Ng v. Meridian Construction Pte Ltd [2025] SGCA 7" },
      { filename: "Statute Extract - Workplace Safety and Health Act 2006.txt", type: "statute", title: "Workplace Safety and Health Act 2006, s 12" },
      { filename: "Board Resolution - Golden Orchid Investments.txt", type: "secondary", title: "Board Resolution of Golden Orchid Investments Pte Ltd, 28 March 2026" },
    ];
    chipsEl.innerHTML = bundleSampleMeta
      .map(
        (m) => `<div class="sample-chip" data-idx="${bundleSampleMeta.indexOf(m)}">
          <span class="name">${escapeHtml(m.type)}: ${escapeHtml(m.title)}</span>
          <div class="actions"><button type="button" class="btn btn-sm add-bundle-sample">+ Add to bundle</button></div>
        </div>`
      )
      .join("");
    chipsEl.addEventListener("click", (e) => {
      const btn = e.target.closest(".add-bundle-sample");
      if (!btn) return;
      const idx = parseInt(btn.closest(".sample-chip").dataset.idx, 10);
      addRow(bundleSampleMeta[idx]);
    });

    addRow(); // start with one blank row

    $("#bundle-submit").addEventListener("click", async () => {
      const rows = $all(".bundle-item-row", itemsEl);
      const rawItems = rows
        .map((row) => ({ title: $(".bundle-title", row).value.trim(), type: $(".bundle-type", row).value }))
        .filter((it) => it.title);

      if (rawItems.length === 0) return setStatus(status, "Add at least one case, statute, or secondary material.", "error");

      const submit = $("#bundle-submit");
      submit.disabled = true;
      setStatus(status, "Generating bundle…");
      actions.style.display = "none";

      const session = PII.createSession();
      const matterTitle = PII.anonymize($("#bundle-matter").value.trim(), session).anonymizedText;
      const hearingType = $("#bundle-hearing-type").value.trim();
      const hearingDate = $("#bundle-hearing-date").value.trim();
      const items = rawItems.map((it) => ({ title: PII.anonymize(it.title, session).anonymizedText, type: it.type }));

      try {
        const data = await callDemoApi("/api/demo/bundle", { matterTitle, hearingType, hearingDate, items });
        const de = (s) => PII.deanonymize(s || "", session.tokenMap);
        const b = data.bundle;
        const formatPart = (part) =>
          part.items.map((it) => `  [${it.tab}] ${de(it.title)}\n       ${de(it.relevance)}`).join("\n\n");

        lastBundleText =
          `${b.coverPage.title}\n${de(b.coverPage.matter)}\n` +
          `Hearing: ${b.coverPage.hearingType || "—"} on ${b.coverPage.hearingDate}\n` +
          `${b.coverPage.formattingNote}\n\n` +
          `${b.tableOfContents.part1Statutes.heading}\n${formatPart(b.tableOfContents.part1Statutes) || "  (none)"}\n\n` +
          `${b.tableOfContents.part2Cases.heading}\n${formatPart(b.tableOfContents.part2Cases) || "  (none)"}\n\n` +
          `${b.tableOfContents.part3Secondary.heading}\n${formatPart(b.tableOfContents.part3Secondary) || "  (none)"}\n`;

        output.className = "output-box";
        output.textContent = lastBundleText;
        actions.style.display = "flex";
        setStatus(status, `${data.summary.totalItems} authorities, ${b.totalTabs} tabs.`);
      } catch (err) {
        setStatus(status, err.message, "error");
      } finally {
        submit.disabled = false;
      }
    });

    $("#bundle-download").addEventListener("click", () => downloadText("bundle-of-authorities.txt", lastBundleText));
  }

  // ── Chronology ────────────────────────────────────────────────────────────

  function initChronology() {
    const docsEl = $("#chronology-docs");
    const status = $("#chronology-status");
    const output = $("#chronology-output");
    const actions = $("#chronology-output-actions");
    const docRows = [];
    let lastEvents = [];

    function addDocRow() {
      const wrap = document.createElement("div");
      wrap.className = "card";
      wrap.style.background = "var(--surface-2)";
      const inner = document.createElement("div");
      wrap.appendChild(inner);
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "btn btn-sm";
      removeBtn.textContent = "Remove this document";
      removeBtn.style.marginTop = "0.5rem";
      wrap.appendChild(removeBtn);
      docsEl.appendChild(wrap);

      const docInput = createDocInput(inner, { tools: ["chronology"], placeholder: "Paste litigation document text..." });
      const entry = { wrap, docInput };
      docRows.push(entry);
      removeBtn.addEventListener("click", () => {
        wrap.remove();
        const idx = docRows.indexOf(entry);
        if (idx !== -1) docRows.splice(idx, 1);
      });
    }

    $("#chronology-add-doc").addEventListener("click", addDocRow);
    addDocRow();

    function sortKey(event) {
      const date = event.date || "";
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
      const m = date.match(/\b(19|20)\d{2}\b/);
      return m ? m[0] : "9999";
    }

    $("#chronology-submit").addEventListener("click", async () => {
      const submit = $("#chronology-submit");
      const nonEmpty = docRows.filter((r) => r.docInput.getText().trim());
      if (nonEmpty.length === 0) return setStatus(status, "Add at least one document.", "error");

      submit.disabled = true;
      actions.style.display = "none";
      output.innerHTML = "";
      lastEvents = [];
      const matterTitle = $("#chronology-matter").value.trim();

      for (let i = 0; i < nonEmpty.length; i++) {
        const { docInput } = nonEmpty[i];
        setStatus(status, `Extracting document ${i + 1} of ${nonEmpty.length}…`);
        const session = PII.createSession();
        const { anonymizedText } = PII.anonymize(docInput.getText().trim(), session);
        const source = docInput.getSourceName();
        try {
          const data = await callDemoApi("/api/demo/chronology", {
            matterTitle,
            documents: [{ source, text: anonymizedText }],
          });
          for (const ev of data.events) {
            lastEvents.push({
              date: ev.date || "",
              event: PII.deanonymize(ev.event || "", session.tokenMap),
              parties: PII.deanonymize(ev.parties || "", session.tokenMap),
              source: ev.source || source,
              significance: PII.deanonymize(ev.significance || "", session.tokenMap),
            });
          }
        } catch (err) {
          setStatus(status, `Document ${i + 1} (${source}): ${err.message}`, "error");
        }
      }

      lastEvents.sort((a, b) => (sortKey(a) < sortKey(b) ? -1 : sortKey(a) > sortKey(b) ? 1 : 0));

      if (lastEvents.length === 0) {
        output.innerHTML = '<div class="output-box empty">No events extracted.</div>';
      } else {
        const rows = lastEvents
          .map(
            (e) => `<tr>
              <td>${escapeHtml(e.date)}</td>
              <td>${escapeHtml(e.event)}</td>
              <td>${escapeHtml(e.parties)}</td>
              <td>${escapeHtml(e.source)}</td>
              <td>${escapeHtml(e.significance)}</td>
            </tr>`
          )
          .join("");
        output.innerHTML = `<table class="demo-table"><thead><tr><th>Date</th><th>Event</th><th>Parties</th><th>Source</th><th>Significance</th></tr></thead><tbody>${rows}</tbody></table>`;
        actions.style.display = "flex";
        setStatus(status, `${lastEvents.length} events extracted.`);
      }
      submit.disabled = false;
    });

    $("#chronology-download").addEventListener("click", () => {
      function csvField(v) { return `"${String(v || "").replace(/"/g, '""')}"`; }
      const header = ["Date", "Event", "Parties", "Source", "Significance"].map(csvField).join(",");
      const rows = lastEvents.map((e) => [e.date, e.event, e.parties, e.source, e.significance].map(csvField).join(","));
      downloadText("chronology.csv", [header, ...rows].join("\n"), "text/csv;charset=utf-8");
    });
  }

  // ── Case Search ───────────────────────────────────────────────────────────

  let searchCorpus = [];

  function loadSearchCorpus(seed) {
    let uploads = [];
    try { uploads = JSON.parse(localStorage.getItem("lb_demo_search_uploads") || "[]"); } catch { /* ignore */ }
    searchCorpus = seed.concat(uploads);
  }

  function saveUpload(doc) {
    let uploads = [];
    try { uploads = JSON.parse(localStorage.getItem("lb_demo_search_uploads") || "[]"); } catch { /* ignore */ }
    uploads.push(doc);
    localStorage.setItem("lb_demo_search_uploads", JSON.stringify(uploads));
    searchCorpus.push(doc);
  }

  function escapeRegExp(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

  function scoreDoc(doc, terms) {
    const lower = doc.text.toLowerCase();
    let score = 0;
    let firstIdx = -1;
    for (const term of terms) {
      if (!term) continue;
      const re = new RegExp(escapeRegExp(term), "gi");
      const matches = lower.match(re);
      if (matches) {
        score += matches.length;
        const idx = lower.indexOf(term);
        if (firstIdx === -1 || (idx !== -1 && idx < firstIdx)) firstIdx = idx;
      }
    }
    return { score, firstIdx };
  }

  function snippetAround(text, idx, radius) {
    if (idx === -1) return text.slice(0, radius * 2);
    const start = Math.max(0, idx - radius);
    const end = Math.min(text.length, idx + radius);
    return (start > 0 ? "…" : "") + text.slice(start, end).replace(/\s+/g, " ").trim() + (end < text.length ? "…" : "");
  }

  function initSearch() {
    const query = $("#search-query");
    const resultsEl = $("#search-results");
    const askCard = $("#search-ask-card");
    const askStatus = $("#search-ask-status");
    const answerEl = $("#search-answer");
    let lastResults = [];

    function runSearch() {
      const q = query.value.trim();
      if (!q) { resultsEl.innerHTML = ""; askCard.style.display = "none"; return; }
      const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
      const scored = searchCorpus
        .map((doc) => ({ doc, ...scoreDoc(doc, terms) }))
        .filter((r) => r.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 6);

      lastResults = scored;
      if (scored.length === 0) {
        resultsEl.innerHTML = '<div class="output-box empty">No matches. Try a different term, or add more documents above.</div>';
        askCard.style.display = "none";
        return;
      }

      resultsEl.innerHTML = scored
        .map(
          (r, i) => `
        <div class="search-result">
          <div class="filename">${escapeHtml(r.doc.docType || "Document")}: ${escapeHtml(r.doc.filename)}</div>
          <div class="snippet">${escapeHtml(snippetAround(r.doc.text, r.firstIdx, 160))}</div>
          <label><input type="checkbox" class="ask-checkbox" data-idx="${i}" ${i < 3 ? "checked" : ""}/> Include in AI answer</label>
        </div>`
        )
        .join("");
      askCard.style.display = "block";
      answerEl.className = "output-box empty";
      answerEl.textContent = "Nothing yet.";
    }

    query.addEventListener("input", () => { clearTimeout(query._t); query._t = setTimeout(runSearch, 200); });
    $("#search-run").addEventListener("click", runSearch);

    $("#search-ask").addEventListener("click", async () => {
      const question = $("#search-question").value.trim();
      if (!question) return setStatus(askStatus, "Enter a question first.", "error");
      const checked = $all(".ask-checkbox", resultsEl).filter((c) => c.checked).map((c) => lastResults[parseInt(c.dataset.idx, 10)]);
      if (checked.length === 0) return setStatus(askStatus, "Select at least one result to include.", "error");

      const btn = $("#search-ask");
      btn.disabled = true;
      setStatus(askStatus, "Asking the AI…");

      const session = PII.createSession();
      const qAnon = PII.anonymize(question, session).anonymizedText;
      const snippets = checked.map((r) => ({
        filename: r.doc.filename,
        text: PII.anonymize(r.doc.text, session).anonymizedText,
      }));

      try {
        const data = await callDemoApi("/api/demo/search-answer", { question: qAnon, snippets });
        answerEl.className = "output-box";
        answerEl.innerHTML = renderMarkdownish(PII.deanonymize(data.answer, session.tokenMap));
        setStatus(askStatus, "");
      } catch (err) {
        setStatus(askStatus, err.message, "error");
      } finally {
        btn.disabled = false;
      }
    });

    const uploadInput = createDocInput($("#search-upload-input"), { tools: [], placeholder: "Paste a document to add to the searchable corpus..." });
    // Hide the (empty) sample picker in this one spot — there's nothing to add-from-sample here.
    const picker = $(".sample-picker", uploadInput.el);
    if (picker) picker.style.display = "none";

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "btn btn-sm";
    addBtn.textContent = "Add to search corpus";
    addBtn.style.marginTop = "0.5rem";
    uploadInput.el.appendChild(addBtn);
    addBtn.addEventListener("click", () => {
      const text = uploadInput.getText().trim();
      if (!text) return;
      const filename = uploadInput.getSourceName() === "Pasted text" ? `Pasted document ${Date.now()}` : uploadInput.getSourceName();
      saveUpload({ id: "upload-" + Date.now(), filename, docType: "Uploaded (this browser only)", text });
      alert(`Added "${filename}" to the search corpus for this browser.`);
    });
  }

  // ── Prompt Library ────────────────────────────────────────────────────────

  function initPrompts(prompts) {
    const searchEl = $("#prompts-search");
    const volumeEl = $("#prompts-volume");
    const listEl = $("#prompts-list");

    const volumesSeen = [];
    const volumeLabels = {};
    for (const p of prompts) {
      if (!volumesSeen.includes(p.volume)) { volumesSeen.push(p.volume); volumeLabels[p.volume] = p.volume_label; }
    }
    volumeEl.innerHTML +=
      volumesSeen.map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(volumeLabels[v])}</option>`).join("");

    function render() {
      const q = searchEl.value.trim().toLowerCase();
      const vol = volumeEl.value;
      const filtered = prompts.filter((p) => {
        if (vol && p.volume !== vol) return false;
        if (!q) return true;
        const hay = (p.title + " " + p.category + " " + p.text.slice(0, 300) + " " + (p.tags || []).join(" ")).toLowerCase();
        return hay.includes(q);
      });

      if (filtered.length === 0) {
        listEl.innerHTML = '<div class="output-box empty">No prompts match.</div>';
        return;
      }

      listEl.innerHTML = filtered
        .slice(0, 100)
        .map(
          (p, i) => `
        <div class="prompt-card" data-idx="${prompts.indexOf(p)}">
          <h4>${escapeHtml(p.title)}</h4>
          <div class="meta">${escapeHtml(p.volume_label)} · ${escapeHtml(p.category)}${p.difficulty ? " · " + escapeHtml(p.difficulty) : ""}</div>
          <pre>${escapeHtml(p.text)}</pre>
          ${p.context ? `<p style="font-size:0.78rem;color:var(--text-muted);margin-bottom:0.6rem;"><strong>Context:</strong> ${escapeHtml(p.context)}</p>` : ""}
          <div class="actions">
            <button type="button" class="btn btn-sm copy-prompt-btn">Copy</button>
            <button type="button" class="btn btn-sm use-in-chat-btn">Use in Chat</button>
          </div>
        </div>`
        )
        .join("");
    }

    listEl.addEventListener("click", (e) => {
      const card = e.target.closest(".prompt-card");
      if (!card) return;
      const idx = parseInt(card.dataset.idx, 10);
      const prompt = prompts[idx];
      if (e.target.closest(".copy-prompt-btn")) {
        navigator.clipboard?.writeText(prompt.text).catch(() => {});
        const btn = e.target.closest(".copy-prompt-btn");
        const original = btn.textContent;
        btn.textContent = "Copied!";
        setTimeout(() => { btn.textContent = original; }, 1200);
      } else if (e.target.closest(".use-in-chat-btn")) {
        window.__legalBoxSwitchTab("chat");
        window.__legalBoxSetChatInput(prompt.text);
      }
    });

    searchEl.addEventListener("input", () => { clearTimeout(searchEl._t); searchEl._t = setTimeout(render, 150); });
    volumeEl.addEventListener("change", render);
    render();
  }

  // ── PII Shield ────────────────────────────────────────────────────────────

  function initPiiShield() {
    const docInput = createDocInput($("#pii-doc-input"), { tools: [], placeholder: "Paste text with names, NRICs, emails, phone numbers..." });
    const output = $("#pii-output");
    const summaryEl = $("#pii-summary");

    $("#pii-run").addEventListener("click", () => {
      const text = docInput.getText();
      if (!text.trim()) { output.className = "output-box empty"; output.textContent = "Nothing yet."; return; }
      const { anonymizedText, summary } = PII.anonymize(text);
      output.className = "output-box";
      output.innerHTML = escapeHtml(anonymizedText).replace(/\[[A-Z][A-Z_]*_\d+\]/g, (m) => `<mark class="pii-token">${m}</mark>`);
      summaryEl.style.display = "block";
      summaryEl.textContent = PII.describeSummary(summary);
    });
  }

  // ── Boot ──────────────────────────────────────────────────────────────────

  async function boot() {
    initTabs();

    const [manifestData, corpusData, promptsData] = await Promise.all([
      fetch("/demo/data/manifest.json").then((r) => r.json()).catch(() => []),
      fetch("/demo/data/corpus.json").then((r) => r.json()).catch(() => []),
      fetch("/demo/data/prompts.json").then((r) => r.json()).catch(() => []),
    ]);

    manifest = manifestData;
    loadSearchCorpus(corpusData);

    initChat();
    initContractReview();
    initRedline();
    initBundle();
    initChronology();
    initSearch();
    initPrompts(promptsData);
    initPiiShield();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
