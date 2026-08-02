// On-device verification of Phases 1-3, driving the REAL WebView on the tablet
// over CDP. Everything here goes through the actual Kotlin bridge and writes to
// the app's real filesDir — no stand-ins.
const { attach } = require('./cdp.js');
const { execFileSync } = require('child_process');

const ADB = `${process.env.LOCALAPPDATA}\\Android\\Sdk\\platform-tools\\adb.exe`;
const PKG = 'com.tynan.mathtutor';
const adb = (...args) => execFileSync(ADB, args, { encoding: 'utf8' });

let fail = 0;
const ok = (label, cond, extra) => {
  if (!cond) fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${label}${extra != null ? ' :: ' + extra : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Read the app's own proficiency file straight off the device. */
function profFile() {
  try {
    const raw = adb('shell', 'run-as', PKG, 'cat', 'files/proficiency.json');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * The devtools socket is named after the WebView's process id, so it changes
 * every time the app restarts — and `pm clear` plus a force-stop restart it
 * twice. Re-resolve and re-forward before each attach rather than assuming.
 */
function forwardDevtools() {
  const unix = adb('shell', 'cat', '/proc/net/unix');
  const names = [...unix.matchAll(/@(webview_devtools_remote_\d+)/g)].map((m) => m[1]);
  if (!names.length) return false;
  const socket = names[names.length - 1];
  adb('forward', '--remove-all');
  adb('forward', 'tcp:9223', `localabstract:${socket}`);
  return true;
}

async function reattach(match) {
  for (let i = 0; i < 25; i++) {
    try {
      if (forwardDevtools()) return await attach(match);
    } catch { /* the page may not have finished loading yet */ }
    await sleep(500);
  }
  throw new Error(`could not attach to ${match}`);
}

(async () => {
  // ---- 1. Progress screen, cold ----------------------------------------------
  adb('shell', 'pm', 'clear', PKG);
  await sleep(1000);
  adb('shell', 'am', 'start', '-n', `${PKG}/.ProgressActivity`);
  await sleep(2500);

  let page = await reattach('progress.html');
  ok('the progress screen loads on the tablet', page.url.includes('progress.html'), page.url);

  let r = await page.eval(`(async () => {
    await new Promise(r => setTimeout(r, 400));
    return JSON.stringify({
      backend: Store.backend,
      summary: document.getElementById('summary').textContent,
      placementShown: !document.getElementById('placement').classList.contains('hidden'),
      areas: document.querySelectorAll('#areas details.area').length,
      focus: [...document.querySelectorAll('#focus .pick')].map(p =>
        p.querySelector('.pick-name').textContent),
      skills: SKILLS.filter(s => templatesForSkill(s.id).length).length,
      templates: PRACTICE.length,
      storage: (() => { try { localStorage.setItem('t','1'); return true; } catch { return false; } })(),
    });
  })()`);
  r = JSON.parse(r);
  ok('it talks to the real Kotlin bridge', r.backend === 'android', r.backend);
  ok('a fresh install reads as empty', /Nothing marked yet/.test(r.summary), r.summary);
  ok('  ...and offers the placement check', r.placementShown === true);
  // Exact on purpose — a census, so shipping content is a deliberate act. `skills`
  // counts only skills with practice templates: the 15 `sym-*` skills are drilled
  // from the symbols screen instead, so they are correctly absent here.
  ok('all 73 templates shipped in the APK', r.templates === 73, String(r.templates));
  ok('  ...covering 41 skills', r.skills === 41, String(r.skills));
  ok('the new areas render', r.areas >= 8, String(r.areas));
  ok('focus-next names three skills', r.focus.length === 3, r.focus.join(', '));
  ok('domStorageEnabled took effect', r.storage === true);
  ok('nothing is stored before anything is answered', profFile() === null);
  page.close();

  // ---- 2. Answer questions in the Studio, self-marked -------------------------
  adb('shell', 'am', 'start', '-n', `${PKG}/.PracticeSpaceActivity`);
  await sleep(2500);
  page = await reattach('practice.html');
  ok('the practice studio loads', page.url.includes('practice.html'), page.url);

  r = await page.eval(`(async () => {
    await new Promise(r => setTimeout(r, 300));
    const done = [];
    for (let i = 0; i < 6; i++) {
      const sel = document.getElementById('topic');
      sel.value = 'coordinate-geometry';
      sel.dispatchEvent(new Event('change'));
      document.getElementById('newQ').click();
      done.push(current.skill + '/' + current.templateId);
      document.getElementById('showAnswer').click();
      document.getElementById(i < 4 ? 'gotIt' : 'missedIt').click();
      await new Promise(r => setTimeout(r, 250));
    }
    return JSON.stringify({ done, mode: answerMode });
  })()`);
  r = JSON.parse(r);
  ok('six coordinate-geometry questions answered', r.done.length === 6, r.done[0]);
  ok('  ...the default mode really is "work it out"', r.mode === 'self', r.mode);

  await sleep(600);
  let log = profFile();
  ok('the attempts reached the real proficiency.json',
    log && log.attempts.length === 6, log ? String(log.attempts.length) : 'no file');
  ok('  ...recorded as self-marked practice',
    log.attempts.every((a) => a.mode === 'self' && a.flow === 'practice'),
    [...new Set(log.attempts.map((a) => `${a.mode}/${a.flow}`))].join(','));
  ok('  ...against a real coordinate-geometry skill',
    log.attempts.every((a) => a.skill === 'coordinate-geometry'),
    [...new Set(log.attempts.map((a) => a.skill))].join(','));

  // ---- 3. Multiple choice through the real bridge ------------------------------
  r = await page.eval(`(async () => {
    const sel = document.getElementById('answerMode');
    sel.value = 'mcq';
    sel.dispatchEvent(new Event('change'));
    const note = document.getElementById('modeNote').textContent;
    const picks = [];
    for (let i = 0; i < 4; i++) {
      const t = document.getElementById('topic');
      t.value = 'quadratics';
      t.dispatchEvent(new Event('change'));
      document.getElementById('newQ').click();
      await new Promise(r => setTimeout(r, 200));
      const cells = [...document.querySelectorAll('.mcq-option')];
      if (!cells.length) { picks.push({ none: true }); continue; }
      const wrongIdx = current.choices.options.findIndex(o => o.why !== null);
      const idx = i === 0 ? current.choices.answerIndex : wrongIdx;
      const why = current.choices.options[idx].why;
      const box = cells[0].getBoundingClientRect();
      cells[idx].click();
      await new Promise(r => setTimeout(r, 250));
      picks.push({
        n: cells.length, why,
        cellH: Math.round(box.height),
        feedback: document.getElementById('mcqFeedback').textContent,
        marked: cells.some(c => c.classList.contains('correct')),
        locked: cells.every(c => c.classList.contains('locked')),
        revealReopened: !document.getElementById('showAnswer').disabled,
      });
      document.getElementById('mcqNext').click();
      await new Promise(r => setTimeout(r, 150));
    }
    return JSON.stringify({ note, picks });
  })()`);
  r = JSON.parse(r);
  ok('switching mode says it applies next question', /next question/i.test(r.note), r.note);
  const real = r.picks.filter((p) => !p.none);
  ok('the option grid renders on the tablet', real.length === 4 && real.every((p) => p.n === 4),
    real.map((p) => p.n).join(','));
  ok('  ...options are a comfortable tap target', real.every((p) => p.cellH >= 44),
    real.map((p) => p.cellH).join(','));
  ok('  ...a pick locks the grid and marks the right one',
    real.every((p) => p.locked && p.marked));
  ok('  ...and reopens the worked steps', real.every((p) => p.revealReopened));
  ok('a wrong pick explains the actual slip',
    real.slice(1).every((p) => p.feedback.length > 15), real[1] && real[1].feedback);

  await sleep(700);
  log = profFile();
  const mcqAttempts = log.attempts.filter((a) => a.mode === 'mcq');
  ok('multiple-choice attempts land in the real file', mcqAttempts.length === 4,
    String(mcqAttempts.length));
  ok('  ...tagged with the option count for the guessing correction',
    mcqAttempts.every((a) => a.k === 4), [...new Set(mcqAttempts.map((a) => a.k))].join(','));
  ok('  ...and carry the misconception only when wrong',
    mcqAttempts.filter((a) => a.score === 0).every((a) => !!a.miss) &&
    mcqAttempts.filter((a) => a.score === 1).every((a) => !a.miss),
    mcqAttempts.map((a) => `${a.score}:${a.miss || '-'}`).join(' '));

  // ---- 4. applyPaper must not eat the right/wrong colours ------------------------
  r = await page.eval(`(async () => {
    document.getElementById('newQ').click();
    await new Promise(r => setTimeout(r, 200));
    const cells = [...document.querySelectorAll('.mcq-option')];
    if (!cells.length) return JSON.stringify({ skipped: true });
    cells[current.choices.options.findIndex(o => o.why !== null)].click();
    await new Promise(r => setTimeout(r, 200));
    applyPaper('#1C1C1E', '#F0F0F0');
    await new Promise(r => setTimeout(r, 200));
    const wrong = cells.find(c => c.classList.contains('wrong'));
    const right = cells.find(c => c.classList.contains('correct'));
    const s = (el) => { const c = getComputedStyle(el); return c.borderTopColor + ' | ' + c.boxShadow; };
    return JSON.stringify({
      body: getComputedStyle(document.body).backgroundColor,
      wrong: s(wrong), right: s(right),
    });
  })()`);
  r = JSON.parse(r);
  if (!r.skipped) {
    ok('dark paper themes the practice page', r.body === 'rgb(28, 28, 30)', r.body);
    ok('  ...and the right/wrong colours survive it',
      /46, 125, 50/.test(r.right) && /198, 40, 40/.test(r.wrong),
      `right ${r.right} · wrong ${r.wrong}`);
  }

  // ---- 5. The new coordinate-geometry visuals actually draw ------------------------
  r = await page.eval(`(async () => {
    const out = [];
    for (const id of ['coord-distance', 'coord-line', 'circle-centre-radius', 'func-inverse']) {
      const t = PRACTICE.find(p => p.id === id);
      show(buildQuestion(t), id);
      document.getElementById('vizBar').click();
      await new Promise(r => setTimeout(r, 400));
      const c = document.getElementById('viz');
      const ctx = c.getContext('2d');
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      // Compare against the canvas's OWN background (corner pixel), not white.
      // renderVisual fills with the paper colour first, so a "non-white" test
      // counts every pixel once the page has been themed dark and passes
      // whatever happens.
      const bg = [d[0], d[1], d[2]];
      let ink = 0;
      for (let p = 0; p < d.length; p += 4) {
        if (Math.abs(d[p]-bg[0]) + Math.abs(d[p+1]-bg[1]) + Math.abs(d[p+2]-bg[2]) > 40) ink++;
      }
      out.push({ id, type: current.viz && current.viz.type, ink, w: c.width, h: c.height });
      document.getElementById('vizBar').click();
      await new Promise(r => setTimeout(r, 150));
    }
    return JSON.stringify(out);
  })()`);
  r = JSON.parse(r);
  for (const v of r) {
    ok(`the ${v.type} diagram draws on device (${v.id})`, v.ink > 200,
      `${v.ink} px on a ${v.w}x${v.h} canvas`);
  }
  page.close();

  // ---- 6. Force-stop, and check the bars survived ----------------------------------
  const beforeKill = profFile().attempts.length;
  adb('shell', 'am', 'force-stop', PKG);
  await sleep(1500);
  adb('shell', 'am', 'start', '-n', `${PKG}/.ProgressActivity`);
  await sleep(3000);
  page = await reattach('progress.html');
  r = await page.eval(`(async () => {
    await new Promise(r => setTimeout(r, 500));
    const bars = [...document.querySelectorAll('#areas details.area')].map(d => ({
      name: d.querySelector('.bar-name').textContent,
      pct: d.querySelector('.bar-pct').textContent,
    })).filter(b => b.pct !== '—');
    return JSON.stringify({
      summary: document.getElementById('summary').textContent,
      placementGone: document.getElementById('placement').classList.contains('hidden'),
      bars,
      focus: [...document.querySelectorAll('#focus .pick')].map(p =>
        p.querySelector('.pick-name').textContent + ' — ' + p.querySelector('.pick-why').textContent),
      mode: (() => { try { return localStorage.getItem('mathlificient.answerMode'); } catch { return null; } })(),
    });
  })()`);
  r = JSON.parse(r);
  ok('after a force-stop the attempts are still there',
    new RegExp(`${beforeKill} questions marked`).test(r.summary), r.summary);
  ok('  ...and the bars have moved off zero', r.bars.length >= 2,
    r.bars.map((b) => `${b.name} ${b.pct}`).join(' · '));
  ok('  ...the placement prompt is gone', r.placementGone === true);
  ok('  ...the answering mode was remembered too', r.mode === 'mcq', String(r.mode));
  console.log('\n  bars: ' + r.bars.map((b) => `${b.name} ${b.pct}`).join(' · '));
  console.log('  focus next:\n    ' + r.focus.join('\n    '));
  page.close();

  console.log(fail ? `\n${fail} FAILURE(S)` : '\nALL PASS');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('HARNESS ERROR:', e.message); process.exit(1); });
