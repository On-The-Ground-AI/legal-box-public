// Summarize.jsx — Document Summarizer
//
// Upload a PDF or DOCX, or paste text directly.
// The AI extracts: document type, parties, obligations, dates, key risks.
// PII is anonymized before the document reaches the AI.

import React, { useState, useRef, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  Upload, FileText, AlertCircle, Loader, Shield,
  X, Copy, CheckCircle, AlignLeft
} from 'lucide-react'
import { api } from '../api'

// ── File drop zone ─────────────────────────────────────────────────────────────

function DropZone({ onFile, disabled }) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef(null)

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragging(false)
    onFile(e.dataTransfer.files[0])
  }, [onFile])

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
        disabled ? 'opacity-50 cursor-not-allowed' :
        dragging ? 'border-[#E05A1E] bg-[#FEF3EE]' :
        'border-gray-300 hover:border-[#E05A1E] hover:bg-[#FEF3EE]/50'
      }`}
    >
      <input ref={inputRef} type="file" accept=".pdf,.docx,.doc" className="hidden"
        onChange={e => e.target.files[0] && onFile(e.target.files[0])} />
      <div className="flex flex-col items-center gap-3">
        <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center">
          <Upload size={24} className={dragging ? 'text-[#E05A1E]' : 'text-gray-400'} />
        </div>
        <div>
          <p className="font-medium text-gray-700">Drop a document here</p>
          <p className="text-sm text-gray-500 mt-0.5">PDF or Word (.pdf, .docx)</p>
        </div>
        <p className="text-xs text-gray-400">PII is anonymized before summarization</p>
      </div>
    </div>
  )
}

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

// ── Main Component ─────────────────────────────────────────────────────────────

export default function Summarize() {
  const [activeTab, setActiveTab] = useState('file')  // 'file' | 'text'
  const [file, setFile] = useState(null)
  const [pastedText, setPastedText] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  // File mode: extract text from the PDF/DOCX first, then summarize
  const handleFileSubmit = async (e) => {
    e.preventDefault()
    if (!file) return
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      // Parse the file to extract text, then summarize
      const data = await api.summarizeFile(file)
      setResult({ ...data, source: file.name })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Text mode: summarize directly from pasted content
  const handleTextSubmit = async (e) => {
    e.preventDefault()
    if (!pastedText.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const data = await api.summarize({ text: pastedText })
      setResult({ ...data, source: 'Pasted text' })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const reset = () => {
    setResult(null)
    setError(null)
    setFile(null)
    setPastedText('')
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Document Summarizer</h1>
        <p className="text-sm text-gray-500 mt-1">
          Upload a legal document and get a structured summary: parties, obligations, key dates, and risks.
          PII is anonymized before the document reaches the AI.
        </p>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {result ? (
        <div className="space-y-4">
          {/* Source badge */}
          <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3">
            <FileText size={16} className="text-gray-400 flex-shrink-0" />
            <span className="text-sm text-gray-700 flex-1 truncate font-medium">{result.source}</span>
            <span className="text-xs text-gray-400">{result.model}</span>
          </div>

          {result.pii_detected && Object.keys(result.pii_detected).length > 0 && (
            <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              <Shield size={12} />
              PII was anonymized before summarization
            </div>
          )}

          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b">
              <span className="text-sm font-medium text-gray-700">Summary</span>
              <CopyButton text={result.summary} />
            </div>
            <div className="px-5 py-5">
              <div className="prose prose-sm max-w-none text-gray-800">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.summary}</ReactMarkdown>
              </div>
            </div>
          </div>

          <p className="text-xs text-center text-gray-400">{result.disclaimer}</p>

          <button onClick={reset}
            className="w-full py-2.5 border border-gray-300 text-gray-600 text-sm rounded-xl hover:bg-gray-50">
            Summarize another document
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Tabs */}
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            {[
              { key: 'file', label: 'Upload file', icon: Upload },
              { key: 'text', label: 'Paste text',  icon: AlignLeft },
            ].map(({ key, label, icon: Icon }) => (
              <button key={key} onClick={() => setActiveTab(key)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-lg transition-all ${
                  activeTab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}>
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>

          {activeTab === 'file' ? (
            <form onSubmit={handleFileSubmit} className="space-y-4">
              {!file ? (
                <DropZone onFile={setFile} disabled={loading} />
              ) : (
                <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-red-50 border border-red-200 flex items-center justify-center flex-shrink-0">
                    <FileText size={18} className="text-red-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-900 truncate">{file.name}</p>
                    <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                  </div>
                  <button type="button" onClick={() => setFile(null)} className="text-gray-400 hover:text-gray-600">
                    <X size={16} />
                  </button>
                </div>
              )}
              <button type="submit" disabled={!file || loading}
                className="w-full py-3 bg-[#E05A1E] text-white font-medium rounded-xl hover:bg-[#C4481A]
                           disabled:opacity-60 disabled:cursor-wait flex items-center justify-center gap-2">
                {loading ? (
                  <><Loader size={16} className="animate-spin" /> Summarizing…</>
                ) : (
                  <><AlignLeft size={16} /> Summarize Document</>
                )}
              </button>
              {loading && <p className="text-center text-xs text-gray-400 mt-2">Local AI is reading your document — typically 20–60 seconds</p>}
            </form>
          ) : (
            <form onSubmit={handleTextSubmit} className="space-y-4">
              <textarea value={pastedText} onChange={e => setPastedText(e.target.value)}
                rows={12} required
                placeholder="Paste the document text here — contract clauses, judgment extracts, affidavit paragraphs, anything…"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#E05A1E] resize-none"
              />
              <button type="submit" disabled={!pastedText.trim() || loading}
                className="w-full py-3 bg-[#E05A1E] text-white font-medium rounded-xl hover:bg-[#C4481A]
                           disabled:opacity-60 disabled:cursor-wait flex items-center justify-center gap-2">
                {loading ? (
                  <><Loader size={16} className="animate-spin" /> Summarizing…</>
                ) : (
                  <><AlignLeft size={16} /> Summarize</>
                )}
              </button>
              {loading && <p className="text-center text-xs text-gray-400 mt-2">Local AI is reading your document — typically 20–60 seconds</p>}
            </form>
          )}
        </div>
      )}
    </div>
  )
}
