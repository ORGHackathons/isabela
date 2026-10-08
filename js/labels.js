/* ==========================================================================
   Isabela Palhano — gerador procedural de rótulos
   --------------------------------------------------------------------------
   Cada rótulo é uma arte-final planificada (2048 × 980 px ≈ 207 × 99 mm)
   desenhada em Canvas 2D e depois aplicada no corpo da lata em 3D.
   • A frente da lata fica no centro do canvas (x = 1024); a emenda fica nas bordas.
   • Junto da arte é gerado um mapa "ORM" (canal G = rugosidade, B = metal),
     que diz ao material 3D onde o alumínio aparece, onde é fosco, onde é foil.
   ========================================================================== */

export const W = 2048;
export const H = 980;
const TAU = Math.PI * 2;
const FX = W / 2; // centro da frente

/* ---------- utilitários ---------- */

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mk(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// cor do mapa ORM: G = rugosidade, B = metal
const mat = (rough, metal) => `rgb(0,${Math.round(rough * 255)},${Math.round(metal * 255)})`;
const INK = mat(0.42, 0.18);
const FOIL = mat(0.3, 1);

function rr(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function setFont(c, size, family, weight = 400, style = 'normal') {
  c.font = `${style} ${weight} ${size}px "${family}"`;
}

function measureSpaced(c, str, spacing) {
  let w = 0;
  let n = 0;
  for (const ch of str) {
    w += c.measureText(ch).width;
    n++;
  }
  return w + spacing * (n - 1);
}

function text(c, str, x, y, o = {}) {
  const {
    size = 40, family = 'DM Sans', weight = 400, style = 'normal', color = '#000', align = 'center',
    spacing = 0, stroke = null, strokeWidth = 0, alpha = 1,
  } = o;
  c.save();
  c.globalAlpha *= alpha;
  setFont(c, size, family, weight, style);
  c.textBaseline = 'alphabetic';
  c.textAlign = 'left';
  c.lineJoin = 'round';
  const total = spacing ? measureSpaced(c, str, spacing) : c.measureText(str).width;
  const x0 = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  const pass = (fn) => {
    if (!spacing) return fn(str, x0);
    let px = x0;
    for (const ch of str) {
      fn(ch, px);
      px += c.measureText(ch).width + spacing;
    }
  };
  if (stroke) {
    c.strokeStyle = stroke;
    c.lineWidth = strokeWidth;
    pass((s, px) => c.strokeText(s, px, y));
  }
  if (color) {
    c.fillStyle = color;
    pass((s, px) => c.fillText(s, px, y));
  }
  c.restore();
  return total;
}

// maior tamanho de fonte que cabe em maxW
function fit(c, str, family, maxW, maxSize, weight = 400, style = 'normal', spacing = 0) {
  setFont(c, 100, family, weight, style);
  const w100 = c.measureText(str).width;
  const n = [...str].length;
  return Math.min(maxSize, ((maxW - spacing * (n - 1)) * 100) / w100);
}

function capHeight(c, str, size, family, weight = 400, style = 'normal') {
  setFont(c, size, family, weight, style);
  return c.measureText(str).actualBoundingBoxAscent;
}

// desenha também do outro lado da emenda quando o elemento a atravessa
function wrapX(x, r, fn) {
  fn(x);
  if (x - r < 0) fn(x + W);
  if (x + r > W) fn(x - W);
}

function para(c, str, x, y, maxW, lh, o) {
  const { size = 18, family = 'DM Sans', weight = 400, color = '#000' } = o;
  setFont(c, size, family, weight);
  c.fillStyle = color;
  c.textAlign = 'left';
  c.textBaseline = 'alphabetic';
  let line = '';
  for (const word of str.split(' ')) {
    const test = line ? `${line} ${word}` : word;
    if (c.measureText(test).width > maxW && line) {
      c.fillText(line, x, y);
      line = word;
      y += lh;
    } else line = test;
  }
  if (line) c.fillText(line, x, y);
  return y + lh;
}

function curveText(c, str, cx, fy, o) {
  const { size, family = 'Anton', weight = 400, color, spacing = 0 } = o;
  c.save();
  setFont(c, size, family, weight);
  c.textAlign = 'center';
  c.textBaseline = 'alphabetic';
  c.fillStyle = color;
  const cap = c.measureText('H').actualBoundingBoxAscent;
  const chars = [...str];
  const ws = chars.map((ch) => c.measureText(ch).width);
  const total = ws.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
  let x = cx - total / 2;
  chars.forEach((ch, i) => {
    const mx = x + ws[i] / 2;
    const a = Math.atan2(fy(mx + 1) - fy(mx - 1), 2);
    c.save();
    c.translate(mx, fy(mx));
    c.rotate(a);
    c.fillText(ch, 0, cap / 2);
    c.restore();
    x += ws[i] + spacing;
  });
  c.restore();
}

function circleText(c, str, x, y, r, o) {
  const { size = 22, family = 'DM Sans', weight = 700, color = '#fff', spacing = 2, start = -Math.PI / 2 } = o;
  c.save();
  setFont(c, size, family, weight);
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillStyle = color;
  const chars = [...str];
  const ws = chars.map((ch) => c.measureText(ch).width + spacing);
  const total = ws.reduce((a, b) => a + b, 0);
  let acc = start - total / r / 2;
  chars.forEach((ch, i) => {
    const a = acc + ws[i] / 2 / r;
    c.save();
    c.translate(x + Math.cos(a) * r, y + Math.sin(a) * r);
    c.rotate(a + Math.PI / 2);
    c.fillText(ch, 0, 0);
    c.restore();
    acc += ws[i] / r;
  });
  c.restore();
}

function star4(c, x, y, r, color) {
  c.save();
  c.fillStyle = color;
  c.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU - Math.PI / 2;
    const rad = i % 2 ? r * 0.26 : r;
    c.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
  }
  c.closePath();
  c.fill();
  c.restore();
}

function sunburst(c, x, y, rays, radius, color) {
  const g = c.createRadialGradient(x, y, 0, x, y, radius);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g;
  c.beginPath();
  for (let i = 0; i < rays; i++) {
    const a0 = (i / rays) * TAU;
    const a1 = ((i + 0.5) / rays) * TAU;
    c.moveTo(x, y);
    c.lineTo(x + Math.cos(a0) * radius, y + Math.sin(a0) * radius);
    c.lineTo(x + Math.cos(a1) * radius, y + Math.sin(a1) * radius);
    c.closePath();
  }
  c.fill();
}

function bubbles(c, rand, n, o = {}) {
  const { y0 = 0, y1 = H, rMin = 3, rMax = 22, color = '255,255,255', aMin = 0.14, aMax = 0.45, bias = 1.6 } = o;
  for (let i = 0; i < n; i++) {
    const x = rand() * W;
    const y = y1 - (y1 - y0) * Math.pow(rand(), bias);
    const r = rMin + (rMax - rMin) * Math.pow(rand(), 2.2);
    const a = aMin + (aMax - aMin) * rand();
    wrapX(x, r, (xx) => {
      c.beginPath();
      c.arc(xx, y, r, 0, TAU);
      c.fillStyle = `rgba(${color},${a * 0.25})`;
      c.fill();
      c.lineWidth = Math.max(1.5, r * 0.12);
      c.strokeStyle = `rgba(${color},${a})`;
      c.stroke();
      c.beginPath();
      c.arc(xx - r * 0.35, y - r * 0.35, r * 0.22, 0, TAU);
      c.fillStyle = `rgba(${color},${Math.min(1, a * 1.8)})`;
      c.fill();
    });
  }
}

function leaf(c, x, y, len, ang, wid, color, vein, veins = true) {
  c.save();
  c.translate(x, y);
  c.rotate(ang);
  c.beginPath();
  c.moveTo(0, 0);
  c.bezierCurveTo(len * 0.25, -wid, len * 0.7, -wid * 0.9, len, 0);
  c.bezierCurveTo(len * 0.7, wid * 0.9, len * 0.25, wid, 0, 0);
  c.fillStyle = color;
  c.fill();
  if (vein) {
    c.strokeStyle = vein;
    c.lineCap = 'round';
    c.lineWidth = Math.max(2, wid * 0.08);
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(len * 0.96, 0);
    c.stroke();
    if (veins) {
      c.lineWidth = Math.max(1.5, wid * 0.045);
      for (let t = 0.14; t < 0.86; t += 0.11) {
        const sw = Math.sin(Math.PI * t) * wid * 0.7;
        c.beginPath();
        c.moveTo(len * t, 0);
        c.quadraticCurveTo(len * (t + 0.05), -sw * 0.5, len * (t + 0.11), -sw);
        c.moveTo(len * t, 0);
        c.quadraticCurveTo(len * (t + 0.05), sw * 0.5, len * (t + 0.11), sw);
        c.stroke();
      }
    }
  }
  c.restore();
}

function barcode(c, x, y, w, h, rand, ink = '#111', bg = '#fff') {
  c.save();
  c.fillStyle = bg;
  rr(c, x - 16, y - 16, w + 32, h + 58, 8);
  c.fill();
  let bits = '101';
  for (let i = 0; i < 42; i++) bits += rand() < 0.5 ? '1' : '0';
  bits += '01010';
  for (let i = 0; i < 42; i++) bits += rand() < 0.5 ? '1' : '0';
  bits += '101';
  const mw = w / bits.length;
  c.fillStyle = ink;
  [...bits].forEach((b, i) => {
    if (b !== '1') return;
    const guard = i < 3 || i > bits.length - 4 || (i >= 45 && i <= 49);
    c.fillRect(x + i * mw, y, mw + 0.3, guard ? h + 12 : h);
  });
  let num = '7 89';
  for (let i = 0; i < 10; i++) num += (i === 4 ? ' ' : '') + Math.floor(rand() * 10);
  text(c, num, x + w / 2, y + h + 34, { size: 20, family: 'DM Sans', color: ink, spacing: 3 });
  c.restore();
}

function recycle(c, x, y, r, color) {
  c.save();
  c.strokeStyle = color;
  c.fillStyle = color;
  c.lineWidth = r * 0.17;
  c.lineCap = 'round';
  for (let k = 0; k < 3; k++) {
    const a0 = (k * TAU) / 3 - Math.PI / 2 + 0.3;
    const a1 = a0 + TAU / 3 - 0.75;
    c.beginPath();
    c.arc(x, y, r, a0, a1);
    c.stroke();
    const px = x + Math.cos(a1) * r;
    const py = y + Math.sin(a1) * r;
    const tx = -Math.sin(a1);
    const ty = Math.cos(a1);
    const nx = Math.cos(a1);
    const ny = Math.sin(a1);
    const s = r * 0.36;
    c.beginPath();
    c.moveTo(px + tx * s, py + ty * s);
    c.lineTo(px + nx * s * 0.75, py + ny * s * 0.75);
    c.lineTo(px - nx * s * 0.75, py - ny * s * 0.75);
    c.closePath();
    c.fill();
  }
  c.restore();
}

// verso da lata: tabela nutricional, ingredientes, código de barras, reciclagem e créditos
function backPanel(c, o, b) {
  const { ink = '#fff', sub = ink, panel = null, kcal = 140, sugar = 35, ingredients = '', seed = 7, band = false } = b;
  const rand = rng(seed);
  // "band": a frente tem uma faixa que dá a volta na lata, então o verso se reorganiza acima/abaixo dela
  const L = band
    ? { ty: 96, row: 34, ing: 120, bar: [170, 770], rec: [1700, 800], credit: 420, fict: 900 }
    : { ty: 250, row: 42, ing: 270, bar: [170, 590], rec: [1700, 750], credit: 860, fict: 850 };
  const tx = 1640;
  const ty = L.ty;
  const tw = 290;
  const th = 96 + 6 * L.row + 30;
  const box = (x, y, w, h) => {
    if (!panel) return;
    c.fillStyle = panel;
    rr(c, x, y, w, h, 12);
    c.fill();
    o.fillStyle = INK;
    rr(o, x, y, w, h, 12);
    o.fill();
  };
  box(tx - 20, ty - 20, tw + 40, th + 40);
  box(126, L.ing - 40, 356, 190);
  box(120, L.credit - 44, 330, 64);
  box(1652, L.rec[1] - 56, 300, 110);
  c.strokeStyle = ink;
  c.lineWidth = 3;
  c.strokeRect(tx, ty, tw, th);
  text(c, 'INFORMAÇÃO NUTRICIONAL', tx + tw / 2, ty + 38, { size: 21, weight: 700, color: ink, spacing: 1 });
  c.fillStyle = ink;
  c.fillRect(tx, ty + 54, tw, 6);
  const rows = [
    ['Porção: 350 ml (1 lata)', ''],
    ['Valor energético', `${kcal} kcal`],
    ['Carboidratos', `${sugar} g`],
    ['Açúcares totais', `${sugar} g`],
    ['Proteínas', '0 g'],
    ['Gorduras totais', '0 g'],
    ['Sódio', '21 mg'],
  ];
  rows.forEach(([k, v], i) => {
    const yy = ty + 96 + i * L.row;
    text(c, k, tx + 14, yy, { size: 19, color: ink, align: 'left' });
    if (v) text(c, v, tx + tw - 14, yy, { size: 19, weight: 700, color: ink, align: 'right' });
    c.fillStyle = ink;
    c.globalAlpha = 0.5;
    c.fillRect(tx + 10, yy + 13, tw - 20, 1.5);
    c.globalAlpha = 1;
  });
  // ingredientes
  text(c, 'INGREDIENTES', 150, L.ing, { size: 21, weight: 700, color: ink, align: 'left', spacing: 2 });
  para(c, ingredients, 150, L.ing + 34, 300, 27, { size: 19, color: sub });
  // código de barras
  barcode(c, L.bar[0], L.bar[1], 230, 110, rand);
  o.fillStyle = INK;
  rr(o, L.bar[0] - 16, L.bar[1] - 16, 262, 168, 8);
  o.fill();
  // reciclagem
  const [rx, ry] = L.rec;
  recycle(c, rx, ry, 34, ink);
  text(c, 'ALUMÍNIO', rx + 56, ry - 8, { size: 20, weight: 700, color: ink, align: 'left', spacing: 2 });
  text(c, '100% RECICLÁVEL', rx + 56, ry + 18, { size: 20, weight: 700, color: ink, align: 'left', spacing: 2 });
  // créditos
  text(c, 'design: Isabela Palhano', 285, L.credit, { size: 34, family: 'Instrument Serif', style: 'italic', color: sub });
  text(c, 'MARCA FICTÍCIA · PROJETO AUTORAL', 1785, L.fict, { size: 16, weight: 700, color: sub, spacing: 3 });
}

/* ==========================================================================
   COLEÇÃO DE LATAS
   ========================================================================== */

// 01 — FIZZA · cola de cereja
function drawFizza(c, o) {
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#ef1b26');
  g.addColorStop(0.55, '#d10f1c');
  g.addColorStop(1, '#9c0914');
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
  sunburst(c, FX, 360, 44, 960, 'rgba(255,255,255,.16)');
  bubbles(c, rng(11), 170, { y0: 60, rMax: 24, bias: 1.4 });

  // faixa ondulada em alumínio aparente
  const fy = (x) => 610 + 34 * Math.sin((x / W) * TAU * 2 + Math.PI / 2);
  const band = (ctx, half, fill) => {
    ctx.beginPath();
    for (let x = 0; x <= W; x += 8) ctx.lineTo(x, fy(x) - half);
    for (let x = W; x >= 0; x -= 8) ctx.lineTo(x, fy(x) + half);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  };
  band(c, 74, '#7a0710');
  const sg = c.createLinearGradient(0, 530, 0, 700);
  sg.addColorStop(0, '#fbfbfa');
  sg.addColorStop(0.42, '#c8cbd0');
  sg.addColorStop(0.56, '#eef0f2');
  sg.addColorStop(1, '#a3a8af');
  band(c, 62, sg);
  band(o, 62, FOIL);
  for (let k = 0; k < 4; k++) {
    curveText(c, 'COLA DE CEREJA', 256 + k * 512, fy, { size: 58, color: '#a10c17', spacing: 7 });
    curveText(o, 'COLA DE CEREJA', 256 + k * 512, fy, { size: 58, color: INK, spacing: 7 });
    wrapX(k * 512, 20, (xx) => star4(c, xx, fy(xx), 22, '#a10c17'));
  }

  // logotipo
  text(c, 'REFRIGERANTE  ·  SABOR', FX, 140, { size: 38, family: 'Anton', color: '#ffe7d1', spacing: 10 });
  const ls = fit(c, 'Fizza', 'Lobster', 700, 330);
  text(c, 'Fizza', FX + 7, 452, { size: ls, family: 'Lobster', color: '#6d0610' });
  text(c, 'Fizza', FX, 438, { size: ls, family: 'Lobster', color: '#fff8ef', stroke: '#fff8ef', strokeWidth: 3 });
  c.beginPath();
  c.moveTo(770, 486);
  c.quadraticCurveTo(1030, 528, 1310, 470);
  c.quadraticCurveTo(1030, 548, 770, 486);
  c.fillStyle = '#fff8ef';
  c.fill();

  // cerejas
  cherries(c, FX, 852, 42);
  text(c, '350 ml', 760, 880, { size: 40, weight: 700, color: '#ffe7d1' });
  text(c, 'CEREJA', 1290, 880, { size: 42, family: 'Anton', color: '#ffe7d1', spacing: 6 });

  // selos laterais
  [FX - 466, FX + 466].forEach((sx) => {
    c.strokeStyle = '#ffe7d1';
    c.lineWidth = 4;
    c.beginPath();
    c.arc(sx, 320, 106, 0, TAU);
    c.stroke();
    c.lineWidth = 2;
    c.beginPath();
    c.arc(sx, 320, 76, 0, TAU);
    c.stroke();
    circleText(c, 'FORTALEZA · CEARÁ · BRASIL ·', sx, 320, 91, { size: 19, color: '#ffe7d1', spacing: 3 });
    text(c, 'EST.', sx, 300, { size: 22, weight: 700, color: '#ffe7d1', spacing: 4 });
    text(c, '2026', sx, 356, { size: 50, family: 'Anton', color: '#ffe7d1' });
  });

  backPanel(c, o, {
    ink: '#fff2e6', sub: 'rgba(255,242,230,.85)', kcal: 147, sugar: 37, seed: 21, band: true,
    ingredients: 'Água gaseificada, açúcar, extrato de noz-de-cola, suco de cereja, cafeína, aroma natural de baunilha e acidulante ácido cítrico.',
  });
}

function cherries(c, x, y, r) {
  c.save();
  c.lineCap = 'round';
  c.strokeStyle = '#2f5a1a';
  c.lineWidth = r * 0.15;
  const top = [x + 8, y - r * 2.7];
  c.beginPath();
  c.moveTo(x - r * 1.05, y - r * 0.8);
  c.quadraticCurveTo(x - r * 0.6, y - r * 2.1, top[0], top[1]);
  c.moveTo(x + r * 1.05, y - r * 0.6);
  c.quadraticCurveTo(x + r * 0.9, y - r * 1.9, top[0], top[1]);
  c.stroke();
  leaf(c, top[0], top[1], r * 1.6, -0.35, r * 0.45, '#3f8a2a', '#9fd27a', false);
  [[x - r * 1.05, y], [x + r * 1.05, y + r * 0.2]].forEach(([cx, cy]) => {
    const g = c.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.1, cx, cy, r);
    g.addColorStop(0, '#ff6b74');
    g.addColorStop(0.55, '#d0101f');
    g.addColorStop(1, '#5e0010');
    c.fillStyle = g;
    c.beginPath();
    c.arc(cx, cy, r, 0, TAU);
    c.fill();
    c.strokeStyle = '#4a0008';
    c.lineWidth = 4;
    c.stroke();
    c.fillStyle = 'rgba(255,255,255,.75)';
    c.beginPath();
    c.ellipse(cx - r * 0.38, cy - r * 0.38, r * 0.24, r * 0.12, -0.7, 0, TAU);
    c.fill();
  });
  c.restore();
}

