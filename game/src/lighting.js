// Dynamic 3-biome bistro lighting: sunlit Mediterranean morning, golden-hour sunset, and candlelit twilight gala.

import {
  CANVAS_WIDTH,
  DINING_X,
  FOOTER_Y,
  GRID_COLS,
  GRID_ORIGIN_X,
  GRID_ORIGIN_Y,
  GRID_ROWS,
  HUD_HEIGHT,
  TILE_SIZE,
  WALL_HEIGHT,
  tileCenter,
} from './config.js';
import { STATION_TYPES } from './kitchen.js';

export const BIOMES = {
  morning: {
    id: 'morning',
    label: 'Amalfi Morning',
    skyTop: '#6ec1e8',
    skyMid: '#bce8f7',
    skyBottom: '#fff2c2',
    beamColor: [255, 246, 206],
    beamAlpha: 0.12,
    ambientTint: 'rgba(255, 245, 214, 0.03)',
    pendantIntensity: 0.1,
    starsVisible: false,
    stringLights: false,
    wallTint: '#f7eedc',
  },
  sunset: {
    id: 'sunset',
    label: 'Golden Hour Sunset',
    skyTop: '#d46a4c',
    skyMid: '#f2a45a',
    skyBottom: '#ffe08c',
    beamColor: [255, 198, 108],
    beamAlpha: 0.16,
    ambientTint: 'rgba(245, 148, 62, 0.06)',
    pendantIntensity: 0.16,
    starsVisible: false,
    stringLights: true,
    wallTint: '#f2dec0',
  },
  gala: {
    id: 'gala',
    label: 'Candlelit Twilight Gala',
    skyTop: '#16213e',
    skyMid: '#2a3560',
    skyBottom: '#5e496b',
    beamColor: [255, 212, 128],
    beamAlpha: 0.07,
    ambientTint: 'rgba(18, 22, 54, 0.22)',
    pendantIntensity: 0.22,
    starsVisible: true,
    stringLights: true,
    wallTint: '#e3cea9',
  },
};

export function getBiomeForShift(shiftIndex) {
  if (shiftIndex === 0) return BIOMES.morning;
  if (shiftIndex === 2) return BIOMES.gala;
  return BIOMES.sunset;
}

