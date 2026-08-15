// _lib/gemini.js — thin wrapper around the Gemini REST API (no SDK dependency,
// so the demo's serverless functions need zero npm install step).
//
// Model choice: gemini-2.5-flash-lite — Google's cheapest fast model, picked
// specifically to keep this public-facing demo affordable per request.
"use strict";

const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

class GeminiNotConfiguredError extends Error {
  constructor() {
    super(
      "The live demo's LLM isn't configured yet (GEMINI_API_KEY is not set). " +
      "Ask the site owner to add it in the Vercel project settings."
    );
    this.code = "NOT_CONFIGURED";
  }
}

async function callGemini({ systemPrompt, userText, contents, maxOutputTokens = 1200, temperature = 0.3 }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new GeminiNotConfiguredError();

  const url = `${API_BASE}/${DEFAULT_MODEL}:generateContent`;
  const requestBody = {
    contents: contents || [{ role: "user", parts: [{ text: userText }] }],
    systemInstruction: { parts: [{ text: systemPrompt }] },
    generationConfig: { maxOutputTokens, temperature },
  };

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify(requestBody),
  });

  if (!resp.ok) {
    let detail = "";
    try {
      detail = (await resp.text()).slice(0, 400);
    } catch { /* ignore */ }
    const err = new Error(`Gemini API error (${resp.status}): ${detail || resp.statusText}`);
    err.status = resp.status;
    throw err;
  }

  const data = await resp.json();
  const candidate = data && data.candidates && data.candidates[0];
  const finishReason = candidate && candidate.finishReason;
  const parts = candidate && candidate.content && candidate.content.parts;
  const text = Array.isArray(parts) ? parts.map((p) => p.text || "").join("") : "";

  if (!text) {
    const blocked = data && data.promptFeedback && data.promptFeedback.blockReason;
    throw new Error(
      blocked
        ? `Gemini blocked this request (${blocked}). Try different text.`
        : `Gemini returned an empty response (finishReason: ${finishReason || "unknown"}).`
    );
  }

  return { text, model: DEFAULT_MODEL, finishReason };
}

module.exports = { callGemini, GeminiNotConfiguredError, DEFAULT_MODEL };