// 02 — TROPIK · maracujá & manga
function drawTropik(c, o) {
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#ffd84a');
  g.addColorStop(0.5, '#ffb321');
  g.addColorStop(1, '#ff7a1f');
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);

  // sol poente listrado (anos 70)
  const sun = mk(720, 720);
  const s = sun.getContext('2d');
  const sg = s.createLinearGradient(0, 0, 0, 720);
  sg.addColorStop(0, '#fff6c4');
  sg.addColorStop(1, '#ffd23f');
  s.fillStyle = sg;
  s.beginPath();
  s.arc(360, 360, 340, 0, TAU);
  s.fill();
  for (let k = 0; k < 8; k++) s.clearRect(0, 392 + k * 40, 720, 4 + k * 3.4);
  c.drawImage(sun, FX - 360, 470 - 360);

  // folhagem
  const rand = rng(5);
  const greens = ['#0f7a43', '#14a25a', '#0b5c33', '#1fb866'];
  const leafAt = (x, y, len, ang, wid) => {
    const col = greens[Math.floor(rand() * greens.length)];
    wrapX(x, len, (xx) => leaf(c, xx, y, len, ang, wid, col, 'rgba(190,255,210,.55)'));
  };
  for (let i = 0; i < 16; i++) {
    const x = (i / 16) * W + rand() * 60;
    const near = Math.abs(x - FX) < 380;
    leafAt(x, H + 30, (near ? 90 : 260) + rand() * (near ? 40 : 110), -Math.PI / 2 + (rand() - 0.5) * 1.3, (near ? 36 : 52) + rand() * 26);
  }
  for (let i = 0; i < 14; i++) {
    const x = (i / 14) * W + rand() * 60;
    if (Math.abs(x - FX) < 330) continue;
    leafAt(x, -30, 220 + rand() * 120, Math.PI / 2 + (rand() - 0.5) * 1.2, 46 + rand() * 26);
  }
  passion(c, 640, 560, 84, rng(9));
  passion(c, 1418, 300, 70, rng(10));
  const sp = rng(3);
  for (let i = 0; i < 26; i++) star4(c, sp() * W, 120 + sp() * 700, 8 + sp() * 14, 'rgba(255,255,255,.85)');

  // logotipo empilhado com extrusão
  const size = fit(c, 'TRO', 'Bungee', 560, 250);
  const cap = capHeight(c, 'TRO', size, 'Bungee');
  const gap = 28;
  const b1 = 480 - (cap * 2 + gap) / 2 + cap;
  const b2 = b1 + cap + gap;
  ['TRO', 'PIK'].forEach((word, i) => {
    const y = i ? b2 : b1;
    for (let d = 16; d > 0; d--) text(c, word, FX + d * 1.4, y + d * 1.8, { size, family: 'Bungee', color: '#c2410c' });
    text(c, word, FX, y, { size, family: 'Bungee', color: '#2b0f63' });
  });
  text(c, 'soda tropical do nordeste', FX, 150, { size: 62, family: 'Instrument Serif', style: 'italic', color: '#2b0f63' });
  text(c, 'MARACUJÁ + MANGA', FX, 845, { size: 66, family: 'Anton', color: '#2b0f63', spacing: 6 });

  backPanel(c, o, {
    ink: '#2b0f63', panel: 'rgba(255,248,220,.82)', kcal: 132, sugar: 33, seed: 22,
    ingredients: 'Água gaseificada, suco de maracujá (8%), polpa de manga (6%), açúcar, aroma natural e acidulante ácido cítrico.',
  });
}

