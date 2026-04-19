import { useState, useEffect } from 'react'
import { X, Settings, RefreshCw, ChevronDown, Plug } from 'lucide-react'
import { useMachine } from '../store/machineStore'
import * as socket from '../lib/socket'
import type { ControllerType } from '../types'
import { clsx } from 'clsx'

const BAUDS = [2400, 9600, 19200, 38400, 57600, 115200, 230400, 250000]
const CONTROLLERS: ControllerType[] = ['Grbl', 'Smoothie', 'TinyG', 'Marlin']
const CONTROLLER_LABELS: Record<ControllerType, string> = {
  Grbl: 'Grbl / FluidNC', Smoothie: 'Smoothie', TinyG: 'TinyG', Marlin: 'Marlin',
}

export default function SettingsPanel() {
  const {
    settingsPanelOpen, setSettingsPanelOpen,
    socketUrl, port, baudrate, controllerType,
    setSocketUrl, setPort, connected, availablePorts,
    setAvailablePorts, addMessage, setConnected,
  } = useMachine()

  // Local form state — only committed when user hits "Save & Connect"
  const [url, setUrl] = useState(socketUrl)
  const [selPort, setSelPort] = useState(port ?? '')
  const [baud, setBaud] = useState(baudrate)
  const [ctrl, setCtrl] = useState<ControllerType>(controllerType)
  const [busy, setBusy] = useState(false)

  // Sync local state when panel opens
  useEffect(() => {
    if (settingsPanelOpen) {
      setUrl(socketUrl)
      setSelPort(port ?? '')
      setBaud(baudrate)
      setCtrl(controllerType)
      // Refresh port list if already connected to socket
      if (socket.isConnected()) socket.listPorts()
    }
  }, [settingsPanelOpen])

  async function handleConnect() {
    setBusy(true)
    try {
      // Reconnect socket if URL changed or not connected
      if (url !== socketUrl || !socket.isConnected()) {
        if (socket.isConnected()) {
          if (port) socket.closePort(port)
          socket.disconnect()
          setConnected(false)
        }
        await socket.connect(url)
        setSocketUrl(url)
        socket.listPorts()
        addMessage(`Connected to CNCjs at ${url}`, 'info')
      }

      // Open serial port
      if (selPort) {
        socket.openPort(selPort, baud, ctrl)
        // setPort / setConnected will be called by the serialport:open event in Workspace
        addMessage(`Opening ${selPort} at ${baud} baud…`, 'info')
      }

      setSettingsPanelOpen(false)
    } catch (err) {
      addMessage(`Connection failed: ${err}`, 'error')
    } finally {
      setBusy(false)
    }
  }

  async function refreshPorts() {
    if (!socket.isConnected()) {
      try {
        await socket.connect(url)
        setSocketUrl(url)
      } catch {
        addMessage(`Cannot reach CNCjs at ${url}`, 'error')
        return
      }
    }
    socket.listPorts()
  }

  if (!settingsPanelOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
        onClick={() => !busy && setSettingsPanelOpen(false)}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-88 bg-surface-card border-l border-surface-border
                      shadow-2xl z-50 flex flex-col overflow-hidden" style={{ width: '22rem' }}>
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-border shrink-0">
          <Settings className="w-5 h-5 text-slate-400" />
          <h2 className="font-semibold text-slate-200">Connection Settings</h2>
          <button
            type="button"
            onClick={() => setSettingsPanelOpen(false)}
            className="ml-auto icon-btn"
            aria-label="Close settings"
            disabled={busy}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Connection status banner */}
        <div className={clsx(
          'flex items-center gap-2 px-4 py-2 text-xs font-semibold border-b border-surface-border',
          connected
            ? 'bg-accent-green/10 text-accent-green'
            : 'bg-slate-800 text-slate-500'
        )}>
          <span className={clsx(
            'w-2 h-2 rounded-full',
            connected ? 'bg-accent-green animate-pulse' : 'bg-slate-600'
          )} />
          {connected ? `Connected · ${port}` : 'Disconnected'}
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-4">

          {/* CNCjs server URL */}
          <div className="space-y-1">
            <label className="text-xs text-slate-500">CNCjs Server URL</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="http://localhost:8000"
              className="w-full h-10 bg-surface-raised border border-surface-border rounded-lg px-3
                         text-sm text-slate-100 placeholder-slate-600
                         focus:outline-none focus:border-accent-blue"
            />
            <p className="text-[10px] text-slate-600">
              Set permanently in <code className="text-slate-500">.env</code> as{' '}
              <code className="text-slate-500">VITE_CNCJS_URL</code>
            </p>
          </div>

          {/* Serial port */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs text-slate-500">Serial Port</label>
              <button
                type="button"
                onClick={refreshPorts}
                className="icon-btn p-1 text-xs gap-1"
                title="Refresh port list"
                aria-label="Refresh port list"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            </div>
            <div className="relative">
              <select
                title="Serial port"
                value={selPort}
                onChange={(e) => setSelPort(e.target.value)}
                className="w-full appearance-none h-10 bg-surface-raised border border-surface-border
                           rounded-lg px-3 pr-8 text-sm text-slate-100
                           focus:outline-none focus:border-accent-blue"
              >
                {selPort === '' && <option value="">— select port —</option>}
                {availablePorts.map((p) => (
                  <option key={p.port} value={p.port}>
                    {p.port}{p.manufacturer ? ` (${p.manufacturer})` : ''}
                  </option>
                ))}
                {/* Allow typing a custom port path if not in list */}
                {selPort && !availablePorts.find((p) => p.port === selPort) && (
                  <option value={selPort}>{selPort} (custom)</option>
                )}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4
                                      text-slate-500 pointer-events-none" />
            </div>
            {/* Manual entry fallback */}
            <input
              type="text"
              value={selPort}
              onChange={(e) => setSelPort(e.target.value)}
              placeholder="/dev/ttyUSB0 or COM3"
              className="w-full h-9 bg-surface-raised border border-surface-border rounded-lg px-3
                         font-mono text-xs text-slate-300 placeholder-slate-600
                         focus:outline-none focus:border-accent-blue"
            />
            <p className="text-[10px] text-slate-600">
              Set default in <code className="text-slate-500">.env</code> as{' '}
              <code className="text-slate-500">VITE_SERIAL_PORT</code>
            </p>
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
                  className="w-full appearance-none h-10 bg-surface-raised border border-surface-border
                             rounded-lg px-3 pr-8 text-sm text-slate-100
                             focus:outline-none focus:border-accent-blue"
                >
                  {BAUDS.map((b) => (
                    <option key={b} value={b}>{b.toLocaleString()}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4
                                        text-slate-500 pointer-events-none" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-500">Controller</label>
              <div className="relative">
                <select
                  title="Controller type"
                  value={ctrl}
                  onChange={(e) => setCtrl(e.target.value as ControllerType)}
                  className="w-full appearance-none h-10 bg-surface-raised border border-surface-border
                             rounded-lg px-3 pr-8 text-sm text-slate-100
                             focus:outline-none focus:border-accent-blue"
                >
                  {CONTROLLERS.map((c) => (
                    <option key={c} value={c}>{CONTROLLER_LABELS[c]}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4
                                        text-slate-500 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        {/* Footer action */}
        <div className="px-4 pb-4 pt-2 border-t border-surface-border shrink-0">
          <button
            type="button"
            onClick={handleConnect}
            disabled={busy || !selPort}
            className={clsx(
              'w-full h-11 rounded-xl font-bold text-sm transition-all active:scale-98',
              'flex items-center justify-center gap-2',
              'bg-accent-blue hover:bg-blue-400 text-white',
              (busy || !selPort) && 'opacity-40 cursor-not-allowed active:scale-100'
            )}
          >
            <Plug className="w-4 h-4" />
            {busy ? 'Connecting…' : connected ? 'Reconnect' : 'Connect'}
          </button>
        </div>
      </div>
    </>
  )
}
