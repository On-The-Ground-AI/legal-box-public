// _lib/http.js — small shared helpers for the demo's Vercel functions.
"use strict";

const { checkAndIncrement } = require("./rateLimit");

function sendJSON(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json");
  res.send(JSON.stringify(body));
}

function readJsonBody(req) {
  // Vercel's Node runtime parses application/json bodies into req.body
  // automatically; defensively handle the rare case it arrives as a string.
  if (req.body == null) return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body || "{}");
    } catch {
      return {};
    }
  }
  return req.body;
}

/**
 * Wraps a POST-only, rate-limited, Gemini-backed handler with consistent
 * method checks, body parsing, and error → status-code mapping. Never logs
 * request bodies — only metadata (status, timing) — since bodies may
 * contain (anonymized) document text.
 */
function withDemoHandler(handler) {
  return async (req, res) => {
    if (req.method !== "POST") {
      return sendJSON(res, 405, { error: "Method not allowed. Use POST." });
    }

    const gate = checkAndIncrement(req, res);
    if (!gate.allowed) {
      return sendJSON(res, 429, {
        error:
          "You've hit this demo's daily request cap (shared per browser, to keep the hosted demo's " +
          "API costs in check). Please try again tomorrow, or self-host the real app for unlimited use.",
        limit: gate.limit,
      });
    }

    try {
      const body = readJsonBody(req);
      const result = await handler(body, req, res);
      if (!res.writableEnded) {
        sendJSON(res, 200, { ...result, requestsRemainingToday: gate.remaining });
      }
    } catch (err) {
      if (err && err.code === "NOT_CONFIGURED") {
        return sendJSON(res, 503, { error: err.message });
      }
      if (err && err.status === 400) {
        return sendJSON(res, 400, { error: err.message });
      }
      console.error("[demo api error]", err && err.message);
      return sendJSON(res, 502, { error: (err && err.message) || "Something went wrong calling the model." });
    }
  };
}

class BadInputError extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
  }
}

module.exports = { sendJSON, readJsonBody, withDemoHandler, BadInputError };
