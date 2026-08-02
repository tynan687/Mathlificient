// The new diagrams, measured properly on the tablet.
//
// The first attempt counted "non-white" pixels, but the page had already been
// themed to dark paper, so every pixel counted and all four templates returned
// the identical total. This counts pixels that differ from the canvas's OWN
// background (sampled from a corner), which works on any paper colour, and
// checks the four look different from each other.
const { attach } = require('./cdp.js');
const { execFileSync } = require('child_process');

const ADB = `${process.env.LOCALAPPDATA}\\Android\\Sdk\\platform-tools\\adb.exe`;
const PKG = 'com.tynan.mathtutor';
const adb = (...args) => execFileSync(ADB, args, { encoding: 'utf8' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let fail = 0;
const ok = (label, cond, extra) => {
  if (!cond) fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${label}${extra != null ? ' :: ' + extra : ''}`);
};

function forwardDevtools() {
  const unix = adb('shell', 'cat', '/proc/net/unix');
  const names = [...unix.matchAll(/@(webview_devtools_remote_\d+)/g)].map((m) => m[1]);
  if (!names.length) return false;
  adb('forward', '--remove-all');
  adb('forward', 'tcp:9223', `localabstract:${names[names.length - 1]}`);
  return true;
}

(async () => {
  adb('shell', 'am', 'start', '-n', `${PKG}/.PracticeSpaceActivity`);
  await sleep(3000);
  let page = null;
  for (let i = 0; i < 25 && !page; i++) {
    try { if (forwardDevtools()) page = await attach('practice.html'); } catch { await sleep(500); }
  }
  if (!page) throw new Error('could not attach');

  const out = JSON.parse(await page.eval(`(async () => {
    // cosine-rule and complex-modarg are here for their renderers, not their
    // topics: they are the only templates that draw the triangle and argand
    // types, and without them those two never get drawn on the tablet at all.
    // (No backticks in this comment - it lives inside a template literal.)
    const ids = ['coord-distance', 'coord-line', 'coord-perpendicular', 'coord-intersect',
                 'circle-centre-radius', 'func-inverse', 'func-transform',
                 'trig-graph-features', 'trig-harmonic', 'trig-equation-domain',
                 'cosine-rule', 'complex-modarg'];
    const results = [];
    for (const id of ids) {
      const t = PRACTICE.find(p => p.id === id);
      show(buildQuestion(t), id);
      if (!current.viz) { results.push({ id, type: null, skipped: true }); continue; }
      const wrap = document.getElementById('vizWrap');
      if (wrap.classList.contains('hidden')) document.getElementById('vizBar').click();
      await new Promise(r => setTimeout(r, 500));
      const c = document.getElementById('viz');
      const ctx = c.getContext('2d');
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      // The corner is background by construction — renderVisual fills first.
      const bg = [d[0], d[1], d[2]];
      let ink = 0;
      const seen = new Set();
      for (let p = 0; p < d.length; p += 4) {
        const near = Math.abs(d[p] - bg[0]) + Math.abs(d[p+1] - bg[1]) + Math.abs(d[p+2] - bg[2]);
        if (near > 40) { ink++; seen.add(d[p] + ',' + d[p+1] + ',' + d[p+2]); }
      }
      results.push({ id, type: current.viz.type, ink, colours: seen.size,
        total: c.width * c.height, bg: bg.join(',') });
    }
    return JSON.stringify(results);
  })()`));

  const drawn = out.filter((r) => !r.skipped);
  for (const r of drawn) {
    const pctInk = (100 * r.ink / r.total).toFixed(2);
    ok(`${r.id} (${r.type}) draws real content`,
      r.ink > 500 && r.ink < r.total * 0.6 && r.colours > 3,
      `${r.ink} px (${pctInk}% of canvas), ${r.colours} distinct colours, bg ${r.bg}`);
  }
  // If the metric were still vacuous every template would report the same total.
  const totals = new Set(drawn.map((r) => r.ink));
  ok('the diagrams differ from one another (metric is not vacuous)',
    totals.size >= drawn.length - 1, `${totals.size} distinct ink counts across ${drawn.length}`);

  page.close();

  // ---- the symbol diagrams, on the same real WebView ------------------------------
  // The eight symbol types are drawn by the same renderer but had never been drawn
  // on the tablet, which is a different Chromium from the desktop one. Every type
  // is exercised here, so a renderer that only works on the PC cannot hide.
  adb('shell', 'am', 'force-stop', PKG);
  await sleep(1200);
  adb('shell', 'am', 'start', '-n', `${PKG}/.SymbolsActivity`);
  await sleep(3000);
  let sym = null;
  for (let i = 0; i < 25 && !sym; i++) {
    try { if (forwardDevtools()) sym = await attach('symbols.html'); } catch { await sleep(500); }
  }
  if (!sym) throw new Error('could not attach to symbols.html');

  const symOut = JSON.parse(await sym.eval(`(async () => {
    // One representative entry per type, so every renderer is covered.
    const wanted = {};
    for (const s of SYMBOLS) {
      if (s.viz && !wanted[s.viz.type]) wanted[s.viz.type] = s;
    }
    const canvas = document.createElement('canvas');
    canvas.style.width = '600px'; canvas.style.height = '180px';
    canvas.style.position = 'fixed'; canvas.style.left = '-3000px';
    document.body.appendChild(canvas);
    await new Promise(r => setTimeout(r, 80));
    const results = [];
    for (const [type, s] of Object.entries(wanted)) {
      const ctx = canvas.getContext('2d');
      let err = null;
      try { renderVisual(canvas, s.viz, vizColors()); } catch (e) { err = e.message; }
      const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const bg = [d[0], d[1], d[2]];
      let ink = 0; const seen = new Set();
      for (let p = 0; p < d.length; p += 4) {
        const near = Math.abs(d[p]-bg[0]) + Math.abs(d[p+1]-bg[1]) + Math.abs(d[p+2]-bg[2]);
        if (near > 40) { ink++; seen.add(d[p] + ',' + d[p+1] + ',' + d[p+2]); }
      }
      results.push({ id: s.id, type, err, ink, colours: seen.size,
        total: canvas.width * canvas.height, bg: bg.join(',') });
    }
    return JSON.stringify(results);
  })()`));

  for (const r of symOut) {
    if (r.err) { ok(`symbol ${r.id} (${r.type}) draws`, false, r.err); continue; }
    const pctInk = (100 * r.ink / r.total).toFixed(2);
    ok(`symbol ${r.id} (${r.type}) draws real content`,
      r.ink > 500 && r.ink < r.total * 0.6 && r.colours > 3,
      `${r.ink} px (${pctInk}%), ${r.colours} colours, bg ${r.bg}`);
  }
  const symTotals = new Set(symOut.map((r) => r.ink));
  ok('  ...and each type draws something different',
    symTotals.size >= symOut.length - 1,
    `${symTotals.size} distinct across ${symOut.length} types`);

  const { VIZ_TYPES } = require(`${process.env.LOCALAPPDATA}\\vmt-build\\renderer\\practice-viz.js`);
  const covered = new Set([...drawn.map((r) => r.type), ...symOut.map((r) => r.type)]);
  const missed = VIZ_TYPES.filter((t) => !covered.has(t));
  ok('every renderer has now drawn on the tablet', missed.length === 0, missed.join(', '));

  sym.close();
  console.log(fail ? `\n${fail} FAILURE(S)` : '\nALL PASS');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('HARNESS ERROR:', e.message); process.exit(1); });