function passion(c, x, y, r, rand) {
  c.save();
  c.fillStyle = '#4a1450';
  c.beginPath();
  c.arc(x, y, r, 0, TAU);
  c.fill();
  c.fillStyle = '#f8f0d0';
  c.beginPath();
  c.arc(x, y, r * 0.86, 0, TAU);
  c.fill();
  c.fillStyle = '#ffb81f';
  c.beginPath();
  c.arc(x, y, r * 0.74, 0, TAU);
  c.fill();
  for (let i = 0; i < 28; i++) {
    const a = rand() * TAU;
    const d = Math.sqrt(rand()) * r * 0.62;
    const sx = x + Math.cos(a) * d;
    const sy = y + Math.sin(a) * d;
    c.fillStyle = 'rgba(255,236,150,.9)';
    c.beginPath();
    c.ellipse(sx, sy, r * 0.09, r * 0.07, a, 0, TAU);
    c.fill();
    c.fillStyle = '#2a1a10';
    c.beginPath();
    c.ellipse(sx, sy, r * 0.05, r * 0.035, a, 0, TAU);
    c.fill();
  }
  c.restore();
}

// 03 — ONDA · energético de açaí
function drawOnda(c, o) {
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#12032a');
  g.addColorStop(0.6, '#2a0656');
  g.addColorStop(1, '#4b0d7c');
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
  const rg = c.createRadialGradient(FX, 470, 0, FX, 470, 560);
  rg.addColorStop(0, 'rgba(255,47,180,.4)');
  rg.addColorStop(1, 'rgba(255,47,180,0)');
  c.fillStyle = rg;
  c.fillRect(0, 0, W, H);

  // ondas em alumínio aparente
  const from = [255, 47, 180];
  const to = [198, 255, 61];
  for (let k = 0; k < 24; k++) {
    const y0 = 30 + k * 40;
    const amp = 22 + 8 * Math.sin(k);
    const ph = k * 0.45;
    const t = k / 23;
    const col = `rgb(${from.map((v, i) => Math.round(v + (to[i] - v) * t)).join(',')})`;
    const lw = k % 3 === 0 ? 7 : 3;
    [c, o].forEach((ctx) => {
      ctx.beginPath();
      for (let x = 0; x <= W; x += 6) ctx.lineTo(x, y0 + amp * Math.sin((x / W) * TAU * 3 + ph));
      ctx.lineWidth = lw;
      ctx.strokeStyle = ctx === c ? col : FOIL;
      ctx.stroke();
    });
  }
  // placa escura atrás do logo
  [c, o].forEach((ctx) => {
    const pg = ctx.createRadialGradient(FX, 470, 0, FX, 470, 470);
    pg.addColorStop(0, ctx === c ? 'rgba(14,2,32,.95)' : 'rgba(0,107,46,1)');
    pg.addColorStop(0.6, ctx === c ? 'rgba(14,2,32,.85)' : 'rgba(0,107,46,.85)');
    pg.addColorStop(1, ctx === c ? 'rgba(14,2,32,0)' : 'rgba(0,107,46,0)');
    ctx.fillStyle = pg;
    ctx.fillRect(FX - 520, 0, 1040, H);
  });

  const size = fit(c, 'ONDA', 'Anton', 690, 360);
  const cap = capHeight(c, 'ONDA', size, 'Anton');
  const base = 470 + cap / 2;
  text(c, 'ONDA', FX - 10, base, { size, family: 'Anton', color: '#ff2fb4' });
  text(c, 'ONDA', FX + 10, base, { size, family: 'Anton', color: '#2ff3ff' });
  text(c, 'ONDA', FX, base, { size, family: 'Anton', color: '#ffffff' });
  text(c, 'ENERGY  ·  AÇAÍ  ·  GUARANÁ', FX, 150, { size: 28, weight: 700, color: 'rgba(255,255,255,.88)', spacing: 10 });
  const tw = text(c, 'ENERGÉTICO DE AÇAÍ', FX, 760, { size: 64, family: 'Anton', color: '#c6ff3d', spacing: 6 });
  bolt(c, FX - tw / 2 - 50, 735, 34, '#c6ff3d');
  bolt(c, FX + tw / 2 + 50, 735, 34, '#c6ff3d');
  text(c, '+ GUARANÁ DA AMAZÔNIA', FX, 830, { size: 26, weight: 700, color: 'rgba(255,255,255,.8)', spacing: 8 });

  // nome vertical nas laterais
  [FX - 500, FX + 500].forEach((sx, i) => {
    c.save();
    c.translate(sx, 490);
    c.rotate(i ? Math.PI / 2 : -Math.PI / 2);
    text(c, 'ONDA', 0, 60, { size: 170, family: 'Anton', color: null, stroke: 'rgba(255,255,255,.5)', strokeWidth: 3, spacing: 8 });
    c.restore();
  });

  backPanel(c, o, {
    ink: '#ffffff', sub: 'rgba(255,255,255,.82)', panel: 'rgba(18,3,42,.9)', kcal: 158, sugar: 39, seed: 23,
    ingredients: 'Água gaseificada, açúcar, extrato de açaí, extrato de guaraná, taurina, cafeína (32 mg/100 ml), vitaminas B3, B6 e B12.',
  });
}

function bolt(c, x, y, s, color) {
  c.save();
  c.translate(x, y);
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(0.15 * s, -1 * s);
  c.lineTo(-0.55 * s, 0.12 * s);
  c.lineTo(-0.02 * s, 0.12 * s);
  c.lineTo(-0.2 * s, 1 * s);
  c.lineTo(0.55 * s, -0.18 * s);
  c.lineTo(0.02 * s, -0.18 * s);
  c.closePath();
  c.fill();
  c.restore();
}

