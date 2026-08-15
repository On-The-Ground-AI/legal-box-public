// api/demo/redline.js — POST { text, clientRole } -> { markup }
// Ported from backend/routers/redline.py's /markup endpoint (AI contract
// markup). The /compare mode needs no LLM at all — it runs entirely in the
// browser (see landing/demo/app.js diffLines()), same as the real backend's
// "no LLM, no PII exposure" comparison path.
"use strict";

const { callGemini } = require("./_lib/gemini");
const { markupSystemPrompt, LEGAL_DISCLAIMER } = require("./_lib/prompts");
const { withDemoHandler, BadInputError } = require("./_lib/http");

const MAX_CHARS = 8000;
const ALLOWED_ROLES = new Set([
  "buyer", "seller", "landlord", "tenant", "employer", "employee", "borrower", "lender",
]);

module.exports = withDemoHandler(async (body) => {
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (text.length < 50) {
    throw new BadInputError("This doesn't look like a contract — please paste or upload more text.");
  }
  const clientRole = ALLOWED_ROLES.has(body.clientRole) ? body.clientRole : "buyer";
  const context = typeof body.context === "string" ? body.context.trim().slice(0, 500) : "";

  const truncated = text.length > MAX_CHARS;
  const excerpt = truncated ? text.slice(0, MAX_CHARS) + "\n\n[... document truncated for the demo ...]" : text;

  const prompt = context
    ? `Context from the lawyer: ${context}\n\n---\n\nContract to redline (representing the ${clientRole}):\n\n${excerpt}`
    : `Contract to redline (representing the ${clientRole}):\n\n${excerpt}`;

  const { text: markup, model } = await callGemini({
    systemPrompt: markupSystemPrompt(clientRole),
    userText: prompt,
    maxOutputTokens: 2048,
  });

  return { markup, clientRole, model, truncated, disclaimer: LEGAL_DISCLAIMER };
});
