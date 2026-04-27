/* Main menu overlay — Kaden Fighters. Loaded before the inline game script. */
class MainMenu {
  /** @param {HTMLElement} root */
  /** @param {{ onAction: (id: string) => void, onBack?: () => void, onExitConfirm?: () => void }} options */
  constructor(root, options) {
    this._root = root;
    this._opts = options;
    this._dialog = document.getElementById('mmExitDlg');
    this._select = root.querySelector('select.mm-select');
    this._items = this._select
      ? Array.from(this._select.querySelectorAll('option[data-id]'))
      : Array.from(root.querySelectorAll('.mm-list .mm-item'));
    this._active = false;
    this._exitOpen = false;
    this._sel = 0;
    this._hover = -1;
    this._lastHoverPlay = 0;
    this._suppressSelectChange = 0;
    this._bind();
  }

  static hoverSound() {
    /* @audio Replace with: new Audio('sfx/hover.mp3').play().catch(() => {}); */
  }
  static selectSound() {
    /* @audio Replace with: new Audio('sfx/select.mp3').play().catch(() => {}); */
  }
  static backSound() {
    /* @audio Replace with: new Audio('sfx/back.mp3').play().catch(() => {}); */
  }

  setActive(visible) {
    if (this._active === visible) return;
    this._active = visible;
    if (visible) {
      this._root.removeAttribute('hidden');
      this._root.setAttribute('aria-hidden', 'false');
      this._sel = 0;
      this._hover = -1;
      this._closeExit();
      this._suppressSelectChange = 1;
      if (this._select) {
        this._select.selectedIndex = 0;
        this._sel = 0;
      }
      const done = () => { this._suppressSelectChange = 0; };
      if (window.requestAnimationFrame) {
        requestAnimationFrame(() => { requestAnimationFrame(done); });
      } else {
        setTimeout(done, 0);
      }
      requestAnimationFrame(() => {
        const t = this._select || this._items[0];
        if (this._active && t) {
          try { t.focus({ preventScroll: true }); } catch (_) { try { t.focus(); } catch (_) { /* */ } }
        }
      });
    } else {
      this._root.setAttribute('hidden', '');
      this._root.setAttribute('aria-hidden', 'true');
      this._closeExit();
      if (this._select) { try { this._select.blur(); } catch (_) { /* */ } }
    }
    this._styleItems();
  }

  /** @returns {boolean} true = game key handler should not process further */
  isExitDialogOpen() { return !!this._exitOpen; }

  handleKeydown(e) {
    if (!this._active) return false;
    const n = this._items.length;
    if (n < 1) return false;
    if (this._exitOpen) {
      if (e.key === 'Escape' || e.key === 'Backspace') {
        e.preventDefault();
        MainMenu.backSound();
        this._closeExit();
        return true;
      }
      return false;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const w = this._sel;
      this._sel = (this._sel + n - 1) % n;
      this._applySelection();
      if (w !== this._sel) this._playHoverThrottled();
      this._styleItems();
      return true;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const w = this._sel;
      this._sel = (this._sel + 1) % n;
      this._applySelection();
      if (w !== this._sel) this._playHoverThrottled();
      this._styleItems();
      return true;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this._activateIndex(this._sel);
      return true;
    }
    if (e.key === 'Escape' || e.key === 'Backspace') {
      e.preventDefault();
      MainMenu.backSound();
      if (this._opts.onBack) this._opts.onBack();
      return true;
    }
    return false;
  }

  _applySelection() {
    if (this._select) this._select.selectedIndex = this._sel;
  }

  _playHoverThrottled() {
    const t = performance.now();
    if (t - this._lastHoverPlay < 30) return;
    this._lastHoverPlay = t;
    MainMenu.hoverSound();
  }

  _activateIndex(i) {
    const el = this._items[i];
    if (!el) return;
    const id = (el.getAttribute('data-id') != null) ? el.getAttribute('data-id') : (el.getAttribute('value') || el.value || '');
    if (!id) return;
    MainMenu.selectSound();
    this._opts.onAction(id);
  }

  openExitDialog() {
    this._openExit();
  }

  _openExit() {
    this._exitOpen = true;
    if (this._dialog && 'showModal' in this._dialog) {
      try { this._dialog.showModal(); } catch (_) { this._dialog.setAttribute('open', ''); }
    }
  }

  _closeExit() {
    this._exitOpen = false;
    if (this._dialog) {
      if (this._dialog.open && 'close' in this._dialog) this._dialog.close();
      else this._dialog.removeAttribute('open');
    }
  }

  _bind() {
    if (this._select) {
      this._select.setAttribute('tabindex', '0');
      this._select.addEventListener('pointerdown', () => { if (this._active) this._suppressSelectChange = 0; });
      this._select.addEventListener('change', () => {
        if (!this._active) return;
        if (this._suppressSelectChange) { this._suppressSelectChange = 0; return; }
        this._sel = this._select.selectedIndex;
        this._styleItems();
        this._activateIndex(this._sel);
      });
    } else {
      this._items.forEach((el, i) => {
        el.setAttribute('tabindex', '0');
        el.addEventListener('pointerenter', () => {
          if (!this._active) return;
          const w = this._sel;
          this._sel = i;
          this._hover = i;
          if (w !== this._sel) this._playHoverThrottled();
          this._styleItems();
        });
        el.addEventListener('pointerleave', () => {
          if (this._hover === i) this._hover = -1;
          this._styleItems();
        });
        el.addEventListener('click', (ev) => {
          if (!this._active) return;
          ev.stopPropagation();
          this._sel = i;
          this._activateIndex(i);
          this._styleItems();
        });
      });
    }
    this._root.querySelectorAll('.mm-aux [data-id]').forEach((btn) => {
      btn.addEventListener('click', (ev) => {
        if (!this._active) return;
        ev.stopPropagation();
        const id = btn.getAttribute('data-id') || '';
        if (id) {
          MainMenu.selectSound();
          this._opts.onAction(id);
        }
      });
    });
    const cancelB = this._root.querySelector('.mm-exit__cancel');
    if (cancelB) {
      cancelB.addEventListener('click', (ev) => {
        ev.preventDefault();
        MainMenu.backSound();
        this._closeExit();
      });
    }
    const okB = this._root.querySelector('.mm-exit__ok');
    if (okB) {
      okB.addEventListener('click', (ev) => {
        ev.preventDefault();
        MainMenu.selectSound();
        this._closeExit();
        if (this._opts.onExitConfirm) this._opts.onExitConfirm();
      });
    }
    if (this._dialog) {
      this._dialog.addEventListener('close', () => { this._exitOpen = false; });
      this._dialog.addEventListener('cancel', (e) => {
        e.preventDefault();
        MainMenu.backSound();
        this._closeExit();
      });
    }
  }

  _styleItems() {
    if (this._select) return;
    for (let i = 0; i < this._items.length; i++) {
      const b = this._items[i];
      b.classList.toggle('mm-item--sel', this._active && this._sel === i);
      b.classList.toggle('mm-item--hot', this._active && (this._hover === i));
    }
  }
}

window.MainMenu = MainMenu;
