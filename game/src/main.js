// Ember & Basil main game loop: dual-chef brigade (Tab), 3 biomes, kitchen upgrades, keyboard + mouse input, and shot hook.

import { createAudioEngine } from './audio.js';
import {
  commandChefToPoint,
  commandChefToStation,
  createBrigade,
  getActiveChef,
  selectTargetStation,
  switchActiveChef,
  triggerChefDash,
  updateChefMovement,
} from './chef.js';
import { CANVAS_HEIGHT, CANVAS_WIDTH, FIXED_STEP, SHIFTS, TILE_SIZE } from './config.js';
import { advanceChopping, interactWithStation, updateKitchenStations } from './cooking.js';
import { createDiningRoom, updateDiningGuests } from './diners.js';
import { createKitchen, getStationAt, STATION_TYPES, tileFromPointer } from './kitchen.js';
import { createOrderSystem, isFeverActive, spawnOrderTicket, updateOrders } from './orders.js';
import { bindParticleHelpers, createParticleSystem, updateParticles } from './particles.js';
import { createRng } from './random.js';
import { renderGame, SCREEN_MODES } from './renderer.js';
import { INGREDIENTS } from './recipes.js';
import { stageDeterministicShot } from './shots.js';
import { createProceduralTextures } from './textures.js';
import { createUpgradeState, getUpgradeModifiers, purchaseKitchenUpgrade } from './upgrades.js';

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

const audio = createAudioEngine();
const persistentUpgrades = createUpgradeState();
const sharedTextures = createProceduralTextures(TILE_SIZE);

const keysDown = new Set();
let lastUrgentSecond = -1;
let state = null;

function createLiveState(shiftIndex = 0, screen = SCREEN_MODES.TITLE) {
  const shift = SHIFTS[shiftIndex];
  const rng = createRng(Date.now() % 100000);
  const kitchen = createKitchen();
  const brigade = createBrigade();
  const mods = getUpgradeModifiers(persistentUpgrades);
  const orders = createOrderSystem(shift, rng, mods);
  const diningRoom = createDiningRoom();
  const fx = createParticleSystem();
  const fxHelpers = bindParticleHelpers(fx);

  spawnOrderTicket(orders, shift.menu[0], false);
  spawnOrderTicket(orders, shift.menu[1], false);

  return {
    screen,
    selectedShiftIndex: shiftIndex,
    time: 0,
    shiftElapsed: 0,
    shiftDuration: shift.durationSec,
    kitchen,
    brigade,
    upgrades: persistentUpgrades,
    mods,
    orders,
    diningRoom,
    textures: sharedTextures,
    fx,
    fxHelpers,
    audio,
    hoveredStation: null,
    targetStation: null,
    ticketBounds: [],
    hudButtons: [],
    brigadeButtons: [],
    titleButtons: [],
    overlayButtons: [],
  };
}

function startShift(shiftIndex) {
  lastUrgentSecond = -1;
  state = createLiveState(shiftIndex, SCREEN_MODES.PLAYING);
  audio.unlock();
  audio.playServeBell(false);
}

function setupHiDpiCanvas() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(CANVAS_WIDTH * dpr);
  canvas.height = Math.round(CANVAS_HEIGHT * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function getCanvasPoint(evt) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((evt.clientX - rect.left) / rect.width) * CANVAS_WIDTH,
    y: ((evt.clientY - rect.top) / rect.height) * CANVAS_HEIGHT,
  };
}

function hitTestButtons(list, x, y) {
  if (!list) return null;
  for (const b of list) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
  }
  return null;
}

function handleInteractAction() {
  if (state.screen !== SCREEN_MODES.PLAYING) return;
  const activeChef = getActiveChef(state.brigade);
  const target = selectTargetStation(activeChef, state.kitchen, state.hoveredStation);
  if (!target) return;
  const acted = interactWithStation(
    target,
    activeChef,
    state.kitchen,
    state.orders,
    state.fxHelpers,
    audio,
    { mods: state.mods, diningRoom: state.diningRoom },
  );
  if (
    acted &&
    target.type === STATION_TYPES.CHOP &&
    target.item?.kind === 'ingredient' &&
    INGREDIENTS[target.item.id]?.choppable
  ) {
    activeChef.autoChoppingStation = target;
  }
}

