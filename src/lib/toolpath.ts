/**
 * G-code → toolpath geometry.
 * Walks the G-code line-by-line and builds a list of 2D segments for canvas rendering.
 * Supports G0/G1 (rapid/cut), G2/G3 (arcs), G20/G21 (units), G90/G91 (distance mode).
 */

import { parseLine, extractCoords } from './gcodeParser'
import type { Segment, Toolpath, Vec3 } from '../types'

const IN2MM = 25.4

interface InterpState {
  pos: Vec3
  motion: number      // 0, 1, 2, 3
  units: 'mm' | 'in'
  absolute: boolean
}

function toMM(v: number, units: 'mm' | 'in') {
  return units === 'in' ? v * IN2MM : v
}

export function buildToolpath(gcodeText: string): Toolpath {
  const lines = gcodeText.split('\n')
  const segments: Segment[] = []

  const state: InterpState = {
    pos: { x: 0, y: 0, z: 0 },
    motion: 0,
    units: 'mm',
    absolute: true,
  }

  let minX = Infinity, maxX = -Infinity
  let minY = Infinity, maxY = -Infinity

  const updateBBox = (x: number, y: number) => {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }

  for (const raw of lines) {
    const parsed = parseLine(raw)
    if (!parsed) continue
    const { words } = parsed

    // Process G/M modal changes first
    for (const { letter, value } of words) {
      if (letter === 'G') {
        if (value === 20) state.units = 'in'
        else if (value === 21) state.units = 'mm'
        else if (value === 90) state.absolute = true
        else if (value === 91) state.absolute = false
        else if ([0, 1, 2, 3].includes(value)) state.motion = value
      }
    }

    const coords = extractCoords(words)

    // Skip if no movement coordinates
    if (
      coords['X'] === undefined &&
      coords['Y'] === undefined &&
      coords['Z'] === undefined
    ) continue

    const from: Vec3 = { ...state.pos }

    // Calculate target position
    const resolve = (axis: 'x' | 'y' | 'z', key: string) => {
      const raw = coords[key]
      if (raw === undefined) return state.pos[axis]
      const v = toMM(raw, state.units)
      return state.absolute ? v : state.pos[axis] + v
    }

    const to: Vec3 = {
      x: resolve('x', 'X'),
      y: resolve('y', 'Y'),
      z: resolve('z', 'Z'),
    }

    if (state.motion === 2 || state.motion === 3) {
      // Arc — centre offsets I/J relative to current position
      const i = toMM(coords['I'] ?? 0, state.units)
      const j = toMM(coords['J'] ?? 0, state.units)
      segments.push({
        type: 'arc',
        from,
        to,
        center: { x: from.x + i, y: from.y + j },
        clockwise: state.motion === 2,
      })
      // Approximate bbox from endpoints only (good enough for fit)
      updateBBox(to.x, to.y)
    } else {
      segments.push({
        type: state.motion === 0 ? 'rapid' : 'cut',
        from,
        to,
      })
      updateBBox(from.x, from.y)
      updateBBox(to.x, to.y)
    }

    state.pos = to
  }

  // Fallback bbox
  if (!isFinite(minX)) { minX = -10; maxX = 10; minY = -10; maxY = 10 }

  return {
    segments,
    bbox: { minX, maxX, minY, maxY },
  }
}

// ── Canvas renderer ───────────────────────────────────────────────────────────

interface RenderOptions {
  toolX: number
  toolY: number
  /** Width × height of the canvas in CSS pixels */
  width: number
  height: number
  dpr: number
}

/**
 * Render toolpath to a canvas context.
 * Call this whenever G-code changes (full re-render) or when tool position
 * moves (lightweight update via renderToolPosition).
 */
export function renderToolpath(
  ctx: CanvasRenderingContext2D,
  toolpath: Toolpath,
  opts: RenderOptions
) {
  const { width, height, dpr, toolX, toolY } = opts
  const { segments, bbox } = toolpath

  ctx.clearRect(0, 0, width * dpr, height * dpr)
  ctx.save()
  ctx.scale(dpr, dpr)

  // Calculate transform: fit bbox into canvas with padding
  const pad = 20
  const bw = bbox.maxX - bbox.minX || 10
  const bh = bbox.maxY - bbox.minY || 10
  const scale = Math.min((width - pad * 2) / bw, (height - pad * 2) / bh)
  const cx = (width - bw * scale) / 2 - bbox.minX * scale
  const cy = (height - bh * scale) / 2 - bbox.minY * scale

  const tx = (wx: number) => wx * scale + cx
  const ty = (wy: number) => height - (wy * scale + cy) // flip Y

  // Draw grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.04)'
  ctx.lineWidth = 1
  for (let gx = Math.floor(bbox.minX / 10) * 10; gx <= bbox.maxX; gx += 10) {
    ctx.beginPath(); ctx.moveTo(tx(gx), 0); ctx.lineTo(tx(gx), height); ctx.stroke()
  }
  for (let gy = Math.floor(bbox.minY / 10) * 10; gy <= bbox.maxY; gy += 10) {
    ctx.beginPath(); ctx.moveTo(0, ty(gy)); ctx.lineTo(width, ty(gy)); ctx.stroke()
  }

  // Draw origin crosshair
  ctx.strokeStyle = 'rgba(239,68,68,0.5)'
  ctx.lineWidth = 1
  ctx.setLineDash([4, 4])
  ctx.beginPath(); ctx.moveTo(tx(0), 0); ctx.lineTo(tx(0), height); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(0, ty(0)); ctx.lineTo(width, ty(0)); ctx.stroke()
  ctx.setLineDash([])

  // Draw segments
  for (const seg of segments) {
    if (seg.type === 'rapid') {
      ctx.strokeStyle = 'rgba(34,197,94,0.5)'
      ctx.lineWidth = 0.8
    } else if (seg.type === 'cut') {
      ctx.strokeStyle = 'rgba(59,130,246,0.9)'
      ctx.lineWidth = 1
    } else {
      // arc
      ctx.strokeStyle = 'rgba(59,130,246,0.9)'
      ctx.lineWidth = 1
    }

    ctx.beginPath()

    if (seg.type === 'arc') {
      const { from, to, center, clockwise } = seg
      const r = Math.hypot(from.x - center.x, from.y - center.y)
      const startAngle = Math.atan2(
        -(from.y - center.y) * scale,
        (from.x - center.x) * scale
      )
      const endAngle = Math.atan2(
        -(to.y - center.y) * scale,
        (to.x - center.x) * scale
      )
      ctx.arc(tx(center.x), ty(center.y), r * scale, startAngle, endAngle, !clockwise)
    } else {
      ctx.moveTo(tx(seg.from.x), ty(seg.from.y))
      ctx.lineTo(tx(seg.to.x), ty(seg.to.y))
    }

    ctx.stroke()
  }

  // Draw tool position marker
  const mx = tx(toolX)
  const my = ty(toolY)

  // Outer ring
  ctx.beginPath()
  ctx.arc(mx, my, 8, 0, Math.PI * 2)
  ctx.strokeStyle = '#f0abfc'
  ctx.lineWidth = 2
  ctx.stroke()

  // Cross hair
  ctx.strokeStyle = '#f0abfc'
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(mx - 12, my); ctx.lineTo(mx + 12, my); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(mx, my - 12); ctx.lineTo(mx, my + 12); ctx.stroke()

  ctx.restore()
}
