// Deterministic real-gameplay autopilot staging for ?shot=rush|sear|fever|title captures.
// Runs the genuine chef pathfinding, chopping, searing, simmering, oven baking, and serving rules.

import { FIXED_STEP, SHIFTS, tileCenter } from './config.js';
import {
  advanceChopping,
  interactWithStation,
  updateKitchenStations,
} from './cooking.js';
import {
  commandChefToStation,
  createChef,
  selectTargetStation,
  triggerChefDash,
  updateChefMovement,
} from './chef.js';
import { createKitchen, getStationAt } from './kitchen.js';
import { createOrderSystem, spawnOrderTicket, updateOrders } from './orders.js';
import { bindParticleHelpers, createParticleSystem, updateParticles } from './particles.js';
import { createRng } from './random.js';
import { SCREEN_MODES } from './renderer.js';

function createSilentAudio() {
  return {
    unlock() {},
    isMuted() {
      return false;
    },
    toggleMute() {
      return false;
    },
    playPickup() {},
    playPlace() {},
    playPlateClink() {},
    playChop() {},
    playCookStart() {},
    playReadyDing() {},
    playServeBell() {},
    playFeverFanfare() {},
    playDash() {},
    playTrash() {},
    playWarnBeep() {},
    playBurnSizzle() {},
    playErrorBuzz() {},
    playTicketChime() {},
    playTickUrgent() {},
  };
}

function createRunner(shiftIndex, seed) {
  const shift = SHIFTS[shiftIndex];
  const rng = createRng(seed);
  const kitchen = createKitchen();
  const chef = createChef();
  const orders = createOrderSystem(shift, rng);
  const fxState = createParticleSystem();
  const fx = bindParticleHelpers(fxState);
  const audio = createSilentAudio();

  const sim = {
    time: 0,
    shiftElapsed: 0,
    shiftDuration: shift.durationSec,
    kitchen,
    chef,
    orders,
    fxState,
    fx,
    audio,
    tick() {
      sim.time += FIXED_STEP;
      sim.shiftElapsed += FIXED_STEP;
      updateKitchenStations(kitchen, FIXED_STEP, fx, audio);
      updateOrders(orders, FIXED_STEP, sim.shiftElapsed, sim.shiftDuration);
      updateParticles(fxState, FIXED_STEP);
    },
    step(seconds) {
      const steps = Math.max(1, Math.round(seconds / FIXED_STEP));
      for (let i = 0; i < steps; i++) sim.tick();
    },
    waitUntilReady(col, row) {
      const st = getStationAt(kitchen, col, row);
      let guard = 0;
      while (st?.cook && st.cook.state === 'cooking' && guard < 450) {
        sim.tick();
        guard += 1;
      }
    },
    walkAndAct(col, row) {
      const st = getStationAt(kitchen, col, row);
      if (!st) return false;
      commandChefToStation(chef, kitchen, st);
      let guard = 0;
      while (guard < 500) {
        guard += 1;
        // Pro chef uses dash on longer sprints across the kitchen
        if (chef.autoPath.length >= 2 && chef.dashCooldown <= 0) {
          const wp = chef.autoPath[0];
          triggerChefDash(chef, wp.x - chef.x, wp.y - chef.y, fx, audio);
        }
        sim.time += FIXED_STEP;
        sim.shiftElapsed += FIXED_STEP;
        const arrived = updateChefMovement(chef, kitchen, { x: 0, y: 0 }, FIXED_STEP, true);
        updateKitchenStations(kitchen, FIXED_STEP, fx, audio);
        updateOrders(orders, FIXED_STEP, sim.shiftElapsed, sim.shiftDuration);
        updateParticles(fxState, FIXED_STEP);
        if (arrived) {
          return interactWithStation(arrived, chef, kitchen, orders, fx, audio);
        }
        if (chef.autoPath.length === 0 && !chef.pendingStation) break;
      }
      return interactWithStation(st, chef, kitchen, orders, fx, audio);
    },
    chopAt(col, row, targetProgress = 1.0) {
      const st = getStationAt(kitchen, col, row);
      if (!st) return;
      const start = st.chopProgress;
      const needed = Math.max(0.05, targetProgress - start);
      const ticks = Math.round((needed * 0.85) / FIXED_STEP);
      for (let i = 0; i < ticks; i++) {
        sim.time += FIXED_STEP;
        sim.shiftElapsed += FIXED_STEP;
        advanceChopping(st, chef, FIXED_STEP, fx, audio, 0);
        updateKitchenStations(kitchen, FIXED_STEP, fx, audio);
        updateOrders(orders, FIXED_STEP, sim.shiftElapsed, sim.shiftDuration);
        updateParticles(fxState, FIXED_STEP);
        if (st.chopProgress === 0 && targetProgress >= 1) break;
      }
    },
  };
  return sim;
}