function handleQuickDropOrToss() {
  const activeChef = getActiveChef(state.brigade);
  if (state.screen !== SCREEN_MODES.PLAYING || !activeChef.heldItem) return;
  const target = selectTargetStation(activeChef, state.kitchen, state.hoveredStation);
  if (target && target.type === STATION_TYPES.COMPOST) {
    interactWithStation(target, activeChef, state.kitchen, state.orders, state.fxHelpers, audio, {
      mods: state.mods,
      diningRoom: state.diningRoom,
    });
    return;
  }
  if (activeChef.heldItem.kind === 'ingredient' && activeChef.heldItem.id === 'burnt') {
    activeChef.heldItem = null;
    audio.playTrash();
    state.fxHelpers.spawnPopup(activeChef.x, activeChef.y - 34, 'Tossed Burnt Item', '#d9cbb3', 13);
  }
}

function readMovementInput() {
  let x = 0;
  let y = 0;
  if (keysDown.has('KeyA') || keysDown.has('ArrowLeft')) x -= 1;
  if (keysDown.has('KeyD') || keysDown.has('ArrowRight')) x += 1;
  if (keysDown.has('KeyW') || keysDown.has('ArrowUp')) y -= 1;
  if (keysDown.has('KeyS') || keysDown.has('ArrowDown')) y += 1;
  return { x, y };
}

function handleKeyDown(evt) {
  audio.unlock();
  const code = evt.code;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(code)) {
    evt.preventDefault();
  }

  if (state.screen === SCREEN_MODES.TITLE) {
    if (code === 'ArrowLeft' || code === 'KeyA') {
      state.selectedShiftIndex = (state.selectedShiftIndex + SHIFTS.length - 1) % SHIFTS.length;
    } else if (code === 'ArrowRight' || code === 'KeyD') {
      state.selectedShiftIndex = (state.selectedShiftIndex + 1) % SHIFTS.length;
    } else if (code === 'Enter' || code === 'Space') {
      startShift(state.selectedShiftIndex);
    }
    return;
  }

  if (code === 'KeyM') {
    audio.toggleMute();
    return;
  }

  if (code === 'KeyR') {
    if (state.screen === SCREEN_MODES.PLAYING) state.screen = SCREEN_MODES.RECIPES;
    else if (state.screen === SCREEN_MODES.RECIPES) state.screen = SCREEN_MODES.PLAYING;
    return;
  }

  if (code === 'KeyU') {
    if (state.screen === SCREEN_MODES.PLAYING) state.screen = SCREEN_MODES.UPGRADES;
    else if (state.screen === SCREEN_MODES.UPGRADES) state.screen = SCREEN_MODES.PLAYING;
    return;
  }

  if (code === 'KeyP' || code === 'Escape') {
    if (state.screen === SCREEN_MODES.PLAYING) state.screen = SCREEN_MODES.PAUSED;
    else if (
      state.screen === SCREEN_MODES.PAUSED ||
      state.screen === SCREEN_MODES.RECIPES ||
      state.screen === SCREEN_MODES.UPGRADES
    ) {
      state.screen = SCREEN_MODES.PLAYING;
    }
    return;
  }

  if (state.screen === SCREEN_MODES.SUMMARY && (code === 'Enter' || code === 'Space')) {
    const nextIdx = Math.min(SHIFTS.length - 1, state.selectedShiftIndex + 1);
    startShift(nextIdx);
    return;
  }

  if (state.screen !== SCREEN_MODES.PLAYING) return;

  const isRepeat = keysDown.has(code);
  keysDown.add(code);

  if (!isRepeat) {
    if (code === 'Tab') {
      const next = switchActiveChef(state.brigade);
      audio.playPickup();
      state.fxHelpers.spawnPopup(next.x, next.y - 36, next.name, next.routeColor, 13);
    } else if (code === 'Space' || code === 'KeyE') {
      handleInteractAction();
    } else if (code === 'ShiftLeft' || code === 'ShiftRight') {
      const activeChef = getActiveChef(state.brigade);
      const vec = readMovementInput();
      triggerChefDash(
        activeChef,
        vec.x,
        vec.y,
        state.fxHelpers,
        audio,
        state.mods.dashCooldownMult,
      );
    } else if (code === 'KeyQ' || code === 'Backspace') {
      handleQuickDropOrToss();
    }
  }
}

function handleKeyUp(evt) {
  keysDown.delete(evt.code);
}

function handlePointerMove(evt) {
  const pt = getCanvasPoint(evt);
  if (state.screen === SCREEN_MODES.PLAYING) {
    const tile = tileFromPointer(pt.x, pt.y);
    state.hoveredStation = tile ? getStationAt(state.kitchen, tile.col, tile.row) : null;
  } else {
    state.hoveredStation = null;
  }
}

