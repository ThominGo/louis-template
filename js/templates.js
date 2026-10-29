// Templates reconstruits depuis le fichier Figma "Louis Thomson – Insta".
// Chaque template dessine sur un canvas de 1080 px de large, en post (1350) ou story (1920).
// La mise en page suit l'auto layout Figma : les blocs s'empilent et se mesurent
// d'après leur texte, le média prend la place restante.

export const C = {
  white: '#f6f6f4',
  black: '#181818',
  orange: '#da593c',
  grid: '#444444',
  ink: '#131313',
  soft: '#dddddd',
};
export const W = 1080;
export const HEIGHT = { post: 1350, story: 1920 };
const LW = 2;

export const FAMILY = '"General Sans", "Helvetica Neue", Arial, sans-serif';
const font = (weight, size) => `${weight} ${size}px ${FAMILY}`;

// ---------- Mesure et texte ----------

function wrap(ctx, text, maxW) {
  const out = [];
  for (const para of String(text ?? '').split('\n')) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) { out.push(''); continue; }
    let line = words[0];
    for (let i = 1; i < words.length; i++) {
      const t = line + ' ' + words[i];
      if (ctx.measureText(t).width <= maxW) line = t;
      else { out.push(line); line = words[i]; }
    }
    out.push(line);
  }
  while (out.length > 1 && out[out.length - 1] === '') out.pop();
  return out;
}

function widest(ctx, lines) {
  return lines.reduce((m, l) => Math.max(m, ctx.measureText(l).width), 0);
}

// Réduit la taille jusqu'à ce que le texte tienne dans la boîte (comme un "fit" Figma).
function fit(ctx, text, { weight = 400, max, min = 24, maxW, maxH = Infinity, lh = 1, maxLines = Infinity }) {
  for (let size = max; size >= min; size -= 2) {
    ctx.font = font(weight, size);
    const lines = wrap(ctx, text, maxW);
    if (widest(ctx, lines) <= maxW + 0.5 && lines.length * size * lh <= maxH + 0.5 && lines.length <= maxLines) {
      return { size, lines, height: lines.length * size * lh };
    }
  }
  ctx.font = font(weight, min);
  const lines = wrap(ctx, text, maxW);
  return { size: min, lines, height: lines.length * min * lh };
}

// Place les lignes comme le fait CSS : demi-interlignage au-dessus et en dessous.
function drawLines(ctx, lines, { x, y, w = 0, size, lh, weight = 400, color, align = 'left' }) {
  ctx.font = font(weight, size);
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  const m = ctx.measureText('Hg');
  const asc = m.fontBoundingBoxAscent ?? size * 0.95;
  const desc = m.fontBoundingBoxDescent ?? size * 0.25;
  const box = size * lh;
  const ax = align === 'center' ? x + w / 2 : align === 'right' ? x + w : x;
  lines.forEach((line, i) => {
    const top = y + i * box;
    ctx.fillText(line, ax, top + (box - (asc + desc)) / 2 + asc);
  });
}

const hline = (ctx, x1, x2, y, color) => { ctx.fillStyle = color; ctx.fillRect(x1, y, x2 - x1, LW); };
const vline = (ctx, x, y1, y2, color) => { ctx.fillStyle = color; ctx.fillRect(x, y1, LW, y2 - y1); };
const disc = (ctx, cx, cy, d, color) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(cx, cy, d / 2, 0, Math.PI * 2); ctx.fill(); };

// ---------- Média : cadrage, noir et blanc, dégradé orange ----------

function mediaSize(el) {
  if (!el) return [0, 0];
  if (el instanceof HTMLVideoElement) return [el.videoWidth, el.videoHeight];
  if (el instanceof HTMLImageElement) return [el.naturalWidth, el.naturalHeight];
  return [el.width, el.height];
}

