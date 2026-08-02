// The symbols page: search, browse, cross-references, and reading breakdowns.
const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');

const { PC: ROOT, ASSETS } = require('./paths.js');

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

async function open(w, h) {
  const win = new BrowserWindow({
    show: false, width: w, height: h,
    webPreferences: { preload: path.join(ROOT, 'preload.js'), backgroundThrottling: false },
  });
  win.webContents.on('console-message', (_e, level, msg) => {
    if (level >= 2 && !/Content-Security-Policy/.test(msg)) console.log('   [page error]', msg);
  });
  await win.loadFile(path.join(ROOT, 'renderer/tools/symbols.html'));
  await sleep(600);
  return win;
}

app.whenReady().then(async () => {
  // Start from a clean profile: localStorage is shared across harnesses via the
  // default Electron profile, so a mode remembered by an earlier run would
  // change what this one sees.
  await session.defaultSession.clearStorageData({ storages: ['localstorage'] });
  ipcMain.handle('settings:get', () => ({}));
  const win = await open(620, 860);
  const js = (src) => win.webContents.executeJavaScript(src, true);

  // ---- 1. It loads, and does NOT typeset everything up front ------------------
  let r = JSON.parse(await js(`(() => JSON.stringify({
    symbols: SYMBOLS.length,
    cards: document.querySelectorAll('.sym').length,
    categories: document.querySelectorAll('h2.cat').length,
    chips: document.querySelectorAll('.chip').length,
    rendered: document.querySelectorAll('.katex').length,
    pending: document.querySelectorAll('.tex-pending').length,
    count: document.getElementById('count').textContent,
  }))()`));
  ok('every symbol has a card', r.cards === r.symbols, `${r.cards}/${r.symbols}`);
  ok('grouped under category headings', r.categories >= 10, String(r.categories));
  ok('with a chip per category', r.chips >= 11, String(r.chips));
  // Exact on purpose — a census, so adding entries is a deliberate act. Bump it.
  ok('the count is shown', /159 symbols/.test(r.count), r.count);
  // The whole point of the lazy path: only what's near the viewport is typeset.
  ok('KaTeX is deferred, not run on all ~300 expressions at load',
    r.rendered > 0 && r.rendered < 60, `${r.rendered} rendered, ${r.pending} still pending`);
  ok('  ...but the visible ones ARE rendered', r.rendered >= 5, String(r.rendered));

  // ---- 2. Opening a card typesets its contents --------------------------------
  r = JSON.parse(await js(`(async () => {
    const card = document.querySelector('.sym[data-id="integral"]');
    const before = card.querySelectorAll('.katex').length;
    card.querySelector('.sym-head').click();
    await new Promise(r => setTimeout(r, 200));
    return JSON.stringify({
      before, after: card.querySelectorAll('.katex').length,
      stillPending: card.querySelectorAll('.tex-pending').length,
      bodyShown: !card.querySelector('.sym-body').classList.contains('hidden'),
      meaning: card.querySelector('.sym-meaning').textContent,
      exampleSay: card.querySelector('.ex-say-text').textContent,
      confusables: [...card.querySelectorAll('.cf-name')].map(n => n.textContent),
    });
  })()`));
  ok('opening a card reveals its body', r.bodyShown === true);
  ok('  ...and typesets what was deferred inside it',
    r.after > r.before && r.stillPending === 0, `${r.before} -> ${r.after}`);
  ok('  ...showing what it means', /stretched S/.test(r.meaning), r.meaning.slice(0, 50));
  ok('  ...and how to say the example', /the integral of x squared/.test(r.exampleSay),
    r.exampleSay);
  ok('  ...and what it gets confused with', r.confusables.length >= 2, r.confusables.join(', '));

  // ---- 3. Confusion resolves both ways ------------------------------------------
  r = JSON.parse(await js(`(() => JSON.stringify({
    // Declared on not-equals only; equals must still show it.
    equalsSees: confusablesOf('equals').map(c => c.id),
    notEqualsSees: confusablesOf('not-equals').map(c => c.id),
    // Declared on epsilon only; element-of must still show it.
    elementSees: confusablesOf('element-of').map(c => c.id),
  }))()`));
  ok('a one-sided declaration resolves both ways',
    r.equalsSees.includes('not-equals') && r.notEqualsSees.includes('equals'),
    `equals sees: ${r.equalsSees.join(', ')}`);
  ok('  ...including the epsilon / element-of trap',
    r.elementSees.includes('epsilon'), r.elementSees.join(', '));

  // ---- 4. Search ------------------------------------------------------------------
  const search = async (q) => JSON.parse(await js(`(async () => {
    const s = document.getElementById('search');
    s.value = ${JSON.stringify(q)};
    s.dispatchEvent(new Event('input'));
    await new Promise(r => setTimeout(r, 150));
    return JSON.stringify({
      n: document.querySelectorAll('.sym').length,
      first: (document.querySelector('.sym-name') || {}).textContent || null,
      empty: !document.getElementById('empty').classList.contains('hidden'),
    });
  })()`));

  r = await search('integral');
  ok('searching a name finds it', r.n >= 1 && /Integral/.test(r.first), `${r.n}: ${r.first}`);
  r = await search('\\partial');
  ok('searching the LaTeX finds it', r.n >= 1 && /Partial/.test(r.first), `${r.n}: ${r.first}`);
  r = await search('curly d');
  ok('searching a description finds it', r.n >= 1 && /Partial/.test(r.first), `${r.n}: ${r.first}`);
  r = await search('given');
  ok('searching how it sounds finds it', r.n >= 1, `${r.n}: ${r.first}`);
  r = await search('zzzzz');
  ok('a nonsense search shows the empty note', r.n === 0 && r.empty === true);
  await search('');

  // ---- 5. Category filter ----------------------------------------------------------
  r = JSON.parse(await js(`(async () => {
    const chips = [...document.querySelectorAll('.chip')];
    const calc = chips.find(c => c.textContent === 'Calculus');
    calc.click();
    await new Promise(r => setTimeout(r, 150));
    return JSON.stringify({
      n: document.querySelectorAll('.sym').length,
      headings: document.querySelectorAll('h2.cat').length,
      on: document.querySelectorAll('.chip.on')[0].textContent,
      count: document.getElementById('count').textContent,
    });
  })()`));
  ok('a category chip filters the list', r.n >= 8 && r.n < 30, String(r.n));
  ok('  ...marks itself active', r.on === 'Calculus', r.on);
  ok('  ...drops the category headings when only one is shown', r.headings === 0);
  ok('  ...and updates the count', /of 159/.test(r.count), r.count);
  await js(`document.querySelectorAll('.chip')[0].click()`);
  await sleep(150);

  // ---- 6. Reading a whole expression --------------------------------------------------
  r = JSON.parse(await js(`(async () => {
    document.getElementById('tabRead').click();
    await new Promise(r => setTimeout(r, 300));
    const cards = [...document.querySelectorAll('.reading')];
    const quad = document.querySelector('.reading[data-id="quadratic-formula"]');
    const tokens = [...quad.querySelectorAll('.token')];
    tokens[0].click();
    await new Promise(r => setTimeout(r, 120));
    return JSON.stringify({
      browseHidden: document.getElementById('browse').classList.contains('hidden'),
      readShown: !document.getElementById('read').classList.contains('hidden'),
      cards: cards.length,
      tokens: tokens.length,
      full: quad.querySelector('.reading-full-text').textContent,
      firstSay: tokens[0].querySelector('.token-say').textContent,
      lit: tokens[0].classList.contains('lit'),
      notes: quad.querySelectorAll('.token-note').length,
    });
  })()`));
  ok('the Read tab swaps the panes', r.browseHidden && r.readShown);
  ok('every reading is listed', r.cards === 20, String(r.cards));
  ok('the quadratic formula breaks into pieces', r.tokens >= 4, String(r.tokens));
  ok('  ...with the whole line written out',
    /all over two a/.test(r.full), r.full.slice(0, 60));
  ok('  ...each piece said in reading order', /x equals/.test(r.firstSay), r.firstSay);
  ok('  ...tapping one highlights it', r.lit === true);
  ok('  ...and the grouping notes are there', r.notes >= 2, String(r.notes));

  // ---- 7. Jumping between the two surfaces -----------------------------------------------
  r = JSON.parse(await js(`(async () => {
    // From a symbol card's "read it in context" link into the Read tab.
    document.getElementById('tabBrowse').click();
    await new Promise(r => setTimeout(r, 150));
    const card = document.querySelector('.sym[data-id="sigma-sum"]');
    card.querySelector('.sym-head').click();
    await new Promise(r => setTimeout(r, 150));
    const link = card.querySelector('.reading-link');
    const linkText = link ? link.textContent : null;
    if (link) link.click();
    await new Promise(r => setTimeout(r, 300));
    return JSON.stringify({
      linkText,
      onRead: !document.getElementById('read').classList.contains('hidden'),
      litReading: !!document.querySelector('.reading.lit'),
    });
  })()`));
  ok('a symbol links out to a reading that uses it', !!r.linkText, r.linkText);
  ok('  ...which switches tab and highlights it', r.onRead && r.litReading);

  r = JSON.parse(await js(`(async () => {
    // From one symbol's "confused with" pill to that other symbol.
    document.getElementById('tabBrowse').click();
    await new Promise(r => setTimeout(r, 150));
    const card = document.querySelector('.sym[data-id="abs"]');
    card.querySelector('.sym-head').click();
    await new Promise(r => setTimeout(r, 150));
    card.querySelector('.cf-pill').click();
    await new Promise(r => setTimeout(r, 300));
    const open = document.querySelector('.sym.open');
    return JSON.stringify({
      openId: open ? open.dataset.id : null,
      onlyOneOpen: document.querySelectorAll('.sym.open').length,
    });
  })()`));
  ok('tapping a "confused with" pill opens that symbol',
    r.openId && r.openId !== 'abs', r.openId);
  ok('  ...and only one card is open at a time', r.onlyOneOpen === 1, String(r.onlyOneOpen));

  // ---- 8. Layout ---------------------------------------------------------------------------
  r = JSON.parse(await js(`(() => JSON.stringify({
    noHScroll: document.body.scrollWidth <= document.documentElement.clientWidth + 1,
    bodyW: document.body.scrollWidth, viewport: document.documentElement.clientWidth,
  }))()`));
  ok('the page never scrolls sideways', r.noHScroll === true, `${r.bodyW} vs ${r.viewport}`);

  console.log(fail ? `\n${fail} FAILURE(S)` : '\nALL PASS');
  app.exit(fail ? 1 : 0);
});
