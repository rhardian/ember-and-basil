// Procedural offscreen canvas textures: glazed terracotta floor tiles, oak butcher-block woodgrain, and brick hearth.

function hash2d(x, y) {
  let n = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  n = (n ^ (n >>> 13)) * 1274126177;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function makeOffscreen(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function createProceduralTextures(tileSize) {
  const sub = tileSize / 2;
  const floorCanvas = makeOffscreen(sub * 4, sub * 4);
  const fctx = floorCanvas.getContext('2d');

  // Hand-glazed Mediterranean terracotta tiles with per-tile warmth & subtle bevels
  const lightTones = ['#d99b6c', '#d59565', '#dd9f71', '#d29161'];
  const darkTones = ['#c27f50', '#bd794b', '#c78455', '#b87446'];

  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const tx = c * sub;
      const ty = r * sub;
      const h = hash2d(c + 11, r + 29);
      const even = (r + c) % 2 === 0;
      const palette = even ? lightTones : darkTones;
      const base = palette[Math.floor(h * palette.length)];

      // Grout fill
      fctx.fillStyle = '#8b512e';
      fctx.fillRect(tx, ty, sub, sub);

      // Glazed tile body
      const pad = 1.6;
      const grad = fctx.createLinearGradient(tx, ty, tx + sub, ty + sub);
      grad.addColorStop(0, base);
      grad.addColorStop(1, even ? '#c9885a' : '#ad6b3f');
      fctx.fillStyle = grad;
      fctx.beginPath();
      fctx.roundRect(tx + pad, ty + pad, sub - pad * 2, sub - pad * 2, 3);
      fctx.fill();

      // Subtle artisan glaze sheen on top-left corner
      fctx.fillStyle = 'rgba(255, 240, 212, 0.14)';
      fctx.beginPath();
      fctx.roundRect(tx + pad + 1.5, ty + pad + 1.5, sub - pad * 2 - 6, (sub - pad * 2) * 0.34, 2);
      fctx.fill();

      // Tiny terracotta mineral speckles
      fctx.fillStyle = 'rgba(92, 46, 20, 0.12)';
      for (let s = 0; s < 5; s++) {
        const sx = tx + 6 + hash2d(c * 7 + s, r * 13 + 1) * (sub - 12);
        const sy = ty + 6 + hash2d(c * 17 + s, r * 5 + 3) * (sub - 12);
        fctx.fillRect(sx, sy, 1.8, 1.8);
      }
    }
  }

  // Butcher-block end-grain oak texture for counters
  const woodCanvas = makeOffscreen(96, 96);
  const wctx = woodCanvas.getContext('2d');
  wctx.fillStyle = '#d69d5e';
  wctx.fillRect(0, 0, 96, 96);
  const stripH = 12;
  for (let row = 0; row < 8; row++) {
    const sy = row * stripH;
    const toneShift = (hash2d(row, 41) - 0.5) * 16;
    const r = Math.min(255, Math.max(0, Math.round(214 + toneShift)));
    const g = Math.min(255, Math.max(0, Math.round(157 + toneShift * 0.78)));
    const b = Math.min(255, Math.max(0, Math.round(94 + toneShift * 0.55)));
    wctx.fillStyle = `rgb(${r},${g},${b})`;
    wctx.fillRect(0, sy, 96, stripH - 1);

    // Fine woodgrain fibers
    wctx.strokeStyle = 'rgba(118, 66, 26, 0.15)';
    wctx.lineWidth = 0.9;
    wctx.beginPath();
    wctx.moveTo(0, sy + stripH * 0.45);
    wctx.bezierCurveTo(28, sy + stripH * 0.25, 62, sy + stripH * 0.7, 96, sy + stripH * 0.42);
    wctx.stroke();

    // Join seam
    wctx.fillStyle = 'rgba(96, 52, 20, 0.14)';
    wctx.fillRect(0, sy + stripH - 1, 96, 1);
  }

  // Dining room herringbone dark walnut parquet texture
  const diningCanvas = makeOffscreen(64, 64);
  const dctx = diningCanvas.getContext('2d');
  dctx.fillStyle = '#472a19';
  dctx.fillRect(0, 0, 64, 64);
  for (let y = 0; y < 64; y += 16) {
    for (let x = 0; x < 64; x += 32) {
      const shift = ((y / 16) % 2) * 16;
      const shade = hash2d(x + shift, y) > 0.5 ? '#573420' : '#4d2d1b';
      dctx.fillStyle = shade;
      dctx.fillRect((x + shift) % 64, y + 1, 30, 14);
      dctx.strokeStyle = 'rgba(22, 11, 5, 0.35)';
      dctx.strokeRect((x + shift) % 64, y + 1, 30, 14);
    }
  }

  return {
    floorCanvas,
    woodCanvas,
    diningCanvas,
    floorPattern: null,
    woodPattern: null,
    diningPattern: null,
  };
}

export function getFloorPattern(ctx, textures) {
  if (!textures.floorPattern) {
    textures.floorPattern = ctx.createPattern(textures.floorCanvas, 'repeat');
  }
  return textures.floorPattern;
}

export function getWoodPattern(ctx, textures) {
  if (!textures.woodPattern) {
    textures.woodPattern = ctx.createPattern(textures.woodCanvas, 'repeat');
  }
  return textures.woodPattern;
}

export function getDiningPattern(ctx, textures) {
  if (!textures.diningPattern) {
    textures.diningPattern = ctx.createPattern(textures.diningCanvas, 'repeat');
  }
  return textures.diningPattern;
}
