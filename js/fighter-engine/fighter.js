import { Animation } from './Animation.js';
import { layoutCroppedInSlot, setPixelArtCanvasState } from './renderSpec.js';

const GRAVITY = 1800;
const WALK = 220;
const JUMP = -520;

/** @typedef {'idle'|'walk'|'jump'|'attack'|'hit'|'block'} FState */
/** @typedef {'punch'|'kick'|'special'|null} AttackKind */

/**
 * @param {Record<string, Animation>} anims
 * @param {string} name
 * @param {string} [fallback]
 */
function playAnimDef(anims, name, fallback) {
  const a = anims[name] || anims[fallback] || anims['idle'];
  a.reset();
  return a;
}

export class Fighter {
  /**
   * @param {import('./fighterConfig.js').CharacterFighterConfig} config
   * @param {Record<string, Animation>} anims
   * @param {{ x: number; floorY: number; facing: 1 | -1; mode: 'player' | 'cpu'; input?: import('./Input.js').Input | null }} opts
   */
  constructor(config, anims, opts) {
    this.config = config;
    this.anims = anims;
    this.floorY = opts.floorY;
    this.mode = opts.mode;
    this.input = opts.input || null;
    this.x = opts.x;
    this.w = config.slot.w;
    this.h = config.slot.h;
    this.y = this.floorY;
    this.facing = opts.facing;
    /** @type {number | null} — set by Game each frame for CPU: opponent world X for facing */
    this._opponentX = null;
    this.vx = 0;
    this.vy = 0;
    /** @type {FState} */
    this.state = 'idle';
    this.currentAnim = playAnimDef(anims, 'idle', 'idle');
    this.onGround = true;
    /** @type {AttackKind} */
    this.attackKind = null;
    this.dealtHitThisAttack = false;
    this.comboStep = 0;
    this.comboTime = 0;
    this.comboWindow = 0.45;
    this.blockPressed = false;
    this.hp = 100;
  }

  get hurtbox() {
    const h = this.config.hurtbox;
    const top = this.y - this.h;
    return {
      x: this.x + h.relX * this.w,
      y: top + h.relY * this.h,
      w: h.relW * this.w,
      h: h.relH * this.h,
    };
  }

  /**
   * Hitboxes align to attack **animation** hitFrames; box position uses slot + facing.
   * @param {number} frameIndex
   * @returns {{x:number;y:number;w:number;h:number;damage:number}|null}
   */
  getHitbox(frameIndex) {
    if (this.state !== 'attack' || !this.attackKind) return null;
    const kind = this.attackKind;
    const adef = this.config.anims[kind];
    if (!adef || !adef.hitFrames || !adef.hitFrames.includes(frameIndex)) return null;
    const box = this.config.hitboxes[kind];
    if (!box) return null;
    const top = this.y - this.h;
    let hx = this.x + box.relX * this.w;
    if (this.facing < 0) {
      hx = this.x + (1 - box.relX - box.relW) * this.w;
    }
    return {
      x: hx,
      y: top + box.relY * this.h,
      w: box.relW * this.w,
      h: box.relH * this.h,
      damage: box.damage,
    };
  }

  /**
   * @param {import('./Input.js').Input} input
   * @param {number} dt
   * @param {number} worldW
   */
  update(input, dt, worldW) {
    if (this.mode === 'cpu') {
      if (this._opponentX != null) {
        this.facing = this._opponentX < this.x ? -1 : 1;
      }
    }

    this.blockPressed = this.mode === 'player' && input ? input.block() : false;

    if (this.state === 'hit' && this.currentAnim.done) {
      this._enter('idle', false);
    }

    if (this.state === 'hit') {
      this.currentAnim.update(dt);
      this.vx = 0;
      this.vy += GRAVITY * dt;
      this.y += this.vy * dt;
      this._floor();
      return;
    }

    if (this.state === 'block') {
      this.currentAnim.update(dt);
      this.vx = 0;
      if (!this.blockPressed) this._enter('idle', false);
      return;
    }

    if (this.state === 'attack' && this.currentAnim.done) {
      this.attackKind = null;
      this.dealtHitThisAttack = false;
      this._enter(this.onGround ? 'idle' : 'jump', true);
    }

    if (this.state === 'attack') {
      this.currentAnim.update(dt);
      this.vx = this.facing * 40;
      this.vy += GRAVITY * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this._floor();
      this._clampX(worldW);
      return;
    }

    if (this.mode === 'cpu') {
      this.vx = 0;
      this.currentAnim.update(dt);
      this._floor();
      this._enter('idle', false);
      this._clampX(worldW);
      return;
    }

    if (this.onGround && this.blockPressed) {
      if (this.state !== 'block') {
        this._enter('block', true);
        this.vx = 0;
      }
      this.currentAnim.update(dt);
      this.vx = 0;
      return;
    } else if (this.state === 'block') {
      this._enter('idle', true);
    }

    this.vx = 0;
    if (input) {
      if (input.left()) {
        this.vx = -WALK;
        this.facing = -1;
      } else if (input.right()) {
        this.vx = WALK;
        this.facing = 1;
      }
    }

    if (this.onGround && !this.blockPressed) {
      if (this.vx !== 0 && this.state !== 'walk' && this.state !== 'attack') {
        this._enter('walk', true);
      } else if (this.vx === 0 && (this.state === 'walk' || this.state === 'idle')) {
        this._enter('idle', true);
      }
    }

    if (this.onGround && input && input.jump()) {
      this.vy = JUMP;
      this.onGround = false;
      this._enter('jump', true);
    }

    this._startAttack(input, worldW);
    if (this.state === 'attack') {
      this.currentAnim.update(dt);
      this._moveAttack(dt, worldW);
      return;
    }

    this.vy += GRAVITY * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this._floor();

    if (this.onGround) {
      if (this.vx === 0) this._enter('idle', false);
      else this._enter('walk', false);
    } else {
      this._enter('jump', false);
    }

    this.currentAnim.update(dt);
    this._clampX(worldW);
  }

