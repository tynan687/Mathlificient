#!/usr/bin/env node
/**
 * Hammer every practice generator and its multiple-choice distractors.
 *
 * The distractors are hand-written maths, so this is where their bugs live. The
 * expensive failure is a "wrong" option that is secretly right — a student picks
 * it, gets marked down, and the app records a misconception they didn't have.
 * Plain string inequality does not catch that, so this checks:
 *
 *   * options are distinct once normalised (x^{3} and x^3 render the same)
 *   * no option is the answer reordered (x = 3, x = -5 vs x = -5, x = 3)
 *   * every option shares the answer's shape, so the odd one out can't give
 *     itself away — skipped for templates that set `mcqShapeVaries`
 *   * every `why` maps to a MISCONCEPTIONS entry, and every entry is reachable
 *   * no "0x" / "1x" / "+ 0" rendering artifacts, in distractors as well as
 *     questions and answers
 *
 *   node tools/check-practice.js            full run
 *   node tools/check-practice.js --runs 50  quicker pass while authoring
 *   node tools/check-practice.js quad       only templates matching "quad"
 */
const path = require('path');

const R = path.resolve(__dirname, '..', 'VoiceMathTutorPC', 'renderer');

// practice-data.js's templatesForSkill calls skillOf from practice-skills.js, and
// classic script tags share one scope — so the skills module has to be on the
// global object before the data module is required.
const skills = require(path.join(R, 'practice-skills.js'));
Object.assign(globalThis, skills);
const { PRACTICE, MISCONCEPTIONS } = require(path.join(R, 'practice-data.js'));
// practice-viz.js touches `window` at call time only, so requiring it for the
// type list is safe under Node.
const { VIZ_TYPES } = require(path.join(R, 'practice-viz.js'));
const mcq = require(path.join(R, 'practice-mcq.js'));
const { buildChoices, normalLatex, shapeOf, equivalentAnswers, MCQ_OPTIONS } = mcq;

const args = process.argv.slice(2);
const runsIdx = args.indexOf('--runs');
const RUNS = runsIdx >= 0 ? Number(args[runsIdx + 1]) : 500;
const filter = args.find((a) => !a.startsWith('--') && a !== String(RUNS));

let failures = 0;
const fail = (template, msg, detail) => {
  failures++;
  console.log(`  FAIL  [${template}] ${msg}`);
  if (detail) console.log(`        ${detail}`);
};

/** Artifacts a coefficient formatter should never produce. Scoped to avoid the
 *  legitimate "-8 + 0i" (complex) and "24 - 0 = 24" (definite-integral step). */
const ARTIFACT = /(^|[^0-9a-zA-Z\\])(0x|[+-] 0x|1x(?![0-9])|[+-] 0(?![0-9ix.]))/;

/**
 * A negative number raised to a power without brackets. "-16^2" is -(16^2) in
 * every convention there is, so writing it where (-16)^2 is meant puts a
 * different — and wrong — number on the screen. PR.par exists for this.
 * Found on-device in coord-distance's working, after four harnesses missed it.
 *
 * `^\circ` is excluded: "-118.07^\circ" is a negative angle, not a power.
 */
const UNBRACKETED_POWER = /-\d+(?:\.\d+)?\^(?!\\circ)/;

/**
 * Only the coefficient artifacts, for scanning STEPS.
 *
 * Steps legitimately contain "- 0" and "+ 0" — "24 - 0 = 24" in a definite
 * integral, "5(5) + 0(-2)" in a dot product with a zero component — because
 * they show the arithmetic as it actually happens. "0x" and "1x" are never
 * right anywhere, so those still fail.
 */
const STEP_ARTIFACT = /(^|[^0-9a-zA-Z\\])(0x|1x(?![0-9]))/;

