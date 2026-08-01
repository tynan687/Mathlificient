// PC ink-drawing canvas for the Practice window — mouse, touch, and graphics-
// tablet/pen input via the browser's native Pointer Events API. Behavioral port
// of Android's InkCanvasView.kt (stroke model, hold-to-erase, pinch-zoom) onto
// pointerdown/move/up/cancel + wheel. No-ops entirely if #inkCanvas isn't present
// (e.g. if this file were ever loaded somewhere without the canvas markup).
(function () {
  const canvas = document.getElementById('inkCanvas');
  if (!canvas) return;

  const wrap = document.getElementById('inkCanvasWrap');
  const ctx = canvas.getContext('2d');

  const inkSwatchesEl = document.getElementById('inkSwatches');
  const eraserSwatchEl = document.getElementById('eraserSwatch');
  const paperSwatchesEl = document.getElementById('paperSwatches');
  const paperCustomEl = document.getElementById('paperCustom');
  const undoBtn = document.getElementById('inkUndo');
  const clearBtn = document.getElementById('inkClear');
  const zoomInBtn = document.getElementById('inkZoomIn');
  const zoomOutBtn = document.getElementById('inkZoomOut');
  const zoomResetBtn = document.getElementById('inkZoomReset');
  const saveBtn = document.getElementById('inkSave');

  // ---- Colour data (ported from PracticeSpaceActivity.kt) --------------------------

  const DARK_INKS = ['#1E2A44', '#1565C0', '#C62828', '#2E7D32'];
  const LIGHT_INKS = ['#F5F5F5', '#90CAF9', '#EF9A9A', '#A5D6A7'];
  const PAPERS = [
    { label: 'White', color: '#FFFFFF' },
    { label: 'Grey', color: '#CBCBCB' },
    { label: 'Sepia', color: '#F4ECD8' },
    { label: 'Dark', color: '#1C1C1E' },
  ];

  function luminanceOf(hex) {
    const h = hex.replace('#', '');
    const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  }
  function isDarkPaper(hex) { return luminanceOf(hex) < 0.4; }
  function contentOn(hex) { return isDarkPaper(hex) ? '#F0F0F0' : '#1A1A1A'; }

  // ---- Drawing engine ----------------------------------------------------------------

  const ERASER_RADIUS_CSS = 12; // matches Android's ~12dp

  class InkCanvas {
    constructor(el) {
      this.canvas = el;
      this.ctx = el.getContext('2d');
      this.strokes = [];
      this.active = null;
      this.activePointerId = null;
      this.activePointerType = null;
      this.activeIsEraser = false;
      this.inkColor = DARK_INKS[0];
      this.eraserMode = false;
      this.onViewChanged = null;

      this.viewScale = 1;
      this.viewOffsetX = 0;
      this.viewOffsetY = 0;

      this.activePointers = new Map(); // id -> {x, y, type} in canvas-local CSS px
      this.gestureActive = false;
      this.gestureId1 = null;
      this.gestureId2 = null;
      this.prev1 = { x: 0, y: 0 };
      this.prev2 = { x: 0, y: 0 };
      this.blockDrawingUntilAllUp = false;

      this.eraserIndicator = { show: false, x: 0, y: 0 };
      this.cssW = 0;
      this.cssH = 0;

      el.style.touchAction = 'none';
      el.addEventListener('contextmenu', (e) => e.preventDefault());
      el.addEventListener('pointerdown', this._onDown.bind(this));
      el.addEventListener('pointermove', this._onMove.bind(this));
      el.addEventListener('pointerup', this._onUp.bind(this));
      el.addEventListener('pointercancel', this._onUp.bind(this));
      el.addEventListener('wheel', this._onWheel.bind(this), { passive: false });
    }

    // ---- view transform -----------------------------------------------------------

    toWorldX(sx) { return (sx - this.viewOffsetX) / this.viewScale; }
    toWorldY(sy) { return (sy - this.viewOffsetY) / this.viewScale; }

    get isTransformed() {
      return this.viewScale !== 1 || this.viewOffsetX !== 0 || this.viewOffsetY !== 0;
    }

    _notifyView() { if (this.onViewChanged) this.onViewChanged(this.isTransformed); }

    resetView() {
      this.viewScale = 1; this.viewOffsetX = 0; this.viewOffsetY = 0;
      this.render(); this._notifyView();
    }

    zoomBy(factor, anchorX, anchorY) {
      const newScale = Math.min(4, Math.max(0.25, this.viewScale * factor));
      const worldAnchorX = (anchorX - this.viewOffsetX) / this.viewScale;
      const worldAnchorY = (anchorY - this.viewOffsetY) / this.viewScale;
      this.viewOffsetX = anchorX - worldAnchorX * newScale;
      this.viewOffsetY = anchorY - worldAnchorY * newScale;
      this.viewScale = newScale;
      this.render(); this._notifyView();
    }

    // ---- sizing ---------------------------------------------------------------------

    resize() {
      const dpr = window.devicePixelRatio || 1;
      const rect = (wrap || this.canvas).getBoundingClientRect();
      this.cssW = rect.width; this.cssH = rect.height;
      this.canvas.width = Math.max(1, Math.round(this.cssW * dpr));
      this.canvas.height = Math.max(1, Math.round(this.cssH * dpr));
      this.render();
    }

    // ---- rendering --------------------------------------------------------------------

    static _pathFromPoints(ctx, pts) {
      if (pts.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(pts[0], pts[1]);
      if (pts.length === 2) { ctx.lineTo(pts[0] + 0.01, pts[1] + 0.01); return; }
      let lastX = pts[0], lastY = pts[1];
      for (let i = 2; i < pts.length; i += 2) {
        const x = pts[i], y = pts[i + 1];
        const midX = (lastX + x) / 2, midY = (lastY + y) / 2;
        ctx.quadraticCurveTo(lastX, lastY, midX, midY);
        lastX = x; lastY = y;
      }
      ctx.lineTo(lastX, lastY);
    }

    render() {
      const dpr = window.devicePixelRatio || 1;
      const ctx = this.ctx;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, this.cssW, this.cssH);
      ctx.save();
      ctx.translate(this.viewOffsetX, this.viewOffsetY);
      ctx.scale(this.viewScale, this.viewScale);
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      for (const s of this.strokes) {
        ctx.strokeStyle = s.color;
        ctx.lineWidth = s.width;
        InkCanvas._pathFromPoints(ctx, s.points);
        ctx.stroke();
      }
      ctx.restore();
      if (this.eraserIndicator.show) {
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(136,136,136,0.7)';
        ctx.lineWidth = 2;
        ctx.arc(this.eraserIndicator.x, this.eraserIndicator.y, ERASER_RADIUS_CSS, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // ---- toolbar-facing API -----------------------------------------------------------

    setInkColor(hex) { this.inkColor = hex; }
    setEraserMode(on) { this.eraserMode = on; }

    undo() {
      if (this.strokes.length) {
        if (this.active === this.strokes[this.strokes.length - 1]) {
          this.active = null; this.activePointerId = null; this.activeIsEraser = false;
        }
        this.strokes.pop();
        this.render();
      }
    }
    clear() {
      this.strokes = []; this.active = null; this.activePointerId = null; this.activeIsEraser = false;
      this.render();
    }

    exportPNG() {
      this.canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'working.png';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      });
    }

    // ---- strokes ------------------------------------------------------------------------

    _beginStroke(sx, sy, pressure) {
      const p = Math.min(1.5, Math.max(0.2, pressure || 0.5));
      const wx = this.toWorldX(sx), wy = this.toWorldY(sy);
      this.active = { color: this.inkColor, width: (3 + p * 4) / this.viewScale, points: [wx, wy] };
      this.strokes.push(this.active);
      this.activeIsEraser = false;
    }
    _addPoint(sx, sy) {
      if (!this.active) return;
      this.active.points.push(this.toWorldX(sx), this.toWorldY(sy));
    }
    _endStroke() {
      this.active = null; this.activePointerId = null; this.activeIsEraser = false;
    }
    _abandonActive() {
      if (this.active) {
        const i = this.strokes.indexOf(this.active);
        if (i >= 0) this.strokes.splice(i, 1);
      }
      this.active = null; this.activePointerId = null; this.activeIsEraser = false;
    }

    // ---- erasing --------------------------------------------------------------------------

    _beginErase(sx, sy) {
      this.active = null;
      this.activeIsEraser = true;
      this._eraseAt(sx, sy);
    }
    _eraseAt(sx, sy) {
      const wx = this.toWorldX(sx), wy = this.toWorldY(sy);
      const radius = ERASER_RADIUS_CSS / this.viewScale;
      let removed = false;
      this.strokes = this.strokes.filter((s) => {
        const reach = radius + s.width / 2;
        for (let i = 0; i < s.points.length; i += 2) {
          if (Math.hypot(s.points[i] - wx, s.points[i + 1] - wy) <= reach) { removed = true; return false; }
        }
        return true;
      });
      this.eraserIndicator = { show: true, x: sx, y: sy };
      return removed;
    }
    _stopErasing() {
      this.eraserIndicator.show = false;
      this.activePointerId = null; this.activeIsEraser = false;
    }

    // ---- pointer-driven eraser trigger ------------------------------------------------

    _wantsErase(e) {
      if (this.eraserMode) return true;
      if (e.pointerType === 'pen') {
        if (e.buttons & 32) return true; // eraser end / inverted pen (W3C spec bit)
        if (e.buttons & 2) return true;  // barrel / side button
      }
      return false;
    }

    _localXY(e) {
      const rect = this.canvas.getBoundingClientRect();
      return [e.clientX - rect.left, e.clientY - rect.top];
    }

    _coalesced(e) {
      const list = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : null;
      return list && list.length ? list : [e];
    }

    // ---- gestures (two-finger pinch/pan on touch-capable hardware) --------------------

    _touchPointers() {
      return [...this.activePointers.entries()].filter(([, p]) => p.type === 'touch');
    }

    _maybeStartGesture() {
      const touches = this._touchPointers();
      if (touches.length < 2) return false;
      if (this.active && this.activePointerType !== 'touch') return false; // pen/mouse stroke wins
      this._abandonActive();
      const [id1, id2] = [touches[0][0], touches[1][0]];
      this.gestureActive = true; this.gestureId1 = id1; this.gestureId2 = id2;
      this.prev1 = { ...this.activePointers.get(id1) };
      this.prev2 = { ...this.activePointers.get(id2) };
      return true;
    }

    _moveGesture() {
      const p1 = this.activePointers.get(this.gestureId1);
      const p2 = this.activePointers.get(this.gestureId2);
      if (!p1 || !p2) return;
      const prevDist = Math.hypot(this.prev1.x - this.prev2.x, this.prev1.y - this.prev2.y) || 1;
      const newDist = Math.hypot(p1.x - p2.x, p1.y - p2.y) || 1;
      const prevFocalX = (this.prev1.x + this.prev2.x) / 2, prevFocalY = (this.prev1.y + this.prev2.y) / 2;
      const focalX = (p1.x + p2.x) / 2, focalY = (p1.y + p2.y) / 2;
      const newScale = Math.min(4, Math.max(0.25, this.viewScale * newDist / prevDist));
      const worldFocalX = (prevFocalX - this.viewOffsetX) / this.viewScale;
      const worldFocalY = (prevFocalY - this.viewOffsetY) / this.viewScale;
      this.viewOffsetX = focalX - worldFocalX * newScale;
      this.viewOffsetY = focalY - worldFocalY * newScale;
      this.viewScale = newScale;
      this.prev1 = { x: p1.x, y: p1.y }; this.prev2 = { x: p2.x, y: p2.y };
      this.render(); this._notifyView();
    }

    _endGesture() {
      this.gestureActive = false; this.gestureId1 = null; this.gestureId2 = null;
      this.blockDrawingUntilAllUp = true;
    }

    // ---- event handlers -----------------------------------------------------------------

    _onDown(e) {
      const [sx, sy] = this._localXY(e);
      this.activePointers.set(e.pointerId, { x: sx, y: sy, type: e.pointerType });
      try { this.canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }

      if (e.pointerType === 'touch') {
        if (this._maybeStartGesture()) { this.render(); return; }
        if (this.gestureActive) return; // a 3rd+ touch, ignore
      }

      if (this.blockDrawingUntilAllUp) return;

      if (this.active !== null || this.activeIsEraser) {
        if (e.pointerType === 'pen' && this.activePointerType !== 'pen') {
          this._abandonActive(); this._stopErasing();
        } else {
          return; // a second drawing pointer while one is already active — ignore
        }
      }
      if (this.gestureActive) this._endGesture();

      this.activePointerId = e.pointerId;
      this.activePointerType = e.pointerType;
      if (this._wantsErase(e)) this._beginErase(sx, sy);
      else this._beginStroke(sx, sy, e.pressure);
      this.render();
    }

    _onMove(e) {
      const [sx, sy] = this._localXY(e);
      if (this.activePointers.has(e.pointerId)) {
        this.activePointers.set(e.pointerId, { x: sx, y: sy, type: e.pointerType });
      }

      if (this.gestureActive) { this._moveGesture(); return; }
      if (e.pointerId !== this.activePointerId) return;

      if (this.activeIsEraser) {
        if (!this._wantsErase(e)) {
          this._stopErasing();
          this._beginStroke(sx, sy, e.pressure);
          this.render();
          return;
        }
        let removed = false;
        for (const ev of this._coalesced(e)) {
          const rect = this.canvas.getBoundingClientRect();
          if (this._eraseAt(ev.clientX - rect.left, ev.clientY - rect.top)) removed = true;
        }
        this.render();
        return;
      }

      if (!this.active) return;
      if (this._wantsErase(e)) {
        this._endStroke();
        this._beginErase(sx, sy);
        this.render();
        return;
      }
      const rect = this.canvas.getBoundingClientRect();
      for (const ev of this._coalesced(e)) this._addPoint(ev.clientX - rect.left, ev.clientY - rect.top);
      this.render();
    }

    _onUp(e) {
      this.activePointers.delete(e.pointerId);
      try { this.canvas.releasePointerCapture(e.pointerId); } catch { /* ignore */ }

      if (this.gestureActive && (e.pointerId === this.gestureId1 || e.pointerId === this.gestureId2)) {
        this._endGesture();
      } else if (e.pointerId === this.activePointerId) {
        if (this.activeIsEraser) this._stopErasing();
        else this._endStroke();
      }
      if (this.activePointers.size === 0) this.blockDrawingUntilAllUp = false;
      this.render();
    }

    _onWheel(e) {
      e.preventDefault();
      const [sx, sy] = this._localXY(e);
      const factor = Math.exp(-e.deltaY * 0.0015);
      this.zoomBy(factor, sx, sy);
    }
  }

  const ink = new InkCanvas(canvas);
  window.__ink = ink; // exposed for on-device/automated verification

  const ro = new ResizeObserver(() => ink.resize());
  ro.observe(wrap || canvas);
  ink.resize();

  // ---- toolbar ---------------------------------------------------------------------------

  let paperColor = '#FFFFFF';

  function currentInks() { return isDarkPaper(paperColor) ? LIGHT_INKS : DARK_INKS; }

  function rebuildInkSwatches() {
    if (!inkSwatchesEl) return;
    inkSwatchesEl.innerHTML = '';
    for (const c of currentInks()) {
      const sw = document.createElement('div');
      sw.className = 'swatch' + (!ink.eraserMode && ink.inkColor === c ? ' selected' : '');
      sw.style.background = c;
      sw.setAttribute('role', 'button');
      sw.tabIndex = 0;
      sw.title = 'Ink colour';
      const pick = () => {
        ink.setInkColor(c); ink.setEraserMode(false);
        rebuildInkSwatches(); rebuildEraserSwatch();
      };
      sw.addEventListener('click', pick);
      sw.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') pick(); });
      inkSwatchesEl.appendChild(sw);
    }
  }
  function rebuildEraserSwatch() {
    if (!eraserSwatchEl) return;
    eraserSwatchEl.classList.toggle('selected', !!ink.eraserMode);
    eraserSwatchEl.style.background = paperColor;
  }
  function rebuildPaperSwatches() {
    if (!paperSwatchesEl) return;
    paperSwatchesEl.innerHTML = '';
    for (const p of PAPERS) {
      const sw = document.createElement('div');
      sw.className = 'swatch' + (paperColor.toUpperCase() === p.color ? ' selected' : '');
      sw.style.background = p.color;
      sw.setAttribute('role', 'button');
      sw.tabIndex = 0;
      sw.title = p.label;
      const pick = () => setPaper(p.color);
      sw.addEventListener('click', pick);
      sw.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') pick(); });
      paperSwatchesEl.appendChild(sw);
    }
  }

  function applyPaperColor(hex) {
    paperColor = hex;
    if (typeof window.applyPaper === 'function') window.applyPaper(hex, contentOn(hex));
    ink.setInkColor(currentInks()[0]);
    ink.setEraserMode(false);
    rebuildInkSwatches(); rebuildEraserSwatch(); rebuildPaperSwatches();
    if (paperCustomEl) paperCustomEl.value = hex;
  }

  async function savePaperSetting(hex) {
    if (typeof window.tutor === 'undefined') return;
    try {
      const s = await window.tutor.invoke('settings:get');
      await window.tutor.invoke('settings:set', { ...s, practicePaperColor: hex });
    } catch { /* best-effort */ }
  }

  function setPaper(hex) {
    applyPaperColor(hex);
    savePaperSetting(hex);
  }

  if (eraserSwatchEl) {
    eraserSwatchEl.setAttribute('role', 'button');
    eraserSwatchEl.tabIndex = 0;
    eraserSwatchEl.title = 'Eraser';
    const pick = () => { ink.setEraserMode(true); rebuildInkSwatches(); rebuildEraserSwatch(); };
    eraserSwatchEl.addEventListener('click', pick);
    eraserSwatchEl.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') pick(); });
  }
  if (paperCustomEl) {
    paperCustomEl.addEventListener('input', () => setPaper(paperCustomEl.value));
  }
  // The canvas now lives inside a collapsible <details> (the multiple-choice
  // grid needs the room). Nothing here needs a guard for that: measured in
  // Chromium 35, closing the panel takes ~460px off the page height but leaves
  // the wrap's own box intact, so the canvas is never resized to zero and
  // ResizeObserver never even fires. Strokes are in world coordinates and would
  // survive a resize regardless.
  if (undoBtn) undoBtn.addEventListener('click', () => ink.undo());
  if (clearBtn) clearBtn.addEventListener('click', () => ink.clear());
  if (zoomInBtn) zoomInBtn.addEventListener('click', () => ink.zoomBy(1.25, ink.cssW / 2, ink.cssH / 2));
  if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => ink.zoomBy(0.8, ink.cssW / 2, ink.cssH / 2));
  if (zoomResetBtn) zoomResetBtn.addEventListener('click', () => ink.resetView());
  if (saveBtn) saveBtn.addEventListener('click', () => ink.exportPNG());

  ink.onViewChanged = (transformed) => {
    if (zoomResetBtn) zoomResetBtn.classList.toggle('hidden', !transformed);
  };

  (async () => {
    let loaded = '#FFFFFF';
    if (typeof window.tutor !== 'undefined') {
      try {
        const s = await window.tutor.invoke('settings:get');
        loaded = s.practicePaperColor || loaded;
      } catch { /* defaults */ }
    }
    applyPaperColor(loaded);
  })();
})();
