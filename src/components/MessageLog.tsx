import { useRef, useEffect } from 'react'
import { Trash2 } from 'lucide-react'
import { useMachine } from '../store/machineStore'
import { clsx } from 'clsx'

const TYPE_STYLE: Record<string, string> = {
  read: 'text-slate-300',
  write: 'text-slate-500',
  info: 'text-accent-blue',
  error: 'text-accent-red',
  alarm: 'text-accent-red font-semibold',
}

export default function MessageLog() {
  const { messages, clearMessages } = useMachine()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-2 py-1 border-b border-surface-border shrink-0">
        <span className="text-xs text-slate-500">{messages.length} messages</span>
        <button onClick={clearMessages} className="icon-btn p-1" title="Clear">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-thin font-mono text-xs p-2 space-y-0.5 min-h-0">
        {messages.length === 0 && (
          <div className="text-slate-600 text-center py-4">No messages</div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={clsx('leading-5 break-all', TYPE_STYLE[msg.type] ?? 'text-slate-400')}>
            <span className="text-slate-700 mr-1">
              {msg.type === 'write' ? '>' : msg.type === 'read' ? '<' : '•'}
            </span>
            {msg.text}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
