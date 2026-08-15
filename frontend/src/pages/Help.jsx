// Help.jsx — In-app help and tool guide

import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  MessageSquare, Upload, Search, FileText, GitCompare,
  BookOpen, Clock, PenTool, AlignLeft, Library,
  Shield, HelpCircle, ExternalLink, ChevronRight,
} from 'lucide-react'

// ── Tool catalog ──────────────────────────────────────────────────────────────

const TOOLS = [
  {
    to:    '/',
    icon:  MessageSquare,
    title: 'Legal Chat',
    desc:  'Ask questions about Singapore law. PII is automatically stripped before anything reaches the AI.',
    uses:  ['Research a legal issue or principle', 'Get a quick summary of how a law works', 'Ask follow-up questions on a topic'],
    example: 'What are the requirements for a valid contract under Singapore law?',
  },
  {
    to:    '/summarize',
    icon:  AlignLeft,
    title: 'Summarize',
    desc:  'Paste text or upload a PDF/DOCX and get a structured legal summary in seconds.',
    uses:  ['Condense a long judgment into key points', 'Get a quick overview before reading in full', 'Summarise an opposing party\'s submissions'],
    example: 'Upload a 60-page judgment → get a 1-page structured summary.',
  },
  {
    to:    '/upload',
    icon:  Upload,
    title: 'Upload Cases',
    desc:  'Add case PDFs to your local database for semantic search and AI-assisted research.',
    uses:  ['Build your own case library', 'Index precedents for a current matter', 'Add research materials from LawNet'],
    example: 'Upload 20 cases on damages → search them by topic instantly.',
  },
  {
    to:    '/search',
    icon:  Search,
    title: 'Search Cases',
    desc:  'Semantic search over your uploaded cases. Finds relevant passages even when exact words differ.',
    uses:  ['Find authorities on a specific legal point', 'Identify cases with similar facts', 'Research damages or remedies across your library'],
    example: 'Search "misrepresentation inducing contract" → finds relevant passages from uploaded cases.',
  },
  {
    to:    '/contracts',
    icon:  FileText,
    title: 'Contract Review',
    desc:  'Upload a contract (PDF or DOCX) and get a structured risk report with clause-by-clause analysis.',
    uses:  ['Initial review of an unfamiliar contract', 'Flag unusual or missing clauses', 'Prepare for negotiation'],
    example: 'Upload a service agreement → get a risk report covering liability, IP, and termination.',
  },
  {
    to:    '/redline',
    icon:  GitCompare,
    title: 'Redlining',
    desc:  'Two modes: (1) AI markup protecting a specific party; (2) Compare two document versions.',
    uses:  ['Mark up a contract from the client\'s perspective', 'Show changes between draft versions', 'Identify what the other side changed'],
    example: 'Upload a lease → get tracked-changes markup protecting the tenant.',
  },
  {
    to:    '/bundles',
    icon:  BookOpen,
    title: 'Bundle Creator',
    desc:  'Describe your matter and get a structured court bundle with authorities sorted by relevance.',
    uses:  ['Prepare a bundle of authorities for a hearing', 'Sort cases by relevance to your submissions', 'Generate relevance statements for each authority'],
    example: 'Describe a negligence claim → get a sorted list of authorities with one-line relevance notes.',
  },
  {
    to:    '/chronology',
    icon:  Clock,
    title: 'Chronology',
    desc:  'Upload multiple documents and extract a sorted timeline of events automatically.',
    uses:  ['Build a litigation chronology from correspondence', 'Extract dates from multiple affidavits', 'Reconstruct a sequence of events'],
    example: 'Upload 30 emails and 5 affidavits → get a sorted chronology with sources.',
  },
  {
    to:    '/drafting',
    icon:  PenTool,
    title: 'Drafting',
    desc:  'Draft letters, billing narratives, and pleading structures. Three modes in one tool.',
    uses:  ['Letter of demand, advice letters, without-prejudice correspondence', 'Time-entry billing narratives for time-keeping', 'Statement of claim or defence skeleton'],
    example: 'Fill in client and matter details → get a ready-to-send letter of demand.',
  },
  {
    to:    '/prompts',
    icon:  Library,
    title: 'Prompt Library',
    desc:  '1000+ pre-written legal AI prompts organised by practice area and difficulty.',
    uses:  ['Find the right prompt for a research task', 'Use structured templates for complex analysis', 'Open any prompt directly in Chat with one click'],
    example: 'Browse "Commercial" → "Advanced" → find prompts for M&A due diligence.',
  },
]

