// Real-time cooking simulation: live °C thermal curves, sweet-spot searing, stone hearth baking, and smart plating.

import { CHEF_CONFIG, TIMING, tileCenter } from './config.js';
import { reactToServedDish } from './diners.js';
import { STATION_TYPES, findStationByType } from './kitchen.js';
import { serveDishAgainstOrders } from './orders.js';
import {
  INGREDIENTS,
  RECIPES,
  canAddToPlate,
  canCombineRawPie,
  createIngredientItem,
  createPlate,
  createRawPie,
  findRawPieProgress,
  resolveRawPieBakeResult,
} from './recipes.js';

function getCookProfile(stationType, inputId, mods = null) {
  const cookMult = mods?.cookSpeedMult ?? 1;
  const ovenMult = mods?.ovenSpeedMult ?? 1;
  const sweetBonus = mods?.sweetSpotBonusSec ?? 0;

  if (stationType === STATION_TYPES.POT) {
    if (inputId === 'pasta') {
      return {
        outputId: 'boiled_pasta',
        readyTime: TIMING.potBoilDuration / cookMult,
        sweetEnd: TIMING.potSweetEnd / cookMult + sweetBonus,
        warnTime: TIMING.potWarnTime / cookMult + sweetBonus,
        burnTime: TIMING.potBurnTime / cookMult + sweetBonus,
        targetTempC: 100,
      };
    }
    if (inputId === 'chopped_tomato') {
      return {
        outputId: 'pomodoro_sauce',
        readyTime: TIMING.sauceSimmerDuration / cookMult,
        sweetEnd: TIMING.sauceSweetEnd / cookMult + sweetBonus,
        warnTime: TIMING.sauceWarnTime / cookMult + sweetBonus,
        burnTime: TIMING.sauceBurnTime / cookMult + sweetBonus,
        targetTempC: 175,
      };
    }
    if (inputId === 'saffron') {
      return {
        outputId: 'saffron_glaze',
        readyTime: TIMING.sauceSimmerDuration / cookMult,
        sweetEnd: TIMING.sauceSweetEnd / cookMult + sweetBonus,
        warnTime: TIMING.sauceWarnTime / cookMult + sweetBonus,
        burnTime: TIMING.sauceBurnTime / cookMult + sweetBonus,
        targetTempC: 165,
      };
    }
  }

  if (stationType === STATION_TYPES.SKILLET) {
    if (inputId === 'steak') {
      return {
        outputId: 'seared_steak',
        readyTime: TIMING.skilletSteakDuration / cookMult,
        sweetEnd: TIMING.skilletSteakSweetEnd / cookMult + sweetBonus,
        warnTime: TIMING.skilletSteakWarn / cookMult + sweetBonus,
        burnTime: TIMING.skilletSteakBurn / cookMult + sweetBonus,
        targetTempC: 242,
      };
    }
    if (inputId === 'salmon') {
      return {
        outputId: 'seared_salmon',
        readyTime: TIMING.skilletSalmonDuration / cookMult,
        sweetEnd: TIMING.skilletSalmonSweetEnd / cookMult + sweetBonus,
        warnTime: TIMING.skilletSalmonWarn / cookMult + sweetBonus,
        burnTime: TIMING.skilletSalmonBurn / cookMult + sweetBonus,
        targetTempC: 224,
      };
    }
    if (inputId === 'chopped_mushroom') {
      return {
        outputId: 'sauteed_mushroom',
        readyTime: TIMING.skilletMushroomDuration / cookMult,
        sweetEnd: TIMING.skilletMushroomSweetEnd / cookMult + sweetBonus,
        warnTime: TIMING.skilletMushroomWarn / cookMult + sweetBonus,
        burnTime: TIMING.skilletMushroomBurn / cookMult + sweetBonus,
        targetTempC: 208,
      };
    }
  }

  if (stationType === STATION_TYPES.OVEN) {
    if (inputId === 'dough') {
      return {
        outputId: 'toasted_bread',
        readyTime: TIMING.ovenToastDuration / ovenMult,
        sweetEnd: TIMING.ovenToastSweetEnd / ovenMult + sweetBonus,
        warnTime: TIMING.ovenToastWarn / ovenMult + sweetBonus,
        burnTime: TIMING.ovenToastBurn / ovenMult + sweetBonus,
        targetTempC: 395,
      };
    }
    if (inputId === 'baked_margherita' || inputId === 'baked_funghi') {
      return {
        outputId: inputId,
        readyTime: TIMING.ovenBakeDuration / ovenMult,
        sweetEnd: TIMING.ovenBakeSweetEnd / ovenMult + sweetBonus,
        warnTime: TIMING.ovenBakeWarn / ovenMult + sweetBonus,
        burnTime: TIMING.ovenBakeBurn / ovenMult + sweetBonus,
        targetTempC: 420,
      };
    }
  }

  return null;
}

