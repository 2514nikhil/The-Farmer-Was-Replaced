# Farmer Replaced

A 3D browser game inspired by "The Farmer Was Replaced" - write Python to
control a drone that farms crops on an isometric grid.

## Tech stack

- Next.js 14 (App Router) + TypeScript
- Three.js + React Three Fiber + drei (isometric orthographic camera)
- Zustand for game state
- Monaco Editor (loaded via CDN by `@monaco-editor/react`, not self-bundled)
- Pyodide (real CPython, in a Web Worker) for running your code
- Tailwind CSS, Framer Motion, Howler (procedural sound effects)

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000. First load takes a few seconds while Pyodide
downloads from jsDelivr's CDN (~10MB) - you'll see a "Loading Python
runtime..." pill at the top until it's ready.

## Writing scripts

Click the `+` icon (top right) for a new floating script window, or edit the
default one. No `await` needed - drone actions are automatically sequenced
one at a time, and the drone visibly finishes each action before the next
line runs.

```python
while True:
    if can_harvest():
        harvest()
    else:
        move(East)
```

Actions: `move(direction)`, `plant(crop)`, `harvest()`, `water()`, `till()`.
Queries: `can_harvest()`, `get_pos()`, `get_crop()`, `get_moisture()`,
`get_growth()`, `grid_size()`. Constants:
`North, South, East, West, Grass, Bush, Carrot, Pumpkin`.

The field starts covered in wild wheat (`Grass`) that grows on its own -
`plant(crop)` only matters when you want something else there. `till()`
permanently boosts a tile's growth speed (diminishing, caps after a few
tills).

Click a window's play icon to run that script (replaces whatever else was
running on the main drone).

### Multiple drones

`spawn_drone()` returns a handle to an additional drone. The main drone's
bare functions are auto-sequenced (no `await` needed), but handle methods
are normal async calls - control them from an `async def` function scheduled
with `asyncio.ensure_future`, so both drones run concurrently:

```python
import asyncio

async def run(d):
    while True:
        if not await d.move(East):
            break

d2 = spawn_drone()
asyncio.ensure_future(run(d2))

while True:
    move(East)
```

## Controls

- Alt + drag (or middle-click drag): pan camera
- Ctrl/Cmd + scroll: zoom
- Arrow keys / WASD, P, H, T: manual move/plant/harvest/water, only while
  no script is running - mainly useful for testing a layout by hand

## Saving

Your farm, inventory, research and scripts autosave to this browser's
localStorage every few seconds - no manual save step. "Reset progress" in
the info panel (top right) clears the save and starts over.

## Project structure

```
src/
  app/                 Next.js app router entry (layout, page, globals.css)
  components/
    GameCanvas.tsx      R3F canvas + scene composition
    GameCamera.tsx       Isometric orthographic camera
    FarmGrid.tsx          Tile/crop/weed rendering
    Drone.tsx              Drone mesh + movement animation
    Lighting.tsx
    Layout.tsx            Overlay UI shell (canvas + floating panels)
    TopBar.tsx             Resource pills + icon toolbar
    EditorWindows.tsx      Floating draggable/resizable script windows
    MonacoEditor.tsx        Code editor wrapper (completions, hover, theme)
    ConsoleFlyout.tsx      Output/error log panel
    HelpPanel.tsx           Function reference
    ResearchModal.tsx      Research tree
  hooks/
    usePyodideWorker.ts   Main-thread bridge: runs actions against the
                          store, paces them for animation, handles
                          run/stop/pause/resume/step
    useControls.ts        Manual keyboard + camera pan/zoom
    useSound.ts            Procedurally synthesized sound effects
    useGamePersistence.ts  Autosave/restore to localStorage
  stores/useGameStore.ts  All game state (grid, drone, inventory, research,
                          scripts) + the drone action methods
  types/game.ts           Types, crop/research definitions, config
public/
  pyodide-worker.js       Classic Web Worker: loads Pyodide, auto-inserts
                          `await` before drone calls, runs your code,
                          round-trips actions to the main thread by id
```

## Known limitations vs. the original game

- Multiple drones work, but only via explicit `asyncio` (`spawn_drone()` +
  `asyncio.ensure_future`) - there's no automatic "every spawned drone runs
  the same way" concurrency model.
- The auto-`await` rewrite is a careful regex pass (skips string literals,
  comments, `def`, already-`await`ed, and attribute calls like `self.move()`
  or `d.move()` on a spawned-drone handle) rather than a full AST transform,
  so it won't catch every edge case in unusual code (e.g. a call split
  across multiple lines).
- Research tree is a simple categorized list rather than the branching node
  graph shown in the reference screenshots.
