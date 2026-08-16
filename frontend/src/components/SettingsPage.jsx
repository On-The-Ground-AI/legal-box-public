// SettingsPage.jsx — Configure models, user profile, and deployment mode
import React, { useState, useEffect } from 'react'
import { Cpu, Wifi, WifiOff, CheckCircle, AlertCircle, RefreshCw, Database, Trash2, ExternalLink, Shield, ShieldCheck, ShieldAlert, Lock } from 'lucide-react'
import { api } from '../api'
import { SystemResources } from './ResourceMeters'

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, description, children }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b bg-gray-50">
        <h2 className="font-semibold text-gray-900">{title}</h2>
        {description && <p className="text-sm text-gray-500 mt-0.5">{description}</p>}
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  )
}

// ── Cloud provider panel ──────────────────────────────────────────────────────
// Lets users choose between local Ollama (offline) and cloud APIs (online).
// When online mode is active, PII shield is forced on and cannot be disabled.

const CLOUD_PROVIDERS = [
  { id: "ollama", name: "Local Ollama (offline)", description: "Run models on your own computer" },
  { id: "openai", name: "OpenAI", description: "GPT-4o, GPT-4o-mini, etc." },
  { id: "anthropic", name: "Anthropic", description: "Claude 3.5 Sonnet, Claude 4, etc." },
  { id: "groq", name: "Groq", description: "Fast inference for Llama, Mixtral, etc." },
  { id: "gemini", name: "Google Gemini", description: "Gemini 1.5 Flash, Pro, etc." },
]

const DEFAULT_CLOUD_MODELS = {
  ollama: "gemma4:e4b",
  openai: "gpt-4o-mini",
  anthropic: "claude-3-5-sonnet",
  groq: "llama-3.1-70b-versatile",
  gemini: "gemini-1.5-flash",
}