export function getLiveTemperatureC(cook) {
  if (!cook) return 22;
  const target = cook.targetTempC ?? 210;
  const ramp = Math.min(1, cook.elapsed / Math.max(0.5, cook.readyTime));
  const base = Math.round(78 + (target - 78) * ramp);
  if (cook.state === 'warn' || cook.state === 'burnt') {
    return base + Math.round((cook.elapsed - cook.readyTime) * 14);
  }
  return base;
}

export function startCookingOnStation(station, inputId, bakedOverrideId = null, mods = null) {
  const profile = getCookProfile(station.type, bakedOverrideId ?? inputId, mods);
  if (!profile) return false;
  station.cook = {
    inputId,
    outputId: profile.outputId,
    elapsed: 0,
    readyTime: profile.readyTime,
    sweetEnd: profile.sweetEnd,
    warnTime: profile.warnTime,
    burnTime: profile.burnTime,
    targetTempC: profile.targetTempC,
    state: 'cooking',
  };
  station.bounce = 1.0;
  return true;
}

export function extractCookedItem(station) {
  const cook = station.cook;
  if (!cook || cook.state === 'cooking') return null;

  const isBurnt = cook.state === 'burnt';
  const isPerfect = cook.state === 'sweet';
  const outputId = isBurnt ? 'burnt' : cook.outputId;

  station.cook = null;
  station.bounce = 1.0;

  if (!isBurnt && (outputId === 'baked_margherita' || outputId === 'baked_funghi')) {
    return createPlate([outputId], isPerfect);
  }
  return createIngredientItem(outputId, isPerfect);
}

export function updateKitchenStations(kitchen, dt, fx, audio) {
  for (const st of kitchen.stations) {
    if (st.bounce > 0) st.bounce = Math.max(0, st.bounce - dt * 5.2);
    if (st.bellPulse > 0) st.bellPulse = Math.max(0, st.bellPulse - dt * 2.6);
    if (st.highlightPulse > 0) st.highlightPulse = Math.max(0, st.highlightPulse - dt);

    if (st.showcase) {
      st.showcase.timer -= dt;
      if (st.showcase.timer <= 0) st.showcase = null;
    }

    const cook = st.cook;
    if (!cook) continue;

    const prevState = cook.state;
    cook.elapsed += dt;

    if (cook.elapsed >= cook.burnTime) cook.state = 'burnt';
    else if (cook.elapsed >= cook.warnTime) cook.state = 'warn';
    else if (cook.elapsed >= cook.sweetEnd) cook.state = 'ready';
    else if (cook.elapsed >= cook.readyTime) cook.state = 'sweet';
    else cook.state = 'cooking';

    const pos = tileCenter(st.col, st.row);
    if (prevState === 'cooking' && cook.state === 'sweet') {
      audio?.playReadyDing(st.type);
      fx?.spawnGoldBurst(pos.x, pos.y - 18, 10);
      fx?.spawnPopup(pos.x, pos.y - 34, `${cook.targetTempC}°C PERFECT ★`, '#ffd452', 12.5);
    } else if (prevState !== 'warn' && cook.state === 'warn') {
      audio?.playWarnBeep();
    } else if (prevState !== 'burnt' && cook.state === 'burnt') {
      audio?.playBurnSizzle();
      fx?.spawnPopup(pos.x, pos.y - 34, 'OVERCOOKED!', '#ff594a', 13.5);
    }

    if (fx) {
      if (st.type === STATION_TYPES.POT) {
        if (Math.random() < dt * 7) fx.spawnSteam(pos.x + (Math.random() - 0.5) * 24, pos.y - 16, cook.state === 'warn' || cook.state === 'burnt');
      } else if (st.type === STATION_TYPES.SKILLET) {
        if (Math.random() < dt * 9) fx.spawnSizzleSpark(pos.x + (Math.random() - 0.5) * 30, pos.y - 8, cook.state === 'sweet');
        if (cook.state === 'warn' || cook.state === 'burnt') {
          if (Math.random() < dt * 9) fx.spawnSteam(pos.x + (Math.random() - 0.5) * 20, pos.y - 14, true);
        }
      } else if (st.type === STATION_TYPES.OVEN) {
        if (Math.random() < dt * 6) fx.spawnEmber(pos.x + (Math.random() - 0.5) * 28, pos.y + 8);
      }
    }
  }
}

