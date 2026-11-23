// Puerto Brisa 3D — the HUD overlay, drawn on the 2D canvas above
// the WebGL world. It is dense on purpose, the way the top entries
// are: mission card and objective checklist top-left, big wanted
// stars and the live police response panel top-right, minimap and
// status bars bottom-left, weapon slots bottom-right, dialogue
// bottom-centre, banners across the middle.

import { CFG, clamp } from './config.js';
import { wantedStars, policePanel } from './police-pursuit.js';
import { WEAPONS, WEAPON_SLOTS } from './combat-weapons.js';
import { empireIncomePerHour } from './empire-businesses.js';
import { garageNear } from './shops-phone.js';

function panel(ctx, x, y, w, h, alpha) {
  ctx.fillStyle = `rgba(8,14,22,${alpha || 0.72})`;
  ctx.strokeStyle = 'rgba(140,220,255,0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.fill();
  ctx.stroke();
}

function wrap(ctx, text, x, y, maxW, lineH, maxLines) {
  const words = String(text).split(/\s+/);
  let line = '', lines = 0;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y + lines * lineH);
      lines++;
      line = word;
      if (lines >= (maxLines || 4)) return y + lines * lineH;
    } else line = test;
  }
  if (line) { ctx.fillText(line, x, y + lines * lineH); lines++; }
  return y + lines * lineH;
}

function drawMissionCard(S, ctx) {
  panel(ctx, 16, 16, 336, 64);
  ctx.fillStyle = '#ffd34d';
  ctx.font = '800 17px system-ui, sans-serif';
  const M = S.mission;
  if (M.active && S.briefing) {
    ctx.fillText(S.briefing.title.toUpperCase(), 28, 40);
    ctx.fillStyle = '#9fd8ff';
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.fillText(`for ${S.briefing.giver} · reward $${(S.briefing.cash || 0).toLocaleString('en-US')}`, 28, 60);
    if (M.timer > 0) {
      ctx.fillStyle = '#ff8f7a';
      ctx.font = '800 14px system-ui, sans-serif';
      const t = Math.max(0, Math.ceil(M.timer));
      ctx.fillText(`⏱ ${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`, 286, 40);
    }
  } else {
    ctx.fillText('PUERTO BRISA', 28, 40);
    ctx.fillStyle = '#9fd8ff';
    ctx.font = '600 12px system-ui, sans-serif';
    const done = S.progress.missionsDone.length;
    ctx.fillText(done >= 10 ? 'The city is yours — free roam.' : 'Find the gold marker — a job is waiting.', 28, 60);
  }
  ctx.fillStyle = '#38e0c8';
  ctx.font = '700 12px system-ui, sans-serif';
  ctx.fillText(`RESPECT Lv ${S.progress.respectLevel}`, 250, 60);
}

function drawChecklist(S, ctx) {
  const M = S.mission;
  let y = 92;
  if (M.active && M.objectives.length) {
    panel(ctx, 16, y, 336, 14 + M.objectives.length * 21);
    ctx.font = '600 13px system-ui, sans-serif';
    M.objectives.forEach((o, i) => {
      const oy = y + 22 + i * 21;
      if (o.state === 'done') {
        ctx.fillStyle = 'rgba(120,230,160,0.9)';
        ctx.fillText(`✓ ${o.text}`, 28, oy);
      } else if (o.state === 'active') {
        ctx.fillStyle = '#ffd34d';
        ctx.fillText(`▶ ${o.text}`, 28, oy);
      } else {
        ctx.fillStyle = 'rgba(230,242,248,0.45)';
        ctx.fillText(`· ${o.text}`, 28, oy);
      }
    });
    y += 22 + M.objectives.length * 21;
  }
  // Standing lines: empire and territory, always visible, compact.
  const lines = [];
  const owned = S.businesses.filter((b) => b.owned).length;
  lines.push(`EMPIRE ${owned}/4 · $${empireIncomePerHour(S)}/h`);
  lines.push(`TERRITORY ${S.progress.territoryTaken.length}/3 · SHELLS ${S.progress.shellsFound}/12`);
  if (S.race && !S.race.finished) {
    lines.push(`RACE POS ${S.race.pos}/4`);
  }
  if (S.territory) {
    lines.push(S.territory.phase === 'hold'
      ? `HOLD THE BLOCK — ${Math.ceil(S.territory.holdT)}s`
      : `TERRITORY WAVE ${S.territory.wave + 1}/3`);
  }
  if (garageNear(S)) lines.push('GARAGE — R repaint $250 · T tune $800');
  panel(ctx, 16, y, 336, 12 + lines.length * 19);
  ctx.font = '700 12px system-ui, sans-serif';
  ctx.fillStyle = '#9fd8ff';
  lines.forEach((l, i) => ctx.fillText(l, 28, y + 21 + i * 19));
}