// 04 — CAJU CLUB · soda de caju (homenagem ao Ceará / cordel)
function drawCaju(c, o) {
  const ink = '#1d1611';
  c.fillStyle = '#f3e3c3';
  c.fillRect(0, 0, W, H);
  const rand = rng(41);
  for (let i = 0; i < 2600; i++) {
    c.fillStyle = `rgba(138,106,58,${0.04 + rand() * 0.09})`;
    c.beginPath();
    c.arc(rand() * W, rand() * H, 0.6 + rand() * 1.4, 0, TAU);
    c.fill();
  }
  // faixa inferior em zigue-zague
  c.fillStyle = ink;
  c.fillRect(0, 915, W, H - 915);
  c.beginPath();
  for (let x = 0; x < W; x += 32) {
    c.moveTo(x, 916);
    c.lineTo(x + 16, 893);
    c.lineTo(x + 32, 916);
  }
  c.fill();

  // bandeirinhas
  const flags = ['#d6452b', '#f2b632', '#2f7d4f', '#2b5c9e'];
  const sy = (x) => 34 + 46 * Math.sin((Math.PI * (((x % 512) + 512) % 512)) / 512);
  c.strokeStyle = ink;
  c.lineWidth = 3;
  c.beginPath();
  for (let x = 0; x <= W; x += 4) c.lineTo(x, sy(x));
  c.stroke();
  let fi = 0;
  for (let seg = 0; seg < 4; seg++) {
    for (let f = 0; f < 8; f++) {
      const x0 = seg * 512 + 18 + f * 60;
      const x1 = x0 + 44;
      c.beginPath();
      c.moveTo(x0, sy(x0));
      c.lineTo(x1, sy(x1));
      c.lineTo((x0 + x1) / 2, (sy(x0) + sy(x1)) / 2 + 64);
      c.closePath();
      c.fillStyle = flags[fi++ % 4];
      c.fill();
      c.lineWidth = 3;
      c.stroke();
    }
  }

  // sol em xilogravura
  const cx = FX;
  const cy = 345;
  c.fillStyle = ink;
  for (let k = 0; k < 22; k++) {
    const a = (k / 22) * TAU;
    const r1 = k % 2 ? 222 : 192;
    c.beginPath();
    c.moveTo(cx + Math.cos(a - 0.07) * 148, cy + Math.sin(a - 0.07) * 148);
    c.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    c.lineTo(cx + Math.cos(a + 0.07) * 148, cy + Math.sin(a + 0.07) * 148);
    c.closePath();
    c.fill();
  }
  c.fillStyle = '#f2b632';
  c.beginPath();
  c.arc(cx, cy, 130, 0, TAU);
  c.fill();
  c.lineWidth = 7;
  c.stroke();

  // caju
  c.lineCap = 'round';
  c.strokeStyle = ink;
  c.lineWidth = 7;
  c.beginPath();
  c.moveTo(cx, 250);
  c.quadraticCurveTo(cx + 4, 228, cx + 12, 212);
  c.stroke();
  leaf(c, cx + 10, 220, 92, -0.55, 26, '#2f7d4f', ink, false);
  const apple = new Path2D();
  apple.moveTo(cx - 40, 252);
  apple.bezierCurveTo(cx - 84, 270, cx - 94, 330, cx - 79, 390);
  apple.bezierCurveTo(cx - 66, 440, cx + 66, 440, cx + 79, 390);
  apple.bezierCurveTo(cx + 94, 330, cx + 84, 270, cx + 40, 252);
  apple.bezierCurveTo(cx + 26, 244, cx - 26, 244, cx - 40, 252);
  const ag = c.createLinearGradient(0, 250, 0, 430);
  ag.addColorStop(0, '#f39a3c');
  ag.addColorStop(1, '#d8342a');
  c.fillStyle = ag;
  c.fill(apple);
  c.save();
  c.clip(apple);
  c.lineWidth = 4;
  for (let i = 0; i < 12; i++) {
    c.beginPath();
    c.moveTo(cx + 18 + i * 15, 230);
    c.lineTo(cx - 70 + i * 15, 460);
    c.stroke();
  }
  c.restore();
  c.lineWidth = 7;
  c.stroke(apple);
  c.strokeStyle = '#fff3d6';
  c.lineWidth = 8;
  c.beginPath();
  c.moveTo(cx - 56, 300);
  c.quadraticCurveTo(cx - 66, 350, cx - 54, 392);
  c.stroke();
  const nut = new Path2D();
  nut.moveTo(cx - 38, 428);
  nut.bezierCurveTo(cx - 70, 470, cx - 36, 516, cx + 8, 504);
  nut.bezierCurveTo(cx + 52, 494, cx + 60, 452, cx + 36, 446);
  nut.bezierCurveTo(cx + 20, 442, cx + 12, 468, cx - 8, 462);
  nut.bezierCurveTo(cx - 24, 456, cx - 22, 434, cx - 38, 428);
  c.fillStyle = '#a3a868';
  c.fill(nut);
  c.strokeStyle = ink;
  c.lineWidth = 6;
  c.stroke(nut);

  // mandacarus nas laterais
  [FX - 470, FX + 470].forEach((x, i) => cactus(c, x, 915, 300 + i * 30, ink));

  // tipografia
  const size = fit(c, 'CAJU', 'Anton', 560, 240, 400, 'normal', 10);
  text(c, 'CAJU', FX - 50, 770, { size, family: 'Anton', color: ink, spacing: 10 });
  text(c, 'club', FX + 250, 838, {
    size: 132, family: 'Instrument Serif', style: 'italic', color: '#d8342a', stroke: '#f3e3c3', strokeWidth: 14,
  });
  text(c, 'SODA ARTESANAL  ·  FORTALEZA – CE', FX, 872, { size: 24, weight: 700, color: ink, spacing: 6 });

  backPanel(c, o, {
    ink, sub: '#3a2c20', kcal: 119, sugar: 29, seed: 24,
    ingredients: 'Água gaseificada, suco integral de caju (12%), açúcar mascavo, rapadura e aroma natural de caju.',
  });
}

function cactus(c, x, base, h, ink) {
  c.save();
  c.lineCap = 'round';
  c.lineJoin = 'round';
  const arm = (pts, w) => {
    c.beginPath();
    pts.forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py)));
    c.strokeStyle = ink;
    c.lineWidth = w + 10;
    c.stroke();
    c.strokeStyle = '#2f7d4f';
    c.lineWidth = w;
    c.stroke();
  };
  arm([[x - 10, base - h * 0.42], [x - 70, base - h * 0.42], [x - 70, base - h * 0.78]], 38);
  arm([[x + 10, base - h * 0.6], [x + 62, base - h * 0.6], [x + 62, base - h * 0.9]], 34);
  c.fillStyle = '#2f7d4f';
  rr(c, x - 28, base - h, 56, h + 20, 28);
  c.fill();
  c.strokeStyle = ink;
  c.lineWidth = 5;
  c.stroke();
  c.lineWidth = 3;
  c.globalAlpha = 0.6;
  [-10, 10].forEach((dx) => {
    c.beginPath();
    c.moveTo(x + dx, base - h + 24);
    c.lineTo(x + dx, base);
    c.stroke();
  });
  c.restore();
}

// 05 — CITRA · tônica de limão siciliano (fosco + hot stamping)
function drawCitra(c, o) {
  const dark = '#173523';
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#f3f6ea');
  g.addColorStop(1, '#dce7cb');
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);

  const gold = c.createLinearGradient(0, 0, 0, H);
  ['#9c7a2c', '#f3dd94', '#c39a3c', '#f6e6a8', '#a7822f'].forEach((col, i) => gold.addColorStop(i / 4, col));
  const foil = (fn) => {
    fn(c, gold);
    fn(o, FOIL);
  };
  foil((ctx, f) => {
    ctx.fillStyle = f;
    ctx.fillRect(0, 54, W, 4);
    ctx.fillRect(0, 66, W, 2);
    ctx.fillRect(0, H - 58, W, 4);
    ctx.fillRect(0, H - 68, W, 2);
    [650, 1398].forEach((x) => {
      ctx.fillRect(x - 1.5, 130, 3, H - 260);
      ctx.beginPath();
      ctx.moveTo(x, 104);
      ctx.lineTo(x + 12, 122);
      ctx.lineTo(x, 140);
      ctx.lineTo(x - 12, 122);
      ctx.closePath();
      ctx.moveTo(x, H - 140);
      ctx.lineTo(x + 12, H - 122);
      ctx.lineTo(x, H - 104);
      ctx.lineTo(x - 12, H - 122);
      ctx.closePath();
      ctx.fill();
    });
  });

  leaf(c, 1400, 200, 160, -0.9, 46, '#3e6d3a', '#a8c99a');
  leaf(c, 1440, 520, 160, 0.5, 42, '#4f7f45', '#a8c99a');
  lemonSlice(c, 1250, 360, 230);
  o.fillStyle = mat(0.62, 0.06);
  o.beginPath();
  o.arc(1250, 360, 232, 0, TAU);
  o.fill();
  lemonSlice(c, 770, 866, 80);
  lemonSlice(c, 300, 470, 70);
  lemonSlice(c, 1785, 150, 78);

  const size = fit(c, 'Citra', 'Instrument Serif', 560, 300, 400, 'italic');
  text(c, 'Citra', 1000, 560, { size, family: 'Instrument Serif', style: 'italic', color: dark, stroke: '#eef3e3', strokeWidth: 16 });
  text(c, 'Nº 05  —  MIXER PREMIUM', FX, 165, { size: 24, weight: 700, color: dark, spacing: 8 });
  text(c, 'ÁGUA TÔNICA', FX, 665, { size: 42, weight: 700, color: dark, spacing: 14 });
  text(c, 'limão siciliano & alecrim', FX, 735, { size: 52, family: 'Instrument Serif', style: 'italic', color: '#4a6a3a' });
  text(c, '350 ml', 1150, 860, { size: 28, weight: 700, color: dark, spacing: 4 });

  backPanel(c, o, {
    ink: dark, sub: '#2f4a36', kcal: 98, sugar: 24, seed: 25,
    ingredients: 'Água gaseificada, açúcar, suco de limão siciliano, quinino, extrato de alecrim e acidulante ácido cítrico.',
  });
}

