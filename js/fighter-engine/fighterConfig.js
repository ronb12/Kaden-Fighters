import { Animation } from './Animation.js';

/**
 * @typedef {Object} AnimDef
 * @property {number} row
 * @property {number} frameCount
 * @property {number} fps
 * @property {boolean} loop
 * @property {number[]} [hitFrames] — 0-based frame indices (punch, kick, special)
 */

/**
 * @typedef {Object} CharacterFighterConfig
 * @property {string} id
 * @property {string} [displayName]
 * @property {string} [sheetUrl] — one sheet per character; all anims in same file
 * @property {{ w: number; h: number }} sourceFrame — uniform cell size in the PNG (high-res art: e.g. 128×128)
 * @property {number} groundAnchorY — pixels from top of each cell to foot/ground line in the art (match your sheet)
 * @property {{ w: number; h: number }} slot — world-space box (all fighters use same for fair baseline)
 * @property {Record<string, AnimDef>} anims — idle, walk, jump, punch, kick, block, hit, special
 * @property {Record<string, { relX: number; relY: number; relW: number; relH: number; damage: number }>} hitboxes — relative 0..1 within the slot, origin top-left; relY from top of slot
 * @property {{ relX: number; relY: number; relW: number; relH: number }} hurtbox — rel to slot
 * @property {string} [placeholderColor] — hsl/hex for missing-image box
 */

/** All fighters share the same world slot; source art is scaled into it (see `renderSpec.layoutCroppedInSlot`). */
export const UNIFORM_SLOT = { w: 80, h: 128 };

/** High-res cells in the PNG (one frame = one cell in the grid). Layout scales into `UNIFORM_SLOT` with aspect preserved. */
export const UNIFORM_SOURCE_FRAME = { w: 128, h: 128 };

/**
 * Pixels from top of each 128×128 cell to where the feet meet the ground line in the artwork.
 * Tune per sheet if your baseline differs; same ratio as legacy 64px art (58/64 ≈ 0.906).
 */
export const UNIFORM_GROUND_ANCHOR = 116;

/**
 * @type {CharacterFighterConfig}
 */
export const HERO_FIGHTER = {
  id: 'hero',
  displayName: 'P1',
  sheetUrl: null,
  sourceFrame: { ...UNIFORM_SOURCE_FRAME },
  groundAnchorY: UNIFORM_GROUND_ANCHOR,
  slot: { ...UNIFORM_SLOT },
  placeholderColor: 'hsl(200 50% 45%)',
  anims: {
    idle: { row: 0, frameCount: 4, fps: 8, loop: true },
    walk: { row: 0, frameCount: 4, fps: 10, loop: true },
    jump: { row: 0, frameCount: 1, fps: 10, loop: true },
    punch: { row: 0, frameCount: 5, fps: 14, loop: false, hitFrames: [2, 3] },
    kick: { row: 0, frameCount: 6, fps: 12, loop: false, hitFrames: [3, 4] },
    block: { row: 0, frameCount: 1, fps: 10, loop: true },
    hit: { row: 0, frameCount: 2, fps: 12, loop: false },
    special: { row: 0, frameCount: 4, fps: 10, loop: false, hitFrames: [2, 3] },
  },
  hitboxes: {
    punch: { relX: 0.4, relY: 0.4, relW: 0.5, relH: 0.28, damage: 8 },
    kick: { relX: 0.35, relY: 0.42, relW: 0.55, relH: 0.3, damage: 12 },
    special: { relX: 0.32, relY: 0.35, relW: 0.6, relH: 0.32, damage: 16 },
  },
  hurtbox: { relX: 0.15, relY: 0.1, relW: 0.7, relH: 0.8 },
};

/**
 * @type {CharacterFighterConfig}
 */
export const RIVAL_FIGHTER = {
  id: 'rival',
  displayName: 'P2',
  sheetUrl: null,
  sourceFrame: { ...UNIFORM_SOURCE_FRAME },
  groundAnchorY: UNIFORM_GROUND_ANCHOR,
  slot: { ...UNIFORM_SLOT },
  placeholderColor: 'hsl(0 50% 45%)',
  anims: {
    idle: { row: 0, frameCount: 4, fps: 8, loop: true },
    walk: { row: 0, frameCount: 4, fps: 10, loop: true },
    jump: { row: 0, frameCount: 1, fps: 10, loop: true },
    punch: { row: 0, frameCount: 5, fps: 14, loop: false, hitFrames: [2, 3] },
    kick: { row: 0, frameCount: 6, fps: 12, loop: false, hitFrames: [3, 4] },
    block: { row: 0, frameCount: 1, fps: 10, loop: true },
    hit: { row: 0, frameCount: 2, fps: 12, loop: false },
    special: { row: 0, frameCount: 4, fps: 10, loop: false, hitFrames: [2, 3] },
  },
  hitboxes: { ...HERO_FIGHTER.hitboxes },
  hurtbox: { ...HERO_FIGHTER.hurtbox },
};

const ANIM_KEYS = ['idle', 'walk', 'jump', 'punch', 'kick', 'block', 'hit', 'special'];

/**
 * @param {CharacterFighterConfig} config
 * @param {HTMLImageElement | null} image
 * @returns {Record<string, Animation>}
 */
export function buildAnimationSet(config, image) {
  const out = {};
  for (const key of ANIM_KEYS) {
    const spec = config.anims[key];
    if (!spec) continue;
    out[key] = new Animation({
      name: key,
      image,
      frameWidth: config.sourceFrame.w,
      frameHeight: config.sourceFrame.h,
      row: spec.row,
      frameCount: spec.frameCount,
      fps: spec.fps,
      loop: spec.loop,
    });
  }
  return out;
}

/**
 * @param {string | null} urlOverride
 * @param {CharacterFighterConfig} config
 * @param {string | null} [globalSheet] — e.g. ?sheet= for both
 * @returns {string | null}
 */
export function resolveSheetUrl(urlOverride, config, globalSheet) {
  if (urlOverride) return urlOverride;
  if (config.sheetUrl) return config.sheetUrl;
  if (globalSheet) return globalSheet;
  return null;
}
