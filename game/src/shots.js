// Deterministic real-gameplay dual-chef autopilot staging for 4 distinct 1280x800 captures across all 3 biomes & upgrades.

import {
  commandChefToStation,
  createBrigade,
  selectTargetStation,
  triggerChefDash,
  updateChefMovement,
} from './chef.js';
import { FIXED_STEP, SHIFTS, TILE_SIZE, tileCenter } from './config.js';
import { advanceChopping, interactWithStation, updateKitchenStations } from './cooking.js';
import { createDiningRoom, updateDiningGuests } from './diners.js';
import { createKitchen, getStationAt } from './kitchen.js';
import { createOrderSystem, spawnOrderTicket, updateOrders } from './orders.js';
import { bindParticleHelpers, createParticleSystem, updateParticles } from './particles.js';
import { createRng } from './random.js';
import { INGREDIENTS } from './recipes.js';
import { SCREEN_MODES } from './renderer.js';
import { createProceduralTextures } from './textures.js';
import { createUpgradeState, getUpgradeModifiers, purchaseKitchenUpgrade } from './upgrades.js';

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
  const brigade = createBrigade();
  const upgrades = createUpgradeState();
  const mods = getUpgradeModifiers(upgrades);
  const orders = createOrderSystem(shift, rng, mods);
  const diningRoom = createDiningRoom();
  const textures = createProceduralTextures(TILE_SIZE);
  const fxState = createParticleSystem();
  const fx = bindParticleHelpers(fxState);
  const audio = createSilentAudio();

  const sim = {
    time: 0,
    shiftElapsed: 0,
    shiftDuration: shift.durationSec,
    kitchen,
    brigade,
    upgrades,
    mods,
    orders,
    diningRoom,
    textures,
    fxState,
    fx,
    audio,
    keepAppliancesSafe() {
      // Prevent unrelated appliances from burning while demonstrating a long multi-dish sequence
      for (const st of kitchen.stations) {
        if (st.cook && st.cook.elapsed > st.cook.readyTime + 0.8) {
          st.cook.elapsed = st.cook.readyTime + 0.45;
          st.cook.state = 'sweet';
        }
      }
    },
    tick() {
      sim.time += FIXED_STEP;
      sim.shiftElapsed += FIXED_STEP;
      updateKitchenStations(kitchen, FIXED_STEP, fx, audio);
      sim.keepAppliancesSafe();
      updateOrders(orders, FIXED_STEP, sim.shiftElapsed, sim.shiftDuration);
      updateDiningGuests(diningRoom, FIXED_STEP);
      updateParticles(fxState, FIXED_STEP);
    },
    waitUntilReady(col, row) {
      const st = getStationAt(kitchen, col, row);
      let guard = 0;
      while (st?.cook && st.cook.state === 'cooking' && guard < 450) {
        sim.tick();
        guard += 1;
      }
    },
    walkAndAct(chefIndex, col, row) {
      const chef = brigade.chefs[chefIndex];
      const st = getStationAt(kitchen, col, row);
      if (!st) return false;
      commandChefToStation(chef, kitchen, st);
      let guard = 0;
      while (guard < 500) {
        guard += 1;
        if (chef.autoPath.length >= 2 && chef.dashCooldown <= 0) {
          const wp = chef.autoPath[0];
          triggerChefDash(chef, wp.x - chef.x, wp.y - chef.y, fx, audio);
        }
        sim.time += FIXED_STEP;
        sim.shiftElapsed += FIXED_STEP;
        const arrived = updateChefMovement(chef, kitchen, { x: 0, y: 0 }, FIXED_STEP, true);
        updateKitchenStations(kitchen, FIXED_STEP, fx, audio);
        sim.keepAppliancesSafe();
        updateOrders(orders, FIXED_STEP, sim.shiftElapsed, sim.shiftDuration);
        updateDiningGuests(diningRoom, FIXED_STEP);
        updateParticles(fxState, FIXED_STEP);
        if (arrived) {
          return interactWithStation(arrived, chef, kitchen, orders, fx, audio, {
            mods,
            diningRoom,
          });
        }
        if (chef.autoPath.length === 0 && !chef.pendingStation) break;
      }
      return interactWithStation(st, chef, kitchen, orders, fx, audio, {
        mods,
        diningRoom,
      });
    },
    chopAt(chefIndex, col, row, targetProgress = 1.0) {
      const chef = brigade.chefs[chefIndex];
      const st = getStationAt(kitchen, col, row);
      if (!st) return;
      if (targetProgress >= 1.0) {
        let guard = 0;
        while (st.item?.kind === 'ingredient' && INGREDIENTS[st.item.id]?.choppable && guard < 120) {
          guard += 1;
          sim.time += FIXED_STEP;
          sim.shiftElapsed += FIXED_STEP;
          advanceChopping(st, chef, FIXED_STEP, fx, audio, 0);
          updateKitchenStations(kitchen, FIXED_STEP, fx, audio);
          sim.keepAppliancesSafe();
          updateOrders(orders, FIXED_STEP, sim.shiftElapsed, sim.shiftDuration);
          updateDiningGuests(diningRoom, FIXED_STEP);
          updateParticles(fxState, FIXED_STEP);
        }
        return;
      }
      let guard = 0;
      while (st.chopProgress < targetProgress && st.item?.kind === 'ingredient' && INGREDIENTS[st.item.id]?.choppable && guard < 120) {
        guard += 1;
        sim.time += FIXED_STEP;
        sim.shiftElapsed += FIXED_STEP;
        advanceChopping(st, chef, FIXED_STEP, fx, audio, 0);
        updateKitchenStations(kitchen, FIXED_STEP, fx, audio);
        sim.keepAppliancesSafe();
        updateOrders(orders, FIXED_STEP, sim.shiftElapsed, sim.shiftDuration);
        updateDiningGuests(diningRoom, FIXED_STEP);
        updateParticles(fxState, FIXED_STEP);
      }
    },
  };
  return sim;
}

