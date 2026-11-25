// Kitchen dimensions, dining pass geometry, live °C heat curves, and 3-biome shift definitions.

export const CANVAS_WIDTH = 1280;
export const CANVAS_HEIGHT = 800;
export const FIXED_STEP = 1 / 60;

export const HUD_HEIGHT = 146;
export const WALL_HEIGHT = 80;
export const GRID_ORIGIN_X = 22;
export const GRID_ORIGIN_Y = HUD_HEIGHT + WALL_HEIGHT; // 226
export const GRID_COLS = 12;
export const GRID_ROWS = 5;
export const TILE_SIZE = 92;

export const DINING_X = GRID_ORIGIN_X + GRID_COLS * TILE_SIZE; // 1126 (154px candlelit dining room!)
export const FOOTER_Y = GRID_ORIGIN_Y + GRID_ROWS * TILE_SIZE + 14; // 700
export const FOOTER_HEIGHT = CANVAS_HEIGHT - FOOTER_Y; // 100

export const CHEF_CONFIG = {
  radius: 24,
  speed: 325,
  feverSpeedMultiplier: 1.22,
  dashSpeed: 700,
  dashDuration: 0.16,
  dashCooldown: 0.7,
  interactRange: 102,
  chopDuration: 0.82,
  tapChopBoost: 0.24,
};

export const TIMING = {
  potBoilDuration: 3.3,
  potSweetEnd: 6.4,
  potWarnTime: 8.5,
  potBurnTime: 11.4,

  sauceSimmerDuration: 3.0,
  sauceSweetEnd: 6.0,
  sauceWarnTime: 8.2,
  sauceBurnTime: 11.2,

  skilletSteakDuration: 3.7,
  skilletSteakSweetEnd: 6.0,
  skilletSteakWarn: 6.9,
  skilletSteakBurn: 9.3,

  skilletSalmonDuration: 3.2,
  skilletSalmonSweetEnd: 5.6,
  skilletSalmonWarn: 6.6,
  skilletSalmonBurn: 9.0,

  skilletMushroomDuration: 2.8,
  skilletMushroomSweetEnd: 5.2,
  skilletMushroomWarn: 6.4,
  skilletMushroomBurn: 8.8,

  ovenToastDuration: 2.3,
  ovenToastSweetEnd: 4.8,
  ovenToastWarn: 6.0,
  ovenToastBurn: 8.4,

  ovenBakeDuration: 3.5,
  ovenBakeSweetEnd: 6.0,
  ovenBakeWarn: 7.0,
  ovenBakeBurn: 9.4,

  perfectBonusRatio: 0.35,
  feverThreshold: 3,
  feverDuration: 18,
  passShowcaseSeconds: 12,
};

export const SHIFTS = [
  {
    id: 'lunch',
    biomeId: 'morning',
    name: 'Amalfi Morning',
    subtitle: 'Bruschetta, Saffron Pasta & Hearth Classics',
    durationSec: 150,
    maxOrders: 4,
    spawnIntervalBase: 14.0,
    spawnIntervalRush: 10.2,
    rushStartSec: 55,
    vipChance: 0.16,
    patienceScale: 1.08,
    starTargets: [160, 270, 390],
    menu: [
      'bruschetta',
      'saffron_crostini',
      'pomodoro_pasta',
      'saffron_pasta',
      'margherita',
      'citrus_salmon',
    ],
  },
  {
    id: 'dinner',
    biomeId: 'sunset',
    name: 'Golden Hour Rush',
    subtitle: 'Seared Ribeye, Wild Salmon & Brick Hearth',
    durationSec: 165,
    maxOrders: 5,
    spawnIntervalBase: 11.8,
    spawnIntervalRush: 8.4,
    rushStartSec: 60,
    vipChance: 0.25,
    patienceScale: 0.98,
    starTargets: [220, 360, 500],
    menu: [
      'bruschetta',
      'pomodoro_pasta',
      'porcini_pasta',
      'margherita',
      'funghi_flatbread',
      'citrus_salmon',
      'salmon_pasta',
      'seared_ribeye',
      'chefs_tasting',
    ],
  },
  {
    id: 'gala',
    biomeId: 'gala',
    name: "Candlelit Critic's Gala",
    subtitle: 'Full 12-Dish Tasting Service & Surf & Turf',
    durationSec: 180,
    maxOrders: 5,
    spawnIntervalBase: 10.2,
    spawnIntervalRush: 7.4,
    rushStartSec: 70,
    vipChance: 0.36,
    patienceScale: 0.92,
    starTargets: [290, 460, 640],
    menu: [
      'pomodoro_pasta',
      'saffron_pasta',
      'porcini_pasta',
      'margherita',
      'funghi_flatbread',
      'citrus_salmon',
      'salmon_pasta',
      'seared_ribeye',
      'chefs_tasting',
      'surf_and_turf',
    ],
  },
];

export const PALETTE = {
  floorLight: '#d89b6e',
  floorDark: '#c78557',
  floorGrout: '#9d623d',
  wallTile: '#f5ead6',
  wallGrout: '#dfd0b5',
  oakTop: '#d7a164',
  oakLight: '#e7b980',
  oakFront: '#8c552b',
  oakShadow: '#5e3418',
  brass: '#dca544',
  brassBright: '#f6d27a',
  brassDark: '#8b5e1f',
  copper: '#cf7446',
  copperHighlight: '#f2a577',
  iron: '#2d2b2e',
  ironEdge: '#4c494f',
  brick: '#9e4733',
  brickDark: '#6c2b1e',
  cream: '#fbf4e3',
  espresso: '#23160f',
  emerald: '#35a162',
  amber: '#e49a24',
  crimson: '#d94136',
  gold: '#f5c242',
};

export function tileCenter(col, row) {
  return {
    x: GRID_ORIGIN_X + (col + 0.5) * TILE_SIZE,
    y: GRID_ORIGIN_Y + (row + 0.5) * TILE_SIZE,
  };
}

export function tileRect(col, row) {
  return {
    x: GRID_ORIGIN_X + col * TILE_SIZE,
    y: GRID_ORIGIN_Y + row * TILE_SIZE,
    w: TILE_SIZE,
    h: TILE_SIZE,
  };
}
