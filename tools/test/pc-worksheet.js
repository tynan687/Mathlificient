// The printable worksheet, in both answering modes.
//
// There has never been a suite for this window. The trap worth guarding is
// specific: the option objects carry `why`, which is null on exactly the correct
// option, so dumping them into the page would make the answer machine-readable in
// the printed HTML — a student reading source could grade the sheet without doing
// any of it.
const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');
const { PC: ROOT } = require('./paths.js');

let fail = 0;
const ok = (label, cond, extra) => {
  if (!cond) fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${label}${extra != null ? ' :: ' + extra : ''}`);
};

/** Build a real question set off the practice page, so this uses real templates. */
async function questionsFrom(win, ids) {
  return JSON.parse(await win.webContents.executeJavaScript(`(() => {
    const out = [];
    for (const id of ${JSON.stringify(ids)}) {
      const t = PRACTICE.find((x) => x.id === id);
      out.push(buildQuestion(t));
    }
    return JSON.stringify(out);
  })()`, true));
}

app.whenReady().then(async () => {
  await session.defaultSession.clearStorageData({ storages: ['localstorage'] });
  ipcMain.handle('settings:get', () => ({ practicePaperColor: '#FFFFFF', currentTopic: 'quadratics' }));
  ipcMain.handle('settings:set', () => true);
  ipcMain.handle('prof:all', () => ({ version: 1, attempts: [] }));
  ipcMain.handle('prof:append', () => true);

  const practice = new BrowserWindow({
    show: false, width: 760, height: 960,
    webPreferences: { preload: path.join(ROOT, 'preload.js'), backgroundThrottling: false },
  });
  await practice.loadFile(path.join(ROOT, 'renderer/tools/practice.html'));
  await new Promise((r) => setTimeout(r, 500));

  // quad-formula has distractors; matrix-det-inv deliberately has none, so it is
  // the per-question fallback case inside an otherwise multiple-choice sheet.
  const set = await questionsFrom(practice, ['quad-formula', 'matrix-det-inv', 'linear-eq']);
  ok('the payload carries built option sets', !!(set[0].choices && set[0].choices.options.length === 4),
    set.map((q) => (q.choices ? 'choices' : 'null')).join(','));
  ok('  ...and matrix-det-inv has none, as designed', set[1].choices === null);

  const sheet = new BrowserWindow({
    show: false, width: 720, height: 840,
    webPreferences: { preload: path.join(ROOT, 'preload.js'), backgroundThrottling: false },
  });
  await sheet.loadFile(path.join(ROOT, 'renderer/tools/worksheet.html'));
  await new Promise((r) => setTimeout(r, 300));

  const draw = async (questions, mode) => JSON.parse(await sheet.webContents.executeJavaScript(`(() => {
    render(${JSON.stringify(questions)}, ${JSON.stringify(mode)});
    return JSON.stringify({
      sub: document.getElementById('sub').textContent,
      items: [...document.querySelectorAll('.qitem')].map(n => ({
        options: n.querySelectorAll('.option').length,
        workspace: n.querySelectorAll('.workspace').length,
        labels: [...n.querySelectorAll('.olabel')].map(l => l.textContent),
      })),
      keys: [...document.querySelectorAll('.arow')].map(n => ({
        letter: (n.querySelector('.akey') || {}).textContent || '',
        text: n.textContent,
      })),
      // KaTeX with throwOnError:false renders a failure as red source text in a
      // .katex-error span. Structure assertions pass straight through that, so
      // without this the sheet can be entirely unreadable and still "pass".
      katexErrors: [...document.querySelectorAll('.katex-error')].map(n => n.textContent.slice(0, 70)),
      html: document.body.innerHTML,
    });
  })()`, true));

  // ---- self mode: unchanged behaviour --------------------------------------------
  let r = await draw(set, 'self');
  ok('self mode prints a working box for every question',
    r.items.every((i) => i.workspace === 1 && i.options === 0));
  ok('  ...and no letters in the answer key', r.keys.every((k) => k === undefined || !k.letter));
  ok('  ...and every question typesets', r.katexErrors.length === 0, r.katexErrors.join(' | '));

  // ---- mcq mode ------------------------------------------------------------------
  r = await draw(set, 'mcq');
  ok('mcq mode prints four lettered options', r.items[0].options === 4,
    r.items[0].labels.join(' '));
  ok('  ...labelled A to D', r.items[0].labels.join('') === 'A)B)C)D)');
  ok('  ...and no working box where there are options', r.items[0].workspace === 0);
  ok('  ...the answer key prints the letter',
    /^[ABCD] — $/.test(r.keys[0].letter), JSON.stringify(r.keys[0].letter));
  ok('  ...and still prints the answer itself', r.keys[0].text.length > 3);
  ok('  ...the subtitle says which mode', /multiple choice/.test(r.sub), r.sub);
  ok('  ...and every question and option typesets',
    r.katexErrors.length === 0, r.katexErrors.join(' | '));

  // ---- the per-question fallback ---------------------------------------------------
  ok('a question with no option set falls back to a box, in the same sheet',
    r.items[1].options === 0 && r.items[1].workspace === 1);
  ok('  ...and its key row prints no letter', !r.keys[1].letter);
  ok('  ...while the others keep their options', r.items[2].options === 4);

  // ---- the leak ---------------------------------------------------------------------
  const whys = set.flatMap((q) => (q.choices ? q.choices.options : []))
    .map((o) => o.why).filter(Boolean);
  ok('the printed page leaks no misconception keys',
    whys.length > 0 && !whys.some((w) => r.html.includes(w)),
    `${whys.length} keys checked`);
  ok('  ...and no "why" attribute or data- payload rides along',
    !/data-why|"why"/.test(r.html));

  console.log(fail ? `\n${fail} FAILURE(S)` : '\nALL PASS');
  app.exit(fail ? 1 : 0);
});