function lemonSlice(c, x, y, r) {
  c.save();
  c.fillStyle = '#f2cf2a';
  c.beginPath();
  c.arc(x, y, r, 0, TAU);
  c.fill();
  c.strokeStyle = '#d9b11c';
  c.lineWidth = 3;
  c.stroke();
  c.fillStyle = '#fffbe3';
  c.beginPath();
  c.arc(x, y, r * 0.9, 0, TAU);
  c.fill();
  const n = 10;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * TAU + 0.05;
    const a1 = ((i + 1) / n) * TAU - 0.05;
    const am = (a0 + a1) / 2;
    const g = c.createRadialGradient(x, y, r * 0.1, x, y, r * 0.84);
    g.addColorStop(0, '#fff3a0');
    g.addColorStop(1, '#f6d332');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(x + Math.cos(am) * r * 0.12, y + Math.sin(am) * r * 0.12);
    c.arc(x, y, r * 0.84, a0, a1);
    c.closePath();
    c.fill();
    c.strokeStyle = 'rgba(255,251,224,.7)';
    c.lineWidth = Math.max(1.5, r * 0.012);
    for (let k = 1; k < 4; k++) {
      const aa = a0 + ((a1 - a0) * k) / 4;
      c.beginPath();
      c.moveTo(x + Math.cos(aa) * r * 0.3, y + Math.sin(aa) * r * 0.3);
      c.lineTo(x + Math.cos(aa) * r * 0.72, y + Math.sin(aa) * r * 0.72);
      c.stroke();
    }
  }
  c.fillStyle = '#fffbe3';
  c.beginPath();
  c.arc(x, y, r * 0.08, 0, TAU);
  c.fill();
  c.restore();
}

// 06 — NOIR · cola zero (preto soft-touch + foil dourado)
function drawNoir(c, o) {
  c.fillStyle = '#0c0c0e';
  c.fillRect(0, 0, W, H);
  c.fillStyle = '#141418';
  for (let x = 0; x < W; x += 16) c.fillRect(x, 0, 2, H);

  const gold = c.createLinearGradient(0, 0, 0, H);
  ['#8c6420', '#f6e3a1', '#c99a3a', '#f2d98a', '#a87b2a', '#f6e3a1', '#8c6420'].forEach((col, i) => gold.addColorStop(i / 6, col));
  const foil = (fn) => {
    fn(c, gold);
    fn(o, FOIL);
  };

  // leque art déco
  foil((ctx, f) => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(470, 0, W - 940, H);
    ctx.clip();
    ctx.strokeStyle = f;
    ctx.lineWidth = 2.5;
    for (let i = 0; i <= 28; i++) {
      const a = Math.PI + 0.22 + (i / 28) * (Math.PI - 0.44);
      ctx.beginPath();
      ctx.moveTo(FX, H + 40);
      ctx.lineTo(FX + Math.cos(a) * 820, H + 40 + Math.sin(a) * 820);
      ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = f;
    ctx.fillRect(0, 36, W, 3);
    ctx.fillRect(0, 46, W, 1.5);
    ctx.fillRect(0, H - 39, W, 3);
    ctx.fillRect(0, H - 47.5, W, 1.5);
  });

  // moldura octogonal
  const frame = (ctx, x0, y0, x1, y1, ch) => {
    ctx.beginPath();
    ctx.moveTo(x0 + ch, y0);
    ctx.lineTo(x1 - ch, y0);
    ctx.lineTo(x1, y0 + ch);
    ctx.lineTo(x1, y1 - ch);
    ctx.lineTo(x1 - ch, y1);
    ctx.lineTo(x0 + ch, y1);
    ctx.lineTo(x0, y1 - ch);
    ctx.lineTo(x0, y0 + ch);
    ctx.closePath();
  };
  frame(c, 744, 150, 1304, 840, 48);
  c.fillStyle = '#0c0c0e';
  c.fill();
  frame(o, 744, 150, 1304, 840, 48);
  o.fillStyle = mat(0.8, 0.12);
  o.fill();
  foil((ctx, f) => {
    ctx.strokeStyle = f;
    ctx.lineWidth = 4;
    frame(ctx, 744, 150, 1304, 840, 48);
    ctx.stroke();
    ctx.lineWidth = 1.5;
    frame(ctx, 760, 166, 1288, 824, 40);
    ctx.stroke();
    ctx.fillStyle = f;
    [[FX, 560], [FX - 470, 490], [FX + 470, 490]].forEach(([x, y], i) => {
      const s = i ? 46 : 14;
      ctx.beginPath();
      ctx.moveTo(x, y - s);
      ctx.lineTo(x + s * 0.7, y);
      ctx.lineTo(x, y + s);
      ctx.lineTo(x - s * 0.7, y);
      ctx.closePath();
      if (i) {
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, TAU);
      }
      ctx.fill();
    });
    ctx.fillRect(FX - 150, 559, 120, 2);
    ctx.fillRect(FX + 30, 559, 120, 2);
    text(ctx, 'COLA', FX, 290, { size: 30, weight: 700, color: f, spacing: 26 });
    const size = fit(c, 'NOIR', 'Instrument Serif', 460, 240, 400, 'normal', 26);
    text(ctx, 'NOIR', FX, 490, { size, family: 'Instrument Serif', color: f, spacing: 26 });
  });
  text(c, 'ZERO AÇÚCAR', FX, 630, { size: 30, weight: 700, color: '#ece6d6', spacing: 14 });
  text(o, 'ZERO AÇÚCAR', FX, 630, { size: 30, weight: 700, color: INK, spacing: 14 });
  text(c, 'baunilha & especiarias', FX, 700, { size: 46, family: 'Instrument Serif', style: 'italic', color: '#bfb6a0' });
  text(c, '350 ml', FX, 790, { size: 22, weight: 700, color: '#bfb6a0', spacing: 6 });

  backPanel(c, o, {
    ink: '#ece6d6', sub: '#bfb6a0', kcal: 0, sugar: 0, seed: 26,
    ingredients: 'Água gaseificada, extrato de noz-de-cola, baunilha, especiarias, edulcorante natural (estévia) e cafeína.',
  });
}

/* ==========================================================================
   RÓTULOS ESPECIAIS — rascunho (processo) e "sua marca aqui" (contato)
   ========================================================================== */

function drawSketch(c, o) {
  const rand = rng(77);
  c.fillStyle = '#f7f4ec';
  c.fillRect(0, 0, W, H);
  for (let x = 0; x <= W; x += 32) {
    c.fillStyle = x % 128 ? '#dbe6f0' : '#bfd2e6';
    c.fillRect(x, 0, x % 128 ? 1 : 2, H);
  }
  for (let y = 0; y <= H; y += 32) {
    c.fillStyle = y % 128 ? '#dbe6f0' : '#bfd2e6';
    c.fillRect(0, y, W, y % 128 ? 1 : 2);
  }
  o.fillStyle = mat(0.72, 0.02);
  o.fillRect(0, 0, W, H);

  c.save();
  c.setLineDash([18, 12]);
  c.strokeStyle = '#e6007e';
  c.lineWidth = 2;
  c.strokeRect(40, 40, W - 80, H - 80);
  c.strokeStyle = 'rgba(0,160,227,.7)';
  c.beginPath();
  c.moveTo(FX, 0);
  c.lineTo(FX, H);
  c.moveTo(0, 490);
  c.lineTo(W, 490);
  c.stroke();
  c.restore();

  const pencil = (fn, passes = 3, jit = 2.5, alpha = 0.55) => {
    for (let k = 0; k < passes; k++) {
      c.save();
      c.translate((rand() - 0.5) * jit * 2, (rand() - 0.5) * jit * 2);
      c.globalAlpha = alpha;
      fn();
      c.restore();
    }
  };
  const graphite = '#3d3d3d';

  // raios
  pencil(() => {
    c.strokeStyle = graphite;
    c.lineWidth = 1.2;
    c.globalAlpha = 0.25;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU;
      c.beginPath();
      c.moveTo(FX + Math.cos(a) * 160, 360 + Math.sin(a) * 160);
      c.lineTo(FX + Math.cos(a) * (420 + rand() * 300), 360 + Math.sin(a) * (420 + rand() * 300));
      c.stroke();
    }
  }, 1);

  // logo
  const ls = fit(c, 'Fizza', 'Lobster', 700, 330);
  pencil(() => text(c, 'Fizza', FX, 438, { size: ls, family: 'Lobster', color: null, stroke: graphite, strokeWidth: 2.4 }));
  pencil(() => {
    c.strokeStyle = graphite;
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(770, 486);
    c.quadraticCurveTo(1030, 528, 1310, 470);
    c.quadraticCurveTo(1030, 548, 770, 486);
    c.stroke();
  });
  pencil(() => text(c, 'REFRIGERANTE  ·  SABOR', FX, 140, { size: 38, family: 'Anton', color: null, stroke: graphite, strokeWidth: 1.4, spacing: 10 }), 2);

  // faixa
  const fy = (x) => 610 + 34 * Math.sin((x / W) * TAU * 2 + Math.PI / 2);
  pencil(() => {
    c.strokeStyle = graphite;
    c.lineWidth = 2;
    [-62, 62].forEach((d) => {
      c.beginPath();
      for (let x = 0; x <= W; x += 10) c.lineTo(x, fy(x) + d + (rand() - 0.5) * 1.5);
      c.stroke();
    });
    c.lineWidth = 1;
    c.globalAlpha = 0.25;
    for (let x = 1200; x < 1500; x += 14) {
      c.beginPath();
      c.moveTo(x, fy(x) - 60);
      c.lineTo(x - 40, fy(x) + 60);
      c.stroke();
    }
  });
  for (let k = 0; k < 4; k++) curveText(c, 'texto da faixa', 256 + k * 512, fy, { size: 46, family: 'Caveat', weight: 500, color: '#6b6b6b' });

  // cerejas
  pencil(() => {
    c.strokeStyle = graphite;
    c.lineWidth = 2.2;
    [[FX - 44, 852], [FX + 44, 860]].forEach(([x, y]) => {
      c.beginPath();
      c.arc(x, y, 42, 0, TAU);
      c.stroke();
    });
    c.beginPath();
    c.moveTo(FX - 44, 816);
    c.quadraticCurveTo(FX - 20, 760, FX + 8, 740);
    c.moveTo(FX + 44, 824);
    c.quadraticCurveTo(FX + 36, 770, FX + 8, 740);
    c.stroke();
  });

  // anotações de caneta
  const red = '#d63a2f';
  pencil(() => {
    c.strokeStyle = red;
    c.lineWidth = 4;
    c.beginPath();
    c.ellipse(FX, 380, 400, 150, -0.04, 0, TAU);
    c.stroke();
  }, 2, 4, 0.85);
  const note = (str, x, y, ax, ay, color = red, size = 50) => {
    text(c, str, x, y, { size, family: 'Caveat', weight: 700, color });
    c.save();
    c.strokeStyle = color;
    c.lineWidth = 3.5;
    c.lineCap = 'round';
    const sx = x;
    const sy2 = y + 16;
    c.beginPath();
    c.moveTo(sx, sy2);
    c.quadraticCurveTo((sx + ax) / 2, sy2 + 50, ax, ay);
    const a = Math.atan2(ay - (sy2 + 50), ax - (sx + ax) / 2);
    c.moveTo(ax, ay);
    c.lineTo(ax - Math.cos(a - 0.5) * 22, ay - Math.sin(a - 0.5) * 22);
    c.moveTo(ax, ay);
    c.lineTo(ax - Math.cos(a + 0.5) * 22, ay - Math.sin(a + 0.5) * 22);
    c.stroke();
    c.restore();
  };
  note('script retrô, mais peso!', 1530, 250, 1380, 340);
  note('faixa em alumínio aparente', 520, 470, 700, 570);
  note('cereja = sabor', 1330, 800, 1110, 850);
  text(c, 'vermelho Pantone 485 C?', 560, 200, { size: 46, family: 'Caveat', weight: 700, color: '#2b5c9e' });

  // cotas
  c.save();
  c.strokeStyle = '#2b5c9e';
  c.fillStyle = '#2b5c9e';
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(60, 20);
  c.lineTo(W - 60, 20);
  c.moveTo(60, 8);
  c.lineTo(60, 32);
  c.moveTo(W - 60, 8);
  c.lineTo(W - 60, 32);
  c.stroke();
  c.restore();
  text(c, '207 mm', 1500, 32, { size: 38, family: 'Caveat', weight: 700, color: '#2b5c9e', stroke: '#f7f4ec', strokeWidth: 10 });

  // verso esboçado
  pencil(() => {
    c.strokeStyle = graphite;
    c.lineWidth = 2;
    [[1640, 96, 290, 330], [154, 754, 262, 168]].forEach(([x, y, w, h]) => {
      c.strokeRect(x, y, w, h);
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + w, y + h);
      c.moveTo(x + w, y);
      c.lineTo(x, y + h);
      c.stroke();
    });
    for (let i = 0; i < 6; i++) {
      c.beginPath();
      c.moveTo(150, 130 + i * 34);
      for (let x = 150; x < 450 - (i === 5 ? 120 : 0); x += 12) c.lineTo(x, 130 + i * 34 + Math.sin(x * 0.2) * 3);
      c.stroke();
    }
  }, 2);
  text(c, 'tabela nutricional', 1785, 280, { size: 44, family: 'Caveat', weight: 700, color: '#6b6b6b', stroke: '#f7f4ec', strokeWidth: 10 });
  text(c, 'cód. barras', 285, 850, { size: 40, family: 'Caveat', weight: 700, color: '#6b6b6b', stroke: '#f7f4ec', strokeWidth: 10 });
  text(c, 'Isa — rascunho v1', 1780, 880, { size: 46, family: 'Caveat', weight: 700, color: graphite });
}

