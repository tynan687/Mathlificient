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
  // A second series colour for the symbol diagrams, DERIVED rather than passed.
  // applyPaper is called from Kotlin with exactly two arguments
  // (PracticeSpaceActivity.paintWeb), so widening that signature would need a
  // native rebuild and a shared-file sync to land in lockstep — an APK running
  // against an older asset bundle would mis-theme silently. Rotating the accent's
  // channels keeps it in the same luminance family, so it stays readable on
  // whatever paper the accent was picked for.
  const accent2 = colors.accent2 || (() => {
    const m = /^#?([0-9a-fA-F]{6})$/.exec(String(accent).trim());
    if (!m) return '#F77D4F';
    const n = parseInt(m[1], 16);
    const rot = ((n & 0x0000ff) << 16) | (n & 0x00ff00) | ((n & 0xff0000) >> 16);
    return `#${rot.toString(16).padStart(6, '0')}`;
  })();
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

  // ---- symbol diagrams -----------------------------------------------------------
  //
  /**
   * A caption with the paper painted behind it. The symbol diagrams fill their
   * canvas edge to edge, so an unbacked caption lands on top of an arrow or a
   * curve about half the time.
   */
  function caption(text, x, y, color) {
    if (!text) return;
    const w = ctx.measureText(text).width;
    ctx.fillStyle = bg; ctx.globalAlpha = 0.88;
    ctx.fillRect(x - 4, y - 10, w + 8, 14);
    reset();
    ctx.fillStyle = color || fg; ctx.globalAlpha = 0.8;
    ctx.fillText(text, x, y);
    reset();
  }

  //
  // The eight types below serve the symbols reference rather than a practice
  // question: they explain what a piece of notation MEANS. Six are compositions
  // of the primitives above; only contourpath, vectorfield and surfaceslice draw
  // anything genuinely new.

  /**
   * A number line with open or closed endpoints and a shaded span.
   *
   * Serves `< ≤ ∈ [a,b) |x|` — and in particular the thing students miss, that
   * |x − 3| < 2 IS an interval rather than a separate kind of object.
   */
  function drawNumberline() {
    const lo = viz.lo != null ? viz.lo : -6;
    const hi = viz.hi != null ? viz.hi : 6;
    const p = makePlot(lo, hi, -1, 1);
    const yl = p.py(0);

    // A null end means the span runs off that side, so no endpoint dot is drawn.
    const a = viz.from != null ? viz.from : lo;
    const b = viz.to != null ? viz.to : hi;
    if (b > a) {
      ctx.fillStyle = accent; ctx.globalAlpha = 0.22;
      ctx.fillRect(p.px(a), yl - 11, p.px(b) - p.px(a), 22);
      reset();
    }

    ctx.strokeStyle = fade(0.5); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(p.px(lo), yl); ctx.lineTo(p.px(hi), yl); ctx.stroke(); reset();

    const step = niceStep(hi - lo);
    for (let x = Math.ceil(lo / step) * step; x <= hi + 1e-9; x += step) {
      ctx.strokeStyle = fade(0.4); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(p.px(x), yl - 5); ctx.lineTo(p.px(x), yl + 5); ctx.stroke(); reset();
      ctx.fillStyle = fg; ctx.globalAlpha = 0.6;
      ctx.fillText(trim(x), p.px(x) - 6, yl + 22); reset();
    }

    if (b > a) {
      ctx.strokeStyle = accent; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(p.px(a), yl); ctx.lineTo(p.px(b), yl); ctx.stroke();
    }
    if (viz.from != null) { if (viz.openFrom) p.openDot(a, 0, accent); else p.dot(a, 0, accent); }
    if (viz.to != null) { if (viz.openTo) p.openDot(b, 0, accent); else p.dot(b, 0, accent); }
    if (viz.point != null) {
      p.dot(viz.point, 0, accent2, 5);
      p.label(viz.point, 0, trim(viz.point), accent2, -5, -14);
    }
    if (viz.label) {
      ctx.fillStyle = accent;
      ctx.fillText(viz.label, p.px((a + b) / 2) - viz.label.length * 3, yl - 26);
    }
  }

  /**
   * Two or three overlapping circles with one region shaded — `∪ ∩ ⊂ ∅`, and
   * `P(A ∩ B)`. Regions are shaded by clipping, then every outline is stroked on
   * top, the same order drawArea uses so the shading never hides a boundary.
   */
  function drawSetdiagram() {
    const labels = viz.labels || ['A', 'B'];
    const layout = viz.layout || 'overlap';
    const R = Math.min(W, H) * 0.26;
    const cy = H / 2;
    const gap = layout === 'disjoint' ? R * 1.25 : layout === 'subset' ? 0 : R * 0.62;
    const circles = layout === 'subset'
      ? [[W / 2, cy, R], [W / 2 + R * 0.28, cy, R * 0.45]]
      : [[W / 2 - gap, cy, R], [W / 2 + gap, cy, R]];
    if (labels.length > 2 && layout === 'overlap') {
      circles.push([W / 2, cy - R * 0.72, R]);
    }
    const path = (c) => { ctx.beginPath(); ctx.arc(c[0], c[1], c[2], 0, 7); };

    const shadeAll = (list) => {
      ctx.fillStyle = accent; ctx.globalAlpha = 0.28;
      ctx.beginPath();
      // One path, one fill: overlapping arcs in a single fill never double up the
      // alpha, which is what makes a union read as one flat region.
      for (const c of list) { ctx.moveTo(c[0] + c[2], c[1]); ctx.arc(c[0], c[1], c[2], 0, 7); }
      ctx.fill(); reset();
    };
    const shadeClipped = (list, cut) => {
      ctx.save();
      for (const c of list) { path(c); ctx.clip(); }
      ctx.fillStyle = accent; ctx.globalAlpha = 0.28; ctx.fillRect(0, 0, W, H);
      ctx.restore(); reset();
      // Painting the cut-out back in `bg` is how a set difference is drawn without
      // compositing modes, which would punch a hole in the paper instead.
      if (cut) { ctx.globalAlpha = 1; ctx.fillStyle = bg; path(cut); ctx.fill(); }
    };

    if (viz.shade === 'union') shadeAll(circles.slice(0, 2));
    else if (viz.shade === 'intersection') shadeClipped(circles.slice(0, 2));
    else if (viz.shade === 'left') shadeClipped([circles[0]], circles[1]);
    else if (viz.shade === 'right') shadeClipped([circles[1]], circles[0]);
    else if (viz.shade === 'subset') shadeClipped([circles[1]]);
    else if (viz.shade === 'all') shadeAll(circles);

    ctx.lineWidth = 2;
    circles.forEach((c, i) => {
      ctx.strokeStyle = i === 1 ? accent2 : fg;
      path(c); ctx.stroke();
      ctx.fillStyle = i === 1 ? accent2 : fg;
      const lx = layout === 'subset' && i === 1 ? c[0] : c[0] + (i === 0 ? -c[2] * 0.62 : c[2] * 0.62);
      ctx.fillText(labels[i] || '', lx - 4, i === 2 ? c[1] - c[2] * 0.55 : c[1] - c[2] * 0.66);
    });
    caption(viz.caption, W / 2 - (viz.caption || '').length * 3, H - 12, accent);
  }

  /**
   * Rectangles under a curve, narrowing left to right — the `Σ → ∫` connection,
   * which is the entire reason the integral sign is a stretched S.
   */
  function drawRiemann() {
    const coeffs = viz.coeffs || [1, 0, 0.35];
    const fn = (x) => polyEval(coeffs, x);
    const a = viz.a != null ? viz.a : 0;
    const b = viz.b != null ? viz.b : 5;
    const n = viz.n || 9;
    const [ymin, ymax] = yRangeFromSamples([fn], a, b, [0]);
    const p = makePlot(a - (b - a) * 0.12, b + (b - a) * 0.12, ymin, ymax);

    // Widths shrink geometrically so the eye reads "and in the limit…" — a
    // non-uniform partition is still a Riemann sum, and it tells the story that
    // n equal boxes cannot.
    const ratio = viz.taper === false ? 1 : 0.82;
    let total = 0;
    const widths = [];
    for (let i = 0; i < n; i++) { const w = Math.pow(ratio, i); widths.push(w); total += w; }
    let x = a;
    ctx.strokeStyle = fade(0.55); ctx.lineWidth = 1;
    for (let i = 0; i < n; i++) {
      const w = (widths[i] / total) * (b - a);
      const h = fn(x + w / 2);
      ctx.fillStyle = accent; ctx.globalAlpha = 0.22;
      ctx.fillRect(p.px(x), p.py(h), p.px(x + w) - p.px(x), p.py(0) - p.py(h));
      reset();
      ctx.strokeStyle = fade(0.5);
      ctx.strokeRect(p.px(x), p.py(h), p.px(x + w) - p.px(x), p.py(0) - p.py(h));
      reset();
      x += w;
    }
    p.axes(niceStep(b - a), niceStep(ymax - ymin));
    p.curve(fn, accent2, 2.5);
  }

  /**
   * A two-level probability tree — `P(A|B)`, and why "given" means you stop
   * looking at the whole tree and read one branch's children.
   */
  function drawTree() {
    const branches = viz.branches || [];
    const x0 = 40;
    const x1 = W * 0.42;
    const x2 = W * 0.76;
    const rootY = H / 2;
    ctx.lineWidth = 2;
    branches.forEach((br, i) => {
      const y1 = H * (i === 0 ? 0.28 : 0.72);
      const live = viz.given == null || viz.given === i;
      ctx.strokeStyle = live ? accent : fg;
      ctx.globalAlpha = live ? 1 : 0.25;
      ctx.beginPath(); ctx.moveTo(x0, rootY); ctx.lineTo(x1, y1); ctx.stroke();
      ctx.fillStyle = live ? accent : fg;
      ctx.fillText(String(br.p != null ? br.p : ''), (x0 + x1) / 2 - 8, (rootY + y1) / 2 - 6);
      ctx.fillText(String(br.label || ''), x1 + 6, y1 + 4);
      reset();

      (br.children || []).forEach((ch, j) => {
        const y2 = y1 + (j === 0 ? -H * 0.16 : H * 0.16);
        ctx.strokeStyle = live ? accent2 : fg;
        ctx.globalAlpha = live ? 1 : 0.18;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x1 + 22, y1); ctx.lineTo(x2, y2); ctx.stroke();
        ctx.fillStyle = live ? accent2 : fg;
        ctx.fillText(String(ch.p != null ? ch.p : ''), (x1 + x2) / 2 + 4, (y1 + y2) / 2 - 6);
        ctx.fillText(String(ch.label || ''), x2 + 6, y2 + 4);
        reset();
      });
    });
    ctx.fillStyle = fg;
    ctx.beginPath(); ctx.arc(x0, rootY, 4, 0, 7); ctx.fill();
    caption(viz.caption, 12, 18, accent);
  }

  /**
   * Terms as blocks that accumulate — `Σ` beside `Π`, so the difference between
   * adding a list and multiplying one is a shape rather than a sentence.
   */
  function drawStack() {
    const values = viz.values || [1, 2, 3, 4];
    const product = viz.mode === 'product';
    const running = [];
    let acc = product ? 1 : 0;
    for (const v of values) { acc = product ? acc * v : acc + v; running.push(acc); }
    const top = Math.max(...running, ...values) * 1.2;
    const p = makePlot(-0.7, values.length + 0.6, 0, top);
    const bw = (p.px(1) - p.px(0)) * 0.6;

    values.forEach((v, i) => {
      ctx.fillStyle = accent; ctx.globalAlpha = 0.75;
      ctx.fillRect(p.px(i) - bw / 2, p.py(v), bw, p.py(0) - p.py(v));
      reset();
      ctx.fillStyle = fg; ctx.globalAlpha = 0.7;
      ctx.fillText(trim(v), p.px(i) - 5, p.py(0) + 15); reset();
    });
    // The running total, one bar clear of the terms.
    const rx = values.length;
    ctx.fillStyle = accent2; ctx.globalAlpha = 0.9;
    ctx.fillRect(p.px(rx) - bw / 2, p.py(acc), bw, p.py(0) - p.py(acc));
    reset();
    ctx.fillStyle = accent2;
    ctx.fillText(`${product ? '×' : '+'} = ${trim(acc)}`, p.px(rx) - bw, p.py(acc) - 8);
    ctx.strokeStyle = fade(0.4); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(p.px(-0.7), p.py(0)); ctx.lineTo(p.px(rx + 0.6), p.py(0)); ctx.stroke();
    reset();
  }

  /** A closed loop with direction arrows on it — `∮`, an integral that comes back. */
  function drawContourpath() {
    const cx = W / 2, cy = H / 2;
    const rx = Math.min(W, H) * 0.3, ry = Math.min(W, H) * 0.24;
    // A faint field behind, so the loop is visibly a path THROUGH something.
    ctx.strokeStyle = fade(0.14); ctx.lineWidth = 1;
    for (let gx = 30; gx < W - 20; gx += 26) {
      ctx.beginPath(); ctx.moveTo(gx, 18); ctx.lineTo(gx, H - 18); ctx.stroke();
    }
    for (let gy = 24; gy < H - 18; gy += 26) {
      ctx.beginPath(); ctx.moveTo(24, gy); ctx.lineTo(W - 20, gy); ctx.stroke();
    }
    reset();
    // A lobed loop rather than an ellipse — an ellipse reads as "a circle", and
    // the point of the contour integral is that the shape does not matter.
    const at = (t) => {
      const r = 1 + 0.18 * Math.cos(3 * t);
      return [cx + rx * r * Math.cos(t), cy + ry * r * Math.sin(t)];
    };
    ctx.strokeStyle = accent; ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i <= 240; i++) {
      const [x, y] = at((i / 240) * Math.PI * 2);
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.closePath(); ctx.stroke();
    // Direction arrows, tangent to the loop.
    for (let k = 0; k < 4; k++) {
      const t = (k / 4) * Math.PI * 2 + 0.35;
      const [x1, y1] = at(t - 0.06);
      const [x2, y2] = at(t + 0.06);
      drawArrow(x1, y1, x2, y2, accent2, 2);
    }
    caption(viz.caption, 14, 18);
  }

  /** Named scalar fields, so a viz spec stays declarative data. */
  const FIELDS = {
    bowl: (x, y) => (x * x + y * y) / 4,
    hill: (x, y) => -(x * x + y * y) / 4,
    saddle: (x, y) => (x * x - y * y) / 4,
    ramp: (x, y) => x + 0.4 * y,
  };

  /**
   * Arrows on a grid, longest where the surface climbs fastest — `∇`, which is
   * the direction of steepest ascent and nothing more mysterious than that.
   */
  function drawVectorfield() {
    const f = FIELDS[viz.field] || FIELDS.bowl;
    const m = viz.extent || 3;
    const p = makePlot(-m, m, -m, m);
    p.axes(niceStep(2 * m), niceStep(2 * m));
    const h = 1e-3;
    const n = viz.density || 6;
    let longest = 0;
    const arrows = [];
    // Inset the sample grid: an arrow rooted on the boundary points outward and
    // its head lands outside the plot, so the edge column reads as headless lines.
    const g = m * 0.8;
    for (let i = 0; i <= n; i++) {
      for (let j = 0; j <= n; j++) {
        const x = -g + (i / n) * 2 * g;
        const y = -g + (j / n) * 2 * g;
        const gx = (f(x + h, y) - f(x - h, y)) / (2 * h);
        const gy = (f(x, y + h) - f(x, y - h)) / (2 * h);
        const len = Math.hypot(gx, gy);
        if (len > longest) longest = len;
        arrows.push([x, y, gx, gy, len]);
      }
    }
    const scale = (m * 0.26) / (longest || 1);
    for (const [x, y, gx, gy, len] of arrows) {
      if (len < 1e-6) continue;
      ctx.globalAlpha = 0.35 + 0.65 * (len / longest);
      drawArrow(p.px(x), p.py(y), p.px(x + gx * scale), p.py(y + gy * scale), accent, 1.8);
      reset();
    }
    caption(viz.caption, 14, 18);
  }

  /**
   * A surface with one variable's slice picked out — `∂`, the "hold the others
   * still and differentiate along this one line" idea.
   */
  function drawSurfaceslice() {
    // A waterfall of slices, NOT a projected mesh.
    //
    // An axonometric wireframe of these surfaces folds through itself: with
    // z ∝ (x−y)(x+y), the screen height of a whole ridge stops depending on depth
    // at x − y = 4·ky/kz, so that ridge collapses to a single point and the
    // picture reads as a fan of crossing lines. Painter's algorithm does not save
    // it either, because a folded surface has no valid back-to-front order by
    // centroid. One curve per fixed y, stepped up and to the right, says "hold y
    // still and vary x" more directly anyway — which is the whole idea of ∂.
    const f = FIELDS[viz.field] || FIELDS.saddle;
    const m = viz.extent || 2.4;
    const rows = viz.rows || 7;
    const yHold = viz.at != null ? viz.at : 0;

    const ys = [];
    for (let j = 0; j < rows; j++) ys.push(-m + (j / (rows - 1)) * 2 * m);
    // Snap to a drawn curve, so the highlight never lands between two of them.
    let hold = 0;
    ys.forEach((y, j) => { if (Math.abs(y - yHold) < Math.abs(ys[hold] - yHold)) hold = j; });

    let zlo = Infinity, zhi = -Infinity;
    for (const y of ys) {
      for (let i = 0; i <= 40; i++) {
        const z = f(-m + (i / 40) * 2 * m, y);
        if (z < zlo) zlo = z;
        if (z > zhi) zhi = z;
      }
    }
    const stepX = W * 0.05, stepY = H * 0.05;
    const sx = (W - 76 - stepX * (rows - 1)) / (2 * m);
    const sz = (H - 66 - stepY * (rows - 1)) / ((zhi - zlo) || 1);
    const baseX = 40, baseY = H - 26;

    ys.forEach((y, j) => {
      const hot = j === hold;
      ctx.strokeStyle = hot ? accent : fg;
      ctx.globalAlpha = hot ? 1 : 0.28;
      ctx.lineWidth = hot ? 3 : 1.4;
      ctx.beginPath();
      for (let i = 0; i <= 60; i++) {
        const x = -m + (i / 60) * 2 * m;
        const X = baseX + j * stepX + (x + m) * sx;
        const Y = baseY - j * stepY - (f(x, y) - zlo) * sz;
        if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y);
      }
      ctx.stroke();
      reset();
    });

    // Label only the held slice — seven labels is clutter, and one is the point.
    // Anchored to the curve's own left end, not to its baseline: a marker sitting
    // at the baseline reads as belonging to whichever slice happens to be near it.
    const lx = baseX + hold * stepX;
    const ly = baseY - hold * stepY - (f(-m, ys[hold]) - zlo) * sz;
    ctx.fillStyle = accent;
    ctx.beginPath(); ctx.arc(lx, ly, 4, 0, 7); ctx.fill();
    ctx.fillStyle = accent2;
    ctx.fillText(viz.holdLabel || `y = ${trim(ys[hold])} held still`, lx - 4, ly - 10);
    caption(viz.caption, 14, 18);
  }

  const draw = {
    poly: drawPoly, rational: drawRational, area: drawArea, sine: drawSine,
    unitcircle: drawUnitCircle, triangle: drawTriangle, vectors: drawVectors,
    argand: drawArgand, bars: drawBars, dots: drawDots,
    points: drawPoints, circle: drawCircle,
    numberline: drawNumberline, setdiagram: drawSetdiagram, riemann: drawRiemann,
    tree: drawTree, stack: drawStack, contourpath: drawContourpath,
    vectorfield: drawVectorfield, surfaceslice: drawSurfaceslice,
  }[viz.type];
  if (draw) draw();
}

// Renderer-supported types, used by tools/check-practice.js and
// tools/check-symbols.js to validate specs.
const VIZ_TYPES = ['poly', 'rational', 'area', 'sine', 'unitcircle', 'triangle',
  'vectors', 'argand', 'bars', 'dots', 'points', 'circle',
  'numberline', 'setdiagram', 'riemann', 'tree', 'stack', 'contourpath',
  'vectorfield', 'surfaceslice'];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { renderVisual, VIZ_TYPES };
}
