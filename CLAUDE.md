# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Vite dev server at :3000 (proxies /socket.io and /api to CNCjs at :8000)
npm run build    # tsc + vite build → dist/
npm run preview  # preview the production build locally
```

Installing dependencies requires `--ignore-scripts` because `serialport` (a legacy CLI dependency) fails native compilation on Node.js ≥ 18:

```bash
npm install --ignore-scripts
```

There are no tests.

## Architecture

This repo has two independent parts:

**1. Web frontend** (`src/`, `index.html`, `vite.config.ts`) — a React 18 + TypeScript + Tailwind CSS SPA built with Vite. The production build in `dist/` is mounted as a static path inside CNCjs via `.cncrc` `mountPoints`. The browser then connects directly to the CNCjs socket.io server.

**2. Legacy CLI tool** (`bin/cncjs-pendant-tablet`, `index.js`, `commands.js`) — original Node.js boilerplate that connects to CNCjs over socket.io from the terminal. Kept for reference but superseded by the web app.

### Frontend data flow

```
Browser ──socket.io──► CNCjs server ──serial──► CNC controller
           (same origin or proxied)
```

socket.io is **not bundled** — it is loaded at runtime via `<script src="/socket.io/socket.io.js">` in `index.html`. This ensures version compatibility with whatever CNCjs is running. During development, Vite proxies that path to `http://localhost:8000`.

### Key files

| File | Purpose |
|---|---|
| `src/lib/socket.ts` | Thin singleton wrapper around the global `io`. All `socket.emit` / `socket.on` calls go through here. Exports typed helpers: `openPort`, `closePort`, `command`, `gcode`, `writeln`. |
| `src/store/machineStore.ts` | Single Zustand store for all machine state (positions, modal state, workflow, G-code, messages, probe settings). Only user preferences are persisted to `localStorage` via `zustand/middleware/persist`. |
| `src/pages/Workspace.tsx` | Mounts all socket event listeners for the lifetime of the workspace session. Contains controller-specific parsers (`handleGrblState`, `handleSmoothieState`, etc.) as plain functions that write into the store. |
| `src/lib/toolpath.ts` | Two responsibilities: (1) `buildToolpath(gcodeText)` parses G-code into a `Segment[]` + bounding box; (2) `renderToolpath(ctx, toolpath, opts)` draws everything to a Canvas 2D context. |
| `src/lib/gcodeParser.ts` | Tokenises a single G-code line into `{ letter, value }` word pairs. Used by `toolpath.ts`. |

### State architecture

All volatile machine state lives in `useMachine` (Zustand). Components subscribe to slices of the store — no prop drilling. The store is the single source of truth for:
- Connection info (`port`, `baudrate`, `controllerType`)
- Positions (`wpos`, `mpos`)
- Modal state (`units`, `wcs`, `distance`, `spindle`, …)
- Workflow (`workflowState`, `activeState`, `senderStatus`)
- G-code content and current executing line
- Parsed toolpath geometry
- Probe settings and probe panel visibility

### socket.io authentication

When the built app is served from CNCjs via `mountPoints`, CNCjs handles auth via the existing browser session cookie. No explicit token is required. During development, the Vite proxy forwards requests without modification.

### FluidNC

The machine uses **FluidNC** (ESP32-based firmware). FluidNC speaks the Grbl 1.1 protocol, so CNCjs and this app treat it as controller type `Grbl`. Relevant differences from stock Grbl:

- **No `$13` setting** — FluidNC uses YAML config; the `$13`-based inches-reporting flag does not exist. Unit mode must be read from `parserstate.modal.units` (G20/G21), which is already the primary source in `handleGrblState`.
- **Jog commands** — always use `$J=G21 G91 X… F…` (the Grbl native jog command via `socket.writeln`). Never use `G1` in `G91` mode for jogging: it pollutes modal state and cannot be cancelled. The real-time jog-cancel byte is `0x85`.
- **Spindle speed** — reported in `status.spindle` of the `Grbl:state` event alongside `status.feedrate`.

### Target tablets

The app runs on two specific devices — keep these constraints in mind for all layout and CSS work:

| Device | CSS viewport (landscape) | DPR | Browser |
| --- | --- | --- | --- |
| Apple iPad Air 2 (A1566) | 1024 × 768 px | 2 | Safari on iOS |
| Huawei MediaPad T3 10 | 1280 × 800 px | 1 | Chrome on Android |

- The **1024 px minimum width** is the binding constraint for the workspace grid layout (`grid-cols-[260px_1fr_280px]`).
- **iOS Safari** zooms into any `<input>` or `<select>` with `font-size < 16px`. The global rule in `index.css` forces 16 px on all inputs to prevent this.
- **`100vh` is unreliable in Safari** — `index.css` uses `-webkit-fill-available` on `body` as the fix.
- `user-scalable=no` and `maximum-scale=1.0` in the viewport meta are intentional — accidental pinch-zoom on a live CNC machine is a safety concern, not an accessibility regression.

### Probe sequences

`ProbePanel.tsx` builds and sends G38.2-based sequences directly as individual G-code lines via `socket.gcode()`. The Z-probe does a two-pass approach (fast + slow) and sets the WCS with `G10 L20 P0 Z<plate_thickness>`. Probe completion is detected by watching `workflowState` returning to `'idle'`.
