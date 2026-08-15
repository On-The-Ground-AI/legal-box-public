// api/demo/search-answer.js — POST { question, snippets: [{filename, text}] }
// -> { answer }
//
// The keyword search itself (matching a query against the bundled sample
// corpus, or anything a visitor uploaded this session) runs entirely
// client-side in landing/demo/app.js — no server round trip, no cost. This
// endpoint is only the optional "synthesize an answer from the top results"
// step, mirroring the real backend's RAG_SYSTEM_PROMPT in main.py.
"use strict";

const { callGemini } = require("./_lib/gemini");
const { RAG_SYSTEM_PROMPT, LEGAL_DISCLAIMER } = require("./_lib/prompts");
const { withDemoHandler, BadInputError } = require("./_lib/http");

const MAX_SNIPPETS = 5;
const MAX_CHARS_PER_SNIPPET = 2000;

module.exports = withDemoHandler(async (body) => {
  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (!question) throw new BadInputError("Please enter a question to ask about the search results.");

  const snippets = Array.isArray(body.snippets) ? body.snippets.slice(0, MAX_SNIPPETS) : [];
  if (snippets.length === 0) throw new BadInputError("Run a search first so there's something to answer from.");

  const excerptsText = snippets
    .map((s, i) => {
      const filename = (typeof s.filename === "string" && s.filename) || `Document ${i + 1}`;
      const text = typeof s.text === "string" ? s.text.slice(0, MAX_CHARS_PER_SNIPPET) : "";
      return `[${filename}]\n${text}`;
    })
    .join("\n\n---\n\n");

  const prompt = `Question: ${question}\n\nExcerpts:\n\n${excerptsText}`;

  const { text: answer, model } = await callGemini({
    systemPrompt: RAG_SYSTEM_PROMPT,
    userText: prompt,
    maxOutputTokens: 1024,
  });

  return { answer, model, disclaimer: LEGAL_DISCLAIMER };
});
