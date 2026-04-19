import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type {
  ActiveState,
  ControllerType,
  Message,
  ModalState,
  PortInfo,
  Position,
  SenderStatus,
  Toolpath,
  WorkflowState,
  ProbeSettings,
} from '../types'
import { DEFAULT_PROBE_SETTINGS } from '../types'

interface MachineStore {
  // ── Connection ──────────────────────────────────────────────────────────────
  socketUrl: string
  connected: boolean
  port: string | null
  baudrate: number
  controllerType: ControllerType
  availablePorts: PortInfo[]

  // ── Machine state ───────────────────────────────────────────────────────────
  activeState: ActiveState
  workflowState: WorkflowState

  // ── Positions ───────────────────────────────────────────────────────────────
  wpos: Position
  mpos: Position
  showMPos: boolean

  // ── Modal state ─────────────────────────────────────────────────────────────
  modal: ModalState

  // ── Overrides (in %) ────────────────────────────────────────────────────────
  feedOverride: number
  rapidOverride: number
  spindleOverride: number

  // ── Feed / speed ────────────────────────────────────────────────────────────
  feedrate: number
  spindleSpeed: number

  // ── G-code / sender ─────────────────────────────────────────────────────────
  gcodeName: string | null
  gcodeLines: string[]
  currentLine: number
  senderStatus: SenderStatus

  // ── Toolpath ────────────────────────────────────────────────────────────────
  toolpath: Toolpath | null

  // ── Messages ─────────────────────────────────────────────────────────────────
  messages: Message[]

  // ── Probe ────────────────────────────────────────────────────────────────────
  probeSettings: ProbeSettings
  probePanelOpen: boolean
  probing: boolean

  // ── Settings panel ───────────────────────────────────────────────────────────
  settingsPanelOpen: boolean

  // ── Actions ──────────────────────────────────────────────────────────────────
  setSocketUrl: (url: string) => void
  setConnected: (v: boolean) => void
  setPort: (port: string | null, baudrate?: number, type?: ControllerType) => void
  setAvailablePorts: (ports: PortInfo[]) => void

  setActiveState: (state: ActiveState) => void
  setWorkflowState: (state: WorkflowState) => void

  updateWPos: (pos: Partial<Position>) => void
  updateMPos: (pos: Partial<Position>) => void
  toggleMPos: () => void

  updateModal: (modal: Partial<ModalState>) => void

  setFeedrate: (f: number) => void
  setSpindleSpeed: (s: number) => void

  setOverride: (kind: 'feed' | 'rapid' | 'spindle', value: number) => void

  setGCode: (name: string, lines: string[]) => void
  clearGCode: () => void
  setCurrentLine: (n: number) => void
  updateSenderStatus: (s: Partial<SenderStatus>) => void

  setToolpath: (t: Toolpath | null) => void

  addMessage: (text: string, type: Message['type']) => void
  clearMessages: () => void

  updateProbeSettings: (s: Partial<ProbeSettings>) => void
  setProbePanelOpen: (v: boolean) => void
  setProbing: (v: boolean) => void

  setSettingsPanelOpen: (v: boolean) => void
}

const DEFAULT_MODAL: ModalState = {
  units: 'G21',
  distance: 'G90',
  wcs: 'G54',
  spindle: 'M5',
  motion: 'G0',
  coolant: 'M9',
}

const DEFAULT_POS: Position = { x: 0, y: 0, z: 0, a: 0 }

const DEFAULT_SENDER: SenderStatus = {
  received: 0,
  total: 0,
  hold: false,
  holdReason: null,
  elapsedTime: 0,
  remainingTime: 0,
}

let msgId = 0

export type { MachineStore }

