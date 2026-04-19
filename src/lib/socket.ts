/**
 * CNCjs socket.io wrapper.
 *
 * socket.io is loaded at runtime via <script src="/socket.io/socket.io.js">
 * so we declare the global here instead of bundling the client.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const io: (url: string, opts?: Record<string, unknown>) => SocketIOClient

interface SocketIOClient {
  on(event: string, fn: (...args: unknown[]) => void): void
  off(event: string, fn?: (...args: unknown[]) => void): void
  once(event: string, fn: (...args: unknown[]) => void): void
  emit(event: string, ...args: unknown[]): void
  disconnect(): void
  readonly connected: boolean
  readonly id: string
}

let _socket: SocketIOClient | null = null

// ── Public API ────────────────────────────────────────────────────────────────

export function connect(serverUrl: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (_socket?.connected) _socket.disconnect()

    _socket = io(serverUrl, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    })

    _socket.once('connect', () => resolve())
    _socket.once('connect_error', (err: unknown) =>
      reject(new Error(String(err)))
    )
  })
}

export function disconnect() {
  _socket?.disconnect()
  _socket = null
}

export function emit(event: string, ...args: unknown[]) {
  _socket?.emit(event, ...args)
}

/** Subscribe to a socket event. Returns an unsubscribe function. */
export function on(
  event: string,
  fn: (...args: unknown[]) => void
): () => void {
  _socket?.on(event, fn)
  return () => _socket?.off(event, fn)
}

export function isConnected(): boolean {
  return _socket?.connected ?? false
}

// ── CNCjs high-level helpers ──────────────────────────────────────────────────

export function openPort(
  port: string,
  baudrate: number,
  controllerType: string
) {
  emit('open', port, { baudrate, controllerType })
}

export function closePort(port: string) {
  emit('close', port)
}

export function listPorts() {
  emit('list')
}

/** Send a CNCjs command (gcode:start, gcode:pause, etc.) */
export function command(port: string, cmd: string, ...args: unknown[]) {
  emit('command', port, cmd, ...args)
}

/** Write a raw line to the controller */
export function writeln(port: string, data: string) {
  emit('writeln', port, data, {})
}

/** Send a single G-code line via the feeder */
export function gcode(port: string, line: string) {
  command(port, 'gcode', line)
}
