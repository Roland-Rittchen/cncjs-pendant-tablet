export type ControllerType = 'Grbl' | 'Smoothie' | 'TinyG' | 'Marlin'

export type ActiveState =
  | 'Idle'
  | 'Run'
  | 'Hold'
  | 'Jog'
  | 'Alarm'
  | 'Door'
  | 'Check'
  | 'Home'
  | 'Sleep'
  | 'Unknown'

export type WorkflowState = 'idle' | 'running' | 'paused'

export interface Position {
  x: number
  y: number
  z: number
  a: number
}

export interface ModalState {
  units: 'G20' | 'G21'
  distance: 'G90' | 'G91'
  wcs: 'G54' | 'G55' | 'G56' | 'G57' | 'G58' | 'G59'
  spindle: 'M3' | 'M4' | 'M5'
  motion: string
  coolant: 'M7' | 'M8' | 'M9'
}

export interface SenderStatus {
  received: number
  total: number
  hold: boolean
  holdReason: string | null
  elapsedTime: number
  remainingTime: number
}

export interface PortInfo {
  port: string
  manufacturer?: string
  inuse?: boolean
}

export interface Message {
  id: number
  text: string
  type: 'info' | 'error' | 'alarm' | 'write' | 'read'
  ts: number
}

// Toolpath types
export interface Vec2 {
  x: number
  y: number
}

export interface Vec3 extends Vec2 {
  z: number
}

export interface ToolpathSegment {
  type: 'rapid' | 'cut'
  from: Vec3
  to: Vec3
}

export interface ArcSegment {
  type: 'arc'
  from: Vec3
  to: Vec3
  center: Vec2
  clockwise: boolean
}

export type Segment = ToolpathSegment | ArcSegment

export interface Toolpath {
  segments: Segment[]
  bbox: { minX: number; maxX: number; minY: number; maxY: number }
}

// Probe settings
export interface ProbeSettings {
  plateThickness: number
  probeDepth: number
  feedFast: number
  feedSlow: number
  retractHeight: number
}

export const DEFAULT_PROBE_SETTINGS: ProbeSettings = {
  plateThickness: 19.5,
  probeDepth: 30,
  feedFast: 100,
  feedSlow: 20,
  retractHeight: 5,
}
