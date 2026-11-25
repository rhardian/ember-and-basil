// 8 fresh ingredients, prep/cook transformations, 12 combinatorial artisan bistro recipes, and smart plate matching.

export const INGREDIENTS = {
  tomato: {
    id: 'tomato',
    name: 'Heirloom Tomato',
    short: 'Tomato',
    color: '#d93829',
    choppable: true,
    chopResult: 'chopped_tomato',
    stepHint: 'Chop on maple cutting board',
  },
  chopped_tomato: {
    id: 'chopped_tomato',
    name: 'Diced Tomato',
    short: 'Diced Tom.',
    color: '#e64733',
    potCookable: true,
    potResult: 'pomodoro_sauce',
    plateable: true,
    stepHint: 'Simmer in Pot for Pomodoro, or plate Bruschetta',
  },
  pomodoro_sauce: {
    id: 'pomodoro_sauce',
    name: 'Pomodoro Ragu',
    short: 'Pomodoro',
    color: '#c22b1f',
    plateable: true,
    doughCombinable: true,
    stepHint: 'Plate with Pasta, or spread on Dough',
  },
  basil: {
    id: 'basil',
    name: 'Sweet Basil',
    short: 'Basil',
    color: '#3f9645',
    choppable: true,
    chopResult: 'chopped_basil',
    stepHint: 'Chop on maple cutting board',
  },
  chopped_basil: {
    id: 'chopped_basil',
    name: 'Minced Basil',
    short: 'Fresh Basil',
    color: '#4db350',
    plateable: true,
    doughCombinable: true,
    stepHint: 'Garnish plate, or top Dough before oven',
  },
  mushroom: {
    id: 'mushroom',
    name: 'Wild Porcini',
    short: 'Porcini',
    color: '#9c6e4b',
    choppable: true,
    chopResult: 'chopped_mushroom',
    stepHint: 'Slice on maple cutting board',
  },
  chopped_mushroom: {
    id: 'chopped_mushroom',
    name: 'Sliced Porcini',
    short: 'Sliced Mush.',
    color: '#b6865e',
    skilletCookable: true,
    skilletResult: 'sauteed_mushroom',
    doughCombinable: true,
    stepHint: 'Saute in Skillet, or top Funghi Dough',
  },
  sauteed_mushroom: {
    id: 'sauteed_mushroom',
    name: 'Sauteed Porcini',
    short: 'Sauteed Mush.',
    color: '#7a4c2a',
    plateable: true,
    stepHint: 'Plate with Pasta or Seared Ribeye',
  },
  steak: {
    id: 'steak',
    name: 'Marbled Ribeye',
    short: 'Raw Ribeye',
    color: '#b83c3b',
    skilletCookable: true,
    skilletResult: 'seared_steak',
    stepHint: 'Sear on 240°C Cast-Iron Skillet',
  },
  seared_steak: {
    id: 'seared_steak',
    name: 'Seared Ribeye',
    short: 'Seared Steak',
    color: '#6e3222',
    plateable: true,
    stepHint: 'Plate for Ribeye, Tasting Plate or Surf & Turf',
  },
  salmon: {
    id: 'salmon',
    name: 'Wild Salmon Fillet',
    short: 'Raw Salmon',
    color: '#f07c56',
    skilletCookable: true,
    skilletResult: 'seared_salmon',
    stepHint: 'Pan-sear on 225°C Cast-Iron Skillet',
  },
  seared_salmon: {
    id: 'seared_salmon',
    name: 'Crispy Citrus Salmon',
    short: 'Seared Salmon',
    color: '#e8683a',
    plateable: true,
    stepHint: 'Plate with Saffron Glaze, Pasta or Surf & Turf',
  },
  saffron: {
    id: 'saffron',
    name: 'Saffron & Lemon',
    short: 'Saffron',
    color: '#f2b824',
    potCookable: true,
    potResult: 'saffron_glaze',
    stepHint: 'Infuse in Copper Pot for Saffron Citrus Glaze',
  },
  saffron_glaze: {
    id: 'saffron_glaze',
    name: 'Saffron Citrus Glaze',
    short: 'Saffron Glaze',
    color: '#f5be32',
    plateable: true,
    stepHint: 'Glaze Salmon, Pasta, Crostini or Surf & Turf',
  },
  pasta: {
    id: 'pasta',
    name: 'Fresh Tagliatelle',
    short: 'Raw Pasta',
    color: '#e8c468',
    potCookable: true,
    potResult: 'boiled_pasta',
    stepHint: 'Boil in Copper Stockpot',
  },
  boiled_pasta: {
    id: 'boiled_pasta',
    name: 'Al-Dente Pasta',
    short: 'Boiled Pasta',
    color: '#f2cf6c',
    plateable: true,
    stepHint: 'Combine with Pomodoro, Saffron, Porcini or Salmon',
  },
  dough: {
    id: 'dough',
    name: 'Artisan Dough',
    short: 'Dough',
    color: '#efe1c2',
    ovenCookable: true,
    ovenResult: 'toasted_bread',
    doughBase: true,
    stepHint: 'Toast in 420°C Oven, or top with Pomodoro',
  },
  toasted_bread: {
    id: 'toasted_bread',
    name: 'Hearth Crostini',
    short: 'Crostini',
    color: '#d2954e',
    plateable: true,
    stepHint: 'Plate for Bruschetta or Saffron Crostini',
  },
  baked_margherita: {
    id: 'baked_margherita',
    name: 'Hearth Margherita',
    short: 'Margherita',
    color: '#d9532f',
    plateable: true,
    stepHint: 'Serve at the Brass Pass!',
  },
  baked_funghi: {
    id: 'baked_funghi',
    name: 'Wood-Fired Funghi',
    short: 'Funghi Pie',
    color: '#b8683a',
    plateable: true,
    stepHint: 'Serve at the Brass Pass!',
  },
  burnt: {
    id: 'burnt',
    name: 'Charred Ruin',
    short: 'Burnt',
    color: '#2a2422',
    stepHint: 'Toss in Compost Bin or press Q',
  },
};