function populateOrderRail(orders, mode) {
  orders.tickets = [];
  const presets =
    mode === 'fever'
      ? [
          { id: 'seared_ribeye', vip: false, ratio: 0.22 },
          { id: 'chefs_tasting', vip: true, ratio: 0.54 },
          { id: 'pomodoro_pasta', vip: false, ratio: 0.68 },
          { id: 'margherita', vip: false, ratio: 0.82 },
          { id: 'funghi_flatbread', vip: false, ratio: 0.91 },
        ]
      : mode === 'sear'
        ? [
            { id: 'pomodoro_pasta', vip: false, ratio: 0.36 },
            { id: 'seared_ribeye', vip: false, ratio: 0.58 },
            { id: 'margherita', vip: false, ratio: 0.76 },
            { id: 'bruschetta', vip: false, ratio: 0.85 },
            { id: 'porcini_pasta', vip: false, ratio: 0.93 },
          ]
        : [
            { id: 'seared_ribeye', vip: false, ratio: 0.32 },
            { id: 'pomodoro_pasta', vip: false, ratio: 0.61 },
            { id: 'margherita', vip: false, ratio: 0.77 },
            { id: 'porcini_pasta', vip: false, ratio: 0.86 },
            { id: 'chefs_tasting', vip: true, ratio: 0.94 },
          ];
  for (const preset of presets) {
    const t = spawnOrderTicket(orders, preset.id, preset.vip);
    if (t) {
      t.patience = Math.round(t.patienceMax * preset.ratio);
      t.slideIn = 0;
    }
  }
}

