import { Power, Zap, Activity, Clock, Settings } from 'lucide-react'
import { useMachine } from '../store/machineStore'
import * as socket from '../lib/socket'
import { clsx } from 'clsx'

const STATE_COLORS: Record<string, string> = {
  Idle:    'bg-slate-700 text-slate-300',
  Run:     'bg-accent-green/20 text-accent-green',
  Hold:    'bg-accent-amber/20 text-accent-amber',
  Jog:     'bg-accent-blue/20 text-accent-blue',
  Alarm:   'bg-accent-red/20 text-accent-red',
  Door:    'bg-accent-amber/20 text-accent-amber',
  Home:    'bg-accent-cyan/20 text-accent-cyan',
  Sleep:   'bg-slate-700 text-slate-400',
  Unknown: 'bg-slate-800 text-slate-500',
}

const STATE_DOT: Record<string, string> = {
  Idle:    'bg-slate-400',
  Run:     'bg-accent-green animate-pulse',
  Hold:    'bg-accent-amber animate-pulse',
  Jog:     'bg-accent-blue animate-pulse',
  Alarm:   'bg-accent-red animate-pulse',
  Home:    'bg-accent-cyan animate-pulse',
  Unknown: 'bg-slate-600',
}

function formatTime(ms: number) {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  if (h > 0) return `${h}h ${m % 60}m`
  if (m > 0) return `${m}m ${s % 60}s`
  return `${s}s`
}

export default function StatusBar() {
  const {
    activeState, modal, feedrate, spindleSpeed, spindleOverride,
    port, controllerType, wpos,
    senderStatus, workflowState,
    probePanelOpen, setProbePanelOpen,
    settingsPanelOpen, setSettingsPanelOpen,
    setConnected,
  } = useMachine()

  const stateColor = STATE_COLORS[activeState] ?? STATE_COLORS.Unknown
  const stateDot = STATE_DOT[activeState] ?? STATE_DOT.Unknown
  const isRunning = workflowState === 'running'

  function handleDisconnect() {
    if (port) socket.closePort(port)
    socket.disconnect()
    setConnected(false)
  }

  return (
    <header className="flex items-center gap-3 px-3 h-12 bg-surface-raised border-b border-surface-border shrink-0">
      {/* Machine state */}
      <div className={clsx('state-badge', stateColor)}>
        <span className={clsx('w-2 h-2 rounded-full', stateDot)} />
        {activeState}
      </div>

      {/* Controller + port */}
      <span className="text-xs text-slate-500 hidden sm:block">
        {controllerType} · {port}
      </span>

      <div className="w-px h-6 bg-surface-border mx-1" />

      {/* WCS + units */}
      <span className="text-xs font-mono font-semibold text-slate-300">
        {modal.wcs}
      </span>
      <span className={clsx(
        'text-xs px-1.5 py-0.5 rounded font-semibold',
        modal.units === 'G20' ? 'bg-accent-amber/20 text-accent-amber' : 'bg-slate-700 text-slate-400'
      )}>
        {modal.units === 'G20' ? 'IN' : 'MM'}
      </span>

      <div className="w-px h-6 bg-surface-border mx-1" />

      {/* Quick position summary */}
      <div className="hidden lg:flex items-center gap-3 font-mono text-xs text-slate-400">
        <span>X<span className="text-slate-200 ml-1">{wpos.x.toFixed(3)}</span></span>
        <span>Y<span className="text-slate-200 ml-1">{wpos.y.toFixed(3)}</span></span>
        <span>Z<span className="text-slate-200 ml-1">{wpos.z.toFixed(3)}</span></span>
      </div>

      <div className="w-px h-6 bg-surface-border mx-1 hidden lg:block" />

      {/* Feed rate */}
      <div className="hidden sm:flex items-center gap-1 text-xs text-slate-400">
        <Activity className="w-3.5 h-3.5" />
        <span className="font-mono text-slate-200">{Math.round(feedrate)}</span>
        <span>{modal.units === 'G20' ? 'in/m' : 'mm/m'}</span>
      </div>

      {/* Spindle */}
      {spindleSpeed > 0 && (
        <div className="hidden sm:flex items-center gap-1 text-xs text-slate-400">
          <Zap className="w-3.5 h-3.5 text-accent-amber" />
          <span className="font-mono text-slate-200">{Math.round(spindleSpeed)}</span>
          <span>RPM</span>
          {spindleOverride !== 100 && (
            <span className="text-accent-amber">({spindleOverride}%)</span>
          )}
        </div>
      )}

      {/* Elapsed time when running */}
      {isRunning && senderStatus.elapsedTime > 0 && (
        <div className="hidden md:flex items-center gap-1 text-xs text-slate-400">
          <Clock className="w-3.5 h-3.5" />
          <span className="font-mono text-slate-200">
            {formatTime(senderStatus.elapsedTime)}
          </span>
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Probe panel toggle */}
      <button
        type="button"
        onClick={() => setProbePanelOpen(!probePanelOpen)}
        className={clsx(
          'text-xs px-2.5 py-1 rounded font-semibold transition-colors',
          probePanelOpen
            ? 'bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/30'
            : 'bg-surface-card text-slate-400 border border-surface-border hover:text-slate-200'
        )}
      >
        Probe
      </button>

      {/* Settings */}
      <button
        type="button"
        onClick={() => setSettingsPanelOpen(!settingsPanelOpen)}
        className={clsx(
          'icon-btn',
          settingsPanelOpen ? 'text-accent-blue' : 'text-slate-400 hover:text-slate-200'
        )}
        title="Connection settings"
        aria-label="Connection settings"
      >
        <Settings className="w-4 h-4" />
      </button>

      {/* Disconnect */}
      <button
        type="button"
        onClick={handleDisconnect}
        className="icon-btn text-accent-red/70 hover:text-accent-red"
        title="Disconnect"
        aria-label="Disconnect"
      >
        <Power className="w-4 h-4" />
      </button>
    </header>
  )
}
