// Redline.jsx — Document Redlining Tool
//
// Two modes:
//   1. AI Markup — upload a contract, AI suggests edits protecting your client
//   2. Compare — upload two versions, see what changed

import React, { useState, useRef, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  Upload, FileText, AlertCircle, Loader, Shield,
  X, Copy, CheckCircle, GitCompare, PenTool
} from 'lucide-react'
import { api } from '../api'

// ── Copy button ────────────────────────────────────────────────────────────────

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }
  return (
    <button onClick={handleCopy} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800">
      {copied ? <><CheckCircle size={13} className="text-green-600" /> Copied</> : <><Copy size={13} /> Copy</>}
    </button>
  )
}

// ── File picker ────────────────────────────────────────────────────────────────

function FilePicker({ label, file, onFile, disabled }) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef(null)

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragging(false)
    onFile(e.dataTransfer.files[0])
  }, [onFile])

  return (
    <div>
      <p className="text-xs font-medium text-gray-600 mb-1">{label}</p>
      {file ? (
        <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-3 py-2.5">
          <FileText size={14} className="text-red-400 flex-shrink-0" />
          <span className="text-sm text-gray-700 flex-1 truncate">{file.name}</span>
          <span className="text-xs text-gray-400">{(file.size / 1024).toFixed(0)} KB</span>
          <button onClick={() => onFile(null)} className="text-gray-400 hover:text-gray-600">
            <X size={14} />
          </button>
        </div>
      ) : (
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => !disabled && inputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
            dragging ? 'border-[#E05A1E] bg-[#FEF3EE]' :
            'border-gray-300 hover:border-[#E05A1E] hover:bg-[#FEF3EE]/50'
          }`}
        >
          <input ref={inputRef} type="file" accept=".pdf,.docx,.doc" className="hidden"
            onChange={e => e.target.files[0] && onFile(e.target.files[0])} />
          <Upload size={18} className="mx-auto text-gray-400 mb-1" />
          <p className="text-xs text-gray-500">Drop PDF or DOCX here, or click to browse</p>
        </div>
      )}
    </div>
  )
}

// ── Diff viewer ────────────────────────────────────────────────────────────────

function DiffChunk({ chunk }) {
  if (chunk.type === 'equal') {
    // Only show a few lines of equal text to keep the view scannable
    const lines = chunk.text.split('\n').filter(Boolean)
    if (lines.length === 0) return null
    const preview = lines.slice(0, 3).join('\n')
    const collapsed = lines.length > 3
    return (
      <div className="px-4 py-1 text-sm text-gray-500 bg-gray-50 font-mono leading-relaxed whitespace-pre-wrap">
        {preview}
        {collapsed && (
          <span className="block text-xs text-gray-400 italic mt-1">
            … {lines.length - 3} unchanged lines …
          </span>
        )}
      </div>
    )
  }

  if (chunk.type === 'delete') {
    return (
      <div className="px-4 py-1.5 bg-red-50 border-l-4 border-red-400">
        <span className="text-xs font-medium text-red-600 block mb-0.5">{chunk.label}</span>
        <p className="text-sm text-red-800 font-mono leading-relaxed whitespace-pre-wrap line-through opacity-75">
          {chunk.text.trim()}
        </p>
      </div>
    )
  }

  if (chunk.type === 'insert') {
    return (
      <div className="px-4 py-1.5 bg-green-50 border-l-4 border-green-400">
        <span className="text-xs font-medium text-green-600 block mb-0.5">{chunk.label}</span>
        <p className="text-sm text-green-800 font-mono leading-relaxed whitespace-pre-wrap">
          {chunk.text.trim()}
        </p>
      </div>
    )
  }

  if (chunk.type === 'replace') {
    return (
      <div className="border-l-4 border-amber-400">
        <div className="px-4 py-1.5 bg-red-50">
          <span className="text-xs font-medium text-red-600 block mb-0.5">Removed</span>
          <p className="text-sm text-red-800 font-mono leading-relaxed whitespace-pre-wrap line-through opacity-75">
            {chunk.old_text.trim()}
          </p>
        </div>
        <div className="px-4 py-1.5 bg-green-50">
          <span className="text-xs font-medium text-green-600 block mb-0.5">Replaced with</span>
          <p className="text-sm text-green-800 font-mono leading-relaxed whitespace-pre-wrap">
            {chunk.new_text.trim()}
          </p>
        </div>
      </div>
    )
  }

  return null
}

// ── AI Markup tab ──────────────────────────────────────────────────────────────

function AIMarkup() {
  const [file, setFile] = useState(null)
  const [clientRole, setClientRole] = useState('buyer')
  const [context, setContext] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const CLIENT_ROLES = [
    { value: 'buyer',    label: 'Buyer' },
    { value: 'seller',   label: 'Seller' },
    { value: 'landlord', label: 'Landlord' },
    { value: 'tenant',   label: 'Tenant' },
    { value: 'employer', label: 'Employer' },
    { value: 'employee', label: 'Employee' },
    { value: 'borrower', label: 'Borrower' },
    { value: 'lender',   label: 'Lender' },
    { value: 'service provider', label: 'Service Provider' },
    { value: 'client',   label: 'Client / Customer' },
  ]

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!file) return
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const data = await api.aiMarkup({ file, clientRole, context })
      setResult(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (result) {
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="bg-[#0A0A0A] text-white rounded-2xl p-5">
          <p className="text-xs text-[#E05A1E] font-semibold mb-1">AI REDLINE</p>
          <p className="font-bold">{result.filename}</p>
          <p className="text-sm text-white/60 mt-1">
            Reviewing as: {result.client_role} · {result.model}
          </p>
          {result.truncated && (
            <p className="text-xs text-amber-300 mt-2">
              Note: Document was truncated to fit the AI context limit. The first portion was reviewed.
            </p>
          )}
        </div>

        {result.pii_detected && Object.keys(result.pii_detected).length > 0 && (
          <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            <Shield size={12} />
            PII was anonymized before the contract reached the AI
          </div>
        )}

        {/* Markup */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b">
            <span className="text-sm font-medium text-gray-700">Suggested Redlines</span>
            <CopyButton text={result.markup} />
          </div>
          <div className="px-5 py-5">
            <div className="prose prose-sm max-w-none text-gray-800">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.markup}</ReactMarkdown>
            </div>
          </div>
        </div>

        <p className="text-xs text-center text-gray-400">{result.disclaimer}</p>

        <button onClick={() => setResult(null)}
          className="w-full py-2.5 border border-gray-300 text-gray-600 text-sm rounded-xl hover:bg-gray-50">
          Redline another contract
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
          <AlertCircle size={15} className="text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <FilePicker label="Contract to redline" file={file} onFile={setFile} disabled={loading} />

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Our client's position
        </label>
        <select value={clientRole} onChange={e => setClientRole(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#E05A1E]">
          {CLIENT_ROLES.map(r => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
        <p className="text-xs text-gray-400 mt-1">The AI will suggest changes that protect this party.</p>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Context <span className="text-gray-400">(optional)</span>
        </label>
        <textarea value={context} onChange={e => setContext(e.target.value)}
          rows={3} placeholder="e.g. This is a 2-year SaaS subscription agreement. We are particularly concerned about data protection clauses and auto-renewal terms."
          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#E05A1E] resize-none"
        />
      </div>

      <button type="submit" disabled={!file || loading}
        className="w-full py-3 bg-[#E05A1E] text-white font-medium rounded-xl hover:bg-[#C4481A]
                   disabled:opacity-60 disabled:cursor-wait flex items-center justify-center gap-2">
        {loading ? (
          <><Loader size={16} className="animate-spin" /> Generating redlines…</>
        ) : (
          <><PenTool size={16} /> Generate AI Redlines</>
        )}
      </button>
      {loading && <p className="text-center text-xs text-gray-400 mt-2">Local AI is reviewing the contract — typically 45–120 seconds</p>}

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-xs text-blue-700 space-y-1">
        <p className="font-medium">What AI redlining does</p>
        <ul className="list-disc list-inside space-y-1 text-blue-600">
          <li>Identifies clauses that disadvantage your client</li>
          <li>Suggests specific edits: what to delete, what to replace it with</li>
          <li>Explains why each change is needed</li>
          <li>Prioritizes: liability, IP, termination, payment, indemnities</li>
        </ul>
      </div>
    </form>
  )
}

// ── Compare Documents tab ──────────────────────────────────────────────────────

function CompareDocuments() {
  const [fileA, setFileA] = useState(null)
  const [fileB, setFileB] = useState(null)
  const [labelA, setLabelA] = useState('Original')
  const [labelB, setLabelB] = useState('Revised')
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const handleExportDocx = async () => {
    if (!fileA || !fileB) return
    setExporting(true)
    setError(null)
    try {
      const blob = await api.exportRedlineDocx({ fileA, fileB, labelA, labelB })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${(fileB.name || 'document').replace(/\.[^.]+$/, '')}-redline-tracked-changes.docx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err.message)
    } finally {
      setExporting(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!fileA || !fileB) return
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const data = await api.compareDocuments({ fileA, fileB, labelA, labelB })
      setResult(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (result) {
    const { summary, chunks } = result
    return (
      <div className="space-y-4">
        {/* Stats bar */}
        <div className="bg-[#0A0A0A] text-white rounded-2xl p-5">
          <p className="text-xs text-[#E05A1E] font-semibold mb-2">COMPARISON RESULT</p>
          <div className="flex gap-6 text-sm">
            <div>
              <p className="text-2xl font-bold text-green-400">{summary.additions}</p>
              <p className="text-white/50 text-xs">additions</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-400">{summary.deletions}</p>
              <p className="text-white/50 text-xs">deletions</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-400">{summary.modifications}</p>
              <p className="text-white/50 text-xs">modifications</p>
            </div>
          </div>
          <div className="flex gap-4 mt-3 text-xs text-white/40">
            <span>{result.label_a}: {result.filename_a}</span>
            <span>→</span>
            <span>{result.label_b}: {result.filename_b}</span>
          </div>
          {summary.total_changes > 0 && (
            <button
              onClick={handleExportDocx}
              disabled={exporting}
              className="mt-4 px-4 py-2 bg-[#E05A1E] text-white text-sm font-medium rounded-lg
                         hover:bg-[#C24E1A] transition-colors cursor-pointer disabled:opacity-50"
            >
              {exporting ? 'Preparing Word file…' : 'Export as Word (track changes)'}
            </button>
          )}
        </div>

        {summary.total_changes === 0 ? (
          <div className="text-center py-10 bg-green-50 border border-green-200 rounded-2xl text-green-700">
            <CheckCircle size={24} className="mx-auto mb-2" />
            <p className="font-medium">No differences found.</p>
            <p className="text-sm text-green-600 mt-1">The two documents appear to be identical.</p>
          </div>
        ) : (
          <div className="border border-gray-200 rounded-2xl overflow-hidden divide-y divide-gray-100">
            {chunks.map((chunk, i) => (
              <DiffChunk key={i} chunk={chunk} />
            ))}
          </div>
        )}

        <p className="text-xs text-center text-gray-400">{result.disclaimer}</p>

        <button onClick={() => setResult(null)}
          className="w-full py-2.5 border border-gray-300 text-gray-600 text-sm rounded-xl hover:bg-gray-50">
          Compare other documents
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
          <AlertCircle size={15} className="text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <input value={labelA} onChange={e => setLabelA(e.target.value)}
            placeholder="Label (e.g. Their draft)"
            className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs mb-2 focus:outline-none focus:border-[#E05A1E]" />
          <FilePicker label="" file={fileA} onFile={setFileA} disabled={loading} />
        </div>
        <div>
          <input value={labelB} onChange={e => setLabelB(e.target.value)}
            placeholder="Label (e.g. Our draft)"
            className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs mb-2 focus:outline-none focus:border-[#E05A1E]" />
          <FilePicker label="" file={fileB} onFile={setFileB} disabled={loading} />
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-xs text-blue-700">
        No AI required — comparison runs locally and instantly. Client data never leaves your computer.
      </div>

      <button type="submit" disabled={!fileA || !fileB || loading}
        className="w-full py-3 bg-[#E05A1E] text-white font-medium rounded-xl hover:bg-[#C4481A]
                   disabled:opacity-60 disabled:cursor-wait flex items-center justify-center gap-2">
        {loading ? (
          <><Loader size={16} className="animate-spin" /> Comparing…</>
        ) : (
          <><GitCompare size={16} /> Compare Documents</>
        )}
      </button>
      {loading && <p className="text-center text-xs text-gray-400 mt-2">Local AI is comparing documents — typically 30–90 seconds</p>}
    </form>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

const TABS = [
  { key: 'markup',  label: 'AI Markup',        icon: PenTool    },
  { key: 'compare', label: 'Compare Versions',  icon: GitCompare },
]

export default function Redline() {
  const [activeTab, setActiveTab] = useState('markup')

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Redlining</h1>
        <p className="text-sm text-gray-500 mt-1">
          AI-generated contract markup, or side-by-side document comparison.
        </p>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-lg transition-all ${
              activeTab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'markup'  && <AIMarkup />}
      {activeTab === 'compare' && <CompareDocuments />}
    </div>
  )
}
