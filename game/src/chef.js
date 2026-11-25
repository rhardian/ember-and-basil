// Dual-Chef Brigade (Head Chef Marco & Sous-Chef Sofia): smooth movement, BFS queued routes, Tab switching, and dash.

import {
  CHEF_CONFIG,
  GRID_COLS,
  GRID_ORIGIN_X,
  GRID_ORIGIN_Y,
  GRID_ROWS,
  TILE_SIZE,
  tileCenter,
} from './config.js';
import { getWalkableNeighbors, isTileWalkable, worldToTile } from './kitchen.js';

export function createChef(profile = {}) {
  const start = tileCenter(profile.startCol ?? 5, profile.startRow ?? 3);
  return {
    id: profile.id ?? 'marco',
    name: profile.name ?? 'Chef Marco',
    role: profile.role ?? 'Head Chef',
    apronColor: profile.apronColor ?? '#346949',
    scarfColor: profile.scarfColor ?? '#d43f2c',
    hairColor: profile.hairColor ?? '#3a2417',
    skinColor: profile.skinColor ?? '#f5c79e',
    tallToque: profile.tallToque ?? true,
    routeColor: profile.routeColor ?? '#ffe270',
    x: start.x,
    y: start.y,
    vx: 0,
    vy: 0,
    facingX: 0,
    facingY: -1,
    facingAngle: -Math.PI / 2,
    walkCycle: 0,
    heldItem: null,
    dashTimer: 0,
    dashCooldown: 0,
    dashDirX: 0,
    dashDirY: 0,
    choppingAnim: 0,
    autoPath: [],
    pendingStation: null,
    autoChoppingStation: null,
  };
}

export function createBrigade() {
  return {
    chefs: [
      createChef({
        id: 'marco',
        name: 'Chef Marco',
        role: 'Hot Line & Hearth',
        startCol: 6,
        startRow: 1,
        apronColor: '#2f6646',
        scarfColor: '#d43f2c',
        hairColor: '#3a2417',
        skinColor: '#f4c59c',
        tallToque: true,
        routeColor: '#ffe066',
      }),
      createChef({
        id: 'sofia',
        name: 'Sous-Chef Sofia',
        role: 'Prep & Pass',
        startCol: 4,
        startRow: 3,
        apronColor: '#2b596e',
        scarfColor: '#e89d2c',
        hairColor: '#4c2618',
        skinColor: '#e8b389',
        tallToque: false,
        routeColor: '#78e8ff',
      }),
    ],
    activeIndex: 0,
  };
}

export function getActiveChef(brigade) {
  return brigade.chefs[brigade.activeIndex];
}

export function switchActiveChef(brigade) {
  brigade.activeIndex = (brigade.activeIndex + 1) % brigade.chefs.length;
  return brigade.chefs[brigade.activeIndex];
}

function circleIntersectsTile(cx, cy, radius, col, row) {
  const rx = GRID_ORIGIN_X + col * TILE_SIZE;
  const ry = GRID_ORIGIN_Y + row * TILE_SIZE;
  const closestX = Math.max(rx, Math.min(cx, rx + TILE_SIZE));
  const closestY = Math.max(ry, Math.min(cy, ry + TILE_SIZE));
  const dx = cx - closestX;
  const dy = cy - closestY;
  return dx * dx + dy * dy < radius * radius;
}

function canStandAt(kitchen, x, y, radius) {
  const minX = GRID_ORIGIN_X + radius + 2;
  const maxX = GRID_ORIGIN_X + GRID_COLS * TILE_SIZE - radius - 2;
  const minY = GRID_ORIGIN_Y + radius + 2;
  const maxY = GRID_ORIGIN_Y + GRID_ROWS * TILE_SIZE - radius - 2;
  if (x < minX || x > maxX || y < minY || y > maxY) return false;

  const c0 = Math.max(0, Math.floor((x - radius - GRID_ORIGIN_X) / TILE_SIZE));
  const c1 = Math.min(GRID_COLS - 1, Math.floor((x + radius - GRID_ORIGIN_X) / TILE_SIZE));
  const r0 = Math.max(0, Math.floor((y - radius - GRID_ORIGIN_Y) / TILE_SIZE));
  const r1 = Math.min(GRID_ROWS - 1, Math.floor((y + radius - GRID_ORIGIN_Y) / TILE_SIZE));

  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      if (!isTileWalkable(kitchen, c, r) && circleIntersectsTile(x, y, radius, c, r)) {
        return false;
      }
    }
  }
  return true;
}

