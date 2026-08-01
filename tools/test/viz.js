// Every template that emits a viz must actually draw something. A spec the
// renderer silently ignores looks fine in the data and shows a blank panel.
const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');
const { PC: ROOT, ASSETS } = require('./paths.js');

app.whenReady().then(async () => {
  // Start from a clean profile: localStorage is shared across harnesses via the
  // default Electron profile, so a mode remembered by an earlier run would
  // change what this one sees.
  await session.defaultSession.clearStorageData({ storages: ['localstorage'] });
  ipcMain.handle('settings:get', () => ({ practicePaperColor: '#FFFFFF', currentTopic: 'quadratics' }));
  ipcMain.handle('settings:set', () => true);
  ipcMain.handle('prof:all', () => ({ version: 1, attempts: [] }));
  ipcMain.handle('prof:append', () => true);

  const win = new BrowserWindow({
    show: false, width: 760, height: 960,
    webPreferences: { preload: path.join(ROOT, 'preload.js'), backgroundThrottling: false },
  });
  await win.loadFile(path.join(ROOT, 'renderer/tools/practice.html'));
  await new Promise((r) => setTimeout(r, 500));

  const out = await win.webContents.executeJavaScript(`(async () => {
    const canvas = document.getElementById('viz');
    canvas.style.width = '600px'; canvas.style.height = '280px';
    document.getElementById('vizWrap').classList.remove('hidden');
    await new Promise(r => setTimeout(r, 60));
    const results = [];
    for (const t of PRACTICE) {
      // Several draws per template: the spec depends on the random numbers.
      let drewEvery = true, sawViz = false, type = null, err = null;
      for (let i = 0; i < 25; i++) {
        const q = t.generate();
        if (!q.viz) continue;
        sawViz = true; type = q.viz.type;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        try {
          renderVisual(canvas, q.viz, { bg: '#ffffff', fg: '#1a1a1a', accent: '#4F7DF7' });
        } catch (e) { err = e.message; drewEvery = false; break; }
        // Count non-background pixels: a spec the renderer ignores leaves it blank.
        const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let ink = 0;
        for (let p = 0; p < d.length; p += 4) {
          if (d[p] < 250 || d[p+1] < 250 || d[p+2] < 250) ink++;
        }
        if (ink < 200) { drewEvery = false; break; }
      }
      if (sawViz) results.push({ id: t.id, type, drewEvery, err });
    }
    return JSON.stringify(results);
  })()`, true);

  const results = JSON.parse(out);
  let fail = 0;
  for (const r of results) {
    if (!r.drewEvery) {
      fail++;
      console.log(`FAIL — ${r.id} (${r.type}) drew nothing${r.err ? ': ' + r.err : ''}`);
    }
  }
  const byType = {};
  for (const r of results) byType[r.type] = (byType[r.type] || 0) + 1;
  console.log(`${results.length} templates with a visual: `
    + Object.entries(byType).map(([t, n]) => `${t} x${n}`).join(', '));
  console.log(fail ? `\n${fail} FAILURE(S)` : '\nALL PASS');
  app.exit(fail ? 1 : 0);
});
