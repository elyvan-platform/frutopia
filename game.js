/* Frutopia — jogo de fusão de frutas. Sem dependências, sem assets. */
"use strict";

/* Leaderboard online (opcional): cola aqui o URL do worker depois do deploy
   (ver worker/README.md). Vazio = leaderboard escondido, jogo 100% offline. */
const LEADERBOARD_URL = "";

/* ---------------------------------------------------------------- i18n */

const PT = navigator.language && navigator.language.toLowerCase().startsWith("pt");
const T = PT ? {
  score: "Pontos", best: "Recorde", next: "Próxima",
  hint: "Toca para largar a fruta · junta duas iguais!",
  over: "Fim do jogo!", newRecord: "🎉 Novo recorde!", pts: "pontos",
  again: "Jogar de novo", share: "Partilhar 📋", copied: "Resultado copiado!",
  biggest: "Maior fruta", classic: "Clássico", daily: "Diário",
  shareClassic: "Clássico", shareDaily: "Desafio Diário",
  streak: "dias seguidos", lbTitle: "🏆 Top 10", lbEmpty: "Ainda sem resultados — sê o primeiro!",
  lbError: "Sem ligação ao ranking 😕", lbSent: "Resultado enviado! 🏆", yourName: "O teu nome",
} : {
  score: "Score", best: "Best", next: "Next",
  hint: "Tap to drop the fruit · match two of a kind!",
  over: "Game over!", newRecord: "🎉 New best!", pts: "points",
  again: "Play again", share: "Share 📋", copied: "Result copied!",
  biggest: "Biggest fruit", classic: "Classic", daily: "Daily",
  shareClassic: "Classic", shareDaily: "Daily Challenge",
  streak: "day streak", lbTitle: "🏆 Top 10", lbEmpty: "No scores yet — be the first!",
  lbError: "Leaderboard unreachable 😕", lbSent: "Score submitted! 🏆", yourName: "Your name",
};

const FRUITS = [
  { r: 18,  name: PT ? "Cereja"     : "Cherry",     emoji: "🍒", c: "#e53935", light: "#ff8a80" },
  { r: 25,  name: PT ? "Morango"    : "Strawberry", emoji: "🍓", c: "#ec407a", light: "#f8a5c2" },
  { r: 33,  name: PT ? "Uva"        : "Grape",      emoji: "🍇", c: "#7e57c2", light: "#b39ddb" },
  { r: 42,  name: PT ? "Clementina" : "Clementine", emoji: "🍊", c: "#ffb300", light: "#ffe082" },
  { r: 52,  name: PT ? "Caqui"      : "Persimmon",  emoji: "🟠", c: "#ff7043", light: "#ffab91" },
  { r: 63,  name: PT ? "Maçã"       : "Apple",      emoji: "🍏", c: "#66bb6a", light: "#a5d6a7" },
  { r: 75,  name: PT ? "Pêra"       : "Pear",       emoji: "🍐", c: "#c0ca33", light: "#e6ee9c" },
  { r: 88,  name: PT ? "Pêssego"    : "Peach",      emoji: "🍑", c: "#ff8a65", light: "#ffccbc" },
  { r: 101, name: PT ? "Ananás"     : "Pineapple",  emoji: "🍍", c: "#fdd835", light: "#fff59d" },
  { r: 115, name: PT ? "Melão"      : "Melon",      emoji: "🍈", c: "#9ccc65", light: "#dcedc8" },
  { r: 130, name: PT ? "Melancia"   : "Watermelon", emoji: "🍉", c: "#2e7d32", light: "#66bb6a" },
];
const MAX_TIER = FRUITS.length - 1;
const DROP_WEIGHTS = [32, 26, 20, 14, 8]; // tiers 0..4

/* ------------------------------------------------------------ constants */

const W = 520, H = 680;
const LOSE_Y = 112;         // linha de derrota
const SPAWN_Y = 66;         // altura onde a fruta aguarda
const GRAVITY = 2200;
const RESTITUTION = 0.12;
const AIR_DAMP = 0.9995;
const MAX_SPEED = 1900;
const STEP = 1 / 120;       // timestep fixo da física
const SOLVER_ITERS = 5;
const DROP_COOLDOWN = 0.45; // s entre largadas
const DANGER_TIME = 1.0;    // s acima da linha até perder

