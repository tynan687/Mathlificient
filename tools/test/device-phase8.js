// On-device verification of Phase 8 and the tutor's marking path.
//
// This is the suite that covers what nothing else can: `Proficiency.resetSkill`
// and `Bridge.shareText` are Kotlin, so the stand-in in android-bridge-preload.js
// proves the JS calls them correctly and nothing more. Everything here goes
// through the real bridge and the app's real filesDir.
//
// It also runs `window.__checkAnswer` in the real WebView. The full tutor round
// trip needs a live session and a key, which no automated run has — but the
// marking itself is local, so it can and should be proven on the hardware it will
// run on.
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
    return JSON.parse(adb('shell', 'run-as', PKG, 'cat', 'files/proficiency.json'));
  } catch {
    return null;
  }
}

/** What the app has written into its share cache. */
function sharedFiles() {
  try {
    return adb('shell', 'run-as', PKG, 'ls', 'cache/shared')
      .split(/\s+/).filter(Boolean);
  } catch {
    return [];
  }
}

// The socket is named after the WebView's pid and changes on every restart, so
// re-resolve and re-forward before each attach rather than caching it.
function forwardDevtools() {
  const unix = adb('shell', 'cat', '/proc/net/unix');
  const names = [...unix.matchAll(/@(webview_devtools_remote_\d+)/g)].map((m) => m[1]);
  if (!names.length) return false;
  adb('forward', '--remove-all');
  adb('forward', 'tcp:9223', `localabstract:${names[names.length - 1]}`);
  return true;
}

async function reattach(match) {
  for (let i = 0; i < 25; i++) {
    try {
      // Take the LAST match: an activity left in the back stack keeps its WebView
      // listed, and attaching to that reads a page showing pre-test state.
      if (forwardDevtools()) return await attach(match);
    } catch { /* the page may not have finished loading */ }
    await sleep(500);
  }
  throw new Error(`could not attach to ${match}`);
}

const open = async (activity, page) => {
  adb('shell', 'am', 'force-stop', PKG);
  await sleep(1200);
  adb('shell', 'am', 'start', '-n', `${PKG}/.${activity}`);
  await sleep(3000);
  return reattach(page);
};

