/**
 * Keyboard + touch: Arrows, Z punch, X kick, C special, Space jump, B block. Touch: data-fc.
 */
export class Input {
  constructor() {
    this.keys = new Set();
    this._zPrev = false;
    this._xPrev = false;
    this._cPrev = false;
    this._spacePrev = false;
    this._edgePunch = false;
    this._edgeKick = false;
    this._edgeSpecial = false;
    this._edgeJump = false;
    this._touchDir = null;
    this._touchJump = false;
    this._touchPunch = false;
    this._touchKick = false;
    this._touchBlock = false;
    this._onDown = (e) => {
      e.preventDefault();
      this._key(e, true);
    };
    this._onUp = (e) => {
      e.preventDefault();
      this._key(e, false);
    };
    this._onBlur = () => this.keys.clear();
  }

  _key(e, down) {
    const c = (e.key || '').toLowerCase();
    const map = {
      ' ': 'space',
      'arrowup': 'up',
      'arrowdown': 'down',
      'arrowleft': 'left',
      'arrowright': 'right',
    };
    const k = map[c] || c;
    if (down) this.keys.add(k);
    else this.keys.delete(k);
  }

  bind(windowObj) {
    const w = windowObj || (typeof window !== 'undefined' ? window : null);
    if (!w) return;
    w.addEventListener('keydown', this._onDown, { passive: false });
    w.addEventListener('keyup', this._onUp, { passive: false });
    w.addEventListener('blur', this._onBlur);
  }

  unbind(windowObj) {
    const w = windowObj || (typeof window !== 'undefined' ? window : null);
    if (!w) return;
    w.removeEventListener('keydown', this._onDown);
    w.removeEventListener('keyup', this._onUp);
    w.removeEventListener('blur', this._onBlur);
  }

  left() {
    return this.keys.has('left') || this._touchDir === 'left';
  }
  right() {
    return this.keys.has('right') || this._touchDir === 'right';
  }
  up() {
    return this.keys.has('up');
  }
  down() {
    return this.keys.has('down');
  }

  block() {
    return this.keys.has('b') || this._touchBlock;
  }

  poll() {
    const z = this.keys.has('z');
    const x = this.keys.has('x');
    const c = this.keys.has('c');
    const sp = this.keys.has('space');
    this._edgePunch = (z && !this._zPrev) || this._touchPunch;
    this._edgeKick = (x && !this._xPrev) || this._touchKick;
    this._edgeSpecial = c && !this._cPrev;
    this._edgeJump = (sp && !this._spacePrev) || this._touchJump;
    this._zPrev = z;
    this._xPrev = x;
    this._cPrev = c;
    this._spacePrev = sp;
  }

  punch() {
    return this._edgePunch;
  }
  kick() {
    return this._edgeKick;
  }
  special() {
    return this._edgeSpecial;
  }
  jump() {
    return this._edgeJump;
  }

  endFrame() {
    this._touchPunch = false;
    this._touchKick = false;
    this._touchJump = false;
  }

  /**
   * @param {HTMLElement} root
   */
  bindTouch(root) {
    if (!root) return;
    const bind = (el, onStart, onEnd) => {
      if (!el) return;
      const start = (e) => {
        e.preventDefault();
        onStart();
      };
      const end = (e) => {
        e.preventDefault();
        onEnd();
      };
      el.addEventListener('touchstart', start, { passive: false });
      el.addEventListener('touchend', end, { passive: false });
      el.addEventListener('touchcancel', end, { passive: false });
    };
    bind(root.querySelector('[data-fc="left"]'), () => (this._touchDir = 'left'), () => (this._touchDir = null));
    bind(root.querySelector('[data-fc="right"]'), () => (this._touchDir = 'right'), () => (this._touchDir = null));
    bind(
      root.querySelector('[data-fc="jump"]'),
      () => (this._touchJump = true),
      () => {}
    );
    bind(
      root.querySelector('[data-fc="punch"]'),
      () => (this._touchPunch = true),
      () => {}
    );
    bind(
      root.querySelector('[data-fc="kick"]'),
      () => (this._touchKick = true),
      () => {}
    );
    const blockEl = root.querySelector('[data-fc="block"]');
    if (blockEl) {
      const start = (e) => {
        e.preventDefault();
        this._touchBlock = true;
      };
      const end = (e) => {
        e.preventDefault();
        this._touchBlock = false;
      };
      blockEl.addEventListener('touchstart', start, { passive: false });
      blockEl.addEventListener('touchend', end, { passive: false });
      blockEl.addEventListener('touchcancel', end, { passive: false });
    }
  }
}
