import { Minus, Plus } from 'lucide-react'
import { useMachine } from '../store/machineStore'
import * as socket from '../lib/socket'
import { clsx } from 'clsx'

interface OverridePillProps {
  label: string
  value: number
  onDelta: (delta: number) => void
  accentClass: string
}

function OverridePill({ label, value, onDelta, accentClass }: OverridePillProps) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[10px] text-slate-500 w-8 shrink-0">{label}</span>
      <button
        onClick={() => onDelta(-10)}
        className="icon-btn p-1 h-7 w-7 text-slate-500 hover:text-slate-200"
      >
        <Minus className="w-3 h-3" />
      </button>
      <div className={clsx(
        'min-w-[3rem] text-center text-xs font-mono font-semibold px-2 py-1 rounded',
        value !== 100 ? accentClass : 'text-slate-400'
      )}>
        {value}%
      </div>
      <button
        onClick={() => onDelta(10)}
        className="icon-btn p-1 h-7 w-7 text-slate-500 hover:text-slate-200"
      >
        <Plus className="w-3 h-3" />
      </button>
      {value !== 100 && (
        <button
          onClick={() => onDelta(100 - value)}
          className="text-[10px] text-slate-600 hover:text-slate-400 transition-colors px-1"
          title="Reset to 100%"
        >
          ⟳
        </button>
      )}
    </div>
  )
}

export default function OverrideControls() {
  const { feedOverride, rapidOverride, spindleOverride, port } = useMachine()

  function adjustFeed(delta: number) {
    if (!port) return
    // CNCjs feedOverride command expects a percentage delta from current
    socket.command(port, 'feedOverride', delta)
  }

  function adjustRapid(delta: number) {
    if (!port) return
    socket.command(port, 'rapidOverride', delta)
  }

  function adjustSpindle(delta: number) {
    if (!port) return
    socket.command(port, 'spindleOverride', delta)
  }

  return (
    <div className="flex items-center gap-3">
      <OverridePill
        label="Feed"
        value={feedOverride}
        onDelta={adjustFeed}
        accentClass="text-accent-amber"
      />
      <OverridePill
        label="Rapid"
        value={rapidOverride}
        onDelta={adjustRapid}
        accentClass="text-accent-cyan"
      />
      <OverridePill
        label="Spin"
        value={spindleOverride}
        onDelta={adjustSpindle}
        accentClass="text-accent-purple"
      />
    </div>
  )
}
