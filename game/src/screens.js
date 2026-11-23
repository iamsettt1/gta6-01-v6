// Puerto Brisa 3D — the full-screen states: title, mission briefing,
// and the city map / empire screen (M). The map labels sit at
// hand-placed offsets per district so nothing collides, and the
// empire panel reads the live businesses, safehouses and bounties.

import { CFG } from './config.js';
import { empireIncomePerHour, empireComplete } from './empire-businesses.js';

function wrap(ctx, text, x, y, maxW, lineH, maxLines) {
  const words = String(text).split(/\s+/);
  let line = '', lines = 0;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y + lines * lineH);
      lines++;
      line = word;
      if (maxLines && lines >= maxLines) return;
    } else line = test;
  }
  if (line) ctx.fillText(line, x, y + lines * lineH);
}

export function drawTitleScreen(S, ctx, W, H) {
  // A translucent scrim, not a wall: the live 3D city orbits behind
  // the menu, tinted dusk-purple at the top, warm at the horizon.
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, 'rgba(43,16,85,0.55)');
  grad.addColorStop(0.45, 'rgba(117,151,222,0.32)');
  grad.addColorStop(0.72, 'rgba(255,154,90,0.25)');
  grad.addColorStop(1, 'rgba(18,58,74,0.6)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 84px system-ui, sans-serif';
  ctx.fillText('PUERTO BRISA', W / 2, 150);
  ctx.fillStyle = '#ffd34d';
  ctx.font = '800 30px system-ui, sans-serif';
  ctx.fillText('3D — STORM SURGE', W / 2, 196);
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText('Rosa Camacho takes the city from the Herrera family — eight districts, two bridges, one storm.', W / 2, 232);

  // The run so far, in one line — every field guarded so a fresh
  // profile (or a partially staged one) can never throw here.
  const prog = S.progress || {};
  let income = 0;
  try { income = empireIncomePerHour(S) || 0; } catch (e) { income = 0; }
  ctx.fillStyle = '#38e0c8';
  ctx.font = '700 14px system-ui, sans-serif';
  ctx.fillText(`RESPECT Lv ${prog.respectLevel || 0} · MISSIONS ${(prog.missionsDone || []).length}/10 · EMPIRE $${income}/h · TERRITORY ${(prog.territoryTaken || []).length}/3 · SHELLS ${prog.shellsFound || 0}/12 · $${(prog.cash || 0).toLocaleString('en-US')}`, W / 2, 264);

  ctx.font = '600 14px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(230,242,248,0.9)';
  const controls = [
    'WASD / arrows — move & drive', 'E — enter car · talk · buy',
    'F — fire · capture bounty', 'Shift — run · 1–4 — weapons',
    'M — map & empire', 'P — phone · H — heist board at a safehouse',
    'R / T — garage paint & tuning', 'Esc — close screens',
  ];
  controls.forEach((c, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    ctx.textAlign = col ? 'left' : 'right';
    ctx.fillText(c, col ? W / 2 + 24 : W / 2 - 24, 560 + row * 24);
  });
  ctx.textAlign = 'center';
  // The menu proper: what each key opens from here.
  ctx.font = '700 15px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(230,242,248,0.95)';
  const menu = [
    'ENTER — START ENGINE',
    'M — CITY MAP & EMPIRE',
    'H — HEIST BOARD',
    'P — PHONE',
  ];
  menu.forEach((m, i) => ctx.fillText(m, W / 2, 404 + i * 24));
  const pulse = 0.65 + Math.sin(S.t * 4) * 0.35;
  ctx.globalAlpha = pulse;
  ctx.fillStyle = '#ffd34d';
  ctx.font = '800 22px system-ui, sans-serif';
  ctx.fillText('PRESS ENTER', W / 2, 500);
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(230,242,248,0.55)';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText('A make.fun gta6-01 entry · The LPD recommends observing the speed limit.', W / 2, H - 18);
  ctx.textAlign = 'left';
}