export function renderBiomeWindowSky(ctx, wx, y0, biome, time) {
  const skyGrad = ctx.createLinearGradient(wx, y0 + 14, wx, y0 + 68);
  skyGrad.addColorStop(0, biome.skyTop);
  skyGrad.addColorStop(0.6, biome.skyMid);
  skyGrad.addColorStop(1, biome.skyBottom);
  ctx.fillStyle = skyGrad;
  ctx.beginPath();
  ctx.roundRect(wx - 48, y0 + 13, 96, 54, [28, 28, 2, 2]);
  ctx.fill();

  if (biome.starsVisible) {
    ctx.fillStyle = '#fff5cc';
    const stars = [
      [-28, 24],
      [-10, 19],
      [16, 22],
      [32, 30],
      [-18, 35],
      [22, 36],
    ];
    for (let i = 0; i < stars.length; i++) {
      const [sx, sy] = stars[i];
      const tw = 0.55 + Math.sin(time * 4 + i * 1.9) * 0.45;
      ctx.globalAlpha = tw;
      ctx.beginPath();
      ctx.arc(wx + sx, y0 + sy, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Warm crescent moon in gala sky
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = '#ffe594';
    ctx.beginPath();
    ctx.arc(wx + 24, y0 + 28, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = biome.skyTop;
    ctx.beginPath();
    ctx.arc(wx + 27, y0 + 26, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  if (biome.stringLights) {
    // Festive warm Mediterranean bistro café string lights across window arch
    ctx.strokeStyle = 'rgba(54, 34, 22, 0.7)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(wx - 46, y0 + 28);
    ctx.quadraticCurveTo(wx, y0 + 42, wx + 46, y0 + 28);
    ctx.stroke();

    for (let i = -2; i <= 2; i++) {
      const lx = wx + i * 18;
      const ly = y0 + 34 - Math.abs(i) * 1.6;
      const glow = ctx.createRadialGradient(lx, ly, 1, lx, ly, 9);
      glow.addColorStop(0, 'rgba(255, 236, 150, 0.95)');
      glow.addColorStop(1, 'rgba(255, 190, 64, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(lx, ly, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff9d6';
      ctx.beginPath();
      ctx.arc(lx, ly, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export function renderKitchenLighting(ctx, kitchen, biome, time, fever) {
  ctx.save();

  // 1. Biome ambient color wash over playable kitchen floor
  ctx.fillStyle = biome.ambientTint;
  ctx.fillRect(
    GRID_ORIGIN_X,
    GRID_ORIGIN_Y,
    GRID_COLS * TILE_SIZE,
    GRID_ROWS * TILE_SIZE,
  );

  // 2. Diagonal sunbeams or twilight window shafts
  const [br, bg, bb] = biome.beamColor;
  const shimmer = biome.beamAlpha + Math.sin(time * 0.9) * 0.015;
  for (const wx of [164, 792]) {
    const grad = ctx.createLinearGradient(wx, GRID_ORIGIN_Y - 10, wx + 150, FOOTER_Y);
    grad.addColorStop(0, `rgba(${br}, ${bg}, ${bb}, ${shimmer * 1.35})`);
    grad.addColorStop(0.55, `rgba(${br}, ${bg}, ${bb}, ${shimmer * 0.65})`);
    grad.addColorStop(1, `rgba(${br}, ${bg}, ${bb}, 0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(wx - 46, GRID_ORIGIN_Y - 10);
    ctx.lineTo(wx + 46, GRID_ORIGIN_Y - 10);
    ctx.lineTo(wx + 220, FOOTER_Y);
    ctx.lineTo(wx + 70, FOOTER_Y);
    ctx.closePath();
    ctx.fill();
  }

  // 3. Overhead Brass Pendant Lamp warm light pools (gentle alpha blend so counters stay crisp!)
  const lamps = [
    tileCenter(5.5, 2),
    tileCenter(5.5, 4),
    tileCenter(11, 2.5),
  ];
  for (const lamp of lamps) {
    const rad = ctx.createRadialGradient(lamp.x, lamp.y, 12, lamp.x, lamp.y, 165);
    rad.addColorStop(0, `rgba(255, 214, 126, ${biome.pendantIntensity})`);
    rad.addColorStop(0.55, `rgba(255, 178, 82, ${biome.pendantIntensity * 0.45})`);
    rad.addColorStop(1, 'rgba(255, 160, 56, 0)');
    ctx.fillStyle = rad;
    ctx.beginPath();
    ctx.arc(lamp.x, lamp.y, 165, 0, Math.PI * 2);
    ctx.fill();
  }

  // 4. Live flickering hearth & burner glow around active cooking stations
  for (const st of kitchen.stations) {
    if (st.type === STATION_TYPES.OVEN && st.ovenSide === 'left') {
      const pos = tileCenter(st.col + 0.5, st.row);
      const flick = 0.24 + Math.sin(time * 13) * 0.04;
      const og = ctx.createRadialGradient(pos.x, pos.y + 34, 8, pos.x, pos.y + 52, 130);
      og.addColorStop(0, `rgba(255, 138, 42, ${flick})`);
      og.addColorStop(1, 'rgba(255, 92, 22, 0)');
      ctx.fillStyle = og;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y + 52, 130, 0, Math.PI * 2);
      ctx.fill();
    } else if ((st.type === STATION_TYPES.SKILLET || st.type === STATION_TYPES.POT) && st.cook) {
      const pos = tileCenter(st.col, st.row);
      const isSweet = st.cook.state === 'sweet';
      const sg = ctx.createRadialGradient(pos.x, pos.y, 6, pos.x, pos.y, 58);
      sg.addColorStop(0, isSweet ? 'rgba(255, 220, 82, 0.22)' : 'rgba(255, 136, 48, 0.16)');
      sg.addColorStop(1, 'rgba(255, 120, 32, 0)');
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 58, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 5. Candlelit Bistro Dining Room warm candle glow pools
  for (let i = 0; i < 3; i++) {
    const cx = DINING_X + 64;
    const cy = GRID_ORIGIN_Y + 95 + i * 145;
    const flicker = 0.24 + Math.sin(time * 10 + i * 2.1) * 0.05;
    const cg = ctx.createRadialGradient(cx, cy, 4, cx, cy, 62);
    cg.addColorStop(0, `rgba(255, 214, 112, ${flicker})`);
    cg.addColorStop(1, 'rgba(255, 150, 48, 0)');
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.arc(cx, cy, 62, 0, Math.PI * 2);
    ctx.fill();
  }

  // 6. Fever golden radiance shimmer
  if (fever) {
    const pulse = 0.08 + Math.sin(time * 7) * 0.035;
    ctx.fillStyle = `rgba(255, 206, 68, ${pulse})`;
    ctx.fillRect(GRID_ORIGIN_X, GRID_ORIGIN_Y, CANVAS_WIDTH - GRID_ORIGIN_X, FOOTER_Y - GRID_ORIGIN_Y);
  }

  ctx.restore();

  // Subtle architectural corner shadow vignette for cozy depth
  ctx.save();
  const wallEdge = ctx.createLinearGradient(0, HUD_HEIGHT + WALL_HEIGHT, 0, HUD_HEIGHT + WALL_HEIGHT + 24);
  wallEdge.addColorStop(0, 'rgba(32, 16, 7, 0.28)');
  wallEdge.addColorStop(1, 'rgba(32, 16, 7, 0)');
  ctx.fillStyle = wallEdge;
  ctx.fillRect(0, GRID_ORIGIN_Y, CANVAS_WIDTH, 24);
  ctx.restore();
}