  _startAttack(input, _worldW) {
    if (this.state === 'hit') return;
    if (this.state === 'attack' && !this.currentAnim.done) return;
    if (!this.onGround) return;
    let kind = null;
    if (input && input.punch()) {
      kind = 'punch';
    } else if (input && input.kick()) {
      kind = 'kick';
    } else if (input && input.special()) {
      kind = 'special';
    }
    if (!kind) return;
    this.state = 'attack';
    this.attackKind = kind;
    this.dealtHitThisAttack = false;
    const time = (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
    if (time - this.comboTime < this.comboWindow) {
      this.comboStep = (this.comboStep + 1) % 3;
    } else {
      this.comboStep = 0;
    }
    this.comboTime = time;
    const an = this.anims[kind];
    an.reset();
    this.currentAnim = an;
  }

  /**
   * @param {FState} state
   * @param {boolean} hardReset
   */
  _enter(state, hardReset) {
    if (this.state === state && !hardReset) {
      this.currentAnim.update(0.0001);
      return;
    }
    this.state = state;
    const map = {
      idle: 'idle',
      walk: 'walk',
      jump: 'jump',
      hit: 'hit',
      block: 'block',
    };
    if (state === 'attack') return;
    const name = map[state] || 'idle';
    this.currentAnim = playAnimDef(this.anims, name, 'idle');
  }

  _moveAttack(dt, worldW) {
    this.vy += GRAVITY * dt;
    this.x += this.facing * 40 * dt;
    this.y += this.vy * dt;
    this._floor();
    this._clampX(worldW);
  }

  _floor() {
    if (this.y >= this.floorY) {
      this.y = this.floorY;
      this.vy = 0;
      this.onGround = true;
    } else {
      this.onGround = false;
    }
  }

  _clampX(worldW) {
    this.x = Math.max(0, Math.min(worldW - this.w, this.x));
  }

  takeHit(damage) {
    if (this.state === 'block') return 0;
    const d = damage | 0;
    this.hp = Math.max(0, (this.hp | 0) - d);
    this._enter('hit', true);
    this.vy = -150;
    this.facing = -this.facing;
    this.comboTime = 0;
    this.comboStep = 0;
    return d;
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   */
  draw(ctx) {
    const c = this.config;
    const layout = layoutCroppedInSlot({
      slotW: this.w,
      slotH: this.h,
      sourceFrameW: c.sourceFrame.w,
      sourceFrameH: c.sourceFrame.h,
      groundAnchorY: c.groundAnchorY,
      worldLeft: this.x,
      worldFeetY: this.y,
    });
    const cx = this.x + this.w * 0.5;
    ctx.save();
    if (this.facing < 0) {
      ctx.translate(cx, 0);
      ctx.scale(-1, 1);
      ctx.translate(-cx, 0);
    }
    setPixelArtCanvasState(ctx);
    this.currentAnim.draw(ctx, layout.dx, layout.dy, layout.dw, layout.dh, c.placeholderColor);
    ctx.restore();
  }

  get debugState() {
    return {
      state: this.state,
      comboStep: this.comboStep,
      attackKind: this.attackKind,
      facing: this.facing,
    };
  }
}

/** @deprecated use Fighter + HERO_FIGHTER */
export function buildPlaceholderAnimations(frames) {
  const mk = (name, frameCount, loop, fps, row) => {
    return new Animation({
      name,
      image: null,
      frameWidth: 128,
      frameHeight: 128,
      row: row | 0,
      frameCount,
      fps,
      loop,
    });
  };
  return {
    idle: mk('idle', frames || 4, true, 8, 0),
    walk: mk('walk', 4, true, 10, 0),
    jump: mk('jump', 1, true, 10, 0),
    punch: mk('punch', 5, false, 14, 0),
    kick: mk('kick', 6, false, 12, 0),
    hit: mk('hit', 2, false, 12, 0),
    block: mk('block', 1, true, 10, 0),
    special: mk('special', 4, false, 10, 0),
  };
}

