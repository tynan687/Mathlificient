#!/usr/bin/env node
/**
 * Hammer the symbols quiz's question builder.
 *
 * The expensive failure is the same one check-practice.js exists for: an option
 * that is secretly right, or a question that cannot assemble four honest options
 * and silently falls back. Symbols make that easy to get wrong, because
 * distractors come from `confusableWith` — which is declared one-way, resolved
 * both ways, and empty on plenty of entries.
 *
 *   node tools/check-symbols-quiz.js
 *   node tools/check-symbols-quiz.js --runs 5000
 */
const path = require('path');

const R = path.resolve(__dirname, '..', 'VoiceMathTutorPC', 'renderer');
// Classic script tags share one scope, so the data has to be global before the
// quiz module is required — the same dance check-practice.js does for skills.
Object.assign(globalThis, require(path.join(R, 'symbols-data.js')));
Object.assign(globalThis, require(path.join(R, 'practice-mcq.js')));
const skills = require(path.join(R, 'practice-skills.js'));
Object.assign(globalThis, skills);
const { SymbolsQuiz } = require(path.join(R, 'symbols-quiz.js'));
const { normalLatex } = require(path.join(R, 'practice-mcq.js'));

const args = process.argv.slice(2);
const idx = args.indexOf('--runs');
const RUNS = idx >= 0 && Number.isFinite(Number(args[idx + 1])) ? Number(args[idx + 1]) : 2000;

let failures = 0;
const seen = new Set();
const fail = (msg, detail) => {
  const key = `${msg}|${detail || ''}`;
  if (seen.has(key)) return; // one systemic bug must not bury every other failure
  seen.add(key);
  failures++;
  console.log(`  FAIL  ${msg}${detail ? `\n        ${detail}` : ''}`);
};

// ---- every category must own a skill, or its attempts vanish -------------------------
// Store.profAppend drops an attempt with no skill silently, so a category with no
// matching `sym-*` skill would look like it was recording and never appear.
for (const cat of SYMBOL_CATEGORIES) {
  const id = SymbolsQuiz.skillForCategory(cat.id);
  if (!SKILL_BY_ID[id]) fail(`category "${cat.id}" has no ${id} skill`);
  else if (SKILL_BY_ID[id].area !== 'notation') {
    fail(`${id} should sit in the notation area`, SKILL_BY_ID[id].area);
  }
}

// ---- top-up must always reach four options -------------------------------------------
for (const sym of SYMBOLS) {
  const n = SymbolsQuiz.neighbours(sym, 5);
  if (n.length < 3) fail(`${sym.id} cannot raise 3 distractors`, `${n.length} found`);
  if (n.some((o) => o.id === sym.id)) fail(`${sym.id} is offered as its own distractor`);
}

// ---- the questions themselves --------------------------------------------------------
let nulls = 0;
const modes = {};
for (let i = 0; i < RUNS; i++) {
  const q = SymbolsQuiz.buildQuestion();
  if (!q) { nulls++; continue; }
  modes[q.mode] = (modes[q.mode] || 0) + 1;

  const { options, answerIndex, k } = q.choices;
  if (options.length !== 4) fail(`${q.mode} built ${options.length} options`);
  if (k !== options.length) fail(`${q.mode} reports k = ${k} for ${options.length} options`);

  const correct = options.filter((o) => o.why === null);
  if (correct.length !== 1) fail(`${q.mode} marks ${correct.length} options correct`);
  if (normalLatex(options[answerIndex].latex) !== normalLatex(q.answer)) {
    fail(`${q.mode}: answerIndex does not point at the answer`);
  }

  const norms = options.map((o) => normalLatex(o.latex));
  if (new Set(norms).size !== norms.length) {
    fail(`${q.mode} shows the same option twice`, norms.join('  |  '));
  }
  for (const o of options) {
    if (o.why === null) continue;
    // The feedback names the symbol behind a wrong pick, so the key has to resolve.
    if (!SYMBOL_BY_ID[o.why] && !READING_BY_ID[o.why]) {
      fail(`${q.mode}: distractor key "${o.why}" resolves to nothing`);
    }
    if (normalLatex(o.latex) === normalLatex(q.answer)) {
      fail(`${q.mode}: a distractor IS the answer`, o.latex);
    }
  }
  if (!q.sym || !SYMBOL_BY_ID[q.sym.id]) fail(`${q.mode} has no symbol to attribute the attempt to`);
}

const rate = nulls / RUNS;
if (rate > 0.02) fail(`${(rate * 100).toFixed(1)}% of questions could not be built`);

console.log(`\n${RUNS} questions: `
  + Object.entries(modes).map(([m, n]) => `${m} ${n}`).join(' · ')
  + (nulls ? ` · ${nulls} unbuildable` : ''));
console.log(`${SYMBOLS.length} symbols, ${SYMBOL_CATEGORIES.length} categories, all with a sym-* skill`);
console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL PASS');
process.exit(failures ? 1 : 0);