function drawYourBrand(c, o) {
  const rand = rng(99);
  c.fillStyle = '#cfd3d8';
  c.fillRect(0, 0, W, H);
  for (let i = 0; i < 1800; i++) {
    const y = rand() * H;
    const x = rand() * W;
    const len = 200 + rand() * 900;
    c.fillStyle = rand() < 0.5 ? `rgba(255,255,255,${0.04 + rand() * 0.1})` : `rgba(80,86,96,${0.03 + rand() * 0.07})`;
    wrapX(x + len / 2, len / 2, (xx) => c.fillRect(xx - len / 2, y, len, 1 + rand() * 1.5));
  }
  o.fillStyle = mat(0.36, 1);
  o.fillRect(0, 0, W, H);

  const ink = '#141414';
  const both = (fn) => {
    fn(c, false);
    fn(o, true);
  };
  c.save();
  c.setLineDash([22, 12]);
  c.lineWidth = 3;
  c.strokeStyle = '#e6007e';
  c.strokeRect(22, 22, W - 44, H - 44);
  c.lineWidth = 2;
  c.strokeStyle = '#00a0e3';
  c.strokeRect(70, 70, W - 140, H - 140);
  c.restore();
  [[110, 490], [W - 110, 490], [FX - 470, 120], [FX + 470, 120]].forEach(([x, y]) => {
    c.strokeStyle = ink;
    c.lineWidth = 2;
    c.beginPath();
    c.arc(x, y, 18, 0, TAU);
    c.moveTo(x - 30, y);
    c.lineTo(x + 30, y);
    c.moveTo(x, y - 30);
    c.lineTo(x, y + 30);
    c.stroke();
  });

  both((ctx, isO) => {
    text(ctx, 'ISABELA PALHANO  —  DESIGN DE RÓTULOS', FX, 170, { size: 26, weight: 700, color: isO ? INK : ink, spacing: 8 });
    const s1 = fit(c, 'SUA MARCA', 'Anton', 760, 230);
    text(ctx, 'SUA MARCA', FX, 470, { size: s1, family: 'Anton', color: isO ? INK : ink, spacing: 0 });
    const s2 = fit(c, 'AQUI', 'Anton', 520, 300);
    text(ctx, 'AQUI', FX, 760, { size: s2, family: 'Anton', color: isO ? INK : '#e6007e' });
    text(ctx, 'o próximo rótulo icônico pode ser o seu', FX, 860, { size: 56, family: 'Caveat', weight: 700, color: isO ? INK : ink });
  });

  ['#00a0e3', '#e6007e', '#ffed00', '#141414'].forEach((col, i) => {
    c.fillStyle = col;
    c.fillRect(1650 + i * 64, 820, 48, 48);
    o.fillStyle = INK;
    o.fillRect(1650 + i * 64, 820, 48, 48);
  });
  text(c, 'C     M     Y     K', 1770, 900, { size: 20, weight: 700, color: ink });
  text(c, 'ESPAÇO RESERVADO', 150, 290, { size: 22, weight: 700, color: ink, align: 'left', spacing: 3 });
  para(c, 'tabela nutricional · código de barras · ingredientes · selo de reciclagem · e tudo o que a sua marca precisar.', 150, 330, 320, 30, { size: 21, color: '#333' });
}

/* ==========================================================================
   EMBALAGENS — garrafa, pote e caixa
   ========================================================================== */

function drawBrota() {
  const w = 2048;
  const h = 575;
  const cv = mk(w, h);
  const c = cv.getContext('2d');
  const rand = rng(301);
  c.fillStyle = '#c89f6f';
  c.fillRect(0, 0, w, h);
  for (let i = 0; i < 3200; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const a = (rand() - 0.5) * 0.6;
    const l = 4 + rand() * 12;
    c.strokeStyle = rand() < 0.6 ? `rgba(90,60,30,${0.06 + rand() * 0.08})` : `rgba(255,240,210,${0.06 + rand() * 0.08})`;
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    c.stroke();
  }
  const ink = '#1c2a19';
  c.fillStyle = ink;
  c.fillRect(0, 22, w, 3);
  c.fillRect(0, 32, w, 1.5);
  c.fillRect(0, h - 25, w, 3);
  c.fillRect(0, h - 33.5, w, 1.5);

  // broto
  c.save();
  c.lineCap = 'round';
  c.strokeStyle = '#1f4d2b';
  c.lineWidth = 6;
  c.beginPath();
  c.moveTo(1024, 205);
  c.quadraticCurveTo(1018, 160, 1024, 118);
  c.stroke();
  [[1022, 158, 80, -2.5], [1024, 132, 86, -0.65]].forEach(([x, y, l, a]) => {
    c.save();
    c.translate(x, y);
    c.rotate(a);
    c.beginPath();
    c.moveTo(0, 0);
    c.bezierCurveTo(l * 0.3, -l * 0.42, l * 0.8, -l * 0.3, l, 0);
    c.bezierCurveTo(l * 0.8, l * 0.3, l * 0.3, l * 0.42, 0, 0);
    c.fillStyle = 'rgba(95,155,90,.45)';
    c.fill();
    c.stroke();
    c.restore();
  });
  c.restore();

  const size = fit(c, 'brota', 'DM Sans', 520, 190, 700);
  text(c, 'brota', 1024, 360, { size, weight: 700, color: ink });
  text(c, 'KOMBUCHA ARTESANAL', 1024, 420, { size: 28, weight: 700, color: ink, spacing: 12 });
  text(c, 'hibisco & gengibre', 1024, 488, { size: 50, family: 'Instrument Serif', style: 'italic', color: '#8c2131' });

  // hibisco em traço
  c.save();
  c.translate(640, 300);
  c.strokeStyle = '#8c2131';
  c.lineWidth = 4;
  for (let i = 0; i < 5; i++) {
    c.save();
    c.rotate((i / 5) * TAU);
    c.beginPath();
    c.ellipse(0, -62, 42, 62, 0, 0, TAU);
    c.fillStyle = 'rgba(200,50,70,.22)';
    c.fill();
    c.stroke();
    c.restore();
  }
  c.beginPath();
  c.moveTo(0, 0);
  c.quadraticCurveTo(30, -40, 70, -90);
  c.stroke();
  c.fillStyle = '#8c2131';
  c.beginPath();
  c.arc(72, -92, 8, 0, TAU);
  c.fill();
  c.restore();

  // gengibre em traço
  c.save();
  c.translate(1410, 300);
  c.strokeStyle = ink;
  c.fillStyle = 'rgba(230,190,120,.5)';
  c.lineWidth = 4;
  [[0, 0, 70, 40], [60, -40, 40, 30], [-60, -30, 36, 26], [90, 20, 34, 24], [-30, 40, 30, 22]].forEach(([x, y, rx, ry]) => {
    c.beginPath();
    c.ellipse(x, y, rx, ry, 0.3, 0, TAU);
    c.fill();
    c.stroke();
  });
  c.restore();

  para(c, 'Fermentado naturalmente com chá verde, hibisco e gengibre fresco. Contém culturas vivas. Mantenha refrigerado.', 150, 210, 340, 30, { size: 22, color: ink });
  text(c, '355 ml', 150, 380, { size: 40, weight: 700, color: ink, align: 'left' });
  text(c, 'design: Isabela Palhano', 320, 470, { size: 34, family: 'Instrument Serif', style: 'italic', color: ink });
  barcode(c, 1660, 190, 220, 100, rng(302), ink, '#efe2cc');
  return cv;
}

