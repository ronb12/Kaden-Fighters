const USE_HTML_MAIN_MENU = true;
const USE_HTML_LEADERBOARD = true;
const cvs = document.getElementById('game');
const gameShell = document.getElementById('gameShell');
/** P1: physical Key* codes (helps if IME or focus makes e.key unreliable) */
const KEY_CODE_TO_GAME = {
  KeyA: 'a', KeyD: 'd', KeyW: 'w', KeyS: 's', KeyJ: 'j', KeyK: 'k', KeyL: 'l', KeyH: 'h', KeyN: 'n', KeyO: 'o', KeyI: 'i', KeyP: 'p', KeyU: 'u', KeyY: 'y',
  KeyR: 'r', KeyV: 'v', KeyB: 'b', KeyM: 'm', KeyG: 'g', Semicolon: ';', Space: ' ',
  // P2 in Versus (and P1 in solo) — e.key can be empty/unstable on some Safari builds
  ArrowLeft: 'arrowleft', ArrowRight: 'arrowright', ArrowUp: 'arrowup', ArrowDown: 'arrowdown',
  // Air flips: P1 Q/E, P2 Z/C (in Versus)
  KeyQ: 'q', KeyE: 'e', KeyZ: 'z', KeyC: 'c',
};
function setKeysFromCodeKeydown(e) {
  if (!e.code) return;
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys.shift = true;
  else { const c = KEY_CODE_TO_GAME[e.code]; if (c) keys[c] = true; }
}
function setKeysFromCodeKeyup(e) {
  if (!e.code) return;
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys.shift = false;
  else { const c = KEY_CODE_TO_GAME[e.code]; if (c) keys[c] = false; }
}
function focusFightInput() {
  const mmSel = document.getElementById('mmModeSelect');
  if (mmSel) {
    const a = document.activeElement;
    if (a === mmSel || (mmSel.contains && mmSel.contains(a))) { try { mmSel.blur(); } catch (_) { /* */ } }
  }
  if (USE_HTML_LEADERBOARD && document.activeElement) {
    const t = document.activeElement;
    if (t.id === 'lbSearch' || t.closest && t.closest('#leaderboardHost')) { try { t.blur(); } catch (_) { /* */ } }
  }
  try { cvs.focus({ preventScroll: true }); } catch (_) { try { cvs.focus(); } catch (__) { /* */ } }
}
/** If a form control keeps focus, some browsers won’t deliver keydown to the window target. */
function blurFightInputStealer() {
  if (state !== 'fight' && state !== 'select' && state !== 'roundover') return;
  const t = document.activeElement;
  if (!t || t === cvs) return;
  if (t.tagName === 'SELECT' || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable) {
    try { t.blur(); } catch (_) { /* */ }
    try { cvs.focus({ preventScroll: true }); } catch (_) { try { cvs.focus(); } catch (_) { /* */ } }
  }
}
const ctx = cvs.getContext('2d');
const G_WIDTH = 1280;
const H_HEIGHT = 720;
let gameDpr = 1;
/** Scales one 60Hz “game tick” of movement / timers; set each frame in update() */
let gameFrameScale = 1;
const KADEN_DEBUG = typeof location !== 'undefined' && (location.search || '').indexOf('debug=1') >= 0;
/** Set `?spriteDebug=1` to also log all render-mode changes (ASTRA / FTKW / legacy) during fights. */
const KADEN_SPRITE_MODE_TRACE = typeof location !== 'undefined' && (location.search || '').indexOf('spriteDebug=1') >= 0;
const _fighterSpriteModeLast = new WeakMap();
/** false = old behavior (canvas stretches to fill shell; can look soft). true = exact N×1280×720 CSS px, centered (sharper pixels). */
const USE_INTEGER_CANVAS_DISPLAY_SCALE = typeof location === 'undefined' || (String(location.search || '').indexOf('smooth=1') < 0);
/** Integer sprite scale (1–4). All fighter blits: dest = source × this. */
const SPRITE_SCALE = 3;
function applyCtxImageSmoothingOff(c) {
  if (!c) return;
  c.imageSmoothingEnabled = false;
  try { c.mozImageSmoothingEnabled = false; } catch (_) { /* */ }
  try { c.webkitImageSmoothingEnabled = false; } catch (_) { /* */ }
  try { c.msImageSmoothingEnabled = false; } catch (_) { /* */ }
  if ('imageSmoothingQuality' in c) c.imageSmoothingQuality = 'low';
}
function applyGameCanvasDpr() {
  // Backing store is integer 1–4× logical 1280×720. High-DPI/Retina/125% Windows: ceil(dpr) already sharp. Many 1080p panels report dpr=1 — add 2× buffer so characters read “1080p clear” (same game coords, more physical pixels; downscale in the compositor is crisp with image-rendering: pixelated on #game).
  const dMax = 4;
  const dRaw = (window.devicePixelRatio != null && window.devicePixelRatio > 0) ? window.devicePixelRatio : 1;
  let d = Math.max(1, Math.min(dMax, Math.ceil(dRaw)));
  const hd0 = typeof location !== 'undefined' && (String(location.search || '').indexOf('hd=0') >= 0);
  if (!hd0 && d === 1 && typeof screen !== 'undefined') {
    const pixels = (screen.width | 0) * (screen.height | 0);
    if (pixels >= 1_800_000) d = 2;
  }
  const w = Math.max(1, (G_WIDTH * d) | 0);
  const h = Math.max(1, (H_HEIGHT * d) | 0);
  if (cvs.width === w && cvs.height === h) {
    gameDpr = w / G_WIDTH;
    syncGameCanvasDisplaySize();
    return;
  }
  cvs.width = w;
  cvs.height = h;
  gameDpr = cvs.width / G_WIDTH;
  applyCtxImageSmoothingOff(ctx);
  try {
    cvs.style.imageRendering = 'pixelated';
  } catch (_) { /* */ }
  syncGameCanvasDisplaySize();
}
/** Map #game CSS size to largest integer (or clean half) multiple of 1280×720 that fits in #gameShell — avoids non-integer browser resample blur. */
function syncGameCanvasDisplaySize() {
  const shell = document.getElementById('gameShell');
  if (!cvs || !shell) return;
  if (!USE_INTEGER_CANVAS_DISPLAY_SCALE) {
    cvs.style.width = '100%';
    cvs.style.height = '100%';
    cvs.style.alignSelf = 'stretch';
    cvs.style.minWidth = '0';
    cvs.style.minHeight = '0';
    cvs.style.flex = '1 1 auto';
    return;
  }
  cvs.style.removeProperty('align-self');
  cvs.style.removeProperty('min-width');
  cvs.style.removeProperty('min-height');
  const aw = Math.max(0, shell.clientWidth);
  const ah = Math.max(0, shell.clientHeight);
  if (aw < 2 || ah < 2) return;
  const kW = (aw / G_WIDTH) | 0;
  const kH = (ah / H_HEIGHT) | 0;
  const intK = kW < kH ? kW : kH;
  let k;
  if (intK >= 1) {
    // Always use integer k so each logical pixel → N whole CSS pixels (nearest-neighbor in the compositor). Fractional k (e.g. 1.35×) blurs the whole frame, especially fighters.
    k = intK;
  } else {
    const cands = [0.5, 0.45, 0.4, 0.35, 1 / 3, 0.3, 0.25, 0.2, 0.125, 0.1];
    k = 0.1;
    for (let j = 0; j < cands.length; j++) {
      const c = cands[j];
      if (G_WIDTH * c <= aw * 0.998 && H_HEIGHT * c <= ah * 0.998) {
        k = c;
        break;
      }
    }
  }
  const w = (G_WIDTH * k) | 0;
  const h = (H_HEIGHT * k) | 0;
  cvs.style.width = w + 'px';
  cvs.style.height = h + 'px';
  cvs.style.flex = '0 0 auto';
}
function setGameCtxBaseTransform() {
  ctx.setTransform(gameDpr, 0, 0, gameDpr, 0, 0);
}
applyCtxImageSmoothingOff(ctx);
/** @type {InstanceType<typeof MainMenu> | null} */
var kadenMainMenu = null;
/** @type {InstanceType<typeof LeaderboardScreen> | null} */
var leaderboardScreen = null;

/** Busts long-lived /assets/* immutable cache if sheet bytes change; keep in sync with index.html if preloaded. */
const ASTRA_ASSET_VER = '51';

const sheet = new Image();
try {
  if (typeof location === 'undefined' || (location.protocol !== 'file:' && location.protocol !== 'blob:' && location.protocol !== 'chrome-extension:'))
    sheet.crossOrigin = 'anonymous';
} catch (_) { /* */ }
/** Final-boss / legacy-clip row only (REIGEN + `getFighterSheetClip` UVs). Roster 0–4 use ASTRA + FTKW sheets. */
sheet.src = `assets/reigen_classic_row.png?v=${ASTRA_ASSET_VER}`;
/**
 * ASTRA / Sprite Lab sheets: 1376×768, 2×5 cells (see getAstraFighterSheetClip).
 * One optional PNG per roster index. Rivals: see `scripts/generate_astra_rival_sheets.py` for a compositor
 * from anim strips; hand-painted Sprite Lab exports are also supported.
 */
function resolveAssetPath(rel) {
  if (!rel) return rel;
  if (typeof document !== 'undefined' && document.baseURI) {
    try { return new URL(rel, document.baseURI).href; } catch (_) { /* */ }
  }
  if (typeof location !== 'undefined' && location.href) {
    try { return new URL(rel, location.href).href; } catch (_) { /* */ }
  }
  return rel;
}
/**
 * `ERR_NETWORK_CHANGED` and flaky Wi‑Fi can fail the first `Image` fetch; retry a few times with backoff.
 * Does not log to console unless KADEN_DEBUG.
 */
function armImageWithNetworkRetry(img, relSrc, label, maxTries) {
  if (!img) return;
  try {
    if (typeof location === 'undefined' || (location.protocol !== 'file:' && location.protocol !== 'blob:' && location.protocol !== 'chrome-extension:'))
      img.crossOrigin = 'anonymous';
  } catch (_) { /* */ }
  const base = (relSrc && relSrc.length) ? relSrc : '';
  let tries = 0;
  const max = typeof maxTries === 'number' && maxTries > 0 ? (maxTries | 0) : 3;
  const go = function () {
    img.src = resolveAssetPath(base);
  };
  const onErr = function () {
    tries++;
    if (tries >= max) {
      if (KADEN_DEBUG) console.warn('[KadenFighters] image give up', label, base, tries);
      img.removeEventListener('error', onErr);
      return;
    }
    setTimeout(function () { go(); }, 180 * tries);
  };
  const onOk = function () {
    img.removeEventListener('error', onErr);
  };
  img.addEventListener('load', onOk, { once: true });
  img.addEventListener('error', onErr);
  go();
}
const ASTRA_FIGHTER_SHEET_SRC = [
  `assets/astra_fighter_sheet.png?v=${ASTRA_ASSET_VER}`,
  `assets/astra_raijin.png?v=${ASTRA_ASSET_VER}`,
  `assets/astra_hikari.png?v=${ASTRA_ASSET_VER}`,
  `assets/astra_ren.png?v=${ASTRA_ASSET_VER}`,
  `assets/astra_yuki.png?v=${ASTRA_ASSET_VER}`,
];
const astraFighterSheets = [];
/** Once an ASTRA sheet has loaded, keep treating the slot as ASTRA so battle art never flips to FTKW on transient `complete`/retry. */
const _astraSheetEverReady = [false, false, false, false, false];
for (let si = 0; si < ASTRA_FIGHTER_SHEET_SRC.length; si++) {
  const src = ASTRA_FIGHTER_SHEET_SRC[si];
  const im = new Image();
  if (src) {
    const tag = 'astra[' + si + ']';
    armImageWithNetworkRetry(im, src, tag);
  }
  astraFighterSheets.push(im);
}
function astraSheetForChar(c) {
  const ci = c | 0;
  if (ci < 0 || ci > 4) return null; // roster slots 0–4 only (not final boss 5+)
  return astraFighterSheets[ci] || null;
}
function charHasAstraSheet(c) {
  const ci = c | 0;
  if (ci < 0 || ci > 4) return false;
  if (_astraSheetEverReady[ci]) return true;
  const im = astraSheetForChar(ci);
  if (!im) return false;
  const ok = !!(im.complete && (im.naturalWidth | 0) > 0);
  if (ok) _astraSheetEverReady[ci] = true;
  return ok;
}
const ASTRA = { w: 1376, h: 768, cellW: 275, cellH: 384, cols: 5, rows: 2 };
function astraCell(col, row) {
  const c = Math.max(0, Math.min(ASTRA.cols - 1, col | 0));
  const r = Math.max(0, Math.min(ASTRA.rows - 1, row | 0));
  const sw = c === ASTRA.cols - 1 ? ASTRA.w - c * ASTRA.cellW : ASTRA.cellW;
  const sh = ASTRA.cellH;
  return { sx: c * ASTRA.cellW, sy: r * ASTRA.cellH, sw, sh };
}
/** High-res Kaden (gameplay) — PNG, black keyed; sheet used for some moves. */
const kadenGameplay = new Image();
armImageWithNetworkRetry(kadenGameplay, `assets/kaden-gameplay.png?v=${ASTRA_ASSET_VER}`, 'kaden-gameplay');
const _chromaCanvas = document.createElement('canvas');
const _chromaCtx = _chromaCanvas.getContext('2d', { willReadFrequently: true });
if (_chromaCtx) { applyCtxImageSmoothingOff(_chromaCtx); }
const _kadenBaked = document.createElement('canvas');
const _kadenBakedCtx = _kadenBaked.getContext('2d', { willReadFrequently: true });
if (_kadenBakedCtx) { applyCtxImageSmoothingOff(_kadenBakedCtx); }
const _menuAstraTmp = document.createElement('canvas');
const _menuAstraTmpCtx = _menuAstraTmp.getContext('2d', { willReadFrequently: true });
if (_menuAstraTmpCtx) { applyCtxImageSmoothingOff(_menuAstraTmpCtx); }
let kadenChromaBaked = false;
const _chromaCache = new Map();const _outlineCache = new Map();const _CHROMA_CACHE_MAX=200;
const _rimCache = new Map();
const KFR_SF6_RIM = true;
const KFR_SF6_VALUE_LIFT = true;

function makeOutlineCanvas(src, pad = 2) {
  if (!src) return null;
  const w = src.width | 0, h = src.height | 0;
  if (w < 1 || h < 1) return null;
  // Build a black silhouette, then stamp it around the sprite to form an outline.
  const sil = document.createElement('canvas');
  sil.width = w; sil.height = h;
  const sx = sil.getContext('2d');
  if (!sx) return null;
  applyCtxImageSmoothingOff(sx);
  sx.clearRect(0, 0, w, h);
  sx.drawImage(src, 0, 0);
  sx.globalCompositeOperation = 'source-in';
  sx.fillStyle = 'rgba(0,0,0,0.95)';
  sx.fillRect(0, 0, w, h);

  const out = document.createElement('canvas');
  out.width = w + pad * 2;
  out.height = h + pad * 2;
  const ox = out.getContext('2d');
  if (!ox) return null;
  applyCtxImageSmoothingOff(ox);
  ox.clearRect(0, 0, out.width, out.height);
  // Chebyshev (square) ball: all offsets with max(|dx|,|dy|)≤pad, no (0,0). Diamond or circle
  // cutoffs leave diagonal gaps that read as a dotted / dashed outline when the sprite scrolls.
  for (let dy = -pad; dy <= pad; dy++) {
    for (let dx = -pad; dx <= pad; dx++) {
      if (dx === 0 && dy === 0) continue;
      if (Math.max(Math.abs(dx), Math.abs(dy)) > pad) continue;
      ox.drawImage(sil, pad + dx, pad + dy);
    }
  }
  // IMPORTANT: outline canvas must NOT include the sprite itself.
  // We draw outline behind, then draw the sprite once to avoid “double image” ghosting.
  return out;
}

function makeRimCanvas(src, color, pad = 3) {
  if (!src) return null;
  const w = src.width | 0, h = src.height | 0;
  if (w < 1 || h < 1) return null;
  const sil = document.createElement('canvas');
  sil.width = w; sil.height = h;
  const sx = sil.getContext('2d');
  if (!sx) return null;
  applyCtxImageSmoothingOff(sx);
  sx.clearRect(0, 0, w, h);
  sx.drawImage(src, 0, 0);
  sx.globalCompositeOperation = 'source-in';
  sx.fillStyle = color || 'rgba(255,255,255,0.9)';
  sx.fillRect(0, 0, w, h);

  const out = document.createElement('canvas');
  out.width = w + pad * 2;
  out.height = h + pad * 2;
  const ox = out.getContext('2d');
  if (!ox) return null;
  applyCtxImageSmoothingOff(ox);
  ox.clearRect(0, 0, out.width, out.height);
  // Same as outline: a circular cutoff here skipped outer diagonals (e.g. (3,2)) and looked like dots.
  for (let dy = -pad; dy <= pad; dy++) {
    for (let dx = -pad; dx <= pad; dx++) {
      if (dx === 0 && dy === 0) continue;
      if (Math.max(Math.abs(dx), Math.abs(dy)) > pad) continue;
      ox.globalAlpha = 0.12;
      ox.drawImage(sil, pad + dx, pad + dy);
    }
  }
  ox.globalAlpha = 1;
  return out;
}
function keySheetChromaToTransparent(p) {
  for (let i = 0; i < p.length; i += 4) {
    const r = p[i], g = p[i + 1], b = p[i + 2], a0 = p[i + 3];
    // Only key out *near pure* black background; keep dark outlines/shading in the fighter art.
    if (r < 26 && g < 26 && b < 26) { p[i + 3] = 0; continue; }
    // Sheet row labels only: bright electric cyan (low R). Wider R matched Raijin/Yuki blues.
    const br = b - r, bg = b - g;
    if (r < 38 && b > 188 && g > 152 && br > 85 && bg > -38 && bg < 68) { p[i + 3] = 0; continue; }
    // Near-black anti-alias only (not dark blues: r+g+b can be low on shadows)
    if (a0 < 255 && a0 > 0 && a0 < 218 && r < 30 && g < 30 && b < 32) p[i + 3] = 0;
  }
}
/** Optional: only nuke very faint isolated halos (never solid pixels — thin limbs use 1px bridges). */
function keySheetChromaDespeckle(p, w, h) {
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      const a = p[i + 3];
      if (a < 8 || a > 85) continue;
      const t =
        p[((y - 1) * w + x) * 4 + 3] +
        p[((y + 1) * w + x) * 4 + 3] +
        p[(y * w + x - 1) * 4 + 3] +
        p[(y * w + x + 1) * 4 + 3];
      if (t === 0) p[i + 3] = 0;
    }
  }
}
/**
 * Tighten fight-strip sprites to the visible character (removes large empty margins after
 * black-key) so gameplay reads like Street Fighter: one figure, not a whole cell “frame”.
 */
