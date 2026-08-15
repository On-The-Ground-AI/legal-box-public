// BundleCreator.jsx — Singapore Court Bundle Automator
//
// Lawyers enter their list of cases, statutes, and secondary materials.
// The app sorts them correctly and generates relevance statements.

import React, { useState } from 'react'
import { Plus, Trash2, BookOpen, Scale, FileText, AlertCircle, Loader, Download } from 'lucide-react'
import { api } from '../api'

// ── Item type labels ───────────────────────────────────────────────────────────

const TYPE_OPTIONS = [
  { value: 'case',      label: 'Case',               icon: Scale    },
  { value: 'statute',   label: 'Statute / Legislation', icon: BookOpen },
  { value: 'secondary', label: 'Secondary Material',  icon: FileText },
]

// ── Single row in the items list ──────────────────────────────────────────────

function ItemRow({ item, index, onChange, onRemove }) {
  return (
    <div className="flex gap-2 items-start bg-white border border-gray-200 rounded-xl p-3">
      <div className="flex-1 flex flex-col gap-2">
        <div className="flex gap-2">
          {/* Type selector */}
          <select
            value={item.type}
            onChange={e => onChange(index, 'type', e.target.value)}
            className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 bg-white
                       focus:outline-none focus:border-[#E05A1E] flex-shrink-0"
          >
            {TYPE_OPTIONS.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>

          {/* Title */}
          <input
            value={item.title}
            onChange={e => onChange(index, 'title', e.target.value)}
            placeholder={
              item.type === 'case' ? 'e.g. Tan v. Lee [2024] SGHC 12' :
              item.type === 'statute' ? 'e.g. Companies Act 1967 (Cap 50), s 123' :
              'e.g. Halsbury\'s Laws of Singapore Vol 6'
            }
            className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-1.5
                       focus:outline-none focus:border-[#E05A1E]"
          />
        </div>

        {/* Relevance hint */}
        <input
          value={item.relevance_hint}
          onChange={e => onChange(index, 'relevance_hint', e.target.value)}
          placeholder="Relevance hint (optional) — e.g. cited for the test of negligence"
          className="text-xs text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5
                     focus:outline-none focus:border-[#E05A1E] bg-gray-50"
        />
      </div>

      <button
        onClick={() => onRemove(index)}
        className="text-gray-400 hover:text-red-500 transition-colors p-1 flex-shrink-0 mt-0.5"
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}

// ── Assemble the actual bundle PDF ─────────────────────────────────────────────
// Merge the authority PDFs (selected in tab order) into one filing-ready
// document: cover page, TOC with relevance statements, bookmarks per tab,
// continuous page numbers.

function AssemblePdf({ result }) {
  const [pdfFiles, setPdfFiles] = useState([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  const toc = result.bundle.table_of_contents
  const orderedTabs = [
    ...toc.part_1_statutes.items,
    ...toc.part_2_cases.items,
    ...toc.part_3_secondary.items,
  ]

  const assemble = async () => {
    setBusy(true); setErr(null)
    try {
      const blob = await api.assembleBundlePdf({ manifest: result, files: pdfFiles })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${result.matter_title || 'Bundle'} - Bundle of Authorities.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5">
      <h3 className="font-semibold text-gray-800 text-sm">Assemble the bundle PDF</h3>
      <p className="text-xs text-gray-500 mt-1">
        Select the {orderedTabs.length} authority PDF{orderedTabs.length !== 1 ? 's' : ''} in
        tab order ({orderedTabs.map(t => `Tab ${t.tab}`).join(', ')}). You'll get one
        filing-ready PDF with a cover page, table of contents, bookmarks, and page numbers.
      </p>
      <input
        type="file"
        accept=".pdf"
        multiple
        onChange={e => setPdfFiles(Array.from(e.target.files || []))}
        className="mt-3 block w-full text-xs text-gray-600
                   file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0
                   file:bg-[#0A0A0A] file:text-white file:text-xs file:cursor-pointer"
      />
      {pdfFiles.length > 0 && (
        <p className="text-xs text-gray-500 mt-2">
          {pdfFiles.length} of {orderedTabs.length} files selected
          {pdfFiles.length !== orderedTabs.length && ' — one PDF per tab is required'}
        </p>
      )}
      {err && <p className="text-xs text-red-600 mt-2">{err}</p>}
      <button
        onClick={assemble}
        disabled={busy || pdfFiles.length !== orderedTabs.length}
        className="mt-3 px-4 py-2 bg-[#E05A1E] text-white text-sm font-medium rounded-lg
                   hover:bg-[#C24E1A] transition-colors cursor-pointer disabled:opacity-40"
      >
        {busy ? 'Assembling…' : 'Assemble & download PDF'}
      </button>
    </div>
  )
}

// ── Bundle result display ──────────────────────────────────────────────────────

function BundleResult({ result }) {
  const { bundle, summary } = result

  const renderSection = (section) => {
    if (!section.items || section.items.length === 0) return null
    return (
      <div className="mb-6">
        <h3 className="font-semibold text-gray-800 text-sm mb-1">{section.heading}</h3>
        <p className="text-xs text-gray-400 mb-3">{section.note}</p>
        <div className="space-y-2">
          {section.items.map((item, i) => (
            <div key={i} className="border border-gray-200 rounded-xl p-4 bg-white">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#0A0A0A] text-white text-xs font-bold
                                flex items-center justify-center flex-shrink-0">
                  {item.tab}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-gray-900">{item.title}</p>
                  {item.relevance && (
                    <p className="text-xs text-gray-600 mt-1 leading-relaxed">{item.relevance}</p>
                  )}
                </div>
                <span className="text-xs text-gray-400 capitalize flex-shrink-0 mt-0.5">{item.type}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Copy bundle text to clipboard
  const copyToClipboard = () => {
    const toc = bundle.table_of_contents
    const lines = [
      `BUNDLE OF AUTHORITIES`,
      `Matter: ${bundle.cover_page.matter}`,
      bundle.cover_page.hearing_date !== 'To be confirmed'
        ? `Hearing: ${bundle.cover_page.hearing_date}` : '',
      ``,
      `TABLE OF CONTENTS`,
      ``,
    ]

    const addSection = (section) => {
      if (!section.items?.length) return
      lines.push(section.heading)
      section.items.forEach(item => {
        lines.push(`  Tab ${item.tab}: ${item.title}`)
        if (item.relevance) lines.push(`         ${item.relevance}`)
      })
      lines.push('')
    }

    addSection(toc.part_1_statutes)
    addSection(toc.part_2_cases)
    addSection(toc.part_3_secondary)

    navigator.clipboard.writeText(lines.filter(Boolean).join('\n'))
      .then(() => alert('Bundle copied to clipboard!'))
      .catch(() => alert('Could not copy — please select and copy manually.'))
  }

  return (
    <div className="space-y-4">
      {/* Cover summary */}
      <div className="bg-[#0A0A0A] text-white rounded-2xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[#E05A1E] mb-1">BUNDLE OF AUTHORITIES</p>
            <p className="font-bold text-lg leading-tight">{bundle.cover_page.matter}</p>
            {bundle.cover_page.hearing_date !== 'To be confirmed' && (
              <p className="text-sm text-white/60 mt-1">Hearing: {bundle.cover_page.hearing_date}</p>
            )}
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-2xl font-bold text-[#E05A1E]">{bundle.total_tabs}</p>
            <p className="text-xs text-white/50">tabs total</p>
          </div>
        </div>
        <div className="flex gap-4 mt-4 text-xs text-white/60">
          <span>{summary.statutes} statute{summary.statutes !== 1 ? 's' : ''}</span>
          <span>·</span>
          <span>{summary.cases} case{summary.cases !== 1 ? 's' : ''}</span>
          <span>·</span>
          <span>{summary.secondary} secondary</span>
        </div>
        <p className="text-xs text-white/40 mt-3">{bundle.cover_page.formatting_note}</p>
      </div>

      {/* Copy button */}
      <button
        onClick={copyToClipboard}
        className="w-full flex items-center justify-center gap-2 py-2.5
                   border border-gray-300 text-gray-700 text-sm rounded-xl hover:bg-gray-50"
      >
        <Download size={14} />
        Copy bundle to clipboard
      </button>

      {/* TOC sections */}
      <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5">
        {renderSection(result.bundle.table_of_contents.part_1_statutes)}
        {renderSection(result.bundle.table_of_contents.part_2_cases)}
        {renderSection(result.bundle.table_of_contents.part_3_secondary)}
      </div>

      {/* Assemble the real PDF */}
      <AssemblePdf result={result} />

      <p className="text-xs text-center text-gray-400">{result.disclaimer}</p>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

const EMPTY_ITEM = () => ({ title: '', type: 'case', relevance_hint: '' })

export default function BundleCreator() {
  const [matterTitle, setMatterTitle] = useState('')
  const [hearingDate, setHearingDate] = useState('')
  const [hearingType, setHearingType] = useState('')
  const [items, setItems] = useState([EMPTY_ITEM(), EMPTY_ITEM()])
  const [generateRelevance, setGenerateRelevance] = useState(true)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const addItem = () => setItems(prev => [...prev, EMPTY_ITEM()])

  const removeItem = (index) => {
    setItems(prev => prev.filter((_, i) => i !== index))
  }

  const changeItem = (index, field, value) => {
    setItems(prev => prev.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    ))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    const validItems = items.filter(item => item.title.trim())
    if (!matterTitle.trim()) {
      setError('Please enter the matter title.')
      return
    }
    if (validItems.length === 0) {
      setError('Please add at least one authority.')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const data = await api.generateBundle({
        matter_title: matterTitle,
        hearing_date: hearingDate,
        hearing_type: hearingType,
        items: validItems,
        generate_relevance: generateRelevance,
      })
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
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Court Bundle Creator</h1>
        <p className="text-sm text-gray-500 mt-1">
          Auto-sort authorities and generate relevance statements for Singapore court bundles.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Result */}
      {result ? (
        <div>
          <BundleResult result={result} />
          <button
            onClick={reset}
            className="w-full mt-4 py-2.5 border border-gray-300 text-gray-600 text-sm rounded-xl hover:bg-gray-50"
          >
            Create another bundle
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Matter details */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
            <h2 className="text-sm font-semibold text-gray-800">Matter Details</h2>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Matter title <span className="text-red-400">*</span>
              </label>
              <input
                value={matterTitle}
                onChange={e => setMatterTitle(e.target.value)}
                placeholder="e.g. ABC Pte Ltd v. XYZ Ltd"
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                           focus:outline-none focus:border-[#E05A1E]"
              />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-600 mb-1">Hearing date</label>
                <input
                  value={hearingDate}
                  onChange={e => setHearingDate(e.target.value)}
                  placeholder="e.g. 15 January 2026"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                             focus:outline-none focus:border-[#E05A1E]"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-600 mb-1">Hearing type</label>
                <select
                  value={hearingType}
                  onChange={e => setHearingType(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                             focus:outline-none focus:border-[#E05A1E] bg-white"
                >
                  <option value="">Select…</option>
                  <option>Summary Judgment</option>
                  <option>Trial</option>
                  <option>Appeal</option>
                  <option>Interlocutory Application</option>
                  <option>Assessment of Damages</option>
                  <option>Case Management Conference</option>
                </select>
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-800">
                Authorities <span className="text-gray-400 font-normal">({items.filter(i => i.title.trim()).length} added)</span>
              </h2>
              <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={generateRelevance}
                  onChange={e => setGenerateRelevance(e.target.checked)}
                  className="rounded"
                />
                AI relevance statements
              </label>
            </div>

            {items.map((item, i) => (
              <ItemRow
                key={i}
                item={item}
                index={i}
                onChange={changeItem}
                onRemove={removeItem}
              />
            ))}

            <button
              type="button"
              onClick={addItem}
              className="w-full py-2.5 border border-dashed border-gray-300 text-gray-500 text-sm rounded-xl
                         hover:border-[#E05A1E] hover:text-[#E05A1E] transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <Plus size={14} />
              Add authority
            </button>
          </div>

          {/* Submit */}
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
                Generating bundle…
              </>
            ) : (
              <>
                <BookOpen size={16} />
                Generate Bundle
              </>
            )}
          </button>
        </form>
      )}
    </div>
  )
}