export function drawMedia(ctx, r, env) {
  const { media, fx, light, hits } = env;
  hits.push({ type: 'media', ...r });
  ctx.save();
  ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
  const [sw, sh] = mediaSize(media.el);
  if (!sw || !sh) {
    ctx.fillStyle = light ? '#e6e5e1' : '#262626';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    if (env.editing) {
      const s = Math.max(24, Math.min(36, r.w / 18));
      drawLines(ctx, ['+ Photo ou vidéo'], { x: r.x, y: r.y + r.h / 2 - s * 0.6, w: r.w, size: s, lh: 1.2, weight: 500, color: light ? '#8a8984' : '#7a7a7a', align: 'center' });
    }
    ctx.restore();
    return;
  }
  const z = media.zoom || 1;
  const s = Math.max(r.w / sw, r.h / sh) * z;
  const dw = sw * s, dh = sh * s;
  // décalage normalisé (-1 à 1) limité pour ne jamais laisser de vide
  const mx = (dw - r.w) / 2, my = (dh - r.h) / 2;
  const ox = Math.max(-1, Math.min(1, media.ox || 0)) * mx;
  const oy = Math.max(-1, Math.min(1, media.oy || 0)) * my;
  ctx.drawImage(media.el, r.x + (r.w - dw) / 2 + ox, r.y + (r.h - dh) / 2 + oy, dw, dh);

  if (fx.bw) {
    // même principe que le calque blanc en mode "Saturation" dans Figma
    ctx.globalCompositeOperation = 'saturation';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    if (fx.contrast > 0) {
      ctx.globalCompositeOperation = 'soft-light';
      ctx.globalAlpha = fx.contrast;
      ctx.drawImage(ctx.canvas, r.x, r.y, r.w, r.h, r.x, r.y, r.w, r.h);
      ctx.globalAlpha = 1;
    }
  }
  if (fx.orange > 0) {
    // dégradé orange transparent → orange, en mode "Produit" (multiply)
    ctx.globalCompositeOperation = 'multiply';
    const g = ctx.createLinearGradient(0, r.y + r.h * (1 - fx.reach), 0, r.y + r.h);
    g.addColorStop(0, 'rgba(218,89,60,0)');
    g.addColorStop(1, `rgba(218,89,60,${fx.orange})`);
    ctx.fillStyle = g;
    ctx.fillRect(r.x, r.y, r.w, r.h);
  }
  ctx.restore();
}

function field(env, key, x, y, w, h) { env.hits.push({ type: 'field', key, x, y, w, h }); }

// ---------- Templates ----------

// 1. post-text / story-text : grille orange sur fond noir
function texte(ctx, H, d, env) {
  const story = H > 1350;
  const colX = story ? 221 : 254;
  const pad = story ? 48 : 40;
  const big = story ? 143 : 120;
  const mid = story ? 95 : 80;
  ctx.fillStyle = C.ink; ctx.fillRect(0, 0, W, H);
  const unit = (H - 3 * LW) / 6.5;
  const rows = [1, 1.5, 3, 1].map(f => f * unit);
  const ys = []; let y = 0;
  rows.forEach(h => { ys.push(y); y += h + LW; });
  vline(ctx, colX - LW, 0, H, C.orange);
  ys.slice(1).forEach(yy => hline(ctx, 0, W, yy - LW, C.orange));

  const tx = colX + pad, tw = W - colX - pad * 2;
  const a = fit(ctx, d.lieu, { max: mid, min: 40, maxW: tw, lh: 0.8, maxLines: 1 });
  drawLines(ctx, a.lines, { x: tx, y: ys[1] + pad, size: a.size, lh: 0.8, color: C.soft });
  field(env, 'lieu', colX, ys[1], W - colX, rows[1] / 2);
  const b = fit(ctx, d.date, { max: mid, min: 40, maxW: tw, lh: 0.8, maxLines: 1 });
  drawLines(ctx, b.lines, { x: tx, y: ys[1] + rows[1] - pad - b.height, size: b.size, lh: 0.8, color: C.soft });
  field(env, 'date', colX, ys[1] + rows[1] / 2, W - colX, rows[1] / 2);

  const t = fit(ctx, d.titre, { max: big, min: 48, maxW: tw, maxH: rows[2] - pad * 4, lh: 1 });
  drawLines(ctx, t.lines, { x: tx, y: ys[2] + (rows[2] - t.height) / 2, size: t.size, lh: 1, color: C.soft });
  field(env, 'titre', colX, ys[2], W - colX, rows[2]);
}

