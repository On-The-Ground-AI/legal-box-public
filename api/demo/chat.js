// api/demo/chat.js — POST { message, history? } -> { reply }
//
// The client anonymizes `message`/`history` with piiShield.js before this
// ever gets called, so this function only ever sees already-redacted text —
// it has no PII to protect and nothing worth logging.
"use strict";

const { callGemini } = require("./_lib/gemini");
const { CHAT_SYSTEM_PROMPT } = require("./_lib/prompts");
const { withDemoHandler, BadInputError } = require("./_lib/http");

const MAX_MESSAGE_CHARS = 4000;
const MAX_HISTORY_TURNS = 8;

module.exports = withDemoHandler(async (body) => {
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) throw new BadInputError("Please provide a message.");
  if (message.length > MAX_MESSAGE_CHARS) {
    throw new BadInputError(`Message is too long for the demo (max ${MAX_MESSAGE_CHARS} characters).`);
  }

  const history = Array.isArray(body.history) ? body.history.slice(-MAX_HISTORY_TURNS) : [];
  const contents = [];
  for (const turn of history) {
    const role = turn && turn.role === "model" ? "model" : "user";
    const text = turn && typeof turn.text === "string" ? turn.text.slice(0, MAX_MESSAGE_CHARS) : "";
    if (text) contents.push({ role, parts: [{ text }] });
  }
  contents.push({ role: "user", parts: [{ text: message }] });

  const { text, model } = await callGemini({
    systemPrompt: CHAT_SYSTEM_PROMPT,
    contents,
    maxOutputTokens: 1024,
  });

  return {
    reply: text,
    model,
    disclaimer: "⚠️ AI output must be reviewed by a qualified lawyer. OTG Legal Box does not provide legal advice.",
  };
});
