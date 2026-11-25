// Painterly 2.5D sunlit bistro renderer: procedural textures, 3 lighting biomes, dual-chef brigade, live °C gauges, candlelit dining bar, and upgrade workshop.

import { getActiveChef } from './chef.js';
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  DINING_X,
  FOOTER_HEIGHT,
  FOOTER_Y,
  GRID_COLS,
  GRID_ORIGIN_X,
  GRID_ORIGIN_Y,
  GRID_ROWS,
  HUD_HEIGHT,
  PALETTE,
  SHIFTS,
  TILE_SIZE,
  WALL_HEIGHT,
  tileCenter,
  tileRect,
} from './config.js';
import {
  getActionPromptForStation,
  getLiveTemperatureC,
  getSuggestedStationTypes,
} from './cooking.js';
import { renderDiningPassGuests } from './diners.js';
import {
  drawDishPreview,
  drawIngredientArt,
  drawKitchenItem,
  drawPerfectStarBadge,
  drawPorcelainPlate,
  drawStatusPill,
} from './food-art.js';
import { STATION_TYPES } from './kitchen.js';
import { getBiomeForShift, renderBiomeWindowSky, renderKitchenLighting } from './lighting.js';
import { computeStarRating, isFeverActive } from './orders.js';
import { renderParticles } from './particles.js';
import { INGREDIENTS, RECIPES, describeItem, findClosestRecipesForPlate } from './recipes.js';
import { getFloorPattern, getWoodPattern } from './textures.js';
import { BISTRO_UPGRADES } from './upgrades.js';

export const SCREEN_MODES = {
  TITLE: 'title',
  PLAYING: 'playing',
  PAUSED: 'paused',
  RECIPES: 'recipes',
  UPGRADES: 'upgrades',
  SUMMARY: 'summary',
};