// Lignes de titre empilées, une rangée par ligne (post-text-image, post-text-video)
function titleRows(ctx, text, size, rowH, maxW) {
  ctx.font = font(400, size);
  let lines = wrap(ctx, text, maxW);
  let s = size;
  while (widest(ctx, lines) > maxW && s > 40) { s -= 2; ctx.font = font(400, s); lines = wrap(ctx, text, maxW); }
  return { lines, size: s, rowH: rowH * (s / size) };
}

// 2. post-text-image : titre centré en rangées, date | lieu, photo dessous, ronds orange
function texteImage(ctx, H, d, env) {
  const story = H > 1350;
  const top = story ? 200 : 0;
  ctx.fillStyle = C.white; ctx.fillRect(0, 0, W, H);
  const T = titleRows(ctx, d.titre, 80, 96, W - 80);
  let y = top;
  if (story) hline(ctx, 0, W, y, C.black);
  const titleTop = y;
  T.lines.forEach((line, i) => {
    drawLines(ctx, [line], { x: 0, y: y + LW, w: W, size: T.size, lh: 1.2, color: C.black, align: 'center' });
    y += T.rowH + LW;
    hline(ctx, 0, W, y - LW, C.black);
  });
  field(env, 'titre', 0, titleTop, W, y - titleTop);
  const rowH = 75;
  drawLines(ctx, [d.date], { x: 40, y: y + 16, w: 499, size: 36, lh: 1.2, weight: 500, color: C.black, align: 'center' });
  drawLines(ctx, [d.lieu], { x: 541, y: y + 16, w: 499, size: 36, lh: 1.2, weight: 500, color: C.black, align: 'center' });
  vline(ctx, 539, y, y + rowH, C.black);
  field(env, 'date', 0, y, 539, rowH);
  field(env, 'lieu', 541, y, 539, rowH);
  y += rowH;
  hline(ctx, 0, W, y, C.black);
  y += LW;
  const m = { x: 0, y, w: W, h: H - y };
  drawMedia(ctx, m, env);
  if (d.ronds) {
    const p = story ? [0.27, 0.42] : [0, 0.49];
    disc(ctx, W, m.y + m.h * p[0], 240, C.orange);
    disc(ctx, 0, m.y + m.h * p[1], 240, C.orange);
    disc(ctx, W, H, 240, C.orange);
  }
}

// Bloc encadré commun aux templates "description"
function descBlock(ctx, d, env, o) {
  const { x0, w, ink, line, sub, withMedia } = o;
  const inner = x0 + LW, iw = w - LW * 2;
  const split = inner + 408;
  const parts = {};
  // titre
  const t = fit(ctx, d.titre, { max: 80, min: 44, maxW: 769, lh: 1, maxH: o.titleMaxH ?? 400 });
  parts.titleH = t.height + 52;
  // description
  const ds = fit(ctx, d.description, { weight: o.descWeight, max: 36, min: 26, maxW: iw - 408 - LW - 48, lh: 1.2, maxH: o.descMaxH ?? 520 });
  parts.descH = ds.height + 48;
  parts.dateH = 95;
  parts.draw = (top) => {
    let y = top;
    drawLines(ctx, t.lines, { x: inner + 24, y: y + 26, size: t.size, lh: 1, color: ink });
    field(env, 'titre', inner, y, iw, parts.titleH);
    y += parts.titleH;
    hline(ctx, inner, inner + iw, y, line); y += LW;
    drawLines(ctx, [d.date], { x: inner + 24, y: y + 26, size: 36, lh: 1.2, weight: 500, color: ink });
    drawLines(ctx, [d.lieu], { x: split + LW + 26, y: y + 26, size: 36, lh: 1.2, weight: 500, color: ink });
    field(env, 'date', inner, y, 408, parts.dateH);
    field(env, 'lieu', split, y, iw - 408, parts.dateH);
    const vTop = y;
    y += parts.dateH;
    hline(ctx, inner, inner + iw, y, line); y += LW;
    drawLines(ctx, ds.lines, { x: split + LW + 24, y: y + 24, size: ds.size, lh: 1.2, weight: o.descWeight, color: sub });
    field(env, 'description', split, y, iw - 408, parts.descH);
    y += parts.descH;
    return { vTop, y, split, inner, iw };
  };
  return parts;
}

