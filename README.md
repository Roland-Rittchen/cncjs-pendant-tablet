# cncjs-pendant-tablet

A modern tablet pendant for [CNCjs](https://github.com/cncjs/cncjs) covering the full CNC workflow: probing, jogging, running, and observing G-code.

**Stack:** React 18 · TypeScript · Vite 5 · Tailwind CSS · Zustand

---

## Features

- **Connection page** — auto-detects serial ports, configurable baud rate and controller type (Grbl, Smoothie, TinyG, Marlin)
- **Digital Readout (DRO)** — X/Y/Z work positions; click any value to set it directly; one-tap zero/go-to-zero per axis
- **Jog control** — XY cross-pad + Z up/down, five configurable step sizes; full keyboard support
  - Arrow keys → X/Y · PageUp/PageDown → Z
  - Shift = ×10 multiplier · Alt = ×0.1 multiplier
  - `+` / `-` cycle through step sizes
- **Toolpath visualizer** — 2D canvas (XY plane), real-time tool position marker, progress bar
- **File manager** — browse the CNCjs watch directory, click to load
- **G-code viewer** — syntax-highlighted, auto-scrolls to the currently executing line
- **Program controls** — Start / Pause / Resume / Stop with elapsed time and % progress
- **MDI** — send arbitrary G-code; command history via ↑/↓
- **Override controls** — feed / rapid / spindle % adjust
- **Probe panel** (slide-over)
  - **Z probe (touch plate)** — two-pass G38.2 (fast approach + slow verification), configurable plate thickness, probe depth, and feed rates; sets WCS Z automatically
  - **Corner probe** — XY zero from any corner (TL / TR / BL / BR)
- **Message log** — colour-coded serial read/write/alarm history

---

## Development

Requires [CNCjs](https://github.com/cncjs/cncjs) running on `localhost:8000`. The Vite dev server proxies `/socket.io` and `/api` to CNCjs automatically.

```bash
npm install
npm run dev       # Vite dev server at http://localhost:3000
```

---

## Production build

```bash
npm run build     # outputs to dist/
```

Mount the `dist/` folder as a CNCjs static path by adding a `mountPoints` entry to `~/.cncrc`:

```json
{
  "mountPoints": [
    {
      "route": "/tablet",
      "path": "/absolute/path/to/cncjs-pendant-tablet/dist"
    }
  ]
}
```

Restart CNCjs, then open:

```
http://localhost:8000/tablet/
```

---

## CLI pendant (legacy)

The original boilerplate CLI tool is still included. Run it with:

```bash
bin/cncjs-pendant-tablet --help
```

---

## License

MIT