export function advanceChopping(station, chef, dt, fx, audio, boost = 0, chopSpeedMult = 1) {
  if (!station || station.type !== STATION_TYPES.CHOP) return false;
  if (!station.item || station.item.kind !== 'ingredient') return false;
  const info = INGREDIENTS[station.item.id];
  if (!info?.choppable) return false;

  const prevStep = Math.floor(station.chopProgress * 4);
  const speed = chopSpeedMult / CHEF_CONFIG.chopDuration;
  station.chopProgress = Math.min(1, station.chopProgress + dt * speed + boost);
  chef.choppingAnim = 0.16;

  const pos = tileCenter(station.col, station.row);
  const nextStep = Math.floor(station.chopProgress * 4);
  if (nextStep > prevStep || boost > 0) {
    audio?.playChop(nextStep);
    fx?.spawnChopBits(pos.x, pos.y - 6, info.color, 5);
    station.bounce = 0.65;
  }

  if (station.chopProgress >= 1) {
    station.item = createIngredientItem(info.chopResult, false);
    station.chopProgress = 0;
    station.bounce = 1.0;
    fx?.spawnChopBits(pos.x, pos.y - 8, info.color, 10);
    fx?.spawnPopup(pos.x, pos.y - 30, INGREDIENTS[info.chopResult].short, '#fbf4e3', 12.5);
    return true;
  }
  return true;
}

function tryCombineItems(targetItem, addedItem) {
  if (!targetItem || !addedItem) return null;

  if (targetItem.kind === 'plate' && addedItem.kind === 'ingredient') {
    if (canAddToPlate(targetItem, addedItem.id)) {
      return createPlate(
        [...targetItem.parts, addedItem.id],
        targetItem.perfect || addedItem.perfect,
      );
    }
  }

  if (targetItem.kind === 'ingredient' && addedItem.kind === 'plate') {
    if (canAddToPlate(addedItem, targetItem.id)) {
      return createPlate(
        [...addedItem.parts, targetItem.id],
        addedItem.perfect || targetItem.perfect,
      );
    }
  }

  if (targetItem.kind === 'plate' && addedItem.kind === 'plate') {
    const merged = [...new Set([...targetItem.parts, ...addedItem.parts])];
    if (merged.length > targetItem.parts.length && merged.length > addedItem.parts.length) {
      const valid = Object.values(RECIPES).some((r) =>
        merged.every((p) => r.components.includes(p)),
      );
      if (valid) {
        return createPlate(merged, targetItem.perfect || addedItem.perfect);
      }
    }
  }

  if (targetItem.kind === 'ingredient' && addedItem.kind === 'ingredient') {
    if (targetItem.id === 'dough' && INGREDIENTS[addedItem.id]?.doughCombinable) {
      if (canCombineRawPie(['dough'], addedItem.id)) {
        return createRawPie(['dough', addedItem.id], targetItem.perfect || addedItem.perfect);
      }
    }
    if (addedItem.id === 'dough' && INGREDIENTS[targetItem.id]?.doughCombinable) {
      if (canCombineRawPie(['dough'], targetItem.id)) {
        return createRawPie(['dough', targetItem.id], targetItem.perfect || addedItem.perfect);
      }
    }
  }

  if (targetItem.kind === 'raw_pie' && addedItem.kind === 'ingredient') {
    if (canCombineRawPie(targetItem.parts, addedItem.id)) {
      return createRawPie(
        [...targetItem.parts, addedItem.id],
        targetItem.perfect || addedItem.perfect,
      );
    }
  }

  if (targetItem.kind === 'ingredient' && addedItem.kind === 'raw_pie') {
    if (canCombineRawPie(addedItem.parts, targetItem.id)) {
      return createRawPie(
        [...addedItem.parts, targetItem.id],
        addedItem.perfect || targetItem.perfect,
      );
    }
  }

  return null;
}