/* ---------------------------------------------------------------- state */

let fruits = [];            // frutas físicas
let particles = [];
let floats = [];            // textos flutuantes
let score = 0;
let best = 0;
let combo = 0;
let comboTimer = 0;
let biggestTier = 0;
let currentTier = 0;
let nextTier = 0;
let aimX = W / 2;
let canDrop = true;
let dropTimer = 0;
let over = false;
let newBest = false;
let shake = 0;
let dangerLevel = 0;        // 0..1 para o aviso visual
let mode = "classic";       // "classic" | "daily"
let rng = Math.random;
let acc = 0;
let lastTime = 0;

/* ------------------------------------------------------------- storage */

const store = {
  get(k, d) { try { const v = localStorage.getItem("frutopia." + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem("frutopia." + k, JSON.stringify(v)); } catch { /* privado/cheio */ } },
};

function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function todayKey() { return dateKey(new Date()); }
function yesterdayKey() { return dateKey(new Date(Date.now() - 864e5)); }
function bestKey() { return mode === "daily" ? "best.daily." + todayKey() : "best.classic"; }

/* seeded RNG (mulberry32) para o desafio diário — igual para todos */
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function dailySeed() {
  let h = 0;
  for (const ch of todayKey()) h = (Math.imul(h, 31) + ch.charCodeAt(0)) | 0;
  return h;
}

/* ----------------------------------------------------------------- som */

let audioCtx = null;
let muted = store.get("muted", false);

function ensureAudio() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
  }
  if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
}