export function triggerChefDash(chef, dirX, dirY, fx, audio, cooldownMult = 1) {
  if (chef.dashCooldown > 0 || chef.dashTimer > 0) return false;
  let dx = dirX;
  let dy = dirY;
  const len = Math.hypot(dx, dy);
  if (len > 0.01) {
    dx /= len;
    dy /= len;
  } else {
    dx = chef.facingX;
    dy = chef.facingY;
  }
  chef.dashDirX = dx;
  chef.dashDirY = dy;
  chef.dashTimer = CHEF_CONFIG.dashDuration;
  chef.dashCooldown = CHEF_CONFIG.dashCooldown * cooldownMult;
  chef.facingX = dx;
  chef.facingY = dy;
  chef.facingAngle = Math.atan2(dy, dx);
  chef.autoChoppingStation = null;
  audio?.playDash();
  fx?.spawnDashDust(chef.x, chef.y + 12, -dx, -dy);
  return true;
}

export function findShortestTilePath(kitchen, startCol, startRow, goalTiles) {
  const goalSet = new Set(goalTiles.map((g) => `${g.col},${g.row}`));
  const startKey = `${startCol},${startRow}`;
  if (goalSet.has(startKey)) return [{ col: startCol, row: startRow }];

  const queue = [{ col: startCol, row: startRow }];
  const cameFrom = new Map([[startKey, null]]);

  while (queue.length > 0) {
    const cur = queue.shift();
    const neighbors = getWalkableNeighbors(kitchen, cur.col, cur.row);
    for (const next of neighbors) {
      const key = `${next.col},${next.row}`;
      if (cameFrom.has(key)) continue;
      cameFrom.set(key, cur);
      if (goalSet.has(key)) {
        const path = [];
        let node = next;
        while (node) {
          path.push(node);
          node = cameFrom.get(`${node.col},${node.row}`);
        }
        path.reverse();
        return path;
      }
      queue.push(next);
    }
  }
  return null;
}

export function commandChefToStation(chef, kitchen, station) {
  const neighbors = getWalkableNeighbors(kitchen, station.col, station.row);
  if (neighbors.length === 0) return false;

  const curTile = worldToTile(chef.x, chef.y);
  const clampedCol = Math.max(0, Math.min(GRID_COLS - 1, curTile.col));
  const clampedRow = Math.max(0, Math.min(GRID_ROWS - 1, curTile.row));

  const tilePath = findShortestTilePath(kitchen, clampedCol, clampedRow, neighbors);
  if (!tilePath) return false;

  chef.autoPath = tilePath.slice(1).map((t) => tileCenter(t.col, t.row));
  if (chef.autoPath.length === 0) {
    chef.autoPath = [tileCenter(tilePath[0].col, tilePath[0].row)];
  }
  chef.pendingStation = station;
  chef.autoChoppingStation = null;
  return true;
}

export function commandChefToPoint(chef, kitchen, wx, wy) {
  const target = worldToTile(wx, wy);
  if (!isTileWalkable(kitchen, target.col, target.row)) return false;
  const curTile = worldToTile(chef.x, chef.y);
  const tilePath = findShortestTilePath(
    kitchen,
    Math.max(0, Math.min(GRID_COLS - 1, curTile.col)),
    Math.max(0, Math.min(GRID_ROWS - 1, curTile.row)),
    [target],
  );
  if (!tilePath) return false;
  chef.autoPath = tilePath.slice(1).map((t) => tileCenter(t.col, t.row));
  chef.autoPath.push({ x: wx, y: wy });
  chef.pendingStation = null;
  chef.autoChoppingStation = null;
  return true;
}

