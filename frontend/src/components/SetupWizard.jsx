// SetupWizard.jsx — First-run onboarding wizard
// Shown once until localStorage key 'legalbox_v1_setup_done' is set.
// Steps: Welcome → Device Check → Ollama Check → Model Download → Profile

import React, { useState, useEffect, useCallback } from 'react'
import {
  Scale, Shield, Cpu, Wifi, WifiOff, CheckCircle,
  AlertCircle, Download, ChevronRight, RefreshCw, X,
} from 'lucide-react'
import { api } from '../api'

// ── Progress indicator ──────────────────────────────────���─────────────────────

function StepPills({ current, total }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {Array.from({ length: total }, (_, i) => (
        <React.Fragment key={i}>
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
            i < current
              ? 'bg-[#E05A1E] text-white'
              : i === current
              ? 'bg-[#0A0A0A] text-white'
              : 'bg-gray-200 text-gray-400'
          }`}>
            {i < current ? <CheckCircle size={14} /> : i + 1}
          </div>
          {i < total - 1 && (
            <div className={`h-0.5 w-8 rounded transition-all ${i < current ? 'bg-[#E05A1E]' : 'bg-[#E5E5E5]'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  )
}

// ── Step 1: Welcome ───────────────────────────��───────────────────────────────

function StepWelcome({ onNext }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="w-16 h-16 rounded-2xl bg-[#E05A1E] flex items-center justify-center mb-5">
        <Scale size={28} className="text-white" />
      </div>
      <h1 className="text-2xl font-bold text-[#0A0A0A] mb-2">Welcome to OTG Legal Box</h1>
      <p className="text-gray-500 text-sm mb-6 max-w-sm leading-relaxed">
        Your AI legal assistant for Singapore law firms.
        Professional, private, and entirely offline.
      </p>

      <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-4 mb-8 max-w-sm text-left">
        <div className="flex items-start gap-3">
          <Shield size={16} className="text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-green-800">100% Private</p>
            <p className="text-xs text-green-700 mt-0.5">
              Everything runs on this computer. No data ever leaves your machine.
              Client files, AI responses, and audit logs stay local.
            </p>
          </div>
        </div>
      </div>

      <button
        onClick={onNext}
        className="flex items-center gap-2 px-6 py-3 bg-[#0A0A0A] text-white rounded-xl
                   font-semibold text-sm hover:bg-[#1A1A1A] transition-colors cursor-pointer"
      >
        Get Started
        <ChevronRight size={16} />
      </button>
    </div>
  )
}

// ── Step 2: Device Check ────────────────────────────────────────────────────��─

function HardwareRow({ label, value, ok, warn }) {
  const icon = ok === null ? null : ok
    ? <CheckCircle size={14} className="text-green-600" />
    : warn
    ? <AlertCircle size={14} className="text-amber-500" />
    : <X size={14} className="text-red-500" />

  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-600">{label}</span>
      <div className="flex items-center gap-2">
        <span className={`text-sm font-medium ${ok === null ? 'text-gray-500' : ok ? 'text-green-700' : warn ? 'text-amber-600' : 'text-red-600'}`}>
          {value}
        </span>
        {icon}
      </div>
    </div>
  )
}

function StepDeviceCheck({ onNext, onSetSystemInfo }) {
  const [info, setInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.getSystemInfo()
      .then(data => { setInfo(data); onSetSystemInfo(data) })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  // Auto-advance if all green after 1.5s
  useEffect(() => {
    if (info?.meets_minimum && info?.ram_gb >= 12) {
      const t = setTimeout(onNext, 1500)
      return () => clearTimeout(t)
    }
  }, [info, onNext])

  const gpuLabel = {
    apple_silicon: 'Apple Silicon (unified memory)',
    nvidia:        'NVIDIA GPU',
    none:          'CPU only',
  }

  if (loading) return (
    <div className="flex flex-col items-center py-8">
      <RefreshCw size={24} className="text-gray-400 animate-spin mb-3" />
      <p className="text-sm text-gray-500">Checking your device…</p>
    </div>
  )

  if (error) return (
    <div className="flex flex-col items-center py-8 text-center">
      <AlertCircle size={24} className="text-amber-500 mb-3" />
      <p className="text-sm text-gray-600 mb-6">Could not read hardware info — you can continue anyway.</p>
      <button onClick={onNext} className="px-5 py-2.5 bg-[#0A0A0A] text-white rounded-xl text-sm font-semibold hover:bg-[#1A1A1A] transition-colors cursor-pointer">
        Continue
      </button>
    </div>
  )

  const ramOk = info.ram_gb >= info.minimum_ram_gb
  const diskOk = info.disk_free_gb >= info.minimum_disk_gb
  const ramWarn = ramOk && info.ram_gb < 12
  const critical = info.ram_gb < 6

  return (
    <div>
      <div className="text-center mb-6">
        <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
          <Cpu size={22} className="text-[#0A0A0A]" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">Device Check</h2>
        <p className="text-sm text-gray-500 mt-1">Verifying your device meets the requirements</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl px-4 mb-5">
        <HardwareRow
          label="RAM"
          value={`${info.ram_gb} GB ${ramOk ? '' : `(minimum ${info.minimum_ram_gb} GB)`}`}
          ok={ramOk}
          warn={ramWarn}
        />
        <HardwareRow
          label="Free Disk"
          value={`${info.disk_free_gb} GB ${diskOk ? '' : `(minimum ${info.minimum_disk_gb} GB)`}`}
          ok={diskOk}
          warn={false}
        />
        <HardwareRow
          label="GPU"
          value={gpuLabel[info.gpu] || info.gpu}
          ok={info.gpu !== 'none'}
          warn={info.gpu === 'none'}
        />
        <HardwareRow
          label="Recommended Model"
          value={info.recommended_model}
          ok={null}
        />
      </div>

      {critical ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-5 text-sm text-red-700">
          <p className="font-semibold">This device is below minimum requirements.</p>
          <p className="mt-1 text-red-600 text-xs">
            OTG Legal Box requires at least 8 GB RAM and {info.minimum_disk_gb} GB free disk.
            Performance will be very poor or the app may not work at all.
          </p>
        </div>
      ) : !info.meets_minimum ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5 text-sm text-amber-800">
          <p className="font-semibold">Low disk space</p>
          <p className="mt-1 text-xs">
            You need at least {info.minimum_disk_gb} GB free to download and run a model.
            Free up space before continuing.
          </p>
        </div>
      ) : ramWarn ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5 text-sm text-amber-800">
          <p className="font-semibold">Only Gemma 4 E4B supported</p>
          <p className="mt-1 text-xs">
            Your device has {info.ram_gb} GB RAM. Larger models need 16+ GB.
            Gemma 4 E4B works well for most legal tasks.
          </p>
        </div>
      ) : (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-5 text-sm text-green-700 flex items-center gap-2">
          <CheckCircle size={15} />
          <span>Your device is ready. Continuing automatically…</span>
        </div>
      )}

      <div className="flex gap-3">
        {critical && (
          <button
            onClick={() => window.close?.() || (window.location.href = 'about:blank')}
            className="flex-1 py-2.5 border border-red-300 text-red-600 rounded-xl text-sm font-medium hover:bg-red-50 transition-colors"
          >
            Exit
          </button>
        )}
        <button
          onClick={onNext}
          className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
            critical
              ? 'flex-1 bg-gray-200 text-gray-600 hover:bg-gray-300'
              : 'w-full bg-[#0A0A0A] text-white hover:bg-[#1A1A1A]'
          }`}
        >
          {critical ? 'Proceed anyway (not recommended)' : 'Next'}
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  )
}

// ── Step 3: Ollama Check ─────────────────────────────���────────────────────────

function StepOllamaCheck({ onNext }) {
  const [ollamaRunning, setOllamaRunning] = useState(false)
  const [checking, setChecking] = useState(true)

  const check = useCallback(async () => {
    setChecking(true)
    try {
      const data = await api.health()
      setOllamaRunning(!!data.ollama_running)
      if (data.ollama_running) {
        setTimeout(onNext, 800)
      }
    } catch {
      setOllamaRunning(false)
    } finally {
      setChecking(false)
    }
  }, [onNext])

  useEffect(() => {
    check()
    const interval = setInterval(check, 3000)
    return () => clearInterval(interval)
  }, [check])

  const openOllamaDownload = () => {
    if (window.legalbox?.openExternal) {
      window.legalbox.openExternal('https://ollama.com/download')
    } else {
      window.open('https://ollama.com/download', '_blank', 'noopener')
    }
  }

  return (
    <div>
      <div className="text-center mb-6">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3 ${
          ollamaRunning ? 'bg-green-100' : 'bg-gray-100'
        }`}>
          {ollamaRunning
            ? <Wifi size={22} className="text-green-600" />
            : <WifiOff size={22} className="text-gray-500" />
          }
        </div>
        <h2 className="text-xl font-bold text-gray-900">Ollama Setup</h2>
        <p className="text-sm text-gray-500 mt-1">Ollama is the engine that runs AI models locally</p>
      </div>

      {ollamaRunning ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 flex items-center gap-3 text-green-700">
          <CheckCircle size={18} />
          <div>
            <p className="font-semibold text-sm">Ollama is running</p>
            <p className="text-xs mt-0.5">Continuing to the next step…</p>
          </div>
        </div>
      ) : (
        <>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5 text-sm text-amber-800">
            <p className="font-semibold">Ollama is not running</p>
            <p className="text-xs text-amber-700 mt-1">
              Ollama must be installed and running before you can use OTG Legal Box.
              It runs silently in the background and never connects to the internet.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={openOllamaDownload}
              className="flex items-center justify-center gap-2 py-2.5 bg-[#0A0A0A] text-white
                         rounded-xl text-sm font-semibold hover:bg-[#1A1A1A] transition-colors cursor-pointer"
            >
              <Download size={15} />
              Download Ollama
            </button>
            <button
              onClick={check}
              disabled={checking}
              className="flex items-center justify-center gap-2 py-2.5 border border-gray-300 text-gray-700
                         rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-40"
            >
              <RefreshCw size={14} className={checking ? 'animate-spin' : ''} />
              Check Again
            </button>
          </div>
          <p className="text-xs text-gray-400 text-center mt-3">
            Checking automatically every 3 seconds…
          </p>
        </>
      )}
    </div>
  )
}

