import { TEMPLATES, SAMPLES, HEIGHT, W, FAMILY, render } from './templates.js';
import { drawInstaStory } from './insta.js';

const $ = (id) => document.getElementById(id);
const canvas = $('canvas');
const ctx = canvas.getContext('2d');
const frame = $('frame');

const LABELS = { titre: 'Titre', date: 'Date', lieu: 'Lieu', description: 'Description' };
const MULTI = { titre: true, description: true };
const STORE_KEY = 'studio-lt-v1';
const FX_DEFAULT = { mode: 'none', orange: 1, reach: 1, contrast: 0 };

// ---------- État ----------

const state = {
  tpl: 'texte-image',
  format: 'post',
  data: { ...SAMPLES['texte-image'], description: SAMPLES['texte-desc'].description, ronds: true },
  fx: {},          // effets propres à chaque template
  media: { el: null, type: null, sample: false },
  crops: {},       // cadrage du média propre à chaque template et format
  igPreview: true, // interface Instagram par-dessus les stories
  flip: {},        // texte en haut ou en bas, par template
};

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (s) {
      if (TEMPLATES.some(t => t.id === s.tpl)) state.tpl = s.tpl;
      if (s.format in HEIGHT) state.format = s.format;
      Object.assign(state.data, s.data || {});
      state.fx = s.fx || {};
      state.crops = s.crops || {};
      state.flip = s.flip || {};
      if (typeof s.igPreview === 'boolean') state.igPreview = s.igPreview;
    }
  } catch (e) { /* stockage indisponible : on garde les valeurs d'exemple */ }
}
let saveTimer = 0;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ tpl: state.tpl, format: state.format, data: state.data, fx: state.fx, crops: state.crops, flip: state.flip, igPreview: state.igPreview })); } catch (e) {}
  }, 300);
}

const tpl = () => TEMPLATES.find(t => t.id === state.tpl);
function fxFor(id) {
  if (!state.fx[id]) {
    const t = TEMPLATES.find(x => x.id === id);
    state.fx[id] = { ...FX_DEFAULT, mode: t.fx || 'none' };
  }
  return state.fx[id];
}
function fxRender(f) {
  return {
    bw: f.mode !== 'none',
    orange: f.mode === 'bwOrange' ? f.orange : 0,
    reach: f.reach,
    contrast: f.mode !== 'none' ? f.contrast : 0,
  };
}

function cropFor(id = state.tpl, format = state.format) {
  const k = id + ':' + format;
  if (!state.crops[k]) state.crops[k] = { ox: 0, oy: 0, zoom: 1 };
  return state.crops[k];
}

// ---------- Média : stockage local du dernier fichier ----------

