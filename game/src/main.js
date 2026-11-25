// Ember & Basil main game bootstrap, fixed-timestep loop, keyboard & mouse input routing, and shot mode hook.

import { createAudioEngine } from './audio.js';
import {
  commandChefToPoint,
  commandChefToStation,
  createChef,
  selectTargetStation,
  triggerChefDash,
  updateChefMovement,
} from './chef.js';
import { CANVAS_HEIGHT, CANVAS_WIDTH, FIXED_STEP, SHIFTS } from './config.js';
import { advanceChopping, interactWithStation, updateKitchenStations } from './cooking.js';
import { createKitchen, getStationAt, STATION_TYPES, tileFromPointer } from './kitchen.js';
import { createOrderSystem, isFeverActive, spawnOrderTicket, updateOrders } from './orders.js';
import { bindParticleHelpers, createParticleSystem, updateParticles } from './particles.js';
import { createRng } from './random.js';
import { renderGame, SCREEN_MODES } from './renderer.js';
import { INGREDIENTS } from './recipes.js';
import { stageDeterministicShot } from './shots.js';

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

const audio = createAudioEngine();

const keysDown = new Set();
let pointerX = -1;
let pointerY = -1;
let lastUrgentSecond = -1;

let state = null;

function createLiveState(shiftIndex = 0, screen = SCREEN_MODES.TITLE) {
  const shift = SHIFTS[shiftIndex];
  const rng = createRng(Date.now() % 100000);
  const kitchen = createKitchen();
  const chef = createChef();
  const orders = createOrderSystem(shift, rng);
  const fx = createParticleSystem();
  const fxHelpers = bindParticleHelpers(fx);

  // Open the ticket rail with two immediate orders so the kitchen starts bustling on frame 1
  spawnOrderTicket(orders, shift.menu[0], false);
  spawnOrderTicket(orders, shift.menu[1], false);

  return {
    screen,
    selectedShiftIndex: shiftIndex,
    time: 0,
    shiftElapsed: 0,
    shiftDuration: shift.durationSec,
    kitchen,
    chef,
    orders,
    fx,
    fxHelpers,
    audio,
    hoveredStation: null,
    targetStation: null,
    ticketBounds: [],
    hudButtons: [],
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
  const target = selectTargetStation(state.chef, state.kitchen, state.hoveredStation);
  if (!target) return;
  const acted = interactWithStation(
    target,
    state.chef,
    state.kitchen,
    state.orders,
    state.fxHelpers,
    audio,
  );
  if (
    acted &&
    target.type === STATION_TYPES.CHOP &&
    target.item?.kind === 'ingredient' &&
    INGREDIENTS[target.item.id]?.choppable
  ) {
    state.chef.autoChoppingStation = target;
  }
}

function handleQuickDropOrToss() {
  if (state.screen !== SCREEN_MODES.PLAYING || !state.chef.heldItem) return;
  const target = selectTargetStation(state.chef, state.kitchen, state.hoveredStation);
  if (target && target.type === STATION_TYPES.COMPOST) {
    interactWithStation(target, state.chef, state.kitchen, state.orders, state.fxHelpers, audio);
    return;
  }
  // Quick-clear burnt items anywhere so mistakes never slow the rush
  if (state.chef.heldItem.kind === 'ingredient' && state.chef.heldItem.id === 'burnt') {
    state.chef.heldItem = null;
    audio.playTrash();
    state.fxHelpers.spawnPopup(state.chef.x, state.chef.y - 34, 'Tossed Burnt Item', '#d9cbb3', 13);
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
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(code)) {
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

  if (code === 'KeyP' || code === 'Escape') {
    if (state.screen === SCREEN_MODES.PLAYING) state.screen = SCREEN_MODES.PAUSED;
    else if (state.screen === SCREEN_MODES.PAUSED || state.screen === SCREEN_MODES.RECIPES) {
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
    if (code === 'Space' || code === 'KeyE') {
      handleInteractAction();
    } else if (code === 'ShiftLeft' || code === 'ShiftRight') {
      const vec = readMovementInput();
      triggerChefDash(state.chef, vec.x, vec.y, state.fxHelpers, audio);
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
  pointerX = pt.x;
  pointerY = pt.y;
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

  if (state.screen === SCREEN_MODES.RECIPES || state.screen === SCREEN_MODES.PAUSED || state.screen === SCREEN_MODES.SUMMARY) {
    const hit = hitTestButtons(state.overlayButtons, pt.x, pt.y);
    if (hit) {
      if (hit.id === 'close_overlay' || hit.id === 'resume') state.screen = SCREEN_MODES.PLAYING;
      else if (hit.id === 'restart') startShift(state.selectedShiftIndex);
      else if (hit.id === 'next_shift') startShift(Math.min(SHIFTS.length - 1, state.selectedShiftIndex + 1));
      else if (hit.id === 'title') state = createLiveState(state.selectedShiftIndex, SCREEN_MODES.TITLE);
    }
    return;
  }

  // Playing mode: check HUD buttons first
  const hudHit = hitTestButtons(state.hudButtons, pt.x, pt.y);
  if (hudHit) {
    if (hudHit.id === 'recipes') state.screen = SCREEN_MODES.RECIPES;
    else if (hudHit.id === 'mute') audio.toggleMute();
    else if (hudHit.id === 'pause') state.screen = SCREEN_MODES.PAUSED;
    return;
  }

  // Check Order Ticket click (focuses ticket & pulses matching stations)
  const ticketHit = hitTestButtons(state.ticketBounds, pt.x, pt.y);
  if (ticketHit) {
    state.orders.focusedTicketId = ticketHit.id;
    state.orders.focusTimer = 3.0;
    audio.playPickup();
    return;
  }

  // Right-click = Quick Dash toward cursor!
  if (evt.button === 2) {
    triggerChefDash(
      state.chef,
      pt.x - state.chef.x,
      pt.y - state.chef.y,
      state.fxHelpers,
      audio,
    );
    return;
  }

  // Left-click kitchen station -> smart pathfind & interact (or walk to floor tile!)
  const tile = tileFromPointer(pt.x, pt.y);
  if (!tile) return;
  const st = getStationAt(state.kitchen, tile.col, tile.row);
  if (st) {
    commandChefToStation(state.chef, state.kitchen, st);
  } else {
    commandChefToPoint(state.chef, state.kitchen, pt.x, pt.y);
  }
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
    state.screen = SCREEN_MODES.SUMMARY;
    audio.playFeverFanfare();
    return;
  }

  const inputVec = readMovementInput();
  const arrivedStation = updateChefMovement(
    state.chef,
    state.kitchen,
    inputVec,
    dt,
    isFeverActive(state.orders),
  );

  if (arrivedStation) {
    const acted = interactWithStation(
      arrivedStation,
      state.chef,
      state.kitchen,
      state.orders,
      state.fxHelpers,
      audio,
    );
    if (
      acted &&
      arrivedStation.type === STATION_TYPES.CHOP &&
      arrivedStation.item?.kind === 'ingredient' &&
      INGREDIENTS[arrivedStation.item.id]?.choppable
    ) {
      state.chef.autoChoppingStation = arrivedStation;
    }
  }

  // Continuous smooth chopping while holding Space/E OR after mouse-clicking a chop board
  state.targetStation = selectTargetStation(state.chef, state.kitchen, state.hoveredStation);
  const holdingChopKey = keysDown.has('Space') || keysDown.has('KeyE');
  const chopCandidate = holdingChopKey
    ? state.targetStation
    : state.chef.autoChoppingStation;

  if (
    chopCandidate &&
    chopCandidate.type === STATION_TYPES.CHOP &&
    chopCandidate.item?.kind === 'ingredient' &&
    INGREDIENTS[chopCandidate.item.id]?.choppable &&
    !state.chef.heldItem
  ) {
    const kept = advanceChopping(chopCandidate, state.chef, dt, state.fxHelpers, audio, 0);
    if (!kept || chopCandidate.chopProgress === 0) {
      state.chef.autoChoppingStation = null;
    }
  } else {
    state.chef.autoChoppingStation = null;
  }

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