function tone(freq, dur, type, vol, freqEnd) {
  if (muted || !audioCtx) return;
  const t0 = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, t0 + dur);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(g).connect(audioCtx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function sndDrop()  { tone(190, 0.09, "triangle", 0.18, 90); }
function sndMerge(tier) {
  const base = 620 * Math.pow(0.9, tier);
  tone(base, 0.13, "sine", 0.22, base * 1.4);
  tone(base * 1.5, 0.18, "sine", 0.12, base * 2);
}
function sndBigMerge() { tone(220, 0.4, "sawtooth", 0.12, 660); tone(440, 0.5, "sine", 0.15, 880); }
function sndOver() { tone(440, 0.25, "sine", 0.2, 330); setTimeout(() => tone(330, 0.25, "sine", 0.2, 220), 180); setTimeout(() => tone(220, 0.5, "sine", 0.2, 110), 360); }

/* ------------------------------------------------------------ elementos */

const $ = (id) => document.getElementById(id);
const canvas = $("game"), ctx = canvas.getContext("2d");
const nextCanvas = $("nextCanvas"), nextCtx = nextCanvas.getContext("2d");

canvas.width = W;
canvas.height = H;

function applyTexts() {
  $("scoreLabel").textContent = T.score;
  $("bestLabel").textContent = T.best;
  $("nextLabel").textContent = T.next;
  $("hint").textContent = T.hint;
  $("overTitle").textContent = T.over;
  $("overRecord").textContent = T.newRecord;
  $("overPts").textContent = T.pts;
  $("againBtn").textContent = T.again;
  $("shareBtn").textContent = T.share;
  $("modeBtn").textContent = mode === "daily" ? "📅 " + T.daily : "♾️ " + T.classic;
  $("soundBtn").textContent = muted ? "🔇" : "🔊";
  $("nameInput").placeholder = T.yourName;
  $("lbTitle").textContent = T.lbTitle;
  updateStreakChip();
}

/* ------------------------------------------------------------- streak 🔥 */

function currentStreak() { return store.get("daily.streak", 0); }

function bumpStreak() {
  const last = store.get("daily.lastPlayed", "");
  const today = todayKey();
  if (last === today) return;
  const streak = last === yesterdayKey() ? currentStreak() + 1 : 1;
  store.set("daily.streak", streak);
  store.set("daily.lastPlayed", today);
  updateStreakChip();
}

function streakIsLive() {
  const last = store.get("daily.lastPlayed", "");
  return last === todayKey() || last === yesterdayKey();
}

function updateStreakChip() {
  const el = $("streakChip");
  const show = mode === "daily" && streakIsLive() && currentStreak() > 0;
  el.classList.toggle("hidden", !show);
  if (show) el.textContent = "🔥" + currentStreak();
}

/* barra de evolução */
(function buildEvolution() {
  const el = $("evolution");
  FRUITS.forEach((f, i) => {
    if (i > 0) {
      const a = document.createElement("span");
      a.className = "arrow";
      a.textContent = "▸";
      el.appendChild(a);
    }
    const d = document.createElement("div");
    d.className = "dot";
    const s = 10 + i * 1.7;
    d.style.width = d.style.height = s + "px";
    d.style.background = `radial-gradient(circle at 35% 30%, ${f.light}, ${f.c})`;
    d.title = f.name;
    el.appendChild(d);
  });
})();

/* --------------------------------------------------------------- frutas */

function rollTier() {
  let total = 0;
  for (const w of DROP_WEIGHTS) total += w;
  let x = rng() * total;
  for (let i = 0; i < DROP_WEIGHTS.length; i++) {
    x -= DROP_WEIGHTS[i];
    if (x < 0) return i;
  }
  return 0;
}

function makeFruit(tier, x, y, vx, vy) {
  return {
    tier, x, y,
    vx: vx || 0, vy: vy || 0,
    r: FRUITS[tier].r,
    mass: FRUITS[tier].r * FRUITS[tier].r,
    a: 0, av: 0,             // rotação (cosmética)
    scale: 0.4,              // animação de entrada
    touched: false,          // já tocou na pilha/chão?
    danger: 0,
    dead: false,
  };
}

function clampAim(tier) {
  const r = FRUITS[tier].r;
  return Math.min(W - r - 4, Math.max(r + 4, aimX));
}

/* --------------------------------------------------------------- física */

function physicsStep(dt) {
  // integração
  for (const f of fruits) {
    f.vy += GRAVITY * dt;
    f.vx *= AIR_DAMP;
    f.vy *= AIR_DAMP;
    const sp = Math.hypot(f.vx, f.vy);
    if (sp > MAX_SPEED) { f.vx *= MAX_SPEED / sp; f.vy *= MAX_SPEED / sp; }
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    f.a += f.av * dt;
    f.av *= 0.985;
    if (f.scale < 1) f.scale = Math.min(1, f.scale + dt * 5);
  }

  const merges = [];

  for (let iter = 0; iter < SOLVER_ITERS; iter++) {
    // paredes e chão
    for (const f of fruits) {
      if (f.x - f.r < 0)  { f.x = f.r;      f.vx = Math.abs(f.vx) * RESTITUTION; f.touched = true; }
      if (f.x + f.r > W)  { f.x = W - f.r;  f.vx = -Math.abs(f.vx) * RESTITUTION; f.touched = true; }
      if (f.y + f.r > H) {
        f.y = H - f.r;
        if (f.vy > 0) f.vy = -f.vy * RESTITUTION;
        f.vx *= 0.985; // atrito com o chão
        f.av += (f.vx / f.r - f.av) * 0.2; // rolar
        f.touched = true;
      }
    }
    // pares
    for (let i = 0; i < fruits.length; i++) {
      const a = fruits[i];
      for (let j = i + 1; j < fruits.length; j++) {
        const b = fruits[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const minDist = a.r + b.r;
        const d2 = dx * dx + dy * dy;
        if (d2 >= minDist * minDist) continue;

        a.touched = b.touched = true;

        if (a.tier === b.tier && !a.dead && !b.dead && iter === 0) {
          merges.push([a, b]);
        }

        const dist = Math.sqrt(d2) || 0.001;
        const nx = dx / dist, ny = dy / dist;
        const overlap = minDist - dist;

        // correção posicional ponderada pela massa
        const totalInv = 1 / a.mass + 1 / b.mass;
        const corr = overlap / totalInv * 0.85;
        a.x -= nx * corr / a.mass;
        a.y -= ny * corr / a.mass;
        b.x += nx * corr / b.mass;
        b.y += ny * corr / b.mass;

        // impulso ao longo da normal
        const rvx = b.vx - a.vx, rvy = b.vy - a.vy;
        const relN = rvx * nx + rvy * ny;
        if (relN < 0) {
          const jImp = -(1 + RESTITUTION) * relN / totalInv;
          a.vx -= jImp * nx / a.mass;
          a.vy -= jImp * ny / a.mass;
          b.vx += jImp * nx / b.mass;
          b.vy += jImp * ny / b.mass;

          // deslizamento tangencial → rotação e leve atrito
          const relT = rvx * -ny + rvy * nx;
          a.av += relT * 0.004;
          b.av += relT * 0.004;
          const fricImp = relT * 0.06 / totalInv;
          a.vx -= fricImp * -ny / a.mass;
          a.vy -= fricImp * nx / a.mass;
          b.vx += fricImp * -ny / b.mass;
          b.vy += fricImp * nx / b.mass;
        }
      }
    }
  }

  // fusões (depois do solver, uma por fruta por passo)
  for (const [a, b] of merges) {
    if (a.dead || b.dead) continue;
    a.dead = b.dead = true;
    mergeFruits(a, b);
  }
  if (merges.length) fruits = fruits.filter((f) => !f.dead);

  // perigo / fim de jogo
  let worst = 0;
  for (const f of fruits) {
    if (f.touched && f.y - f.r < LOSE_Y) f.danger += dt;
    else f.danger = Math.max(0, f.danger - dt * 2);
    worst = Math.max(worst, f.danger);
  }
  dangerLevel = Math.min(1, worst / DANGER_TIME);
  if (worst >= DANGER_TIME && !over) gameOver();

  // temporizadores
  if (!canDrop) {
    dropTimer -= dt;
    if (dropTimer <= 0) canDrop = true;
  }
  if (comboTimer > 0) {
    comboTimer -= dt;
    if (comboTimer <= 0) combo = 0;
  }
}

function mergeFruits(a, b) {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const tier = a.tier;

  combo++;
  comboTimer = 1.6;
  const base = (tier + 1) * (tier + 2) / 2;
  const gain = Math.round(base * (1 + 0.15 * (combo - 1)));
  addScore(gain, mx, my - FRUITS[tier].r);

  if (tier === MAX_TIER) {
    // duas melancias: explosão gloriosa
    addScore(500, mx, my - 40);
    burst(mx, my, FRUITS[tier].c, 40, 400);
    burst(mx, my, "#fff176", 20, 300);
    shake = Math.min(22, shake + 18);
    sndBigMerge();
    return;
  }

  const nt = tier + 1;
  biggestTier = Math.max(biggestTier, nt);
  const nf = makeFruit(nt, mx, my, (a.vx + b.vx) / 2, (a.vy + b.vy) / 2 - 70);
  nf.x = Math.min(W - nf.r, Math.max(nf.r, nf.x));
  nf.y = Math.min(H - nf.r, nf.y);
  nf.touched = true;
  nf.scale = 0.55;
  fruits.push(nf);

  burst(mx, my, FRUITS[tier].light, 8 + tier * 2, 180 + tier * 25);
  if (nt >= 5) shake = Math.min(16, shake + (nt - 4) * 2.2);
  sndMerge(tier);
  if (combo >= 2) {
    floats.push({ x: clampFloatX(mx), y: my - FRUITS[nt].r - 14, text: "COMBO x" + combo, life: 1, big: true });
  }
}

function clampFloatX(x) { return Math.min(W - 90, Math.max(90, x)); }

function addScore(n, x, y) {
  score += n;
  $("scoreVal").textContent = score;
  if (score > best) {
    best = score;
    newBest = true;
    store.set(bestKey(), best);
    $("bestVal").textContent = best;
  }
  if (x !== undefined) floats.push({ x: clampFloatX(x), y, text: "+" + n, life: 1, big: false });
}

/* ----------------------------------------------------------- partículas */

function burst(x, y, color, count, speed) {
  for (let i = 0; i < count; i++) {
    const ang = rngVisual() * Math.PI * 2;
    const sp = speed * (0.4 + rngVisual() * 0.8);
    particles.push({
      x, y,
      vx: Math.cos(ang) * sp,
      vy: Math.sin(ang) * sp - 60,
      r: 2 + rngVisual() * 4,
      color, life: 1,
    });
  }
}
// efeitos visuais usam sempre Math.random para não consumir a semente do diário
function rngVisual() { return Math.random(); }

/* ----------------------------------------------------------------- loop */

function update(dt) {
  if (!over) {
    acc += dt;
    if (acc > 0.15) acc = 0.15; // evitar espiral após tab inativa
    while (acc >= STEP) {
      physicsStep(STEP);
      acc -= STEP;
    }
  }
  for (const p of particles) {
    p.vy += 900 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt * 1.8;
  }
  particles = particles.filter((p) => p.life > 0);
  for (const f of floats) {
    f.y -= 46 * dt;
    f.life -= dt * 0.9;
  }
  floats = floats.filter((f) => f.life > 0);
  shake = Math.max(0, shake - dt * 40);
}

/* --------------------------------------------------------------- render */

function drawFruit(g, f, x, y, scale) {
  const spec = FRUITS[f.tier];
  const r = spec.r * scale;
  g.save();
  g.translate(x, y);
  g.rotate(f.a || 0);

  const grad = g.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r * 1.05);
  grad.addColorStop(0, spec.light);
  grad.addColorStop(1, spec.c);
  g.fillStyle = grad;
  g.beginPath();
  g.arc(0, 0, r, 0, Math.PI * 2);
  g.fill();

  // riscas da melancia
  if (f.tier === MAX_TIER) {
    g.strokeStyle = "rgba(27,94,32,0.55)";
    g.lineWidth = r * 0.13;
    for (let i = -2; i <= 2; i++) {
      g.beginPath();
      g.moveTo(i * r * 0.38, -Math.sqrt(Math.max(0, r * r - (i * r * 0.38) ** 2)) * 0.95);
      g.quadraticCurveTo(i * r * 0.55, 0, i * r * 0.38, Math.sqrt(Math.max(0, r * r - (i * r * 0.38) ** 2)) * 0.95);
      g.stroke();
    }
  }

  // brilho
  g.fillStyle = "rgba(255,255,255,0.35)";
  g.beginPath();
  g.ellipse(-r * 0.35, -r * 0.45, r * 0.22, r * 0.13, -0.6, 0, Math.PI * 2);
  g.fill();

  // cara
  const er = Math.max(1.6, r * 0.07);
  g.fillStyle = "rgba(50,25,10,0.85)";
  g.beginPath(); g.arc(-r * 0.22, -r * 0.05, er, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(r * 0.22, -r * 0.05, er, 0, Math.PI * 2); g.fill();
  g.strokeStyle = "rgba(50,25,10,0.85)";
  g.lineWidth = Math.max(1.2, r * 0.045);
  g.lineCap = "round";
  g.beginPath();
  g.arc(0, r * 0.1, r * 0.18, 0.25, Math.PI - 0.25);
  g.stroke();

  g.restore();
}

function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);

  if (shake > 0) {
    ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  }

  // fundo do recipiente
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#fff8ea");
  bg.addColorStop(1, "#ffedcf");
  ctx.fillStyle = bg;
  ctx.fillRect(-20, -20, W + 40, H + 40);

  // linha de derrota
  const flash = dangerLevel > 0 ? (Math.sin(performance.now() / 90) * 0.5 + 0.5) * dangerLevel : 0;
  ctx.strokeStyle = dangerLevel > 0
    ? `rgba(229,57,53,${0.35 + 0.65 * flash})`
    : "rgba(160,110,60,0.35)";
  ctx.lineWidth = dangerLevel > 0 ? 3 : 2;
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  ctx.moveTo(0, LOSE_Y);
  ctx.lineTo(W, LOSE_Y);
  ctx.stroke();
  ctx.setLineDash([]);

  // guia + fruta atual
  if (!over && canDrop) {
    const ax = clampAim(currentTier);
    ctx.strokeStyle = "rgba(160,110,60,0.25)";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 10]);
    ctx.beginPath();
    ctx.moveTo(ax, SPAWN_Y + FRUITS[currentTier].r);
    ctx.lineTo(ax, H);
    ctx.stroke();
    ctx.setLineDash([]);
    drawFruit(ctx, { tier: currentTier, a: 0 }, ax, SPAWN_Y, 1);
  }

  // frutas
  for (const f of fruits) drawFruit(ctx, f, f.x, f.y, f.scale);

  // partículas
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // textos flutuantes
  for (const f of floats) {
    ctx.globalAlpha = Math.max(0, Math.min(1, f.life * 1.4));
    ctx.font = (f.big ? "bold 30px" : "bold 22px") + " 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = f.big ? "#f07b1d" : "#8d6e63";
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = 4;
    ctx.strokeText(f.text, f.x, f.y);
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
}

