import { Play, Pause, Square, RotateCcw } from 'lucide-react'
import { useMachine } from '../store/machineStore'
import * as socket from '../lib/socket'
import { clsx } from 'clsx'

function formatTime(ms: number) {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  if (h > 0) return `${String(h).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

export default function ProgramControls() {
  const { workflowState, port, gcodeName, senderStatus, activeState } = useMachine()

  const isIdle = workflowState === 'idle'
  const isRunning = workflowState === 'running'
  const isPaused = workflowState === 'paused'
  const hasFile = Boolean(gcodeName)
  const isAlarm = activeState === 'Alarm'

  function start() {
    if (!port) return
    if (isPaused) socket.command(port, 'gcode:resume')
    else socket.command(port, 'gcode:start')
  }

  function pause() {
    if (!port) return
    socket.command(port, 'gcode:pause')
  }

  function stop() {
    if (!port) return
    socket.command(port, 'gcode:stop', { force: true })
  }

  function reload() {
    if (!port || !gcodeName) return
    socket.command(port, 'watchdir:load', gcodeName)
  }

  const progress = senderStatus.total > 0
    ? Math.round((senderStatus.received / senderStatus.total) * 100)
    : 0

  return (
    <div className="flex items-center gap-2">
      {/* Start / Resume */}
      <button
        onClick={start}
        disabled={isAlarm || isRunning || (!hasFile && !isPaused)}
        className={clsx(
          'flex items-center justify-center gap-1.5 h-10 px-4 rounded-lg font-semibold text-sm',
          'transition-all active:scale-95',
          isPaused
            ? 'bg-accent-amber hover:bg-amber-400 text-black'
            : 'bg-accent-green hover:bg-green-400 text-black',
          (isAlarm || isRunning || (!hasFile && !isPaused)) &&
            'opacity-40 cursor-not-allowed active:scale-100'
        )}
      >
        <Play className="w-4 h-4 fill-current" />
        {isPaused ? 'Resume' : 'Start'}
      </button>

      {/* Pause */}
      <button
        onClick={pause}
        disabled={!isRunning}
        className={clsx(
          'flex items-center justify-center gap-1.5 h-10 px-3 rounded-lg font-semibold text-sm',
          'transition-all active:scale-95',
          'bg-surface-card border border-surface-border text-slate-300 hover:border-accent-amber hover:text-accent-amber',
          !isRunning && 'opacity-40 cursor-not-allowed active:scale-100'
        )}
      >
        <Pause className="w-4 h-4" />
      </button>

      {/* Stop */}
      <button
        onClick={stop}
        disabled={isIdle && !hasFile}
        className={clsx(
          'flex items-center justify-center gap-1.5 h-10 px-3 rounded-lg font-semibold text-sm',
          'transition-all active:scale-95',
          'bg-surface-card border border-surface-border text-slate-300 hover:border-accent-red hover:text-accent-red',
          isIdle && !hasFile && 'opacity-40 cursor-not-allowed active:scale-100'
        )}
      >
        <Square className="w-4 h-4" />
      </button>

      {/* Reload file */}
      {hasFile && isIdle && (
        <button
          onClick={reload}
          className="flex items-center justify-center h-10 px-2.5 rounded-lg
                     bg-surface-card border border-surface-border text-slate-400
                     hover:text-slate-200 transition-colors active:scale-95"
          title="Reload file"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      )}

      {/* Progress info */}
      {(isRunning || isPaused) && senderStatus.total > 0 && (
        <div className="flex flex-col min-w-[80px]">
          <div className="flex justify-between text-xs text-slate-400">
            <span>{progress}%</span>
            <span className="font-mono">{formatTime(senderStatus.elapsedTime)}</span>
          </div>
          <div className="h-1 bg-surface-raised rounded-full overflow-hidden mt-0.5">
            <div
              className={clsx(
                'h-full rounded-full transition-all',
                isPaused ? 'bg-accent-amber' : 'bg-accent-green'
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
