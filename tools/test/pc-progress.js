// Phase 1 UI: grading records attempts, the quiz drives them, the placement
// check runs 12, and the progress screen renders what got recorded.
//
// The prof:* handlers here are a faithful stand-in for main.js's (same file,
// same append semantics) so the RENDERER wiring is what's under test.
const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

const { PC: ROOT, ASSETS } = require('./paths.js');
const PROF = path.join(os.tmpdir(), 'phase1-proficiency.json');
try { fs.unlinkSync(PROF); } catch { /* first run */ }

const readProf = () => {
  try { return JSON.parse(fs.readFileSync(PROF, 'utf8')); } catch { return { version: 1, attempts: [] }; }
};

let fail = 0;
const ok = (label, cond, extra) => {
  if (!cond) fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${label}${extra != null ? ' :: ' + extra : ''}`);
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function open(file, w, h) {
  const win = new BrowserWindow({
    show: false, width: w, height: h,
    webPreferences: { preload: path.join(ROOT, 'preload.js') },
  });
  win.webContents.on('console-message', (_e, level, msg) => {
    if (level >= 2) console.log('   [page error]', msg);
  });
  await win.loadFile(path.join(ROOT, file));
  await sleep(350);
  return win;
}

app.whenReady().then(async () => {
  // Start from a clean profile: localStorage is shared across harnesses via the
  // default Electron profile, so a mode remembered by an earlier run would
  // change what this one sees.
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
  ipcMain.handle('prof:resetSkill', (_e, skillId) => {
    const log = readProf();
    log.attempts = log.attempts.filter((a) => a && a.skill !== skillId);
    fs.writeFileSync(PROF, JSON.stringify(log, null, 2));
    return true;
  });

  // ---- 1. Free practice: grade a question ---------------------------------------
  const practice = await open('renderer/tools/practice.html', 760, 960);

  let r = await practice.webContents.executeJavaScript(`(async () => {
    const sel = document.getElementById('topic');
    sel.value = 'quadratics';
    sel.dispatchEvent(new Event('change'));
    document.getElementById('newQ').click();
    const before = document.getElementById('grading').classList.contains('hidden');
    document.getElementById('showAnswer').click();
    const after = document.getElementById('grading').classList.contains('hidden');
    document.getElementById('gotIt').click();
    await new Promise(r => setTimeout(r, 150));
    const closed = document.getElementById('grading').classList.contains('hidden');
    return JSON.stringify({
      backend: Store.backend, skill: current.skill, tmpl: current.templateId,
      hiddenBeforeAnswer: before, hiddenAfterAnswer: after, hiddenAfterGrade: closed,
    });
  })()`, true);
  r = JSON.parse(r);
  ok('practice page uses the electron store backend', r.backend === 'electron', r.backend);
  ok('a generated question carries its skill', r.skill === 'quadratics', r.skill);
  ok('  ...and its template id', !!r.tmpl, r.tmpl);
  ok('grading is hidden until the answer is shown', r.hiddenBeforeAnswer === true);
  ok('grading appears with the answer', r.hiddenAfterAnswer === false);
  ok('grading closes once marked', r.hiddenAfterGrade === true);

  let log = readProf();
  ok('the attempt reached the store', log.attempts.length === 1, String(log.attempts.length));
  const a0 = log.attempts[0] || {};
  ok('  ...tagged skill + mode + score', a0.skill === 'quadratics' && a0.mode === 'self' && a0.score === 1,
    JSON.stringify(a0));
  ok('  ...with a timing', typeof a0.ms === 'number' && a0.ms >= 0, String(a0.ms));

  // Double-marking must not double-count.
  await practice.webContents.executeJavaScript(
    `document.getElementById('gotIt').click(); document.getElementById('missedIt').click();`, true);
  await sleep(150);
  ok('a question can only be marked once', readProf().attempts.length === 1,
    String(readProf().attempts.length));

  // A tutor-pushed question has no template; it must still be gradable via topic.
  r = await practice.webContents.executeJavaScript(`(() => {
    showTutorQuestion({ question: 'x^2=4', steps: ['x=\\\\pm2'], answer: 'x=\\\\pm2', topic: 'chain rule' });
    document.getElementById('showAnswer').click();
    return JSON.stringify({ skill: current.skill,
      gradable: !document.getElementById('grading').classList.contains('hidden') });
  })()`, true);
  r = JSON.parse(r);
  ok('a tutor question infers its skill from the topic', r.skill === 'diff-rules', r.skill);
  ok('  ...and is gradable', r.gradable === true);

  // ---- 2. Quiz mode --------------------------------------------------------------
  const beforeQuiz = readProf().attempts.length;
  ok('an ungraded tutor question logs nothing', beforeQuiz === 1, String(beforeQuiz));
  r = await practice.webContents.executeJavaScript(`(async () => {
    document.getElementById('quizCount').value = '5';
    document.getElementById('startQuiz').click();
    const seen = [];
    for (let i = 0; i < 5; i++) {
      seen.push({ q: document.getElementById('src').textContent, skill: current.skill });
      document.getElementById('showAnswer').click();
      document.getElementById(i % 2 ? 'missedIt' : 'gotIt').click();
      await new Promise(r => setTimeout(r, 80));
    }
    return JSON.stringify({
      seen,
      summaryShown: !document.getElementById('quizSummary').classList.contains('hidden'),
      summaryText: document.getElementById('quizSummary').textContent.slice(0, 60),
      progressHidden: document.getElementById('quizProgress').classList.contains('hidden'),
      topicReenabled: !document.getElementById('topic').disabled,
    });
  })()`, true);
  r = JSON.parse(r);
  ok('a 5-question quiz runs to the end', r.seen.length === 5);
  ok('  ...each question labelled "Quiz"', r.seen.every((s) => s.q.startsWith('Quiz —')),
    r.seen[0].q);
  ok('  ...and shows a summary', r.summaryShown && /3\/5/.test(r.summaryText), r.summaryText);
  ok('  ...restoring the controls', r.progressHidden && r.topicReenabled);

  log = readProf();
  ok('the quiz logged all 5 attempts', log.attempts.length === beforeQuiz + 5,
    String(log.attempts.length));
  const quizAttempts = log.attempts.slice(beforeQuiz);
  ok('  ...scored 3 right / 2 wrong',
    quizAttempts.filter((x) => x.score === 1).length === 3 &&
    quizAttempts.filter((x) => x.score === 0).length === 2,
    quizAttempts.map((x) => x.score).join(','));

  // ---- 3. Placement check ---------------------------------------------------------
  await practice.webContents.executeJavaScript(`window.tutor.invoke('prof:reset')`, true);
  await sleep(120);
  r = await practice.webContents.executeJavaScript(`(async () => {
    startPlacement();
    const skills = [];
    for (let i = 0; i < 12; i++) {
      skills.push(current.skill);
      document.getElementById('showAnswer').click();
      document.getElementById(i % 3 === 0 ? 'missedIt' : 'gotIt').click();
      await new Promise(r => setTimeout(r, 70));
    }
    return JSON.stringify({ skills,
      summary: document.getElementById('quizSummary').textContent.slice(0, 80) });
  })()`, true);
  r = JSON.parse(r);
  ok('the placement check asks 12 questions', r.skills.length === 12);
  ok('  ...one per skill, no repeats', new Set(r.skills).size === 12, r.skills.join(', '));
  ok('  ...and says so at the end', /Placement check done/.test(r.summary), r.summary);

  log = readProf();
  // Phase 2 split these: `mode` is how it was graded, `flow` is where it
  // happened. Placement is always self-marked, so it is mode:self flow:placement.
  ok('placement attempts are logged as such',
    log.attempts.length === 12 &&
    log.attempts.every((x) => x.flow === 'placement' && x.mode === 'self'),
    `${log.attempts.length} · ${[...new Set(log.attempts.map((x) => `${x.mode}/${x.flow}`))].join(',')}`);

  // Grading mode must fall back after a placement run.
  await practice.webContents.executeJavaScript(`(async () => {
    document.getElementById('newQ').click();
    document.getElementById('showAnswer').click();
    document.getElementById('gotIt').click();
    await new Promise(r => setTimeout(r, 120));
  })()`, true);
  await sleep(150);
  log = readProf();
  ok('after placement, normal practice logs as self-marked',
    log.attempts[12] && log.attempts[12].mode === 'self',
    log.attempts[12] && log.attempts[12].mode);

  // ---- 4. Progress screen ----------------------------------------------------------
  const progress = await open('renderer/tools/progress.html', 620, 820);
  r = await progress.webContents.executeJavaScript(`(async () => {
    await new Promise(r => setTimeout(r, 250));
    const focus = [...document.querySelectorAll('#focus .pick')].map(p => ({
      name: p.querySelector('.pick-name').textContent,
      why: p.querySelector('.pick-why').textContent,
      path: (p.querySelector('.pick-path') || {}).textContent || null,
    }));
    const areas = [...document.querySelectorAll('#areas details.area')].map(d => ({
      name: d.querySelector('.bar-name').textContent,
      pct: d.querySelector('.bar-pct').textContent,
      skills: d.querySelectorAll('.skill').length,
      fills: [...d.querySelectorAll('.skill .fill')].map(f => f.style.width),
    }));
    return JSON.stringify({
      summary: document.getElementById('summary').textContent,
      placementShown: !document.getElementById('placement').classList.contains('hidden'),
      emptyShown: !document.getElementById('empty').classList.contains('hidden'),
      reviewShown: !document.getElementById('reviewWrap').classList.contains('hidden'),
      focus, areas,
    }, null, 1);
  })()`, true);
  r = JSON.parse(r);
  console.log('\n--- progress screen ---');
  console.log('summary:', r.summary);
  for (const f of r.focus) console.log(`  FOCUS ${f.name} — ${f.why}${f.path ? '\n        ' + f.path : ''}`);
  for (const a of r.areas) console.log(`  AREA  ${a.name} ${a.pct} (${a.skills} skills)`);
  console.log('-----------------------\n');

  ok('the summary counts the attempts', /13 questions marked/.test(r.summary), r.summary);
  ok('the placement prompt is gone once there is history', r.placementShown === false);
  ok('the empty hint is gone too', r.emptyShown === false);
  ok('focus-next names 3 skills', r.focus.length === 3, String(r.focus.length));
  ok('  ...each with a reason', r.focus.every((f) => f.why && f.why.length > 12),
    r.focus.map((f) => f.why).join(' | '));
  ok('area bars render', r.areas.length >= 5, String(r.areas.length));
  ok('  ...with a real percentage', r.areas.some((a) => /%$/.test(a.pct)),
    r.areas.map((a) => a.pct).join(','));
  ok('  ...and skill bars inside', r.areas.every((a) => a.skills > 0),
    r.areas.map((a) => `${a.name}:${a.skills}`).join(', '));
  ok('  ...drawn at non-zero width where practised',
    r.areas.some((a) => a.fills.some((w) => w && w !== '0%')),
    r.areas.flatMap((a) => a.fills).filter(Boolean).slice(0, 6).join(','));

  // Practise buttons must reach the main process.
  const routed = [];
  ipcMain.on('practice:skill', (_e, id) => routed.push(id));
  await progress.webContents.executeJavaScript(
    `document.querySelector('#focus .pick .go').click()`, true);
  await sleep(150);
  ok('"Practise" routes the skill to the main process', routed.length === 1, routed.join(','));

  // Reset is two-step (no window.confirm in an Android WebView).
  r = await progress.webContents.executeJavaScript(`(async () => {
    const b = document.getElementById('reset');
    b.click();
    const armedText = b.textContent;
    await new Promise(r => setTimeout(r, 60));
    const stillThere = (await window.tutor.invoke('prof:all')).attempts.length;
    b.click();
    await new Promise(r => setTimeout(r, 200));
    return JSON.stringify({ armedText, stillThere,
      after: (await window.tutor.invoke('prof:all')).attempts.length,
      summary: document.getElementById('summary').textContent,
      placementBack: !document.getElementById('placement').classList.contains('hidden') });
  })()`, true);
  r = JSON.parse(r);
  ok('one tap on Reset only arms it', r.armedText !== 'Reset all progress' && r.stillThere === 13,
    `${r.armedText} · ${r.stillThere} kept`);
  ok('a second tap clears the log', r.after === 0, String(r.after));
  ok('  ...and the screen goes back to empty', /Nothing marked yet/.test(r.summary), r.summary);
  ok('  ...offering the placement check again', r.placementBack === true);

  // ---- 5. Cold-start progress screen -------------------------------------------------
  r = await progress.webContents.executeJavaScript(`(() => {
    const focus = [...document.querySelectorAll('#focus .pick')].map(p =>
      p.querySelector('.pick-name').textContent + ' — ' + p.querySelector('.pick-why').textContent);
    return JSON.stringify({ focus,
      areas: document.querySelectorAll('#areas details.area').length });
  })()`, true);
  r = JSON.parse(r);
  ok('a cold screen still recommends something', r.focus.length === 3, r.focus.join(' | '));
  console.log('  cold focus:', r.focus.join('\n              '));
  ok('  ...and still lists the areas', r.areas >= 5, String(r.areas));

  // ---- 6. Phase 8: slips, Forget, export ----------------------------------------------
  //
  // All three shipped covered only by device-phase8.js, so none of it was
  // checked without a tablet. Seeded directly rather than driven through the UI:
  // what is under test is the progress screen's reading of a log, and picking
  // the same misconception twice by clicking options would take a lucky draw.
  const seeded = [];
  const now = Date.now();
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
    await render();
    await new Promise(r => setTimeout(r, 200));
    const cards = [...document.querySelectorAll('#slips .pick')].map(c => ({
      name: c.querySelector('.pick-name').textContent,
      count: (c.querySelector('.slip-count') || {}).textContent || '',
      hint: (c.querySelector('.pick-why') || {}).textContent || '',
    }));
    return JSON.stringify({
      shown: !document.getElementById('slipsWrap').classList.contains('hidden'),
      cards,
      hintHtml: (document.querySelector('#slips .pick-why') || {}).innerHTML || '',
      forgets: document.querySelectorAll('#areas .forget').length,
    });
  })()`, true));
  ok('three of the same slip raises the slips panel', r.shown === true);
  ok('  ...naming the misconception, not its key',
    r.cards.length >= 1 && /^You keep /.test(r.cards[0].name) && !/disc-sign/.test(r.cards[0].name),
    r.cards[0] && r.cards[0].name);
  ok('  ...with the number of times', /^3×$/.test(r.cards[0].count), r.cards[0].count);
  ok('  ...and a hint in plain text, never LaTeX',
    r.cards[0].hint.length > 0 && !/\\\\|katex|<span/i.test(r.hintHtml),
    JSON.stringify(r.cards[0].hint.slice(0, 60)));
  ok('  ...and Forget is offered only where there is history', r.forgets === 2,
    `${r.forgets} forget buttons for 2 skills with attempts`);

  // Forget one skill, keep the other. The arming step is the point: a single
  // stray tap must not be able to delete a topic's history.
  r = JSON.parse(await progress.webContents.executeJavaScript(`(async () => {
    const btn = [...document.querySelectorAll('#areas .forget')].find(b =>
      b.closest('.skill').textContent.includes('Quadratic'));
    if (!btn) return JSON.stringify({ error: 'no Forget on quadratics' });
    btn.click();
    await new Promise(r => setTimeout(r, 60));
    const armed = { text: btn.textContent, cls: btn.className };
    const mid = await Store.profAll();
    btn.click();
    await new Promise(r => setTimeout(r, 250));
    const after = await Store.profAll();
    return JSON.stringify({ armed, midCount: mid.attempts.length,
      afterQuad: after.attempts.filter(a => a.skill === 'quadratics').length,
      afterOther: after.attempts.filter(a => a.skill === 'linear-equations').length });
  })()`, true));
  ok('one tap on Forget only arms it', r.midCount === 5 && /again/i.test(r.armed.text),
    `${r.armed.text} · ${r.midCount} kept`);
  ok('  ...and it is visibly armed', /armed/.test(r.armed.cls || ''), r.armed.cls);
  ok('a second tap forgets that skill', r.afterQuad === 0, String(r.afterQuad));
  ok('  ...and leaves every other skill alone', r.afterOther === 2, String(r.afterOther));

  // Export. The JSON is the only backup a student can keep — the log is
  // rewritten whole on every attempt — so it has to be the log, exactly.
  fs.writeFileSync(PROF, JSON.stringify({ version: 1, attempts: seeded }, null, 2));
  let exported = null;
  ipcMain.handle('prof:export', (_e, payload) => { exported = payload; return true; });

  await progress.webContents.executeJavaScript(`(async () => {
    await render();
    document.getElementById('export-json').click();
    await new Promise(r => setTimeout(r, 250));
  })()`, true);
  ok('Export backup writes a .json', !!exported && /\.json$/.test(exported.file),
    exported && exported.file);
  ok('  ...that parses back to the same log',
    JSON.stringify(JSON.parse(exported.body).attempts) === JSON.stringify(seeded),
    `${JSON.parse(exported.body).attempts.length} attempts`);

  exported = null;
  await progress.webContents.executeJavaScript(`(async () => {
    document.getElementById('export-csv').click();
    await new Promise(r => setTimeout(r, 250));
  })()`, true);
  const csv = exported ? exported.body.split('\n') : [];
  ok('Export spreadsheet writes a .csv', !!exported && /\.csv$/.test(exported.file),
    exported && exported.file);
  ok('  ...a header plus one row per attempt', csv.length === seeded.length + 1,
    `${csv.length} lines for ${seeded.length} attempts`);
  ok('  ...with skill ids resolved to names', /Quadratic/.test(csv[1] || ''), csv[1]);
  ok('  ...and the slip recorded against it', /disc-sign/.test(csv[1] || ''), csv[1]);

  console.log(fail ? `\n${fail} FAILURE(S)` : '\nALL PASS');
  app.exit(fail ? 1 : 0);
});
