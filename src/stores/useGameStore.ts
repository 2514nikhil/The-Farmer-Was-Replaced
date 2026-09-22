import { create } from 'zustand';
import type {
  TileData,
  DroneState,
  Inventory,
  ResearchNode,
  GameConfig,
  SaveData,
  ScriptFile,
  Vector2,
  Direction,
  CropType,
  CropTypeNullable,
  GamePhase,
} from '@/types/game';
import {
  DEFAULT_GAME_CONFIG,
  INITIAL_RESEARCH_NODES,
  CROP_DEFINITIONS,
  DIRECTION_VECTORS,
  DIRECTION_ROTATIONS,
  getCropDefinition,
} from '@/types/game';

interface MoveResult {
  success: boolean;
  x: number;
  y: number;
}

interface GameStore {
  config: GameConfig;
  grid: TileData[][];
  drones: DroneState[];
  droneMemorySlots: number;
  research: ResearchNode[];
  inventory: Inventory;
  scripts: ScriptFile[];
  activeScriptIndex: number;
  gamePhase: GamePhase;
  executionSpeed: number;
  showGrid: boolean;
  cameraPosition: Vector2;
  cameraZoom: number;
  selectedCrop: CropTypeNullable;
  initialized: boolean;

  initializeGrid: (size?: number) => void;
  setGamePhase: (phase: GamePhase) => void;
  setExecutionSpeed: (speed: number) => void;
  setShowGrid: (show: boolean) => void;
  setCameraPosition: (pos: Vector2) => void;
  setCameraZoom: (zoom: number) => void;
  setSelectedCrop: (crop: CropTypeNullable) => void;

  updateDronePosition: (droneId: number, pos: Vector2, instant?: boolean) => void;
  updateDroneRotation: (droneId: number, rotation: number, instant?: boolean) => void;
  setDroneMoving: (droneId: number, moving: boolean) => void;
  spawnDrone: () => number;

  getTile: (x: number, y: number) => TileData | null;
  setTile: (x: number, y: number, data: Partial<TileData>) => void;
  canPlantAt: (x: number, y: number, crop: CropTypeNullable) => boolean;
  canHarvestAt: (x: number, y: number) => boolean;

  addToInventory: (items: Partial<Inventory>) => void;
  removeFromInventory: (items: Partial<Inventory>) => boolean;
  hasResources: (cost: Partial<Inventory>) => boolean;
  spendResources: (cost: Partial<Inventory>) => boolean;

  unlockResearch: (id: string) => boolean;
  getUnlockedResearch: () => ResearchNode[];
  getAvailableResearch: () => ResearchNode[];
  isCropUnlocked: (crop: CropType) => boolean;

  expandGrid: (newSize: number) => void;

  addScript: (name: string, content?: string) => number;
  removeScript: (index: number) => void;
  updateScript: (index: number, content: string) => void;
  renameScript: (index: number, name: string) => void;
  setActiveScript: (index: number) => void;

  saveGame: () => SaveData;
  loadGame: (data: SaveData) => void;
  resetGame: () => void;

  simulateCropGrowth: () => void;
  simulateSoilMoisture: () => void;
  checkPumpkinMerge: (x: number, y: number) => void;

  // Drone actions - called directly by the Python execution bridge.
  // Each mutates state synchronously and returns a plain result. droneId
  // defaults to 0, the original single drone, for backward compatibility.
  moveDrone: (droneId: number, direction: Direction) => MoveResult;
  plantCrop: (droneId: number, cropType: CropTypeNullable) => boolean;
  harvestCrop: (droneId: number) => boolean;
  waterTile: (droneId: number) => boolean;
  tillTile: (droneId: number) => boolean;
  getDronePos: (droneId: number) => [number, number];
  canHarvestHere: (droneId: number) => boolean;
  getCropAtDrone: (droneId: number) => CropTypeNullable;
  getMoistureAtDrone: (droneId: number) => number;
  getGrowthAtDrone: (droneId: number) => number;
}

const createInitialGrid = (size: number): TileData[][] => {
  const grid: TileData[][] = [];
  for (let y = 0; y < size; y++) {
    const row: TileData[] = [];
    for (let x = 0; x < size; x++) {
      row.push({
        position: { x, y },
        // The field starts covered in wild wheat, like the reference game -
        // there's always something growing unless a script plants over it.
        cropType: 'grass',
        growthStage: 0.3 + Math.random() * 0.7,
        moisture: 0.5,
        fertility: 1.0,
      });
    }
    grid.push(row);
  }
  return grid;
};