// 3. post-text-image-description : cadre clair, texte en haut, photo en bas à droite
function texteImageDesc(ctx, H, d, env) {
  const story = H > 1350;
  ctx.fillStyle = C.white; ctx.fillRect(0, 0, W, H);
  const boxY = story ? 325 : 40, boxH = 1270;
  const x0 = 40, w = 1000;
  const P = descBlock(ctx, d, env, { x0, w, ink: C.black, line: C.black, sub: C.black, descWeight: 500, titleMaxH: 360, descMaxH: 400 });
  const r = P.draw(boxY + LW);
  hline(ctx, r.inner, r.inner + r.iw, r.y, C.black);
  const mTop = r.y + LW;
  const m = { x: r.split + LW, y: mTop, w: r.inner + r.iw - r.split - LW, h: boxY + boxH - LW - mTop };
  if (m.h > 40) drawMedia(ctx, m, env);
  vline(ctx, r.split, r.vTop, boxY + boxH, C.black);
  // cadre
  ctx.strokeStyle = C.black; ctx.lineWidth = LW;
  ctx.strokeRect(x0 + 1, boxY + 1, w - LW, boxH - LW);
  if (d.ronds && m.h > 160) disc(ctx, r.split + 1, m.y + m.h * 0.76, 120, C.orange);
}

// 4. post-text-description : cadre sombre, bloc centré
function texteDesc(ctx, H, d, env) {
  const story = H > 1350;
  ctx.fillStyle = C.black; ctx.fillRect(0, 0, W, H);
  const boxY = story ? 325 : 40, boxH = 1270;
  const x0 = 40, w = 1000;
  const P = descBlock(ctx, d, env, { x0, w, ink: C.white, line: C.grid, sub: 'rgba(246,246,244,0.7)', descWeight: 400, titleMaxH: 420, descMaxH: 520 });
  const total = P.titleH + LW + P.dateH + LW + P.descH;
  const top = boxY + (boxH - total) / 2;
  hline(ctx, x0 + LW, x0 + w - LW, top - LW, C.grid);
  const r = P.draw(top);
  hline(ctx, r.inner, r.inner + r.iw, r.y, C.grid);
  vline(ctx, r.split, r.vTop, r.y, C.grid);
  ctx.strokeStyle = C.grid; ctx.lineWidth = LW;
  ctx.strokeRect(x0 + 1, boxY + 1, w - LW, boxH - LW);
}

// 5. post-text-video : vidéo en haut, titre en rangées en bas
function texteVideo(ctx, H, d, env) {
  const story = H > 1350;
  ctx.fillStyle = C.white; ctx.fillRect(0, 0, W, H);
  const size = story ? 95 : 80, rowH = story ? 114 : 96;
  const T = titleRows(ctx, d.titre, size, rowH, W - 80);
  const block = T.lines.length * (T.rowH + LW);
  const m = { x: 0, y: 0, w: W, h: H - block - LW };
  drawMedia(ctx, m, env);
  let y = m.h;
  hline(ctx, 0, W, y, C.black);
  y += LW;
  field(env, 'titre', 0, y, W, H - y);
  T.lines.forEach(line => {
    drawLines(ctx, [line], { x: 0, y, w: W, size: T.size, lh: 1.2, color: C.black, align: 'center' });
    y += T.rowH;
    hline(ctx, 0, W, y, C.black);
    y += LW;
  });
  if (d.ronds) {
    const p = story ? [0.36, 0.83] : [0.34, 0.79];
    const D = story ? 286 : 240;
    disc(ctx, W, m.h * p[0], D, C.orange);
    disc(ctx, 0, m.h * p[1], D, C.orange);
    disc(ctx, W, H, D, C.orange);
  }
}

