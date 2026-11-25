// Bespoke painterly 2D Canvas illustrations for every raw ingredient, prepped component, mid-assembly plate, and finished dish.

import { INGREDIENTS, findClosestRecipesForPlate, findRawPieProgress } from './recipes.js';

function drawEllipseShadow(ctx, x, y, rx, ry, alpha = 0.24) {
  ctx.save();
  ctx.fillStyle = `rgba(34, 18, 8, ${alpha})`;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawPorcelainPlate(ctx, x, y, radius, goldenHalo = false) {
  ctx.save();
  if (goldenHalo) {
    const glow = ctx.createRadialGradient(x, y, radius * 0.65, x, y, radius * 1.38);
    glow.addColorStop(0, 'rgba(255, 218, 92, 0.45)');
    glow.addColorStop(1, 'rgba(255, 218, 92, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, radius * 1.38, 0, Math.PI * 2);
    ctx.fill();
  }

  drawEllipseShadow(ctx, x + 2, y + 4, radius * 1.02, radius * 0.96, 0.3);

  const rimGrad = ctx.createRadialGradient(
    x - radius * 0.28,
    y - radius * 0.28,
    radius * 0.1,
    x,
    y,
    radius,
  );
  rimGrad.addColorStop(0, '#fffdf7');
  rimGrad.addColorStop(0.75, '#f6eedc');
  rimGrad.addColorStop(1, '#dfd2b8');

  ctx.fillStyle = rimGrad;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();

  // Outer fine gold bistro rim
  ctx.strokeStyle = goldenHalo ? '#e8b030' : '#cfa24a';
  ctx.lineWidth = Math.max(1.5, radius * 0.065);
  ctx.beginPath();
  ctx.arc(x, y, radius * 0.92, 0, Math.PI * 2);
  ctx.stroke();

  // Inner plate well bevel
  ctx.strokeStyle = 'rgba(155, 134, 102, 0.35)';
  ctx.lineWidth = Math.max(1, radius * 0.045);
  ctx.beginPath();
  ctx.arc(x, y, radius * 0.72, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

export function drawIngredientArt(ctx, ingredientId, x, y, radius = 20) {
  ctx.save();
  ctx.translate(x, y);
  const s = radius / 20;
  ctx.scale(s, s);

  switch (ingredientId) {
    case 'tomato': {
      drawEllipseShadow(ctx, 1, 5, 14, 10, 0.24);
      const grad = ctx.createRadialGradient(-5, -5, 2, 0, 0, 15);
      grad.addColorStop(0, '#ff6d52');
      grad.addColorStop(0.55, '#d93223');
      grad.addColorStop(1, '#8f1b13');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(0, 1, 14.5, 12.8, 0, 0, Math.PI * 2);
      ctx.fill();
      // Specular gloss
      ctx.fillStyle = 'rgba(255, 240, 225, 0.45)';
      ctx.beginPath();
      ctx.ellipse(-5.5, -4, 4.5, 2.4, -0.5, 0, Math.PI * 2);
      ctx.fill();
      // Green calyx star
      ctx.fillStyle = '#338a3b';
      for (let i = 0; i < 5; i++) {
        ctx.save();
        ctx.translate(0, -8.5);
        ctx.rotate((i * Math.PI * 2) / 5);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(2.4, -5.5);
        ctx.lineTo(-2.4, -5.5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      break;
    }

    case 'chopped_tomato': {
      drawEllipseShadow(ctx, 1, 4, 15, 10, 0.2);
      const cubes = [
        [-7, -4, 7.5, 6.5, -0.25, '#e33b29'],
        [2, -6, 7.2, 6.4, 0.2, '#f0523c'],
        [-9, 3, 7.2, 6.0, 0.15, '#c92d1e'],
        [1, 2, 8.0, 6.6, -0.18, '#ea4431'],
        [-2, -1, 6.5, 5.8, 0.3, '#ff6e54'],
      ];
      for (const [cx, cy, cw, ch, rot, col] of cubes) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(rot);
        ctx.fillStyle = col;
        ctx.strokeStyle = '#8c1d14';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(-cw / 2, -ch / 2, cw, ch, 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = 'rgba(255, 232, 188, 0.55)';
        ctx.fillRect(-cw * 0.22, -ch * 0.22, cw * 0.32, ch * 0.24);
        ctx.restore();
      }
      break;
    }

    case 'pomodoro_sauce': {
      drawEllipseShadow(ctx, 1, 4, 15, 11, 0.22);
      const grad = ctx.createRadialGradient(-3, -3, 2, 0, 0, 15);
      grad.addColorStop(0, '#e3422b');
      grad.addColorStop(0.68, '#b82418');
      grad.addColorStop(1, '#7a150e');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(0, 0, 15.5, 12.5, 0, 0, Math.PI * 2);
      ctx.fill();
      // Olive oil swirl
      ctx.strokeStyle = 'rgba(247, 198, 92, 0.65)';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(0, 0, 7.5, 0.4, 3.8);
      ctx.stroke();
      // Herb flecks
      ctx.fillStyle = '#47ad4b';
      for (const [hx, hy] of [
        [-5, -3],
        [4, 2],
        [-2, 5],
        [6, -4],
      ]) {
        ctx.beginPath();
        ctx.ellipse(hx, hy, 2.2, 1.2, hx, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }

    case 'basil': {
      drawEllipseShadow(ctx, 1, 5, 14, 9, 0.2);
      const leaves = [
        [-7, 1, -0.55, 9.5, 6.2, '#2d8236'],
        [7, 2, 0.6, 9.5, 6.2, '#34943e'],
        [0, -4, 0.05, 10.5, 7.0, '#44b54d'],
      ];
      for (const [lx, ly, rot, rx, ry, col] of leaves) {
        ctx.save();
        ctx.translate(lx, ly);
        ctx.rotate(rot);
        ctx.fillStyle = col;
        ctx.strokeStyle = '#1f5e27';
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = '#7fe07a';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(-rx * 0.72, 0);
        ctx.lineTo(rx * 0.68, 0);
        ctx.stroke();
        ctx.restore();
      }
      break;
    }

    case 'chopped_basil': {
      drawEllipseShadow(ctx, 0, 4, 13, 8, 0.16);
      const strips = [
        [-8, -2, -0.4, '#2d8a38'],
        [-2, -6, 0.5, '#47ba4f'],
        [5, -3, -0.7, '#359c40'],
        [-6, 4, 0.35, '#4ac453'],
        [2, 3, -0.25, '#2b7d34'],
        [8, 2, 0.6, '#57d15f'],
        [0, 0, 0.1, '#3ca846'],
      ];
      for (const [bx, by, rot, col] of strips) {
        ctx.save();
        ctx.translate(bx, by);
        ctx.rotate(rot);
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.ellipse(0, 0, 5.2, 2.2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      break;
    }

    case 'mushroom': {
      drawEllipseShadow(ctx, 1, 6, 13, 8, 0.22);
      // Creamy stem
      ctx.fillStyle = '#ead9be';
      ctx.strokeStyle = '#9e8462';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.roundRect(-5.5, 0, 11, 12, 4);
      ctx.fill();
      ctx.stroke();
      // Chestnut porcini cap
      const capGrad = ctx.createRadialGradient(-4, -7, 2, 0, -3, 16);
      capGrad.addColorStop(0, '#c89463');
      capGrad.addColorStop(0.65, '#8c5732');
      capGrad.addColorStop(1, '#59331a');
      ctx.fillStyle = capGrad;
      ctx.beginPath();
      ctx.ellipse(0, -3, 14.5, 9.5, 0, Math.PI, Math.PI * 2);
      ctx.quadraticCurveTo(14.5, 3, 0, 3.5);
      ctx.quadraticCurveTo(-14.5, 3, -14.5, -3);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 238, 210, 0.32)';
      ctx.beginPath();
      ctx.ellipse(-4.5, -7, 4.5, 2.1, -0.3, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'chopped_mushroom':
    case 'sauteed_mushroom': {
      const golden = ingredientId === 'sauteed_mushroom';
      drawEllipseShadow(ctx, 1, 5, 14, 9, 0.2);
      const slices = [
        [-6, 1, -0.45],
        [5, 2, 0.5],
        [0, -4, 0.05],
      ];
      for (const [mx, my, rot] of slices) {
        ctx.save();
        ctx.translate(mx, my);
        ctx.rotate(rot);
        ctx.fillStyle = golden ? '#c28b4e' : '#efe3ce';
        ctx.strokeStyle = golden ? '#633818' : '#8a6646';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-4, 6);
        ctx.lineTo(-4, 0);
        ctx.arc(0, -1, 7.5, Math.PI, 0);
        ctx.lineTo(4, 6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        if (golden) {
          ctx.fillStyle = 'rgba(255, 224, 130, 0.45)';
          ctx.beginPath();
          ctx.arc(-2, -3, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
      break;
    }

    case 'steak': {
      drawEllipseShadow(ctx, 1, 5, 16, 11, 0.25);
      const grad = ctx.createRadialGradient(-4, -3, 2, 0, 0, 18);
      grad.addColorStop(0, '#d95757');
      grad.addColorStop(0.7, '#ab2e31');
      grad.addColorStop(1, '#751c20');
      ctx.fillStyle = grad;
      ctx.strokeStyle = '#f5dede';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(-14, 2);
      ctx.bezierCurveTo(-15, -10, 4, -14, 14, -5);
      ctx.bezierCurveTo(18, 4, 10, 12, -2, 11);
      ctx.bezierCurveTo(-11, 11, -14, 7, -14, 2);
      ctx.fill();
      ctx.stroke();
      // Ivory marbling veins
      ctx.strokeStyle = 'rgba(255, 236, 232, 0.72)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-8, -3);
      ctx.quadraticCurveTo(-1, 1, 7, -4);
      ctx.moveTo(-5, 5);
      ctx.quadraticCurveTo(2, 2, 9, 4);
      ctx.stroke();
      break;
    }

    case 'seared_steak': {
      drawEllipseShadow(ctx, 1, 5, 16, 11, 0.28);
      const grad = ctx.createRadialGradient(-4, -4, 2, 0, 0, 18);
      grad.addColorStop(0, '#9c4a2e');
      grad.addColorStop(0.65, '#6b2c1a');
      grad.addColorStop(1, '#40180e');
      ctx.fillStyle = grad;
      ctx.strokeStyle = '#33120a';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-15, 2);
      ctx.bezierCurveTo(-15, -10, 4, -13, 15, -4);
      ctx.bezierCurveTo(18, 5, 10, 12, -2, 11);
      ctx.bezierCurveTo(-11, 11, -15, 7, -15, 2);
      ctx.fill();
      ctx.stroke();
      // Char grill marks
      ctx.strokeStyle = '#260e08';
      ctx.lineWidth = 2.1;
      for (const offset of [-7, -1, 5]) {
        ctx.beginPath();
        ctx.moveTo(offset - 3, -6);
        ctx.lineTo(offset + 4, 7);
        ctx.stroke();
      }
      // Melting golden herb butter pat
      ctx.fillStyle = '#ffe16e';
      ctx.strokeStyle = '#d9a42e';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(2, -1, 5.2, 3.8, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#3d9942';
      ctx.beginPath();
      ctx.arc(2.5, -1, 1.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'pasta':
    case 'boiled_pasta': {
      const cooked = ingredientId === 'boiled_pasta';
      drawEllipseShadow(ctx, 1, 5, 15, 11, 0.2);
      ctx.fillStyle = cooked ? '#f6d265' : '#e6c36c';
      ctx.beginPath();
      ctx.ellipse(0, 1, 15, 11.5, 0, 0, Math.PI * 2);
      ctx.fill();
      // Swirling tagliatelle ribbons
      ctx.strokeStyle = cooked ? '#fff1a8' : '#f7e19c';
      ctx.lineWidth = 3.2;
      ctx.lineCap = 'round';
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.arc(0, 0.5, 4 + i * 2.8, i * 0.9, i * 0.9 + Math.PI * 1.45);
        ctx.stroke();
      }
      ctx.strokeStyle = cooked ? '#cc9426' : '#b88f38';
      ctx.lineWidth = 1.4;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(0, 0.5, 5.5 + i * 2.8, i * 1.2 + 0.5, i * 1.2 + 2.6);
        ctx.stroke();
      }
      break;
    }

    case 'dough': {
      drawEllipseShadow(ctx, 1, 5, 15, 11, 0.2);
      const grad = ctx.createRadialGradient(-4, -4, 2, 0, 0, 16);
      grad.addColorStop(0, '#fffaf0');
      grad.addColorStop(0.7, '#efe0c0');
      grad.addColorStop(1, '#cfb991');
      ctx.fillStyle = grad;
      ctx.strokeStyle = '#bda47b';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(0, 1, 15, 12.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Subtle flour dusting
      ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.beginPath();
      ctx.ellipse(-3, -2, 6, 3.5, -0.3, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'toasted_bread': {
      drawEllipseShadow(ctx, 1, 5, 16, 10, 0.24);
      const slices = [
        [-5, 2, -0.25],
        [4, -1, 0.2],
      ];
      for (const [sx, sy, rot] of slices) {
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(rot);
        ctx.fillStyle = '#c47c38';
        ctx.strokeStyle = '#734117';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.roundRect(-10, -6.5, 20, 13, 5);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#f2cf8d';
        ctx.beginPath();
        ctx.roundRect(-7.5, -4.2, 15, 8.4, 3);
        ctx.fill();
        ctx.restore();
      }
      break;
    }

    case 'baked_margherita': {
      drawWoodFiredFlatbread(ctx, false, true);
      break;
    }

    case 'baked_funghi': {
      drawWoodFiredFlatbread(ctx, true, true);
      break;
    }

    case 'salmon': {
      drawEllipseShadow(ctx, 1, 5, 16, 10, 0.24);
      const grad = ctx.createLinearGradient(-15, -8, 15, 10);
      grad.addColorStop(0, '#ff9d78');
      grad.addColorStop(0.55, '#f06e48');
      grad.addColorStop(1, '#c94c2c');
      ctx.fillStyle = grad;
      ctx.strokeStyle = '#ffd9c7';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-15, 2);
      ctx.quadraticCurveTo(-8, -11, 13, -7);
      ctx.quadraticCurveTo(17, 2, 10, 10);
      ctx.quadraticCurveTo(-8, 11, -15, 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Delicate white salmon marbling stripes
      ctx.strokeStyle = 'rgba(255, 240, 232, 0.72)';
      ctx.lineWidth = 1.4;
      for (const sx of [-8, -2, 4, 10]) {
        ctx.beginPath();
        ctx.moveTo(sx - 2, -6);
        ctx.quadraticCurveTo(sx + 1, 0, sx - 1, 8);
        ctx.stroke();
      }
      break;
    }

    case 'seared_salmon': {
      drawEllipseShadow(ctx, 1, 5, 16, 10, 0.28);
      const grad = ctx.createLinearGradient(-15, -8, 15, 10);
      grad.addColorStop(0, '#ffaa6b');
      grad.addColorStop(0.5, '#e36a36');
      grad.addColorStop(1, '#9e3b18');
      ctx.fillStyle = grad;
      ctx.strokeStyle = '#63250e';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-15, 2);
      ctx.quadraticCurveTo(-8, -11, 13, -7);
      ctx.quadraticCurveTo(17, 2, 10, 10);
      ctx.quadraticCurveTo(-8, 11, -15, 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Golden crispy sear lines
      ctx.strokeStyle = 'rgba(84, 30, 10, 0.72)';
      ctx.lineWidth = 1.8;
      for (const sx of [-7, -1, 5]) {
        ctx.beginPath();
        ctx.moveTo(sx - 2, -6);
        ctx.lineTo(sx + 3, 7);
        ctx.stroke();
      }
      // Bright Amalfi lemon slice crown
      ctx.fillStyle = '#ffe552';
      ctx.strokeStyle = '#e0a914';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(5, -2, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fff9c4';
      ctx.beginPath();
      ctx.arc(5, -2, 3.2, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'saffron': {
      drawEllipseShadow(ctx, 1, 5, 14, 10, 0.22);
      // Bright Amalfi lemon half
      ctx.fillStyle = '#ffd93b';
      ctx.strokeStyle = '#c49014';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(-4, 1, 10, 8.5, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fff6bd';
      ctx.beginPath();
      ctx.ellipse(-4, 1, 7, 5.8, -0.3, 0, Math.PI * 2);
      ctx.fill();
      // Crimson-gold saffron threads beside lemon
      ctx.strokeStyle = '#d93d1a';
      ctx.lineWidth = 1.8;
      for (const [ox, oy, rot] of [
        [8, -4, 0.4],
        [10, 2, -0.3],
        [7, 6, 0.7],
      ]) {
        ctx.save();
        ctx.translate(ox, oy);
        ctx.rotate(rot);
        ctx.beginPath();
        ctx.moveTo(-4, 0);
        ctx.quadraticCurveTo(0, -3, 5, 1);
        ctx.stroke();
        ctx.restore();
      }
      break;
    }

    case 'saffron_glaze': {
      drawEllipseShadow(ctx, 1, 4, 15, 11, 0.22);
      const grad = ctx.createRadialGradient(-3, -3, 2, 0, 0, 15);
      grad.addColorStop(0, '#ffea75');
      grad.addColorStop(0.6, '#f2b724');
      grad.addColorStop(1, '#b8760d');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(0, 0, 15.5, 12.5, 0, 0, Math.PI * 2);
      ctx.fill();
      // Cream velvet swirl + saffron threads
      ctx.strokeStyle = 'rgba(255, 250, 224, 0.75)';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(0, 0, 7.5, 0.3, 3.9);
      ctx.stroke();
      ctx.strokeStyle = '#d9381e';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-4, -3);
      ctx.lineTo(2, -1);
      ctx.moveTo(1, 3);
      ctx.lineTo(6, 1);
      ctx.stroke();
      break;
    }

    case 'burnt': {
      drawEllipseShadow(ctx, 1, 5, 14, 10, 0.3);
      ctx.fillStyle = '#292321';
      ctx.strokeStyle = '#120f0e';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(0, 1, 14, 11, 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#5c4d47';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-6, -2);
      ctx.lineTo(5, 4);
      ctx.moveTo(4, -4);
      ctx.lineTo(-5, 5);
      ctx.stroke();
      break;
    }

    default: {
      ctx.fillStyle = '#d9b589';
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawWoodFiredFlatbread(ctx, isFunghi, isBaked) {
  drawEllipseShadow(ctx, 1, 4, 18, 15, 0.25);
  // Outer crust
  ctx.fillStyle = isBaked ? '#c97e38' : '#efe0c0';
  ctx.strokeStyle = isBaked ? '#6e3b14' : '#baa37d';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.ellipse(0, 0, 17.5, 14.8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Char blisters when wood-fired
  if (isBaked) {
    ctx.fillStyle = '#4f270d';
    for (const [cx, cy] of [
      [-13, -6],
      [12, -7],
      [13, 5],
      [-11, 8],
      [0, -12],
    ]) {
      ctx.beginPath();
      ctx.arc(cx, cy, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Pomodoro base
  ctx.fillStyle = isBaked ? '#c4321e' : '#d93c26';
  ctx.beginPath();
  ctx.ellipse(0, 0, 13.5, 11.2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Melted mozzarella pearls
  if (isBaked) {
    ctx.fillStyle = '#fff5d6';
    for (const [mx, my, r] of [
      [-5, -4, 3.8],
      [5, -3, 3.5],
      [-4, 4, 3.6],
      [5, 4, 3.4],
      [0, 0, 3.2],
    ]) {
      ctx.beginPath();
      ctx.arc(mx, my, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Toppings
  if (isFunghi) {
    for (const [fx, fy, rot] of [
      [-5, -2, -0.3],
      [5, 2, 0.4],
      [0, -5, 0.1],
      [-2, 5, -0.2],
    ]) {
      ctx.save();
      ctx.translate(fx, fy);
      ctx.rotate(rot);
      ctx.fillStyle = isBaked ? '#855029' : '#d8c2a3';
      ctx.beginPath();
      ctx.ellipse(0, 0, 3.6, 2.3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  } else {
    for (const [bx, by, rot] of [
      [-5, -3, -0.4],
      [5, 3, 0.5],
      [1, -4, 0.2],
      [-3, 4, -0.2],
    ]) {
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(rot);
      ctx.fillStyle = '#3ea846';
      ctx.beginPath();
      ctx.ellipse(0, 0, 3.8, 2.1, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

export function drawRawPieArt(ctx, rawPie, x, y, radius = 24) {
  ctx.save();
  ctx.translate(x, y);
  const s = radius / 20;
  ctx.scale(s, s);

  drawEllipseShadow(ctx, 1, 4, 17.5, 14.5, 0.22);
  ctx.fillStyle = '#f2e3c4';
  ctx.strokeStyle = '#bda57e';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(0, 0, 17, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  if (rawPie.parts.includes('pomodoro_sauce')) {
    ctx.fillStyle = '#cf3220';
    ctx.beginPath();
    ctx.ellipse(0, 0, 13, 10.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (rawPie.parts.includes('chopped_basil')) {
    for (const [bx, by] of [
      [-5, -3],
      [5, 3],
      [0, -4],
      [-3, 4],
    ]) {
      ctx.fillStyle = '#44b54d';
      ctx.beginPath();
      ctx.ellipse(bx, by, 3.6, 2, bx, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (rawPie.parts.includes('chopped_mushroom')) {
    for (const [mx, my] of [
      [-5, -2],
      [5, 2],
      [1, -4],
      [-2, 4],
    ]) {
      ctx.fillStyle = '#d9c2a3';
      ctx.strokeStyle = '#7d5636';
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.ellipse(mx, my, 3.6, 2.4, mx, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
  ctx.restore();
}

export function drawDishPreview(ctx, dishId, x, y, radius = 24, perfect = false) {
  drawPorcelainPlate(ctx, x, y, radius, perfect);
  ctx.save();
  ctx.translate(x, y);
  const s = radius / 26;
  ctx.scale(s, s);

  switch (dishId) {
    case 'bruschetta': {
      drawIngredientArt(ctx, 'toasted_bread', 0, 1, 22);
      drawIngredientArt(ctx, 'chopped_tomato', 0, -1, 16);
      drawIngredientArt(ctx, 'chopped_basil', 0, -3, 12);
      break;
    }
    case 'saffron_crostini': {
      drawIngredientArt(ctx, 'toasted_bread', 0, 1, 22);
      drawIngredientArt(ctx, 'saffron_glaze', 0, -1, 15);
      drawIngredientArt(ctx, 'chopped_basil', 1, -3, 11);
      break;
    }
    case 'pomodoro_pasta': {
      drawIngredientArt(ctx, 'boiled_pasta', 0, 1, 21);
      drawIngredientArt(ctx, 'pomodoro_sauce', 0, -1, 14);
      drawIngredientArt(ctx, 'chopped_basil', 1, -3, 11);
      break;
    }
    case 'saffron_pasta': {
      drawIngredientArt(ctx, 'boiled_pasta', 0, 1, 21);
      drawIngredientArt(ctx, 'saffron_glaze', 0, -1, 14.5);
      drawIngredientArt(ctx, 'chopped_basil', 1, -3, 11);
      break;
    }
    case 'porcini_pasta': {
      drawIngredientArt(ctx, 'boiled_pasta', 0, 1, 21);
      drawIngredientArt(ctx, 'sauteed_mushroom', 0, -1, 16);
      drawIngredientArt(ctx, 'chopped_basil', 1, -3, 10);
      break;
    }
    case 'margherita': {
      drawWoodFiredFlatbread(ctx, false, true);
      break;
    }
    case 'funghi_flatbread': {
      drawWoodFiredFlatbread(ctx, true, true);
      break;
    }
    case 'citrus_salmon': {
      drawIngredientArt(ctx, 'saffron_glaze', 0, 3, 19);
      drawIngredientArt(ctx, 'seared_salmon', 0, -1, 20);
      drawIngredientArt(ctx, 'chopped_basil', -6, -4, 10);
      break;
    }
    case 'salmon_pasta': {
      drawIngredientArt(ctx, 'boiled_pasta', 5, 3, 17);
      drawIngredientArt(ctx, 'saffron_glaze', 5, 2, 11);
      drawIngredientArt(ctx, 'seared_salmon', -6, -2, 17);
      break;
    }
    case 'seared_ribeye': {
      drawIngredientArt(ctx, 'sauteed_mushroom', 7, 5, 14);
      drawIngredientArt(ctx, 'seared_steak', -3, -2, 20);
      drawIngredientArt(ctx, 'chopped_basil', -2, -5, 10);
      break;
    }
    case 'chefs_tasting': {
      drawIngredientArt(ctx, 'boiled_pasta', 7, 3, 15);
      drawIngredientArt(ctx, 'pomodoro_sauce', 7, 2, 10);
      drawIngredientArt(ctx, 'seared_steak', -7, -2, 17);
      drawIngredientArt(ctx, 'chopped_basil', 0, -4, 11);
      break;
    }
    case 'surf_and_turf': {
      drawIngredientArt(ctx, 'saffron_glaze', 0, 4, 18);
      drawIngredientArt(ctx, 'seared_steak', -7, -2, 16.5);
      drawIngredientArt(ctx, 'seared_salmon', 8, 2, 16);
      drawIngredientArt(ctx, 'chopped_basil', 0, -5, 10.5);
      break;
    }
    default:
      break;
  }

  ctx.restore();

  if (perfect) {
    drawPerfectStarBadge(ctx, x + radius * 0.68, y - radius * 0.68, Math.max(7, radius * 0.34));
  }
}

export function drawPerfectStarBadge(ctx, x, y, r = 9) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#ffd644';
  ctx.strokeStyle = '#75470a';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const outerA = -Math.PI / 2 + (i * Math.PI * 2) / 5;
    const innerA = outerA + Math.PI / 5;
    const ox = Math.cos(outerA) * r;
    const oy = Math.sin(outerA) * r;
    const ix = Math.cos(innerA) * r * 0.45;
    const iy = Math.sin(innerA) * r * 0.45;
    if (i === 0) ctx.moveTo(ox, oy);
    else ctx.lineTo(ox, oy);
    ctx.lineTo(ix, iy);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

export function drawKitchenItem(ctx, item, x, y, radius = 26, showAssemblyBadge = false) {
  if (!item) return;

  if (item.kind === 'ingredient') {
    drawIngredientArt(ctx, item.id, x, y, radius * 0.86);
    if (item.perfect) {
      drawPerfectStarBadge(ctx, x + radius * 0.56, y - radius * 0.56, 8);
    }
    return;
  }

  if (item.kind === 'raw_pie') {
    drawRawPieArt(ctx, item, x, y, radius * 0.96);
    if (showAssemblyBadge) {
      const prog = findRawPieProgress(item);
      if (prog) {
        drawStatusPill(
          ctx,
          x,
          y - radius - 10,
          prog.readyForOven ? 'BAKE IN OVEN' : `${prog.matched}/${prog.total} PIE`,
          prog.readyForOven ? '#e07a24' : '#3b2416',
          '#fff6e0',
        );
      }
    }
    return;
  }

  if (item.kind === 'plate') {
    if (item.dishId) {
      drawDishPreview(ctx, item.dishId, x, y, radius, item.perfect);
      return;
    }

    drawPorcelainPlate(ctx, x, y, radius, false);
    // Draw plated mid-assembly layers in culinary order
    const order = [
      'toasted_bread',
      'boiled_pasta',
      'pomodoro_sauce',
      'saffron_glaze',
      'sauteed_mushroom',
      'chopped_tomato',
      'seared_steak',
      'seared_salmon',
      'chopped_basil',
    ];
    for (const part of order) {
      if (!item.parts.includes(part)) continue;
      let ox = 0;
      let oy = 0;
      let pr = radius * 0.72;
      if (part === 'pomodoro_sauce' || part === 'saffron_glaze') pr = radius * 0.54;
      if (part === 'chopped_basil') {
        oy = -3;
        pr = radius * 0.44;
      }
      if (part === 'seared_steak' && (item.parts.includes('boiled_pasta') || item.parts.includes('seared_salmon'))) {
        ox = -6;
        oy = -2;
        pr = radius * 0.62;
      }
      if (part === 'seared_salmon' && (item.parts.includes('boiled_pasta') || item.parts.includes('seared_steak'))) {
        ox = 6;
        oy = 2;
        pr = radius * 0.6;
      }
      drawIngredientArt(ctx, part, x + ox, y + oy, pr);
    }

    if (showAssemblyBadge && item.parts.length > 0) {
      const matches = findClosestRecipesForPlate(item);
      if (matches.length > 0) {
        const best = matches[0];
        const nextMissing = best.missing[0] ? INGREDIENTS[best.missing[0]]?.short ?? '' : '';
        const shortWord = nextMissing.split(' ').pop()?.toUpperCase() ?? '';
        const pillText = shortWord
          ? `${best.matched}/${best.total} · +${shortWord}`
          : `${best.matched}/${best.total} PLATING`;
        drawStatusPill(ctx, x, y - radius - 11, pillText, '#1d4d3a', '#e0ffeb', '#80f0a8');
      }
    }
  }
}

export function drawStatusPill(ctx, x, y, text, bgColor, textColor, borderColor = 'rgba(255,244,214,0.45)') {
  ctx.save();
  ctx.font = '800 10.5px "Trebuchet MS", "Segoe UI", sans-serif';
  const w = Math.max(46, ctx.measureText(text).width + 14);
  const h = 18;
  ctx.fillStyle = bgColor;
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - h / 2, w, h, 9);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = textColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y + 0.5);
  ctx.restore();
}
