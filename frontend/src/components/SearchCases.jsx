// SearchCases.jsx — Search the local case law database with AI-powered answers

import React, { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Search, FileText, AlertCircle, Shield, Loader, BookOpen, ChevronDown, ChevronUp } from 'lucide-react'
import { api } from '../api'

// ── Case Excerpt Card ─────────────────────────────────────────────────────────

function ExcerptCard({ result, index }) {
  const [expanded, setExpanded] = useState(false)
  const preview = result.text.slice(0, 280)
  const hasMore = result.text.length > 280

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white animate-fade-in">
      <div className="flex items-start gap-3 px-4 py-3 bg-gray-50 border-b">
        <div className="w-7 h-7 rounded-lg bg-[#0A0A0A] flex items-center justify-center flex-shrink-0 text-white text-xs font-bold">
          {index}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-gray-900 truncate">{result.case_name}</p>
          <p className="text-xs text-gray-500">{result.filename}</p>
        </div>
        {result.relevance_score !== null && (
          <div className="text-xs text-gray-500 font-medium bg-white border border-gray-200 rounded-full px-2 py-0.5 flex-shrink-0">
            {Math.round(result.relevance_score * 100)}% match
          </div>
        )}
      </div>
      <div className="px-4 py-3">
        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
          {expanded ? result.text : preview}
          {hasMore && !expanded && '…'}
        </p>
        {hasMore && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-2 flex items-center gap-1 text-xs text-[#E05A1E] hover:text-[#C4481A] font-medium cursor-pointer"
          >
            {expanded ? <><ChevronUp size={12} /> Show less</> : <><ChevronDown size={12} /> Show more</>}
          </button>
        )}
      </div>
    </div>
  )
}

// ── AI Answer Block ───────────────────────────────────────────────────────────

function AnswerBlock({ answer }) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 animate-fade-in">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-full bg-[#E05A1E] flex items-center justify-center flex-shrink-0">
          <BookOpen size={13} className="text-white" />
        </div>
        <span className="font-semibold text-sm text-gray-800">AI Answer</span>
        <span className="text-xs text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">based on your case database</span>
      </div>
      <div className="prose prose-sm max-w-none text-gray-800">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{answer}</ReactMarkdown>
      </div>
    </div>
  )
}

// ── Empty State ───────────────────────────────────────────────────────────────

function EmptyDatabase() {
  return (
    <div className="text-center py-16 px-8">
      <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
        <FileText size={24} className="text-gray-400" />
      </div>
      <h3 className="font-semibold text-gray-700 mb-2">No cases indexed yet</h3>
      <p className="text-sm text-gray-500 max-w-sm mx-auto">
        Go to <strong>Upload Cases</strong> to add your first case PDF.
        Once uploaded, you can search across all your cases by meaning — not just keywords.
      </p>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function SearchCases({ health }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)   // null = not searched yet
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [caseCount, setCaseCount] = useState(null)
  const [generateAnswer, setGenerateAnswer] = useState(true)

  // Check how many cases are in the database
  useEffect(() => {
    api.listCases()
      .then(data => setCaseCount(data.total))
      .catch(() => setCaseCount(0))
  }, [])

  const handleSearch = async (e) => {
    e?.preventDefault()
    if (!query.trim() || loading) return

    setLoading(true)
    setError(null)
    setResults(null)

    try {
      const data = await api.searchCases({
        query: query.trim(),
        topK: 5,
        answer: generateAnswer,
      })
      setResults(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const hasResults = results && results.results.length > 0

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Search Cases</h1>
        <p className="text-sm text-gray-500 mt-1">
          Search your local case database by meaning. The AI reads relevant excerpts and generates an answer.
          {caseCount !== null && (
            <span className="ml-1 font-medium text-gray-700">{caseCount} {caseCount === 1 ? 'case' : 'cases'} indexed.</span>
          )}
        </p>
      </div>

      {/* Search bar */}
      <form onSubmit={handleSearch} className="mb-6">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="e.g. What is the test for specific performance in Singapore?"
              className="w-full border border-gray-300 rounded-xl pl-9 pr-4 py-2.5 text-sm
                         focus:outline-none focus:border-[#E05A1E] focus:ring-2 focus:ring-[#E05A1E]/20"
              disabled={loading}
            />
          </div>
          <button
            type="submit"
            disabled={!query.trim() || loading || caseCount === 0}
            className="px-5 py-2.5 bg-[#E05A1E] text-white text-sm font-medium rounded-xl
                       hover:bg-[#C4481A] disabled:opacity-50 disabled:cursor-not-allowed
                       flex items-center gap-2 flex-shrink-0 cursor-pointer"
          >
            {loading
              ? <><Loader size={14} className="animate-spin" /> Searching…</>
              : <><Search size={14} /> Search</>
            }
          </button>
        </div>

        {/* Options row */}
        <div className="flex items-center gap-4 mt-2 px-1">
          <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={generateAnswer}
              onChange={e => setGenerateAnswer(e.target.checked)}
              className="rounded"
            />
            Generate AI answer from results
          </label>
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <Shield size={10} className="text-green-500" />
            Query anonymized before search
          </div>
        </div>
      </form>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 mb-4">
          <AlertCircle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Empty database */}
      {caseCount === 0 && <EmptyDatabase />}

      {/* Results */}
      {results && (
        <div className="flex flex-col gap-5">
          {/* PII notice */}
          {results.pii_detected && Object.keys(results.pii_detected).length > 0 && (
            <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              <Shield size={12} />
              PII was anonymized in your query before searching
            </div>
          )}

          {/* No results */}
          {!hasResults && (
            <div className="text-center py-10 text-gray-500 text-sm">
              No relevant cases found for this query. Try rephrasing or uploading more cases.
            </div>
          )}

          {/* AI Answer (shown first if available) */}
          {results.answer && hasResults && (
            <AnswerBlock answer={results.answer} />
          )}

          {/* Case excerpts */}
          {hasResults && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                Relevant excerpts ({results.results.length})
              </h3>
              <div className="flex flex-col gap-3">
                {results.results.map((r, i) => (
                  <ExcerptCard key={i} result={r} index={i + 1} />
                ))}
              </div>
            </div>
          )}

          <p className="text-xs text-center text-gray-400">{results.disclaimer}</p>
        </div>
      )}
    </div>
  )
}