function executeServe(plate, passStation, kitchen, orderSys, fx, audio, diningRoom = null) {
  if (!plate || plate.kind !== 'plate' || !plate.dishId) {
    return { served: false, reason: 'not_complete' };
  }
  const result = serveDishAgainstOrders(orderSys, plate.dishId, plate.perfect);
  const pos = tileCenter(passStation.col, passStation.row);

  if (!result.matched) {
    audio?.playErrorBuzz();
    fx?.spawnPopup(pos.x - 16, pos.y - 34, 'No matching ticket!', '#ff7666', 13.5);
    return { served: false, reason: 'no_ticket' };
  }

  passStation.bellPulse = 1.0;
  audio?.playServeBell(result.isPerfect || result.isVip);
  fx?.spawnGoldBurst(pos.x, pos.y - 14, result.isPerfect ? 26 : 16);
  fx?.addShake(result.isPerfect ? 5.5 : 3.2);

  const label = result.isPerfect
    ? `+$${result.totalPayout} PERFECT! ★`
    : `+$${result.totalPayout} (+$${result.tip} tip)`;
  fx?.spawnPopup(pos.x - 76, pos.y - 26, label, '#ffe066', 16.5);

  if (result.combo >= 2) {
    fx?.spawnPopup(pos.x - 72, pos.y - 52, `×${result.combo} COMBO!`, '#7dffb2', 14.5);
  }
  if (result.triggeredFever) {
    audio?.playFeverFanfare();
    fx?.spawnPopup(580, 285, '🔥 FEVER SERVICE! +25% TIPS & SPEED 🔥', '#ffd447', 20);
  }

  const showcaseStation = findStationByType(kitchen, STATION_TYPES.SHOWCASE);
  if (showcaseStation) {
    showcaseStation.showcase = {
      dishId: plate.dishId,
      perfect: plate.perfect,
      payout: result.totalPayout,
      tip: result.tip,
      combo: result.combo,
      timer: TIMING.passShowcaseSeconds,
    };
    showcaseStation.bounce = 1.0;
  }

  reactToServedDish(diningRoom, plate.dishId, plate.perfect, result.totalPayout, result.isVip);

  return { served: true, result };
}

