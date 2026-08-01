// Per-question visuals for the practice engine — pure canvas, no dependencies,
// shared PC ↔ Android. renderVisual(canvas, viz, {bg, fg, accent}) draws the
// diagram for the CURRENT question's actual numbers (real roots, real triangle,
// real asymptotes), so the picture is the problem, not a stock image.

/* eslint-disable no-unused-vars */
function renderVisual(canvas, viz, colors) {
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth || 600;
  const H = canvas.clientHeight || 280;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const bg = colors.bg || '#ffffff';
  const fg = colors.fg || '#1a1a1a';
  const accent = colors.accent || '#4F7DF7';
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.font = '11px system-ui, sans-serif';

  const polyEval = (c, x) => c.reduce((s, ci, i) => s + ci * Math.pow(x, i), 0);
  const fade = (alpha) => {
    // fg with alpha, works for both hex and rgb() strings
    ctx.globalAlpha = alpha;
    return fg;
  };
  const reset = () => { ctx.globalAlpha = 1; };

  // ---- generic scaled plot -------------------------------------------------------
  function makePlot(xmin, xmax, ymin, ymax, pad = 28) {
    const sx = (W - 2 * pad) / (xmax - xmin);
    const sy = (H - 2 * pad) / (ymax - ymin);
    const px = (x) => pad + (x - xmin) * sx;
    const py = (y) => H - pad - (y - ymin) * sy;
    return {
      px, py, xmin, xmax, ymin, ymax,
      axes(xLabelStep, yLabelStep) {
        ctx.strokeStyle = fade(0.35); ctx.lineWidth = 1;
        const y0 = ymin <= 0 && ymax >= 0 ? py(0) : py(ymin);
        const x0 = xmin <= 0 && xmax >= 0 ? px(0) : px(xmin);
        ctx.beginPath();
        ctx.moveTo(pad - 6, y0); ctx.lineTo(W - pad + 6, y0);
        ctx.moveTo(x0, pad - 6); ctx.lineTo(x0, H - pad + 6);
        ctx.stroke();
        ctx.fillStyle = fg;
        if (xLabelStep) {
          const start = Math.ceil(xmin / xLabelStep) * xLabelStep;
          for (let x = start; x <= xmax + 1e-9; x += xLabelStep) {
            if (Math.abs(x) < 1e-9 && xmin < 0) continue;
            ctx.globalAlpha = 0.55;
            ctx.fillText(trim(x), px(x) - 6, y0 + 14);
          }
        }
        if (yLabelStep) {
          const start = Math.ceil(ymin / yLabelStep) * yLabelStep;
          for (let y = start; y <= ymax + 1e-9; y += yLabelStep) {
            if (Math.abs(y) < 1e-9) continue;
            ctx.globalAlpha = 0.55;
            ctx.fillText(trim(y), x0 + 5, py(y) + 4);
          }
        }
        reset();
      },
      curve(fn, color, width = 2) {
        ctx.strokeStyle = color; ctx.lineWidth = width;
        ctx.beginPath();
        let pen = false;
        const steps = 300;
        for (let i = 0; i <= steps; i++) {
          const x = xmin + (i / steps) * (xmax - xmin);
          const y = fn(x);
          if (!isFinite(y) || y < ymin - (ymax - ymin) || y > ymax + (ymax - ymin)) {
            pen = false; continue;
          }
          const X = px(x); const Y = py(Math.max(ymin, Math.min(ymax, y)));
          if (pen) ctx.lineTo(X, Y); else { ctx.moveTo(X, Y); pen = true; }
        }
        ctx.stroke();
      },
      dot(x, y, color, r = 4) {
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(px(x), py(y), r, 0, 7); ctx.fill();
      },
      openDot(x, y, color) {
        ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.fillStyle = bg;
        ctx.beginPath(); ctx.arc(px(x), py(y), 4.5, 0, 7); ctx.fill(); ctx.stroke();
      },
      dashedV(x, color) {
        ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]);
        ctx.beginPath(); ctx.moveTo(px(x), pad - 4); ctx.lineTo(px(x), H - pad + 4); ctx.stroke();
        ctx.setLineDash([]);
      },
      dashedH(y, color) {
        ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]);
        ctx.beginPath(); ctx.moveTo(pad - 4, py(y)); ctx.lineTo(W - pad + 4, py(y)); ctx.stroke();
        ctx.setLineDash([]);
      },
      label(x, y, text, color, dx = 6, dy = -6) {
        ctx.fillStyle = color || fg;
        ctx.fillText(text, px(x) + dx, py(y) + dy);
      },
    };
  }

  function trim(n) {
    const r = Math.round(n * 100) / 100;
    return String(Math.abs(r) < 1e-9 ? 0 : r);
  }

  function niceStep(span) {
    const raw = span / 6;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    for (const m of [1, 2, 5, 10]) if (raw <= m * mag) return m * mag;
    return 10 * mag;
  }

  function yRangeFromSamples(fns, xmin, xmax, focusYs = []) {
    const ys = [...focusYs];
    for (const fn of fns) {
      for (let i = 0; i <= 80; i++) {
        const y = fn(xmin + (i / 80) * (xmax - xmin));
        if (isFinite(y)) ys.push(y);
      }
    }
    ys.sort((a, b) => a - b);
    let lo = ys[Math.floor(ys.length * 0.06)];
    let hi = ys[Math.floor(ys.length * 0.94)];
    for (const y of focusYs) { lo = Math.min(lo, y); hi = Math.max(hi, y); }
    lo = Math.min(lo, 0); hi = Math.max(hi, 0);
    const padY = Math.max((hi - lo) * 0.15, 1);
    return [lo - padY, hi + padY];
  }

  function drawArrow(x1, y1, x2, y2, color, width = 2.5) {
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    const ang = Math.atan2(y2 - y1, x2 - x1);
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - 10 * Math.cos(ang - 0.4), y2 - 10 * Math.sin(ang - 0.4));
    ctx.lineTo(x2 - 10 * Math.cos(ang + 0.4), y2 - 10 * Math.sin(ang + 0.4));
    ctx.closePath(); ctx.fill();
  }

  // ---- type renderers --------------------------------------------------------------

  function drawPoly() {
    const fn = (x) => polyEval(viz.coeffs, x);
    const extras = (viz.extra || []).map((e) => (x) => polyEval(e.coeffs, x));
    const focusXs = [
      ...(viz.roots || []),
      ...(viz.vertex ? [viz.vertex[0]] : []),
      ...(viz.tangentAt != null ? [viz.tangentAt] : []),
      ...(viz.mark ? [viz.mark[0]] : []),
    ];
    let xmin = -5, xmax = 5;
    if (focusXs.length) {
      xmin = Math.min(...focusXs); xmax = Math.max(...focusXs);
      const span = Math.max(xmax - xmin, 4);
      xmin -= span * 0.45; xmax += span * 0.45;
    }
    const focusYs = [
      ...(viz.vertex ? [viz.vertex[1]] : []),
      ...(viz.mark ? [viz.mark[1]] : []),
      ...(viz.roots ? viz.roots.map(() => 0) : []),
    ];
    const [ymin, ymax] = yRangeFromSamples([fn, ...extras], xmin, xmax, focusYs);
    const p = makePlot(xmin, xmax, ymin, ymax);
    p.axes(niceStep(xmax - xmin), niceStep(ymax - ymin));
    p.curve(fn, accent);
    extras.forEach((e) => p.curve(e, fg, 1.5));
    if (viz.tangentAt != null) {
      const x0 = viz.tangentAt;
      const h = 1e-4;
      const slope = (fn(x0 + h) - fn(x0 - h)) / (2 * h);
      const y0 = fn(x0);
      p.curve((x) => y0 + slope * (x - x0), fg, 1.5);
      p.dot(x0, y0, fg);
      p.label(x0, y0, 'tangent', fg);
    }
    (viz.roots || []).forEach((r) => { p.dot(r, 0, fg); p.label(r, 0, trim(r), fg, -4, 16); });
    if (viz.vertex) { p.dot(viz.vertex[0], viz.vertex[1], fg); p.label(viz.vertex[0], viz.vertex[1], `(${trim(viz.vertex[0])}, ${trim(viz.vertex[1])})`, fg); }
    if (viz.mark) { p.dot(viz.mark[0], viz.mark[1], fg); p.label(viz.mark[0], viz.mark[1], `x = ${trim(viz.mark[0])}`, fg); }
  }

  function drawRational() {
    const fn = (x) => polyEval(viz.num, x) / polyEval(viz.den, x);
    const asym = viz.asym || [];
    const focus = [...asym, ...(viz.holes || []), 0];
    let xmin = Math.min(...focus) - 4;
    let xmax = Math.max(...focus) + 4;
    if (xmax - xmin < 8) { const c = (xmin + xmax) / 2; xmin = c - 4; xmax = c + 4; }
    const [ymin, ymax] = [-8, 8];
    const p = makePlot(xmin, xmax, ymin, ymax);
    p.axes(niceStep(xmax - xmin), 2);
    asym.forEach((a) => { p.dashedV(a, accent); p.label(a, ymax - 1, `x = ${trim(a)}`, accent, 4, 0); });
    p.curve(fn, accent);
    (viz.holes || []).forEach((h) => {
      const y = (fn(h - 1e-3) + fn(h + 1e-3)) / 2;
      if (isFinite(y) && y > ymin && y < ymax) { p.openDot(h, y, fg); p.label(h, y, 'hole', fg); }
    });
  }

  function drawArea() {
    const fn = (x) => polyEval(viz.coeffs, x);
    const span = Math.max(viz.b - viz.a, 2);
    const xmin = viz.a - span * 0.5, xmax = viz.b + span * 0.5;
    const [ymin, ymax] = yRangeFromSamples([fn], xmin, xmax, [0]);
    const p = makePlot(xmin, xmax, ymin, ymax);
    // shaded region first
    ctx.globalAlpha = 0.25; ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.moveTo(p.px(viz.a), p.py(0));
    for (let i = 0; i <= 60; i++) {
      const x = viz.a + (i / 60) * (viz.b - viz.a);
      ctx.lineTo(p.px(x), p.py(fn(x)));
    }
    ctx.lineTo(p.px(viz.b), p.py(0));
    ctx.closePath(); ctx.fill(); reset();
    p.axes(niceStep(xmax - xmin), niceStep(ymax - ymin));
    p.curve(fn, accent);
    p.dashedV(viz.a, fg); p.dashedV(viz.b, fg);
    p.label(viz.a, 0, `a = ${trim(viz.a)}`, fg, -8, 16);
    p.label(viz.b, 0, `b = ${trim(viz.b)}`, fg, -8, 16);
  }

  /**
   * y = a·sin(b(x − c)) + d over 0..xmax degrees, with an optional horizontal
   * line at `k` and dots on the solutions. The four wave parameters default to
   * a plain sin x, so the older `{ type:'sine', k, sols }` specs still draw
   * exactly what they did before.
   */
  function drawSine() {
    const a = viz.a != null ? viz.a : 1;
    const b = viz.b != null ? viz.b : 1;
    const c = viz.c != null ? viz.c : 0;
    const d = viz.d != null ? viz.d : 0;
    const xmax = viz.xmax != null ? viz.xmax : 360;
    const wave = (x) => a * Math.sin(b * (x - c) * Math.PI / 180) + d;
    const amp = Math.abs(a);
    const p = makePlot(0, xmax, d - amp * 1.6, d + amp * 1.6);
    p.axes(xmax / 4, niceStep(amp * 2));
    p.curve(wave, accent);
    if (viz.k != null) p.dashedH(viz.k, fg);
    (viz.sols || []).forEach((s) => {
      const y = viz.k != null ? viz.k : wave(s);
      p.dot(s, y, fg);
      p.label(s, y, `${trim(s)}°`, fg, 4, -8);
    });
  }

  /** Labelled points, optional joining segments and full lines — coordinate geometry. */
  function drawPoints() {
    const pts = viz.points || [];
    const lines = viz.lines || [];
    const xs = pts.map((q) => q[0]);
    const ys = pts.map((q) => q[1]);
    if (viz.mark) { xs.push(viz.mark[0]); ys.push(viz.mark[1]); }
    // A spec can be lines only (a function and its inverse, say). Without this
    // the min/max below are +/-Infinity and the whole panel comes out blank.
    if (!xs.length) { xs.push(-6, 6); ys.push(-6, 6); }
    const spanX = Math.max(...xs) - Math.min(...xs);
    const spanY = Math.max(...ys) - Math.min(...ys);
    const pad = Math.max(spanX, spanY, 4) * 0.35;
    const p = makePlot(Math.min(...xs) - pad, Math.max(...xs) + pad,
      Math.min(...ys) - pad, Math.max(...ys) + pad);
    p.axes(niceStep(spanX + 2 * pad), niceStep(spanY + 2 * pad));

    lines.forEach((ln, i) => {
      // A vertical line has no gradient, so it's given as `x` instead of m/c.
      if (ln.x != null) p.dashedV(ln.x, i === 0 ? accent : fg);
      else p.curve((x) => ln.m * x + ln.c, i === 0 ? accent : fg, 1.8);
    });
    (viz.segments || []).forEach(([i, j]) => {
      ctx.strokeStyle = accent; ctx.lineWidth = 2; ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(p.px(pts[i][0]), p.py(pts[i][1]));
      ctx.lineTo(p.px(pts[j][0]), p.py(pts[j][1]));
      ctx.stroke();
    });
    pts.forEach(([x, y, label]) => {
      p.dot(x, y, fg);
      p.label(x, y, `${label ? label + ' ' : ''}(${trim(x)}, ${trim(y)})`, fg);
    });
    if (viz.mark) {
      p.dot(viz.mark[0], viz.mark[1], accent, 5);
      p.label(viz.mark[0], viz.mark[1], viz.mark[2] || '', accent, 6, 14);
    }
  }

  /** A circle with its centre and radius marked — circles and loci. */
  function drawCircle() {
    const { cx, cy, r } = viz;
    const m = r * 1.5;
    const p = makePlot(cx - m, cx + m, cy - m, cy + m);
    p.axes(niceStep(2 * m), niceStep(2 * m));
    ctx.strokeStyle = accent; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.px(cx), p.py(cy), Math.abs(p.px(cx + r) - p.px(cx)), 0, 7);
    ctx.stroke();
    p.dot(cx, cy, fg);
    p.label(cx, cy, `(${trim(cx)}, ${trim(cy)})`, fg);
    // The radius, drawn to the right so it never sits on top of the centre label.
    ctx.strokeStyle = fg; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(p.px(cx), p.py(cy)); ctx.lineTo(p.px(cx + r), p.py(cy));
    ctx.stroke(); ctx.setLineDash([]);
    p.label(cx + r / 2, cy, `r = ${trim(r)}`, fg, -10, -6);
  }

  function drawUnitCircle() {
    const cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2 - 30;
    ctx.strokeStyle = fade(0.35); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx - R - 12, cy); ctx.lineTo(cx + R + 12, cy);
    ctx.moveTo(cx, cy - R - 12); ctx.lineTo(cx, cy + R + 12); ctx.stroke(); reset();
    ctx.strokeStyle = fg; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.stroke();
    (viz.angles || []).forEach((deg, i) => {
      const rad = -deg * Math.PI / 180;
      const color = i === (viz.angles.length - 1) ? accent : fg;
      drawArrow(cx, cy, cx + R * Math.cos(rad), cy + R * Math.sin(rad), color, 2);
      ctx.fillStyle = color;
      ctx.fillText(`${deg}°`, cx + (R + 14) * Math.cos(rad) - 8, cy + (R + 14) * Math.sin(rad) + 4);
    });
  }

  function drawTriangle() {
    const { a, b, C } = viz;
    const rad = C * Math.PI / 180;
    // C at origin, side b along +x, side a at angle C.
    const P = [[0, 0], [b, 0], [a * Math.cos(rad), a * Math.sin(rad)]];
    const xs = P.map((q) => q[0]), ys = P.map((q) => q[1]);
    const pad = 40;
    const spanX = Math.max(...xs) - Math.min(...xs), spanY = Math.max(...ys) - Math.min(...ys);
    const s = Math.min((W - 2 * pad) / (spanX || 1), (H - 2 * pad) / (spanY || 1));
    const ox = pad - Math.min(...xs) * s;
    const oy = H - pad + Math.min(...ys) * s;
    const T = P.map(([x, y]) => [ox + x * s, oy - y * s]);
    ctx.strokeStyle = accent; ctx.lineWidth = 2.5; ctx.fillStyle = accent;
    ctx.globalAlpha = 0.12;
    ctx.beginPath(); ctx.moveTo(...T[0]); ctx.lineTo(...T[1]); ctx.lineTo(...T[2]); ctx.closePath(); ctx.fill();
    reset();
    ctx.strokeStyle = accent;
    ctx.beginPath(); ctx.moveTo(...T[0]); ctx.lineTo(...T[1]); ctx.lineTo(...T[2]); ctx.closePath(); ctx.stroke();
    // angle arc at C
    ctx.strokeStyle = fg; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(T[0][0], T[0][1], 26, -rad, 0); ctx.stroke();
    ctx.fillStyle = fg;
    ctx.fillText(`C = ${C}°`, T[0][0] + 30, T[0][1] - 8);
    const mid = (i, j) => [(T[i][0] + T[j][0]) / 2, (T[i][1] + T[j][1]) / 2];
    let m = mid(0, 1); ctx.fillText(`b = ${b}`, m[0] - 12, m[1] + 16);
    m = mid(0, 2); ctx.fillText(`a = ${a}`, m[0] - 30, m[1]);
    m = mid(1, 2); ctx.fillStyle = accent; ctx.fillText('c = ?', m[0] + 8, m[1]);
  }

  function drawVectors() {
    const [ax, ay] = viz.a, [bx, by] = viz.b;
    const m = Math.max(Math.abs(ax), Math.abs(ay), Math.abs(bx), Math.abs(by), 1) * 1.3;
    const p = makePlot(-m, m, -m, m);
    p.axes(niceStep(2 * m), niceStep(2 * m));
    drawArrow(p.px(0), p.py(0), p.px(ax), p.py(ay), accent);
    drawArrow(p.px(0), p.py(0), p.px(bx), p.py(by), fg);
    ctx.fillStyle = accent; ctx.fillText(`a (${ax}, ${ay})`, p.px(ax) + 6, p.py(ay) - 6);
    ctx.fillStyle = fg; ctx.fillText(`b (${bx}, ${by})`, p.px(bx) + 6, p.py(by) - 6);
  }

  function drawArgand() {
    const pts = viz.points || [];
    const m = Math.max(...pts.flat().map(Math.abs), viz.circle || 0, 1) * 1.3;
    const p = makePlot(-m, m, -m, m);
    p.axes(niceStep(2 * m), niceStep(2 * m));
    ctx.fillStyle = fg;
    ctx.globalAlpha = 0.55;
    ctx.fillText('Re', W - 40, p.py(0) - 6);
    ctx.fillText('Im', p.px(0) + 6, 16);
    reset();
    if (viz.circle) {
      ctx.strokeStyle = fade(0.4); ctx.setLineDash([5, 4]); ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(p.px(0), p.py(0), Math.abs(p.px(viz.circle) - p.px(0)), 0, 7);
      ctx.stroke(); ctx.setLineDash([]); reset();
    }
    pts.forEach(([re, im]) => {
      drawArrow(p.px(0), p.py(0), p.px(re), p.py(im), accent);
      ctx.fillStyle = fg;
      ctx.fillText(`${trim(re)} ${im >= 0 ? '+' : '−'} ${trim(Math.abs(im))}i`, p.px(re) + 6, p.py(im) - 6);
    });
  }

  function drawBars() {
    const values = viz.values || [];
    const n = values.length;
    const lo = Math.min(0, ...values), hi = Math.max(0, ...values);
    const p = makePlot(-0.7, n - 0.3, lo, hi + (hi - lo) * 0.15 || 1);
    p.axes(0, niceStep((hi - lo) || 1));
    const bw = (p.px(1) - p.px(0)) * 0.66;
    values.forEach((v, i) => {
      ctx.fillStyle = i === viz.highlight ? accent : fg;
      ctx.globalAlpha = i === viz.highlight ? 0.95 : 0.4;
      const y0 = p.py(0), y1 = p.py(v);
      ctx.fillRect(p.px(i) - bw / 2, Math.min(y0, y1), bw, Math.abs(y1 - y0));
      reset();
      ctx.fillStyle = fg; ctx.globalAlpha = 0.6;
      ctx.fillText(String(viz.labels ? viz.labels[i] : i + (viz.startIndex || 1)), p.px(i) - 4, H - 10);
      reset();
    });
  }

  function drawDots() {
    const values = viz.values || [];
    const lo = Math.min(...values) - 1, hi = Math.max(...values) + 1;
    const p = makePlot(lo, hi, 0, 4);
    ctx.strokeStyle = fade(0.4); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(p.px(lo), p.py(0.5)); ctx.lineTo(p.px(hi), p.py(0.5)); ctx.stroke(); reset();
    const counts = {};
    values.forEach((v) => {
      counts[v] = (counts[v] || 0) + 1;
      p.dot(v, 0.5 + (counts[v] - 1) * 0.55, accent, 6);
      ctx.fillStyle = fg; ctx.globalAlpha = 0.6;
      ctx.fillText(trim(v), p.px(v) - 5, p.py(0) + 2); reset();
    });
    if (viz.mean != null) {
      p.dashedV(viz.mean, fg);
      p.label(viz.mean, 3.4, `x̄ = ${trim(viz.mean)}`, fg);
    }
  }

  const draw = {
    poly: drawPoly, rational: drawRational, area: drawArea, sine: drawSine,
    unitcircle: drawUnitCircle, triangle: drawTriangle, vectors: drawVectors,
    argand: drawArgand, bars: drawBars, dots: drawDots,
    points: drawPoints, circle: drawCircle,
  }[viz.type];
  if (draw) draw();
}

// Renderer-supported types, used by tools/check-practice.js to validate specs.
const VIZ_TYPES = ['poly', 'rational', 'area', 'sine', 'unitcircle', 'triangle',
  'vectors', 'argand', 'bars', 'dots', 'points', 'circle'];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { renderVisual, VIZ_TYPES };
}
