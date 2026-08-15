// ModelManagerModal.jsx — Prominent model switcher
//
// Opened from the header pill in App.jsx and from the Settings page.
// Three sections:
//   1. Profiles  — pick a heavy model (contracts, drafting, redline) and a
//                  light model (chat, search, summarize) from installed models.
//   2. Installed — see what Ollama has on disk; delete models.
//   3. Available — the bundled Gemma 4 catalog; download new models (requires
//                  a one-time internet connection).
//
// The catalog is intentionally STATIC and bundled — OTG Legal Box never
// fetches a remote catalog, so new models only appear when the app is updated.

import React, { useState, useEffect, useCallback } from 'react'
import {
  X, Zap, Feather, Download, Trash2, RefreshCw,
  CheckCircle, AlertCircle, Cpu, Wifi, WifiOff,
} from 'lucide-react'
import { api } from '../api'

const TIER_LABELS = { basic: 'Basic', recommended: 'Recommended', professional: 'Professional' }
const TIER_COLORS = {
  basic:        'text-gray-500',
  recommended:  'text-[#E05A1E]',
  professional: 'text-purple-600',
}

export default function ModelManagerModal({ open, onClose, health }) {
  const [installed, setInstalled]       = useState([])
  const [catalog, setCatalog]           = useState([])
  const [profiles, setProfiles]         = useState({ heavy: '', light: '' })
  const [activeModel, setActiveModel]   = useState('')
  const [pullState, setPullState]       = useState({})     // { modelId: { status, progress, ... } }
  const [deleting, setDeleting]         = useState(null)
  const [savingProfiles, setSavingProfiles] = useState(false)
  const [error, setError]               = useState(null)
  const [loading, setLoading]           = useState(true)
  const [search, setSearch]             = useState('')

  const filteredCatalog = search.trim()
    ? catalog.filter(m => m.name.toLowerCase().includes(search.toLowerCase()) || m.id.toLowerCase().includes(search.toLowerCase()))
    : catalog

  const filteredCatalogByTier = [
    { tier: 'Basic', models: filteredCatalog.filter(m => m.tier === 'basic'), color: 'text-gray-500' },
    { tier: 'Recommended', models: filteredCatalog.filter(m => m.tier === 'recommended'), color: 'text-[#E05A1E]' },
    { tier: 'Professional', models: filteredCatalog.filter(m => m.tier === 'professional'), color: 'text-purple-600' },
  ].filter(t => t.models.length > 0)

  const refresh = useCallback(async () => {
    try {
      const [modelsRes, catalogRes, profilesRes] = await Promise.all([
        api.listModels(),
        api.getRecommendedModels(),
        api.getModelProfiles(),
      ])
      setInstalled(modelsRes.models || [])
      setCatalog(catalogRes.models || [])
      setProfiles(profilesRes.profiles || { heavy: '', light: '' })
      setActiveModel(profilesRes.active || modelsRes.default_model || '')
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) { setLoading(true); refresh() }
  }, [open, refresh])

  if (!open) return null

  const installedNames = installed.map(m => m.name)
  const ollamaRunning  = health?.ollama_running

  const setSlot = (slot, value) => {
    setProfiles(prev => ({ ...prev, [slot]: value }))
  }

  const saveProfiles = async () => {
    setSavingProfiles(true)
    try {
      const res = await api.setModelProfiles({
        heavy: profiles.heavy || '',
        light: profiles.light || '',
      })
      setProfiles(res.profiles || profiles)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingProfiles(false)
    }
  }

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
          },
        }))
      })
      setPullState(prev => ({ ...prev, [modelId]: { status: 'done', progress: 100 } }))
      refresh()
    } catch (err) {
      setPullState(prev => ({ ...prev, [modelId]: { status: 'error', error: err.message } }))
    }
  }

  const handleDelete = async (modelName) => {
    if (!window.confirm(`Delete model "${modelName}"? You'll need to re-download it to use it again.`)) return
    setDeleting(modelName)
    try {
      await api.deleteModel(modelName)
      // If this model was used in a profile slot, clear that slot.
      const cleared = {
        heavy: profiles.heavy === modelName ? '' : profiles.heavy,
        light: profiles.light === modelName ? '' : profiles.light,
      }
      if (cleared.heavy !== profiles.heavy || cleared.light !== profiles.light) {
        await api.setModelProfiles(cleared)
      }
      refresh()
    } catch (err) {
      alert(`Failed to delete: ${err.message}`)
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Model Manager</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Install multiple models and switch between them for heavy and light tasks.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 p-1 cursor-pointer"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-6">
          {/* Ollama status banner */}
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${
            ollamaRunning
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {ollamaRunning ? <Wifi size={13} /> : <WifiOff size={13} />}
            {ollamaRunning
              ? 'Ollama is running — you can install and switch models.'
              : 'Ollama is not running. Start Ollama before installing or switching models.'}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2 text-sm text-red-700">
              <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-10 text-gray-400">
              <RefreshCw size={18} className="animate-spin mr-2" /> Loading models…
            </div>
          ) : (
            <>
              {/* ── Profiles ── */}
              <section>
                <h3 className="text-sm font-semibold text-gray-900 mb-1">Active models by task</h3>
                <p className="text-xs text-gray-500 mb-3">
                  Pick one model for heavy work (Contract Review, Drafting, Redlining, Bundles, Chronology)
                  and one for light work (Chat, Search, Summarise). If a slot is empty, the fallback
                  model <code className="bg-gray-100 px-1 rounded">{activeModel || '—'}</code> is used.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <ProfileSlot
                    icon={<Zap size={14} className="text-[#E05A1E]" />}
                    label="Heavy tasks"
                    hint="Contracts, drafting, redline, bundles, chronology"
                    value={profiles.heavy}
                    options={installedNames}
                    onChange={val => setSlot('heavy', val)}
                  />
                  <ProfileSlot
                    icon={<Feather size={14} className="text-[#0A0A0A]" />}
                    label="Light tasks"
                    hint="Chat, search, summarise"
                    value={profiles.light}
                    options={installedNames}
                    onChange={val => setSlot('light', val)}
                  />
                </div>

                <div className="flex items-center gap-3 mt-3">
                  <button
                    onClick={saveProfiles}
                    disabled={savingProfiles}
                    className="px-4 py-2 bg-[#0A0A0A] text-white text-sm font-medium rounded-lg
                               hover:bg-[#1A1A1A] disabled:opacity-40 transition-colors cursor-pointer"
                  >
                    {savingProfiles ? 'Saving…' : 'Save profiles'}
                  </button>
                  {installedNames.length === 0 && (
                    <span className="text-xs text-gray-500">
                      No models installed yet. Download one below first.
                    </span>
                  )}
                </div>
              </section>

              {/* ── Installed models ── */}
              <section>
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Installed models</h3>
                {installed.length === 0 ? (
                  <p className="text-sm text-gray-500">Nothing installed yet.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {installed.map(m => {
                      const isHeavy = profiles.heavy === m.name
                      const isLight = profiles.light === m.name
                      return (
                        <div key={m.name} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 bg-white">
                          <Cpu size={16} className="text-gray-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{m.name}</p>
                            <p className="text-xs text-gray-500">
                              {m.size_gb} GB on disk
                              {isHeavy && <span className="ml-2 text-[#E05A1E] font-medium">· Heavy</span>}
                              {isLight && <span className="ml-2 text-[#0A0A0A] font-medium">· Light</span>}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              onClick={() => setSlot('heavy', m.name)}
                              title="Use for heavy tasks"
                              className={`text-xs px-2 py-1 rounded-md border transition-colors cursor-pointer ${
                                isHeavy
                                  ? 'border-[#E05A1E] bg-[#FEF3EE] text-[#E05A1E]'
                                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                              }`}
                            >
                              Heavy
                            </button>
                            <button
                              onClick={() => setSlot('light', m.name)}
                              title="Use for light tasks"
                              className={`text-xs px-2 py-1 rounded-md border transition-colors cursor-pointer ${
                                isLight
                                  ? 'border-[#0A0A0A] bg-gray-100 text-[#0A0A0A]'
                                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                              }`}
                            >
                              Light
                            </button>
                            <button
                              onClick={() => handleDelete(m.name)}
                              disabled={deleting === m.name}
                              className="text-gray-400 hover:text-red-500 disabled:opacity-40 p-1 transition-colors"
                              title="Delete model"
                            >
                              {deleting === m.name
                                ? <RefreshCw size={14} className="animate-spin" />
                                : <Trash2 size={14} />}
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>

              {/* ── Available catalog ── */}
              <section>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-gray-900">Available models</h3>
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider">
                    Bundled catalog · offline-safe
                  </span>
                </div>
                <p className="text-xs text-gray-500 mb-3">
                  Downloading a model needs a one-time internet connection. Once installed,
                  OTG Legal Box runs fully offline — the app never fetches a remote catalog.
                </p>
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search models…"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#E05A1E] mb-3"
                />
                <div className="flex flex-col gap-3">
                  {filteredCatalogByTier.map(({ tier, models: tierModels, color }) => (
                    <div key={tier}>
                      <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${color}`}>
                        {tier}
                      </p>
                      <div className="flex flex-col gap-2">
                        {tierModels.map(m => {
                          const alreadyInstalled = installedNames.includes(m.id)
                          const ps = pullState[m.id]
                          return (
                            <div key={m.id} className="px-4 py-3 rounded-xl border border-gray-200 bg-white">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="text-sm font-medium text-gray-800">{m.name}</p>
                                    <span className="text-xs text-gray-400">{m.ram_gb} GB RAM</span>
                                    <span className="text-xs text-gray-400">{m.disk_gb} GB disk</span>
                                    <span className="text-xs text-gray-400">{m.context_k}K context</span>
                                  </div>
                                  <p className="text-xs text-gray-500 mt-0.5">{m.description}</p>
                                </div>
                                {alreadyInstalled ? (
                                  <span className="text-xs text-green-600 font-medium flex-shrink-0 mt-0.5">
                                    <CheckCircle size={12} className="inline mr-1" />
                                    Installed
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => startPull(m.id)}
                                    disabled={!!ps || !ollamaRunning}
                                    className="flex items-center gap-1.5 text-xs font-medium text-white bg-[#0A0A0A]
                                               px-3 py-1.5 rounded-lg hover:bg-[#1A1A1A] disabled:opacity-40
                                               transition-colors flex-shrink-0 cursor-pointer"
                                  >
                                    <Download size={12} />
                                    Download
                                  </button>
                                )}
                              </div>
                              {ps?.status === 'pulling' && (
                                <div className="mt-2">
                                  <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                                    <span>{ps.statusText || 'Downloading…'}</span>
                                    {ps.progress >= 0 && <span>{ps.progress}%</span>}
                                  </div>
                                  <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                    {ps.progress >= 0 ? (
                                      <div
                                        className="h-full bg-[#E05A1E] rounded-full transition-all duration-300"
                                        style={{ width: `${ps.progress}%` }}
                                      />
                                    ) : (
                                      <div className="h-full bg-[#E05A1E] rounded-full animate-pulse w-1/3" />
                                    )}
                                  </div>
                                </div>
                              )}
                              {ps?.status === 'error' && (
                                <p className="mt-1 text-xs text-red-600">{ps.error}</p>
                              )}
                              {ps?.status === 'done' && !alreadyInstalled && (
                                <p className="mt-1 text-xs text-green-600">Download complete.</p>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-200 flex items-center justify-between">
          <button
            onClick={refresh}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 cursor-pointer"
          >
            <RefreshCw size={12} /> Refresh
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-sm font-medium rounded-lg transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

function ProfileSlot({ icon, label, hint, value, options, onChange }) {
  return (
    <div className="border border-gray-200 rounded-xl p-3 bg-gray-50">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <p className="text-xs font-semibold text-gray-800">{label}</p>
      </div>
      <p className="text-[11px] text-gray-500 mb-2">{hint}</p>
      <select
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm bg-white
                   focus:outline-none focus:border-[#E05A1E]"
      >
        <option value="">(use fallback)</option>
        {options.map(name => (
          <option key={name} value={name}>{name}</option>
        ))}
      </select>
    </div>
  )
}
