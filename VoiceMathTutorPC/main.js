const {
  app, BrowserWindow, ipcMain, desktopCapturer, safeStorage, screen, dialog,
} = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

let homeWin = null;
let settingsWin = null;
let engineWin = null;
let bubbleWin = null;
let menuWin = null;
const toolWins = {};

/**
 * Set once the front door has been closed, so the deferred quit runs exactly one
 * pass — without it, `app.quit()` fires `close` again and the handler would keep
 * re-arming its own timer.
 */
let quitting = false;
/** Long enough for the engine to close the session and write the study log. */
const STOP_GRACE_MS = 700;

// ---- Local storage ---------------------------------------------------------------

const file = (name) => path.join(app.getPath('userData'), name);

/**
 * The app was called "VoiceMathTutor" before 1.0.0. Electron derives the
 * userData folder from productName, so renaming it to "Mathlificient" points at
 * a fresh, empty directory and leaves the old API key, settings, memory, study
 * log and PDF library stranded next door. Copy them across once, on first run
 * after the rename. Chromium's own caches are deliberately not copied — they
 * regenerate, and they're the bulk of the folder.
 */
function migrateLegacyUserData() {
  const current = app.getPath('userData');
  const legacy = path.join(path.dirname(current), 'VoiceMathTutor');
  if (legacy === current || !fs.existsSync(legacy)) return;
  // Anything already here wins — never clobber newer data with older.
  if (fs.existsSync(path.join(current, 'settings.json'))) return;

  const items = [
    'apikey.bin', 'settings.json', 'spend.json', 'study_log.json',
    'tutor_memory.json', 'worked_examples.json', 'proficiency.json', 'pdfs',
  ];
  try {
    fs.mkdirSync(current, { recursive: true });
    for (const name of items) {
      const from = path.join(legacy, name);
      const to = path.join(current, name);
      if (fs.existsSync(from) && !fs.existsSync(to)) {
        fs.cpSync(from, to, { recursive: true });
      }
    }
    console.log('Migrated settings from the pre-1.0 VoiceMathTutor folder.');
  } catch (err) {
    // Not fatal: a fresh install just starts empty.
    console.error('Could not migrate old user data:', err.message);
  }
}
migrateLegacyUserData();

const DEFAULT_SETTINGS = {
  model: 'gpt-realtime-2.1',
  reasoningEffort: 'high',
  vadEagerness: 'low',
  voice: 'marin',
  pushToTalk: true, // mic locked by default: hold the bubble to talk (unlock VAD in settings)
  softCapAud: 12,
  personalisationEnabled: true,
  currentTopic: 'partial fraction decomposition',
  tapAction: 'hint',
  watchMode: false,
  watchIntervalSec: 20,
  captureTargetName: '', // '' = entire screen; otherwise a window-title substring
  assessmentMode: false,
  textbook: '',
  textbookWindowName: '', // window title of the user's e-book reader; '' = off
  retrievalModel: 'gpt-4.1-mini', // cheap text model for PDF search reranking
  bubbleColor: '#4F7DF7',
  bubbleSize: 96,
  bubbleOpacity: 1.0,
  bubbleGlyph: 'π',
  theme: 'system', // system | light | dark | sepia
  // Drives every accent in the app — buttons, tabs, links and the diagram
  // colour — through the --accent token in renderer/app.css.
  accent: '#4F7DF7',
  practicePaperColor: '#FFFFFF', // Practice Studio ink canvas paper colour
};

function readJson(name, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file(name), 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(name, obj) {
  fs.writeFileSync(file(name), JSON.stringify(obj, null, 2));
}

function readApiKey() {
  try {
    const raw = fs.readFileSync(file('apikey.bin'));
    return safeStorage.isEncryptionAvailable()
      ? safeStorage.decryptString(raw)
      : raw.toString('utf8');
  } catch {
    return null;
  }
}

// ---- Windows ---------------------------------------------------------------------

function createWindows() {
  // The front door. This used to be the settings form, which meant the app
  // opened on a page of controls and could not be configured without keeping
  // that page open — closing it quit everything.
  homeWin = new BrowserWindow({
    width: 700,
    height: 820,
    minWidth: 520,
    // The page's <title> overrides this. ownWindowTitles() reads the live title
    // off each window, so the capture picker follows automatically and there is
    // no list to keep in sync.
    title: 'Mathlificient',
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  homeWin.removeMenu();
  homeWin.loadFile('renderer/home.html');
  // Closing the front door quits, by design — but not instantly. `app.quit()`
  // never routes through the engine's stop(), so the session's duration, cost and
  // assessment report never reach studylog:append: a student who closes the window
  // at the end of an hour loses the record of that hour. Ask the engine to stop,
  // give it a moment to write, then go.
  homeWin.on('close', (e) => {
    if (quitting) return;
    quitting = true;
    e.preventDefault();
    engineWin?.webContents.send('engine:stop');
    setTimeout(() => app.quit(), STOP_GRACE_MS);
  });

  // Hidden window that owns the WebRTC session; throttling off so the watch
  // loop and audio keep running while hidden.
  engineWin = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      backgroundThrottling: false,
    },
  });
  engineWin.loadFile('renderer/engine.html');

  bubbleWin = new BrowserWindow({
    width: 96,
    height: 96,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    show: false,
    focusable: false, // never steal focus/clicks from the app underneath
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      backgroundThrottling: false,
    },
  });
  bubbleWin.setAlwaysOnTop(true, 'screen-saver');
  bubbleWin.loadFile('renderer/bubble.html');
  bubbleWin.webContents.on('did-finish-load', () => {
    // Start click-through: only the disc becomes interactive (renderer toggles this
    // per hover via 'bubble:interactive'), so clicks elsewhere pass through to Word.
    bubbleWin.setIgnoreMouseEvents(true, { forward: true });
    sendBubbleStyle();
  });
}

