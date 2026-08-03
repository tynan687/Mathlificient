// Phase 8: the tutor's verdict, in a real practice page.
//
// window.__checkAnswer is what makes "you may say whether they were right, but
// never what the answer is" true. The model asks, the PAGE marks it against the
// answer it is already holding, and only a verdict comes back — so the two
// things worth guarding are that the verdict is correct and that nothing in the
// reply leaks the answer.
//
// Until now this existed only in device-phase8.js, which needs a tablet. Every
// assertion here is about renderer wiring, so none of it needed one.
const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

const { PC: ROOT } = require('./paths.js');
const PROF = path.join(os.tmpdir(), 'phase8-proficiency.json');
try { fs.unlinkSync(PROF); } catch { /* first run */ }

const readProf = () => {
  try { return JSON.parse(fs.readFileSync(PROF, 'utf8')); } catch { return { version: 1, attempts: [] }; }
};
const writeProf = (log) => fs.writeFileSync(PROF, JSON.stringify(log, null, 2));

let fail = 0;
const ok = (label, cond, extra) => {
  if (!cond) fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${label}${extra != null ? ` :: ${extra}` : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// A rejected executeJavaScript otherwise leaves Electron running with nothing
// printed, which reads exactly like a hang. Say what broke and stop.
process.on('unhandledRejection', (err) => {
  console.log('FAIL — harness crashed ::', err && err.message);
  app.exit(1);
});
setTimeout(() => { console.log('FAIL — harness timed out'); app.exit(1); }, 120000).unref();

app.whenReady().then(async () => {
  // Every harness shares the default profile on disk, so a mode left in
  // localStorage by an earlier one would decide whether the option grid is up.
  await session.defaultSession.clearStorageData({ storages: ['localstorage'] });
  ipcMain.handle('settings:get', () => ({ practicePaperColor: '#FFFFFF', currentTopic: 'quadratics' }));
  ipcMain.handle('settings:set', () => true);
  ipcMain.handle('prof:all', () => readProf());
  ipcMain.handle('prof:append', (_e, a) => {
    if (!a || !a.skill) return false;
    const log = readProf();
    log.attempts.push(a);
    writeProf(log);
    return true;
  });
  ipcMain.handle('prof:reset', () => { writeProf({ version: 1, attempts: [] }); return true; });

  const win = new BrowserWindow({
    show: false, width: 760, height: 960,
    webPreferences: { preload: path.join(ROOT, 'preload.js'), backgroundThrottling: false },
  });
  win.webContents.on('console-message', (_e, level, msg) => {
    if (level >= 2) console.log('   [page error]', msg);
  });
  await win.loadFile(path.join(ROOT, 'renderer/tools/practice.html'));
  await sleep(400);

  const js = (src) => win.webContents.executeJavaScript(src, true);

  /**
   * Put a known question on screen in a known answering mode, and clear the log.
   *
   * `self` is asked for explicitly rather than left to whatever localStorage
   * held: whether the option grid is live changes what __checkAnswer is allowed
   * to do, so it is part of the fixture, not the environment.
   */
  async function fresh(templateId, mode) {
    writeProf({ version: 1, attempts: [] });
    return JSON.parse(await js(`(async () => {
      const sel = document.getElementById('answerMode');
      sel.value = ${JSON.stringify(mode)};
      sel.dispatchEvent(new Event('change'));
      const t = PRACTICE.find((x) => x.id === ${JSON.stringify(templateId)});
      if (!t) throw new Error('no such template: ' + ${JSON.stringify(templateId)});
      show(buildQuestion(t), t.topic);   // the same pair newQuestion() uses
      await new Promise((r) => setTimeout(r, 120));
      return JSON.stringify({ answer: current.answer, skill: current.skill,
        hasChoices: !!current.choices });
    })()`));
  }
  const check = async (heard) =>
    JSON.parse(await js(`JSON.stringify(window.__checkAnswer(${JSON.stringify(heard)}))`));

  // ---- 1. the marker is wired to the page at all ---------------------------------
  ok('the page exposes __checkAnswer', await js('typeof window.__checkAnswer') === 'function');
  ok('  ...and __working', await js('typeof window.__working') === 'function');

  // ---- 2. a right answer, self-marking -------------------------------------------
  let q = await fresh('linear-eq', 'self');
  let r = await check(q.answer);
  await sleep(120);
  let log = readProf();
  ok('saying the answer reads right', r.verdict === 'right', JSON.stringify(r.why));
  ok('  ...and is recorded', r.recorded === true && log.attempts.length === 1,
    `${log.attempts.length} attempt(s)`);
  ok('  ...as an objective tutor verdict, full marks',
    log.attempts[0] && log.attempts[0].mode === 'tutor' && log.attempts[0].score === 1,
    JSON.stringify(log.attempts[0]));
  ok('  ...carrying no k, because it was never a choice between options',
    log.attempts[0] && log.attempts[0].k === undefined, JSON.stringify(log.attempts[0] || {}));

  // ---- 3. one question, one attempt ------------------------------------------------
  r = await check(q.answer);
  await sleep(120);
  ok('asking twice does not record twice', readProf().attempts.length === 1,
    String(readProf().attempts.length));
  ok('  ...and says so', r.recorded === false && r.alreadyMarked === true, JSON.stringify(r));

  // ---- 4. a wrong answer ------------------------------------------------------------
  q = await fresh('linear-eq', 'self');
  r = await check('x equals nine hundred and ninety nine');
  await sleep(120);
  log = readProf();
  ok('a wrong answer reads wrong', r.verdict === 'wrong', JSON.stringify(r.why));
  ok('  ...and is recorded as a miss', log.attempts[0] && log.attempts[0].score === 0,
    JSON.stringify(log.attempts[0]));
  ok('  ...with no working to look at on a blank page', r.workingToSee === false,
    String(r.workingToSee));

  // ---- 5. something unreadable ------------------------------------------------------
  q = await fresh('linear-eq', 'self');
  r = await check('erm, can I have a hint');
  await sleep(120);
  ok('an unreadable answer reads unsure', r.verdict === 'unsure', JSON.stringify(r.why));
  ok('  ...and records NOTHING — unsure is not a miss',
    r.recorded === false && readProf().attempts.length === 0,
    String(readProf().attempts.length));

  // ---- 6. reading the steps first --------------------------------------------------
  //
  // The same rule mcqPick applies: once the working is on screen, saying the
  // answer back is a copying exercise, so it does not get objective credit.
  q = await fresh('linear-eq', 'self');
  await js(`document.getElementById('nextStep').click()`);
  await sleep(120);
  r = await check(q.answer);
  await sleep(120);
  log = readProf();
  ok('peeking at a step is noticed', r.peeked === true, JSON.stringify(r.peeked));
  ok('  ...and drops it to a self-marked half', log.attempts[0]
    && log.attempts[0].mode === 'self' && log.attempts[0].score === 0.5,
    JSON.stringify(log.attempts[0]));

  // ---- 7. a live option grid owns the marking ----------------------------------------
  //
  // Recording here would leave four clickable options that silently no-op, so
  // the verdict still comes back and the model is told to nudge them to pick.
  q = await fresh('quad-formula', 'mcq');
  ok('the mcq fixture really has an option grid', q.hasChoices === true);
  r = await check(q.answer);
  await sleep(120);
  ok('a live option grid is reported', r.gridLive === true, JSON.stringify(r.gridLive));
  ok('  ...the verdict still comes back', r.verdict === 'right', r.verdict);
  ok('  ...but nothing is recorded behind the grid',
    r.recorded === false && readProf().attempts.length === 0,
    String(readProf().attempts.length));

  // ---- 8. the answer must never come back ---------------------------------------------
  //
  // The reason the tutor may say "that's it" while never reading an answer out is
  // that it is not told one. Check the whole reply, not the fields we happen to
  // know about — a field added later would otherwise leak silently.
  const numbers = (s) => (String(s).match(/-?\d+(?:\.\d+)?/g) || []);
  /** Does this reply mention the answer that was on screen when it was made? */
  const leakIn = (reply, answer) => {
    const flat = JSON.stringify(reply);
    if (answer && flat.includes(answer)) return `${flat} contains "${answer}"`;
    // Not just the string: no number out of the answer may ride along either.
    for (const n of numbers(answer)) {
      if (numbers(flat).includes(n)) return `${flat} contains the value ${n}`;
    }
    return null;
  };

  // Each reply is checked against the answer that was actually on screen for it,
  // across several templates and all three verdicts.
  const pairs = [];
  for (const [id, heard] of [
    ['quad-formula', null], ['quad-formula', 'erm, no idea'],
    ['linear-eq', 'x equals seventeen'], ['sim-elimination', null],
    ['circle-centre-radius', 'no idea at all'],
  ]) {
    const fixture = await fresh(id, 'self');
    pairs.push({ answer: fixture.answer, reply: await check(heard === null ? fixture.answer : heard) });
  }
  const leaked = pairs.map((p) => leakIn(p.reply, p.answer)).find(Boolean) || null;
  ok(`no reply carries the answer, or any number from it (${pairs.length} checked)`,
    leaked === null, leaked);
  // The check above passes trivially if leakIn cannot detect anything, and a
  // silent no-op here would be worse than having no check at all — this is the
  // one guarantee the whole feature rests on.
  ok('  ...and that check can actually fail',
    leakIn({ verdict: 'right', why: pairs[0].answer }, pairs[0].answer) !== null
    && leakIn({ verdict: 'right', hint: `it was ${numbers(pairs[0].answer)[0]}` },
      pairs[0].answer) !== null,
    `probed with ${JSON.stringify(pairs[0].answer)}`);
  ok('  ...and the fields it does carry are the documented ones',
    pairs.map((p) => p.reply).every((x) => Object.keys(x).every((k) => [
      'verdict', 'why', 'recorded', 'peeked', 'gridLive', 'skill', 'alreadyMarked',
      'workingToSee', 'reason',
    ].includes(k))),
    JSON.stringify(Object.keys(pairs[0].reply)));

  // ---- 9. nothing on screen -------------------------------------------------------------
  await js('current = null');
  r = await check('two');
  ok('with no question up, the verdict is none', r.verdict === 'none', JSON.stringify(r));

  console.log(fail ? `\n${fail} FAILURE(S)` : '\nALL PASS');
  app.exit(fail ? 1 : 0);
});
