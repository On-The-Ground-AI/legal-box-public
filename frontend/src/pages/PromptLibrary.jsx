import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, Search, ChevronRight, X, Copy, Send, Tag, BarChart2, ChevronDown, ChevronUp, Loader } from 'lucide-react'
import { getPromptVolumes, searchPrompts, getPrompt } from '../api'

// ── Difficulty badge ──────────────────────────────────────────────────────────

const DIFF_COLORS = {
  Beginner: 'bg-green-100 text-green-800',
  Intermediate: 'bg-yellow-100 text-yellow-800',
  Advanced: 'bg-red-100 text-red-800',
}

function DifficultyBadge({ level }) {
  if (!level) return null
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${DIFF_COLORS[level] || 'bg-gray-100 text-gray-600'}`}>
      {level}
    </span>
  )
}

// ── Placeholder form ──────────────────────────────────────────────────────────

function fillPlaceholders(text, values) {
  let filled = text
  for (const [key, val] of Object.entries(values)) {
    if (val) {
      filled = filled.replaceAll(`[${key}]`, val)
    }
  }
  return filled
}

function PlaceholderForm({ placeholders, values, onChange }) {
  if (!placeholders || placeholders.length === 0) return null
  return (
    <div className="space-y-3 mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
      <p className="text-sm font-semibold text-amber-800">
        Fill in the placeholders (optional)
      </p>
      {placeholders.map((ph) => (
        <div key={ph}>
          <label className="block text-xs text-amber-700 font-medium mb-1">
            [{ph}]
          </label>
          <input
            type="text"
            value={values[ph] || ''}
            onChange={(e) => onChange(ph, e.target.value)}
            placeholder={`e.g. ${ph.toLowerCase().replace(/_/g, ' ')}`}
            className="w-full border border-amber-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
          />
        </div>
      ))}
    </div>
  )
}

// ── Prompt detail modal ───────────────────────────────────────────────────────

function PromptModal({ promptId, onClose }) {
  const navigate = useNavigate()
  const [prompt, setPrompt] = useState(null)
  const [loading, setLoading] = useState(true)
  const [values, setValues] = useState({})
  const [copied, setCopied] = useState(false)
  const [showFull, setShowFull] = useState(false)

  useEffect(() => {
    if (!promptId) return
    setLoading(true)
    setValues({})
    getPrompt(promptId)
      .then(setPrompt)
      .catch(() => setPrompt(null))
      .finally(() => setLoading(false))
  }, [promptId])

  const handleValueChange = (key, val) => {
    setValues(prev => ({ ...prev, [key]: val }))
  }

  const filledText = prompt ? fillPlaceholders(prompt.text, values) : ''

  const handleCopy = () => {
    navigator.clipboard.writeText(filledText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSendToChat = () => {
    // Store in sessionStorage so Chat page can pick it up
    sessionStorage.setItem('chatPrefill', filledText)
    onClose()
    navigate('/chat')
  }

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const PREVIEW_LIMIT = 600

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b">
          <div className="flex-1 min-w-0 pr-4">
            {loading ? (
              <div className="h-6 w-48 bg-gray-200 rounded animate-pulse" />
            ) : prompt ? (
              <>
                <p className="text-xs text-gray-400 mb-1">{prompt.volume_label} › {prompt.category}</p>
                <h2 className="text-lg font-semibold text-gray-900 leading-tight">{prompt.title}</h2>
                <div className="mt-2">
                  <DifficultyBadge level={prompt.difficulty} />
                </div>
              </>
            ) : (
              <p className="text-gray-500">Prompt not found.</p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 p-1">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loading && (
            <div className="flex items-center gap-2 text-gray-400">
              <Loader size={16} className="animate-spin" />
              <span className="text-sm">Loading prompt...</span>
            </div>
          )}

          {!loading && prompt && (
            <>
              {/* Prompt text */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Prompt Text</p>
                <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-800 leading-relaxed whitespace-pre-wrap font-mono border border-gray-200">
                  {showFull || filledText.length <= PREVIEW_LIMIT
                    ? filledText
                    : filledText.slice(0, PREVIEW_LIMIT) + '…'}
                </div>
                {filledText.length > PREVIEW_LIMIT && (
                  <button
                    onClick={() => setShowFull(f => !f)}
                    className="mt-1 text-xs text-blue-600 hover:underline flex items-center gap-1"
                  >
                    {showFull ? <><ChevronUp size={12} /> Show less</> : <><ChevronDown size={12} /> Show full prompt</>}
                  </button>
                )}
              </div>

              {/* Placeholder form */}
              <PlaceholderForm
                placeholders={prompt.placeholders}
                values={values}
                onChange={handleValueChange}
              />

              {/* Context */}
              {prompt.context && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">When to use</p>
                  <p className="text-sm text-gray-600 leading-relaxed">{prompt.context}</p>
                </div>
              )}

              {/* Follow-up */}
              {prompt.follow_up && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Follow-up suggestion</p>
                  <p className="text-sm text-gray-600 leading-relaxed">{prompt.follow_up}</p>
                </div>
              )}

              {/* Tags */}
              {prompt.tags && prompt.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {prompt.tags.map(tag => (
                    <span key={tag} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{tag}</span>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer actions */}
        {!loading && prompt && (
          <div className="flex gap-3 p-4 border-t bg-gray-50 rounded-b-xl">
            <button
              onClick={handleCopy}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-white transition-colors"
            >
              <Copy size={15} />
              {copied ? 'Copied!' : 'Copy prompt'}
            </button>
            <button
              onClick={handleSendToChat}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <Send size={15} />
              Open in Chat
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Prompt card ───────────────────────────────────────────────────────────────

function PromptCard({ prompt, onSelect }) {
  return (
    <button
      onClick={() => onSelect(prompt.id)}
      className="w-full text-left p-4 bg-white border border-gray-200 rounded-lg hover:border-blue-400 hover:shadow-sm transition-all group"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-400 mb-0.5 truncate">{prompt.category}</p>
          <p className="text-sm font-medium text-gray-900 leading-snug line-clamp-2">{prompt.title}</p>
        </div>
        <ChevronRight size={14} className="text-gray-300 group-hover:text-blue-500 shrink-0 mt-1" />
      </div>
      <div className="mt-2 flex items-center gap-2">
        <DifficultyBadge level={prompt.difficulty} />
        {prompt.placeholders && prompt.placeholders.length > 0 && (
          <span className="text-xs text-gray-400 flex items-center gap-0.5">
            <Tag size={10} />
            {prompt.placeholders.length} fields
          </span>
        )}
      </div>
      {prompt.text && (
        <p className="mt-2 text-xs text-gray-400 line-clamp-2 leading-relaxed">
          {prompt.text.slice(0, 120)}…
        </p>
      )}
    </button>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

const DIFFICULTIES = ['', 'Beginner', 'Intermediate', 'Advanced']

export default function PromptLibrary() {
  const [volumes, setVolumes] = useState([])
  const [selectedVolume, setSelectedVolume] = useState('')
  const [query, setQuery] = useState('')
  const [difficulty, setDifficulty] = useState('')
  const [prompts, setPrompts] = useState([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const LIMIT = 24
  const searchRef = useRef(null)
  const debounceRef = useRef(null)

  // Load volumes once
  useEffect(() => {
    getPromptVolumes().then(data => setVolumes(data.volumes || []))
  }, [])

  const fetchPrompts = useCallback((q, vol, diff, off) => {
    setLoading(true)
    searchPrompts({ q, volume: vol, difficulty: diff, limit: LIMIT, offset: off })
      .then(data => {
        setPrompts(data.prompts || [])
        setTotal(data.total || 0)
      })
      .catch(() => setPrompts([]))
      .finally(() => setLoading(false))
  }, [])

  // Debounce search
  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setOffset(0)
      fetchPrompts(query, selectedVolume, difficulty, 0)
    }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [query, selectedVolume, difficulty, fetchPrompts])

  // Pagination
  useEffect(() => {
    fetchPrompts(query, selectedVolume, difficulty, offset)
  }, [offset]) // eslint-disable-line

  const totalPages = Math.ceil(total / LIMIT)
  const currentPage = Math.floor(offset / LIMIT) + 1

  const totalAllPrompts = volumes.reduce((s, v) => s + v.count, 0)

  return (
    <div className="h-full flex">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 border-r bg-gray-50 flex flex-col">
        <div className="p-4 border-b">
          <div className="flex items-center gap-2 text-blue-700 font-semibold text-sm">
            <BookOpen size={16} />
            Prompt Library
          </div>
          <p className="text-xs text-gray-400 mt-1">{totalAllPrompts.toLocaleString()} prompts</p>
        </div>

        <nav className="flex-1 overflow-y-auto p-2">
          <button
            onClick={() => setSelectedVolume('')}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm mb-0.5 transition-colors ${
              selectedVolume === ''
                ? 'bg-blue-100 text-blue-800 font-medium'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            All volumes
          </button>
          {volumes.map(vol => (
            <button
              key={vol.id}
              onClick={() => setSelectedVolume(vol.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm mb-0.5 transition-colors flex items-center justify-between gap-1 ${
                selectedVolume === vol.id
                  ? 'bg-blue-100 text-blue-800 font-medium'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <span className="leading-tight">{vol.label}</span>
              <span className="text-xs text-gray-400 shrink-0">{vol.count}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Search bar */}
        <div className="p-4 border-b bg-white flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-48 relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search prompts by keyword…"
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
              >
                <X size={13} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <BarChart2 size={14} className="text-gray-400" />
            <select
              value={difficulty}
              onChange={e => setDifficulty(e.target.value)}
              className="border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
            >
              {DIFFICULTIES.map(d => (
                <option key={d} value={d}>{d || 'All levels'}</option>
              ))}
            </select>
          </div>
          <p className="text-sm text-gray-400 shrink-0">
            {loading ? 'Searching…' : `${total.toLocaleString()} result${total === 1 ? '' : 's'}`}
          </p>
        </div>

        {/* Prompt grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading && prompts.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-gray-400 gap-2">
              <Loader size={18} className="animate-spin" />
              <span className="text-sm">Loading…</span>
            </div>
          ) : prompts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400 gap-2">
              <BookOpen size={32} className="text-gray-200" />
              <p className="text-sm">No prompts found. Try a different search.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {prompts.map(p => (
                  <PromptCard key={p.id} prompt={p} onSelect={setSelectedId} />
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-4 mt-6 pb-2">
                  <button
                    onClick={() => setOffset(Math.max(0, offset - LIMIT))}
                    disabled={offset === 0}
                    className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40 hover:bg-gray-50 disabled:cursor-not-allowed"
                  >
                    ← Prev
                  </button>
                  <span className="text-sm text-gray-500">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setOffset(offset + LIMIT)}
                    disabled={offset + LIMIT >= total}
                    className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40 hover:bg-gray-50 disabled:cursor-not-allowed"
                  >
                    Next →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Prompt detail modal */}
      {selectedId && (
        <PromptModal
          promptId={selectedId}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  )
}