const DB = {
  open() {
    return new Promise((res, rej) => {
      const r = indexedDB.open('studio-lt', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('media');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  },
  async put(blob) {
    try { const db = await this.open(); db.transaction('media', 'readwrite').objectStore('media').put(blob, 'last'); } catch (e) {}
  },
  async get() {
    try {
      const db = await this.open();
      return await new Promise((res) => {
        const q = db.transaction('media').objectStore('media').get('last');
        q.onsuccess = () => res(q.result || null);
        q.onerror = () => res(null);
      });
    } catch (e) { return null; }
  },
};

let mediaURL = null;
function setMedia(blob, { sample = false, persist = true } = {}) {
  return new Promise((resolve) => {
    const isVideo = blob.type.startsWith('video/');
    if (mediaURL) URL.revokeObjectURL(mediaURL);
    mediaURL = URL.createObjectURL(blob);
    const old = state.media.el;
    if (old instanceof HTMLVideoElement) { old.pause(); old.removeAttribute('src'); old.load(); }
    const done = (el) => {
      Object.assign(state.media, { el, blob, type: isVideo ? 'video' : 'image', sample });
      if (persist) state.crops = {};
      $('zoom').value = 1;
      updateMediaUI();
      dirty = true; thumbsLater();
      if (persist) DB.put(blob);
      resolve(true);
    };
    if (isVideo) {
      const v = document.createElement('video');
      v.playsInline = true; v.muted = true; v.loop = true; v.preload = 'auto';
      v.setAttribute('playsinline', '');
      v.onloadeddata = () => { v.currentTime = 0.01; done(v); };
      v.onerror = () => { toast("Cette vidéo n'est pas lisible. Essaie un fichier .mp4 ou .mov."); resolve(false); };
      v.src = mediaURL;
      v.load();
    } else {
      const img = new Image();
      img.onload = () => done(img);
      img.onerror = () => { toast("Cette image n'est pas lisible. Essaie un .jpg ou un .png."); resolve(false); };
      img.src = mediaURL;
    }
  });
}

// ---------- Rendu ----------

const env = { media: state.media, fx: null, hits: [], editing: true, light: false };
let dirty = true;

function draw(target = ctx, editing = true) {
  const t = tpl();
  env.fx = fxRender(fxFor(t.id));
  env.editing = editing;
  env.light = ['texte-image', 'texte-image-desc', 'texte-video'].includes(t.id);
  env.crop = cropFor(t.id);
  render(target, t, state.format, { ...state.data, ronds: state.data.ronds && !!t.ronds, flip: !!state.flip[t.id] }, env);
  // aperçu uniquement : jamais dans les fichiers exportés
  if (editing && target === ctx && state.format === 'story' && state.igPreview) drawInstaStory(target, W, HEIGHT.story);
}

function sizeCanvas() {
  const H = HEIGHT[state.format];
  if (canvas.height !== H) canvas.height = H;
  frame.classList.toggle('story', state.format === 'story');
}

function loop() {
  const v = state.media.el;
  if (dirty || (v instanceof HTMLVideoElement && !v.paused)) {
    draw();
    dirty = false;
    if (miniOn) copyMini();
  }
  requestAnimationFrame(loop);
}

// ---------- Aperçu réduit (50 %) quand l'aperçu principal sort de l'écran ----------

const mini = $('mini');
const miniCanvas = $('miniCanvas');
const miniCtx = miniCanvas.getContext('2d');
const bar = document.querySelector('.bar');
let miniOn = false;
function sizeMini() {
  const w = frame.getBoundingClientRect().width / 2;
  const h = w * canvas.height / canvas.width;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  miniCanvas.style.width = w + 'px';
  miniCanvas.style.height = h + 'px';
  miniCanvas.width = Math.round(w * dpr);
  miniCanvas.height = Math.round(h * dpr);
  document.documentElement.style.setProperty('--bar-h', bar.offsetHeight + 'px');
  document.documentElement.style.scrollPaddingTop = (miniOn ? bar.offsetHeight + mini.offsetHeight : bar.offsetHeight) + 12 + 'px';
}
function copyMini() {
  miniCtx.imageSmoothingQuality = 'high';
  miniCtx.drawImage(canvas, 0, 0, miniCanvas.width, miniCanvas.height);
}
function setMini(on) {
  const want = on && !window.matchMedia('(min-width: 900px)').matches;
  if (want === miniOn) return;
  miniOn = want;
  mini.hidden = !want;
  sizeMini();
  if (want) copyMini();
}
new IntersectionObserver((entries) => {
  const e = entries[entries.length - 1];
  // l'aperçu réduit apparaît dès que moins d'un quart du grand aperçu reste visible
  setMini(e.intersectionRatio < 0.25);
}, { threshold: [0, 0.25, 0.5], rootMargin: '-64px 0px 0px 0px' }).observe(frame);
window.addEventListener('resize', () => { sizeMini(); if (miniOn) copyMini(); });
mini.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

// Vignettes des templates
const thumbCanvas = document.createElement('canvas');
thumbCanvas.width = W;
const thumbCtx = thumbCanvas.getContext('2d');
let thumbTimer = 0;
function thumbsLater() { clearTimeout(thumbTimer); thumbTimer = setTimeout(drawThumbs, 250); }
function drawThumbs() {
  const H = HEIGHT[state.format];
  thumbCanvas.height = H;
  const current = state.tpl;
  const tmpEnv = { ...env, hits: [] };
  document.querySelectorAll('.tpl').forEach((btn) => {
    const t = TEMPLATES.find(x => x.id === btn.dataset.id);
    const c = btn.querySelector('canvas');
    c.width = 184; c.height = Math.round(184 * H / W);
    tmpEnv.fx = fxRender(fxFor(t.id));
    tmpEnv.light = ['texte-image', 'texte-image-desc', 'texte-video'].includes(t.id);
    tmpEnv.editing = false;
    tmpEnv.crop = cropFor(t.id);
    render(thumbCtx, t, state.format, { ...state.data, ronds: state.data.ronds && !!t.ronds, flip: !!state.flip[t.id] }, tmpEnv);
    const cx = c.getContext('2d');
    cx.imageSmoothingQuality = 'high';
    cx.drawImage(thumbCanvas, 0, 0, c.width, c.height);
  });
  state.tpl = current;
}

// ---------- Interface ----------

function buildTemplates() {
  const list = $('templates');
  list.innerHTML = '';
  TEMPLATES.forEach((t) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'tpl'; b.dataset.id = t.id;
    b.setAttribute('role', 'option');
    b.innerHTML = '<canvas aria-hidden="true"></canvas><span></span>';
    b.querySelector('span').textContent = t.name;
    b.addEventListener('click', () => selectTemplate(t.id));
    list.appendChild(b);
  });
}

function buildFields() {
  const t = tpl();
  const box = $('fields');
  box.innerHTML = '';
  $('textBlock').hidden = t.fields.length === 0;
  t.fields.forEach((key) => {
    const wrap = document.createElement('label');
    wrap.className = 'field'; wrap.dataset.key = key;
    const s = document.createElement('span');
    s.textContent = LABELS[key];
    const input = document.createElement(MULTI[key] ? 'textarea' : 'input');
    input.id = 'f-' + key;
    if (MULTI[key]) input.rows = key === 'description' ? 4 : 3;
    else { input.type = 'text'; input.enterKeyHint = 'done'; }
    input.value = state.data[key] ?? '';
    input.addEventListener('input', () => { state.data[key] = input.value; dirty = true; save(); thumbsLater(); });
    input.addEventListener('focus', () => wrap.classList.add('active'));
    input.addEventListener('blur', () => wrap.classList.remove('active'));
    wrap.append(s, input);
    box.appendChild(wrap);
  });
}

function updateMediaUI() {
  const t = tpl();
  $('mediaBlock').hidden = !t.media;
  $('fxBlock').hidden = !t.media;
  $('optBlock').hidden = !t.ronds && !t.flip;
  $('flipBtn').hidden = !t.flip;
  $('rondsRow').hidden = !t.ronds;
  $('ronds').checked = !!state.data.ronds;
  const isVideo = state.media.type === 'video';
  $('playBtn').hidden = !isVideo;
  $('muteBtn').hidden = !isVideo;
  if (isVideo) {
    $('playBtn').textContent = state.media.el.paused ? 'Lecture' : 'Pause';
    $('muteBtn').textContent = state.media.el.muted ? 'Son : coupé' : 'Son : activé';
  }
  $('zoom').value = cropFor().zoom || 1;
  $('zoomVal').textContent = Math.round((cropFor().zoom || 1) * 100) + ' %';
  const f = fxFor(t.id);
  document.querySelectorAll('#fxSeg button').forEach(b => b.setAttribute('aria-checked', String(b.dataset.fx === f.mode)));
  $('orangeRange').hidden = f.mode !== 'bwOrange';
  $('reachRange').hidden = f.mode !== 'bwOrange';
  $('orange').value = f.orange; $('orangeVal').textContent = Math.round(f.orange * 100) + ' %';
  $('reach').value = f.reach; $('reachVal').textContent = Math.round(f.reach * 100) + ' %';
  $('contrast').value = f.contrast; $('contrastVal').textContent = Math.round(f.contrast * 100) + ' %';
  $('contrast').closest('.range').hidden = f.mode === 'none';
  $('exportBtn').textContent = (t.media && isVideo) ? 'Exporter la vidéo' : 'Exporter';
}

function selectTemplate(id) {
  state.tpl = id;
  document.querySelectorAll('.tpl').forEach(b => b.setAttribute('aria-selected', String(b.dataset.id === id)));
  buildFields();
  updateMediaUI();
  dirty = true; save();
}

function setFormat(f) {
  state.format = f;
  document.querySelectorAll('[data-format]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.format === f)));
  sizeCanvas();
  setTimeout(() => { if (miniOn) { sizeMini(); copyMini(); } }, 260);
  $('igToggle').hidden = f !== 'story';
  updateMediaUI();
  dirty = true; save(); thumbsLater();
}

document.querySelectorAll('[data-format]').forEach(b => b.addEventListener('click', () => setFormat(b.dataset.format)));
document.querySelectorAll('#fxSeg button').forEach(b => b.addEventListener('click', () => {
  fxFor(state.tpl).mode = b.dataset.fx; updateMediaUI(); dirty = true; save(); thumbsLater();
}));
[['orange', 'orange'], ['reach', 'reach'], ['contrast', 'contrast']].forEach(([id, k]) => {
  $(id).addEventListener('input', (e) => { fxFor(state.tpl)[k] = +e.target.value; updateMediaUI(); dirty = true; save(); thumbsLater(); });
});
$('igPreview').checked = state.igPreview;
$('igPreview').addEventListener('change', (e) => { state.igPreview = e.target.checked; dirty = true; save(); });
$('flipBtn').addEventListener('click', () => { state.flip[state.tpl] = !state.flip[state.tpl]; dirty = true; save(); thumbsLater(); });
$('ronds').addEventListener('change', (e) => { state.data.ronds = e.target.checked; dirty = true; save(); thumbsLater(); });
$('zoom').addEventListener('input', (e) => { cropFor().zoom = +e.target.value; updateMediaUI(); dirty = true; save(); thumbsLater(); });
$('recenter').addEventListener('click', () => { Object.assign(cropFor(), { ox: 0, oy: 0, zoom: 1 }); $('zoom').value = 1; updateMediaUI(); dirty = true; save(); thumbsLater(); });
$('fileInput').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  e.target.value = '';
  if (f) { await setMedia(f); if (state.media.type === 'video') state.media.el.play().catch(() => {}); updateMediaUI(); }
});
$('playBtn').addEventListener('click', () => {
  const v = state.media.el; if (!(v instanceof HTMLVideoElement)) return;
  v.paused ? v.play().catch(() => {}) : v.pause();
  setTimeout(updateMediaUI, 50); dirty = true;
});
$('muteBtn').addEventListener('click', () => {
  const v = state.media.el; if (!(v instanceof HTMLVideoElement)) return;
  v.muted = !v.muted; updateMediaUI();
});
$('resetBtn').addEventListener('click', () => {
  const s = SAMPLES[state.tpl] || SAMPLES['texte-image'];
  Object.assign(state.data, s);
  if (!s.description) state.data.description = SAMPLES['texte-desc'].description;
  buildFields(); dirty = true; save(); thumbsLater();
});

let toastTimer = 0;
function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 3200);
}

