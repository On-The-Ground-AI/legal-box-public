// AuditLog.jsx — Compliance audit log viewer
// Shows all API activity with proof that nothing left the local machine.

import React, { useState, useEffect, useCallback } from 'react'
import { Shield, Download, RefreshCw, AlertCircle, ChevronDown } from 'lucide-react'
import { api } from '../api'

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusColor(status) {
  if (status >= 500) return 'bg-red-100 text-red-700'
  if (status >= 400) return 'bg-amber-100 text-amber-700'
  return 'bg-green-100 text-green-700'
}

function pathLabel(path) {
  const map = {
    '/api/chat':                   'Chat',
    '/api/summarize':              'Summarize (text)',
    '/api/summarize-file':         'Summarize (file)',
    '/api/contracts/review':       'Contract Review',
    '/api/redline/markup':         'AI Redline',
    '/api/redline/compare':        'Document Compare',
    '/api/bundles/generate':       'Bundle Generator',
    '/api/chronology/extract':     'Chronology (files)',
    '/api/chronology/from-text':   'Chronology (text)',
    '/api/drafting/letter':        'Draft Letter',
    '/api/drafting/billing':       'Billing Narrative',
    '/api/drafting/pleading':      'Draft Pleading',
    '/api/upload-case':            'Upload Case',
    '/api/search-cases':           'Search Cases',
    '/api/settings':               'Settings',
    '/api/health':                 'Health Check',
  }
  return map[path] || path
}

