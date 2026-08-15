// api.js — All calls to the Python backend go through here.

// Where the backend lives, resolved once at load time.
//
// In the Vite dev server the page is served over http://localhost:3000 and
// "/api" is proxied to the backend (see vite.config.js), so a relative base
// is correct. In the packaged desktop app the UI is loaded from disk with a
// file:// origin — there is no dev proxy and a relative "/api/…" would
// resolve to "file:///api/…" and never reach the backend. Detect that case
// and talk to the local backend directly. The backend CORS layer already
// allows the "null" origin that a file:// page sends.
export const API_ORIGIN =
  (typeof window !== 'undefined' && window.location.protocol === 'file:')
    ? 'http://127.0.0.1:8000'
    : ''

const BASE_URL = `${API_ORIGIN}/api`

async function request(method, path, body = null, isFormData = false) {
  const options = {
    method,
    headers: isFormData ? {} : { 'Content-Type': 'application/json' },
  }
  if (body) {
    options.body = isFormData ? body : JSON.stringify(body)
  }
  const res = await fetch(`${BASE_URL}${path}`, options)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `Request failed: ${res.status}`)
  }
  return res.json()
}

// Named exports used directly by PromptLibrary page
export const getPromptVolumes = (...args) => api.getPromptVolumes(...args)
export const searchPrompts    = (...args) => api.searchPrompts(...args)
export const getPrompt        = (...args) => api.getPrompt(...args)