// --- self-test ----------------------------------------------------------------
// Every check below leans on these three helpers. If they are wrong, the whole
// run is a green light that means nothing — so prove them first.
{
  const same = (a, b, expect, label) => {
    if (equivalentAnswers(a, b) !== expect) {
      fail('practice-mcq', `${label}: "${a}" vs "${b}"`);
    }
  };
  same('x = 3', 'x = 3', true, 'identical');
  same('x^{3}', 'x^3', true, 'braces round a single token are decoration');
  same('\\tfrac{1}{2}', '\\frac{1}{2}', true, 'tfrac and frac render the same');
  same('x = 5, \\ x = -3', 'x = -3, \\ x = 5', true, 'roots reordered are the same answer');
  same('(x + 2)^2 - 8', '(x - 2)^2 - 8', false, 'a flipped sign is a different answer');
  same('(x + 2)^2 - 8', '(x + 2)^2 + 8', false, 'a flipped constant is a different answer');
  same('x = 3', 'x = -3', false, 'negation is a different answer');
  same('x^2 + 12x + 36', 'x^2 + 12x - 36', false, 'a sign change is not a reordering');
  same('x = 4', '\\frac{1}{2}', false, 'unrelated');
  if (shapeOf('4x^2 - x - 5') !== shapeOf('4x^2 + 19x - 5')) {
    fail('practice-mcq', 'a unit coefficient should not change the shape');
  }
  if (shapeOf('x = 5') === shapeOf('x = \\frac{1}{2}')) {
    fail('practice-mcq', 'a fraction should not share a shape with an integer');
  }
  if (shapeOf('2x^2 + 3') === shapeOf('2x^2 + 4x + 3')) {
    fail('practice-mcq', 'a vanished term should change the shape');
  }
}

const seenWhy = new Set();
const stats = [];

for (const t of PRACTICE) {
  if (filter && !t.id.includes(filter)) continue;

  let mcqOk = 0;
  let mcqNull = 0;
  let sampled = null;

  for (let i = 0; i < RUNS; i++) {
    const gen = t.generate();
    const { w, ...q } = gen;

    // --- the generator itself -------------------------------------------------
    for (const [field, text] of [['question', q.question], ['answer', q.answer]]) {
      if (typeof text !== 'string' || !text.length) {
        fail(t.id, `${field} is empty`);
        break;
      }
      if (ARTIFACT.test(text)) fail(t.id, `${field} has a coefficient artifact`, text);
    }
    if (!Array.isArray(q.steps) || !q.steps.length) fail(t.id, 'no steps');
    // The worked steps are read as carefully as the answer, so they get the same
    // scrutiny. This was previously unchecked, which is how a "-16^2" shipped.
    for (const [i, text] of (q.steps || []).entries()) {
      if (UNBRACKETED_POWER.test(text)) {
        fail(t.id, `step ${i + 1} raises a negative to a power without brackets`, text);
      }
      if (STEP_ARTIFACT.test(text)) fail(t.id, `step ${i + 1} has a coefficient artifact`, text);
    }
    for (const [field, text] of [['question', q.question], ['answer', q.answer]]) {
      if (UNBRACKETED_POWER.test(text)) {
        fail(t.id, `${field} raises a negative to a power without brackets`, text);
      }
    }
    if (q.viz && !VIZ_TYPES.includes(q.viz.type)) {
      fail(t.id, `viz type "${q.viz.type}" has no renderer`);
    }

    if (!t.distractors) { mcqNull++; continue; }

    // --- the options ----------------------------------------------------------
    if (typeof w !== 'object' || w === null) {
      fail(t.id, 'declares distractors() but generate() returns no workings bag `w`');
      break;
    }

    // Coverage is counted off the raw candidate list, not the three that get
    // shipped: candidates are best-first and the tail exists as slack for when
    // an earlier one collides, so a trailing `why` is legitimately rare.
    for (const c of (t.distractors(w) || [])) {
      if (c && c.why) seenWhy.add(c.why);
    }
    const choices = buildChoices(q.answer, t.distractors, w, { ordered: t.mcqOrdered });
    if (!choices) { mcqNull++; continue; }
    mcqOk++;
    if (!sampled) sampled = { q, choices };

    if (choices.options.length !== MCQ_OPTIONS) {
      fail(t.id, `${choices.options.length} options, expected ${MCQ_OPTIONS}`);
    }
    const correct = choices.options.filter((o) => o.why === null);
    if (correct.length !== 1) {
      fail(t.id, `${correct.length} options marked correct, expected exactly 1`);
    }
    if (normalLatex(choices.options[choices.answerIndex].latex) !== normalLatex(q.answer)) {
      fail(t.id, 'answerIndex does not point at the answer');
    }

    const norms = choices.options.map((o) => normalLatex(o.latex));
    if (new Set(norms).size !== norms.length) {
      fail(t.id, 'two options render the same', norms.join('  |  '));
    }

    for (const o of choices.options) {
      if (o.why === null) continue;
      if (equivalentAnswers(o.latex, q.answer, t.mcqOrdered)) {
        fail(t.id, 'a distractor is the answer in disguise',
          `answer: ${q.answer}\n        option: ${o.latex}`);
      }
      if (ARTIFACT.test(o.latex)) {
        fail(t.id, 'a distractor has a coefficient artifact', o.latex);
      }
      // A divide-by-zero somewhere in the workings, shown to the student.
      if (/NaN|Infinity|undefined|null/.test(o.latex)) {
        fail(t.id, 'a distractor contains a non-finite value', o.latex);
      }
      if (!o.why) {
        fail(t.id, 'a distractor carries no `why`', o.latex);
      } else if (!MISCONCEPTIONS[o.why]) {
        fail(t.id, `unknown misconception key "${o.why}"`, o.latex);
      } else {
        seenWhy.add(o.why);
        const m = MISCONCEPTIONS[o.why];
        if (!m.label || !m.hint) fail(t.id, `misconception "${o.why}" is missing label or hint`);
        if (/\\|\$/.test(m.label + m.hint)) {
          fail(t.id, `misconception "${o.why}" contains LaTeX; both fields must be plain text`);
        }
      }
      // The odd one out must not be spottable from its form alone.
      if (!t.mcqShapeVaries && shapeOf(o.latex) !== shapeOf(q.answer)) {
        fail(t.id, 'an option has a different shape from the answer',
          `answer: ${q.answer}  ->  ${shapeOf(q.answer)}\n        option: ${o.latex}  ->  ${shapeOf(o.latex)}`);
      }
    }
  }

  if (t.distractors) {
    const rate = mcqNull / (mcqOk + mcqNull);
    stats.push({ id: t.id, rate, sampled });
    // A high fallback rate means the distractors collide with the answer too
    // often, so the student keeps getting bumped back to self-marking.
    if (rate > 0.05) {
      fail(t.id, `falls back to self-mark ${(rate * 100).toFixed(1)}% of the time`);
      console.log(diagnoseFallback(t));
    }
  } else {
    stats.push({ id: t.id, rate: 1, sampled: null });
  }
}