function alphaBoundsRgba(p, w, h, aMin) {
  const lo = aMin == null ? 0 : aMin | 0;
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    const row = y * w * 4;
    for (let x = 0; x < w; x++) {
      if (p[row + x * 4 + 3] > lo) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  return { minX, minY, maxX, maxY };
}
function trimFtkwChromaToCharacter(cvs) {
  if (!cvs) return cvs;
  const w0 = cvs.width | 0, h0 = cvs.height | 0;
  if (w0 < 2 || h0 < 2) return cvs;
  const cx = cvs.getContext('2d', { willReadFrequently: true });
  if (!cx) return cvs;
  const id = cx.getImageData(0, 0, w0, h0);
  // Use any visible alpha so soft edges still bound the figure (aMin=6 could miss the body).
  const b = alphaBoundsRgba(id.data, w0, h0, 0);
  if (!b) return cvs;
  const tw = b.maxX - b.minX + 1, th = b.maxY - b.minY + 1;
  if (tw < 2 || th < 2) return cvs;
  if (tw >= w0 * 0.98 && th >= h0 * 0.98) return cvs;
  const out = document.createElement('canvas');
  out.width = tw; out.height = th;
  const ox = out.getContext('2d', { willReadFrequently: true });
  if (!ox) return cvs;
  applyCtxImageSmoothingOff(ox);
  ox.drawImage(cvs, b.minX, b.minY, tw, th, 0, 0, tw, th);
  return out;
}
/** If chroma was too strong, the frame is ~empty — use raw pixels instead (still visible, SF6-style is secondary). */
function sheetChromaGoneTooFar(p, w, h, astra) {
  const area = (w | 0) * (h | 0);
  if (area < 1) return true;
  let n = 0;
  for (let i = 3; i < p.length; i += 4) {
    if (p[i] > 12) n++;
  }
  const minAstra = Math.max(20, (area * 0.00035) | 0);
  const minMatte = Math.max(40, (area * 0.0008) | 0);
  return astra ? n < minAstra : n < minMatte;
}
function keyKadenChromaToTransparent(p) {
  for (let i = 0; i < p.length; i += 4) {
    const r = p[i], g = p[i + 1], b = p[i + 2];
    if (r < 26 && g < 26 && b < 26) p[i + 3] = 0;
  }
}
/**
 * Sprite Lab / ASTRA sheet: do NOT reuse character_sheet heuristics (cyan labels, “dark AA” rule),
 * or dark clothing/edges get fully keyed out and the sprite disappears in gameplay.
 * Only transparent near-matte black (background); tune threshold if a sheet uses dark gray.
 */
function keyAstraChromaToTransparent(p, thresh) {
  const t = (thresh == null || thresh < 0) ? 10 : Math.min(60, thresh | 0);
  for (let i = 0; i < p.length; i += 4) {
    const r = p[i], g = p[i + 1], b = p[i + 2];
    if (r < t && g < t && b < t) p[i + 3] = 0;
  }
}
/** Gray/white checkered mat (Sprite Lab) */
function isAstraCheckerMat(r, g, b) {
  const max = r > g ? (r > b ? r : b) : (g > b ? g : b);
  const min = r < g ? (r < b ? r : b) : (g < b ? g : b);
  const av = (r + g + b) / 3;
  return (max - min) < 16 && av > 100 && av < 235;
}
/**
 * ASTRA: void / flat dark export background — flood can walk through from edges.
 * spread < 5 blocks brown shoes/soles (higher channel spread) while still clearing rgb(20,20,20) void.
 */
function isAstraFlatVoidOrMatBlack(r, g, b) {
  const max = r > g ? (r > b ? r : b) : (g > b ? g : b);
  const min = r < g ? (r < b ? r : b) : (g < b ? g : b);
  const av = (r + g + b) / 3;
  const spread = max - min;
  return av < 26 && max < 36 && spread < 5;
}
function isAstraBackgroundLike(r, g, b) {
  return isAstraCheckerMat(r, g, b) || isAstraFlatVoidOrMatBlack(r, g, b);
}
/**
 * Flood from frame edges, clearing only “background-like” (checker + near-black) pixels.
 * Second pass: remove trapped checker islands inside the silhouette (rare, small specks).
 */
function keyAstraFloodKeyBackground(p, w, h) {
  const w0 = w | 0, h0 = h | 0;
  if (w0 < 2 || h0 < 2) return;
  const area = w0 * h0;
  const st = new Uint8Array(area);
  const qx = new Int32Array(area);
  const qy = new Int32Array(area);
  let qt = 0;
  function borderPush(x, y) {
    const I = y * w0 + x, o = I * 4;
    if (st[I]) return;
    if (isAstraBackgroundLike(p[o], p[o + 1], p[o + 2])) {
      st[I] = 2;
      qx[qt] = x; qy[qt] = y; qt++;
    } else st[I] = 1;
  }
  for (let x = 0; x < w0; x++) {
    borderPush(x, 0);
    borderPush(x, h0 - 1);
  }
  for (let y = 0; y < h0; y++) {
    borderPush(0, y);
    borderPush(w0 - 1, y);
  }
  let qh = 0;
  while (qh < qt) {
    const x = qx[qh], y = qy[qh], I = y * w0 + x;
    qh++;
    p[I * 4 + 3] = 0;
    for (let d = 0; d < 4; d++) {
      const nx = x + (d === 0 ? -1 : d === 1 ? 1 : 0);
      const ny = y + (d === 2 ? -1 : d === 3 ? 1 : 0);
      if (nx < 0 || ny < 0 || nx >= w0 || ny >= h0) continue;
      const nI = ny * w0 + nx;
      if (st[nI]) continue;
      const o = nI * 4;
      if (isAstraBackgroundLike(p[o], p[o + 1], p[o + 2])) {
        st[nI] = 2;
        qx[qt] = nx; qy[qt] = ny; qt++;
      } else st[nI] = 1;
    }
  }
  // Only nuke *trapped checker islands* (same mat as the floor). Do not remove trapped flat void here —
  // that ate dark shoes/limbs; gameplay sprites looked wrong. Void is already cleared if edge-connected
  // via isAstraFlatVoidOrMatBlack; if not, a tiny speck is preferable to a missing foot.
  for (let I = 0; I < area; I++) {
    if (st[I]) continue;
    const o = I * 4;
    if (isAstraCheckerMat(p[o], p[o + 1], p[o + 2])) p[o + 3] = 0;
  }
}
/** Roster / character select: ASTRA cells use the same checker mat as gameplay — key before scaling to the card. */
function _prepareAstraMenuCellFrom(sheetImg, col, row) {
  if (!sheetImg || !sheetImg.complete || (sheetImg.naturalWidth | 0) < 1 || !_menuAstraTmpCtx) return [0, 0];
  const ac = astraCell(col, row);
  const sw = ac.sw | 0, sh = ac.sh | 0;
  if (sw < 1 || sh < 1) return [0, 0];
  if (_menuAstraTmp.width !== sw || _menuAstraTmp.height !== sh) {
    _menuAstraTmp.width = sw;
    _menuAstraTmp.height = sh;
  }
  _menuAstraTmpCtx.clearRect(0, 0, sw, sh);
  _menuAstraTmpCtx.drawImage(sheetImg, ac.sx, ac.sy, sw, sh, 0, 0, sw, sh);
  try {
    const mid = _menuAstraTmpCtx.getImageData(0, 0, sw, sh);
    keyAstraFloodKeyBackground(mid.data, sw, sh);
    _menuAstraTmpCtx.putImageData(mid, 0, 0);
  } catch (_) {
    /* Taint or security: use unkeyed mat (roster may show checker) */
  }
  return [sw, sh];
}
/**
 * ASTRA roster: key cell first, then draw a source sub-rectangle with cover + clip. vertical: 'bottom' | 'center'
 */
function _drawAstraKeyedSrcCover(tctx, sheetImg, col, row, sx, sy, ssw, ssh, boxX, boxY, boxW, boxH, vertical, scaleMult) {
  if (!tctx || !sheetImg) return;
  const dim = _prepareAstraMenuCellFrom(sheetImg, col, row);
  if ((dim[0] | 0) < 1 || (dim[1] | 0) < 1) return;
  const ssw0 = ssw | 0, ssh0 = ssh | 0;
  if (ssw0 < 1 || ssh0 < 1) return;
  const sm = typeof scaleMult === 'number' && scaleMult > 0 ? scaleMult : 1;
  const sc = Math.max(boxW / ssw0, boxH / ssh0) * sm;
  const dw3 = (ssw0 * sc) | 0, dh3 = (ssh0 * sc) | 0;
  const ox = (boxX + (((boxW - dw3) * 0.5) | 0)) | 0;
  const oy = vertical === 'center'
    ? (boxY + (((boxH - dh3) * 0.5) | 0)) | 0
    : (boxY + (boxH - dh3)) | 0;
  const sx0 = Math.max(0, sx | 0);
  const sy0 = Math.max(0, sy | 0);
  applyCtxImageSmoothingOff(tctx);
  tctx.save();
  tctx.beginPath();
  tctx.rect(boxX, boxY, boxW, boxH);
  tctx.clip();
  tctx.drawImage(_menuAstraTmp, sx0, sy0, ssw0, ssh0, ox, oy, dw3, dh3);
  tctx.restore();
}
/**
 * ASTRA top row: [bust crop | name + kanji | mini stance] — one keyed cell from this fighter’s Sprite Lab sheet.
 * `slot` is roster index 0–4; the sheet is always taken from `astraFighterSheets[slot]` (never a captured Image).
 */
function drawAstraRosterTopBanner(tctx, slot, c, col, row, boxX, boxY, boxW, boxH) {
  if (!tctx) return;
  const sheetImg = astraFighterSheets[slot | 0];
  if (!sheetImg) return;
  const dim = _prepareAstraMenuCellFrom(sheetImg, col, row);
  const sw = dim[0] | 0, sh = dim[1] | 0;
  if (sw < 1 || sh < 1) return;
  const bustW = Math.max(58, (boxW * 0.35) | 0);
  const miniW = Math.max(48, (boxW * 0.28) | 0);
  const midW = boxW - bustW - miniW;
  const headH = ((sh * 0.5) | 0);
  _drawAstraKeyedSrcCover(tctx, sheetImg, col, row, 0, 0, sw, headH, boxX, boxY, bustW, boxH, 'center', 1.08);
  _drawAstraKeyedSrcCover(tctx, sheetImg, col, row, 0, 0, sw, sh, boxX + boxW - miniW, boxY, miniW, boxH, 'bottom', 1);
  const mx = (boxX + bustW + midW * 0.5) | 0;
  const fEn = Math.max(16, (boxH * 0.2) | 0);
  const fJp = Math.max(14, (boxH * 0.16) | 0);
  const my1 = (boxY + boxH * 0.38) | 0, my2 = (boxY + boxH * 0.7) | 0;
  const jpStr = c.jp != null ? String(c.jp) : '';
  tctx.save();
  tctx.textAlign = 'center';
  tctx.textBaseline = 'middle';
  tctx.lineJoin = 'round';
  tctx.miterLimit = 2;
  tctx.font = 'bold ' + fEn + 'px Impact, "Arial Black", system-ui, sans-serif';
  tctx.lineWidth = 2.4;
  tctx.strokeStyle = 'rgba(0,0,0,0.85)';
  tctx.strokeText(c.name, mx, my1);
  tctx.lineWidth = 0;
  tctx.fillStyle = c.color;
  tctx.fillText(c.name, mx, my1);
  if (jpStr) {
    tctx.font = '600 ' + fJp + 'px "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", "Noto Sans JP", "PingFang SC", system-ui, sans-serif';
    tctx.lineWidth = 2;
    tctx.strokeStyle = 'rgba(0,0,0,0.85)';
    tctx.strokeText(jpStr, mx, my2);
    tctx.lineWidth = 0;
    tctx.fillStyle = c.color;
    tctx.fillText(jpStr, mx, my2);
  }
  tctx.restore();
}
/**
 * ASTRA roster slots: key the cell, then cover + clip. opts: { scaleMult, vertical: 'bottom' | 'center' }
 */
function drawAstraCellKeyedInBox(tctx, slot, col, row, boxX, boxY, boxW, boxH, opts) {
  if (!tctx) return;
  const sheetImg = astraFighterSheets[slot | 0];
  if (!sheetImg) return;
  const o = opts && typeof opts === 'object' ? opts : {};
  const vertical = o.vertical === 'center' ? 'center' : 'bottom';
  const scaleMult = typeof o.scaleMult === 'number' && o.scaleMult > 0 ? o.scaleMult : 1;
  const dim = _prepareAstraMenuCellFrom(sheetImg, col, row);
  const sw = dim[0] | 0, sh = dim[1] | 0;
  if (sw < 1 || sh < 1) return;
  _drawAstraKeyedSrcCover(tctx, sheetImg, col, row, 0, 0, sw, sh, boxX, boxY, boxW, boxH, vertical, scaleMult);
}
/** @param {CanvasImageSource} img */
function drawKadenMenuImageCoverClipped(ctx, img, boxX, boxY, boxW, boxH, opts) {
  if (!img || !img.complete || (img.naturalWidth | 0) < 1) return;
  const o = opts && typeof opts === 'object' ? opts : {};
  const vertical = o.vertical === 'center' ? 'center' : 'bottom';
  const scaleMult = typeof o.scaleMult === 'number' && o.scaleMult > 0 ? o.scaleMult : 1;
  const aw = img.naturalWidth | 0, ah = img.naturalHeight | 0;
  const sc = Math.max(boxW / aw, boxH / ah) * scaleMult;
  const dw = (aw * sc) | 0, dh = (ah * sc) | 0;
  const ox = (boxX + (((boxW - dw) * 0.5) | 0)) | 0;
  const oy = vertical === 'center'
    ? (boxY + (((boxH - dh) * 0.5) | 0)) | 0
    : (boxY + (boxH - dh)) | 0;
  applyCtxImageSmoothingOff(ctx);
  ctx.save();
  ctx.beginPath();
  ctx.rect(boxX, boxY, boxW, boxH);
  ctx.clip();
  ctx.drawImage(img, 0, 0, aw, ah, ox, oy, dw, dh);
  ctx.restore();
}
/** Fills _chromaCanvas with a keyed slice (black bg + cyan label text → transparent). */
function buildChromaSlice(sx, sy, sw, sh) {
  if (!sheet.complete || sheet.naturalWidth <= 0) return;
  const w = Math.max(1, Math.floor(sw));
  const h0 = Math.max(1, Math.floor(sh));
  _chromaCanvas.width = w;
  _chromaCanvas.height = h0;
  _chromaCtx.clearRect(0, 0, w, h0);
  _chromaCtx.drawImage(sheet, Math.floor(sx), Math.floor(sy), w, h0, 0, 0, w, h0);
  const img = _chromaCtx.getImageData(0, 0, w, h0);
  keySheetChromaToTransparent(img.data);
  keySheetChromaDespeckle(img.data, w, h0);
  _chromaCtx.putImageData(img, 0, 0);
}
/** Bakes full Kaden key art once (black key); reused every frame for sharp, fast blits. */
function bakeKadenPortraitChromaOnce() {
  if (kadenChromaBaked || !kadenGameplay.complete || kadenGameplay.naturalWidth <= 0) return;
  const w = kadenGameplay.naturalWidth | 0;
  const h0 = kadenGameplay.naturalHeight | 0;
  if (w < 2 || h0 < 2) return;
  _kadenBaked.width = w;
  _kadenBaked.height = h0;
  _kadenBakedCtx.clearRect(0, 0, w, h0);
  _kadenBakedCtx.drawImage(kadenGameplay, 0, 0, w, h0, 0, 0, w, h0);
  const img = _kadenBakedCtx.getImageData(0, 0, w, h0);
  keyKadenChromaToTransparent(img.data);
  _kadenBakedCtx.putImageData(img, 0, 0);
  kadenChromaBaked = true;
}
kadenGameplay.addEventListener('load', () => { kadenChromaBaked = false; bakeKadenPortraitChromaOnce(); });
if (kadenGameplay.complete) bakeKadenPortraitChromaOnce();
/** In-battle Kaden: Taekwondo move sheet (1024×682, black key). One strip per move; each strip sliced into equal-width frames. */
const kadenTaekwondoSheet = new Image();
const _FTKW_RETRIES = 6;
armImageWithNetworkRetry(kadenTaekwondoSheet, `assets/kaden_taekwondo_sheet.png?v=${ASTRA_ASSET_VER}`, 'kaden_taekwondo_sheet', _FTKW_RETRIES);
/** In-battle Raijin: Muay Thai + lightning (1024×682, black key) — same strip layout as Kaden sheet. */
const raijinTaekwondoSheet = new Image();
armImageWithNetworkRetry(raijinTaekwondoSheet, `assets/raijin_taekwondo_sheet.png?v=${ASTRA_ASSET_VER}`, 'raijin_taekwondo_sheet', _FTKW_RETRIES);
/** In-battle Hikari: Wushu sheet (1024×682, black key). */
const hikariWushuSheet = new Image();
armImageWithNetworkRetry(hikariWushuSheet, `assets/hikari_wushu_sheet.png?v=${ASTRA_ASSET_VER}`, 'hikari_wushu_sheet', _FTKW_RETRIES);
/** In-battle Ren: Aikido sheet (1024×682, black key). */
const renAikidoSheet = new Image();
armImageWithNetworkRetry(renAikidoSheet, `assets/ren_aikido_sheet.png?v=${ASTRA_ASSET_VER}`, 'ren_aikido_sheet', _FTKW_RETRIES);
/** In-battle Yuki: Judo sheet (1024×682, black key). */
const yukiJudoSheet = new Image();
armImageWithNetworkRetry(yukiJudoSheet, `assets/yuki_judo_sheet.png?v=${ASTRA_ASSET_VER}`, 'yuki_judo_sheet', _FTKW_RETRIES);
/** Prioritize + decode so fightTkwUseInFight is true on frame 1 (avoids ASTRA fallback). */
(function primeFightMoveSheetsFromCache() {
  const list = [kadenTaekwondoSheet, raijinTaekwondoSheet, hikariWushuSheet, renAikidoSheet, yukiJudoSheet];
  function tryDecode(im) {
    if (!im || !im.decode) return;
    if (im.complete && (im.naturalWidth | 0) > 0) im.decode().catch(function () {});
  }
  list.forEach(function (im) {
    if (!im) return;
    try { if ('fetchPriority' in im) im.fetchPriority = 'high'; } catch (_) { /* */ }
    tryDecode(im);
    im.addEventListener('load', function () { tryDecode(im); }, { once: true });
  });
})();

const KADEN_TKW = {
  idle: { x: 285, y: 13, w: 108, h: 31, f: 3 },
  /**
   * Order matches the sheet: jab, front, round, jump, crescent, axe, side, low, backflip, spin/jab2.
   * (x, y, w, h) from automated bbox on `assets/kaden_taekwondo_sheet.png`; f = frame count in strip.
   */
  moves: [
    { x: 32, y: 104, w: 45, h: 67, f: 3 },
    { x: 96, y: 104, w: 46, h: 67, f: 3 },
    { x: 165, y: 104, w: 48, h: 67, f: 4 },
    { x: 272, y: 105, w: 47, h: 66, f: 4 },
    { x: 342, y: 107, w: 49, h: 64, f: 3 },
    { x: 410, y: 107, w: 47, h: 64, f: 3 },
    { x: 519, y: 104, w: 29, h: 67, f: 4 },
    { x: 580, y: 104, w: 38, h: 67, f: 4 },
    { x: 645, y: 104, w: 74, h: 67, f: 5 },
    { x: 753, y: 104, w: 44, h: 67, f: 3 }
  ],
  s1: { x: 323, y: 500, w: 154, h: 131, f: 6 },
  s2: { x: 807, y: 500, w: 70, h: 131, f: 6 }
};
/** Game action / attack name → move strip index 0..9. */
const KADEN_TKW_NORM = {
  jab: 0, cross: 0, uppercut: 0, hook: 2, palm: 4,
  'front kick': 1, 'push kick': 1, 'flick kick': 1,
  'round kick': 2, 'spin kick': 9, 'crescent kick': 4, crescent: 4,
  'jump kick': 3, 'low kick': 7, 'axe kick': 5, 'side kick': 6, 'back kick': 8
};
/** Raijin: jab, low, round, knee, elbow, spin back, teep, sweep, flying, wide finisher. */
const RAIJIN_TKW = {
  idle: { x: 292, y: 12, w: 92, h: 33, f: 3 },
  moves: [
    { x: 24, y: 104, w: 53, h: 67, f: 3 },
    { x: 96, y: 104, w: 50, h: 67, f: 3 },
    { x: 166, y: 104, w: 53, h: 67, f: 3 },
    { x: 272, y: 107, w: 43, h: 64, f: 3 },
    { x: 346, y: 107, w: 55, h: 64, f: 3 },
    { x: 419, y: 107, w: 38, h: 64, f: 4 },
    { x: 530, y: 107, w: 48, h: 64, f: 3 },
    { x: 598, y: 106, w: 59, h: 65, f: 5 },
    { x: 782, y: 107, w: 49, h: 64, f: 4 },
    { x: 909, y: 104, w: 104, h: 67, f: 4 }
  ],
  s1: { x: 320, y: 500, w: 175, h: 131, f: 5 },
  s2: { x: 881, y: 500, w: 118, h: 131, f: 5 }
};
const RAIJIN_TKW_NORM = {
  jab: 0, cross: 0, uppercut: 0, hook: 4, palm: 4,
  'low kick': 1, 'flick kick': 1, 'crescent kick': 2, crescent: 2,
  'round kick': 2, 'spin kick': 5, 'back kick': 5,
  'front kick': 6, 'push kick': 6, 'side kick': 6,
  'jump kick': 8, 'axe kick': 3
};
/** Wushu: palm, front snap, spin hook, flying side, swallow, round, backfist, low sweep, backflip, finisher. */
const HIKARI_TKW = {
  idle: { x: 224, y: 12, w: 172, h: 33, f: 4 },
  moves: [
    { x: 27, y: 111, w: 33, h: 60, f: 4 },
    { x: 82, y: 111, w: 33, h: 60, f: 4 },
    { x: 135, y: 111, w: 34, h: 60, f: 4 },
    { x: 194, y: 111, w: 32, h: 60, f: 3 },
    { x: 266, y: 111, w: 37, h: 60, f: 3 },
    { x: 323, y: 111, w: 34, h: 60, f: 3 },
    { x: 378, y: 111, w: 38, h: 60, f: 3 },
    { x: 432, y: 108, w: 68, h: 63, f: 5 },
    { x: 528, y: 111, w: 39, h: 60, f: 4 },
    { x: 630, y: 112, w: 42, h: 59, f: 4 }
  ],
  s1: { x: 84, y: 500, w: 318, h: 131, f: 4 },
  s2: { x: 855, y: 500, w: 111, h: 131, f: 4 }
};
const HIKARI_TKW_NORM = {
  jab: 0, cross: 0, palm: 0, uppercut: 0, hook: 6,
  'front kick': 1, 'push kick': 1, 'flick kick': 1, 'side kick': 1,
  'round kick': 5, 'crescent kick': 5, crescent: 5, 'spin kick': 2,
  'jump kick': 3, 'low kick': 7, 'axe kick': 4, 'back kick': 8
};
/** Aikido: open palm, flow, throw entry, irimi, tenkan, grab counter, shiho, koten, pin, finisher. */
const REN_TKW = {
  idle: { x: 24, y: 105, w: 40, h: 71, f: 3 },
  moves: [
    { x: 86, y: 105, w: 38, h: 72, f: 3 },
    { x: 144, y: 105, w: 45, h: 72, f: 4 },
    { x: 234, y: 105, w: 52, h: 72, f: 4 },
    { x: 303, y: 104, w: 53, h: 72, f: 3 },
    { x: 378, y: 108, w: 45, h: 68, f: 3 },
    { x: 427, y: 106, w: 46, h: 72, f: 3 },
    { x: 504, y: 107, w: 38, h: 70, f: 4 },
    { x: 573, y: 107, w: 40, h: 70, f: 5 },
    { x: 627, y: 107, w: 40, h: 70, f: 5 },
    { x: 677, y: 104, w: 62, h: 72, f: 5 }
  ],
  s1: { x: 160, y: 495, w: 315, h: 144, f: 7 },
  s2: { x: 688, y: 480, w: 317, h: 160, f: 5 }
};
const REN_TKW_NORM = {
  jab: 0, cross: 0, palm: 0, uppercut: 0, hook: 5,
  'front kick': 1, 'push kick': 1, 'flick kick': 1, 'side kick': 1,
  'round kick': 2, 'crescent kick': 2, crescent: 2, 'spin kick': 2,
  'jump kick': 3, 'low kick': 6, 'axe kick': 3, 'back kick': 4
};
/** Judo: grip, seoi, o-goshi, sweep, uchi-mata, kote, ashi, side, kesa, finisher. */
const YUKI_TKW = {
  idle: { x: 24, y: 106, w: 41, h: 88, f: 3 },
  moves: [
    { x: 90, y: 100, w: 42, h: 94, f: 3 },
    { x: 163, y: 108, w: 43, h: 85, f: 4 },
    { x: 240, y: 100, w: 52, h: 93, f: 3 },
    { x: 18, y: 255, w: 42, h: 80, f: 3 },
    { x: 70, y: 255, w: 42, h: 80, f: 3 },
    { x: 121, y: 256, w: 100, h: 79, f: 4 },
    { x: 256, y: 255, w: 58, h: 80, f: 3 },
    { x: 95, y: 391, w: 91, h: 66, f: 5 },
    { x: 310, y: 402, w: 105, h: 54, f: 5 },
    { x: 305, y: 100, w: 49, h: 92, f: 3 }
  ],
  s1: { x: 280, y: 499, w: 140, h: 124, f: 6 },
  s2: { x: 710, y: 505, w: 165, h: 119, f: 6 }
};
const YUKI_TKW_NORM = {
  jab: 0, cross: 0, palm: 0, uppercut: 0, hook: 1,
  'front kick': 2, 'push kick': 2, 'flick kick': 2, 'side kick': 2,
  'round kick': 1, 'crescent kick': 1, crescent: 1, 'spin kick': 1,
  'jump kick': 3, 'low kick': 5, 'axe kick': 3, 'back kick': 2
};

function kadenTaekwondoSheetReady() {
  const im = kadenTaekwondoSheet;
  return !!(im && im.complete && (im.naturalWidth | 0) > 0 && (im.naturalHeight | 0) > 0);
}
function raijinTaekwondoSheetReady() {
  const im = raijinTaekwondoSheet;
  return !!(im && im.complete && (im.naturalWidth | 0) > 0 && (im.naturalHeight | 0) > 0);
}
function hikariWushuSheetReady() {
  const im = hikariWushuSheet;
  return !!(im && im.complete && (im.naturalWidth | 0) > 0 && (im.naturalHeight | 0) > 0);
}
function renAikidoSheetReady() {
  const im = renAikidoSheet;
  return !!(im && im.complete && (im.naturalWidth | 0) > 0 && (im.naturalHeight | 0) > 0);
}
function yukiJudoSheetReady() {
  const im = yukiJudoSheet;
  return !!(im && im.complete && (im.naturalWidth | 0) > 0 && (im.naturalHeight | 0) > 0);
}
function fightTkwDef(charIdx) {
  const c = charIdx | 0;
  if (c === 0) return KADEN_TKW;
  if (c === 1) return RAIJIN_TKW;
  if (c === 2) return HIKARI_TKW;
  if (c === 3) return REN_TKW;
  if (c === 4) return YUKI_TKW;
  return null;
}
function fightTkwImageForChar(charIdx) {
  const c = charIdx | 0;
  if (c === 0) return kadenTaekwondoSheet;
  if (c === 1) return raijinTaekwondoSheet;
  if (c === 2) return hikariWushuSheet;
  if (c === 3) return renAikidoSheet;
  if (c === 4) return yukiJudoSheet;
  return kadenTaekwondoSheet;
}
/** Kaden–Yuki (0–4) use full move sheet in battle when the PNG is loaded. */
function fightTkwUseInFight(f) {
  const c = f.char | 0;
  if (c === 0) return kadenTaekwondoSheetReady();
  if (c === 1) return raijinTaekwondoSheetReady();
  if (c === 2) return hikariWushuSheetReady();
  if (c === 3) return renAikidoSheetReady();
  if (c === 4) return yukiJudoSheetReady();
  return false;
}
function tkwSubRect(meta, fr) {
  const f = Math.max(1, meta.f | 0);
  const fi = Math.max(0, Math.min(f - 1, fr | 0));
  const w0 = (meta.w / f);
  const sx = (meta.x + fi * w0) | 0;
  const sw0 = (fi === f - 1 ? meta.w - (sx - meta.x) : w0) | 0;
  return { sx, sy: meta.y | 0, sw: Math.max(1, sw0), sh: Math.max(1, meta.h | 0) };
}
/** Must match `physics` lock tick (0.01) or the last ~6 frames of an attack can drop tkw and show the wrong strip. */
const TKW_LOCK_MIN = 0.01;
function tkwFrameIndexForLock(f) {
  const kw = f._tkw;
  const d = fightTkwDef(f.char | 0);
  if (kw && f.lock > TKW_LOCK_MIN && kw.l0 > 0) {
    const t = 1 - f.lock / kw.l0;
    return Math.max(0, Math.min(kw.n - 1, Math.floor(t * kw.n)));
  }
  if (d && f.action === 'super' && f.lock > TKW_LOCK_MIN) {
    const nf = Math.max(1, d.s2.f | 0);
    return Math.max(0, Math.min(nf - 1, Math.floor((1 - f.lock / 60) * nf)));
  }
  if (d && f.action === 'special' && f.lock > TKW_LOCK_MIN) {
    const nf = Math.max(1, d.s1.f | 0);
    const c = f.char | 0;
    const spL = c === 0 ? 38 : c === 1 ? 30 : c === 2 ? 22 : c === 3 ? 30 : c === 4 ? 36 : 32;
    return Math.max(0, Math.min(nf - 1, Math.floor((1 - f.lock / spL) * nf)));
  }
  return 0;
}
function tkwMetaForFighter(f) {
  const d = fightTkwDef(f.char | 0);
  if (!d) return KADEN_TKW.idle;
  if (f._tkw && f.lock > TKW_LOCK_MIN) {
    if (f._tkw.kind === 'n') return d.moves[f._tkw.mid] || d.moves[0];
    if (f._tkw.kind === 's1') return d.s1;
    if (f._tkw.kind === 's2') return d.s2;
  }
  if (f.action === 'super' && f.lock > TKW_LOCK_MIN) return d.s2;
  if (f.action === 'special' && f.lock > TKW_LOCK_MIN) return d.s1;
  if (f.action === 'frontflip' || f.action === 'backflip') return d.moves[3];
  if (f.action === 'jump') return d.moves[3];
  return d.idle;
}
function tkwBaseFrame(f) {
  if (f._tkw && f.lock > TKW_LOCK_MIN) return tkwFrameIndexForLock(f);
  if (f.action === 'super' && f.lock > TKW_LOCK_MIN) return tkwFrameIndexForLock(f);
  if (f.action === 'special' && f.lock > TKW_LOCK_MIN) return tkwFrameIndexForLock(f);
  if (f.action === 'frontflip' || f.action === 'backflip') {
    const u = 1 - f.lock / FIGHTER_FLIP_FRAMES;
    return Math.max(0, Math.min(3, (u * 4) | 0));
  }
  {
    const _def = fightTkwDef(f.char | 0);
    const _idleF = _def && _def.idle && _def.idle.f ? Math.max(1, _def.idle.f | 0) : 3;
    if (f.action === 'walk') return (Math.floor(f.animT) % _idleF);
    if (f.action === 'idle' || f.action === 'block' || f.action === 'crouch') { return (Math.floor(f.animT * 0.4) % _idleF); }
  }
  if (f.action === 'jump') return Math.max(0, Math.min(3, Math.floor((FLOOR_FIGHT_Y - f.y) / 45)));
  if (f.action === 'hurt' || f.action === 'knockdown') return 0;
  return 0;
}
function tkwSrcForDraw(f) {
  const m = tkwMetaForFighter(f);
  return tkwSubRect(m, tkwBaseFrame(f));
}
/**
 * In battle, Kaden always uses the sheet row (side-view) so `ctx.scale(-1,1)` flips
 * them toward the opponent. The static HD `kaden-gameplay` is front view — it never
 * looks like true left/right facing. Menus / end cards use the classic sheet or HD
 * depending on USE_CLASSIC_KADEN_PORTRAIT. Character select uses `astra_fighter_sheet`
 * for Kaden’s card (bust + mini + portrait), same as other ASTRA fighters. Cell (0,0) is
 * built from `kaden-gameplay` in the repo; HD `kaden-gameplay` is for VS / loss / taunt.
 */
const USE_CLASSIC_KADEN_PORTRAIT = typeof location === 'undefined' || (String(location.search || '').indexOf('kadenHD=1') < 0);
/**
 * HD `kaden-gameplay` for VS / loss / taunt art (not the character-select ASTRA card).
 * `?kadenClassic=1` forces non-HD/legacy; `?kadenHD=1` can still request HD when the PNG is available.
 */
function useKadenHdMenuPortrait() {
  if (String(location.search || '').indexOf('kadenClassic=1') >= 0) return false;
  if (kadenGameplay.complete && (kadenGameplay.naturalWidth | 0) > 0) return true;
  return !USE_CLASSIC_KADEN_PORTRAIT;
}
function useKadenPortraitForAction() {
  return false;
}

const menuBg = new Image();
menuBg.src = 'assets/main-menu-hero.png';

const stageStrip = new Image();
stageStrip.src = 'assets/stages-strip.png';
/** When true, the fight draws `stages-strip.png`. Add ?noStage=1 to the URL to hide it (e.g. testing). */
const USE_GAMEPLAY_STAGE_IMAGE = typeof location === 'undefined' || (String(location.search || '').indexOf('noStage=1') < 0);

const gameOverBg = new Image();
gameOverBg.src = 'assets/game-over.png';

/** Replaces former leaderboard-bg.png: canvas fallbacks (store, non-HTML scores) */
function drawProceduralLeaderboardCanvasBg() {
  const g = ctx.createLinearGradient(0, 0, 1280, 720);
  g.addColorStop(0, '#0c0614');
  g.addColorStop(0.4, '#08040e');
  g.addColorStop(0.7, '#05020a');
  g.addColorStop(1, '#030108');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1280, 720);
  const h = ctx.createRadialGradient(640, 0, 40, 640, 180, 500);
  h.addColorStop(0, 'rgba(120, 50, 40, 0.2)');
  h.addColorStop(0.5, 'rgba(60, 20, 30, 0.08)');
  h.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = h;
  ctx.fillRect(0, 0, 1280, 720);
  const s = ctx.createLinearGradient(0, 0, 0, 720);
  s.addColorStop(0, 'rgba(0,0,0,0.08)');
  s.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = s;
  ctx.fillRect(0, 0, 1280, 720);
  return true;
}

// --- Character roster -------------------------------------------------------
const characters = [
  {name:'KADEN',  jp:'火伝', color:'#e23a2e', style:'Taekwondo',       special:'Raging Palm',   super:'Kaden Fury',       row:0,
    specialDesc:'Armored palm wave — eats one hit'},
  {name:'RAIJIN', jp:'雷神', color:'#3aa7ff', style:'Muay Thai',  special:'Thunder Dash',  super:'Storm Breaker',    row:1,
    specialDesc:'Teleport behind opponent and strike'},
  {name:'HIKARI', jp:'光',   color:'#ff4f91', style:'Wushu', special:'Sakura Step',   super:'Blossom Storm',    row:2,
    specialDesc:'Air-dash with brief invincibility'},
  {name:'REN',    jp:'蓮',   color:'#7ec46b', style:'Aikido',  special:'Lotus Guard',   super:'Lotus Ascension',  row:3,
    specialDesc:'Parry the next hit and counter'},
  {name:'YUKI',   jp:'雪',   color:'#69cfff', style:'Judo',  special:'Frost Slide',   super:'Absolute Zero',    row:4,
    specialDesc:'Slow ice wave that lingers'},

  // Final boss (not selectable)
  {name:'REIGEN', jp:'永遠の影', color:'#a855f7', style:'FINAL BOSS', special:'Shadow Techniques', super:'Void Destruction', row:1,
    specialDesc:'3-phase boss with regen + brutal punishes'}
];
const SELECTABLE_COUNT = 5;
const BOSS_INDEX = 5;
const rowY = [0, 200, 392, 572, 748];
const rowH = [198, 190, 178, 174, 168];

function sheetRowTop(charIdx) {
  if ((charIdx | 0) === BOSS_INDEX) return 0; // `reigen_classic_row.png` is a single legacy row; UVs start at y=0
  const r = characters[charIdx]?.row;
  return rowY[r] ?? rowY[0];
}
function sheetRowHeight(charIdx) {
  if ((charIdx | 0) === BOSS_INDEX) {
    const r = characters[BOSS_INDEX]?.row;
    return (r != null && r >= 0 && r < rowH.length) ? rowH[r] : rowH[1];
  }
  const r = characters[charIdx]?.row;
  return rowH[r] ?? rowH[0];
}
// Skip the label strip; columns often include “IDLE”/“WALK” text—chroma also removes it.
const SHEET_CELL_TOP = 22;
// VFX / shield radii were tuned vs ~2.4× body art; re-scale from integer SPRITE_SCALE
const FIGHTER_FX = SPRITE_SCALE / 2.4;
const FIGHTER_DRAW_SCALE = 1.6;
// Kaden (ASTRA + gameplay portrait) uses tall cells; 90px cap matched legacy height but the figure read small vs the cast — nudge toward a taller “row” so on-screen size matches other fighters.
const KADEN_TARGET_ROW_REF = 105;
/** World-space camera (integer px; no subpixel scroll jitter) */
const camera = { x: 0, y: 0 };
// Air acrobatics: full 360° rotation, ~0.7s
const FIGHTER_FLIP_FRAMES = 44;
// Align with wood floor in stages-strip (taller scale needs a lower Y so feet sit on the planks)
const GROUND_DRAW_Y = 706;
const FLOOR_FIGHT_Y = GROUND_DRAW_Y;
// Projectiles were authored vs old floor=600; shift keeps hand height consistent
const FLOOR_PROJ_DY = FLOOR_FIGHT_Y - 600;

// --- Global state -----------------------------------------------------------
let state = 'menu';
let menuHot = null;     // which menu button the pointer is over (menu state only)
let menuDDOpen = false; // main menu: left column is a dropdown list
let menuDDFocus = 0;   // index in MENU_GAME_DROP_ORDER when list is open (keyboard + mouse)
let menuHintText = '';
let menuHintUntil = 0;  // performance.now() deadline for a short top-of-screen message
let pendingPlayMode = 'tournament';
let playMode = 'tournament';
let p2IsHuman = false;  // local versus: P2 on arrows + number keys
let storeSel = 0;       // extras store row
let storyPage = 0;
const STORY_INTRO = [
  'A shadow dojo reopens its gates. Four rivals stand between you and the one who was never meant to be challenged.',
  'Kaden and his rivals carry old grudges into the same ring — the tournament will name the true master of the RISE OF REIGEN line.',
  'The path of the Kaden Fighters is written in fists, not in fate. Step into the light when you are ready to fight.'
];
const STORE_ITEMS = [
  { name: 'Classic HUD frame',  cost: 0,  note: 'Always on' },
  { name: 'Rival color pack',   cost: 5,  note: '5 tournament wins' },
  { name: 'Gallery: stage art', cost: 10, note: '10 tournament wins' },
  { name: 'Prototype extra slot', cost: 99, note: 'Planned' },
];
let sel = 0, oppIndex = 1;
let round = 1, p1wins = 0, p2wins = 0;
let tournamentWins = 0;        // opponents defeated in tournament
let score = 0;
let runMaxCombo = 0;            // per-run; saved to local leaderboard
let msg = '';
let hitPause = 0;              // freezes update loop while > 0
let shake = 0;                 // screen-shake intensity
const sparks = [];             // hit/effect particles
let p1, p2;
let projectiles = [];
let lastOpponentChar = 1;
let endTaunt = '';
let endTauntSpeaker = 1;

// --- Global leaderboard (Neon /api/high-scores) -----------------------------
// Static hosts (file:, Python, Live Server) have no /api — use a stub JSON to avoid 404s in the console.
// Set window.__KADEN_LEADERBOARD_GET_URL = '/api/high-scores' to always hit the Vercel serverless API.
// Set window.__KADEN_LEADERBOARD_GET_URL = 'assets/leaderboard-stub.json' to force local-only.
const LEADERBOARD_STUB_URL = 'assets/leaderboard-stub.json';
const LS_PLAYER_NAME = 'kadenFighterName';
let scoreSubmittedThisRun = false;
let leaderboardRows = [];
let leaderboardLoadState = 'idle'; // idle | loading | ok | error
let lastSubmitStatus = '';

function getHighScoresListUrl() {
  if (typeof window === 'undefined' || !window) return LEADERBOARD_STUB_URL;
  if (window.__KADEN_LEADERBOARD_GET_URL != null && String(window.__KADEN_LEADERBOARD_GET_URL) !== '') {
    return String(window.__KADEN_LEADERBOARD_GET_URL);
  }
  var p = (location && location.port) || '';
  var h = (location && location.hostname) || '';
  var pr = (location && location.protocol) || '';
  if (pr === 'file:') return LEADERBOARD_STUB_URL;
  if (h === 'localhost' || h === '127.0.0.1' || h === '::1') {
    if (p === '3000') return '/api/high-scores';
    return LEADERBOARD_STUB_URL;
  }
  if (/^10\./.test(h) || /^192\.168\./.test(h)) return LEADERBOARD_STUB_URL;
  if (h.endsWith('github.io') || h.endsWith('gitee.io') || h.endsWith('netlify.app')) {
    return LEADERBOARD_STUB_URL;
  }
  if (h.endsWith('vercel.app')) return '/api/high-scores';
  return '/api/high-scores';
}