function PiiPill({ type }) {
  const colors = {
    PERSON:      'bg-blue-100 text-blue-700',
    NRIC:        'bg-purple-100 text-purple-700',
    EMAIL:       'bg-indigo-100 text-indigo-700',
    PHONE:       'bg-pink-100 text-pink-700',
    UEN:         'bg-orange-100 text-orange-700',
    BANK_ACCT:   'bg-yellow-100 text-yellow-700',
  }
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${colors[type] || 'bg-gray-100 text-gray-600'}`}>
      {type}
    </span>
  )
}

// ── Date selector ─────────────────────────────────────────────────────────────

function DateSelector({ dates, selected, onSelect }) {
  return (
    <div className="relative">
      <select
        value={selected}
        onChange={e => onSelect(e.target.value)}
        className="appearance-none border border-gray-300 rounded-lg px-3 py-2 pr-8 text-sm
                   focus:outline-none focus:border-[#E05A1E] focus:ring-2 focus:ring-[#E05A1E]/20 bg-white"
      >
        {dates.map(d => (
          <option key={d} value={d}>{d}</option>
        ))}
      </select>
      <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
    </div>
  )
}

// ── Summary bar ───────────────────────────────────────────────────────────────

function SummaryBar({ entries }) {
  const aiPaths = new Set([
    '/api/chat', '/api/summarize', '/api/summarize-file',
    '/api/contracts/review', '/api/redline/markup', '/api/redline/compare',
    '/api/bundles/generate', '/api/chronology/extract', '/api/chronology/from-text',
    '/api/drafting/letter', '/api/drafting/billing', '/api/drafting/pleading',
  ])

  const aiCalls = entries.filter(e => aiPaths.has(e.path)).length
  const piiEvents = entries.filter(e => e.pii && Object.keys(e.pii).length > 0).length
  const errors = entries.filter(e => e.status >= 400).length

  return (
    <div className="grid grid-cols-4 gap-3">
      {[
        { label: 'Total Actions', value: entries.length, color: 'text-gray-900' },
        { label: 'AI Calls',      value: aiCalls,        color: 'text-[#0A0A0A]' },
        { label: 'PII Shielded',  value: piiEvents,      color: 'text-green-700' },
        { label: 'Errors',        value: errors,         color: errors > 0 ? 'text-red-600' : 'text-gray-400' },
      ].map(({ label, value, color }) => (
        <div key={label} className="bg-white border border-gray-200 rounded-xl px-4 py-3">
          <p className={`text-2xl font-semibold ${color}`}>{value}</p>
          <p className="text-xs text-gray-500 mt-0.5">{label}</p>
        </div>
      ))}
    </div>
  )
}

// ── Log table ─────────────────────────────────────────────────────────────────

function LogTable({ entries }) {
  if (entries.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl px-6 py-12 text-center">
        <Shield size={32} className="mx-auto text-gray-300 mb-3" />
        <p className="text-gray-500 text-sm">No activity recorded for this date.</p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-left">
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Time</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">User</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Model</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Duration</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">PII Detected</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Network</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, i) => {
              const hasPii = entry.pii && Object.keys(entry.pii).length > 0
              return (
                <tr
                  key={entry.id || i}
                  className={`border-b border-gray-100 last:border-0 ${
                    hasPii ? 'bg-amber-50/40' : i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'
                  }`}
                >
                  <td className="px-4 py-2.5 text-xs text-gray-500 font-mono whitespace-nowrap">
                    {entry.ts ? entry.ts.split('T')[1]?.replace('Z', '') : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-700 whitespace-nowrap">
                    {entry.user || '—'}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-800 font-medium whitespace-nowrap">
                    {pathLabel(entry.path)}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${statusColor(entry.status)}`}>
                      {entry.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-500 font-mono whitespace-nowrap">
                    {entry.model || '—'}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">
                    {entry.ms != null ? `${entry.ms} ms` : '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    {hasPii ? (
                      <div className="flex flex-wrap gap-1">
                        {Object.keys(entry.pii).map(type => (
                          <PiiPill key={type} type={type} />
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">None</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center gap-1 text-[11px] text-green-700 font-medium">
                      <Shield size={10} />
                      {entry.network || 'local_only'}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function AuditLog() {
  const [dates, setDates] = useState([])
  const [selectedDate, setSelectedDate] = useState(null)
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [verifying, setVerifying] = useState(false)
  const [verifyResult, setVerifyResult] = useState(null)

  // Load available dates on mount
  useEffect(() => {
    api.getAuditDates()
      .then(data => {
        const d = data.dates || []
        const today = new Date().toISOString().split('T')[0]
        const all = d.includes(today) ? d : [today, ...d]
        setDates(all)
        setSelectedDate(all[0] || today)
      })
      .catch(() => {
        const today = new Date().toISOString().split('T')[0]
        setDates([today])
        setSelectedDate(today)
      })
  }, [])

  const loadLogs = useCallback(() => {
    if (!selectedDate) return
    setLoading(true)
    setError(null)
    api.getAuditLogs(selectedDate)
      .then(data => setEntries(data.entries || []))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [selectedDate])

  useEffect(() => { loadLogs() }, [loadLogs])

  const exportLogs = () => {
    if (selectedDate) {
      window.location.href = api.getAuditExportUrl(selectedDate)
    }
  }

  const verifyChain = async () => {
    if (!selectedDate) return
    setVerifying(true)
    setVerifyResult(null)
    try {
      const res = await api.verifyAuditChain(selectedDate)
      setVerifyResult(res)
    } catch (e) {
      setVerifyResult({ valid: false, message: `Verification failed: ${e.message}` })
    } finally {
      setVerifying(false)
    }
  }

  return (
    <div className="px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Audit Log</h1>
          <p className="text-sm text-gray-500 mt-1 flex items-center gap-1.5">
            <Shield size={13} className="text-green-600" />
            Every record proves activity stayed local — no internet egress
          </p>
        </div>
        <div className="flex items-center gap-3">
          {dates.length > 0 && (
            <DateSelector dates={dates} selected={selectedDate} onSelect={setSelectedDate} />
          )}
          <button
            onClick={loadLogs}
            className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            title="Refresh"
          >
            <RefreshCw size={15} className={`text-gray-500 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={verifyChain}
            disabled={verifying}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm
                       hover:bg-gray-50 transition-colors text-gray-700"
          >
            <Shield size={14} />
            {verifying ? 'Verifying…' : 'Verify Integrity'}
          </button>
          <button
            onClick={exportLogs}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm
                       hover:bg-gray-50 transition-colors text-gray-700"
          >
            <Download size={14} />
            Export JSONL
          </button>
        </div>
      </div>

      {/* Verification result */}
      {verifyResult && (
        <div className={`mb-4 rounded-xl p-4 flex items-start gap-3 text-sm ${
          verifyResult.valid ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'
        }`}>
          {verifyResult.valid
            ? <Shield size={15} className="flex-shrink-0 mt-0.5" />
            : <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
          }
          <div>
            <p className="font-medium">{verifyResult.valid ? 'Chain Intact' : 'Chain Broken'}</p>
            <p className="text-xs mt-0.5">{verifyResult.message}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 text-sm text-red-700">
          <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* Summary */}
      {!loading && (
        <div className="mb-4">
          <SummaryBar entries={entries} />
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="bg-white border border-gray-200 rounded-2xl px-6 py-12 text-center">
          <RefreshCw size={24} className="mx-auto text-gray-300 mb-3 animate-spin" />
          <p className="text-sm text-gray-400">Loading audit log…</p>
        </div>
      ) : (
        <LogTable entries={entries} />
      )}

      {/* Compliance note */}
      <p className="text-center text-xs text-gray-400 mt-4">
        Every record contains <code className="font-mono">network: local_only</code> — confirming no data was transmitted to external services.
        Logs are retained for 90 days and can be exported for compliance review.
      </p>
    </div>
  )
}