export const useMachine = create<MachineStore>()(
  persist(
    (set) => ({
      // Connection — seeded from .env at build time; overridden by persisted localStorage values
      socketUrl: import.meta.env.VITE_CNCJS_URL || window.location.origin || 'http://localhost:8000',
      connected: false,
      port: import.meta.env.VITE_SERIAL_PORT || null,
      baudrate: Number(import.meta.env.VITE_BAUDRATE) || 115200,
      controllerType: (import.meta.env.VITE_CONTROLLER_TYPE as ControllerType) || 'Grbl',
      availablePorts: [],

      // Machine
      activeState: 'Unknown',
      workflowState: 'idle',

      // Position
      wpos: { ...DEFAULT_POS },
      mpos: { ...DEFAULT_POS },
      showMPos: false,

      // Modal
      modal: { ...DEFAULT_MODAL },

      // Overrides
      feedOverride: 100,
      rapidOverride: 100,
      spindleOverride: 100,

      // Feed/speed
      feedrate: 0,
      spindleSpeed: 0,

      // G-code
      gcodeName: null,
      gcodeLines: [],
      currentLine: 0,
      senderStatus: { ...DEFAULT_SENDER },

      // Toolpath
      toolpath: null,

      // Messages
      messages: [],

      // Probe
      probeSettings: { ...DEFAULT_PROBE_SETTINGS },
      probePanelOpen: false,
      probing: false,

      // Settings panel
      settingsPanelOpen: false,

      // ── Actions ─────────────────────────────────────────────────────────────
      setSocketUrl: (url) => set({ socketUrl: url }),

      setConnected: (connected) =>
        set((s) => ({
          connected,
          ...(connected ? {} : {
            port: null,
            activeState: 'Unknown',
            workflowState: 'idle',
            wpos: { ...DEFAULT_POS },
            mpos: { ...DEFAULT_POS },
            modal: { ...DEFAULT_MODAL },
            gcodeName: null,
            gcodeLines: [],
            currentLine: 0,
            senderStatus: { ...DEFAULT_SENDER },
            toolpath: null,
            feedrate: 0,
            spindleSpeed: 0,
          }),
        })),

      setPort: (port, baudrate, type) =>
        set((s) => ({
          port,
          baudrate: baudrate ?? s.baudrate,
          controllerType: type ?? s.controllerType,
        })),

      setAvailablePorts: (ports) => set({ availablePorts: ports }),

      setActiveState: (activeState) => set({ activeState }),

      setWorkflowState: (workflowState) => set({ workflowState }),

      updateWPos: (pos) =>
        set((s) => ({ wpos: { ...s.wpos, ...pos } })),

      updateMPos: (pos) =>
        set((s) => ({ mpos: { ...s.mpos, ...pos } })),

      toggleMPos: () => set((s) => ({ showMPos: !s.showMPos })),

      updateModal: (modal) =>
        set((s) => ({ modal: { ...s.modal, ...modal } })),

      setFeedrate: (feedrate) => set({ feedrate }),
      setSpindleSpeed: (spindleSpeed) => set({ spindleSpeed }),

      setOverride: (kind, value) => {
        if (kind === 'feed') set({ feedOverride: value })
        else if (kind === 'rapid') set({ rapidOverride: value })
        else set({ spindleOverride: value })
      },

      setGCode: (name, lines) =>
        set({ gcodeName: name, gcodeLines: lines, currentLine: 0, toolpath: null }),

      clearGCode: () =>
        set({ gcodeName: null, gcodeLines: [], currentLine: 0, toolpath: null }),

      setCurrentLine: (currentLine) => set({ currentLine }),

      updateSenderStatus: (s) =>
        set((prev) => ({ senderStatus: { ...prev.senderStatus, ...s } })),

      setToolpath: (toolpath) => set({ toolpath }),

      addMessage: (text, type) =>
        set((s) => ({
          messages: [
            ...s.messages.slice(-199),
            { id: ++msgId, text, type, ts: Date.now() },
          ],
        })),

      clearMessages: () => set({ messages: [] }),

      updateProbeSettings: (s) =>
        set((prev) => ({ probeSettings: { ...prev.probeSettings, ...s } })),

      setProbePanelOpen: (probePanelOpen) => set({ probePanelOpen }),
      setProbing: (probing) => set({ probing }),

      setSettingsPanelOpen: (settingsPanelOpen) => set({ settingsPanelOpen }),
    }),
    {
      name: 'cncjs-tablet-settings',
      storage: createJSONStorage(() => localStorage),
      // Only persist user preferences, not volatile machine state
      partialize: (s) => ({
        socketUrl: s.socketUrl,
        baudrate: s.baudrate,
        controllerType: s.controllerType,
        port: s.port,
        showMPos: s.showMPos,
        probeSettings: s.probeSettings,
      }),
    }
  )
)