function drawWanted(S, ctx, W) {
  const stars = wantedStars(S);
  if (stars <= 0) return;
  ctx.font = '56px system-ui, sans-serif';
  ctx.textAlign = 'right';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < stars ? '#ffd34d' : 'rgba(230,242,248,0.25)';
    ctx.fillText('★', W - 16 - (4 - i) * 52, 66);
  }
  ctx.textAlign = 'left';
  const rows = policePanel(S);
  const h = 34 + Math.max(1, rows.length) * 21;
  panel(ctx, W - 282, 84, 266, h);
  ctx.fillStyle = '#ff8f7a';
  ctx.font = '800 13px system-ui, sans-serif';
  ctx.fillText('LPD RESPONSE', W - 266, 106);
  ctx.font = '600 12px system-ui, sans-serif';
  if (!rows.length) {
    ctx.fillStyle = 'rgba(230,242,248,0.7)';
    ctx.fillText('SEARCHING…', W - 266, 128);
  }
  rows.forEach((r, i) => {
    const y = 128 + i * 21;
    ctx.fillStyle = '#e6f2f8';
    ctx.fillText(r.name, W - 266, y);
    ctx.fillStyle = '#9fd8ff';
    ctx.fillText(r.role, W - 176, y);
    ctx.fillStyle = '#ffd34d';
    ctx.textAlign = 'right';
    ctx.fillText(`${r.dist}m`, W - 28, y);
    ctx.textAlign = 'left';
  });
  // Bust meter under the panel while the net closes.
  if (S.wanted.bustT > 0.04) {
    const bw = 266;
    ctx.fillStyle = 'rgba(255,60,40,0.25)';
    ctx.fillRect(W - 282, 92 + h, bw, 12);
    ctx.fillStyle = '#ff4a33';
    ctx.fillRect(W - 282, 92 + h, bw * clamp(S.wanted.bustT / 1.6, 0, 1), 12);
    ctx.fillStyle = '#fff';
    ctx.font = '800 10px system-ui, sans-serif';
    ctx.fillText('BUSTED', W - 274, 92 + h + 10);
  }
}