function usesHighScoresApiPost() {
  const u = getHighScoresListUrl();
  if (u.indexOf('leaderboard-stub') !== -1) return false;
  if (u.indexOf('/api/high') === -1) return false;
  return true;
}

function getPlayerName() {
  try {
    const s = localStorage.getItem(LS_PLAYER_NAME);
    if (s && String(s).trim()) return String(s).trim().slice(0, 12);
  } catch (_) {}
  return 'FIGHTER';
}

function setPlayerName(raw) {
  const cleaned = String(raw || 'FIGHTER').slice(0, 12).replace(/[^a-zA-Z0-9 _-]/g, '') || 'FIGHTER';
  try { localStorage.setItem(LS_PLAYER_NAME, cleaned); } catch (_) {}
  return cleaned;
}

async function fetchLeaderboard() {
  leaderboardLoadState = 'loading';
  leaderboardRows = [];
  try {
    const url = getHighScoresListUrl();
    const r = await fetch(url, { cache: 'no-store' });
    if (!r || !r.ok) {
      leaderboardLoadState = 'error';
      return;
    }
    const ct = (r.headers && r.headers.get && r.headers.get('content-type')) || '';
    var j = null;
    if (ct.indexOf('application/json') >= 0) {
      j = await r.json();
    } else {
      const raw = await r.text();
      try { j = JSON.parse(raw); } catch (_) { j = null; }
    }
    if (j && j.ok && Array.isArray(j.scores)) {
      leaderboardRows = j.scores;
      leaderboardLoadState = 'ok';
    } else {
      leaderboardLoadState = 'error';
    }
  } catch (_) {
    leaderboardLoadState = 'error';
  }
}

function submitRunToLeaderboard(finalScore, name, runWon) {
  if (scoreSubmittedThisRun) return;
  scoreSubmittedThisRun = true;
  const s = Math.max(0, Math.min(99999999, Math.floor(Number(finalScore) || 0)));
  if (typeof LeaderboardData !== 'undefined' && LeaderboardData.recordLocalRun) {
    try {
      const w = runWon === true;
      const fighterName = (typeof characters !== 'undefined' && typeof sel === 'number' && characters[sel]) ? characters[sel].name : 'KADEN';
      const sp = (typeof characters !== 'undefined' && typeof sel === 'number' && characters[sel] && characters[sel].special) || 'Raging Palm';
      LeaderboardData.recordLocalRun({
        name: (name && String(name).trim()) || getPlayerName(),
        score: s,
        fighter: fighterName,
        tournamentWins: typeof tournamentWins !== 'undefined' ? (tournamentWins | 0) : 0,
        runMaxCombo: typeof runMaxCombo !== 'undefined' ? (runMaxCombo | 0) : 0,
        won: w,
        favoriteMove: sp,
      });
    } catch (_) { /* @firebase: also sync run document to Firestore */ }
  }
  if (!usesHighScoresApiPost()) {
    lastSubmitStatus = 'Saved locally — global board needs the deployed /api (Neon) site.';
    return;
  }
  lastSubmitStatus = 'Saving score…';
  fetch('/api/high-scores', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: name || 'FIGHTER', score: s }),
  })
    .then(r => r.json().catch(() => ({})))
    .then(j => {
      lastSubmitStatus = j && j.ok ? 'Saved to global scoreboard!' : 'Save failed — check connection or DATABASE_URL.';
    })
    .catch(() => {
      lastSubmitStatus = 'Save failed — offline or API unavailable.';
    });
}

function formatScoreDate(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch (_) {
    return '';
  }
}

function drawScoresScreen() {
  if (USE_HTML_LEADERBOARD) {
    ctx.clearRect(0, 0, 1280, 720);
    ctx.fillStyle = '#020006';
    ctx.fillRect(0, 0, 1280, 720);
    return;
  }
  ctx.clearRect(0, 0, 1280, 720);
  drawProceduralLeaderboardCanvasBg();

  drawText('GLOBAL SCOREBOARD', 640, 72, 52, '#ffd65a', 'center');
  drawText('Top runs · same tournament scoring you see in-fight', 640, 118, 18, '#aaa', 'center');

  if (leaderboardLoadState === 'loading') {
    drawText('Loading…', 640, 360, 28, '#fff', 'center');
  } else if (leaderboardLoadState === 'error') {
    drawText('Could not load scores.', 640, 320, 26, '#e55', 'center');
    drawText('Play on the deployed site with DATABASE_URL set, or try again.', 640, 360, 18, '#888', 'center');
  } else if (!leaderboardRows.length) {
    drawText('No scores yet — be the first!', 640, 340, 24, '#ccc', 'center');
  } else {
    const xRank = 200;
    const xName = 280;
    const xScore = 880;
    const xWhen = 1040;
    drawText('#', xRank, 168, 20, '#888', 'center');
    drawText('PLAYER', xName, 168, 20, '#888', 'left');
    drawText('SCORE', xScore, 168, 20, 'right');
    drawText('DATE', xWhen, 168, 20, 'center');
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.moveTo(120, 182);
    ctx.lineTo(1160, 182);
    ctx.stroke();

    const max = Math.min(leaderboardRows.length, 20);
    for (let i = 0; i < max; i++) {
      const row = leaderboardRows[i];
      const y = 210 + i * 36;
      const rankCol = i === 0 ? '#ffd65a' : i === 1 ? '#c0c0c0' : i === 2 ? '#cd7f32' : '#ddd';
      drawText(String(i + 1), xRank, y, 22, rankCol, 'center');
      drawText(String(row.player_name || '—'), xName, y, 22, '#fff', 'left');
      drawText(String(row.score != null ? row.score : '—'), xScore, y, 22, '#7ec46b', 'right');
      drawText(formatScoreDate(row.created_at), xWhen, y, 18, '#777', 'center');
    }
  }

  drawText('Playing as: ' + getPlayerName() + '  ·  N on menu to change name', 640, 640, 18, '#888', 'center');
  drawText('ESC / BACKSPACE — back to menu', 640, 678, 24, '#ff3333', 'center');
}

// --- Stages -----------------------------------------------------------------
// Light tints only — strong dark layers made the stage strip look muddy
const stages = [
  { name: 'DOJO OF DISCIPLINE', tint: 'rgba(0,0,0,0.025)' },
  { name: 'STORMY MOUNTAIN PEAK', tint: 'rgba(0,0,0,0.02)' },
  { name: 'BURNING VILLAGE', tint: 'rgba(0,0,0,0.02)' },
  { name: 'SHADOW TEMPLE', tint: 'rgba(0,0,0,0.03)' },
  { name: 'DRAGON FALLS', tint: 'rgba(0,0,0,0.02)' },
];
let stageIndex = 0;

// --- Difficulty -------------------------------------------------------------
const difficulties = [
  { id: 'easy', name: 'EASY', aiScalar: 0.75, moveScalar: 0.85 },
  { id: 'medium', name: 'MEDIUM', aiScalar: 1.0, moveScalar: 1.0 },
  { id: 'hard', name: 'HARD', aiScalar: 1.25, moveScalar: 1.12 },
];
let difficultyIndex = 1;
function difficulty() { return difficulties[difficultyIndex] || difficulties[1]; }
function clamp01(x) { return Math.max(0, Math.min(1, x)); }

function addScore(points) {
  if (!Number.isFinite(points)) return;
  score = Math.max(0, Math.round(score + points));
}

/** True for human-controlled scoring: P1 always, P2 in local Versus */
function playerScoresFor(f) {
  return f === p1 || (p2IsHuman && f === p2);
}

// --- Fight SFX: Real Martial Arts Sound Design (Web Audio synthesis) ---
let fightSfxAudioCtx = null;
function getFightSfxContext() {
  if (!fightSfxAudioCtx) { const AC = window.AudioContext||window.webkitAudioContext; if (AC) try { fightSfxAudioCtx = new AC(); } catch(_){} } return fightSfxAudioCtx;
}
function resumeFightSfx() { const c=getFightSfxContext(); if(c&&c.state==='suspended')try{c.resume()}catch(_){}; return c; }
function kickAttackName(n){ return n && String(n).toLowerCase().indexOf('kick')>=0; }
function _nb(ctx,dur){ const n=Math.max(2,Math.floor(ctx.sampleRate*dur)|0),b=ctx.createBuffer(1,n,ctx.sampleRate),d=b.getChannelData(0); for(let i=0;i<n;i++)d[i]=Math.random()*2-1; return b; }
function playSfxPunch(peak=0.22){ const ctx=resumeFightSfx(); if(!ctx)return; const t0=ctx.currentTime;
  const o=ctx.createOscillator(); o.type='sine'; o.frequency.setValueAtTime(95,t0); o.frequency.exponentialRampToValueAtTime(38,t0+0.08);
  const g=ctx.createGain(); g.gain.setValueAtTime(0,t0); g.gain.linearRampToValueAtTime(peak*0.9,t0+0.003); g.gain.exponentialRampToValueAtTime(0.001,t0+0.1);
  o.connect(g); g.connect(ctx.destination); o.start(t0); o.stop(t0+0.13);
  const s=ctx.createBufferSource(); s.buffer=_nb(ctx,0.04);
  const f=ctx.createBiquadFilter(); f.type='bandpass'; f.frequency.value=2800; f.Q.value=3;
  const g2=ctx.createGain(); g2.gain.setValueAtTime(0,t0); g2.gain.linearRampToValueAtTime(peak*0.55,t0+0.002); g2.gain.exponentialRampToValueAtTime(0.001,t0+0.035);
  s.connect(f); f.connect(g2); g2.connect(ctx.destination); s.start(t0);
  const s2=ctx.createBufferSource(); s2.buffer=_nb(ctx,0.055);
  const f2=ctx.createBiquadFilter(); f2.type='lowpass'; f2.frequency.value=500;
  const g3=ctx.createGain(); g3.gain.setValueAtTime(0,t0+0.001); g3.gain.linearRampToValueAtTime(peak*0.4,t0+0.005); g3.gain.exponentialRampToValueAtTime(0.001,t0+0.06);
  s2.connect(f2); f2.connect(g3); g3.connect(ctx.destination); s2.start(t0+0.001);
}
function playSfxKick(peak=0.28){ const ctx=resumeFightSfx(); if(!ctx)return; const t0=ctx.currentTime;
  const o=ctx.createOscillator(); o.type='sine'; o.frequency.setValueAtTime(65,t0); o.frequency.exponentialRampToValueAtTime(28,t0+0.14);
  const g=ctx.createGain(); g.gain.setValueAtTime(0,t0); g.gain.linearRampToValueAtTime(peak,t0+0.005); g.gain.exponentialRampToValueAtTime(0.001,t0+0.16);
  o.connect(g); g.connect(ctx.destination); o.start(t0); o.stop(t0+0.18);
  const s=ctx.createBufferSource(); s.buffer=_nb(ctx,0.09);
  const lp=ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=280;
  const pk=ctx.createBiquadFilter(); pk.type='peaking'; pk.frequency.value=120; pk.gain.value=9; pk.Q.value=0.8;
  const g2=ctx.createGain(); g2.gain.setValueAtTime(0,t0); g2.gain.linearRampToValueAtTime(peak*0.7,t0+0.008); g2.gain.exponentialRampToValueAtTime(0.001,t0+0.1);
  s.connect(lp); lp.connect(pk); pk.connect(g2); g2.connect(ctx.destination); s.start(t0);
  const s2=ctx.createBufferSource(); s2.buffer=_nb(ctx,0.03);
  const hp=ctx.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=3500;
  const g3=ctx.createGain(); g3.gain.setValueAtTime(0,t0); g3.gain.linearRampToValueAtTime(peak*0.35,t0+0.002); g3.gain.exponentialRampToValueAtTime(0.001,t0+0.025);
  s2.connect(hp); hp.connect(g3); g3.connect(ctx.destination); s2.start(t0);
}
function playSfxWhoosh(peak=0.048){ const ctx=resumeFightSfx(); if(!ctx)return; const t0=ctx.currentTime;
  const s=ctx.createBufferSource(); s.buffer=_nb(ctx,0.08);
  const bp=ctx.createBiquadFilter(); bp.type='bandpass'; bp.frequency.setValueAtTime(800,t0); bp.frequency.exponentialRampToValueAtTime(3200,t0+0.055); bp.Q.value=2.5;
  const g=ctx.createGain(); g.gain.setValueAtTime(0,t0); g.gain.linearRampToValueAtTime(peak,t0+0.012); g.gain.exponentialRampToValueAtTime(0.001,t0+0.075);
  s.connect(bp); bp.connect(g); g.connect(ctx.destination); s.start(t0);
  const o=ctx.createOscillator(); o.type='sawtooth'; o.frequency.setValueAtTime(380,t0); o.frequency.exponentialRampToValueAtTime(1800,t0+0.05);
  const g2=ctx.createGain(); g2.gain.setValueAtTime(0,t0); g2.gain.linearRampToValueAtTime(peak*0.3,t0+0.008); g2.gain.exponentialRampToValueAtTime(0.001,t0+0.06);
  o.connect(g2); g2.connect(ctx.destination); o.start(t0); o.stop(t0+0.08);
}
function playSfxBlock(peak=0.12){ const ctx=resumeFightSfx(); if(!ctx)return; const t0=ctx.currentTime;
  const o=ctx.createOscillator(); o.type='square'; o.frequency.setValueAtTime(1100,t0); o.frequency.exponentialRampToValueAtTime(320,t0+0.04);
  const g=ctx.createGain(); g.gain.setValueAtTime(0,t0); g.gain.linearRampToValueAtTime(peak,t0+0.002); g.gain.exponentialRampToValueAtTime(0.001,t0+0.05);
  o.connect(g); g.connect(ctx.destination); o.start(t0); o.stop(t0+0.06);
  const s=ctx.createBufferSource(); s.buffer=_nb(ctx,0.035);
  const f=ctx.createBiquadFilter(); f.type='bandpass'; f.frequency.value=1800; f.Q.value=1.5;
  const g2=ctx.createGain(); g2.gain.setValueAtTime(0,t0); g2.gain.linearRampToValueAtTime(peak*0.6,t0+0.003); g2.gain.exponentialRampToValueAtTime(0.001,t0+0.04);
  s.connect(f); f.connect(g2); g2.connect(ctx.destination); s.start(t0);
}
function playSfxParry(peak=0.18){ const ctx=resumeFightSfx(); if(!ctx)return; const t0=ctx.currentTime;
  [1200,2400,3600].forEach((hz,k)=>{
    const o=ctx.createOscillator(); o.type='sine'; o.frequency.setValueAtTime(hz*(1+k*0.02),t0); o.frequency.exponentialRampToValueAtTime(hz*0.85,t0+0.15);
    const g=ctx.createGain(); const v=peak*(0.5-k*0.1); g.gain.setValueAtTime(0,t0); g.gain.linearRampToValueAtTime(v,t0+0.003+k*0.002); g.gain.exponentialRampToValueAtTime(0.001,t0+0.18+k*0.02);
    o.connect(g); g.connect(ctx.destination); o.start(t0); o.stop(t0+0.22);
  });
  const s=ctx.createBufferSource(); s.buffer=_nb(ctx,0.025);
  const f=ctx.createBiquadFilter(); f.type='highpass'; f.frequency.value=4000;
  const g=ctx.createGain(); g.gain.setValueAtTime(0,t0); g.gain.linearRampToValueAtTime(peak*0.8,t0+0.001); g.gain.exponentialRampToValueAtTime(0.001,t0+0.02);
  s.connect(f); f.connect(g); g.connect(ctx.destination); s.start(t0);
}
function playSfxKiai(peak=0.18){ const ctx=resumeFightSfx(); if(!ctx)return; const t0=ctx.currentTime;
  [220,880,1760,2640].forEach((hz,k)=>{
    const o=ctx.createOscillator(); o.type=k===0?'sawtooth':'sine';
    o.frequency.setValueAtTime(hz*0.9,t0); o.frequency.linearRampToValueAtTime(hz*1.08,t0+0.06); o.frequency.exponentialRampToValueAtTime(hz*0.7,t0+0.22);
    const bp=ctx.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=k===1?900:k===2?1800:hz; bp.Q.value=k===0?0.8:4;
    const g=ctx.createGain(); const v=peak*[0.9,0.5,0.3,0.15][k];
    g.gain.setValueAtTime(0,t0); g.gain.linearRampToValueAtTime(v,t0+0.015); g.gain.setValueAtTime(v*0.8,t0+0.1); g.gain.exponentialRampToValueAtTime(0.001,t0+0.24);
    o.connect(bp); bp.connect(g); g.connect(ctx.destination); o.start(t0); o.stop(t0+0.26);
  });
}
function playSfxBoneCrack(peak=0.32){ const ctx=resumeFightSfx(); if(!ctx)return; const t0=ctx.currentTime;
  const o=ctx.createOscillator(); o.type='sine'; o.frequency.setValueAtTime(55,t0); o.frequency.exponentialRampToValueAtTime(20,t0+0.2);
  const g=ctx.createGain(); g.gain.setValueAtTime(0,t0); g.gain.linearRampToValueAtTime(peak,t0+0.004); g.gain.exponentialRampToValueAtTime(0.001,t0+0.22);
  o.connect(g); g.connect(ctx.destination); o.start(t0); o.stop(t0+0.25);
  const s=ctx.createBufferSource(); s.buffer=_nb(ctx,0.06);
  const f=ctx.createBiquadFilter(); f.type='bandpass'; f.frequency.value=4500; f.Q.value=1.8;
  const g2=ctx.createGain(); g2.gain.setValueAtTime(0,t0); g2.gain.linearRampToValueAtTime(peak*0.75,t0+0.001); g2.gain.exponentialRampToValueAtTime(0.001,t0+0.055);
  s.connect(f); f.connect(g2); g2.connect(ctx.destination); s.start(t0);
  const o2=ctx.createOscillator(); o2.type='triangle'; o2.frequency.setValueAtTime(140,t0+0.005); o2.frequency.exponentialRampToValueAtTime(45,t0+0.12);
  const g3=ctx.createGain(); g3.gain.setValueAtTime(0,t0+0.005); g3.gain.linearRampToValueAtTime(peak*0.8,t0+0.012); g3.gain.exponentialRampToValueAtTime(0.001,t0+0.14);
  o2.connect(g3); g3.connect(ctx.destination); o2.start(t0+0.005); o2.stop(t0+0.18);
}
function playSfxImpactByMoveName(t){ return kickAttackName(t) ? playSfxKick() : playSfxPunch(); }


// --- Combo system (Street Fighter-style) ------------------------------------
const COMBO_WINDOW_FRAMES = 45; // ~0.75s at 60fps

function resetCombo(f) {
  f.comboHits = 0;
  f.comboTimer = 0;
  f.comboPop = 0;
}

function registerComboHit(attacker) {
  attacker.comboHits = (attacker.comboHits || 0) + 1;
  attacker.comboTimer = COMBO_WINDOW_FRAMES;
  attacker.comboPop = 14; // small pop animation frames
  if (typeof p1 !== 'undefined' && attacker === p1 && typeof runMaxCombo !== 'undefined') {
    runMaxCombo = Math.max(runMaxCombo, attacker.comboHits | 0);
  }
}

// --- Lightweight event queue (for multi-hit boss sequences) -----------------
function schedule(f, delayFrames, fn) {
  if (!f) return;
  if (!f.events) f.events = [];
  f.events.push({ t: Math.max(0, delayFrames | 0), fn });
}

function runEvents(f, scale) {
  if (!f || !f.events || f.events.length === 0) return;
  const s = (scale > 0 && scale < 4) ? scale : 1;
  for (let i = f.events.length - 1; i >= 0; i--) {
    const e = f.events[i];
    e.t -= s;
    if (e.t <= 0) {
      f.events.splice(i, 1);
      try { e.fn(); } catch (_) {}
    }
  }
}

// --- Reigen boss move kit ---------------------------------------------------
function bossHit(attacker, power, range, opts = {}) {
  const other = (attacker === p1) ? p2 : p1;
  if (!other) return false;
  const dist = Math.abs(attacker.x - other.x);
  if (dist >= range) return false;

  // i-frames: whiff
  if (other.iframes > 0) return false;

  // Parry: punish attacker
  if (other.parry > 0) {
    other.parry = 0;
    playSfxParry(0.12);
    attacker.action = 'hurt';
    attacker.lock = Math.max(attacker.lock, 36);
    attacker.health = Math.max(0, attacker.health - Math.ceil(power * 0.8));
    attacker.flash = 10;
    hitPause = Math.max(hitPause, 8);
    shake = Math.max(shake, 14);
    spark(attacker.x, attacker.y - 120, '#ffeb70', 14);
    resetCombo(attacker);
    return true;
  }

  // Block
  if (other.block) {
    playSfxBlock(0.085);
    other.health = Math.max(0, other.health - Math.ceil(power * 0.2));
    spark(other.x, other.y - 100, '#dddddd', 6);
    resetCombo(attacker);
    return true;
  }

  // Armor
  if (other.armor > 0) {
    other.armor--;
    playSfxPunch(0.12);
    other.health = Math.max(0, other.health - Math.ceil(power * 0.45));
    spark(other.x, other.y - 100, '#ffd65a', 6);
    resetCombo(attacker);
    return true;
  }

  // Clean hit
  if (power >= 9) playSfxKick(0.22);
  else playSfxPunch(0.2);
  other.health = Math.max(0, other.health - power);
  other.action = 'hurt';
  other.lock = Math.max(other.lock, opts.stun ?? 14);
  other.flash = Math.max(other.flash, 6);
  const dir = Math.sign(other.x - attacker.x) || 1;
  other.x = Math.max(80, Math.min(1200, other.x + dir * (opts.push ?? 14)));

  registerComboHit(attacker);
  hitPause = Math.max(hitPause, opts.pause ?? 4);
  shake = Math.max(shake, opts.shake ?? 10);
  spark(other.x, other.y - 110, opts.spark || '#a855f7', 10);
  return true;
}

const REIGEN_MOVES = [
  // 1) Basic attacks (1-4)
  { id: 1,  name: 'Jab Punch',            kind: 'strike', phase: 1, minDist: 0,   maxDist: 120, lock: 16, exec: f => bossHit(f, 6, 110, { stun: 12 }) },
  { id: 2,  name: 'Straight Punch',       kind: 'strike', phase: 1, minDist: 0,   maxDist: 140, lock: 18, exec: f => bossHit(f, 8, 135, { stun: 14, push: 16 }) },
  { id: 3,  name: 'Hook Punch',           kind: 'strike', phase: 1, minDist: 0,   maxDist: 150, lock: 20, exec: f => bossHit(f, 9, 150, { stun: 14, push: 18 }) },
  { id: 4,  name: 'Uppercut',             kind: 'strike', phase: 1, minDist: 0,   maxDist: 150, lock: 22, exec: f => bossHit(f, 11, 150, { stun: 16, push: 18, shake: 14 }) },

  // 2) Kicks (5-10)
  { id: 5,  name: 'Front Kick',           kind: 'strike', phase: 1, minDist: 40,  maxDist: 180, lock: 20, exec: f => bossHit(f, 9, 170, { stun: 14, push: 22 }) },
  { id: 6,  name: 'Roundhouse Kick',      kind: 'strike', phase: 1, minDist: 60,  maxDist: 210, lock: 24, exec: f => bossHit(f, 12, 200, { stun: 18, push: 26, shake: 16 }) },
  { id: 7,  name: 'Side Kick',            kind: 'strike', phase: 1, minDist: 60,  maxDist: 220, lock: 24, exec: f => bossHit(f, 10, 210, { stun: 16, push: 28 }) },
  { id: 8,  name: 'Axe Kick',             kind: 'strike', phase: 1, minDist: 0,   maxDist: 170, lock: 28, exec: f => bossHit(f, 13, 170, { stun: 20, push: 18, shake: 18 }) },
  { id: 9,  name: 'Jumping Kick',         kind: 'air',    phase: 1, minDist: 0,   maxDist: 200, lock: 22, exec: f => { f.vy = -12; return bossHit(f, 10, 190, { stun: 14 }); } },
  { id: 10, name: 'Spin Kick',            kind: 'strike', phase: 1, minDist: 0,   maxDist: 230, lock: 28, exec: f => bossHit(f, 14, 220, { stun: 20, push: 26, shake: 18 }) },

  // 3) Elbows & knees (11-15)
  { id: 11, name: 'Elbow Strike',         kind: 'strike', phase: 1, minDist: 0,   maxDist: 110, lock: 18, exec: f => bossHit(f, 7, 105, { stun: 12 }) },
  { id: 12, name: 'Jumping Elbow',        kind: 'air',    phase: 1, minDist: 0,   maxDist: 140, lock: 20, exec: f => { f.vy = -10; return bossHit(f, 8, 135, { stun: 14 }); } },
  { id: 13, name: 'Knee Strike',          kind: 'strike', phase: 1, minDist: 0,   maxDist: 120, lock: 18, exec: f => bossHit(f, 8, 115, { stun: 14, push: 10 }) },
  { id: 14, name: 'Jump Knee',            kind: 'air',    phase: 1, minDist: 0,   maxDist: 150, lock: 22, exec: f => { f.vy = -12; return bossHit(f, 9, 145, { stun: 16 }); } },
  { id: 15, name: 'Flying Knee',          kind: 'dash',   phase: 2, minDist: 100, maxDist: 380, lock: 28, exec: f => { f.iframes = 10; f.x = Math.max(80, Math.min(1200, f.x + (f.flip ? -1 : 1) * 160)); return bossHit(f, 13, 220, { stun: 18, push: 26, shake: 16 }); } },

  // 4) Combos (16-20)
  { id: 16, name: '3 Hit Combo',          kind: 'combo',  phase: 1, minDist: 0,   maxDist: 150, lock: 34, exec: f => { bossHit(f, 5, 135, { stun: 10 }); schedule(f, 10, () => bossHit(f, 6, 145, { stun: 10 })); schedule(f, 20, () => bossHit(f, 7, 155, { stun: 12, shake: 12 })); return true; } },
  { id: 17, name: '4 Hit Combo',          kind: 'combo',  phase: 2, minDist: 0,   maxDist: 170, lock: 40, exec: f => { bossHit(f, 5, 140, { stun: 10 }); schedule(f, 9, () => bossHit(f, 6, 150, { stun: 10 })); schedule(f, 18, () => bossHit(f, 7, 160, { stun: 12 })); schedule(f, 28, () => bossHit(f, 9, 175, { stun: 14, shake: 14 })); return true; } },
  { id: 18, name: '5 Hit Combo',          kind: 'combo',  phase: 3, minDist: 0,   maxDist: 190, lock: 48, exec: f => { bossHit(f, 5, 140, { stun: 10 }); schedule(f, 8, () => bossHit(f, 6, 150, { stun: 10 })); schedule(f, 16, () => bossHit(f, 7, 160, { stun: 10 })); schedule(f, 24, () => bossHit(f, 8, 170, { stun: 12 })); schedule(f, 34, () => bossHit(f, 12, 190, { stun: 16, shake: 18 })); return true; } },
  { id: 19, name: 'Body Combo',           kind: 'combo',  phase: 2, minDist: 0,   maxDist: 160, lock: 38, exec: f => { bossHit(f, 6, 140, { stun: 10 }); schedule(f, 10, () => bossHit(f, 6, 140, { stun: 10 })); schedule(f, 22, () => bossHit(f, 10, 165, { stun: 14, push: 20 })); return true; } },
  { id: 20, name: 'Kick Combo',           kind: 'combo',  phase: 2, minDist: 40,  maxDist: 220, lock: 42, exec: f => { bossHit(f, 7, 180, { stun: 12 }); schedule(f, 12, () => bossHit(f, 9, 200, { stun: 14 })); schedule(f, 26, () => bossHit(f, 12, 220, { stun: 18, shake: 16 })); return true; } },

  // 5) Special moves (21-25)
  { id: 21, name: 'Shadow Dash',          kind: 'dash',   phase: 1, minDist: 160, maxDist: 520, lock: 22, exec: f => { f.iframes = 14; f.x = Math.max(80, Math.min(1200, f.x + (f.flip ? -1 : 1) * 240)); spark(f.x, f.y - 100, '#a855f7', 14); return true; } },
  { id: 22, name: 'Dark Slash',           kind: 'strike', phase: 2, minDist: 0,   maxDist: 210, lock: 26, exec: f => bossHit(f, 14, 205, { stun: 18, shake: 16 }) },
  { id: 23, name: 'Shadow Sweep',         kind: 'strike', phase: 2, minDist: 0,   maxDist: 220, lock: 26, exec: f => bossHit(f, 12, 210, { stun: 18, push: 26 }) },
  { id: 24, name: 'Void Strike',          kind: 'strike', phase: 3, minDist: 0,   maxDist: 260, lock: 30, exec: f => bossHit(f, 18, 250, { stun: 22, push: 30, shake: 20 }) },
  { id: 25, name: 'Dark Uppercut',        kind: 'strike', phase: 3, minDist: 0,   maxDist: 200, lock: 32, exec: f => bossHit(f, 19, 190, { stun: 24, shake: 22 }) },

  // 6) Projectile moves (26-30)
  { id: 26, name: 'Dark Fireball',        kind: 'proj',   phase: 1, minDist: 120, maxDist: 999, lock: 26, exec: f => { projectiles.push({ x: f.x + (f.flip ? -60 : 60), y: 430 + FLOOR_PROJ_DY, vx: f.flip ? -10 : 10, owner: f, life: 70, color: '#a855f7', power: 10, size: 58, kind: 'shadow' }); return true; } },
  { id: 27, name: 'Shadow Wave',          kind: 'proj',   phase: 2, minDist: 120, maxDist: 999, lock: 28, exec: f => { projectiles.push({ x: f.x + (f.flip ? -60 : 60), y: 480 + FLOOR_PROJ_DY, vx: f.flip ? -7.5 : 7.5, owner: f, life: 120, color: '#a855f7', power: 8, size: 70, kind: 'shadow' }); return true; } },
  { id: 28, name: 'Dark Spear',           kind: 'proj',   phase: 2, minDist: 120, maxDist: 999, lock: 30, exec: f => { projectiles.push({ x: f.x + (f.flip ? -60 : 60), y: 460 + FLOOR_PROJ_DY, vx: f.flip ? -13 : 13, owner: f, life: 55, color: '#c084fc', power: 12, size: 42, kind: 'shadow' }); return true; } },
  { id: 29, name: 'Void Blast',           kind: 'proj',   phase: 3, minDist: 120, maxDist: 999, lock: 34, exec: f => { projectiles.push({ x: f.x + (f.flip ? -60 : 60), y: 440 + FLOOR_PROJ_DY, vx: f.flip ? -15 : 15, owner: f, life: 48, color: '#e9d5ff', power: 14, size: 50, kind: 'void' }); return true; } },
  { id: 30, name: 'Shadow Barrage',       kind: 'proj',   phase: 3, minDist: 160, maxDist: 999, lock: 44, exec: f => { for (let i = 0; i < 5; i++) schedule(f, i * 6, () => projectiles.push({ x: f.x + (f.flip ? -60 : 60), y: 420 + i * 10 + FLOOR_PROJ_DY, vx: f.flip ? -12 : 12, owner: f, life: 50, color: '#a855f7', power: 7, size: 46, kind: 'shadow' })); return true; } },

  // 7) Power moves (31-35)
  { id: 31, name: 'Shadow Eruption',      kind: 'power',  phase: 2, minDist: 0,   maxDist: 360, lock: 40, exec: f => { projectiles.push({ x: (f===p1?p2:p1).x, y: 520 + FLOOR_PROJ_DY, vx: 0, owner: f, life: 30, color: '#a855f7', power: 16, size: 110, kind: 'void' }); return true; } },
  { id: 32, name: 'Dark Explosion',       kind: 'power',  phase: 3, minDist: 0,   maxDist: 420, lock: 46, exec: f => { const other=(f===p1?p2:p1); if(!other) return false; projectiles.push({ x: other.x, y: 470 + FLOOR_PROJ_DY, vx: 0, owner: f, life: 22, color: '#c084fc', power: 18, size: 130, kind: 'void' }); return true; } },
  { id: 33, name: 'Gravity Crush',        kind: 'power',  phase: 3, minDist: 0,   maxDist: 320, lock: 44, exec: f => bossHit(f, 20, 300, { stun: 26, push: 0, shake: 24 }) },
  { id: 34, name: 'Shadow Impact',        kind: 'strike', phase: 2, minDist: 0,   maxDist: 260, lock: 34, exec: f => bossHit(f, 16, 250, { stun: 22, push: 30, shake: 20 }) },
  { id: 35, name: 'Void Breaker',         kind: 'strike', phase: 3, minDist: 0,   maxDist: 280, lock: 38, exec: f => bossHit(f, 22, 270, { stun: 28, push: 34, shake: 26 }) },

  // 8) Air moves (36-40)
  { id: 36, name: 'Air Punch',            kind: 'air',    phase: 1, minDist: 0,   maxDist: 160, lock: 22, exec: f => { f.vy = -13; return bossHit(f, 8, 150, { stun: 12 }); } },
  { id: 37, name: 'Air Kick',             kind: 'air',    phase: 1, minDist: 0,   maxDist: 180, lock: 22, exec: f => { f.vy = -13; return bossHit(f, 9, 170, { stun: 14 }); } },
  { id: 38, name: 'Air Spin Kick',        kind: 'air',    phase: 2, minDist: 0,   maxDist: 220, lock: 28, exec: f => { f.vy = -14; return bossHit(f, 13, 210, { stun: 18, shake: 16 }); } },
  { id: 39, name: 'Air Dash',             kind: 'air',    phase: 2, minDist: 160, maxDist: 520, lock: 24, exec: f => { f.iframes = 12; f.vy = -10; f.x = Math.max(80, Math.min(1200, f.x + (f.flip ? -1 : 1) * 260)); spark(f.x, f.y - 110, '#a855f7', 12); return true; } },
  { id: 40, name: 'Diving Attack',        kind: 'air',    phase: 3, minDist: 120, maxDist: 420, lock: 32, exec: f => { f.vy = -16; schedule(f, 10, () => bossHit(f, 16, 240, { stun: 22, shake: 20 })); return true; } },

  // 9) Counter & defensive (41-45)
  { id: 41, name: 'Shadow Counter',       kind: 'def',    phase: 2, minDist: 0,   maxDist: 200, lock: 24, exec: f => { f.parry = 14; spark(f.x, f.y - 100, '#7c3aed', 8); return true; } },
  { id: 42, name: 'Void Parry',           kind: 'def',    phase: 3, minDist: 0,   maxDist: 200, lock: 28, exec: f => { f.parry = 22; spark(f.x, f.y - 110, '#e9d5ff', 10); return true; } },
  { id: 43, name: 'Shadow Dodge',         kind: 'def',    phase: 2, minDist: 0,   maxDist: 999, lock: 16, exec: f => { f.iframes = 18; spark(f.x, f.y - 110, '#a855f7', 10); return true; } },
  { id: 44, name: 'Dark Guard',           kind: 'def',    phase: 1, minDist: 0,   maxDist: 999, lock: 18, exec: f => { f.block = true; f.blockTimer = 18; return true; } },
  { id: 45, name: 'Teleport Counter',     kind: 'def',    phase: 3, minDist: 0,   maxDist: 999, lock: 28, exec: f => { const other=(f===p1?p2:p1); if(!other) return false; f.iframes = 16; f.x = Math.max(80, Math.min(1200, other.x + ((other.x > 640) ? -110 : 110))); f.flip = f.x > other.x; spark(f.x, f.y - 105, '#a855f7', 16); schedule(f, 10, () => bossHit(f, 14, 190, { stun: 18 })); return true; } },

  // 10) Ultimate moves (46-50)
  { id: 46, name: 'Eternal Darkness',     kind: 'ult',    phase: 3, minDist: 0,   maxDist: 999, lock: 52, exec: f => { shake = Math.max(shake, 24); hitPause = Math.max(hitPause, 8); for (let i = 0; i < 8; i++) schedule(f, i * 7, () => projectiles.push({ x: f.x + (f.flip ? -60 : 60), y: 420 + (i%3)*20 + FLOOR_PROJ_DY, vx: f.flip ? -11 : 11, owner: f, life: 60, color: '#a855f7', power: 7, size: 48, kind: 'shadow' })); return true; } },
  { id: 47, name: 'Void Destruction',     kind: 'ult',    phase: 3, minDist: 0,   maxDist: 520, lock: 60, exec: f => { superMove(f); return true; } },
  { id: 48, name: 'Shadow Domain',        kind: 'ult',    phase: 3, minDist: 0,   maxDist: 999, lock: 56, exec: f => { const other=(f===p1?p2:p1); if(!other) return false; projectiles.push({ x: other.x, y: 500 + FLOOR_PROJ_DY, vx: 0, owner: f, life: 80, color: '#a855f7', power: 14, size: 160, kind: 'void' }); return true; } },
  { id: 49, name: 'Oblivion Strike',      kind: 'ult',    phase: 3, minDist: 0,   maxDist: 320, lock: 50, exec: f => bossHit(f, 28, 300, { stun: 34, push: 40, shake: 30 }) },
  { id: 50, name: 'Reigen Supreme',       kind: 'ult',    phase: 3, minDist: 0,   maxDist: 520, lock: 70, exec: f => { bossHit(f, 10, 200, { stun: 10 }); schedule(f, 10, () => bossHit(f, 12, 230, { stun: 12 })); schedule(f, 20, () => bossHit(f, 14, 260, { stun: 14 })); schedule(f, 34, () => bossHit(f, 24, 320, { stun: 30, shake: 28 })); return true; } },
];

