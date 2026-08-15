// Drafting.jsx — Legal Drafting Assistant
//
// Three drafting tools in one page:
//   1. Legal letters and emails
//   2. Billing narratives
//   3. Pleading structure

import React, { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { PenTool, Mail, DollarSign, FileText, AlertCircle, Loader, Shield, Copy, CheckCircle } from 'lucide-react'
import { api } from '../api'

// ── Copy to clipboard button ───────────────────────────────────────────────────

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(text)
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2500)
      })
      .catch(() => alert('Could not copy — please select and copy manually.'))
  }

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 transition-colors"
    >
      {copied ? <><CheckCircle size={13} className="text-green-600" /> Copied</> : <><Copy size={13} /> Copy</>}
    </button>
  )
}

// ── Result box ─────────────────────────────────────────────────────────────────

function ResultBox({ text, onReset, resetLabel, pii_detected, disclaimer }) {
  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b">
          <span className="text-sm font-medium text-gray-700">Draft</span>
          <CopyButton text={text} />
        </div>
        <div className="px-5 py-5">
          <div className="prose prose-sm max-w-none text-gray-800">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
          </div>
        </div>
      </div>

      {pii_detected && Object.keys(pii_detected).length > 0 && (
        <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          <Shield size={12} />
          PII was anonymized during drafting
        </div>
      )}

      <p className="text-xs text-center text-gray-400">{disclaimer}</p>

      <button
        onClick={onReset}
        className="w-full py-2.5 border border-gray-300 text-gray-600 text-sm rounded-xl hover:bg-gray-50"
      >
        {resetLabel || 'Draft another'}
      </button>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// TAB 1: Letter drafter
// ──────────────────────────────────────────────────────────────────────────────

function LetterDrafter() {
  const [form, setForm] = useState({
    letter_type: 'demand',
    sender: '',
    recipient: '',
    subject: '',
    key_points: '',
    matter_reference: '',
  })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const set = field => e => setForm(prev => ({ ...prev, [field]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.key_points.trim()) return

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const data = await api.draftLetter(form)
      setResult(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (result) {
    return (
      <ResultBox
        text={result.draft}
        pii_detected={result.pii_detected}
        disclaimer={result.disclaimer}
        onReset={() => setResult(null)}
        resetLabel="Draft another letter"
      />
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
          <label className="block text-xs font-medium text-gray-600 mb-1">Letter type</label>
          <select value={form.letter_type} onChange={set('letter_type')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#E05A1E]">
            <option value="demand">Letter of Demand</option>
            <option value="without_prejudice">Without Prejudice Letter</option>
            <option value="to_client">Client Update Letter</option>
            <option value="to_court">Letter to Court</option>
            <option value="general">General Legal Letter</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Matter reference</label>
          <input value={form.matter_reference} onChange={set('matter_reference')}
            placeholder="e.g. CL/2024/0012"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#E05A1E]" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
          <input value={form.sender} onChange={set('sender')}
            placeholder="e.g. Chan & Lee LLC, for the Plaintiff"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#E05A1E]" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
          <input value={form.recipient} onChange={set('recipient')}
            placeholder="e.g. M/s Tan & Co"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#E05A1E]" />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Subject / matter description</label>
        <input value={form.subject} onChange={set('subject')}
          placeholder="e.g. Outstanding debt of $15,000 — Invoice #1234"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#E05A1E]" />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Key points to include <span className="text-red-400">*</span>
        </label>
        <textarea value={form.key_points} onChange={set('key_points')}
          required rows={5}
          placeholder={"- Client is owed $15,000 from unpaid invoices dated Jan and Feb 2024\n- Demand payment within 14 days\n- Warn that legal action will follow if not paid\n- Mention previous email of 15 March went unanswered"}
          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#E05A1E] resize-none"
        />
        <p className="text-xs text-gray-400 mt-1">PII in your notes is anonymized before reaching the AI.</p>
      </div>

      <button type="submit" disabled={loading || !form.key_points.trim()}
        className="w-full py-3 bg-[#E05A1E] text-white font-medium rounded-xl hover:bg-[#C4481A]
                   disabled:opacity-60 disabled:cursor-wait flex items-center justify-center gap-2">
        {loading ? <><Loader size={16} className="animate-spin" /> Drafting…</> : <><Mail size={16} /> Draft Letter</>}
      </button>
      {loading && <p className="text-center text-xs text-gray-400 mt-2">Local AI is generating — letters typically take 30–90 seconds</p>}
    </form>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// TAB 2: Billing narratives
// ──────────────────────────────────────────────────────────────────────────────

function BillingNarratives() {
  const [activities, setActivities] = useState('')
  const [matterType, setMatterType] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!activities.trim()) return

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const data = await api.generateBillingNarratives({ activities, matter_type: matterType })
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
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b">
            <span className="text-sm font-medium text-gray-700">Billing entries</span>
            <CopyButton text={result.narratives.join('\n')} />
          </div>
          <div className="px-5 py-4 space-y-2">
            {result.narratives.map((entry, i) => (
              <div key={i} className="flex gap-3 py-2 border-b border-gray-100 last:border-0">
                <span className="text-xs text-gray-400 font-mono mt-0.5 flex-shrink-0">{i + 1}.</span>
                <p className="text-sm text-gray-800">{entry}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-center text-gray-400">{result.disclaimer}</p>
        <button onClick={() => setResult(null)}
          className="w-full py-2.5 border border-gray-300 text-gray-600 text-sm rounded-xl hover:bg-gray-50">
          Generate more narratives
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

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Matter type</label>
        <select value={matterType} onChange={e => setMatterType(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#E05A1E]">
          <option value="">Select (optional)</option>
          <option>Commercial litigation</option>
          <option>Contract review</option>
          <option>Corporate advisory</option>
          <option>Employment matter</option>
          <option>Conveyancing</option>
          <option>Family law</option>
          <option>Intellectual property</option>
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          What did you do today? <span className="text-red-400">*</span>
        </label>
        <textarea value={activities} onChange={e => setActivities(e.target.value)}
          required rows={6}
          placeholder={"- Read client's email about the new contract\n- Called opposing counsel to discuss settlement\n- Reviewed draft agreement, marked up clauses 3, 7, and 12\n- Prepared attendance note\n- Researched case law on specific performance"}
          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#E05A1E] resize-none"
        />
        <p className="text-xs text-gray-400 mt-1">Write rough notes — the AI will turn them into proper billing language.</p>
      </div>

      <button type="submit" disabled={loading || !activities.trim()}
        className="w-full py-3 bg-[#E05A1E] text-white font-medium rounded-xl hover:bg-[#C4481A]
                   disabled:opacity-60 disabled:cursor-wait flex items-center justify-center gap-2">
        {loading ? <><Loader size={16} className="animate-spin" /> Generating…</> : <><DollarSign size={16} /> Generate Narratives</>}
      </button>
      {loading && <p className="text-center text-xs text-gray-400 mt-2">Local AI is generating — billing narratives typically take 30–90 seconds</p>}
    </form>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// TAB 3: Pleading drafter
// ──────────────────────────────────────────────────────────────────────────────

function PleadingDrafter() {
  const [form, setForm] = useState({
    pleading_type: 'statement_of_claim',
    party_role: 'plaintiff',
    facts: '',
    causes_of_action: '',
    relief_sought: '',
  })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const set = field => e => setForm(prev => ({ ...prev, [field]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.facts.trim()) return

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const data = await api.draftPleading(form)
      setResult(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (result) {
    return (
      <ResultBox
        text={result.draft}
        pii_detected={result.pii_detected}
        disclaimer={result.disclaimer}
        onReset={() => setResult(null)}
        resetLabel="Draft another pleading"
      />
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
          <label className="block text-xs font-medium text-gray-600 mb-1">Pleading type</label>
          <select value={form.pleading_type} onChange={set('pleading_type')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#E05A1E]">
            <option value="statement_of_claim">Statement of Claim</option>
            <option value="defence">Defence</option>
            <option value="reply">Reply</option>
            <option value="counterclaim">Defence and Counterclaim</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Our client's role</label>
          <select value={form.party_role} onChange={set('party_role')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#E05A1E]">
            <option value="plaintiff">Plaintiff</option>
            <option value="defendant">Defendant</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Key facts <span className="text-red-400">*</span>
        </label>
        <textarea value={form.facts} onChange={set('facts')}
          required rows={5}
          placeholder="List the key facts chronologically. Include who did what, when, and where. Don't worry about legal language — just explain what happened."
          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#E05A1E] resize-none"
        />
      </div>

      {form.party_role === 'plaintiff' && (
        <>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Causes of action / grounds of claim</label>
            <textarea value={form.causes_of_action} onChange={set('causes_of_action')}
              rows={3}
              placeholder="e.g. Breach of contract — failure to deliver goods. Alternatively, misrepresentation."
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#E05A1E] resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Relief sought</label>
            <textarea value={form.relief_sought} onChange={set('relief_sought')}
              rows={3}
              placeholder="e.g. Damages of $50,000. Interest at 5.33% per annum. Costs."
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#E05A1E] resize-none"
            />
          </div>
        </>
      )}

      <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
        The AI will draft a structure only — have a lawyer review and refine before filing.
      </div>

      <button type="submit" disabled={loading || !form.facts.trim()}
        className="w-full py-3 bg-[#E05A1E] text-white font-medium rounded-xl hover:bg-[#C4481A]
                   disabled:opacity-60 disabled:cursor-wait flex items-center justify-center gap-2">
        {loading ? <><Loader size={16} className="animate-spin" /> Drafting…</> : <><FileText size={16} /> Draft Pleading</>}
      </button>
      {loading && <p className="text-center text-xs text-gray-400 mt-2">Local AI is generating — pleadings typically take 45–120 seconds</p>}
    </form>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

const TABS = [
  { key: 'letter',   label: 'Letter / Email',  icon: Mail       },
  { key: 'billing',  label: 'Billing',          icon: DollarSign },
  { key: 'pleading', label: 'Pleading',         icon: FileText   },
]

export default function Drafting() {
  const [activeTab, setActiveTab] = useState('letter')

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Legal Drafting</h1>
        <p className="text-sm text-gray-500 mt-1">
          Draft letters, billing narratives, and pleading structures using AI.
          Your notes stay private — PII is anonymized before reaching the AI.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-lg transition-all ${
              activeTab === key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'letter'   && <LetterDrafter />}
      {activeTab === 'billing'  && <BillingNarratives />}
      {activeTab === 'pleading' && <PleadingDrafter />}
    </div>
  )
}
