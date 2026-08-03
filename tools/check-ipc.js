#!/usr/bin/env node
/**
 * Every IPC channel a renderer uses must exist on the other side.
 *
 * The bridge in preload.js is deliberately generic — `invoke`, `send` and `on`
 * pass any channel name straight through — so a typo or a renamed handler fails
 * at runtime, silently, on whatever screen happens to use it. Nothing else in
 * the project would notice. This is the PC counterpart to
 * `tools/check-activities.js`, and the same kind of check: source text, one
 * second, no app and no device.
 *
 *   node tools/check-ipc.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PC = path.join(ROOT, 'VoiceMathTutorPC');

let failures = 0;
const ok = (label, cond, extra) => {
  if (!cond) failures++;
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${label}${extra != null ? ` :: ${extra}` : ''}`);
};

const renderer = {};
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(js|html)$/.test(e.name)) renderer[path.relative(PC, p).replace(/\\/g, '/')] = fs.readFileSync(p, 'utf8');
  }
}(path.join(PC, 'renderer')));
const main = fs.readFileSync(path.join(PC, 'main.js'), 'utf8');

const all = (re, text) => [...text.matchAll(re)].map((m) => m[1]);
const handled = new Set(all(/ipcMain\.handle\(\s*['"]([^'"]+)/g, main));
const listened = new Set(all(/ipcMain\.on\(\s*['"]([^'"]+)/g, main));

/**
 * Channels main.js sends to a renderer.
 *
 * Literal `.send('x')` is the easy half. The other half is `sendToPractice`,
 * which takes the channel as an argument and is the ONLY way practice:new,
 * practice:skill and practice:placement are ever dispatched — miss it and this
 * check confidently reports three bugs that do not exist.
 */
const sent = new Set(all(/\.send\(\s*['"]([^'"]+)/g, main));
for (const c of all(/sendToPractice\(\s*['"]([^'"]+)/g, main)) sent.add(c);

/** Where a channel is used, for the failure message. */
function usedIn(channel, kind) {
  const re = new RegExp(`tutor\\.${kind}\\(\\s*['"\`]${channel.replace(/[:$]/g, '\\$&')}`);
  return Object.keys(renderer).filter((f) => re.test(renderer[f])).join(', ');
}

const uses = (kind) => {
  const out = new Set();
  const re = new RegExp(`(?:window\\.)?tutor\\.${kind}\\(\\s*['"\`]([^'"\`]+)`, 'g');
  for (const text of Object.values(renderer)) for (const c of all(re, text)) out.add(c);
  return [...out];
};

const badInvoke = uses('invoke').filter((c) => !handled.has(c));
ok(`every invoke() has an ipcMain.handle (${uses('invoke').length} channels)`,
  badInvoke.length === 0,
  badInvoke.map((c) => `${c} <- ${usedIn(c, 'invoke')}`).join(' | ') || 'all handled');

// A send() may legitimately be answered by handle() as well as on().
const badSend = uses('send').filter((c) => !listened.has(c) && !handled.has(c));
ok(`every send() has an ipcMain.on (${uses('send').length} channels)`,
  badSend.length === 0,
  badSend.map((c) => `${c} <- ${usedIn(c, 'send')}`).join(' | ') || 'all listened for');

const badOn = uses('on').filter((c) => !sent.has(c));
ok(`every tutor.on() waits for something main.js sends (${uses('on').length} channels)`,
  badOn.length === 0,
  badOn.map((c) => `${c} <- ${usedIn(c, 'on')}`).join(' | ') || 'all dispatched');

// The reverse direction is a warning, not a failure: main.js may hold a handler
// for a channel only the Android side or a harness uses.
const unused = [...handled, ...listened].filter(
  (c) => !uses('invoke').includes(c) && !uses('send').includes(c));
if (unused.length) console.log(`     main.js handles with no renderer caller: ${unused.join(', ')}`);

console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL PASS');
process.exit(failures ? 1 : 0);