function sendBubbleStyle() {
  if (!bubbleWin) return;
  const s = { ...DEFAULT_SETTINGS, ...readJson('settings.json', {}) };
  const size = Math.round(s.bubbleSize);
  bubbleWin.setSize(size, size);
  bubbleWin.webContents.send('bubble:style', {
    color: s.bubbleColor, size, opacity: s.bubbleOpacity, glyph: s.bubbleGlyph,
  });
}

// ---- Quick-action menu + tool windows --------------------------------------------

const MENU_SIZE = { width: 220, height: 470 };

/**
 * Where the quick menu may sit.
 *
 * Two bugs met here. Callers without a cursor position (the home screen's search
 * buttons send none) produced `setPosition(NaN, NaN)`, which throws in main
 * BEFORE show() — so the button silently did nothing from the second press on.
 * And the menu is positioned from the raw cursor with no clamp, so right-clicking
 * a bubble parked low pushed the whole Tools group off the bottom of a frameless,
 * unscrollable window.
 *
 * Defaulting and clamping here rather than at the call sites means every present
 * and future caller is safe.
 */
function menuPosition(x, y, size) {
  const pt = (Number.isFinite(x) && Number.isFinite(y))
    ? { x: Math.round(x), y: Math.round(y) }
    : screen.getCursorScreenPoint();
  const { workArea } = screen.getDisplayNearestPoint(pt);
  const w = (size && size.width) || MENU_SIZE.width;
  const h = (size && size.height) || MENU_SIZE.height;
  return {
    x: Math.max(workArea.x, Math.min(pt.x, workArea.x + workArea.width - w)),
    y: Math.max(workArea.y, Math.min(pt.y, workArea.y + workArea.height - h)),
  };
}