function bossUseMove(f, moveId) {
  const mv = REIGEN_MOVES.find(m => m.id === moveId);
  if (!mv) return false;
  if ((f.phase || 1) < mv.phase) return false;
  f.action = 'special';
  f.lock = Math.max(f.lock, mv.lock);
  return !!mv.exec(f);
}

// --- Input ------------------------------------------------------------------
const keys = {};
function onWindowKeydown(e) {
  keys[e.key.toLowerCase()] = true;
  setKeysFromCodeKeydown(e);
  if (state === 'scores' && USE_HTML_LEADERBOARD && e.target && e.target.id === 'lbSearch' && (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Home' || e.key === 'End')) {
    return;
  }
  if (state === 'scores' && USE_HTML_LEADERBOARD && leaderboardScreen) {
    if (leaderboardScreen.interceptKeydown(e)) {
      e.preventDefault();
      return;
    }
  } else if (state === 'scores' && (e.key === 'Escape' || e.key === 'Backspace')) {
    e.preventDefault();
    state = 'menu';
    return;
  }
  if (state === 'story') {
    e.preventDefault();
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight' || e.key === 'PageDown') advanceStory();
    return;
  }
  if (state === 'options') {
    e.preventDefault();
    if (e.key === 'Escape' || e.key === 'Backspace' || e.key === 'Enter' || e.key === ' ') { state = 'menu'; return; }
    if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') difficultyIndex = (difficultyIndex + 1) % difficulties.length;
    if (e.key === 'ArrowLeft'  || e.key.toLowerCase() === 'a') difficultyIndex = (difficultyIndex + difficulties.length - 1) % difficulties.length;
    return;
  }
  if (state === 'store') {
    e.preventDefault();
    if (e.key === 'Escape' || e.key === 'Backspace') { state = 'menu'; return; }
    if (e.key === 'Enter' && STORE_ITEMS[storeSel]) {
      setMenuHint(STORE_ITEMS[storeSel].cost === 0 ? 'Unlocked! (cosmetic in a future build)' : 'Save more points in the tournament to unlock (coming soon)');
    }
    if (e.key === 'ArrowUp'  || e.key === 'w')   storeSel = (storeSel + STORE_ITEMS.length - 1) % STORE_ITEMS.length;
    if (e.key === 'ArrowDown' || e.key === 's') storeSel = (storeSel + 1) % STORE_ITEMS.length;
    return;
  }
  if (state === 'menu' && USE_HTML_MAIN_MENU && kadenMainMenu) {
    if (kadenMainMenu.handleKeydown(e)) {
      e.preventDefault();
      return;
    }
  }
  if (e.key === 'Enter') {
    if (kadenMainMenu && kadenMainMenu.isExitDialogOpen && kadenMainMenu.isExitDialogOpen()) { e.preventDefault(); return; }
    if (state === 'scores' && USE_HTML_LEADERBOARD && leaderboardScreen && leaderboardScreen.isModalOpen && leaderboardScreen.isModalOpen()) { return; }
    e.preventDefault();
    if (state === 'menu' && !USE_HTML_MAIN_MENU && menuDDOpen) {
      const go = MENU_GAME_DROP_ORDER[menuDDFocus] || 'tournament';
      runMenuAction(go);
      menuDDOpen = false;
      return;
    }
    enter();
    return;
  }
  if (state === 'menu' && !USE_HTML_MAIN_MENU) {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (menuDDOpen) { menuDDOpen = false; return; }
    }
    if (e.key === 'ArrowUp' && menuDDOpen) {
      e.preventDefault();
      menuDDFocus = (menuDDFocus + MENU_GAME_DROP_ORDER.length - 1) % MENU_GAME_DROP_ORDER.length;
      return;
    }
    if (e.key === 'ArrowDown' && menuDDOpen) {
      e.preventDefault();
      menuDDFocus = (menuDDFocus + 1) % MENU_GAME_DROP_ORDER.length;
      return;
    }
    if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && !menuDDOpen) {
      e.preventDefault();
      menuDDOpen = true;
      menuDDFocus = e.key === 'ArrowUp' ? (MENU_GAME_DROP_ORDER.length - 1) : 0;
      return;
    }
  }
  if (state === 'menu') {
    if (e.key.toLowerCase() === 'h') {
      e.preventDefault();
      runMenuAction('leaderboard');
      return;
    }
    if (e.key.toLowerCase() === 'n') {
      e.preventDefault();
      runMenuAction('profile');
      return;
    }
    if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') {
      e.preventDefault();
      difficultyIndex = (difficultyIndex + 1) % difficulties.length;
      setMenuHint('AI: ' + difficulty().name, 1500);
      return;
    }
    if (e.key === 'ArrowLeft'  || e.key.toLowerCase() === 'a') {
      e.preventDefault();
      difficultyIndex = (difficultyIndex + difficulties.length - 1) % difficulties.length;
      setMenuHint('AI: ' + difficulty().name, 1500);
      return;
    }
  }
  if (state === 'select') {
    if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') sel = (sel + 1) % SELECTABLE_COUNT;
    if (e.key === 'ArrowLeft'  || e.key.toLowerCase() === 'a') sel = (sel + (SELECTABLE_COUNT - 1)) % SELECTABLE_COUNT;
  }
  e.preventDefault();
}
window.addEventListener('keydown', onWindowKeydown, { capture: true });
function onWindowKeyup(e) {
  keys[e.key.toLowerCase()] = false;
  setKeysFromCodeKeyup(e);
}
window.addEventListener('keyup', onWindowKeyup, { capture: true });

cvs.addEventListener('pointermove', e => {
  if (state !== 'menu' || (typeof USE_HTML_MAIN_MENU !== 'undefined' && USE_HTML_MAIN_MENU)) { menuHot = null; return; }
  const p = clientToCanvas(e.clientX, e.clientY);
  menuHot = menuHitId(p.x, p.y);
  if (menuDDOpen) {
    const ri = menuPointInGameDropdownList(p.x, p.y);
    if (ri !== null) menuDDFocus = ri;
  }
});
cvs.addEventListener('pointerleave', () => { menuHot = null; });
cvs.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  if (state === 'fight' || state === 'select' || state === 'roundover') {
    if (e.target === cvs) try { cvs.focus({ preventScroll: true }); } catch (_) { try { cvs.focus(); } catch (_) { /* */ } }
  }
}, { passive: true });
if (gameShell) {
  gameShell.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    if (state === 'fight' || state === 'select' || state === 'roundover') {
      try { cvs.focus({ preventScroll: true }); } catch (_) { try { cvs.focus(); } catch (_) { /* */ } }
    }
  }, { capture: true, passive: true });
}
cvs.addEventListener('pointerup', e => {
  if (e.button !== 0) return;
  if (state !== 'menu' || (typeof USE_HTML_MAIN_MENU !== 'undefined' && USE_HTML_MAIN_MENU)) return;
  e.preventDefault();
  const p = clientToCanvas(e.clientX, e.clientY);
  const id = menuHitId(p.x, p.y);
  if (id === 'menu_dd_header') {
    menuDDOpen = !menuDDOpen;
    if (menuDDOpen) menuDDFocus = 0;
    return;
  }
  if (menuDDOpen) {
    if (id == null) {
      menuDDOpen = false;
      return;
    }
  }
  if (id) {
    if (id !== 'menu_dd_header') runMenuAction(id);
  }
  if (id && id !== 'profile' && id !== 'leaderboard' && MENU_GAME_DROP_ORDER.includes(id)) {
    menuDDOpen = false;
  }
  if (id === 'profile' && menuDDOpen) menuDDOpen = false;
}, { passive: false });

function enter() {
  if (state === 'scores') { state = 'menu'; return; }
  if (state === 'menu') {
    menuHintText = '';
    menuHintUntil = 0;
    pendingPlayMode = 'tournament';
    state = 'select';
  } else if (state === 'select') startTournament();
  else if (state === 'roundover') nextRoundOrMatch();
  else if (state === 'champion' || state === 'gameover') restartToMenu();
}

function restartToMenu() {
  state = 'menu';
  menuDDOpen = false;
  menuDDFocus = 0;
  sel = 0;
  oppIndex = 1;
  round = 1;
  p1wins = p2wins = tournamentWins = score = 0;
  msg = '';
  hitPause = shake = 0;
  projectiles.length = 0;
  sparks.length = 0;
  p1 = p2 = null;
  aiState.lastPlayerAction = 'idle';
  aiState.whiffWindow = 0;
  endTaunt = '';
  scoreSubmittedThisRun = false;
  lastSubmitStatus = '';
  menuHintText = '';
  menuHintUntil = 0;
  pendingPlayMode = 'tournament';
  playMode = 'tournament';
  p2IsHuman = false;
  storyPage = 0;
  runMaxCombo = 0;
}

function pickTaunt(speakerChar, playerWon) {
  const name = characters[speakerChar]?.name || 'RIVAL';
  const tauntsLose = {
    0: ["Too slow. Train harder.", "You fought well… but not enough.", "Come back when your fists are real.", "That was embarrassing to watch. For you.", "You hit like a tutorial dummy."],
    1: ["Pathetic. You couldn't keep up.", "Lightning ends this!", "You blinked. You lost.", "Did you even see the last hit? Didn't think so.", "Run home before the storm comes back."],
    2: ["Aww… did that hurt?", "You chased shadows and fell.", "Try again. I'll still be faster.", "Cuter effort. Still a loss.", "Thanks for the warm-up — I needed a laugh."],
    3: ["Predictable. I read you like a scroll.", "You swung first. You paid for it.", "Your anger is easy to counter.", "All that rage, zero discipline.", "I saw that mix-up three seconds before you did it."],
    4: ["Frozen in place. Like you belong.", "Cold lesson: don't rush in.", "You couldn't break my control.", "You crawled to me. I just finished it.", "Ice doesn’t argue. It just wins."],
    5: ["You were never going to close that gap.", "The void has no patience for amateurs.", "Another echo in the dark. Another loss.", "I’ve ended stronger than you. Today was easy."]
  };
  const tauntsWin = {
    0: ["This isn't over. Next time, you fall.", "Lucky hit… don't get comfortable.", "You won today. Not tomorrow."],
    1: ["Tch… I'll strike faster next time.", "Enjoy it. Thunder always returns.", "I won't miss again."],
    2: ["Heh… cute. I slipped.", "Nice! But you won't catch me twice.", "Okay… that was clean. Don't get cocky."],
    3: ["…Interesting. You adapted.", "I underestimated you. It won't happen again.", "A single mistake. That's all it took."],
    4: ["Warmth fades. Winter comes back.", "I froze too late… next round you shatter.", "Control lost… for now."]
  };
  const pool = playerWon ? (tauntsWin[speakerChar] || tauntsWin[0]) : (tauntsLose[speakerChar] || tauntsLose[0]);
  return pool[Math.floor(Math.random() * pool.length)].replace('{name}', name);
}

function drawSpeechBubble(x, y, w, h, text, accent = '#7d0e0e') {
  ctx.save();
  // Bubble
  ctx.fillStyle = 'rgba(10,10,12,0.92)';
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 3;
  roundRect(x, y, w, h, 18, true, true);

  // Accent bar
  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.75;
  roundRect(x + 12, y + 12, 10, h - 24, 8, true, false);
  ctx.globalAlpha = 1;

  // Text
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'left';
  ctx.font = '26px Impact, Arial Black';
  const lines = wrapText(text, 38);
  const startY = y + 44;
  for (let i = 0; i < Math.min(lines.length, 3); i++) {
    ctx.fillText(lines[i], x + 34, startY + i * 30);
  }
  ctx.restore();
}

function roundRect(x, y, w, h, r, fill, stroke) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}

function wrapText(str, maxChars) {
  const words = String(str || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const w of words) {
    const next = line ? (line + ' ' + w) : w;
    if (next.length > maxChars && line) { lines.push(line); line = w; }
    else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/** Big taunt panel for “you lost” end screen (more lines, readable at a glance). */
function drawLossTauntBubble(x, y, w, h, text, accent = '#7d0e0e') {
  ctx.save();
  ctx.fillStyle = 'rgba(10,10,12,0.94)';
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 3;
  roundRect(x, y, w, h, 20, true, true);
  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.78;
  roundRect(x + 12, y + 14, 10, h - 28, 8, true, false);
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'left';
  const maxChars = 48;
  const fontPx = 23;
  ctx.font = fontPx + 'px Impact, Arial Black';
  const lines = wrapText(String(text || ''), maxChars).slice(0, 5);
  const startY = y + 50;
  const lineGap = 30;
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], x + 36, startY + i * lineGap);
  }
  ctx.restore();
}

/** Full roster/loss art: classic sheet (default) or HD, then full-width sheet row (355×) for other fighters. */
function drawOpponentFullBody(speaker, boxX, boxY, boxW, boxH) {
  const py = sheetRowTop(speaker);
  const ph = sheetRowHeight(speaker);
  applyCtxImageSmoothingOff(ctx);
  ctx.save();
  if (speaker === 0 && useKadenHdMenuPortrait() && kadenChromaBaked && _kadenBaked && _kadenBaked.width > 0) {
    const aw = _kadenBaked.width, ah = _kadenBaked.height;
    const sc = Math.min(boxW / aw, boxH / ah);
    const dw = (aw * sc) | 0, dh = (ah * sc) | 0;
    const ox = boxX + (((boxW - dw) * 0.5) | 0);
    const oy = boxY + (boxH - dh);
    ctx.drawImage(_kadenBaked, 0, 0, aw, ah, ox, oy, dw, dh);
  } else if (speaker === 0 && useKadenHdMenuPortrait()) {
    const aw = kadenGameplay.naturalWidth, ah = kadenGameplay.naturalHeight;
    const sc = Math.min(boxW / aw, boxH / ah);
    const dw = (aw * sc) | 0, dh = (ah * sc) | 0;
    const ox = boxX + (((boxW - dw) * 0.5) | 0);
    const oy = boxY + (boxH - dh);
    ctx.drawImage(kadenGameplay, 0, 0, aw, ah, ox, oy, dw, dh);
  } else if (charHasAstraSheet(speaker | 0)) {
    drawAstraCellKeyedInBox(ctx, speaker | 0, 0, 0, boxX, boxY, boxW, boxH, { vertical: 'bottom', scaleMult: 1.12 });
  } else if (sheet && sheet.complete && sheet.naturalWidth > 0) {
    const sw = 355;
    const sh = ph;
    if (sh > 0) {
      const sc = Math.min(boxW / sw, boxH / sh);
      const dw = (sw * sc) | 0, dh = (sh * sc) | 0;
      const ox = boxX + (((boxW - dw) * 0.5) | 0);
      const oy = boxY + (boxH - dh);
      ctx.drawImage(sheet, 0, py, sw, sh, ox, oy, dw, dh);
    }
  }
  ctx.restore();
}

function drawOpponentVictoryEndScreen() {
  if (gameOverBg && gameOverBg.complete && gameOverBg.naturalWidth > 0) {
    drawImageCover(gameOverBg, 0, 0, 1280, 720);
  } else {
    const bg = ctx.createLinearGradient(0, 0, 1280, 720);
    bg.addColorStop(0, '#1a0a12');
    bg.addColorStop(0.5, '#12060c');
    bg.addColorStop(1, '#080308');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 1280, 720);
  }
  const gDim = ctx.createLinearGradient(0, 0, 1280, 0);
  gDim.addColorStop(0, 'rgba(0,0,0,0.82)');
  gDim.addColorStop(0.4, 'rgba(0,0,0,0.35)');
  gDim.addColorStop(0.65, 'rgba(0,0,0,0.2)');
  gDim.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = gDim;
  ctx.fillRect(0, 0, 1280, 720);
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(0, 0, 1280, 190);

  const speaker = Number.isFinite(endTauntSpeaker) ? endTauntSpeaker : lastOpponentChar;
  const c = characters[speaker];
  const accent = c?.color || '#a855f7';
  const line = endTaunt || pickTaunt(speaker, false);
  const title = playMode === 'versus' ? 'PLAYER 2 WINS THE SET' : 'GAME OVER';
  const sub = playMode === 'versus'
    ? (c ? c.name + '  ·  ' + c.style : '')
    : (c ? c.name + '  —  ' + (c.style || '') : 'You were outclassed');
  drawText(title, 640, 64, 52, '#ffd65a', 'center');
  drawText(sub, 640, 118, 24, c ? c.color : '#ddd', 'center');
  if (playMode === 'tournament' || playMode === 'story') {
    const hint = playMode === 'story' ? 'The RISE reclaims the ring.' : 'Tournament over. Train and try again.';
    drawText(hint, 640, 152, 17, 'rgba(255,255,255,0.6)', 'center');
  } else {
    drawText('Set over — run it back from the main menu when you are ready.', 640, 152, 16, 'rgba(255,255,255,0.52)', 'center');
  }
  drawLossTauntBubble(40, 210, 600, 228, line, accent);
  drawOpponentFullBody(speaker, 700, 80, 560, 600);
  drawText('FINAL SCORE  ' + Math.floor(score), 640, 654, 28, '#ffd65a', 'center');
  if (lastSubmitStatus) drawText(lastSubmitStatus, 640, 686, 17, 'rgba(200,220,255,0.9)', 'center');
  drawText('PRESS ENTER  —  MAIN MENU', 640, 714, 21, 'rgba(255,230,255,0.95)', 'center');
}

// --- Helpers ----------------------------------------------------------------
function drawText(t, x, y, size = 36, color = 'white', align = 'left', fontStack = 'Impact, Arial Black') {
  ctx.fillStyle = color;
  ctx.font = size + 'px ' + fontStack;
  ctx.textAlign = align;
  ctx.fillText(t, x, y);
}

function spark(x, y, color, n = 9) {
  const count = Math.max(2, Math.min(12, (n * 0.4) | 0) + (n > 8 ? 1 : 0));
  for (let i = 0; i < count; i++) {
    sparks.push({
      x, y,
      vx: (Math.random() - 0.5) * 6,
      vy: (Math.random() - 0.75) * 6,
      life: 10 + Math.random() * 10,
      maxLife: 20,
      color,
      size: 1.1 + Math.random() * 1.6,
      gravity: 0.45
    });
  }
}

function petals(x, y, color) {
  for (let i = 0; i < 6; i++) {
    sparks.push({
      x: x + (Math.random()-0.5)*60,
      y: y + (Math.random()-0.5)*40,
      vx: (Math.random()-0.5) * 2,
      vy: -Math.random() * 1.5,
      life: 40 + Math.random() * 20,
      maxLife: 60,
      color,
      size: 5,
      gravity: 0.05
    });
  }
}

// --- Menu / Select ----------------------------------------------------------
function clientToCanvas(clientX, clientY) {
  const r = cvs.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return { x: 0, y: 0 };
  // Logical 1280×game coords (independent of backing-store / devicePixelRatio)
  return {
    x: (clientX - r.left) * (G_WIDTH / r.width),
    y: (clientY - r.top) * (H_HEIGHT / r.height)
  };
}
/**
 * Map a sub-rect in menu-main.png (source pixels) to canvas 1280×720 using the same
 * "cover" transform as drawImageCover — so hit areas line up with the art.
 */
function menuBgSourceToCanvas(sx, sy, sw, sh) {
  const img = menuBg;
  if (!img || !img.complete || img.naturalWidth <= 0) return null;
  const iw = img.naturalWidth, ih = img.naturalHeight;
  const dw = 1280, dh = 720;
  const scale = Math.max(dw / iw, dh / ih);
  const w2 = iw * scale, h2 = ih * scale;
  const dx = (dw - w2) * 0.5, dy = (dh - h2) * 0.5;
  return {
    x: dx + (sx / iw) * w2,
    y: dy + (sy / ih) * h2,
    w: (sw / iw) * w2,
    h: (sh / ih) * h2
  };
}
// menu-main.png 1024×682 — 8 left-column items (tuned to the menu strip); profile = bottom-right panel
// Row layout: y starts ~228px in source, ~46px per row, ~40px-tall hot zones, left ~38% of image width
const MENU_ROW_SH = 40;
const MENU_ROW_STEP = 46;
const MENU_LEFT_Y0 = 228;
const MENU_SRC_HITS = [
  { id: 'story',      sx: 0,  sy: MENU_LEFT_Y0 + 0 * MENU_ROW_STEP,  sw: 392,  sh: MENU_ROW_SH },
  { id: 'versus',     sx: 0,  sy: MENU_LEFT_Y0 + 1 * MENU_ROW_STEP,  sw: 392,  sh: MENU_ROW_SH },
  { id: 'tournament', sx: 0,  sy: MENU_LEFT_Y0 + 2 * MENU_ROW_STEP,  sw: 392,  sh: MENU_ROW_SH },
  { id: 'training',   sx: 0,  sy: MENU_LEFT_Y0 + 3 * MENU_ROW_STEP,  sw: 392,  sh: MENU_ROW_SH },
  { id: 'options',    sx: 0,  sy: MENU_LEFT_Y0 + 4 * MENU_ROW_STEP,  sw: 392,  sh: MENU_ROW_SH },
  // Slightly nudged vs grid: art “EXTRAS / gallery” strip sat above the old box (blank + no text on screen)
  { id: 'extras',     sx: 0,  sy: 444,  sw: 392,  sh: 50 },
  { id: 'store',      sx: 0,  sy: MENU_LEFT_Y0 + 6 * MENU_ROW_STEP,  sw: 392,  sh: MENU_ROW_SH },
  // Bottom row: grid was low / narrow vs art; match “Exit game” strip and keep full hit height
  { id: 'exit',       sx: 0,  sy: 544,  sw: 392,  sh: 52 },
];
const MENU_SRC_PROFILE = { id: 'profile', sx: 500, sy: 435, sw: 518, sh: 245 };
// In-button copy (replaces hard-to-read baked art on the left strip; panels match hit rects)
const MENU_PRO_BY_ID = {
  story: { title: 'STORY', sub: 'Journey' },
  versus: { title: 'VERSUS', sub: '2-Player' },
  tournament: { title: 'TOURNAMENT', sub: 'Ladder' },
  training: { title: 'TRAINING', sub: 'Practice' },
  options: { title: 'OPTIONS', sub: 'Settings' },
  extras: { title: 'GALLERY', sub: 'Unlocks' },
  store: { title: 'STORE', sub: 'Shop' },
  exit: { title: 'QUIT', sub: 'Exit' },
  leaderboard: { title: 'RANKS', sub: 'Global board' },
};
// Screen-space (1280×720) menu buttons, drawn on top; hit-tested before profile
const MENU_CANVAS_HITS = [
  { id: 'leaderboard', x: 850, y: 10, w: 412, h: 50 },
];
// Order in the main-menu dropdown (replaces the separate left column buttons)
const MENU_GAME_DROP_ORDER = ['story', 'versus', 'tournament', 'training', 'options', 'extras', 'store', 'exit'];
function getMenuDropLayout() {
  if (menuBg && menuBg.complete && menuBg.naturalWidth > 0) {
    const r = menuBgSourceToCanvas(0, 200, 392, 380);
    if (r) {
      return {
        x: r.x + 4, y: r.y + 6, w: Math.max(300, r.w * 0.98),
        barH: 46, rowH: 33,
        n: MENU_GAME_DROP_ORDER.length
      };
    }
  }
  return { x: 36, y: 212, w: 400, barH: 46, rowH: 33, n: MENU_GAME_DROP_ORDER.length };
}
function menuPointInGameDropdownList(cx, cy) {
  const d = getMenuDropLayout();
  if (!menuDDOpen) return null;
  for (let i = 0; i < d.n; i++) {
    const y = d.y + d.barH + i * d.rowH;
    if (cx >= d.x && cx < d.x + d.w && cy >= y && cy < y + d.rowH) {
      return i;
    }
  }
  return null;
}
function menuGameDropdownBarHit(cx, cy) {
  const d = getMenuDropLayout();
  return (cx >= d.x && cx < d.x + d.w && cy >= d.y && cy < d.y + d.barH);
}

