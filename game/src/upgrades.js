// Between-shift bistro kitchen upgrades: knife speed, copper induction, heated pass, and sommelier tips.

export const BISTRO_UPGRADES = [
  {
    id: 'damascus_knife',
    name: 'Damascus Santoku',
    cost: 90,
    icon: 'knife',
    effectText: 'Chop ingredients 40% faster on every board',
    modifier: { chopSpeedMult: 1.4 },
  },
  {
    id: 'hammered_copper',
    name: 'Hammered Copper Line',
    cost: 120,
    icon: 'copper',
    effectText: 'Pots & Skillets cook 25% faster with wider ★ sweet-spot',
    modifier: { cookSpeedMult: 1.25, sweetSpotBonusSec: 1.2 },
  },
  {
    id: 'heated_brass_pass',
    name: 'Heated Brass Pass',
    cost: 110,
    icon: 'pass',
    effectText: 'Order tickets gain +18% patience under warm lamps',
    modifier: { patienceMult: 1.18 },
  },
  {
    id: 'sommelier_pairing',
    name: 'Sommelier Reserve',
    cost: 140,
    icon: 'wine',
    effectText: '+30% extra tips on VIP Critic & Chef Perfect ★ dishes',
    modifier: { tipBonusMult: 1.3 },
  },
  {
    id: 'double_hearth_peel',
    name: 'Artisan Brick Peel',
    cost: 130,
    icon: 'oven',
    effectText: 'Wood-Fired Stone Oven bakes 30% faster & resists burn',
    modifier: { ovenSpeedMult: 1.3 },
  },
  {
    id: 'brigade_boots',
    name: 'Brigade Sprint Boots',
    cost: 100,
    icon: 'boots',
    effectText: 'Both Chefs move 18% faster with rapid Dash recharge',
    modifier: { moveSpeedMult: 1.18, dashCooldownMult: 0.72 },
  },
];

export function createUpgradeState() {
  return {
    bank: 0,
    owned: new Set(),
  };
}

export function purchaseKitchenUpgrade(upgradeState, upgradeId) {
  const item = BISTRO_UPGRADES.find((u) => u.id === upgradeId);
  if (!item) return false;
  if (upgradeState.owned.has(upgradeId)) return false;
  if (upgradeState.bank < item.cost) return false;
  upgradeState.bank -= item.cost;
  upgradeState.owned.add(upgradeId);
  return true;
}

export function getUpgradeModifiers(upgradeState) {
  const mods = {
    chopSpeedMult: 1,
    cookSpeedMult: 1,
    sweetSpotBonusSec: 0,
    patienceMult: 1,
    tipBonusMult: 1,
    ovenSpeedMult: 1,
    moveSpeedMult: 1,
    dashCooldownMult: 1,
  };
  if (!upgradeState) return mods;
  for (const u of BISTRO_UPGRADES) {
    if (!upgradeState.owned.has(u.id)) continue;
    if (u.modifier.chopSpeedMult) mods.chopSpeedMult *= u.modifier.chopSpeedMult;
    if (u.modifier.cookSpeedMult) mods.cookSpeedMult *= u.modifier.cookSpeedMult;
    if (u.modifier.sweetSpotBonusSec) mods.sweetSpotBonusSec += u.modifier.sweetSpotBonusSec;
    if (u.modifier.patienceMult) mods.patienceMult *= u.modifier.patienceMult;
    if (u.modifier.tipBonusMult) mods.tipBonusMult *= u.modifier.tipBonusMult;
    if (u.modifier.ovenSpeedMult) mods.ovenSpeedMult *= u.modifier.ovenSpeedMult;
    if (u.modifier.moveSpeedMult) mods.moveSpeedMult *= u.modifier.moveSpeedMult;
    if (u.modifier.dashCooldownMult) mods.dashCooldownMult *= u.modifier.dashCooldownMult;
  }
  return mods;
}