export function drawBriefingScreen(S, ctx, W, H) {
  ctx.fillStyle = 'rgba(5,10,16,0.88)';
  ctx.fillRect(0, 0, W, H);
  const bw = 640, bh = 340;
  const x = (W - bw) / 2, y = (H - bh) / 2;
  ctx.fillStyle = 'rgba(12,22,34,0.97)';
  ctx.strokeStyle = '#ffd34d';
  ctx.lineWidth = 2;
  ctx.fillRect(x, y, bw, bh);
  ctx.strokeRect(x, y, bw, bh);
  const b = S.briefing || { title: 'PUERTO BRISA', giver: 'Tomás Ibarra', text: '', cash: 0 };
  ctx.fillStyle = '#9fd8ff';
  ctx.font = '700 13px system-ui, sans-serif';
  ctx.fillText(`MISSION ${S.progress.missionsDone.length + (S.mission.active ? 0 : 1)} OF 10`, x + 32, y + 40);
  ctx.fillStyle = '#ffd34d';
  ctx.font = '900 34px system-ui, sans-serif';
  ctx.fillText(b.title.toUpperCase(), x + 32, y + 82);
  ctx.fillStyle = '#38e0c8';
  ctx.font = '700 15px system-ui, sans-serif';
  ctx.fillText(b.giver, x + 32, y + 112);
  ctx.fillStyle = '#e6f2f8';
  ctx.font = '16px system-ui, sans-serif';
  wrap(ctx, b.text, x + 32, y + 148, bw - 64, 23, 5);
  ctx.fillStyle = '#ffd34d';
  ctx.font = '800 17px system-ui, sans-serif';
  ctx.fillText(`REWARD  $${(b.cash || 0).toLocaleString('en-US')}`, x + 32, y + bh - 64);
  ctx.fillStyle = 'rgba(230,242,248,0.65)';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText('ENTER — roll out · ESC — not yet', x + 32, y + bh - 30);
}

// Hand-placed label anchors (world coords) so district names never
// collide on the map.
const LABEL_AT = {
  'El Mirador': [890, 760], 'Avenida Coral': [2540, 760],
  'Puerto Brisa Marina': [1120, 2050], 'Barrio Iris': [2810, 2050],
  'Playa Brisa': [4330, 2050], 'Las Lomas': [4330, 760],
  'Zona Libre': [5900, 900], 'Isla Ancla': [5900, 2500],
};

