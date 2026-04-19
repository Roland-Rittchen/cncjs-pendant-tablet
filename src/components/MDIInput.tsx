import { useState, useRef } from 'react'
import { Send } from 'lucide-react'
import { useMachine } from '../store/machineStore'
import * as socket from '../lib/socket'
import { clsx } from 'clsx'

export default function MDIInput() {
  const { port, workflowState } = useMachine()
  const [value, setValue] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [histIdx, setHistIdx] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)

  const isRunning = workflowState === 'running'

  function send() {
    const line = value.trim().toUpperCase()
    if (!line || !port) return
    socket.gcode(port, line)
    setHistory((h) => [line, ...h.slice(0, 49)])
    setValue('')
    setHistIdx(-1)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { send(); return }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHistIdx((i) => {
        const next = Math.min(i + 1, history.length - 1)
        setValue(history[next] ?? '')
        return next
      })
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHistIdx((i) => {
        const next = Math.max(i - 1, -1)
        setValue(next === -1 ? '' : (history[next] ?? ''))
        return next
      })
    }
  }

  return (
    <div className="flex-1 flex gap-1 min-w-0">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value.toUpperCase())}
        onKeyDown={onKeyDown}
        disabled={!port || isRunning}
        placeholder="G-code…"
        className="flex-1 min-w-0 h-9 bg-surface-card border border-surface-border rounded-lg px-3
                   font-mono text-sm text-slate-100 placeholder-slate-600
                   focus:outline-none focus:border-accent-blue
                   disabled:opacity-40"
      />
      <button
        type="button"
        title="Send G-code"
        aria-label="Send G-code"
        onClick={send}
        disabled={!port || !value.trim() || isRunning}
        className={clsx(
          'h-9 px-3 rounded-lg transition-all active:scale-95 shrink-0',
          'bg-accent-blue hover:bg-blue-400 text-white',
          (!port || !value.trim() || isRunning) && 'opacity-40 cursor-not-allowed active:scale-100'
        )}
      >
        <Send className="w-4 h-4" />
      </button>
    </div>
  )
}
