import { useEffect, useRef } from 'react'
import { useMachine } from '../store/machineStore'
import { clsx } from 'clsx'

export default function GCodeViewer() {
  const { gcodeLines, currentLine, gcodeName } = useMachine()
  const listRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to current line
  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
  }, [currentLine])

  if (gcodeLines.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-xs text-slate-600">
        No G-code loaded
      </div>
    )
  }

  return (
    <div ref={listRef} className="h-full overflow-y-auto scrollbar-thin font-mono text-xs">
      {gcodeLines.map((line, i) => {
        const lineNum = i + 1
        const isActive = lineNum === currentLine
        const isComment = /^\s*;|^\s*\(/.test(line)
        const isEmpty = !line.trim()
        return (
          <div
            key={i}
            ref={isActive ? activeRef : undefined}
            className={clsx(
              'flex items-start gap-2 px-2 py-px leading-5',
              isActive && 'bg-accent-blue/20 text-accent-blue',
              !isActive && isComment && 'text-slate-600',
              !isActive && !isComment && !isEmpty && 'text-slate-300',
              !isActive && isEmpty && 'text-transparent'
            )}
          >
            <span className="shrink-0 w-8 text-right text-slate-600 select-none">
              {lineNum}
            </span>
            <span className="flex-1 truncate">{line || ' '}</span>
          </div>
        )
      })}
    </div>
  )
}
