/**
 * Shared layout: every fighter uses the same world slot, ground line, and anchor math.
 * Sprites are drawn with preserved aspect ratio inside the slot, feet on groundY.
 */
export const DEFAULT_GROUND_Y = 420;

/**
 * Layout one source frame (frameWidth × frameHeight) into a world slot, feet pinned to worldFeetY.
 * @param {{ slotW: number; slotH: number; sourceFrameW: number; sourceFrameH: number;
 *   groundAnchorY: number; worldLeft: number; worldFeetY: number; }} p
 * groundAnchorY: pixels from top of source cell to the ground/foot line in the art.
 * @returns {{ dx: number; dy: number; dw: number; dh: number; scale: number }}
 */
export function layoutCroppedInSlot(p) {
  const {
    slotW,
    slotH,
    sourceFrameW: sw,
    sourceFrameH: sh,
    groundAnchorY,
    worldLeft,
    worldFeetY,
  } = p;
  if (sw <= 0 || sh <= 0) {
    return { dx: worldLeft, dy: worldFeetY - slotH, dw: slotW, dh: slotH, scale: 1 };
  }
  const scale = Math.min(slotW / sw, slotH / sh);
  const dw = sw * scale;
  const dh = sh * scale;
  const feetFromTop = Math.min(sh, Math.max(0, groundAnchorY)) / sh;
  const feetYInDest = feetFromTop * dh;
  const dy = worldFeetY - feetYInDest;
  const dx = worldLeft + (slotW - dw) * 0.5;
  return { dx, dy, dw, dh, scale };
}

/**
 * @param {CanvasRenderingContext2D} ctx
 */
export function setPixelArtCanvasState(ctx) {
  ctx.imageSmoothingEnabled = false;
  if ('imageSmoothingQuality' in ctx) {
    ctx.imageSmoothingQuality = 'low';
  }
  if (typeof ctx.mozImageSmoothingEnabled !== 'undefined') {
    ctx.mozImageSmoothingEnabled = false;
  }
}
