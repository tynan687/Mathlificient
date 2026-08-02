// Every template and every symbol that declares a `viz` must actually draw, and
// draw something DIFFERENT from its neighbours. A spec the renderer silently
// ignores looks fine in the data and shows a blank panel.
//
// The metric is the one device-viz.js arrived at the hard way, and it lives here
// now so it runs without a tablet plugged in:
//
//   * background sampled from the canvas's OWN corner, not assumed white — an
//     earlier version counted "non-white" pixels on a dark-themed page, so every
//     pixel counted and it reported the identical total for four different
//     templates while passing whatever happened;
//   * an upper bound as well as a lower one, so "filled the canvas with one
//     colour" fails too;
//   * more than three distinct colours, so axes alone are not enough;
//   * per-spec totals must differ, which is what actually catches a renderer
//     that ignores its spec;
//   * and a floor on the COUNT, so a diagram quietly disappearing from the data
//     fails instead of shrinking the run.
const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');
const { PC: ROOT } = require('./paths.js');

// Bump these when you add diagrams. They exist so a collapse in coverage is a
// failure rather than a smaller number nobody reads.
const MIN_TEMPLATE_VIZ = 42;
const MIN_SYMBOL_VIZ = 55;

let fail = 0;
const ok = (label, cond, extra) => {
  if (!cond) fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${label}${extra != null ? ' :: ' + extra : ''}`);
};

/** Draw one spec and measure it. Returns {ink, colours, total, err}. */
const MEASURE = `(canvas, spec) => {
  const ctx = canvas.getContext('2d');
  let err = null;
  try { renderVisual(canvas, spec, { bg: '#ffffff', fg: '#1a1a1a', accent: '#4F7DF7' }); }
  catch (e) { err = e.message; }
  const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  // The corner is background by construction — renderVisual fills before drawing.
  const bg = [d[0], d[1], d[2]];
  let ink = 0; const seen = new Set();
  for (let p = 0; p < d.length; p += 4) {
    const dist = Math.abs(d[p]-bg[0]) + Math.abs(d[p+1]-bg[1]) + Math.abs(d[p+2]-bg[2]);
    if (dist > 40) { ink++; seen.add((d[p]>>4)+','+(d[p+1]>>4)+','+(d[p+2]>>4)); }
  }
  return { err, ink, colours: seen.size, total: canvas.width * canvas.height };
}`;

function judge(kind, rows) {
  const inks = [];
  for (const r of rows) {
    if (r.err) { ok(`${kind} ${r.id} (${r.type}) draws`, false, r.err); continue; }
    const pct = ((r.ink / r.total) * 100).toFixed(1);
    ok(`${kind} ${r.id} (${r.type}) draws`,
      r.ink > 500 && r.ink < r.total * 0.6 && r.colours > 3,
      `${r.ink}px (${pct}%), ${r.colours} colours`);
    inks.push(r.ink);
  }
  // Near-identical specs are legitimate, so allow a couple of ties — but a
  // renderer ignoring its spec collapses this to 1 and fails loudly.
  ok(`  ...and ${kind} diagrams differ from each other`,
    new Set(inks).size >= inks.length - 2, `${new Set(inks).size} distinct of ${inks.length}`);
  const byType = {};
  for (const r of rows) byType[r.type] = (byType[r.type] || 0) + 1;
  console.log(`     ${rows.length} ${kind} diagrams: `
    + Object.entries(byType).map(([t, n]) => `${t} x${n}`).join(', '));
  return byType;
}

app.whenReady().then(async () => {
  // Start from a clean profile: localStorage is shared across harnesses via the
  // default Electron profile, so a mode remembered by an earlier run would
  // change what this one sees.
  await session.defaultSession.clearStorageData({ storages: ['localstorage'] });
  ipcMain.handle('settings:get', () => ({ practicePaperColor: '#FFFFFF', currentTopic: 'quadratics' }));
  ipcMain.handle('settings:set', () => true);
  ipcMain.handle('prof:all', () => ({ version: 1, attempts: [] }));
  ipcMain.handle('prof:append', () => true);

  const win = new BrowserWindow({
    show: false, width: 760, height: 960,
    webPreferences: { preload: path.join(ROOT, 'preload.js'), backgroundThrottling: false },
  });

  // ---- practice templates ----------------------------------------------------------
  await win.loadFile(path.join(ROOT, 'renderer/tools/practice.html'));
  await new Promise((r) => setTimeout(r, 500));
  const tRows = JSON.parse(await win.webContents.executeJavaScript(`(async () => {
    const measure = ${MEASURE};
    const canvas = document.getElementById('viz');
    canvas.style.width = '600px'; canvas.style.height = '280px';
    document.getElementById('vizWrap').classList.remove('hidden');
    await new Promise(r => setTimeout(r, 60));
    const rows = [];
    for (const t of PRACTICE) {
      // Several draws: whether a template emits a viz can depend on its numbers.
      let spec = null;
      for (let i = 0; i < 25 && !spec; i++) { const q = t.generate(); if (q.viz) spec = q.viz; }
      if (!spec) continue;
      rows.push({ id: t.id, type: spec.type, ...measure(canvas, spec) });
    }
    return JSON.stringify(rows);
  })()`, true));
  const tTypes = judge('template', tRows);
  ok(`at least ${MIN_TEMPLATE_VIZ} templates carry a diagram`,
    tRows.length >= MIN_TEMPLATE_VIZ, String(tRows.length));

  // ---- symbols ---------------------------------------------------------------------
  await win.loadFile(path.join(ROOT, 'renderer/tools/symbols.html'));
  await new Promise((r) => setTimeout(r, 500));
  const sRows = JSON.parse(await win.webContents.executeJavaScript(`(async () => {
    const measure = ${MEASURE};
    const canvas = document.createElement('canvas');
    canvas.style.width = '600px'; canvas.style.height = '180px';
    canvas.style.position = 'fixed'; canvas.style.left = '-2000px';
    document.body.appendChild(canvas);
    await new Promise(r => setTimeout(r, 60));
    const rows = [];
    for (const s of SYMBOLS) {
      if (!s.viz) continue;
      rows.push({ id: s.id, type: s.viz.type, ...measure(canvas, s.viz) });
    }
    return JSON.stringify(rows);
  })()`, true));
  const sTypes = judge('symbol', sRows);
  ok(`at least ${MIN_SYMBOL_VIZ} symbols carry a diagram`,
    sRows.length >= MIN_SYMBOL_VIZ, String(sRows.length));

  // Every renderer the data can reach must be exercised by something, or a broken
  // one sits unnoticed until a student opens the one card that uses it.
  const { VIZ_TYPES } = require(path.join(ROOT, 'renderer', 'practice-viz.js'));
  const exercised = new Set([...Object.keys(tTypes), ...Object.keys(sTypes)]);
  const unused = VIZ_TYPES.filter((t) => !exercised.has(t));
  ok('every renderer is exercised by real data', unused.length === 0, unused.join(', '));

  console.log(fail ? `\n${fail} FAILURE(S)` : '\nALL PASS');
  app.exit(fail ? 1 : 0);
});
