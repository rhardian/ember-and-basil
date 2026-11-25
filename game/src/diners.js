// Candlelit Bistro Dining Bar guests: animated regulars and the monocled Food Critic reacting to served dishes.

import { CANVAS_WIDTH, DINING_X, FOOTER_Y, GRID_ORIGIN_Y } from './config.js';
import { drawDishPreview } from './food-art.js';
import { getDiningPattern } from './textures.js';

const GUEST_CAST = [
  {
    name: 'Elena',
    role: 'Regular',
    hair: '#3b2419',
    coat: '#8c3138',
    skin: '#f2c49e',
    critic: false,
  },
  {
    name: 'Critic Henri',
    role: 'VIP Critic',
    hair: '#d9d4cc',
    coat: '#283652',
    skin: '#f0bfa0',
    critic: true,
  },
  {
    name: 'Mateo',
    role: 'Sommelier',
    hair: '#241b16',
    coat: '#2e6346',
    skin: '#dfa67c',
    critic: false,
  },
];

export function createDiningRoom() {
  return {
    tables: GUEST_CAST.map((guest, idx) => ({
      id: idx,
      guest,
      y: GRID_ORIGIN_Y + 95 + idx * 145,
      servedDishId: null,
      servedPerfect: false,
      serveTimer: 0,
      delightTimer: 0,
      lastTipText: '',
    })),
  };
}

export function reactToServedDish(diningRoom, dishId, isPerfect, payout, isVip) {
  if (!diningRoom) return;
  let table = isVip
    ? diningRoom.tables.find((t) => t.guest.critic)
    : diningRoom.tables.find((t) => t.serveTimer <= 0 && !t.guest.critic);
  if (!table) {
    table = diningRoom.tables[Math.floor(Math.random() * diningRoom.tables.length)];
  }
  table.servedDishId = dishId;
  table.servedPerfect = isPerfect;
  table.serveTimer = 14;
  table.delightTimer = 5.5;
  table.lastTipText = isPerfect ? `★ +$${payout}` : `+$${payout}`;
}

export function updateDiningGuests(diningRoom, dt) {
  if (!diningRoom) return;
  for (const t of diningRoom.tables) {
    if (t.serveTimer > 0) {
      t.serveTimer = Math.max(0, t.serveTimer - dt);
      if (t.serveTimer === 0) t.servedDishId = null;
    }
    if (t.delightTimer > 0) {
      t.delightTimer = Math.max(0, t.delightTimer - dt);
    }
  }
}

