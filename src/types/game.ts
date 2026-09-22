export type Direction = 'north' | 'south' | 'east' | 'west';
export type CropType = 'grass' | 'bush' | 'carrot' | 'pumpkin';
export type CropTypeNullable = CropType | null;
export type GamePhase = 'idle' | 'running' | 'paused';

export interface Vector2 {
  x: number;
  y: number;
}

export interface TileData {
  position: Vector2;
  cropType: CropTypeNullable;
  growthStage: number;
  moisture: number;
  fertility: number;
}

export interface DroneState {
  id: number;
  position: Vector2;
  targetPosition: Vector2;
  rotation: number;
  targetRotation: number;
  isMoving: boolean;
}

export interface Inventory {
  hay: number;
  wood: number;
  carrots: number;
  pumpkins: number;
}

export interface CropDefinition {
  type: CropType;
  name: string;
  growthTime: number;
  waterRequired: number;
  yield: Partial<Inventory>;
  color: string;
  height: number;
  unlockCost?: number;
  description: string;
}

export interface ResearchNode {
  id: string;
  name: string;
  description: string;
  // Paid directly out of harvested resources - hay, wood, carrots, pumpkins -
  // not a separate points currency.
  cost: Partial<Inventory>;
  prerequisites: string[];
  unlocked: boolean;
  effect: ResearchEffect;
  category: 'expansion' | 'crops' | 'drone';
}

export type ResearchEffect =
  | { type: 'grid_expansion'; size: number }
  | { type: 'unlock_crop'; cropType: CropType }
  | { type: 'drone_memory'; slots: number }
  | { type: 'drone_speed'; multiplier: number };

export interface GameConfig {
  gridSize: number;
  initialGridSize: number;
  maxGridSize: number;
  tickRate: number;
  droneMemorySlots: number;
  startingInventory: Inventory;
}

export interface ScriptFile {
  name: string;
  content: string;
}

export interface SaveData {
  grid: TileData[][];
  drones: DroneState[];
  research: ResearchNode[];
  inventory: Inventory;
  scripts: ScriptFile[];
  config: GameConfig;
  version: number;
}

export const CROP_DEFINITIONS: Record<CropType, CropDefinition> = {
  grass: {
    type: 'grass',
    name: 'Grass',
    growthTime: 30,
    waterRequired: 0,
    yield: { hay: 1 },
    color: '#6bb33e',
    height: 0.3,
    description: 'Basic crop, yields hay. Grows without water.',
  },
  bush: {
    type: 'bush',
    name: 'Bush',
    growthTime: 60,
    waterRequired: 1,
    yield: { wood: 2 },
    color: '#4a7c2e',
    height: 0.6,
    unlockCost: 50,
    description: 'Yields wood. Requires water to grow.',
  },
  carrot: {
    type: 'carrot',
    name: 'Carrot',
    growthTime: 90,
    waterRequired: 2,
    yield: { carrots: 3 },
    color: '#e67e22',
    height: 0.4,
    unlockCost: 150,
    description: 'Yields carrots. Requires more water.',
  },
  pumpkin: {
    type: 'pumpkin',
    name: 'Pumpkin',
    growthTime: 120,
    waterRequired: 3,
    yield: { pumpkins: 1 },
    color: '#d4761a',
    height: 0.5,
    unlockCost: 300,
    description: 'High-value crop. Adjacent mature pumpkins merge for bonus yield.',
  },
};

export const EMPTY_CROP_DEFINITION: CropDefinition = {
  type: 'grass',
  name: 'Empty',
  growthTime: 0,
  waterRequired: 0,
  yield: {},
  color: '#34495e',
  height: 0,
  description: 'Empty tile.',
};

export const INITIAL_RESEARCH_NODES: ResearchNode[] = [
  {
    id: 'expand_5x5',
    name: 'Grid Expansion: 5x5',
    description: 'Expand farm grid to 5x5',
    cost: { hay: 150 },
    prerequisites: [],
    unlocked: false,
    effect: { type: 'grid_expansion', size: 5 },
    category: 'expansion',
  },
  {
    id: 'expand_8x8',
    name: 'Grid Expansion: 8x8',
    description: 'Expand farm grid to 8x8',
    cost: { hay: 400, wood: 150 },
    prerequisites: ['expand_5x5'],
    unlocked: false,
    effect: { type: 'grid_expansion', size: 8 },
    category: 'expansion',
  },
  {
    id: 'expand_16x16',
    name: 'Grid Expansion: 16x16',
    description: 'Expand farm grid to 16x16',
    cost: { hay: 1000, wood: 400, carrots: 200 },
    prerequisites: ['expand_8x8'],
    unlocked: false,
    effect: { type: 'grid_expansion', size: 16 },
    category: 'expansion',
  },
  {
    id: 'unlock_bush',
    name: 'Unlock Bushes',
    description: 'Unlock bush crop type (yields wood)',
    cost: { hay: 60 },
    prerequisites: [],
    unlocked: false,
    effect: { type: 'unlock_crop', cropType: 'bush' },
    category: 'crops',
  },
  {
    id: 'unlock_carrot',
    name: 'Unlock Carrots',
    description: 'Unlock carrot crop type',
    cost: { wood: 80 },
    prerequisites: ['unlock_bush'],
    unlocked: false,
    effect: { type: 'unlock_crop', cropType: 'carrot' },
    category: 'crops',
  },
  {
    id: 'unlock_pumpkin',
    name: 'Unlock Pumpkins',
    description: 'Unlock pumpkin crop type (merges when adjacent)',
    cost: { carrots: 120 },
    prerequisites: ['unlock_carrot'],
    unlocked: false,
    effect: { type: 'unlock_crop', cropType: 'pumpkin' },
    category: 'crops',
  },
  {
    id: 'drone_memory_2',
    name: 'Drone Memory +2',
    description: 'Increase drone memory slots by 2',
    cost: { hay: 100, wood: 40 },
    prerequisites: [],
    unlocked: false,
    effect: { type: 'drone_memory', slots: 2 },
    category: 'drone',
  },
  {
    id: 'drone_speed_2x',
    name: 'Drone Speed 2x',
    description: 'Double drone action speed',
    cost: { wood: 150, pumpkins: 30 },
    prerequisites: ['drone_memory_2'],
    unlocked: false,
    effect: { type: 'drone_speed', multiplier: 2 },
    category: 'drone',
  },
];

export const DEFAULT_GAME_CONFIG: GameConfig = {
  gridSize: 3,
  initialGridSize: 3,
  maxGridSize: 32,
  tickRate: 200,
  droneMemorySlots: 4,
  startingInventory: {
    hay: 10,
    wood: 0,
    carrots: 0,
    pumpkins: 0,
  },
};

export const DIRECTION_VECTORS: Record<Direction, Vector2> = {
  north: { x: 0, y: -1 },
  south: { x: 0, y: 1 },
  east: { x: 1, y: 0 },
  west: { x: -1, y: 0 },
};

export const DIRECTION_ROTATIONS: Record<Direction, number> = {
  north: Math.PI,
  south: 0,
  east: -Math.PI / 2,
  west: Math.PI / 2,
};

export function getCropDefinition(crop: CropTypeNullable): CropDefinition {
  if (crop === null) return EMPTY_CROP_DEFINITION;
  return CROP_DEFINITIONS[crop];
}
