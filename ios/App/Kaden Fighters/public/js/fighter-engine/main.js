import { Game } from './Game.js';

const canvas = document.getElementById('fighter-canvas');
if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
  throw new Error('#fighter-canvas missing');
}

const params = new URLSearchParams(window.location.search);
const sheetUrl = params.get('sheet') || undefined;
const sheet1 = params.get('sheet1') || sheetUrl || undefined;
const sheet2 = params.get('sheet2') || undefined;

function sizeCanvas() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.min(960, Math.floor(window.innerWidth - 16));
  const h = 480;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  const ctx = canvas.getContext('2d');
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return w;
}

const initialW = sizeCanvas();
const game = new Game(canvas, {
  url: sheetUrl || undefined,
  p1Sheet: sheet1,
  p2Sheet: sheet2,
});
game.worldW = initialW;
window.addEventListener('resize', () => {
  game.worldW = sizeCanvas();
});

if (params.get('debug') === '1') {
  game.setDebug(true);
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'd' || e.key === 'D') {
    e.preventDefault();
    game.setDebug(!game.debug);
  }
});

game.start();