// ── Tool card ─────────────────────────────────────────────────────────────────

function ToolCard({ tool, filter }) {
  const navigate = useNavigate()
  const Icon = tool.icon

  if (filter && !tool.title.toLowerCase().includes(filter) && !tool.desc.toLowerCase().includes(filter)) {
    return null
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 hover:border-[#E05A1E] hover:shadow-sm transition-all group">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-[#0A0A0A] flex items-center justify-center flex-shrink-0">
          <Icon size={18} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 text-sm">{tool.title}</h3>
          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{tool.desc}</p>
        </div>
      </div>

      <div className="mt-4">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">When to use</p>
        <ul className="flex flex-col gap-1">
          {tool.uses.map((u, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs text-gray-600">
              <span className="text-[#E05A1E] mt-0.5 flex-shrink-0">·</span>
              {u}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4 bg-gray-50 rounded-xl px-3 py-2.5">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Example</p>
        <p className="text-xs text-gray-600 italic leading-relaxed">{tool.example}</p>
      </div>

      <button
        onClick={() => navigate(tool.to)}
        className="mt-4 w-full flex items-center justify-center gap-2 py-2 bg-[#0A0A0A]
                   text-white text-xs font-medium rounded-lg hover:bg-[#1A1A1A] transition-colors cursor-pointer"
      >
        Open {tool.title}
        <ChevronRight size={13} />
      </button>
    </div>
  )
}

// ── Privacy section ───────────────────────────────────────────────────────────

function PrivacySection() {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
          <Shield size={18} className="text-green-700" />
        </div>
        <div>
          <h2 className="font-semibold text-gray-900">Data Privacy & Security</h2>
          <p className="text-sm text-gray-500 mt-1 leading-relaxed">
            OTG Legal Box runs entirely on your computer. No data is sent to the internet —
            not your questions, not your documents, not your clients' names.
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            title: 'PII Shield',
            body:  'Names, NRICs, phone numbers, emails, and company UENs are automatically replaced with placeholders before reaching the AI. They are restored in the response.',
          },
          {
            title: 'Local AI',
            body:  'Gemma 4 runs inside Ollama on your computer. Your questions go to localhost, not a cloud server. Even in a power outage with no internet, the app still works.',
          },
          {
            title: 'Audit Log',
            body:  'Every action is logged locally with "network: local_only" — providing a timestamped record of activity for PDPA compliance and internal review.',
          },
        ].map(({ title, body }) => (
          <div key={title} className="bg-gray-50 rounded-xl p-4">
            <p className="text-sm font-semibold text-gray-800 mb-1">{title}</p>
            <p className="text-xs text-gray-500 leading-relaxed">{body}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Help() {
  const [filter, setFilter] = useState('')

  return (
    <div className="px-6 py-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-xl bg-[#E05A1E] flex items-center justify-center">
            <HelpCircle size={18} className="text-white" />
          </div>
          <h1 className="text-xl font-semibold text-gray-900">Help & Guide</h1>
        </div>
        <p className="text-sm text-gray-500">
          OTG Legal Box — 10 AI tools for Singapore law firms. All local. All private.
        </p>
      </div>

      <PrivacySection />

      {/* Tool search */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-800">All Tools</h2>
        <input
          type="text"
          value={filter}
          onChange={e => setFilter(e.target.value.toLowerCase())}
          placeholder="Filter tools…"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-48
                     focus:outline-none focus:border-[#E05A1E] focus:ring-2 focus:ring-[#E05A1E]/20"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {TOOLS.map(tool => (
          <ToolCard key={tool.to} tool={tool} filter={filter} />
        ))}
      </div>

      {/* Disclaimer */}
      <div className="mt-8 text-center text-xs text-gray-400 leading-relaxed">
        OTG Legal Box is a productivity tool for qualified legal professionals.
        All AI output must be reviewed by a qualified lawyer before use.
        <br />
        All Singapore Ministry of Law guidelines on the use of generative AI in legal practice apply.
      </div>
    </div>
  )
}