export function drawMapScreen(S, ctx, W, H) {
  ctx.fillStyle = '#0a2436';
  ctx.fillRect(0, 0, W, H);
  // Fit the LAND, not the whole world: a third of the world south of
  // the city is open sea, and fitting to it shrank the city into the
  // top of the panel over a band of empty blue. The view is the lands'
  // bounding box with a slim water margin, centred in the space
  // between the title block and the empire strip, and every map draw
  // is clipped to that panel.
  let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
  for (const land of S.city.lands) {
    bx0 = Math.min(bx0, land.x); by0 = Math.min(by0, land.y);
    bx1 = Math.max(bx1, land.x + land.w); by1 = Math.max(by1, land.y + land.h);
  }
  bx0 -= 90; by0 -= 90; bx1 += 90; by1 += 90;
  const bw = bx1 - bx0, bh = by1 - by0;
  const top = 76, bottom = H - 70;
  const s = Math.min((W - 48) / bw, (bottom - top) / bh);
  const ox = (W - bw * s) / 2 - bx0 * s;
  const oy = top + ((bottom - top) - bh * s) / 2 - by0 * s;
  const px = (wx) => ox + wx * s;
  const py = (wy) => oy + wy * s;
  const panelX = px(bx0), panelY = py(by0), panelW = bw * s, panelH = bh * s;
  ctx.fillStyle = '#123c5c';
  ctx.fillRect(panelX, panelY, panelW, panelH);
  ctx.save();
  ctx.beginPath();
  ctx.rect(panelX, panelY, panelW, panelH);
  ctx.clip();
  for (const land of S.city.lands) {
    ctx.fillStyle = '#c9a86a';
    ctx.fillRect(px(land.x), py(land.y), land.w * s, land.h * s);
  }
  ctx.fillStyle = '#2f7fc4';
  for (const wrect of S.city.waters) ctx.fillRect(px(wrect.x), py(wrect.y), wrect.w * s, wrect.h * s);
  ctx.fillStyle = '#8b93a0';
  for (const b of S.city.bridges) ctx.fillRect(px(b.x), py(b.y), b.w * s, Math.max(2, b.h * s));
  ctx.fillStyle = 'rgba(50,50,56,0.5)';
  for (const r of S.city.roads) ctx.fillRect(px(r.x), py(r.y), Math.max(1.5, r.w * s), Math.max(1.5, r.h * s));

  ctx.textAlign = 'center';
  for (const d of S.city.districts) {
    const [lx, ly] = LABEL_AT[d.name] || [d.x + d.w / 2, d.y + d.h / 2];
    ctx.fillStyle = 'rgba(10,20,30,0.85)';
    ctx.font = '800 13px system-ui, sans-serif';
    ctx.fillText(d.name.toUpperCase(), px(lx), py(ly));
  }
  ctx.textAlign = 'left';

  // District label centres in screen space, for tag collision checks.
  ctx.font = '800 13px system-ui, sans-serif';
  const districtPts = S.city.districts.map((d) => {
    const [lx, ly] = LABEL_AT[d.name] || [d.x + d.w / 2, d.y + d.h / 2];
    return { x: px(lx), y: py(ly), half: ctx.measureText(d.name.toUpperCase()).width / 2 };
  });
  const tag = (x, y, text, color) => {
    const sx = px(x), sy = py(y);
    ctx.font = '800 11px system-ui, sans-serif';
    const tw = ctx.measureText(text).width;
    // A tag that would print across a district name drops below its
    // dot instead; every tag gets a dark backing so it stays legible
    // over roads, land and water alike.
    const clash = districtPts.some((d) =>
      Math.abs(sy - d.y) < 15 && Math.abs(sx + 6 + tw / 2 - d.x) < d.half + tw / 2 + 4);
    const tx = sx + 6, ty = clash ? sy + 17 : sy + 3;
    ctx.fillStyle = 'rgba(6,12,20,0.72)';
    ctx.fillRect(tx - 3, ty - 9, tw + 6, 13);
    ctx.fillStyle = color;
    ctx.fillText(text, tx, ty);
    ctx.beginPath();
    ctx.arc(sx, sy, 3.5, 0, Math.PI * 2);
    ctx.fill();
  };
  for (const biz of S.businesses) {
    tag(biz.x, biz.y, biz.owned ? `${biz.name} — OWNED` : `${biz.name} $${(biz.price / 1000).toFixed(0)}k`, biz.owned ? '#ffd34d' : '#38e0c8');
  }
  for (const sh of S.safehouses) {
    tag(sh.x, sh.y, sh.owned ? sh.name : `${sh.name} $${(sh.price / 1000).toFixed(0)}k`, '#9fd8ff');
  }
  for (const b of S.bounties) {
    if (!b.caught && b.ped && !b.ped.dead) tag(b.ped.x, b.ped.y, `${b.name} $${(b.reward / 1000).toFixed(1)}k`, '#ff5d47');
  }
  if (S.mission.active && S.mission.target) {
    ctx.strokeStyle = '#ffd34d';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px(S.mission.target.x), py(S.mission.target.y), 9 + Math.sin(S.t * 5) * 2, 0, Math.PI * 2);
    ctx.stroke();
  }
  const p = S.player;
  ctx.save();
  ctx.translate(px(p.inVehicle ? p.inVehicle.x : p.x), py(p.inVehicle ? p.inVehicle.y : p.y));
  ctx.rotate((p.inVehicle ? p.inVehicle.angle : p.angle) + Math.PI / 2);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(-5, 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore(); // the map panel clip

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 26px system-ui, sans-serif';
  ctx.fillText('PUERTO BRISA', 24, 36);
  ctx.fillStyle = '#9fd8ff';
  ctx.font = '600 13px system-ui, sans-serif';
  ctx.fillText('City map & empire', 24, 60);

  // Empire strip along the bottom.
  const by = H - 58;
  ctx.fillStyle = 'rgba(8,14,22,0.85)';
  ctx.fillRect(0, by, W, 58);
  ctx.font = '700 13px system-ui, sans-serif';
  const owned = S.businesses.filter((b) => b.owned).length;
  const cols = [
    `EMPIRE ${owned}/4${empireComplete(S) ? ' — COMPLETE' : ''}`,
    `INCOME $${empireIncomePerHour(S)}/h`,
    `TERRITORY ${S.progress.territoryTaken.length}/3`,
    `SHELLS ${S.progress.shellsFound}/12`,
    `BOUNTIES ${S.progress.bountiesCaught.length}/4`,
    `MISSIONS ${S.progress.missionsDone.length}/10`,
    `CASH $${S.progress.cash.toLocaleString('en-US')}`,
  ];
  cols.forEach((c, i) => {
    ctx.fillStyle = i === cols.length - 1 ? '#ffd34d' : '#e6f2f8';
    ctx.fillText(c, 24 + i * 178, by + 35);
  });
}
