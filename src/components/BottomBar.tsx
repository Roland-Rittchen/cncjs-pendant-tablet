import { Home, Unlock, RotateCcw } from 'lucide-react'
import { useMachine } from '../store/machineStore'
import * as socket from '../lib/socket'
import MDIInput from './MDIInput'
import ProgramControls from './ProgramControls'
import OverrideControls from './OverrideControls'
import { clsx } from 'clsx'

const QUICK = [
  { label: 'Home',   icon: Home,       cmd: 'homing', title: 'Home all axes'        },
  { label: 'Unlock', icon: Unlock,     cmd: 'unlock', title: 'Unlock / clear alarm' },
  { label: 'Reset',  icon: RotateCcw,  cmd: 'reset',  title: 'Soft reset'           },
] as const

export default function BottomBar() {
  const { port, workflowState } = useMachine()
  const isRunning = workflowState === 'running'

  function quickCmd(cmd: string) {
    if (!port) return
    socket.command(port, cmd)
  }

  return (
    <footer className="flex flex-col bg-surface-raised border-t border-surface-border shrink-0">

      {/* ── Row 1: quick actions + MDI + program controls ─────────── */}
      <div className="flex items-center gap-2 px-3 h-11 border-b border-surface-border">

        {/* Quick actions — icon-only to save horizontal space */}
        {QUICK.map(({ label, icon: Icon, cmd, title }) => (
          <button
            key={cmd}
            onClick={() => quickCmd(cmd)}
            disabled={!port || isRunning}
            title={title}
            type="button"
            className={clsx(
              'icon-btn w-9 h-9 shrink-0',
              (!port || isRunning) && 'opacity-30 cursor-not-allowed'
            )}
            aria-label={label}
          >
            <Icon className="w-4 h-4" />
          </button>
        ))}

        <div className="w-px h-6 bg-surface-border shrink-0" />

        {/* MDI input (flex-1 to absorb remaining space) */}
        <MDIInput />

        <div className="w-px h-6 bg-surface-border shrink-0" />

        {/* Start / Pause / Stop */}
        <ProgramControls />
      </div>

      {/* ── Row 2: overrides ──────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-3 h-9">
        <OverrideControls />
      </div>

    </footer>
  )
}