export function selectTargetStation(chef, kitchen, hoveredStation = null) {
  if (hoveredStation) {
    const hc = tileCenter(hoveredStation.col, hoveredStation.row);
    if (Math.hypot(hc.x - chef.x, hc.y - chef.y) <= CHEF_CONFIG.interactRange + 26) {
      return hoveredStation;
    }
  }

  let best = null;
  let bestScore = -Infinity;
  for (const st of kitchen.stations) {
    const sc = tileCenter(st.col, st.row);
    const dx = sc.x - chef.x;
    const dy = sc.y - chef.y;
    const dist = Math.hypot(dx, dy);
    if (dist > CHEF_CONFIG.interactRange) continue;

    const dot = dist > 0.01 ? (dx * chef.facingX + dy * chef.facingY) / dist : 1;
    if (dot < -0.18 && dist > 62) continue;

    const score = dot * 72 - dist * 0.9;
    if (score > bestScore) {
      bestScore = score;
      best = st;
    }
  }
  return best;
}

export function updateChefMovement(chef, kitchen, inputVec, dt, feverActive, speedMult = 1) {
  if (chef.dashCooldown > 0) chef.dashCooldown = Math.max(0, chef.dashCooldown - dt);
  if (chef.choppingAnim > 0) chef.choppingAnim = Math.max(0, chef.choppingAnim - dt);

  let moveX = inputVec.x;
  let moveY = inputVec.y;
  const manualMove = Math.hypot(moveX, moveY) > 0.01;

  if (manualMove) {
    chef.autoPath = [];
    chef.pendingStation = null;
    chef.autoChoppingStation = null;
  } else if (chef.autoPath.length > 0) {
    const wp = chef.autoPath[0];
    const dx = wp.x - chef.x;
    const dy = wp.y - chef.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 14) {
      chef.autoPath.shift();
      if (chef.autoPath.length === 0 && chef.pendingStation) {
        const sc = tileCenter(chef.pendingStation.col, chef.pendingStation.row);
        const fdx = sc.x - chef.x;
        const fdy = sc.y - chef.y;
        const flen = Math.hypot(fdx, fdy);
        if (flen > 0.01) {
          chef.facingX = fdx / flen;
          chef.facingY = fdy / flen;
          chef.facingAngle = Math.atan2(chef.facingY, chef.facingX);
        }
      }
    } else {
      moveX = dx / dist;
      moveY = dy / dist;
    }
  }

  let speed = CHEF_CONFIG.speed * speedMult * (feverActive ? CHEF_CONFIG.feverSpeedMultiplier : 1);
  if (chef.dashTimer > 0) {
    chef.dashTimer = Math.max(0, chef.dashTimer - dt);
    moveX = chef.dashDirX;
    moveY = chef.dashDirY;
    speed = CHEF_CONFIG.dashSpeed;
  }

  const mlen = Math.hypot(moveX, moveY);
  if (mlen > 0.01) {
    const nx = moveX / mlen;
    const ny = moveY / mlen;
    chef.facingX = nx;
    chef.facingY = ny;
    chef.facingAngle = Math.atan2(ny, nx);

    const stepX = nx * speed * dt;
    const stepY = ny * speed * dt;
    const prevX = chef.x;
    const prevY = chef.y;

    if (canStandAt(kitchen, chef.x + stepX, chef.y, CHEF_CONFIG.radius)) {
      chef.x += stepX;
    }
    if (canStandAt(kitchen, chef.x, chef.y + stepY, CHEF_CONFIG.radius)) {
      chef.y += stepY;
    }

    chef.vx = (chef.x - prevX) / Math.max(dt, 1e-4);
    chef.vy = (chef.y - prevY) / Math.max(dt, 1e-4);
    chef.walkCycle += dt * (chef.dashTimer > 0 ? 22 : 12.5);
  } else {
    chef.vx = 0;
    chef.vy = 0;
  }

  let arrivedStation = null;
  if (chef.pendingStation && chef.autoPath.length === 0) {
    const sc = tileCenter(chef.pendingStation.col, chef.pendingStation.row);
    if (Math.hypot(sc.x - chef.x, sc.y - chef.y) <= CHEF_CONFIG.interactRange + 20) {
      arrivedStation = chef.pendingStation;
      chef.pendingStation = null;
    }
  }

  return arrivedStation;
}
