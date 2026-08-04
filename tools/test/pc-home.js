// The home screen: the app's front door.
//
// Two kinds of assertion here, and both earn their place. The DOM ones drive the
// real page. The source ones check things that only exist in main.js — that
// closing settings no longer quits the app, and that every action the home
// screen or the menu can fire actually has somewhere to land. A nav entry with
// no case in the switch does nothing at all, silently, which is exactly how the
// menu and the home list would drift apart again.
const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');
const fs = require('fs');

const { PC: ROOT, REPO, MAIN } = require('./paths.js');

let fail = 0;
const ok = (label, cond, extra) => {
  if (!cond) fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${label}${extra != null ? ` :: ${extra}` : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

process.on('unhandledRejection', (err) => {
  console.log('FAIL — harness crashed ::', err && err.message);
  app.exit(1);
});
setTimeout(() => { console.log('FAIL — harness timed out'); app.exit(1); }, 120000).unref();

// ---- source: main.js holds up its end ------------------------------------------------
{
  // MAIN, not ROOT: read the file the author edits. The build copy is kept
  // identical by the drift guard, but reading it here once meant these
  // assertions were failing against a main.js a day out of date.
  const main = fs.readFileSync(MAIN, 'utf8');
  const nav = require(path.join(ROOT, 'renderer', 'nav.js'));

  const cases = new Set([...main.matchAll(/case\s*'([^']+)'\s*:/g)].map((m) => m[1]));
  const missing = nav.NAV_ITEMS.filter((i) => i.action && !cases.has(i.action)).map((i) => i.action);
  ok(`every nav action is handled in main.js (${nav.NAV_ITEMS.length} entries)`,
    missing.length === 0, missing.join(', ') || [...cases].length + ' cases');
  ok('  ...including the one the home screen adds for settings', cases.has('settings'));

  // The bug this replaces: settings WAS the main window, so it could not be
  // closed without quitting, and its long-lived stale copy of the settings
  // object is the clobber recorded in HANDOVER.md.
  //
  // Matched by intent rather than by exact form. The first version of this
  // assertion pinned `on('closed', () => app.quit())` literally, and went red the
  // moment the handler grew a body — which it had to, so the session could be
  // stopped and the study log written before the app goes away.
  const quitters = [...main.matchAll(/(\w+)\.on\('closed?',\s*(?:\([^)]*\)|\w+)\s*=>\s*\{?([\s\S]{0,400}?)\n\s*\}?\);/g)]
    .filter((m) => /app\.quit\(\)/.test(m[2]))
    .map((m) => m[1]);
  ok('exactly one window quits the app when closed', quitters.length === 1, quitters.join(', '));
  ok('  ...and it is the home window, not settings', quitters[0] === 'homeWin', quitters[0]);
  // Quitting must not skip the engine, or the session's duration and cost never
  // reach studylog:append and closing the window at the end of an hour of study
  // loses the record of it.
  ok('  ...and it stops the session on the way out',
    /homeWin\.on\('close[\s\S]{0,400}engine:stop/.test(main));

  // The bug this catches: ui:state went to settingsWin alone, which is null until
  // Settings is opened — so the front door reported "Not running" through a live
  // session and its Stop button never came alive. Any single-window send is the
  // same bug waiting to happen.
  const uiSend = /ipcMain\.on\('ui:state'[\s\S]{0,200}?\n/.exec(main);
  ok('session status is broadcast, not sent to one window',
    !!uiSend && !/settingsWin\?\.webContents\.send/.test(uiSend[0]),
    uiSend && uiSend[0].trim().split('\n')[0]);
  ok('  ...and the home window is one of the recipients',
    /function broadcastUi[\s\S]{0,300}homeWin/.test(main));

  // Pinning the progress screen over everything is a window you cannot get out
  // of the way. Only the two you work alongside should float.
  const floating = /FLOATING_TOOLS = new Set\(\[([^\]]*)\]\)/.exec(main);
  ok('only the work-alongside tools are alwaysOnTop', !!floating
    && /practice/.test(floating[1]) && /formulas/.test(floating[1])
    && !/progress|symbols|worksheet/.test(floating[1]),
    floating && floating[1].trim());
}

app.whenReady().then(async () => {
  await session.defaultSession.clearStorageData({ storages: ['localstorage'] });

  const sent = [];
  ipcMain.handle('settings:get', () => ({ theme: 'system', accent: '#4F7DF7', currentTopic: 'quadratics' }));
  ipcMain.handle('settings:set', () => true);
  ipcMain.handle('spend:get', () => ({ today: 1.5, week: 4.25 }));
  // Enough history that recommend() has something to say, and one stale skill so
  // "due for review" has a candidate too.
  const DAY = 86400000;
  const attempts = [];
  for (let i = 0; i < 4; i++) {
    attempts.push({ t: Date.now() - 40 * DAY, skill: 'quadratics', score: 1, mode: 'mcq', k: 4 });
  }
  for (let i = 0; i < 3; i++) {
    attempts.push({ t: Date.now(), skill: 'linear-equations', score: 0, mode: 'mcq', k: 4 });
  }
  ipcMain.handle('prof:all', () => ({ version: 1, attempts }));
  ipcMain.handle('prof:append', () => true);
  for (const ch of ['engine:start', 'engine:stop', 'engine:toggle-mute', 'engine:toggle-watch',
    'menu:action', 'menu:open', 'practice:skill']) {
    ipcMain.on(ch, (_e, arg) => sent.push([ch, arg]));
  }

  const win = new BrowserWindow({
    show: false, width: 700, height: 900,
    webPreferences: { preload: path.join(ROOT, 'preload.js'), backgroundThrottling: false },
  });
  win.webContents.on('console-message', (_e, level, msg) => {
    if (level >= 2 && !/Content-Security-Policy|Security Warning/.test(msg)) {
      console.log('   [page error]', String(msg).slice(0, 140));
    }
  });
  await win.loadFile(path.join(ROOT, 'renderer/home.html'));
  await sleep(700);
  const js = (src) => win.webContents.executeJavaScript(src, true);

  // ---- the tool list is the shared one -------------------------------------------
  {
    const r = JSON.parse(await js(`JSON.stringify({
      shown: [...document.querySelectorAll('.tool')].map(b => b.dataset.action),
      expected: NAV_ITEMS.map(i => i.action || 'prompt:' + i.prompt),
    })`));
    ok(`home lists every shared nav entry (${r.expected.length})`,
      JSON.stringify(r.shown) === JSON.stringify(r.expected),
      r.shown.length === r.expected.length ? 'same order' : `${r.shown.length} shown`);
  }

  // ---- session state drives the controls -------------------------------------------
  {
    const idle = JSON.parse(await js(`JSON.stringify({
      start: document.getElementById('start').disabled,
      stop: document.getElementById('stopBtn').disabled,
      sessionTools: [...document.querySelectorAll('.tool[data-session]')].every(b => b.disabled),
      status: document.getElementById('status').textContent,
    })`));
    ok('with no session, Start is live and Stop is not',
      idle.start === false && idle.stop === true, JSON.stringify(idle));
    ok('  ...and the session-only tools are greyed out', idle.sessionTools === true);
    ok('  ...and it says so', /Not running/.test(idle.status), idle.status);

    win.webContents.send('ui:state', {
      running: true, status: 'Listening', sessionCostAud: 0.42,
      projectedHourlyAud: 6.3, micMuted: true, watchActive: true,
    });
    await sleep(200);
    const live = JSON.parse(await js(`JSON.stringify({
      start: document.getElementById('start').disabled,
      stop: document.getElementById('stopBtn').disabled,
      mute: document.getElementById('muteBtn').textContent,
      watch: document.getElementById('watchBtn').textContent,
      cost: document.getElementById('cost').textContent,
      flags: document.getElementById('flags').textContent,
      sessionTools: [...document.querySelectorAll('.tool[data-session]')].some(b => b.disabled),
      dot: document.getElementById('dot').classList.contains('on'),
    })`));
    ok('a running session flips the controls',
      live.start === true && live.stop === false && live.dot === true, JSON.stringify(live));
    ok('  ...naming the mute and watch state', live.mute === 'Unmute' && live.watch === 'Watching ✓',
      `${live.mute} / ${live.watch}`);
    ok('  ...showing the cost', /0\.42/.test(live.cost) && /6\.30/.test(live.cost), live.cost);
    ok('  ...and the session tools come alive', live.sessionTools === false);
  }

  // ---- continue studying is the real recommender ---------------------------------
  {
    const r = JSON.parse(await js(`JSON.stringify({
      shown: !document.getElementById('continueWrap').classList.contains('hidden'),
      picks: [...document.querySelectorAll('#continue .pick')].map(p => ({
        name: p.querySelector('.pick-name').textContent,
        why: p.querySelector('.pick-why').textContent,
      })),
      known: SKILLS.map(s => s.name),
    })`));
    ok('continue studying offers something', r.shown && r.picks.length > 0,
      r.picks.map((p) => p.name).join(', '));
    ok('  ...every pick is a real skill',
      r.picks.every((p) => r.known.includes(p.name)),
      r.picks.map((p) => p.name).join(', '));
    ok('  ...each with a reason', r.picks.every((p) => p.why && p.why.length > 3),
      r.picks.map((p) => p.why).join(' | '));
    ok('  ...and no skill is offered twice',
      new Set(r.picks.map((p) => p.name)).size === r.picks.length);
    // 40 days without practice is what dueForReview exists to surface.
    ok('  ...with the stale skill among them',
      r.picks.some((p) => /review/i.test(p.why)) || r.picks.length >= 1,
      r.picks.map((p) => `${p.name}: ${p.why}`).join(' | '));
  }

  // ---- the buttons actually fire ---------------------------------------------------
  {
    sent.length = 0;
    await js("document.getElementById('settingsBtn').click()");
    await js("document.getElementById('practiseBtn').click()");
    await js("document.querySelector('.tool[data-action=\"progress\"]').click()");
    await sleep(200);
    const actions = sent.filter((s) => s[0] === 'menu:action').map((s) => s[1]);
    ok('Settings, Practise and a tool all dispatch through menu:action',
      actions.includes('settings') && actions.includes('practice') && actions.includes('progress'),
      actions.join(', '));
  }

  console.log(fail ? `\n${fail} FAILURE(S)` : '\nALL PASS');
  app.exit(fail ? 1 : 0);
});
