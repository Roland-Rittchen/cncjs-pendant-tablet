import { useState, useEffect } from 'react'
import { X, Crosshair, ArrowDown, AlertTriangle, CheckCircle, Info } from 'lucide-react'
import { useMachine } from '../store/machineStore'
import * as socket from '../lib/socket'
import { clsx } from 'clsx'
import type { ProbeSettings } from '../types'

type ProbeStatus = 'idle' | 'probing' | 'success' | 'error'

// ── Z Probe G-code sequence ───────────────────────────────────────────────────
// Uses G38.2 (probe toward workpiece, error if no contact)
// G10 L20 P0 sets WCS to specified value
function buildZProbeGCode(s: ProbeSettings, units: 'G20' | 'G21') {
  const isInch = units === 'G20'
  const thick = s.plateThickness
  const depth = isInch ? -(s.probeDepth / 25.4) : -s.probeDepth
  const retract = isInch ? (s.retractHeight / 25.4) : s.retractHeight
  const feedFast = isInch ? Math.round(s.feedFast / 25.4) : s.feedFast
  const feedSlow = isInch ? Math.round(s.feedSlow / 25.4) : s.feedSlow
  const plateVal = isInch ? (thick / 25.4).toFixed(4) : thick.toFixed(3)
  const retractStr = retract.toFixed(3)

  return [
    '; === Z PROBE START ===',
    'G91',                                          // relative mode
    `G38.2 Z${depth.toFixed(3)} F${feedFast}`,     // fast probe
    `G0 Z${(retract * 0.5).toFixed(3)}`,            // partial retract
    `G38.2 Z${(depth * 0.2).toFixed(3)} F${feedSlow}`, // slow probe
    `G10 L20 P0 Z${plateVal}`,                      // set WCS Z = plate thickness
    `G0 Z${retractStr}`,                            // lift to safe height
    'G90',                                          // back to absolute
    '; === Z PROBE END ===',
  ]
}

// ── Corner probe sequence (X/Y) ───────────────────────────────────────────────
type Corner = 'BL' | 'BR' | 'TR' | 'TL'

function buildCornerProbeGCode(corner: Corner, probeDepth: number, feedFast: number) {
  // Probe X first, then Y, both toward center
  const xDir = (corner === 'BL' || corner === 'TL') ? 1 : -1
  const yDir = (corner === 'BL' || corner === 'BR') ? 1 : -1
  const d = probeDepth.toFixed(3)
  const f = feedFast
  return [
    '; === CORNER PROBE START ===',
    'G91',
    `G38.2 X${(xDir * 20).toFixed(3)} F${f}`, // probe X
    'G0 X-2',                                    // retract slightly
    `G38.2 X${(xDir * 5).toFixed(3)} F${Math.round(f * 0.2)}`, // fine probe X
    'G10 L20 P0 X0',                             // set X=0
    'G0 X5',                                     // clear
    `G38.2 Y${(yDir * 20).toFixed(3)} F${f}`, // probe Y
    'G0 Y-2',
    `G38.2 Y${(yDir * 5).toFixed(3)} F${Math.round(f * 0.2)}`, // fine probe Y
    'G10 L20 P0 Y0',                             // set Y=0
    'G0 Y5',
    'G90',
    '; === CORNER PROBE END ===',
  ]
}