// ── Step 4: Model Download ──────────────────────────────���─────────────────────

function StepModelDownload({ systemInfo, onNext }) {
  const [installed, setInstalled]       = useState([])
  const [catalog, setCatalog]           = useState([])
  const [pullState, setPullState]       = useState({})
  const [showAll, setShowAll]           = useState(false)
  const [loading, setLoading]           = useState(true)
  const [search, setSearch]             = useState('')

  const recommended = systemInfo?.recommended_model || 'gemma4:e4b'

  const loadInstalled = useCallback(() => {
    api.listModels()
      .then(data => setInstalled((data.models || []).map(m => m.name)))
      .catch(() => {})
  }, [])

  useEffect(() => {
    Promise.all([api.getRecommendedModels(), loadInstalled()])
      .then(([catRes]) => setCatalog(catRes.models || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [loadInstalled])

  const hasAnyInstalled = installed.length > 0

  const startPull = async (modelId) => {
    setPullState(prev => ({ ...prev, [modelId]: { status: 'pulling', progress: -1, statusText: 'Starting…' } }))
    try {
      await api.pullModel(modelId, (evt) => {
        const progress = evt.total > 0 ? Math.round((evt.completed / evt.total) * 100) : -1
        setPullState(prev => ({
          ...prev,
          [modelId]: {
            status:     evt.status === 'done' ? 'done' : 'pulling',
            progress,
            statusText: evt.status || 'Downloading…',
          }
        }))
      })
      setPullState(prev => ({ ...prev, [modelId]: { status: 'done', progress: 100 } }))
      loadInstalled()
    } catch (err) {
      setPullState(prev => ({ ...prev, [modelId]: { status: 'error', error: err.message } }))
    }
  }

  const primaryModel = catalog.find(m => m.id === recommended) || catalog[0]
  const filteredCatalog = search.trim()
    ? catalog.filter(m => m.name.toLowerCase().includes(search.toLowerCase()) || m.id.toLowerCase().includes(search.toLowerCase()))
    : catalog
  const basicModels     = filteredCatalog.filter(m => m.tier === 'basic')
  const recModels       = filteredCatalog.filter(m => m.tier === 'recommended')
  const profModels      = filteredCatalog.filter(m => m.tier === 'professional')

  const tierLabel = { basic: 'Basic', recommended: 'Recommended', professional: 'Professional' }
  const tierColor = { basic: 'text-gray-500', recommended: 'text-[#E05A1E]', professional: 'text-purple-600' }

  if (loading) return (
    <div className="flex flex-col items-center py-8">
      <RefreshCw size={24} className="text-gray-400 animate-spin mb-3" />
      <p className="text-sm text-gray-500">Loading model catalog…</p>
    </div>
  )

  return (
    <div>
      <div className="text-center mb-6">
        <div className="w-12 h-12 rounded-xl bg-[#E05A1E] flex items-center justify-center mx-auto mb-3">
          <Download size={22} className="text-white" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">Download AI Model</h2>
        <p className="text-sm text-gray-500 mt-1">
          Based on your device, we recommend <strong>{primaryModel?.name || '—'}</strong>
        </p>
      </div>

      {hasAnyInstalled && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-5 flex items-center gap-3 text-green-700">
          <CheckCircle size={18} />
          <div>
            <p className="font-semibold text-sm">Model ready</p>
            <p className="text-xs mt-0.5">Installed: {installed.join(', ')}</p>
          </div>
        </div>
      )}

      {/* Primary model card */}
      {primaryModel && !installed.includes(primaryModel.id) && (
        <ModelDownloadCard
          model={primaryModel}
          ps={pullState[primaryModel.id]}
          onPull={() => startPull(primaryModel.id)}
          primary
        />
      )}

      {/* Search + filter */}
      <div className="mt-4">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search models…"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#E05A1E]"
        />
      </div>

      {/* Other models grouped by tier */}
      <button
        onClick={() => setShowAll(v => !v)}
        className="text-xs text-gray-400 hover:text-gray-600 underline mt-3 block mx-auto"
      >
        {showAll ? 'Hide all models' : `Show all ${catalog.length} models`}
      </button>

      {showAll && (
        <div className="mt-3 flex flex-col gap-4">
          {[['basic', basicModels], ['recommended', recModels], ['professional', profModels]].map(([tier, models]) => {
            if (models.length === 0) return null
            return (
              <div key={tier}>
                <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${tierColor[tier]}`}>
                  {tierLabel[tier]}
                </p>
                <div className="flex flex-col gap-2">
                  {models.map(m => (
                    <ModelDownloadCard
                      key={m.id}
                      model={{
                        id: m.id,
                        name: m.name,
                        desc: m.description,
                        ram: `${m.ram_gb} GB`,
                        size: `~${m.disk_gb} GB`,
                        context: m.context_k,
                      }}
                      ps={pullState[m.id]}
                      onPull={() => startPull(m.id)}
                      installed={installed.includes(m.id)}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="mt-6 flex flex-col gap-2">
        <button
          onClick={onNext}
          disabled={!hasAnyInstalled && !Object.values(pullState).some(p => p.status === 'done')}
          className="flex items-center justify-center gap-2 py-2.5 bg-[#0A0A0A] text-white
                     rounded-xl text-sm font-semibold hover:bg-[#1A1A1A] disabled:opacity-40 transition-colors cursor-pointer"
        >
          {hasAnyInstalled ? 'Continue' : 'Continue Once Downloaded'}
          <ChevronRight size={15} />
        </button>
        {!hasAnyInstalled && (
          <button onClick={onNext} className="text-xs text-gray-400 hover:text-gray-600 underline text-center">
            Skip for now
          </button>
        )}
      </div>
    </div>
  )
}

function ModelDownloadCard({ model, ps, onPull, primary, installed }) {
  return (
    <div className={`border rounded-xl p-4 ${primary ? 'border-[#E05A1E] bg-[#FEF3EE]' : 'border-gray-200 bg-white'}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-800">{model.name}</p>
          <p className="text-xs text-gray-500">{model.desc}</p>
          <p className="text-xs text-gray-400 mt-0.5">{model.ram} RAM · {model.size} download</p>
        </div>
        {installed ? (
          <span className="text-xs text-green-600 font-medium flex-shrink-0">Installed</span>
        ) : ps?.status === 'pulling' ? (
          <span className="text-xs text-gray-500 flex-shrink-0">Downloading…</span>
        ) : ps?.status === 'done' ? (
          <span className="text-xs text-green-600 font-medium flex-shrink-0">Done</span>
        ) : (
          <button
            onClick={onPull}
            className="flex items-center gap-1.5 text-xs font-medium text-white bg-[#0A0A0A]
                       px-3 py-1.5 rounded-lg hover:bg-[#1A1A1A] transition-colors flex-shrink-0 cursor-pointer"
          >
            <Download size={12} />
            Download
          </button>
        )}
      </div>

      {ps?.status === 'pulling' && (
        <div className="mt-3">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>{ps.statusText || 'Downloading…'}</span>
            {ps.progress >= 0 && <span>{ps.progress}%</span>}
          </div>
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            {ps.progress >= 0
              ? <div className="h-full bg-[#E05A1E] rounded-full transition-all" style={{ width: `${ps.progress}%` }} />
              : <div className="h-full bg-[#E05A1E] rounded-full animate-pulse w-1/3" />
            }
          </div>
        </div>
      )}
      {ps?.status === 'error' && (
        <p className="mt-2 text-xs text-red-600">{ps.error}</p>
      )}
    </div>
  )
}

// ── Step 5: Profile ───────────────────────────────────────────────────────────

function StepProfile({ onComplete }) {
  const [name, setName] = useState('')
  const [firm, setFirm] = useState('')
  const [role, setRole] = useState('Associate')
  const [saving, setSaving] = useState(false)

  const finish = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      await api.updateSettings({ display_name: name.trim(), firm: firm.trim(), role })
      onComplete()
    } catch {
      onComplete()
    }
  }

  return (
    <div>
      <div className="text-center mb-6">
        <div className="w-12 h-12 rounded-xl bg-[#E05A1E] flex items-center justify-center mx-auto mb-3">
          <Scale size={22} className="text-white" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">Almost there!</h2>
        <p className="text-sm text-gray-500 mt-1">
          Your name and firm are recorded in every audit log entry
        </p>
      </div>

      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-gray-700 uppercase tracking-wide">
            Your Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Alice Tan"
            className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#E05A1E] focus:ring-2 focus:ring-[#E05A1E]/20"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-gray-700 uppercase tracking-wide">Firm Name</label>
          <input
            type="text"
            value={firm}
            onChange={e => setFirm(e.target.value)}
            placeholder="e.g. Tan & Partners LLP"
            className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#E05A1E] focus:ring-2 focus:ring-[#E05A1E]/20"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-gray-700 uppercase tracking-wide">Role</label>
          <input
            list="role-options"
            value={role}
            onChange={e => setRole(e.target.value)}
            placeholder="Select or type your role"
            className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#E05A1E] focus:ring-2 focus:ring-[#E05A1E]/20"
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
      </div>

      <button
        onClick={finish}
        disabled={saving}
        className="w-full flex items-center justify-center gap-2 py-3 bg-[#E05A1E] text-white
                   rounded-xl text-sm font-semibold hover:bg-[#C4481A] disabled:opacity-40 transition-colors cursor-pointer"
      >
        {saving ? <RefreshCw size={15} className="animate-spin" /> : <CheckCircle size={15} />}
        Start using OTG Legal Box
      </button>

      <p className="text-center text-xs text-gray-400 mt-3">
        You can update your profile anytime in Settings.
      </p>
    </div>
  )
}

// ── Main Wizard Component ──────────────────────────��───────────────────���──────

const TOTAL_STEPS = 5

export default function SetupWizard({ onComplete }) {
  const [step, setStep] = useState(0)
  const [systemInfo, setSystemInfo] = useState(null)

  const next = useCallback(() => {
    setStep(s => Math.min(s + 1, TOTAL_STEPS - 1))
  }, [])

  const handleComplete = () => {
    localStorage.setItem('legalbox_v1_setup_done', '1')
    onComplete()
  }

  const STEPS = [
    <StepWelcome key={0} onNext={next} />,
    <StepDeviceCheck key={1} onNext={next} onSetSystemInfo={setSystemInfo} />,
    <StepOllamaCheck key={2} onNext={next} />,
    <StepModelDownload key={3} systemInfo={systemInfo} onNext={next} />,
    <StepProfile key={4} onComplete={handleComplete} />,
  ]

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-8 max-h-[90vh] overflow-y-auto">
        <StepPills current={step} total={TOTAL_STEPS} />
        {STEPS[step]}
      </div>
    </div>
  )
}