export function renderDiningPassGuests(ctx, diningRoom, orders, textures, time) {
  const panelW = CANVAS_WIDTH - DINING_X;
  const panelH = FOOTER_Y - GRID_ORIGIN_Y;

  ctx.save();
  // Dark walnut parquet dining room floor
  ctx.fillStyle = getDiningPattern(ctx, textures);
  ctx.fillRect(DINING_X, GRID_ORIGIN_Y, panelW, panelH);

  // Brass pass window divider molding
  const moldGrad = ctx.createLinearGradient(DINING_X, 0, DINING_X + 10, 0);
  moldGrad.addColorStop(0, '#784e18');
  moldGrad.addColorStop(0.5, '#f2cc72');
  moldGrad.addColorStop(1, '#5e3c10');
  ctx.fillStyle = moldGrad;
  ctx.fillRect(DINING_X, GRID_ORIGIN_Y, 8, panelH);

  // Dining room top banner
  ctx.fillStyle = 'rgba(24, 14, 8, 0.86)';
  ctx.beginPath();
  ctx.roundRect(DINING_X + 16, GRID_ORIGIN_Y + 8, panelW - 26, 24, 12);
  ctx.fill();
  ctx.strokeStyle = 'rgba(220, 165, 68, 0.55)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = '#f6d687';
  ctx.font = '800 10px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('CANDLELIT DINING', DINING_X + 16 + (panelW - 26) / 2, GRID_ORIGIN_Y + 20);

  // Three intimate marble bistro tables with seated regulars & VIP Critic
  const activeTickets = orders.tickets;
  diningRoom.tables.forEach((table, idx) => {
    const tx = DINING_X + 64;
    const ty = table.y;
    const wantedTicket = table.guest.critic
      ? activeTickets.find((t) => t.isVip) ?? activeTickets[idx]
      : activeTickets[idx];

    // Table shadow
    ctx.fillStyle = 'rgba(16, 8, 4, 0.42)';
    ctx.beginPath();
    ctx.ellipse(tx + 3, ty + 6, 36, 32, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cream & wine-red linen bistro tablecloth
    ctx.fillStyle = table.guest.critic ? '#7a1f2b' : '#fbf4e3';
    ctx.strokeStyle = table.guest.critic ? '#f0c451' : '#c9b18a';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(tx, ty, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Inner linen doily
    ctx.fillStyle = '#fff9ec';
    ctx.beginPath();
    ctx.arc(tx, ty, 26, 0, Math.PI * 2);
    ctx.fill();

    // Warm flickering brass tabletop candle
    const flicker = Math.sin(time * 14 + idx * 3) * 1.4;
    ctx.fillStyle = '#d9a441';
    ctx.beginPath();
    ctx.arc(tx - 17, ty - 14, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffe573';
    ctx.beginPath();
    ctx.arc(tx - 17, ty - 15, 2.8 + flicker * 0.2, 0, Math.PI * 2);
    ctx.fill();

    // Wine glass
    ctx.fillStyle = 'rgba(168, 32, 46, 0.85)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(tx - 15, ty + 14, 5.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Dish served on guest's table!
    if (table.servedDishId) {
      drawDishPreview(ctx, table.servedDishId, tx + 3, ty + 1, 20, table.servedPerfect);
    }

    // Seated Guest Character right beside table
    const gx = DINING_X + 118;
    const gy = ty + 2;
    const bob = table.delightTimer > 0 ? Math.abs(Math.sin(time * 11)) * 4 : Math.sin(time * 2.2 + idx) * 1.2;

    ctx.save();
    ctx.translate(gx, gy - bob);
    // Chair back
    ctx.fillStyle = '#6b3e1f';
    ctx.beginPath();
    ctx.roundRect(8, -16, 10, 32, 4);
    ctx.fill();
    // Shoulders
    ctx.fillStyle = table.guest.coat;
    ctx.strokeStyle = '#24140d';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(-13, -10, 24, 24, 10);
    ctx.fill();
    ctx.stroke();
    // Head
    ctx.fillStyle = table.guest.skin;
    ctx.beginPath();
    ctx.arc(-2, -16, 11.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Hair
    ctx.fillStyle = table.guest.hair;
    ctx.beginPath();
    ctx.arc(-1, -20, 10.5, Math.PI * 0.9, Math.PI * 2.15);
    ctx.fill();
    // Eyes looking left toward kitchen pass
    ctx.fillStyle = '#24140d';
    ctx.beginPath();
    ctx.arc(-6, -16, 1.7, 0, Math.PI * 2);
    ctx.arc(-1, -16, 1.7, 0, Math.PI * 2);
    ctx.fill();
    // Critic monocle & golden bowtie!
    if (table.guest.critic) {
      ctx.strokeStyle = '#ffe066';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(-6, -16, 3.8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#f0c451';
      ctx.beginPath();
      ctx.moveTo(-6, -6);
      ctx.lineTo(0, -3);
      ctx.lineTo(-6, 0);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // Nameplate under table
    ctx.fillStyle = table.guest.critic ? '#ffe073' : '#e0caa6';
    ctx.font = '800 9.5px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(table.guest.name.toUpperCase(), DINING_X + 78, ty + 47);

    // Floating Delight Reaction OR Craving Bubble
    if (table.delightTimer > 0) {
      ctx.fillStyle = '#1d7a44';
      ctx.strokeStyle = '#ffe066';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.roundRect(DINING_X + 52, ty - 54, 72, 20, 10);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fff9d6';
      ctx.font = '900 10.5px "Trebuchet MS", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(table.lastTipText, DINING_X + 88, ty - 43.5);
    } else if (wantedTicket) {
      // Subtle craving thought bubble pointing at active ticket dish
      ctx.fillStyle = 'rgba(251, 244, 227, 0.94)';
      ctx.strokeStyle = table.guest.critic ? '#e8b030' : '#9e7c52';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(DINING_X + 108, ty - 44, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      drawDishPreview(ctx, wantedTicket.recipeId, DINING_X + 108, ty - 44, 12, false);
    }
  });

  ctx.restore();
}