function drawMinimap(S, ctx, H) {
  const size = CFG.MINIMAP;
  const x0 = 16, y0 = H - size - 104;
  const s = size / CFG.WORLD_W;
  const mapH = CFG.WORLD_H * s;
  const oy = y0 + (size - mapH) / 2;
  // High-contrast base: deep saturated blue water, darker olive land,
  // and the road grid in near-black at full opacity, so the street
  // pattern reads at a glance even in this small cell. The radar is a
  // GTA-style circle: everything below is clipped to the disc, so the
  // corners of the old square cell stay transparent over the world.
  const cx = x0 + size / 2, cy = y0 + size / 2, radius = size / 2;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#164e8a';
  ctx.fillRect(x0, y0, size, size);
  const px = (wx) => x0 + wx * s;
  const py = (wy) => oy + wy * s;
  for (const land of S.city.lands) {
    ctx.fillStyle = '#5f6c35';
    ctx.fillRect(px(land.x), py(land.y), land.w * s, land.h * s);
  }
  ctx.fillStyle = '#164e8a';
  for (const wrect of S.city.waters) {
    ctx.fillRect(px(wrect.x), py(wrect.y), wrect.w * s, wrect.h * s);
  }
  ctx.fillStyle = '#101014';
  for (const r of S.city.roads) {
    ctx.fillRect(px(r.x), py(r.y), Math.max(1.5, r.w * s), Math.max(1.5, r.h * s));
  }
  ctx.fillStyle = '#9aa2ae';
  for (const b of S.city.bridges) {
    ctx.fillRect(px(b.x), py(b.y), b.w * s, Math.max(2, b.h * s));
  }
  const dot = (x, y, color, r) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(px(x), py(y), r || 3, 0, Math.PI * 2);
    ctx.fill();
  };
  for (const biz of S.businesses) dot(biz.x, biz.y, biz.owned ? '#ffd34d' : '#38e0c8', 3);
  for (const sh of S.safehouses) if (sh.owned) dot(sh.x, sh.y, '#9fd8ff', 3);
  for (const b of S.bounties) {
    if (!b.caught && b.ped && !b.ped.dead) dot(b.ped.x, b.ped.y, '#ff5d47', 3);
  }
  for (const v of S.vehicles) {
    if (v.driver === 'police' || v.driver === 'roadblock') dot(v.x, v.y, '#5da2ff', 2.5);
  }
  const target = (S.mission.active && S.mission.target) || (S.race && !S.race.finished && S.race.target) || null;
  if (target) {
    ctx.strokeStyle = '#ffd34d';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px(target.x), py(target.y), 6 + Math.sin(S.t * 5) * 1.5, 0, Math.PI * 2);
    ctx.stroke();
  } else if (!S.mission.active) {
    // The next giver glows gold when no job is running.
    const g = S._nextGiverPos;
    if (g) {
      ctx.strokeStyle = '#ffd34d';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px(g.x), py(g.y), 6 + Math.sin(S.t * 5) * 1.5, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  if (S.taxi) {
    const t = S.taxi.stage === 'pickup' ? S.taxi : { x: S.taxi.destX, y: S.taxi.destY };
    dot(t.x, t.y, '#ffe14d', 4);
  }
  // Rosa herself: a white arrow on her heading.
  const p = S.player;
  const rx = p.inVehicle ? p.inVehicle.x : p.x;
  const ry = p.inVehicle ? p.inVehicle.y : p.y;
  const ra = p.inVehicle ? p.inVehicle.angle : p.angle;
  ctx.save();
  ctx.translate(px(rx), py(ry));
  ctx.rotate(ra + Math.PI / 2);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(0, -6); ctx.lineTo(4.5, 5); ctx.lineTo(-4.5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // Close the radar clip, then ring the disc.
  ctx.restore();
  ctx.strokeStyle = 'rgba(140,220,255,0.5)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();
  const district = S._districtName || '';
  ctx.fillStyle = 'rgba(230,242,248,0.85)';
  ctx.font = '700 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0,0,0,0.75)';
  ctx.shadowBlur = 3;
  ctx.fillText(district.toUpperCase(), cx, y0 + size + 13);
  ctx.shadowBlur = 0;
  ctx.textAlign = 'left';
}

function drawStatus(S, ctx, H) {
  const p = S.player;
  const y = H - 92;
  panel(ctx, 16, y, 300, 76);
  const bar = (label, frac, color, by) => {
    ctx.fillStyle = '#9fd8ff';
    ctx.font = '700 10px system-ui, sans-serif';
    ctx.fillText(label, 28, by + 9);
    ctx.fillStyle = 'rgba(230,242,248,0.18)';
    ctx.fillRect(84, by, 140, 10);
    ctx.fillStyle = color;
    ctx.fillRect(84, by, 140 * clamp(frac, 0, 1), 10);
  };
  bar('HEALTH', p.health / 100, p.health > 30 ? '#53d769' : '#ff4a33', y + 8);
  bar('ARMOUR', p.armour / 100, '#5da2ff', y + 26);
  ctx.fillStyle = '#ffd34d';
  ctx.font = '800 16px system-ui, sans-serif';
  ctx.fillText(`$${S.progress.cash.toLocaleString('en-US')}`, 236, y + 26);
  ctx.fillStyle = '#e6f2f8';
  ctx.font = '600 12px system-ui, sans-serif';
  if (p.inVehicle) {
    const kmh = Math.round(Math.abs(p.inVehicle.speed) / 20 * 3.6);
    ctx.fillText(`${kmh} KM/H`, 28, y + 62);
    ctx.fillStyle = '#9fd8ff';
    ctx.fillText(`HULL ${Math.max(0, Math.round(p.inVehicle.health))}%`, 120, y + 62);
  } else {
    ctx.fillText(p.weapon === 'fists' ? 'ON FOOT' : WEAPONS[p.weapon].name, 28, y + 62);
  }
  ctx.fillStyle = '#9fd8ff';
  ctx.fillText(`MISSION ${S.progress.missionsDone.length}/10`, 200, y + 62);
}

function drawWeapons(S, ctx, W, H) {
  const p = S.player;
  const bw = 62, gap = 6;
  const x0 = W - 16 - WEAPON_SLOTS.length * (bw + gap) + gap;
  const y = H - 16 - 62;
  WEAPON_SLOTS.forEach((w, i) => {
    const x = x0 + i * (bw + gap);
    const owned = p.ownedWeapons && p.ownedWeapons[w];
    panel(ctx, x, y, bw, 62, owned ? 0.8 : 0.45);
    if (p.weapon === w) {
      ctx.strokeStyle = '#ffd34d';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, bw, 62);
    }
    ctx.fillStyle = owned ? '#e6f2f8' : 'rgba(230,242,248,0.35)';
    ctx.font = '800 11px system-ui, sans-serif';
    ctx.fillText(`${i + 1} ${WEAPONS[w].name}`, x + 7, y + 18);
    ctx.font = '700 13px system-ui, sans-serif';
    ctx.fillStyle = '#ffd34d';
    ctx.fillText(w === 'fists' ? '∞' : String(owned ? (p.ammo[w] || 0) : '—'), x + 7, y + 42);
  });
}

function drawDialogue(S, ctx, W, H) {
  const d = S.dialogue;
  if (!d || d.t <= 0) return;
  const w = Math.min(640, W - 380);
  const x = (W - w) / 2;
  const y = H - 128;
  panel(ctx, x, y, w, 76, 0.85);
  ctx.fillStyle = d.color || '#ffd34d';
  ctx.font = '800 13px system-ui, sans-serif';
  ctx.fillText(d.name, x + 16, y + 22);
  ctx.fillStyle = '#e6f2f8';
  ctx.font = '14px system-ui, sans-serif';
  wrap(ctx, d.text, x + 16, y + 44, w - 32, 17, 2);
}

function drawToastAndBanner(S, ctx, W, H) {
  if (S.message && S.message.t > 0) {
    ctx.font = '700 15px system-ui, sans-serif';
    const w = ctx.measureText(S.message.text).width + 36;
    panel(ctx, (W - w) / 2, H - 176, w, 34, 0.8);
    ctx.fillStyle = '#e6f2f8';
    ctx.fillText(S.message.text, (W - w) / 2 + 18, H - 154);
  }
  const b = S.banner;
  if (b && b.t > 0) {
    const fade = clamp(b.t / 0.5, 0, 1);
    ctx.globalAlpha = Math.min(1, fade + 0.3);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd34d';
    ctx.font = '900 44px system-ui, sans-serif';
    ctx.fillText(b.title, W / 2, 210);
    ctx.fillStyle = '#e6f2f8';
    ctx.font = '600 17px system-ui, sans-serif';
    ctx.fillText(b.sub || '', W / 2, 240);
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
  }
}

export function drawHUD(S, ctx, W, H) {
  drawMissionCard(S, ctx);
  drawChecklist(S, ctx);
  drawWanted(S, ctx, W);
  drawMinimap(S, ctx, H);
  drawStatus(S, ctx, H);
  drawWeapons(S, ctx, W, H);
  drawDialogue(S, ctx, W, H);
  drawToastAndBanner(S, ctx, W, H);
  const p = S.player;
  if (p.dead) {
    ctx.fillStyle = 'rgba(80,0,0,0.45)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ff4a33';
    ctx.font = '900 64px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('WASTED', W / 2, H / 2);
    ctx.textAlign = 'left';
  }
  if (S._bustedFlash && S.t < S._bustedFlash) {
    ctx.fillStyle = 'rgba(20,40,120,0.4)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#9fd8ff';
    ctx.font = '900 64px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('BUSTED', W / 2, H / 2);
    ctx.textAlign = 'left';
  }
}
