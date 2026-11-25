// Kitchen dimensions, grid geometry, timing balance, and service shift definitions.

export const CANVAS_WIDTH = 1280;
export const CANVAS_HEIGHT = 800;
export const FIXED_STEP = 1 / 60;

export const HUD_HEIGHT = 146;
export const WALL_HEIGHT = 80;
export const GRID_ORIGIN_X = 64;
export const GRID_ORIGIN_Y = HUD_HEIGHT + WALL_HEIGHT; // 226
export const GRID_COLS = 12;
export const GRID_ROWS = 5;
export const TILE_SIZE = 96;

export const FOOTER_Y = GRID_ORIGIN_Y + GRID_ROWS * TILE_SIZE; // 706
export const FOOTER_HEIGHT = CANVAS_HEIGHT - FOOTER_Y; // 94

export const CHEF_CONFIG = {
  radius: 26,
  speed: 318,
  feverSpeedMultiplier: 1.22,
  dashSpeed: 690,
  dashDuration: 0.16,
  dashCooldown: 0.72,
  interactRange: 104,
  chopDuration: 0.85,
  tapChopBoost: 0.22,
};

export const TIMING = {
  potBoilDuration: 3.4,
  potSweetEnd: 6.4,
  potWarnTime: 8.4,
  potBurnTime: 11.4,

  sauceSimmerDuration: 3.1,
  sauceSweetEnd: 6.0,
  sauceWarnTime: 8.2,
  sauceBurnTime: 11.2,

  skilletSteakDuration: 3.8,
  skilletSteakSweetEnd: 6.0,
  skilletSteakWarn: 6.8,
  skilletSteakBurn: 9.2,

  skilletMushroomDuration: 2.9,
  skilletMushroomSweetEnd: 5.2,
  skilletMushroomWarn: 6.4,
  skilletMushroomBurn: 8.8,

  ovenToastDuration: 2.3,
  ovenToastSweetEnd: 4.8,
  ovenToastWarn: 6.0,
  ovenToastBurn: 8.4,

  ovenBakeDuration: 3.6,
  ovenBakeSweetEnd: 6.0,
  ovenBakeWarn: 7.0,
  ovenBakeBurn: 9.4,

  comboDecayBonus: 0.35,
  perfectBonusRatio: 0.35,
  feverThreshold: 3,
  feverDuration: 18,
  passShowcaseSeconds: 12,
};

export const SHIFTS = [
  {
    id: 'lunch',
    name: 'Sunlit Lunch',
    subtitle: 'Bruschetta, Pasta & Hearth Classics',
    durationSec: 150,
    maxOrders: 4,
    spawnIntervalBase: 14.5,
    spawnIntervalRush: 10.5,
    rushStartSec: 55,
    vipChance: 0.14,
    patienceScale: 1.08,
    starTargets: [140, 240, 340],
    menu: ['bruschetta', 'pomodoro_pasta', 'porcini_pasta', 'margherita', 'seared_ribeye'],
  },
  {
    id: 'dinner',
    name: 'Golden Hour Rush',
    subtitle: 'Wood-Fired Pies, Ribeye & Critic Visits',
    durationSec: 165,
    maxOrders: 5,
    spawnIntervalBase: 12.2,
    spawnIntervalRush: 8.6,
    rushStartSec: 65,
    vipChance: 0.24,
    patienceScale: 0.98,
    starTargets: [200, 330, 460],
    menu: [
      'bruschetta',
      'pomodoro_pasta',
      'porcini_pasta',
      'margherita',
      'funghi_flatbread',
      'seared_ribeye',
      'chefs_tasting',
    ],
  },
  {
    id: 'gala',
    name: "Critic's Gala",
    subtitle: 'High-Pressure Full Tasting Service',
    durationSec: 180,
    maxOrders: 5,
    spawnIntervalBase: 10.5,
    spawnIntervalRush: 7.5,
    rushStartSec: 75,
    vipChance: 0.35,
    patienceScale: 0.9,
    starTargets: [260, 420, 580],
    menu: [
      'pomodoro_pasta',
      'porcini_pasta',
      'margherita',
      'funghi_flatbread',
      'seared_ribeye',
      'chefs_tasting',
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
  oakFront: '#925b31',
  oakShadow: '#643a1d',
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