export const RECIPES = {
  bruschetta: {
    id: 'bruschetta',
    name: 'Caprese Bruschetta',
    shortName: 'Bruschetta',
    price: 26,
    patienceSec: 54,
    components: ['toasted_bread', 'chopped_tomato', 'chopped_basil'],
    ovenRecipe: false,
    stepsText: 'Toast Dough + Diced Tomato + Basil',
    accent: '#d94d32',
  },
  saffron_crostini: {
    id: 'saffron_crostini',
    name: 'Saffron Lemon Crostini',
    shortName: 'Saffron Toast',
    price: 30,
    patienceSec: 56,
    components: ['toasted_bread', 'saffron_glaze', 'chopped_basil'],
    ovenRecipe: false,
    stepsText: 'Toast Dough + Saffron Glaze + Basil',
    accent: '#c98e1e',
  },
  pomodoro_pasta: {
    id: 'pomodoro_pasta',
    name: 'Pomodoro Tagliatelle',
    shortName: 'Pomodoro Pasta',
    price: 34,
    patienceSec: 64,
    components: ['boiled_pasta', 'pomodoro_sauce', 'chopped_basil'],
    ovenRecipe: false,
    stepsText: 'Boil Pasta + Simmer Pomodoro + Basil',
    accent: '#cc3726',
  },
  saffron_pasta: {
    id: 'saffron_pasta',
    name: 'Amalfi Saffron Pasta',
    shortName: 'Saffron Pasta',
    price: 38,
    patienceSec: 64,
    components: ['boiled_pasta', 'saffron_glaze', 'chopped_basil'],
    ovenRecipe: false,
    stepsText: 'Boil Pasta + Infuse Saffron + Basil',
    accent: '#d49a1e',
  },
  porcini_pasta: {
    id: 'porcini_pasta',
    name: 'Truffle Porcini Pasta',
    shortName: 'Porcini Pasta',
    price: 40,
    patienceSec: 66,
    components: ['boiled_pasta', 'sauteed_mushroom', 'chopped_basil'],
    ovenRecipe: false,
    stepsText: 'Boil Pasta + Saute Porcini + Basil',
    accent: '#8f5b34',
  },
  margherita: {
    id: 'margherita',
    name: 'Hearth Margherita',
    shortName: 'Margherita',
    price: 36,
    patienceSec: 68,
    components: ['baked_margherita'],
    rawPieParts: ['dough', 'pomodoro_sauce', 'chopped_basil'],
    displaySteps: ['dough', 'pomodoro_sauce', 'chopped_basil'],
    ovenRecipe: true,
    stepsText: 'Dough + Pomodoro + Basil -> 420°C Oven',
    accent: '#d8572a',
  },
  funghi_flatbread: {
    id: 'funghi_flatbread',
    name: 'Wood-Fired Funghi',
    shortName: 'Funghi Pie',
    price: 42,
    patienceSec: 70,
    components: ['baked_funghi'],
    rawPieParts: ['dough', 'pomodoro_sauce', 'chopped_mushroom'],
    displaySteps: ['dough', 'pomodoro_sauce', 'chopped_mushroom'],
    ovenRecipe: true,
    stepsText: 'Dough + Pomodoro + Porcini -> 420°C Oven',
    accent: '#a35d35',
  },
  citrus_salmon: {
    id: 'citrus_salmon',
    name: 'Amalfi Citrus Salmon',
    shortName: 'Citrus Salmon',
    price: 48,
    patienceSec: 66,
    components: ['seared_salmon', 'saffron_glaze', 'chopped_basil'],
    ovenRecipe: false,
    stepsText: 'Sear Salmon + Saffron Glaze + Basil',
    accent: '#d46237',
  },
  salmon_pasta: {
    id: 'salmon_pasta',
    name: 'Saffron Salmon Pasta',
    shortName: 'Salmon Pasta',
    price: 52,
    patienceSec: 70,
    components: ['seared_salmon', 'boiled_pasta', 'saffron_glaze'],
    ovenRecipe: false,
    stepsText: 'Sear Salmon + Boil Pasta + Saffron Glaze',
    accent: '#c45a2d',
  },
  seared_ribeye: {
    id: 'seared_ribeye',
    name: 'Seared Ribeye & Herb',
    shortName: 'Seared Ribeye',
    price: 48,
    patienceSec: 68,
    components: ['seared_steak', 'sauteed_mushroom', 'chopped_basil'],
    ovenRecipe: false,
    stepsText: 'Sear Ribeye + Saute Porcini + Basil',
    accent: '#8e2f24',
  },
  chefs_tasting: {
    id: 'chefs_tasting',
    name: "Chef's Tasting Plate",
    shortName: 'Tasting Plate',
    price: 64,
    patienceSec: 78,
    components: ['seared_steak', 'boiled_pasta', 'pomodoro_sauce', 'chopped_basil'],
    ovenRecipe: false,
    stepsText: 'Ribeye + Pasta + Pomodoro + Basil',
    accent: '#b87d1a',
  },
  surf_and_turf: {
    id: 'surf_and_turf',
    name: 'Grand Surf & Turf',
    shortName: 'Surf & Turf',
    price: 74,
    patienceSec: 82,
    components: ['seared_steak', 'seared_salmon', 'saffron_glaze', 'chopped_basil'],
    ovenRecipe: false,
    stepsText: 'Ribeye + Salmon + Saffron Glaze + Basil',
    accent: '#a33c26',
  },
};