// 6-8. médias seuls, avec repères
function mediaFrame(ctx, H, env, r) {
  ctx.fillStyle = C.black; ctx.fillRect(0, 0, W, H);
  drawMedia(ctx, r, env);
  vline(ctx, r.x - 1, 0, H, C.grid);
  vline(ctx, r.x + r.w - 1, 0, H, C.grid);
  hline(ctx, 0, W, r.y - 1, C.grid);
  hline(ctx, 0, W, r.y + r.h - 1, C.grid);
}
function mediaPortrait(ctx, H, d, env) {
  const r = H > 1350 ? { x: 145, y: 348, w: 790, h: 1222 } : { x: 245, y: 245, w: 590, h: 859 };
  mediaFrame(ctx, H, env, r);
}
function mediaPaysage(ctx, H, d, env) {
  const h = 563;
  mediaFrame(ctx, H, env, { x: 40, y: Math.round((H - h) / 2), w: 1000, h });
}
function mediaPlein(ctx, H, d, env) {
  ctx.fillStyle = C.black; ctx.fillRect(0, 0, W, H);
  drawMedia(ctx, { x: 0, y: 0, w: W, h: H }, env);
}

export const TEMPLATES = [
  { id: 'texte', name: 'Annonce', draw: texte, fields: ['titre', 'date', 'lieu'], media: false },
  { id: 'texte-image', name: 'Concert photo', draw: texteImage, fields: ['titre', 'date', 'lieu'], media: true, ronds: true },
  { id: 'texte-image-desc', name: 'Concert détaillé', draw: texteImageDesc, fields: ['titre', 'date', 'lieu', 'description'], media: true, ronds: true },
  { id: 'texte-desc', name: 'Événement texte', draw: texteDesc, fields: ['titre', 'date', 'lieu', 'description'], media: false },
  { id: 'texte-video', name: 'Morceau', draw: texteVideo, fields: ['titre'], media: true, ronds: true },
  { id: 'media', name: 'Cadre portrait', draw: mediaPortrait, fields: [], media: true, fx: 'bwOrange' },
  { id: 'media-169', name: 'Cadre 16:9', draw: mediaPaysage, fields: [], media: true, fx: 'bwOrange' },
  { id: 'media-plein', name: 'Plein cadre', draw: mediaPlein, fields: [], media: true },
];

// Valeurs d'exemple propres à chaque template (reprises du fichier Figma)
export const SAMPLES = {
  'texte': { titre: 'Live percussion\nSynths × Techno', date: '13.12.2026', lieu: 'Villeneuve' },
  'texte-image': { titre: "Concert\navec l'ensemble\nPolychrome", date: '13.12.2026', lieu: 'Villeneuve' },
  'texte-image-desc': { titre: "Concert avec l'ensemble Polychrome", date: '13.12.2026', lieu: 'Villeneuve', description: 'Une soirée autour du vibraphone et des percussions, entre écriture contemporaine et improvisation.' },
  'texte-desc': { titre: "Concert avec l'ensemble Polychrome", date: '13.12.2026', lieu: 'Villeneuve', description: 'Une soirée autour du vibraphone et des percussions, entre écriture contemporaine et improvisation.' },
  'texte-video': { titre: 'Lately\non the\nvibraphone' },
};

export function render(ctx, tpl, format, data, env) {
  const H = HEIGHT[format];
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  env.hits.length = 0;
  tpl.draw(ctx, H, data, env);
  ctx.restore();
}