/**
 * Find a generation that fell back and say which candidate died and why.
 * Guessing at this from the fallback percentage alone is slow, and Phases 3-4
 * add another 33 templates to author.
 */
function diagnoseFallback(t) {
  for (let i = 0; i < 4000; i++) {
    const { w, ...q } = t.generate();
    if (buildChoices(q.answer, t.distractors, w)) continue;

    let candidates;
    try { candidates = t.distractors(w) || []; } catch (e) { return `        threw: ${e.message}`; }
    const lines = [`        answer: ${q.answer}`];
    const seen = new Set([normalLatex(q.answer)]);
    for (const c of candidates) {
      if (!c || !c.latex) { lines.push('         (skipped: candidate returned null)'); continue; }
      const norm = normalLatex(c.latex);
      let verdict = 'kept';
      if (equivalentAnswers(c.latex, q.answer, t.mcqOrdered)) verdict = 'IS THE ANSWER';
      else if (seen.has(norm)) verdict = 'duplicate of an earlier option';
      else seen.add(norm);
      lines.push(`         ${verdict === 'kept' ? ' ' : 'x'} ${c.latex}   [${c.why}] ${verdict === 'kept' ? '' : '<- ' + verdict}`);
    }
    lines.push(`        only ${seen.size - 1} of ${candidates.length} candidates survived; need 3`);
    return lines.join('\n');
  }
  return '        (could not reproduce a fallback)';
}

// --- coverage -----------------------------------------------------------------
if (!filter) {
  const unreachable = Object.keys(MISCONCEPTIONS).filter((k) => !seenWhy.has(k));
  if (unreachable.length) {
    fail('MISCONCEPTIONS', `${unreachable.length} entries no distractor ever emits`,
      unreachable.join(', '));
  }
}

const withMcq = stats.filter((s) => s.rate < 1).length;
console.log(`\n${withMcq}/${stats.length} templates offer multiple choice (${RUNS} runs each)`);
const noMcq = stats.filter((s) => s.rate === 1).map((s) => s.id);
if (noMcq.length) console.log(`self-mark only: ${noMcq.join(', ')}`);
const flaky = stats.filter((s) => s.rate > 0 && s.rate < 1);
if (flaky.length) {
  console.log('fallback rate: ' + flaky.map((s) => `${s.id} ${(s.rate * 100).toFixed(1)}%`).join(' · '));
}

if (args.includes('--sample')) {
  for (const s of stats) {
    if (!s.sampled) continue;
    console.log(`\n${s.id}\n  Q: ${s.sampled.q.question}`);
    for (const o of s.sampled.choices.options) {
      console.log(`   ${o.why === null ? '*' : ' '} ${o.latex}${o.why ? `   [${o.why}]` : ''}`);
    }
  }
}

console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL PASS');
process.exit(failures ? 1 : 0);
