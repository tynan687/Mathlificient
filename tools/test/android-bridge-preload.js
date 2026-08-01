// Stands in for FormulaSheetActivity.Bridge, with the same semantics as
// memory/Proficiency.kt: synchronous, string in / string out, corrupt reads
// degrade to an empty log.
const fs = require('fs');
const path = require('path');
const os = require('os');

const FILE = path.join(os.tmpdir(), 'android-proficiency.json');
const EMPTY = '{"version":1,"attempts":[]}';

window.__androidCalls = [];

window.Android = {
  profAll() {
    try {
      const text = fs.readFileSync(FILE, 'utf8');
      const o = JSON.parse(text);
      if (!Array.isArray(o.attempts)) return EMPTY;
      return text;
    } catch { return EMPTY; }
  },
  profAppend(json) {
    let attempt;
    try { attempt = JSON.parse(json); } catch { return; }
    if (!attempt || !attempt.skill) return;
    let log;
    try { log = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { log = { version: 1, attempts: [] }; }
    if (!Array.isArray(log.attempts)) log = { version: 1, attempts: [] };
    log.attempts.push(attempt);
    fs.writeFileSync(FILE, JSON.stringify(log));
  },
  profReset() { fs.writeFileSync(FILE, EMPTY); },
  openSkill(id) { window.__androidCalls.push(['openSkill', id]); },
  openPlacement() { window.__androidCalls.push(['openPlacement']); },
  speak(text) { window.__androidCalls.push(['speak', text]); },
  copyText(t) { window.__androidCalls.push(['copyText', t]); },
  closeWindow() { window.__androidCalls.push(['closeWindow']); },
};

window.__profFile = FILE;
