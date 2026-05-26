#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const gamePath = path.join(root, 'js', 'kfr-game.js');
const source = fs.readFileSync(gamePath, 'utf8');

function noop() {}

const ctx = new Proxy({}, {
  get(target, prop) {
    if (prop in target) return target[prop];
    if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => ({ addColorStop: noop });
    if (prop === 'measureText') return (s) => ({ width: String(s || '').length * 10 });
    if (prop === 'getImageData' || prop === 'createImageData') return () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 });
    return noop;
  },
  set(target, prop, value) {
    target[prop] = value;
    return true;
  }
});

function element(id = '') {
  return {
    id,
    tagName: id === 'game' ? 'CANVAS' : 'DIV',
    style: { removeProperty: noop },
    classList: { add: noop, remove: noop, toggle: noop },
    dataset: {},
    clientWidth: 1280,
    clientHeight: 720,
    width: 1280,
    height: 720,
    focus: noop,
    blur: noop,
    contains: () => false,
    closest: () => null,
    addEventListener: noop,
    removeEventListener: noop,
    querySelector: () => null,
    querySelectorAll: () => [],
    getContext: () => ctx,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 })
  };
}

class FakeImage {
  constructor() {
    this.complete = true;
    this.naturalWidth = 1280;
    this.naturalHeight = 5760;
  }
  set src(v) { this._src = v; }
  get src() { return this._src || ''; }
  addEventListener() {}
}

class StubScreen {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        if (prop in target) return target[prop];
        return noop;
      }
    });
  }
}

const sandbox = {
  console,
  Uint8ClampedArray,
  Math,
  Date,
  WeakMap,
  Map,
  Set,
  URL,
  document: {
    baseURI: 'http://127.0.0.1:8876/index.html',
    activeElement: null,
    getElementById: (id) => element(id),
    createElement: (tag) => element(tag),
    addEventListener: noop,
    removeEventListener: noop
  },
  location: {
    search: '?debug=1',
    protocol: 'http:',
    href: 'http://127.0.0.1:8876/index.html?debug=1'
  },
  navigator: {
    maxTouchPoints: 0,
    getGamepads: () => []
  },
  screen: { width: 1280, height: 720 },
  Image: FakeImage,
  KeyboardEvent: function KeyboardEvent() {},
  MainMenu: StubScreen,
  LeaderboardScreen: StubScreen,
  requestAnimationFrame: noop,
  cancelAnimationFrame: noop,
  setTimeout: noop,
  clearTimeout: noop,
  setInterval: () => 1,
  clearInterval: noop,
  performance: { now: () => Date.now() },
  addEventListener: noop,
  removeEventListener: noop,
  dispatchEvent: noop
};
sandbox.window = sandbox;