export const api = {
  // ── Core ───────────────────────────────────────────────────────────────────

  health:         ()         => request('GET',  '/health'),
  listModels:     ()         => request('GET',  '/models'),
  getSettings:    ()         => request('GET',  '/settings'),
  updateSettings: (settings) => request('POST', '/settings', settings),

  /** Preview exactly what the PII shield would send to the AI (nothing stored) */
  piiPreview:     (text)     => request('POST', '/pii/preview', { text }),

  /** Live CPU/RAM/GPU usage for the resource dashboard */
  getSystemUsage: ()         => request('GET',  '/system/usage'),

  /** Erase ALL local data (cases, index, logs, settings) — irreversible */
  wipeAllData:    ()         => request('POST', '/system/wipe', { confirm: 'ERASE' }),

  /** Merge authority PDFs into a filing-ready bundle (cover, TOC, bookmarks, page numbers) */
  assembleBundlePdf: async ({ manifest, files }) => {
    const fd = new FormData()
    fd.append('manifest', JSON.stringify(manifest))
    files.forEach(f => fd.append('files', f))
    const res = await fetch(`${BASE_URL}/bundles/assemble-pdf`, { method: 'POST', body: fd })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }))
      throw new Error(err.detail || `Assembly failed: ${res.status}`)
    }
    return res.blob()
  },

  /** Download a Word file with real tracked changes for two document versions */
  exportRedlineDocx: async ({ fileA, fileB, labelA = 'Original', labelB = 'Revised' }) => {
    const fd = new FormData()
    fd.append('file_a', fileA)
    fd.append('file_b', fileB)
    fd.append('label_a', labelA)
    fd.append('label_b', labelB)
    const res = await fetch(`${BASE_URL}/redline/export-docx`, { method: 'POST', body: fd })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }))
      throw new Error(err.detail || `Export failed: ${res.status}`)
    }
    return res.blob()
  },

  // ── Chat ───────────────────────────────────────────────────────────────────

  chat: ({ messages, model }) =>
    request('POST', '/chat', { messages, model }),

  /** Summarize text directly */
  summarize: ({ text, model }) =>
    request('POST', '/summarize', { text, model }),

  /** Upload a file (PDF/DOCX) and summarize it */
  summarizeFile: (file) => {
    const fd = new FormData()
    fd.append('file', file)
    return request('POST', '/summarize-file', fd, true)
  },

  // ── Cases ──────────────────────────────────────────────────────────────────

  uploadCase: (formData) => request('POST', '/upload-case', formData, true),
  listCases:  ()         => request('GET',  '/cases'),
  deleteCase: (caseId)   => request('DELETE', `/cases/${caseId}`),

  searchCases: ({ query, topK = 5, model, answer = true }) => {
    const params = new URLSearchParams({
      query, top_k: topK, answer,
      ...(model && { model }),
    })
    return request('GET', `/search-cases?${params}`)
  },

  // ── Contract Review ────────────────────────────────────────────────────────

  reviewContract: ({ file, notes = '', model = '' }) => {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('notes', notes)
    if (model) fd.append('model', model)
    return request('POST', '/contracts/review', fd, true)
  },

  // ── Redlining ──────────────────────────────────────────────────────────────

  /** AI-generated markup: suggests edits protecting a specific party */
  aiMarkup: ({ file, clientRole, context = '', model = '' }) => {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('client_role', clientRole)
    fd.append('context', context)
    if (model) fd.append('model', model)
    return request('POST', '/redline/markup', fd, true)
  },

  /** Compare two document versions and return a structured diff */
  compareDocuments: ({ fileA, fileB, labelA = 'Original', labelB = 'Revised' }) => {
    const fd = new FormData()
    fd.append('file_a', fileA)
    fd.append('file_b', fileB)
    fd.append('label_a', labelA)
    fd.append('label_b', labelB)
    return request('POST', '/redline/compare', fd, true)
  },

  // ── Bundle Creator ─────────────────────────────────────────────────────────

  generateBundle: (payload) =>
    request('POST', '/bundles/generate', payload),

  // ── Chronology ─────────────────────────────────────────────────────────────

  extractChronology: ({ files, matterTitle = '' }) => {
    const fd = new FormData()
    files.forEach(f => fd.append('files', f))
    if (matterTitle) fd.append('matter_title', matterTitle)
    return request('POST', '/chronology/extract', fd, true)
  },

  extractChronologyFromText: ({ text, matterTitle = '', sourceLabel = 'Pasted text', model }) =>
    request('POST', '/chronology/from-text', {
      text,
      matter_title: matterTitle,
      source_label: sourceLabel,
      ...(model && { model }),
    }),

  // ── Drafting ───────────────────────────────────────────────────────────────

  draftLetter: ({ letter_type, sender, recipient, subject, key_points, matter_reference, model }) =>
    request('POST', '/drafting/letter', {
      letter_type,
      sender: sender || '',
      recipient: recipient || '',
      subject: subject || '',
      key_points,
      matter_reference: matter_reference || '',
      ...(model && { model }),
    }),

  generateBillingNarratives: ({ activities, matter_type = '', model }) =>
    request('POST', '/drafting/billing', {
      activities,
      matter_type,
      ...(model && { model }),
    }),

  draftPleading: ({ pleading_type, party_role, facts, causes_of_action, relief_sought, model }) =>
    request('POST', '/drafting/pleading', {
      pleading_type,
      party_role,
      facts,
      causes_of_action: causes_of_action || '',
      relief_sought: relief_sought || '',
      ...(model && { model }),
    }),

  // ── Prompt Library ─────────────────────────────────────────────────────────

  getPromptVolumes: () =>
    request('GET', '/prompts/volumes'),

  searchPrompts: ({ q = '', volume = '', difficulty = '', limit = 50, offset = 0 }) => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (volume) params.set('volume', volume)
    if (difficulty) params.set('difficulty', difficulty)
    params.set('limit', limit)
    params.set('offset', offset)
    return request('GET', `/prompts?${params}`)
  },

  getPrompt: (promptId) =>
    request('GET', `/prompts/${encodeURIComponent(promptId)}`),

  // ── Audit Log ──────────────────────────────────────────────────────────────

  getAuditDates: () =>
    request('GET', '/audit/dates'),

  getAuditLogs: (date) => {
    const params = new URLSearchParams()
    if (date) params.set('date', date)
    params.set('limit', 500)
    return request('GET', `/audit/logs?${params}`)
  },

  verifyAuditChain: (date) => {
    const params = new URLSearchParams()
    if (date) params.set('date', date)
    return request('GET', `/audit/verify?${params}`)
  },

  getAuditExportUrl: (date) =>
    `${API_ORIGIN}/api/audit/export?date=${encodeURIComponent(date)}`,

  // ── User Management ────────────────────────────────────────────────────────

  listUsers: () =>
    request('GET', '/users'),

  createUser: (user) =>
    request('POST', '/users', user),

  switchUser: (slug) =>
    request('POST', `/users/${encodeURIComponent(slug)}/switch`),

  removeUser: (slug) =>
    request('DELETE', `/users/${encodeURIComponent(slug)}`),

  // ── System Info ────────────────────────────────────────────────────────────

  getSystemInfo: () =>
    request('GET', '/system/info'),

  // ── Model Management ───────────────────────────────────────────────────────

  getRecommendedModels: () =>
    request('GET', '/models/recommended'),

  /** Get the current heavy/light profile assignments plus the active fallback model */
  getModelProfiles: () =>
    request('GET', '/models/profiles'),

  /** Update heavy and/or light profile slot. Pass empty string to clear. */
  setModelProfiles: ({ heavy, light }) =>
    request('POST', '/models/profiles', {
      ...(heavy !== undefined && { heavy }),
      ...(light !== undefined && { light }),
    }),

  deleteModel: (name) =>
    request('DELETE', `/models/${encodeURIComponent(name)}`),

  /**
   * Pull a model from Ollama with SSE progress updates.
   * onProgress(json) is called for each SSE event.
   * Returns a promise that resolves when the stream ends.
   */
  pullModel: async (modelName, onProgress) => {
    const res = await fetch(`${BASE_URL}/models/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: modelName }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }))
      throw new Error(err.detail || `Pull failed: ${res.status}`)
    }
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            onProgress(JSON.parse(line.slice(6)))
          } catch {}
        }
      }
    }
  },
}