function gameMenuButtonStrokeFill(text, x, y, sizePx, isHot, isExit) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  ctx.font = 'bold ' + sizePx + 'px Impact, "Arial Black", system-ui, sans-serif';
  ctx.lineWidth = Math.max(2.2, sizePx * 0.1);
  ctx.strokeStyle = 'rgba(0,0,0,0.9)';
  if (isExit) {
    const g = ctx.createLinearGradient(x - 50, 0, x + 50, 0);
    if (isHot) {
      g.addColorStop(0, '#ffe8e8');
      g.addColorStop(1, '#ffcccc');
    } else {
      g.addColorStop(0, '#e8c8c8');
      g.addColorStop(1, '#f0c0a0');
    }
    ctx.fillStyle = g;
  } else if (isHot) {
    ctx.fillStyle = '#fffbef';
  } else {
    const g2 = ctx.createLinearGradient(x - 60, y, x + 60, y);
    g2.addColorStop(0, '#f8f0ff');
    g2.addColorStop(0.5, '#ffffff');
    g2.addColorStop(1, '#fff8e0');
    ctx.fillStyle = g2;
  }
  ctx.strokeText(text, x, y);
  ctx.fillText(text, x, y);
}

function drawProMenuPillInRect(r, pro, isHot, styleId) {
  if (!r || !pro) return;
  const pad = 5;
  const ix = r.x + pad, iy = r.y + pad, iw = r.w - pad * 2, ih = r.h - pad * 2;
  const outerRr = Math.min(12, r.w / 4, r.h / 2.2);
  const rr = Math.min(10, iw / 4, ih / 2.2);
  ctx.save();
  ctx.fillStyle = '#0a040f';
  roundRect(r.x, r.y, r.w, r.h, outerRr, true, false);
  const g = ctx.createLinearGradient(ix, iy, ix, iy + ih);
  if (isHot) {
    g.addColorStop(0, 'rgb(50, 26, 70)');
    g.addColorStop(0.5, 'rgb(38, 18, 56)');
    g.addColorStop(1, 'rgb(24, 12, 40)');
    ctx.fillStyle = g;
    roundRect(ix, iy, iw, ih, rr, true, false);
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = 'rgba(255, 230, 140, 0.95)';
  } else {
    g.addColorStop(0, 'rgb(20, 8, 32)');
    g.addColorStop(0.5, 'rgb(14, 4, 24)');
    g.addColorStop(1, 'rgb(8, 2, 12)');
    ctx.fillStyle = g;
    roundRect(ix, iy, iw, ih, rr, true, false);
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = styleId === 'exit' ? 'rgba(220, 150, 180, 0.5)' : 'rgba(150, 120, 200, 0.45)';
  }
  roundRect(ix, iy, iw, ih, rr, false, true);
  const cx = r.x + r.w / 2;
  const titleH = Math.max(14, Math.min(20, r.h * 0.4));
  const subH = Math.max(9, titleH * 0.5);
  const yTitle = pro.sub
    ? r.y + r.h * 0.38
    : r.y + r.h * 0.52;
  gameMenuButtonStrokeFill(pro.title, cx, yTitle, titleH, isHot, styleId === 'exit');
  if (pro.sub) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = Math.round(subH) + 'px system-ui, "Segoe UI", sans-serif';
    const ys = yTitle + titleH * 0.55;
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    ctx.fillStyle = isHot ? 'rgba(220, 215, 245, 0.98)' : 'rgba(160, 155, 200, 0.95)';
    ctx.strokeText(pro.sub, cx, ys);
    ctx.fillText(pro.sub, cx, ys);
  }
  ctx.restore();
}
function drawProLeftMenuButton(z, isHot) {
  const pro = MENU_PRO_BY_ID[z.id];
  if (!pro) return;
  const r = menuBgSourceToCanvas(z.sx, z.sy, z.sw, z.sh);
  if (!r) return;
  drawProMenuPillInRect(r, pro, isHot, z.id);
}
function drawMenuGameDropdown() {
  if (state !== 'menu') return;
  const d = getMenuDropLayout();
  const rBar = { x: d.x, y: d.y, w: d.w, h: d.barH };
  const onBar = menuHot === 'menu_dd_header';
  const barLabel = 'GAME MENU' + (menuDDOpen ? '  \u25B2' : '  \u25BC');
  ctx.save();
  const padI = 5;
  const rIn = { x: rBar.x + padI, y: rBar.y + padI, w: rBar.w - padI * 2, h: rBar.h - padI * 2 };
  const g = ctx.createLinearGradient(rIn.x, rIn.y, rIn.x, rIn.y + rIn.h);
  g.addColorStop(0, onBar ? 'rgb(52, 32, 72)' : 'rgb(22, 10, 35)');
  g.addColorStop(0.5, onBar ? 'rgb(40, 22, 60)' : 'rgb(16, 6, 28)');
  g.addColorStop(1, onBar ? 'rgb(32, 14, 50)' : 'rgb(8, 2, 12)');
  ctx.fillStyle = '#0a040f';
  const rr0 = 10;
  roundRect(rBar.x, rBar.y, rBar.w, rBar.h, rr0, true, false);
  ctx.fillStyle = g;
  roundRect(rIn.x, rIn.y, rIn.w, rIn.h, 8, true, false);
  ctx.lineWidth = onBar ? 2.4 : 1.5;
  ctx.strokeStyle = onBar ? 'rgba(255, 220, 140, 0.9)' : 'rgba(150, 120, 200, 0.45)';
  roundRect(rIn.x, rIn.y, rIn.w, rIn.h, 8, false, true);
  const ty = rBar.y + rBar.h * 0.5;
  const tx = rBar.x + 18;
  const titleBar = 20;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  ctx.font = 'bold ' + titleBar + 'px Impact, "Arial Black", system-ui, sans-serif';
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = 'rgba(0,0,0,0.85)';
  ctx.fillStyle = onBar ? '#fffbef' : '#e8d8ff';
  ctx.strokeText(barLabel, tx, ty);
  ctx.fillText(barLabel, tx, ty);
  if (menuDDOpen) {
    const listH = d.n * d.rowH;
    const bx = d.x, by = d.y + d.barH, bw = d.w, bh = listH;
    const pan = ctx.createLinearGradient(0, by, 0, by + bh);
    pan.addColorStop(0, 'rgba(8,2,16,0.99)');
    pan.addColorStop(1, 'rgba(3,0,6,0.99)');
    ctx.fillStyle = pan;
    const lrr = 6;
    roundRect(bx, by, bw, bh, lrr, true, false);
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = 'rgba(180, 150, 230, 0.4)';
    roundRect(bx, by, bw, bh, lrr, false, true);
    for (let i = 0; i < d.n; i++) {
      const id = MENU_GAME_DROP_ORDER[i];
      const pro = MENU_PRO_BY_ID[id];
      if (!pro) continue;
      const y0 = by + i * d.rowH;
      const rowHot = (menuDDFocus === i) || (menuHot === id);
      if (rowHot) {
        ctx.fillStyle = 'rgba(80, 48, 120, 0.55)';
        roundRect(bx + 4, y0 + 1, bw - 8, d.rowH - 2, 4, true, false);
      }
      const tcy = y0 + d.rowH * 0.4;
      const subY = y0 + d.rowH * 0.74;
      const tcx = bx + 14;
      const titleH = 15, subH = 11;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.miterLimit = 2;
      ctx.font = 'bold ' + titleH + 'px Impact, "Arial Black", system-ui, sans-serif';
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(0,0,0,0.82)';
      if (id === 'exit') {
        const gq = ctx.createLinearGradient(tcx, 0, tcx + 80, 0);
        gq.addColorStop(0, rowHot ? '#ffdddd' : '#d8a8a8');
        gq.addColorStop(1, rowHot ? '#f0b8a0' : '#c8a0a0');
        ctx.fillStyle = gq;
      } else {
        ctx.fillStyle = rowHot ? '#ffffff' : '#e8d8f8';
      }
      ctx.strokeText(pro.title, tcx, tcy);
      ctx.fillText(pro.title, tcx, tcy);
      if (pro.sub) {
        ctx.font = '600 ' + subH + 'px system-ui, "Segoe UI", sans-serif';
        ctx.lineWidth = 1.5;
        ctx.fillStyle = rowHot ? 'rgba(235, 228, 255, 0.95)' : 'rgba(150, 145, 200, 0.92)';
        ctx.strokeStyle = 'rgba(0,0,0,0.55)';
        ctx.strokeText(pro.sub, tcx, subY);
        ctx.fillText(pro.sub, tcx, subY);
      }
    }
  }
  ctx.restore();
}
function drawAllMenuCanvasButtons() {
  for (const c of MENU_CANVAS_HITS) {
    const pro = MENU_PRO_BY_ID[c.id];
    if (pro) drawProMenuPillInRect({ x: c.x, y: c.y, w: c.w, h: c.h }, pro, menuHot === c.id, c.id);
  }
}

function drawMenuProfileOverlay(isHot) {
  const r = menuBgSourceToCanvas(MENU_SRC_PROFILE.sx, MENU_SRC_PROFILE.sy, MENU_SRC_PROFILE.sw, MENU_SRC_PROFILE.sh);
  if (!r) return;
  const rr = Math.min(12, r.w / 4, r.h / 2);
  ctx.save();
  if (isHot) {
    ctx.fillStyle = 'rgba(200, 160, 255, 0.14)';
    roundRect(r.x, r.y, r.w, r.h, rr, true, false);
  }
  ctx.lineWidth = isHot ? 3.2 : 1.6;
  ctx.strokeStyle = isHot ? 'rgba(255, 230, 150, 0.95)' : 'rgba(200, 180, 255, 0.6)';
  roundRect(r.x, r.y, r.w, r.h, rr, false, true);
  ctx.restore();
}
/** Opaque only under the Game Menu dropdown (bar, or bar+list when open) — not the full left side. */
function drawMenuDropdownBakedTextMask() {
  if (state !== 'menu' || !menuBg || !menuBg.complete) return;
  const d = getMenuDropLayout();
  const listH = menuDDOpen ? d.n * d.rowH : 0;
  const totalH = d.barH + listH;
  const pad = 8;
  ctx.save();
  ctx.fillStyle = '#07030d';
  ctx.fillRect(d.x - pad, d.y - pad, d.w + pad * 2, totalH + pad * 2);
  ctx.restore();
}
function drawAllMenuOverlays() {
  if (!menuBg || !menuBg.complete || menuBg.naturalWidth <= 0) return;
  drawMenuProfileOverlay(menuHot === 'profile');
}
/** Re-clip and redraw from menu-main.png in canvas space to undo the vignette (bright, readable). */
function redrawMenuSubrectUnfaded(z) {
  if (!menuBg || !menuBg.complete || !menuBg.naturalWidth) return;
  if (!z || !Number.isFinite(z.sx)) return;
  const r = menuBgSourceToCanvas(z.sx, z.sy, z.sw, z.sh);
  if (!r) return;
  const iw = menuBg.naturalWidth, ih = menuBg.naturalHeight;
  const dw = 1280, dh = 720;
  const sc = Math.max(dw / iw, dh / ih);
  const w2 = iw * sc, h2 = ih * sc;
  const dx = (dw - w2) * 0.5, dy = (dh - h2) * 0.5;
  ctx.save();
  ctx.beginPath();
  const rr = Math.min(12, r.w / 4, r.h / 2);
  ctx.moveTo(r.x + rr, r.y);
  ctx.arcTo(r.x + r.w, r.y, r.x + r.w, r.y + r.h, rr);
  ctx.arcTo(r.x + r.w, r.y + r.h, r.x, r.y + r.h, rr);
  ctx.arcTo(r.x, r.y + r.h, r.x, r.y, rr);
  ctx.arcTo(r.x, r.y, r.x + r.w, r.y, rr);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(menuBg, 0, 0, iw, ih, dx, dy, w2, h2);
  ctx.restore();
}
function redrawMenuProfileUnfaded() {
  redrawMenuSubrectUnfaded(MENU_SRC_PROFILE);
}
function drawTopMenuHintIfAny() {
  if (performance.now() < menuHintUntil && menuHintText) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(160, 6, 960, 36);
    drawText(menuHintText, 640, 32, 20, 'rgba(255,255,255,0.95)', 'center');
    ctx.restore();
  }
}
function advanceStory() {
  storyPage++;
  if (storyPage >= STORY_INTRO.length) {
    pendingPlayMode = 'story';
    state = 'select';
    storyPage = 0;
  }
}
function drawStoryScreen() {
  ctx.clearRect(0, 0, 1280, 720);
  if (drawImageCover(menuBg, 0, 0, 1280, 720)) {
    const g = ctx.createLinearGradient(0, 0, 1280, 0);
    g.addColorStop(0, 'rgba(0,0,0,0.55)');
    g.addColorStop(0.5, 'rgba(0,0,0,0.4)');
    g.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1280, 720);
  } else {
    ctx.fillStyle = '#080510';
    ctx.fillRect(0, 0, 1280, 720);
  }
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  roundRect(80, 120, 1120, 400, 14, true, true);
  const t = STORY_INTRO[storyPage] || '';
  const all = wrapText(t, 52);
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255,240,255,0.9)';
  ctx.font = '26px Impact, Arial Black';
  const y0 = 220;
  for (let i = 0; i < all.length; i++) {
    ctx.fillText(all[i], 120, y0 + i * 40);
  }
  drawText('Page ' + (storyPage + 1) + ' / ' + STORY_INTRO.length, 120, 500, 20, '#9cf0c2', 'left');
  drawText('Press Enter to continue  ·  Last page goes to the roster', 640, 600, 22, '#ff8888', 'center');
  drawTopMenuHintIfAny();
  ctx.restore();
}
function drawOptionsScreen() {
  ctx.clearRect(0, 0, 1280, 720);
  ctx.fillStyle = '#0a0a10';
  ctx.fillRect(0, 0, 1280, 720);
  drawText('OPTIONS', 640, 70, 52, '#ff8888', 'center');
  drawText('AI DIFFICULTY: ' + difficulty().name, 640, 280, 36, '#ffd65a', 'center');
  drawText('Use A / D or Arrow keys  ·  Enter to close', 640, 360, 22, '#9cf0c2', 'center');
  drawText('Affects how sharp the computer opponent reads you (not in local Versus).', 640, 400, 18, '#666', 'center');
  drawText('Escape  ·  Backspace  ·  Enter  —  main menu', 640, 660, 20, '#888', 'center');
  drawTopMenuHintIfAny();
}
function drawStoreScreen() {
  ctx.clearRect(0, 0, 1280, 720);
  drawProceduralLeaderboardCanvasBg();
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(0, 0, 1280, 720);
  drawText('DOJO STORE', 640, 70, 48, '#d4a5ff', 'center');
  drawText('Tournament points unlock future cosmetics. Enter: info', 640, 130, 18, '#9cf0c2', 'center');
  STORE_ITEMS.forEach((it, i) => {
    const y = 210 + i * 110;
    const isSel = i === storeSel;
    if (isSel) {
      ctx.save();
      ctx.fillStyle = 'rgba(200, 120, 255, 0.2)';
      roundRect(200, y - 40, 880, 100, 10, true, true);
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(255,220,160,0.7)';
      roundRect(200, y - 40, 880, 100, 10, false, true);
      ctx.restore();
    }
    drawText(it.name + (it.cost ? '  —  ' + it.cost + ' pts' : '  (free)'), 640, y, 32, isSel ? '#fff' : '#aaa', 'center');
    drawText(it.note, 640, y + 38, 16, '#777', 'center');
  });
  drawText('W/S or Up/Down  ·  Enter  —  Check unlock   ·  Escape — menu', 640, 680, 20, '#888', 'center');
  drawTopMenuHintIfAny();
}
function setMenuHint(msg, ms = 2000) {
  menuHintText = msg;
  menuHintUntil = performance.now() + ms;
}
function menuHitId(cx, cy) {
  if (state !== 'menu') return null;
  for (const c of MENU_CANVAS_HITS) {
    if (cx >= c.x && cx < c.x + c.w && cy >= c.y && cy < c.y + c.h) return c.id;
  }
  if (menuGameDropdownBarHit(cx, cy)) return 'menu_dd_header';
  if (menuDDOpen) {
    const ri = menuPointInGameDropdownList(cx, cy);
    if (ri !== null) return MENU_GAME_DROP_ORDER[ri];
  }
  if (menuBg && menuBg.complete && menuBg.naturalWidth > 0) {
    const z = MENU_SRC_PROFILE;
    const r = menuBgSourceToCanvas(z.sx, z.sy, z.sw, z.sh);
    if (r && cx >= r.x && cx < r.x + r.w && cy >= r.y && cy < r.y + r.h) return z.id;
    return null;
  }
  if (cx >= 400 && cx < 880 && cy >= 500 && cy < 600) return 'tournament';
  return null;
}
function runMenuAction(id) {
  if (state !== 'menu' || !id) return;
  if (id === 'menu_dd_header') return;
  if (id === 'tournament') {
    pendingPlayMode = 'tournament';
    enter();
    return;
  }
  if (id === 'story') {
    storyPage = 0;
    state = 'story';
    return;
  }
  if (id === 'versus') {
    pendingPlayMode = 'versus';
    state = 'select';
    return;
  }
  if (id === 'training') {
    pendingPlayMode = 'training';
    state = 'select';
    return;
  }
  if (id === 'leaderboard') {
    state = 'scores';
    fetchLeaderboard();
    return;
  }
  if (id === 'extras') {
    state = 'store';
    storeSel = 2; // highlight Gallery row; global ranks use Ranks (top) or H
    return;
  }
  if (id === 'store') {
    state = 'store';
    storeSel = 0;
    return;
  }
  if (id === 'options') {
    state = 'options';
    return;
  }
  if (id === 'profile') {
    const v = prompt('Name on the global scoreboard (letters, numbers, spaces, max 12):', getPlayerName());
    if (v !== null) setPlayerName(v);
    return;
  }
  if (id === 'fullscreen') {
    toggleFullscreen();
    return;
  }
  if (id === 'exit') {
    if (USE_HTML_MAIN_MENU && kadenMainMenu) {
      kadenMainMenu.openExitDialog();
      return;
    }
    setMenuHint('Close this tab to leave the game');
    return;
  }
}

function toggleFullscreen() {
  const el = document.getElementById('gameShell') || document.documentElement;
  const doc = document;
  const isFs = !!(doc.fullscreenElement || doc.webkitFullscreenElement);
  try {
    if (!isFs) {
      const req = el.requestFullscreen || el.webkitRequestFullscreen;
      if (req) req.call(el);
    } else {
      const ex = doc.exitFullscreen || doc.webkitExitFullscreen;
      if (ex) ex.call(doc);
    }
  } catch (_) {
    // Ignore: some browsers block fullscreen without a trusted gesture.
  }
  try { syncGameCanvasDisplaySize(); } catch (_) {}
}
function drawImageCover(img, dx, dy, dw, dh) {
  if (!img || !img.complete || img.naturalWidth <= 0) return false;
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const scale = Math.max(dw / iw, dh / ih);
  const w = iw * scale;
  const h = ih * scale;
  const x = dx + (dw - w) / 2;
  const y = dy + (dh - h) / 2;
  ctx.drawImage(img, 0, 0, iw, ih, x, y, w, h);
  return true;
}

/** Cover: uniform scale, fills dest (crops; used for full-screen stage art). */
function drawImageSliceCover(img, sx, sy, sw, sh, dx, dy, dw, dh) {
  if (!img || !img.complete || sw <= 0 || sh <= 0) return;
  const s = Math.max(dw / sw, dh / sh);
  const w2 = Math.round(sw * s);
  const h2 = Math.round(sh * s);
  const x0 = Math.round(dx + (dw - w2) * 0.5);
  const y0 = Math.round(dy + (dh - h2) * 0.5);
  ctx.drawImage(img, sx, sy, sw, sh, x0, y0, w2, h2);
}
/** Contain: full slice, uniform scale, bottom edge at dest bottom (no stretch / no zoom-crop on X). */
function drawImageSliceBottomFit(img, sx, sy, sw, sh, dx, dy, dw, dh) {
  if (!img || !img.complete || sw <= 0 || sh <= 0) return;
  const s = Math.min(dw / sw, dh / sh);
  const w2 = sw * s;
  const h2 = sh * s;
  const x0 = dx + (dw - w2) * 0.5;
  const y0 = dy + dh - h2;
  const prevEn = ctx.imageSmoothingEnabled;
  const prevQ = ctx.imageSmoothingQuality;
  ctx.imageSmoothingEnabled = true;
  if ('imageSmoothingQuality' in ctx) ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, sx, sy, sw, sh, x0, y0, w2, h2);
  ctx.imageSmoothingEnabled = prevEn;
  if ('imageSmoothingQuality' in ctx) ctx.imageSmoothingQuality = prevQ;
}

function menu() {
  if (USE_HTML_MAIN_MENU) {
    ctx.clearRect(0, 0, 1280, 720);
    ctx.fillStyle = '#020006';
    ctx.fillRect(0, 0, 1280, 720);
    return;
  }
  ctx.clearRect(0, 0, 1280, 720);
  if (drawImageCover(menuBg, 0, 0, 1280, 720)) {
    // very light edge darkening so menu art and button frames stay readable
    const g = ctx.createRadialGradient(640, 360, 200, 640, 360, 720);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.12)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1280, 720);
    // Left-column labels are drawn on pro panels; profile panel still needs unfaded art under the frame
    redrawMenuProfileUnfaded();
    // Opaque only behind the Game Menu control so art shows elsewhere on the left
    drawMenuDropdownBakedTextMask();
    drawAllMenuOverlays();
  } else {
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, 1280, 720);
    drawText('KADEN FIGHTER', 640, 120, 74, '#d71920', 'center');
    drawText('FIVE WARRIOR TOURNAMENT', 640, 170, 34, 'white', 'center');
  }
  drawMenuGameDropdown();
  drawAllMenuCanvasButtons();
  drawTopMenuHintIfAny();
  if (menuHot === 'tournament' && (!menuBg || !menuBg.complete || !menuBg.naturalWidth)) {
    ctx.save();
    ctx.fillStyle = 'rgba(200, 160, 255, 0.15)';
    roundRect(400, 500, 480, 100, 10, true, false);
    ctx.lineWidth = menuHot === 'tournament' ? 3 : 2;
    ctx.strokeStyle = 'rgba(255, 230, 150, 0.9)';
    roundRect(400, 500, 480, 100, 10, false, true);
    ctx.restore();
  }
}

/** Roster select: card grid + type sizes (G_WIDTH 1280) — single source of truth for layout. */
const ROSTER_LAYOUT = (function () {
  const n = typeof SELECTABLE_COUNT === 'number' ? SELECTABLE_COUNT : 5;
  const gap = 0;
  const cardW = ((1280 - (n - 1) * gap) / n) | 0;
  const totalW = n * cardW + (n - 1) * gap;
  return {
    cardW,
    cardH: 636,
    gap,
    /** Flush under header bar; see drawCharacterSelectHeaderBar topH. */
    topY: 46,
    pad: 4,
    /** Slightly shorter art blocks so the text stack below the portrait fits without overlap. */
    stripH: 168,
    portW: 248,
    portH: 300,
    marginX: (1280 - totalW) / 2,
    fontName: 40,
    fontStyle: 20,
    fontSp: 18,
    fontDesc: 12,
    fontSu: 18,
    /** `specialDesc` wraps within card width; line height in px (system font). */
    descLineH: 12,
    /** At most 2 short lines of SP blurb (see characterSelect) so bottom lines don’t collide. */
    descMaxLines: 2,
  };
})();

/**
 * `drawText` uses alphabetic baseline: space so the next line’s text doesn’t overlap the one above.
 */
function rosterTextBaselineAfter(fontSizePx) {
  const s = fontSizePx | 0;
  return Math.max(16, (s * 0.62) | 0) + 3;
}

/**
 * Split `specialDesc` to fit `maxW` (set `ctx.font` first). At most `maxLines` lines; adds … if truncated.
 */