function drawMel() {
  const w = 2048;
  const h = 332;
  const cv = mk(w, h);
  const c = cv.getContext('2d');
  const rand = rng(401);
  c.fillStyle = '#173a2a';
  c.fillRect(0, 0, w, h);
  const r = w / (40 * Math.sqrt(3));
  const hw = Math.sqrt(3) * r;
  for (let row = -1; row < h / (r * 1.5) + 1; row++) {
    for (let col = 0; col < 41; col++) {
      const x = col * hw + (row % 2 ? hw / 2 : 0);
      const y = row * r * 1.5;
      c.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * TAU + Math.PI / 6;
        c.lineTo(x + Math.cos(a) * (r - 3), y + Math.sin(a) * (r - 3));
      }
      c.closePath();
      if (rand() < 0.16) {
        c.fillStyle = 'rgba(232,163,23,.85)';
        c.fill();
      }
      c.strokeStyle = 'rgba(217,162,39,.55)';
      c.lineWidth = 3;
      c.stroke();
    }
  }
  c.fillStyle = '#f6ecd2';
  c.beginPath();
  c.ellipse(1024, 166, 430, 128, 0, 0, TAU);
  c.fill();
  c.strokeStyle = '#d9a227';
  c.lineWidth = 6;
  c.stroke();
  c.lineWidth = 2;
  c.beginPath();
  c.ellipse(1024, 166, 410, 110, 0, 0, TAU);
  c.stroke();
  const size = fit(c, 'Mel de Aroeira', 'Instrument Serif', 640, 110, 400, 'italic');
  text(c, 'Mel de Aroeira', 1024, 184, { size, family: 'Instrument Serif', style: 'italic', color: '#173a2a' });
  text(c, 'SERTÃO DO CEARÁ  ·  280 g', 1024, 236, { size: 22, weight: 700, color: '#a7741a', spacing: 8 });
  [[500, 160], [1548, 160]].forEach(([x, y]) => bee(c, x, y, 1.4));
  text(c, 'design: Isabela Palhano', 200, 300, { size: 26, family: 'Instrument Serif', style: 'italic', color: '#f6ecd2' });
  return cv;
}

function bee(c, x, y, s) {
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  c.fillStyle = 'rgba(255,255,255,.8)';
  c.strokeStyle = '#1b1b1b';
  c.lineWidth = 2;
  [[-8, -20, -0.5], [10, -20, 0.5]].forEach(([wx, wy, a]) => {
    c.beginPath();
    c.ellipse(wx, wy, 12, 20, a, 0, TAU);
    c.fill();
    c.stroke();
  });
  c.fillStyle = '#f2c230';
  c.beginPath();
  c.ellipse(0, 0, 30, 19, 0, 0, TAU);
  c.fill();
  c.stroke();
  c.save();
  c.clip();
  c.fillStyle = '#1b1b1b';
  c.fillRect(-12, -20, 8, 40);
  c.fillRect(6, -20, 8, 40);
  c.restore();
  c.fillStyle = '#1b1b1b';
  c.beginPath();
  c.arc(-32, 0, 11, 0, TAU);
  c.fill();
  c.restore();
}

function drawMelLid() {
  const s = 512;
  const cv = mk(s, s);
  const c = cv.getContext('2d');
  c.fillStyle = '#173a2a';
  c.fillRect(0, 0, s, s);
  c.strokeStyle = '#d9a227';
  c.lineWidth = 6;
  c.beginPath();
  c.arc(256, 256, 236, 0, TAU);
  c.stroke();
  c.lineWidth = 2;
  c.beginPath();
  c.arc(256, 256, 190, 0, TAU);
  c.stroke();
  circleText(c, 'MEL DE AROEIRA · SERTÃO DO CEARÁ · ', 256, 256, 213, { size: 24, color: '#d9a227', spacing: 3 });
  c.fillStyle = '#d9a227';
  c.beginPath();
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TAU + Math.PI / 6;
    c.lineTo(256 + Math.cos(a) * 120, 256 + Math.sin(a) * 120);
  }
  c.closePath();
  c.fill();
  text(c, 'MA', 256, 296, { size: 120, family: 'Instrument Serif', style: 'italic', color: '#173a2a' });
  return cv;
}

function drawCacauFront() {
  const w = 1024;
  const h = 512;
  const cv = mk(w, h);
  const c = cv.getContext('2d');
  c.fillStyle = '#b4532a';
  c.fillRect(0, 0, w, h);
  // padronagem inspirada na cerâmica do Cariri
  const band = (y, flip) => {
    for (let x = 0; x < w; x += 40) {
      c.fillStyle = '#5b2412';
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + 20, y + (flip ? -26 : 26));
      c.lineTo(x + 40, y);
      c.closePath();
      c.fill();
      c.fillStyle = '#e9c8a0';
      c.beginPath();
      c.arc(x + 20, y + (flip ? 14 : -14), 5, 0, TAU);
      c.fill();
    }
  };
  band(46, false);
  band(h - 46, true);
  for (let y = 110; y < h - 90; y += 52) {
    [70, w - 70].forEach((x) => {
      c.strokeStyle = '#e9c8a0';
      c.lineWidth = 3;
      c.beginPath();
      c.arc(x, y, 18, 0, TAU);
      c.stroke();
      c.fillStyle = '#5b2412';
      c.beginPath();
      c.arc(x, y, 8, 0, TAU);
      c.fill();
    });
  }
  c.fillStyle = '#f1dfc4';
  rr(c, 200, 96, 624, 320, 10);
  c.fill();
  c.strokeStyle = '#5b2412';
  c.lineWidth = 6;
  c.stroke();
  c.lineWidth = 2;
  rr(c, 212, 108, 600, 296, 6);
  c.stroke();
  // cacau
  c.save();
  c.translate(512, 172);
  c.fillStyle = '#7a2f14';
  c.beginPath();
  c.ellipse(0, 0, 74, 40, 0, 0, TAU);
  c.fill();
  c.strokeStyle = '#d97a45';
  c.lineWidth = 3;
  for (let i = -2; i <= 2; i++) {
    c.beginPath();
    c.ellipse(0, i * 13, 66, 6, 0, Math.PI * 1.05, Math.PI * 1.95);
    c.stroke();
  }
  leaf(c, 60, -10, 90, -0.4, 22, '#2f6b3a', '#a6d39a', false);
  c.restore();
  const size = fit(c, 'CACAU CARIRI', 'Anton', 460, 92);
  text(c, 'CACAU CARIRI', 512, 300, { size, family: 'Anton', color: '#3a170c' });
  text(c, 'CHOCOLATE AMARGO', 512, 344, { size: 22, weight: 700, color: '#7a2f14', spacing: 8 });
  text(c, '80 g', 512, 388, { size: 22, weight: 700, color: '#3a170c' });
  c.fillStyle = '#3a170c';
  c.beginPath();
  c.arc(770, 120, 64, 0, TAU);
  c.fill();
  c.strokeStyle = '#e9c8a0';
  c.lineWidth = 3;
  c.stroke();
  text(c, '70%', 770, 132, { size: 50, family: 'Anton', color: '#f1dfc4' });
  text(c, 'CACAU', 770, 160, { size: 15, weight: 700, color: '#e9c8a0', spacing: 3 });
  return cv;
}

function drawCacauBack() {
  const w = 1024;
  const h = 512;
  const cv = mk(w, h);
  const c = cv.getContext('2d');
  c.fillStyle = '#5b2412';
  c.fillRect(0, 0, w, h);
  c.strokeStyle = '#e9c8a0';
  c.lineWidth = 2;
  rr(c, 40, 40, w - 80, h - 80, 10);
  c.stroke();
  text(c, 'Cacau Cariri', 90, 130, { size: 64, family: 'Instrument Serif', style: 'italic', color: '#f1dfc4', align: 'left' });
  para(c, 'Cacau fino de origem, torrado em pequenos lotes no sul do Ceará. Ingredientes: massa de cacau, açúcar de coco e manteiga de cacau.', 90, 190, 480, 34, { size: 24, color: '#e9c8a0' });
  text(c, 'design: Isabela Palhano', 90, 420, { size: 34, family: 'Instrument Serif', style: 'italic', color: '#f1dfc4', align: 'left' });
  barcode(c, 680, 300, 230, 90, rng(501), '#3a170c', '#f1dfc4');
  return cv;
}

/* ==========================================================================
   PRANCHA DE ARTE-FINAL (galeria)
   ========================================================================== */