const createDrone = (id: number, position: Vector2): DroneState => ({
  id,
  position,
  targetPosition: position,
  rotation: 0,
  targetRotation: 0,
  isMoving: false,
});

// Start in a corner, not the center - scripts that sweep the grid with
// relative move() calls (the common pattern for these games) assume a
// known starting corner to reason about.
const START_POSITION: Vector2 = { x: 0, y: 0 };

const DEFAULT_SCRIPT = `# Write Python to control the drone.
# Actions: move(dir), plant(crop), harvest(), water(), till()
# Queries: can_harvest(), get_pos(), get_crop(), get_moisture(), get_growth()
# Directions: North, South, East, West
# Crops: Grass, Bush, Carrot, Pumpkin
# The field is covered in wild wheat (Grass) by default, growing on its own -
# call plant(crop) only when you want to replace it with something else.
# till() permanently boosts a tile's growth speed - costs a visit, pays off
# over time. No "await" needed - actions are automatically sequenced.

while True:
    if can_harvest():
        harvest()
    else:
        move(East)
`;

// Crop growth per tick, normalized 0-1. Tuned against the 200ms tick rate
// (5 ticks/sec) so grass matures in roughly 5-10s and pumpkin in well under
// a minute.
const CROP_GROWTH_RATES: Record<CropType, number> = {
  grass: 0.0333,
  bush: 0.02,
  carrot: 0.0134,
  pumpkin: 0.01,
};

const MOISTURE_EVAPORATION = 0.002;
const CROP_MOISTURE_CONSUMPTION: Record<CropType, number> = {
  grass: 0.0005,
  bush: 0.001,
  carrot: 0.0015,
  pumpkin: 0.002,
};

const MAX_FERTILITY = 2.0;
const TILL_BOOST = 0.4;

