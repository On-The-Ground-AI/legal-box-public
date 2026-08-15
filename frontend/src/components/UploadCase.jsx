// UploadCase.jsx — Upload a case PDF into the local case database

import React, { useState, useRef, useCallback } from 'react'
import { Upload, FileText, CheckCircle, AlertCircle, X, Plus } from 'lucide-react'
import { api } from '../api'

// ── Drag-and-drop zone ────────────────────────────────────────────────────────

function DropZone({ onFile, disabled }) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef(null)

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file && file.type === 'application/pdf') onFile(file)
  }, [onFile])

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
        disabled ? 'opacity-50 cursor-not-allowed' :
        dragging
          ? 'border-[#E05A1E] bg-[#FEF3EE]'
          : 'border-gray-300 hover:border-[#E05A1E] hover:bg-[#FEF3EE]/50'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={e => e.target.files[0] && onFile(e.target.files[0])}
      />
      <div className="flex flex-col items-center gap-3">
        <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center">
          <Upload size={24} className={dragging ? 'text-[#E05A1E]' : 'text-gray-400'} />
        </div>
        <div>
          <p className="font-medium text-gray-700">Drop a PDF here</p>
          <p className="text-sm text-gray-500 mt-0.5">or click to browse your files</p>
        </div>
        <p className="text-xs text-gray-400">PDF files only · The full text will be indexed for search</p>
      </div>
    </div>
  )
}

// ── Metadata Form ─────────────────────────────────────────────────────────────

function MetadataForm({ file, onSubmit, onCancel, uploading }) {
  const [form, setForm] = useState({
    case_name: file.name.replace('.pdf', ''),
    court: '',
    date: '',
    parties: '',
    practice_area: '',
  })

  const set = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }))

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit(form)
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      {/* File name bar */}
      <div className="flex items-center gap-3 px-5 py-4 bg-gray-50 border-b">
        <div className="w-9 h-9 rounded-lg bg-red-50 border border-red-200 flex items-center justify-center flex-shrink-0">
          <FileText size={16} className="text-red-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-gray-900 truncate">{file.name}</p>
          <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
        </div>
        <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-600">
          <X size={16} />
        </button>
      </div>

      {/* Form fields */}
      <div className="px-5 py-5 grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Case name <span className="text-gray-400">(required)</span>
          </label>
          <input
            value={form.case_name}
            onChange={set('case_name')}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#E05A1E]"
            placeholder="e.g. Tan v. Lee [2024] SGHC 12"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Court</label>
          <select
            value={form.court}
            onChange={set('court')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#E05A1E] bg-white"
          >
            <option value="">Select court…</option>
            <option>Court of Appeal</option>
            <option>General Division (High Court)</option>
            <option>Appellate Division (High Court)</option>
            <option>District Court</option>
            <option>Magistrates' Court</option>
            <option>Family Justice Courts</option>
            <option>Employment Claims Tribunal</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Date decided</label>
          <input
            type="date"
            value={form.date}
            onChange={set('date')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#E05A1E]"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Parties</label>
          <input
            value={form.parties}
            onChange={set('parties')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#E05A1E]"
            placeholder="e.g. Tan Wei Ming v. Lee Shu Fen"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Practice area</label>
          <select
            value={form.practice_area}
            onChange={set('practice_area')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#E05A1E] bg-white"
          >
            <option value="">Select area…</option>
            <option>Contract Law</option>
            <option>Tort Law</option>
            <option>Company Law</option>
            <option>Criminal Law</option>
            <option>Family Law</option>
            <option>Employment Law</option>
            <option>Conveyancing</option>
            <option>Intellectual Property</option>
            <option>Litigation (Civil)</option>
            <option>Litigation (Criminal)</option>
            <option>Other</option>
          </select>
        </div>
      </div>

      {/* Actions */}
      <div className="px-5 pb-5 flex gap-3 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={uploading}
          className="px-5 py-2 text-sm bg-[#E05A1E] text-white rounded-lg hover:bg-[#C4481A]
                     disabled:opacity-60 disabled:cursor-wait font-medium flex items-center gap-2"
        >
          {uploading ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Indexing…
            </>
          ) : (
            <>
              <Plus size={15} />
              Add to Database
            </>
          )}
        </button>
      </div>
    </form>
  )
}

// ── Success Toast ─────────────────────────────────────────────────────────────

function SuccessCard({ message, onDismiss }) {
  return (
    <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3 animate-fade-in">
      <CheckCircle size={18} className="text-green-600 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="font-medium text-green-800 text-sm">{message}</p>
        <p className="text-xs text-green-600 mt-0.5">The case is now searchable from the Search page.</p>
      </div>
      <button onClick={onDismiss} className="text-green-500 hover:text-green-700">
        <X size={15} />
      </button>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function UploadCase({ onUploaded }) {
  const [selectedFile, setSelectedFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [success, setSuccess] = useState(null)
  const [error, setError] = useState(null)

  const handleFile = (file) => {
    setError(null)
    setSuccess(null)
    setSelectedFile(file)
  }

  const handleSubmit = async (formData) => {
    if (!selectedFile) return
    setUploading(true)
    setError(null)

    const fd = new FormData()
    fd.append('file', selectedFile)
    Object.entries(formData).forEach(([k, v]) => fd.append(k, v))

    try {
      const res = await api.uploadCase(fd)
      setSuccess(res.message)
      setSelectedFile(null)
      onUploaded?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Upload Case</h1>
        <p className="text-sm text-gray-500 mt-1">
          Add a case PDF to your local database. The full text will be indexed and
          searchable by meaning — not just keywords.
        </p>
      </div>

      {/* Success */}
      {success && (
        <div className="mb-4">
          <SuccessCard message={success} onDismiss={() => setSuccess(null)} />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Drop zone or form */}
      {!selectedFile ? (
        <DropZone onFile={handleFile} disabled={uploading} />
      ) : (
        <MetadataForm
          file={selectedFile}
          onSubmit={handleSubmit}
          onCancel={() => setSelectedFile(null)}
          uploading={uploading}
        />
      )}

      {/* Tips */}
      <div className="mt-6 bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700">
        <p className="font-medium mb-1">Tips for best results</p>
        <ul className="list-disc list-inside space-y-1 text-blue-600 text-xs">
          <li>Use PDF judgments from the Singapore Courts website (law.sg or elitigation.sg)</li>
          <li>Text-based PDFs work best — scanned images may not index well</li>
          <li>Adding metadata (court, date, parties) improves search accuracy</li>
          <li>Each PDF is stored only on your computer — nothing is uploaded to the internet</li>
        </ul>
      </div>
    </div>
  )
}