function wordWrapRosterDescLines(ctx, text, maxW, maxLines) {
  const cap = Math.max(1, Math.min(4, maxLines | 0));
  const words = String(text != null ? text : '')
    .replace(/\r/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return [''];
  const out = [];
  let i = 0;
  let cur = '';
  while (i < words.length && out.length < cap) {
    const word = words[i];
    const cand = cur ? cur + ' ' + word : word;
    if (ctx.measureText(cand).width <= maxW) {
      cur = cand;
      i++;
      continue;
    }
    if (cur) {
      out.push(cur);
      cur = '';
      continue;
    }
    let piece = '';
    for (let j = 0; j < word.length; j++) {
      const test = piece + word[j];
      if (ctx.measureText(test).width <= maxW) {
        piece = test;
      } else {
        if (piece) {
          out.push(piece);
          piece = word[j];
          if (out.length >= cap) break;
        } else {
          out.push(String(word[j]));
          if (out.length >= cap) break;
        }
      }
    }
    if (out.length < cap && piece) cur = piece;
    i++;
  }
  if (cur && out.length < cap) out.push(cur);
  if (i < words.length && out.length) {
    const li = out.length - 1;
    let t = out[li] + '…';
    while (t.length > 2 && ctx.measureText(t).width > maxW) t = t.slice(0, -2) + '…';
    out[li] = t;
  }
  return out;
}
function rosterCardLeft(i) {
  return ROSTER_LAYOUT.marginX + i * (ROSTER_LAYOUT.cardW + ROSTER_LAYOUT.gap);
}
function rosterCardCenterX(i) {
  return rosterCardLeft(i) + ROSTER_LAYOUT.cardW * 0.5;
}
function rosterCardStripRect(i) {
  const x = rosterCardLeft(i) + ROSTER_LAYOUT.pad;
  const y = ROSTER_LAYOUT.topY + ROSTER_LAYOUT.pad;
  const w = ROSTER_LAYOUT.cardW - 2 * ROSTER_LAYOUT.pad;
  return { x, y, w, h: ROSTER_LAYOUT.stripH };
}
function rosterCardPortraitRect(i) {
  const r = rosterCardStripRect(i);
  const y = r.y + r.h + 8;
  const x = rosterCardLeft(i) + (ROSTER_LAYOUT.cardW - ROSTER_LAYOUT.portW) * 0.5;
  return { x, y, w: ROSTER_LAYOUT.portW, h: ROSTER_LAYOUT.portH };
}
function drawCharacterSelectHeaderBar() {
  const mLabel = { tournament: 'Tournament', story: 'Story (full arc)', training: 'Training (dummy AI)', versus: 'Local Versus (2P)' }[pendingPlayMode] || 'Tournament';
  const lines = mLabel.length > 42 ? mLabel.slice(0, 40) + '…' : mLabel;
  const topH = 40;
  const topW = 1280;
  const topX = 0;
  const topY = 4;
  const rr = 12;
  const padL = 32;
  const padR = 24;
  ctx.save();
  const bg = ctx.createLinearGradient(topX, topY, topX, topY + topH);
  bg.addColorStop(0, 'rgba(16, 10, 36, 0.96)');
  bg.addColorStop(0.45, 'rgba(8, 6, 20, 0.98)');
  bg.addColorStop(1, 'rgba(4, 3, 12, 0.99)');
  ctx.fillStyle = bg;
  roundRect(topX, topY, topW, topH, rr, true, false);
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = 'rgba(130, 100, 200, 0.42)';
  roundRect(topX, topY, topW, topH, rr, false, true);
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  roundRect(topX + 1, topY + 1, topW - 2, topH - 2, Math.max(2, rr - 1), false, true);
  const midY = (topY + topH * 0.5) | 0;
  ctx.textBaseline = 'middle';
  let hint = 'A / D  ·  arrows  ·  Enter to play';
  ctx.font = '11px system-ui, -apple-system, sans-serif';
  if (ctx.measureText(hint).width > 400) hint = 'Arrows or A/D · Enter to play';
  ctx.textAlign = 'center';
  const cxBar = (topX + topW * 0.5) | 0;
  ctx.fillStyle = 'rgba(150, 140, 188, 0.78)';
  ctx.fillText(hint, cxBar, midY);
  ctx.textAlign = 'left';
  const tx = topX + padL;
  ctx.font = '800 28px system-ui, -apple-system, "Segoe UI", sans-serif';
  ctx.letterSpacing = '0.04em';
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  const title = 'ROSTER';
  ctx.strokeText(title, tx, midY);
  ctx.lineWidth = 0;
  ctx.letterSpacing = '0.08em';
  const g = ctx.createLinearGradient(tx, midY - 16, tx, midY + 16);
  g.addColorStop(0, '#fff8ff');
  g.addColorStop(1, '#c8b8e8');
  ctx.fillStyle = g;
  ctx.fillText(title, tx, midY);
  ctx.letterSpacing = '0';
  ctx.font = '600 10px system-ui, sans-serif';
  const wMode = ctx.measureText('MODE').width;
  ctx.font = '600 14px system-ui, sans-serif';
  const wLab = ctx.measureText(lines).width;
  const chipW = Math.min(380, Math.max(200, Math.ceil(Math.max(wMode, wLab) + 32)));
  const chipH = 32;
  const chipX = (topX + topW - padR - chipW) | 0;
  const chipY = (topY + (topH - chipH) * 0.5) | 0;
  const cr2 = 8;
  ctx.fillStyle = 'rgba(4, 28, 30, 0.92)';
  roundRect(chipX, chipY, chipW, chipH, cr2, true, false);
  ctx.lineWidth = 1.3;
  ctx.strokeStyle = 'rgba(72, 200, 165, 0.55)';
  roundRect(chipX, chipY, chipW, chipH, cr2, false, true);
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#5dccb0';
  ctx.font = '600 10px system-ui, sans-serif';
  ctx.fillText('MODE', chipX + 12, chipY + 13);
  ctx.fillStyle = '#b5f0e5';
  ctx.font = '600 13px system-ui, sans-serif';
  ctx.fillText(lines, chipX + 12, chipY + 27);
  ctx.restore();
}
function drawCharacterSelectFooterBar() {
  const botH = 36;
  const botW = 1280;
  const botX = 0;
  const botY = 684;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  roundRect(botX, botY, botW, botH, 8, true, false);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(150, 130, 200, 0.35)';
  roundRect(botX, botY, botW, botH, 8, false, true);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const mid = botX + botW * 0.5;
  const my = botY + botH * 0.38;
  const my2 = botY + botH * 0.7;
  ctx.lineWidth = 2.4;
  ctx.lineJoin = 'round';
  ctx.font = 'bold 22px Impact, "Arial Black", system-ui, sans-serif';
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.fillStyle = '#c8c0d8';
  const L1 = 'A / D  ·  ARROWS  ·  ENTER  TO  FIGHT';
  ctx.strokeText(L1, mid, my);
  ctx.fillText(L1, mid, my);
  ctx.lineWidth = 0;
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(160, 155, 180, 0.95)';
  ctx.fillText('Fighters play differently — check SP and SU in each card before you lock in.', mid, my2);
  ctx.restore();
}
function characterSelect() {
  ctx.clearRect(0, 0, 1280, 720);
  drawCharacterSelectHeaderBar();
  const rl = ROSTER_LAYOUT;
  for (let i = 0; i < SELECTABLE_COUNT; i++) {
    const c = characters[i];
    if (!c) break;
    const rIdx = (c.row != null ? (c.row | 0) : i);
    const syRow = (rIdx >= 0 && rIdx < rowY.length) ? rowY[rIdx] : rowY[i];
    const shRow = (rIdx >= 0 && rIdx < rowH.length) ? rowH[rIdx] : rowH[i];
    const x = rosterCardLeft(i);
    const cx = rosterCardCenterX(i);
    const strip = rosterCardStripRect(i);
    const port = rosterCardPortraitRect(i);
    ctx.strokeStyle = i === sel ? '#fff' : c.color;
    ctx.lineWidth = i === sel ? 6 : 3;
    ctx.strokeRect(x, rl.topY, rl.cardW, rl.cardH);
    const hasAstra = charHasAstraSheet(i);
    // ASTRA: [bust | name+kanji | mini] + main portrait from cell (0,0) — same for Kaden, Raijin, Hikari.
    if (hasAstra) {
      drawAstraRosterTopBanner(ctx, i, c, 0, 0, strip.x, strip.y, strip.w, strip.h);
    } else if (i === 0 && useKadenHdMenuPortrait()) {
      drawKadenMenuImageCoverClipped(ctx, kadenGameplay, strip.x, strip.y, strip.w, strip.h, { vertical: 'center', scaleMult: 1.04 });
    } else {
      ctx.drawImage(sheet, 0, syRow, 355, shRow, strip.x, strip.y, strip.w, strip.h);
    }
    if (hasAstra) {
      drawAstraCellKeyedInBox(ctx, i, 0, 0, port.x, port.y, port.w, port.h, { vertical: 'bottom', scaleMult: 1.12 });
    } else if (i === 0 && useKadenHdMenuPortrait()) {
      drawKadenMenuImageCoverClipped(ctx, kadenGameplay, port.x, port.y, port.w, port.h, { vertical: 'bottom', scaleMult: 1.12 });
    } else {
      ctx.drawImage(sheet, 246, syRow, 109, shRow, port.x, port.y, port.w, port.h);
    }
    if (i === 0 && !hasAstra) {
      const my1 = (strip.y + strip.h * 0.4) | 0;
      const my2 = (strip.y + strip.h * 0.72) | 0;
      const jpStr = c.jp != null ? String(c.jp) : '';
      const fe = Math.max(16, (strip.h * 0.2) | 0);
      const fj = Math.max(15, (strip.h * 0.16) | 0);
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.miterLimit = 2;
      ctx.font = 'bold ' + fe + 'px Impact, "Arial Black", system-ui, sans-serif';
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      ctx.strokeText(c.name, cx, my1);
      ctx.lineWidth = 0;
      ctx.fillStyle = c.color;
      ctx.fillText(c.name, cx, my1);
      if (jpStr) {
        ctx.font = '600 ' + fj + 'px "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", "Noto Sans JP", "PingFang SC", system-ui, sans-serif';
        ctx.lineWidth = 1.8;
        ctx.strokeStyle = 'rgba(0,0,0,0.85)';
        ctx.strokeText(jpStr, cx, my2);
        ctx.lineWidth = 0;
        ctx.fillStyle = c.color;
        ctx.fillText(jpStr, cx, my2);
      }
      ctx.restore();
    }
    const yName = (port.y + port.h + 5) | 0;
    const yStyle = yName + rosterTextBaselineAfter(rl.fontName);
    const ySp = yStyle + rosterTextBaselineAfter(rl.fontStyle);
    const yDesc = ySp + rosterTextBaselineAfter(rl.fontSp) + 1;
    const maxDescW = Math.max(40, (rl.cardW - 2 * rl.pad - 4) | 0);
    const dSize = rl.fontDesc;
    const dLH = rl.descLineH;
    const dCap = (typeof rl.descMaxLines === 'number' && rl.descMaxLines > 0) ? (rl.descMaxLines | 0) : 2;
    ctx.save();
    ctx.font = '400 ' + dSize + 'px system-ui, sans-serif';
    const descLines = wordWrapRosterDescLines(ctx, c.specialDesc, maxDescW, dCap);
    ctx.restore();
    const ySu = (yDesc + descLines.length * dLH + 5) | 0;
    drawText(c.name, cx, yName, rl.fontName, c.color, 'center');
    drawText(c.style, cx, yStyle, rl.fontStyle, '#ddd', 'center');
    drawText('SP: ' + c.special, cx, ySp, rl.fontSp, '#ffd65a', 'center');
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = '400 ' + dSize + 'px system-ui, sans-serif';
    for (let di = 0; di < descLines.length; di++) {
      ctx.fillStyle = '#bbb';
      ctx.fillText(descLines[di], cx, (yDesc + di * dLH) | 0);
    }
    ctx.restore();
    drawText('SU: ' + c.super, cx, ySu, rl.fontSu, '#ff8888', 'center');
  }
  drawCharacterSelectFooterBar();
}

// --- Fighter factory --------------------------------------------------------
function makeFighter(charIdx, x, flip = false) {
  const isBoss = charIdx === BOSS_INDEX;
  const maxHealth = isBoss ? 140 : 100;
  return {
    char: charIdx,
    x, y: FLOOR_FIGHT_Y,
    vx: 0, vy: 0,
    flip,
    maxHealth,
    health: maxHealth,
    meter: 0,
    action: 'idle',
    frame: 0,
    animT: 0,
    _prevA: 'idle',
    lock: 0,
    block: false,
    cool: 0,
    comboHits: 0,
    comboTimer: 0,
    comboPop: 0,
    wins: 0,
    flash: 0,        // white-flash duration when hit
    armor: 0,        // hits absorbed during super-armor
    iframes: 0,      // invulnerability frames
    parry: 0,        // active parry window
    airDashUsed: false,
    airFlipUsed: false, // one flip per time airborne until you land
    phase: 1,
    blockTimer: 0,   // AI: commit to block for N frames
    actionCooldown: 0, // AI: don't re-pick decisions every frame
    _tkw: null        // { kind:'n'|'s1'|'s2', mid, n, l0 } — move-sheet anim (Kaden–Ren)
  };
}

function startTournament() {
  playMode = pendingPlayMode;
  pendingPlayMode = 'tournament';
  p2IsHuman = (playMode === 'versus');
  oppIndex = (sel + 1) % SELECTABLE_COUNT;
  if (oppIndex === sel) oppIndex = (oppIndex + 1) % SELECTABLE_COUNT;
  p1wins = 0; p2wins = 0; round = 1; tournamentWins = 0; score = 0;
  scoreSubmittedThisRun = false;
  lastSubmitStatus = '';
  newRound();
  state = 'fight';
}

function newRound() {
  p1 = makeFighter(sel, 260, false);
  p2 = makeFighter(oppIndex, 860, true);
  resetCombo(p1);
  resetCombo(p2);
  projectiles = [];
  sparks.length = 0;
  hitPause = 0;
  shake = 0;
  // Stage pick: rotate with tournament progress, but force Shadow Temple for boss.
  if (oppIndex === BOSS_INDEX) stageIndex = 3;
  else stageIndex = Math.max(0, Math.min(stages.length - 1, tournamentWins % stages.length));
  msg = 'ROUND ' + round;
  setTimeout(() => msg = '', 900);
  requestAnimationFrame(() => focusFightInput());
}

// --- Air flips (while airborne; one per jump) --------------------------------
function inAirFlip(f) {
  return f && (f.action === 'frontflip' || f.action === 'backflip');
}
function tryStartAirFlip(f, isFront) {
  if (!f || f.y >= FLOOR_FIGHT_Y - 1) return;
  if (f.airFlipUsed) return;
  if (f.lock > 0.01) return;
  f.airFlipUsed = true;
  f.action = isFront ? 'frontflip' : 'backflip';
  f.lock = FIGHTER_FLIP_FRAMES;
  f.animT = 0; f._prevA = f.action; f.frame = 0;
  f.vx = f.flip ? (isFront ? -5.1 : 5.1) : (isFront ? 5.1 : -5.1);
  f.vy = Math.min(f.vy, 0) - 2.6;
  f.iframes = 12;
  playSfxWhoosh(0.07);
}

// --- Combat -----------------------------------------------------------------
function attack(f, type, power, range) {
  if (f.lock > 0.01) return;
  f.action = type;
  f.lock = 24;
  f._tkw = null;
  if (fightTkwUseInFight(f)) {
    const c0 = f.char | 0;
    const d0 = fightTkwDef(c0);
    if (c0 === 1 && type === 'special-strike' && d0) {
      f._tkw = { kind: 's1', n: d0.s1.f, l0: 0 };
      f.lock = 30;
      f._tkw.l0 = f.lock;
    } else if (d0) {
      const nmap = c0 === 0 ? KADEN_TKW_NORM : c0 === 1 ? RAIJIN_TKW_NORM : c0 === 2 ? HIKARI_TKW_NORM : c0 === 3 ? REN_TKW_NORM : c0 === 4 ? YUKI_TKW_NORM : null;
      if (nmap) {
        const mid0 = nmap[type] != null ? nmap[type] : 0;
        const _metaN = d0.moves[mid0];
        const _n = _metaN && _metaN.f ? _metaN.f : 3;
        f._tkw = { kind: 'n', mid: mid0, n: _n, l0: 0 };
        f.lock = Math.max(20, Math.min(44, _n * 4 + 2));
        f._tkw.l0 = f.lock;
      }
    }
  }
  f.animT = 0; f._prevA = f.action; f.frame = 0;
  f.cool = 18;
  playSfxWhoosh(kickAttackName(type) ? 0.055 : 0.048);

  const other = (f === p1) ? p2 : p1;
  const dist = Math.abs(f.x - other.x);
  if (dist >= range) {
    resetCombo(f);
    return;
  }

  // Defender i-frames: whiff entirely
  if (other.iframes > 0) {
    resetCombo(f);
    spark(other.x, other.y - 110, '#ffffff', 4);
    return;
  }

  // Defender parry: counter the attacker
  if (other.parry > 0) {
    playSfxParry(0.14);
    other.parry = 0;
    f.action = 'hurt';
    f.lock = 36;
    f.health = Math.max(0, f.health - 14);
    f.flash = 12;
    other.meter = Math.min(100, other.meter + 30);
    other.action = 'special';
    other.lock = 18;
    hitPause = 10;
    shake = 18;
    spark(f.x, f.y - 120, '#ffeb70', 14);
    msg = characters[other.char].name + ' COUNTERS!';
    setTimeout(() => msg = '', 700);
    resetCombo(f);
    return;
  }

  if (other.block) {
    resetCombo(f);
    playSfxBlock(0.09);
    other.health = Math.max(0, other.health - Math.ceil(power * 0.25));
    f.meter = Math.min(100, f.meter + 4);
    shake = Math.max(shake, 4);
    spark(other.x + (f.flip ? 40 : -40), other.y - 100, '#dddddd', 5);
    return;
  }

  if (other.armor > 0) {
    resetCombo(f);
    playSfxPunch(0.14);
    // Soaks the hit: reduced damage, no stun, armor depletes
    other.armor--;
    other.health = Math.max(0, other.health - Math.ceil(power * 0.5));
    f.meter = Math.min(100, f.meter + power * 0.6);
    shake = Math.max(shake, 5);
    spark(other.x, other.y - 100, '#ffd65a', 6);
    return;
  }

  // Clean hit
  playSfxImpactByMoveName(type);
  const dir = Math.sign(other.x - f.x) || 1;
  other.health = Math.max(0, other.health - power);
  f.meter = Math.min(100, f.meter + power * 1.2);
  registerComboHit(f);
  if (playerScoresFor(f)) {
    const comboBonus = f.comboHits >= 2 ? (f.comboHits - 1) * 15 : 0;
    addScore(power * 10 + comboBonus);
  }
  other.action = 'hurt';
  other.lock = 12;
  other.x += dir * 18;
  other.flash = 6;
  hitPause = Math.min(8, 3 + Math.floor(power / 4));
  shake = Math.min(16, 4 + Math.floor(power / 2));
  spark(other.x + (f.flip ? -40 : 40), other.y - 100 - Math.random() * 40, characters[f.char].color);
}

// Per-character special moves
function special(f) {
  if (f.lock > 0.01 || f.meter < 25) return;
  f.meter -= 25;
  f._tkw = null;
  const c = f.char;
  const other = (f === p1) ? p2 : p1;

  if (c === 0) {
    // KADEN — Raging Palm: armored projectile palm wave
    f.action = 'special';
    f.lock = 38;
    if (fightTkwUseInFight(f) && KADEN_TKW.s1) {
      f._tkw = { kind: 's1', n: KADEN_TKW.s1.f, l0: 38 };
    }
    f.armor = 1;
    projectiles.push({
      x: f.x + (f.flip ? -60 : 60), y: 430 + FLOOR_PROJ_DY,
      vx: f.flip ? -10 : 10,
      owner: f, life: 70,
      color: characters[c].color, power: 14, size: 55, kind: 'palm'
    });
  }
  else if (c === 1) {
    // RAIJIN — Thunder Dash: teleport behind and strike
    f.action = 'special';
    f.lock = 30;
    const targetSide = (other.x > 640) ? -100 : 100; // wrap behind toward stage center side
    f.x = Math.max(80, Math.min(1200, other.x + targetSide));
    f.flip = f.x > other.x;
    spark(f.x, f.y - 100, '#3aa7ff', 16);
    if (other.iframes > 0 || other.parry > 0) {
      // teleport still happens; treat the strike via attack so parries work
    }
    // Apply a strong hit using normal pipeline (lets parry/iframes interact)
    const old = f.lock;
    f.lock = 0;
    attack(f, 'special-strike', 18, 180);
    f.lock = Math.max(f.lock, 30);
  }
  else if (c === 2) {
    // HIKARI — Sakura Step: fast i-frame air-dash, drops petals
    f.action = 'special';
    f.lock = 22;
    f.iframes = 22;
    if (fightTkwUseInFight(f) && HIKARI_TKW.s1) {
      f._tkw = { kind: 's1', n: HIKARI_TKW.s1.f, l0: 22 };
    }
    const dir = f.flip ? -1 : 1;
    f.x = Math.max(80, Math.min(1200, f.x + dir * 220));
    f.flip = f.x > other.x;
    f.vy = -10;
    petals(f.x, 460 + FLOOR_PROJ_DY, '#ff4f91');
    petals(f.x - dir * 80, 480 + FLOOR_PROJ_DY, '#ffb3d1');
  }
  else if (c === 3) {
    // REN — Lotus Guard: open parry window + Serene Deflection (s1) sheet
    f.action = 'special';
    f.lock = 30;
    f.parry = 30;
    if (fightTkwUseInFight(f) && REN_TKW.s1) {
      f._tkw = { kind: 's1', n: REN_TKW.s1.f, l0: 30 };
    }
    spark(f.x, f.y - 110, '#7ec46b', 6);
  }
  else if (c === BOSS_INDEX) {
    // REIGEN — Shadow Techniques: fast shadow bolt (stronger by phase)
    f.action = 'special';
    f.lock = 34;
    const phaseMul = (f.phase || 1) === 3 ? 1.25 : (f.phase || 1) === 2 ? 1.12 : 1.0;
    projectiles.push({
      x: f.x + (f.flip ? -60 : 60), y: 430 + FLOOR_PROJ_DY,
      vx: f.flip ? -12 : 12,
      owner: f, life: 55,
      color: '#a855f7', power: Math.round(12 * phaseMul), size: 62, kind: 'shadow'
    });
  }
  else if (c === 4) {
    // YUKI — Frost Slide + Judgment Throw (s1) sheet
    f.action = 'special';
    f.lock = 36;
    if (fightTkwUseInFight(f) && YUKI_TKW.s1) {
      f._tkw = { kind: 's1', n: YUKI_TKW.s1.f, l0: 36 };
    }
    projectiles.push({
      x: f.x + (f.flip ? -60 : 60), y: 480 + FLOOR_PROJ_DY,
      vx: f.flip ? -4.5 : 4.5,
      owner: f, life: 150,
      color: characters[c].color, power: 8, size: 42, kind: 'frost'
    });
  }
}

function superMove(f) {
  if (f.lock > 0.01 || f.meter < 100) return;
  f.meter = 0;
  f.action = 'super';
  f.lock = 60;
  f._tkw = null;
  if (fightTkwUseInFight(f) && fightTkwDef(f.char | 0)) {
    const dS = fightTkwDef(f.char | 0);
    f._tkw = { kind: 's2', n: dS.s2.f, l0: 60 };
  }
  const other = (f === p1) ? p2 : p1;
  const dist = Math.abs(f.x - other.x);

  // REIGEN boss super: huge shadow eruption (screen-control)
  if (f.char === BOSS_INDEX) {
    playSfxWhoosh(0.07);
    msg = 'VOID DESTRUCTION!';
    setTimeout(() => msg = '', 900);
    shake = Math.max(shake, 22);
    hitPause = Math.max(hitPause, 10);
    // Spawn a slow expanding wave projectile
    projectiles.push({
      x: f.x, y: 500 + FLOOR_PROJ_DY,
      vx: 0,
      owner: f, life: 70,
      color: '#a855f7', power: 22, size: 120, kind: 'void'
    });
    // Direct damage if close
    if (dist < 360 && other.iframes <= 0 && !other.block) {
      playSfxKick(0.26);
      other.health = Math.max(0, other.health - 18);
      other.action = 'hurt';
      other.lock = 26;
      other.flash = 14;
    }
    registerComboHit(f);
    return;
  }

  playSfxWhoosh(0.065);
  playSfxKiai(0.20);
  if (dist < 520 && other.iframes <= 0) {
    if (other.parry > 0) {
      // Big parry punish
      other.parry = 0;
      playSfxParry(0.2);
      resetCombo(f);
      f.action = 'hurt'; f.lock = 60;
      f.health = Math.max(0, f.health - 30);
      f.flash = 18;
      hitPause = 14; shake = 22;
      spark(f.x, f.y - 120, '#ffeb70', 24);
    } else if (other.block) {
      resetCombo(f);
      playSfxBlock(0.1);
      other.health = Math.max(0, other.health - 12);
      shake = 12;
    } else {
      playSfxKick(0.3); playSfxBoneCrack(0.26);
      other.health = Math.max(0, other.health - 35);
      other.action = 'hurt';
      other.lock = 22;
      other.flash = 14;
      hitPause = 12;
      shake = 22;
      spark(other.x, other.y - 120, characters[f.char].color, 22);
      if (playerScoresFor(f)) addScore(500);
      registerComboHit(f);
    }
  } else {
    resetCombo(f);
  }
  msg = characters[f.char].super.toUpperCase() + '!';
  setTimeout(() => msg = '', 900);
}

// --- Player input -----------------------------------------------------------
function controls() {
  const p1InFlip = inAirFlip(p1);
  if (!p1InFlip) { p1.vx = 0; p1.block = false; } else p1.block = false;
  // P1: WASD always. Arrows also when P2 is AI (single-player) — in local Versus, arrows are reserved for P2.
  const a = keys.a || (!p2IsHuman && keys['arrowleft']);
  const d = keys.d || (!p2IsHuman && keys['arrowright']);
  const w = keys.w || (!p2IsHuman && keys['arrowup']);
  const s = keys.s || (!p2IsHuman && keys['arrowdown']);
  if (!p1InFlip) {
    if (a) p1.vx = -5;
    if (d) p1.vx = 5;
  }
  if (w && p1.y >= FLOOR_FIGHT_Y) p1.vy = -16;
  if (s) p1.block = true;
  if (p1.y < FLOOR_FIGHT_Y - 2) {
    if (keys['q']) { tryStartAirFlip(p1, false); keys['q'] = false; } // back flip
    if (keys['e']) { tryStartAirFlip(p1, true); keys['e'] = false; }  // front flip
  }

  const moves = {
    j: ['jab', 5, 95], u: ['cross', 7, 105], i: ['uppercut', 9, 100], o: ['hook', 10, 110], p: ['palm', 12, 125],
    k: ['front kick', 7, 135], h: ['round kick', 9, 150], y: ['jump kick', 10, 145], l: ['low kick', 6, 130], n: ['spin kick', 13, 165],
    ';': ['flick kick', 5, 115], r: ['crescent kick', 8, 140], v: ['side kick', 8, 155], b: ['back kick', 7, 150],
    m: ['push kick', 6, 128], g: ['axe kick', 9, 125]
  };
  for (const k in moves) {
    if (keys[k]) {
      const m = moves[k];
      attack(p1, m[0], m[1], m[2]);
      keys[k] = false;
    }
  }
  if (keys[' ']) { special(p1); keys[' '] = false; }
  if (keys.shift) { superMove(p1); keys.shift = false; }

  if (p1.lock > 0.01 && !p1InFlip) p1.vx = 0;
}

// P2 (local): arrows move/jump/block, 1-0 attacks, - = special, = = super
function controlsP2() {
  const p2InFlip = inAirFlip(p2);
  if (!p2InFlip) { p2.vx = 0; p2.block = false; } else p2.block = false;
  if (!p2InFlip) {
    if (keys['arrowleft']) p2.vx = -5;
    if (keys['arrowright']) p2.vx = 5;
  }
  if (keys['arrowup'] && p2.y >= FLOOR_FIGHT_Y) p2.vy = -16;
  if (keys['arrowdown']) p2.block = true;
  if (p2.y < FLOOR_FIGHT_Y - 2) {
    if (keys['z']) { tryStartAirFlip(p2, false); keys['z'] = false; } // back
    if (keys['c']) { tryStartAirFlip(p2, true); keys['c'] = false; }  // front
  }
  const p2m = {
    '1': ['jab', 5, 95], '2': ['cross', 7, 105], '3': ['uppercut', 9, 100], '4': ['hook', 10, 110], '5': ['palm', 12, 125],
    '6': ['front kick', 7, 135], '7': ['round kick', 9, 150], '8': ['jump kick', 10, 145], '9': ['low kick', 6, 130], '0': ['spin kick', 13, 165],
    ',': ['flick kick', 5, 115], '.': ['crescent kick', 8, 140], '/': ['side kick', 8, 155], "'": ['back kick', 7, 150],
    '[': ['push kick', 6, 128], ']': ['axe kick', 9, 125]
  };
  for (const k in p2m) {
    if (keys[k]) {
      const a = p2m[k];
      attack(p2, a[0], a[1], a[2]);
      keys[k] = false;
    }
  }
  if (keys['-']) { special(p2); keys['-'] = false; }
  if (keys['=']) { superMove(p2); keys['='] = false; }
  if (p2.lock > 0.01 && !p2InFlip) p2.vx = 0;
}

// --- AI ---------------------------------------------------------------------
// Tracks short history of player action to react to whiffs.
let aiState = { lastPlayerAction: 'idle', whiffWindow: 0 };

function isPlayerAttacking() {
  const a = p1.action;
  return p1.lock > 0.02 && a !== 'idle' && a !== 'walk' && a !== 'hurt' && a !== 'block' && a !== 'frontflip' && a !== 'backflip' && a !== 'jump';
}

function ai() {
  if (p2IsHuman) return;
  if (playMode === 'training') {
    p2.vx = 0;
    p2.block = false;
    p2.meter = Math.min(100, p2.meter + 0.2);
    return;
  }
  // Track whiff: player just finished an attack without landing
  if (isPlayerAttacking()) {
    aiState.lastPlayerAction = p1.action;
    aiState.whiffWindow = 0;
  } else if (aiState.lastPlayerAction !== 'idle' && p1.lock <= 0.01) {
    // Just exited an attack — opens punish window briefly
    aiState.whiffWindow = 18;
    aiState.lastPlayerAction = 'idle';
  }
  if (aiState.whiffWindow > 0) aiState.whiffWindow = Math.max(0, aiState.whiffWindow - gameFrameScale);

  const d = p1.x - p2.x;
  const ad = Math.abs(d);
  const dir = Math.sign(d) || 1;
  p2.vx = 0;
  p2.block = false;

  if (p2.lock > 0.01) return;

  // Block commit: once AI decides to block, hold it for N frames
  if (p2.blockTimer > 0) {
    p2.block = true;
    p2.blockTimer = Math.max(0, p2.blockTimer - gameFrameScale);
    return;
  }

  if (p2.actionCooldown > 0) {
    p2.actionCooldown = Math.max(0, p2.actionCooldown - gameFrameScale);
    // still allow movement during cooldown so AI doesn't freeze in place
    const mv = difficulty().moveScalar;
    if (ad > 165) p2.vx = dir * (3.5 * mv);
    else if (ad < 95) p2.vx = -dir * (2 * mv);
    return;
  }

  // Difficulty scales 0.30 (1st opp) → 0.85 (final boss) then adjusted by mode.
  const base = Math.min(0.85, 0.30 + tournamentWins * 0.15);
  const mode = difficulty();
  let diff = Math.min(0.95, Math.max(0.18, base * mode.aiScalar));
  let mv = mode.moveScalar;

  // Boss tuning: always tougher, and ramps up by phase.
  if (p2.char === BOSS_INDEX) {
    const phaseMul = (p2.phase === 3) ? 1.45 : (p2.phase === 2) ? 1.25 : 1.1;
    diff = Math.min(0.99, diff * phaseMul);
    mv = mv * (p2.phase === 3 ? 1.18 : p2.phase === 2 ? 1.10 : 1.05);
  }

  // REIGEN special boss behavior: choose from a 50-move kit
  if (p2.char === BOSS_INDEX) {
    const other = p1;
    const dist = Math.abs(p2.x - other.x);
    const inRange = dist < 210;

    // Phase 3: frequent ultimates / pressure
    if (p2.phase === 3 && p2.meter >= 100 && Math.random() < diff * 0.08) {
      bossUseMove(p2, 47); // Void Destruction (super)
      p2.actionCooldown = 26;
      return;
    }

    // Defensive reads
    if (isPlayerAttacking() && dist < 210 && Math.random() < diff * 0.22) {
      bossUseMove(p2, p2.phase >= 3 ? 42 : 41); // void parry / counter
      p2.actionCooldown = 10;
      return;
    }

    // Whiff punish
    if (aiState.whiffWindow > 0 && dist < 260 && Math.random() < diff * 0.25) {
      bossUseMove(p2, p2.phase >= 3 ? 24 : 22); // void strike / dark slash
      p2.actionCooldown = 12;
      return;
    }

    // Projectile zoning when far
    if (dist > 260 && Math.random() < diff * 0.20) {
      const projPool = p2.phase >= 3 ? [29, 30, 26] : (p2.phase === 2 ? [27, 28, 26] : [26]);
      bossUseMove(p2, projPool[Math.floor(Math.random() * projPool.length)]);
      p2.actionCooldown = 14;
      return;
    }

    // Dash/teleport closes distance
    if (dist > 320 && Math.random() < diff * 0.18) {
      const mobility = p2.phase >= 3 ? [21, 39, 45] : (p2.phase === 2 ? [21, 39] : [21]);
      bossUseMove(p2, mobility[Math.floor(Math.random() * mobility.length)]);
      p2.actionCooldown = 10;
      return;
    }

    // In-range: pick a strike or combo by phase
    if (inRange && Math.random() < diff * 0.42) {
      const pool =
        p2.phase === 1 ? [1, 2, 3, 4, 5, 6, 11, 13, 16] :
        p2.phase === 2 ? [6, 7, 8, 10, 15, 17, 19, 20, 22, 23, 34] :
                         [18, 20, 24, 25, 31, 33, 35, 40, 49, 50];
      bossUseMove(p2, pool[Math.floor(Math.random() * pool.length)]);
      p2.actionCooldown = 8;
      return;
    }
  }

  // 1) Anti-air: player jumping in
  if (p1.y < 470 && ad < 240 && Math.random() < diff * 0.18) {
    if (p2.y >= FLOOR_FIGHT_Y) p2.vy = -13;
    attack(p2, 'jump kick', 10, 200);
    p2.actionCooldown = 6;
    return;
  }

  // 2) Block when player is attacking close — commit so we don't reroll every frame
  if (isPlayerAttacking() && ad < 180 && p2.actionCooldown <= 0 && Math.random() < diff * 0.16) {
    p2.block = true;
    p2.blockTimer = 10 + Math.floor(diff * 8); // slightly shorter
    return;
  }

  // 3) Punish whiff window — burst in with a heavy (one-shot)
  if (aiState.whiffWindow > 0 && ad < 220 && Math.random() < diff * 0.12) {
    if (ad > 140) p2.vx = dir * (4.5 * mv);
    else { attack(p2, 'spin kick', 13, 165); aiState.whiffWindow = 0; }
    p2.actionCooldown = 8;
    return;
  }

  // 4) Spacing: keep around 130 px
  if (ad > 165) {
    p2.vx = dir * (3.5 * mv);
  } else if (ad < 95) {
    p2.vx = -dir * (2 * mv);
  } else {
    // 5) In-range: choose between super, special, normal
    if (p2.meter >= 100 && Math.random() < diff * 0.025) {
      superMove(p2);
      p2.actionCooldown = 20;
    } else if (p2.meter >= 25 && Math.random() < diff * 0.02) {
      special(p2);
      p2.actionCooldown = 14;
    } else if (Math.random() < diff * 0.035) {
      const moves = [
        ['jab', 5, 95], ['cross', 7, 105], ['hook', 10, 110],
        ['front kick', 7, 135], ['round kick', 9, 150], ['palm', 12, 125]
      ];
      const m = moves[Math.floor(Math.random() * moves.length)];
      attack(p2, m[0], m[1], m[2]);
      p2.actionCooldown = 6;
    } else if (Math.random() < diff * 0.015) {
      // Occasional pre-emptive block in case player swings
      p2.block = true;
      p2.blockTimer = 8;
    }
  }
}

// --- Physics ----------------------------------------------------------------
function physics(f, s) {
  const sc = (s > 0 && s < 4) ? s : 1;
  f.x += f.vx * sc;
  f.y += f.vy * sc;
  f.vy += 0.8 * sc;
  if (f.y > FLOOR_FIGHT_Y) { f.y = FLOOR_FIGHT_Y; f.vy = 0; f.airDashUsed = false; f.airFlipUsed = false; }
  f.x = Math.max(80, Math.min(1100, f.x));
  if (f.action === 'frontflip' || f.action === 'backflip') f.vx *= Math.pow(0.985, sc);

  if (f.lock > 0.01) f.lock = Math.max(0, f.lock - sc);
  if (f.lock < 0.01) f.lock = 0;
  if (f.lock <= 0) {
    if ((f.char | 0) === 0 || (f.char | 0) === 1 || (f.char | 0) === 2 || (f.char | 0) === 3 || (f.char | 0) === 4) f._tkw = null;
    if (f.y < FLOOR_FIGHT_Y - 2) {
      f.action = 'jump';
    } else if (f.block) {
      f.action = Math.abs(f.vx) > 0.12 ? 'walk' : 'block';
    } else {
      f.action = Math.abs(f.vx) > 0.12 ? 'walk' : 'idle';
    }
  }

  if (f._prevA !== f.action) {
    f.animT = 0;
    f._prevA = f.action;
  }
  f.animT = (f.animT || 0) + 0.18 * sc;
  f.frame = f.animT % 8;

  if (f.flash > 0) f.flash = Math.max(0, f.flash - sc);
  if (f.iframes > 0) f.iframes = Math.max(0, f.iframes - sc);
  if (f.parry > 0) f.parry = Math.max(0, f.parry - sc);

  // Combo window decay
  if (f.comboTimer > 0) f.comboTimer = Math.max(0, f.comboTimer - sc);
  else if (f.comboHits > 0) resetCombo(f);
  if (f.comboPop > 0) f.comboPop = Math.max(0, f.comboPop - sc);
  if (f.comboTimer < 0.01) f.comboTimer = 0;

  runEvents(f, sc);

  // Always face the opponent: sprite art is a side view, mirrored when this fighter
  // is to the right of the other. (Old lock-gated update froze facing during jabs.)
  const opp = f === p1 ? p2 : p1;
  if (opp) f.flip = f.x > opp.x;
}

// Keep the two fighters from overlapping. Called once per frame after physics.
function separate() {
  // Tightest melee uses attack(..., jab) range 95: minDist here MUST be < 95 or nothing ever lands.
  // Keep this in *world pixels* (not render scale), since hit logic uses f.x distances.
  const minDist = 84;
  const d = p2.x - p1.x;
  const ad = Math.abs(d);
  if (ad < minDist) {
    const push = (minDist - ad) / 2;
    const dir = Math.sign(d) || 1;
    // Don't push during teleport/dash i-frames so those moves still feel snappy
    if (p1.iframes <= 0 && p2.iframes <= 0) {
      p1.x = Math.max(80, Math.min(1100, p1.x - dir * push));
      p2.x = Math.max(80, Math.min(1100, p2.x + dir * push));
    }
  }
}

function update() {
  if (state !== 'fight') return;
  const tNow = performance.now();
  if (update._tLast == null) update._tLast = tNow;
  const dMs = Math.min(48, Math.max(0, tNow - update._tLast));
  update._tLast = tNow;
  gameFrameScale = Math.min(2.5, Math.max(0.2, dMs / (1000 / 60)));

  if (hitPause > 0) {
    hitPause = Math.max(0, hitPause - gameFrameScale);
    return;
  }
  blurFightInputStealer();

  controls();
  if (p2IsHuman) controlsP2();
  else ai();
  const g = gameFrameScale;
  physics(p1, g);
  physics(p2, g);
  separate();

  // Boss phase + regen
  if (p2 && p2.char === BOSS_INDEX) {
    const m = p2.maxHealth || 140;
    const hpPct = p2.health / m;
    p2.phase = hpPct > 0.70 ? 1 : (hpPct > 0.30 ? 2 : 3);
    p2.health = Math.min(m, p2.health + (p2.phase === 3 ? 0.022 : 0.012) * g); // reduced regen
    // boss builds meter faster
    p2.meter = Math.min(100, p2.meter + 0.08 * g);
  }

  // Update projectiles
  projectiles.forEach(pr => {
    pr.x += pr.vx * g;
    pr.life -= g;
    const other = pr.owner === p1 ? p2 : p1;
    const dist = Math.abs(pr.x - other.x);
    const yOk = Math.abs(pr.y - other.y) < 130;
    if (dist < 55 && yOk) {
      if (other.iframes > 0) { /* whiff */ }
      else if (other.parry > 0) {
        // Reflect — turn it around
        playSfxParry(0.1);
        pr.vx = -pr.vx;
        pr.owner = other;
        pr.comboApplied = false;
        other.parry = 0;
        other.meter = Math.min(100, other.meter + 25);
        spark(pr.x, pr.y, '#ffeb70', 10);
      } else if (other.block) {
        resetCombo(pr.owner);
        playSfxBlock(0.075);
        other.health = Math.max(0, other.health - Math.ceil(pr.power * 0.25));
        spark(pr.x, pr.y, '#dddddd', 6);
        pr.life = 0;
      } else {
        const firstDamage = !pr.comboApplied;
        if (firstDamage) {
          if (pr.kind === 'frost' || pr.kind === 'palm' || pr.kind === 'void') {
            (pr.kind === 'frost' || (pr.size | 0) > 50 ? playSfxKick : playSfxPunch)(0.1);
          } else playSfxPunch(0.11);
        }
        other.health = Math.max(0, other.health - pr.power);
        other.action = 'hurt';
        other.lock = 14;
        other.flash = 6;
        if (!pr.comboApplied) {
          registerComboHit(pr.owner);
          pr.comboApplied = true;
        }
        if (pr.kind !== 'frost') pr.life = 0; // frost lingers and can multi-hit
        else pr.life = Math.max(pr.life - 30, 0); // costs duration on hit
        if (firstDamage && playerScoresFor(pr.owner)) addScore(150);
        hitPause = Math.max(hitPause, 4);
        shake = Math.max(shake, 8);
        spark(pr.x, pr.y, pr.color, 10);
      }
    }
  });
  projectiles = projectiles.filter(p => p.life > 0.01 && p.x > -100 && p.x < 1380);

  // Update sparks
  for (let i = sparks.length - 1; i >= 0; i--) {
    const s = sparks[i];
    s.x += s.vx * g; s.y += s.vy * g;
    s.vy += s.gravity * g;
    s.life -= g;
    if (s.life <= 0) sparks.splice(i, 1);
  }

  // Decay shake
  if (shake > 0) shake = Math.max(0, shake - 0.8 * g);

  // Round end (true double KO: both out of health same frame — draw goes to CPU)
  if (p1.health <= 0 || p2.health <= 0) {
    if (playMode === 'training' && p1 && p2) {
      p1.health = p1.maxHealth != null ? p1.maxHealth : 100;
      p2.health = p2.maxHealth != null ? p2.maxHealth : 100;
      p1.x = 260; p2.x = 860; p1.vx = p2.vx = p1.vy = p2.vy = 0;
      p1.action = p2.action = 'idle'; p1.lock = p2.lock = 0;
      p1.airFlipUsed = p2.airFlipUsed = false;
      projectiles = [];
      msg = 'DUMMY  —  reset';
      setTimeout(() => (msg = ''), 1000);
      return;
    }
    if (p1.health <= 0 && p2.health <= 0) {
      state = 'roundover';
      shake = 0; camera.x = camera.y = 0; // no decay while state !== 'fight' — else roundOver drawFight wobbles
      if (Math.random() < 0.5) {
        p1wins++;
        msg = 'DOUBLE KO — ' + characters[p1.char].name + ' WINS ROUND';
      } else {
        p2wins++;
        msg = 'DOUBLE KO — ' + characters[p2.char].name + ' WINS ROUND';
      }
    } else if (p2.health <= 0) {
      p1wins++;
      state = 'roundover';
      shake = 0; camera.x = camera.y = 0;
      msg = characters[p1.char].name + ' WINS ROUND';
      addScore(1000);
    } else {
      p2wins++;
      state = 'roundover';
      shake = 0; camera.x = camera.y = 0;
      msg = characters[p2.char].name + ' WINS ROUND';
      if (p2IsHuman) addScore(1000);
    }
  }
}

// --- Rendering --------------------------------------------------------------
function drawStage() {
  const ox = -120, oy = -120, ow = 1520, oh = 960;
  const i = Math.max(0, Math.min(4, stageIndex | 0));
  if (stageStrip && stageStrip.complete && stageStrip.naturalWidth > 0) {
    const srcW = stageStrip.naturalWidth;
    const srcH = stageStrip.naturalHeight;
    const n = 5;
    const step = srcH / n;
    const sy = i * step;
    const sh = (i < n - 1) ? step : (srcH - sy);

    

    if (USE_GAMEPLAY_STAGE_IMAGE) {
      const pEn = ctx.imageSmoothingEnabled;
      const pQ = ctx.imageSmoothingQuality;
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      if ('imageSmoothingQuality' in ctx) ctx.imageSmoothingQuality = 'high';
      if ('filter' in ctx) ctx.filter = 'brightness(1.4) contrast(1.2) saturate(1.5)';
      drawImageSliceCover(stageStrip, 0, sy, srcW, sh, 0, 0, 1280, 720);
      if ('filter' in ctx) ctx.filter = 'none';
      ctx.restore();
      ctx.imageSmoothingEnabled = pEn;
      if ('imageSmoothingQuality' in ctx) ctx.imageSmoothingQuality = pQ;
    }
    ctx.imageSmoothingEnabled = false;
    if ('imageSmoothingQuality' in ctx) ctx.imageSmoothingQuality = 'low';

    

    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_DRAW_Y); ctx.lineTo(1280, GROUND_DRAW_Y);
    ctx.stroke();
  } else {
    ctx.fillStyle = '#020202';
    ctx.fillRect(ox, oy, ow, oh);
    drawText('武',  180, 260, 150, '#171717', 'center');
    drawText('士', 1080, 270, 150, '#171717', 'center');
    drawText('道',  640, 390, 220, '#141414', 'center');
    ctx.strokeStyle = '#202020';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_DRAW_Y); ctx.lineTo(1280, GROUND_DRAW_Y);
    ctx.stroke();
  }
}