export function interactWithStation(
  station,
  chef,
  kitchen,
  orderSys,
  fx,
  audio,
  options = {},
) {
  if (!station) return false;
  const pos = tileCenter(station.col, station.row);
  const held = chef.heldItem;
  const mods = options.mods ?? null;
  const diningRoom = options.diningRoom ?? null;

  if (station.type === STATION_TYPES.PANTRY) {
    if (!held) {
      chef.heldItem = createIngredientItem(station.ingredient, false);
      station.bounce = 1.0;
      audio?.playPickup();
      return true;
    }
    if (held.kind === 'ingredient' && held.id === station.ingredient) {
      chef.heldItem = null;
      station.bounce = 0.7;
      audio?.playPlace();
      return true;
    }
    return false;
  }

  if (station.type === STATION_TYPES.PLATE_STACK) {
    if (!held) {
      chef.heldItem = createPlate([], false);
      station.bounce = 1.0;
      audio?.playPlateClink();
      return true;
    }
    if (held.kind === 'plate' && held.parts.length === 0) {
      chef.heldItem = null;
      station.bounce = 0.7;
      audio?.playPlateClink();
      return true;
    }
    if (held.kind === 'ingredient' && INGREDIENTS[held.id]?.plateable) {
      chef.heldItem = createPlate([held.id], held.perfect);
      station.bounce = 1.0;
      audio?.playPlateClink();
      return true;
    }
    return false;
  }

  if (station.type === STATION_TYPES.COMPOST) {
    if (!held) return false;
    if (held.kind === 'plate' && held.parts.length > 0) {
      chef.heldItem = createPlate([], false);
      fx?.spawnPopup(pos.x, pos.y - 28, 'Plate Rinsed', '#e8dec8', 12.5);
    } else {
      chef.heldItem = null;
      fx?.spawnPopup(pos.x, pos.y - 28, 'Composted', '#d9cbb3', 12.5);
    }
    station.bounce = 0.9;
    audio?.playTrash();
    return true;
  }

  if (station.type === STATION_TYPES.SERVE_BELL) {
    if (held && held.kind === 'plate' && held.dishId) {
      const outcome = executeServe(held, station, kitchen, orderSys, fx, audio, diningRoom);
      if (outcome.served) {
        chef.heldItem = null;
        return true;
      }
      return false;
    }
    if (!held) {
      const warmPass = findStationByType(kitchen, STATION_TYPES.PASS_HOLD);
      if (warmPass?.item?.kind === 'plate' && warmPass.item.dishId) {
        const outcome = executeServe(warmPass.item, station, kitchen, orderSys, fx, audio, diningRoom);
        if (outcome.served) {
          warmPass.item = null;
          return true;
        }
      }
    }
    audio?.playErrorBuzz();
    fx?.spawnPopup(pos.x - 24, pos.y - 32, 'Plate a finished dish!', '#f5c78a', 12.5);
    return false;
  }

  if (station.type === STATION_TYPES.CHOP) {
    if (!station.item && held) {
      station.item = held;
      station.chopProgress = 0;
      chef.heldItem = null;
      station.bounce = 0.85;
      audio?.playPlace();
      if (station.item.kind === 'ingredient' && INGREDIENTS[station.item.id]?.choppable) {
        advanceChopping(station, chef, 0, fx, audio, CHEF_CONFIG.tapChopBoost, mods?.chopSpeedMult ?? 1);
      }
      return true;
    }
    if (station.item && !held) {
      if (station.item.kind === 'ingredient' && INGREDIENTS[station.item.id]?.choppable) {
        return advanceChopping(station, chef, 0, fx, audio, CHEF_CONFIG.tapChopBoost, mods?.chopSpeedMult ?? 1);
      }
      chef.heldItem = station.item;
      station.item = null;
      station.chopProgress = 0;
      audio?.playPickup();
      return true;
    }
    if (station.item && held) {
      const combined = tryCombineItems(station.item, held);
      if (combined) {
        if (held.kind === 'plate') {
          chef.heldItem = combined;
          station.item = null;
        } else {
          station.item = combined;
          chef.heldItem = null;
        }
        station.bounce = 1.0;
        audio?.playPlateClink();
        return true;
      }
    }
    return false;
  }

  if (
    station.type === STATION_TYPES.POT ||
    station.type === STATION_TYPES.SKILLET ||
    station.type === STATION_TYPES.OVEN
  ) {
    if (!station.cook && held) {
      if (station.type === STATION_TYPES.POT && held.kind === 'ingredient' && INGREDIENTS[held.id]?.potCookable) {
        startCookingOnStation(station, held.id, null, mods);
        chef.heldItem = null;
        audio?.playCookStart('pot');
        fx?.spawnSteam(pos.x, pos.y - 16, false);
        return true;
      }
      if (station.type === STATION_TYPES.SKILLET && held.kind === 'ingredient' && INGREDIENTS[held.id]?.skilletCookable) {
        startCookingOnStation(station, held.id, null, mods);
        chef.heldItem = null;
        audio?.playCookStart('skillet');
        fx?.spawnSizzleSpark(pos.x, pos.y - 8, true);
        return true;
      }
      if (station.type === STATION_TYPES.OVEN) {
        if (held.kind === 'ingredient' && held.id === 'dough') {
          startCookingOnStation(station, 'dough', null, mods);
          chef.heldItem = null;
          audio?.playCookStart('oven');
          fx?.spawnEmber(pos.x, pos.y + 6);
          return true;
        }
        if (held.kind === 'raw_pie') {
          const bakeResult = resolveRawPieBakeResult(held.parts);
          if (bakeResult) {
            startCookingOnStation(station, 'raw_pie', bakeResult, mods);
            chef.heldItem = null;
            audio?.playCookStart('oven');
            fx?.spawnEmber(pos.x, pos.y + 6);
            return true;
          }
          fx?.spawnPopup(pos.x, pos.y - 32, 'Add topping first!', '#ffba73', 12.5);
          audio?.playErrorBuzz();
          return false;
        }
      }
      return false;
    }

    if (station.cook && station.cook.state !== 'cooking') {
      const previewId = station.cook.state === 'burnt' ? 'burnt' : station.cook.outputId;
      if (!held) {
        const extracted = extractCookedItem(station);
        chef.heldItem = extracted;
        if (extracted?.perfect) {
          fx?.spawnGoldBurst(pos.x, pos.y - 18, 14);
          fx?.spawnPopup(pos.x, pos.y - 36, 'CHEF PERFECT ★', '#ffd954', 13.5);
        }
        audio?.playPickup();
        return true;
      }
      if (held.kind === 'plate') {
        if (previewId === 'burnt') return false;
        if (canAddToPlate(held, previewId)) {
          const extracted = extractCookedItem(station);
          const partId = extracted.kind === 'plate' ? extracted.parts[0] : extracted.id;
          chef.heldItem = createPlate(
            [...held.parts, partId],
            held.perfect || extracted.perfect,
          );
          audio?.playPlateClink();
          if (extracted.perfect) {
            fx?.spawnGoldBurst(pos.x, pos.y - 18, 14);
          }
          return true;
        }
      }
    }
    return false;
  }

  if (station.type === STATION_TYPES.COUNTER || station.type === STATION_TYPES.PASS_HOLD) {
    if (!station.item && held) {
      station.item = held;
      chef.heldItem = null;
      station.bounce = 0.8;
      audio?.playPlace();
      return true;
    }
    if (station.item && !held) {
      chef.heldItem = station.item;
      station.item = null;
      station.bounce = 0.7;
      audio?.playPickup();
      return true;
    }
    if (station.item && held) {
      const combined = tryCombineItems(station.item, held);
      if (combined) {
        if (held.kind === 'plate' && station.item.kind !== 'plate') {
          chef.heldItem = combined;
          station.item = null;
        } else {
          station.item = combined;
          chef.heldItem = null;
        }
        station.bounce = 1.0;
        audio?.playPlateClink();
        if (combined.kind === 'plate' && combined.dishId) {
          fx?.spawnGoldBurst(pos.x, pos.y - 18, 12);
          fx?.spawnPopup(pos.x, pos.y - 34, `${RECIPES[combined.dishId].shortName} READY!`, '#80f5a8', 13.5);
        }
        return true;
      }
      const prev = station.item;
      station.item = held;
      chef.heldItem = prev;
      station.bounce = 0.8;
      audio?.playPlace();
      return true;
    }
  }

  return false;
}

