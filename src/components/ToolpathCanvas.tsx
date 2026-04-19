import { useEffect, useRef, useCallback } from 'react'
import { useMachine } from '../store/machineStore'
import { renderToolpath } from '../lib/toolpath'

export default function ToolpathCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const { toolpath, wpos, gcodeName, senderStatus, currentLine, gcodeLines } = useMachine()

  const render = useCallback(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container || !toolpath) return

    const dpr = window.devicePixelRatio || 1
    const { width, height } = container.getBoundingClientRect()

    // Update canvas resolution
    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    renderToolpath(ctx, toolpath, {
      toolX: wpos.x,
      toolY: wpos.y,
      width,
      height,
      dpr,
    })
  }, [toolpath, wpos])

  // Re-render on toolpath or position change
  useEffect(() => {
    render()
  }, [render])

  // Handle resize
  useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver(() => render())
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [render])

  const progress = senderStatus.total > 0
    ? Math.round((senderStatus.received / senderStatus.total) * 100)
    : 0

  return (
    <div className="panel h-full flex flex-col">
      {/* Header */}
      <div className="panel-header shrink-0">
        <span className="truncate max-w-[60%]">
          {gcodeName ?? 'No file loaded'}
        </span>
        <div className="flex items-center gap-3 text-slate-500">
          {senderStatus.total > 0 && (
            <span className="font-mono">
              {currentLine}/{senderStatus.total}
            </span>
          )}
        </div>
      </div>

      {/* Canvas area */}
      <div ref={containerRef} className="flex-1 relative min-h-0">
        {!toolpath ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-600">
            <svg viewBox="0 0 24 24" className="w-12 h-12 opacity-20" fill="none" stroke="currentColor" strokeWidth="1">
              <path d="M3 17l4-4 4 4 4-8 4 4" />
            </svg>
            <span className="text-sm">Load a G-code file to see toolpath</span>
          </div>
        ) : (
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
        )}
      </div>

      {/* Progress bar */}
      {senderStatus.total > 0 && (
        <div className="shrink-0 px-3 pb-2 pt-1">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>{progress}%</span>
            {senderStatus.remainingTime > 0 && (
              <span>{Math.ceil(senderStatus.remainingTime / 1000)}s remaining</span>
            )}
          </div>
          <div className="h-1.5 bg-surface-raised rounded-full overflow-hidden">
            <div
              className="h-full bg-accent-blue rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