// ---------- Gestes sur l'aperçu : cadrer, zoomer, toucher un texte ----------

const pointers = new Map();
let gesture = null;
function toCanvas(e) {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * canvas.height / r.height, k: W / r.width };
}
function hitAt(p) {
  for (let i = env.hits.length - 1; i >= 0; i--) {
    const h = env.hits[i];
    if (p.x >= h.x && p.x <= h.x + h.w && p.y >= h.y && p.y <= h.y + h.h) return h;
  }
  return null;
}
function margins(h) {
  const el = state.media.el;
  if (!el) return [0, 0];
  const sw = el.videoWidth || el.naturalWidth, sh = el.videoHeight || el.naturalHeight;
  const s = Math.max(h.w / sw, h.h / sh) * (cropFor().zoom || 1);
  return [(sw * s - h.w) / 2, (sh * s - h.h) / 2];
}

canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  const p = toCanvas(e);
  pointers.set(e.pointerId, p);
  if (pointers.size === 1) {
    const h = hitAt(p);
    gesture = { start: p, hit: h, moved: false, ox: cropFor().ox, oy: cropFor().oy };
  } else if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    gesture = { pinch: Math.hypot(a.x - b.x, a.y - b.y), zoom: cropFor().zoom, moved: true, hit: gesture?.hit };
  }
});
canvas.addEventListener('pointermove', (e) => {
  if (!pointers.has(e.pointerId) || !gesture) return;
  const p = toCanvas(e);
  pointers.set(e.pointerId, p);
  if (gesture.pinch && pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    cropFor().zoom = Math.max(1, Math.min(4, gesture.zoom * d / gesture.pinch));
    $('zoom').value = cropFor().zoom; updateMediaUI(); dirty = true;
    return;
  }
  const dx = p.x - gesture.start.x, dy = p.y - gesture.start.y;
  if (Math.hypot(dx, dy) > 12) gesture.moved = true;
  if (gesture.moved && gesture.hit?.type === 'media' && state.media.el) {
    const [mx, my] = margins(gesture.hit);
    cropFor().ox = mx > 0 ? Math.max(-1, Math.min(1, gesture.ox + dx / mx)) : 0;
    cropFor().oy = my > 0 ? Math.max(-1, Math.min(1, gesture.oy + dy / my)) : 0;
    dirty = true;
  }
});
function endPointer(e) {
  if (!pointers.has(e.pointerId)) return;
  pointers.delete(e.pointerId);
  if (pointers.size > 0) return;
  const g = gesture; gesture = null;
  if (!g) return;
  if (g.moved) { save(); thumbsLater(); return; }
  const h = g.hit;
  if (!h) return;
  if (h.type === 'field') {
    const input = $('f-' + h.key);
    if (input) { input.focus({ preventScroll: true }); input.scrollIntoView({ block: miniOn ? 'end' : 'center', behavior: 'smooth' }); }
  } else if (h.type === 'media' && !state.media.el) {
    $('fileInput').click();
  }
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('wheel', (e) => {
  if (!state.media.el) return;
  e.preventDefault();
  const c = cropFor();
  c.zoom = Math.max(1, Math.min(4, c.zoom * (e.deltaY < 0 ? 1.06 : 0.94)));
  $('zoom').value = c.zoom; save(); updateMediaUI(); dirty = true;
}, { passive: false });

// ---------- Export ----------

function fileName(ext) {
  const t = tpl();
  return `louis-${t.id}-${state.format}.${ext}`;
}

async function deliver(blob, name) {
  const file = new File([blob], name, { type: blob.type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file] }); return; }
    catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  toast('Fichier enregistré : ' + name);
}

