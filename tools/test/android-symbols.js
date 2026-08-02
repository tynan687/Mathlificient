// The symbols page on Android: the real asset copy at phone size, with a
// stand-in for the bridge's speak().
const { app, BrowserWindow, session } = require('electron');
const path = require('path');

const { ASSETS } = require('./paths.js');
const PRELOAD = path.join(__dirname, 'android-bridge-preload.js');

let fail = 0;
const ok = (label, cond, extra) => {
  if (!cond) fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${label}${extra != null ? ' :: ' + extra : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
process.on('unhandledRejection', (e) => {
  console.log('FAIL — harness crashed ::', e && e.message);
  app.exit(1);
});

app.whenReady().then(async () => {
  // Start from a clean profile: localStorage is shared across harnesses via the
  // default Electron profile, so a mode remembered by an earlier run would
  // change what this one sees.
  await session.defaultSession.clearStorageData({ storages: ['localstorage'] });
  // 1080x2340 at 3x = 360x780 dp.
  const win = new BrowserWindow({
    show: false, width: 360, height: 780,
    webPreferences: {
      preload: PRELOAD, contextIsolation: false, sandbox: false, backgroundThrottling: false,
    },
  });
  win.webContents.on('console-message', (_e, level, msg) => {
    if (level >= 2 && !/Content-Security-Policy/.test(msg)) console.log('   [page error]', msg);
  });
  await win.loadFile(path.join(ASSETS, 'symbols.html'));
  await sleep(700);
  const js = (src) => win.webContents.executeJavaScript(src, true);

  let r = JSON.parse(await js(`(() => JSON.stringify({
    symbols: typeof SYMBOLS !== 'undefined' ? SYMBOLS.length : 0,
    readings: typeof READINGS !== 'undefined' ? READINGS.length : 0,
    cards: document.querySelectorAll('.sym').length,
    rendered: document.querySelectorAll('.katex').length,
    pending: document.querySelectorAll('.tex-pending').length,
    noHScroll: document.body.scrollWidth <= window.innerWidth + 1,
    bodyW: document.body.scrollWidth, viewport: window.innerWidth,
  }))()`));
  // Exact on purpose — a census, so adding entries is a deliberate act. Bump it.
  ok('the symbols page loads on a phone', r.symbols === 159 && r.cards === 159,
    `${r.cards} cards`);
  ok('  ...with the readings', r.readings === 20, String(r.readings));
  ok('  ...typesetting lazily', r.rendered > 0 && r.rendered < 60,
    `${r.rendered} rendered, ${r.pending} pending`);
  ok('  ...and nothing overflows 360dp', r.noHScroll === true, `${r.bodyW} vs ${r.viewport}`);

  // Speech: the page must use the Kotlin bridge, not Web Speech.
  r = JSON.parse(await js(`(async () => {
    const card = document.querySelector('.sym[data-id="integral"]');
    card.querySelector('.sym-head').click();
    await new Promise(r => setTimeout(r, 250));
    window.__androidCalls.length = 0;
    const btn = card.querySelector('.speak');
    const box = btn ? btn.getBoundingClientRect() : null;
    if (btn) btn.click();
    await new Promise(r => setTimeout(r, 150));
    return JSON.stringify({
      hasButton: !!btn,
      h: box ? Math.round(box.height) : 0, w: box ? Math.round(box.width) : 0,
      calls: window.__androidCalls,
      sayLineVisible: !!card.querySelector('.ex-say-text').textContent.trim(),
    });
  })()`));
  ok('the speak button appears when the bridge offers speech', r.hasButton === true);
  ok('  ...as a 44px target', r.h >= 44 && r.w >= 44, `${r.w}x${r.h}`);
  ok('  ...and routes through Android.speak, not Web Speech',
    r.calls.length === 1 && r.calls[0][0] === 'speak', JSON.stringify(r.calls));
  ok('  ...with the written line there regardless', r.sayLineVisible === true);

  // Touch targets on the things a finger actually hits.
  r = JSON.parse(await js(`(() => {
    const h = (sel) => {
      const el = document.querySelector(sel);
      return el ? Math.round(el.getBoundingClientRect().height) : 0;
    };
    return JSON.stringify({
      tab: h('.tab'), chip: h('.chip'), head: h('.sym-head'), search: h('#search'),
    });
  })()`));
  ok('tabs are 44px', r.tab >= 44, String(r.tab));
  ok('chips are comfortable', r.chip >= 40, String(r.chip));
  ok('symbol rows are 44px', r.head >= 44, String(r.head));
  ok('the search box is 40px+', r.search >= 40, String(r.search));

  // Reading tab on a phone.
  r = JSON.parse(await js(`(async () => {
    document.getElementById('tabRead').click();
    await new Promise(r => setTimeout(r, 400));
    const first = document.querySelector('.reading');
    const tokens = [...first.querySelectorAll('.token')];
    return JSON.stringify({
      cards: document.querySelectorAll('.reading').length,
      tokenH: tokens.length ? Math.round(tokens[0].getBoundingClientRect().height) : 0,
      noHScroll: document.body.scrollWidth <= window.innerWidth + 1,
      texScrolls: getComputedStyle(first.querySelector('.reading-tex')).overflowX,
    });
  })()`));
  ok('readings render on a phone', r.cards === 20, String(r.cards));
  ok('  ...tokens are 44px targets', r.tokenH >= 44, String(r.tokenH));
  ok('  ...the page still does not scroll sideways', r.noHScroll === true);
  ok('  ...and a wide expression scrolls inside its own box, not the page',
    r.texScrolls === 'auto', r.texScrolls);

  // applyPaper, called from Kotlin on every paper-colour change.
  r = JSON.parse(await js(`(() => {
    applyPaper('#1C1C1E', '#F0F0F0');
    return JSON.stringify({
      body: getComputedStyle(document.body).backgroundColor,
      colour: getComputedStyle(document.body).color,
    });
  })()`));
  ok('applyPaper themes the symbols page',
    r.body === 'rgb(28, 28, 30)' && r.colour === 'rgb(240, 240, 240)', JSON.stringify(r));

  console.log(fail ? `\n${fail} FAILURE(S)` : '\nALL PASS');
  app.exit(fail ? 1 : 0);
});
