// Sunlit Mediterranean 2.5D bistro renderer: kitchen architecture, animated chef, order ticket rail, brass clock, and overlays.

import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
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
import { getActionPromptForStation, getSuggestedStationTypes } from './cooking.js';
import {
  drawDishPreview,
  drawIngredientArt,
  drawKitchenItem,
  drawPerfectStarBadge,
  drawPorcelainPlate,
  drawStatusPill,
} from './food-art.js';
import { STATION_TYPES } from './kitchen.js';
import { computeStarRating, isFeverActive } from './orders.js';
import { renderParticles } from './particles.js';
import { INGREDIENTS, RECIPES, describeItem, findClosestRecipesForPlate } from './recipes.js';

export const SCREEN_MODES = {
  TITLE: 'title',
  PLAYING: 'playing',
  PAUSED: 'paused',
  RECIPES: 'recipes',
  SUMMARY: 'summary',
};

function formatClock(seconds) {
  const clamped = Math.max(0, Math.ceil(seconds));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function collectAvailableParts(kitchen, chef) {
  const parts = new Set();
  const inspect = (item) => {
    if (!item) return;
    if (item.kind === 'ingredient') parts.add(item.id);
    else if (item.kind === 'plate' || item.kind === 'raw_pie') {
      for (const p of item.parts) parts.add(p);
    }
  };
  inspect(chef.heldItem);
  for (const st of kitchen.stations) {
    inspect(st.item);
    if (st.cook && st.cook.state !== 'burnt') {
      parts.add(st.cook.outputId);
    }
  }
  return parts;
}

export function renderGame(ctx, state) {
  const { time, screen, kitchen, chef, orders, fx, hoveredStation, targetStation } = state;

  ctx.save();
  if (fx.shakeTime > 0 && fx.shakePower > 0) {
    const sx = (Math.sin(time * 91) * fx.shakePower * fx.shakeTime) / 0.22;
    const sy = (Math.cos(time * 79) * fx.shakePower * fx.shakeTime) / 0.22;
    ctx.translate(sx, sy);
  }

  // 1. Kitchen Wall & Sunlit Floor
  drawBistroWall(ctx, time);
  drawTerracottaFloor(ctx, time, isFeverActive(orders));

  // 2. Click-to-move auto-path bread crumbs
  if (chef.autoPath.length > 0 && screen === SCREEN_MODES.PLAYING) {
    drawChefRoutePreview(ctx, chef);
  }

  // 3. Stations (sorted back-to-front by row, with chef interleaved by y for true 2.5D depth!)
  const suggestedTypes = getSuggestedStationTypes(chef.heldItem);
  const focusedRecipe = orders.focusedTicketId
    ? orders.tickets.find((t) => t.id === orders.focusedTicketId)?.recipeId ?? null
    : null;

  let chefDrawn = false;
  for (let row = 0; row < GRID_ROWS; row++) {
    const rowBottomY = GRID_ORIGIN_Y + (row + 1) * TILE_SIZE;
    if (!chefDrawn && chef.y < rowBottomY - 22) {
      drawChefCharacter(ctx, chef, time, isFeverActive(orders));
      chefDrawn = true;
    }
    for (let col = 0; col < GRID_COLS; col++) {
      const st = kitchen.grid[row][col];
      if (!st) continue;
      if (st.type === STATION_TYPES.OVEN && st.ovenSide === 'right') continue;
      const isHovered = hoveredStation === st;
      const isTarget = targetStation === st;
      const isSuggested = suggestedTypes.has(st.type);
      drawStation(ctx, st, kitchen, time, {
        isHovered,
        isTarget,
        isSuggested,
        focusedRecipe,
        orders,
        heldItem: chef.heldItem,
      });
    }
  }
  if (!chefDrawn) {
    drawChefCharacter(ctx, chef, time, isFeverActive(orders));
  }

  // 4. Warm diagonal afternoon sunbeams across the kitchen
  drawAfternoonSunbeams(ctx, time);

  // 5. Particles & Floating Score Popups
  renderParticles(ctx, fx);

  // 6. Top Order Ticket Rail & Brass Shift Clock HUD
  const availableParts = collectAvailableParts(kitchen, chef);
  drawTopHudAndTickets(ctx, state, availableParts);

  // 7. Bottom Interactive Oak Status & Quick-Recipe Bar
  drawFooterBar(ctx, state);

  // 8. Rush Banner / Urgency Edge Glow
  if (screen === SCREEN_MODES.PLAYING) {
    drawUrgencyAndBanners(ctx, state);
  }

  // 9. Hover contextual station tooltip
  if (screen === SCREEN_MODES.PLAYING && hoveredStation) {
    drawHoverTooltip(ctx, hoveredStation, chef.heldItem);
  }

  ctx.restore();

  // 10. Fullscreen Overlays (Title, Recipes, Pause, Shift Summary)
  if (screen === SCREEN_MODES.TITLE) {
    drawTitleOverlay(ctx, state);
  } else if (screen === SCREEN_MODES.RECIPES) {
    drawRecipeBookOverlay(ctx, state);
  } else if (screen === SCREEN_MODES.PAUSED) {
    drawPauseOverlay(ctx, state);
  } else if (screen === SCREEN_MODES.SUMMARY) {
    drawSummaryOverlay(ctx, state);
  }
}

function drawBistroWall(ctx, time) {
  const y0 = HUD_HEIGHT;
  const h = WALL_HEIGHT;

  // Base cream wall
  const wallGrad = ctx.createLinearGradient(0, y0, 0, y0 + h);
  wallGrad.addColorStop(0, '#ead9bc');
  wallGrad.addColorStop(1, '#f7ecd9');
  ctx.fillStyle = wallGrad;
  ctx.fillRect(0, y0, CANVAS_WIDTH, h);

  // Subway tile brickwork
  ctx.strokeStyle = PALETTE.wallGrout;
  ctx.lineWidth = 1;
  const tileW = 36;
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

  // Two sunlit arched Mediterranean windows
  for (const wx of [185, 845]) {
    ctx.save();
    ctx.fillStyle = '#734a2c';
    ctx.beginPath();
    ctx.roundRect(wx - 58, y0 + 8, 116, 66, [34, 34, 4, 4]);
    ctx.fill();

    const skyGrad = ctx.createLinearGradient(wx, y0 + 14, wx, y0 + 68);
    skyGrad.addColorStop(0, '#8ecae6');
    skyGrad.addColorStop(0.65, '#ffe5a3');
    skyGrad.addColorStop(1, '#ffd07b');
    ctx.fillStyle = skyGrad;
    ctx.beginPath();
    ctx.roundRect(wx - 50, y0 + 14, 100, 54, [28, 28, 2, 2]);
    ctx.fill();

    // Window mullions
    ctx.strokeStyle = '#734a2c';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(wx, y0 + 14);
    ctx.lineTo(wx, y0 + 68);
    ctx.moveTo(wx - 50, y0 + 44);
    ctx.lineTo(wx + 50, y0 + 44);
    ctx.stroke();

    // Potted basil on windowsill
    ctx.fillStyle = '#c45b33';
    ctx.fillRect(wx - 10, y0 + 58, 20, 12);
    ctx.fillStyle = '#3da347';
    ctx.beginPath();
    ctx.arc(wx - 5, y0 + 54, 7, 0, Math.PI * 2);
    ctx.arc(wx + 5, y0 + 54, 7, 0, Math.PI * 2);
    ctx.arc(wx, y0 + 49, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Center Framed Bistro Chalkboard Sign
  ctx.save();
  const bx = 520;
  ctx.fillStyle = '#6c4223';
  ctx.beginPath();
  ctx.roundRect(bx - 120, y0 + 10, 240, 58, 6);
  ctx.fill();
  ctx.fillStyle = '#25332b';
  ctx.beginPath();
  ctx.roundRect(bx - 113, y0 + 16, 226, 46, 4);
  ctx.fill();
  ctx.strokeStyle = 'rgba(244, 218, 152, 0.45)';
  ctx.lineWidth = 1.2;
  ctx.strokeRect(bx - 108, y0 + 20, 216, 38);

  ctx.fillStyle = '#faeac8';
  ctx.font = '800 15px Georgia, "Times New Roman", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('EMBER & BASIL', bx, y0 + 33);
  ctx.fillStyle = '#e8c16b';
  ctx.font = '700 10px "Trebuchet MS", sans-serif';
  ctx.fillText('WOOD-FIRED BISTRO  ·  HANDMADE PASTA', bx, y0 + 49);
  ctx.restore();

  // Brass hanging copper pan rack on the right
  ctx.save();
  const rx = 1090;
  ctx.strokeStyle = PALETTE.brassDark;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(rx - 95, y0 + 22);
  ctx.lineTo(rx + 95, y0 + 22);
  ctx.stroke();

  const sway = Math.sin(time * 1.4) * 0.03;
  for (const [px, r] of [
    [rx - 62, 14],
    [rx - 22, 11],
    [rx + 18, 15],
    [rx + 60, 12],
  ]) {
    ctx.save();
    ctx.translate(px, y0 + 22);
    ctx.rotate(sway);
    ctx.strokeStyle = '#5c3c1e';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 18);
    ctx.stroke();
    const pGrad = ctx.createRadialGradient(-4, 26, 2, 0, 30, r);
    pGrad.addColorStop(0, PALETTE.copperHighlight);
    pGrad.addColorStop(0.7, PALETTE.copper);
    pGrad.addColorStop(1, '#7a3c1f');
    ctx.fillStyle = pGrad;
    ctx.beginPath();
    ctx.arc(0, 30, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#5c2b14';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();

  // Warm wood molding trim
  ctx.fillStyle = '#734424';
  ctx.fillRect(0, y0 + h - 5, CANVAS_WIDTH, 5);
}

function drawTerracottaFloor(ctx, time, fever) {
  // Side wooden wainscoting walls flanking the kitchen
  ctx.fillStyle = '#56331c';
  ctx.fillRect(0, GRID_ORIGIN_Y, GRID_ORIGIN_X, GRID_ROWS * TILE_SIZE);
  ctx.fillRect(
    GRID_ORIGIN_X + GRID_COLS * TILE_SIZE,
    GRID_ORIGIN_Y,
    CANVAS_WIDTH - (GRID_ORIGIN_X + GRID_COLS * TILE_SIZE),
    GRID_ROWS * TILE_SIZE,
  );

  // Subtle vertical wood paneling on side borders
  ctx.strokeStyle = 'rgba(30, 15, 7, 0.35)';
  ctx.lineWidth = 2;
  for (let x = 16; x < GRID_ORIGIN_X; x += 16) {
    ctx.beginPath();
    ctx.moveTo(x, GRID_ORIGIN_Y);
    ctx.lineTo(x, FOOTER_Y);
    ctx.stroke();
  }
  for (let x = GRID_ORIGIN_X + GRID_COLS * TILE_SIZE + 16; x < CANVAS_WIDTH; x += 16) {
    ctx.beginPath();
    ctx.moveTo(x, GRID_ORIGIN_Y);
    ctx.lineTo(x, FOOTER_Y);
    ctx.stroke();
  }

  // Sunlit terracotta checkerboard floor tiles (half-tile subdivision for cozy scale)
  const sub = TILE_SIZE / 2;
  for (let r = 0; r < GRID_ROWS * 2; r++) {
    for (let c = 0; c < GRID_COLS * 2; c++) {
      const tx = GRID_ORIGIN_X + c * sub;
      const ty = GRID_ORIGIN_Y + r * sub;
      const even = (r + c) % 2 === 0;
      ctx.fillStyle = even ? PALETTE.floorLight : PALETTE.floorDark;
      ctx.fillRect(tx, ty, sub, sub);
      ctx.strokeStyle = 'rgba(130, 74, 42, 0.28)';
      ctx.lineWidth = 1;
      ctx.strokeRect(tx + 0.5, ty + 0.5, sub - 1, sub - 1);
    }
  }

  // Warm Fever golden shimmer along walkable floor edges
  if (fever) {
    const pulse = 0.08 + Math.sin(time * 7) * 0.04;
    ctx.fillStyle = `rgba(255, 206, 68, ${pulse})`;
    ctx.fillRect(GRID_ORIGIN_X, GRID_ORIGIN_Y, GRID_COLS * TILE_SIZE, GRID_ROWS * TILE_SIZE);
  }

  // Subtle floor vignette shadow along kitchen wall
  const topShadow = ctx.createLinearGradient(0, GRID_ORIGIN_Y, 0, GRID_ORIGIN_Y + 26);
  topShadow.addColorStop(0, 'rgba(42, 20, 8, 0.25)');
  topShadow.addColorStop(1, 'rgba(42, 20, 8, 0)');
  ctx.fillStyle = topShadow;
  ctx.fillRect(GRID_ORIGIN_X, GRID_ORIGIN_Y, GRID_COLS * TILE_SIZE, 26);
}

function drawChefRoutePreview(ctx, chef) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 232, 130, 0.65)';
  ctx.lineWidth = 3;
  ctx.setLineDash([7, 7]);
  ctx.beginPath();
  ctx.moveTo(chef.x, chef.y + 8);
  for (const wp of chef.autoPath) {
    ctx.lineTo(wp.x, wp.y + 8);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  const end = chef.autoPath[chef.autoPath.length - 1];
  ctx.fillStyle = 'rgba(255, 224, 102, 0.85)';
  ctx.beginPath();
  ctx.arc(end.x, end.y + 8, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawOakCounterBase(ctx, x, y, w, h, topColor = PALETTE.oakTop, accentRim = false) {
  // Drop shadow on terracotta floor
  ctx.fillStyle = 'rgba(42, 19, 8, 0.28)';
  ctx.beginPath();
  ctx.roundRect(x + 3, y + 6, w - 2, h - 1, 7);
  ctx.fill();

  // 2.5D beveled wooden front face
  ctx.fillStyle = PALETTE.oakFront;
  ctx.beginPath();
  ctx.roundRect(x + 1, y + 2, w - 2, h - 3, 6);
  ctx.fill();

  // Top butcher-block surface
  const topH = h - 14;
  ctx.fillStyle = topColor;
  ctx.beginPath();
  ctx.roundRect(x + 2, y + 2, w - 4, topH, 5);
  ctx.fill();

  // Butcher-block subtle woodgrain planks
  ctx.strokeStyle = 'rgba(130, 77, 36, 0.16)';
  ctx.lineWidth = 1;
  for (let py = y + 14; py < y + topH - 4; py += 14) {
    ctx.beginPath();
    ctx.moveTo(x + 6, py);
    ctx.lineTo(x + w - 6, py);
    ctx.stroke();
  }

  // Top highlight bevel
  ctx.strokeStyle = accentRim ? '#ffe38c' : 'rgba(255, 240, 212, 0.45)';
  ctx.lineWidth = accentRim ? 2 : 1.2;
  ctx.strokeRect(x + 3.5, y + 3.5, w - 7, topH - 3);

  // Subtle brass front cabinet pull
  ctx.fillStyle = PALETTE.brassDark;
  ctx.fillRect(x + w / 2 - 12, y + h - 8, 24, 3);
}

function drawCookGauge(ctx, x, y, cook, time) {
  const r = 19;
  ctx.save();
  ctx.translate(x, y);

  // Backing dark espresso disk
  ctx.fillStyle = 'rgba(26, 15, 9, 0.88)';
  ctx.beginPath();
  ctx.arc(0, 0, r + 3.5, 0, Math.PI * 2);
  ctx.fill();

  const totalWindow = cook.burnTime;
  const startA = -Math.PI / 2;

  // Sweet-spot golden arc preview
  const sweetStartA = startA + (cook.readyTime / totalWindow) * Math.PI * 2;
  const sweetEndA = startA + (cook.sweetEnd / totalWindow) * Math.PI * 2;
  ctx.strokeStyle = 'rgba(255, 214, 70, 0.45)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(0, 0, r - 2, sweetStartA, sweetEndA);
  ctx.stroke();

  // Burn danger arc preview
  const warnStartA = startA + (cook.warnTime / totalWindow) * Math.PI * 2;
  ctx.strokeStyle = 'rgba(225, 62, 50, 0.4)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(0, 0, r - 2, warnStartA, startA + Math.PI * 2);
  ctx.stroke();

  // Active elapsed fill arc
  const frac = Math.min(1, cook.elapsed / totalWindow);
  let color = '#56d178';
  if (cook.state === 'cooking') color = '#58c9f5';
  else if (cook.state === 'sweet') color = '#ffd94a';
  else if (cook.state === 'ready') color = '#4be086';
  else if (cook.state === 'warn') color = Math.sin(time * 18) > 0 ? '#ff4a3d' : '#ff9842';
  else if (cook.state === 'burnt') color = '#665b57';

  ctx.strokeStyle = color;
  ctx.lineWidth = 5.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, 0, r - 2, startA, startA + frac * Math.PI * 2);
  ctx.stroke();

  // Center icon / label
  ctx.fillStyle = '#fff9eb';
  ctx.font = '800 10px "Trebuchet MS", sans-serif';
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
    ctx.font = '900 14px "Trebuchet MS", sans-serif';
    ctx.fillText('!', 0, 1);
  } else if (cook.state === 'burnt') {
    ctx.fillStyle = '#ff7d70';
    ctx.fillText('✕', 0, 0.5);
  } else {
    const pct = Math.min(99, Math.round((cook.elapsed / cook.readyTime) * 100));
    ctx.fillText(`${pct}%`, 0, 0.5);
  }

  ctx.restore();
}

function drawStation(ctx, st, kitchen, time, flags) {
  const rect = tileRect(st.col, st.row);
  const bounceY = -Math.sin(st.bounce * Math.PI) * 5;
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2 - 5;

  ctx.save();
  ctx.translate(0, bounceY);

  // Double-wide Wood-Fired Brick Stone Oven (cols 10..11, row 0)
  if (st.type === STATION_TYPES.OVEN && st.ovenSide === 'left') {
    const rightSt = kitchen.grid[st.row][st.col + 1];
    const w = TILE_SIZE * 2;
    const h = TILE_SIZE;
    const x = rect.x;
    const y = rect.y;

    // Warm hearth firelight spill onto terracotta floor in front of Stone Oven
    const hearthGlow = ctx.createRadialGradient(x + w / 2, y + h + 8, 12, x + w / 2, y + h + 28, 96);
    hearthGlow.addColorStop(0, 'rgba(255, 146, 48, 0.28)');
    hearthGlow.addColorStop(1, 'rgba(255, 110, 24, 0)');
    ctx.fillStyle = hearthGlow;
    ctx.fillRect(x - 10, y + h - 4, w + 20, 96);

    // Shadow
    ctx.fillStyle = 'rgba(35, 16, 6, 0.34)';
    ctx.beginPath();
    ctx.roundRect(x + 4, y + 6, w - 4, h - 2, 10);
    ctx.fill();

    // Terracotta Brick Dome Exterior
    const brickGrad = ctx.createLinearGradient(x, y, x, y + h);
    brickGrad.addColorStop(0, '#b5563b');
    brickGrad.addColorStop(0.65, '#8c3b27');
    brickGrad.addColorStop(1, '#5e2417');
    ctx.fillStyle = brickGrad;
    ctx.beginPath();
    ctx.roundRect(x + 2, y + 2, w - 4, h - 4, [14, 14, 6, 6]);
    ctx.fill();

    // Mortar brick courses
    ctx.strokeStyle = 'rgba(244, 218, 184, 0.25)';
    ctx.lineWidth = 1.3;
    for (let by = y + 14; by < y + h - 12; by += 14) {
      ctx.beginPath();
      ctx.moveTo(x + 6, by);
      ctx.lineTo(x + w - 6, by);
      ctx.stroke();
    }

    // Two arched hearth openings (Slot 1 & Slot 2)
    for (const [slotIdx, ovenSt] of [
      [0, st],
      [1, rightSt],
    ]) {
      const sx = x + 48 + slotIdx * TILE_SIZE;
      const sy = y + 48;
      const active = Boolean(ovenSt?.cook);
      const flicker = 0.85 + Math.sin(time * 13 + slotIdx * 2) * 0.15;

      // Arched opening
      ctx.fillStyle = '#23120b';
      ctx.beginPath();
      ctx.arc(sx, sy + 4, 30, Math.PI, 0);
      ctx.lineTo(sx + 30, sy + 26);
      ctx.lineTo(sx - 30, sy + 26);
      ctx.closePath();
      ctx.fill();

      // Brick arch keystone trim
      ctx.strokeStyle = '#d98a5b';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(sx, sy + 4, 31, Math.PI, 0);
      ctx.stroke();

      // Glowing hearth fire bed
      const fireGrad = ctx.createRadialGradient(sx, sy + 18, 3, sx, sy + 16, 28);
      fireGrad.addColorStop(0, `rgba(255, 224, 102, ${0.95 * flicker})`);
      fireGrad.addColorStop(0.5, `rgba(255, 112, 32, ${0.75 * flicker})`);
      fireGrad.addColorStop(1, 'rgba(130, 26, 8, 0.05)');
      ctx.fillStyle = fireGrad;
      ctx.beginPath();
      ctx.arc(sx, sy + 16, 27, Math.PI, 0);
      ctx.lineTo(sx + 27, sy + 24);
      ctx.lineTo(sx - 27, sy + 24);
      ctx.closePath();
      ctx.fill();

      // Item baking inside oven hearth
      if (active) {
        const previewId = ovenSt.cook.state === 'burnt' ? 'burnt' : ovenSt.cook.outputId;
        drawIngredientArt(ctx, previewId, sx, sy + 10, 17);
        drawCookGauge(ctx, sx + 22, sy - 20, ovenSt.cook, time);
      }
    }

    drawStatusPill(ctx, x + w / 2, y + h - 9, 'STONE HEARTH OVEN', '#3b190f', '#ffdfa0');

    // Highlight if hovered or targeted on either side
    if (flags.isHovered || flags.isTarget || flags.isSuggested) {
      drawStationOutline(ctx, x + 2, y + 2, w - 4, h - 4, flags.isTarget || flags.isHovered, time);
    }
    ctx.restore();
    return;
  }

  // Base counter by station type
  if (st.type === STATION_TYPES.PANTRY) {
    drawOakCounterBase(ctx, rect.x, rect.y, rect.w, rect.h, '#c48a4f');
    // Wooden crate recess
    ctx.fillStyle = '#6e4321';
    ctx.beginPath();
    ctx.roundRect(rect.x + 10, rect.y + 8, rect.w - 20, rect.h - 28, 6);
    ctx.fill();
    ctx.strokeStyle = '#996032';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Abundant overflowing ingredients in crate
    const offsets = [
      [-14, -7],
      [14, -7],
      [-11, 8],
      [12, 8],
      [0, 0],
    ];
    for (const [ox, oy] of offsets) {
      drawIngredientArt(ctx, st.ingredient, cx + ox, cy + oy - 2, 14.5);
    }
    drawStatusPill(ctx, cx, rect.y + rect.h - 11, st.label.toUpperCase(), '#2e1b10', '#f9e7c2');
  } else if (st.type === STATION_TYPES.POT) {
    // Dark slate stovetop counter
    drawOakCounterBase(ctx, rect.x, rect.y, rect.w, rect.h, '#4a4547');
    // Gas burner grate
    ctx.fillStyle = '#252224';
    ctx.beginPath();
    ctx.arc(cx, cy, 32, 0, Math.PI * 2);
    ctx.fill();
    if (st.cook) {
      const glow = 0.65 + Math.sin(time * 16) * 0.25;
      ctx.strokeStyle = `rgba(255, 132, 36, ${glow})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(cx, cy, 31, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Hammered copper stockpot
    ctx.fillStyle = PALETTE.brassDark;
    ctx.fillRect(cx - 34, cy - 5, 68, 10);
    const potGrad = ctx.createRadialGradient(cx - 8, cy - 8, 4, cx, cy, 27);
    potGrad.addColorStop(0, PALETTE.copperHighlight);
    potGrad.addColorStop(0.65, PALETTE.copper);
    potGrad.addColorStop(1, '#7c3a1d');
    ctx.fillStyle = potGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#f2b98a';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Broth / bubbling liquid inside pot
    const isTomato = st.cook?.inputId === 'chopped_tomato';
    ctx.fillStyle = st.cook
      ? st.cook.state === 'burnt'
        ? '#261e1c'
        : isTomato
          ? '#c7301e'
          : '#e8d79b'
      : '#3b4a52';
    ctx.beginPath();
    ctx.arc(cx, cy, 20, 0, Math.PI * 2);
    ctx.fill();

    if (st.cook) {
      // Animated simmering bubbles
      ctx.fillStyle = isTomato ? 'rgba(255, 168, 128, 0.7)' : 'rgba(255, 252, 232, 0.75)';
      for (let i = 0; i < 4; i++) {
        const a = time * 2.5 + i * 1.6;
        const bx = cx + Math.cos(a) * 9;
        const by = cy + Math.sin(a * 1.3) * 8;
        const br = 2 + ((time * 4 + i) % 1) * 3.5;
        ctx.beginPath();
        ctx.arc(bx, by, br, 0, Math.PI * 2);
        ctx.fill();
      }
      drawIngredientArt(
        ctx,
        st.cook.state === 'burnt' ? 'burnt' : st.cook.outputId,
        cx,
        cy,
        13.5,
      );
      drawCookGauge(ctx, cx + 24, cy - 22, st.cook, time);
    }
    drawStatusPill(ctx, cx, rect.y + rect.h - 11, 'COPPER POT', '#331d13', '#ffd8a8');
  } else if (st.type === STATION_TYPES.SKILLET) {
    drawOakCounterBase(ctx, rect.x, rect.y, rect.w, rect.h, '#4a4547');
    // Burner glow
    ctx.fillStyle = '#242124';
    ctx.beginPath();
    ctx.arc(cx, cy, 32, 0, Math.PI * 2);
    ctx.fill();
    if (st.cook) {
      const glow = 0.75 + Math.sin(time * 20) * 0.25;
      ctx.strokeStyle = `rgba(255, 108, 28, ${glow})`;
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.arc(cx, cy, 32, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Cast-iron skillet handle
    ctx.strokeStyle = '#1f1d20';
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx + 18, cy + 16);
    ctx.lineTo(cx + 34, cy + 28);
    ctx.stroke();

    // Skillet pan body
    const panGrad = ctx.createRadialGradient(cx - 6, cy - 6, 4, cx, cy, 27);
    panGrad.addColorStop(0, '#49464d');
    panGrad.addColorStop(0.75, '#2b292d');
    panGrad.addColorStop(1, '#18171a');
    ctx.fillStyle = panGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, 26, 0, Math.PI * 2);
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
      drawIngredientArt(ctx, showId, cx, cy, 17);
      drawCookGauge(ctx, cx + 24, cy - 22, st.cook, time);
    }
    drawStatusPill(ctx, cx, rect.y + rect.h - 11, 'SKILLET', '#242124', '#ffcf91');
  } else if (st.type === STATION_TYPES.CHOP) {
    drawOakCounterBase(ctx, rect.x, rect.y, rect.w, rect.h, PALETTE.oakLight);
    // Pale maple butcher cutting board
    ctx.fillStyle = '#f2dec0';
    ctx.strokeStyle = '#b08654';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(rect.x + 12, rect.y + 10, rect.w - 24, rect.h - 32, 6);
    ctx.fill();
    ctx.stroke();

    // Knife marks on board
    ctx.strokeStyle = 'rgba(148, 108, 66, 0.25)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(rect.x + 24 + i * 11, rect.y + 20);
      ctx.lineTo(rect.x + 28 + i * 11, rect.y + 46);
      ctx.stroke();
    }

    // Chef knife resting (or bobbing when actively chopping!)
    const knifeLift = st.chopProgress > 0 ? Math.abs(Math.sin(time * 24)) * 7 : 0;
    ctx.save();
    ctx.translate(cx + 22, cy - 4 - knifeLift);
    ctx.rotate(st.chopProgress > 0 ? -0.35 - knifeLift * 0.04 : -0.78);
    // Handle
    ctx.fillStyle = '#332016';
    ctx.fillRect(-14, -3, 12, 6);
    // Stainless blade
    ctx.fillStyle = '#e8eef2';
    ctx.strokeStyle = '#8b99a3';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-2, -3);
    ctx.lineTo(18, -3);
    ctx.quadraticCurveTo(16, 6, -2, 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    if (st.item) {
      drawKitchenItem(ctx, st.item, cx - 4, cy, 24, true);
    }

    // Crisp horizontal chop progress bar
    if (st.chopProgress > 0) {
      const bw = 64;
      const bh = 9;
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
    drawOakCounterBase(ctx, rect.x, rect.y, rect.w, rect.h, PALETTE.oakTop);
    for (let i = 0; i < 3; i++) {
      drawPorcelainPlate(ctx, cx, cy + 8 - i * 6, 25, false);
    }
    drawStatusPill(ctx, cx, rect.y + rect.h - 11, 'PLATES', '#332214', '#fff5dc');
  } else if (st.type === STATION_TYPES.COMPOST) {
    drawOakCounterBase(ctx, rect.x, rect.y, rect.w, rect.h, '#5c4b3d');
    ctx.fillStyle = '#2d2520';
    ctx.strokeStyle = PALETTE.brass;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#d9c6a3';
    ctx.font = '800 18px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('♻', cx, cy + 1);
    drawStatusPill(ctx, cx, rect.y + rect.h - 11, 'COMPOST', '#2b1d14', '#e8d8b8');
  } else if (st.type === STATION_TYPES.PASS_HOLD) {
    // Illuminated Brass Heat-Lamp Service Shelf
    drawOakCounterBase(ctx, rect.x, rect.y, rect.w, rect.h, '#cfa258', true);
    const lampGlow = ctx.createRadialGradient(cx, cy, 6, cx, cy, 42);
    lampGlow.addColorStop(0, 'rgba(255, 224, 128, 0.45)');
    lampGlow.addColorStop(1, 'rgba(255, 196, 72, 0)');
    ctx.fillStyle = lampGlow;
    ctx.fillRect(rect.x + 4, rect.y + 4, rect.w - 8, rect.h - 18);

    if (st.item) {
      drawKitchenItem(ctx, st.item, cx, cy - 1, 29, true);
      if (st.item.kind === 'plate' && st.item.dishId) {
        // Gentle rising aroma ribbons on a ready-to-serve gourmet plate
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 250, 232, 0.62)';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        for (let wIdx = -1; wIdx <= 1; wIdx++) {
          const wx = cx + wIdx * 10;
          const phase = time * 3.4 + wIdx * 1.4;
          ctx.beginPath();
          ctx.moveTo(wx, cy - 14);
          ctx.bezierCurveTo(
            wx - 5 + Math.sin(phase) * 4,
            cy - 24,
            wx + 5 + Math.cos(phase) * 4,
            cy - 32,
            wx + Math.sin(phase) * 3,
            cy - 40,
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
    drawStatusPill(ctx, cx, rect.y + rect.h - 11, 'WARM PASS', '#5c3c0e', '#ffe9a6');
  } else if (st.type === STATION_TYPES.SERVE_BELL) {
    // Iconic Brass Service Pass Window & Counter Bell
    drawOakCounterBase(ctx, rect.x, rect.y, rect.w, rect.h, '#d6a44b', true);
    // Striped bistro awning along right edge
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#276e47' : '#fbf4e3';
      ctx.fillRect(rect.x + rect.w - 15, rect.y + 4 + i * 12, 13, 12);
    }

    // Gleaming Brass Counter Bell
    const bellScale = 1 + Math.sin(st.bellPulse * Math.PI * 3) * 0.14;
    ctx.save();
    ctx.translate(cx - 4, cy + 2);
    ctx.scale(bellScale, bellScale);
    ctx.fillStyle = '#332011';
    ctx.beginPath();
    ctx.ellipse(0, 12, 24, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    const bellGrad = ctx.createRadialGradient(-7, -7, 2, 0, 2, 22);
    bellGrad.addColorStop(0, '#fff4b8');
    bellGrad.addColorStop(0.5, '#e8b238');
    bellGrad.addColorStop(1, '#8c5d14');
    ctx.fillStyle = bellGrad;
    ctx.beginPath();
    ctx.arc(0, 8, 20, Math.PI, 0);
    ctx.lineTo(20, 11);
    ctx.lineTo(-20, 11);
    ctx.closePath();
    ctx.fill();
    // Top button
    ctx.fillStyle = '#ffe580';
    ctx.beginPath();
    ctx.arc(0, -13, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Pulsing Serve Beacon whenever a complete dish is held or waiting on Warm Pass!
    const warmPass = kitchen.stations.find((s) => s.type === STATION_TYPES.PASS_HOLD);
    const hasReadyDish =
      Boolean(flags.heldItem?.kind === 'plate' && flags.heldItem?.dishId) ||
      Boolean(warmPass?.item?.kind === 'plate' && warmPass?.item?.dishId);
    if (hasReadyDish) {
      const bounce = Math.sin(time * 8) * 4;
      drawStatusPill(ctx, cx - 4, rect.y + 5 + bounce, 'SERVE BELL!', '#1d8a4b', '#ffffff', '#ffe066');
    }
    drawStatusPill(ctx, cx - 2, rect.y + rect.h - 11, 'SERVE PASS', '#472c08', '#ffe48f');
  } else if (st.type === STATION_TYPES.SHOWCASE) {
    // Dining Pass Exit Counter (shows last served gourmet plate!)
    drawOakCounterBase(ctx, rect.x, rect.y, rect.w, rect.h, '#c48f4d');
    ctx.fillStyle = 'rgba(255, 240, 204, 0.25)';
    ctx.beginPath();
    ctx.roundRect(rect.x + 12, rect.y + 10, rect.w - 24, rect.h - 32, 6);
    ctx.fill();

    if (st.showcase) {
      drawDishPreview(ctx, st.showcase.dishId, cx, cy - 2, 26, st.showcase.perfect);
      drawStatusPill(
        ctx,
        cx,
        rect.y + 7,
        `SERVED +$${st.showcase.payout}`,
        '#256b40',
        '#fff6cc',
        '#ffd954',
      );
    }
    drawStatusPill(ctx, cx, rect.y + rect.h - 11, 'TO DINING', '#3b2412', '#f2dec0');
  } else {
    // Oak Prep / Assembly Counter
    const isAssembly = st.role === 'assembly';
    drawOakCounterBase(
      ctx,
      rect.x,
      rect.y,
      rect.w,
      rect.h,
      isAssembly ? '#dfb075' : PALETTE.oakTop,
      isAssembly,
    );
    if (isAssembly) {
      // Subtle linen plating mat on assembly benches
      ctx.fillStyle = 'rgba(255, 249, 236, 0.34)';
      ctx.strokeStyle = 'rgba(138, 86, 44, 0.28)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.roundRect(rect.x + 11, rect.y + 10, rect.w - 22, rect.h - 30, 8);
      ctx.fill();
      ctx.stroke();
    } else if (!st.item && st.col === 3 && st.row === 4) {
      // Decorative artisan olive oil cruet & pepper mill on the Spice Counter when empty
      ctx.fillStyle = '#c89b32';
      ctx.beginPath();
      ctx.arc(cx - 14, cy + 4, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#6b4714';
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.fillStyle = '#5c361e';
      ctx.beginPath();
      ctx.arc(cx + 12, cy - 2, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f2d084';
      ctx.beginPath();
      ctx.arc(cx + 12, cy - 2, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (!st.item && st.col === 0 && st.row === 3) {
      // Folded red-and-cream bistro kitchen towel on West Prep Counter when empty
      ctx.fillStyle = '#fbf4e3';
      ctx.strokeStyle = '#c4a980';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.roundRect(cx - 22, cy - 12, 44, 24, 4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#c9412e';
      ctx.fillRect(cx - 18, cy - 6, 36, 4);
      ctx.fillRect(cx - 18, cy + 3, 36, 4);
    }
    if (st.item) {
      drawKitchenItem(ctx, st.item, cx, cy - 1, isAssembly ? 29 : 26, true);
    }
  }

  // Interactive Target / Hover / Suggested Guidance Ring
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
  ctx.lineWidth = strong ? 3.5 : 2.2;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.stroke();
  ctx.restore();
}

function drawChefCharacter(ctx, chef, time, fever) {
  const bob = Math.abs(Math.sin(chef.walkCycle)) * 4;
  const speed = Math.hypot(chef.vx, chef.vy);
  const tilt = speed > 15 ? Math.sin(chef.walkCycle) * 0.08 : 0;

  ctx.save();
  ctx.translate(chef.x, chef.y);

  // Ground shadow
  ctx.fillStyle = 'rgba(34, 15, 6, 0.32)';
  ctx.beginPath();
  ctx.ellipse(0, 18, 24, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  // Fever golden aura beneath chef's feet
  if (fever) {
    const aura = ctx.createRadialGradient(0, 14, 4, 0, 14, 34);
    aura.addColorStop(0, 'rgba(255, 214, 68, 0.55)');
    aura.addColorStop(1, 'rgba(255, 214, 68, 0)');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, 14, 34, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.translate(0, -bob);
  ctx.rotate(tilt);

  // Chef Shoes
  const stride = speed > 15 ? Math.sin(chef.walkCycle) * 5 : 0;
  ctx.fillStyle = '#382218';
  ctx.beginPath();
  ctx.ellipse(-9, 14 + stride * 0.5, 7, 4.5, 0, 0, Math.PI * 2);
  ctx.ellipse(9, 14 - stride * 0.5, 7, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Crisp White Chef Coat & Olive Bistro Apron
  ctx.fillStyle = '#fff9ee';
  ctx.strokeStyle = '#5c4130';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(-19, -12, 38, 27, 13);
  ctx.fill();
  ctx.stroke();

  // Sage-olive chef apron front + brass buttons
  ctx.fillStyle = '#3a6e4c';
  ctx.beginPath();
  ctx.roundRect(-13, -1, 26, 16, [4, 4, 9, 9]);
  ctx.fill();
  ctx.fillStyle = '#f0c451';
  ctx.beginPath();
  ctx.arc(-5, -6, 2, 0, Math.PI * 2);
  ctx.arc(5, -6, 2, 0, Math.PI * 2);
  ctx.fill();

  // Warm Neckerchief
  ctx.fillStyle = '#d1432e';
  ctx.beginPath();
  ctx.moveTo(-10, -11);
  ctx.lineTo(10, -11);
  ctx.lineTo(0, -3);
  ctx.closePath();
  ctx.fill();

  // Head
  ctx.fillStyle = '#f5c79e';
  ctx.strokeStyle = '#6e452b';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(0, -20, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Expressive eyes shifted toward facing direction
  const eyeOffX = chef.facingX * 4;
  const eyeOffY = chef.facingY * 2.5;
  ctx.fillStyle = '#291910';
  ctx.beginPath();
  ctx.arc(-4.8 + eyeOffX, -19 + eyeOffY, 2.2, 0, Math.PI * 2);
  ctx.arc(4.8 + eyeOffX, -19 + eyeOffY, 2.2, 0, Math.PI * 2);
  ctx.fill();
  // Rosy cheeks
  ctx.fillStyle = 'rgba(232, 118, 98, 0.45)';
  ctx.beginPath();
  ctx.arc(-9 + eyeOffX * 0.6, -15 + eyeOffY, 2.6, 0, Math.PI * 2);
  ctx.arc(9 + eyeOffX * 0.6, -15 + eyeOffY, 2.6, 0, Math.PI * 2);
  ctx.fill();

  // Iconic Pleated Chef Toque (Hat)
  ctx.save();
  ctx.translate(0, -32);
  ctx.rotate(chef.facingX * 0.14);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#756658';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(-8, -7, 9, 0, Math.PI * 2);
  ctx.arc(8, -7, 9, 0, Math.PI * 2);
  ctx.arc(0, -11, 10.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#fffdf7';
  ctx.beginPath();
  ctx.roundRect(-13, -4, 26, 9, 3);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Hands & Held Culinary Item
  const holdX = chef.facingX * 26;
  const holdY = -2 + chef.facingY * 18;
  const chopOffset = chef.choppingAnim > 0 ? Math.sin(time * 36) * 5 : 0;

  ctx.fillStyle = '#f5c79e';
  ctx.strokeStyle = '#6e452b';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(holdX - chef.facingY * 11, holdY + chef.facingX * 11 + chopOffset, 5.2, 0, Math.PI * 2);
  ctx.arc(holdX + chef.facingY * 11, holdY - chef.facingX * 11 - chopOffset, 5.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  if (chef.heldItem) {
    drawKitchenItem(ctx, chef.heldItem, holdX, holdY - 4, 24, false);
  }

  ctx.restore();
}

function drawAfternoonSunbeams(ctx, time) {
  ctx.save();
  const shimmer = 0.085 + Math.sin(time * 0.8) * 0.015;
  for (const wx of [185, 845]) {
    const grad = ctx.createLinearGradient(wx, GRID_ORIGIN_Y - 10, wx + 170, FOOTER_Y);
    grad.addColorStop(0, `rgba(255, 238, 178, ${shimmer * 1.4})`);
    grad.addColorStop(0.55, `rgba(255, 224, 146, ${shimmer * 0.7})`);
    grad.addColorStop(1, 'rgba(255, 224, 146, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(wx - 48, GRID_ORIGIN_Y - 10);
    ctx.lineTo(wx + 48, GRID_ORIGIN_Y - 10);
    ctx.lineTo(wx + 240, FOOTER_Y);
    ctx.lineTo(wx + 80, FOOTER_Y);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawTopHudAndTickets(ctx, state, availableParts) {
  const { orders, time, shiftElapsed, shiftDuration, audio } = state;

  // Deep espresso top header background
  const headGrad = ctx.createLinearGradient(0, 0, 0, HUD_HEIGHT);
  headGrad.addColorStop(0, '#1e130d');
  headGrad.addColorStop(1, '#2f1d13');
  ctx.fillStyle = headGrad;
  ctx.fillRect(0, 0, CANVAS_WIDTH, HUD_HEIGHT);

  // Brushed brass & steel overhead ticket rail bar
  const railGrad = ctx.createLinearGradient(0, 8, 0, 20);
  railGrad.addColorStop(0, '#f0cc75');
  railGrad.addColorStop(0.5, '#b88532');
  railGrad.addColorStop(1, '#6b4714');
  ctx.fillStyle = railGrad;
  ctx.fillRect(14, 9, 976, 11);

  // Brass bottom divider trim
  ctx.fillStyle = PALETTE.brass;
  ctx.fillRect(0, HUD_HEIGHT - 3, CANVAS_WIDTH, 3);

  // Order Tickets clipped to rail
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

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
    ctx.beginPath();
    ctx.roundRect(3, 5, ticketW, ticketH, 7);
    ctx.fill();

    // Cream restaurant order slip paper
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

    // Brass ticket clip at top center
    ctx.fillStyle = '#d9a441';
    ctx.strokeStyle = '#634112';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(ticketW / 2 - 14, -7, 28, 12, 3);
    ctx.fill();
    ctx.stroke();

    // Ticket header banner
    ctx.fillStyle = ticket.isVip ? '#b87a14' : recipe.accent;
    ctx.beginPath();
    ctx.roundRect(2, 2, ticketW - 4, 24, [5, 5, 0, 0]);
    ctx.fill();

    ctx.fillStyle = '#fffaf0';
    ctx.font = '800 11.5px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const titlePrefix = ticket.isVip ? '★ ' : '';
    ctx.fillText(`${titlePrefix}${recipe.shortName}`, 8, 14.5);

    // Ticket payout badge
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffe588';
    ctx.font = '900 12px "Trebuchet MS", sans-serif';
    ctx.fillText(`$${recipe.price}`, ticketW - 8, 14.5);

    // Bespoke mini dish preview on left side of ticket
    drawDishPreview(ctx, ticket.recipeId, 34, 62, 24, ticket.isVip);

    // Step-by-step Ingredient Icons on right side of ticket (single clean row for 3 or 4 items, zero overlap!)
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

    // Oven indicator or VIP Critic badge cleanly below ingredient row
    if (recipe.ovenRecipe) {
      drawStatusPill(ctx, 123, 84, 'BAKE IN STONE OVEN', '#8c3b27', '#ffe6ba');
    } else if (ticket.isVip) {
      drawStatusPill(ctx, 123, 84, '★ VIP CRITIC · +35%', '#9e670e', '#fff8d6', '#f0c451');
    } else {
      ctx.fillStyle = '#634734';
      ctx.font = '700 9.5px "Trebuchet MS", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('FRESH PLATE & SERVE', 66, 85);
    }

    // Chunky Patience Timer Bar
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

    // Remaining seconds micro-text on timer bar
    ctx.fillStyle = '#1e120a';
    ctx.font = '800 9px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.ceil(ticket.patience)}s`, barX + barW - 3, barY + 5.5);

    ctx.restore();
  }

  // Right HUD Cluster: Brass Shift Timer + Cash Score + Combo/Fever + Utility Buttons
  const hudX = 1002;
  const hudW = 264;
  ctx.save();
  ctx.fillStyle = 'rgba(20, 12, 7, 0.72)';
  ctx.strokeStyle = 'rgba(220, 165, 68, 0.55)';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.roundRect(hudX, 10, hudW, 124, 10);
  ctx.fill();
  ctx.stroke();

  // Circular Brass Analog Shift Clock Dial
  const remaining = Math.max(0, shiftDuration - shiftElapsed);
  const timeRatio = Math.max(0, remaining / Math.max(1, shiftDuration));
  const urgentShift = remaining <= 25 && state.screen === SCREEN_MODES.PLAYING;
  const clockX = hudX + 38;
  const clockY = 48;

  ctx.fillStyle = urgentShift && Math.sin(time * 12) > 0 ? '#5c1814' : '#fbf2dc';
  ctx.strokeStyle = urgentShift ? '#ff594a' : PALETTE.brass;
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.arc(clockX, clockY, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Remaining shift wedge
  ctx.fillStyle = urgentShift ? 'rgba(224, 65, 52, 0.3)' : 'rgba(53, 161, 98, 0.24)';
  ctx.beginPath();
  ctx.moveTo(clockX, clockY);
  ctx.arc(
    clockX,
    clockY,
    20,
    -Math.PI / 2,
    -Math.PI / 2 + Math.PI * 2 * timeRatio,
  );
  ctx.closePath();
  ctx.fill();

  // Clock hand
  const handAngle = -Math.PI / 2 + Math.PI * 2 * (1 - timeRatio);
  ctx.strokeStyle = urgentShift ? '#ffdedb' : '#2e1a0e';
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(clockX, clockY);
  ctx.lineTo(clockX + Math.cos(handAngle) * 15, clockY + Math.sin(handAngle) * 15);
  ctx.stroke();
  ctx.fillStyle = PALETTE.brassDark;
  ctx.beginPath();
  ctx.arc(clockX, clockY, 3, 0, Math.PI * 2);
  ctx.fill();

  // Bold Digital Timer & Shift Status
  ctx.fillStyle = urgentShift ? '#ff7c70' : '#fff6df';
  ctx.font = '900 26px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(formatClock(remaining), hudX + 72, 39);

  ctx.fillStyle = orders.rushActive ? '#ffb84d' : '#cbb694';
  ctx.font = '800 10.5px "Trebuchet MS", sans-serif';
  ctx.fillText(
    orders.rushActive ? '🔥 DINNER RUSH' : orders.shift.name.toUpperCase(),
    hudX + 73,
    59,
  );

  // Score & Stars
  ctx.fillStyle = '#ffe066';
  ctx.font = '900 24px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`$${orders.score}`, hudX + hudW - 14, 39);

  const stars = computeStarRating(orders);
  for (let s = 0; s < 3; s++) {
    ctx.fillStyle = s < stars ? '#ffd447' : 'rgba(255, 240, 200, 0.22)';
    ctx.font = '900 13px sans-serif';
    ctx.fillText('★', hudX + hudW - 44 + s * 15, 59);
  }

  // Divider
  ctx.strokeStyle = 'rgba(220, 165, 68, 0.28)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(hudX + 12, 77);
  ctx.lineTo(hudX + hudW - 12, 77);
  ctx.stroke();

  // Combo & Fever Meter Strip
  const feverOn = isFeverActive(orders);
  const pillColor = feverOn ? '#c96f14' : orders.combo >= 2 ? '#236e42' : '#3a261a';
  ctx.fillStyle = pillColor;
  ctx.beginPath();
  ctx.roundRect(hudX + 12, 86, 114, 36, 7);
  ctx.fill();
  ctx.strokeStyle = feverOn ? '#ffe066' : 'rgba(255, 240, 204, 0.25)';
  ctx.lineWidth = 1.4;
  ctx.stroke();

  ctx.fillStyle = feverOn ? '#fff7cc' : '#f5e4c4';
  ctx.font = '900 13px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(
    feverOn ? `🔥 FEVER ×${orders.combo}` : orders.combo > 0 ? `COMBO ×${orders.combo}` : 'STREAK ×0',
    hudX + 69,
    100,
  );
  ctx.fillStyle = '#ffe599';
  ctx.font = '700 9.5px "Trebuchet MS", sans-serif';
  ctx.fillText(
    feverOn ? `${Math.ceil(orders.feverTimer)}s +25% TIPS` : `${orders.dishesServed} SERVED`,
    hudX + 69,
    114,
  );

  // Utility Buttons: Recipes (R), Sound (M), Pause (P)
  state.hudButtons = [];
  const btns = [
    { id: 'recipes', label: 'Menu', key: 'R', x: hudX + 134, w: 46 },
    { id: 'mute', label: audio.isMuted() ? 'Off' : 'Sfx', key: 'M', x: hudX + 184, w: 36 },
    { id: 'pause', label: 'II', key: 'P', x: hudX + 224, w: 30 },
  ];
  for (const b of btns) {
    state.hudButtons.push({ id: b.id, x: b.x, y: 86, w: b.w, h: 36 });
    ctx.fillStyle = '#3b2416';
    ctx.strokeStyle = 'rgba(220, 165, 68, 0.5)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(b.x, 86, b.w, 36, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fff2d1';
    ctx.font = '800 11px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(b.label, b.x + b.w / 2, 100);
    ctx.fillStyle = '#cfa355';
    ctx.font = '700 9px "Trebuchet MS", sans-serif';
    ctx.fillText(`[${b.key}]`, b.x + b.w / 2, 114);
  }

  ctx.restore();
}

function drawFooterBar(ctx, state) {
  const { chef, orders } = state;

  // Rich dark walnut footer bar
  const grad = ctx.createLinearGradient(0, FOOTER_Y, 0, CANVAS_HEIGHT);
  grad.addColorStop(0, '#301d13');
  grad.addColorStop(1, '#1b100a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, FOOTER_Y, CANVAS_WIDTH, FOOTER_HEIGHT);

  ctx.fillStyle = PALETTE.brass;
  ctx.fillRect(0, FOOTER_Y, CANVAS_WIDTH, 3);

  // Left: Chef Held Item & Smart Context Card
  ctx.save();
  ctx.fillStyle = 'rgba(255, 245, 224, 0.08)';
  ctx.strokeStyle = 'rgba(220, 165, 68, 0.4)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.roundRect(16, FOOTER_Y + 12, 354, 70, 9);
  ctx.fill();
  ctx.stroke();

  if (chef.heldItem) {
    drawKitchenItem(ctx, chef.heldItem, 54, FOOTER_Y + 47, 24, false);
  } else {
    ctx.strokeStyle = 'rgba(245, 220, 175, 0.35)';
    ctx.lineWidth = 1.8;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(54, FOOTER_Y + 47, 20, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.fillStyle = '#e8be66';
  ctx.font = '800 10.5px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('IN CHEF HANDS', 90, FOOTER_Y + 28);

  ctx.fillStyle = '#fff7e4';
  ctx.font = '800 14.5px "Trebuchet MS", sans-serif';
  ctx.fillText(describeItem(chef.heldItem), 90, FOOTER_Y + 48);

  let nextStep = 'Grab ingredients or click any station to cook';
  if (chef.heldItem?.kind === 'ingredient') {
    nextStep = INGREDIENTS[chef.heldItem.id]?.stepHint ?? nextStep;
  } else if (chef.heldItem?.kind === 'plate') {
    if (chef.heldItem.dishId) {
      nextStep = 'Bring to Brass Service Bell on the right!';
    } else if (chef.heldItem.parts.length > 0) {
      const m = findClosestRecipesForPlate(chef.heldItem)[0];
      if (m) nextStep = `Add ${m.missing.map((x) => INGREDIENTS[x]?.short ?? x).join(' + ')}`;
    } else {
      nextStep = 'Scoop cooked food from Pots, Skillets or Oven';
    }
  } else if (chef.heldItem?.kind === 'raw_pie') {
    nextStep = 'Top with Pomodoro + Basil/Porcini -> Oven';
  }
  ctx.fillStyle = '#cbb694';
  ctx.font = '600 10.5px "Trebuchet MS", sans-serif';
  ctx.fillText(nextStep, 90, FOOTER_Y + 67);
  ctx.restore();

  // Center: Active Menu Quick-Reference Pills
  const activeMenu = orders.shift.menu.slice(0, 5);
  const activeOrderSet = new Set(orders.tickets.map((t) => t.recipeId));
  let rx = 386;
  for (const rId of activeMenu) {
    const r = RECIPES[rId];
    const wanted = activeOrderSet.has(rId);
    const cardW = 114;
    ctx.save();
    ctx.fillStyle = wanted ? 'rgba(220, 165, 68, 0.18)' : 'rgba(255, 245, 224, 0.05)';
    ctx.strokeStyle = wanted ? '#f0c451' : 'rgba(220, 165, 68, 0.22)';
    ctx.lineWidth = wanted ? 1.8 : 1;
    ctx.beginPath();
    ctx.roundRect(rx, FOOTER_Y + 12, cardW, 70, 8);
    ctx.fill();
    ctx.stroke();

    drawDishPreview(ctx, rId, rx + 26, FOOTER_Y + 40, 18, false);
    ctx.fillStyle = wanted ? '#fff6d6' : '#c9b69a';
    ctx.font = '800 10.5px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(r.shortName.split(' ')[0], rx + 49, FOOTER_Y + 34);
    ctx.fillStyle = '#e8c066';
    ctx.font = '800 10.5px "Trebuchet MS", sans-serif';
    ctx.fillText(`$${r.price}`, rx + 49, FOOTER_Y + 49);

    ctx.fillStyle = wanted ? '#92f2b5' : '#9c8a72';
    ctx.font = '700 9px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(wanted ? 'ON RAIL' : 'MENU', rx + cardW / 2, FOOTER_Y + 69);
    ctx.restore();
    rx += cardW + 8;
  }

  // Right: Keyboard + Mouse Controls Legend
  ctx.save();
  ctx.fillStyle = 'rgba(255, 245, 224, 0.07)';
  ctx.strokeStyle = 'rgba(220, 165, 68, 0.3)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.roundRect(996, FOOTER_Y + 12, 268, 70, 9);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#e8be66';
  ctx.font = '800 10.5px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('KEYBOARD & MOUSE CONTROLS', 1010, FOOTER_Y + 28);

  ctx.fillStyle = '#f5e7ce';
  ctx.font = '700 11.5px "Trebuchet MS", sans-serif';
  ctx.fillText('WASD / Arrows / Click: Move & Act', 1010, FOOTER_Y + 48);
  ctx.fillStyle = '#cbb694';
  ctx.font = '700 11px "Trebuchet MS", sans-serif';
  ctx.fillText('Space/E: Chop·Cook·Serve  |  Shift: Dash', 1010, FOOTER_Y + 67);
  ctx.restore();
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
    const bannerText = '🔥 GOLDEN HOUR RUSH — ORDERS SPEEDING UP! 🔥';
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = '900 17px Georgia, serif';
    const bw = Math.max(430, ctx.measureText(bannerText).width + 44);
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
      ? Math.min(FOOTER_Y - 14, pos.y + 52)
      : Math.max(HUD_HEIGHT + 22, pos.y - 54);
  const x = Math.max(96, Math.min(CANVAS_WIDTH - 96, pos.x));
  drawStatusPill(ctx, x, y, prompt, 'rgba(26, 15, 9, 0.94)', '#fff5d8', '#e6b44c');
}

function drawTitleOverlay(ctx, state) {
  ctx.save();
  ctx.fillStyle = 'rgba(22, 12, 7, 0.56)';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  const panelW = 810;
  const panelH = 548;
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

  // Culinary centerpiece dishes cleanly flanking the title header (zero subtitle overlap!)
  drawDishPreview(ctx, 'seared_ribeye', px + 88, py + 72, 40, true);
  drawDishPreview(ctx, 'margherita', px + panelW - 88, py + 72, 40, true);
  drawDishPreview(ctx, 'pomodoro_pasta', px + 158, py + 68, 25, false);
  drawDishPreview(ctx, 'bruschetta', px + panelW - 158, py + 68, 25, false);

  // Title typography
  ctx.fillStyle = '#ffe182';
  ctx.font = '900 46px Georgia, "Times New Roman", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('EMBER & BASIL', CANVAS_WIDTH / 2, py + 68);

  ctx.fillStyle = '#f2dec0';
  ctx.font = '700 14.5px "Trebuchet MS", sans-serif';
  ctx.fillText(
    'SUNLIT ARTISAN BISTRO · ROUTE, CHOP, SEAR & PLATE TO BEAT THE RUSH',
    CANVAS_WIDTH / 2,
    py + 128,
  );

  // Feature highlights strip
  const perks = [
    '★ Golden Sweet-Spot Searing',
    '⚡ Keyboard & Full Mouse Play',
    '🔥 7 Wood-Fired & Pasta Dishes',
  ];
  ctx.fillStyle = '#d9be94';
  ctx.font = '700 12.5px "Trebuchet MS", sans-serif';
  ctx.fillText(perks.join('    ·    '), CANVAS_WIDTH / 2, py + 158);

  // 3 Clickable Shift Cards
  state.titleButtons = [];
  const cardW = 232;
  const cardH = 198;
  const gap = 22;
  const rowX = CANVAS_WIDTH / 2 - (cardW * 3 + gap * 2) / 2;
  const rowY = py + 188;

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
    ctx.font = '900 19px Georgia, serif';
    ctx.fillText(shift.name, cx + cardW / 2, rowY + 52);

    ctx.fillStyle = '#d2bc9a';
    ctx.font = '600 11.5px "Trebuchet MS", sans-serif';
    ctx.fillText(shift.subtitle, cx + cardW / 2, rowY + 78);

    // Mini dishes on shift card
    const sampleDishes = shift.menu.slice(0, 3);
    sampleDishes.forEach((dId, dIdx) => {
      drawDishPreview(ctx, dId, cx + 52 + dIdx * 60, rowY + 124, 21, dIdx === 2);
    });

    ctx.fillStyle = '#f0c451';
    ctx.font = '800 11px "Trebuchet MS", sans-serif';
    ctx.fillText(
      `★★★ Target: $${shift.starTargets[2]}`,
      cx + cardW / 2,
      rowY + 172,
    );
  });

  // Big Start Service Button
  const btnW = 290;
  const btnH = 58;
  const bx = CANVAS_WIDTH / 2 - btnW / 2;
  const by = py + 416;
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
  ctx.fillText('OPEN THE KITCHEN', CANVAS_WIDTH / 2, by + 30);

  ctx.fillStyle = '#ccb694';
  ctx.font = '700 12px "Trebuchet MS", sans-serif';
  ctx.fillText('Press Enter / Space or Click to Start Service  ·  Press [R] anytime for Recipe Book', CANVAS_WIDTH / 2, py + 500);

  ctx.restore();
}

function drawRecipeBookOverlay(ctx, state) {
  ctx.save();
  ctx.fillStyle = 'rgba(18, 10, 6, 0.74)';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  const w = 930;
  const h = 612;
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
  ctx.font = '900 28px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('EMBER & BASIL — CHEF RECIPE BOOK', CANVAS_WIDTH / 2, y + 38);

  ctx.fillStyle = '#735036';
  ctx.font = '700 12.5px "Trebuchet MS", sans-serif';
  ctx.fillText(
    'Pull cooked items in the Golden Sweet-Spot (★) for +35% Chef Perfect Tips! Combine dough + sauce + toppings on a counter before baking.',
    CANVAS_WIDTH / 2,
    y + 66,
  );

  const list = Object.values(RECIPES);
  const colW = 424;
  const rowH = 98;
  list.forEach((r, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const rx = x + 32 + col * (colW + 18);
    const ry = y + 88 + row * (rowH + 10);

    ctx.fillStyle = '#f3e5cb';
    ctx.strokeStyle = '#d1b78e';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.roundRect(rx, ry, colW, rowH, 10);
    ctx.fill();
    ctx.stroke();

    drawDishPreview(ctx, r.id, rx + 48, ry + 49, 32, r.id === 'chefs_tasting');

    ctx.fillStyle = '#2d1a0e';
    ctx.font = '900 15.5px Georgia, serif';
    ctx.textAlign = 'left';
    ctx.fillText(r.name, rx + 94, ry + 23);

    ctx.fillStyle = '#1f7a44';
    ctx.font = '900 15.5px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`$${r.price}`, rx + colW - 14, ry + 23);

    ctx.fillStyle = '#5c402c';
    ctx.font = '700 11.5px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(r.stepsText, rx + 94, ry + 44);

    const parts = r.displaySteps ?? r.components;
    parts.forEach((pId, pi) => {
      const ix = rx + 114 + pi * 72;
      const iy = ry + 72;
      drawIngredientArt(ctx, pId, ix, iy, 13);
      ctx.fillStyle = '#4f3726';
      ctx.font = '700 9px "Trebuchet MS", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(INGREDIENTS[pId]?.short ?? pId, ix, iy + 18);
    });
  });

  // Slot 8: Bistro Kitchen Pro Tips Card (fills bottom-right cleanly!)
  const tipX = x + 32 + colW + 18;
  const tipY = y + 88 + 3 * (rowH + 10);
  ctx.fillStyle = '#e9f2e6';
  ctx.strokeStyle = '#6da879';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.roundRect(tipX, tipY, colW, rowH, 10);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#1f5e35';
  ctx.font = '900 14.5px Georgia, serif';
  ctx.textAlign = 'left';
  ctx.fillText('CHEF ROUTING PRO TIPS', tipX + 16, tipY + 23);
  ctx.fillStyle = '#2f4a37';
  ctx.font = '700 11.5px "Trebuchet MS", sans-serif';
  ctx.fillText('• Hold a Plate to scoop cooked items straight from Pots & Skillets.', tipX + 16, tipY + 46);
  ctx.fillText('• Stage finished dishes on Warm Pass or tap the Brass Bell to serve.', tipX + 16, tipY + 65);
  ctx.fillText('• Chain 3 serves for 🔥 FEVER (+25% tips & faster chef movement).', tipX + 16, tipY + 84);

  state.overlayButtons = [
    { id: 'close_overlay', x: CANVAS_WIDTH / 2 - 120, y: y + h - 56, w: 240, h: 42 },
  ];
  ctx.fillStyle = '#2c7a48';
  ctx.beginPath();
  ctx.roundRect(CANVAS_WIDTH / 2 - 120, y + h - 56, 240, 42, 10);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 15px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('BACK TO KITCHEN [R / ESC]', CANVAS_WIDTH / 2, y + h - 35);

  ctx.restore();
}

function drawPauseOverlay(ctx, state) {
  ctx.save();
  ctx.fillStyle = 'rgba(18, 10, 6, 0.72)';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  const w = 420;
  const h = 300;
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
  ctx.font = '900 32px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('SERVICE PAUSED', CANVAS_WIDTH / 2, y + 54);

  const items = [
    { id: 'resume', label: 'Resume Service [P]', color: '#2b824b' },
    { id: 'restart', label: 'Restart Shift', color: '#8f5924' },
    { id: 'title', label: 'Return to Shift Select', color: '#543422' },
  ];
  state.overlayButtons = [];
  items.forEach((item, idx) => {
    const by = y + 96 + idx * 60;
    state.overlayButtons.push({ id: item.id, x: x + 55, y: by, w: w - 110, h: 46 });
    ctx.fillStyle = item.color;
    ctx.strokeStyle = 'rgba(255, 226, 132, 0.55)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.roundRect(x + 55, by, w - 110, 46, 10);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fff9ec';
    ctx.font = '800 16px "Trebuchet MS", sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(item.label, CANVAS_WIDTH / 2, by + 23);
  });
  ctx.restore();
}

function drawSummaryOverlay(ctx, state) {
  const { orders } = state;
  const stars = computeStarRating(orders);

  ctx.save();
  ctx.fillStyle = 'rgba(18, 10, 6, 0.78)';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  const w = 560;
  const h = 440;
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

  // Big Star Rating Display
  for (let i = 0; i < 3; i++) {
    const sx = CANVAS_WIDTH / 2 + (i - 1) * 68;
    const sy = y + 132;
    if (i < stars) {
      drawPerfectStarBadge(ctx, sx, sy, 24);
    } else {
      ctx.fillStyle = 'rgba(255, 240, 200, 0.16)';
      ctx.font = '900 40px sans-serif';
      ctx.fillText('★', sx, sy + 14);
    }
  }

  // Ledger Stats
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

  // Action buttons
  state.overlayButtons = [];
  const hasNext = state.selectedShiftIndex < SHIFTS.length - 1;
  const btns = hasNext
    ? [
        { id: 'next_shift', label: 'Next Shift →', x: x + 46, w: 224, color: '#2b8a4e' },
        { id: 'restart', label: 'Replay Shift', x: x + 290, w: 224, color: '#8c5623' },
      ]
    : [
        { id: 'restart', label: 'Play Again', x: x + 46, w: 224, color: '#2b8a4e' },
        { id: 'title', label: 'Shift Select', x: x + 290, w: 224, color: '#8c5623' },
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
    ctx.font = '800 17px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(b.label, b.x + b.w / 2, y + h - 48);
  }

  ctx.restore();
}
