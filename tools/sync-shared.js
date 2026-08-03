#!/usr/bin/env node
/**
 * Copy the shared offline-engine files between the PC and Android trees.
 *
 * These files are meant to be byte-identical on both platforms, but the paths
 * do NOT line up: most live in `renderer/` on PC, while `practice.js` and
 * `progress.js` live in `renderer/tools/`. On Android everything is flat in
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
  ['practice-mcq.js', 'practice-mcq.js'],
  ['formulas-data.js', 'formulas-data.js'],
  ['symbols-data.js', 'symbols-data.js'],
  ['symbols-quiz.js', 'symbols-quiz.js'],
  ['tools/practice.js', 'practice.js'],
  ['tools/progress.js', 'progress.js'],
  ['tools/symbols.js', 'symbols.js'],
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
  ['tools/symbols.html', 'symbols.html',
    'Same structure, but Android uses 44px targets and asset-relative script paths.'],
];

const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const exists = (p) => fs.existsSync(p);

/**
 * The two practice pages are in DIVERGENT — their markup and CSS are genuinely
 * meant to differ — but the SET OF SCRIPTS they pull in is not. Nothing else
 * would catch adding a shared module to one page and forgetting the other,
 * which is exactly the class of drift the DIVERGENT list warns about.
 * Scripts that legitimately belong to one platform are listed with a reason.
 */
const HTML_PAIRS = [
  ['tools/practice.html', 'practice.html'],
  ['tools/progress.html', 'progress.html'],
  ['tools/symbols.html', 'symbols.html'],
];
const SCRIPT_ONLY = {
  'practice-ink.js': 'PC only — Android draws on a native InkCanvasView below the WebView',
  'theme.js': 'PC only — Android themes its WebViews from Kotlin via applyPaper()',
};

function scriptNames(file) {
  const html = fs.readFileSync(file, 'utf8');
  const names = new Set();
  for (const m of html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)) {
    names.add(path.basename(m[1]));
  }
  return names;
}

/** Returns the number of mismatches found. */
function checkScriptTags() {
  let bad = 0;
  for (const [pcRel, androidRel] of HTML_PAIRS) {
    const pcPath = path.join(PC, pcRel);
    const androidPath = path.join(ANDROID, androidRel);
    if (!exists(pcPath) || !exists(androidPath)) continue;
    const onPc = scriptNames(pcPath);
    const onAndroid = scriptNames(androidPath);
    for (const [set, other, label] of [[onPc, onAndroid, 'Android'], [onAndroid, onPc, 'PC']]) {
      for (const name of set) {
        if (other.has(name) || SCRIPT_ONLY[name]) continue;
        console.log(`SCRIPT   ${pcRel} <-> ${androidRel}: "${name}" is missing on ${label}`);
        bad++;
      }
    }
  }
  return bad;
}

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
    const scriptDrift = checkScriptTags();
    if (missing) console.log(`\n${missing} file(s) missing.`);
    if (drift) {
      console.log(`\n${drift} shared file(s) out of sync. Run: node tools/sync-shared.js`);
      process.exit(1);
    }
    if (scriptDrift) {
      console.log(`\n${scriptDrift} script tag(s) present on one platform only.`);
      process.exit(1);
    }
    console.log(`All ${PAIRS.length} shared files match, and both practice pages load the same scripts.`);
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
