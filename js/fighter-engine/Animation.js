import { setPixelArtCanvasState } from './renderSpec.js';

/**
 * Frame-based sprite animation. Renders a single source crop per frame; never the full sheet.
 * Always uses 9-argument drawImage.
 */
export class Animation {
  /**
   * @param {{ image: HTMLImageElement | null; frameWidth: number; frameHeight: number;
   *   row: number; frameCount: number; fps: number; loop: boolean; name?: string; }} def
   */
  constructor(def) {
    this.name = def.name || 'unnamed';
    this.image = def.image;
    this.frameWidth = def.frameWidth | 0;
    this.frameHeight = def.frameHeight | 0;
    this.row = def.row | 0;
    this.frameCount = Math.max(1, def.frameCount | 0);
    this.loop = !!def.loop;
    this.fps = def.fps == null ? 10 : +def.fps;
    this._currentFrame = 0;
    this._acc = 0;
    this._done = false;
  }

  get currentFrame() {
    return this._currentFrame;
  }

  get done() {
    return this._done;
  }

  reset() {
    this._currentFrame = 0;
    this._acc = 0;
    this._done = false;
  }

  /**
   * @param {number} dtSeconds
   */
  update(dtSeconds) {
    if (this._done && !this.loop) return this._currentFrame;
    this._acc += dtSeconds;
    const step = 1 / Math.max(1, this.fps);
    while (this._acc >= step) {
      this._acc -= step;
      this._currentFrame++;
      if (this._currentFrame >= this.frameCount) {
        if (this.loop) {
          this._currentFrame = 0;
        } else {
          this._currentFrame = this.frameCount - 1;
          this._done = true;
        }
      }
    }
    return this._currentFrame;
  }

  /**
   * 9-arg draw only. Safe if image is missing or throws.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} dx
   * @param {number} dy
   * @param {number} dw
   * @param {number} dh
   * @param {string} [placeholderColor]
   */
  draw(ctx, dx, dy, dw, dh, placeholderColor) {
    const f = this._currentFrame;
    const fw = this.frameWidth;
    const fh = this.frameHeight;
    if (fw <= 0 || fh <= 0) {
      this._drawPlaceholder(ctx, dx, dy, dw, dh, f, placeholderColor);
      return;
    }
    const sx = f * fw;
    const sy = (this.row | 0) * fh;
    const img = this.image;
    const validSource =
      img &&
      img.complete &&
      (img.naturalWidth || 0) > 0 &&
      sx + fw <= (img.naturalWidth || 0) + 0.5 &&
      sy + fh <= (img.naturalHeight || 0) + 0.5;
    if (!validSource) {
      this._drawPlaceholder(ctx, dx, dy, dw, dh, f, placeholderColor);
      return;
    }
    setPixelArtCanvasState(ctx);
    try {
      ctx.drawImage(
        /** @type {CanvasImageSource} */ (img),
        sx,
        sy,
        fw,
        fh,
        dx,
        dy,
        dw,
        dh
      );
    } catch {
      this._drawPlaceholder(ctx, dx, dy, dw, dh, f, placeholderColor);
    }
  }

  _drawPlaceholder(ctx, dx, dy, dw, dh, f, placeholderColor) {
    const hue = 200 + f * 15;
    ctx.fillStyle = placeholderColor || `hsl(${hue % 360} 50% 45%)`;
    ctx.fillRect(Math.round(dx), Math.round(dy), Math.round(dw), Math.round(dh));
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1;
    ctx.strokeRect(Math.round(dx) + 0.5, Math.round(dy) + 0.5, Math.round(dw) - 1, Math.round(dh) - 1);
  }
}