function openMenu(x, y) {
  const at = menuPosition(x, y);
  if (menuWin && !menuWin.isDestroyed()) {
    menuWin.setPosition(at.x, at.y);
    menuWin.reload(); // reset DOM to the fresh menu (not a leftover search prompt)
    menuWin.show();
    menuWin.focus();
    return;
  }
  menuWin = new BrowserWindow({
    width: MENU_SIZE.width, height: MENU_SIZE.height, x: at.x, y: at.y,
    frame: false, transparent: true, alwaysOnTop: true, skipTaskbar: true,
    resizable: false, hasShadow: true, show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  menuWin.setAlwaysOnTop(true, 'screen-saver');
  menuWin.loadFile('renderer/menu.html');
  menuWin.once('ready-to-show', () => { menuWin.show(); menuWin.focus(); });
  menuWin.on('blur', () => menuWin && menuWin.hide());
}

let chatWin = null;
let worksheetWin = null;

/**
 * Bring an already-open window to the front.
 *
 * `show()` alone is a no-op on a window that is already visible, so the second
 * press of a button that "opens" something did nothing at all — and with fresh
 * content just rendered into it, that reads as the button being broken.
 */
function surface(win) {
  if (!win || win.isDestroyed()) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.moveTop();
  win.focus();
}

function openWorksheet() {
  if (worksheetWin && !worksheetWin.isDestroyed()) {
    surface(worksheetWin);
    return;
  }
  worksheetWin = new BrowserWindow({
    width: 720, height: 840, title: 'Worksheet',
    // Practice is alwaysOnTop and it is the window the Worksheet button lives in,
    // so an ordinary window opens UNDERNEATH it and the button looks broken. A
    // topmost window sits above a normal one no matter which has focus.
    alwaysOnTop: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  worksheetWin.removeMenu();
  worksheetWin.loadFile('renderer/tools/worksheet.html');
  worksheetWin.on('closed', () => { worksheetWin = null; });
}
function openChat() {
  if (chatWin && !chatWin.isDestroyed()) {
    surface(chatWin);
    return;
  }
  chatWin = new BrowserWindow({
    width: 480, height: 640, title: 'Worked Examples',
    // Same reason as the worksheet: the tutor says "look at the panel" while
    // pushing to it, so it has to be able to come forward past pinned Practice.
    alwaysOnTop: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  chatWin.removeMenu();
  chatWin.loadFile('renderer/chat.html');
  chatWin.on('closed', () => { chatWin = null; });
}

const TOOL_SIZES = {
  converter: [420, 560],
  timer: [420, 560],
  formulas: [560, 720],
  practice: [760, 960],
  progress: [620, 820],
  symbols: [620, 860],
  ambient: [380, 360],
};

// Practice grew a drawing canvas + two toolbar rows + quiz controls — don't let
// it get shrunk into an unusable sliver.
const TOOL_MIN_SIZES = {
  practice: [560, 680],
  progress: [420, 520],
};

/** Tools you work alongside, rather than switch to. */
const FLOATING_TOOLS = new Set(['practice', 'formulas']);

/**
 * Tools that must keep running while hidden.
 *
 * Chromium throttles timers in an occluded page to roughly once a minute, and the
 * timer decrements by one per tick — so a minimised focus timer does not pause,
 * it runs about sixty times slow and the phase change fires minutes late. Losing
 * time while you are not looking is precisely the failure a focus timer cannot
 * have. Ambient sound has the same problem for the same reason.
 *
 * Scoped rather than applied to every tool window: keeping a page fully awake
 * costs battery, and the others have nothing to keep doing.
 */
const KEEP_RUNNING_TOOLS = new Set(['timer', 'ambient']);

function openTool(name) {
  if (toolWins[name] && !toolWins[name].isDestroyed()) {
    surface(toolWins[name]);
    return toolWins[name];
  }
  const [w, h] = TOOL_SIZES[name] || [420, 560];
  const [minW, minH] = TOOL_MIN_SIZES[name] || [0, 0];
  const win = new BrowserWindow({
    width: w, height: h, minWidth: minW, minHeight: minH, title: name,
    // Only the two that exist to sit BESIDE your work stay on top. Pinning the
    // progress screen or the symbol reference over every other window is just
    // a window you cannot get out of the way.
    alwaysOnTop: FLOATING_TOOLS.has(name), skipTaskbar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      backgroundThrottling: !KEEP_RUNNING_TOOLS.has(name),
    },
  });
  win.removeMenu();
  win.loadFile(`renderer/tools/${name}.html`);
  win.on('closed', () => { toolWins[name] = null; });
  toolWins[name] = win;
  return win;
}

/**
 * Ask the practice page to mark what the tutor heard.
 *
 * A round trip rather than a channel pair, because the answer must never leave
 * that page: it marks the attempt itself and hands back only a verdict.
 * executeJavaScript returns a promise, so this needs no new renderer plumbing —
 * and deliberately does NOT open the window. If practice is not on screen there
 * is nothing to mark, and opening it behind the student's back to answer a tool
 * call would be worse than saying so.
 */
async function checkPracticeAnswer(heard) {
  const win = toolWins.practice;
  if (!win || win.isDestroyed() || win.webContents.isLoading()) {
    return { verdict: 'none', reason: 'the practice window is not open' };
  }
  try {
    const raw = await win.webContents.executeJavaScript(
      `window.__checkAnswer(${JSON.stringify(String(heard || ''))})`, true);
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (err) {
    return { verdict: 'unsure', reason: err.message };
  }
}
ipcMain.handle('practice:check', (_e, payload) => checkPracticeAnswer(payload && payload.heard));

/** The student's handwritten working, base64, for the tutor to actually look at. */
ipcMain.handle('practice:working', async () => {
  const win = toolWins.practice;
  if (!win || win.isDestroyed() || win.webContents.isLoading()) return null;
  try {
    return await win.webContents.executeJavaScript('window.__working && window.__working()', true);
  } catch { return null; }
});

/**
 * Settings, opened from the home screen rather than being the home screen.
 * Closing it no longer quits the app, which is the whole point.
 */
function openSettings() {
  if (settingsWin && !settingsWin.isDestroyed()) {
    settingsWin.show();
    settingsWin.focus();
    return settingsWin;
  }
  settingsWin = new BrowserWindow({
    width: 560, height: 900, title: 'Mathlificient Settings',
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  settingsWin.removeMenu();
  settingsWin.loadFile('renderer/settings.html');
  settingsWin.on('closed', () => { settingsWin = null; });
  return settingsWin;
}

/** Open the practice window and send it something once it's ready to listen. */
function sendToPractice(channel, payload) {
  const win = openTool('practice');
  if (win.webContents.isLoading()) {
    win.webContents.once('did-finish-load', () => win.webContents.send(channel, payload));
  } else {
    win.webContents.send(channel, payload);
  }
  win.show();
  win.focus();
}

// A tutor-generated practice question: open the practice window and hand it over.
ipcMain.on('practice:push', (_e, payload) => sendToPractice('practice:new', payload));

// "Practise this" / "Take the placement check", from the progress window.
ipcMain.on('practice:skill', (_e, skillId) => sendToPractice('practice:skill', skillId));
ipcMain.on('practice:placement', () => sendToPractice('practice:placement'));

// A generated worksheet (N questions + answer key) to print or save as PDF.
ipcMain.on('worksheet:open', (_e, payload) => {
  openWorksheet();
  const target = worksheetWin;
  if (target.webContents.isLoading()) {
    target.webContents.once('did-finish-load', () => target.webContents.send('worksheet:data', payload));
  } else {
    target.webContents.send('worksheet:data', payload);
  }
});

// Cheap-vision watch check: the screenshot goes to the lightweight model, not the
// realtime session. Returns { verdict } ("OK" / "ALERT: …") or { error }.
const VISION_CHECK_PROMPT =
  "You are silently checking a maths student's written working from a screenshot. " +
  "Reply with EXACTLY 'OK' if the visible working is correct, unfinished, or unclear " +
  "- or 'ALERT: <one short sentence naming the specific line and the error>' if there " +
  'is a CLEAR mathematical mistake. Never flag half-written steps or style.';

ipcMain.handle('vision:check', async (_e, { b64, model }) => {
  try {
    const key = readApiKey();
    if (!key) return { error: 'no API key' };
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model || 'gpt-4.1-mini',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: VISION_CHECK_PROMPT },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${b64}`, detail: 'high' } },
          ],
        }],
        max_completion_tokens: 60,
      }),
      signal: AbortSignal.timeout(12_000),
    });
    const json = await resp.json();
    if (!resp.ok) return { error: JSON.stringify(json).slice(0, 200) };
    const verdict = (json.choices && json.choices[0] && json.choices[0].message
      && json.choices[0].message.content || '').trim();
    return verdict ? { verdict } : { error: 'empty verdict' };
  } catch (e) {
    return { error: String(e.message || e) };
  }
});

// ---- IPC: settings / key / files -------------------------------------------------

ipcMain.handle('settings:get', () => ({ ...DEFAULT_SETTINGS, ...readJson('settings.json', {}) }));
/**
 * Merge, never replace.
 *
 * Callers send a patch of what they changed (settings.js diffs against the copy
 * it opened with; practice-ink.js sends one key). A whole-object write here meant
 * whichever window saved last erased every other writer's field — the documented
 * clobber. Merging also makes a single-key write from any page safe.
 */
ipcMain.handle('settings:set', (_e, patch) => {
  const current = readJson('settings.json', {});
  writeJson('settings.json', { ...current, ...(patch || {}) });
  return true;
});

ipcMain.handle('apikey:exists', () => fs.existsSync(file('apikey.bin')));

/**
 * Whether the API key can be encrypted at rest.
 *
 * On Windows this is always true — safeStorage uses DPAPI, which is always
 * there — so the plaintext branch below never once ran. On Linux safeStorage
 * needs a keyring (libsecret with gnome-keyring or kwallet actually running),
 * and without one it silently writes the key as readable bytes. The .deb
 * depends on libsecret-1-0, but a dependency does not mean a keyring is
 * *unlocked*, so the answer has to be reported rather than assumed.
 */
ipcMain.handle('apikey:secure', () => safeStorage.isEncryptionAvailable());

/**
 * How the desktop will treat our floating windows.
 *
 * The bubble and the quick-action menu place themselves — setPosition, an
 * always-on-top level of 'screen-saver', a transparent frameless window and
 * click-through via setIgnoreMouseEvents. All of that is X11. Wayland does not
 * let a client choose where its own window goes, so on a Wayland session the
 * bubble will not stay where it is dragged and the menu will not open under the
 * cursor. Debian 12's default GNOME session IS Wayland.
 *
 * Reporting this beats leaving it looking broken. Everything else — home,
 * practice, progress, symbols, the tools — is ordinary windows and is fine.
 */
ipcMain.handle('platform:info', () => ({
  platform: process.platform,
  // XDG_SESSION_TYPE is what a login manager sets; ozone tells us what Electron
  // actually chose, which can differ if the user forced a backend.
  sessionType: process.env.XDG_SESSION_TYPE || '',
  wayland: process.platform === 'linux'
    && (process.env.XDG_SESSION_TYPE === 'wayland' || !!process.env.WAYLAND_DISPLAY),
  keyringOk: safeStorage.isEncryptionAvailable(),
}));

ipcMain.handle('apikey:save', (_e, key) => {
  const trimmed = String(key).trim();
  const secure = safeStorage.isEncryptionAvailable();
  const data = secure ? safeStorage.encryptString(trimmed) : Buffer.from(trimmed, 'utf8');
  // Report rather than throw, so the renderer can say something useful instead of
  // surfacing Electron's "Error invoking remote method" wrapper.
  try {
    fs.writeFileSync(file('apikey.bin'), data);
  } catch (err) {
    return { saved: false, secure, error: err.message };
  }
  // 0600 either way, but it is the only protection left when `secure` is false.
  try { fs.chmodSync(file('apikey.bin'), 0o600); } catch { /* best effort */ }
  return { saved: true, secure };
});

ipcMain.handle('memory:get', () => readJson('tutor_memory.json', { notes: [] }));
ipcMain.handle('memory:add', (_e, text) => {
  const m = readJson('tutor_memory.json', { notes: [] });
  m.notes.push({ date: new Date().toISOString().slice(0, 10), text: String(text).trim() });
  writeJson('tutor_memory.json', m);
  return m;
});
ipcMain.handle('memory:delete', (_e, index) => {
  const m = readJson('tutor_memory.json', { notes: [] });
  if (index >= 0 && index < m.notes.length) m.notes.splice(index, 1);
  writeJson('tutor_memory.json', m);
  return m;
});
ipcMain.handle('memory:clear', () => {
  writeJson('tutor_memory.json', { notes: [] });
  return { notes: [] };
});

ipcMain.handle('studylog:get', () => readJson('study_log.json', { sessions: [] }));
ipcMain.handle('studylog:append', (_e, entry) => {
  const log = readJson('study_log.json', { sessions: [] });
  log.sessions.push(entry);
  writeJson('study_log.json', log);
  return true;
});

// ---- IPC: proficiency ------------------------------------------------------------
//
// An append-only log of attempts; the mastery maths lives in the renderer
// (renderer/practice-prof.js) and is recomputed on read. Nothing is derived
// here, so two windows practising at once can at worst lose a single attempt
// rather than clobber a whole record.

const EMPTY_PROF = () => ({ version: 1, attempts: [] });

/** Keep the file bounded — 5000 attempts is years of practice, and mastery is
 *  dominated by the recent tail anyway. */
const PROF_MAX_ATTEMPTS = 5000;

ipcMain.handle('prof:all', () => readJson('proficiency.json', EMPTY_PROF()));
ipcMain.handle('prof:append', (_e, attempt) => {
  if (!attempt || !attempt.skill) return false;
  const log = readJson('proficiency.json', EMPTY_PROF());
  if (!Array.isArray(log.attempts)) log.attempts = [];
  log.attempts.push(attempt);
  if (log.attempts.length > PROF_MAX_ATTEMPTS) {
    log.attempts = log.attempts.slice(-PROF_MAX_ATTEMPTS);
  }
  writeJson('proficiency.json', log);
  return true;
});
ipcMain.handle('prof:reset', () => {
  writeJson('proficiency.json', EMPTY_PROF());
  return true;
});
/**
 * Save an export where the student asks. The renderer builds the bytes — this
 * only picks a destination, so the two platforms produce the identical file.
 */
ipcMain.handle('prof:export', async (event, payload) => {
  const { file, body } = payload || {};
  if (!file || typeof body !== 'string') return { ok: false, reason: 'nothing to export' };
  // Modal to the window that asked, so the dialog cannot end up behind it.
  const parent = BrowserWindow.fromWebContents(event.sender);
  const res = await dialog.showSaveDialog(parent || undefined, {
    defaultPath: file,
    filters: file.endsWith('.csv')
      ? [{ name: 'CSV', extensions: ['csv'] }]
      : [{ name: 'JSON', extensions: ['json'] }],
  });
  if (res.canceled || !res.filePath) return { ok: false, canceled: true };
  // The write was unguarded, so a student could pick a filename, press Save and
  // get no file and no error — most easily by exporting the CSV twice while the
  // first copy is open in Excel, which fails EBUSY. Having just been through a
  // Save dialog, they have every reason to believe it worked.
  try {
    fs.writeFileSync(res.filePath, body, 'utf8');
    return { ok: true, path: res.filePath };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
});

/** Forget one skill, keep the rest. A filter, so no mastery is derived here either. */
ipcMain.handle('prof:resetSkill', (_e, skillId) => {
  if (!skillId) return false;
  const log = readJson('proficiency.json', EMPTY_PROF());
  if (!Array.isArray(log.attempts)) return false;
  log.attempts = log.attempts.filter((a) => a && a.skill !== skillId);
  writeJson('proficiency.json', log);
  return true;
});

const dayKey = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() - offset);
  return d.toISOString().slice(0, 10);
};
ipcMain.handle('spend:get', () => {
  const spend = readJson('spend.json', {});
  let week = 0;
  for (let i = 0; i < 7; i++) week += spend[dayKey(i)] || 0;
  return { today: spend[dayKey()] || 0, week };
});
ipcMain.handle('spend:add', (_e, aud) => {
  const spend = readJson('spend.json', {});
  spend[dayKey()] = (spend[dayKey()] || 0) + Number(aud);
  writeJson('spend.json', spend);
  return true;
});

// ---- IPC: realtime + capture -----------------------------------------------------

ipcMain.handle('realtime:mint', async (_e, sessionConfig) => {
  const key = readApiKey();
  if (!key) throw new Error('No API key saved');
  const resp = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ session: sessionConfig }),
  });
  const text = await resp.text();
  if (!resp.ok) throw new Error(`client_secrets failed (${resp.status}): ${text}`);
  const body = JSON.parse(text);
  const value = body.value || (body.client_secret && body.client_secret.value);
  if (!value) throw new Error('No client secret in response');
  return value;
});

async function captureFullScreenB64() {
  const display = screen.getPrimaryDisplay();
  const { width, height } = display.size;
  const scale = Math.min(1536 / Math.max(width, height), 1);
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: Math.round(width * scale), height: Math.round(height * scale) },
  });
  const source = sources.find((s) => s.display_id === String(display.id)) || sources[0];
  if (!source || source.thumbnail.isEmpty()) return null;
  return source.thumbnail.toJPEG(80).toString('base64');
}

/**
 * Own windows, excluded from the picker and from window matching.
 *
 * Asked of the live windows rather than kept as a list. A hardcoded set listed
 * four names while the real titles were ten different ones — `Practice`,
 * `My Progress`, `Symbols`, `Formula Sheet`, `Worksheet`, `Focus Timer`, … — so
 * the picker offered our own screens and a student who chose "Practice" had the
 * tutor watching Mathlificient instead of their work.
 *
 * A window's real title comes from its page's `<title>`, which overrides the
 * constructor option, so reading `getTitle()` is also the only way to get the
 * name the OS actually publishes. This cannot go stale.
 */
function ownWindowTitles() {
  const titles = new Set(['Mathlificient']);
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue;
    const t = win.getTitle();
    if (t) titles.add(t);
  }
  return titles;
}

ipcMain.handle('capture:list-sources', async () => {
  const sources = await desktopCapturer.getSources({
    types: ['screen', 'window'],
    thumbnailSize: { width: 0, height: 0 },
  });
  const own = ownWindowTitles();
  return sources
    .filter((s) => s.name && !own.has(s.name))
    .map((s) => ({ name: s.name, type: s.id.startsWith('screen') ? 'screen' : 'window' }));
});

ipcMain.handle('capture:screen', async (_e, target) => {
  if (target && target.type === 'window' && target.name) {
    const sources = await desktopCapturer.getSources({
      types: ['window'],
      thumbnailSize: { width: 1536, height: 1536 },
    });
    const wanted = String(target.name).toLowerCase();
    const own = ownWindowTitles();
    const match = sources.find(
      (s) => s.name && !own.has(s.name) && s.name.toLowerCase().includes(wanted)
    );
    if (match && !match.thumbnail.isEmpty()) {
      return { b64: match.thumbnail.toJPEG(80).toString('base64'), fellBack: false };
    }
    return { b64: await captureFullScreenB64(), fellBack: true };
  }
  return { b64: await captureFullScreenB64(), fellBack: false };
});

// ---- Web search (Wikipedia reference API; no key, no bot-blocking) ----------------

ipcMain.handle('search:web', async (_e, query) => {
  try {
    const url = 'https://en.wikipedia.org/w/api.php?action=query&format=json'
      + '&generator=search&gsrsearch=' + encodeURIComponent(String(query))
      + '&gsrlimit=4&prop=extracts|info&exintro=1&explaintext=1&exchars=320&inprop=url';
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'Mathlificient/1.0 (personal study app)' },
    });
    if (!resp.ok) return { error: `search failed (${resp.status})` };
    const json = await resp.json();
    const pages = json.query && json.query.pages ? Object.values(json.query.pages) : [];
    pages.sort((a, b) => (a.index || 0) - (b.index || 0));
    const results = pages.map((p) => ({
      title: p.title,
      snippet: (p.extract || '').replace(/\s+/g, ' ').slice(0, 300),
      url: p.fullurl,
    }));
    return { results };
  } catch (err) {
    return { error: String(err.message || err) };
  }
});

// ---- PDF reference library --------------------------------------------------------

const pdfDir = () => {
  const dir = file('pdfs');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
};
const pdfPath = (id) => path.join(pdfDir(), `${id}.json`);

function pdfIndex() {
  return readJson(path.join('pdfs', 'index.json'), { books: [] });
}
function writePdfIndex(index) {
  writeJson(path.join('pdfs', 'index.json'), index);
}

let pdfjsLib = null;
async function loadPdfjs() {
  if (pdfjsLib) return pdfjsLib;
  const p = path.join(__dirname, 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.mjs');
  pdfjsLib = await import('file:///' + p.replace(/\\/g, '/'));
  return pdfjsLib;
}

/** Best-effort printed page number: a standalone number near the start/end of the page. */
function detectPrintedPage(text) {
  const head = text.slice(0, 60);
  const tail = text.slice(-60);
  const m = (tail.match(/\b(\d{1,4})\b\s*$/) || head.match(/^\s*(\d{1,4})\b/));
  return m ? Number(m[1]) : null;
}

ipcMain.handle('pdf:list', () => pdfIndex().books);

ipcMain.handle('pdf:add', async () => {
  const pick = await dialog.showOpenDialog(settingsWin, {
    title: 'Add a textbook PDF you own',
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
    properties: ['openFile'],
  });
  if (pick.canceled || !pick.filePaths[0]) return { canceled: true, books: pdfIndex().books };
  const filePath = pick.filePaths[0];
  // Everything below can throw on a perfectly ordinary file — an encrypted PDF is
  // enough, and loadPdfjs() is a dynamic ESM import that may fail outright in a
  // packaged build. Unguarded, the button went "Indexing…" and back, the list
  // still said "No books yet", and the student believed they had added a textbook.
  try {
    const pdfjs = await loadPdfjs();
    const data = new Uint8Array(fs.readFileSync(filePath));
    const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
    const pages = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      const text = content.items.map((i) => i.str).join(' ').replace(/\s+/g, ' ').trim();
      pages.push({ page: p, printedPage: detectPrintedPage(text), text });
    }
    const id = crypto.randomBytes(6).toString('hex');
    const title = path.basename(filePath).replace(/\.pdf$/i, '');
    const totalChars = pages.reduce((sum, p) => sum + p.text.length, 0);
    const noText = totalChars < 40; // scanned/image-only PDF — nothing to search
    writeJson(path.join('pdfs', `${id}.json`),
      { id, title, addedAt: new Date().toISOString(), pageCount: doc.numPages, noText, pages });
    const index = pdfIndex();
    index.books.push({ id, title, pageCount: doc.numPages, noText });
    writePdfIndex(index);
    return { books: index.books, warning: noText
      ? `"${title}" has no text layer (it looks scanned/image-only), so topic search `
        + 'will not find anything in it. Use a text-based PDF or an OCR\'d copy.'
      : null };
  } catch (err) {
    return {
      books: pdfIndex().books,
      error: `Could not read ${path.basename(filePath)}: ${err.message}`,
    };
  }
});

ipcMain.handle('pdf:remove', (_e, id) => {
  const index = pdfIndex();
  index.books = index.books.filter((b) => b.id !== id);
  writePdfIndex(index);
  try { fs.unlinkSync(pdfPath(id)); } catch { /* ignore */ }
  return { books: index.books };
});

const STOPWORDS = new Set(['the', 'a', 'an', 'of', 'to', 'in', 'is', 'and', 'or', 'for',
  'on', 'with', 'how', 'what', 'where', 'do', 'i', 'my', 'me', 'find', 'about', 'this']);

function localCandidates(query, bookId) {
  const terms = String(query).toLowerCase().match(/[a-z0-9]+/g) || [];
  const wanted = terms.filter((t) => t.length > 1 && !STOPWORDS.has(t));
  if (!wanted.length) return [];
  const books = pdfIndex().books.filter((b) => !bookId || b.id === bookId);
  const scored = [];
  for (const book of books) {
    const doc = readJson(path.join('pdfs', `${book.id}.json`), null);
    if (!doc) continue;
    for (const pg of doc.pages) {
      const hay = pg.text.toLowerCase();
      let score = 0;
      for (const t of wanted) {
        let idx = hay.indexOf(t);
        while (idx !== -1) { score++; idx = hay.indexOf(t, idx + t.length); }
      }
      if (score > 0) {
        scored.push({
          book: book.title, bookId: book.id, page: pg.page,
          printedPage: pg.printedPage, score,
          snippet: pg.text.slice(0, 400),
        });
      }
    }
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 8);
}

ipcMain.handle('pdf:search', async (_e, { query, bookId, retrievalModel }) => {
  const candidates = localCandidates(query, bookId);
  if (!candidates.length) return { results: [] };
  const key = readApiKey();
  // Hybrid: let a cheap model rerank/explain the local candidates.
  if (key && retrievalModel) {
    try {
      const context = candidates.map((c, i) =>
        `[${i}] book="${c.book}" pdfPage=${c.page} printedPage=${c.printedPage ?? '?'}\n`
        + c.snippet).join('\n\n');
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: retrievalModel,
          messages: [
            { role: 'system', content: 'You help locate where a topic is covered in a '
              + 'student\'s textbook. From the candidate pages, pick the best 3 for the '
              + 'query. Reply ONLY with JSON: {"results":[{"index":<n>,"why":"<short>"}]}.' },
            { role: 'user', content: `Query: ${query}\n\nCandidates:\n${context}` },
          ],
          temperature: 0,
          max_tokens: 300,
        }),
      });
      if (resp.ok) {
        const json = await resp.json();
        const raw = json.choices?.[0]?.message?.content || '';
        const parsed = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));
        const picked = (parsed.results || []).map((r) => {
          const c = candidates[r.index];
          return c && { book: c.book, page: c.page, printedPage: c.printedPage, why: r.why };
        }).filter(Boolean);
        if (picked.length) return { results: picked };
      }
    } catch { /* fall through to keyword-only */ }
  }
  // Keyword-only fallback.
  return {
    results: candidates.slice(0, 3).map((c) => ({
      book: c.book, page: c.page, printedPage: c.printedPage,
      why: 'keyword match',
    })),
  };
});

// ---- IPC: window routing ---------------------------------------------------------

// engine → bubble
ipcMain.on('bubble:state', (_e, state) => bubbleWin?.webContents.send('bubble:state', state));
ipcMain.on('bubble:flags', (_e, flags) => bubbleWin?.webContents.send('bubble:flags', flags));
ipcMain.on('bubble:timer', (_e, payload) => bubbleWin?.webContents.send('bubble:timer', payload));
ipcMain.on('bubble:restyle', () => sendBubbleStyle());
ipcMain.on('bubble:interactive', (_e, on) => {
  // on = pointer is over the disc → capture clicks; otherwise pass through to Word.
  bubbleWin?.setIgnoreMouseEvents(!on, { forward: true });
});

// bubble → engine
ipcMain.on('bubble:tap', () => engineWin?.webContents.send('bubble:tap'));
ipcMain.on('bubble:hold', (_e, down) => engineWin?.webContents.send('bubble:hold', down));

// quick-action menu
ipcMain.on('menu:open', (_e, x, y) => openMenu(x, y));
ipcMain.on('menu:close', () => menuWin && menuWin.hide());
ipcMain.on('menu:resize', (_e, height) => {
  if (!menuWin || menuWin.isDestroyed() || !(height > 0)) return;
  const [w] = menuWin.getSize();
  const h = Math.min(Math.round(height), 700);
  menuWin.setSize(w, h);
  // Growing only ever adds height downward from the click point, so the menu can
  // leave the screen after it resizes even though it fitted when it opened.
  const [x, y] = menuWin.getPosition();
  const at = menuPosition(x, y, { width: w, height: h });
  if (at.x !== x || at.y !== y) menuWin.setPosition(at.x, at.y);
});
ipcMain.on('menu:action', (_e, action) => {
  menuWin && menuWin.hide();
  switch (action) {
    case 'ask': engineWin?.webContents.send('bubble:tap'); break;
    case 'snapshot': engineWin?.webContents.send('engine:snapshot'); break;
    case 'practice':
      // Open the popup immediately (offline generator); a live session will also
      // ask the tutor for a context-tailored question that replaces it.
      openTool('practice');
      engineWin?.webContents.send('engine:practice');
      break;
    case 'watch': engineWin?.webContents.send('engine:toggle-watch'); break;
    case 'mute': engineWin?.webContents.send('engine:toggle-mute'); break;
    case 'converter': openTool('converter'); break;
    case 'timer': openTool('timer'); break;
    case 'formulas': openTool('formulas'); break;
    case 'progress': openTool('progress'); break;
    case 'symbols': openTool('symbols'); break;
    case 'ambient': openTool('ambient'); break;
    case 'chat': openChat(); break;
    case 'settings': openSettings(); break;
    default: break;
  }
});

// Worked examples: engine pushes; stored locally; panel auto-opens.
ipcMain.on('working:push', (_e, example) => {
  const store = readJson('worked_examples.json', { items: [] });
  const entry = {
    title: String(example.title || 'Worked example').slice(0, 120),
    steps: (Array.isArray(example.steps) ? example.steps : [String(example.steps || '')])
      .slice(0, 30).map((s) => String(s).slice(0, 500)),
    note: example.note ? String(example.note).slice(0, 400) : undefined,
    when: new Date().toISOString().slice(0, 16).replace('T', ' '),
  };
  store.items.push(entry);
  if (store.items.length > 50) store.items = store.items.slice(-50);
  writeJson('worked_examples.json', store);
  openChat();
  // Window may have just been created — wait for load before sending.
  const target = chatWin;
  if (target.webContents.isLoading()) {
    target.webContents.once('did-finish-load', () => target.webContents.send('working:new', entry));
  } else {
    target.webContents.send('working:new', entry);
  }
});
ipcMain.handle('working:list', () => readJson('worked_examples.json', { items: [] }).items);
ipcMain.handle('working:clear', () => { writeJson('worked_examples.json', { items: [] }); return true; });

// Theme changes broadcast to every window.
ipcMain.on('theme:changed', () => {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('theme:changed');
  }
});
ipcMain.on('engine:web-search', (_e, query) => engineWin?.webContents.send('engine:web-search', query));
ipcMain.on('engine:textbook-search', (_e, query) => engineWin?.webContents.send('engine:textbook-search', query));
ipcMain.on('tool:timer', (_e, payload) => bubbleWin?.webContents.send('bubble:timer', payload));

// bubble dragging
ipcMain.on('bubble:move', (_e, dx, dy) => {
  if (!bubbleWin) return;
  const [x, y] = bubbleWin.getPosition();
  bubbleWin.setPosition(x + Math.round(dx), y + Math.round(dy));
});
ipcMain.on('bubble:snap', () => {
  if (!bubbleWin) return;
  const [x, y] = bubbleWin.getPosition();
  const area = screen.getDisplayNearestPoint({ x, y }).workArea;
  const margin = 16;
  const targetX = x + 48 < area.x + area.width / 2
    ? area.x + margin
    : area.x + area.width - 96 - margin;
  const clampedY = Math.min(Math.max(y, area.y + margin), area.y + area.height - 96 - margin);
  bubbleWin.setPosition(targetX, clampedY);
});

// settings ↔ engine
ipcMain.on('engine:start', () => {
  engineWin?.webContents.send('engine:start');
  if (bubbleWin) {
    sendBubbleStyle();
    const area = screen.getPrimaryDisplay().workArea;
    const size = Math.round(bubbleWin.getBounds().width);
    bubbleWin.setPosition(area.x + area.width - size - 24, area.y + 160);
    bubbleWin.show();
  }
});
ipcMain.on('engine:stop', () => {
  engineWin?.webContents.send('engine:stop');
  bubbleWin?.hide();
});
ipcMain.on('engine:toggle-mute', () => engineWin?.webContents.send('engine:toggle-mute'));
ipcMain.on('engine:toggle-watch', () => engineWin?.webContents.send('engine:toggle-watch'));
ipcMain.on('session:hide-bubble', () => bubbleWin?.hide());

/**
 * engine → every screen that shows session status.
 *
 * This used to go to `settingsWin` alone, which was right when Settings WAS the
 * main window. Once home became the front door that made its whole session card
 * dead: it reported "Not running" through a live session, left Stop, Mute and
 * Watch disabled, and greyed out six of its tool buttons — so there was no way to
 * stop the tutor from the window the app opens on.
 *
 * Send to any of our windows that are listening, so adding another screen later
 * cannot reintroduce this.
 */
function broadcastUi(state) {
  for (const win of [homeWin, settingsWin]) {
    if (win && !win.isDestroyed()) win.webContents.send('ui:state', state);
  }
}
ipcMain.on('ui:state', (_e, state) => broadcastUi(state));

// ---- App lifecycle ---------------------------------------------------------------

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  // Bring the front door forward, not Settings — `settingsWin` is null until the
  // user opens Settings, so relaunching from the shortcut used to do nothing at
  // all. Fall back to any window we have, so this can never be a no-op again.
  app.on('second-instance', () => {
    const win = [homeWin, settingsWin].find((w) => w && !w.isDestroyed())
      || BrowserWindow.getAllWindows().find((w) => !w.isDestroyed());
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  });
  app.whenReady().then(createWindows);
  app.on('window-all-closed', () => app.quit());
}