export function getSuggestedStationTypes(heldItem) {
  const hints = new Set();
  if (!heldItem) return hints;

  if (heldItem.kind === 'ingredient') {
    const info = INGREDIENTS[heldItem.id];
    if (info?.id === 'burnt') {
      hints.add(STATION_TYPES.COMPOST);
      return hints;
    }
    if (info?.choppable) hints.add(STATION_TYPES.CHOP);
    if (info?.potCookable) hints.add(STATION_TYPES.POT);
    if (info?.skilletCookable) hints.add(STATION_TYPES.SKILLET);
    if (info?.ovenCookable) hints.add(STATION_TYPES.OVEN);
    if (info?.plateable) {
      hints.add(STATION_TYPES.PLATE_STACK);
      hints.add(STATION_TYPES.COUNTER);
    }
    if (info?.doughBase || info?.doughCombinable) hints.add(STATION_TYPES.COUNTER);
    return hints;
  }

  if (heldItem.kind === 'raw_pie') {
    const prog = findRawPieProgress(heldItem);
    if (prog?.readyForOven) hints.add(STATION_TYPES.OVEN);
    else hints.add(STATION_TYPES.COUNTER);
    return hints;
  }

  if (heldItem.kind === 'plate') {
    if (heldItem.dishId) {
      hints.add(STATION_TYPES.SERVE_BELL);
      hints.add(STATION_TYPES.PASS_HOLD);
    } else {
      hints.add(STATION_TYPES.COUNTER);
      hints.add(STATION_TYPES.POT);
      hints.add(STATION_TYPES.SKILLET);
      hints.add(STATION_TYPES.OVEN);
    }
  }
  return hints;
}

