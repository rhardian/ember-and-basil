// Culinary particle effects: rising steam, sizzling sear sparks, chop droplets, embers, and floating popups.

export function createParticleSystem() {
  return {
    particles: [],
    popups: [],
    shakeTime: 0,
    shakePower: 0,
  };
}

export function addShake(fx, power, duration = 0.22) {
  fx.shakePower = Math.max(fx.shakePower, power);
  fx.shakeTime = Math.max(fx.shakeTime, duration);
}

export function spawnSteam(fx, x, y, darkSmoke = false) {
  fx.particles.push({
    kind: 'steam',
    x,
    y,
    vx: (Math.random() - 0.5) * 14,
    vy: -(24 + Math.random() * 22),
    size: darkSmoke ? 10 + Math.random() * 7 : 7 + Math.random() * 6,
    life: 0,
    maxLife: darkSmoke ? 0.95 : 1.15,
    color: darkSmoke ? '#3b322e' : '#fff8ec',
    alpha: darkSmoke ? 0.55 : 0.42,
  });
}

export function spawnSizzleSpark(fx, x, y, golden = false) {
  const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.9;
  const spd = 48 + Math.random() * 62;
  fx.particles.push({
    kind: 'spark',
    x,
    y,
    vx: Math.cos(angle) * spd,
    vy: Math.sin(angle) * spd - 16,
    gravity: 210,
    size: 2.4 + Math.random() * 2.2,
    life: 0,
    maxLife: 0.34 + Math.random() * 0.2,
    color: golden ? '#ffd95e' : '#ff9b42',
    alpha: 0.95,
  });
}

export function spawnChopBits(fx, x, y, color, count = 6) {
  for (let i = 0; i < count; i++) {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
    const spd = 55 + Math.random() * 90;
    fx.particles.push({
      kind: 'bit',
      x: x + (Math.random() - 0.5) * 12,
      y: y + (Math.random() - 0.5) * 6,
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd - 20,
      gravity: 340,
      size: 3 + Math.random() * 3.2,
      rot: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 12,
      life: 0,
      maxLife: 0.42 + Math.random() * 0.22,
      color,
      alpha: 1,
    });
  }
}

export function spawnEmber(fx, x, y) {
  fx.particles.push({
    kind: 'ember',
    x,
    y,
    vx: (Math.random() - 0.5) * 22,
    vy: -(28 + Math.random() * 30),
    size: 2.5 + Math.random() * 2.5,
    life: 0,
    maxLife: 0.65 + Math.random() * 0.3,
    color: Math.random() < 0.5 ? '#ff7c2b' : '#ffd24c',
    alpha: 0.95,
  });
}

export function spawnGoldBurst(fx, x, y, count = 14) {
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.25;
    const spd = 55 + Math.random() * 95;
    fx.particles.push({
      kind: 'star',
      x,
      y,
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd - 28,
      gravity: 160,
      size: 4.5 + Math.random() * 3.5,
      rot: Math.random() * Math.PI,
      vrot: (Math.random() - 0.5) * 8,
      life: 0,
      maxLife: 0.58 + Math.random() * 0.28,
      color: i % 2 === 0 ? '#ffe066' : '#fff7d1',
      alpha: 1,
    });
  }
}

export function spawnDashDust(fx, x, y, backX, backY) {
  for (let i = 0; i < 8; i++) {
    fx.particles.push({
      kind: 'steam',
      x: x + (Math.random() - 0.5) * 14,
      y: y + (Math.random() - 0.5) * 10,
      vx: backX * (35 + Math.random() * 45) + (Math.random() - 0.5) * 25,
      vy: backY * (35 + Math.random() * 45) + (Math.random() - 0.5) * 25,
      size: 6 + Math.random() * 6,
      life: 0,
      maxLife: 0.42 + Math.random() * 0.16,
      color: '#f5e7cf',
      alpha: 0.65,
    });
  }
}

export function spawnPopup(fx, x, y, text, color = '#ffe066', size = 15) {
  fx.popups.push({
    x,
    y,
    vy: -42,
    text,
    color,
    size,
    life: 0,
    maxLife: 1.45,
  });
}

export function updateParticles(fx, dt) {
  if (fx.shakeTime > 0) {
    fx.shakeTime = Math.max(0, fx.shakeTime - dt);
    if (fx.shakeTime === 0) fx.shakePower = 0;
  }

  const nextP = [];
  for (const p of fx.particles) {
    p.life += dt;
    if (p.life >= p.maxLife) continue;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.gravity) p.vy += p.gravity * dt;
    if (p.vrot) p.rot += p.vrot * dt;
    if (p.kind === 'steam') {
      p.size += dt * 11;
      p.vx += Math.sin(p.life * 6) * dt * 10;
    }
    nextP.push(p);
  }
  fx.particles = nextP;

  const nextPop = [];
  for (const pop of fx.popups) {
    pop.life += dt;
    if (pop.life >= pop.maxLife) continue;
    pop.y += pop.vy * dt;
    pop.vy *= Math.pow(0.28, dt);
    nextPop.push(pop);
  }
  fx.popups = nextPop;
}

export function renderParticles(ctx, fx) {
  for (const p of fx.particles) {
    const t = p.life / p.maxLife;
    const fade = 1 - t;
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.alpha * fade);

    if (p.kind === 'steam') {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === 'spark' || p.kind === 'ember') {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === 'bit') {
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size * 0.6, -p.size * 0.45, p.size * 1.2, p.size * 0.9);
    } else if (p.kind === 'star') {
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2;
        ctx.lineTo(Math.cos(a) * p.size, Math.sin(a) * p.size);
        ctx.lineTo(Math.cos(a + Math.PI / 4) * p.size * 0.35, Math.sin(a + Math.PI / 4) * p.size * 0.35);
      }
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  for (const pop of fx.popups) {
    const t = pop.life / pop.maxLife;
    const alpha = t < 0.72 ? 1 : (1 - t) / 0.28;
    const scale = t < 0.14 ? 0.75 + (t / 0.14) * 0.3 : 1.0;
    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.translate(pop.x, pop.y);
    ctx.scale(scale, scale);
    ctx.font = `800 ${pop.size}px "Trebuchet MS", "Segoe UI", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(28, 16, 10, 0.92)';
    ctx.strokeText(pop.text, 0, 0);
    ctx.fillStyle = pop.color;
    ctx.fillText(pop.text, 0, 0);
    ctx.restore();
  }
}

export function bindParticleHelpers(fx) {
  return {
    state: fx,
    addShake: (power, dur) => addShake(fx, power, dur),
    spawnSteam: (x, y, dark) => spawnSteam(fx, x, y, dark),
    spawnSizzleSpark: (x, y, gold) => spawnSizzleSpark(fx, x, y, gold),
    spawnChopBits: (x, y, color, count) => spawnChopBits(fx, x, y, color, count),
    spawnEmber: (x, y) => spawnEmber(fx, x, y),
    spawnGoldBurst: (x, y, count) => spawnGoldBurst(fx, x, y, count),
    spawnDashDust: (x, y, bx, by) => spawnDashDust(fx, x, y, bx, by),
    spawnPopup: (x, y, text, color, size) => spawnPopup(fx, x, y, text, color, size),
  };
}