function drawBars() {
  function bar(x, y, w, h, val, col, name, wins, maxHp) {
    const mh = maxHp > 0 ? maxHp : 100;
    const ratio = Math.max(0, Math.min(1, val / mh));
    const low = mh * 0.35;
    ctx.strokeStyle = '#fff'; ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = '#333'; ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
    ctx.fillStyle = val > low ? '#6ee14e' : '#e13a3a';
    ctx.fillRect(x + 2, y + 2, (w - 4) * ratio, h - 4);
    drawText(name, x, y - 10, 22, col);
    drawText('Wins: ' + wins, x + w - 85, y - 10, 18, 'white');
  }
  bar(50, 45, 430, 28, p1.health, characters[p1.char].color, characters[p1.char].name, p1wins, p1.maxHealth || 100);
  bar(800, 45, 430, 28, p2.health, characters[p2.char].color, characters[p2.char].name, p2wins, p2.maxHealth || 100);
  drawText('ROUND ' + round + '  BEST OF 3', 640, 70, 30, 'white', 'center');
  drawText('SCORE ' + Math.floor(score), 640, 105, 24, '#ffd65a', 'center');
  if (playMode === 'training') {
    drawText('Kaden P1: J–P punches · K–N kicks · R V B G M ; Taekwondo  ·  E/Q flips  ·  KO resets dummy', 640, 128, 14, '#9cf0c2', 'center');
  } else if (playMode === 'versus') {
    drawText('VERSUS  ·  P1: A/D, W, S, J–P & K–N & R V B G M ;  ·  P2: Arrows, 0-9, , . /  \' [ ]  ·  Z/C flips  ·  - =', 640, 125, 12, '#ffccaa', 'center');
  } else {
    drawText('Tournament: ' + Math.min(tournamentWins + 1, 4) + '/4', 640, 130, 18, '#aaa', 'center');
  }
  if (state === 'fight' && stages[stageIndex]) {
    /* system-ui: Impact at small size can make "J" look like "T" in "DOJO" */
    drawText(stages[stageIndex].name, 640, 160, 18, 'rgba(255,255,255,0.75)', 'center', 'system-ui, "Segoe UI", "Helvetica Neue", sans-serif');
  }
  meter(50, 88, 300, p1.meter, characters[p1.char].color);
  meter(930, 88, 300, p2.meter, characters[p2.char].color);

  // Combo counter is drawn in-world HUD area (see drawCombos)
}

function drawCombos() {
  if (!p1 || !p2) return;

  function drawComboFor(attacker, defender) {
    if (attacker.comboHits < 2 || attacker.comboTimer < 0.05) return;
    const isLeft = attacker === p1;

    // Position near the defender (Street Fighter-style callout)
    const x = Math.max(140, Math.min(1140, defender.x + (isLeft ? 120 : -120)));
    const y = 250;

    const pop = attacker.comboPop / 14;
    const scale = 1 + pop * 0.18;
    const alpha = Math.min(1, attacker.comboTimer / 10);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    ctx.textAlign = 'center';
    ctx.font = '44px Impact, Arial Black';

    // Glow
    ctx.shadowColor = isLeft ? '#ffd65a' : '#ff6666';
    ctx.shadowBlur = 18 * pop + 8;
    // Outline
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.strokeText(attacker.comboHits + ' HIT', 0, 0);
    ctx.shadowBlur = 0;

    // Fill
    ctx.fillStyle = isLeft ? '#ffd65a' : '#ff8888';
    ctx.fillText(attacker.comboHits + ' HIT', 0, 0);

    ctx.font = '26px Impact, Arial Black';
    ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    ctx.lineWidth = 5;
    ctx.strokeText('COMBO', 0, 34);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('COMBO', 0, 34);

    ctx.restore();
  }

  drawComboFor(p1, p2);
  drawComboFor(p2, p1);
}

function meter(x, y, w, val, col) {
  ctx.strokeStyle = '#888';
  ctx.strokeRect(x, y, w, 14);
  ctx.fillStyle = col;
  ctx.fillRect(x + 2, y + 2, (w - 4) * val / 100, 10);
  if (val >= 100) {
    ctx.save();
    ctx.fillStyle = '#fff';
    ctx.font = '11px Impact';
    ctx.textAlign = 'left';
    ctx.fillText('SUPER READY', x + 4, y + 12);
    ctx.restore();
  }
}

/**
 * ASTRA row1 (strikes) for kicks / specials. Punches: use **row0 idle (0,0)** for melee
 * so we never show rival-sheet col0/1, which the anim compositor fills from the same
 * mid-strip frame (often a kick) for both jab and cross (see `generate_astra_rival_sheets.py`).
 * Hand-tuned Kaden astra can use row1 in a future per-slot override.
 */
function astraStrikeCellForAction(a) {
  if (isPunchTypeMelee(a)) return { col: 0, row: 0 };
  if (a === 'flick kick' || a === 'front kick' || a === 'low kick' || a === 'push kick') return { col: 2, row: 1 };
  if (a === 'round kick' || a === 'spin kick' || a === 'crescent kick' || a === 'back kick') return { col: 3, row: 1 };
  if (a === 'axe kick' || a === 'side kick') return { col: 2, row: 1 };
  if (a === 'jump kick') return { col: 4, row: 0 };
  if (a && a.indexOf('kick') >= 0) return { col: 2, row: 1 };
  return { col: 0, row: 0 };
}
/**
 * ASTRA sheet (Sprite Lab export): 1376×768, 2 rows × 5 cols.
 * Row0: idle, idle2, walk1, walk2, jump — Row1: jab, cross, kick, special, super
 * Melee: wind-up (idle) → impact cell → return (idle) using lock so limbs don’t need multi-frame art.
 */
function getAstraFighterSheetClip(f) {
  const a = f.action || 'idle';
  // One stable strike cell for the whole attack lock. Wind/hit/return phases cycled f.lock
  // across 15/5 boundaries and flashed 3 very different 275×384 cells (visible “glitching”).
  if (f.lock > 0.01 && a !== 'frontflip' && a !== 'backflip' && a !== 'special' && a !== 'special-strike' && a !== 'super' && a !== 'victory') {
    if (isPunchTypeMelee(a) || isKickTypeMelee(a)) {
      const st = astraStrikeCellForAction(a);
      const cell = astraCell(st.col, st.row);
      return { astra: true, sx: cell.sx, sy: cell.sy, sw: cell.sw, sh: cell.sh, anim: a, label: a + ':m', frame: Math.floor(f.frame) };
    }
  }
  let col = 0, row = 0, label = a;
  // Idle: alternate idle1 (col0) / idle2 (col1) so the fighter visibly breathes.
  // Slowed by /4 so the sway reads as breathing, not jitter.
  if (a === 'frontflip' || a === 'backflip' || a === 'idle') {
    const ph = Math.floor(f.frame / 4) % 2;
    col = ph; row = 0; label = 'idle:' + ph;
  }
  else if (a === 'walk') {
    const ph = Math.floor(f.frame) % 2;
    col = 2 + ph; row = 0; label = 'walk:' + ph;
  }
  else if (a === 'jump') { col = 4; row = 0; }
  // Block: subtle guard sway alternating idle/idle2 cells (sheet has no dedicated guard cell).
  else if (a === 'block' || a === 'crouch') {
    const ph = Math.floor(f.frame / 5) % 2;
    col = ph; row = 0; label = 'guard:' + ph;
  }
  // Hurt: keep the dedicated hurt cell but tag the cache key per-frame so the flash/recoil flicker reads as motion.
  else if (a === 'hurt' || a === 'knockdown') {
    const ph = Math.floor(f.frame / 2) % 2;
    col = 1; row = 1; label = 'hurt:' + ph;
  }
  // Super/victory: pulse cache key so chroma cache invalidates and the ASTRA strike pose visibly settles.
  else if (a === 'super' || a === 'victory') {
    const ph = Math.floor(f.frame / 3) % 2;
    col = 4; row = 1; label = 'super:' + ph;
  }
  else if (a === 'special' || a === 'special-strike') {
    const ph = Math.floor(f.frame / 3) % 2;
    col = 3; row = 1; label = 'special:' + ph;
  }
  else if (isPunchTypeMelee(a)) { col = 0; row = 0; }
  else if (a === 'axe kick' || a === 'side kick') { col = 2; row = 1; }
  else if (a === 'flick kick' || a === 'front kick' || a === 'low kick' || a === 'push kick') { col = 2; row = 1; }
  else if (a === 'round kick' || a === 'spin kick' || a === 'crescent kick' || a === 'back kick') { col = 3; row = 1; }
  else if (a === 'jump kick') { col = 4; row = 0; label = a; }
  else if (a && a.indexOf('kick') >= 0) { col = 2; row = 1; }
  else { col = 0; row = 0; }
  const cell = astraCell(col, row);
  return { astra: true, sx: cell.sx, sy: cell.sy, sw: cell.sw, sh: cell.sh, anim: a, label, frame: Math.floor(f.frame) };
}

/**
 * Source rectangles: `reigen_classic_row.png` (boss only) — one row, y0+label strip. Roster 0–4 use ASTRA.
 * third value = source width (px); source height = min(90, available row h) in draw, same as legacy.
 */
function getFighterSheetClip(f) {
  if (f && f.char != null && charHasAstraSheet(f.char | 0)) return getAstraFighterSheetClip(f);
  const t = SHEET_CELL_TOP;
  const a = f.action || 'idle';
  let ix, ry, sw, label = a;

  if (a === 'frontflip' || a === 'backflip' || a === 'idle') { ix = 364; ry = t; sw = 42; }
  else if (a === 'walk') {
    const phase = Math.floor(f.frame) % 2;
    ix = 460 + phase * 48; ry = t; sw = 44; label = 'walk:' + phase;
  }
  else if (a === 'jump') { ix = 508; ry = t; sw = 44; } // walk frame 1 reads as airborne
  else if (a === 'block' || a === 'crouch') { ix = 628; ry = t; sw = 58; }
  else if (a === 'hurt' || a === 'knockdown') { ix = 520; ry = 80; sw = 72; }
  else if (a === 'special' || a === 'special-strike') { ix = 780; ry = 90 + t; sw = 118; }
  else if (a === 'super' || a === 'victory') { ix = 980; ry = 90 + t; sw = 135; }
  else if (a && a.includes && a.includes('kick')) { ix = 1032; ry = t; sw = 58; }
  else if (a === 'jab' || a === 'cross') { ix = 520; ry = 80; sw = 72; } // lean-in punch (hurt frame)
  else { ix = 780; ry = 90 + t; sw = 118; } // hook/palm: extended-reach special pose

  if (ix + sw > 1200) console.warn('[KadenFighters] sheet clip OOB: ' + a, ix, sw);
  return {
    ix: Math.floor(ix), yOff: Math.floor(ry), sw: Math.floor(sw),
    anim: a, label, frame: Math.floor(f.frame)
  };
}

function isPunchTypeMelee(a) {
  if (!a || typeof a !== 'string') return false;
  return a === 'jab' || a === 'cross' || a === 'uppercut' || a === 'hook' || a === 'palm';
}
function isKickTypeMelee(a) {
  if (!a || typeof a !== 'string') return false;
  return a.indexOf('kick') >= 0;
}
/**
 * One art frame per normal attack: use lock timing for wind-up / impact / return so punches & kicks
 * read as body motion (lunge, lift, slight lean) even without multi-frame spritework.
 */
function applyStrikeBodyMotion(ctx, f) {
  if (!f || f.lock < TKW_LOCK_MIN) return;
  // Full ASTRA cells already show a wind-up / strike pose; extra translate+rotate reads as a sliding “card”.
  if (f.char != null && charHasAstraSheet(f.char | 0)) return;
  const a = f.action;
  if (typeof a !== 'string') return;
  if (a === 'frontflip' || a === 'backflip' || a === 'super' || a === 'victory' || a === 'hurt' || a === 'knockdown' || a === 'special' || a === 'special-strike') return;
  if (!isPunchTypeMelee(a) && !isKickTypeMelee(a)) return;
  const lock0 = 24;
  const t = Math.max(0, Math.min(1, (lock0 - f.lock) / lock0));
  const s = Math.sin(t * Math.PI);
  if (s < 0.003) return;
  const wz = f.flip ? -1 : 1;
  const sc0 = (typeof FIGHTER_FX !== 'undefined' ? FIGHTER_FX : 1) * 1.05;
  if (isKickTypeMelee(a)) {
    ctx.translate(wz * s * 7.5 * sc0, -s * 6 * sc0);
    ctx.rotate(wz * s * 0.08);
  } else {
    ctx.translate(wz * s * 10 * sc0, -s * 3 * sc0);
    ctx.rotate(wz * s * 0.1);
  }
}