function renderNext() {
  nextCtx.setTransform(1, 0, 0, 1, 0, 0);
  nextCtx.clearRect(0, 0, 56, 56);
  const scale = 22 / FRUITS[nextTier].r;
  drawFruit(nextCtx, { tier: nextTier, a: 0 }, 28, 28, scale);
}

function frame(now) {
  const dt = Math.min(0.1, (now - lastTime) / 1000 || 0);
  lastTime = now;
  update(dt);
  render();
  requestAnimationFrame(frame);
}

/* ------------------------------------------------------------ jogo/fluxo */

function newGame() {
  fruits = [];
  particles = [];
  floats = [];
  score = 0;
  combo = 0;
  comboTimer = 0;
  biggestTier = 0;
  newBest = false;
  over = false;
  shake = 0;
  dangerLevel = 0;
  canDrop = true;
  acc = 0;
  rng = mode === "daily" ? mulberry32(dailySeed()) : Math.random;
  currentTier = rollTier();
  nextTier = rollTier();
  best = store.get(bestKey(), 0);
  $("scoreVal").textContent = "0";
  $("bestVal").textContent = best;
  $("overlay").classList.add("hidden");
  renderNext();
}

function drop() {
  if (over || !canDrop) return;
  ensureAudio();
  const x = clampAim(currentTier);
  const f = makeFruit(currentTier, x, SPAWN_Y);
  f.scale = 1;
  fruits.push(f);
  if (mode === "daily") bumpStreak();
  sndDrop();
  canDrop = false;
  dropTimer = DROP_COOLDOWN;
  currentTier = nextTier;
  nextTier = rollTier();
  renderNext();
}