function handlePointerDown(evt) {
  audio.unlock();
  canvas.focus();
  const pt = getCanvasPoint(evt);

  if (state.screen === SCREEN_MODES.TITLE) {
    const hit = hitTestButtons(state.titleButtons, pt.x, pt.y);
    if (hit) {
      if (hit.id === 'start_shift') startShift(state.selectedShiftIndex);
      else if (hit.shiftIndex !== undefined) state.selectedShiftIndex = hit.shiftIndex;
    }
    return;
  }

  if (
    state.screen === SCREEN_MODES.RECIPES ||
    state.screen === SCREEN_MODES.UPGRADES ||
    state.screen === SCREEN_MODES.PAUSED ||
    state.screen === SCREEN_MODES.SUMMARY
  ) {
    const hit = hitTestButtons(state.overlayButtons, pt.x, pt.y);
    if (hit) {
      if (hit.upgradeId) {
        // Combine live score into bank if needed when upgrading mid-session
        const total = state.upgrades.bank + state.orders.score;
        const prevBank = state.upgrades.bank;
        state.upgrades.bank = total;
        if (purchaseKitchenUpgrade(state.upgrades, hit.upgradeId)) {
          const spent = total - state.upgrades.bank;
          if (spent <= prevBank) {
            state.upgrades.bank = prevBank - spent;
          } else {
            state.orders.score = Math.max(0, state.orders.score - (spent - prevBank));
            state.upgrades.bank = 0;
          }
          state.mods = getUpgradeModifiers(state.upgrades);
          state.orders.upgradeMods = state.mods;
          audio.playServeBell(true);
        } else {
          state.upgrades.bank = prevBank;
          audio.playErrorBuzz();
        }
      } else if (hit.id === 'close_overlay' || hit.id === 'resume') {
        state.screen = SCREEN_MODES.PLAYING;
      } else if (hit.id === 'upgrades') {
        state.screen = SCREEN_MODES.UPGRADES;
      } else if (hit.id === 'restart') {
        startShift(state.selectedShiftIndex);
      } else if (hit.id === 'next_shift') {
        startShift(Math.min(SHIFTS.length - 1, state.selectedShiftIndex + 1));
      } else if (hit.id === 'title') {
        state = createLiveState(state.selectedShiftIndex, SCREEN_MODES.TITLE);
      }
    }
    return;
  }

  // Playing mode: check HUD utility buttons
  const hudHit = hitTestButtons(state.hudButtons, pt.x, pt.y);
  if (hudHit) {
    if (hudHit.id === 'recipes') state.screen = SCREEN_MODES.RECIPES;
    else if (hudHit.id === 'upgrades') state.screen = SCREEN_MODES.UPGRADES;
    else if (hudHit.id === 'mute') audio.toggleMute();
    return;
  }

  // Click either Brigade Chef card in footer to swap instantly
  const brigadeHit = hitTestButtons(state.brigadeButtons, pt.x, pt.y);
  if (brigadeHit) {
    state.brigade.activeIndex = brigadeHit.index;
    audio.playPickup();
    return;
  }

  // Click an Order Ticket to highlight it
  const ticketHit = hitTestButtons(state.ticketBounds, pt.x, pt.y);
  if (ticketHit) {
    state.orders.focusedTicketId = ticketHit.id;
    state.orders.focusTimer = 3.0;
    audio.playPickup();
    return;
  }

  const activeChef = getActiveChef(state.brigade);

  // Clicking directly on the inactive chef swaps control to them!
  for (let i = 0; i < state.brigade.chefs.length; i++) {
    const c = state.brigade.chefs[i];
    if (i !== state.brigade.activeIndex && Math.hypot(pt.x - c.x, pt.y - c.y) <= 30) {
      state.brigade.activeIndex = i;
      audio.playPickup();
      return;
    }
  }

  // Right-click = Quick Dash toward cursor
  if (evt.button === 2) {
    triggerChefDash(
      activeChef,
      pt.x - activeChef.x,
      pt.y - activeChef.y,
      state.fxHelpers,
      audio,
      state.mods.dashCooldownMult,
    );
    return;
  }

  // Left-click station -> smart route & interact (other chef keeps executing their queued route!)
  const tile = tileFromPointer(pt.x, pt.y);
  if (!tile) return;
  const st = getStationAt(state.kitchen, tile.col, tile.row);
  if (st) commandChefToStation(activeChef, state.kitchen, st);
  else commandChefToPoint(activeChef, state.kitchen, pt.x, pt.y);
}