async function exportImage() {
  const out = document.createElement('canvas');
  out.width = W; out.height = HEIGHT[state.format];
  const keepHits = env.hits.slice();
  draw(out.getContext('2d'), false);
  env.hits.splice(0, env.hits.length, ...keepHits);
  // JPEG haute qualité : bien plus rapide à encoder que le PNG sur téléphone, et Instagram recompresse de toute façon
  const blob = await new Promise(r => out.toBlob(r, 'image/jpeg', 0.95));
  await deliver(blob, fileName('jpg'));
}

let audio = null;
function audioFor(v) {
  if (audio && audio.el === v) return audio;
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const src = ac.createMediaElementSource(v);
    const dest = ac.createMediaStreamDestination();
    src.connect(dest); src.connect(ac.destination);
    audio = { el: v, ac, dest };
  } catch (e) { audio = null; }
  return audio;
}
function pickMime() {
  const list = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm'];
  return list.find(m => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || '';
}

let recorder = null;
async function exportVideoRealtime() {
  const v = state.media.el;
  if (!window.MediaRecorder || !canvas.captureStream) { toast("L'export vidéo n'est pas disponible sur ce navigateur. Utilise Safari ou Chrome à jour."); return; }
  const out = document.createElement('canvas');
  out.width = W; out.height = HEIGHT[state.format];
  const octx = out.getContext('2d');
  const stream = out.captureStream(30);
  const wasMuted = v.muted;
  const a = audioFor(v);
  if (a) { if (a.ac.state === 'suspended') await a.ac.resume(); a.dest.stream.getAudioTracks().forEach(t => stream.addTrack(t)); }
  const mime = pickMime();
  const chunks = [];
  recorder = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 10e6 } : { videoBitsPerSecond: 10e6 });
  recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  let cancelled = false, raf = 0;
  const dur = Math.min(v.duration || MAX_SECONDS, MAX_SECONDS);
  const ui = (txt, p) => { $('overlayText').textContent = txt; $('progressBar').style.width = Math.round(p * 100) + '%'; };
  $('overlay').hidden = false;
  ui('Lecture de la vidéo en temps réel. Garde l’app ouverte.', 0);
  const stopped = new Promise(r => { recorder.onstop = r; });
  $('cancelExport').onclick = () => { cancelled = true; recorder.state !== 'inactive' && recorder.stop(); };
  v.pause(); v.loop = false; v.muted = false; v.currentTime = 0;
  await new Promise(r => { v.onseeked = r; setTimeout(r, 500); });
  const keepHits = env.hits.slice();
  const tick = () => {
    draw(octx, false);
    ui(`Export : ${Math.floor(v.currentTime)} / ${Math.round(dur)} s`, v.currentTime / dur);
    if (v.currentTime >= dur || v.ended) { recorder.state !== 'inactive' && recorder.stop(); return; }
    raf = requestAnimationFrame(tick);
  };
  draw(octx, false);
  recorder.start(250);
  await v.play().catch(() => {});
  tick();
  await stopped;
  cancelAnimationFrame(raf);
  v.pause(); v.loop = true; v.muted = wasMuted;
  env.hits.splice(0, env.hits.length, ...keepHits);
  $('overlay').hidden = true;
  updateMediaUI(); dirty = true;
  if (cancelled) { toast('Export annulé'); return; }
  const type = recorder.mimeType || mime || 'video/webm';
  const ext = type.includes('mp4') ? 'mp4' : 'webm';
  await deliver(new Blob(chunks, { type }), fileName(ext));
  if (ext === 'webm') toast('Vidéo en .webm : convertis-la en .mp4 avant de la publier.');
}

