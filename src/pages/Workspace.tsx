import { useEffect, useRef } from 'react'
import { useMachine } from '../store/machineStore'
import type { MachineStore } from '../store/machineStore'
import * as socket from '../lib/socket'
import { buildToolpath } from '../lib/toolpath'
import type { ActiveState, PortInfo, WorkflowState } from '../types'

import StatusBar from '../components/StatusBar'
import DRO from '../components/DRO'
import JogControl from '../components/JogControl'
import ToolpathCanvas from '../components/ToolpathCanvas'
import RightPanel from '../components/RightPanel'
import BottomBar from '../components/BottomBar'
import ProbePanel from '../components/ProbePanel'
import SettingsPanel from '../components/SettingsPanel'

export default function Workspace() {
  const store = useMachine()
  const toolpathBuildRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const connectingRef = useRef(false)

  // ── Auto-connect on mount using stored / env settings ─────────────────────
  useEffect(() => {
    if (connectingRef.current || socket.isConnected()) return
    connectingRef.current = true

    const { socketUrl, port, baudrate, controllerType } = useMachine.getState()

    socket.connect(socketUrl)
      .then(() => {
        socket.listPorts()
        if (port) socket.openPort(port, baudrate, controllerType)
      })
      .catch((err: unknown) => {
        store.addMessage(`Cannot reach CNCjs at ${socketUrl}: ${err}`, 'error')
      })
      .finally(() => { connectingRef.current = false })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Wire up all socket events ──────────────────────────────────────────────
  useEffect(() => {
    const unsubs: Array<() => void> = [
      // When the serial port closes, clear the connected flag but stay in workspace
      socket.on('disconnect', () => {
        store.setConnected(false)
      }),

      socket.on('serialport:close', () => {
        store.setConnected(false)
      }),

      // Port list (used to detect new devices)
      socket.on('serialport:list', (ports: unknown) => {
        store.setAvailablePorts(ports as PortInfo[])
      }),

      // Raw serial data
      socket.on('serialport:read', (data: unknown) => {
        const line = (data as string).trim()
        if (line && line !== 'ok') {
          const type = /alarm|error/i.test(line) ? 'alarm' : 'read'
          store.addMessage(line, type)
        }
      }),

      socket.on('serialport:write', (data: unknown) => {
        const line = (data as string).trim()
        if (line) store.addMessage(line, 'write')
      }),

      // G-code load / unload
      socket.on('gcode:load', (name: unknown, content: unknown) => {
        const lines = (content as string).split('\n')
        store.setGCode(name as string, lines)

        // Debounce toolpath build (can be slow for large files)
        if (toolpathBuildRef.current) clearTimeout(toolpathBuildRef.current)
        toolpathBuildRef.current = setTimeout(() => {
          const tp = buildToolpath(content as string)
          store.setToolpath(tp)
        }, 100)
      }),

      socket.on('gcode:unload', () => {
        store.clearGCode()
      }),

      // Workflow state
      socket.on('workflow:state', (state: unknown) => {
        store.setWorkflowState(state as WorkflowState)
      }),

      // Sender status
      socket.on('sender:status', (data: unknown) => {
        const s = data as {
          received?: number; total?: number; hold?: boolean
          holdReason?: { data?: string }; elapsedTime?: number; remainingTime?: number
          name?: string; line?: number
        }
        store.updateSenderStatus({
          received: s.received ?? 0,
          total: s.total ?? 0,
          hold: s.hold ?? false,
          holdReason: s.holdReason?.data ?? null,
          elapsedTime: s.elapsedTime ?? 0,
          remainingTime: s.remainingTime ?? 0,
        })
        if (s.line !== undefined) store.setCurrentLine(s.line)
      }),

      // Grbl state
      socket.on('Grbl:state', (data: unknown) => {
        handleGrblState(data, store)
      }),

      socket.on('Grbl:settings', (data: unknown) => {
        const settings = (data as { settings?: Record<string, string> }).settings ?? {}
        // $13 = 1 means report in inches
        if (settings['$13'] !== undefined) {
          store.updateModal({ units: settings['$13'] === '1' ? 'G20' : 'G21' })
        }
      }),

      // Smoothie state
      socket.on('Smoothie:state', (data: unknown) => {
        handleSmoothieState(data, store)
      }),

      // TinyG state
      socket.on('TinyG:state', (data: unknown) => {
        handleTinyGState(data, store)
      }),

      // Marlin state
      socket.on('Marlin:state', (data: unknown) => {
        handleMarlinState(data, store)
      }),
    ]

    return () => {
      unsubs.forEach((fn) => fn())
      if (toolpathBuildRef.current) clearTimeout(toolpathBuildRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="h-screen flex flex-col bg-surface overflow-hidden">
      {/* Top status bar */}
      <StatusBar />

      {/* Main 3-column area — sized to fit iPad Air 2 landscape (1024×768 CSS px) */}
      <div className="flex-1 grid grid-cols-[260px_1fr_280px] gap-2 p-2 min-h-0">
        {/* Left: DRO + Jog */}
        <div className="flex flex-col gap-2 min-h-0">
          <DRO />
          <JogControl />
        </div>

        {/* Center: Toolpath canvas */}
        <div className="min-h-0">
          <ToolpathCanvas />
        </div>

        {/* Right: Files / GCode / Messages */}
        <div className="min-h-0">
          <RightPanel />
        </div>
      </div>

      {/* Bottom bar: MDI + Program controls + Overrides */}
      <BottomBar />

      {/* Probe panel slide-over */}
      <ProbePanel />

      {/* Settings panel slide-over */}
      <SettingsPanel />
    </div>
  )
}

// ── Controller-specific state parsers ─────────────────────────────────────────

function handleGrblState(data: unknown, store: MachineStore) {
  // CNCjs Grbl state shape — also used for FluidNC (which speaks Grbl protocol)
  const d = data as {
    status?: {
      activeState?: string
      wpos?: { x?: number; y?: number; z?: number }
      mpos?: { x?: number; y?: number; z?: number }
      feedrate?: number   // actual feed from FS:feed,spindle
      spindle?: number    // actual spindle RPM from FS:feed,spindle
      ov?: number[]       // [feed%, rapid%, spindle%] — Grbl 1.1 / FluidNC
    }
    parserstate?: {
      modal?: {
        units?: string; distance?: string; wcs?: string
        spindle?: string; motion?: string; coolant?: string
      }
    }
  }

  const st = d.status ?? {}
  if (st.activeState) store.setActiveState(st.activeState as ActiveState)

  if (st.wpos) {
    store.updateWPos({
      x: st.wpos.x ?? 0, y: st.wpos.y ?? 0, z: st.wpos.z ?? 0,
    })
  }
  if (st.mpos) {
    store.updateMPos({
      x: st.mpos.x ?? 0, y: st.mpos.y ?? 0, z: st.mpos.z ?? 0,
    })
  }
  if (st.feedrate !== undefined) store.setFeedrate(st.feedrate)
  if (st.spindle !== undefined) store.setSpindleSpeed(st.spindle)

  // Overrides: ov[0]=feed ov[1]=rapid ov[2]=spindle (in %, 1-200)
  if (st.ov) {
    if (st.ov[0] !== undefined) store.setOverride('feed', st.ov[0])
    if (st.ov[1] !== undefined) store.setOverride('rapid', st.ov[1])
    if (st.ov[2] !== undefined) store.setOverride('spindle', st.ov[2])
  }

  const ps = d.parserstate?.modal ?? {}
  store.updateModal({
    ...(ps.units && { units: ps.units as 'G20' | 'G21' }),
    ...(ps.distance && { distance: ps.distance as 'G90' | 'G91' }),
    ...(ps.wcs && { wcs: ps.wcs as 'G54' }),
    ...(ps.spindle && { spindle: ps.spindle as 'M3' }),
    ...(ps.motion && { motion: ps.motion }),
    ...(ps.coolant && { coolant: ps.coolant as 'M9' }),
  })
}

function handleSmoothieState(data: unknown, store: MachineStore) {
  const d = data as {
    status?: { activeState?: string; wpos?: Record<string, number>; mpos?: Record<string, number>; feedrate?: number }
    parserstate?: { modal?: Record<string, string> }
  }
  const st = d.status ?? {}
  if (st.activeState) store.setActiveState(st.activeState as ActiveState)
  if (st.wpos) store.updateWPos({ x: st.wpos.x ?? 0, y: st.wpos.y ?? 0, z: st.wpos.z ?? 0 })
  if (st.mpos) store.updateMPos({ x: st.mpos.x ?? 0, y: st.mpos.y ?? 0, z: st.mpos.z ?? 0 })
  if (st.feedrate !== undefined) store.setFeedrate(st.feedrate)

  const ps = d.parserstate?.modal ?? {}
  if (Object.keys(ps).length > 0) {
    store.updateModal({
      ...(ps['units'] && { units: ps['units'] as 'G20' }),
      ...(ps['distance'] && { distance: ps['distance'] as 'G90' }),
      ...(ps['wcs'] && { wcs: ps['wcs'] as 'G54' }),
      ...(ps['spindle'] && { spindle: ps['spindle'] as 'M5' }),
    })
  }
}

function handleTinyGState(data: unknown, store: MachineStore) {
  const d = data as {
    sr?: {
      machineState?: number; velocity?: number
      posx?: number; posy?: number; posz?: number
      mpox?: number; mpoy?: number; mpoz?: number
    }
  }
  const sr = d.sr ?? {}
  // TinyG machineState: 3=run 5=hold 6=stop 4=jog
  const stateMap: Record<number, ActiveState> = {
    0: 'Unknown', 1: 'Unknown', 2: 'Idle', 3: 'Run', 4: 'Jog',
    5: 'Hold', 6: 'Unknown', 7: 'Home', 9: 'Alarm', 10: 'Sleep',
  }
  if (sr.machineState !== undefined) {
    store.setActiveState(stateMap[sr.machineState] ?? 'Unknown')
  }
  store.updateWPos({
    x: sr.posx ?? 0, y: sr.posy ?? 0, z: sr.posz ?? 0,
  })
  store.updateMPos({
    x: sr.mpox ?? 0, y: sr.mpoy ?? 0, z: sr.mpoz ?? 0,
  })
  if (sr.velocity !== undefined) store.setFeedrate(sr.velocity)
}

function handleMarlinState(data: unknown, store: MachineStore) {
  const d = data as {
    pos?: { x?: number; y?: number; z?: number }
    feedrate?: number
  }
  if (d.pos) {
    store.updateWPos({ x: d.pos.x ?? 0, y: d.pos.y ?? 0, z: d.pos.z ?? 0 })
    store.updateMPos({ x: d.pos.x ?? 0, y: d.pos.y ?? 0, z: d.pos.z ?? 0 })
  }
  if (d.feedrate !== undefined) store.setFeedrate(d.feedrate)
}
