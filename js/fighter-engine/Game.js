import { Input } from './Input.js';
import { Fighter } from './fighter.js';
import {
  HERO_FIGHTER,
  RIVAL_FIGHTER,
  buildAnimationSet,
  resolveSheetUrl,
} from './fighterConfig.js';
import { loadImageSafe } from './imageLoad.js';
import { DEFAULT_GROUND_Y } from './renderSpec.js';

/** @param {{x:number;y:number;w:number;h:number}} a @param {typeof a} b */
function rectOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/**
 * @param {ReturnType<Fighter['getHitbox']>} hit
 * @param {{x:number;y:number;w:number;h:number}} hurt
 */
function hitVsHurt(hit, hurt) {
  if (!hit) return false;
  return rectOverlap(hit, hurt);
}

export class Game {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{ url?: string; p1Sheet?: string; p2Sheet?: string }} [opts]
   */
  constructor(canvas, opts) {
    opts = opts || {};
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.input = new Input();
    this.input.bind(window);
    this.worldW = 960;
    this.debug = false;
    this.lastComboMsg = '-';

    this.groundY = DEFAULT_GROUND_Y;
    this.heroAnims = buildAnimationSet(HERO_FIGHTER, null);
    this.rivalAnims = buildAnimationSet(RIVAL_FIGHTER, null);

    this.player = new Fighter(HERO_FIGHTER, this.heroAnims, {
      x: 80,
      floorY: this.groundY,
      facing: 1,
      mode: 'player',
      input: this.input,
    });

    this.opponent = new Fighter(RIVAL_FIGHTER, this.rivalAnims, {
      x: 600,
      floorY: this.groundY,
      facing: -1,
      mode: 'cpu',
    });

    this._ready = true;
    this._loadSheets(opts);
    this._last = 0;
    this._raf = 0;
  }

  /**
   * @param {{ url?: string; p1Sheet?: string; p2Sheet?: string }} opts
   */
  _loadSheets(opts) {
    const p1u = resolveSheetUrl(opts.p1Sheet || null, HERO_FIGHTER, opts.url || null);
    const p2u = resolveSheetUrl(opts.p2Sheet || null, RIVAL_FIGHTER, opts.url || null);
    const p1 = p1u ? loadImageSafe(p1u) : Promise.resolve(null);
    const p2 = p2u && p2u !== p1u ? loadImageSafe(p2u) : Promise.resolve(null);
    Promise.all([p1, p2])
      .then(([img1, img2]) => {
        if (img1) {
          this._applySheet(this.heroAnims, img1);
        }
        if (img2) {
          this._applySheet(this.rivalAnims, img2);
        } else if (img1) {
          this._applySheet(this.rivalAnims, img1);
        }
        this._ready = true;
      })
      .catch(() => {
        this._ready = true;
      });
  }

  /**
   * @param {Record<string, import('./Animation.js').Animation>} anims
   * @param {HTMLImageElement | null} img
   */
  _applySheet(anims, img) {
    if (!img) return;
    for (const k of Object.keys(anims)) {
      anims[k].image = img;
    }
  }

  setDebug(on) {
    this.debug = !!on;
  }

  start() {
    const touchRoot = document.getElementById('fighter-touch');
    if (touchRoot) this.input.bindTouch(touchRoot);
    this._last = performance.now() / 1000;
    const loop = (t) => {
      const now = t / 1000;
      const dt = Math.min(0.05, now - this._last);
      this._last = now;
      this._tick(dt);
      this._raf = requestAnimationFrame(loop);
    };
    this._raf = requestAnimationFrame(loop);
  }

  stop() {
    cancelAnimationFrame(this._raf);
  }

  _tick(dt) {
    this.input.poll();
    this.opponent._opponentX = this.player.x;
    this.player._opponentX = this.opponent.x;
    this.player.update(this.input, dt, this.worldW);
    this.opponent.update(null, dt, this.worldW);
    this._combat();
    this._uiCombo();
    this._draw();
    this.input.endFrame();
  }

  _combat() {
    const p = this.player;
    if (p.state !== 'attack' || !p.attackKind || p.dealtHitThisAttack) return;
    const fr = p.currentAnim.currentFrame;
    const hit = p.getHitbox(fr);
    if (!hit) return;
    if (hitVsHurt(hit, this.opponent.hurtbox)) {
      this.opponent.takeHit(hit.damage);
      p.dealtHitThisAttack = true;
    }
  }

  _uiCombo() {
    const s = this.player.debugState;
    this.lastComboMsg =
      s.comboStep === 0
        ? 'Combo: next hit within 0.45s'
        : `Combo x${s.comboStep + 1}`;
  }

  _draw() {
    const c = this.canvas;
    const ctx = this.ctx;
    const w = c.width;
    const h = c.height;
    ctx.fillStyle = '#1a1d24';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#2a333f';
    ctx.fillRect(0, this.groundY, w, h - this.groundY);

    this.opponent.draw(ctx);
    this.player.draw(ctx);

    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(
      `${this.opponent.config.displayName || 'CPU'}  HP ${(this.opponent.hp != null ? this.opponent.hp : 100) | 0}`,
      this.opponent.x,
      this.opponent.y - this.opponent.h - 6
    );

    if (this.debug) {
      ctx.save();
      ctx.lineWidth = 1;
      const draw = (b, col) => {
        ctx.strokeStyle = col;
        ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
      };
      const ph = this.player.hurtbox;
      draw(ph, 'rgba(0,255,0,0.9)');
      const oh = this.opponent.hurtbox;
      draw(oh, 'rgba(255,140,0,0.9)');
      if (this.player.state === 'attack' && this.player.attackKind) {
        const hb = this.player.getHitbox(this.player.currentAnim.currentFrame);
        if (hb) {
          draw(hb, 'rgba(255,0,200,0.95)');
        }
      }
      ctx.fillStyle = '#fff';
      ctx.font = '12px ui-monospace, monospace';
      const ds = this.player.debugState;
      ctx.fillText(
        `P1 state=${this.player.state} fr=${this.player.currentAnim.currentFrame} kind=${this.player.attackKind} facing=${this.player.facing > 0 ? 'R' : 'L'}`,
        8,
        16
      );
      ctx.fillText(
        `P2 fr=${this.opponent.currentAnim.currentFrame} facing=${this.opponent.facing > 0 ? 'R' : 'L'}`,
        8,
        32
      );
      ctx.restore();
    }

    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, w, 36);
    ctx.fillStyle = '#e8eaef';
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText(
      'Arrows · Space jump · Z punch · X kick · C special · B block · D debug',
      12,
      22
    );
    ctx.textAlign = 'right';
    ctx.fillText(this.lastComboMsg, w - 12, 22);
  }
}
