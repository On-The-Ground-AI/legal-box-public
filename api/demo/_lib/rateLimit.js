// _lib/rateLimit.js — a stateless per-browser daily cap on LLM-backed demo
// calls, so one visitor can't rack up unbounded Gemini API cost.
//
// There's no database behind this public demo, so the "bucket" lives in an
// HMAC-signed cookie: {count, day} + a signature the server can verify but
// the client can't forge. It resets at UTC midnight. This is a soft limit —
// a determined script could clear cookies and start over — not a substitute
// for the site owner also watching the Gemini billing dashboard.
"use strict";

const crypto = require("crypto");

const COOKIE_NAME = "lbdemo";
const SECRET = process.env.DEMO_COOKIE_SECRET || "legal-box-demo-dev-secret-change-me";
const DAILY_LIMIT = parseInt(process.env.DEMO_DAILY_LIMIT || "25", 10);

function sign(payload) {
  return crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  header.split(";").forEach((part) => {
    const idx = part.indexOf("=");
    if (idx === -1) return;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  });
  return out;
}

function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

function readBucket(req) {
  const raw = parseCookies(req.headers.cookie)[COOKIE_NAME];
  const fresh = { count: 0, day: todayUTC() };
  if (!raw) return fresh;

  const dot = raw.lastIndexOf(".");
  if (dot === -1) return fresh;
  const payload = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  if (sign(payload) !== sig) return fresh;

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (data.day !== fresh.day) return fresh;
    return { count: data.count || 0, day: data.day };
  } catch {
    return fresh;
  }
}

function writeBucket(res, bucket) {
  const payload = Buffer.from(JSON.stringify(bucket), "utf8").toString("base64url");
  const value = `${payload}.${sign(payload)}`;
  const maxAge = 60 * 60 * 24;
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`
  );
}

/** Call once per LLM-backed request. Returns {allowed, remaining, limit}. */
function checkAndIncrement(req, res) {
  const bucket = readBucket(req);
  if (bucket.count >= DAILY_LIMIT) {
    writeBucket(res, bucket);
    return { allowed: false, remaining: 0, limit: DAILY_LIMIT };
  }
  const next = { count: bucket.count + 1, day: bucket.day };
  writeBucket(res, next);
  return { allowed: true, remaining: DAILY_LIMIT - next.count, limit: DAILY_LIMIT };
}

module.exports = { checkAndIncrement, DAILY_LIMIT };
