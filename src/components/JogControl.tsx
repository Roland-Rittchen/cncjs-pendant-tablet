import { useEffect, useState } from 'react'
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, ChevronsUp, ChevronsDown } from 'lucide-react'
import { useMachine } from '../store/machineStore'
import * as socket from '../lib/socket'
import { clsx } from 'clsx'

// Step sizes in mm / inches
const MM_STEPS = [0.01, 0.1, 1, 10, 100]
const IN_STEPS = [0.001, 0.01, 0.1, 1, 10]

// Feed rates used for jog moves
const JOG_FEED_MM = 1000   // mm/min
const JOG_FEED_IN = 40     // in/min

export default function JogControl() {
  const { port, modal, workflowState, activeState } = useMachine()
  const isInches = modal.units === 'G20'
  const steps = isInches ? IN_STEPS : MM_STEPS
  const [stepIdx, setStepIdx] = useState(2) // default 1 mm / 0.1 in

  const disabled = !port || workflowState === 'running' || activeState === 'Alarm'
  const step = steps[stepIdx]

  /**
   * Send a jog move using the Grbl/FluidNC native $J= command.
   *
   * $J= bypasses the G-code feeder, does not change modal state, and can be
   * cancelled mid-move with the real-time 0x85 byte. This is the correct way
   * to jog on Grbl 1.1 / FluidNC — never use G1 in G91 mode for jogging.
   */
  function jog(x: number, y: number, z: number) {
    if (disabled || !port) return
    const parts: string[] = []
    if (x !== 0) parts.push(`X${(x * step).toFixed(4)}`)
    if (y !== 0) parts.push(`Y${(y * step).toFixed(4)}`)
    if (z !== 0) parts.push(`Z${(z * step).toFixed(4)}`)
    if (parts.length === 0) return
    const unitCode = isInches ? 'G20' : 'G21'
    const feed = isInches ? JOG_FEED_IN : JOG_FEED_MM
    socket.writeln(port, `$J=${unitCode} G91 ${parts.join(' ')} F${feed}`)
  }

  // Keyboard jog
  useEffect(() => {
    function sendJog(x: number, y: number, z: number) {
      if (disabled || !port) return
      const parts: string[] = []
      if (x !== 0) parts.push(`X${(x * step).toFixed(4)}`)
      if (y !== 0) parts.push(`Y${(y * step).toFixed(4)}`)
      if (z !== 0) parts.push(`Z${(z * step).toFixed(4)}`)
      if (parts.length === 0) return
      const unitCode = isInches ? 'G20' : 'G21'
      const feed = isInches ? JOG_FEED_IN : JOG_FEED_MM
      socket.writeln(port, `$J=${unitCode} G91 ${parts.join(' ')} F${feed}`)
    }

    function onKeyDown(e: KeyboardEvent) {
      if ((e.target as HTMLElement).tagName === 'INPUT') return
      if (disabled) return
      const mult = e.shiftKey ? 10 : e.altKey ? 0.1 : 1
      switch (e.key) {
        case 'ArrowLeft':  e.preventDefault(); sendJog(-1 * mult, 0, 0); break
        case 'ArrowRight': e.preventDefault(); sendJog( 1 * mult, 0, 0); break
        case 'ArrowUp':    e.preventDefault(); sendJog(0,  1 * mult, 0); break
        case 'ArrowDown':  e.preventDefault(); sendJog(0, -1 * mult, 0); break
        case 'PageUp':     e.preventDefault(); sendJog(0, 0,  1 * mult); break
        case 'PageDown':   e.preventDefault(); sendJog(0, 0, -1 * mult); break
        case '+': case '=': setStepIdx((i) => Math.min(i + 1, steps.length - 1)); break
        case '-': case '_': setStepIdx((i) => Math.max(i - 1, 0)); break
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [disabled, port, step, isInches, steps.length])

  const btnCls = clsx('jog-btn', disabled && 'opacity-30 cursor-not-allowed')

  return (
    <div className={clsx('panel flex flex-col gap-3 p-3', disabled && 'opacity-70')}>
      {/* Step selector */}
      <div>
        <div className="text-xs text-slate-500 mb-1.5">Step ({isInches ? 'in' : 'mm'})</div>
        <div className="flex gap-1">
          {steps.map((s, i) => (
            <button
              key={s}
              type="button"
              onClick={() => setStepIdx(i)}
              className={clsx(
                'flex-1 h-7 rounded text-xs font-semibold transition-colors',
                i === stepIdx
                  ? 'bg-accent-blue text-white'
                  : 'bg-surface-raised text-slate-400 hover:text-slate-200 border border-surface-border'
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* XY jog pad + Z buttons */}
      <div className="flex gap-2">
        {/* XY pad (3×3 grid) */}
        <div className="flex-1 grid grid-cols-3 grid-rows-3 gap-1">
          <div />
          <button type="button" title="Y+" aria-label="Jog Y+" className={clsx(btnCls, 'h-12 w-full')} onClick={() => jog(0, 1, 0)}>
            <ArrowUp className="w-5 h-5" />
          </button>
          <div />

          <button type="button" title="X-" aria-label="Jog X-" className={clsx(btnCls, 'h-12 w-full')} onClick={() => jog(-1, 0, 0)}>
            <ArrowLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            title="Go to X0 Y0"
            aria-label="Go to X0 Y0"
            onClick={() => { if (port) socket.gcode(port, 'G0 X0 Y0') }}
            className={clsx(btnCls, 'h-12 w-full text-xs text-slate-500')}
          >
            ⌂
          </button>
          <button type="button" title="X+" aria-label="Jog X+" className={clsx(btnCls, 'h-12 w-full')} onClick={() => jog(1, 0, 0)}>
            <ArrowRight className="w-5 h-5" />
          </button>

          <div />
          <button type="button" title="Y-" aria-label="Jog Y-" className={clsx(btnCls, 'h-12 w-full')} onClick={() => jog(0, -1, 0)}>
            <ArrowDown className="w-5 h-5" />
          </button>
          <div />
        </div>

        {/* Z axis */}
        <div className="flex flex-col gap-1 w-12">
          <button type="button" className={clsx(btnCls, 'h-12 w-full flex-col gap-0.5')} onClick={() => jog(0, 0, 1)}>
            <ChevronsUp className="w-4 h-4" />
            <span className="text-[10px] text-slate-500">Z+</span>
          </button>
          <div className="flex-1 flex items-center justify-center text-xs font-bold text-slate-500">Z</div>
          <button type="button" className={clsx(btnCls, 'h-12 w-full flex-col gap-0.5')} onClick={() => jog(0, 0, -1)}>
            <span className="text-[10px] text-slate-500">Z-</span>
            <ChevronsDown className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Keyboard hint */}
      <div className="text-[10px] text-slate-600 text-center">
        ↑↓←→ jog XY · PgUp/Dn jog Z · Shift=×10 · Alt=×0.1 · +/- step
      </div>
    </div>
  )
}
