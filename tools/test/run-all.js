#!/usr/bin/env node
/**
 * Run every harness that does not need a tablet plugged in.
 *
 *   node tools/test/run-all.js           everything
 *   node tools/test/run-all.js --fast    skip the slow generator sweep
 *   node tools/test/run-all.js pc        only suites whose name contains "pc"
 *
 * The on-device suites (device-*.js) are deliberately excluded — they need a
 * connected tablet and a debug build. See tools/test/README.md.
 *
 * Electron is used as the JS runtime throughout, because this project has no
 * system Node. Suites ending .mjs are pure logic and run with
 * ELECTRON_RUN_AS_NODE=1; the rest need a real browser window.
 */
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const HERE = __dirname;
const REPO = path.resolve(HERE, '..', '..');

/** Ordered so the cheapest, most fundamental checks fail first. */
const SUITES = [
  { name: 'skills', file: 'skills.mjs', node: true, what: 'skill graph + topic matching' },
  { name: 'model', file: 'model.mjs', node: true, what: 'mastery maths, decay, guessing correction' },
  { name: 'practice', cmd: ['tools/check-practice.js'], node: true, slow: true,
    what: 'generators + distractors, ~2000 runs each' },
  { name: 'symbols-data', cmd: ['tools/check-symbols.js'], node: true,
    what: 'symbol entries + cross-references' },
  { name: 'sync', cmd: ['tools/sync-shared.js', '--check'], node: true,
    what: 'PC/Android shared files match' },
  { name: 'viz', file: 'viz.js', what: 'every diagram actually draws' },
  { name: 'pc-progress', file: 'pc-progress.js', what: 'PC: grading, quiz, placement, progress' },
  { name: 'pc-mcq', file: 'pc-mcq.js', what: 'PC: multiple choice end to end' },
  { name: 'pc-symbols', file: 'pc-symbols.js', what: 'PC: symbols browse + read' },
  { name: 'android-progress', file: 'android-progress.js', what: 'Android page at 360dp' },
  { name: 'android-mcq', file: 'android-mcq.js', what: 'Android: options, .mini popup, paper' },
  { name: 'android-symbols', file: 'android-symbols.js', what: 'Android: symbols at 360dp' },
];

/** Electron doubles as the JS runtime — there is no system node here. */
function electronBinary() {
  const candidates = [
    path.join(REPO, 'VoiceMathTutorPC', 'node_modules', 'electron', 'dist', 'electron.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'vmt-build', 'node_modules', 'electron', 'dist', 'electron.exe'),
    path.join(REPO, 'VoiceMathTutorPC', 'node_modules', 'electron', 'dist', 'electron'),
  ];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  return null;
}

const args = process.argv.slice(2);
const fast = args.includes('--fast');
const filter = args.find((a) => !a.startsWith('--'));

const electron = electronBinary();
if (!electron) {
  console.error('Could not find Electron. Run `npm install` in VoiceMathTutorPC first.');
  process.exit(1);
}

const chosen = SUITES.filter((s) => (!filter || s.name.includes(filter)) && !(fast && s.slow));
const results = [];
const started = Date.now();

for (const suite of chosen) {
  const target = suite.cmd || [path.join('tools', 'test', suite.file)];
  process.stdout.write(`\n─── ${suite.name} — ${suite.what}\n`);
  const env = { ...process.env };
  if (suite.node) env.ELECTRON_RUN_AS_NODE = '1'; else delete env.ELECTRON_RUN_AS_NODE;

  const run = spawnSync(electron, target, { cwd: REPO, env, encoding: 'utf8' });
  const out = `${run.stdout || ''}${run.stderr || ''}`;
  // Electron prints security warnings and deprecations that are not ours.
  const lines = out.split('\n').filter((l) =>
    /^(PASS|FAIL|\s+FAIL|ALL PASS|\d+ FAILURE|HARNESS ERROR|  !)/.test(l));
  const failed = run.status !== 0;
  for (const l of lines.filter((l) => /FAIL|HARNESS|  !/.test(l))) console.log(l);
  if (!failed) console.log(`    ok`);
  results.push({ name: suite.name, failed });
}

const secs = ((Date.now() - started) / 1000).toFixed(0);
console.log(`\n${'─'.repeat(56)}`);
for (const r of results) console.log(`  ${r.failed ? 'FAIL' : ' ok '}  ${r.name}`);
const bad = results.filter((r) => r.failed);
console.log(`\n${results.length - bad.length}/${results.length} suites passed in ${secs}s`);
if (bad.length) {
  console.log(`\nRe-run one on its own to see the detail, e.g.:`);
  const s = SUITES.find((x) => x.name === bad[0].name);
  const t = s.cmd ? s.cmd.join(' ') : `tools/test/${s.file}`;
  console.log(`  ${s.node ? 'ELECTRON_RUN_AS_NODE=1 ' : ''}<electron> ${t}`);
}
process.exit(bad.length ? 1 : 0);
