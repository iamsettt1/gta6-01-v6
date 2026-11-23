// Puerto Brisa 3D — synthesized audio: engine hum, gunshots, cash
// register, sirens. Everything is generated with WebAudio, there are
// no audio files, and every entry point is guarded — a browser that
// refuses audio (or a headless screenshot run) simply plays silent.

function ac(S) {
  try {
    if (S.audio.enabled === false) return null;
    if (!S.audio.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      S.audio.ctx = new AC();
      S.audio.master = S.audio.ctx.createGain();
      S.audio.master.gain.value = 0.5;
      S.audio.master.connect(S.audio.ctx.destination);
    }
    if (S.audio.ctx.state === 'suspended') S.audio.ctx.resume();
    return S.audio.ctx;
  } catch (err) {
    return null;
  }
}

// Called on the first key press — browsers only allow audio after a
// user gesture.
export function unlockAudio(S) {
  ac(S);
}

function blip(S, freq, dur, type, gain, slideTo) {
  const ctx = ac(S);
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
    g.gain.setValueAtTime(gain || 0.15, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(g);
    g.connect(S.audio.master);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  } catch (err) { /* silent */ }
}

export function shotSound(S, weapon) {
  blip(S, weapon === 'rifle' ? 150 : 190, 0.09, 'square', 0.2, 55);
  blip(S, 900, 0.03, 'sawtooth', 0.06, 200);
}

export function cashSound(S) {
  blip(S, 880, 0.09, 'sine', 0.16);
  setTimeout(() => blip(S, 1318, 0.14, 'sine', 0.16), 70);
}

export function thudSound(S) {
  blip(S, 70, 0.16, 'sine', 0.3, 40);
}

export function chimeSound(S) {
  blip(S, 660, 0.1, 'triangle', 0.14);
  setTimeout(() => blip(S, 990, 0.16, 'triangle', 0.14), 80);
}

function startEngine(S, ctx) {
  try {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = 52;
    g.gain.value = 0.0;
    osc.connect(g);
    g.connect(S.audio.master);
    osc.start();
    S.audio.engine = { osc, gain: g };
  } catch (err) { /* silent */ }
}

function startSiren(S, ctx) {
  try {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = 720;
    lfo.frequency.value = 0.6;
    lfoGain.gain.value = 130;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    g.gain.value = 0.0;
    osc.connect(g);
    g.connect(S.audio.master);
    osc.start();
    lfo.start();
    S.audio.siren = { osc, gain: g, lfo };
  } catch (err) { /* silent */ }
}

function stopNode(S, key) {
  const node = S.audio[key];
  if (!node) return;
  try {
    node.gain.gain.setTargetAtTime(0, S.audio.ctx.currentTime, 0.08);
    const osc = node.osc, lfo = node.lfo;
    setTimeout(() => { try { osc.stop(); if (lfo) lfo.stop(); } catch (err) { /* gone */ } }, 300);
  } catch (err) { /* silent */ }
  S.audio[key] = null;
}

// Per-frame: engine pitch follows speed, the siren follows the heat
// and how close the nearest unit is.
export function updateAudio(S, dt, stars, nearestCopDist) {
  const ctx = S.audio.ctx;
  if (!ctx || S.audio.enabled === false) return;
  try {
    const p = S.player;
    if (p.inVehicle && !p.dead) {
      if (!S.audio.engine) startEngine(S, ctx);
      if (S.audio.engine) {
        const ratio = Math.min(1, Math.abs(p.inVehicle.speed) / 520);
        S.audio.engine.osc.frequency.setTargetAtTime(52 + ratio * 150, ctx.currentTime, 0.05);
        S.audio.engine.gain.gain.setTargetAtTime(0.028 + ratio * 0.05, ctx.currentTime, 0.08);
      }
    } else if (S.audio.engine) {
      stopNode(S, 'engine');
    }
    if (stars > 0 && nearestCopDist < 1500) {
      if (!S.audio.siren) startSiren(S, ctx);
      if (S.audio.siren) {
        const vol = 0.012 + 0.03 * (1 - Math.min(1, nearestCopDist / 1500));
        S.audio.siren.gain.gain.setTargetAtTime(vol, ctx.currentTime, 0.1);
      }
    } else if (S.audio.siren) {
      stopNode(S, 'siren');
    }
  } catch (err) { /* silent */ }
}
