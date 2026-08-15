// ContractReview.jsx — Upload a contract and get a structured risk analysis

import React, { useState, useRef, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  Upload, FileText, AlertCircle, Shield, Loader,
  CheckCircle, X, AlertTriangle, ChevronDown, ChevronUp
} from 'lucide-react'
import { api } from '../api'

// ── File Drop Zone ─────────────────────────────────────────────────────────────

function DropZone({ onFile, disabled }) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef(null)

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) onFile(file)
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
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,.doc"
        className="hidden"
        onChange={e => e.target.files[0] && onFile(e.target.files[0])}
      />
      <div className="flex flex-col items-center gap-3">
        <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center">
          <Upload size={24} className={dragging ? 'text-[#E05A1E]' : 'text-gray-400'} />
        </div>
        <div>
          <p className="font-medium text-gray-700">Drop a contract here</p>
          <p className="text-sm text-gray-500 mt-0.5">PDF or Word document (.pdf, .docx)</p>
        </div>
        <p className="text-xs text-gray-400">
          PII is stripped before analysis — client names stay private
        </p>
      </div>
    </div>
  )
}

// ── Risk Badge ─────────────────────────────────────────────────────────────────

function RiskBadge({ review }) {
  // Extract the risk rating from the review markdown
  const match = review?.match(/Risk Rating[:\s]*\*?\*?(LOW|MEDIUM|HIGH)\*?\*?/i)
  const level = match ? match[1].toUpperCase() : null

  if (!level) return null

  const styles = {
    LOW:    'bg-green-100 text-green-800 border-green-300',
    MEDIUM: 'bg-amber-100 text-amber-800 border-amber-300',
    HIGH:   'bg-red-100 text-red-800 border-red-300',
  }
  const icons = {
    LOW:    <CheckCircle size={14} />,
    MEDIUM: <AlertTriangle size={14} />,
    HIGH:   <AlertCircle size={14} />,
  }

  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-semibold ${styles[level]}`}>
      {icons[level]}
      {level} RISK
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function ContractReview() {
  const [selectedFile, setSelectedFile] = useState(null)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const handleFile = (file) => {
    setSelectedFile(file)
    setResult(null)
    setError(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!selectedFile) return

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const data = await api.reviewContract({ file: selectedFile, notes })
      setResult(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const reset = () => {
    setSelectedFile(null)
    setNotes('')
    setResult(null)
    setError(null)
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Contract Review</h1>
        <p className="text-sm text-gray-500 mt-1">
          Upload a contract and get a structured risk analysis: unusual clauses, missing protections,
          and actionable recommendations.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Upload form */}
      {!result && (
        <form onSubmit={handleSubmit} className="space-y-4">
          {!selectedFile ? (
            <DropZone onFile={handleFile} disabled={loading} />
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-50 border border-red-200 flex items-center justify-center flex-shrink-0">
                <FileText size={18} className="text-red-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-gray-900 truncate">{selectedFile.name}</p>
                <p className="text-xs text-gray-500">{(selectedFile.size / 1024 / 1024).toFixed(1)} MB</p>
              </div>
              <button type="button" onClick={reset} className="text-gray-400 hover:text-gray-600">
                <X size={16} />
              </button>
            </div>
          )}

          {selectedFile && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Context for the reviewer <span className="text-gray-400">(optional)</span>
                </label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="e.g. This is a supplier services agreement. We are the buyer. Focus on liability caps and IP ownership."
                  rows={3}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm
                             focus:outline-none focus:border-[#E05A1E] resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-[#E05A1E] text-white font-medium rounded-xl
                           hover:bg-[#C4481A] disabled:opacity-60 disabled:cursor-wait
                           flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader size={16} className="animate-spin" />
                    Analysing contract…
                  </>
                ) : (
                  <>
                    <Shield size={16} />
                    Analyse Contract
                  </>
                )}
              </button>
              {loading && <p className="text-center text-xs text-gray-400 mt-2">Local AI is reviewing your contract — typically 30–90 seconds</p>}
            </>
          )}
        </form>
      )}

      {/* PII notice while loading */}
      {loading && (
        <div className="mt-3 flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          <Shield size={12} />
          PII is being anonymized before the contract reaches the AI
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Summary bar */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-red-50 border border-red-200 flex items-center justify-center flex-shrink-0">
              <FileText size={18} className="text-red-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm text-gray-900 truncate">{result.filename}</p>
              <p className="text-xs text-gray-500">
                {result.text_length?.toLocaleString()} characters · {result.model}
              </p>
            </div>
            <RiskBadge review={result.review} />
          </div>

          {/* PII notice */}
          {result.pii_detected && Object.keys(result.pii_detected).length > 0 && (
            <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              <Shield size={12} />
              PII was anonymized during analysis
            </div>
          )}

          {/* Review */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <div className="prose prose-sm max-w-none text-gray-800">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.review}</ReactMarkdown>
            </div>
          </div>

          {/* Disclaimer */}
          <p className="text-xs text-center text-gray-400">{result.disclaimer}</p>

          {/* Review another */}
          <button
            onClick={reset}
            className="w-full py-2.5 border border-gray-300 text-gray-600 text-sm rounded-xl hover:bg-gray-50"
          >
            Review another contract
          </button>
        </div>
      )}

      {/* Tips */}
      {!result && !loading && (
        <div className="mt-6 bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700">
          <p className="font-medium mb-1">What this tool checks</p>
          <ul className="list-disc list-inside space-y-1 text-blue-600 text-xs">
            <li>Unusual or one-sided clauses (liability caps, indemnities, exclusions)</li>
            <li>Missing standard protections (limitation of liability, IP ownership, termination rights)</li>
            <li>Key obligations of each party and critical deadlines</li>
            <li>Overall risk rating (Low / Medium / High) with explanation</li>
            <li>3-5 specific recommendations before signing</li>
          </ul>
        </div>
      )}
    </div>
  )
}
