// App.jsx — Root component with navigation and layout

import React, { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import {
  MessageSquare, Upload, Search, Settings,
  Scale, Wifi, WifiOff, AlertCircle,
  FileText, BookOpen, Clock, PenTool,
  GitCompare, AlignLeft, Library, ClipboardList, ChevronDown,
  UserPlus, CheckCircle, HelpCircle, Cpu, Zap, Feather,
} from 'lucide-react'

import Chat from './components/Chat'
import UploadCase from './components/UploadCase'
import SearchCases from './components/SearchCases'
import SettingsPage from './components/SettingsPage'
import ContractReview from './pages/ContractReview'
import BundleCreator from './pages/BundleCreator'
import Chronology from './pages/Chronology'
import Drafting from './pages/Drafting'
import Redline from './pages/Redline'
import Summarize from './pages/Summarize'
import PromptLibrary from './pages/PromptLibrary'
import AuditLog from './pages/AuditLog'
import Help from './pages/Help'
import SetupWizard from './components/SetupWizard'
import ModelManagerModal from './components/ModelManagerModal'
import { SidebarMeters } from './components/ResourceMeters'
import { api } from './api'

// ── Status Badge ──────────────────────────────────────────────────────────────

function StatusBadge({ health }) {
  if (!health) return (
    <div className="flex items-center gap-2 text-xs text-gray-400 px-4 py-2">
      <span className="w-2 h-2 rounded-full bg-gray-400 animate-pulse" />
      Checking...
    </div>
  )
  const ok = health.ollama_running
  // pii_ner_active === false means the NER model failed to load: regex
  // classes (NRIC, phones…) still work but NAMES ARE NOT MASKED. This must
  // never be invisible to the user.
  const shieldDegraded = health.pii_ner_active === false
  return (
    <>
      {shieldDegraded && (
        <div className="flex items-center gap-2 text-xs px-4 py-2 rounded-lg mx-3 mb-1 bg-red-50 text-red-700 border border-red-200">
          <WifiOff size={12} />
          PII shield degraded — names not masked
        </div>
      )}
      <div className={`flex items-center gap-2 text-xs px-4 py-2 rounded-lg mx-3 mb-1 ${
        ok
          ? 'bg-green-50 text-green-700 border border-green-200'
          : 'bg-red-50 text-red-700 border border-red-200'
      }`}>
        {ok ? <Wifi size={12} /> : <WifiOff size={12} />}
        {ok ? 'Ollama running' : 'Ollama offline'}
      </div>
    </>
  )
}

// ── Sidebar Navigation ────────────────────────────────────────────────────────

const NAV_SECTIONS = [
  {
    heading: 'Research',
    items: [
      { to: '/',          label: 'Chat',           icon: MessageSquare },
      { to: '/summarize', label: 'Summarize',       icon: AlignLeft     },
      { to: '/upload',    label: 'Upload Cases',    icon: Upload        },
      { to: '/search',    label: 'Search Cases',    icon: Search        },
      { to: '/prompts',   label: 'Prompt Library',  icon: Library       },
    ]
  },
  {
    heading: 'Tools',
    items: [
      { to: '/contracts',  label: 'Contract Review', icon: FileText   },
      { to: '/redline',    label: 'Redlining',       icon: GitCompare },
      { to: '/bundles',    label: 'Bundle Creator',  icon: BookOpen   },
      { to: '/chronology', label: 'Chronology',      icon: Clock      },
      { to: '/drafting',   label: 'Drafting',        icon: PenTool    },
    ]
  },
  {
    heading: null,
    items: [
      { to: '/audit',    label: 'Audit Log', icon: ClipboardList },
      { to: '/help',     label: 'Help',      icon: HelpCircle   },
      { to: '/settings', label: 'Settings',  icon: Settings },
    ]
  }
]

function Sidebar({ health, caseCount }) {
  return (
    <aside className="w-56 flex-shrink-0 bg-[#0A0A0A] flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#E05A1E] flex items-center justify-center flex-shrink-0">
            <Scale size={16} className="text-white" />
          </div>
          <div>
            <div className="text-white font-semibold text-sm leading-tight">OTG Legal Box</div>
            <div className="text-white/40 text-xs">Singapore Edition</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 flex flex-col gap-4 px-3 overflow-y-auto">
        {NAV_SECTIONS.map((section, si) => (
          <div key={si}>
            {section.heading && (
              <p className="text-[#6B7280] text-[10px] font-semibold uppercase tracking-wider px-3 mb-1">
                {section.heading}
              </p>
            )}
            <div className="flex flex-col gap-0.5">
              {section.items.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors duration-150 cursor-pointer ${
                      isActive
                        ? 'bg-[#E05A1E] text-white font-semibold'
                        : 'text-white/60 hover:text-white hover:bg-[#1A1A1A]'
                    }`
                  }
                >
                  <Icon size={15} />
                  {label}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom: user avatar + case count + status */}
      <div className="border-t border-[#1A1A1A] pt-3">
        <UserAvatar />
        {typeof caseCount === 'number' && (
          <div className="px-4 py-1 text-xs text-white/40">
            {caseCount} {caseCount === 1 ? 'case' : 'cases'} indexed
          </div>
        )}
        <SidebarMeters />
        <StatusBadge health={health} />
        <div className="px-4 pb-4 mt-2 text-[10px] text-white/25 leading-relaxed">
          All data stays on your computer.
          Nothing is sent to the internet.
        </div>
      </div>
    </aside>
  )
}

// ── User Avatar / Switcher ────────────────────────────────────────────────────

function initials(name) {
  return (name || '?').split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

function UserAvatar() {
  const [users, setUsers] = useState([])
  const [current, setCurrent] = useState(null)
  const [open, setOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    api.listUsers()
      .then(data => { setUsers(data.users || []); setCurrent(data.current) })
      .catch(() => {})
  }, [])

  const currentUser = users.find(u => u.slug === current)

  const switchUser = async (slug) => {
    try {
      await api.switchUser(slug)
      setCurrent(slug)
      setOpen(false)
    } catch {}
  }

  const addUser = async () => {
    if (!newName.trim()) return
    setAdding(true)
    try {
      const data = await api.createUser({ name: newName.trim() })
      setUsers(prev => [...prev, data.user])
      setNewName('')
    } catch {} finally {
      setAdding(false)
    }
  }

  if (!currentUser) return null

  return (
    <div className="relative px-3 pb-3">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[#1A1A1A] transition-colors duration-150 cursor-pointer"
      >
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
          style={{ backgroundColor: currentUser.color || '#0A0A0A' }}
        >
          {initials(currentUser.name)}
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="text-white text-xs font-medium truncate">{currentUser.name}</p>
          <p className="text-white/40 text-[10px] truncate">{currentUser.role}</p>
        </div>
        <ChevronDown size={12} className={`text-white/40 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute bottom-full left-3 right-3 mb-1 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-10">
          <div className="py-1">
            {users.map(u => (
              <button
                key={u.slug}
                onClick={() => switchUser(u.slug)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-gray-50 transition-colors ${
                  u.slug === current ? 'bg-amber-50' : ''
                }`}
              >
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                  style={{ backgroundColor: u.color || '#0A0A0A' }}
                >
                  {initials(u.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-800 truncate">{u.name}</p>
                  <p className="text-[10px] text-gray-400">{u.role}</p>
                </div>
                {u.slug === current && <CheckCircle size={12} className="text-[#E05A1E] flex-shrink-0" />}
              </button>
            ))}
          </div>
          <div className="border-t border-gray-100 px-3 py-2">
            <div className="flex gap-1.5">
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addUser()}
                placeholder="Add user…"
                className="flex-1 text-xs border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:border-[#E05A1E]"
              />
              <button
                onClick={addUser}
                disabled={adding || !newName.trim()}
                className="text-[#0A0A0A] hover:text-[#E05A1E] disabled:opacity-40 transition-colors cursor-pointer"
              >
                <UserPlus size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Top Bar with Model Pill ───────────────────────────────────────────────────

function TopBar({ health, onOpenModels }) {
  const [profiles, setProfiles] = useState({ heavy: '', light: '' })
  const [active,   setActive]   = useState('')

  useEffect(() => {
    let cancelled = false
    const load = () =>
      api.getModelProfiles()
        .then(res => {
          if (cancelled) return
          setProfiles(res.profiles || { heavy: '', light: '' })
          setActive(res.active || '')
        })
        .catch(() => {})
    load()
    // Refresh when the modal closes (rough signal) + periodically as a safety net
    const interval = setInterval(load, 15_000)
    // Refresh when user opens/closes modal — picked up via window event
    const onModelsChanged = () => load()
    window.addEventListener('legalbox:models-changed', onModelsChanged)
    return () => {
      cancelled = true
      clearInterval(interval)
      window.removeEventListener('legalbox:models-changed', onModelsChanged)
    }
  }, [])

  const ollamaRunning = health?.ollama_running
  const heavy = profiles.heavy || active || '—'
  const light = profiles.light || active || '—'

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-2 flex items-center justify-end gap-2">
      <button
        onClick={onOpenModels}
        title="Switch between installed models for heavy and light tasks"
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200
                   hover:border-[#E05A1E] hover:bg-[#FEF3EE] transition-colors cursor-pointer"
      >
        <Cpu size={14} className="text-gray-500" />
        <span className="flex items-center gap-1 text-xs text-gray-700">
          <Zap size={11} className="text-[#E05A1E]" />
          <span className="font-medium">{heavy}</span>
        </span>
        <span className="text-gray-300">·</span>
        <span className="flex items-center gap-1 text-xs text-gray-700">
          <Feather size={11} className="text-[#0A0A0A]" />
          <span className="font-medium">{light}</span>
        </span>
        <span className={`ml-1 w-1.5 h-1.5 rounded-full ${ollamaRunning ? 'bg-green-500' : 'bg-red-500'}`} />
        <span className="text-[10px] text-gray-400 ml-0.5">Manage</span>
      </button>
    </div>
  )
}

// ── Disclaimer Banner ─────────────────────────────────────────────────────────

function DisclaimerBanner() {
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem('disclaimer_dismissed') === 'true'
  )
  if (dismissed) return null
  return (
    <div className="bg-amber-50 border-b border-amber-200 px-6 py-2 flex items-start gap-2 text-sm text-amber-800">
      <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
      <span className="flex-1">
        <strong>Important:</strong> AI output must be reviewed by a qualified lawyer.
        OTG Legal Box does not provide legal advice.
      </span>
      <button
        onClick={() => { setDismissed(true); sessionStorage.setItem('disclaimer_dismissed', 'true') }}
        className="text-amber-600 hover:text-amber-900 font-medium text-xs flex-shrink-0"
      >
        Dismiss
      </button>
    </div>
  )
}

// ── Main Layout ───────────────────────────────────────────────────────────────

function Layout() {
  const [health, setHealth] = useState(null)
  const [caseCount, setCaseCount] = useState(null)
  const [showSetup, setShowSetup] = useState(
    () => !localStorage.getItem('legalbox_v1_setup_done')
  )
  const [modelsOpen, setModelsOpen] = useState(false)

  const closeModels = () => {
    setModelsOpen(false)
    // Let the header pill refresh profile state
    window.dispatchEvent(new Event('legalbox:models-changed'))
  }

  useEffect(() => {
    const check = async () => {
      try {
        const data = await api.health()
        setHealth(data)
        setCaseCount(data.case_count)
      } catch {
        setHealth({ ollama_running: false })
      }
    }
    check()
    const interval = setInterval(check, 10_000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex min-h-screen bg-gray-50">
      {showSetup && <SetupWizard onComplete={() => setShowSetup(false)} />}
      <ModelManagerModal open={modelsOpen} onClose={closeModels} health={health} />
      <Sidebar health={health} caseCount={caseCount} />
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        <TopBar health={health} onOpenModels={() => setModelsOpen(true)} />
        <DisclaimerBanner />
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/"            element={<Chat health={health} />} />
            <Route path="/summarize"   element={<Summarize />} />
            <Route path="/upload"      element={<UploadCase onUploaded={() => setCaseCount(c => (c || 0) + 1)} />} />
            <Route path="/search"      element={<SearchCases health={health} />} />
            <Route path="/contracts"   element={<ContractReview />} />
            <Route path="/redline"     element={<Redline />} />
            <Route path="/bundles"     element={<BundleCreator />} />
            <Route path="/chronology"  element={<Chronology />} />
            <Route path="/drafting"    element={<Drafting />} />
            <Route path="/prompts"     element={<PromptLibrary />} />
            <Route path="/audit"       element={<AuditLog />} />
            <Route path="/help"        element={<Help />} />
            <Route path="/settings"    element={<SettingsPage health={health} onOpenModels={() => setModelsOpen(true)} />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Layout />
    </BrowserRouter>
  )
}
