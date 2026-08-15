// Chronology.jsx — Extract a timeline of events from litigation documents

import React, { useState, useRef, useCallback } from 'react'
import { Upload, FileText, AlertCircle, Loader, X, Calendar, Clock, Users } from 'lucide-react'
import { api } from '../api'

// ── File Drop Zone ─────────────────────────────────────────────────────────────

function DropZone({ files, onFiles, disabled }) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef(null)

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragging(false)
    onFiles(Array.from(e.dataTransfer.files))
  }, [onFiles])

  return (
    <div>
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
          disabled ? 'opacity-50 cursor-not-allowed' :
          dragging ? 'border-[#E05A1E] bg-[#FEF3EE]' :
          'border-gray-300 hover:border-[#E05A1E] hover:bg-[#FEF3EE]/50'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,.doc"
          multiple
          className="hidden"
          onChange={e => onFiles(Array.from(e.target.files))}
        />
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
            <Upload size={20} className={dragging ? 'text-[#E05A1E]' : 'text-gray-400'} />
          </div>
          <div>
            <p className="font-medium text-gray-700">Drop documents here</p>
            <p className="text-sm text-gray-500 mt-0.5">PDF or DOCX · Multiple files allowed</p>
          </div>
        </div>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="mt-3 space-y-2">
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-3 py-2.5">
              <FileText size={14} className="text-gray-400 flex-shrink-0" />
              <span className="text-sm text-gray-700 flex-1 truncate">{f.name}</span>
              <span className="text-xs text-gray-400">{(f.size / 1024).toFixed(0)} KB</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Event Card ─────────────────────────────────────────────────────────────────

function EventCard({ event, index }) {
  return (
    <div className="flex gap-4">
      {/* Timeline line */}
      <div className="flex flex-col items-center">
        <div className="w-8 h-8 rounded-full bg-[#0A0A0A] text-white text-xs font-bold
                        flex items-center justify-center flex-shrink-0 z-10">
          {index + 1}
        </div>
        <div className="w-0.5 flex-1 bg-gray-200 mt-1" />
      </div>

      {/* Event content */}
      <div className="flex-1 pb-5">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          {/* Date */}
          <div className="flex items-center gap-2 mb-2">
            <Calendar size={13} className="text-[#E05A1E] flex-shrink-0" />
            <span className="text-xs font-semibold text-[#0A0A0A]">{event.date || 'Unknown date'}</span>
          </div>

          {/* Event description */}
          <p className="text-sm text-gray-800 leading-relaxed mb-2">{event.event}</p>

          {/* Meta */}
          <div className="flex flex-wrap gap-3 text-xs text-gray-500">
            {event.parties && (
              <div className="flex items-center gap-1">
                <Users size={11} />
                {event.parties}
              </div>
            )}
            {event.source && (
              <div className="flex items-center gap-1">
                <FileText size={11} />
                {event.source}
              </div>
            )}
          </div>

          {/* Significance */}
          {event.significance && (
            <div className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
              {event.significance}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Text input tab ─────────────────────────────────────────────────────────────

function TextInput({ onSubmit, loading }) {
  const [text, setText] = useState('')
  const [sourceLabel, setSourceLabel] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (text.trim()) onSubmit(text, sourceLabel || 'Pasted text')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Source label (optional)</label>
        <input
          value={sourceLabel}
          onChange={e => setSourceLabel(e.target.value)}
          placeholder="e.g. Plaintiff's affidavit, Chronology notes"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                     focus:outline-none focus:border-[#E05A1E]"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Paste text here</label>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Paste the relevant section of a document, an email thread, or any text containing dates and events…"
          rows={8}
          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm
                     focus:outline-none focus:border-[#E05A1E] resize-none"
        />
      </div>
      <button
        type="submit"
        disabled={!text.trim() || loading}
        className="w-full py-3 bg-[#E05A1E] text-white font-medium rounded-xl
                   hover:bg-[#C4481A] disabled:opacity-60 disabled:cursor-wait
                   flex items-center justify-center gap-2 cursor-pointer"
      >
        {loading ? (
          <><Loader size={16} className="animate-spin" /> Extracting events…</>
        ) : (
          <><Clock size={16} /> Extract Chronology</>
        )}
      </button>
      {loading && <p className="text-center text-xs text-gray-400 mt-2">Local AI is reading the document — typically 20–60 seconds</p>}
    </form>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function Chronology() {
  const [activeTab, setActiveTab] = useState('upload') // 'upload' | 'text'
  const [files, setFiles] = useState([])
  const [matterTitle, setMatterTitle] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const addFiles = (newFiles) => {
    setFiles(prev => {
      const names = new Set(prev.map(f => f.name))
      const unique = newFiles.filter(f => !names.has(f.name))
      return [...prev, ...unique]
    })
  }

  const handleFileSubmit = async (e) => {
    e.preventDefault()
    if (!files.length) return

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const data = await api.extractChronology({ files, matterTitle })
      setResult(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleTextSubmit = async (text, sourceLabel) => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const data = await api.extractChronologyFromText({ text, matterTitle, sourceLabel })
      setResult(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const reset = () => {
    setResult(null)
    setError(null)
    setFiles([])
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Chronology Generator</h1>
        <p className="text-sm text-gray-500 mt-1">
          Upload litigation documents and get a sorted timeline of key events.
          Great for preparing pleadings and trial bundles.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-red-700 font-medium">Error</p>
            <p className="text-sm text-red-600">{error}</p>
          </div>
        </div>
      )}

      {/* Result */}
      {result ? (
        <div className="space-y-4">
          {/* Summary */}
          <div className="bg-[#0A0A0A] text-white rounded-2xl p-5">
            <p className="text-sm font-semibold text-[#E05A1E] mb-1">CHRONOLOGY</p>
            <p className="font-bold text-lg">{result.matter_title || 'Extracted events'}</p>
            <p className="text-sm text-white/60 mt-1">{result.total_events} events extracted</p>
            {result.processed_files?.length > 0 && (
              <p className="text-xs text-white/40 mt-2">
                Sources: {result.processed_files.join(', ')}
              </p>
            )}
          </div>

          {/* Errors from processing */}
          {result.errors?.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
              Some files could not be processed: {result.errors.join('; ')}
            </div>
          )}

          {/* Events timeline */}
          {result.events?.length === 0 ? (
            <div className="text-center py-10 text-gray-500 text-sm">
              No events could be extracted. Try documents with clearer dates and event descriptions.
            </div>
          ) : (
            <div className="space-y-0">
              {result.events.map((event, i) => (
                <EventCard key={i} event={event} index={i} />
              ))}
            </div>
          )}

          <p className="text-xs text-center text-gray-400">{result.disclaimer}</p>

          <button
            onClick={reset}
            className="w-full py-2.5 border border-gray-300 text-gray-600 text-sm rounded-xl hover:bg-gray-50"
          >
            Extract another chronology
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Matter title */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Matter title (optional)</label>
            <input
              value={matterTitle}
              onChange={e => setMatterTitle(e.target.value)}
              placeholder="e.g. ABC v XYZ — fraud claim"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                         focus:outline-none focus:border-[#E05A1E]"
            />
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            {[
              { key: 'upload', label: 'Upload files' },
              { key: 'text',   label: 'Paste text'   },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                  activeTab === tab.key
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'upload' ? (
            <form onSubmit={handleFileSubmit} className="space-y-4">
              <DropZone files={files} onFiles={addFiles} disabled={loading} />
              <button
                type="submit"
                disabled={!files.length || loading}
                className="w-full py-3 bg-[#E05A1E] text-white font-medium rounded-xl
                           hover:bg-[#C4481A] disabled:opacity-60 disabled:cursor-wait
                           flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <><Loader size={16} className="animate-spin" /> Extracting events…</>
                ) : (
                  <><Clock size={16} /> Extract Chronology</>
                )}
              </button>
              {loading && <p className="text-center text-xs text-gray-400 mt-2">Local AI is reading the document — typically 20–60 seconds</p>}
            </form>
          ) : (
            <TextInput onSubmit={handleTextSubmit} loading={loading} />
          )}
        </div>
      )}
    </div>
  )
}