export const RECIPE_LIST = Object.values(RECIPES);

export function createIngredientItem(ingredientId, perfect = false) {
  return { kind: 'ingredient', id: ingredientId, perfect };
}

export function createRawPie(parts, perfect = false) {
  return { kind: 'raw_pie', parts: [...new Set(parts)], perfect };
}

export function createPlate(parts = [], perfect = false) {
  return {
    kind: 'plate',
    parts: [...new Set(parts)],
    perfect,
    dishId: resolveCompleteDish(parts),
  };
}

export function resolveCompleteDish(parts) {
  if (!parts || parts.length === 0) return null;
  const set = new Set(parts);
  for (const recipe of RECIPE_LIST) {
    if (
      recipe.components.length === set.size &&
      recipe.components.every((c) => set.has(c))
    ) {
      return recipe.id;
    }
  }
  return null;
}

export function resolveRawPieBakeResult(parts) {
  const set = new Set(parts);
  for (const recipe of RECIPE_LIST) {
    if (!recipe.ovenRecipe || !recipe.rawPieParts) continue;
    if (
      recipe.rawPieParts.length === set.size &&
      recipe.rawPieParts.every((c) => set.has(c))
    ) {
      return recipe.components[0];
    }
  }
  return null;
}

export function canAddToPlate(plate, ingredientId) {
  if (!plate || plate.kind !== 'plate') return false;
  if (!INGREDIENTS[ingredientId]?.plateable) return false;
  if (plate.parts.includes(ingredientId)) return false;

  const nextParts = [...plate.parts, ingredientId];
  return RECIPE_LIST.some((recipe) =>
    nextParts.every((part) => recipe.components.includes(part)),
  );
}