function gameOver() {
  over = true;
  sndOver();
  shake = 14;
  $("overScore").textContent = score;
  $("overBiggest").textContent = `${T.biggest}: ${FRUITS[biggestTier].emoji} ${FRUITS[biggestTier].name}`;
  $("overRecord").classList.toggle("hidden", !newBest);
  const showStreak = mode === "daily" && currentStreak() > 0;
  $("overStreak").classList.toggle("hidden", !showStreak);
  if (showStreak) $("overStreak").textContent = `🔥 ${currentStreak()} ${T.streak}`;
  $("overlay").classList.remove("hidden");
  lbOnGameOver();
}

function shareText() {
  const modeName = mode === "daily" ? `${T.shareDaily} ${todayKey()}` : T.shareClassic;
  const streak = mode === "daily" && currentStreak() > 1 ? ` · 🔥${currentStreak()}` : "";
  const url = location.href.startsWith("http") ? "\n" + location.href.split("#")[0].split("?")[0] : "";
  return `🍉 Frutopia — ${modeName}\n⭐ ${score} ${T.pts} · ${FRUITS[biggestTier].emoji} ${FRUITS[biggestTier].name}${streak}${url}`;
}

let toastTimer = 0;
function toast(msg) {
  const el = $("toast");
  el.textContent = msg;
  el.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add("hidden"), 1800);
}