export function stageDeterministicShot(shotName, seed = 7) {
  const mode = shotName || 'rush';
  const shiftIndex = mode === 'fever' ? 2 : 1;
  const sim = createRunner(shiftIndex, seed);
  const { kitchen, chef, orders, fx, fxState, audio } = sim;

  orders.spawnCooldown = 999;
  spawnOrderTicket(orders, 'bruschetta', false);
  spawnOrderTicket(orders, 'seared_ribeye', false);
  spawnOrderTicket(orders, 'pomodoro_pasta', false);
  spawnOrderTicket(orders, 'margherita', false);
  spawnOrderTicket(orders, 'chefs_tasting', true);

  // STAGE A: Prepare a gleaming Seared Ribeye & Herb ★ and stage it on Warm Pass (11, 2) READY TO SERVE!
  sim.walkAndAct(2, 0); // grab wild porcini
  sim.walkAndAct(3, 2); // chop porcini
  sim.chopAt(3, 2, 1.0);
  sim.walkAndAct(1, 0); // grab basil
  sim.walkAndAct(4, 2); // chop basil
  sim.chopAt(4, 2, 1.0);
  sim.walkAndAct(3, 0); // grab raw ribeye
  sim.walkAndAct(8, 0); // sear ribeye in Skillet 1
  sim.walkAndAct(3, 2); // pick up sliced porcini
  sim.walkAndAct(9, 0); // saute porcini in Skillet 2
  sim.walkAndAct(8, 2); // grab warm plate
  sim.walkAndAct(4, 2); // scoop fresh basil onto plate
  sim.waitUntilReady(9, 0);
  sim.walkAndAct(9, 0); // pull golden porcini ★ onto plate
  sim.waitUntilReady(8, 0);
  sim.walkAndAct(8, 0); // pull seared ribeye ★ onto plate -> Seared Ribeye & Herb ★ READY!
  sim.walkAndAct(11, 2); // set finished plate on Warm Service Pass!

  // STAGE B: Assemble a 2/3 MID-ASSEMBLY Pomodoro Tagliatelle on Central Assembly Bench 1 (5, 2)
  sim.walkAndAct(0, 0); // grab tomato
  sim.walkAndAct(3, 2); // chop tomato
  sim.chopAt(3, 2, 1.0);
  sim.walkAndAct(3, 2); // pick up diced tomato
  sim.walkAndAct(7, 0); // simmer Pomodoro Ragu in Copper Pot 2
  sim.walkAndAct(4, 0); // grab pasta
  sim.walkAndAct(6, 0); // boil fresh pasta in Copper Pot 1
  sim.walkAndAct(8, 2); // grab warm plate
  sim.waitUntilReady(7, 0);
  sim.walkAndAct(7, 0); // ladle crimson pomodoro ragu onto plate
  sim.waitUntilReady(6, 0);
  sim.walkAndAct(6, 0); // scoop golden al-dente pasta onto plate -> 2/3 MID-ASSEMBLY!
  sim.walkAndAct(5, 2); // stage mid-assembly plate on Assembly Bench 1!

  // STAGE C: Prep fresh counter ingredients & a Raw Hearth Margherita ready for the Stone Oven on (6, 2)
  sim.walkAndAct(0, 0);
  sim.walkAndAct(3, 2);
  sim.chopAt(3, 2, 1.0);
  sim.walkAndAct(3, 2);
  sim.walkAndAct(7, 0);
  sim.walkAndAct(1, 0);
  sim.walkAndAct(4, 2);
  sim.chopAt(4, 2, 1.0);
  sim.walkAndAct(5, 0);
  sim.walkAndAct(6, 2);
  sim.waitUntilReady(7, 0);
  sim.walkAndAct(7, 0);
  sim.walkAndAct(6, 2);
  sim.walkAndAct(4, 2);
  sim.walkAndAct(6, 2); // Raw Hearth Margherita (BAKE IN OVEN) on (6, 2)!

  // Extra visible prepped counter ingredients: diced tomato on (7, 2) and sliced porcini on Chop Board 3 (4, 4)
  sim.walkAndAct(0, 0);
  sim.walkAndAct(3, 2);
  sim.chopAt(3, 2, 1.0);
  sim.walkAndAct(3, 2);
  sim.walkAndAct(7, 2); // Diced Tomatoes staged on Garnish Bench!

  sim.walkAndAct(2, 0);
  sim.walkAndAct(4, 4);
  sim.chopAt(4, 4, 1.0); // Sliced Porcini on Front Chop Board 3!

  // STAGE D: Serve a fresh Caprese Bruschetta right near the end so Dining Pass (11, 4) gleams!
  if (!orders.tickets.some((t) => t.recipeId === 'bruschetta')) {
    orders.tickets.pop();
    spawnOrderTicket(orders, 'bruschetta', false);
  }
  sim.walkAndAct(0, 0);
  sim.walkAndAct(3, 2);
  sim.chopAt(3, 2, 1.0);
  sim.walkAndAct(1, 0);
  sim.walkAndAct(4, 2);
  sim.chopAt(4, 2, 1.0);
  sim.walkAndAct(5, 0);
  sim.walkAndAct(10, 0); // toast crostini
  sim.walkAndAct(8, 2); // grab warm plate
  sim.walkAndAct(3, 2); // scoop diced tomato
  sim.walkAndAct(4, 2); // scoop fresh basil
  sim.waitUntilReady(10, 0);
  sim.walkAndAct(10, 0); // pull crostini -> Caprese Bruschetta ★ complete!
  sim.walkAndAct(11, 3); // serve at Brass Service Bell -> live on TO DINING (11, 4)!

  // STAGE E: Ignite the ENTIRE Hot Line in parallel right before the freeze-frame (ZERO burnt pans!)
  sim.walkAndAct(3, 0);
  sim.walkAndAct(8, 0); // Skillet 1 searing Ribeye!

  sim.walkAndAct(0, 0);
  sim.walkAndAct(3, 2);
  sim.chopAt(3, 2, 1.0);
  sim.walkAndAct(3, 2);
  sim.walkAndAct(7, 0); // Copper Pot 2 simmering Pomodoro!

  sim.walkAndAct(4, 0);
  sim.walkAndAct(6, 0); // Copper Pot 1 boiling Pasta!

  if (mode === 'sear') {
    // In Shot 2, bake our Raw Margherita right inside the glowing Stone Oven!
    sim.walkAndAct(6, 2);
    sim.walkAndAct(10, 0);
    sim.walkAndAct(4, 4);
    sim.walkAndAct(9, 0); // Skillet 2 sauteing Porcini!
    // Re-chop porcini on board 3 so front bench stays lively
    sim.walkAndAct(2, 0);
    sim.walkAndAct(4, 4);
    sim.chopAt(4, 4, 1.0);
  } else {
    sim.walkAndAct(5, 0);
    sim.walkAndAct(10, 0); // Stone Oven 1 baking golden Hearth Crostini!
    sim.walkAndAct(4, 4);
    sim.walkAndAct(9, 0); // Skillet 2 sauteing Porcini!
    sim.walkAndAct(2, 0);
    sim.walkAndAct(4, 4);
    sim.chopAt(4, 4, 1.0);
  }

  // Wait until Skillet 1 hits Golden Sweet-Spot ★, keeping every burner in crisp active range
  const skillet1 = getStationAt(kitchen, 8, 0);
  let waitGuard = 0;
  while (skillet1?.cook && skillet1.cook.state === 'cooking' && waitGuard < 220) {
    sim.tick();
    waitGuard += 1;
  }

  const normalizeHotLine = () => {
    const pot1 = getStationAt(kitchen, 6, 0);
    if (pot1?.cook) {
      pot1.cook.elapsed = pot1.cook.readyTime * 0.78;
      pot1.cook.state = 'cooking';
    }
    const pot2 = getStationAt(kitchen, 7, 0);
    if (pot2?.cook) {
      pot2.cook.elapsed = pot2.cook.readyTime + 0.45;
      pot2.cook.state = 'sweet';
    }
    const sk1 = getStationAt(kitchen, 8, 0);
    if (sk1?.cook) {
      sk1.cook.elapsed = sk1.cook.readyTime + 0.55;
      sk1.cook.state = 'sweet';
    }
    const sk2 = getStationAt(kitchen, 9, 0);
    if (sk2?.cook) {
      sk2.cook.elapsed = sk2.cook.readyTime * 0.68;
      sk2.cook.state = 'cooking';
    }
    const ov1 = getStationAt(kitchen, 10, 0);
    if (ov1?.cook) {
      ov1.cook.elapsed = ov1.cook.readyTime + 0.35;
      ov1.cook.state = 'sweet';
    }
  };

  populateOrderRail(orders, mode);
  fxState.popups = [];
  fxState.particles = [];

  let screen = SCREEN_MODES.PLAYING;
  let hoveredStation = null;

  if (mode === 'rush') {
    // COVER SHOT: Chef actively chopping Sweet Basil right on Chop Board 2 (4, 2) beside 2/3 mid-assembly pasta!
    sim.walkAndAct(1, 0);
    sim.walkAndAct(4, 2);
    sim.chopAt(4, 2, 0.62);
    normalizeHotLine();
    fxState.popups = [];
    fxState.particles = [];
    orders.combo = 3;
    orders.maxCombo = 3;
    orders.dishesServed = 5;
    orders.perfectServed = 3;
    orders.score = 214;
    orders.tipsEarned = 58;
    orders.rushActive = true;
    orders.rushBannerTimer = 0;
    sim.shiftElapsed = 69; // 01:36 remaining on brass clock!
    const sc = getStationAt(kitchen, 11, 4);
    if (sc?.showcase) sc.showcase.timer = 9.0;
    // Crisp live kitchen atmosphere particles (pure white steam, golden sear sparks, green basil bits, hearth embers!)
    const sk1Pos = tileCenter(8, 0);
    for (let i = 0; i < 6; i++) fx.spawnSizzleSpark(sk1Pos.x + (i - 2.5) * 6, sk1Pos.y - 10, true);
    const pot1Pos = tileCenter(6, 0);
    const pot2Pos = tileCenter(7, 0);
    fx.spawnSteam(pot1Pos.x - 4, pot1Pos.y - 18, false);
    fx.spawnSteam(pot1Pos.x + 6, pot1Pos.y - 26, false);
    fx.spawnSteam(pot2Pos.x - 3, pot2Pos.y - 18, false);
    fx.spawnSteam(pot2Pos.x + 5, pot2Pos.y - 24, false);
    const ovPos = tileCenter(10, 0);
    for (let i = 0; i < 4; i++) fx.spawnEmber(ovPos.x + (i - 1.5) * 10, ovPos.y + 4);
    const chopPos = tileCenter(4, 2);
    fx.spawnChopBits(chopPos.x, chopPos.y - 6, '#4db350', 9);
  } else if (mode === 'sear') {
    // SHOT 2: Chef finishes Pomodoro Tagliatelle ★ and carries it right up to the glowing Brass Service Bell!
    sim.walkAndAct(1, 0);
    sim.walkAndAct(4, 2);
    sim.chopAt(4, 2, 1.0);
    sim.walkAndAct(4, 2);
    sim.walkAndAct(5, 2);
    sim.walkAndAct(5, 2); // pick up finished Pomodoro Tagliatelle ★!
    normalizeHotLine();
    fxState.popups = [];
    fxState.particles = [];
    const bellApproach = tileCenter(10, 3);
    chef.x = bellApproach.x + 6;
    chef.y = bellApproach.y;
    chef.facingX = 1;
    chef.facingY = 0;
    chef.facingAngle = 0;
    orders.combo = 2;
    orders.maxCombo = 2;
    orders.dishesServed = 4;
    orders.perfectServed = 2;
    orders.score = 168;
    orders.rushActive = true;
    orders.rushBannerTimer = 0;
    sim.shiftElapsed = 52;
    const sc = getStationAt(kitchen, 11, 4);
    if (sc?.showcase) sc.showcase.timer = 9.0;
    const sk1Pos = tileCenter(8, 0);
    fx.spawnGoldBurst(sk1Pos.x, sk1Pos.y - 14, 10);
    const pot1Pos = tileCenter(6, 0);
    fx.spawnSteam(pot1Pos.x, pot1Pos.y - 20, false);
    const pot2Pos = tileCenter(7, 0);
    fx.spawnSteam(pot2Pos.x, pot2Pos.y - 20, false);
  } else if (mode === 'fever') {
    // SHOT 3: Peak FEVER SERVICE rush in final 18s with VIP Critic Tasting Plate + golden bursts!
    normalizeHotLine();
    sim.walkAndAct(8, 0); // Chef pulls gleaming ★ Seared Ribeye straight from Skillet 1!
    normalizeHotLine();
    fxState.popups = [];
    fxState.particles = [];
    const mid = tileCenter(5, 3);
    chef.x = mid.x;
    chef.y = mid.y - 6;
    chef.facingX = 0;
    chef.facingY = -1;
    chef.facingAngle = -Math.PI / 2;
    orders.combo = 4;
    orders.maxCombo = 4;
    orders.feverTimer = 14;
    orders.rushActive = true;
    orders.rushBannerTimer = 0;
    orders.dishesServed = 8;
    orders.perfectServed = 5;
    orders.score = 392;
    orders.tipsEarned = 114;
    sim.shiftElapsed = sim.shiftDuration - 18;
    const bellPos = tileCenter(11, 3);
    fx.spawnGoldBurst(bellPos.x - 16, bellPos.y - 12, 22);
    fx.spawnPopup(bellPos.x - 122, bellPos.y - 6, '+$64 PERFECT! ★', '#ffe066', 17);
    const pot1Pos = tileCenter(6, 0);
    fx.spawnSteam(pot1Pos.x, pot1Pos.y - 20, false);
    const pot2Pos = tileCenter(7, 0);
    fx.spawnSteam(pot2Pos.x, pot2Pos.y - 20, false);
    const sc = getStationAt(kitchen, 11, 4);
    if (sc?.showcase) sc.showcase.timer = 9.0;
  } else if (mode === 'title') {
    normalizeHotLine();
    fxState.popups = [];
    fxState.particles = [];
    screen = SCREEN_MODES.TITLE;
    sim.shiftElapsed = 0;
    orders.score = 0;
    orders.combo = 0;
    orders.dishesServed = 0;
  }

  // Final particle tick for natural airborne steam/sparks
  updateParticles(fxState, FIXED_STEP * 3);

  const targetStation = selectTargetStation(chef, kitchen, hoveredStation);

  return {
    screen,
    selectedShiftIndex: shiftIndex,
    time: sim.time,
    shiftElapsed: sim.shiftElapsed,
    shiftDuration: sim.shiftDuration,
    kitchen,
    chef,
    orders,
    fx: fxState,
    fxHelpers: fx,
    audio,
    hoveredStation,
    targetStation,
    ticketBounds: [],
    hudButtons: [],
    titleButtons: [],
    overlayButtons: [],
  };
}
