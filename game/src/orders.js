// Order ticket rail, service wave pacing, VIP critic orders, patience timers, and combo scoring.

import { TIMING } from './config.js';
import { RECIPES } from './recipes.js';

export function createOrderSystem(shift, rng) {
  return {
    shift,
    rng,
    tickets: [],
    nextTicketId: 1,
    spawnCooldown: 0.4,
    score: 0,
    tipsEarned: 0,
    dishesServed: 0,
    perfectServed: 0,
    expiredCount: 0,
    combo: 0,
    maxCombo: 0,
    feverTimer: 0,
    rushActive: false,
    rushBannerTimer: 0,
    focusedTicketId: null,
    focusTimer: 0,
    recentServeLog: [],
  };
}

export function isFeverActive(orderSys) {
  return orderSys.feverTimer > 0;
}

export function spawnOrderTicket(orderSys, forcedRecipeId = null, forcedVip = null) {
  const { shift, rng } = orderSys;
  if (orderSys.tickets.length >= shift.maxOrders) return null;

  let recipeId = forcedRecipeId;
  if (!recipeId) {
    const activeIds = new Set(orderSys.tickets.map((t) => t.recipeId));
    const freshChoices = shift.menu.filter((id) => !activeIds.has(id));
    const pool = freshChoices.length > 0 && rng() < 0.72 ? freshChoices : shift.menu;
    recipeId = pool[Math.floor(rng() * pool.length)];
  }

  const recipe = RECIPES[recipeId];
  const isVip =
    forcedVip !== null
      ? forcedVip
      : recipeId === 'chefs_tasting' ||
        (orderSys.tickets.length >= 2 && rng() < shift.vipChance);

  const patienceMax = Math.round(
    recipe.patienceSec * shift.patienceScale * (isVip ? 0.92 : 1.0),
  );

  const ticket = {
    id: orderSys.nextTicketId++,
    recipeId,
    isVip,
    patience: patienceMax,
    patienceMax,
    slideIn: 1.0,
    pulse: 0,
  };
  orderSys.tickets.push(ticket);
  return ticket;
}

export function updateOrders(orderSys, dt, shiftElapsed, shiftDuration, callbacks = {}) {
  const remaining = Math.max(0, shiftDuration - shiftElapsed);
  if (!orderSys.rushActive && shiftElapsed >= orderSys.shift.rushStartSec) {
    orderSys.rushActive = true;
    orderSys.rushBannerTimer = 3.2;
    callbacks.onRushStart?.();
  }

  if (orderSys.rushBannerTimer > 0) {
    orderSys.rushBannerTimer = Math.max(0, orderSys.rushBannerTimer - dt);
  }
  if (orderSys.feverTimer > 0) {
    orderSys.feverTimer = Math.max(0, orderSys.feverTimer - dt);
  }
  if (orderSys.focusTimer > 0) {
    orderSys.focusTimer = Math.max(0, orderSys.focusTimer - dt);
    if (orderSys.focusTimer === 0) orderSys.focusedTicketId = null;
  }

  // Update ticket timers
  const kept = [];
  for (const ticket of orderSys.tickets) {
    ticket.slideIn = Math.max(0, ticket.slideIn - dt * 4.5);
    ticket.patience -= dt;
    const ratio = ticket.patience / ticket.patienceMax;
    if (ratio < 0.28) {
      ticket.pulse += dt * 7;
    }
    if (ticket.patience <= 0) {
      orderSys.expiredCount += 1;
      orderSys.combo = 0;
      orderSys.feverTimer = 0;
      callbacks.onTicketExpired?.(ticket);
    } else {
      kept.push(ticket);
    }
  }
  orderSys.tickets = kept;

  // Keep the rail bustling without overwhelming the player
  orderSys.spawnCooldown -= dt;
  const minWanted = orderSys.rushActive ? 3 : 2;
  if (
    remaining > 12 &&
    orderSys.tickets.length < orderSys.shift.maxOrders &&
    (orderSys.spawnCooldown <= 0 || orderSys.tickets.length < minWanted)
  ) {
    const ticket = spawnOrderTicket(orderSys);
    if (ticket) {
      callbacks.onTicketSpawned?.(ticket);
      const base = orderSys.rushActive
        ? orderSys.shift.spawnIntervalRush
        : orderSys.shift.spawnIntervalBase;
      orderSys.spawnCooldown = base * (0.85 + orderSys.rng() * 0.3);
    }
  }
}

export function serveDishAgainstOrders(orderSys, dishId, isPerfect) {
  let bestIdx = -1;
  let lowestPatienceRatio = Infinity;
  for (let i = 0; i < orderSys.tickets.length; i++) {
    const ticket = orderSys.tickets[i];
    if (ticket.recipeId !== dishId) continue;
    const ratio = ticket.patience / ticket.patienceMax;
    if (ratio < lowestPatienceRatio) {
      lowestPatienceRatio = ratio;
      bestIdx = i;
    }
  }

  if (bestIdx === -1) {
    return { matched: false };
  }

  const [ticket] = orderSys.tickets.splice(bestIdx, 1);
  const recipe = RECIPES[dishId];

  orderSys.combo += 1;
  if (orderSys.combo > orderSys.maxCombo) orderSys.maxCombo = orderSys.combo;
  orderSys.dishesServed += 1;
  if (isPerfect) orderSys.perfectServed += 1;

  let triggeredFever = false;
  if (orderSys.combo >= TIMING.feverThreshold) {
    if (orderSys.feverTimer <= 0) triggeredFever = true;
    orderSys.feverTimer = TIMING.feverDuration;
  }

  const basePay = recipe.price;
  const speedRatio = Math.max(0, Math.min(1, ticket.patience / ticket.patienceMax));
  const speedTip = Math.round(basePay * 0.25 * speedRatio);
  const perfectBonus = isPerfect ? Math.round(basePay * TIMING.perfectBonusRatio) : 0;
  const vipBonus = ticket.isVip ? Math.round(basePay * 0.35) : 0;
  const comboBonus = Math.min(4, orderSys.combo - 1) * 5;
  const feverMultiplier = orderSys.feverTimer > 0 ? 1.25 : 1.0;

  const totalTip = Math.round((speedTip + perfectBonus + vipBonus + comboBonus) * feverMultiplier);
  const totalPayout = basePay + totalTip;

  orderSys.score += totalPayout;
  orderSys.tipsEarned += totalTip;

  const entry = {
    ticketId: ticket.id,
    dishId,
    recipeName: recipe.shortName,
    basePay,
    tip: totalTip,
    totalPayout,
    isPerfect,
    isVip: ticket.isVip,
    combo: orderSys.combo,
    triggeredFever,
  };
  orderSys.recentServeLog.unshift(entry);
  if (orderSys.recentServeLog.length > 6) orderSys.recentServeLog.pop();

  return { matched: true, ...entry };
}

export function computeStarRating(orderSys) {
  const targets = orderSys.shift.starTargets;
  let stars = 0;
  for (const target of targets) {
    if (orderSys.score >= target) stars += 1;
  }
  return stars;
}
