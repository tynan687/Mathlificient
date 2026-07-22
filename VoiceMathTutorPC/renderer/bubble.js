// The floating π bubble — canvas port of the Android BubbleView.

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');

let state = 'LOADING';
let muted = false;
let watching = false;
let glyph = 'π';
let opacity = 1;
let idleColor = '#4F7DF7';
let timerText = null;

window.tutor.on('bubble:state', (s) => { state = s; });
window.tutor.on('bubble:flags', (f) => { muted = !!f.muted; watching = !!f.watching; });
window.tutor.on('bubble:timer', (p) => { timerText = p && p.text ? p.text : null; });
window.tutor.on('bubble:style', (s) => {
  if (!s) return;
  idleColor = s.color || idleColor;
  glyph = s.glyph || glyph;
  opacity = typeof s.opacity === 'number' ? s.opacity : opacity;
  const px = (s.size || 96);
  canvas.width = px;
  canvas.height = px;
});

function colorFor(st) {
  const COLORS = {
    LOADING: '#8E8E93',
    IDLE: idleColor,
    LISTENING: '#2FB65D',
    THINKING: '#8E5CF7',
    SEARCHING: '#F0A322',
    TALKING: idleColor,
    RESPONSE_DONE: '#2FB65D',
    ERROR: '#E5484D',
  };
  return COLORS[st] || idleColor;
}

const start = performance.now();

function draw() {
  const phase = ((performance.now() - start) % 1400) / 1400;
  const W = canvas.width;
  const cx = W / 2, cy = W / 2;
  const radius = W * 0.3125; // 30 at 96px
  ctx.clearRect(0, 0, W, W);
  ctx.globalAlpha = opacity;

  const breathe = state === 'IDLE' ? 1 + 0.04 * Math.sin(phase * 2 * Math.PI) : 1;
  ctx.fillStyle = colorFor(state);
  ctx.beginPath();
  ctx.arc(cx, cy, radius * breathe, 0, 2 * Math.PI);
  ctx.fill();

  ctx.lineWidth = radius * 0.13;
  ctx.lineCap = 'round';

  if (state === 'LOADING' || state === 'THINKING' || state === 'SEARCHING') {
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.arc(cx, cy, radius + radius * 0.23, phase * 2 * Math.PI, phase * 2 * Math.PI + Math.PI / 1.8);
    ctx.stroke();
  } else if (state === 'LISTENING') {
    ctx.strokeStyle = `rgba(47,182,93,${(1 - phase) * 0.8})`;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * (1 + 0.45 * phase), 0, 2 * Math.PI);
    ctx.stroke();
  } else if (state === 'TALKING') {
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = radius * 0.16;
    for (let i = 0; i < 4; i++) {
      const x = cx + (i - 1.5) * radius * 0.42;
      const h = radius * (0.28 + 0.32 * (0.5 + 0.5 * Math.sin(2 * Math.PI * (phase * 2 + i * 0.27))));
      ctx.beginPath();
      ctx.moveTo(x, cy - h);
      ctx.lineTo(x, cy + h);
      ctx.stroke();
    }
  } else if (state === 'RESPONSE_DONE') {
    ctx.strokeStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(cx, cy, radius + radius * 0.2, 0, 2 * Math.PI);
    ctx.stroke();
  }

  if (state !== 'TALKING') {
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold ${radius}px Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(glyph, cx, cy + radius * 0.07);
  }

  if (watching) {
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(cx + radius * 0.75, cy - radius * 0.75, radius * 0.16, 0, 2 * Math.PI);
    ctx.fill();
  }

  if (muted) {
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.beginPath();
    const d = radius * 0.7;
    ctx.moveTo(cx - d, cy - d);
    ctx.lineTo(cx + d, cy + d);
    ctx.stroke();
  }

  if (timerText) {
    // Focus-timer badge across the bottom of the disc.
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    const bh = radius * 0.5;
    ctx.fillRect(cx - radius, cy + radius - bh, radius * 2, bh);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold ${radius * 0.34}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(timerText, cx, cy + radius - bh / 2);
  }

  ctx.globalAlpha = 1;
  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);

// Right-click (or long-press below) opens the quick-action menu.
canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  window.tutor.send('menu:open', e.screenX, e.screenY);
});

// ---- Click-through: only the visible disc captures the mouse ---------------------
// The window starts click-through (main sets setIgnoreMouseEvents(true, forward)).
// Forwarded mousemove events still reach us, so we hit-test the cursor against the
// disc and flip interactivity on/off — clicks outside the disc pass through to Word.

let interactive = false;
let pointerActive = false; // true between pointerdown and pointerup (drag/hold/tap)

function setInteractive(on) {
  if (on === interactive) return;
  interactive = on;
  window.tutor.send('bubble:interactive', on);
}

function overDisc(clientX, clientY) {
  const W = canvas.width;
  const cx = W / 2, cy = W / 2;
  const r = W * 0.3125 * 1.5; // disc radius + ripple margin
  return (clientX - cx) ** 2 + (clientY - cy) ** 2 <= r * r;
}

document.addEventListener('mousemove', (e) => {
  if (pointerActive) { setInteractive(true); return; }
  setInteractive(overDisc(e.clientX, e.clientY));
});
document.addEventListener('mouseleave', () => {
  if (!pointerActive) setInteractive(false);
});

// ---- Gestures: tap, hold (PTT), drag (with edge snap) ----------------------------

const HOLD_DELAY_MS = 450;
const TAP_MAX_MS = 400;
const SLOP = 6;

let downAt = 0;
let downX = 0;
let downY = 0;
let dragging = false;
let holding = false;
let holdTimer = null;

canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  pointerActive = true;
  downAt = Date.now();
  downX = e.screenX;
  downY = e.screenY;
  dragging = false;
  holding = false;
  holdTimer = setTimeout(() => {
    holding = true;
    window.tutor.send('bubble:hold', true);
  }, HOLD_DELAY_MS);
});

canvas.addEventListener('pointermove', (e) => {
  if (!downAt) return;
  const dx = e.screenX - downX;
  const dy = e.screenY - downY;
  if (dragging || Math.abs(dx) > SLOP || Math.abs(dy) > SLOP) {
    if (!dragging && !holding) clearTimeout(holdTimer);
    dragging = true;
    window.tutor.send('bubble:move', e.screenX - downX, e.screenY - downY);
    downX = e.screenX;
    downY = e.screenY;
  }
});

canvas.addEventListener('pointerup', (e) => {
  clearTimeout(holdTimer);
  if (holding) {
    holding = false;
    window.tutor.send('bubble:hold', false);
  } else if (dragging) {
    window.tutor.send('bubble:snap');
  } else if (Date.now() - downAt < TAP_MAX_MS) {
    window.tutor.send('bubble:tap');
  }
  downAt = 0;
  pointerActive = false;
  // Re-evaluate hover so we go click-through if the cursor left the disc.
  setInteractive(overDisc(e.clientX, e.clientY));
});