export function getActionPromptForStation(station, heldItem) {
  if (!station) return '';
  if (station.type === STATION_TYPES.PANTRY) {
    return heldItem ? station.label : `Grab ${INGREDIENTS[station.ingredient].name}`;
  }
  if (station.type === STATION_TYPES.PLATE_STACK) {
    if (heldItem?.kind === 'ingredient' && INGREDIENTS[heldItem.id]?.plateable) {
      return `Plate ${INGREDIENTS[heldItem.id].short}`;
    }
    return 'Take Porcelain Plate';
  }
  if (station.type === STATION_TYPES.SERVE_BELL) {
    if (heldItem?.kind === 'plate' && heldItem.dishId) {
      return `SERVE ${RECIPES[heldItem.dishId].shortName}!`;
    }
    return 'Service Bell (Serve Ready Plate)';
  }
  if (station.type === STATION_TYPES.CHOP) {
    if (station.item?.kind === 'ingredient' && INGREDIENTS[station.item.id]?.choppable) {
      return `Chop ${INGREDIENTS[station.item.id].short}`;
    }
    if (heldItem?.kind === 'ingredient' && INGREDIENTS[heldItem.id]?.choppable) {
      return `Chop ${INGREDIENTS[heldItem.id].short}`;
    }
    return station.item ? 'Pick Up / Combine' : 'Chopping Board';
  }
  if (station.type === STATION_TYPES.POT || station.type === STATION_TYPES.SKILLET || station.type === STATION_TYPES.OVEN) {
    if (station.cook) {
      const temp = getLiveTemperatureC(station.cook);
      if (station.cook.state === 'cooking') return `${temp}°C · Cooking ${INGREDIENTS[station.cook.outputId]?.short ?? ''}`;
      if (station.cook.state === 'sweet') return `${temp}°C · Pull Perfect ${INGREDIENTS[station.cook.outputId]?.short} ★`;
      if (station.cook.state === 'burnt') return 'Remove Burnt Ruin';
      return `Take ${INGREDIENTS[station.cook.outputId]?.short}`;
    }
    if (station.type === STATION_TYPES.POT) return 'Boil Pasta / Simmer Tomato or Saffron';
    if (station.type === STATION_TYPES.SKILLET) return 'Sear Ribeye, Salmon or Porcini';
    return '420°C Stone Oven · Bake Flatbread';
  }
  if (station.type === STATION_TYPES.COMPOST) return 'Compost / Rinse Plate';
  if (station.type === STATION_TYPES.PASS_HOLD) return 'Warm Service Pass';
  return station.item ? 'Pick Up / Combine' : 'Assembly Counter';
}
