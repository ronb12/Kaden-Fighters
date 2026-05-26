/* Kaden Fighters: Rise of Reigen — interactive HTML leaderboard (overlay on #gameShell) */
(function (W) {
  'use strict';

  class LeaderboardScreen {
    constructor(root, opts) {
      this.root = root;
      this.getPlayerName = opts.getPlayerName || (() => 'KADEN');
      this.getApiRows = opts.getApiRows;
      this.getLoadState = opts.getLoadState;
      this.onBack = opts.onBack;
      this.onFetchRemote = opts.onFetchRemote || (() => W.Promise.resolve());
      this.merged = [];
      this._tab = 'global';
      this._sort = 'rank';
      this._search = '';
      this._sel = 0;
      this._viewRows = [];
      this._active = false;
      this._refs = this._mapRefs();
      this._bindUi();
    }

    _mapRefs() {
      return {
        tableWrap: this.$('lbTableWrap'),
        tb: this.$('lbTbody'),
        you: this.$('lbYou'),
        search: this.$('lbSearch'),
        refresh: this.$('lbRefresh'),
        back: this.$('lbBack'),
        loadBar: this.$('lbLoad'),
        errBar: this.$('lbErr'),
        titleWrap: this.$('lbTitleWrap'),
        dlg: this.$('lbDetail'),
      };
    }

    $(id) { return W.document.getElementById(id); }

    setActive(on) {
      if (this._active === on) return;
      this._active = on;
      if (on) {
        this.root.removeAttribute('hidden');
        this.root.setAttribute('aria-hidden', 'false');
        this._sel = 0;
        this._refresh();
      } else {
        this.root.setAttribute('hidden', '');
        this.root.setAttribute('aria-hidden', 'true');
        this._closeModal();
      }
    }

    isModalOpen() { return this._refs.dlg && (this._refs.dlg.hasAttribute('open') || this._refs.dlg.open); }

    _closeModal() {
      if (this._refs.dlg && this._refs.dlg.open) { try { this._refs.dlg.close(); } catch (_){} }
    }

    /**
     * @returns {boolean} true = stop (handled)
     */
    interceptKeydown(e) {
      if (!this._active) return false;
      const tg = e.target;
      if (tg && (tg.id === 'lbSearch' || (tg.classList && tg.classList.contains('lb-srch'))) && (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Enter' || (e.key === ' ' && tg.type === 'search'))) {
        return false;
      }
      if (e.key === ' ' && this._viewRows && this._viewRows.length) {
        e.preventDefault();
        this._openRowDetail(this._sel);
        return true;
      }
      if (this._refs.dlg && this._refs.dlg.open) {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          if (W.MainMenu && W.MainMenu.backSound) W.MainMenu.backSound();
          this._closeModal();
        }
        return e.key === 'Escape';
      }
      if (e.key === 'ArrowUp') { e.preventDefault(); this._nudgeSel(-1); return true; }
      if (e.key === 'ArrowDown') { e.preventDefault(); this._nudgeSel(1); return true; }
      if (e.key === 'Enter' || (e.key === ' ' && e.target === W.document.body)) {
        e.preventDefault();
        this._openRowDetail(this._sel);
        return true;
      }
      if (e.key === 'Escape' || e.key === 'Backspace') {
        e.preventDefault();
        if (W.MainMenu && W.MainMenu.backSound) W.MainMenu.backSound();
        this.setActive(false);
        this.onBack && this.onBack();
        return true;
      }
      return false;
    }

    _nudgeSel(d) {
      const n = this._viewRows.length;
      if (n < 1) return;
      this._sel = (this._sel + d + n) % n;
      this._updateRowClasses();
    }

    _openRowDetail(index) {
      const row = this._viewRows[index];
      if (!row) return;
      const a = row;
      this.setModalFields(a, index);
      if (this._refs.dlg) this._refs.dlg.showModal();
    }

    setModalFields(a) {
      const set = (id, t) => { const el = this.$(id); if (el) el.textContent = t; };
      set('dlName', a.playerName);
      set('dlFighter', a.fighter);
      set('dlWins', String(a.wins));
      set('dlLosses', String(a.losses));
      set('dlKo', String(a.kos));
      set('dlWrate', (a.winRate * 100).toFixed(1) + '%');
      set('dlFav', a.favoriteMove);
      set('dlCombo', String(a.bestCombo));
      set('dlHi', String(a.highScore));
    }

    _bindUi() {
      this.$('lbDetClose') && this.$('lbDetClose').addEventListener('click', () => { this._closeModal(); });
      this.$('dlOk') && this.$('dlOk').addEventListener('click', () => { this._closeModal(); });
      if (this._refs.search) {
        this._refs.search.addEventListener('input', (e) => {
          this._search = (e.target && e.target.value) || '';
          this._rebuild();
        });
      }
      this._refs.refresh && this._refs.refresh.addEventListener('click', (ev) => {
        ev.preventDefault();
        this._refresh();
      });
      this._refs.back && this._refs.back.addEventListener('click', () => {
        if (W.MainMenu && W.MainMenu.backSound) W.MainMenu.backSound();
        this.setActive(false);
        this.onBack && this.onBack();
      });
      for (const b of W.document.querySelectorAll('#lbTabs .lb-tab')) {
        b.addEventListener('click', (ev) => {
          for (const x of W.document.querySelectorAll('#lbTabs .lb-tab')) { x.setAttribute('aria-pressed', 'false'); }
          b.setAttribute('aria-pressed', 'true');
          this._tab = b.getAttribute('data-tab') || 'global';
          this._rebuild();
        });
      }
      for (const b of W.document.querySelectorAll('.lb-th-sort')) {
        b.addEventListener('click', (ev) => {
          for (const x of W.document.querySelectorAll('.lb-th-sort')) { x.setAttribute('aria-pressed', 'false'); }
          b.setAttribute('aria-pressed', 'true');
          this._sort = b.getAttribute('data-sort') || 'highScore';
          this._rebuild();
        });
      }
    }

    _refresh() {
      const p = this.onFetchRemote();
      W.Promise.resolve(p).then(() => { this._rebuild(); }).catch(() => { this._rebuild(); });
    }

    _rebuild() {
      if (!W.LeaderboardData) return;
      const LD = W.LeaderboardData;
      const st = (this.getLoadState && this.getLoadState()) || 'idle';
      if (this._refs.loadBar) this._refs.loadBar.style.display = st === 'loading' ? 'block' : 'none';
      if (this._refs.errBar) {
        const off = (this.getLoadState && this.getLoadState()) === 'error';
        this._refs.errBar.style.display = off ? 'block' : 'none';
        this._refs.errBar.textContent = off
          ? 'Server unavailable — using local + sample. @firebase: use Firestore snapshot here.'
          : '';
      }
      const api = (this.getApiRows && this.getApiRows()) || [];
      this.merged = LD.mergeSources(api, true);
      const fTab = LD.byTab(this.merged, this._tab);
      const f2 = LD.filterQuery(fTab, this._search);
      const sKey = this._sort;
      const sorted0 = LD.reRankBySort(f2, sKey, true);
      this._viewRows = LD.withDisplayRank(sorted0);
      this._sel = Math.max(0, Math.min(this._sel, this._viewRows.length - 1));
      this._drawTable();
      this._you();
    }

    _drawTable() {
      if (!this._refs.tb) return;
      this._refs.tb.textContent = '';
      for (let i = 0; i < this._viewRows.length; i++) {
        const d = this._viewRows[i];
        const tr = W.document.createElement('tr');
        if (d._rank <= 3) tr.classList.add('lb-row--top' + d._rank);
        if (i === this._sel) tr.classList.add('lb-row--sel');
        tr.dataset.index = i;
        tr.setAttribute('role', 'row');
        tr.setAttribute('tabindex', '0');
        tr.setAttribute('aria-selected', i === this._sel ? 'true' : 'false');
        const add = (cls, t) => {
          const td = W.document.createElement('td');
          if (cls) td.className = cls;
          td.appendChild(W.document.createTextNode(t));
          tr.appendChild(td);
        };
        const pct = (d.winRate * 100).toFixed(0);
        add('num', String(d._rank));
        add(null, d.playerName);
        add(null, d.fighter);
        add('num', String(d.wins));
        add('num', String(d.kos));
        add('num', pct + '%');
        add('num', String(d.bestCombo));
        add('num', String(d.highScore));
        tr.addEventListener('pointerenter', () => { this._sel = (tr.dataset.index|0) || 0; this._updateRowClasses(); });
        tr.addEventListener('click', (ev) => { ev.stopPropagation(); this._sel = (tr.dataset.index|0) || 0; this._openRowDetail(this._sel); });
        this._refs.tb.appendChild(tr);
      }
    }

    _updateRowClasses() {
      for (const tr of this._refs.tb ? this._refs.tb.querySelectorAll('tr') : []) {
        const j = (tr.getAttribute('data-index')|0) || 0;
        tr.classList.toggle('lb-row--sel', j === this._sel);
        tr.setAttribute('aria-selected', j === this._sel ? 'true' : 'false');
      }
    }

    _you() {
      if (!W.LeaderboardData) return;
      const p = (this.getPlayerName && this.getPlayerName()) || 'KADEN';
      const y = W.LeaderboardData.youPanelFrom(this.merged, p);
      const w = (v) => (v == null ? '—' : v);
      const t = (id, v) => { const e = this.$(id); if (e) e.textContent = v; };
      t('lbYName', w((y && y.name) != null ? y.name : p));
      t('lbYRank', String((y && y.rank) != null ? y.rank : '—'));
      t('lbYWins', String((y && y.wins) | 0));
      t('lbYKo', String((y && y.kos) | 0));
      t('lbYWr', (y && y.winRate != null ? (y.winRate * 100).toFixed(1) : '0.0') + '%');
      t('lbYHi', String((y && y.highScore) | 0));
    }
  }

  W.LeaderboardScreen = LeaderboardScreen;
})(typeof self !== 'undefined' ? self : this);