export function canCombineRawPie(partsA, partB) {
  if (partsA.includes(partB)) return false;
  const nextParts = [...partsA, partB];
  return RECIPE_LIST.some(
    (recipe) =>
      recipe.ovenRecipe &&
      recipe.rawPieParts &&
      nextParts.every((p) => recipe.rawPieParts.includes(p)),
  );
}

export function findClosestRecipesForPlate(plate) {
  if (!plate || plate.kind !== 'plate' || plate.parts.length === 0) return [];
  const matches = [];
  for (const recipe of RECIPE_LIST) {
    if (plate.parts.every((p) => recipe.components.includes(p))) {
      const missing = recipe.components.filter((c) => !plate.parts.includes(c));
      matches.push({
        recipe,
        matched: plate.parts.length,
        total: recipe.components.length,
        missing,
      });
    }
  }
  matches.sort((a, b) => a.missing.length - b.missing.length || b.recipe.price - a.recipe.price);
  return matches;
}

export function findRawPieProgress(rawPie) {
  if (!rawPie || rawPie.kind !== 'raw_pie') return null;
  for (const recipe of RECIPE_LIST) {
    if (!recipe.ovenRecipe || !recipe.rawPieParts) continue;
    if (rawPie.parts.every((p) => recipe.rawPieParts.includes(p))) {
      const missing = recipe.rawPieParts.filter((c) => !rawPie.parts.includes(c));
      return {
        recipe,
        matched: rawPie.parts.length,
        total: recipe.rawPieParts.length,
        missing,
        readyForOven: missing.length === 0,
      };
    }
  }
  return null;
}

export function describeItem(item) {
  if (!item) return 'Empty Hands';
  if (item.kind === 'ingredient') {
    const info = INGREDIENTS[item.id];
    return `${info ? info.name : item.id}${item.perfect ? ' ★' : ''}`;
  }
  if (item.kind === 'raw_pie') {
    const prog = findRawPieProgress(item);
    if (prog?.readyForOven) return `Raw ${prog.recipe.shortName} (420°C Oven)`;
    const need = prog?.missing?.[0] ? INGREDIENTS[prog.missing[0]]?.short : 'Topping';
    return `Flatbread Dough (+ ${need})`;
  }
  if (item.kind === 'plate') {
    if (item.parts.length === 0) return 'Warm Porcelain Plate';
    if (item.dishId) {
      const recipe = RECIPES[item.dishId];
      return `${recipe.name}${item.perfect ? ' ★' : ''} (Ready!)`;
    }
    const candidates = findClosestRecipesForPlate(item);
    if (candidates.length > 0) {
      const best = candidates[0];
      const nextNeed = best.missing.map((m) => INGREDIENTS[m]?.short ?? m).join(' + ');
      return `Plating ${best.recipe.shortName} (${best.matched}/${best.total}: +${nextNeed})`;
    }
    return 'Partial Plate';
  }
  return 'Kitchen Item';
}
