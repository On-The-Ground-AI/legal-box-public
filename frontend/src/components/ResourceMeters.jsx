// ResourceMeters.jsx — live CPU / RAM / GPU usage widgets.
//
// Two exports:
//   <SystemResources />   full panel for the Settings page
//   <SidebarMeters />     compact CPU/RAM bars for the sidebar
//
// Both poll GET /api/system/usage (server-side cached ~2s) and degrade
// silently if the endpoint is unavailable (e.g. Ollama down mid-poll).

import React, { useState, useEffect, useRef } from 'react'
import { Cpu, MemoryStick, HardDrive, Zap } from 'lucide-react'
import { api } from '../api'

function useUsage(intervalMs) {
  const [usage, setUsage] = useState(null)
  const [failed, setFailed] = useState(false)
  const timer = useRef(null)

  useEffect(() => {
    let alive = true
    const tick = async () => {
      try {
        const data = await api.getSystemUsage()
        if (alive) { setUsage(data); setFailed(false) }
      } catch {
        if (alive) setFailed(true)
      }
    }
    tick()
    timer.current = setInterval(tick, intervalMs)
    return () => { alive = false; clearInterval(timer.current) }
  }, [intervalMs])

  return { usage, failed }
}

function barColor(pct) {
  if (pct >= 90) return '#DC2626'   // red
  if (pct >= 70) return '#E05A1E'   // brand orange
  return '#16A34A'                  // green
}

function Meter({ icon: Icon, label, percent, detail }) {
  const pct = Math.max(0, Math.min(100, percent ?? 0))
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-gray-600">
          <Icon size={13} /> {label}
        </span>
        <span className="text-gray-500 tabular-nums">{detail}</span>
      </div>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: barColor(pct) }}
        />
      </div>
    </div>
  )
}

// Full panel for Settings
export function SystemResources() {
  const { usage, failed } = useUsage(3000)

  if (failed && !usage) {
    return <p className="text-sm text-gray-400">Resource usage is unavailable right now.</p>
  }
  if (!usage) {
    return <p className="text-sm text-gray-400">Reading system usage…</p>
  }

  const gpu = usage.gpu || {}
  return (
    <div className="flex flex-col gap-4">
      <Meter
        icon={Cpu} label="CPU"
        percent={usage.cpu_percent}
        detail={`${Math.round(usage.cpu_percent)}% · ${usage.cpu_count} cores`}
      />
      <Meter
        icon={MemoryStick} label="Memory"
        percent={usage.ram_percent}
        detail={`${usage.ram_used_gb} / ${usage.ram_total_gb} GB`}
      />
      <Meter
        icon={HardDrive} label="Disk"
        percent={usage.disk_percent}
        detail={`${usage.disk_free_gb} GB free`}
      />
      {gpu.type === 'nvidia' && (
        <Meter
          icon={Zap} label="GPU"
          percent={gpu.util_percent}
          detail={`${Math.round(gpu.util_percent)}% · ${Math.round(gpu.vram_used_mb / 1024)} / ${Math.round(gpu.vram_total_mb / 1024)} GB VRAM`}
        />
      )}
      {gpu.type === 'apple_silicon' && (
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <Zap size={13} /> GPU: Apple Silicon (unified memory — see Memory above)
        </div>
      )}

      {usage.loaded_models?.length > 0 ? (
        <div className="flex flex-wrap gap-2 pt-1">
          {usage.loaded_models.map(m => (
            <span key={m.name}
              className="text-xs bg-[#FEF3EE] text-[#E05A1E] border border-[#E05A1E]/20 rounded-full px-2.5 py-1">
              {m.name} loaded · {m.vram_gb > 0 ? `${m.vram_gb} GB VRAM` : `${m.size_gb} GB`}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-400">No model currently loaded in memory.</p>
      )}
    </div>
  )
}

// Compact sidebar version — just CPU + RAM, hidden on error
export function SidebarMeters() {
  const { usage } = useUsage(5000)
  if (!usage) return null

  const rows = [
    { label: 'CPU', pct: usage.cpu_percent },
    { label: 'RAM', pct: usage.ram_percent },
  ]
  return (
    <div className="px-4 py-2 flex flex-col gap-1.5">
      {rows.map(r => (
        <div key={r.label} className="flex items-center gap-2">
          <span className="text-[10px] text-white/40 w-7">{r.label}</span>
          <div className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.max(0, Math.min(100, r.pct))}%`, backgroundColor: barColor(r.pct) }} />
          </div>
          <span className="text-[10px] text-white/40 w-8 text-right tabular-nums">
            {Math.round(r.pct)}%
          </span>
        </div>
      ))}
    </div>
  )
}
