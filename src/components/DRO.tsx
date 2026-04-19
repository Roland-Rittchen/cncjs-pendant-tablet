import { useState } from 'react'
import { Target, Home, Eye, EyeOff } from 'lucide-react'
import { useMachine } from '../store/machineStore'
import * as socket from '../lib/socket'
import { clsx } from 'clsx'

const AXES = ['X', 'Y', 'Z'] as const
type Axis = typeof AXES[number]

interface AxisRowProps {
  axis: Axis
  value: number
  mvalue: number
  showM: boolean
  onZero: () => void
  onGoto: () => void
  onSetValue: (v: number) => void
}

function AxisRow({ axis, value, mvalue, showM, onZero, onGoto, onSetValue }: AxisRowProps) {
  const [editing, setEditing] = useState(false)
  const [input, setInput] = useState('')

  const AXIS_COLORS: Record<Axis, string> = {
    X: 'text-accent-red',
    Y: 'text-accent-green',
    Z: 'text-accent-blue',
  }

  function startEdit() {
    setInput(value.toFixed(3))
    setEditing(true)
  }

  function commitEdit() {
    setEditing(false)
    const v = parseFloat(input)
    if (!isNaN(v)) onSetValue(v)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') commitEdit()
    if (e.key === 'Escape') setEditing(false)
  }

  return (
    <div className="flex items-center gap-2 py-2 border-b border-surface-border last:border-0">
      {/* Axis label */}
      <span className={clsx('w-5 text-sm font-bold font-mono', AXIS_COLORS[axis])}>
        {axis}
      </span>

      {/* Position value (click to edit) */}
      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            autoFocus
            type="number"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={handleKeyDown}
            className="w-full bg-surface-raised border border-accent-blue rounded px-2 py-0.5
                       font-mono text-lg text-slate-100 focus:outline-none text-right"
          />
        ) : (
          <button
            onClick={startEdit}
            className="w-full text-right font-mono text-lg font-semibold text-slate-100
                       tabular-nums hover:text-white transition-colors"
            title="Click to set value"
          >
            {value.toFixed(3)}
          </button>
        )}
        {showM && (
          <div className="text-right font-mono text-xs text-slate-500 tabular-nums">
            M: {mvalue.toFixed(3)}
          </div>
        )}
      </div>

      {/* Zero this axis */}
      <button
        onClick={onZero}
        className="jog-btn w-8 h-8 text-xs font-bold border-surface-border"
        title={`Zero ${axis} (set WCS to 0)`}
      >
        0
      </button>

      {/* Go to zero */}
      <button
        onClick={onGoto}
        className="jog-btn w-8 h-8"
        title={`Go to ${axis}=0`}
      >
        <Home className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

export default function DRO() {
  const { wpos, mpos, showMPos, modal, port, toggleMPos } = useMachine()
  const units = modal.units === 'G20' ? 'in' : 'mm'
  const isInches = modal.units === 'G20'

  function zeroAxis(axis: Axis) {
    if (!port) return
    const axisLower = axis.toLowerCase()
    // G10 L20 P0 sets WCS position (current WCS) to the given value
    socket.gcode(port, `G10 L20 P0 ${axis}0`)
  }

  function gotoAxis(axis: Axis) {
    if (!port) return
    // Rapid to axis zero, other axes unchanged — use modal motion
    socket.gcode(port, `G0 ${axis}0`)
  }

  function setAxisValue(axis: Axis, value: number) {
    if (!port) return
    socket.gcode(port, `G10 L20 P0 ${axis}${value}`)
  }

  return (
    <div className="panel flex flex-col">
      {/* Header */}
      <div className="panel-header">
        <div className="flex items-center gap-2">
          <Target className="w-3.5 h-3.5" />
          Position
          <span className="text-slate-600">({units})</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-slate-600 text-[10px]">{modal.wcs}</span>
          <button
            onClick={toggleMPos}
            className="icon-btn p-1"
            title={showMPos ? 'Hide MPos' : 'Show MPos'}
          >
            {showMPos ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Axis rows */}
      <div className="px-3 py-1">
        {AXES.map((axis) => {
          const key = axis.toLowerCase() as 'x' | 'y' | 'z'
          return (
            <AxisRow
              key={axis}
              axis={axis}
              value={wpos[key]}
              mvalue={mpos[key]}
              showM={showMPos}
              onZero={() => zeroAxis(axis)}
              onGoto={() => gotoAxis(axis)}
              onSetValue={(v) => setAxisValue(axis, v)}
            />
          )
        })}
      </div>

      {/* Zero all / Go home */}
      <div className="grid grid-cols-2 gap-2 px-3 pb-3 pt-1">
        <button
          onClick={() => {
            if (!port) return
            socket.gcode(port, 'G10 L20 P0 X0 Y0 Z0')
          }}
          className="jog-btn h-8 text-xs gap-1"
        >
          Zero All
        </button>
        <button
          onClick={() => {
            if (!port) return
            socket.gcode(port, 'G0 X0 Y0')
          }}
          className="jog-btn h-8 text-xs gap-1"
        >
          Go XY=0
        </button>
      </div>
    </div>
  )
}
