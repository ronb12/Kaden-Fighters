/* eslint-disable */
/**
 * Leaderboard / scoreboard data layer — Kaden Fighters: Rise of Reigen
 * Placeholder + localStorage; merge with Neon API rows in the app.
 * @firebase
 *  Replace localStorage and merge logic with:
 *  - onSnapshot on Firestore 'leaderboard' / 'players' for live updates
 *  - or batch reads + Cloud Functions to aggregate weekly / friends
 *  - Keep the same field shape: see normalizeRow()
 */
(function (global) {
  const LS_RUNS = 'kfr2_lb_local_runs';
  const LS_AGG = 'kfr2_lb_aggregated';
  const LS_FRIENDS = 'kfr2_lb_friend_names';
  // @firebase: sync friend IDs with auth users / follow graph

  /** Fighters in roster (for search + display) */
  const FIGHTERS = ['KADEN', 'RAIJIN', 'HIKARI', 'REN', 'YUKI', 'REIGEN'];

  function safeJsonParse(s, d) {
    try {
      return JSON.parse(s) || d;
    } catch (_) {
      return d;
    }
  }

  function weekKey() {
    const t = new Date();
    return t.getUTCFullYear() + 'W' + getWeek(t);
  }
  function getWeek(d) {
    const x = new Date(d.getTime());
    x.setHours(0, 0, 0, 0);
    x.setDate(x.getDate() + 3 - ((x.getDay() + 6) % 7));
    return Math.ceil((x - new Date(x.getFullYear(), 0, 1)) / 864e5 / 7);
  }

  function isThisWeek(ts) {
    if (ts == null) return true;
    const t = new Date(typeof ts === 'string' || typeof ts === 'number' ? ts : Date.now());
    const now = Date.now();
    return now - t.getTime() < 7 * 864e5;
  }

  function normalizeRow(r) {
    const wins = Math.max(0, Number(r.wins) | 0);
    const losses = Math.max(0, Number(r.losses) | 0);
    const highScore = Math.max(0, Math.floor(Number(r.highScore) || 0));
    const kos = Math.max(0, Math.floor(Number(r.kos) || 0));
    const bestCombo = Math.max(0, Math.floor(Number(r.bestCombo) || 0));
    const played = Math.max(1, wins + losses);
    const winRate = r.winRate != null ? Math.max(0, Math.min(1, Number(r.winRate) || 0)) : (wins / played);
    return {
      id: String(r.id != null ? r.id : (r.player_name || 'x') + '_' + (r.fighter || '') + '_' + (r.source || 'd')),
      playerName: String(r.player_name != null ? r.player_name : r.playerName || '—').trim().slice(0, 16) || '—',
      fighter: String(r.fighter != null ? r.fighter : r.fighterUsed || '—'),
      wins,
      losses,
      kos,
      winRate,
      bestCombo,
      highScore,
      favoriteMove: String(r.favoriteMove != null ? r.favoriteMove : (r.favoriteMove || '—')) || '—',
      source: r.source != null ? r.source : (r._api ? 'api' : r._local ? 'local' : 'data'),
      createdAt: r.createdAt != null ? r.createdAt : (r.created_at != null ? r.created_at : Date.now()),
    };
  }

  function mapApiRow(row) {
    if (!row) return null;
    return normalizeRow({
      id: 'api_' + (row.id != null ? row.id : (row.player_name + '_' + row.score)),
      player_name: row.player_name,
      fighter: FIGHTERS[(row.id | 0) % FIGHTERS.length],
      wins: 0,
      losses: 0,
      kos: 0,
      highScore: row.score,
      bestCombo: 0,
      winRate: 0,
      favoriteMove: 'Tournament',
      _api: 1,
      source: 'api',
      createdAt: row.created_at,
    });
  }

  const PLACEHOLDER_25 = [
    { n: 'SHADOWFIST', f: 'KADEN', w: 34, l: 8, ko: 18, c: 12, hi: 98420, m: 'Raging Palm' },
    { n: 'VoltageKing', f: 'RAIJIN', w: 32, l: 10, ko: 20, c: 15, hi: 97200, m: 'Storm Breaker' },
    { n: 'SakuraStep', f: 'HIKARI', w: 30, l: 9, ko: 16, c: 18, hi: 96010, m: 'Sakura Step' },
    { n: 'LOTUS9', f: 'REN', w: 28, l: 11, ko: 15, c: 11, hi: 94000, m: 'Lotus Guard' },
    { n: 'FrostBite_99', f: 'YUKI', w: 27, l: 12, ko: 19, c: 14, hi: 92050, m: 'Absolute Zero' },
    { n: 'VoidWalker', f: 'REIGEN', w: 26, l: 5, ko: 22, c: 9, hi: 91000, m: 'Void Destruction' },
    { n: 'DOJO_ACE', f: 'KADEN', w: 25, l: 10, ko: 14, c: 10, hi: 90500, m: 'Kaden Fury' },
    { n: 'ThunderKid', f: 'RAIJIN', w: 24, l: 14, ko: 17, c: 8, hi: 89800, m: 'Thunder Dash' },
    { n: 'BloomQueen', f: 'HIKARI', w: 24, l: 11, ko: 12, c: 16, hi: 88888, m: 'Blossom Storm' },
    { n: 'KADEN', f: 'KADEN', w: 23, l: 6, ko: 13, c: 9, hi: 88200, m: 'Raging Palm' },
    { n: 'NinjaNorth', f: 'REN', w: 22, l: 13, ko: 11, c: 7, hi: 87000, m: 'Lotus Ascension' },
    { n: 'IceKiddo', f: 'YUKI', w: 21, l: 9, ko: 15, c: 6, hi: 86500, m: 'Frost Slide' },
    { n: 'Eclipse7', f: 'REIGEN', w: 20, l: 7, ko: 21, c: 5, hi: 86000, m: 'Eternal Darkness' },
    { n: 'HOT_ROD', f: 'KADEN', w: 19, l: 10, ko: 10, c: 6, hi: 84200, m: 'Raging Palm' },
    { n: 'StormChaser', f: 'RAIJIN', w: 18, l: 8, ko: 14, c: 5, hi: 83000, m: 'Thunder Dash' },
    { n: 'Hikari_01', f: 'HIKARI', w: 17, l: 6, ko: 9, c: 4, hi: 81000, m: 'Blossom Storm' },
    { n: 'REN_RUN', f: 'REN', w: 16, l: 12, ko: 8, c: 3, hi: 79800, m: 'Parry' },
    { n: 'SnowPrint', f: 'YUKI', w: 16, l: 9, ko: 10, c: 4, hi: 78900, m: 'Frost Slide' },
    { n: 'DARKLORD2', f: 'REIGEN', w: 15, l: 4, ko: 18, c: 2, hi: 77650, m: 'Void Destruction' },
    { n: 'FIGHTER_X', f: 'KADEN', w: 15, l: 15, ko: 7, c: 0, hi: 76000, m: 'Jab' },
    { n: 'ComboMike', f: 'RAIJIN', w: 14, l: 10, ko: 11, c: 0, hi: 74500, m: 'Chain Hit' },
    { n: 'LuckyCat', f: 'HIKARI', w: 12, l: 8, ko: 6, c: 0, hi: 70000, m: 'Dodge' },
    { n: 'BASICBOT', f: 'REN', w: 8, l: 20, ko: 2, c: 0, hi: 50000, m: 'Block' },
    { n: 'RookieK', f: 'YUKI', w: 4, l: 6, ko: 1, c: 0, hi: 12000, m: 'Frost' },
    { n: 'Trainee99', f: 'KADEN', w: 0, l: 5, ko: 0, c: 0, hi: 2100, m: 'Walk' },
    { n: 'Guest001', f: 'RAIJIN', w: 1, l: 2, ko: 0, c: 0, hi: 500, m: 'Jab' },
  ];

  function makePlaceholder() {
    const t = new Date();
    t.setDate(t.getDate() - 2);
    return PLACEHOLDER_25.map((p, i) => {
      const t2 = new Date(t.getTime() - i * 3.6e6);
      return normalizeRow({
        id: 'pl_' + i,
        player_name: p.n,
        fighter: p.f,
        wins: p.w,
        losses: p.l,
        kos: p.ko,
        bestCombo: p.c,
        highScore: p.hi,
        winRate: p.w / Math.max(1, p.w + p.l),
        favoriteMove: p.m,
        source: 'placeholder',
        createdAt: t2.toISOString(),
      });
    });
  }

  function loadLocalRuns() {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(LS_RUNS) : null;
    const a = Array.isArray(safeJsonParse(raw, [])) ? safeJsonParse(raw, []) : [];
    return a.map((x) => normalizeRow(x));
  }

  function saveLocalRuns(runs) {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(LS_RUNS, JSON.stringify(runs));
    } catch (_) {}
  }

  function loadAggregated() {
    return safeJsonParse(typeof localStorage !== 'undefined' ? localStorage.getItem(LS_AGG) : null, {
      name: 'FIGHTER',
      highScore: 0,
      wins: 0,
      losses: 0,
      kos: 0,
      bestCombo: 0,
      lastFighter: 'KADEN',
    });
  }

  function saveAggregated(a) {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(LS_AGG, JSON.stringify(a));
    } catch (_) {}
  }

  function defaultFriendList() {
    return ['Hikari_01', 'YUKI', 'BLOOMQUEEN', 'FROSTBITE_99', 'KADEN'];
  }

  function getFriendNameSet() {
    return new Set(loadFriendNames().map((x) => String(x).toUpperCase().trim()));
  }
  function loadFriendNames() {
    const r = safeJsonParse(typeof localStorage !== 'undefined' ? localStorage.getItem(LS_FRIENDS) : null, null);
    return r && r.length ? r : defaultFriendList();
  }
  function setFriendNames(names) {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(LS_FRIENDS, JSON.stringify(names));
    } catch (_) {}
  }

  /**
   * Deduplicate by id; prefer: api > local > placeholder for same name
   */
  function mergeSources(apiRows, usePlaceholder) {
    const map = new Map();
    for (const r of apiRows || []) {
      const m = mapApiRow(r);
      if (m) map.set(m.id, m);
    }
    for (const r of loadLocalRuns()) {
      const k = r.id;
      if (!map.has(k)) map.set(k, r);
    }
    if (usePlaceholder !== false) {
      for (const r of makePlaceholder()) {
        if (!map.has(r.id)) map.set(r.id, r);
      }
    }
    return Array.from(map.values());
  }

  function reRankBySort(rows, key, desc) {
    const mult = desc === false ? -1 : 1;
    const arr = rows.slice();
    if (key === 'rank' || !key) {
      return arr.sort(
        (a, b) =>
          mult * (b.highScore - a.highScore) ||
          mult * (b.wins - a.wins) ||
          (String(a.playerName) > String(b.playerName) ? 1 : -1)
      );
    }
    if (key === 'playerName') return arr.sort((a, b) => {
      const c = String(a.playerName).localeCompare(String(b.playerName), undefined, { sensitivity: 'base' });
      return mult * c || mult * (b.highScore - a.highScore);
    });
    if (key === 'wins') return arr.sort((a, b) => mult * (b.wins - a.wins) || mult * (b.highScore - a.highScore));
    if (key === 'kos') return arr.sort((a, b) => mult * (b.kos - a.kos) || mult * (b.highScore - a.highScore));
    if (key === 'winRate') return arr.sort((a, b) => mult * (b.winRate - a.winRate) || mult * (b.wins - a.wins));
    if (key === 'highScore') return arr.sort((a, b) => mult * (b.highScore - a.highScore));
    if (key === 'bestCombo') return arr.sort((a, b) => mult * (b.bestCombo - a.bestCombo) || mult * (b.highScore - a.highScore));
    return arr;
  }

  function byTab(rows, tab) {
    const t = (tab || 'global').toLowerCase();
    // global & alltime: full merged list; friends / weekly: filtered; @firebase: per-season collections
    if (t === 'global' || t === 'alltime' || t === 'all' || t === 'all-time') return rows;
    if (t === 'friends') {
      const s = getFriendNameSet();
      return rows.filter((r) => s.has(String(r.playerName).toUpperCase().trim()));
    }
    if (t === 'weekly') return rows.filter((r) => isThisWeek(r.createdAt));
    return rows;
  }

  function filterQuery(rows, q) {
    const t = (q || '').trim().toLowerCase();
    if (!t) return rows;
    return rows.filter(
      (r) =>
        String(r.playerName)
          .toLowerCase()
          .includes(t) || String(r.fighter).toLowerCase().includes(t) || t.includes(String(r.playerName).toLowerCase())
    );
  }

  function withDisplayRank(rows) {
    return rows.map((r, i) => ({ _rank: i + 1, ...r }));
  }

  /**
   * @param {object} o — one completed run
   * @param {string} o.name
   * @param {number} o.score
   * @param {string} o.fighter
   * @param {number} o.tournamentWins
   * @param {number} o.runMaxCombo
   * @param {boolean} o.won
   * @param {string} o.favoriteMove
   */
  function recordLocalRun(o) {
    if (!o) return;
    const ag = loadAggregated();
    const n = o.name != null ? String(o.name) : (ag && ag.name) || 'FIGHTER';
    const score = Math.max(0, Math.floor(Number(o.score) || 0));
    if (n && n !== 'FIGHTER') ag.name = n.slice(0, 12);
    ag.lastFighter = o.fighter != null ? String(o.fighter) : ag.lastFighter;
    ag.highScore = Math.max(ag.highScore || 0, score);
    if (o.won) {
      ag.wins = (ag.wins | 0) + 1;
    } else {
      ag.losses = (ag.losses | 0) + 1;
    }
    if (o.tournamentWins != null) {
      const tw = o.tournamentWins | 0;
      if (o.won) {
        const bonusKo = 3;
        ag.kos = (ag.kos | 0) + tw * bonusKo + 1;
      } else {
        const bonusKo = 2;
        ag.kos = (ag.kos | 0) + Math.max(0, tw) * bonusKo;
      }
    } else {
      if (o.kos) ag.kos = (ag.kos | 0) + (o.kos | 0);
    }
    if (o.runMaxCombo) ag.bestCombo = Math.max(ag.bestCombo | 0, o.runMaxCombo | 0);
    const p = (ag.wins + ag.losses) || 1;
    ag.winRate = ag.wins / p;
    if (o.favoriteMove) ag.favoriteMove = o.favoriteMove;
    else if (ag.favoriteMove == null) ag.favoriteMove = 'Raging Palm';
    saveAggregated(ag);
    const row = normalizeRow({
      id: 'me_' + Date.now(),
      player_name: n,
      fighter: ag.lastFighter,
      wins: ag.wins,
      losses: ag.losses,
      kos: ag.kos,
      highScore: score,
      bestCombo: ag.bestCombo,
      winRate: ag.winRate,
      favoriteMove: ag.favoriteMove,
      source: 'local',
      createdAt: new Date().toISOString(),
    });
    const run = { ...row, _runScore: score };
    const list = loadLocalRuns();
    list.push(run);
    if (list.length > 200) list.splice(0, list.length - 200);
    saveLocalRuns(list);
    return { aggregate: ag, run: run };
  }

  function youPanelFrom(merged, playerName) {
    const ag = loadAggregated();
    const display = (playerName && String(playerName).trim()) || (ag && ag.name) || 'KADEN';
    const nameU = String(display).toUpperCase();
    const sorted = withDisplayRank(reRankBySort(merged, 'highScore', true));
    const row = sorted.find((r) => String(r.playerName).toUpperCase() === nameU);
    const rr = {
      name: display,
      rank: row && row._rank != null ? row._rank : '—',
      wins: (ag && ag.wins) | 0,
      losses: (ag && ag.losses) | 0,
      kos: (ag && ag.kos) | 0,
      winRate: (ag && ag.winRate) != null ? ag.winRate : 0,
      highScore: (ag && ag.highScore) | 0,
      bestCombo: (ag && ag.bestCombo) | 0,
    };
    if (row) {
      rr.wins = row.wins;
      rr.losses = row.losses;
      rr.kos = row.kos;
      rr.winRate = row.winRate;
      rr.highScore = Math.max(rr.highScore, row.highScore);
      if (row.bestCombo > (rr.bestCombo | 0)) rr.bestCombo = row.bestCombo;
    }
    return rr;
  }

  global.LeaderboardData = {
    mergeSources,
    reRankBySort,
    withDisplayRank,
    byTab,
    filterQuery,
    isThisWeek,
    weekKey,
    FIGHTERS,
    recordLocalRun,
    loadLocalRuns,
    makePlaceholder,
    mapApiRow,
    youPanelFrom,
    loadAggregated,
    getFriendNameSet,
    setFriendNames,
  };
})(typeof self !== 'undefined' ? self : this);
