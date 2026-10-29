// Interface d'une story Instagram dessinée par-dessus l'aperçu (jamais exportée),
// pour voir les zones recouvertes en haut et en bas de l'écran.
import { FAMILY } from './templates.js';

const font = (w, s) => `${w} ${s}px ${FAMILY}`;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function heart(ctx, cx, cy, s) {
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.42);
  ctx.bezierCurveTo(cx - s * 0.55, cy + s * 0.02, cx - s * 0.55, cy - s * 0.42, cx - s * 0.25, cy - s * 0.42);
  ctx.bezierCurveTo(cx - s * 0.08, cy - s * 0.42, cx, cy - s * 0.3, cx, cy - s * 0.2);
  ctx.bezierCurveTo(cx, cy - s * 0.3, cx + s * 0.08, cy - s * 0.42, cx + s * 0.25, cy - s * 0.42);
  ctx.bezierCurveTo(cx + s * 0.55, cy - s * 0.42, cx + s * 0.55, cy + s * 0.02, cx, cy + s * 0.42);
  ctx.closePath();
  ctx.stroke();
}

function plane(ctx, cx, cy, s) {
  const h = s / 2;
  ctx.beginPath();
  ctx.moveTo(cx - h, cy - h * 0.15);
  ctx.lineTo(cx + h, cy - h);
  ctx.lineTo(cx + h * 0.15, cy + h);
  ctx.lineTo(cx - h * 0.05, cy + h * 0.05);
  ctx.closePath();
  ctx.moveTo(cx - h * 0.05, cy + h * 0.05);
  ctx.lineTo(cx + h, cy - h);
  ctx.stroke();
}

export function drawInstaStory(ctx, W, H, name = 'louisthomson') {
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;

  // voiles haut et bas
  let g = ctx.createLinearGradient(0, 0, 0, 280);
  g.addColorStop(0, 'rgba(0,0,0,0.42)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, 280);
  g = ctx.createLinearGradient(0, H - 320, 0, H);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = g; ctx.fillRect(0, H - 320, W, 320);

  // barres de progression
  const segs = 3, gap = 8, x0 = 24, w = (W - 48 - gap * (segs - 1)) / segs;
  for (let i = 0; i < segs; i++) {
    ctx.fillStyle = i === 0 ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.4)';
    roundRect(ctx, x0 + i * (w + gap), 26, w, 6, 3); ctx.fill();
  }

  // photo de profil, nom, heure
  ctx.fillStyle = '#3a3a3a';
  ctx.beginPath(); ctx.arc(88, 110, 42, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = '#ffffff'; ctx.font = font(600, 28); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('LT', 88, 111);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.font = font(600, 32);
  ctx.fillText(name, 150, 122);
  const nw = ctx.measureText(name).width;
  ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = font(500, 32);
  ctx.fillText('2 h', 150 + nw + 18, 122);

  // menu et fermeture
  ctx.fillStyle = '#ffffff';
  [920, 944, 968].forEach(x => { ctx.beginPath(); ctx.arc(x, 110, 5, 0, Math.PI * 2); ctx.fill(); });
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(1012, 88); ctx.lineTo(1052, 128); ctx.moveTo(1052, 88); ctx.lineTo(1012, 128); ctx.stroke();

  // champ de message, cœur, partage
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  roundRect(ctx, 32, H - 156, 780, 100, 50); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.font = font(500, 32);
  ctx.fillText('Envoyer un message', 80, H - 94);
  ctx.lineWidth = 4.5; ctx.lineJoin = 'round'; ctx.strokeStyle = '#ffffff';
  heart(ctx, 880, H - 106, 64);
  plane(ctx, 992, H - 106, 58);

  ctx.restore();
}