async function share() {
  const text = shareText();
  if (navigator.share) {
    try { await navigator.share({ text }); return; } catch { /* cancelado */ }
  }
  try {
    await navigator.clipboard.writeText(text);
    toast(T.copied);
  } catch {
    toast(text);
  }
}

/* ---------------------------------------------------- leaderboard online */

const LB = LEADERBOARD_URL.replace(/\/+$/, "");
let lbSubmitted = false;

function boardId() { return mode === "daily" ? "daily-" + todayKey() : "classic"; }

async function lbSubmit(name) {
  const res = await fetch(LB + "/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ board: boardId(), name, score }),
  });
  if (!res.ok) throw new Error("submit failed");
}

function lbOnGameOver() {
  lbSubmitted = false;
  $("lbSubmitRow").classList.add("hidden");
  if (!LB || score <= 0) return;
  const name = store.get("name", "");
  if (name) {
    lbSubmit(name).then(() => { lbSubmitted = true; }).catch(() => toast(T.lbError));
  } else {
    $("lbSubmitRow").classList.remove("hidden");
  }
}

async function lbSend() {
  const name = $("nameInput").value.trim().slice(0, 16);
  if (!name || lbSubmitted) return;
  store.set("name", name);
  $("lbSubmitRow").classList.add("hidden");
  try {
    await lbSubmit(name);
    lbSubmitted = true;
    toast(T.lbSent);
  } catch {
    toast(T.lbError);
  }
}

