// Phase 2 UI: options are built and frozen with the question, a pick records at
// the right weight with the right misconception, revealing the answer first
// forfeits the objective score, and a quiz doesn't stall on a mode switch.
const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

const { PC: ROOT, ASSETS } = require('./paths.js');
const PROF = path.join(os.tmpdir(), 'phase2-proficiency.json');
try { fs.unlinkSync(PROF); } catch { /* first run */ }

const readProf = () => {
  try { return JSON.parse(fs.readFileSync(PROF, 'utf8')); } catch { return { version: 1, attempts: [] }; }
};
const lastAttempt = () => readProf().attempts.slice(-1)[0] || {};

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
  // localStorage survives between runs in the Electron profile, so the
  // remembered answering mode from the last run would fake the default.
  await session.defaultSession.clearStorageData({ storages: ['localstorage'] });

  ipcMain.handle('settings:get', () => ({
    practicePaperColor: '#FFFFFF', currentTopic: 'partial fraction decomposition',
  }));
  ipcMain.handle('settings:set', () => true);
  ipcMain.handle('prof:all', () => readProf());
  ipcMain.handle('prof:append', (_e, a) => {
    if (!a || !a.skill) return false;
    const log = readProf();
    log.attempts.push(a);
    fs.writeFileSync(PROF, JSON.stringify(log, null, 2));
    return true;
  });
  ipcMain.handle('prof:reset', () => {
    fs.writeFileSync(PROF, JSON.stringify({ version: 1, attempts: [] }));
    return true;
  });

  const win = new BrowserWindow({
    show: false, width: 760, height: 960,
    webPreferences: { preload: path.join(ROOT, 'preload.js'), backgroundThrottling: false },
  });
  win.webContents.on('console-message', (_e, level, msg) => {
    if (level >= 2 && !/Content-Security-Policy/.test(msg)) console.log('   [page error]', msg);
  });
  await win.loadFile(path.join(ROOT, 'renderer/tools/practice.html'));
  await sleep(500);
  const js = (src) => win.webContents.executeJavaScript(src, true);

  // ---- 1. Default mode + frozen options ------------------------------------------
  let r = JSON.parse(await js(`(() => {
    localStorage.removeItem('mathlificient.answerMode');
    return JSON.stringify({ mode: answerMode, sel: document.getElementById('answerMode').value,
      inkOpen: document.getElementById('inkPanel').open });
  })()`));
  ok('the default answering mode is "work it out"', r.mode === 'self' && r.sel === 'self', r.mode);
  ok('  ...and the working space starts open', r.inkOpen === true);

  r = JSON.parse(await js(`(() => {
    const t = PRACTICE.find(p => p.id === 'quad-formula');
    const q = buildQuestion(t);
    const first = JSON.stringify(q.choices.options.map(o => o.latex));
    return JSON.stringify({
      hasChoices: !!q.choices, count: q.choices.options.length, k: q.choices.k,
      answerAt: q.choices.answerIndex,
      answerMatches: q.choices.options[q.choices.answerIndex].latex === q.answer,
      correctWhyNull: q.choices.options[q.choices.answerIndex].why === null,
      wNotStored: !('w' in q),
      stable: JSON.stringify(q.choices.options.map(o => o.latex)) === first,
    });
  })()`));
  ok('a template with distractors gets four options', r.hasChoices && r.count === 4, String(r.count));
  ok('  ...tagged with the option count for the guessing correction', r.k === 4, String(r.k));
  ok('  ...answerIndex points at the real answer', r.answerMatches && r.correctWhyNull);
  ok('  ...and the workings bag never reaches the question record', r.wNotStored === true);

  r = JSON.parse(await js(`(() => {
    const q = buildQuestion(PRACTICE.find(p => p.id === 'matrix-det-inv'));
    const tutor = { question: 'x', steps: ['x'], answer: 'x' };
    showTutorQuestion(tutor);
    return JSON.stringify({ excluded: q.choices === null, tutorHasNone: current.choices == null });
  })()`));
  ok('a template with no distractors yields no options', r.excluded === true);
  ok('a tutor-pushed question yields no options either', r.tutorHasNone === true);

  // ---- 2. Answering by picking ------------------------------------------------------
  r = JSON.parse(await js(`(async () => {
    answerMode = 'mcq';
    const t = PRACTICE.find(p => p.id === 'quad-factorise');
    show(buildQuestion(t), 'test');
    const cells = [...document.querySelectorAll('.mcq-option')];
    const state = {
      gridShown: !document.getElementById('choices').classList.contains('hidden'),
      cells: cells.length,
      nextDisabled: document.getElementById('nextStep').disabled,
      answerDisabled: document.getElementById('showAnswer').disabled,
      gradingHidden: document.getElementById('grading').classList.contains('hidden'),
    };
    cells[current.choices.answerIndex].click();
    await new Promise(r => setTimeout(r, 200));
    return JSON.stringify({ ...state,
      correctMarked: cells[current.choices.answerIndex].classList.contains('correct'),
      allLocked: cells.every(c => c.classList.contains('locked')),
      feedback: document.getElementById('mcqFeedback').textContent,
      feedbackClass: document.getElementById('mcqFeedback').className,
      nextShown: !document.getElementById('mcqNext').classList.contains('hidden'),
      revealReopened: !document.getElementById('showAnswer').disabled,
    });
  })()`));
  ok('multiple choice shows a four-option grid', r.gridShown && r.cells === 4, String(r.cells));
  ok('  ...with the reveal buttons locked until a pick', r.nextDisabled && r.answerDisabled);
  ok('  ...and no self-mark row alongside it', r.gradingHidden === true);
  ok('a right pick is marked correct and locks the grid', r.correctMarked && r.allLocked);
  ok('  ...says so', /Correct/.test(r.feedback) && /good/.test(r.feedbackClass), r.feedback);
  ok('  ...offers Next', r.nextShown === true);
  ok('  ...and reopens the worked steps', r.revealReopened === true);

  let a = lastAttempt();
  ok('a right pick records score 1 at mcq weight',
    a.score === 1 && a.mode === 'mcq' && a.k === 4, JSON.stringify(a));
  ok('  ...tagged with the flow', a.flow === 'practice', a.flow);
  ok('  ...and no misconception on a correct answer', !('miss' in a), JSON.stringify(a));

  // A wrong pick must name the actual slip.
  r = JSON.parse(await js(`(async () => {
    show(buildQuestion(PRACTICE.find(p => p.id === 'quad-formula')), 'test');
    const cells = [...document.querySelectorAll('.mcq-option')];
    const wrong = current.choices.options.findIndex(o => o.why !== null);
    const why = current.choices.options[wrong].why;
    cells[wrong].click();
    await new Promise(r => setTimeout(r, 200));
    return JSON.stringify({ why,
      hint: MISCONCEPTIONS[why].hint,
      feedback: document.getElementById('mcqFeedback').textContent,
      wrongMarked: cells[wrong].classList.contains('wrong'),
      correctShown: cells[current.choices.answerIndex].classList.contains('correct'),
    });
  })()`));
  ok('a wrong pick is marked wrong', r.wrongMarked === true);
  ok('  ...and the right one is highlighted', r.correctShown === true);
  ok('  ...with the specific misconception explained', r.feedback === r.hint, r.feedback);

  a = lastAttempt();
  ok('a wrong pick records 0 and the misconception key',
    a.score === 0 && a.miss === r.why && a.mode === 'mcq', JSON.stringify(a));

  // Double-clicking must not double-record.
  const before = readProf().attempts.length;
  await js(`document.querySelectorAll('.mcq-option')[0].click();
            document.querySelectorAll('.mcq-option')[1].click();`);
  await sleep(150);
  ok('a locked grid ignores further clicks', readProf().attempts.length === before,
    String(readProf().attempts.length));

  // ---- 3. Reading the steps first forfeits the objective score -----------------------
  r = JSON.parse(await js(`(async () => {
    show(buildQuestion(PRACTICE.find(p => p.id === 'quad-factorise')), 'test');
    // Simulate a student who reveals first: enableReveal() then step through.
    enableReveal();
    document.getElementById('nextStep').click();
    document.getElementById('showAnswer').click();
    const cells = [...document.querySelectorAll('.mcq-option')];
    cells[current.choices.answerIndex].click();
    await new Promise(r => setTimeout(r, 200));
    return JSON.stringify({ revealed });
  })()`));
  a = lastAttempt();
  ok('revealing the steps before picking forfeits the mcq weight',
    a.mode === 'self' && a.score === 0.5 && !('k' in a), JSON.stringify(a));

  // ---- 4. Quiz mode with options ----------------------------------------------------
  await js(`window.tutor.invoke('prof:reset')`);
  await sleep(150);
  r = JSON.parse(await js(`(async () => {
    answerMode = 'mcq';
    document.getElementById('quizCount').value = '5';
    document.getElementById('startQuiz').click();
    const seen = [];
    for (let i = 0; i < 5; i++) {
      const cells = [...document.querySelectorAll('.mcq-option')];
      seen.push({ n: cells.length, skill: current.skill });
      if (cells.length) {
        cells[i % 2 === 0 ? current.choices.answerIndex
                          : (current.choices.answerIndex + 1) % 4].click();
        await new Promise(r => setTimeout(r, 120));
        // The quiz must NOT advance until Next is pressed.
        if (i === 0) {
          seen[0].heldStill = document.getElementById('quizProgress').textContent;
        }
        document.getElementById('mcqNext').click();
      } else {
        document.getElementById('showAnswer').click();
        document.getElementById('gotIt').click();
      }
      await new Promise(r => setTimeout(r, 120));
    }
    return JSON.stringify({ seen,
      progressText: seen[0].heldStill,
      summaryShown: !document.getElementById('quizSummary').classList.contains('hidden'),
      summary: document.getElementById('quizSummary').textContent.slice(0, 40),
      gridCleared: document.getElementById('choices').classList.contains('hidden'),
      nextHidden: document.getElementById('mcqNext').classList.contains('hidden'),
      feedbackCleared: document.getElementById('mcqFeedback').textContent === '',
      topicReenabled: !document.getElementById('topic').disabled,
    });
  })()`));
  ok('a quiz runs all 5 questions with options', r.seen.length === 5);
  ok('  ...and a pick does not advance on its own', /Question 1 of 5/.test(r.progressText),
    r.progressText);
  ok('  ...reaching the summary', r.summaryShown && /3\/5/.test(r.summary), r.summary);
  ok('  ...tearing the option grid down afterwards',
    r.gridCleared && r.nextHidden && r.feedbackCleared && r.topicReenabled,
    JSON.stringify({ g: r.gridCleared, n: r.nextHidden, f: r.feedbackCleared }));

  const quizLog = readProf().attempts;
  ok('the quiz logged 5 attempts', quizLog.length === 5, String(quizLog.length));
  ok('  ...as mcq, in the quiz flow — not as self-marked',
    quizLog.every((x) => x.mode === 'mcq' && x.flow === 'quiz'),
    [...new Set(quizLog.map((x) => `${x.mode}/${x.flow}`))].join(','));
  ok('  ...with 3 right and 2 wrong', quizLog.filter((x) => x.score === 1).length === 3,
    quizLog.map((x) => x.score).join(','));
  ok('  ...and a misconception on each wrong one',
    quizLog.filter((x) => x.score === 0).every((x) => !!x.miss),
    quizLog.map((x) => x.miss || '-').join(','));

  // ---- 5. Placement stays self-marked -------------------------------------------------
  await js(`window.tutor.invoke('prof:reset')`);
  await sleep(150);
  await js(`(async () => {
    answerMode = 'mcq';
    startPlacement();
    for (let i = 0; i < 12; i++) {
      document.getElementById('showAnswer').click();
      document.getElementById('gotIt').click();
      await new Promise(r => setTimeout(r, 70));
    }
  })()`);
  await sleep(200);
  const plog = readProf().attempts;
  ok('placement is self-marked even in multiple-choice mode',
    plog.length === 12 && plog.every((x) => x.mode === 'self' && x.flow === 'placement'),
    `${plog.length} · ${[...new Set(plog.map((x) => `${x.mode}/${x.flow}`))].join(',')}`);
  ok('  ...and carries no option count', plog.every((x) => !('k' in x)));

  // ---- 6. Mode switch mid-question doesn't strand a quiz --------------------------------
  r = JSON.parse(await js(`(async () => {
    answerMode = 'self';
    document.getElementById('quizCount').value = '5';
    document.getElementById('startQuiz').click();
    const at = document.getElementById('quizProgress').textContent;
    // Flip the selector mid-question, the way a student would.
    const sel = document.getElementById('answerMode');
    sel.value = 'mcq';
    sel.dispatchEvent(new Event('change'));
    const note = document.getElementById('modeNote').textContent;
    // The current question must still be answerable by the path it started on.
    document.getElementById('showAnswer').click();
    const gradable = !document.getElementById('grading').classList.contains('hidden');
    document.getElementById('gotIt').click();
    await new Promise(r => setTimeout(r, 200));
    return JSON.stringify({ at, note, gradable,
      moved: document.getElementById('quizProgress').textContent,
      inkClosed: document.getElementById('inkPanel').open === false });
  })()`));
  ok('switching mode says it applies next question', /next question/i.test(r.note), r.note);
  ok('  ...leaves the current question answerable', r.gradable === true);
  ok('  ...so the quiz still advances', /Question 2 of 5/.test(r.moved), r.moved);
  ok('  ...and collapses the working space for multiple choice', r.inkClosed === true);

  // ---- 7. Mode persists ------------------------------------------------------------------
  await js(`localStorage.setItem('mathlificient.answerMode', 'mcq')`);
  const win2 = new BrowserWindow({
    show: false, width: 760, height: 960,
    // Without this, ResizeObserver callbacks are throttled for a hidden window
    // and the collapse test measures a stale size.
    webPreferences: { preload: path.join(ROOT, 'preload.js'), backgroundThrottling: false },
  });
  await win2.loadFile(path.join(ROOT, 'renderer/tools/practice.html'));
  await sleep(400);
  r = JSON.parse(await win2.webContents.executeJavaScript(
    `JSON.stringify({ mode: answerMode, sel: document.getElementById('answerMode').value })`, true));
  ok('the chosen mode is remembered across a reload', r.mode === 'mcq' && r.sel === 'mcq', r.mode);

  // ---- 8. Ink panel survives collapse ------------------------------------------------------
  r = JSON.parse(await win2.webContents.executeJavaScript(`(async () => {
    const panel = document.getElementById('inkPanel');
    panel.open = true;
    await new Promise(r => setTimeout(r, 200));
    const openH = document.body.scrollHeight;
    const c = document.getElementById('inkCanvas');
    const rect = c.getBoundingClientRect();
    const send = (type, x, y) => c.dispatchEvent(new PointerEvent(type, {
      pointerId: 1, pointerType: 'mouse', buttons: type === 'pointerup' ? 0 : 1,
      clientX: rect.left + x, clientY: rect.top + y, bubbles: true }));
    send('pointerdown', 40, 40); send('pointermove', 120, 90); send('pointerup', 120, 90);
    const drawn = window.__ink.strokes.length;
    panel.open = false;
    await new Promise(r => setTimeout(r, 200));
    const closedH = document.body.scrollHeight;
    const closedStrokes = window.__ink.strokes.length;
    panel.open = true;
    await new Promise(r => setTimeout(r, 250));
    return JSON.stringify({ drawn, openH, closedH, closedStrokes,
      reopenedStrokes: window.__ink.strokes.length,
      reopenedW: Math.round(window.__ink.cssW) });
  })()`, true));
  ok('a stroke is drawn while the panel is open', r.drawn === 1, String(r.drawn));
  // The whole point of the <details>: buy back enough height for the option grid.
  ok('collapsing the panel frees 400px+ of page height', r.openH - r.closedH > 400,
    `${r.openH} -> ${r.closedH}`);
  ok('  ...without losing the strokes', r.closedStrokes === 1, String(r.closedStrokes));
  ok('reopening keeps them and the canvas is still live',
    r.reopenedStrokes === 1 && r.reopenedW > 0, JSON.stringify(r));
  // The page must still fit the window's minimum height with options showing.
  r = JSON.parse(await win2.webContents.executeJavaScript(`(async () => {
    document.getElementById('inkPanel').open = false;
    answerMode = 'mcq';
    show(buildQuestion(PRACTICE.find(p => p.id === 'quad-formula')), 'test');
    await new Promise(r => setTimeout(r, 200));
    return JSON.stringify({ h: document.body.scrollHeight,
      noHScroll: document.body.scrollWidth <= document.documentElement.clientWidth + 1 });
  })()`, true));
  ok('with options showing and ink collapsed, the page fits the minimum window',
    r.h < 648, `${r.h}px vs 648px usable at min size`);
  ok('  ...and never scrolls sideways', r.noHScroll === true);

  console.log(fail ? `\n${fail} FAILURE(S)` : '\nALL PASS');
  app.exit(fail ? 1 : 0);
});
