// api/demo/contract-review.js — POST { text, notes? } -> { review }
// Ported from backend/routers/contracts.py. Client sends already-anonymized text.
"use strict";

const { callGemini } = require("./_lib/gemini");
const { CONTRACT_REVIEW_PROMPT, LEGAL_DISCLAIMER } = require("./_lib/prompts");
const { withDemoHandler, BadInputError } = require("./_lib/http");

const MAX_CHARS = 8000;

module.exports = withDemoHandler(async (body) => {
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (text.length < 50) {
    throw new BadInputError("This doesn't look like a contract — please paste or upload more text.");
  }
  const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 500) : "";

  const truncated = text.length > MAX_CHARS;
  const excerpt = truncated ? text.slice(0, MAX_CHARS) + "\n\n[... document truncated for the demo ...]" : text;

  const prompt = notes
    ? `Context from the lawyer: ${notes}\n\n---\n\nPlease review the following contract:\n\n${excerpt}`
    : `Please review the following contract:\n\n${excerpt}`;

  const { text: review, model } = await callGemini({
    systemPrompt: CONTRACT_REVIEW_PROMPT,
    userText: prompt,
    maxOutputTokens: 2048,
  });

  return { review, model, truncated, disclaimer: LEGAL_DISCLAIMER };
});
