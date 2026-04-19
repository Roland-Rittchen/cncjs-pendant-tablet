import { useState, useEffect, useCallback } from 'react'
import { Folder, File, RefreshCw, ChevronRight, Upload } from 'lucide-react'
import { useMachine } from '../store/machineStore'
import * as socket from '../lib/socket'
import { clsx } from 'clsx'

interface FileEntry {
  type: 'file' | 'dir'
  name: string
  path: string
  size?: number
}

export default function FileManager() {
  const { port, gcodeName, socketUrl } = useMachine()
  const [path, setPath] = useState('/')
  const [entries, setEntries] = useState<FileEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const loadDirectory = useCallback(async (dir: string) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${socketUrl}/api/watch/files?path=${encodeURIComponent(dir)}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      // CNCjs returns { files: [...] } or an array
      const files: FileEntry[] = Array.isArray(data) ? data : (data.files ?? data.result ?? [])
      setEntries(files)
      setPath(dir)
    } catch (err) {
      setError('Could not load file list. Check CNCjs watch directory.')
      setEntries([])
    } finally {
      setLoading(false)
    }
  }, [socketUrl])

  useEffect(() => {
    loadDirectory(path)
  }, []) // only on mount

  function handleEntry(entry: FileEntry) {
    if (entry.type === 'dir') {
      loadDirectory(entry.path)
    } else {
      // Load the file into CNCjs
      if (!port) return
      socket.command(port, 'watchdir:load', entry.path)
    }
  }

  function goUp() {
    const parent = path.split('/').slice(0, -1).join('/') || '/'
    loadDirectory(parent)
  }

  const gcodeExtensions = /\.(nc|gcode|ngc|tap|cnc|gc)$/i

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* Path breadcrumb */}
      <div className="flex items-center gap-1 px-2 py-1.5 text-xs text-slate-500 border-b border-surface-border shrink-0">
        <button onClick={() => loadDirectory('/')} className="hover:text-slate-300 transition-colors">
          root
        </button>
        {path !== '/' && path.split('/').filter(Boolean).map((seg, i, arr) => (
          <span key={i} className="flex items-center gap-1">
            <ChevronRight className="w-3 h-3" />
            <button
              onClick={() => loadDirectory('/' + arr.slice(0, i + 1).join('/'))}
              className="hover:text-slate-300 transition-colors"
            >
              {seg}
            </button>
          </span>
        ))}
        <div className="flex-1" />
        <button
          onClick={() => loadDirectory(path)}
          className="icon-btn p-1"
          title="Refresh"
          disabled={loading}
        >
          <RefreshCw className={clsx('w-3.5 h-3.5', loading && 'animate-spin')} />
        </button>
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto scrollbar-thin min-h-0">
        {error && (
          <div className="px-3 py-2 text-xs text-accent-red/70">{error}</div>
        )}

        {/* Up directory */}
        {path !== '/' && (
          <button
            onClick={goUp}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm
                       hover:bg-surface-raised transition-colors text-slate-400"
          >
            <Folder className="w-4 h-4 shrink-0" />
            <span className="font-mono">..</span>
          </button>
        )}

        {entries.length === 0 && !loading && !error && (
          <div className="px-3 py-4 text-xs text-slate-600 text-center">
            No files found
          </div>
        )}

        {entries
          .sort((a, b) => {
            if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
            return a.name.localeCompare(b.name)
          })
          .map((entry) => {
            const isGcode = entry.type === 'file' && gcodeExtensions.test(entry.name)
            const isLoaded = gcodeName === entry.path || gcodeName === entry.name
            return (
              <button
                key={entry.path}
                onClick={() => handleEntry(entry)}
                className={clsx(
                  'flex items-center gap-2 w-full px-3 py-2 text-sm text-left transition-colors',
                  isLoaded
                    ? 'bg-accent-blue/10 text-accent-blue'
                    : 'hover:bg-surface-raised text-slate-300'
                )}
              >
                {entry.type === 'dir' ? (
                  <Folder className="w-4 h-4 shrink-0 text-slate-500" />
                ) : (
                  <File className={clsx(
                    'w-4 h-4 shrink-0',
                    isGcode ? 'text-accent-blue' : 'text-slate-600'
                  )} />
                )}
                <span className="font-mono truncate text-xs">{entry.name}</span>
                {entry.size !== undefined && (
                  <span className="ml-auto text-[10px] text-slate-600 shrink-0">
                    {entry.size < 1024
                      ? `${entry.size}B`
                      : entry.size < 1024 * 1024
                        ? `${(entry.size / 1024).toFixed(1)}K`
                        : `${(entry.size / 1024 / 1024).toFixed(1)}M`}
                  </span>
                )}
              </button>
            )
          })}
      </div>
    </div>
  )
}
