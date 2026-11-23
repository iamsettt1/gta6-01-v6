// Puerto Brisa 3D — the empire: four buyable businesses paying
// hourly income, and three safehouses (one owned from the start).
// Standing at a business with the cash buys it; income lands on a
// timer while Rosa roams. Safehouses are where the heist board opens.

import { CFG, showMessage } from './config.js';

const BUSINESS_DEFS = [
  { id: 'club', name: 'Club Iris', kind: 'Nightclub', x: 2830, y: 1560, price: 18000, rate: 340 },
  { id: 'boatyard', name: 'Astillería Brisa', kind: 'Boatyard', x: 1500, y: 2050, price: 14000, rate: 260 },
  { id: 'taxi', name: 'Brisa Taxi Depot', kind: 'Taxi depot', x: 4280, y: 420, price: 11000, rate: 220 },
  { id: 'chop', name: 'Taller Clandestino', kind: 'Chop shop', x: 4350, y: 700, price: 16000, rate: 300 },
];

const SAFEHOUSE_DEFS = [
  { id: 'mirador', name: 'Mirador Flat', x: 700, y: 1150, price: 0, owned: true },
  { id: 'playa', name: 'Playa Brisa Beach House', x: 4400, y: 2350, price: 9000, owned: false },
  { id: 'ancla', name: 'Isla Ancla Hideout', x: 6050, y: 2050, price: 9000, owned: false },
];

export function createBusinesses(S) {
  return BUSINESS_DEFS.map((d) => ({ ...d, owned: false }));
}

export function createSafehouses() {
  return SAFEHOUSE_DEFS.map((d) => ({ ...d }));
}

export function empireIncomePerHour(S) {
  return S.businesses.filter((b) => b.owned).reduce((sum, b) => sum + b.rate, 0);
}

export function empireComplete(S) {
  return S.businesses.every((b) => b.owned);
}

function refPos(S) {
  const p = S.player;
  return p.inVehicle ? p.inVehicle : p;
}

// The buy key (E) near an unowned business: checks distance and cash.
export function tryBuyBusiness(S) {
  const ref = refPos(S);
  for (const biz of S.businesses) {
    if (biz.owned) continue;
    if (Math.hypot(ref.x - biz.x, ref.y - biz.y) > 170) continue;
    if (S.progress.cash < biz.price) {
      showMessage(S, `${biz.name} — $${biz.price.toLocaleString('en-US')}. You are short.`, 3.5);
      return true;
    }
    S.progress.cash -= biz.price;
    biz.owned = true;
    showMessage(S, `${biz.name} is yours — $${biz.rate}/hour, every hour.`, 4.5);
    if (S.hooks.onBusinessBought) S.hooks.onBusinessBought(S, biz);
    if (empireComplete(S) && S.hooks.onEmpireComplete) S.hooks.onEmpireComplete(S);
    return true;
  }
  return false;
}

export function nearestSafehouse(S, x, y, ownedOnly) {
  let best = null, bestD = Infinity;
  for (const sh of S.safehouses) {
    if (ownedOnly && !sh.owned) continue;
    const d = Math.hypot(sh.x - x, sh.y - y);
    if (d < bestD) { bestD = d; best = sh; }
  }
  return bestD <= 220 ? best : null;
}

export function tryBuySafehouse(S) {
  const ref = refPos(S);
  for (const sh of S.safehouses) {
    if (sh.owned) continue;
    if (Math.hypot(ref.x - sh.x, ref.y - sh.y) > 190) continue;
    if (S.progress.cash < sh.price) {
      showMessage(S, `${sh.name} — $${sh.price.toLocaleString('en-US')}. Not yet.`, 3.5);
      return true;
    }
    S.progress.cash -= sh.price;
    sh.owned = true;
    showMessage(S, `${sh.name} — a new door to disappear through.`, 4);
    return true;
  }
  return false;
}

// Income ticks: every INCOME_PERIOD seconds of roaming, the owned
// businesses pay their hourly rate scaled to the period.
export function updateEmpire(S, dt) {
  S.incomeT += dt;
  if (S.incomeT < CFG.INCOME_PERIOD) return;
  S.incomeT = 0;
  const perHour = empireIncomePerHour(S);
  if (perHour <= 0) return;
  const pay = Math.round(perHour * (CFG.INCOME_PERIOD / 3600));
  S.progress.cash += pay;
  showMessage(S, `Business income +$${pay}`, 2.5);
}