function CloudProviderPanel({ settings, onSave, saving }) {
  const [provider, setProvider] = useState(settings?.cloud_provider || "ollama")
  const [apiKey, setApiKey] = useState("")
  const [model, setModel] = useState(settings?.cloud_model || "")
  const [baseUrl, setBaseUrl] = useState(settings?.cloud_base_url || "")
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)

  const isOnline = provider !== "ollama"

  const handleSave = () => {
    onSave({
      cloud_provider: provider,
      cloud_api_key: apiKey,
      cloud_model: model || DEFAULT_CLOUD_MODELS[provider] || "",
      cloud_base_url: baseUrl,
    })
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch("/api/health")
      const data = await res.json()
      setTestResult({ ok: true, message: `Connected! Using ${data.cloud_provider || provider}` })
    } catch (e) {
      setTestResult({ ok: false, message: `Failed: ${e.message}` })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Provider selection */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {CLOUD_PROVIDERS.map(p => (
          <button
            key={p.id}
            onClick={() => setProvider(p.id)}
            className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
              provider === p.id
                ? "border-[#E05A1E] bg-[#FEF3EE]"
                : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
            }`}
          >
            <div className="flex-1">
              <p className={`font-medium text-sm ${provider === p.id ? "text-[#0A0A0A]" : "text-gray-800"}`}>
                {p.name}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">{p.description}</p>
            </div>
            {provider === p.id && <CheckCircle size={14} className="text-[#E05A1E] flex-shrink-0 mt-0.5" />}
          </button>
        ))}
      </div>

      {/* Online mode settings */}
      {isOnline && (
        <div className="flex flex-col gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start gap-2">
            <AlertCircle size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800">Online mode — your data will be sent to {CLOUD_PROVIDERS.find(p => p.id === provider)?.name}</p>
              <p className="text-xs text-amber-600 mt-0.5">PII shield is active and cannot be disabled in online mode.</p>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-700">API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="sk-..."
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#E05A1E] focus:ring-2 focus:ring-[#E05A1E]/20"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-700">Model (optional)</label>
            <input
              type="text"
              value={model}
              onChange={e => setModel(e.target.value)}
              placeholder={DEFAULT_CLOUD_MODELS[provider] || "default"}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#E05A1E] focus:ring-2 focus:ring-[#E05A1E]/20"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-700">Base URL (optional)</label>
            <input
              type="text"
              value={baseUrl}
              onChange={e => setBaseUrl(e.target.value)}
              placeholder="https://api.openai.com/v1"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#E05A1E] focus:ring-2 focus:ring-[#E05A1E]/20"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving || !apiKey}
              className="px-4 py-2 bg-[#0A0A0A] text-white text-sm font-medium rounded-lg hover:bg-[#1A1A1A] disabled:opacity-40 transition-colors"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              onClick={handleTest}
              disabled={testing || !apiKey}
              className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-colors"
            >
              {testing ? "Testing…" : "Test Connection"}
            </button>
          </div>

          {testResult && (
            <p className={`text-xs ${testResult.ok ? "text-green-600" : "text-red-600"}`}>
              {testResult.message}
            </p>
          )}
        </div>
      )}

      {/* Offline mode info */}
      {!isOnline && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3 text-green-700">
          <ShieldCheck size={18} className="flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm">Local mode — fully offline</p>
            <p className="text-xs mt-0.5">PII shield is optional in offline mode since data never leaves your computer.</p>
          </div>
        </div>
      )}

      {isOnline && (
        <button
          onClick={handleSave}
          disabled={saving}
          className="self-start px-4 py-2 bg-[#0A0A0A] text-white text-sm font-medium rounded-lg hover:bg-[#1A1A1A] disabled:opacity-40 transition-colors"
        >
          {saving ? "Saving…" : "Save backend settings"}
        </button>
      )}
    </div>
  )
}

// ── Confidentiality panel ─────────────────────────────────────────────────────
// The client-facing proof that the PII shield works and that nothing leaves
// the machine. Paste any text → see exactly what the AI would receive.
// PII detection is powered by Presidio (MIT) + Singapore-specific recognizers.

const SAMPLE_TEXT =
  'Our client Mr Tan Ah Kow (NRIC S1234567A) of Block 123 Ang Mo Kio Avenue 3, ' +
  '#05-12, Singapore 560123 owes Acme Holdings Pte Ltd (UEN 201912345A) the sum ' +
  'of S$45,000. Contact him at +65 9123 4567 or tan.ahkow@example.com.sg.'

function ConfidentialityPanel({ health, onSave, saving }) {
  const [text, setText] = useState(SAMPLE_TEXT)
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  const runPreview = async () => {
    setBusy(true); setErr(null)
    try {
      setPreview(await api.piiPreview(text))
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => { runPreview() }, [])  // show the sample masked on first open

  const nerActive = health?.pii_ner_active
  const engine = health?.pii_engine
  const egressLocked = health?.egress_locked
  const piiEnabled = health?.pii_shield_enabled
  const cloudProvider = health?.cloud_provider || "ollama"
  const isOnline = cloudProvider !== "ollama"

  const togglePiiShield = () => {
    if (!isOnline) {
      onSave({ pii_shield_enabled: !piiEnabled })
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* PII Shield toggle */}
      <div className={`flex items-start gap-3 p-3 rounded-xl border ${
        piiEnabled ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'
      }`}>
        {piiEnabled
          ? <ShieldCheck size={18} className="text-green-600 flex-shrink-0 mt-0.5" />
          : <ShieldAlert size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
        }
        <div className="flex-1">
          <p className={`text-sm font-medium ${piiEnabled ? 'text-green-800' : 'text-amber-800'}`}>
            PII Shield {piiEnabled ? 'active' : 'disabled'}
          </p>
          <p className={`text-xs mt-0.5 ${piiEnabled ? 'text-green-700' : 'text-amber-700'}`}>
            {isOnline
              ? 'Required in online mode — data goes to a third party.'
              : 'Optional in offline mode — data stays on your computer.'}
          </p>
        </div>
        <button
          onClick={togglePiiShield}
          disabled={isOnline || saving}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            piiEnabled ? 'bg-green-500' : 'bg-gray-300'
          } ${isOnline ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            piiEnabled ? 'translate-x-6' : 'translate-x-1'
          }`} />
        </button>
      </div>

      {/* Status row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className={`flex items-start gap-3 p-3 rounded-xl border ${
          nerActive === false ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'
        }`}>
          {nerActive === false
            ? <ShieldAlert size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
            : <ShieldCheck size={18} className="text-green-600 flex-shrink-0 mt-0.5" />
          }
          <div>
            <p className={`text-sm font-medium ${nerActive === false ? 'text-red-800' : 'text-green-800'}`}>
              {nerActive === false ? 'Name detection unavailable' : 'PII detection active'}
            </p>
            <p className={`text-xs mt-0.5 ${nerActive === false ? 'text-red-600' : 'text-green-700'}`}>
              {engine === 'presidio'
                ? 'Powered by Presidio + Singapore recognizers'
                : engine === 'spacy-fallback'
                  ? 'spaCy names + Singapore recognizers'
                  : 'Regex recognizers only — names not masked'}
            </p>
          </div>
        </div>
        <div className={`flex items-start gap-3 p-3 rounded-xl border ${
          egressLocked ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'
        }`}>
          <Lock size={18} className={`flex-shrink-0 mt-0.5 ${egressLocked ? 'text-green-600' : 'text-amber-600'}`} />
          <div>
            <p className={`text-sm font-medium ${egressLocked ? 'text-green-800' : 'text-amber-800'}`}>
              {egressLocked ? 'Egress locked' : 'Egress guard off (dev)'}
            </p>
            <p className={`text-xs mt-0.5 ${egressLocked ? 'text-green-700' : 'text-amber-700'}`}>
              {egressLocked
                ? 'The app can only reach this computer'
                : 'Development mode — network is not restricted'}
            </p>
          </div>
        </div>
      </div>

      {/* Live preview */}
      <div>
        <label className="text-xs font-medium text-gray-600">
          Paste any text — this is exactly what the AI would see
        </label>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          rows={4}
          className="mt-1 w-full text-sm border border-gray-200 rounded-xl p-3 font-mono
                     focus:outline-none focus:ring-2 focus:ring-[#E05A1E]/40 resize-y"
        />
        <button
          onClick={runPreview}
          disabled={busy || !text.trim()}
          className="mt-2 flex items-center gap-2 px-4 py-2 bg-[#0A0A0A] text-white text-sm font-medium
                     rounded-lg hover:bg-[#1A1A1A] transition-colors cursor-pointer disabled:opacity-50"
        >
          <Shield size={14} />
          {busy ? 'Checking…' : 'Show what the AI sees'}
        </button>
      </div>

      {err && <p className="text-sm text-red-600">{err}</p>}

      {preview && (
        <div className="flex flex-col gap-2">
          <div className="bg-gray-900 text-gray-100 rounded-xl p-3 text-sm font-mono whitespace-pre-wrap break-words">
            {preview.anonymized_text}
          </div>
          <p className="text-xs text-gray-500">{preview.summary_line}</p>
        </div>
      )}
    </div>
  )
}

// ── Case list ─────────────────────────────────────────────────────────────────

function CaseList() {
  const [cases, setCases] = useState([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState(null)

  const load = () => {
    setLoading(true)
    api.listCases()
      .then(data => setCases(data.cases || []))
      .catch(() => setCases([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleDelete = async (caseId, caseName) => {
    if (!window.confirm(`Remove "${caseName}" from the database?\nThe original PDF file will not be deleted.`)) return
    setDeletingId(caseId)
    try {
      await api.deleteCase(caseId)
      setCases(prev => prev.filter(c => c.id !== caseId))
    } catch (err) {
      alert(`Failed to delete: ${err.message}`)
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) return <p className="text-sm text-gray-400">Loading cases…</p>
  if (cases.length === 0) return (
    <p className="text-sm text-gray-500">No cases uploaded yet. Go to <strong>Upload Cases</strong> to add your first case.</p>
  )

  return (
    <div className="flex flex-col gap-2">
      {cases.map(c => (
        <div key={c.id} className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-xl border border-gray-200">
          <Database size={15} className="text-gray-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 truncate">{c.case_name}</p>
            <p className="text-xs text-gray-500">
              {[c.court, c.date, c.practice_area].filter(Boolean).join(' · ') || 'No metadata'}
              {' · '}{c.chunk_count} chunks indexed
            </p>
          </div>
          <button
            onClick={() => handleDelete(c.id, c.case_name)}
            disabled={deletingId === c.id}
            className="text-gray-400 hover:text-red-500 disabled:opacity-40 transition-colors p-1"
            title="Remove from database"
          >
            {deletingId === c.id
              ? <RefreshCw size={14} className="animate-spin" />
              : <Trash2 size={14} />}
          </button>
        </div>
      ))}
    </div>
  )
}

// ── User Profile ──────────────────────────────────────────────────────────────

function UserProfile({ settings, onSave, saving }) {
  const [name, setName] = useState('')
  const [firm, setFirm] = useState('')
  const [role, setRole] = useState('Associate')
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (settings) {
      setName(settings.display_name || '')
      setFirm(settings.firm || '')
      setRole(settings.role || 'Associate')
      setDirty(false)
    }
  }, [settings])

  const handleSave = () => {
    onSave({ display_name: name, firm, role })
    setDirty(false)
  }

  const mark = (setter) => (e) => { setter(e.target.value); setDirty(true) }

  return (
    <Section title="User Profile" description="Your name and firm appear in audit logs">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-gray-700 uppercase tracking-wide">Display Name</label>
          <input
            type="text"
            value={name}
            onChange={mark(setName)}
            placeholder="e.g. Alice Tan"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#E05A1E] focus:ring-2 focus:ring-[#E05A1E]/20"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-gray-700 uppercase tracking-wide">Firm Name</label>
          <input
            type="text"
            value={firm}
            onChange={mark(setFirm)}
            placeholder="e.g. Tan & Partners LLP"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#E05A1E] focus:ring-2 focus:ring-[#E05A1E]/20"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-gray-700 uppercase tracking-wide">Role</label>
          <input
            list="role-options"
            value={role}
            onChange={mark(setRole)}
            placeholder="Select or type your role"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#E05A1E] focus:ring-2 focus:ring-[#E05A1E]/20"
          />
          <datalist id="role-options">
            <option value="Managing Partner" />
            <option value="Senior Partner" />
            <option value="Partner" />
            <option value="Of Counsel" />
            <option value="Consultant" />
            <option value="Senior Associate" />
            <option value="Associate" />
            <option value="Trainee Solicitor" />
            <option value="Paralegal" />
            <option value="Legal Executive" />
            <option value="Director" />
            <option value="General Counsel" />
            <option value="Deputy General Counsel" />
            <option value="Legal Officer" />
          </datalist>
        </div>
        <button
          onClick={handleSave}
          disabled={!dirty || saving}
          className="self-start px-4 py-2 bg-[#0A0A0A] text-white text-sm font-medium rounded-lg
                     hover:bg-[#1A1A1A] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          {saving ? 'Saving…' : 'Save Profile'}
        </button>
      </div>
    </Section>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function SettingsPage({ health, onOpenModels }) {
  const [settings, setSettings] = useState(null)
  const [models, setModels] = useState([])
  const [profiles, setProfiles] = useState({ heavy: '', light: '' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    Promise.all([api.getSettings(), api.listModels(), api.getModelProfiles()])
      .then(([s, m, p]) => {
        setSettings(s)
        setModels(m.models || [])
        setProfiles(p.profiles || { heavy: '', light: '' })
      })
      .catch(err => setError(err.message))
  }, [])

  const openUninstallGuide = () => {
    const url = 'https://github.com/On-The-Ground-AI/legal-box-public/blob/main/UNINSTALL.md'
    if (window.legalbox?.openExternal) {
      window.legalbox.openExternal(url)
    } else {
      window.open(url, '_blank', 'noopener')
    }
  }

  const saveSettings = async (patch) => {
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      const updated = await api.updateSettings(patch)
      setSettings(updated.settings)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const ollamaRunning = health?.ollama_running

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-500 mt-1">Configure your Legal Box installation</p>
        </div>
        {saved && (
          <div className="flex items-center gap-1.5 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5 animate-fade-in">
            <CheckCircle size={14} />
            Saved
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 text-sm text-red-700">
          <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      <div className="flex flex-col gap-5">

        {/* Confidentiality — the core promise, shown first */}
        <Section
          title="Confidentiality"
          description="Everything runs on this computer. PII is masked before the AI sees it, then restored in the result."
        >
          <ConfidentialityPanel health={health} onSave={saveSettings} saving={saving} />
        </Section>

        {/* AI Backend */}
        <Section title="AI Backend" description="Choose local Ollama or a cloud API provider">
          <CloudProviderPanel 
            settings={health} 
            onSave={saveSettings} 
            saving={saving}
            error={error}
          />
        </Section>

        {/* Ollama Status */}
        <Section title="Ollama Status" description="The local LLM runtime that powers all AI features">
          <div className={`flex items-start gap-3 p-4 rounded-xl ${
            ollamaRunning ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
          }`}>
            {ollamaRunning
              ? <Wifi size={18} className="text-green-600 flex-shrink-0 mt-0.5" />
              : <WifiOff size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
            }
            <div>
              <p className={`font-medium text-sm ${ollamaRunning ? 'text-green-800' : 'text-red-800'}`}>
                {ollamaRunning ? 'Ollama is running' : 'Ollama is not running'}
              </p>
              {!ollamaRunning && (
                <p className="text-xs text-red-600 mt-1">
                  Open Terminal and run: <code className="bg-red-100 px-1 py-0.5 rounded font-mono">ollama serve</code>
                </p>
              )}
              {ollamaRunning && health?.models_available?.length > 0 && (
                <p className="text-xs text-green-600 mt-1">
                  Models available: {health.models_available.join(', ')}
                </p>
              )}
            </div>
          </div>
        </Section>

        {/* System Resources — live CPU/RAM/GPU */}
        <Section
          title="System Resources"
          description="Live usage on this computer. Watch this while the AI runs to see how hard it is working."
        >
          <SystemResources />
        </Section>

        {/* Model Management */}
        <Section
          title="AI Models"
          description="Install multiple models and switch between them based on task weight."
        >
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="border border-gray-200 rounded-xl p-3 bg-gray-50">
                <p className="text-xs font-semibold text-[#E05A1E] uppercase tracking-wide">Heavy</p>
                <p className="text-sm font-medium text-gray-800 mt-1 truncate">
                  {profiles.heavy || settings?.model || '—'}
                </p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Contracts · Drafting · Redline · Bundles · Chronology
                </p>
              </div>
              <div className="border border-gray-200 rounded-xl p-3 bg-gray-50">
                <p className="text-xs font-semibold text-[#0A0A0A] uppercase tracking-wide">Light</p>
                <p className="text-sm font-medium text-gray-800 mt-1 truncate">
                  {profiles.light || settings?.model || '—'}
                </p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Chat · Search · Summarise
                </p>
              </div>
            </div>
            <button
              onClick={onOpenModels}
              className="self-start flex items-center gap-2 px-4 py-2 bg-[#0A0A0A] text-white text-sm font-medium rounded-lg
                         hover:bg-[#1A1A1A] transition-colors cursor-pointer"
            >
              <Cpu size={14} />
              Manage models
            </button>
            <p className="text-xs text-gray-400">
              The model catalog is bundled with the app — OTG Legal Box never fetches a remote list.
              Downloading a new model requires a one-time internet connection.
            </p>
          </div>
        </Section>

        {/* Deployment Mode — Server mode is hidden by default because it
            binds to the network without authentication; only show it when
            explicitly enabled (?advanced=1) or already active. */}
        <Section
          title="Deployment Mode"
          description="Desktop mode: only you can access. Server mode: other devices on the same WiFi can connect."
        >
          <div className="flex flex-col gap-2">
            {[
              {
                value: 'desktop',
                label: 'Desktop Mode',
                desc: 'Only accessible from this computer (localhost). Best for solo use.',
                icon: '💻',
              },
              {
                value: 'server',
                label: 'Server Mode',
                desc: 'Accessible from other computers on the same WiFi. For office Mac Mini setups.',
                icon: '🖥️',
              },
            ].filter(opt =>
              opt.value !== 'server' ||
              settings?.mode === 'server' ||
              (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('advanced') === '1')
            ).map(opt => (
              <button
                key={opt.value}
                onClick={() => saveSettings({ mode: opt.value })}
                className={`flex items-start gap-4 p-4 rounded-xl border text-left transition-all ${
                  settings?.mode === opt.value
                    ? 'border-[#E05A1E] bg-[#FEF3EE]'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <span className="text-xl flex-shrink-0 mt-0.5">{opt.icon}</span>
                <div>
                  <p className={`font-medium text-sm ${settings?.mode === opt.value ? 'text-[#0A0A0A]' : 'text-gray-800'}`}>
                    {opt.label}
                    {settings?.mode === opt.value && (
                      <span className="ml-2 text-xs text-[#E05A1E] font-semibold">Active</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </Section>

        {/* User Profile */}
        <UserProfile settings={settings} onSave={saveSettings} saving={saving} />

        {/* Case Database */}
        <Section
          title="Case Database"
          description="Cases you've uploaded. Remove cases you no longer need."
        >
          <CaseList />
        </Section>

        {/* About */}
        <Section title="About">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-800">OTG Legal Box</p>
                <p className="text-xs text-gray-500">Version {settings?.version || '1.0.0'}</p>
              </div>
              <a
                href="https://github.com/On-The-Ground-AI/legal-box-public"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-[#E05A1E] hover:underline"
              >
                View on GitHub <ExternalLink size={12} />
              </a>
            </div>
            <button
              onClick={openUninstallGuide}
              className="self-start flex items-center gap-2 text-xs text-gray-500 hover:text-red-600 transition-colors"
            >
              <Trash2 size={12} />
              Uninstall guide
            </button>
          </div>
        </Section>
      </div>
    </div>
  )
}