export function printSheet(d) {
  const w = 1600;
  const h = 1000;
  const cv = mk(w, h);
  const c = cv.getContext('2d');
  c.fillStyle = '#f2efe8';
  c.fillRect(0, 0, w, h);
  const lw = 1240;
  const lh = Math.round((lw * H) / W);
  const lx = (w - lw) / 2;
  const ly = 200;
  c.save();
  c.shadowColor = 'rgba(0,0,0,.18)';
  c.shadowBlur = 30;
  c.shadowOffsetY = 12;
  c.fillStyle = '#fff';
  c.fillRect(lx, ly, lw, lh);
  c.restore();
  c.drawImage(d.canvas, lx, ly, lw, lh);

  // área de emenda
  c.save();
  c.beginPath();
  c.rect(lx, ly, 34, lh);
  c.clip();
  c.fillStyle = 'rgba(255,255,255,.55)';
  c.fillRect(lx, ly, 34, lh);
  c.strokeStyle = 'rgba(230,0,126,.6)';
  c.lineWidth = 2;
  for (let y = -40; y < lh + 40; y += 14) {
    c.beginPath();
    c.moveTo(lx, ly + y);
    c.lineTo(lx + 34, ly + y + 34);
    c.stroke();
  }
  c.restore();

  c.strokeStyle = '#e6007e';
  c.lineWidth = 2;
  c.strokeRect(lx + 0.5, ly + 0.5, lw, lh);
  c.save();
  c.setLineDash([10, 8]);
  c.strokeStyle = '#00a0e3';
  c.strokeRect(lx + 26, ly + 26, lw - 52, lh - 52);
  c.restore();

  // marcas de corte
  c.strokeStyle = '#1a1a1a';
  c.lineWidth = 1.5;
  [[lx, ly], [lx + lw, ly], [lx, ly + lh], [lx + lw, ly + lh]].forEach(([x, y]) => {
    const sx = x === lx ? -1 : 1;
    const sy = y === ly ? -1 : 1;
    c.beginPath();
    c.moveTo(x + sx * 14, y);
    c.lineTo(x + sx * 54, y);
    c.moveTo(x, y + sy * 14);
    c.lineTo(x, y + sy * 54);
    c.stroke();
  });
  // marcas de registro
  [[lx - 80, ly + lh / 2], [lx + lw + 80, ly + lh / 2], [w / 2, ly - 70]].forEach(([x, y]) => {
    c.beginPath();
    c.arc(x, y, 14, 0, TAU);
    c.moveTo(x - 24, y);
    c.lineTo(x + 24, y);
    c.moveTo(x, y - 24);
    c.lineTo(x, y + 24);
    c.stroke();
  });
  // marcador de frente
  c.fillStyle = '#e6007e';
  c.beginPath();
  c.moveTo(lx + lw / 2 - 9, ly - 22);
  c.lineTo(lx + lw / 2 + 9, ly - 22);
  c.lineTo(lx + lw / 2, ly - 8);
  c.closePath();
  c.fill();
  text(c, 'FRENTE', lx + lw / 2 + 60, ly - 12, { size: 14, weight: 700, color: '#e6007e', spacing: 3 });
  text(c, 'EMENDA', lx + 60, ly - 12, { size: 14, weight: 700, color: '#e6007e', spacing: 3 });

  // cabeçalho
  text(c, 'ISABELA PALHANO — ARTE-FINAL', lx, 70, { size: 20, weight: 700, color: '#1a1a1a', align: 'left', spacing: 3 });
  text(c, d.file, lx + lw, 70, { size: 20, color: '#555', align: 'right' });
  text(c, `${d.name} · ${d.flavor}`, lx, 122, { size: 42, family: 'Instrument Serif', style: 'italic', color: '#1a1a1a', align: 'left' });
  text(c, '207 × 99 mm  ·  emenda 6 mm  ·  CMYK + foil', lx + lw, 118, { size: 18, color: '#555', align: 'right' });

  // barras de cor
  const by = ly + lh + 70;
  ['#00a0e3', '#e6007e', '#ffed00', '#1a1a1a'].forEach((col, i) => {
    c.fillStyle = col;
    c.fillRect(lx + i * 46, by, 40, 40);
  });
  d.palette.forEach((col, i) => {
    const x = lx + 230 + i * 190;
    c.fillStyle = col;
    c.fillRect(x, by, 40, 40);
    c.strokeStyle = 'rgba(0,0,0,.15)';
    c.lineWidth = 1;
    c.strokeRect(x + 0.5, by + 0.5, 40, 40);
    text(c, col.toUpperCase(), x + 52, by + 27, { size: 18, color: '#333', align: 'left' });
  });
  text(c, `${d.finishLabel}`, lx + lw, by + 27, { size: 18, weight: 700, color: '#1a1a1a', align: 'right', spacing: 2 });
  return cv;
}

/* ==========================================================================
   DADOS DA COLEÇÃO
   ========================================================================== */

export const COLLECTION = [
  {
    id: 'fizza', name: 'Fizza', flavor: 'Cola de cereja', draw: drawFizza, finish: [0.38, 0.22],
    desc: 'Um refrigerante de cola com alma retrô: logotipo em script, raios de sol e uma faixa em alumínio aparente que brilha a cada giro da lata.',
    tags: ['Lata 350 ml', 'Alumínio aparente', 'Script retrô'],
    palette: ['#e3121f', '#fff8ef', '#c9ccd0', '#6d0610'], bg: '#240306', glow: '#ff2a36',
    file: 'FIZZA_LATA350_v12.pdf', finishLabel: 'BRILHO + ALUMÍNIO',
  },
  {
    id: 'tropik', name: 'Tropik', flavor: 'Maracujá & manga', draw: drawTropik, finish: [0.36, 0.2],
    desc: 'O verão nordestino dentro de uma lata: sol poente em listras, folhagem tropical e tipografia em bloco que salta da prateleira.',
    tags: ['Lata 350 ml', 'Ilustração', 'Tipografia 3D'],
    palette: ['#ffb321', '#2b0f63', '#14a25a', '#fff6c4'], bg: '#2a1300', glow: '#ffae00',
    file: 'TROPIK_LATA350_v08.pdf', finishLabel: 'BRILHO TOTAL',
  },
  {
    id: 'onda', name: 'Onda', flavor: 'Energético de açaí', draw: drawOnda, finish: [0.34, 0.22],
    desc: 'Energia em alta frequência: ondas em alumínio aparente reluzindo sobre o roxo do açaí e um logo com aberração cromática.',
    tags: ['Lata 350 ml', 'Alumínio aparente', 'Neon'],
    palette: ['#2a0656', '#ff2fb4', '#c6ff3d', '#2ff3ff'], bg: '#13042a', glow: '#c42cff',
    file: 'ONDA_LATA350_v15.pdf', finishLabel: 'BRILHO + ALUMÍNIO',
  },
  {
    id: 'caju', name: 'Caju Club', flavor: 'Soda de caju', draw: drawCaju, finish: [0.55, 0.08],
    desc: 'Uma homenagem ao Ceará: xilogravura de cordel, bandeirinhas e o caju como protagonista. Regional com orgulho, pronto para o mundo.',
    tags: ['Lata 350 ml', 'Xilogravura', 'Acabamento papel'],
    palette: ['#f3e3c3', '#1d1611', '#d8342a', '#f2b632'], bg: '#2a1206', glow: '#ff6a2b',
    file: 'CAJUCLUB_LATA350_v06.pdf', finishLabel: 'FOSCO TEXTURIZADO',
  },
  {
    id: 'citra', name: 'Citra', flavor: 'Tônica de limão siciliano', draw: drawCitra, finish: [0.62, 0.06],
    desc: 'Mixer premium em acabamento fosco, serifa elegante e hot stamping dourado. Feito para dividir a mesa com bons drinks.',
    tags: ['Lata 350 ml', 'Fosco', 'Hot stamping'],
    palette: ['#eef3e3', '#173523', '#f2cf2a', '#c39a3c'], bg: '#0b1f14', glow: '#b8e05a',
    file: 'CITRA_LATA350_v09.pdf', finishLabel: 'FOSCO + FOIL OURO',
  },
  {
    id: 'noir', name: 'Noir', flavor: 'Cola zero açúcar', draw: drawNoir, finish: [0.8, 0.12],
    desc: 'Preto soft-touch, filetes dourados e uma tipografia que sussurra em vez de gritar. Zero açúcar, cem por cento presença.',
    tags: ['Lata 350 ml', 'Soft-touch', 'Foil ouro'],
    palette: ['#0c0c0e', '#d6aa45', '#ece6d6', '#bfb6a0'], bg: '#0a0a0c', glow: '#d4af37',
    file: 'NOIR_LATA350_v11.pdf', finishLabel: 'SOFT-TOUCH + FOIL',
  },
];

export const PRODUCTS = [
  {
    id: 'brota', name: 'Brota', kind: 'Kombucha · garrafa âmbar 355 ml',
    desc: 'Rótulo em papel kraft com ilustração botânica em traço fino. Orgânico, honesto e cheio de vida — do jeito que a bebida é.',
    tags: ['Garrafa de vidro', 'Papel kraft', 'Ilustração'], bg: '#13180d', glow: '#7fb069',
  },
  {
    id: 'mel', name: 'Mel de Aroeira', kind: 'Mel · pote de vidro 280 g',
    desc: 'Favo geométrico, tampa ilustrada e tipografia clássica para um produto do sertão com cara de presente.',
    tags: ['Pote de vidro', 'Tampa impressa', 'Padronagem'], bg: '#1d1404', glow: '#f0a21a',
  },
  {
    id: 'cacau', name: 'Cacau Cariri', kind: 'Chocolate 70% · barra 80 g',
    desc: 'Padronagem inspirada na cerâmica do Cariri, cores de terra e um cacau que dá vontade de abrir na hora.',
    tags: ['Cartucho', 'Padronagem', 'Cores de terra'], bg: '#1e0c06', glow: '#d0643a',
  },
];

function renderLabel(draw, finish) {
  const c = mk(W, H);
  const o = mk(W, H);
  const oc = o.getContext('2d');
  oc.fillStyle = mat(finish[0], finish[1]);
  oc.fillRect(0, 0, W, H);
  draw(c.getContext('2d'), oc);
  return { canvas: c, orm: o };
}

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

export async function buildLabels(onProgress = () => {}) {
  const designs = [];
  for (let i = 0; i < COLLECTION.length; i++) {
    const d = COLLECTION[i];
    designs.push({ ...d, ...renderLabel(d.draw, d.finish) });
    onProgress((i + 1) / (COLLECTION.length + 3));
    await nextFrame();
  }
  const sketch = { id: 'sketch', ...renderLabel(drawSketch, [0.72, 0.02]) };
  const yours = { id: 'yours', ...renderLabel(drawYourBrand, [0.36, 1]) };
  onProgress((COLLECTION.length + 2) / (COLLECTION.length + 3));
  await nextFrame();
  const products = {
    brota: drawBrota(),
    mel: drawMel(),
    melLid: drawMelLid(),
    cacauFront: drawCacauFront(),
    cacauBack: drawCacauBack(),
  };
  onProgress(1);
  return { designs, sketch, yours, products };
}
