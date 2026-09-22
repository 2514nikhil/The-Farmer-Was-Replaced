/*
 * Classic (non-module) Web Worker that runs user Python via Pyodide.
 *
 * Protocol (worker -> main):
 *   { type: 'READY' }
 *   { type: 'STDOUT', text }
 *   { type: 'STDERR', text }
 *   { type: 'ACTION', id, action, payload }   -- asks main thread to perform a drone action
 *   { type: 'DONE', error? }                  -- script finished (normally, on error, or stopped)
 *
 * Protocol (main -> worker):
 *   { type: 'RUN', code }
 *   { type: 'STOP' }
 *   { type: 'ACTION_RESULT', id, result }
 */

importScripts('https://cdn.jsdelivr.net/pyodide/v0.26.1/full/pyodide.js');

let pyodide = null;
let pending = new Map(); // id -> { resolve, reject }
let actionCounter = 0;
let stopped = false;
let runToken = 0;

function post(msg) {
  self.postMessage(msg);
}

function callAction(action, payload) {
  return new Promise((resolve, reject) => {
    if (stopped) {
      reject(new Error('Execution stopped'));
      return;
    }
    const id = ++actionCounter;
    pending.set(id, { resolve, reject });
    post({ type: 'ACTION', id, action, payload: payload || {} });
  });
}

const AWAITABLE_FUNCS = [
  'move',
  'plant',
  'harvest',
  'water',
  'till',
  'get_pos',
  'can_harvest',
  'get_crop',
  'get_moisture',
  'get_growth',
  'grid_size',
  'spawn_drone',
];

// Rewrites bare calls to drone functions into awaited calls, so user scripts
// don't need to write "await" themselves (matches the reference game's syntax).
// Best-effort: skips matches inside string literals, already-awaited calls,
// function definitions, and attribute/method access (e.g. self.move()).
function autoAwait(code) {
  const pattern = new RegExp('\\b(' + AWAITABLE_FUNCS.join('|') + ')\\s*\\(', 'g');
  return code
    .split('\n')
    .map((line) => {
      let commentIdx = line.length;
      let inStr = false;
      let strCh = '';
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (inStr) {
          if (c === strCh && line[i - 1] !== '\\') inStr = false;
        } else if (c === '"' || c === "'") {
          inStr = true;
          strCh = c;
        } else if (c === '#') {
          commentIdx = i;
          break;
        }
      }
      const codePart = line.slice(0, commentIdx);
      const rest = line.slice(commentIdx);

      let result = '';
      let lastEnd = 0;
      pattern.lastIndex = 0;
      let m;
      while ((m = pattern.exec(codePart)) !== null) {
        const start = m.index;
        let s = false;
        let sc = '';
        for (let i = 0; i < start; i++) {
          const c = codePart[i];
          if (s) {
            if (c === sc && codePart[i - 1] !== '\\') s = false;
          } else if (c === '"' || c === "'") {
            s = true;
            sc = c;
          }
        }
        if (s) continue;
        const before = codePart.slice(0, start);
        if (/await\s*$/.test(before)) continue;
        if (/def\s+$/.test(before)) continue;
        if (/\.\s*$/.test(before)) continue;

        result += codePart.slice(lastEnd, start) + 'await ' + m[0];
        lastEnd = start + m[0].length;
      }
      result += codePart.slice(lastEnd);
      return result + rest;
    })
    .join('\n');
}

async function initPyodide() {
  pyodide = await self.loadPyodide({
    indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.1/full/',
    stdout: (msg) => post({ type: 'STDOUT', text: msg }),
    stderr: (msg) => post({ type: 'STDERR', text: msg }),
  });
  post({ type: 'READY' });
}

// A handle exposing the same action/query methods for one drone. The main
// drone's bare global functions (move(), plant(), ...) are just this
// factory called with droneId 0; spawn_drone() returns a fresh handle for
// an additional drone. Handle methods are NOT auto-awaited (see
// autoAwait's attribute-call skip above) - call them from an `async def`
// controller with explicit `await`, same as normal Python asyncio code.
function makeDroneHandle(droneId) {
  return {
    id: droneId,
    move: (direction) => callAction('move', { direction, droneId }),
    plant: (cropType) => callAction('plant', { cropType: cropType === undefined ? null : cropType, droneId }),
    harvest: () => callAction('harvest', { droneId }),
    water: () => callAction('water', { droneId }),
    till: () => callAction('till', { droneId }),
    can_harvest: () => callAction('can_harvest', { droneId }),
    get_pos: () => callAction('get_pos', { droneId }),
    get_crop: () => callAction('get_crop', { droneId }),
    get_moisture: () => callAction('get_moisture', { droneId }),
    get_growth: () => callAction('get_growth', { droneId }),
  };
}

function buildNamespace() {
  const builtins = pyodide.pyimport('builtins');
  const ns = builtins.dict();
  ns.set('__name__', '__main__');

  const mainDrone = makeDroneHandle(0);
  ns.set('move', mainDrone.move);
  ns.set('plant', mainDrone.plant);
  ns.set('harvest', mainDrone.harvest);
  ns.set('water', mainDrone.water);
  ns.set('till', mainDrone.till);
  ns.set('can_harvest', mainDrone.can_harvest);
  ns.set('get_pos', mainDrone.get_pos);
  ns.set('get_crop', mainDrone.get_crop);
  ns.set('get_moisture', mainDrone.get_moisture);
  ns.set('get_growth', mainDrone.get_growth);
  ns.set('grid_size', () => callAction('grid_size'));
  ns.set('spawn_drone', async () => makeDroneHandle(await callAction('spawn_drone', {})));

  ns.set('North', 'north');
  ns.set('South', 'south');
  ns.set('East', 'east');
  ns.set('West', 'west');
  ns.set('Grass', 'grass');
  ns.set('Bush', 'bush');
  ns.set('Carrot', 'carrot');
  ns.set('Pumpkin', 'pumpkin');

  return ns;
}

async function runCode(code, token) {
  const namespace = buildNamespace();
  const processed = autoAwait(code);
  const combined = `${processed}

if 'main' in dir():
    import asyncio as __asyncio
    if __asyncio.iscoroutinefunction(main):
        await main()
    elif callable(main):
        main()
`;

  try {
    await pyodide.runPythonAsync(combined, { globals: namespace });
    if (token === runToken) post({ type: 'DONE' });
  } catch (err) {
    if (token !== runToken) return; // superseded by a new run/stop
    const message = err && err.message ? String(err.message) : String(err);
    if (!/Execution stopped/.test(message)) {
      post({ type: 'STDERR', text: message });
      post({ type: 'DONE', error: message });
    } else {
      post({ type: 'DONE' });
    }
  } finally {
    namespace.destroy();
  }
}

function stopCurrentRun() {
  stopped = true;
  runToken++;
  pending.forEach(({ reject }) => reject(new Error('Execution stopped')));
  pending.clear();
}

self.onmessage = async (event) => {
  const data = event.data || {};
  switch (data.type) {
    case 'RUN': {
      stopCurrentRun();
      stopped = false;
      const token = runToken;
      if (!pyodide) {
        await initPyodide();
      }
      runCode(data.code, token);
      break;
    }
    case 'STOP': {
      stopCurrentRun();
      break;
    }
    case 'ACTION_RESULT': {
      const entry = pending.get(data.id);
      if (entry) {
        pending.delete(data.id);
        entry.resolve(data.result);
      }
      break;
    }
  }
};

initPyodide();