async function lbShow() {
  const list = $("lbList");
  list.innerHTML = "<li>…</li>";
  $("lbOverlay").classList.remove("hidden");
  try {
    const res = await fetch(LB + "/top?board=" + encodeURIComponent(boardId()));
    if (!res.ok) throw new Error("top failed");
    const data = await res.json();
    list.innerHTML = "";
    const scores = (data.scores || []).slice(0, 10);
    if (!scores.length) {
      list.innerHTML = `<li>${T.lbEmpty}</li>`;
      return;
    }
    const medals = ["🥇", "🥈", "🥉"];
    scores.forEach((s, i) => {
      const li = document.createElement("li");
      const who = document.createElement("span");
      who.textContent = `${medals[i] || (i + 1) + "."} ${s.name}`;
      const pts = document.createElement("b");
      pts.textContent = s.score;
      li.append(who, pts);
      list.appendChild(li);
    });
  } catch {
    list.innerHTML = `<li>${T.lbError}</li>`;
  }
}

/* ---------------------------------------------------------------- input */

function canvasX(ev) {
  const rect = canvas.getBoundingClientRect();
  return (ev.clientX - rect.left) * (W / rect.width);
}

canvas.addEventListener("pointermove", (ev) => { aimX = canvasX(ev); });
canvas.addEventListener("pointerdown", (ev) => { aimX = canvasX(ev); ensureAudio(); });
canvas.addEventListener("pointerup", (ev) => {
  aimX = canvasX(ev);
  drop();
});

window.addEventListener("keydown", (ev) => {
  if (ev.target && ev.target.tagName === "INPUT") {
    if (ev.key === "Enter") lbSend();
    return;
  }
  if (ev.repeat && ev.key !== "ArrowLeft" && ev.key !== "ArrowRight") return;
  switch (ev.key) {
    case "ArrowLeft": aimX = Math.max(0, aimX - 22); break;
    case "ArrowRight": aimX = Math.min(W, aimX + 22); break;
    case " ": case "ArrowDown": ev.preventDefault(); drop(); break;
    case "r": case "R": newGame(); break;
    case "m": case "M": toggleMute(); break;
  }
});

function toggleMute() {
  muted = !muted;
  store.set("muted", muted);
  $("soundBtn").textContent = muted ? "🔇" : "🔊";
}

$("soundBtn").addEventListener("click", () => { ensureAudio(); toggleMute(); });
$("restartBtn").addEventListener("click", () => newGame());
$("againBtn").addEventListener("click", () => newGame());
$("shareBtn").addEventListener("click", share);
$("sendBtn").addEventListener("click", lbSend);
$("lbBtn").addEventListener("click", lbShow);
$("lbCloseBtn").addEventListener("click", () => $("lbOverlay").classList.add("hidden"));
$("lbOverlay").addEventListener("click", (ev) => {
  if (ev.target === $("lbOverlay")) $("lbOverlay").classList.add("hidden");
});
if (LB) $("lbBtn").classList.remove("hidden");
$("modeBtn").addEventListener("click", () => {
  mode = mode === "classic" ? "daily" : "classic";
  applyTexts();
  newGame();
  toast(mode === "daily" ? "📅 " + (PT ? "Desafio Diário — a mesma sequência para todos, hoje!" : "Daily Challenge — same sequence for everyone today!") : "♾️ " + T.classic);
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) { lastTime = performance.now(); acc = 0; }
});

/* ----------------------------------------------------------------- init */

applyTexts();
newGame();
requestAnimationFrame((t) => { lastTime = t; requestAnimationFrame(frame); });

/* PWA: funciona offline e instala-se como app */
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("sw.js").catch(() => { /* opcional */ });
}

/* hook mínimo para testes automatizados (sem efeito no jogo normal) */
window.__frutopia = {
  get score() { return score; },
  get over() { return over; },
  get fruitCount() { return fruits.length; },
  spawn(tier, x, y) { fruits.push(makeFruit(tier, x, y)); },
};
