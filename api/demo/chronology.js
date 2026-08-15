// api/demo/chronology.js — POST { documents: [{ source, text }], matterTitle? }
// -> { events, totalEvents }
// Ported from backend/routers/chronology.py's /from-text logic, run once per
// uploaded document and merged, same as /extract does for multiple files.
"use strict";

const { callGemini } = require("./_lib/gemini");
const { CHRONOLOGY_SYSTEM_PROMPT, LEGAL_DISCLAIMER } = require("./_lib/prompts");
const { withDemoHandler, BadInputError } = require("./_lib/http");

const MAX_CHARS_PER_DOC = 6000;
const MAX_DOCS = 5;

function parseEvents(rawResponse, source) {
  const events = [];
  for (const rawLine of rawResponse.trim().split("\n")) {
    const line = rawLine.trim();
    if (!line.startsWith("{")) continue;
    try {
      const event = JSON.parse(line);
      if (!event.source) event.source = source;
      events.push(event);
    } catch {
      // The model sometimes adds stray text around the JSON lines — skip it.
    }
  }
  return events;
}

function sortKey(event) {
  const date = event.date || "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  const yearMatch = date.match(/\b(19|20)\d{2}\b/);
  return yearMatch ? yearMatch[0] : "9999";
}

module.exports = withDemoHandler(async (body) => {
  const documents = Array.isArray(body.documents) ? body.documents.slice(0, MAX_DOCS) : [];
  if (documents.length === 0) throw new BadInputError("Please provide at least one document (paste or upload).");

  const matterTitle = typeof body.matterTitle === "string" ? body.matterTitle.trim().slice(0, 200) : "";

  let allEvents = [];
  let lastModel = null;
  for (const doc of documents) {
    const text = typeof doc.text === "string" ? doc.text.trim() : "";
    if (!text) continue;
    const source = (typeof doc.source === "string" && doc.source.trim()) || "Pasted text";
    const truncated = text.length > MAX_CHARS_PER_DOC;
    const excerpt = truncated ? text.slice(0, MAX_CHARS_PER_DOC) : text;
    const prompt = `Document: ${source}\n\n${excerpt}` + (truncated ? "\n\n[... document truncated ...]" : "");

    const { text: raw, model } = await callGemini({
      systemPrompt: CHRONOLOGY_SYSTEM_PROMPT,
      userText: prompt,
      maxOutputTokens: 1536,
    });
    lastModel = model;
    allEvents = allEvents.concat(parseEvents(raw, source));
  }

  allEvents.sort((a, b) => (sortKey(a) < sortKey(b) ? -1 : sortKey(a) > sortKey(b) ? 1 : 0));

  return {
    matterTitle,
    events: allEvents,
    totalEvents: allEvents.length,
    model: lastModel,
    disclaimer: LEGAL_DISCLAIMER,
  };
});
