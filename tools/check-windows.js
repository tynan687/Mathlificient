#!/usr/bin/env node
/**
 * Window behaviour, read out of main.js.
 *
 * Every assertion here corresponds to a bug that shipped, and each was found by
 * reading rather than by anything failing — which is the point of writing them
 * down. They are source checks because the alternative is driving a real second
 * instance, a real screen edge and a real occluded page, and none of that runs in
 * a second on a machine with no display.
 *
 * The bugs, in the order they appear below:
 *
 *   * the front door reported a live session as "Not running" and could not stop
 *     it, because status went to one window that is null until Settings is opened;
 *   * relaunching from the shortcut did nothing at all, for the same reason;
 *   * closing the front door quit without stopping the session, losing the study
 *     log entry for the whole sitting;
 *   * the capture picker offered our own windows, so "watch Practice" pointed the
 *     tutor at Mathlificient instead of the student's work;
 *   * a minimised focus timer ran ~60x slow, which is the one thing a focus timer
 *     must not do;
 *   * the worksheet opened underneath always-on-top Practice and looked broken;
 *   * the quick menu grew downward from the cursor with no clamp, putting its
 *     Tools group off the bottom of a frameless window.
 *
 *   node tools/check-windows.js
 */
const fs = require('fs');
const path = require('path');

const MAIN = path.resolve(__dirname, '..', 'VoiceMathTutorPC', 'main.js');
const main = fs.readFileSync(MAIN, 'utf8');

let failures = 0;
const ok = (label, cond, extra) => {
  if (!cond) failures++;
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${label}${extra != null ? ` :: ${extra}` : ''}`);
};

/**
 * The text from an anchor to the end of its top-level block.
 *
 * Delimited by the next `\n});` or `\n}` at column zero rather than by a
 * character count. The first version of this took a fixed number of characters
 * and reported a missing `catch` that was simply 150 characters further down the
 * handler than the window reached — a check failing for a reason that has nothing
 * to do with what it is checking is worse than no check.
 */
const near = (anchor) => {
  const i = main.indexOf(anchor);
  if (i < 0) return '';
  const end = main.slice(i).search(/\n\}\)?;?\n/);
  return end < 0 ? main.slice(i) : main.slice(i, i + end);
};

// ---- session status reaches every screen that shows it --------------------------------
{
  const handler = near("ipcMain.on('ui:state'");
  ok('session status is broadcast, not sent to a single window',
    !!handler && !/\bsettingsWin\?\.webContents\.send/.test(handler),
    handler.split('\n')[0]);
  const fn = near('function broadcastUi');
  ok('  ...and the broadcast includes the home window', /homeWin/.test(fn));
  ok('  ...and settings', /settingsWin/.test(fn));
  ok('  ...skipping destroyed windows', /isDestroyed\(\)/.test(fn));
}

// ---- relaunching brings something forward ---------------------------------------------
{
  const fn = near("app.on('second-instance'");
  ok('a second launch focuses the front door', /homeWin/.test(fn), fn.split('\n')[1]);
  ok('  ...and falls back to any window rather than doing nothing',
    /getAllWindows\(\)/.test(fn));
  ok('  ...restoring it if minimised', /isMinimized\(\)/.test(fn) && /focus\(\)/.test(fn));
}

// ---- quitting does not throw the session away -----------------------------------------
{
  const fn = near("homeWin.on('close");
  ok('closing the front door stops the session first', /engine:stop/.test(fn));
  ok('  ...before quitting, not instead of it', /app\.quit\(\)/.test(fn));
  ok('  ...and only runs its exit path once', /quitting/.test(fn));
}

// ---- the tutor is never offered our own windows ---------------------------------------
{
  ok('own windows are excluded by asking the live windows, not from a list',
    /function ownWindowTitles/.test(main) && /getAllWindows\(\)[\s\S]{0,120}getTitle\(\)/.test(main));
  ok('  ...and no hardcoded title list survives',
    !/OWN_WINDOW_TITLES\s*=/.test(main));
  const list = near("ipcMain.handle('capture:list-sources'");
  ok('  ...the picker filters against it', /ownWindowTitles\(\)/.test(list));
  const cap = near("ipcMain.handle('capture:screen'");
  ok('  ...and so does window matching', /ownWindowTitles\(\)/.test(cap));
}

// ---- tools that must keep running while hidden ----------------------------------------
{
  const set = /KEEP_RUNNING_TOOLS = new Set\(\[([^\]]*)\]\)/.exec(main);
  ok('the timer keeps running while hidden', !!set && /timer/.test(set[1]),
    set && set[1].trim());
  ok('  ...and so does ambient sound', !!set && /ambient/.test(set[1]));
  ok('  ...wired to backgroundThrottling', /backgroundThrottling:\s*!KEEP_RUNNING_TOOLS/.test(main));
  // Not every window: keeping a page awake costs battery and the rest have
  // nothing to keep doing.
  ok('  ...but not applied to every tool', !!set && !/practice|progress|symbols/.test(set[1]));
}

// ---- windows that have to come forward past a pinned one -------------------------------
{
  ok('there is one way to bring an open window forward', /function surface\(/.test(main));
  const fn = near('function surface(');
  ok('  ...which does more than show()', /moveTop\(\)/.test(fn) && /focus\(\)/.test(fn));
  const ws = near('function openWorksheet');
  ok('the worksheet can rise above pinned Practice', /alwaysOnTop:\s*true/.test(ws));
  ok('  ...and surfaces when already open', /surface\(worksheetWin\)/.test(ws));
  const chat = near('function openChat');
  ok('the worked-examples panel does too',
    /alwaysOnTop:\s*true/.test(chat) && /surface\(chatWin\)/.test(chat));
  const tool = near('function openTool');
  ok('  ...as do reopened tool windows', /surface\(toolWins\[name\]\)/.test(tool));
}

// ---- the quick menu stays on screen ---------------------------------------------------
{
  ok('menu position is computed in one place', /function menuPosition/.test(main));
  const fn = near('function menuPosition');
  ok('  ...clamped to the display work area', /workArea/.test(fn));
  ok('  ...defaulting to the cursor when given no coordinates',
    /getCursorScreenPoint\(\)/.test(fn) && /Number\.isFinite/.test(fn));
  const resize = near("ipcMain.on('menu:resize'");
  ok('  ...and re-clamped after it grows', /menuPosition\(/.test(resize));
}

// ---- actions that must report failure --------------------------------------------------
{
  const exp = near("ipcMain.handle('prof:export'");
  ok('export reports a failed write instead of swallowing it',
    /catch/.test(exp) && /ok:\s*false/.test(exp), 'prof:export');
  ok('  ...and its dialog is modal to the window that asked',
    /fromWebContents/.test(exp));
  const pdf = near("ipcMain.handle('pdf:add'");
  ok('adding a PDF reports why it failed', /catch\s*\(err\)/.test(pdf) && /error:/.test(pdf));
  const key = near("ipcMain.handle('apikey:save'");
  ok('saving the key reports a failed write', /saved:\s*false/.test(key));
  const set = near("ipcMain.handle('settings:set'");
  ok('settings are merged, never replaced wholesale', /readJson\('settings\.json'/.test(set)
    && /\.\.\.current/.test(set));
}

console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL PASS');
process.exit(failures ? 1 : 0);
