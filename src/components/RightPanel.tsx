import { useState } from 'react'
import { FolderOpen, Code2, MessageSquare } from 'lucide-react'
import FileManager from './FileManager'
import GCodeViewer from './GCodeViewer'
import MessageLog from './MessageLog'
import { useMachine } from '../store/machineStore'
import { clsx } from 'clsx'

type Tab = 'files' | 'gcode' | 'messages'

export default function RightPanel() {
  const [tab, setTab] = useState<Tab>('files')
  const messages = useMachine((s) => s.messages)
  const errors = messages.filter((m) => m.type === 'alarm' || m.type === 'error')

  return (
    <div className="panel h-full flex flex-col min-h-0">
      {/* Tab bar */}
      <div className="flex gap-1 p-1.5 border-b border-surface-border shrink-0">
        <button
          onClick={() => setTab('files')}
          className={clsx('tab-btn flex items-center justify-center gap-1', tab === 'files' && 'active')}
        >
          <FolderOpen className="w-3.5 h-3.5" />
          Files
        </button>
        <button
          onClick={() => setTab('gcode')}
          className={clsx('tab-btn flex items-center justify-center gap-1', tab === 'gcode' && 'active')}
        >
          <Code2 className="w-3.5 h-3.5" />
          G-Code
        </button>
        <button
          onClick={() => setTab('messages')}
          className={clsx(
            'tab-btn flex items-center justify-center gap-1 relative',
            tab === 'messages' && 'active'
          )}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          Log
          {errors.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-accent-red rounded-full" />
          )}
        </button>
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {tab === 'files' && <FileManager />}
        {tab === 'gcode' && <GCodeViewer />}
        {tab === 'messages' && <MessageLog />}
      </div>
    </div>
  )
}