function drawFighter(f) {
  const y0 = sheetRowTop(f.char);
  const hrow = sheetRowHeight(f.char);
  // When ASTRA is loaded, use the same grid as character select (getFighterSheetClip + astra_*.png).
  // Sticky `charHasAstraSheet` avoids flipping to FTKW strips when the Image briefly retries / decode races.
  const useFtk = fightTkwUseInFight(f) && (state === 'fight' || state === 'roundover') && !charHasAstraSheet(f.char | 0);
  let kadenPort = f.char === 0 && useKadenPortraitForAction() && kadenGameplay.complete && kadenGameplay.naturalWidth > 0 && !useFtk;
  /** Single key for this draw’s sheet chroma (must match between bake + blit; avoids subtle key-string drift). */
  let chromaKeyForDraw = '';
  let csw = 0, csh = 0, sh, sw0, sx0, sy0, cl, dw, dh, dx0, dy0, wSrc, hSrc;
  let srcImg = sheet;
  if (kadenPort) {
    bakeKadenPortraitChromaOnce();
    csw = _kadenBaked.width | 0;
    csh = _kadenBaked.height | 0;
    if (csh < 2) kadenPort = false;
  }
  if (kadenPort) {
    wSrc = csw; hSrc = csh; sh = csh; sw0 = csw; sx0 = 0; sy0 = 0;
    cl = { anim: f.action, label: f.action, frame: Math.floor(f.frame) };
    const walkSway = f.action === 'walk' ? ((Math.floor(f.frame) % 2) * 2 - 1) : 0;
    dh = Math.round(KADEN_TARGET_ROW_REF * SPRITE_SCALE * FIGHTER_DRAW_SCALE);
    dw = (csw * dh / csh) | 0;
    dx0 = (Math.round(-dw * 0.5) + walkSway) | 0;
    dy0 = (-dh) | 0;
  } else {
    if (useFtk) {
      const r = tkwSrcForDraw(f);
      // Use classic black-key chroma (keySheetChroma*), not ASTRA edge-flood — flood wipes taekwondo/wushu strips
      // and only leaves bright title fragments from the sheet PNG.
      cl = {
        astra: false,
        ftkw: true,
        sx: r.sx, sy: r.sy, sw: r.sw, sh: r.sh,
        anim: f.action,
        label: 'ktw:' + r.sx + ',' + r.sy + ',' + r.sw + ',' + r.sh,
        frame: tkwBaseFrame(f)
      };
      srcImg = fightTkwImageForChar(f.char | 0);
      sh = r.sh; sx0 = r.sx; sy0 = r.sy; sw0 = r.sw;
    } else {
      cl = getFighterSheetClip(f);
      srcImg = (cl && cl.astra && charHasAstraSheet(f.char | 0)) ? (astraSheetForChar(f.char | 0) || sheet) : sheet;
      if (cl.astra) {
        sh = Math.max(1, cl.sh | 0);
        sx0 = cl.sx | 0;
        sy0 = cl.sy | 0;
        sw0 = Math.max(1, cl.sw | 0);
      } else {
        const syF = y0 + cl.yOff;
        const maxH = (y0 + hrow) - syF;
        sh = Math.max(1, Math.min(90, hrow - cl.yOff, maxH) | 0);
        sx0 = cl.ix;
        sy0 = (syF | 0);
        sw0 = Math.max(1, cl.sw | 0);
      }
    }
    // Chroma-key each frame: removes dark background box for SF6-style clean sprites
    // Important: cache key must include per-frame variants (e.g. walk:0 vs walk:1),
    // otherwise the wrong frame can be reused and the animation looks broken.
    const _chromaPfx = (cl && cl.astra) ? 'a4:' : ((cl && cl.ftkw) ? 'fS:' : '');
    const _ck = f.char + ':' + _chromaPfx + String(cl.label != null ? cl.label : (cl.anim != null ? cl.anim : f.action));
    chromaKeyForDraw = _ck;
    if (!_chromaCache.has(_ck)) {
      if (_chromaCache.size >= _CHROMA_CACHE_MAX) _chromaCache.delete(_chromaCache.keys().next().value);
      const _cc = document.createElement('canvas');
      _cc.width = sw0; _cc.height = sh;
      const _cx = _cc.getContext('2d', { willReadFrequently: true });
      if (_cx) {
        applyCtxImageSmoothingOff(_cx);
        _cx.drawImage(srcImg, sx0, sy0, sw0, sh, 0, 0, sw0, sh);
        let outCanvas = _cc;
        let ftkwSkipTrim = false;
        try {
          const _id = _cx.getImageData(0, 0, sw0, sh);
          const _rawCopy = new Uint8ClampedArray(_id.data);
          if (cl.astra) {
            keyAstraFloodKeyBackground(_id.data, sw0, sh);
            if (sheetChromaGoneTooFar(_id.data, sw0, sh, true)) _id.data.set(_rawCopy);
          } else {
            keySheetChromaToTransparent(_id.data);
            if (cl.ftkw) keySheetChromaDespeckle(_id.data, sw0, sh);
            if (sheetChromaGoneTooFar(_id.data, sw0, sh, false)) {
              _id.data.set(_rawCopy);
              ftkwSkipTrim = !!cl.ftkw;
            }
          }
          _cx.putImageData(_id, 0, 0);
          if (cl.ftkw && !ftkwSkipTrim) {
            try {
              outCanvas = trimFtkwChromaToCharacter(_cc);
            } catch (_) {
              outCanvas = _cc;
            }
          }
        } catch (_secErr) {
          // getImageData blocked (file:// / taint) — keep raster from drawImage; no key
        }
        _chromaCache.set(_ck, outCanvas);
        const _ol = makeOutlineCanvas(outCanvas, 2);
        if (_ol) _outlineCache.set(_ck, _ol);
        if (KFR_SF6_RIM) {
          const c0 = characters && characters[f.char] && characters[f.char].color ? String(characters[f.char].color) : '#ffffff';
          const _rim = makeRimCanvas(outCanvas, c0, 3);
          if (_rim) _rimCache.set(_ck, _rim);
        }
      }
    }
    const _cachedFr = _chromaCache.get(_ck);
    let blitW = sw0, blitH = sh;
    if (cl && cl.ftkw && _cachedFr) {
      blitW = Math.max(1, _cachedFr.width | 0);
      blitH = Math.max(1, _cachedFr.height | 0);
    }
    csw = 0; csh = 0; // keep 0 so sheet.complete branch runs as fallback
    wSrc = blitW;    hSrc = blitH;
    // Legacy rows clip at ~90px tall; ASTRA cells are 384px — width-only _frameCap made fighters ~3× too tall.
    // ftkw: use alpha-trimmed size so the visible body fills the on-screen cap (SF-style, not a big empty cell).
    const _capW = 1050 / (blitW * SPRITE_SCALE);
    const _rowRefH = (cl && (cl.astra || cl.ftkw)) ? KADEN_TARGET_ROW_REF : 90;
    const _capH = (_rowRefH * FIGHTER_DRAW_SCALE) / blitH;
    const FTKW_SCREEN_PRESENCE = 1.1;
    const _ftkwBoost = (cl && cl.ftkw) ? FTKW_SCREEN_PRESENCE : 1;
    const _frameCap = Math.min(FIGHTER_DRAW_SCALE * _ftkwBoost, _capW, _capH);
    dw = Math.round(blitW * SPRITE_SCALE * _frameCap);
    dh = Math.round(blitH * SPRITE_SCALE * _frameCap);
    if (!srcImg.complete) console.warn('[KadenFighters] sprite sheet not ready; using placeholder blit');
    dx0 = (Math.round(-dw * 0.5) + 0) | 0;
    dy0 = (-dh) | 0;
  }

  {
    let sm = 'other';
    if (kadenPort) sm = 'kaden-port';
    else if (useFtk) sm = 'ftkw';
    else if (cl && cl.astra && charHasAstraSheet(f.char | 0)) sm = 'astra';
    else sm = 'legacy';
    if (state === 'fight' || state === 'roundover') {
      const prev = _fighterSpriteModeLast.get(f);
      if (prev === 'astra' && (sm === 'ftkw' || sm === 'legacy')) {
        console.warn('[KadenFighters] sprite NEW→OLD: ASTRA → ' + sm, {
          char: f.char,
          name: (characters[f.char] && characters[f.char].name) || '?',
          state: state,
          action: f.action,
          useFtk: useFtk,
          charHasAstraSheet: charHasAstraSheet(f.char | 0)
        });
      } else if (KADEN_SPRITE_MODE_TRACE && prev != null && prev !== sm) {
        console.log('[KadenFighters] sprite mode', prev, '→', sm, { char: f.char, action: f.action, state: state });
      }
      _fighterSpriteModeLast.set(f, sm);
    }
  }

  ctx.save();
  const xDraw = Math.round(f.x);
  const yDraw = Math.round(f.y);
  ctx.translate(xDraw, yDraw);
  // Default: side-view is drawn “right” in texture; f.flip → ctx.scale(-1,1) so both face mid-screen.
  // ?astraMirror=1 inverts to !f.flip for ASTRA-only (some Sprite Lab exports face the other way).
  const astraL = charHasAstraSheet(f.char | 0);
  const astraInvert = astraL && (typeof location !== 'undefined' && String(location.search || '').indexOf('astraMirror=1') >= 0);
  const hMirror = astraInvert ? !f.flip : f.flip;
  // Super/victory animations have baked-in directional art (text, effects that read L→R).
  // Don't mirror these frames so the art always displays correctly.
  const _skipFlip = (f.action === 'super' || f.action === 'victory') && !useFtk;
  if (hMirror && !_skipFlip) ctx.scale(-1, 1);

  if (f.action === 'frontflip' || f.action === 'backflip') {
    const u = 1 - f.lock / FIGHTER_FLIP_FRAMES;
    const tRot = Math.max(0, Math.min(1, u));
    const sign = f.action === 'backflip' ? -1 : 1;
    ctx.translate(0, (-0.5 * dh) | 0);
    ctx.rotate(sign * 2 * Math.PI * tRot);
    ctx.translate(0, (0.5 * dh) | 0);
  }

  if (state === 'fight' || state === 'roundover') {
    applyStrikeBodyMotion(ctx, f);
  }

  const dxI = (dx0 | 0) + 0;
  const dyI = (dy0 | 0) + 0;
  applyCtxImageSmoothingOff(ctx);

  // SF6-style readability: ground shadow + outline so sprites pop off the stage.
  // (Kept subtle so it doesn't look like a sticker.)
  if (state === 'fight' || state === 'roundover') {
    const v = FIGHTER_FX * FIGHTER_DRAW_SCALE;
    const air = (f.y < FLOOR_FIGHT_Y - 10) ? 1 : 0;
    const a0 = air ? 0.14 : 0.26;
    const sx = (air ? 34 : 46) * v;
    const sy = (air ? 8 : 10) * v;
    ctx.save();
    ctx.globalAlpha = a0;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(0, -2 * v, sx, sy, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  if (csw > 0 && csh > 0) {
    if ('filter' in ctx) ctx.filter = 'none';
    if (kadenPort) ctx.drawImage(_kadenBaked, 0, 0, csw, csh, dxI, dyI, dw, dh);
    else ctx.drawImage(_chromaCanvas, 0, 0, csw, csh, dxI, dyI, dw, dh);
  } else if (srcImg.complete && srcImg.naturalWidth > 0) {
    if ('filter' in ctx) ctx.filter = 'none';
  {const _kDraw=chromaKeyForDraw||(f.char+':'+((cl&&cl.astra)?'a4:':(cl&&cl.ftkw)?'fS:':'')+String((cl&&cl.label!=null)?cl.label:((cl&&cl.anim!=null)?cl.anim:f.action)));
    const _cfd=_chromaCache&&_kDraw&&_chromaCache.get(_kDraw);const _olf=_outlineCache&&_kDraw&&_outlineCache.get(_kDraw);const _rim=_rimCache&&_kDraw&&_rimCache.get(_kDraw);
    const _cw=_cfd?(_cfd.width|0):sw0, _ch=_cfd?(_cfd.height|0):sh;
    const _astraNoFx=cl&&cl.astra;
    if(_rim&&KFR_SF6_RIM&&!_astraNoFx){ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha=0.26;ctx.drawImage(_rim,0,0,_rim.width,_rim.height,dxI-3,dyI-3,dw+6,dh+6);ctx.restore();}
    if(_olf&&!_astraNoFx){ctx.globalAlpha=0.95;ctx.drawImage(_olf,0,0,_olf.width,_olf.height,dxI-2,dyI-2,dw+4,dh+4);ctx.globalAlpha=1;}
    if(_cfd){ctx.drawImage(_cfd,0,0,_cw,_ch,dxI,dyI,dw,dh);}else{ctx.drawImage(srcImg,sx0,sy0,sw0,sh,dxI,dyI,dw,dh);}
    if(KFR_SF6_VALUE_LIFT&&_cfd&&!_astraNoFx){ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha=0.07;ctx.drawImage(_cfd,0,0,_cw,_ch,dxI,dyI,dw,dh);ctx.restore();}
  }
    // Fix: the super/victory frame has 'SPECIAL MOVE' text baked-in reversed in the source art.
    // Overdraw it with correctly-oriented canvas text so it always reads left-to-right.
    if (!useFtk && (f.action === 'super' || f.action === 'victory')) {
      const _ow = Math.min(dw * 0.75, 380); // narrower so it stays on canvas
      const _ox = -(_ow * 0.5);
      const _oy = -(dh * 0.78); // slightly lower to center better
      const _oh = dh * 0.38;
      ctx.save();
      if (f.flip && !_skipFlip) ctx.scale(-1, 1);
      ctx.fillStyle = 'rgba(8,2,16,0.85)';
      ctx.fillRect(_ox, _oy, _ow, _oh);
      ctx.fillStyle = '#e8d5ff';
      ctx.font = 'bold ' + Math.round(_oh * 0.52) + 'px Impact, Arial Black';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = '#a855f7';
      ctx.shadowBlur = 12;
      ctx.fillText('SPECIAL MOVE', 0, _oy + _oh * 0.5);
      ctx.shadowBlur = 0;
      ctx.restore();
    }
  } else {
    ctx.fillStyle = '#3a0a0a';
    ctx.fillRect(dxI, dyI, dw, dh);
  }
  if (f.char === BOSS_INDEX) {
    const a = FIGHTER_FX * FIGHTER_DRAW_SCALE;
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = '#a855f7';
    ctx.beginPath();
    ctx.ellipse(0, -95 * a, 64 * a, 118 * a, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.ellipse(0, -95 * a, 50 * a, 95 * a, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  if (f.flash > 0) {
    /* Second blit, no filter — only alpha (stacks over base draw) for a sharp hit flash. */
    ctx.save();
    applyCtxImageSmoothingOff(ctx);
    if ('filter' in ctx) ctx.filter = 'none';
    ctx.globalAlpha = Math.min(0.42, f.flash / 6);
    if (csw > 0 && csh > 0) {
      if (kadenPort) ctx.drawImage(_kadenBaked, 0, 0, csw, csh, dxI, dyI, dw, dh);
      else ctx.drawImage(_chromaCanvas, 0, 0, csw, csh, dxI, dyI, dw, dh);
    } else if (srcImg.complete && srcImg.naturalWidth > 0) {
      const _kFlash = chromaKeyForDraw || (f.char + ':' + ((cl && cl.astra) ? 'a4:' : (cl && cl.ftkw) ? 'fS:' : '') + String(cl ? (cl.label != null ? cl.label : (cl.anim != null ? cl.anim : f.action)) : f.action));
      const _cfL = _kFlash && _chromaCache.get(_kFlash);
      if (_cfL) ctx.drawImage(_cfL, 0, 0, _cfL.width | 0, _cfL.height | 0, dxI, dyI, dw, dh);
      else ctx.drawImage(srcImg, sx0, sy0, sw0, sh, dxI, dyI, dw, dh);
    }
    ctx.restore();
  }
  ctx.restore();

  if (KADEN_DEBUG) {
    const wz = f.flip ? -1 : 1;
    ctx.save();
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = '#0f0';
    const px = f.x, py = f.y;
    ctx.strokeRect(
      (px - dw * 0.5) | 0, (py - dh) | 0, dw, dh
    );
    let hx = 70, hy = 130;
    if (f.action && f.action.includes('kick')) hy = 150;
    else if (f.action && (f.action === 'super' || f.action === 'special' || f.action === 'special-strike')) { hx = 100; hy = 160; }
    ctx.fillStyle = 'rgba(255,0,0,0.2)';
    ctx.fillRect(
      (px + wz * 85 - hx * 0.5) | 0, (py - hy) | 0, hx, 48
    );
    ctx.fillStyle = 'rgba(0,200,255,0.2)';
    ctx.fillRect(
      (px - 32) | 0, (py - 130) | 0, 64, 130
    );
    ctx.strokeStyle = '#ff0';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(f.x - 200 | 0, f.y | 0);
    ctx.lineTo(f.x + 200 | 0, f.y | 0);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#fff';
    ctx.font = '10px system-ui, sans-serif';
    ctx.textAlign = 'left';
    const db = cl.anim != null ? cl.anim : f.action;
    ctx.fillText(String(db) + '  f' + (cl.frame|0), 8 + (f === p1 ? 0 : 520), 18 + (f === p1 ? 18 : 36));
    ctx.restore();
  }

  // Block shield
  const v = FIGHTER_FX * FIGHTER_DRAW_SCALE;
  if (f.block) {
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(f.x, f.y - 115 * v, 62 * v, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Armor ring
  if (f.armor > 0) {
    ctx.strokeStyle = '#ffd65a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(f.x, f.y - 100 * v, 70 * v, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Parry ring
  if (f.parry > 0) {
    ctx.strokeStyle = '#7ec46b';
    ctx.lineWidth = 3;
    const r = (60 + Math.sin(f.parry * 0.8) * 6) * v;
    ctx.beginPath();
    ctx.arc(f.x, f.y - 110 * v, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  // i-frames trail
  if (f.iframes > 0) {
    ctx.fillStyle = 'rgba(255, 79, 145, 0.28)';
    ctx.beginPath();
    ctx.ellipse(f.x, f.y - 90 * v, 50 * v, 110 * v, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawSparks() {
  sparks.forEach(s => {
    const px = s.x | 0;
    const py = s.y | 0;
    const r = Math.max(0.75, s.size * 0.5);
    ctx.globalAlpha = Math.max(0, 0.55 * (s.life / s.maxLife));
    ctx.fillStyle = s.color;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

function drawProjectiles() {
  projectiles.forEach(p => {
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = (p.kind === 'frost' || p.kind === 'shadow' || p.kind === 'void') ? 30 : 20;
    ctx.beginPath();
    if (p.kind === 'frost') {
      // jagged frost wave
      ctx.ellipse(p.x, p.y, p.size, 22, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#cce8ff';
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.size * 0.6, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    } else if (p.kind === 'void') {
      // expanding void wave
      const t = 1 - (p.life / 70);
      const r = (p.size || 120) * (0.65 + t * 1.15);
      ctx.globalAlpha = 0.35;
      ctx.ellipse(p.x, p.y, r, 28 + t * 26, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#e9d5ff';
      ctx.globalAlpha = 0.18;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, r * 0.55, 18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    } else {
      ctx.ellipse(p.x, p.y, p.size || 45, 18, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  });
}

function drawFight() {
  // Base scale = devicePixelRatio; keeps sprites sharp when the canvas is CSS-scaled
  setGameCtxBaseTransform();
  ctx.save(); // guarantee clean context state
  ctx.textBaseline = 'alphabetic';
  ctx.clearRect(0, 0, G_WIDTH, H_HEIGHT);
  applyCtxImageSmoothingOff(ctx);

  // Apply screen shake to world but not HUD (sin/cos phase; integer offset reduces shimmer)
  ctx.save();
  applyCtxImageSmoothingOff(ctx);
  if (shake > 0.5) {
    const phase = performance.now() * 0.045;
    const sx0 = Math.sin(phase) * shake * 0.42;
    const sy0 = Math.cos(phase * 1.63) * shake * 0.42;
    camera.x = (Math.round(sx0 * 2) / 2) | 0;
    camera.y = (Math.round(sy0 * 2) / 2) | 0;
    ctx.translate(camera.x, camera.y);
  } else {
    camera.x = camera.y = 0;
  }
  drawStage();
  applyCtxImageSmoothingOff(ctx);
  drawProjectiles();
  drawFighter(p1);
  drawFighter(p2);
  drawSparks();
  if (msg) drawText(msg, 640, 205, 48, '#ff3333', 'center');
  ctx.restore();

  drawBars();
  if (state === 'fight') drawCombos();
  const sp = p2IsHuman
    ? 'P1: E/Q air flips  ·  P2: C/Z  ·  Space/Shift vs -/= specials  ·  Best of 3'
    : ('SPACE: ' + characters[p1.char].special + ' (25)  ·  SHIFT: ' + characters[p1.char].super + ' (100)  ·  E front / Q back flip (in air)');
  drawText(sp, 640, 690, p2IsHuman ? 15 : 17, '#bbb', 'center');
  ctx.restore(); // match save at top of drawFight
}

function roundOver() {
  drawFight();
  setGameCtxBaseTransform();
  ctx.save(); // Safety: reset transform after drawFight
  ctx.textBaseline = 'alphabetic';
  drawText(msg, 640, 300, 52, '#fff', 'center');
  drawText('PRESS ENTER', 640, 370, 34, '#ff3333', 'center');
  ctx.restore();
}

function nextRoundOrMatch() {
  if (playMode === 'versus') {
    if (p1wins >= 2) {
      endTauntSpeaker = sel;
      endTaunt = 'PLAYER 1  —  ' + characters[sel].name;
      state = 'champion';
      return;
    }
    if (p2wins >= 2) {
      endTauntSpeaker = oppIndex;
      endTaunt = pickTaunt(oppIndex, false);
      state = 'gameover';
      return;
    }
    round++;
    newRound();
    state = 'fight';
    return;
  }
  if (p1wins >= 2) {
    lastOpponentChar = p2.char;
    // If we just beat the boss, we win the tournament.
    if (lastOpponentChar === BOSS_INDEX) {
      endTauntSpeaker = lastOpponentChar;
      endTaunt = pickTaunt(endTauntSpeaker, true);
      state = 'champion';
      if (playMode === 'tournament' || playMode === 'story') {
        submitRunToLeaderboard(score, getPlayerName(), true);
        fetchLeaderboard();
      }
      return;
    }

    tournamentWins++;
    // After defeating 4 opponents, the final boss appears.
    if (tournamentWins >= 4) {
      oppIndex = BOSS_INDEX;
    } else {
      // Pick next opponent: skip self, wrap around among selectable roster
      oppIndex = (oppIndex + 1) % SELECTABLE_COUNT;
      if (oppIndex === sel) oppIndex = (oppIndex + 1) % SELECTABLE_COUNT;
    }
    p1wins = 0; p2wins = 0;
    round = 1;
    newRound();
    state = 'fight';
  } else if (p2wins >= 2) {
    lastOpponentChar = p2.char;
    endTauntSpeaker = lastOpponentChar;
    endTaunt = pickTaunt(endTauntSpeaker, false);
    state = 'gameover';
    if (playMode === 'tournament' || playMode === 'story') {
      submitRunToLeaderboard(score, getPlayerName(), false);
      fetchLeaderboard();
    }
  } else {
    round++;
    newRound();
    state = 'fight';
  }
}

function endScreen(win) {
  ctx.clearRect(0, 0, 1280, 720);
  if (!win) {
    drawOpponentVictoryEndScreen();
    return;
  }

  {
    const winTitle = playMode === 'versus' ? 'PLAYER 1 WINS THE SET' : playMode === 'story' ? 'STORY COMPLETE' : 'TOURNAMENT CHAMPION';
    const winSub = playMode === 'versus' ? characters[sel].name
      : playMode === 'story' ? characters[p1.char].name + ' — a legend in the RISE'
      : characters[p1.char].name + ' rules the Shadow Dojo';
    drawText(winTitle, 640, 230, 62, '#ffd65a', 'center');
    drawText(winSub, 640, 300, 30, 'white', 'center');
  }

  const speaker = Number.isFinite(endTauntSpeaker) ? endTauntSpeaker : lastOpponentChar;
  const accent = characters[speaker]?.color || '#7d0e0e';
  const py = sheetRowTop(speaker);
  const ph = sheetRowHeight(speaker);
  ctx.save();
  ctx.globalAlpha = 0.95;
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 3;
  roundRect(110, 360, 250, 290, 18, true, true);
  ctx.globalAlpha = 1;
  if (speaker === 0 && useKadenHdMenuPortrait()) {
    const tw2 = 180, th2 = 250, ix2 = 145, iy2 = 385;
    const aw2 = kadenGameplay.naturalWidth, ah2 = kadenGameplay.naturalHeight;
    const sc2 = Math.min(tw2 / aw2, th2 / ah2);
    const dw3 = (aw2 * sc2) | 0, dh3 = (ah2 * sc2) | 0;
    const ox2 = ix2 + (((tw2 - dw3) * 0.5) | 0), oy2 = iy2 + (th2 - dh3);
    applyCtxImageSmoothingOff(ctx);
    ctx.drawImage(kadenGameplay, 0, 0, aw2, ah2, ox2, oy2, dw3, dh3);
  } else if (charHasAstraSheet(speaker | 0)) {
    drawAstraCellKeyedInBox(ctx, speaker | 0, 0, 0, 145, 385, 180, 250, { vertical: 'bottom', scaleMult: 1.08 });
  } else {
    ctx.drawImage(sheet, 246, py, 109, ph, 145, 385, 180, 250);
  }
  ctx.restore();

  const line = endTaunt || pickTaunt(speaker, win);
  drawSpeechBubble(390, 390, 780, 150, line, accent);

  drawText('FINAL SCORE ' + Math.floor(score), 640, 568, 32, '#ffd65a', 'center');
  if (lastSubmitStatus) drawText(lastSubmitStatus, 640, 608, 20, '#9cf0c2', 'center');

  drawText('PRESS ENTER TO RESTART', 640, 658, 28, '#ff3333', 'center');
  drawText('Or refresh the page', 640, 692, 20, '#666', 'center');
}

// --- Main loop --------------------------------------------------------------
let gameLoopStarted = false;
function loop() {
  applyGameCanvasDpr();
  setGameCtxBaseTransform();
  applyCtxImageSmoothingOff(ctx);
  if (kadenMainMenu) kadenMainMenu.setActive(state === 'menu' && USE_HTML_MAIN_MENU);
  if (typeof leaderboardScreen !== 'undefined' && leaderboardScreen) {
    leaderboardScreen.setActive(!!(state === 'scores' && USE_HTML_LEADERBOARD));
  }
  {
    const _mc = document.getElementById('mobileControls');
    if (_mc) _mc.classList.toggle('mc-fight', state === 'fight');
  }
  if (state !== 'menu') menuHot = null;
  update();
  if (state === 'menu')         menu();
  else if (state === 'story')  drawStoryScreen();
  else if (state === 'options')  drawOptionsScreen();
  else if (state === 'store')  drawStoreScreen();
  else if (state === 'scores')  drawScoresScreen();
  else if (state === 'select')  characterSelect();
  else if (state === 'fight')   drawFight();
  else if (state === 'roundover') roundOver();
  else if (state === 'champion') endScreen(true);
  else if (state === 'gameover') endScreen(false);
  cvs.style.cursor = (state === 'menu' && !USE_HTML_MAIN_MENU && menuHot) ? 'pointer' : 'default';
  requestAnimationFrame(loop);
}

function startGameLoop() {
  if (gameLoopStarted) return;
  gameLoopStarted = true;
  applyGameCanvasDpr();
  window.addEventListener('resize', applyGameCanvasDpr, { passive: true });
  loop();
}
if (USE_HTML_MAIN_MENU) {
  kadenMainMenu = new MainMenu(document.getElementById('mainMenuHost'), {
    onAction: (id) => runMenuAction(id),
    onExitConfirm: () => restartToMenu()
  });
}
if (USE_HTML_LEADERBOARD) {
  leaderboardScreen = new LeaderboardScreen(document.getElementById('leaderboardHost'), {
    getPlayerName: () => getPlayerName(),
    getApiRows: () => leaderboardRows,
    getLoadState: () => leaderboardLoadState,
    onFetchRemote: () => fetchLeaderboard(),
    onBack: () => { state = 'menu'; }
  });
}
function prebakeAllSheetFrames() {
  if (!sheet.complete || sheet.naturalWidth <= 0) return;
  const actions = [{anim:'idle',ix:364,sw:42},{anim:'walk0',ix:460,sw:44},{anim:'walk1',ix:508,sw:44},
    {anim:'jump',ix:508,sw:44},{anim:'block',ix:628,sw:58},{anim:'hurt',ix:520,sw:72},
    {anim:'special',ix:780,sw:118},{anim:'super',ix:980,sw:135},{anim:'kick',ix:1032,sw:58}];
  [0,1,2,3,4].forEach(char => {
    if (charHasAstraSheet(char)) return;
    const y0=sheetRowTop(char); const hrow=sheetRowHeight(char);
    actions.forEach(({anim,ix,sw}) => {
      const sh=Math.max(1,Math.min(90,hrow-22)|0);
      const key=char+':'+anim;
      if(!_chromaCache.has(key)){
        const cc=document.createElement('canvas');cc.width=sw;cc.height=sh;
        const cx=cc.getContext('2d',{willReadFrequently:true});
        if(cx){applyCtxImageSmoothingOff(cx);cx.drawImage(sheet,ix,y0+22,sw,sh,0,0,sw,sh);
          const id=cx.getImageData(0,0,sw,sh);keySheetChromaToTransparent(id.data);
          cx.putImageData(id,0,0);_chromaCache.set(key,cc);}
      }
    });
  });
  for (let ac = 0; ac < astraFighterSheets.length; ac++) {
    if (charHasAstraSheet(ac)) prebakeAstraFighterFrames(ac);
  }
  if (KADEN_DEBUG) console.log('[KF] Prebaked', _chromaCache.size, 'sprite frames');
}
/** Warm chroma cache for one fighter’s ASTRA sheet (Sprite Lab export, same pipeline as gameplay). */
function prebakeAstraFighterFrames(charIdx) {
  const src = astraSheetForChar(charIdx);
  if (!src || !src.complete || (src.naturalWidth | 0) < 1) return;
  const F = (action, frame) => ({ char: charIdx, action, frame: frame | 0, lock: 0 });
  const samples = [
    ['idle', 0], ['walk', 0], ['walk', 1], ['jump', 0], ['block', 0], ['hurt', 0],
    ['special', 0], ['super', 0], ['victory', 0], ['front kick', 0],
    ['uppercut', 0], ['hook', 0], ['palm', 0], ['flick kick', 0], ['crescent kick', 0], ['side kick', 0],
    ['back kick', 0], ['push kick', 0], ['axe kick', 0]
  ];
  for (const [act, fr] of samples) {
    const f = F(act, fr);
    const cl = getAstraFighterSheetClip(f);
    const sh = cl.sh|0, sw0 = cl.sw|0, sx0 = cl.sx|0, sy0 = cl.sy|0;
    const _ck = charIdx + ':a4:' + String(cl.label);
    if (_chromaCache.has(_ck)) continue;
    if (_chromaCache.size >= _CHROMA_CACHE_MAX) _chromaCache.delete(_chromaCache.keys().next().value);
    const _cc = document.createElement('canvas');
    _cc.width = sw0; _cc.height = sh;
    const _cx = _cc.getContext('2d', { willReadFrequently: true });
    if (!_cx) continue;
    applyCtxImageSmoothingOff(_cx);
    _cx.drawImage(src, sx0, sy0, sw0, sh, 0, 0, sw0, sh);
    const _id = _cx.getImageData(0, 0, sw0, sh);
    keyAstraFloodKeyBackground(_id.data, sw0, sh);
    _cx.putImageData(_id, 0, 0);
    _chromaCache.set(_ck, _cc);
    const _ol = makeOutlineCanvas(_cc, 2);
    if (_ol) _outlineCache.set(_ck, _ol);
    if (KFR_SF6_RIM) {
      const c0 = characters[charIdx] && characters[charIdx].color ? String(characters[charIdx].color) : '#ffffff';
      const _rim = makeRimCanvas(_cc, c0, 3);
      if (_rim) _rimCache.set(_ck, _rim);
    }
  }
}
function warmAstraIfReady() {
  for (let i = 0; i < astraFighterSheets.length; i++) {
    try { if (charHasAstraSheet(i)) prebakeAstraFighterFrames(i); } catch (_) { /* */ }
  }
}
sheet.onload = function(){ prebakeAllSheetFrames(); startGameLoop(); };
if (sheet.complete) startGameLoop();
astraFighterSheets.forEach((im) => {
  if (!im.src) return;
  im.addEventListener('load', function () { try { warmAstraIfReady(); } catch (_){} });
});
// === MOBILE CONTROLS ===
(function(){
  const mc = document.getElementById('mobileControls');
  if (!mc) return;
  // Show on touch devices
  function checkTouch(){ if(navigator.maxTouchPoints>0||'ontouchstart' in window){ mc.classList.add('mc-visible'); } }
  checkTouch();
  window.addEventListener('touchstart', function(){ mc.classList.add('mc-visible'); }, {once:true, passive:true});
  // Key simulation helper
  const pressed = new Set();
  function fireKey(k, down){
    const key = k === ' ' ? ' ' : k === 'shift' ? 'Shift' : k === 'enter' ? 'Enter' : k.length===1 ? k : k.charAt(0).toUpperCase()+k.slice(1);
    const code = k==='arrowleft'?'ArrowLeft':k==='arrowright'?'ArrowRight':k==='arrowup'?'ArrowUp':k==='arrowdown'?'ArrowDown':k==='shift'?'ShiftLeft':k==='enter'?'Enter':k===' '?'Space':'Key'+k.toUpperCase();
    const ev = new KeyboardEvent(down?'keydown':'keyup', {key,code,bubbles:true,cancelable:true,shiftKey:k==='shift'});
    window.dispatchEvent(ev);
    if(down) resumeFightSfx&&resumeFightSfx();
  }
  function bindBtn(el){
    const k = el.dataset.key;
    if(!k) return;
    el.addEventListener('pointerdown', e=>{ e.preventDefault(); el.classList.add('mc-pressed'); if(!pressed.has(k)){ pressed.add(k); fireKey(k,true); } }, {passive:false});
    const up = ()=>{ el.classList.remove('mc-pressed'); if(pressed.has(k)){ pressed.delete(k); fireKey(k,false); } };
    el.addEventListener('pointerup', up, {passive:true});
    el.addEventListener('pointerleave', up, {passive:true});
    el.addEventListener('pointercancel', up, {passive:true});
  }
  mc.querySelectorAll('[data-key]').forEach(bindBtn);
  // D-pad joystick swipe support
  const dpad = document.getElementById('mcDpad');
  if(dpad){
    let dpStart=null, dpActive=null;
    dpad.addEventListener('pointerdown',e=>{
      dpStart={x:e.clientX,y:e.clientY}; dpad.setPointerCapture(e.pointerId);
    },{passive:true});
    dpad.addEventListener('pointermove',e=>{
      if(!dpStart) return;
      const dx=e.clientX-dpStart.x, dy=e.clientY-dpStart.y;
      const dist=Math.sqrt(dx*dx+dy*dy);
      if(dist<12) return;
      const ang=Math.atan2(dy,dx)*180/Math.PI;
      let dir = ang>=-45&&ang<45?'arrowright':ang>=45&&ang<135?'arrowdown':ang>=-135&&ang<-45?'arrowup':'arrowleft';
      if(dir!==dpActive){ if(dpActive){pressed.delete(dpActive);fireKey(dpActive,false);} dpActive=dir; pressed.add(dir); fireKey(dir,true); }
    },{passive:true});
    const dpUp=()=>{ if(dpActive){pressed.delete(dpActive);fireKey(dpActive,false);dpActive=null;} dpStart=null; };
    dpad.addEventListener('pointerup',dpUp,{passive:true});
    dpad.addEventListener('pointercancel',dpUp,{passive:true});
  }
})();
