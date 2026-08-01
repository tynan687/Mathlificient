#!/usr/bin/env node
/**
 * Copy the shared offline-engine files between the PC and Android trees.
 *
 * These files are meant to be byte-identical on both platforms, but the paths
 * do NOT line up: most live in `renderer/` on PC, while `practice.js` and the
 * quiz/MCQ modules live in `renderer/tools/`. On Android everything is flat in
 * `assets/formulas/`. A directory-level copy therefore silently misses files —
 * which is how `formulas.js` drifted apart without anyone noticing. Hence an
 * explicit pair manifest rather than a glob.
 *
 *   node tools/sync-shared.js            copy PC -> Android
 *   node tools/sync-shared.js --check    report drift, change nothing (exit 1 if any)
 *   node tools/sync-shared.js --from-android
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const PC = path.join(ROOT, 'VoiceMathTutorPC', 'renderer');
const ANDROID = path.join(ROOT, 'VoiceMathTutor', 'app', 'src', 'main', 'assets', 'formulas');

/**
 * [pcRelativeToRenderer, androidRelativeToFormulas]
 * Add every new shared file here — that is the whole point of this script.
 */
const PAIRS = [
  ['practice-data.js', 'practice-data.js'],
  ['practice-viz.js', 'practice-viz.js'],
  ['practice-skills.js', 'practice-skills.js'],
  ['practice-prof.js', 'practice-prof.js'],
  ['practice-store.js', 'practice-store.js'],
  ['practice-quiz.js', 'practice-quiz.js'],
  ['formulas-data.js', 'formulas-data.js'],
  ['tools/practice.js', 'practice.js'],
  ['tools/progress.js', 'progress.js'],
];

/**
 * Deliberately NOT synced. Recording why keeps someone from "fixing" it later.
 */
const DIVERGENT = [
  ['tools/formulas.js', 'formulas.js',
    'Android has the lazy-render/phone work; PC uses navigator.clipboard. Reconcile deliberately, never by copy.'],
  ['tools/practice.html', 'practice.html',
    'PC has the ink toolbars and worksheet button; Android has touch sizing, the .mini popup rules and different asset paths.'],
  ['tools/formulas.html', 'formulas.html',
    'Android has the sticky header, group chips and safe-area insets.'],
  ['tools/progress.html', 'progress.html',
    'Same structure, but Android uses 44px targets and asset-relative script paths.'],
];

const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const exists = (p) => fs.existsSync(p);

function main() {
  const check = process.argv.includes('--check');
  const fromAndroid = process.argv.includes('--from-android');

  let drift = 0;
  let copied = 0;
  let missing = 0;

  for (const [pcRel, androidRel] of PAIRS) {
    const pcPath = path.join(PC, pcRel);
    const androidPath = path.join(ANDROID, androidRel);
    const [src, dst] = fromAndroid ? [androidPath, pcPath] : [pcPath, androidPath];

    if (!exists(src)) {
      console.log(`MISSING  ${path.relative(ROOT, src)}`);
      missing++;
      continue;
    }
    const same = exists(dst) && sha(src) === sha(dst);
    if (same) continue;

    drift++;
    if (check) {
      console.log(`DRIFT    ${pcRel}  <->  ${androidRel}`);
    } else {
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.copyFileSync(src, dst);
      console.log(`copied   ${pcRel}  ->  ${path.relative(ROOT, dst)}`);
      copied++;
    }
  }

  if (check) {
    if (missing) console.log(`\n${missing} file(s) missing.`);
    if (drift) {
      console.log(`\n${drift} shared file(s) out of sync. Run: node tools/sync-shared.js`);
      process.exit(1);
    }
    console.log(`All ${PAIRS.length} shared files match.`);
    if (DIVERGENT.length) {
      console.log('\nIntentionally divergent (not checked):');
      for (const [a, , why] of DIVERGENT) console.log(`  ${a} — ${why}`);
    }
  } else {
    console.log(copied ? `\n${copied} file(s) synced.` : `\nAlready in sync (${PAIRS.length} files).`);
  }
  if (missing) process.exit(1);
}

main();