function setOrderRail(orders, mode) {
  orders.tickets = [];
  const presets =
    mode === 'gala'
      ? [
          { id: 'surf_and_turf', vip: true, ratio: 0.24 },
          { id: 'seared_ribeye', vip: false, ratio: 0.48 },
          { id: 'chefs_tasting', vip: true, ratio: 0.68 },
          { id: 'citrus_salmon', vip: false, ratio: 0.81 },
          { id: 'funghi_flatbread', vip: false, ratio: 0.92 },
        ]
      : mode === 'morning'
        ? [
            { id: 'pomodoro_pasta', vip: false, ratio: 0.34 },
            { id: 'salmon_pasta', vip: false, ratio: 0.56 },
            { id: 'saffron_pasta', vip: false, ratio: 0.74 },
            { id: 'margherita', vip: false, ratio: 0.89 },
          ]
        : [
            { id: 'seared_ribeye', vip: false, ratio: 0.31 },
            { id: 'pomodoro_pasta', vip: false, ratio: 0.58 },
            { id: 'citrus_salmon', vip: false, ratio: 0.74 },
            { id: 'margherita', vip: false, ratio: 0.85 },
            { id: 'chefs_tasting', vip: true, ratio: 0.94 },
          ];
  for (const p of presets) {
    const t = spawnOrderTicket(orders, p.id, p.vip);
    if (t) {
      t.patience = Math.round(t.patienceMax * p.ratio);
      t.slideIn = 0;
    }
  }
}