export const useGameStore = create<GameStore>()((set, get) => ({
  config: DEFAULT_GAME_CONFIG,
  grid: createInitialGrid(DEFAULT_GAME_CONFIG.initialGridSize),
  drones: [createDrone(0, START_POSITION)],
  droneMemorySlots: DEFAULT_GAME_CONFIG.droneMemorySlots,
  research: INITIAL_RESEARCH_NODES,
  inventory: DEFAULT_GAME_CONFIG.startingInventory,
  scripts: [{ name: 'main.py', content: DEFAULT_SCRIPT }],
  activeScriptIndex: 0,
  gamePhase: 'idle',
  executionSpeed: 1,
  showGrid: true,
  cameraPosition: { x: 0, y: 0 },
  cameraZoom: 1,
  selectedCrop: 'grass',
  initialized: false,

  initializeGrid: (size = DEFAULT_GAME_CONFIG.initialGridSize) => {
    const clampedSize = Math.min(Math.max(size, 3), DEFAULT_GAME_CONFIG.maxGridSize);
    set({
      grid: createInitialGrid(clampedSize),
      drones: [createDrone(0, START_POSITION)],
      config: { ...get().config, gridSize: clampedSize },
      initialized: true,
    });
  },

  setGamePhase: (phase) => set({ gamePhase: phase }),
  setExecutionSpeed: (speed) => set({ executionSpeed: Math.max(0.25, Math.min(8, speed)) }),
  setShowGrid: (show) => set({ showGrid: show }),
  setCameraPosition: (pos) => set({ cameraPosition: pos }),
  setCameraZoom: (zoom) => set({ cameraZoom: Math.max(0.5, Math.min(3, zoom)) }),
  setSelectedCrop: (crop) => set({ selectedCrop: crop }),

  updateDronePosition: (droneId, pos, instant = false) =>
    set((state) => ({
      drones: state.drones.map((d, i) =>
        i === droneId
          ? { ...d, position: instant ? pos : d.position, targetPosition: pos, isMoving: !instant }
          : d
      ),
    })),

  updateDroneRotation: (droneId, rotation, instant = false) =>
    set((state) => ({
      drones: state.drones.map((d, i) =>
        i === droneId ? { ...d, rotation: instant ? rotation : d.rotation, targetRotation: rotation } : d
      ),
    })),

  setDroneMoving: (droneId, moving) =>
    set((state) => ({
      drones: state.drones.map((d, i) =>
        i === droneId
          ? { ...d, isMoving: moving, position: moving ? d.position : d.targetPosition, rotation: moving ? d.rotation : d.targetRotation }
          : d
      ),
    })),

  spawnDrone: () => {
    const state = get();
    const spawnPoint = state.drones[0]?.position ?? START_POSITION;
    const newId = state.drones.length;
    set({ drones: [...state.drones, createDrone(newId, { ...spawnPoint })] });
    return newId;
  },

  getTile: (x, y) => {
    const { grid } = get();
    if (x < 0 || y < 0 || y >= grid.length || x >= grid[0].length) return null;
    return grid[y][x];
  },

  setTile: (x, y, data) =>
    set((state) => {
      if (x < 0 || y < 0 || y >= state.grid.length || x >= state.grid[0].length) return state;
      const newGrid = state.grid.map((row, ry) =>
        ry === y ? row.map((tile, rx) => (rx === x ? { ...tile, ...data } : tile)) : row
      );
      return { grid: newGrid };
    }),

  canPlantAt: (x, y, crop) => {
    const tile = get().getTile(x, y);
    if (!tile || crop === null) return false;
    if (!get().isCropUnlocked(crop)) return false;
    // Planting always overwrites whatever's on the tile (including the
    // default wheat) - except re-requesting the crop that's already
    // growing there, which is a no-op so scripts like
    // "if not plant(Grass): move(East)" don't get stuck replanting forever.
    if (tile.cropType === crop) return false;
    return true;
  },

  canHarvestAt: (x, y) => {
    const tile = get().getTile(x, y);
    if (!tile || tile.cropType === null) return false;
    return tile.growthStage >= 1;
  },

  isCropUnlocked: (crop) => {
    if (crop === 'grass') return true;
    const node = get().research.find((r) => r.effect.type === 'unlock_crop' && r.effect.cropType === crop);
    return node ? node.unlocked : false;
  },

  addToInventory: (items) =>
    set((state) => ({
      inventory: {
        hay: state.inventory.hay + (items.hay || 0),
        wood: state.inventory.wood + (items.wood || 0),
        carrots: state.inventory.carrots + (items.carrots || 0),
        pumpkins: state.inventory.pumpkins + (items.pumpkins || 0),
      },
    })),

  removeFromInventory: (items) => {
    const { inventory } = get();
    const canRemove =
      inventory.hay >= (items.hay || 0) &&
      inventory.wood >= (items.wood || 0) &&
      inventory.carrots >= (items.carrots || 0) &&
      inventory.pumpkins >= (items.pumpkins || 0);
    if (!canRemove) return false;
    set({
      inventory: {
        hay: inventory.hay - (items.hay || 0),
        wood: inventory.wood - (items.wood || 0),
        carrots: inventory.carrots - (items.carrots || 0),
        pumpkins: inventory.pumpkins - (items.pumpkins || 0),
      },
    });
    return true;
  },

  hasResources: (cost) => {
    const { inventory } = get();
    return (
      inventory.hay >= (cost.hay || 0) &&
      inventory.wood >= (cost.wood || 0) &&
      inventory.carrots >= (cost.carrots || 0) &&
      inventory.pumpkins >= (cost.pumpkins || 0)
    );
  },

  spendResources: (cost) => {
    if (!get().hasResources(cost)) return false;
    get().removeFromInventory(cost);
    return true;
  },

  unlockResearch: (id) => {
    const state = get();
    const node = state.research.find((r) => r.id === id);
    if (!node || node.unlocked) return false;
    if (!state.hasResources(node.cost)) return false;
    if (!node.prerequisites.every((p) => state.research.find((r) => r.id === p)?.unlocked)) return false;

    state.spendResources(node.cost);
    set((s) => ({ research: s.research.map((r) => (r.id === id ? { ...r, unlocked: true } : r)) }));

    const effect = node.effect;
    if (effect.type === 'grid_expansion') {
      get().expandGrid(effect.size);
    } else if (effect.type === 'drone_memory') {
      set((s) => ({ droneMemorySlots: s.droneMemorySlots + effect.slots }));
    } else if (effect.type === 'drone_speed') {
      set((s) => ({ executionSpeed: Math.min(8, s.executionSpeed * effect.multiplier) }));
    }
    return true;
  },

  getUnlockedResearch: () => get().research.filter((r) => r.unlocked),

  getAvailableResearch: () => {
    const state = get();
    return state.research.filter(
      (r) => !r.unlocked && r.prerequisites.every((p) => state.research.find((n) => n.id === p)?.unlocked)
    );
  },

  expandGrid: (newSize) => {
    const clampedSize = Math.min(Math.max(newSize, 3), DEFAULT_GAME_CONFIG.maxGridSize);
    const { grid, config } = get();
    if (clampedSize <= config.gridSize) return;

    const newGrid = createInitialGrid(clampedSize);
    for (let y = 0; y < grid.length; y++) {
      for (let x = 0; x < grid[0].length; x++) {
        newGrid[y][x] = grid[y][x];
      }
    }
    set({ grid: newGrid, config: { ...config, gridSize: clampedSize } });
  },

  addScript: (name, content = DEFAULT_SCRIPT) => {
    const index = get().scripts.length;
    set((state) => ({ scripts: [...state.scripts, { name, content }] }));
    return index;
  },

  removeScript: (index) =>
    set((state) => {
      if (state.scripts.length <= 1) return state;
      const newScripts = state.scripts.filter((_, i) => i !== index);
      let newActiveIndex = state.activeScriptIndex;
      if (index < state.activeScriptIndex) newActiveIndex--;
      else if (index === state.activeScriptIndex) newActiveIndex = Math.max(0, index - 1);
      return { scripts: newScripts, activeScriptIndex: newActiveIndex };
    }),

  updateScript: (index, content) =>
    set((state) => ({
      scripts: state.scripts.map((s, i) => (i === index ? { ...s, content } : s)),
    })),

  renameScript: (index, name) =>
    set((state) => ({
      scripts: state.scripts.map((s, i) => (i === index ? { ...s, name } : s)),
    })),

  setActiveScript: (index) => set({ activeScriptIndex: index }),

  saveGame: () => {
    const state = get();
    return {
      grid: state.grid,
      drones: state.drones,
      research: state.research,
      inventory: state.inventory,
      scripts: state.scripts,
      config: state.config,
      version: 3,
    };
  },

  loadGame: (data) =>
    set({
      grid: data.grid,
      drones: data.drones && data.drones.length > 0 ? data.drones : [createDrone(0, START_POSITION)],
      research: data.research,
      inventory: data.inventory,
      scripts: data.scripts.length > 0 ? data.scripts : [{ name: 'main.py', content: DEFAULT_SCRIPT }],
      config: data.config,
      initialized: true,
    }),

  resetGame: () =>
    set({
      grid: createInitialGrid(DEFAULT_GAME_CONFIG.initialGridSize),
      drones: [createDrone(0, START_POSITION)],
      research: INITIAL_RESEARCH_NODES,
      inventory: DEFAULT_GAME_CONFIG.startingInventory,
      config: DEFAULT_GAME_CONFIG,
      gamePhase: 'idle',
    }),

  simulateCropGrowth: () =>
    set((state) => ({
      grid: state.grid.map((row) =>
        row.map((tile) => {
          if (!tile.cropType) return tile;
          const baseRate = CROP_GROWTH_RATES[tile.cropType] || 0.005;
          const moistureFactor = Math.max(0.6, tile.moisture);
          const growthDelta = baseRate * moistureFactor * tile.fertility;
          const consumption = CROP_MOISTURE_CONSUMPTION[tile.cropType] || 0.001;
          return {
            ...tile,
            growthStage: Math.min(1, tile.growthStage + growthDelta),
            moisture: Math.max(0, tile.moisture - consumption),
          };
        })
      ),
    })),

  simulateSoilMoisture: () =>
    set((state) => ({
      // Only bare-planted tiles need moisture tracked; leaving empty tiles
      // untouched keeps their object reference stable so unplanted areas of
      // the grid don't force a re-render every tick.
      grid: state.grid.map((row) =>
        row.map((tile) => {
          if (!tile.cropType || tile.moisture <= 0) return tile;
          return { ...tile, moisture: Math.max(0, tile.moisture - MOISTURE_EVAPORATION) };
        })
      ),
    })),

  checkPumpkinMerge: (x, y) =>
    set((state) => {
      const tile = state.grid[y]?.[x];
      if (!tile || tile.cropType !== 'pumpkin' || tile.growthStage < 1) return state;

      const neighbors = [
        { dx: 0, dy: -1 },
        { dx: 0, dy: 1 },
        { dx: 1, dy: 0 },
        { dx: -1, dy: 0 },
      ];
      const mergeTargets: Array<{ x: number; y: number }> = [];
      for (const n of neighbors) {
        const t = state.grid[y + n.dy]?.[x + n.dx];
        if (t && t.cropType === 'pumpkin' && t.growthStage >= 1) {
          mergeTargets.push({ x: x + n.dx, y: y + n.dy });
        }
      }
      if (mergeTargets.length < 2) return state;

      const newGrid = state.grid.map((row, ry) =>
        row.map((t, rx) => {
          if (mergeTargets.some((p) => p.x === rx && p.y === ry)) {
            return { ...t, cropType: 'grass' as const, growthStage: 0 };
          }
          return t;
        })
      );
      get().addToInventory({ pumpkins: mergeTargets.length + 1 });
      return { grid: newGrid };
    }),

  moveDrone: (droneId, direction) => {
    const state = get();
    const drone = state.drones[droneId];
    if (!drone) return { success: false, x: 0, y: 0 };
    const normalized = (typeof direction === 'string' ? direction.toLowerCase() : '') as Direction;
    const vector = DIRECTION_VECTORS[normalized];
    if (!vector) {
      return { success: false, x: drone.position.x, y: drone.position.y };
    }
    const newX = drone.position.x + vector.x;
    const newY = drone.position.y + vector.y;
    if (newX < 0 || newY < 0 || newX >= state.config.gridSize || newY >= state.config.gridSize) {
      get().updateDroneRotation(droneId, DIRECTION_ROTATIONS[normalized]);
      return { success: false, x: drone.position.x, y: drone.position.y };
    }
    get().updateDronePosition(droneId, { x: newX, y: newY });
    get().updateDroneRotation(droneId, DIRECTION_ROTATIONS[normalized]);
    get().setDroneMoving(droneId, true);
    return { success: true, x: newX, y: newY };
  },

  plantCrop: (droneId, cropType) => {
    const drone = get().drones[droneId];
    if (!drone) return false;
    const { position } = drone;
    if (!get().canPlantAt(position.x, position.y, cropType) || cropType === null) return false;
    get().setTile(position.x, position.y, {
      cropType,
      growthStage: 0,
      moisture: Math.max(get().getTile(position.x, position.y)?.moisture ?? 0.5, 0.3),
    });
    return true;
  },

  harvestCrop: (droneId) => {
    const drone = get().drones[droneId];
    if (!drone) return false;
    const { position } = drone;
    if (!get().canHarvestAt(position.x, position.y)) return false;
    const tile = get().getTile(position.x, position.y);
    if (!tile || !tile.cropType) return false;
    const cropDef = getCropDefinition(tile.cropType);
    get().addToInventory(cropDef.yield);
    // Bare ground doesn't stay bare - wild wheat regrows automatically,
    // same as the rest of the field.
    get().setTile(position.x, position.y, { cropType: 'grass', growthStage: 0 });
    return true;
  },

  waterTile: (droneId) => {
    const drone = get().drones[droneId];
    if (!drone) return false;
    const tile = get().getTile(drone.position.x, drone.position.y);
    if (!tile) return false;
    get().setTile(drone.position.x, drone.position.y, { moisture: Math.min(1, tile.moisture + 0.35) });
    return true;
  },

  tillTile: (droneId) => {
    const drone = get().drones[droneId];
    if (!drone) return false;
    const tile = get().getTile(drone.position.x, drone.position.y);
    if (!tile || tile.fertility >= MAX_FERTILITY) return false;
    get().setTile(drone.position.x, drone.position.y, {
      fertility: Math.min(MAX_FERTILITY, tile.fertility + TILL_BOOST),
    });
    return true;
  },

  getDronePos: (droneId) => {
    const drone = get().drones[droneId];
    if (!drone) return [0, 0];
    return [drone.position.x, drone.position.y];
  },

  canHarvestHere: (droneId) => {
    const drone = get().drones[droneId];
    if (!drone) return false;
    return get().canHarvestAt(drone.position.x, drone.position.y);
  },

  getCropAtDrone: (droneId) => {
    const drone = get().drones[droneId];
    if (!drone) return null;
    return get().getTile(drone.position.x, drone.position.y)?.cropType ?? null;
  },

  getMoistureAtDrone: (droneId) => {
    const drone = get().drones[droneId];
    if (!drone) return 0;
    return get().getTile(drone.position.x, drone.position.y)?.moisture ?? 0;
  },

  getGrowthAtDrone: (droneId) => {
    const drone = get().drones[droneId];
    if (!drone) return 0;
    return get().getTile(drone.position.x, drone.position.y)?.growthStage ?? 0;
  },
}));

export const useDrones = () => useGameStore((state) => state.drones);
export const useGamePhase = () => useGameStore((state) => state.gamePhase);
export const useGrid = () => useGameStore((state) => state.grid);
export const useInventory = () => useGameStore((state) => state.inventory);
export const useResearch = () => useGameStore((state) => state.research);
export const useScripts = () => useGameStore((state) => state.scripts);
export const useSelectedCrop = () => useGameStore((state) => state.selectedCrop);
export const useCameraPosition = () => useGameStore((state) => state.cameraPosition);
export const useCameraZoom = () => useGameStore((state) => state.cameraZoom);
export const useShowGrid = () => useGameStore((state) => state.showGrid);

export { DEFAULT_SCRIPT };