const smoke = `
(function () {
  const failures = [];
  const checks = [];
  function check(name, value, detail) {
    checks.push({ name, pass: !!value, detail: detail || '' });
    if (!value) failures.push(name + (detail ? ': ' + detail : ''));
  }

  state = 'fight';
  playMode = 'tournament';
  p2IsHuman = false;
  sel = 0;
  oppIndex = 1;
  p1 = makeFighter(0, 260, false);
  p2 = makeFighter(1, 860, true);
  resetCombo(p1);
  resetCombo(p2);
  check('initial spacing', Math.abs(p2.x - p1.x) >= 500, 'distance=' + Math.abs(p2.x - p1.x));
  check('banter covers full cast', characters.every((_, i) => !!BANTER[i]), 'banter=' + Object.keys(BANTER).length);

  sel = 0;
  oppIndex = 6;
  newRound();
  check('intro rivalry banter appears', banterLeft && banterRight && /kicks|precision/i.test(banterLeft.text + ' ' + banterRight.text), (banterLeft && banterLeft.text) + ' / ' + (banterRight && banterRight.text));

  p1.x = 470;
  p2.x = 610;
  p1.flip = false;
  p2.flip = true;
  p1.meter = 100;
  p2.health = 100;
  const beforeMeter = p1.meter;
  const beforeSpecial = p2.health;
  special(p1, 2);
  check('special variant spends meter', p1.meter < beforeMeter, 'meter=' + p1.meter);
  check('special variant hits or creates pressure', p2.health < beforeSpecial || projectiles.length > 0, 'hp=' + p2.health + ' projectiles=' + projectiles.length);

  p1 = makeFighter(0, 410, false);
  p2 = makeFighter(1, 605, true);
  resetCombo(p1);
  resetCombo(p2);
  state = 'fight';
  p2.health = 100;
  const beforeKick = p2.health;
  attack(p1, 'round kick', 9, 150);
  check('kick steps into contact', p2.health < beforeKick, 'hp=' + p2.health + ' p1.x=' + p1.x);

  p1 = makeFighter(0, 470, false);
  p2 = makeFighter(1, 600, true);
  resetCombo(p1);
  resetCombo(p2);
  state = 'fight';
  p2.health = 100;
  attack(p1, 'jab', 5, 160); p1.lock = 0;
  attack(p1, 'round kick', 9, 180); p1.lock = 0;
  attack(p1, 'spin kick', 13, 190);
  check('style combo adds damage', p2.health <= 64, 'p2.health=' + p2.health);
  check('style combo callout', /TORNADO TAEKWONDO/.test(msg), 'msg=' + msg);
  check('combo banter fires', !!(banterLeft && banterLeft.text), banterLeft && banterLeft.text);

  p1 = makeFighter(5, 470, false);
  p2 = makeFighter(1, 600, true);
  resetCombo(p1);
  resetCombo(p2);
  state = 'fight';
  p1.health = 25;
  lastBanterAt = 0;
  attack(p1, 'haymaker', 15, 190);
  check('comeback banter fires', !!(banterLeft && /Still standing|Bad news/i.test(banterLeft.text)), banterLeft && banterLeft.text);

  p1 = makeFighter(0, 470, false);
  p2 = makeFighter(1, 600, true);
  resetCombo(p1);
  resetCombo(p2);
  p1wins = 0;
  p2wins = 0;
  state = 'fight';
  p2.health = 7;
  attack(p1, 'spin kick', 13, 190);
  hitPause = 0;
  update._tLast = performance.now() - 16;
  update();
  check('KO enters finishing replay', state === 'finishreplay', 'state=' + state);
  check('finish replay names move', finishReplay && finishReplay.move === 'DRAGON TORNADO BREAK', finishReplay && finishReplay.move);
  if (finishReplay) finishReplay.started = performance.now() - finishReplay.duration - 1;
  drawFinishReplay();
  check('finishing replay resolves roundover', state === 'roundover', 'state=' + state);
  check('winner awarded after replay', p1wins === 1, 'p1wins=' + p1wins);

  check('expanded roster count', SELECTABLE_COUNT === 10, 'SELECTABLE_COUNT=' + SELECTABLE_COUNT);
  check('boss index moved after new roster', BOSS_INDEX === 10, 'BOSS_INDEX=' + BOSS_INDEX);
  ['MARCUS', 'AIKO', 'LUNA', 'DANTE', 'SARI'].forEach((name, offset) => {
    const charIdx = 5 + offset;
    check(name + ' roster entry', characters[charIdx] && characters[charIdx].name === name, characters[charIdx] && characters[charIdx].name);
    check(name + ' has ASTRA sheet slot', !!ASTRA_FIGHTER_SHEET_SRC[charIdx], ASTRA_FIGHTER_SHEET_SRC[charIdx]);

    p1 = makeFighter(charIdx, 470, false);
    p2 = makeFighter((charIdx + 1) % SELECTABLE_COUNT, 600, true);
    resetCombo(p1);
    resetCombo(p2);
    state = 'fight';
    p1.meter = 100;
    p2.health = 100;
    const before = p2.health;
    special(p1, 1);
    check(name + ' special hits or pressures', p2.health < before || projectiles.length > 0 || p1.parry > 0 || p1.armor > 0, 'hp=' + p2.health + ' projectiles=' + projectiles.length + ' parry=' + p1.parry + ' armor=' + p1.armor);

    const combo = styleComboForChar(charIdx);
    p1 = makeFighter(charIdx, 470, false);
    p2 = makeFighter((charIdx + 1) % SELECTABLE_COUNT, 600, true);
    resetCombo(p1);
    resetCombo(p2);
    state = 'fight';
    p2.health = 100;
    for (let i = 0; i < combo.seq.length; i++) {
      const moveName = combo.seq[i];
      const mv = moveSetForChar(charIdx).find(m => m[0] === moveName) || [moveName, 8, 180];
      attack(p1, mv[0], mv[1], Math.max(mv[2], 190));
      p1.lock = 0;
    }
    check(name + ' style combo damages', p2.health <= 78, 'hp=' + p2.health + ' combo=' + combo.name);
    check(name + ' style combo callout', msg.indexOf(combo.name) >= 0, 'msg=' + msg);

    p1 = makeFighter(charIdx, 470, false);
    p2 = makeFighter((charIdx + 1) % SELECTABLE_COUNT, 600, true);
    resetCombo(p1);
    resetCombo(p2);
    p1wins = 0;
    p2wins = 0;
    state = 'fight';
    p2.health = 6;
    attack(p1, moveSetForChar(charIdx)[9][0], 18, 195);
    hitPause = 0;
    update._tLast = performance.now() - 16;
    update();
    check(name + ' KO enters finishing replay', state === 'finishreplay', 'state=' + state);
    check(name + ' finishing move name', finishReplay && finishReplay.move === finishingMoveNameForChar(charIdx), finishReplay && finishReplay.move);
    if (finishReplay) finishReplay.started = performance.now() - finishReplay.duration - 1;
    drawFinishReplay();
    check(name + ' finishing replay resolves', state === 'roundover', 'state=' + state);
  });

  return { checks, failures };
})()
`;

try {
  const result = vm.runInNewContext(source + '\n' + smoke, sandbox, { timeout: 8000 });
  for (const c of result.checks) {
    console.log((c.pass ? 'OK  ' : 'FAIL') + ' ' + c.name + (c.detail ? ' - ' + c.detail : ''));
  }
  if (result.failures.length) {
    console.error('\\nGameplay smoke failed:\\n' + result.failures.join('\\n'));
    process.exit(1);
  }
  console.log('\\nGameplay smoke: all checks passed');
} catch (err) {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
}