function stepLiveSimulation(dt) {
  state.time += dt;
  if (state.screen !== SCREEN_MODES.PLAYING) {
    updateParticles(state.fx, dt);
    return;
  }

  state.shiftElapsed += dt;
  const remaining = Math.max(0, state.shiftDuration - state.shiftElapsed);
  if (remaining <= 10 && remaining > 0) {
    const whole = Math.ceil(remaining);
    if (whole !== lastUrgentSecond) {
      lastUrgentSecond = whole;
      audio.playTickUrgent();
    }
  }
  if (remaining <= 0) {
    state.upgrades.bank += state.orders.score;
    state.screen = SCREEN_MODES.SUMMARY;
    audio.playFeverFanfare();
    return;
  }

  const inputVec = readMovementInput();
  const feverOn = isFeverActive(state.orders);
  const activeChef = getActiveChef(state.brigade);

  // Update BOTH chefs simultaneously (active chef takes keyboard/mouse, partner finishes queued routes & chopping!)
  for (const chef of state.brigade.chefs) {
    const vec = chef === activeChef ? inputVec : { x: 0, y: 0 };
    const arrivedStation = updateChefMovement(
      chef,
      state.kitchen,
      vec,
      dt,
      feverOn,
      state.mods.moveSpeedMult,
    );

    if (arrivedStation) {
      const acted = interactWithStation(
        arrivedStation,
        chef,
        state.kitchen,
        state.orders,
        state.fxHelpers,
        audio,
        { mods: state.mods, diningRoom: state.diningRoom },
      );
      if (
        acted &&
        arrivedStation.type === STATION_TYPES.CHOP &&
        arrivedStation.item?.kind === 'ingredient' &&
        INGREDIENTS[arrivedStation.item.id]?.choppable
      ) {
        chef.autoChoppingStation = arrivedStation;
      }
    }

    const holdingKey = chef === activeChef && (keysDown.has('Space') || keysDown.has('KeyE'));
    const chopCandidate = holdingKey
      ? selectTargetStation(chef, state.kitchen, state.hoveredStation)
      : chef.autoChoppingStation;

    if (
      chopCandidate &&
      chopCandidate.type === STATION_TYPES.CHOP &&
      chopCandidate.item?.kind === 'ingredient' &&
      INGREDIENTS[chopCandidate.item.id]?.choppable &&
      !chef.heldItem
    ) {
      const kept = advanceChopping(
        chopCandidate,
        chef,
        dt,
        state.fxHelpers,
        audio,
        0,
        state.mods.chopSpeedMult,
      );
      if (!kept || chopCandidate.chopProgress === 0) chef.autoChoppingStation = null;
    } else {
      chef.autoChoppingStation = null;
    }
  }

  state.targetStation = selectTargetStation(activeChef, state.kitchen, state.hoveredStation);
  updateKitchenStations(state.kitchen, dt, state.fxHelpers, audio);
  updateOrders(state.orders, dt, state.shiftElapsed, state.shiftDuration, {
    onTicketSpawned(ticket) {
      audio.playTicketChime(ticket.isVip);
    },
    onTicketExpired() {
      audio.playErrorBuzz();
      state.fxHelpers.addShake(4, 0.25);
    },
    onRushStart() {
      audio.playFeverFanfare();
    },
  });
  updateDiningGuests(state.diningRoom, dt);
  updateParticles(state.fx, dt);
}

function boot() {
  setupHiDpiCanvas();
  window.addEventListener('resize', setupHiDpiCanvas);

  const params = new URLSearchParams(window.location.search);
  const shotName = params.get('shot');
  const seed = Number(params.get('seed') ?? 7) || 7;

  if (shotName) {
    state = stageDeterministicShot(shotName, seed);
    renderGame(ctx, state);
    document.documentElement.dataset.shotReady = shotName;
    return;
  }

  state = createLiveState(0, SCREEN_MODES.TITLE);

  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
  canvas.addEventListener('pointermove', handlePointerMove);
  canvas.addEventListener('pointerdown', handlePointerDown);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  let lastTime = performance.now();
  let accumulator = 0;

  function frame(now) {
    const delta = Math.min(0.08, Math.max(0, (now - lastTime) / 1000));
    lastTime = now;
    accumulator += delta;
    while (accumulator >= FIXED_STEP) {
      stepLiveSimulation(FIXED_STEP);
      accumulator -= FIXED_STEP;
    }
    renderGame(ctx, state);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

boot();
