// api/demo/bundle.js — POST { matterTitle, hearingDate?, hearingType?, items: [{title, type, relevanceHint?}] }
// -> { bundle }
// Ported from backend/routers/bundles.py's /generate. Sorting/categorising
// is pure JS (no LLM); relevance statements for items missing a hint are
// generated with one Gemini call for the whole batch.
"use strict";

const { callGemini } = require("./_lib/gemini");
const { RELEVANCE_SYSTEM_PROMPT, LEGAL_DISCLAIMER } = require("./_lib/prompts");
const { withDemoHandler, BadInputError } = require("./_lib/http");

const MAX_ITEMS = 15;
const VALID_TYPES = new Set(["statute", "case", "secondary"]);

function sortKey(item) {
  return item.title.toLowerCase().trim();
}

function categorise(items) {
  const statutes = items.filter((i) => i.type === "statute").sort((a, b) => (sortKey(a) < sortKey(b) ? -1 : 1));
  const cases = items.filter((i) => i.type === "case").sort((a, b) => (sortKey(a) < sortKey(b) ? -1 : 1));
  const secondary = items.filter((i) => i.type === "secondary").sort((a, b) => (sortKey(a) < sortKey(b) ? -1 : 1));
  return { statutes, cases, secondary };
}

async function generateRelevanceStatements(matterTitle, hearingType, items) {
  const itemsText = items
    .map((item, i) => `${i + 1}. ${item.title} [${item.type}]`)
    .join("\n");
  const prompt =
    `Matter: ${matterTitle}\n` +
    `Hearing type: ${hearingType || "Not specified"}\n\n` +
    `For each of the following authorities, write a relevance statement (maximum 3 sentences):\n\n${itemsText}\n\n` +
    `Format your response exactly as:\n1. [relevance statement]\n2. [relevance statement]\netc.`;

  const { text: response, model } = await callGemini({
    systemPrompt: RELEVANCE_SYSTEM_PROMPT,
    userText: prompt,
    maxOutputTokens: 1536,
  });

  const result = {};
  for (const rawLine of response.trim().split("\n")) {
    const line = rawLine.trim();
    const m = line.match(/^(\d+)\.\s+(.+)$/);
    if (!m) continue;
    const idx = parseInt(m[1], 10) - 1;
    if (idx >= 0 && idx < items.length) result[items[idx].title] = m[2];
  }
  return { result, model };
}

function buildBundleOutput(matterTitle, hearingDate, hearingType, statutes, cases, secondary) {
  function formatSection(items, startNum) {
    return items.map((item, i) => ({
      tab: String(startNum + i),
      title: item.title,
      type: item.type,
      relevance: item.relevanceHint || "Refer to this authority as cited in submissions.",
    }));
  }
  let tabNum = 1;
  const tocStatutes = formatSection(statutes, tabNum);
  tabNum += statutes.length;
  const tocCases = formatSection(cases, tabNum);
  tabNum += cases.length;
  const tocSecondary = formatSection(secondary, tabNum);

  return {
    coverPage: {
      title: "BUNDLE OF AUTHORITIES",
      matter: matterTitle,
      hearingDate: hearingDate || "To be confirmed",
      hearingType: hearingType || "",
      formattingNote:
        "Format: Times New Roman 12pt, page numbers top-right. Tabs to be inserted. Authorities to be separated by dividers.",
    },
    tableOfContents: {
      part1Statutes: { heading: "PART 1 — STATUTES AND SUBSIDIARY LEGISLATION", note: "Listed alphabetically", items: tocStatutes },
      part2Cases: { heading: "PART 2 — CASES", note: "Listed alphabetically", items: tocCases },
      part3Secondary: { heading: "PART 3 — SECONDARY MATERIALS", note: "Listed alphabetically", items: tocSecondary },
    },
    totalTabs: statutes.length + cases.length + secondary.length,
  };
}

module.exports = withDemoHandler(async (body) => {
  const matterTitle = typeof body.matterTitle === "string" ? body.matterTitle.trim().slice(0, 200) : "";
  const hearingDate = typeof body.hearingDate === "string" ? body.hearingDate.trim().slice(0, 100) : "";
  const hearingType = typeof body.hearingType === "string" ? body.hearingType.trim().slice(0, 100) : "";
  const rawItems = Array.isArray(body.items) ? body.items.slice(0, MAX_ITEMS) : [];

  const items = rawItems
    .filter((i) => i && typeof i.title === "string" && i.title.trim() && VALID_TYPES.has(i.type))
    .map((i) => ({
      title: i.title.trim().slice(0, 300),
      type: i.type,
      relevanceHint: typeof i.relevanceHint === "string" ? i.relevanceHint.trim().slice(0, 500) : "",
    }));

  if (items.length === 0) throw new BadInputError("Please add at least one case, statute, or secondary material.");

  const { statutes, cases, secondary } = categorise(items);
  const allItems = [...statutes, ...cases, ...secondary];
  const needingRelevance = allItems.filter((i) => !i.relevanceHint);

  let model = null;
  if (needingRelevance.length > 0) {
    const { result, model: usedModel } = await generateRelevanceStatements(matterTitle, hearingType, needingRelevance);
    model = usedModel;
    for (const item of allItems) {
      if (result[item.title]) item.relevanceHint = result[item.title];
    }
  }

  const bundle = buildBundleOutput(matterTitle, hearingDate, hearingType, statutes, cases, secondary);

  return {
    matterTitle,
    hearingDate,
    hearingType,
    bundle,
    model,
    summary: { totalItems: items.length, statutes: statutes.length, cases: cases.length, secondary: secondary.length },
    disclaimer: LEGAL_DISCLAIMER,
  };
});