export default function ProbePanel() {
  const {
    probePanelOpen, setProbePanelOpen,
    probeSettings, updateProbeSettings,
    port, modal, workflowState, wpos,
    addMessage, probing, setProbing,
  } = useMachine()

  const [status, setStatus] = useState<ProbeStatus>('idle')
  const [resultZ, setResultZ] = useState<number | null>(null)
  const [selectedCorner, setSelectedCorner] = useState<Corner>('BL')

  // Detect probe completion via workflow:state returning to idle
  useEffect(() => {
    if (probing && workflowState === 'idle') {
      setStatus('success')
      setResultZ(wpos.z)
      setProbing(false)
      addMessage('Probe cycle complete', 'info')
    }
  }, [workflowState, probing])

  function startZProbe() {
    if (!port) return
    setStatus('probing')
    setResultZ(null)
    setProbing(true)

    const lines = buildZProbeGCode(probeSettings, modal.units)
    // Send as a loaded gcode sequence via feeder
    lines.forEach((line) => {
      if (!line.startsWith(';')) socket.gcode(port, line)
    })
    addMessage('Starting Z probe cycle…', 'info')
  }

  function startCornerProbe() {
    if (!port) return
    setStatus('probing')
    setProbing(true)
    const lines = buildCornerProbeGCode(selectedCorner, probeSettings.probeDepth, probeSettings.feedFast)
    lines.forEach((line) => {
      if (!line.startsWith(';')) socket.gcode(port, line)
    })
    addMessage(`Starting ${selectedCorner} corner probe…`, 'info')
  }

  function cancelProbe() {
    if (!port) return
    socket.command(port, 'gcode:stop', { force: true })
    setProbing(false)
    setStatus('idle')
  }

  if (!probePanelOpen) return null

  const isRunning = status === 'probing'
  const canProbe = !isRunning && !!port && workflowState !== 'running'

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
        onClick={() => !isRunning && setProbePanelOpen(false)}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-96 bg-surface-card border-l border-surface-border
                      shadow-2xl z-50 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-border shrink-0">
          <Crosshair className="w-5 h-5 text-accent-cyan" />
          <h2 className="font-semibold text-slate-200">Probing</h2>
          {!isRunning && (
            <button
              onClick={() => setProbePanelOpen(false)}
              className="ml-auto icon-btn"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-5">

          {/* Status indicator */}
          {status !== 'idle' && (
            <div className={clsx(
              'flex items-center gap-2 p-3 rounded-lg text-sm',
              status === 'probing' && 'bg-accent-cyan/10 border border-accent-cyan/30 text-accent-cyan',
              status === 'success' && 'bg-accent-green/10 border border-accent-green/30 text-accent-green',
              status === 'error' && 'bg-accent-red/10 border border-accent-red/30 text-accent-red',
            )}>
              {status === 'probing' && (
                <>
                  <ArrowDown className="w-4 h-4 animate-bounce" />
                  Probing in progress… do not touch the machine.
                </>
              )}
              {status === 'success' && (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>
                    Probe complete!
                    {resultZ !== null && (
                      <span className="font-mono ml-2">Z = {resultZ.toFixed(3)}</span>
                    )}
                  </span>
                </>
              )}
              {status === 'error' && (
                <>
                  <AlertTriangle className="w-4 h-4" />
                  Probe failed — no contact or alarm. Check setup.
                </>
              )}
            </div>
          )}

          {/* ── Z Probe section ──────────────────────────────────── */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <ArrowDown className="w-4 h-4 text-accent-blue" />
              Z Probe (Touch Plate)
            </h3>

            <div className="bg-surface-raised rounded-lg p-3 space-y-3">
              <SettingRow
                label="Plate thickness"
                unit={modal.units === 'G20' ? 'in' : 'mm'}
                value={probeSettings.plateThickness}
                onChange={(v) => updateProbeSettings({ plateThickness: v })}
                step={0.01}
                min={0}
                max={100}
              />
              <SettingRow
                label="Max probe depth"
                unit={modal.units === 'G20' ? 'in' : 'mm'}
                value={probeSettings.probeDepth}
                onChange={(v) => updateProbeSettings({ probeDepth: v })}
                step={1}
                min={1}
                max={200}
              />
              <SettingRow
                label="Fast feed"
                unit="mm/min"
                value={probeSettings.feedFast}
                onChange={(v) => updateProbeSettings({ feedFast: v })}
                step={10}
                min={1}
                max={500}
              />
              <SettingRow
                label="Slow feed"
                unit="mm/min"
                value={probeSettings.feedSlow}
                onChange={(v) => updateProbeSettings({ feedSlow: v })}
                step={5}
                min={1}
                max={100}
              />
              <SettingRow
                label="Retract height"
                unit={modal.units === 'G20' ? 'in' : 'mm'}
                value={probeSettings.retractHeight}
                onChange={(v) => updateProbeSettings({ retractHeight: v })}
                step={1}
                min={0}
                max={50}
              />
            </div>

            <div className="bg-surface-raised rounded-lg p-3 text-xs text-slate-500 space-y-1">
              <p className="flex items-start gap-1.5">
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-accent-cyan" />
                Place the touch plate on the workpiece surface. The probe will descend, contact,
                and set Z = plate thickness in the current WCS ({modal.wcs}).
              </p>
            </div>

            <div className="flex gap-2">
              {isRunning ? (
                <button
                  onClick={cancelProbe}
                  className="flex-1 h-11 rounded-lg font-semibold text-sm
                             bg-accent-red/20 border border-accent-red/30 text-accent-red
                             hover:bg-accent-red/30 transition-colors"
                >
                  Cancel Probe
                </button>
              ) : (
                <button
                  onClick={startZProbe}
                  disabled={!canProbe}
                  className={clsx(
                    'flex-1 h-11 rounded-lg font-semibold text-sm transition-all active:scale-98',
                    'bg-accent-cyan hover:bg-cyan-400 text-black',
                    !canProbe && 'opacity-40 cursor-not-allowed active:scale-100'
                  )}
                >
                  Probe Z
                </button>
              )}
            </div>
          </section>

          {/* ── Corner Probe section ─────────────────────────────── */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <Crosshair className="w-4 h-4 text-accent-purple" />
              Corner Probe (XY Zero)
            </h3>

            <div className="bg-surface-raised rounded-lg p-3 space-y-3">
              {/* Corner selector */}
              <div className="space-y-1">
                <label className="text-xs text-slate-500">Probe corner</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {(['TL', 'TR', 'BL', 'BR'] as Corner[]).map((c) => (
                    <button
                      key={c}
                      onClick={() => setSelectedCorner(c)}
                      className={clsx(
                        'py-2 rounded text-xs font-semibold transition-colors',
                        c === selectedCorner
                          ? 'bg-accent-purple/20 border border-accent-purple/40 text-accent-purple'
                          : 'bg-surface-card border border-surface-border text-slate-400 hover:text-slate-200'
                      )}
                    >
                      {{ TL: '↖ Top Left', TR: '↗ Top Right', BL: '↙ Bot Left', BR: '↘ Bot Right' }[c]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              {isRunning ? (
                <button
                  onClick={cancelProbe}
                  className="flex-1 h-11 rounded-lg font-semibold text-sm
                             bg-accent-red/20 border border-accent-red/30 text-accent-red
                             hover:bg-accent-red/30 transition-colors"
                >
                  Cancel Probe
                </button>
              ) : (
                <button
                  onClick={startCornerProbe}
                  disabled={!canProbe}
                  className={clsx(
                    'flex-1 h-11 rounded-lg font-semibold text-sm transition-all active:scale-98',
                    'bg-accent-purple/20 border border-accent-purple/40 text-accent-purple',
                    'hover:bg-accent-purple/30',
                    !canProbe && 'opacity-40 cursor-not-allowed active:scale-100'
                  )}
                >
                  Probe {selectedCorner} Corner
                </button>
              )}
            </div>
          </section>
        </div>
      </div>
    </>
  )
}

// ── Setting row ───────────────────────────────────────────────────────────────
interface SettingRowProps {
  label: string
  unit: string
  value: number
  onChange: (v: number) => void
  step: number
  min: number
  max: number
}

function SettingRow({ label, unit, value, onChange, step, min, max }: SettingRowProps) {
  return (
    <div className="flex items-center justify-between gap-2">
      <label className="text-xs text-slate-400 flex-1">{label}</label>
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={value}
          onChange={(e) => {
            const v = parseFloat(e.target.value)
            if (!isNaN(v) && v >= min && v <= max) onChange(v)
          }}
          step={step}
          min={min}
          max={max}
          className="w-20 bg-surface-card border border-surface-border rounded px-2 py-1
                     text-xs font-mono text-right text-slate-100
                     focus:outline-none focus:border-accent-blue"
        />
        <span className="text-xs text-slate-600 w-10">{unit}</span>
      </div>
    </div>
  )
}
