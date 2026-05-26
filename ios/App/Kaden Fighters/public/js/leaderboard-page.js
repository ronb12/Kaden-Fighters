/* Standalone /leaderboard.html — fetches and shows global board without the canvas game. */
(function () {
  'use strict';
  const LEADERBOARD_STUB_URL = 'assets/leaderboard-stub.json';
  const LEADERBOARD_PRODUCTION_URL = 'https://kaden-fighter.vercel.app/api/high-scores';
  const LS_PLAYER_NAME = 'kadenFighterName';
  let leaderboardRows = [];
  let leaderboardLoadState = 'idle';

  function getHighScoresListUrl() {
    if (typeof window === 'undefined' || !window) return LEADERBOARD_STUB_URL;
    if (window.__KADEN_LEADERBOARD_GET_URL != null && String(window.__KADEN_LEADERBOARD_GET_URL) !== '') {
      return String(window.__KADEN_LEADERBOARD_GET_URL);
    }
    var p = (location && location.port) || '';
    var h = (location && location.hostname) || '';
    var pr = (location && location.protocol) || '';
    if (pr === 'file:') return LEADERBOARD_PRODUCTION_URL;
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

  function getPlayerName() {
    try {
      const s = localStorage.getItem(LS_PLAYER_NAME);
      if (s && String(s).trim()) return String(s).trim().slice(0, 12);
    } catch (_) { /* */ }
    return 'FIGHTER';
  }

  async function fetchLeaderboard() {
    leaderboardLoadState = 'loading';
    leaderboardRows = [];
    async function loadStub() {
      const sr = await fetch(LEADERBOARD_STUB_URL, { cache: 'no-store' });
      if (!sr || !sr.ok) throw new Error('stub leaderboard unavailable');
      const sj = await sr.json();
      leaderboardRows = sj && Array.isArray(sj.scores) ? sj.scores : [];
      leaderboardLoadState = 'ok';
    }
    try {
      const url = getHighScoresListUrl();
      const r = await fetch(url, { cache: 'no-store' });
      if (!r || !r.ok) {
        await loadStub();
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
        await loadStub();
      }
    } catch (_) {
      try {
        await loadStub();
      } catch (__) {
        leaderboardLoadState = 'error';
      }
    }
  }

  const root = document.getElementById('leaderboardHost');
  if (!root || typeof LeaderboardScreen === 'undefined') return;

  const screen = new LeaderboardScreen(root, {
    getPlayerName: getPlayerName,
    getApiRows: function () { return leaderboardRows; },
    getLoadState: function () { return leaderboardLoadState; },
    onFetchRemote: fetchLeaderboard,
    onBack: function () { location.href = 'index.html'; }
  });

  function onKeydown(e) {
    if (e.target && e.target.id === 'lbSearch' && (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Home' || e.key === 'End')) {
      return;
    }
    if (screen.interceptKeydown(e)) {
      e.preventDefault();
    }
  }
  window.addEventListener('keydown', onKeydown, { capture: true });
  screen.setActive(true);
})();
