// The theme and the accent, on every page.
//
// This is the suite the theme setting needed and never had. It shipped working
// on seven pages and doing nothing at all on the four a student spends the most
// time in — practice, progress, symbols and the worksheet — and nothing could
// have told you, because "the page loaded" was as far as any check went.
//
// So the assertions here are about EFFECT, not wiring: the pixels change when
// the setting changes. A page that links the stylesheet and ignores it fails.
const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');

const { PC: ROOT } = require('./paths.js');

// The worksheet is deliberately excluded from the theme assertions: it is a
// printable sheet and keeps its own white paper on purpose. It still has to LOAD
// the shared files, so it stays in the structural list below.
const PAGES = [
  'renderer/settings.html', 'renderer/menu.html', 'renderer/chat.html',
  'renderer/tools/practice.html', 'renderer/tools/progress.html',
  'renderer/tools/symbols.html', 'renderer/tools/formulas.html',
  'renderer/tools/converter.html', 'renderer/tools/timer.html',
  'renderer/tools/ambient.html',
];
const PRINT_PAGES = ['renderer/tools/worksheet.html'];

let fail = 0;
const ok = (label, cond, extra) => {
  if (!cond) fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${label}${extra != null ? ` :: ${extra}` : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

process.on('unhandledRejection', (err) => {
  console.log('FAIL — harness crashed ::', err && err.message);
  app.exit(1);
});
setTimeout(() => { console.log('FAIL — harness timed out'); app.exit(1); }, 180000).unref();

/** sRGB relative luminance of an "rgb(r, g, b)" string. */
function luminance(rgb) {
  const m = /(\d+(?:\.\d+)?)\D+(\d+(?:\.\d+)?)\D+(\d+(?:\.\d+)?)/.exec(String(rgb));
  if (!m) return null;
  const lin = (v) => {
    const c = Number(v) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(m[1]) + 0.7152 * lin(m[2]) + 0.0722 * lin(m[3]);
}
const contrast = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)];
  if (x == null || y == null) return null;
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

let SETTINGS = { theme: 'system', accent: '#4F7DF7', practicePaperColor: '#FFFFFF', currentTopic: 'quadratics' };

app.whenReady().then(async () => {
  await session.defaultSession.clearStorageData({ storages: ['localstorage'] });
  ipcMain.handle('settings:get', () => SETTINGS);
  ipcMain.handle('settings:set', () => true);
  for (const ch of ['apikey:exists', 'prof:append', 'prof:reset', 'prof:resetSkill',
    'spend:add', 'studylog:append', 'memory:add', 'memory:delete', 'memory:clear',
    'apikey:save', 'pdf:add', 'pdf:remove', 'working:clear']) ipcMain.handle(ch, () => true);
  ipcMain.handle('memory:get', () => ({ notes: [] }));
  ipcMain.handle('studylog:get', () => ({ sessions: [] }));
  ipcMain.handle('prof:all', () => ({ version: 1, attempts: [] }));
  ipcMain.handle('spend:get', () => ({ today: 0, week: 0 }));
  for (const ch of ['capture:list-sources', 'pdf:list', 'pdf:search', 'working:list',
    'search:web']) ipcMain.handle(ch, () => []);
  ipcMain.handle('vision:check', () => ({ ok: true }));
  ipcMain.handle('realtime:mint', () => ({}));
  ipcMain.handle('capture:screen', () => null);
  ipcMain.handle('practice:check', () => ({ verdict: 'none' }));
  ipcMain.handle('practice:working', () => null);
  // Broadcast exactly as main.js does, so re-theming is tested through the real path.
  ipcMain.on('theme:changed', () => {
    for (const w of BrowserWindow.getAllWindows()) w.webContents.send('theme:changed');
  });

  const wins = {};
  for (const page of [...PAGES, ...PRINT_PAGES]) {
    const win = new BrowserWindow({
      show: false, width: 900, height: 900,
      webPreferences: { preload: path.join(ROOT, 'preload.js'), backgroundThrottling: false },
    });
    await win.loadFile(path.join(ROOT, page));
    wins[page] = win;
  }
  await sleep(600);

  const read = (page, expr) => wins[page].webContents.executeJavaScript(expr, true);

  /** Re-broadcast the theme and wait for every page to have applied it. */
  async function setTheme(patch) {
    SETTINGS = { ...SETTINGS, ...patch };
    for (const w of Object.values(wins)) w.webContents.send('theme:changed');
    await sleep(350);
  }

  // ---- 1. every page loads the shared files --------------------------------------
  {
    const missing = [];
    for (const page of [...PAGES, ...PRINT_PAGES]) {
      const has = JSON.parse(await read(page, `JSON.stringify({
        css: !!document.querySelector('link[href$="app.css"]'),
        js: [...document.querySelectorAll('script[src]')].some(s => s.src.endsWith('theme.js')),
      })`));
      if (!has.css || !has.js) missing.push(`${path.basename(page)}${has.css ? '' : ' -app.css'}${has.js ? '' : ' -theme.js'}`);
    }
    ok(`every page loads app.css and theme.js (${PAGES.length + PRINT_PAGES.length} pages)`,
      missing.length === 0, missing.join(', ') || 'all present');
  }

  // ---- 2. the theme actually changes the pixels ------------------------------------
  await setTheme({ theme: 'light' });
  const light = {};
  for (const page of PAGES) light[page] = await read(page, 'getComputedStyle(document.body).backgroundColor');

  await setTheme({ theme: 'dark' });
  const dark = {};
  for (const page of PAGES) dark[page] = await read(page, 'getComputedStyle(document.body).backgroundColor');

  // menu.html's body is transparent by design — it is a frameless popup and the
  // themed surface is .menu inside it. practice.html's body is the PAPER colour,
  // which is a separate setting on purpose: it is the sheet you write on, not app
  // chrome, and practice-ink.js drives it through applyPaper on PC as well as
  // Android. Both still have to pick up the accent, which section 3 checks.
  const BODY_THEMED = PAGES.filter((p) =>
    !/menu\.html|practice\.html/.test(p));
  {
    const stuck = BODY_THEMED.filter((p) => light[p] === dark[p]);
    ok('light and dark give every page a different background', stuck.length === 0,
      stuck.map((p) => `${path.basename(p)} stuck at ${light[p]}`).join(', ') || `${BODY_THEMED.length} pages`);
    const notDark = BODY_THEMED.filter((p) => (luminance(dark[p]) ?? 1) > 0.5);
    ok('  ...and dark is actually dark', notDark.length === 0,
      notDark.map((p) => `${path.basename(p)} ${dark[p]}`).join(', ') || 'all dark');
  }

  await setTheme({ theme: 'sepia' });
  {
    const wrong = [];
    for (const page of BODY_THEMED) {
      const seen = await read(page, 'getComputedStyle(document.body).backgroundColor');
      if (seen === light[page] || seen === dark[page]) wrong.push(`${path.basename(page)} ${seen}`);
    }
    // Sepia was the theme most likely to be partial: it used to be a hardcoded
    // list of four selectors, so a page not on the list simply stayed as it was.
    ok('sepia reaches every page too', wrong.length === 0, wrong.join(', ') || `${BODY_THEMED.length} pages`);
  }

  {
    // The menu is the one page whose themed surface is not <body>. Skipping it
    // entirely would leave the popup free to ignore the theme unnoticed.
    await setTheme({ theme: 'light' });
    const l = await read('renderer/menu.html', "getComputedStyle(document.querySelector('.menu')).backgroundColor");
    await setTheme({ theme: 'dark' });
    const d = await read('renderer/menu.html', "getComputedStyle(document.querySelector('.menu')).backgroundColor");
    ok('the popup menu themes its own surface', l !== d, `${l} -> ${d}`);
  }

  // ---- 3. the accent reaches buttons AND the diagrams --------------------------------
  await setTheme({ theme: 'light', accent: '#2FB65D' });
  {
    const button = await read('renderer/settings.html',
      "getComputedStyle(document.querySelector('button.primary')).backgroundColor");
    ok('a chosen accent paints the primary buttons', /47,\s*182,\s*93/.test(button), button);

    const token = await read('renderer/tools/practice.html',
      "getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()");
    ok('  ...and is on the token every page reads', token.toLowerCase() === '#2fb65d', token);

    // The one a structural check would miss: a canvas cannot read a CSS variable,
    // so the diagram had its own copy of the colour and ignored the setting.
    const viz = await read('renderer/tools/practice.html', 'vizColors().accent');
    ok('  ...and reaches the diagram colour', String(viz).toLowerCase() === '#2fb65d', viz);
  }

  // ---- 4. a colour setting must not be able to make the app unreadable -----------------
  {
    const bad = [];
    for (const [theme, accent] of [['light', '#F0A322'], ['dark', '#F0A322'],
      ['sepia', '#0E7C86'], ['light', '#111827'], ['dark', '#4F7DF7']]) {
      await setTheme({ theme, accent });
      const r = JSON.parse(await read('renderer/settings.html', `(() => {
        const body = getComputedStyle(document.body);
        const btn = getComputedStyle(document.querySelector('button.primary'));
        return JSON.stringify({ bg: body.backgroundColor, fg: body.color,
          abg: btn.backgroundColor, afg: btn.color });
      })()`));
      const text = contrast(r.bg, r.fg);
      const onAccent = contrast(r.abg, r.afg);
      if (text < 7) bad.push(`${theme}: body text ${text.toFixed(1)}:1`);
      // 4.5:1 is the WCAG AA floor for normal text; button labels are the only
      // place the user's own colour choice sits behind text.
      if (onAccent < 4.5) bad.push(`${theme}+${accent}: on-accent ${onAccent.toFixed(1)}:1`);
    }
    ok('every theme and accent stays readable', bad.length === 0, bad.join(' · ') || '5 combinations');
  }

  // ---- 5. the print sheet stays printable ------------------------------------------------
  await setTheme({ theme: 'dark', accent: '#4F7DF7' });
  {
    const bg = await read(PRINT_PAGES[0], 'getComputedStyle(document.body).backgroundColor');
    // Themeing the worksheet would print a black page. It links app.css for the
    // controls and overrides the paper on purpose.
    ok('the worksheet keeps white paper on a dark theme', (luminance(bg) ?? 0) > 0.9, bg);
  }

  console.log(fail ? `\n${fail} FAILURE(S)` : '\nALL PASS');
  app.exit(fail ? 1 : 0);
});
