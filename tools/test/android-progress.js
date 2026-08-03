// Phase 1, Android side: the real asset copies, loaded at phone size, driven
// through a stand-in for FormulaSheetActivity.Bridge with Proficiency.kt's
// semantics. Covers everything except the Kotlin itself.
const { app, BrowserWindow, session } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

const { ASSETS } = require('./paths.js');
const PRELOAD = path.join(__dirname, 'android-bridge-preload.js');
const PROF = path.join(os.tmpdir(), 'android-proficiency.json');
try { fs.unlinkSync(PROF); } catch { /* first run */ }

let fail = 0;
const ok = (label, cond, extra) => {
  if (!cond) fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${label}${extra != null ? ' :: ' + extra : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const readProf = () => {
  try { return JSON.parse(fs.readFileSync(PROF, 'utf8')); } catch { return { version: 1, attempts: [] }; }
};

// A phone, not the tablet this was written on: 1080x2340 @ 3x = 360x780 dp.
async function openPhone(file) {
  const win = new BrowserWindow({
    show: false, width: 360, height: 780,
    webPreferences: { preload: PRELOAD, contextIsolation: false, sandbox: false, backgroundThrottling: false },
  });
  win.webContents.on('console-message', (_e, level, msg) => {
    if (level >= 2 && !/Content-Security-Policy/.test(msg)) console.log('   [page error]', msg);
  });
  await win.loadFile(path.join(ASSETS, file));
  await sleep(450);
  return win;
}

process.on('unhandledRejection', (err) => {
  console.log('FAIL — harness crashed ::', err && err.message);
  app.exit(1);
});

app.whenReady().then(async () => {
  // Start from a clean profile: localStorage is shared across harnesses via the
  // default Electron profile, so a mode remembered by an earlier run would
  // change what this one sees.
  await session.defaultSession.clearStorageData({ storages: ['localstorage'] });
  // ---- 1. The practice page on a phone ------------------------------------------
  const practice = await openPhone('practice.html');

  let r = JSON.parse(await practice.webContents.executeJavaScript(`(() => JSON.stringify({
    backend: Store.backend,
    hasSkills: typeof SKILLS !== 'undefined' && SKILLS.length,
    hasProf: typeof computeProficiency === 'function',
    hasQuiz: !!document.getElementById('startQuiz'),
    hasGrading: !!document.getElementById('gotIt'),
    noWorksheet: !document.getElementById('printWorksheet'),
    bodyWidth: document.body.scrollWidth,
    viewport: window.innerWidth,
  }))()`, true));
  ok('the Android page picks the bridge backend', r.backend === 'android', r.backend);
  // Exact on purpose: this doubles as a census, so adding a skill has to be a
  // deliberate act with the placement composition re-read (see model.mjs). Bump
  // the number, don't loosen the check.
  ok('the skill graph loaded', r.hasSkills === 64, String(r.hasSkills));
  ok('practice-prof.js loaded', r.hasProf === true);
  ok('quiz markup shipped to Android', r.hasQuiz === true);
  ok('grading buttons shipped', r.hasGrading === true);
  ok('the PC-only worksheet button is absent', r.noWorksheet === true);
  ok('nothing overflows a 360dp-wide phone', r.bodyWidth <= r.viewport + 1,
    `${r.bodyWidth} vs ${r.viewport}`);

  // Tap targets: these get hit one-handed right after reading an answer.
  r = JSON.parse(await practice.webContents.executeJavaScript(`(() => {
    document.getElementById('newQ').click();
    document.getElementById('showAnswer').click();
    const g = document.getElementById('gotIt').getBoundingClientRect();
    const m = document.getElementById('missedIt').getBoundingClientRect();
    return JSON.stringify({ gotH: Math.round(g.height), missH: Math.round(m.height),
      gotW: Math.round(g.width), sideBySide: Math.abs(g.top - m.top) < 2 });
  })()`, true));
  ok('Got it / Missed it are 44px+ tall', r.gotH >= 44 && r.missH >= 44, `${r.gotH} / ${r.missH}`);
  ok('  ...side by side, not stacked', r.sideBySide === true);
  ok('  ...and wide enough to hit', r.gotW >= 120, String(r.gotW));

  // Grade through the bridge.
  await practice.webContents.executeJavaScript(
    `document.getElementById('gotIt').click()`, true);
  await sleep(200);
  let log = readProf();
  ok('grading writes through the Android bridge', log.attempts.length === 1,
    String(log.attempts.length));
  ok('  ...with a skill and mode', log.attempts[0] && log.attempts[0].skill && log.attempts[0].mode === 'self',
    JSON.stringify(log.attempts[0]));

  // A full quiz on the phone.
  r = JSON.parse(await practice.webContents.executeJavaScript(`(async () => {
    document.getElementById('quizCount').value = '5';
    document.getElementById('startQuiz').click();
    for (let i = 0; i < 5; i++) {
      document.getElementById('showAnswer').click();
      document.getElementById(i < 3 ? 'gotIt' : 'missedIt').click();
      await new Promise(r => setTimeout(r, 90));
    }
    // The summary card renders KaTeX asynchronously, so scrollWidth read straight
    // after the last click can catch the page mid-layout and report a transient
    // overflow. Wait for the width to stop changing before measuring.
    let w = -1;
    for (let i = 0; i < 25 && w !== document.body.scrollWidth; i++) {
      w = document.body.scrollWidth;
      await new Promise(r => requestAnimationFrame(() => setTimeout(r, 40)));
    }
    return JSON.stringify({
      summary: document.getElementById('quizSummary').textContent.slice(0, 40),
      shown: !document.getElementById('quizSummary').classList.contains('hidden'),
      scrollWidth: document.body.scrollWidth,
      innerWidth: window.innerWidth,
    });
  })()`, true));
  ok('Android runs a full 5-question quiz', r.shown && /3\/5/.test(r.summary), r.summary);
  ok('  ...without breaking the phone layout',
    r.scrollWidth <= r.innerWidth + 1, `${r.scrollWidth} vs ${r.innerWidth}`);
  ok('  ...logging all 5 attempts', readProf().attempts.length === 6,
    String(readProf().attempts.length));

  // Placement.
  await practice.webContents.executeJavaScript(`Android.profReset()`, true);
  r = JSON.parse(await practice.webContents.executeJavaScript(`(async () => {
    startPlacement();
    for (let i = 0; i < 12; i++) {
      document.getElementById('showAnswer').click();
      document.getElementById(i % 4 === 0 ? 'missedIt' : 'gotIt').click();
      await new Promise(r => setTimeout(r, 60));
    }
    return JSON.stringify({ summary: document.getElementById('quizSummary').textContent.slice(0, 40) });
  })()`, true));
  log = readProf();
  ok('Android runs the 12-question placement check',
    // `mode` is HOW it was graded and `flow` is WHERE it happened — two axes
    // since multiple choice landed. Placement is always self-marked.
    log.attempts.length === 12 &&
    log.attempts.every((a) => a.mode === 'self' && a.flow === 'placement'),
    `${log.attempts.length} · ${[...new Set(log.attempts.map((a) => `${a.mode}/${a.flow}`))].join(',')}`);

  // ---- 2. The .mini popup guard ---------------------------------------------------
  // PracticeActivity's 520x640dp dialog loads the SAME page.
  const mini = new BrowserWindow({
    show: false, width: 520, height: 640,
    webPreferences: { preload: PRELOAD, contextIsolation: false },
  });
  await mini.loadFile(path.join(ASSETS, 'practice.html'));
  await sleep(400);
  await mini.webContents.executeJavaScript(`document.body.classList.add('mini')`, true);
  await sleep(120);
  r = JSON.parse(await mini.webContents.executeJavaScript(`(() => {
    const vis = (id) => {
      const el = document.getElementById(id);
      return el ? getComputedStyle(el).display !== 'none' : null;
    };
    document.getElementById('newQ').click();
    document.getElementById('showAnswer').click();
    return JSON.stringify({
      quizbar: getComputedStyle(document.querySelector('.quizbar')).display !== 'none',
      summary: vis('quizSummary'),
      grading: vis('grading'),
      newQ: vis('newQ'),
      answer: vis('answer'),
      height: document.body.scrollHeight,
    });
  })()`, true));
  ok('.mini hides the quiz bar in the popup', r.quizbar === false);
  ok('.mini hides the quiz summary card', r.summary === false);
  ok('.mini KEEPS grading (the popup exists to mark a pushed question)', r.grading === true);
  ok('.mini keeps the core controls', r.newQ === true && r.answer === true);
  ok('  ...and the popup stays roughly one screen', r.height < 900, String(r.height));

  // Without .mini the quiz bar must come back — the studio uses the same file.
  r = JSON.parse(await mini.webContents.executeJavaScript(`(() => {
    document.body.classList.remove('mini');
    return JSON.stringify({
      quizbar: getComputedStyle(document.querySelector('.quizbar')).display !== 'none' });
  })()`, true));
  ok('the studio (no .mini) still shows the quiz bar', r.quizbar === true);

  // ---- 3. The progress page on a phone ---------------------------------------------
  const progress = await openPhone('progress.html');
  await sleep(400);
  r = JSON.parse(await progress.webContents.executeJavaScript(`(async () => {
    await new Promise(r => setTimeout(r, 300));
    const areas = [...document.querySelectorAll('#areas details.area')];
    const focus = [...document.querySelectorAll('#focus .pick')].map(p =>
      p.querySelector('.pick-name').textContent + ' — ' + p.querySelector('.pick-why').textContent);
    const btns = [...document.querySelectorAll('button')].map(b => Math.round(b.getBoundingClientRect().height));
    return JSON.stringify({
      backend: Store.backend,
      summary: document.getElementById('summary').textContent,
      focus, areaCount: areas.length,
      overflow: document.body.scrollWidth <= window.innerWidth + 1,
      bodyWidth: document.body.scrollWidth, viewport: window.innerWidth,
      minBtn: Math.min(...btns.filter(h => h > 0)),
      firstAreaOpen: areas[0] ? areas[0].open : null,
    });
  })()`, true));
  ok('the progress page uses the bridge', r.backend === 'android', r.backend);
  ok('it reads the placement history', /12 questions marked/.test(r.summary), r.summary);
  ok('focus-next renders on a phone', r.focus.length === 3, r.focus.join(' | '));
  console.log('   phone focus:', r.focus.join('\n                '));
  ok('area bars render', r.areaCount >= 5, String(r.areaCount));
  ok('nothing overflows 360dp', r.overflow === true, `${r.bodyWidth} vs ${r.viewport}`);
  ok('every button is a 44px target', r.minBtn >= 44, String(r.minBtn));
  ok('areas start collapsed (the list is long)', r.firstAreaOpen === false);

  // Expanding an area must not break the layout.
  r = JSON.parse(await progress.webContents.executeJavaScript(`(() => {
    const d = document.querySelector('#areas details.area');
    d.open = true;
    const skills = d.querySelectorAll('.skill');
    const go = d.querySelector('.skill .go');
    return JSON.stringify({
      skills: skills.length,
      overflow: document.body.scrollWidth <= window.innerWidth + 1,
      goH: go ? Math.round(go.getBoundingClientRect().height) : null,
      goInside: go ? go.getBoundingClientRect().right <= window.innerWidth : null,
    });
  })()`, true));
  ok('an expanded area lists its skills', r.skills > 0, String(r.skills));
  ok('  ...still fits the phone', r.overflow === true);
  ok('  ...with the Practise button on screen and tappable',
    r.goInside === true && r.goH >= 40, `${r.goH}px, on-screen: ${r.goInside}`);

  // The bridge navigation calls.
  r = JSON.parse(await progress.webContents.executeJavaScript(`(() => {
    window.__androidCalls.length = 0;
    document.querySelector('#focus .pick .go').click();
    return JSON.stringify(window.__androidCalls);
  })()`, true));
  ok('"Practise" calls Android.openSkill', r.length === 1 && r[0][0] === 'openSkill' && !!r[0][1],
    JSON.stringify(r));

  // Reset must work without window.confirm (no WebChromeClient on Android).
  r = JSON.parse(await progress.webContents.executeJavaScript(`(async () => {
    const b = document.getElementById('reset');
    b.click();
    const armed = b.textContent;
    b.click();
    await new Promise(r => setTimeout(r, 250));
    return JSON.stringify({ armed, summary: document.getElementById('summary').textContent,
      placement: !document.getElementById('placement').classList.contains('hidden') });
  })()`, true));
  ok('two-step reset works without a JS dialog', readProf().attempts.length === 0,
    `${r.armed} -> ${readProf().attempts.length} attempts`);
  ok('  ...and the placement prompt returns', r.placement === true);

  // Placement button routes through the bridge.
  r = JSON.parse(await progress.webContents.executeJavaScript(`(() => {
    window.__androidCalls.length = 0;
    document.getElementById('startPlacement').click();
    return JSON.stringify(window.__androidCalls);
  })()`, true));
  ok('"Take the check" calls Android.openPlacement',
    r.length === 1 && r[0][0] === 'openPlacement', JSON.stringify(r));

  // ---- 4. applyPaper theming (called from Kotlin) ------------------------------------
  r = JSON.parse(await progress.webContents.executeJavaScript(`(() => {
    applyPaper('#1C1C1E', '#F0F0F0');
    const cs = getComputedStyle(document.body);
    return JSON.stringify({ bg: cs.backgroundColor, fg: cs.color });
  })()`, true));
  ok('applyPaper themes the progress page for dark paper',
    r.bg === 'rgb(28, 28, 30)' && r.fg === 'rgb(240, 240, 240)', JSON.stringify(r));

  // ---- 5. Phase 8 through the bridge, at 360dp ----------------------------------------
  //
  // android-bridge-preload.js has had profResetSkill and shareText since Phase 8
  // landed and nothing has ever called them. On this platform the export must go
  // to the share sheet, NOT to the clipboard fallback — copyText puts the whole
  // log on the clipboard behind a Toast about pasting into Word, which is the
  // wrong thing to do with a file a student wants to keep.
  const now = Date.now();
  const seeded = [];
  for (let i = 0; i < 3; i++) {
    seeded.push({ t: now - i * 60000, skill: 'quadratics', tmpl: 'quad-formula',
      score: 0, mode: 'mcq', k: 4, miss: 'disc-sign', flow: 'practice' });
  }
  for (let i = 0; i < 2; i++) {
    seeded.push({ t: now - i * 60000, skill: 'linear-equations', tmpl: 'linear-eq',
      score: 1, mode: 'mcq', k: 4, flow: 'practice' });
  }
  fs.writeFileSync(PROF, JSON.stringify({ version: 1, attempts: seeded }, null, 2));

  r = JSON.parse(await progress.webContents.executeJavaScript(`(async () => {
    applyPaper('#FFFFFF', '#111111');
    await render();
    await new Promise(r => setTimeout(r, 250));
    const card = document.querySelector('#slips .pick');
    return JSON.stringify({
      shown: !document.getElementById('slipsWrap').classList.contains('hidden'),
      name: card ? card.querySelector('.pick-name').textContent : null,
      count: card ? (card.querySelector('.slip-count') || {}).textContent : null,
      scrollWidth: document.body.scrollWidth,
      innerWidth: window.innerWidth,
      forgets: document.querySelectorAll('#areas .forget').length,
    });
  })()`, true));
  ok('the slips panel renders on a phone', r.shown === true && /^You keep /.test(r.name || ''), r.name);
  ok('  ...with its count', r.count === '3×', r.count);
  ok('  ...without widening the page', r.scrollWidth <= r.innerWidth + 1,
    `${r.scrollWidth} vs ${r.innerWidth}`);
  ok('  ...and Forget only where there is history', r.forgets === 2, String(r.forgets));

  r = JSON.parse(await progress.webContents.executeJavaScript(`(async () => {
    const btn = [...document.querySelectorAll('#areas .forget')].find(b =>
      b.closest('.skill').textContent.includes('Quadratic'));
    const box = btn.getBoundingClientRect();
    btn.click(); await new Promise(r => setTimeout(r, 60));
    const mid = (await Store.profAll()).attempts.length;
    btn.click(); await new Promise(r => setTimeout(r, 250));
    const after = await Store.profAll();
    return JSON.stringify({ h: Math.round(box.height), mid,
      quad: after.attempts.filter(a => a.skill === 'quadratics').length,
      other: after.attempts.filter(a => a.skill === 'linear-equations').length });
  })()`, true));
  ok('Forget arms on the first tap, on the phone too', r.mid === 5, String(r.mid));
  ok('  ...then forgets that skill through the bridge', r.quad === 0, String(r.quad));
  ok('  ...leaving the others alone', r.other === 2, String(r.other));
  ok('  ...and it went through Proficiency.kt semantics, not a page-side rewrite',
    readProf().attempts.length === 2, String(readProf().attempts.length));

  fs.writeFileSync(PROF, JSON.stringify({ version: 1, attempts: seeded }, null, 2));
  r = JSON.parse(await progress.webContents.executeJavaScript(`(async () => {
    window.__androidCalls.length = 0;
    await render();
    document.getElementById('export-json').click();
    await new Promise(r => setTimeout(r, 200));
    document.getElementById('export-csv').click();
    await new Promise(r => setTimeout(r, 200));
    return JSON.stringify({ calls: window.__androidCalls });
  })()`, true));
  const shares = r.calls.filter((c) => c[0] === 'shareText');
  ok('export hands the file to the share sheet', shares.length === 2,
    JSON.stringify(r.calls.map((c) => c[0])));
  ok('  ...as JSON then CSV, named and typed',
    shares[0] && /\.json$/.test(shares[0][1]) && shares[0][2] === 'application/json'
    && shares[1] && /\.csv$/.test(shares[1][1]) && shares[1][2] === 'text/csv',
    JSON.stringify(shares.map((s) => [s[1], s[2]])));
  ok('  ...and never falls through to copyText',
    !r.calls.some((c) => c[0] === 'copyText'),
    JSON.stringify(r.calls.map((c) => c[0])));

  console.log(fail ? `\n${fail} FAILURE(S)` : '\nALL PASS');
  app.exit(fail ? 1 : 0);
});
