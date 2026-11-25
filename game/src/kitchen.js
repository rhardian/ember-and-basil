// Spatial kitchen layout with 8 fresh pantry crates, dual copper pots, skillets, 420°C brick oven, and dining pass.

import { GRID_COLS, GRID_ORIGIN_X, GRID_ORIGIN_Y, GRID_ROWS, TILE_SIZE } from './config.js';

export const STATION_TYPES = {
  PANTRY: 'pantry',
  CHOP: 'chop',
  POT: 'pot',
  SKILLET: 'skillet',
  OVEN: 'oven',
  PLATE_STACK: 'plate_stack',
  COUNTER: 'counter',
  PASS_HOLD: 'pass_hold',
  SERVE_BELL: 'serve_bell',
  SHOWCASE: 'showcase',
  COMPOST: 'compost',
};

const LAYOUT_BLUEPRINT = [
  // Row 0: Fresh Pantry Line (cols 0..5) + Live °C Hot Cooking Line (cols 6..11)
  { col: 0, row: 0, type: STATION_TYPES.PANTRY, ingredient: 'tomato', label: 'Tomato' },
  { col: 1, row: 0, type: STATION_TYPES.PANTRY, ingredient: 'basil', label: 'Basil' },
  { col: 2, row: 0, type: STATION_TYPES.PANTRY, ingredient: 'mushroom', label: 'Porcini' },
  { col: 3, row: 0, type: STATION_TYPES.PANTRY, ingredient: 'steak', label: 'Ribeye' },
  { col: 4, row: 0, type: STATION_TYPES.PANTRY, ingredient: 'pasta', label: 'Pasta' },
  { col: 5, row: 0, type: STATION_TYPES.PANTRY, ingredient: 'dough', label: 'Dough' },
  { col: 6, row: 0, type: STATION_TYPES.POT, label: 'Stockpot 1' },
  { col: 7, row: 0, type: STATION_TYPES.POT, label: 'Stockpot 2' },
  { col: 8, row: 0, type: STATION_TYPES.SKILLET, label: 'Skillet 1' },
  { col: 9, row: 0, type: STATION_TYPES.SKILLET, label: 'Skillet 2' },
  { col: 10, row: 0, type: STATION_TYPES.OVEN, ovenSide: 'left', label: 'Stone Oven 1' },
  { col: 11, row: 0, type: STATION_TYPES.OVEN, ovenSide: 'right', label: 'Stone Oven 2' },

  // Row 2: Coastal Salmon Ice Tray + Central Butcher-Block Prep & Assembly Island + Warm Service Pass
  { col: 0, row: 2, type: STATION_TYPES.PANTRY, ingredient: 'salmon', label: 'Salmon' },
  { col: 3, row: 2, type: STATION_TYPES.CHOP, label: 'Chop Board 1' },
  { col: 4, row: 2, type: STATION_TYPES.CHOP, label: 'Chop Board 2' },
  { col: 5, row: 2, type: STATION_TYPES.COUNTER, role: 'assembly', label: 'Assembly 1' },
  { col: 6, row: 2, type: STATION_TYPES.COUNTER, role: 'assembly', label: 'Assembly 2' },
  { col: 7, row: 2, type: STATION_TYPES.COUNTER, role: 'garnish', label: 'Garnish Bench' },
  { col: 8, row: 2, type: STATION_TYPES.PLATE_STACK, label: 'Warm Plates' },
  { col: 11, row: 2, type: STATION_TYPES.PASS_HOLD, label: 'Warm Pass' },

  // Row 3: Golden Saffron & Lemon Crate + Brass Service Pass Bell
  { col: 0, row: 3, type: STATION_TYPES.PANTRY, ingredient: 'saffron', label: 'Saffron' },
  { col: 11, row: 3, type: STATION_TYPES.SERVE_BELL, label: 'Serve Pass' },

  // Row 4: Compost Bin + Front Oak Prep Rail & Plate Stack 2 + Dining Pass Showcase
  { col: 0, row: 4, type: STATION_TYPES.COMPOST, label: 'Compost' },
  { col: 3, row: 4, type: STATION_TYPES.PLATE_STACK, label: 'Plates' },
  { col: 4, row: 4, type: STATION_TYPES.CHOP, label: 'Chop Board 3' },
  { col: 5, row: 4, type: STATION_TYPES.COUNTER, role: 'assembly', label: 'Plating Bench' },
  { col: 6, row: 4, type: STATION_TYPES.COUNTER, role: 'assembly', label: 'Holding Bench' },
  { col: 7, row: 4, type: STATION_TYPES.COUNTER, role: 'spice', label: 'Spice Counter' },
  { col: 8, row: 4, type: STATION_TYPES.COUNTER, role: 'prep', label: 'Staging Bench' },
  { col: 11, row: 4, type: STATION_TYPES.SHOWCASE, label: 'Dining Pass' },
];

export function createKitchen() {
  const grid = Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(null));
  const stations = LAYOUT_BLUEPRINT.map((spec, idx) => {
    const station = {
      id: `st_${idx}`,
      col: spec.col,
      row: spec.row,
      type: spec.type,
      label: spec.label,
      ingredient: spec.ingredient ?? null,
      role: spec.role ?? null,
      ovenSide: spec.ovenSide ?? null,
      item: null,
      cook: null,
      chopProgress: 0,
      bellPulse: 0,
      highlightPulse: 0,
      bounce: 0,
      showcase: null,
    };
    grid[spec.row][spec.col] = station;
    return station;
  });

  return { cols: GRID_COLS, rows: GRID_ROWS, grid, stations };
}

export function getStationAt(kitchen, col, row) {
  if (col < 0 || col >= kitchen.cols || row < 0 || row >= kitchen.rows) return null;
  return kitchen.grid[row][col];
}

export function isTileWalkable(kitchen, col, row) {
  if (col < 0 || col >= kitchen.cols || row < 0 || row >= kitchen.rows) return false;
  return kitchen.grid[row][col] === null;
}

export function worldToTile(x, y) {
  return {
    col: Math.floor((x - GRID_ORIGIN_X) / TILE_SIZE),
    row: Math.floor((y - GRID_ORIGIN_Y) / TILE_SIZE),
  };
}

export function tileFromPointer(x, y) {
  const col = Math.floor((x - GRID_ORIGIN_X) / TILE_SIZE);
  const row = Math.floor((y - GRID_ORIGIN_Y) / TILE_SIZE);
  if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return null;
  return { col, row };
}

export function findStationByType(kitchen, type, predicate = null) {
  for (const st of kitchen.stations) {
    if (st.type !== type) continue;
    if (!predicate || predicate(st)) return st;
  }
  return null;
}

export function getWalkableNeighbors(kitchen, col, row) {
  const dirs = [
    [0, 1],
    [0, -1],
    [-1, 0],
    [1, 0],
  ];
  const result = [];
  for (const [dc, dr] of dirs) {
    const nc = col + dc;
    const nr = row + dr;
    if (isTileWalkable(kitchen, nc, nr)) {
      result.push({ col: nc, row: nr });
    }
  }
  return result;
}