(async () => {
  adb('shell', 'pm', 'clear', PKG);
  await sleep(1000);

  // ---- 1. Marking, in the real WebView --------------------------------------------
  let page = await open('PracticeSpaceActivity', 'practice.html');
  ok('the practice studio loads', page.url.includes('practice.html'), page.url);

  let r = JSON.parse(await page.eval(`(async () => {
    localStorage.setItem('mathlificient.answerMode', 'self');
    answerMode = 'self';
    show(buildQuestion(PRACTICE.find(t => t.id === 'linear-eq')));
    await new Promise(x => setTimeout(x, 80));
    const truth = current.answer;
    const right = window.__checkAnswer(truth);
    return JSON.stringify({ right, truth, hasMarker: typeof markAnswer === 'function' });
  })()`));
  ok('markAnswer shipped in the APK', r.hasMarker === true);
  ok('a right answer is marked right on device', r.right.verdict === 'right',
    JSON.stringify(r.right));
  ok('  ...and the reply carries no trace of the answer',
    !JSON.stringify(r.right).includes(r.truth), `answer was ${r.truth}`);
  ok('  ...recorded as mode tutor with no option count',
    r.right.recorded === true, JSON.stringify(r.right));

  await sleep(400);
  let prof = profFile();
  ok('the tutor verdict reached the real proficiency.json',
    !!prof && prof.attempts.length === 1, prof && String(prof.attempts.length));
  ok('  ...graded tutor, no k',
    !!prof && prof.attempts[0].mode === 'tutor' && prof.attempts[0].k === undefined,
    prof && JSON.stringify(prof.attempts[0]));

  r = JSON.parse(await page.eval(`(async () => {
    show(buildQuestion(PRACTICE.find(t => t.id === 'linear-eq')));
    await new Promise(x => setTimeout(x, 80));
    const wrong = window.__checkAnswer('x = 999999');
    const spoken = markAnswer('x equals twenty three', 'x = 23');
    const junk = window.__checkAnswer('erm can I have a hint');
    return JSON.stringify({ wrong, spoken, junk });
  })()`));
  ok('a wrong answer is marked wrong on device', r.wrong.verdict === 'wrong');
  ok('  ...spoken numbers are understood on device', r.spoken.verdict === 'right',
    JSON.stringify(r.spoken));
  ok('  ...and gibberish is unsure, never wrong', r.junk.verdict === 'unsure');

  // ---- 2. Seed history across three skills, one with a slip -----------------------
  // Counted off what is already there rather than hardcoded: the marking section
  // above has legitimately written attempts of its own.
  const before = (profFile() || { attempts: [] }).attempts.length;
  await page.eval(`(async () => {
    const now = Date.now();
    const add = (skill, tmpl, extra) => Store.profAppend(attemptFrom(
      skill, tmpl, extra.score, extra.mode || 'mcq', 900,
      { k: 4, flow: extra.flow || 'practice', miss: extra.miss }));
    for (let i = 0; i < 3; i++) add('quadratics', 'quad-formula', { score: 0, miss: 'disc-no-a' });
    for (let i = 0; i < 2; i++) add('sym-calculus', 'integral', { score: 0, flow: 'symbols', miss: 'sym:contour-integral' });
    add('trig-ratios', 'trig-solve', { score: 1 });
    await new Promise(x => setTimeout(x, 400));
    return 'seeded';
  })()`);
  await sleep(600);
  prof = profFile();
  const bySkill = (p) => p.attempts.reduce((m, a) => ({ ...m, [a.skill]: (m[a.skill] || 0) + 1 }), {});
  const quadCount = prof ? prof.attempts.filter((a) => a.skill === 'quadratics').length : 0;
  ok('seeded history is on the device', !!prof && prof.attempts.length === before + 6,
    prof && JSON.stringify(bySkill(prof)));

  // ---- 3. The slips panel, on the real screen -------------------------------------
  page = await open('ProgressActivity', 'progress.html');
  r = JSON.parse(await page.eval(`(async () => {
    await new Promise(x => setTimeout(x, 500));
    return JSON.stringify({
      hidden: document.getElementById('slipsWrap').classList.contains('hidden'),
      cards: [...document.querySelectorAll('#slips .pick')].map(c => c.textContent.slice(0, 80)),
      overflow: document.body.scrollWidth > window.innerWidth + 1,
    });
  })()`));
  ok('the slips panel appears on device', r.hidden === false);
  ok('  ...naming the practice slip in English',
    r.cards.some((c) => /leaving a out of the discriminant/.test(c)), r.cards.join(' | '));
  ok('  ...and the symbol confusion as a pair',
    r.cards.some((c) => /reading Integral as Closed integral/.test(c)), r.cards.join(' | '));
  ok('  ...with no raw keys leaking',
    !r.cards.some((c) => /sym:|disc-no-a/.test(c)));
  ok('  ...and no overflow on the tablet', r.overflow === false);

  // ---- 4. Per-skill reset, through the real Kotlin --------------------------------
  r = JSON.parse(await page.eval(`(async () => {
    for (const a of document.querySelectorAll('details.area')) a.open = true;
    await new Promise(x => setTimeout(x, 120));
    const rows = [...document.querySelectorAll('.skill')];
    const row = rows.find(n => /Quadratics/.test(n.textContent));
    const btn = row && row.querySelector('.forget');
    if (!btn) return JSON.stringify({ missing: true });
    const resting = btn.textContent;
    // Measure BEFORE firing: onFire calls render(), which rebuilds #areas, and a
    // detached node reports a zero rect — which reads as a broken tap target.
    const tapTarget = Math.round(btn.getBoundingClientRect().height);
    btn.click();
    const armed = btn.textContent;
    await new Promise(x => setTimeout(x, 80));
    btn.click();
    await new Promise(x => setTimeout(x, 600));
    return JSON.stringify({ resting, armed, tapTarget });
  })()`));
  ok('Forget is offered on a skill with history', !r.missing);
  ok('  ...one tap only arms it', r.armed === 'Tap again to forget', r.armed);
  ok('  ...and it is a real tap target', r.tapTarget >= 44, String(r.tapTarget));
  await sleep(600);
  const after = profFile();
  ok('the second tap reached Proficiency.resetSkill on device',
    !!after && !after.attempts.some((a) => a.skill === 'quadratics'),
    after && JSON.stringify(bySkill(after)));
  ok('  ...and left every other skill alone',
    !!after && after.attempts.length === prof.attempts.length - quadCount,
    after && `${after.attempts.length} of ${prof.attempts.length}, minus ${quadCount} quadratics`);

  // ---- 5. Export, through Bridge.shareText ----------------------------------------
  // The file is written before the chooser is raised, so the file landing is the
  // real assertion; the chooser is then dismissed so it cannot block the run.
  for (const [kind, ext] of [['json', 'json'], ['csv', 'csv']]) {
    await page.eval(`document.getElementById('export-${kind}').click(); true;`);
    await sleep(1500);
    const files = sharedFiles();
    ok(`export ${kind} wrote a .${ext} through the real bridge`,
      files.some((f) => f.endsWith(`.${ext}`)), files.join(', '));
    adb('shell', 'input', 'keyevent', 'KEYCODE_BACK');
    await sleep(800);
  }
  const shared = sharedFiles();
  ok('  ...both files are named for the app and dated',
    shared.filter((f) => /^mathlificient-progress-\d{4}-\d{2}-\d{2}\.(json|csv)$/.test(f)).length === 2,
    shared.join(', '));

  console.log(fail ? `\n${fail} FAILURE(S)` : '\nALL PASS');
  process.exit(fail ? 1 : 0);
})().catch((err) => {
  console.log('HARNESS ERROR —', err.message);
  process.exit(1);
});
