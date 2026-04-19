import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Cpu, RefreshCw, Wifi, WifiOff, ChevronDown } from 'lucide-react'
import { useMachine } from '../store/machineStore'
import * as socket from '../lib/socket'
import type { ControllerType, PortInfo } from '../types'

const BAUDS = [2400, 9600, 19200, 38400, 57600, 115200, 230400, 250000]
// FluidNC speaks the Grbl protocol — select "Grbl" for FluidNC machines.
const CONTROLLERS: ControllerType[] = ['Grbl', 'Smoothie', 'TinyG', 'Marlin']
const CONTROLLER_LABELS: Record<ControllerType, string> = {
  Grbl:    'Grbl / FluidNC',
  Smoothie:'Smoothie',
  TinyG:   'TinyG',
  Marlin:  'Marlin',
}

export default function Connection() {
  const navigate = useNavigate()
  const {
    socketUrl, baudrate, controllerType, port: savedPort,
    setSocketUrl, setPort, setConnected, setAvailablePorts,
    availablePorts, addMessage,
  } = useMachine()

  const [url, setUrl] = useState(socketUrl)
  const [selectedPort, setSelectedPort] = useState(savedPort ?? '')
  const [baud, setBaud] = useState(baudrate)
  const [controller, setController] = useState<ControllerType>(controllerType)
  const [connecting, setConnecting] = useState(false)
  const [socketConnected, setSocketConnected] = useState(false)
  const [error, setError] = useState('')
  const connectingRef = useRef(false)

  // Auto-connect to socket on mount to populate port list
  useEffect(() => {
    if (!socketConnected && !connectingRef.current) {
      connectSocket(url)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function connectSocket(targetUrl: string) {
    if (connectingRef.current) return
    connectingRef.current = true
    setError('')
    try {
      await socket.connect(targetUrl)
      setSocketConnected(true)
      setSocketUrl(targetUrl)
      socket.listPorts()
    } catch (err) {
      setError(`Cannot reach CNCjs at ${targetUrl}. Is it running?`)
      setSocketConnected(false)
    } finally {
      connectingRef.current = false
    }
  }

  // Listen for port list and connection events
  useEffect(() => {
    const unsubs = [
      socket.on('serialport:list', (ports: unknown) => {
        const list = ports as PortInfo[]
        setAvailablePorts(list)
        if (!selectedPort && list.length > 0) setSelectedPort(list[0].port)
      }),

      socket.on('serialport:open', (opts: unknown) => {
        const o = opts as { port: string; baudrate: number; controllerType: string }
        setPort(o.port, o.baudrate, o.controllerType as ControllerType)
        setConnected(true)
        setConnecting(false)
        navigate('/workspace')
      }),

      socket.on('serialport:error', (opts: unknown) => {
        const o = opts as { port: string }
        setError(`Failed to open port ${o.port}. Check connections and baud rate.`)
        setConnecting(false)
      }),

      socket.on('connect', () => {
        setSocketConnected(true)
        socket.listPorts()
      }),

      socket.on('disconnect', () => {
        setSocketConnected(false)
        setConnected(false)
      }),
    ]
    return () => unsubs.forEach((fn) => fn())
  }, [navigate, setAvailablePorts, setConnected, setPort, selectedPort])

  async function handleConnect() {
    if (!selectedPort) { setError('Select a serial port first.'); return }
    setError('')
    setConnecting(true)
    addMessage(`Opening ${selectedPort} at ${baud} baud…`, 'info')

    if (!socketConnected) {
      try {
        await connectSocket(url)
      } catch {
        setConnecting(false)
        return
      }
    }
    socket.openPort(selectedPort, baud, controller)
  }

  return (
    <div className="flex items-center justify-center h-screen bg-surface p-4">
      <div className="w-full max-w-md space-y-4">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Cpu className="w-8 h-8 text-accent-blue" />
            <h1 className="text-2xl font-bold text-slate-100">CNCjs Tablet</h1>
          </div>
          <p className="text-sm text-slate-400">Connect to your CNC machine</p>
        </div>

        {/* CNCjs server URL */}
        <div className="panel p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            {socketConnected
              ? <Wifi className="w-4 h-4 text-accent-green" />
              : <WifiOff className="w-4 h-4 text-slate-500" />}
            <span className="text-sm font-semibold text-slate-300">CNCjs Server</span>
            <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${
              socketConnected
                ? 'bg-accent-green/20 text-accent-green'
                : 'bg-slate-700 text-slate-400'
            }`}>
              {socketConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          <div className="flex gap-2">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onBlur={() => { if (url !== socketUrl) connectSocket(url) }}
              className="flex-1 bg-surface-raised border border-surface-border rounded-lg px-3 py-2
                         text-sm text-slate-100 placeholder-slate-500
                         focus:outline-none focus:border-accent-blue"
              placeholder="http://localhost:8000"
            />
            <button
              type="button"
              onClick={() => connectSocket(url)}
              className="icon-btn border border-surface-border px-3"
              title="Reconnect"
              aria-label="Reconnect to CNCjs server"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Serial port & controller settings */}
        <div className="panel p-4 space-y-3">
          <span className="text-sm font-semibold text-slate-300">Port Settings</span>

          {/* Port selector */}
          <div className="space-y-1">
            <label className="text-xs text-slate-500">Serial Port</label>
            <div className="relative">
              <select
                title="Serial port"
                value={selectedPort}
                onChange={(e) => setSelectedPort(e.target.value)}
                className="w-full appearance-none bg-surface-raised border border-surface-border
                           rounded-lg px-3 py-2 text-sm text-slate-100 pr-8
                           focus:outline-none focus:border-accent-blue"
              >
                {availablePorts.length === 0 && (
                  <option value="">— no ports detected —</option>
                )}
                {availablePorts.map((p) => (
                  <option key={p.port} value={p.port}>
                    {p.port}{p.manufacturer ? ` (${p.manufacturer})` : ''}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
            </div>
          </div>

          {/* Baud + Controller */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-slate-500">Baud Rate</label>
              <div className="relative">
                <select
                  title="Baud rate"
                  value={baud}
                  onChange={(e) => setBaud(Number(e.target.value))}
                  className="w-full appearance-none bg-surface-raised border border-surface-border
                             rounded-lg px-3 py-2 text-sm text-slate-100 pr-8
                             focus:outline-none focus:border-accent-blue"
                >
                  {BAUDS.map((b) => (
                    <option key={b} value={b}>{b.toLocaleString()}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-500">Controller</label>
              <div className="relative">
                <select
                  title="Controller type"
                  value={controller}
                  onChange={(e) => setController(e.target.value as ControllerType)}
                  className="w-full appearance-none bg-surface-raised border border-surface-border
                             rounded-lg px-3 py-2 text-sm text-slate-100 pr-8
                             focus:outline-none focus:border-accent-blue"
                >
                  {CONTROLLERS.map((c) => (
                    <option key={c} value={c}>{CONTROLLER_LABELS[c]}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-accent-red/10 border border-accent-red/30 rounded-lg px-4 py-3
                          text-sm text-accent-red">
            {error}
          </div>
        )}

        {/* Connect button */}
        <button
          type="button"
          onClick={handleConnect}
          disabled={connecting || !socketConnected}
          className="w-full py-3.5 rounded-xl font-bold text-base transition-all
                     bg-accent-blue hover:bg-blue-400 active:scale-98 text-white
                     disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
        >
          {connecting ? 'Connecting…' : 'Connect'}
        </button>
      </div>
    </div>
  )
}
