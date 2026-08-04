#!/usr/bin/env node
/**
 * The settings object, and who is allowed to write it.
 *
 * Two things this catches, both of which have happened or nearly happened:
 *
 *   * a control that saves a key nothing ever reads — the same shape as the
 *     theme setting that four pages ignored, and just as invisible;
 *   * a NEW whole-object writer of `settings:set`.
 *
 * The second used to guard a race that was known and accepted: `settings:set`
 * replaced settings.json wholesale, and renderers holding a snapshot for the life
 * of their window wrote it back over anything another writer had changed — so
 * picking a paper colour in Practice, then touching any control in Settings, put
 * the paper back.
 *
 * That race is now FIXED, in two halves, and it needed both. `settings:set` in
 * main.js merges over what is on disk; and settings.js sends only the fields it
 * actually changed, diffed against the copy it opened with — because merging
 * alone cannot help when a stale snapshot carries the old value explicitly and so
 * wins the merge.
 *
 * The pin stays anyway. A whole-object write is still the shape that caused it:
 * with merging in place it can no longer erase a key, but a snapshot-holding
 * writer can still resurrect a stale one. A fourth should be a decision rather
 * than an accident.
 *
 *   node tools/check-settings.js
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

/** Every renderer source, plus main.js. */
function sources() {
  const out = {};
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(js|html)$/.test(e.name)) out[path.relative(PC, p)] = fs.readFileSync(p, 'utf8');
    }
  };
  walk(path.join(PC, 'renderer'));
  out['main.js'] = fs.readFileSync(path.join(PC, 'main.js'), 'utf8');
  return out;
}

const src = sources();
const main = src['main.js'];

// ---- every default is actually used --------------------------------------------------
const block = /DEFAULT_SETTINGS\s*=\s*\{([\s\S]*?)\n\};?/.exec(main);
ok('main.js declares DEFAULT_SETTINGS', !!block);
if (block) {
  const keys = [...block[1].matchAll(/^\s*([a-zA-Z][a-zA-Z0-9]*)\s*:/gm)].map((m) => m[1]);
  ok('  ...with keys in it', keys.length > 0, `${keys.length} keys`);

  // The declaration itself does not count as a use, or every key passes trivially.
  const withoutDefaults = { ...src, 'main.js': main.replace(block[0], '') };
  const dead = [];
  for (const key of keys) {
    // Matches `settings.key`, `s.key`, `{ key: ... }` and `'key'` alike — a use is
    // a use however it is spelled, and being loose here only risks missing a dead
    // key, never inventing one.
    const re = new RegExp(`\\b${key}\\b`);
    if (!Object.values(withoutDefaults).some((t) => re.test(t))) dead.push(key);
  }
  ok('  ...and every one is read or written somewhere', dead.length === 0,
    dead.length ? dead.join(', ') : `${keys.length} keys all used`);
}

// ---- who writes the whole settings object ----------------------------------------------
//
// Pinned deliberately. Adding a name here means accepting that this writer can
// revert a key it did not touch — see the header.
const KNOWN_WRITERS = new Set([
  'renderer/settings.js',      // holds a snapshot from window open; never refreshes it
  'renderer/engine.js',        // holds its own; writes when the tutor saves a topic
  'renderer/practice-ink.js',  // re-reads first, so this one cannot revert anything
]);

const writers = Object.entries(src)
  .filter(([f, t]) => f !== 'main.js' && /invoke\(\s*['"`]settings:set/.test(t))
  .map(([f]) => f.replace(/\\/g, '/'));

const added = writers.filter((f) => !KNOWN_WRITERS.has(f));
const gone = [...KNOWN_WRITERS].filter((f) => !writers.includes(f));

ok(`settings:set has no new whole-object writer (${writers.length} known)`,
  added.length === 0,
  added.length
    ? `${added.join(', ')} — see the header before adding it to KNOWN_WRITERS`
    : writers.join(', '));
// A writer that has gone away is good news, but the list should still be trimmed
// so it keeps describing reality.
ok('  ...and the pinned list has no stale entries', gone.length === 0,
  gone.length ? `no longer writes settings: ${gone.join(', ')}` : 'list matches');

console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL PASS');
process.exit(failures ? 1 : 0);
