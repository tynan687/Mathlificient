// The two flows the first on-device pass didn't cover: the placement check
// end-to-end, and the floating PracticeActivity popup that shares practice.html.
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

function profFile() {
  try { return JSON.parse(adb('shell', 'run-as', PKG, 'cat', 'files/proficiency.json')); }
  catch { return null; }
}
function forwardDevtools() {
  const unix = adb('shell', 'cat', '/proc/net/unix');
  const names = [...unix.matchAll(/@(webview_devtools_remote_\d+)/g)].map((m) => m[1]);
  if (!names.length) return false;
  adb('forward', '--remove-all');
  adb('forward', 'tcp:9223', `localabstract:${names[names.length - 1]}`);
  return true;
}
async function reattach(match) {
  for (let i = 0; i < 30; i++) {
    try { if (forwardDevtools()) return await attach(match); } catch { /* still loading */ }
    await sleep(500);
  }
  throw new Error(`could not attach to ${match}`);
}

(async () => {
  // ---- 1. The placement check, driven from the progress screen ----------------
  adb('shell', 'pm', 'clear', PKG);
  await sleep(1200);
  adb('shell', 'am', 'start', '-n', `${PKG}/.ProgressActivity`);
  await sleep(2500);
  let page = await reattach('progress.html');

  // Tap the real button: it calls Android.openPlacement() over the bridge.
  await page.eval(`document.getElementById('startPlacement').click()`);
  page.close();
  await sleep(3000);

  const top = adb('shell', 'dumpsys', 'activity', 'activities');
  ok('"Take the check" opens the practice studio through the bridge',
    /topResumedActivity.*PracticeSpaceActivity/.test(top),
    (top.match(/topResumedActivity=ActivityRecord\{[^ ]+ [^ ]+ ([^ ]+)/) || [])[1]);

  page = await reattach('practice.html');
  let r = JSON.parse(await page.eval(`(async () => {
    await new Promise(r => setTimeout(r, 600));
    return JSON.stringify({
      progress: document.getElementById('quizProgress').textContent,
      label: document.getElementById('src').textContent,
      hasGrid: document.querySelectorAll('.mcq-option').length,
    });
  })()`));
  ok('the placement check starts automatically', /Question 1 of 12/.test(r.progress), r.progress);
  ok('  ...labelled as a placement, not a quiz', /^Placement/.test(r.label), r.label);
  ok('  ...and is self-marked even though options exist for the skill',
    r.hasGrid === 0, `${r.hasGrid} option cells`);

  r = JSON.parse(await page.eval(`(async () => {
    const skills = [];
    for (let i = 0; i < 12; i++) {
      skills.push(current.skill);
      document.getElementById('showAnswer').click();
      document.getElementById(i % 3 === 0 ? 'missedIt' : 'gotIt').click();
      await new Promise(r => setTimeout(r, 200));
    }
    return JSON.stringify({ skills,
      summary: document.getElementById('quizSummary').textContent.slice(0, 60) });
  })()`));
  ok('all 12 placement questions run', r.skills.length === 12);
  ok('  ...one per skill, no repeats', new Set(r.skills).size === 12, r.skills.join(', '));
  ok('  ...ending with the placement summary', /Placement check done/.test(r.summary), r.summary);
  page.close();

  await sleep(800);
  const log = profFile();
  ok('12 placement attempts written to the device', log && log.attempts.length === 12,
    log ? String(log.attempts.length) : 'no file');
  ok('  ...all self-marked, flagged as placement',
    log.attempts.every((a) => a.mode === 'self' && a.flow === 'placement'),
    [...new Set(log.attempts.map((a) => `${a.mode}/${a.flow}`))].join(','));
  ok('  ...and none carries an option count',
    log.attempts.every((a) => !('k' in a)));

  // The whole point of a placement: the progress screen now has something to say.
  // Force-stop first — the ProgressActivity that launched the placement is still
  // in the back stack with a stale DOM, and this also makes it a cold-start test.
  adb('shell', 'am', 'force-stop', PKG);
  await sleep(1500);
  adb('shell', 'am', 'start', '-n', `${PKG}/.ProgressActivity`);
  await sleep(3000);
  page = await reattach('progress.html');
  r = JSON.parse(await page.eval(`(async () => {
    await new Promise(r => setTimeout(r, 500));
    return JSON.stringify({
      summary: document.getElementById('summary').textContent,
      placementGone: document.getElementById('placement').classList.contains('hidden'),
      focus: [...document.querySelectorAll('#focus .pick')].map(p =>
        p.querySelector('.pick-name').textContent + ' — ' + p.querySelector('.pick-why').textContent),
      areasWithScore: [...document.querySelectorAll('#areas details.area')]
        .map(d => d.querySelector('.bar-name').textContent + ' ' + d.querySelector('.bar-pct').textContent)
        .filter(s => !s.endsWith('—')),
    });
  })()`));
  ok('the placement seeded the progress screen', /12 questions marked/.test(r.summary), r.summary);
  ok('  ...the prompt is gone', r.placementGone === true);
  ok('  ...and it now recommends from real evidence', r.focus.length === 3);
  console.log('  seeded bars: ' + r.areasWithScore.join(' · '));
  console.log('  focus next:\n    ' + r.focus.join('\n    '));
  page.close();

  // ---- 2. The floating popup that shares the same page ------------------------
  adb('shell', 'am', 'start', '-n', `${PKG}/.PracticeActivity`);
  await sleep(2500);
  page = await reattach('practice.html');
  r = JSON.parse(await page.eval(`(async () => {
    await new Promise(r => setTimeout(r, 400));
    const shown = (id) => {
      const el = document.getElementById(id);
      return el ? getComputedStyle(el).display !== 'none' : null;
    };
    document.getElementById('newQ').click();
    document.getElementById('showAnswer').click();
    await new Promise(r => setTimeout(r, 200));
    return JSON.stringify({
      mini: document.body.classList.contains('mini'),
      quizbar: getComputedStyle(document.querySelector('.quizbar')).display !== 'none',
      choices: shown('choices'), modeNote: shown('modeNote'),
      grading: !document.getElementById('grading').classList.contains('hidden'),
      newQ: shown('newQ'), answer: shown('answer'),
      height: document.body.scrollHeight,
      viewport: window.innerHeight,
    });
  })()`));
  ok('PracticeActivity applies the .mini class', r.mini === true);
  ok('  ...hiding the quiz bar, mode picker and option grid',
    !r.quizbar && !r.modeNote && !r.choices,
    JSON.stringify({ quizbar: r.quizbar, note: r.modeNote, choices: r.choices }));
  ok('  ...but keeping self-marking, which is what the popup is for', r.grading === true);
  ok('  ...and the core controls', r.newQ && r.answer);
  ok('  ...in a popup that stays glanceable', r.height < r.viewport * 2.2,
    `${r.height}px content in a ${r.viewport}px window`);
  page.close();

  console.log(fail ? `\n${fail} FAILURE(S)` : '\nALL PASS');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('HARNESS ERROR:', e.message); process.exit(1); });
