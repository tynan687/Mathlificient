// Phase 2 on Android: the real asset copies at phone size, driven through a
// stand-in for FormulaSheetActivity.Bridge. Covers everything but the Kotlin.
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
const lastAttempt = () => readProf().attempts.slice(-1)[0] || {};

process.on('unhandledRejection', (e) => {
  console.log('FAIL — harness crashed ::', e && e.message);
  app.exit(1);
});

// 1080x2340 at 3x = 360x780 dp, the phone this has to work on.
async function openPhone(file, w, h) {
  const win = new BrowserWindow({
    show: false, width: w || 360, height: h || 780,
    webPreferences: {
      preload: PRELOAD, contextIsolation: false, sandbox: false, backgroundThrottling: false,
    },
  });
  win.webContents.on('console-message', (_e, level, msg) => {
    if (level >= 2 && !/Content-Security-Policy/.test(msg)) console.log('   [page error]', msg);
  });
  await win.loadFile(path.join(ASSETS, file));
  await sleep(450);
  return win;
}

app.whenReady().then(async () => {
  await session.defaultSession.clearStorageData({ storages: ['localstorage'] });
  const win = await openPhone('practice.html');
  const js = (src) => win.webContents.executeJavaScript(src, true);

  let r = JSON.parse(await js(`(() => JSON.stringify({
    backend: Store.backend,
    hasMcq: typeof buildChoices === 'function',
    hasModeSel: !!document.getElementById('answerMode'),
    hasGrid: !!document.getElementById('choices'),
    hasNext: !!document.getElementById('mcqNext'),
    defaultMode: answerMode,
    storageWorks: (() => { try { localStorage.setItem('t','1'); return localStorage.getItem('t') === '1'; }
                          catch { return false; } })(),
  }))()`));
  ok('the Android page has the MCQ module', r.hasMcq === true);
  ok('  ...the mode selector, grid and Next button', r.hasModeSel && r.hasGrid && r.hasNext);
  ok('  ...still uses the bridge for storage', r.backend === 'android', r.backend);
  ok('  ...defaults to working it out', r.defaultMode === 'self', r.defaultMode);
  ok('  ...and localStorage is available for the remembered mode', r.storageWorks === true);

  // ---- Answering by touch --------------------------------------------------------
  r = JSON.parse(await js(`(async () => {
    answerMode = 'mcq';
    show(buildQuestion(PRACTICE.find(p => p.id === 'quad-formula')), 'test');
    await new Promise(r => setTimeout(r, 150));
    const cells = [...document.querySelectorAll('.mcq-option')];
    const boxes = cells.map(c => c.getBoundingClientRect());
    const wrong = current.choices.options.findIndex(o => o.why !== null);
    cells[wrong].click();
    await new Promise(r => setTimeout(r, 200));
    const fb = document.getElementById('mcqFeedback');
    return JSON.stringify({
      count: cells.length,
      minH: Math.round(Math.min(...boxes.map(b => b.height))),
      twoPerRow: Math.abs(boxes[0].top - boxes[1].top) < 2 &&
                 Math.abs(boxes[0].top - boxes[2].top) > 10,
      allOnScreen: boxes.every(b => b.right <= window.innerWidth + 1),
      noHScroll: document.body.scrollWidth <= window.innerWidth + 1,
      bodyW: document.body.scrollWidth, viewport: window.innerWidth,
      feedback: fb.textContent, feedbackBad: fb.className.includes('bad'),
      nextH: Math.round(document.getElementById('mcqNext').getBoundingClientRect().height),
    });
  })()`));
  ok('four options render on a 360dp phone', r.count === 4);
  ok('  ...as a 2x2 grid', r.twoPerRow === true);
  ok('  ...each a 44px+ touch target', r.minH >= 44, String(r.minH));
  ok('  ...all within the viewport', r.allOnScreen === true);
  ok('  ...with no sideways scroll', r.noHScroll === true, `${r.bodyW} vs ${r.viewport}`);
  ok('a wrong pick explains the slip', r.feedback.length > 15 && r.feedbackBad, r.feedback);
  ok('  ...and Next is a 44px target', r.nextH >= 44, String(r.nextH));

  let a = lastAttempt();
  ok('the attempt reaches the bridge with mode, k and miss',
    a.mode === 'mcq' && a.k === 4 && !!a.miss, JSON.stringify(a));

  // ---- applyPaper must not eat the right/wrong colours ----------------------------
  r = JSON.parse(await js(`(() => {
    applyPaper('#1C1C1E', '#F0F0F0');
    const cells = [...document.querySelectorAll('.mcq-option')];
    const correct = cells.find(c => c.classList.contains('correct'));
    const wrong = cells.find(c => c.classList.contains('wrong'));
    const cs = (el) => { const s = getComputedStyle(el); return { border: s.borderTopColor, shadow: s.boxShadow }; };
    return JSON.stringify({
      body: getComputedStyle(document.body).backgroundColor,
      correct: cs(correct), wrong: cs(wrong),
      feedback: getComputedStyle(document.getElementById('mcqFeedback')).color,
    });
  })()`));
  ok('dark paper themes the page', r.body === 'rgb(28, 28, 30)', r.body);
  ok('  ...but the correct option stays green',
    /46, 125, 50/.test(r.correct.border) || /46, 125, 50/.test(r.correct.shadow),
    JSON.stringify(r.correct));
  ok('  ...and the wrong one stays red',
    /198, 40, 40/.test(r.wrong.border) || /198, 40, 40/.test(r.wrong.shadow),
    JSON.stringify(r.wrong));
  ok('  ...as does the feedback text', /198, 40, 40/.test(r.feedback), r.feedback);

  // ---- A full quiz on the phone ----------------------------------------------------
  await js(`Android.profReset()`);
  r = JSON.parse(await js(`(async () => {
    answerMode = 'mcq';
    document.getElementById('quizCount').value = '5';
    document.getElementById('startQuiz').click();
    let picked = 0;
    for (let i = 0; i < 5; i++) {
      const cells = [...document.querySelectorAll('.mcq-option')];
      if (cells.length) {
        picked++;
        cells[current.choices.answerIndex].click();
        await new Promise(r => setTimeout(r, 100));
        document.getElementById('mcqNext').click();
      } else {
        document.getElementById('showAnswer').click();
        document.getElementById('gotIt').click();
      }
      await new Promise(r => setTimeout(r, 100));
    }
    return JSON.stringify({ picked,
      summary: document.getElementById('quizSummary').textContent.slice(0, 30),
      noHScroll: document.body.scrollWidth <= window.innerWidth + 1 });
  })()`));
  ok('a 5-question quiz runs on the phone', /5\/5/.test(r.summary), r.summary);
  ok('  ...without breaking the layout', r.noHScroll === true);
  const qlog = readProf().attempts;
  ok('  ...logging every attempt through the bridge', qlog.length === 5, String(qlog.length));
  ok('  ...as mcq in the quiz flow', qlog.filter((x) => x.mode === 'mcq' && x.flow === 'quiz').length === r.picked,
    `${r.picked} picked · ${[...new Set(qlog.map((x) => x.mode + '/' + x.flow))].join(',')}`);

  // ---- The .mini popup --------------------------------------------------------------
  const mini = await openPhone('practice.html', 520, 640);
  await mini.webContents.executeJavaScript(`document.body.classList.add('mini')`, true);
  await sleep(150);
  r = JSON.parse(await mini.webContents.executeJavaScript(`(async () => {
    const vis = (id) => {
      const el = document.getElementById(id);
      return el ? getComputedStyle(el).display !== 'none' : null;
    };
    // The popup only ever shows tutor-pushed questions.
    answerMode = 'mcq';
    showTutorQuestion({ question: 'x^2 = 9', steps: ['x = \\\\pm 3'], answer: 'x = \\\\pm 3',
                        topic: 'quadratics' });
    document.getElementById('showAnswer').click();
    await new Promise(r => setTimeout(r, 120));
    return JSON.stringify({
      quizbar: getComputedStyle(document.querySelector('.quizbar')).display !== 'none',
      modeNote: vis('modeNote'), choices: vis('choices'), feedback: vis('mcqFeedback'),
      grading: !document.getElementById('grading').classList.contains('hidden'),
      height: document.body.scrollHeight,
    });
  })()`, true));
  ok('.mini hides the mode picker and the grid',
    !r.quizbar && !r.modeNote && !r.choices && !r.feedback, JSON.stringify(r));
  ok('  ...but keeps self-marking, which is what the popup is for', r.grading === true);
  ok('  ...and stays about one screen', r.height < 900, String(r.height));

  console.log(fail ? `\n${fail} FAILURE(S)` : '\nALL PASS');
  app.exit(fail ? 1 : 0);
});