function formatClock(seconds) {
  const clamped = Math.max(0, Math.ceil(seconds));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function collectAvailableParts(kitchen, brigade) {
  const parts = new Set();
  const inspect = (item) => {
    if (!item) return;
    if (item.kind === 'ingredient') parts.add(item.id);
    else if (item.kind === 'plate' || item.kind === 'raw_pie') {
      for (const p of item.parts) parts.add(p);
    }
  };
  for (const chef of brigade.chefs) inspect(chef.heldItem);
  for (const st of kitchen.stations) {
    inspect(st.item);
    if (st.cook && st.cook.state !== 'burnt') parts.add(st.cook.outputId);
  }
  return parts;
}

export function renderGame(ctx, state) {
  const {
    time,
    screen,
    kitchen,
    brigade,
    orders,
    diningRoom,
    textures,
    fx,
    hoveredStation,
    targetStation,
  } = state;
  const activeChef = getActiveChef(brigade);
  const biome = getBiomeForShift(state.selectedShiftIndex);

  ctx.save();
  if (fx.shakeTime > 0 && fx.shakePower > 0) {
    const sx = (Math.sin(time * 91) * fx.shakePower * fx.shakeTime) / 0.22;
    const sy = (Math.cos(time * 79) * fx.shakePower * fx.shakeTime) / 0.22;
    ctx.translate(sx, sy);
  }

  // 1. Kitchen Subway-Tile Wall, Biome Windows, Floor & Candlelit Dining Room
  drawBistroWall(ctx, biome, time);
  drawKitchenFloor(ctx, textures);
  renderDiningPassGuests(ctx, diningRoom, orders, textures, time);

  // 2. Dual-Chef Queued Route Path Lines on Terracotta Floor
  for (const chef of brigade.chefs) {
    if (chef.autoPath.length > 0) {
      drawChefRoutePreview(ctx, chef);
    }
  }

  // 3. Stations & Both Chefs interleaved row-by-row for true 2.5D depth sorting
  const suggestedTypes = getSuggestedStationTypes(activeChef.heldItem);
  const drawnChefs = new Set();

  for (let row = 0; row < GRID_ROWS; row++) {
    const rowBottomY = GRID_ORIGIN_Y + (row + 1) * TILE_SIZE;
    const rowChefs = brigade.chefs
      .filter((c) => !drawnChefs.has(c.id) && c.y < rowBottomY - 18)
      .sort((a, b) => a.y - b.y);
    for (const c of rowChefs) {
      drawChefCharacter(ctx, c, c === activeChef, time, isFeverActive(orders));
      drawnChefs.add(c.id);
    }

    for (let col = 0; col < GRID_COLS; col++) {
      const st = kitchen.grid[row][col];
      if (!st) continue;
      if (st.type === STATION_TYPES.OVEN && st.ovenSide === 'right') continue;
      drawStation(ctx, st, kitchen, textures, time, {
        isHovered: hoveredStation === st,
        isTarget: targetStation === st,
        isSuggested: suggestedTypes.has(st.type),
        heldItem: activeChef.heldItem,
      });
    }
  }
  const restChefs = brigade.chefs.filter((c) => !drawnChefs.has(c.id)).sort((a, b) => a.y - b.y);
  for (const c of restChefs) {
    drawChefCharacter(ctx, c, c === activeChef, time, isFeverActive(orders));
  }

  // 4. Dynamic 3-Biome Lighting, Pendant Lamp Pools, Hearth Firelight & Candlelight
  renderKitchenLighting(ctx, kitchen, biome, time, isFeverActive(orders));

  // 5. Culinary Particles & Floating Score Popups
  renderParticles(ctx, fx);

  // 6. Top Order Ticket Rail & Brass Shift Clock HUD
  const availableParts = collectAvailableParts(kitchen, brigade);
  drawTopHudAndTickets(ctx, state, availableParts, biome);

  // 7. Bottom Interactive Brigade, Hand Status & Quick Menu Footer
  drawFooterBar(ctx, state);

  // 8. Urgency Frame Glow & Rush Banner
  if (screen === SCREEN_MODES.PLAYING) {
    drawUrgencyAndBanners(ctx, state);
  }

  // 9. Contextual Station Hover Tooltip
  if (screen === SCREEN_MODES.PLAYING && hoveredStation) {
    drawHoverTooltip(ctx, hoveredStation, activeChef.heldItem);
  }

  ctx.restore();

  // 10. Overlays
  if (screen === SCREEN_MODES.TITLE) drawTitleOverlay(ctx, state);
  else if (screen === SCREEN_MODES.RECIPES) drawRecipeBookOverlay(ctx, state);
  else if (screen === SCREEN_MODES.UPGRADES) drawUpgradesOverlay(ctx, state);
  else if (screen === SCREEN_MODES.PAUSED) drawPauseOverlay(ctx, state);
  else if (screen === SCREEN_MODES.SUMMARY) drawSummaryOverlay(ctx, state);
}

function drawBistroWall(ctx, biome, time) {
  const y0 = HUD_HEIGHT;
  const h = WALL_HEIGHT;

  const wallGrad = ctx.createLinearGradient(0, y0, 0, y0 + h);
  wallGrad.addColorStop(0, '#e5d1b2');
  wallGrad.addColorStop(1, biome.wallTint);
  ctx.fillStyle = wallGrad;
  ctx.fillRect(0, y0, CANVAS_WIDTH, h);

  // Subway tile brickwork
  ctx.strokeStyle = PALETTE.wallGrout;
  ctx.lineWidth = 1;
  const tileW = 34;
  const tileH = 16;
  for (let row = 0; row * tileH < h; row++) {
    const ty = y0 + row * tileH;
    ctx.beginPath();
    ctx.moveTo(0, ty);
    ctx.lineTo(CANVAS_WIDTH, ty);
    ctx.stroke();
    const offset = (row % 2) * (tileW / 2);
    for (let x = -offset; x < CANVAS_WIDTH; x += tileW) {
      ctx.beginPath();
      ctx.moveTo(x, ty);
      ctx.lineTo(x, Math.min(y0 + h, ty + tileH));
      ctx.stroke();
    }
  }

  // Two sunlit / twilight arched Mediterranean windows
  for (const wx of [164, 792]) {
    ctx.save();
    ctx.fillStyle = '#6b4226';
    ctx.beginPath();
    ctx.roundRect(wx - 56, y0 + 7, 112, 66, [34, 34, 4, 4]);
    ctx.fill();

    renderBiomeWindowSky(ctx, wx, y0, biome, time);

    ctx.strokeStyle = '#6b4226';
    ctx.lineWidth = 3.8;
    ctx.beginPath();
    ctx.moveTo(wx, y0 + 13);
    ctx.lineTo(wx, y0 + 67);
    ctx.moveTo(wx - 48, y0 + 44);
    ctx.lineTo(wx + 48, y0 + 44);
    ctx.stroke();

    // Potted basil on windowsill
    ctx.fillStyle = '#c45b33';
    ctx.fillRect(wx - 10, y0 + 57, 20, 12);
    ctx.fillStyle = '#3da347';
    ctx.beginPath();
    ctx.arc(wx - 5, y0 + 53, 6.5, 0, Math.PI * 2);
    ctx.arc(wx + 5, y0 + 53, 6.5, 0, Math.PI * 2);
    ctx.arc(wx, y0 + 48, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Center Framed Bistro Chalkboard Sign
  ctx.save();
  const bx = 478;
  ctx.fillStyle = '#6c4223';
  ctx.beginPath();
  ctx.roundRect(bx - 134, y0 + 9, 268, 60, 6);
  ctx.fill();
  ctx.fillStyle = '#223028';
  ctx.beginPath();
  ctx.roundRect(bx - 127, y0 + 15, 254, 48, 4);
  ctx.fill();
  ctx.strokeStyle = 'rgba(244, 218, 152, 0.45)';
  ctx.lineWidth = 1.2;
  ctx.strokeRect(bx - 122, y0 + 19, 244, 40);

  ctx.fillStyle = '#faeac8';
  ctx.font = '900 15.5px Georgia, "Times New Roman", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('EMBER & BASIL', bx, y0 + 32);
  ctx.fillStyle = '#e8c16b';
  ctx.font = '800 9.5px "Trebuchet MS", sans-serif';
  ctx.fillText(`420°C STONE HEARTH · ${biome.label.toUpperCase()}`, bx, y0 + 49);
  ctx.restore();

  // Brushed copper pan rack
  ctx.save();
  const rx = 1018;
  ctx.strokeStyle = PALETTE.brassDark;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(rx - 86, y0 + 21);
  ctx.lineTo(rx + 86, y0 + 21);
  ctx.stroke();

  const sway = Math.sin(time * 1.4) * 0.03;
  for (const [px, r] of [
    [rx - 56, 13],
    [rx - 18, 10.5],
    [rx + 18, 14],
    [rx + 56, 11.5],
  ]) {
    ctx.save();
    ctx.translate(px, y0 + 21);
    ctx.rotate(sway);
    ctx.strokeStyle = '#5c3c1e';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 17);
    ctx.stroke();
    const pGrad = ctx.createRadialGradient(-4, 25, 2, 0, 29, r);
    pGrad.addColorStop(0, PALETTE.copperHighlight);
    pGrad.addColorStop(0.7, PALETTE.copper);
    pGrad.addColorStop(1, '#7a3c1f');
    ctx.fillStyle = pGrad;
    ctx.beginPath();
    ctx.arc(0, 29, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#5c2b14';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();

  // Dining Room Wall Sconce on top-right wall (above dining bar)
  const dx = DINING_X + 77;
  ctx.save();
  ctx.fillStyle = '#5e3820';
  ctx.fillRect(DINING_X, y0, CANVAS_WIDTH - DINING_X, h);
  ctx.fillStyle = PALETTE.brass;
  ctx.beginPath();
  ctx.roundRect(dx - 24, y0 + 18, 48, 34, 8);
  ctx.fill();
  ctx.fillStyle = '#fff5cc';
  ctx.beginPath();
  ctx.arc(dx, y0 + 35, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = '#6c3e20';
  ctx.fillRect(0, y0 + h - 5, CANVAS_WIDTH, 5);
}

function drawKitchenFloor(ctx, textures) {
  // Left wood molding edge
  ctx.fillStyle = '#4f2e19';
  ctx.fillRect(0, GRID_ORIGIN_Y, GRID_ORIGIN_X, FOOTER_Y - GRID_ORIGIN_Y);

  // Hand-glazed procedural terracotta tiles across kitchen floor
  ctx.save();
  ctx.translate(GRID_ORIGIN_X, GRID_ORIGIN_Y);
  ctx.fillStyle = getFloorPattern(ctx, textures);
  ctx.fillRect(0, 0, GRID_COLS * TILE_SIZE, FOOTER_Y - GRID_ORIGIN_Y);
  ctx.restore();
}

function drawChefRoutePreview(ctx, chef) {
  ctx.save();
  ctx.strokeStyle = chef.routeColor;
  ctx.globalAlpha = 0.78;
  ctx.lineWidth = 3.2;
  ctx.setLineDash([7, 6]);
  ctx.beginPath();
  ctx.moveTo(chef.x, chef.y + 10);
  for (const wp of chef.autoPath) {
    ctx.lineTo(wp.x, wp.y + 10);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  const end = chef.autoPath[chef.autoPath.length - 1];
  ctx.fillStyle = chef.routeColor;
  ctx.beginPath();
  ctx.arc(end.x, end.y + 10, 6.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#24140a';
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.restore();
}

function drawOakCounterBase(ctx, textures, x, y, w, h, tint = null, accentRim = false) {
  ctx.fillStyle = 'rgba(34, 15, 6, 0.34)';
  ctx.beginPath();
  ctx.roundRect(x + 3, y + 6, w - 2, h - 1, 7);
  ctx.fill();

  ctx.fillStyle = PALETTE.oakFront;
  ctx.beginPath();
  ctx.roundRect(x + 1, y + 2, w - 2, h - 3, 6);
  ctx.fill();

  const topH = h - 14;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x + 2, y + 2, w - 4, topH, 5);
  ctx.clip();
  ctx.translate(x, y);
  ctx.fillStyle = tint ?? getWoodPattern(ctx, textures);
  ctx.fillRect(0, 0, w, topH + 4);
  if (tint === null) {
    ctx.fillStyle = 'rgba(255, 240, 210, 0.08)';
    ctx.fillRect(0, 0, w, topH * 0.45);
  }
  ctx.restore();

  ctx.strokeStyle = accentRim ? '#ffe38c' : 'rgba(255, 240, 212, 0.42)';
  ctx.lineWidth = accentRim ? 2 : 1.2;
  ctx.strokeRect(x + 3.5, y + 3.5, w - 7, topH - 3);

  ctx.fillStyle = PALETTE.brassDark;
  ctx.fillRect(x + w / 2 - 12, y + h - 8, 24, 3);
}

function drawCookGauge(ctx, x, y, cook, time) {
  const r = 18.5;
  ctx.save();
  ctx.translate(x, y);

  ctx.fillStyle = 'rgba(24, 13, 7, 0.9)';
  ctx.beginPath();
  ctx.arc(0, 0, r + 3.5, 0, Math.PI * 2);
  ctx.fill();

  const totalWindow = cook.burnTime;
  const startA = -Math.PI / 2;

  const sweetStartA = startA + (cook.readyTime / totalWindow) * Math.PI * 2;
  const sweetEndA = startA + (cook.sweetEnd / totalWindow) * Math.PI * 2;
  ctx.strokeStyle = 'rgba(255, 214, 70, 0.48)';
  ctx.lineWidth = 4.8;
  ctx.beginPath();
  ctx.arc(0, 0, r - 2, sweetStartA, sweetEndA);
  ctx.stroke();

  const warnStartA = startA + (cook.warnTime / totalWindow) * Math.PI * 2;
  ctx.strokeStyle = 'rgba(225, 62, 50, 0.42)';
  ctx.lineWidth = 4.8;
  ctx.beginPath();
  ctx.arc(0, 0, r - 2, warnStartA, startA + Math.PI * 2);
  ctx.stroke();

  const frac = Math.min(1, cook.elapsed / totalWindow);
  let color = '#58c9f5';
  if (cook.state === 'sweet') color = '#ffd94a';
  else if (cook.state === 'ready') color = '#4be086';
  else if (cook.state === 'warn') color = Math.sin(time * 18) > 0 ? '#ff4a3d' : '#ff9842';
  else if (cook.state === 'burnt') color = '#665b57';

  ctx.strokeStyle = color;
  ctx.lineWidth = 5.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, 0, r - 2, startA, startA + frac * Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#fff9eb';
  ctx.font = '800 9.5px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (cook.state === 'sweet') {
    ctx.fillStyle = '#ffe052';
    ctx.font = '900 13px "Trebuchet MS", sans-serif';
    ctx.fillText('★', 0, 1);
  } else if (cook.state === 'ready') {
    ctx.fillStyle = '#7dffb2';
    ctx.fillText('OK', 0, 0.5);
  } else if (cook.state === 'warn') {
    ctx.fillStyle = '#ff6b57';
    ctx.font = '900 13px sans-serif';
    ctx.fillText('!', 0, 1);
  } else if (cook.state === 'burnt') {
    ctx.fillStyle = '#ff7d70';
    ctx.fillText('✕', 0, 0.5);
  } else {
    const pct = Math.min(99, Math.round((cook.elapsed / cook.readyTime) * 100));
    ctx.fillText(`${pct}%`, 0, 0.5);
  }

  // Live °C micro-temperature tag tucked neatly below gauge
  const tempC = getLiveTemperatureC(cook);
  ctx.fillStyle = 'rgba(26, 14, 7, 0.88)';
  ctx.beginPath();
  ctx.roundRect(-20, r + 2, 40, 13, 6);
  ctx.fill();
  ctx.fillStyle = cook.state === 'sweet' ? '#ffe066' : cook.state === 'warn' ? '#ff7c6e' : '#ffd8a8';
  ctx.font = '800 8.5px "Trebuchet MS", sans-serif';
  ctx.fillText(`${tempC}°C`, 0, r + 9);

  ctx.restore();
}

function drawStation(ctx, st, kitchen, textures, time, flags) {
  const rect = tileRect(st.col, st.row);
  const bounceY = -Math.sin(st.bounce * Math.PI) * 5;
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2 - 5;

  ctx.save();
  ctx.translate(0, bounceY);

  if (st.type === STATION_TYPES.OVEN && st.ovenSide === 'left') {
    const rightSt = kitchen.grid[st.row][st.col + 1];
    const w = TILE_SIZE * 2;
    const h = TILE_SIZE;
    const x = rect.x;
    const y = rect.y;

    ctx.fillStyle = 'rgba(35, 16, 6, 0.38)';
    ctx.beginPath();
    ctx.roundRect(x + 4, y + 6, w - 4, h - 2, 10);
    ctx.fill();

    const brickGrad = ctx.createLinearGradient(x, y, x, y + h);
    brickGrad.addColorStop(0, '#b5563b');
    brickGrad.addColorStop(0.65, '#8c3b27');
    brickGrad.addColorStop(1, '#5e2417');
    ctx.fillStyle = brickGrad;
    ctx.beginPath();
    ctx.roundRect(x + 2, y + 2, w - 4, h - 4, [14, 14, 6, 6]);
    ctx.fill();

    ctx.strokeStyle = 'rgba(244, 218, 184, 0.25)';
    ctx.lineWidth = 1.3;
    for (let by = y + 14; by < y + h - 12; by += 14) {
      ctx.beginPath();
      ctx.moveTo(x + 6, by);
      ctx.lineTo(x + w - 6, by);
      ctx.stroke();
    }

    for (const [slotIdx, ovenSt] of [
      [0, st],
      [1, rightSt],
    ]) {
      const sx = x + TILE_SIZE / 2 + slotIdx * TILE_SIZE;
      const sy = y + 46;
      const active = Boolean(ovenSt?.cook);
      const flicker = 0.85 + Math.sin(time * 13 + slotIdx * 2) * 0.15;

      ctx.fillStyle = '#23120b';
      ctx.beginPath();
      ctx.arc(sx, sy + 4, 29, Math.PI, 0);
      ctx.lineTo(sx + 29, sy + 24);
      ctx.lineTo(sx - 29, sy + 24);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = '#d98a5b';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(sx, sy + 4, 30, Math.PI, 0);
      ctx.stroke();

      const fireGrad = ctx.createRadialGradient(sx, sy + 17, 3, sx, sy + 15, 26);
      fireGrad.addColorStop(0, `rgba(255, 224, 102, ${0.95 * flicker})`);
      fireGrad.addColorStop(0.5, `rgba(255, 112, 32, ${0.75 * flicker})`);
      fireGrad.addColorStop(1, 'rgba(130, 26, 8, 0.05)');
      ctx.fillStyle = fireGrad;
      ctx.beginPath();
      ctx.arc(sx, sy + 15, 25, Math.PI, 0);
      ctx.lineTo(sx + 25, sy + 23);
      ctx.lineTo(sx - 25, sy + 23);
      ctx.closePath();
      ctx.fill();

      if (active) {
        const previewId = ovenSt.cook.state === 'burnt' ? 'burnt' : ovenSt.cook.outputId;
        drawIngredientArt(ctx, previewId, sx, sy + 9, 16);
        drawCookGauge(ctx, sx + 20, sy - 20, ovenSt.cook, time);
      }
    }

    drawStatusPill(ctx, x + w / 2, y + h - 9, '420°C STONE OVEN', '#3b190f', '#ffdfa0');
    if (flags.isHovered || flags.isTarget || flags.isSuggested) {
      drawStationOutline(ctx, x + 2, y + 2, w - 4, h - 4, flags.isTarget || flags.isHovered, time);
    }
    ctx.restore();
    return;
  }

  if (st.type === STATION_TYPES.PANTRY) {
    const isIce = st.ingredient === 'salmon';
    drawOakCounterBase(ctx, textures, rect.x, rect.y, rect.w, rect.h, isIce ? '#9db6c4' : '#c0854a');
    ctx.fillStyle = isIce ? '#d4ecf7' : '#6b401e';
    ctx.beginPath();
    ctx.roundRect(rect.x + 9, rect.y + 8, rect.w - 18, rect.h - 28, 6);
    ctx.fill();
    ctx.strokeStyle = isIce ? '#7ea3b8' : '#996032';
    ctx.lineWidth = 2;
    ctx.stroke();

    const offsets = [
      [-13, -7],
      [13, -7],
      [-10, 7],
      [11, 7],
      [0, 0],
    ];
    for (const [ox, oy] of offsets) {
      drawIngredientArt(ctx, st.ingredient, cx + ox, cy + oy - 2, 13.5);
    }
    drawStatusPill(ctx, cx, rect.y + rect.h - 10, st.label.toUpperCase(), '#2e1b10', '#f9e7c2');
  } else if (st.type === STATION_TYPES.POT) {
    drawOakCounterBase(ctx, textures, rect.x, rect.y, rect.w, rect.h, '#474245');
    ctx.fillStyle = '#242123';
    ctx.beginPath();
    ctx.arc(cx, cy, 30, 0, Math.PI * 2);
    ctx.fill();
    if (st.cook) {
      const glow = 0.7 + Math.sin(time * 16) * 0.25;
      ctx.strokeStyle = `rgba(255, 132, 36, ${glow})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(cx, cy, 29, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = PALETTE.brassDark;
    ctx.fillRect(cx - 32, cy - 5, 64, 10);
    const potGrad = ctx.createRadialGradient(cx - 7, cy - 7, 3, cx, cy, 25);
    potGrad.addColorStop(0, PALETTE.copperHighlight);
    potGrad.addColorStop(0.65, PALETTE.copper);
    potGrad.addColorStop(1, '#7c3a1d');
    ctx.fillStyle = potGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, 24.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#f2b98a';
    ctx.lineWidth = 2;
    ctx.stroke();

    const isTomato = st.cook?.inputId === 'chopped_tomato';
    const isSaffron = st.cook?.inputId === 'saffron';
    ctx.fillStyle = st.cook
      ? st.cook.state === 'burnt'
        ? '#261e1c'
        : isTomato
          ? '#c7301e'
          : isSaffron
            ? '#f0b624'
            : '#e8d79b'
      : '#3b4a52';
    ctx.beginPath();
    ctx.arc(cx, cy, 19, 0, Math.PI * 2);
    ctx.fill();

    if (st.cook) {
      ctx.fillStyle = isTomato ? 'rgba(255, 168, 128, 0.72)' : 'rgba(255, 252, 232, 0.78)';
      for (let i = 0; i < 4; i++) {
        const a = time * 2.5 + i * 1.6;
        const bx = cx + Math.cos(a) * 8;
        const by = cy + Math.sin(a * 1.3) * 7.5;
        const br = 2 + ((time * 4 + i) % 1) * 3.2;
        ctx.beginPath();
        ctx.arc(bx, by, br, 0, Math.PI * 2);
        ctx.fill();
      }
      drawIngredientArt(
        ctx,
        st.cook.state === 'burnt' ? 'burnt' : st.cook.outputId,
        cx,
        cy,
        12.8,
      );
      drawCookGauge(ctx, cx + 22, cy - 20, st.cook, time);
    }
    drawStatusPill(ctx, cx, rect.y + rect.h - 10, 'COPPER POT', '#331d13', '#ffd8a8');
  } else if (st.type === STATION_TYPES.SKILLET) {
    drawOakCounterBase(ctx, textures, rect.x, rect.y, rect.w, rect.h, '#474245');
    ctx.fillStyle = '#242124';
    ctx.beginPath();
    ctx.arc(cx, cy, 30, 0, Math.PI * 2);
    ctx.fill();
    if (st.cook) {
      const glow = 0.75 + Math.sin(time * 20) * 0.25;
      ctx.strokeStyle = `rgba(255, 108, 28, ${glow})`;
      ctx.lineWidth = 4.2;
      ctx.beginPath();
      ctx.arc(cx, cy, 30, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.strokeStyle = '#1f1d20';
    ctx.lineWidth = 8.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx + 16, cy + 15);
    ctx.lineTo(cx + 32, cy + 27);
    ctx.stroke();

    const panGrad = ctx.createRadialGradient(cx - 6, cy - 6, 4, cx, cy, 25);
    panGrad.addColorStop(0, '#49464d');
    panGrad.addColorStop(0.75, '#2b292d');
    panGrad.addColorStop(1, '#18171a');
    ctx.fillStyle = panGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, 24.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#66616b';
    ctx.lineWidth = 2;
    ctx.stroke();

    if (st.cook) {
      const showId =
        st.cook.state === 'burnt'
          ? 'burnt'
          : st.cook.state === 'cooking'
            ? st.cook.inputId
            : st.cook.outputId;
      drawIngredientArt(ctx, showId, cx, cy, 16);
      drawCookGauge(ctx, cx + 22, cy - 20, st.cook, time);
    }
    drawStatusPill(ctx, cx, rect.y + rect.h - 10, 'SKILLET', '#242124', '#ffcf91');
  } else if (st.type === STATION_TYPES.CHOP) {
    drawOakCounterBase(ctx, textures, rect.x, rect.y, rect.w, rect.h, null);
    ctx.fillStyle = '#f2dec0';
    ctx.strokeStyle = '#b08654';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(rect.x + 11, rect.y + 9, rect.w - 22, rect.h - 30, 6);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = 'rgba(148, 108, 66, 0.25)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(rect.x + 22 + i * 11, rect.y + 18);
      ctx.lineTo(rect.x + 26 + i * 11, rect.y + 44);
      ctx.stroke();
    }

    const knifeLift = st.chopProgress > 0 ? Math.abs(Math.sin(time * 24)) * 7 : 0;
    ctx.save();
    ctx.translate(cx + 21, cy - 4 - knifeLift);
    ctx.rotate(st.chopProgress > 0 ? -0.35 - knifeLift * 0.04 : -0.78);
    ctx.fillStyle = '#332016';
    ctx.fillRect(-13, -3, 11, 6);
    ctx.fillStyle = '#e8eef2';
    ctx.strokeStyle = '#8b99a3';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-2, -3);
    ctx.lineTo(17, -3);
    ctx.quadraticCurveTo(15, 6, -2, 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    if (st.item) drawKitchenItem(ctx, st.item, cx - 4, cy, 23, true);

    if (st.chopProgress > 0) {
      const bw = 62;
      const bh = 8.5;
      const bx = cx - bw / 2;
      const by = rect.y + 6;
      ctx.fillStyle = 'rgba(28, 15, 8, 0.85)';
      ctx.beginPath();
      ctx.roundRect(bx - 2, by - 2, bw + 4, bh + 4, 5);
      ctx.fill();
      ctx.fillStyle = '#5ee887';
      ctx.beginPath();
      ctx.roundRect(bx, by, bw * st.chopProgress, bh, 4);
      ctx.fill();
    }
  } else if (st.type === STATION_TYPES.PLATE_STACK) {
    drawOakCounterBase(ctx, textures, rect.x, rect.y, rect.w, rect.h, null);
    for (let i = 0; i < 3; i++) {
      drawPorcelainPlate(ctx, cx, cy + 7 - i * 5.5, 24, false);
    }
    drawStatusPill(ctx, cx, rect.y + rect.h - 10, 'PLATES', '#332214', '#fff5dc');
  } else if (st.type === STATION_TYPES.COMPOST) {
    drawOakCounterBase(ctx, textures, rect.x, rect.y, rect.w, rect.h, '#5c4b3d');
    ctx.fillStyle = '#2d2520';
    ctx.strokeStyle = PALETTE.brass;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#d9c6a3';
    ctx.font = '800 17px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('♻', cx, cy + 1);
    drawStatusPill(ctx, cx, rect.y + rect.h - 10, 'COMPOST', '#2b1d14', '#e8d8b8');
  } else if (st.type === STATION_TYPES.PASS_HOLD) {
    drawOakCounterBase(ctx, textures, rect.x, rect.y, rect.w, rect.h, '#cfa258', true);
    const lampGlow = ctx.createRadialGradient(cx, cy, 6, cx, cy, 40);
    lampGlow.addColorStop(0, 'rgba(255, 224, 128, 0.45)');
    lampGlow.addColorStop(1, 'rgba(255, 196, 72, 0)');
    ctx.fillStyle = lampGlow;
    ctx.fillRect(rect.x + 4, rect.y + 4, rect.w - 8, rect.h - 18);

    if (st.item) {
      drawKitchenItem(ctx, st.item, cx, cy - 1, 27, true);
      if (st.item.kind === 'plate' && st.item.dishId) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 250, 232, 0.65)';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        for (let wIdx = -1; wIdx <= 1; wIdx++) {
          const wx = cx + wIdx * 9;
          const phase = time * 3.4 + wIdx * 1.4;
          ctx.beginPath();
          ctx.moveTo(wx, cy - 14);
          ctx.bezierCurveTo(
            wx - 5 + Math.sin(phase) * 4,
            cy - 24,
            wx + 5 + Math.cos(phase) * 4,
            cy - 31,
            wx + Math.sin(phase) * 3,
            cy - 38,
          );
          ctx.stroke();
        }
        ctx.restore();
        const pulse = 0.86 + Math.sin(time * 7) * 0.14;
        ctx.save();
        ctx.globalAlpha = pulse;
        drawStatusPill(ctx, cx, rect.y + 4, 'READY TO SERVE ★', '#167a42', '#f2fff5', '#ffe066');
        ctx.restore();
      }
    }
    drawStatusPill(ctx, cx, rect.y + rect.h - 10, 'WARM PASS', '#5c3c0e', '#ffe9a6');
  } else if (st.type === STATION_TYPES.SERVE_BELL) {
    drawOakCounterBase(ctx, textures, rect.x, rect.y, rect.w, rect.h, '#d6a44b', true);
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#276e47' : '#fbf4e3';
      ctx.fillRect(rect.x + rect.w - 14, rect.y + 4 + i * 11.5, 12, 11.5);
    }

    const bellScale = 1 + Math.sin(st.bellPulse * Math.PI * 3) * 0.14;
    ctx.save();
    ctx.translate(cx - 4, cy + 2);
    ctx.scale(bellScale, bellScale);
    ctx.fillStyle = '#332011';
    ctx.beginPath();
    ctx.ellipse(0, 12, 22, 8.5, 0, 0, Math.PI * 2);
    ctx.fill();
    const bellGrad = ctx.createRadialGradient(-7, -7, 2, 0, 2, 20);
    bellGrad.addColorStop(0, '#fff4b8');
    bellGrad.addColorStop(0.5, '#e8b238');
    bellGrad.addColorStop(1, '#8c5d14');
    ctx.fillStyle = bellGrad;
    ctx.beginPath();
    ctx.arc(0, 8, 18.5, Math.PI, 0);
    ctx.lineTo(18.5, 11);
    ctx.lineTo(-18.5, 11);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffe580';
    ctx.beginPath();
    ctx.arc(0, -12, 4.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const warmPass = kitchen.stations.find((s) => s.type === STATION_TYPES.PASS_HOLD);
    const hasReadyDish =
      Boolean(flags.heldItem?.kind === 'plate' && flags.heldItem?.dishId) ||
      Boolean(warmPass?.item?.kind === 'plate' && warmPass?.item?.dishId);
    if (hasReadyDish) {
      const bounce = Math.sin(time * 8) * 3.5;
      drawStatusPill(ctx, cx - 4, rect.y + 5 + bounce, 'SERVE BELL!', '#1d8a4b', '#ffffff', '#ffe066');
    }
    drawStatusPill(ctx, cx - 2, rect.y + rect.h - 10, 'SERVE PASS', '#472c08', '#ffe48f');
  } else if (st.type === STATION_TYPES.SHOWCASE) {
    drawOakCounterBase(ctx, textures, rect.x, rect.y, rect.w, rect.h, '#c48f4d');
    ctx.fillStyle = 'rgba(255, 240, 204, 0.25)';
    ctx.beginPath();
    ctx.roundRect(rect.x + 11, rect.y + 9, rect.w - 22, rect.h - 30, 6);
    ctx.fill();

    if (st.showcase) {
      drawDishPreview(ctx, st.showcase.dishId, cx, cy - 2, 25, st.showcase.perfect);
      drawStatusPill(
        ctx,
        cx,
        rect.y + 6,
        `SERVED +$${st.showcase.payout}`,
        '#256b40',
        '#fff6cc',
        '#ffd954',
      );
    }
    drawStatusPill(ctx, cx, rect.y + rect.h - 10, 'TO DINING', '#3b2412', '#f2dec0');
  } else {
    const isAssembly = st.role === 'assembly';
    drawOakCounterBase(ctx, textures, rect.x, rect.y, rect.w, rect.h, null, isAssembly);
    if (isAssembly) {
      ctx.fillStyle = 'rgba(255, 249, 236, 0.34)';
      ctx.strokeStyle = 'rgba(138, 86, 44, 0.28)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.roundRect(rect.x + 10, rect.y + 9, rect.w - 20, rect.h - 28, 8);
      ctx.fill();
      ctx.stroke();
    } else if (!st.item && st.role === 'spice') {
      ctx.fillStyle = '#c89b32';
      ctx.beginPath();
      ctx.arc(cx - 13, cy + 4, 8.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#6b4714';
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.fillStyle = '#5c361e';
      ctx.beginPath();
      ctx.arc(cx + 12, cy - 2, 7.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f2d084';
      ctx.beginPath();
      ctx.arc(cx + 12, cy - 2, 2.8, 0, Math.PI * 2);
      ctx.fill();
    }
    if (st.item) {
      drawKitchenItem(ctx, st.item, cx, cy - 1, isAssembly ? 27 : 25, true);
    }
  }

  if (flags.isTarget || flags.isHovered || flags.isSuggested || st.highlightPulse > 0) {
    drawStationOutline(
      ctx,
      rect.x + 2,
      rect.y + 2,
      rect.w - 4,
      rect.h - 4,
      flags.isTarget || flags.isHovered,
      time,
    );
  }

  ctx.restore();
}

function drawStationOutline(ctx, x, y, w, h, strong, time) {
  ctx.save();
  const pulse = 0.65 + Math.sin(time * 8) * 0.35;
  ctx.strokeStyle = strong
    ? `rgba(255, 232, 118, ${0.88 + pulse * 0.12})`
    : `rgba(125, 240, 168, ${0.35 + pulse * 0.3})`;
  ctx.lineWidth = strong ? 3.4 : 2.1;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.stroke();
  ctx.restore();
}

function drawChefCharacter(ctx, chef, isActive, time, fever) {
  const bob = Math.abs(Math.sin(chef.walkCycle)) * 3.8;
  const speed = Math.hypot(chef.vx, chef.vy);
  const tilt = speed > 15 ? Math.sin(chef.walkCycle) * 0.08 : 0;

  ctx.save();
  ctx.translate(chef.x, chef.y);

  // Ground shadow
  ctx.fillStyle = 'rgba(34, 15, 6, 0.34)';
  ctx.beginPath();
  ctx.ellipse(0, 17, 23, 11, 0, 0, Math.PI * 2);
  ctx.fill();

  // Active Chef Selection Ring (crisp gold/cyan ring under feet!)
  if (isActive) {
    ctx.strokeStyle = fever ? '#ffe066' : chef.routeColor;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.ellipse(0, 16, 26, 13, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (fever) {
    const aura = ctx.createRadialGradient(0, 13, 4, 0, 13, 34);
    aura.addColorStop(0, 'rgba(255, 214, 68, 0.52)');
    aura.addColorStop(1, 'rgba(255, 214, 68, 0)');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, 13, 34, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.translate(0, -bob);
  ctx.rotate(tilt);

  const stride = speed > 15 ? Math.sin(chef.walkCycle) * 5 : 0;
  ctx.fillStyle = '#382218';
  ctx.beginPath();
  ctx.ellipse(-8.5, 13 + stride * 0.5, 6.5, 4.2, 0, 0, Math.PI * 2);
  ctx.ellipse(8.5, 13 - stride * 0.5, 6.5, 4.2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Crisp White Chef Coat
  ctx.fillStyle = '#fff9ee';
  ctx.strokeStyle = '#5c4130';
  ctx.lineWidth = 1.9;
  ctx.beginPath();
  ctx.roundRect(-18, -12, 36, 26, 12);
  ctx.fill();
  ctx.stroke();

  // Unique Brigade Apron Color (Marco: Sage Green, Sofia: Bistro Navy-Teal)
  ctx.fillStyle = chef.apronColor;
  ctx.beginPath();
  ctx.roundRect(-12, -1, 24, 15, [4, 4, 8, 8]);
  ctx.fill();
  ctx.fillStyle = '#f0c451';
  ctx.beginPath();
  ctx.arc(-5, -6, 1.9, 0, Math.PI * 2);
  ctx.arc(5, -6, 1.9, 0, Math.PI * 2);
  ctx.fill();

  // Neckerchief
  ctx.fillStyle = chef.scarfColor;
  ctx.beginPath();
  ctx.moveTo(-9, -11);
  ctx.lineTo(9, -11);
  ctx.lineTo(0, -3);
  ctx.closePath();
  ctx.fill();

  // Head
  ctx.fillStyle = chef.skinColor;
  ctx.strokeStyle = '#6e452b';
  ctx.lineWidth = 1.7;
  ctx.beginPath();
  ctx.arc(0, -19, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Hair tuft
  ctx.fillStyle = chef.hairColor;
  ctx.beginPath();
  ctx.arc(0, -22, 13, Math.PI * 0.95, Math.PI * 2.05);
  ctx.fill();

  const eyeOffX = chef.facingX * 3.8;
  const eyeOffY = chef.facingY * 2.2;
  ctx.fillStyle = '#291910';
  ctx.beginPath();
  ctx.arc(-4.5 + eyeOffX, -18 + eyeOffY, 2.1, 0, Math.PI * 2);
  ctx.arc(4.5 + eyeOffX, -18 + eyeOffY, 2.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(232, 118, 98, 0.45)';
  ctx.beginPath();
  ctx.arc(-8.5 + eyeOffX * 0.6, -14.5 + eyeOffY, 2.4, 0, Math.PI * 2);
  ctx.arc(8.5 + eyeOffX * 0.6, -14.5 + eyeOffY, 2.4, 0, Math.PI * 2);
  ctx.fill();

  // Pleated Chef Toque (tall for Head Chef Marco, stylish flat cap for Sous-Chef Sofia!)
  ctx.save();
  ctx.translate(0, -30);
  ctx.rotate(chef.facingX * 0.14);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#756658';
  ctx.lineWidth = 1.6;
  if (chef.tallToque) {
    ctx.beginPath();
    ctx.arc(-7.5, -7, 8.5, 0, Math.PI * 2);
    ctx.arc(7.5, -7, 8.5, 0, Math.PI * 2);
    ctx.arc(0, -11, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fffdf7';
    ctx.beginPath();
    ctx.roundRect(-12, -4, 24, 8.5, 3);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.ellipse(0, -5, 13, 6.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = chef.apronColor;
    ctx.fillRect(-11, -3, 22, 4);
  }
  ctx.restore();

  // Hands & Held Culinary Item
  const holdX = chef.facingX * 24;
  const holdY = -2 + chef.facingY * 17;
  const chopOffset = chef.choppingAnim > 0 ? Math.sin(time * 36) * 5 : 0;

  ctx.fillStyle = chef.skinColor;
  ctx.strokeStyle = '#6e452b';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(holdX - chef.facingY * 10, holdY + chef.facingX * 10 + chopOffset, 4.8, 0, Math.PI * 2);
  ctx.arc(holdX + chef.facingY * 10, holdY - chef.facingX * 10 - chopOffset, 4.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  if (chef.heldItem) {
    drawKitchenItem(ctx, chef.heldItem, holdX, holdY - 4, 23, false);
  }

  ctx.restore();

  // Subtle crisp name badge under chef so Dual-Chef Brigade reads in a glance!
  ctx.save();
  ctx.fillStyle = isActive ? 'rgba(26, 14, 7, 0.86)' : 'rgba(26, 14, 7, 0.62)';
  ctx.beginPath();
  ctx.roundRect(chef.x - 24, chef.y + 20, 48, 14, 7);
  ctx.fill();
  ctx.fillStyle = isActive ? chef.routeColor : '#e8d8b8';
  ctx.font = '800 8.5px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(chef.id === 'marco' ? 'MARCO' : 'SOFIA', chef.x, chef.y + 27.5);
  ctx.restore();
}

function drawTopHudAndTickets(ctx, state, availableParts, biome) {
  const { orders, time, shiftElapsed, shiftDuration, audio } = state;

  const headGrad = ctx.createLinearGradient(0, 0, 0, HUD_HEIGHT);
  headGrad.addColorStop(0, '#1c120c');
  headGrad.addColorStop(1, '#2f1d13');
  ctx.fillStyle = headGrad;
  ctx.fillRect(0, 0, CANVAS_WIDTH, HUD_HEIGHT);

  const railGrad = ctx.createLinearGradient(0, 8, 0, 20);
  railGrad.addColorStop(0, '#f0cc75');
  railGrad.addColorStop(0.5, '#b88532');
  railGrad.addColorStop(1, '#6b4714');
  ctx.fillStyle = railGrad;
  ctx.fillRect(14, 9, 976, 11);

  ctx.fillStyle = PALETTE.brass;
  ctx.fillRect(0, HUD_HEIGHT - 3, CANVAS_WIDTH, 3);

  const ticketW = 186;
  const ticketH = 118;
  const gap = 10;
  const startX = 18;
  state.ticketBounds = [];

  for (let i = 0; i < orders.tickets.length; i++) {
    const ticket = orders.tickets[i];
    const recipe = RECIPES[ticket.recipeId];
    const tx = startX + i * (ticketW + gap);
    const ratio = Math.max(0, ticket.patience / ticket.patienceMax);
    const urgent = ratio < 0.28;
    const wiggle = urgent ? Math.sin(ticket.pulse) * 2.5 : 0;
    const slideY = -ticket.slideIn * 64;
    const ty = 16 + slideY;

    state.ticketBounds.push({ id: ticket.id, x: tx, y: ty, w: ticketW, h: ticketH });

    ctx.save();
    ctx.translate(tx + ticketW / 2, ty + ticketH / 2);
    ctx.rotate((wiggle * Math.PI) / 180);
    ctx.translate(-ticketW / 2, -ticketH / 2);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
    ctx.beginPath();
    ctx.roundRect(3, 5, ticketW, ticketH, 7);
    ctx.fill();

    ctx.fillStyle = ticket.isVip ? '#fff9e6' : PALETTE.cream;
    ctx.strokeStyle =
      orders.focusedTicketId === ticket.id
        ? '#ffd447'
        : urgent
          ? '#e64236'
          : ticket.isVip
            ? '#d9a12b'
            : '#c7b596';
    ctx.lineWidth = urgent || orders.focusedTicketId === ticket.id ? 2.6 : 1.6;
    ctx.beginPath();
    ctx.roundRect(0, 0, ticketW, ticketH, 7);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#d9a441';
    ctx.strokeStyle = '#634112';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(ticketW / 2 - 14, -7, 28, 12, 3);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = ticket.isVip ? '#b87a14' : recipe.accent;
    ctx.beginPath();
    ctx.roundRect(2, 2, ticketW - 4, 24, [5, 5, 0, 0]);
    ctx.fill();

    ctx.fillStyle = '#fffaf0';
    ctx.font = '800 11.5px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${ticket.isVip ? '★ ' : ''}${recipe.shortName}`, 8, 14.5);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffe588';
    ctx.font = '900 12px "Trebuchet MS", sans-serif';
    ctx.fillText(`$${recipe.price}`, ticketW - 8, 14.5);

    drawDishPreview(ctx, ticket.recipeId, 34, 62, 24, ticket.isVip);

    const stepParts = recipe.displaySteps ?? recipe.components;
    const isFour = stepParts.length >= 4;
    const iconRadius = isFour ? 12.2 : 14;
    const stepGap = isFour ? 28.5 : 36;
    const startIconX = isFour ? 76 : 79;
    for (let pIdx = 0; pIdx < stepParts.length; pIdx++) {
      const partId = stepParts[pIdx];
      const px = startIconX + pIdx * stepGap;
      const py = 55;
      const hasReady = availableParts.has(partId);

      ctx.fillStyle = hasReady ? 'rgba(53, 161, 98, 0.22)' : 'rgba(130, 96, 62, 0.12)';
      ctx.strokeStyle = hasReady ? '#2f9959' : 'rgba(130, 96, 62, 0.36)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(px, py, iconRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      drawIngredientArt(ctx, partId, px, py, isFour ? 10 : 11.5);

      if (hasReady) {
        const badgeOff = isFour ? 8.5 : 10;
        ctx.fillStyle = '#279151';
        ctx.beginPath();
        ctx.arc(px + badgeOff, py - badgeOff, 5.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 8.5px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('✓', px + badgeOff, py - badgeOff + 0.5);
      }
    }

    if (recipe.ovenRecipe) {
      drawStatusPill(ctx, 123, 84, '420°C STONE OVEN', '#8c3b27', '#ffe6ba');
    } else if (ticket.isVip) {
      drawStatusPill(ctx, 123, 84, '★ VIP CRITIC · +35%', '#9e670e', '#fff8d6', '#f0c451');
    } else {
      ctx.fillStyle = '#634734';
      ctx.font = '700 9.5px "Trebuchet MS", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('FRESH PLATE & SERVE', 66, 85);
    }

    const barX = 8;
    const barY = ticketH - 16;
    const barW = ticketW - 16;
    const barH = 10;
    ctx.fillStyle = '#dfd0b8';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 5);
    ctx.fill();

    const barColor =
      ratio > 0.55 ? PALETTE.emerald : ratio > 0.28 ? PALETTE.amber : PALETTE.crimson;
    ctx.fillStyle = barColor;
    ctx.beginPath();
    ctx.roundRect(barX, barY, Math.max(4, barW * ratio), barH, 5);
    ctx.fill();

    ctx.fillStyle = '#1e120a';
    ctx.font = '800 9px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.ceil(ticket.patience)}s`, barX + barW - 3, barY + 5.5);

    ctx.restore();
  }

  // Right Brass Shift Clock + Revenue + Combo/Fever + Utility Buttons
  const hudX = 1002;
  const hudW = 264;
  ctx.save();
  ctx.fillStyle = 'rgba(20, 12, 7, 0.76)';
  ctx.strokeStyle = 'rgba(220, 165, 68, 0.58)';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.roundRect(hudX, 10, hudW, 124, 10);
  ctx.fill();
  ctx.stroke();

  const remaining = Math.max(0, shiftDuration - shiftElapsed);
  const timeRatio = Math.max(0, remaining / Math.max(1, shiftDuration));
  const urgentShift = remaining <= 25 && state.screen === SCREEN_MODES.PLAYING;
  const clockX = hudX + 38;
  const clockY = 46;

  ctx.fillStyle = urgentShift && Math.sin(time * 12) > 0 ? '#5c1814' : '#fbf2dc';
  ctx.strokeStyle = urgentShift ? '#ff594a' : PALETTE.brass;
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.arc(clockX, clockY, 23, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = urgentShift ? 'rgba(224, 65, 52, 0.3)' : 'rgba(53, 161, 98, 0.24)';
  ctx.beginPath();
  ctx.moveTo(clockX, clockY);
  ctx.arc(clockX, clockY, 19, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * timeRatio);
  ctx.closePath();
  ctx.fill();

  const handAngle = -Math.PI / 2 + Math.PI * 2 * (1 - timeRatio);
  ctx.strokeStyle = urgentShift ? '#ffdedb' : '#2e1a0e';
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(clockX, clockY);
  ctx.lineTo(clockX + Math.cos(handAngle) * 14, clockY + Math.sin(handAngle) * 14);
  ctx.stroke();
  ctx.fillStyle = PALETTE.brassDark;
  ctx.beginPath();
  ctx.arc(clockX, clockY, 2.8, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = urgentShift ? '#ff7c70' : '#fff6df';
  ctx.font = '900 25px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(formatClock(remaining), hudX + 70, 38);

  ctx.fillStyle = orders.rushActive ? '#ffb84d' : '#cbb694';
  ctx.font = '800 10px "Trebuchet MS", sans-serif';
  ctx.fillText(
    orders.rushActive ? '🔥 SERVICE RUSH' : biome.label.toUpperCase(),
    hudX + 71,
    58,
  );

  ctx.fillStyle = '#ffe066';
  ctx.font = '900 24px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`$${orders.score}`, hudX + hudW - 14, 38);

  const stars = computeStarRating(orders);
  for (let s = 0; s < 3; s++) {
    ctx.fillStyle = s < stars ? '#ffd447' : 'rgba(255, 240, 200, 0.22)';
    ctx.font = '900 13px sans-serif';
    ctx.fillText('★', hudX + hudW - 44 + s * 15, 58);
  }

  ctx.strokeStyle = 'rgba(220, 165, 68, 0.28)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(hudX + 12, 76);
  ctx.lineTo(hudX + hudW - 12, 76);
  ctx.stroke();

  const feverOn = isFeverActive(orders);
  const pillColor = feverOn ? '#c96f14' : orders.combo >= 2 ? '#236e42' : '#3a261a';
  ctx.fillStyle = pillColor;
  ctx.beginPath();
  ctx.roundRect(hudX + 12, 85, 108, 37, 7);
  ctx.fill();
  ctx.strokeStyle = feverOn ? '#ffe066' : 'rgba(255, 240, 204, 0.25)';
  ctx.lineWidth = 1.4;
  ctx.stroke();

  ctx.fillStyle = feverOn ? '#fff7cc' : '#f5e4c4';
  ctx.font = '900 12.5px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(
    feverOn ? `🔥 FEVER ×${orders.combo}` : orders.combo > 0 ? `COMBO ×${orders.combo}` : 'STREAK ×0',
    hudX + 66,
    99,
  );
  ctx.fillStyle = '#ffe599';
  ctx.font = '700 9.5px "Trebuchet MS", sans-serif';
  ctx.fillText(
    feverOn ? `${Math.ceil(orders.feverTimer)}s +25% TIPS` : `${orders.dishesServed} SERVED`,
    hudX + 66,
    114,
  );

  state.hudButtons = [];
  const btns = [
    { id: 'recipes', label: 'Menu', key: 'R', x: hudX + 126, w: 42 },
    { id: 'upgrades', label: 'Shop', key: 'U', x: hudX + 171, w: 40 },
    { id: 'mute', label: audio.isMuted() ? 'Off' : 'Sfx', key: 'M', x: hudX + 214, w: 40 },
  ];
  for (const b of btns) {
    state.hudButtons.push({ id: b.id, x: b.x, y: 85, w: b.w, h: 37 });
    ctx.fillStyle = '#3b2416';
    ctx.strokeStyle = 'rgba(220, 165, 68, 0.5)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(b.x, 85, b.w, 37, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fff2d1';
    ctx.font = '800 10.5px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(b.label, b.x + b.w / 2, 99);
    ctx.fillStyle = '#cfa355';
    ctx.font = '700 8.5px "Trebuchet MS", sans-serif';
    ctx.fillText(`[${b.key}]`, b.x + b.w / 2, 114);
  }

  ctx.restore();
}

function drawFooterBar(ctx, state) {
  const { brigade, orders } = state;
  const activeChef = getActiveChef(brigade);

  const grad = ctx.createLinearGradient(0, FOOTER_Y, 0, CANVAS_HEIGHT);
  grad.addColorStop(0, '#301d13');
  grad.addColorStop(1, '#1b100a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, FOOTER_Y, CANVAS_WIDTH, FOOTER_HEIGHT);

  ctx.fillStyle = PALETTE.brass;
  ctx.fillRect(0, FOOTER_Y, CANVAS_WIDTH, 3);

  // Left: Dual-Chef Brigade Cards (Clickable to swap Marco / Sofia!)
  state.brigadeButtons = [];
  brigade.chefs.forEach((chef, idx) => {
    const bx = 14 + idx * 184;
    const by = FOOTER_Y + 13;
    const bw = 176;
    const bh = 74;
    const isAct = idx === brigade.activeIndex;
    state.brigadeButtons.push({ id: `chef_${idx}`, index: idx, x: bx, y: by, w: bw, h: bh });

    ctx.save();
    ctx.fillStyle = isAct ? 'rgba(220, 165, 68, 0.16)' : 'rgba(255, 245, 224, 0.05)';
    ctx.strokeStyle = isAct ? chef.routeColor : 'rgba(220, 165, 68, 0.25)';
    ctx.lineWidth = isAct ? 2.2 : 1.2;
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 9);
    ctx.fill();
    ctx.stroke();

    if (chef.heldItem) {
      drawKitchenItem(ctx, chef.heldItem, bx + 30, by + 39, 20, false);
    } else {
      ctx.strokeStyle = 'rgba(245, 220, 175, 0.35)';
      ctx.lineWidth = 1.6;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.arc(bx + 30, by + 39, 17, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.fillStyle = isAct ? chef.routeColor : '#d9be94';
    ctx.font = '800 10px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${chef.name.toUpperCase()} ${isAct ? '●' : '[TAB]'}`, bx + 56, by + 18);

    ctx.fillStyle = '#fff7e4';
    ctx.font = '800 12px "Trebuchet MS", sans-serif';
    const itemDesc = describeItem(chef.heldItem);
    const trimmed = itemDesc.length > 19 ? `${itemDesc.slice(0, 18)}…` : itemDesc;
    ctx.fillText(trimmed, bx + 56, by + 38);

    ctx.fillStyle = '#c5ae8a';
    ctx.font = '600 9.5px "Trebuchet MS", sans-serif';
    ctx.fillText(chef.role, bx + 56, by + 57);
    ctx.restore();
  });

  // Center: Active Menu Quick-Reference Cards (5 spotlight dishes)
  const activeMenu = orders.shift.menu.slice(0, 5);
  const activeOrderSet = new Set(orders.tickets.map((t) => t.recipeId));
  let rx = 390;
  for (const rId of activeMenu) {
    const r = RECIPES[rId];
    const wanted = activeOrderSet.has(rId);
    const cardW = 114;
    ctx.save();
    ctx.fillStyle = wanted ? 'rgba(220, 165, 68, 0.18)' : 'rgba(255, 245, 224, 0.05)';
    ctx.strokeStyle = wanted ? '#f0c451' : 'rgba(220, 165, 68, 0.22)';
    ctx.lineWidth = wanted ? 1.8 : 1;
    ctx.beginPath();
    ctx.roundRect(rx, FOOTER_Y + 13, cardW, 74, 8);
    ctx.fill();
    ctx.stroke();

    drawDishPreview(ctx, rId, rx + 26, FOOTER_Y + 42, 18, false);
    ctx.fillStyle = wanted ? '#fff6d6' : '#c9b69a';
    ctx.font = '800 10.5px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(r.shortName.split(' ')[0], rx + 49, FOOTER_Y + 35);
    ctx.fillStyle = '#e8c066';
    ctx.font = '800 10.5px "Trebuchet MS", sans-serif';
    ctx.fillText(`$${r.price}`, rx + 49, FOOTER_Y + 50);

    ctx.fillStyle = wanted ? '#92f2b5' : '#9c8a72';
    ctx.font = '700 9px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(wanted ? 'ON RAIL' : 'MENU', rx + cardW / 2, FOOTER_Y + 72);
    ctx.restore();
    rx += cardW + 7;
  }

  // Right: Brigade Controls Card
  ctx.save();
  ctx.fillStyle = 'rgba(255, 245, 224, 0.07)';
  ctx.strokeStyle = 'rgba(220, 165, 68, 0.3)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.roundRect(1002, FOOTER_Y + 13, 264, 74, 9);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#e8be66';
  ctx.font = '800 10px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('DUAL-CHEF KEYBOARD & MOUSE', 1016, FOOTER_Y + 29);

  ctx.fillStyle = '#f5e7ce';
  ctx.font = '700 11px "Trebuchet MS", sans-serif';
  ctx.fillText('WASD / Click: Route · Space/E: Act', 1016, FOOTER_Y + 49);
  ctx.fillStyle = '#cbb694';
  ctx.font = '700 10.5px "Trebuchet MS", sans-serif';
  ctx.fillText('Tab: Swap Chef · Shift: Dash · U: Shop', 1016, FOOTER_Y + 69);
  ctx.restore();

  // Keep reference live for active chef tooltip hint
  void activeChef;
}

function drawUrgencyAndBanners(ctx, state) {
  const { orders, shiftElapsed, shiftDuration, time } = state;
  const remaining = Math.max(0, shiftDuration - shiftElapsed);

  if (remaining <= 20 && remaining > 0) {
    const alpha = 0.08 + Math.abs(Math.sin(time * 6)) * 0.12;
    ctx.save();
    ctx.strokeStyle = `rgba(224, 58, 46, ${alpha * 3.2})`;
    ctx.lineWidth = 14;
    ctx.strokeRect(7, HUD_HEIGHT + 7, CANVAS_WIDTH - 14, FOOTER_Y - HUD_HEIGHT - 14);
    ctx.restore();
  }

  if (orders.rushBannerTimer > 0) {
    const alpha = Math.min(1, orders.rushBannerTimer / 0.6);
    const bannerText = '🔥 SERVICE RUSH — CRITICS ARRIVING! 🔥';
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = '900 17px Georgia, serif';
    const bw = Math.max(410, ctx.measureText(bannerText).width + 44);
    const by = GRID_ORIGIN_Y + TILE_SIZE + 8;
    ctx.fillStyle = 'rgba(34, 18, 10, 0.9)';
    ctx.strokeStyle = '#ffbe47';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(CANVAS_WIDTH / 2 - bw / 2, by, bw, 42, 21);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffe073';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(bannerText, CANVAS_WIDTH / 2, by + 21);
    ctx.restore();
  }
}

function drawHoverTooltip(ctx, station, heldItem) {
  const prompt = getActionPromptForStation(station, heldItem);
  if (!prompt) return;
  const pos = tileCenter(station.col, station.row);
  const hasTopBadge =
    station.type === STATION_TYPES.PASS_HOLD ||
    station.type === STATION_TYPES.SERVE_BELL ||
    station.item?.kind === 'plate' ||
    station.item?.kind === 'raw_pie';
  const y =
    station.row === 0 || hasTopBadge
      ? Math.min(FOOTER_Y - 14, pos.y + 50)
      : Math.max(HUD_HEIGHT + 22, pos.y - 52);
  const x = Math.max(96, Math.min(DINING_X - 90, pos.x));
  drawStatusPill(ctx, x, y, prompt, 'rgba(26, 15, 9, 0.94)', '#fff5d8', '#e6b44c');
}

function drawTitleOverlay(ctx, state) {
  ctx.save();
  ctx.fillStyle = 'rgba(22, 12, 7, 0.56)';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  const panelW = 820;
  const panelH = 550;
  const px = (CANVAS_WIDTH - panelW) / 2;
  const py = (CANVAS_HEIGHT - panelH) / 2;

  ctx.fillStyle = '#28180f';
  ctx.strokeStyle = PALETTE.brass;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(px, py, panelW, panelH, 18);
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = 'rgba(246, 210, 122, 0.35)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.roundRect(px + 10, py + 10, panelW - 20, panelH - 20, 12);
  ctx.stroke();

  drawDishPreview(ctx, 'surf_and_turf', px + 88, py + 72, 40, true);
  drawDishPreview(ctx, 'margherita', px + panelW - 88, py + 72, 40, true);
  drawDishPreview(ctx, 'citrus_salmon', px + 158, py + 68, 25, false);
  drawDishPreview(ctx, 'pomodoro_pasta', px + panelW - 158, py + 68, 25, false);

  ctx.fillStyle = '#ffe182';
  ctx.font = '900 46px Georgia, "Times New Roman", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('EMBER & BASIL', CANVAS_WIDTH / 2, py + 68);

  ctx.fillStyle = '#f2dec0';
  ctx.font = '700 14.5px "Trebuchet MS", sans-serif';
  ctx.fillText(
    'DUAL-CHEF SUNLIT BISTRO · 12 ARTISAN DISHES · 420°C STONE HEARTH · 3 BIOMES',
    CANVAS_WIDTH / 2,
    py + 126,
  );

  const perks = [
    '★ Dual-Chef Brigade (Tab)',
    '🔥 Live °C Sweet-Spot Searing',
    '🍷 Candlelit Regulars & Upgrades',
  ];
  ctx.fillStyle = '#d9be94';
  ctx.font = '700 12.5px "Trebuchet MS", sans-serif';
  ctx.fillText(perks.join('    ·    '), CANVAS_WIDTH / 2, py + 156);

  state.titleButtons = [];
  const cardW = 236;
  const cardH = 198;
  const gap = 22;
  const rowX = CANVAS_WIDTH / 2 - (cardW * 3 + gap * 2) / 2;
  const rowY = py + 186;

  SHIFTS.forEach((shift, idx) => {
    const cx = rowX + idx * (cardW + gap);
    const selected = state.selectedShiftIndex === idx;
    state.titleButtons.push({ id: `shift_${idx}`, shiftIndex: idx, x: cx, y: rowY, w: cardW, h: cardH });

    ctx.fillStyle = selected ? '#3f2617' : '#311e13';
    ctx.strokeStyle = selected ? '#ffe066' : 'rgba(220, 165, 68, 0.42)';
    ctx.lineWidth = selected ? 3 : 1.6;
    ctx.beginPath();
    ctx.roundRect(cx, rowY, cardW, cardH, 12);
    ctx.fill();
    ctx.stroke();

    const mins = Math.floor(shift.durationSec / 60);
    const secs = String(shift.durationSec % 60).padStart(2, '0');
    ctx.fillStyle = selected ? '#ffe066' : '#f2d084';
    ctx.font = '800 11px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`SHIFT ${idx + 1} · ${mins}m ${secs}s`, cx + cardW / 2, rowY + 24);

    ctx.fillStyle = '#fff9ec';
    ctx.font = '900 18.5px Georgia, serif';
    ctx.fillText(shift.name, cx + cardW / 2, rowY + 52);

    ctx.fillStyle = '#d2bc9a';
    ctx.font = '600 11px "Trebuchet MS", sans-serif';
    ctx.fillText(shift.subtitle, cx + cardW / 2, rowY + 78);

    const sampleDishes = shift.menu.slice(-3);
    sampleDishes.forEach((dId, dIdx) => {
      drawDishPreview(ctx, dId, cx + 54 + dIdx * 64, rowY + 124, 21, dIdx === 2);
    });

    ctx.fillStyle = '#f0c451';
    ctx.font = '800 11px "Trebuchet MS", sans-serif';
    ctx.fillText(`★★★ Target: $${shift.starTargets[2]}`, cx + cardW / 2, rowY + 172);
  });

  const btnW = 290;
  const btnH = 56;
  const bx = CANVAS_WIDTH / 2 - btnW / 2;
  const by = py + 414;
  state.titleButtons.push({ id: 'start_shift', x: bx, y: by, w: btnW, h: btnH });

  const btnGrad = ctx.createLinearGradient(bx, by, bx, by + btnH);
  btnGrad.addColorStop(0, '#44b86a');
  btnGrad.addColorStop(1, '#237843');
  ctx.fillStyle = btnGrad;
  ctx.strokeStyle = '#ffe073';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.roundRect(bx, by, btnW, btnH, 14);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 22px "Trebuchet MS", sans-serif';
  ctx.fillText('OPEN THE KITCHEN', CANVAS_WIDTH / 2, by + 29);

  ctx.fillStyle = '#ccb694';
  ctx.font = '700 12px "Trebuchet MS", sans-serif';
  ctx.fillText('WASD / Click to Play · [Tab] Swap Marco & Sofia · [R] 12-Dish Menu · [U] Kitchen Upgrades', CANVAS_WIDTH / 2, py + 502);
  ctx.restore();
}

function drawUpgradesOverlay(ctx, state) {
  const { upgrades, orders } = state;
  ctx.save();
  ctx.fillStyle = 'rgba(18, 10, 6, 0.72)';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  const w = 1020;
  const h = 640;
  const x = (CANVAS_WIDTH - w) / 2;
  const y = (CANVAS_HEIGHT - h) / 2;

  ctx.fillStyle = '#29180f';
  ctx.strokeStyle = PALETTE.brass;
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 18);
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = 'rgba(246, 210, 122, 0.3)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.roundRect(x + 10, y + 10, w - 20, h - 20, 12);
  ctx.stroke();

  // Header
  ctx.fillStyle = '#ffe182';
  ctx.font = '900 28px Georgia, serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('EMBER & BASIL — BRIGADE WORKSHOP', x + 36, y + 44);

  // Bistro Bank Balance Badge
  const availableBank = upgrades.bank + orders.score;
  ctx.fillStyle = '#1f5e36';
  ctx.strokeStyle = '#ffe066';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x + w - 210, y + 24, 174, 40, 10);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#fff9d6';
  ctx.font = '900 17px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`BANK: $${availableBank}`, x + w - 123, y + 45);

  // Left Column: 6 Purchasable Kitchen Equipment Upgrades
  ctx.fillStyle = '#e8c474';
  ctx.font = '800 12.5px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('KITCHEN EQUIPMENT UPGRADES (CARRY ACROSS ALL 3 SHIFTS)', x + 36, y + 84);

  state.overlayButtons = [];
  const uColW = 304;
  const uRowH = 122;
  BISTRO_UPGRADES.forEach((upg, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const ux = x + 34 + col * (uColW + 14);
    const uy = y + 102 + row * (uRowH + 12);
    const owned = upgrades.owned.has(upg.id);
    const canBuy = !owned && availableBank >= upg.cost;

    state.overlayButtons.push({ id: `buy_${upg.id}`, upgradeId: upg.id, x: ux, y: uy, w: uColW, h: uRowH });

    ctx.fillStyle = owned ? '#203b2a' : '#3a2215';
    ctx.strokeStyle = owned ? '#62e08d' : canBuy ? '#f0c451' : 'rgba(220, 165, 68, 0.3)';
    ctx.lineWidth = owned || canBuy ? 2.2 : 1.4;
    ctx.beginPath();
    ctx.roundRect(ux, uy, uColW, uRowH, 11);
    ctx.fill();
    ctx.stroke();

    // Upgrade emblem icon
    ctx.fillStyle = owned ? '#2c7a48' : '#57341e';
    ctx.beginPath();
    ctx.arc(ux + 34, uy + 40, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffe073';
    ctx.font = '900 18px sans-serif';
    ctx.textAlign = 'center';
    const glyph =
      upg.icon === 'knife'
        ? '🔪'
        : upg.icon === 'copper'
          ? '🔥'
          : upg.icon === 'pass'
            ? '🔔'
            : upg.icon === 'wine'
              ? '🍷'
              : upg.icon === 'oven'
                ? '🧱'
                : '⚡';
    ctx.fillText(glyph, ux + 34, uy + 41);

    ctx.fillStyle = '#fff8e6';
    ctx.font = '900 15px Georgia, serif';
    ctx.textAlign = 'left';
    ctx.fillText(upg.name, ux + 64, uy + 30);

    ctx.fillStyle = '#d4be9a';
    ctx.font = '600 11.5px "Trebuchet MS", sans-serif';
    const words = upg.effectText.split(' ');
    let line1 = '';
    let line2 = '';
    let spilled = false;
    for (const word of words) {
      if (!spilled && (line1 + ' ' + word).trim().length <= 31) {
        line1 = (line1 + ' ' + word).trim();
      } else {
        spilled = true;
        line2 = (line2 + ' ' + word).trim();
      }
    }
    ctx.fillText(line1, ux + 64, uy + 52);
    if (line2) ctx.fillText(line2, ux + 64, uy + 68);

    // Price / Equipped pill
    const pillBg = owned ? '#27824a' : canBuy ? '#c9881c' : '#4a3224';
    ctx.fillStyle = pillBg;
    ctx.beginPath();
    ctx.roundRect(ux + 16, uy + uRowH - 32, uColW - 32, 23, 7);
    ctx.fill();
    ctx.fillStyle = owned ? '#e8ffef' : canBuy ? '#fff9d6' : '#a89278';
    ctx.font = '800 11.5px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      owned ? '✓ EQUIPPED IN KITCHEN' : canBuy ? `UPGRADE NOW · $${upg.cost}` : `LOCKED · $${upg.cost}`,
      ux + uColW / 2,
      uy + uRowH - 20,
    );
  });

  // Right Panel: 12-Dish Artisan Bistro Tasting Menu Showcase
  const mx = x + 672;
  const my = y + 102;
  const mw = 314;
  const mh = 434;
  ctx.fillStyle = '#fbf4e3';
  ctx.strokeStyle = '#c9a152';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.roundRect(mx, my, mw, mh, 12);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#331d10';
  ctx.font = '900 15px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('12-DISH ARTISAN BISTRO MENU', mx + mw / 2, my + 24);

  const dishes = Object.values(RECIPES);
  dishes.forEach((d, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const dx = mx + 12 + col * 148;
    const dy = my + 44 + row * 63;

    ctx.fillStyle = '#f2e4c8';
    ctx.beginPath();
    ctx.roundRect(dx, dy, 140, 55, 8);
    ctx.fill();
    drawDishPreview(ctx, d.id, dx + 26, dy + 28, 20, d.price >= 60);
    ctx.fillStyle = '#2d1a0e';
    ctx.font = '800 10.5px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(d.shortName, dx + 50, dy + 21);
    ctx.fillStyle = '#1f7a44';
    ctx.font = '900 11.5px "Trebuchet MS", sans-serif';
    ctx.fillText(`$${d.price}`, dx + 50, dy + 38);
  });

  // Bottom Return Button
  state.overlayButtons.push({
    id: 'close_overlay',
    x: CANVAS_WIDTH / 2 - 140,
    y: y + h - 68,
    w: 280,
    h: 46,
  });
  ctx.fillStyle = '#2b8a4e';
  ctx.strokeStyle = '#ffe073';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(CANVAS_WIDTH / 2 - 140, y + h - 68, 280, 46, 11);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 16px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('RETURN TO SERVICE [U / ESC]', CANVAS_WIDTH / 2, y + h - 45);
  ctx.restore();
}

function drawRecipeBookOverlay(ctx, state) {
  ctx.save();
  ctx.fillStyle = 'rgba(18, 10, 6, 0.74)';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  const w = 1040;
  const h = 656;
  const x = (CANVAS_WIDTH - w) / 2;
  const y = (CANVAS_HEIGHT - h) / 2;

  ctx.fillStyle = '#fbf4e3';
  ctx.strokeStyle = '#8b5e1f';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 16);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#331d10';
  ctx.font = '900 26px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('EMBER & BASIL — 12-DISH CHEF RECIPE BOOK', CANVAS_WIDTH / 2, y + 34);

  ctx.fillStyle = '#735036';
  ctx.font = '700 12px "Trebuchet MS", sans-serif';
  ctx.fillText(
    'Pull cooked items in the Golden Sweet-Spot (★) for +35% Tips · Press [Tab] to coordinate Chef Marco & Sous-Chef Sofia!',
    CANVAS_WIDTH / 2,
    y + 58,
  );

  const list = Object.values(RECIPES);
  const colW = 316;
  const rowH = 120;
  list.forEach((r, idx) => {
    const col = idx % 3;
    const row = Math.floor(idx / 3);
    const rx = x + 30 + col * (colW + 16);
    const ry = y + 78 + row * (rowH + 10);

    ctx.fillStyle = '#f3e5cb';
    ctx.strokeStyle = '#d1b78e';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(rx, ry, colW, rowH, 10);
    ctx.fill();
    ctx.stroke();

    drawDishPreview(ctx, r.id, rx + 40, ry + 48, 28, r.price >= 60);

    ctx.fillStyle = '#2d1a0e';
    ctx.font = '900 13.5px Georgia, serif';
    ctx.textAlign = 'left';
    ctx.fillText(r.name, rx + 76, ry + 22);

    ctx.fillStyle = '#1f7a44';
    ctx.font = '900 13.5px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`$${r.price}`, rx + colW - 12, ry + 22);

    ctx.fillStyle = '#5c402c';
    ctx.font = '700 10.5px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(r.stepsText, rx + 76, ry + 42);

    const parts = r.displaySteps ?? r.components;
    parts.forEach((pId, pi) => {
      const ix = rx + 92 + pi * 58;
      const iy = ry + 78;
      drawIngredientArt(ctx, pId, ix, iy, 12);
      ctx.fillStyle = '#4f3726';
      ctx.font = '700 8.5px "Trebuchet MS", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText((INGREDIENTS[pId]?.short ?? pId).split(' ')[0], ix, iy + 18);
    });
  });

  state.overlayButtons = [
    { id: 'close_overlay', x: CANVAS_WIDTH / 2 - 120, y: y + h - 54, w: 240, h: 40 },
  ];
  ctx.fillStyle = '#2c7a48';
  ctx.beginPath();
  ctx.roundRect(CANVAS_WIDTH / 2 - 120, y + h - 54, 240, 40, 10);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 14.5px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('BACK TO KITCHEN [R / ESC]', CANVAS_WIDTH / 2, y + h - 34);
  ctx.restore();
}

function drawPauseOverlay(ctx, state) {
  ctx.save();
  ctx.fillStyle = 'rgba(18, 10, 6, 0.72)';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  const w = 420;
  const h = 340;
  const x = (CANVAS_WIDTH - w) / 2;
  const y = (CANVAS_HEIGHT - h) / 2;

  ctx.fillStyle = '#2b1a10';
  ctx.strokeStyle = PALETTE.brass;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 16);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#ffe073';
  ctx.font = '900 30px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('SERVICE PAUSED', CANVAS_WIDTH / 2, y + 50);

  const items = [
    { id: 'resume', label: 'Resume Service [P]', color: '#2b824b' },
    { id: 'upgrades', label: 'Brigade Upgrades [U]', color: '#9c6818' },
    { id: 'restart', label: 'Restart Shift', color: '#7a4a20' },
    { id: 'title', label: 'Shift Select', color: '#543422' },
  ];
  state.overlayButtons = [];
  items.forEach((item, idx) => {
    const by = y + 88 + idx * 56;
    state.overlayButtons.push({ id: item.id, x: x + 55, y: by, w: w - 110, h: 44 });
    ctx.fillStyle = item.color;
    ctx.strokeStyle = 'rgba(255, 226, 132, 0.55)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.roundRect(x + 55, by, w - 110, 44, 10);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fff9ec';
    ctx.font = '800 15.5px "Trebuchet MS", sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(item.label, CANVAS_WIDTH / 2, by + 22);
  });
  ctx.restore();
}

function drawSummaryOverlay(ctx, state) {
  const { orders } = state;
  const stars = computeStarRating(orders);

  ctx.save();
  ctx.fillStyle = 'rgba(18, 10, 6, 0.78)';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  const w = 580;
  const h = 456;
  const x = (CANVAS_WIDTH - w) / 2;
  const y = (CANVAS_HEIGHT - h) / 2;

  ctx.fillStyle = '#2a1910';
  ctx.strokeStyle = PALETTE.brass;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 18);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#ffe073';
  ctx.font = '900 34px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('SHIFT COMPLETE!', CANVAS_WIDTH / 2, y + 52);

  ctx.fillStyle = '#e8cf9e';
  ctx.font = '700 14px "Trebuchet MS", sans-serif';
  ctx.fillText(orders.shift.name.toUpperCase(), CANVAS_WIDTH / 2, y + 82);

  for (let i = 0; i < 3; i++) {
    const sx = CANVAS_WIDTH / 2 + (i - 1) * 68;
    const sy = y + 132;
    if (i < stars) drawPerfectStarBadge(ctx, sx, sy, 24);
    else {
      ctx.fillStyle = 'rgba(255, 240, 200, 0.16)';
      ctx.font = '900 40px sans-serif';
      ctx.fillText('★', sx, sy + 14);
    }
  }

  const stats = [
    ['Total Service Revenue', `$${orders.score}`],
    ['Tips & Perfect Bonuses', `$${orders.tipsEarned}`],
    ['Dishes Served', `${orders.dishesServed} (${orders.perfectServed} Chef Perfect ★)`],
    ['Best Combo Streak', `×${orders.maxCombo}`],
    ['Expired Orders', `${orders.expiredCount}`],
  ];
  let sy = y + 188;
  for (const [label, val] of stats) {
    ctx.fillStyle = '#cbb694';
    ctx.font = '700 15px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(label, x + 56, sy);
    ctx.fillStyle = '#fff5d8';
    ctx.font = '900 16px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(val, x + w - 56, sy);
    sy += 31;
  }

  state.overlayButtons = [];
  const hasNext = state.selectedShiftIndex < SHIFTS.length - 1;
  const btns = [
    { id: 'upgrades', label: 'Kitchen Upgrades', x: x + 34, w: 162, color: '#a87018' },
    {
      id: hasNext ? 'next_shift' : 'restart',
      label: hasNext ? 'Next Shift →' : 'Play Again',
      x: x + 208,
      w: 170,
      color: '#2b8a4e',
    },
    { id: 'title', label: 'Shift Select', x: x + 390, w: 156, color: '#6b4222' },
  ];

  for (const b of btns) {
    state.overlayButtons.push({ id: b.id, x: b.x, y: y + h - 72, w: b.w, h: 48 });
    ctx.fillStyle = b.color;
    ctx.strokeStyle = '#ffe073';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(b.x, y + h - 72, b.w, 48, 11);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 15px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(b.label, b.x + b.w / 2, y + h - 48);
  }
  ctx.restore();
}