// Export rapide : décode la vidéo image par image (WebCodecs), dessine le template,
// réencode en MP4 et recopie le son sans le réencoder. Bien plus rapide que le temps réel.
const MAX_SECONDS = 90;
const CODEC = window.__exportCodec || 'avc'; // H.264, le format accepté partout par Instagram
let MB = null;
async function exportVideoFast() {
  if (!('VideoEncoder' in window) || !('VideoDecoder' in window) || !state.media.blob) return false;
  MB = MB || await import('./vendor/mediabunny.min.mjs');
  const { Input, ALL_FORMATS, BlobSource, Output, Mp4OutputFormat, BufferTarget, Conversion, QUALITY_HIGH, canEncodeVideo } = MB;
  const H = HEIGHT[state.format];
  if (!(await canEncodeVideo(CODEC, { width: W, height: H }).catch(() => false))) return false;

  const out = document.createElement('canvas');
  out.width = W; out.height = H;
  const octx = out.getContext('2d');
  const frameCanvas = document.createElement('canvas');
  const fctx = frameCanvas.getContext('2d');
  const keepEl = state.media.el;
  const keepHits = env.hits.slice();
  const v = state.media.el;
  const dur = Math.min(v.duration || MAX_SECONDS, MAX_SECONDS);

  const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(state.media.blob) });
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() });
  let conv;
  try {
    conv = await Conversion.init({
      input, output, showWarnings: false,
      trim: { start: 0, end: dur },
      video: {
        codec: CODEC, quality: QUALITY_HIGH, forceTranscode: true,
        processedWidth: W, processedHeight: H,
        process: (sample) => {
          const sw = sample.displayWidth, sh = sample.displayHeight;
          if (frameCanvas.width !== sw || frameCanvas.height !== sh) { frameCanvas.width = sw; frameCanvas.height = sh; }
          sample.draw(fctx, 0, 0, sw, sh);
          state.media.el = frameCanvas;
          draw(octx, false);
          state.media.el = keepEl;
          return out;
        },
      },
    });
  } catch (e) { return false; }
  if (!conv.isValid) return false;

  const ui = (txt, p) => { $('overlayText').textContent = txt; $('progressBar').style.width = Math.round(p * 100) + '%'; };
  let cancelled = false;
  $('overlay').hidden = false;
  ui('Préparation…', 0);
  $('cancelExport').onclick = () => { cancelled = true; conv.cancel?.(); };
  conv.onProgress = (p) => ui(`Export : ${Math.round(p * 100)} %`, p);
  v.pause();
  try {
    await conv.execute();
  } catch (e) {
    state.media.el = keepEl;
    env.hits.splice(0, env.hits.length, ...keepHits);
    $('overlay').hidden = true;
    if (cancelled) { toast('Export annulé'); return true; }
    return false;
  }
  state.media.el = keepEl;
  env.hits.splice(0, env.hits.length, ...keepHits);
  $('overlay').hidden = true;
  updateMediaUI(); dirty = true;
  if (cancelled) { toast('Export annulé'); return true; }
  await deliver(new Blob([output.target.buffer], { type: 'video/mp4' }), fileName('mp4'));
  return true;
}

async function exportVideo() {
  let done = false;
  try { done = await exportVideoFast(); } catch (e) { done = false; }
  if (!done) await exportVideoRealtime();
}

$('exportBtn').addEventListener('click', async () => {
  const t = tpl();
  const btn = $('exportBtn');
  btn.disabled = true;
  try {
    if (t.media && state.media.type === 'video') await exportVideo();
    else await exportImage();
  } catch (e) {
    $('overlay').hidden = true;
    toast("L'export n'a pas abouti. Réessaie.");
  }
  btn.disabled = false;
});

// ---------- Démarrage ----------

async function start() {
  load();
  buildTemplates();
  setFormat(state.format);
  selectTemplate(state.tpl);
  try { await Promise.all([document.fonts.load(`400 80px ${FAMILY}`), document.fonts.load(`500 36px ${FAMILY}`)]); } catch (e) {}
  const saved = await DB.get();
  if (saved) await setMedia(saved, { persist: false });
  else {
    try {
      const r = await fetch('samples/vibraphone.jpg');
      if (r.ok) await setMedia(await r.blob(), { sample: true, persist: false });
    } catch (e) {}
  }
  dirty = true;
  drawThumbs();
  requestAnimationFrame(loop);
}
start();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