export function stageDeterministicShot(shotName, seed = 7) {
  const mode = shotName || 'rush';
  const shiftIndex = mode === 'morning' ? 0 : mode === 'gala' ? 2 : 1;
  const sim = createRunner(shiftIndex, seed);
  const { kitchen, brigade, upgrades, orders, diningRoom, textures, fx, fxState, audio } = sim;

  orders.spawnCooldown = 999;
  spawnOrderTicket(orders, 'citrus_salmon', false);
  spawnOrderTicket(orders, 'seared_ribeye', false);
  spawnOrderTicket(orders, 'pomodoro_pasta', false);
  spawnOrderTicket(orders, 'margherita', false);
  spawnOrderTicket(orders, 'surf_and_turf', true);

  // 1. Cook & stage complete Seared Ribeye & Herb ★ on Warm Pass (11, 2) READY TO SERVE!
  sim.walkAndAct(1, 2, 0); // Sofia grabs porcini
  sim.walkAndAct(1, 3, 2); // places on Chop 1
  sim.chopAt(1, 3, 2, 1.0); // sliced porcini
  sim.walkAndAct(1, 3, 2); // picks up sliced porcini
  sim.walkAndAct(1, 9, 0); // sautes porcini in Skillet 2!

  sim.walkAndAct(0, 3, 0); // Marco grabs ribeye
  sim.walkAndAct(0, 8, 0); // sears ribeye in Skillet 1!

  sim.walkAndAct(1, 1, 0); // Sofia grabs basil
  sim.walkAndAct(1, 4, 2); // chops on Chop 2
  sim.chopAt(1, 4, 2, 1.0);

  sim.walkAndAct(1, 8, 2); // grabs warm plate
  sim.walkAndAct(1, 4, 2); // scoops fresh basil onto plate
  sim.waitUntilReady(9, 0);
  sim.walkAndAct(1, 9, 0); // scoops golden porcini ★ onto plate
  sim.waitUntilReady(8, 0);
  sim.walkAndAct(1, 8, 0); // scoops seared ribeye ★ -> Seared Ribeye & Herb ★ READY!
  sim.walkAndAct(1, 11, 2); // stages finished plate on Warm Service Pass!

  // 2. Stage 2/3 MID-ASSEMBLY Pomodoro Tagliatelle on Central Assembly Bench 1 (5, 2)
  sim.walkAndAct(1, 0, 0); // tomato
  sim.walkAndAct(1, 3, 2); // chop tomato
  sim.chopAt(1, 3, 2, 1.0);
  sim.walkAndAct(1, 3, 2); // pick up diced tomato
  sim.walkAndAct(1, 7, 0); // simmer Pomodoro in Pot 2

  sim.walkAndAct(0, 4, 0); // Marco grabs fresh pasta
  sim.walkAndAct(0, 6, 0); // boils Pasta in Pot 1

  sim.walkAndAct(1, 8, 2); // warm plate
  sim.waitUntilReady(7, 0);
  sim.walkAndAct(1, 7, 0); // scoops crimson Pomodoro ★
  sim.waitUntilReady(6, 0);
  sim.walkAndAct(1, 6, 0); // scoops golden Pasta ★ -> 2/3 · +BASIL mid-assembly!
  sim.walkAndAct(1, 5, 2); // places mid-assembly plate on Assembly Bench 1!

  // 3. Stage Raw Hearth Margherita (BAKE IN OVEN) on Central Assembly Bench 2 (6, 2)
  sim.walkAndAct(1, 0, 0);
  sim.walkAndAct(1, 3, 2);
  sim.chopAt(1, 3, 2, 1.0);
  sim.walkAndAct(1, 3, 2);
  sim.walkAndAct(1, 7, 0); // Pomodoro in Pot 2

  sim.walkAndAct(1, 1, 0);
  sim.walkAndAct(1, 4, 2);
  sim.chopAt(1, 4, 2, 1.0); // minced basil on Chop 2

  sim.walkAndAct(0, 5, 0); // dough
  sim.walkAndAct(0, 6, 2); // place on Assembly Bench 2
  sim.waitUntilReady(7, 0);
  sim.walkAndAct(0, 7, 0); // scoop pomodoro
  sim.walkAndAct(0, 6, 2); // spread pomodoro onto dough!
  sim.walkAndAct(1, 4, 2); // pick up minced basil
  sim.walkAndAct(1, 6, 2); // top with basil -> Raw Hearth Margherita (BAKE IN OVEN)!

  // 4. Cook & SERVE an Amalfi Citrus Salmon ★ -> lights up Dining Pass (11, 4) & Elena's candlelit table!
  if (!orders.tickets.some((t) => t.recipeId === 'citrus_salmon')) {
    orders.tickets.pop();
    spawnOrderTicket(orders, 'citrus_salmon', false);
  }
  sim.walkAndAct(0, 0, 2); // Marco grabs Wild Salmon
  sim.walkAndAct(0, 9, 0); // sears Salmon in Skillet 2
  sim.walkAndAct(0, 0, 3); // grabs Saffron & Lemon
  sim.walkAndAct(0, 7, 0); // infuses Saffron Glaze in Pot 2
  sim.walkAndAct(1, 1, 0);
  sim.walkAndAct(1, 4, 2);
  sim.chopAt(1, 4, 2, 1.0);
  sim.walkAndAct(1, 8, 2); // warm plate
  sim.walkAndAct(1, 4, 2); // basil
  sim.waitUntilReady(7, 0);
  sim.walkAndAct(1, 7, 0); // saffron glaze ★
  sim.waitUntilReady(9, 0);
  sim.walkAndAct(1, 9, 0); // seared salmon ★ -> Amalfi Citrus Salmon ★ COMPLETE!
  sim.walkAndAct(1, 11, 3); // RING BRASS SERVICE BELL -> Elena gets dish + tip!

  // 5. Stage fresh counter prep: Diced Tomato on Garnish Bench (7, 2) + Sliced Porcini on Front Chop 3 (4, 4)
  sim.walkAndAct(1, 0, 0);
  sim.walkAndAct(1, 3, 2);
  sim.chopAt(1, 3, 2, 1.0);
  sim.walkAndAct(1, 3, 2);
  sim.walkAndAct(1, 7, 2); // Diced Tomatoes on Garnish Bench

  sim.walkAndAct(1, 2, 0);
  sim.walkAndAct(1, 4, 4);
  sim.chopAt(1, 4, 4, 1.0); // Sliced Porcini on Front Chop Board 3

  // 6. Ignite ALL 5 Hot-Line Stations cleanly (Pot 1 Pasta, Pot 2 Saffron, Skillet 1 Ribeye, Skillet 2 Salmon, 420°C Brick Oven!)
  sim.walkAndAct(0, 4, 0);
  sim.walkAndAct(0, 6, 0); // Pot 1: Boiling Pasta
  sim.walkAndAct(0, 0, 3);
  sim.walkAndAct(0, 7, 0); // Pot 2: Golden Saffron Glaze
  sim.walkAndAct(0, 3, 0);
  sim.walkAndAct(0, 8, 0); // Skillet 1: Searing Ribeye
  sim.walkAndAct(0, 0, 2);
  sim.walkAndAct(0, 9, 0); // Skillet 2: Searing Wild Salmon
  if (mode === 'morning' || mode === 'gala') {
    sim.walkAndAct(0, 6, 2); // Slide Raw Margherita straight into 420°C Brick Oven!
    sim.walkAndAct(0, 10, 0);
  } else {
    sim.walkAndAct(0, 5, 0);
    sim.walkAndAct(0, 10, 0); // Bake Hearth Crostini in 420°C Brick Oven!
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
      sk1.cook.elapsed = sk1.cook.readyTime + 0.5;
      sk1.cook.state = 'sweet';
    }
    const sk2 = getStationAt(kitchen, 9, 0);
    if (sk2?.cook) {
      sk2.cook.elapsed = sk2.cook.readyTime + 0.35;
      sk2.cook.state = 'sweet';
    }
    const ov1 = getStationAt(kitchen, 10, 0);
    if (ov1?.cook) {
      ov1.cook.elapsed = ov1.cook.readyTime + 0.35;
      ov1.cook.state = 'sweet';
    }
  };

  setOrderRail(orders, mode);
  fxState.popups = [];
  fxState.particles = [];

  let screen = SCREEN_MODES.PLAYING;
  let hoveredStation = null;

  const marco = brigade.chefs[0];
  const sofia = brigade.chefs[1];

  if (mode === 'rush') {
    // SHOT 1 COVER (Golden Hour Sunset Rush):
    // Sofia actively chopping Sweet Basil on Chop Board 2 (4, 2) beside 2/3 mid-assembly Pomodoro Pasta + BAKE IN OVEN Margherita!
    // Marco pulls gleaming ★ Seared Ribeye from Skillet 1 with golden dotted route heading to Assembly Bench 1!
    sim.walkAndAct(1, 1, 0);
    sim.walkAndAct(1, 4, 2);
    sim.chopAt(1, 4, 2, 0.64);

    // Marco grabs sizzling Seared Ribeye ★ and reloads Skillet 1? Even cleaner: Marco holds a fresh Seared Salmon ★ from Skillet 2, then reload Skillet 2? Keep Skillet 1 searing Ribeye & Skillet 2 searing Salmon while Marco carries a freshly pulled ★ Seared Ribeye toward plating!
    normalizeHotLine();
    sim.walkAndAct(0, 8, 0); // Marco pulls ★ Seared Ribeye!
    // Reload Skillet 1 with another fresh Ribeye so ALL 5 hot-line appliances gleam with °C gauges!
    const sk1 = getStationAt(kitchen, 8, 0);
    sk1.cook = {
      inputId: 'steak',
      outputId: 'seared_steak',
      elapsed: 4.15,
      readyTime: 3.7,
      sweetEnd: 6.0,
      warnTime: 6.9,
      burnTime: 9.3,
      targetTempC: 242,
      state: 'sweet',
    };
    normalizeHotLine();

    const mPos = tileCenter(8, 1);
    marco.x = mPos.x;
    marco.y = mPos.y + 4;
    marco.facingX = -1;
    marco.facingY = 0;
    commandChefToStation(marco, kitchen, getStationAt(kitchen, 5, 2));
    brigade.activeIndex = 0;

    fxState.popups = [];
    fxState.particles = [];
    orders.combo = 4;
    orders.maxCombo = 4;
    orders.feverTimer = 0;
    orders.dishesServed = 6;
    orders.perfectServed = 4;
    orders.score = 286;
    orders.tipsEarned = 78;
    orders.rushActive = true;
    orders.rushBannerTimer = 0;
    sim.shiftElapsed = 71; // 01:34 remaining!
    const sc = getStationAt(kitchen, 11, 4);
    if (sc) {
      sc.showcase = { dishId: 'citrus_salmon', perfect: true, payout: 69, tip: 21, combo: 4, timer: 10.5 };
    }
    diningRoom.tables[0].servedDishId = 'citrus_salmon';
    diningRoom.tables[0].servedPerfect = true;
    diningRoom.tables[0].delightTimer = 4.5;
    diningRoom.tables[0].serveTimer = 11;
    diningRoom.tables[0].lastTipText = '★ +$69';

    const sk1Pos = tileCenter(8, 0);
    for (let i = 0; i < 6; i++) fx.spawnSizzleSpark(sk1Pos.x + (i - 2.5) * 6, sk1Pos.y - 8, true);
    for (const c of [6, 7]) {
      const p = tileCenter(c, 0);
      fx.spawnSteam(p.x - 4, p.y - 16, false);
      fx.spawnSteam(p.x + 5, p.y - 25, false);
    }
    const ovPos = tileCenter(10, 0);
    for (let i = 0; i < 5; i++) fx.spawnEmber(ovPos.x + (i - 2) * 8, ovPos.y + 4);
    const chopPos = tileCenter(4, 2);
    fx.spawnChopBits(chopPos.x, chopPos.y - 6, '#4db350', 9);
  } else if (mode === 'gala') {
    // SHOT 2 (Shift 3: Candlelit Twilight Gala + Peak FEVER ×6 + 00:18 Countdown!)
    // Marco builds & carries a complete VIP Grand Surf & Turf ★ toward the Brass Service Bell!
    normalizeHotLine();
    sim.walkAndAct(1, 1, 0);
    sim.walkAndAct(1, 4, 2);
    sim.chopAt(1, 4, 2, 1.0); // minced basil ready on Chop 2

    sim.walkAndAct(0, 8, 2); // Marco grabs warm plate
    sim.walkAndAct(0, 8, 0); // scoops ★ Seared Ribeye
    sim.walkAndAct(0, 9, 0); // scoops ★ Seared Salmon
    sim.walkAndAct(0, 7, 0); // scoops ★ Saffron Glaze
    sim.walkAndAct(0, 4, 2); // scoops fresh Basil -> VIP GRAND SURF & TURF ★ COMPLETE!

    // Sofia reloads Skillet 1, Skillet 2 & Pot 2 so the whole twilight hot line glows dramatically!
    sim.walkAndAct(1, 3, 0);
    sim.walkAndAct(1, 8, 0);
    sim.walkAndAct(1, 0, 2);
    sim.walkAndAct(1, 9, 0);
    sim.walkAndAct(1, 0, 3);
    sim.walkAndAct(1, 7, 0);
    normalizeHotLine();

    const mPos = tileCenter(9, 3);
    marco.x = mPos.x + 6;
    marco.y = mPos.y;
    marco.facingX = 1;
    marco.facingY = 0;
    commandChefToStation(marco, kitchen, getStationAt(kitchen, 11, 3));

    const sPos = tileCenter(5, 3);
    sofia.x = sPos.x;
    sofia.y = sPos.y - 4;
    sofia.facingX = 0;
    sofia.facingY = -1;
    brigade.activeIndex = 0;

    fxState.popups = [];
    fxState.particles = [];
    orders.combo = 6;
    orders.maxCombo = 6;
    orders.feverTimer = 15;
    orders.rushActive = true;
    orders.rushBannerTimer = 0;
    orders.dishesServed = 11;
    orders.perfectServed = 8;
    orders.score = 548;
    orders.tipsEarned = 164;
    sim.shiftElapsed = sim.shiftDuration - 18;
    diningRoom.tables[1].servedDishId = 'chefs_tasting';
    diningRoom.tables[1].servedPerfect = true;
    diningRoom.tables[1].serveTimer = 12;
    diningRoom.tables[1].delightTimer = 5;
    diningRoom.tables[1].lastTipText = '★ +$96';
    const sc = getStationAt(kitchen, 11, 4);
    if (sc) {
      sc.showcase = { dishId: 'chefs_tasting', perfect: true, payout: 96, tip: 32, combo: 6, timer: 10.5 };
    }
    const bellPos = tileCenter(11, 3);
    fx.spawnGoldBurst(bellPos.x - 10, bellPos.y - 10, 22);
    // Positioned cleanly in open corridor above Marco's route (zero overlap with Marco's hat or Warm Pass!)
    fx.spawnPopup(bellPos.x - 165, bellPos.y - 68, '+$96 CRITIC PERFECT! ★', '#ffe066', 16);
    const ovPos = tileCenter(10, 0);
    for (let i = 0; i < 6; i++) fx.spawnEmber(ovPos.x + (i - 2.5) * 8, ovPos.y + 4);
  } else if (mode === 'morning') {
    // SHOT 3 (Shift 1: Sunlit Amalfi Morning — Dual-Chef Simultaneous Queued Route Planning!)
    // Sofia finishes Pomodoro Tagliatelle ★ and queues cyan route straight to Brass Bell!
    // Marco pulls Golden Saffron Glaze ★ and queues golden route straight to a 2/3 Salmon Pasta mid-assembly plate!
    normalizeHotLine();
    sim.walkAndAct(1, 1, 0);
    sim.walkAndAct(1, 4, 2);
    sim.chopAt(1, 4, 2, 1.0);
    sim.walkAndAct(1, 4, 2); // pick up minced basil
    sim.walkAndAct(1, 5, 2); // complete Pomodoro Tagliatelle ★ on Assembly Bench 1!
    sim.walkAndAct(1, 5, 2); // pick up finished Pomodoro Tagliatelle ★!

    // Marco puts a 2/3 Salmon Pasta (Seared Salmon + Boiled Pasta) mid-assembly plate on Assembly Bench 2 (6, 2),
    // then carries Golden Saffron Glaze ★ along a visible golden route right to it!
    sim.walkAndAct(0, 8, 2); // plate
    sim.walkAndAct(0, 6, 0); // boiled pasta ★
    sim.walkAndAct(0, 9, 0); // seared salmon ★ -> 2/3 · +GLAZE!
    sim.walkAndAct(0, 6, 2); // place on Assembly Bench 2!
    sim.walkAndAct(0, 7, 0); // Marco carries Saffron Citrus Glaze ★!

    // Keep all 5 hot-line appliances cooking brightly in morning sun
    const pot1 = getStationAt(kitchen, 6, 0);
    pot1.cook = { inputId: 'pasta', outputId: 'boiled_pasta', elapsed: 2.5, readyTime: 3.3, sweetEnd: 6.4, warnTime: 8.5, burnTime: 11.4, targetTempC: 100, state: 'cooking' };
    const pot2 = getStationAt(kitchen, 7, 0);
    pot2.cook = { inputId: 'saffron', outputId: 'saffron_glaze', elapsed: 3.4, readyTime: 3.0, sweetEnd: 6.0, warnTime: 8.2, burnTime: 11.2, targetTempC: 165, state: 'sweet' };
    const sk2 = getStationAt(kitchen, 9, 0);
    sk2.cook = { inputId: 'salmon', outputId: 'seared_salmon', elapsed: 3.6, readyTime: 3.2, sweetEnd: 5.6, warnTime: 6.6, burnTime: 9.0, targetTempC: 224, state: 'sweet' };
    normalizeHotLine();

    const mPos = tileCenter(2, 1);
    marco.x = mPos.x;
    marco.y = mPos.y;
    marco.facingX = 1;
    marco.facingY = 0;
    commandChefToStation(marco, kitchen, getStationAt(kitchen, 6, 2));

    const sPos = tileCenter(7, 3);
    sofia.x = sPos.x;
    sofia.y = sPos.y;
    sofia.facingX = 1;
    sofia.facingY = 0;
    commandChefToStation(sofia, kitchen, getStationAt(kitchen, 11, 3));
    brigade.activeIndex = 1;

    fxState.popups = [];
    fxState.particles = [];
    orders.combo = 2;
    orders.maxCombo = 2;
    orders.dishesServed = 3;
    orders.perfectServed = 2;
    orders.score = 148;
    orders.rushActive = false;
    orders.rushBannerTimer = 0;
    sim.shiftElapsed = 44;
    const sc = getStationAt(kitchen, 11, 4);
    if (sc) {
      sc.showcase = { dishId: 'citrus_salmon', perfect: true, payout: 62, tip: 14, combo: 2, timer: 10.5 };
    }
    diningRoom.tables[0].servedDishId = 'citrus_salmon';
    diningRoom.tables[0].servedPerfect = true;
    diningRoom.tables[0].serveTimer = 11;
    diningRoom.tables[0].delightTimer = 0;
    for (const c of [6, 7]) {
      const p = tileCenter(c, 0);
      fx.spawnSteam(p.x, p.y - 18, false);
    }
  } else if (mode === 'upgrades') {
    // SHOT 4: Brigade Workshop + 12-Dish Artisan Bistro Menu!
    normalizeHotLine();
    fxState.popups = [];
    fxState.particles = [];
    upgrades.bank = 440;
    purchaseKitchenUpgrade(upgrades, 'damascus_knife');
    purchaseKitchenUpgrade(upgrades, 'hammered_copper');
    orders.score = 286;
    orders.combo = 4;
    orders.dishesServed = 6;
    sim.shiftElapsed = 71;
    screen = SCREEN_MODES.UPGRADES;
  }

  updateParticles(fxState, FIXED_STEP * 3);
  const activeChef = brigade.chefs[brigade.activeIndex];
  const targetStation = selectTargetStation(activeChef, kitchen, hoveredStation);

  return {
    screen,
    selectedShiftIndex: shiftIndex,
    time: sim.time,
    shiftElapsed: sim.shiftElapsed,
    shiftDuration: sim.shiftDuration,
    kitchen,
    brigade,
    upgrades,
    mods: sim.mods,
    orders,
    diningRoom,
    textures,
    fx: fxState,
    fxHelpers: fx,
    audio,
    hoveredStation,
    targetStation,
    ticketBounds: [],
    hudButtons: [],
    brigadeButtons: [],
    titleButtons: [],
    overlayButtons: [],
  };
}
