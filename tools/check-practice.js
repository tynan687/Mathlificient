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
const seedIdx = args.indexOf('--seed');
const SEED = seedIdx >= 0 ? args[seedIdx + 1] : '1';
// Both flag VALUES have to be excluded, or `--seed 7` leaves "7" looking like a
// template filter and the run silently checks nothing.
const flagValues = new Set([String(RUNS), SEED]);
const filter = args.find((a) => !a.startsWith('--') && !flagValues.has(a));

/**
 * Seed the generators.
 *
 * The fallback-rate gate is a threshold on a sampled percentage, so unseeded it
 * fails at random: `indices` averages ~2.9% over 500 runs but its tail crosses
 * the 5% bar often enough to have been seen doing it. A gate that goes red for
 * no reason is worse than no gate, because the next real failure gets shrugged
 * off as "that one again".
 *
 * So the default run is deterministic and the seed is printed with the result —
 * a failure can be reproduced exactly with `--seed N`. `--seed random` restores
 * the old exploratory behaviour, for deliberately hunting rare draws.
 */
const usedSeed = SEED === 'random' ? String(Date.now() % 2147483647) : SEED;
{
  let s = 0;
  for (const ch of usedSeed) s = (Math.imul(s, 31) + ch.charCodeAt(0)) >>> 0;
  s = (s || 1) >>> 0;
  Math.random = () => {                       // mulberry32
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Above this share of self-mark fallbacks, the distractors are too collidey. */
const FALLBACK_MAX = 0.05;

/**
 * The low end of a 99% Wilson interval for `k` fallbacks out of `n` draws.
 *
 * Wilson rather than the textbook normal approximation because the rates here
 * are a few percent on a few hundred draws, which is exactly where the normal
 * one misbehaves (it happily returns a negative lower bound). Returns 0 for
 * n = 0, so a template that never generated cannot fail this way.
 */
function wilsonLower(k, n) {
  if (!n) return 0;
  const z = 2.576;
  const p = k / n;
  const z2 = z * z;
  const centre = p + z2 / (2 * n);
  const spread = z * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n);
  return Math.max(0, (centre - spread) / (1 + z2 / n));
}

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

/**
 * Two operators in a row: "10 + -14", "A(3 - -4)", "4A - -3C", "16 + 8i + -4i".
 *
 * Nothing these lines assert is false, so `badArithmetic` passes them and so does
 * every artifact rule — "+ -14" is a legitimate way to write "- 14". It is simply
 * not how anyone writes maths, and it lands on the line the student copies down.
 * Six templates had it and each was found separately, by eye, which is the wrong
 * way to find the sixth instance of anything.
 *
 * The fix is always the same: let a helper carry the sign (`PR.s`, `PR.xt`) or
 * bracket the operand (`PR.par`).
 */
const DOUBLED_SIGN = /[+\-]\s+[+\-]\s*\d/;

/**
 * Does a step's arithmetic actually hold?
 *
 * Nothing here evaluated a step before, only pattern-matched it — so
 * "53 - 3 = 12" was invisible, and six templates shipped worked steps that were
 * arithmetically false. `PR.par` brackets only negatives, so `${a}${PR.par(d)}`
 * fused "1" and "4" into "14" whenever d was positive, and the student following
 * the method got a different number from the answer the app stated.
 *
 * Deliberately narrow. It judges only the sides of a chain that are purely
 * numeric, and ignores the rest — most real steps are labelled ("\det A = …"),
 * so demanding that every side be readable threw away the very cases this exists
 * to catch. Two or more numeric sides that disagree is a false claim; fewer than
 * two is nothing to compare and gets skipped. A check that guessed at the
 * symbolic parts would be worse than one that admits what it cannot parse.
 *
 * The load-bearing part is inserting the implicit `*`: it is what turns "1(4)"
 * into a claim worth checking, and what leaves "14 - 2(-3) = 10" failing.
 *
 * Returns a description of the disagreement, or null.
 */
function badArithmetic(step) {
  const cleaned = String(step)
    .replace(/\\(?:cdot|times)/g, '*')
    .replace(/\\(?:left|right|,|;|!|quad|qquad)/g, ' ')
    .replace(/\s+/g, ' ');
  // Anything asserting a relation other than equality is not a claim about equal
  // numbers, so there is nothing here to contradict.
  if (/[<>≤≥≠]|\\(?:approx|neq|leq|geq|Rightarrow|to)/.test(cleaned)) return null;

  // A step often carries several independent claims on one line — coord-distance
  // shows Δx and Δy together — so split on commas BEFORE splitting on `=`, or
  // Δx's result gets compared against Δy's expression and every one of them
  // "fails". Only commas at bracket depth 0 separate claims: the one inside a
  // coordinate pair like "(-4, 8)" does not.
  const claims = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (ch === '(' || ch === '{' || ch === '[') depth++;
    else if (ch === ')' || ch === '}' || ch === ']') depth--;
    else if (ch === ',' && depth === 0) { claims.push(cleaned.slice(start, i)); start = i + 1; }
  }
  claims.push(cleaned.slice(start));

  for (const claim of claims) {
    const found = falseChain(claim);
    if (found) return found;
  }
  return null;
}

/** One claim: are the numeric sides of this equality chain in agreement? */
function falseChain(claim) {
  const sides = claim.split('=').map((s) => s.trim()).filter(Boolean);
  if (sides.length < 2) return null;

  const numeric = [];
  for (const side of sides) {
    const expr = side
      // Exponents, braced or bare. This has to happen here rather than be left to
      // the whitelist below: with `^` absent from it, every side carrying a power
      // was written off as symbolic, and that hid the worst instance of the very
      // bug this function was added for — quad-formula's discriminant line, false
      // in 100% of generations, skipped in 100% of runs.
      .replace(/\^\s*\{([^{}]*)\}/g, '**($1)')
      .replace(/\^/g, '**')
      // Implicit multiplication, both ways round: "3(4)", "(4)3", "(2)(3)".
      .replace(/(\d)\s*\(/g, '$1*(')
      .replace(/\)\s*(\d)/g, ')*$1')
      .replace(/\)\s*\(/g, ')*(');
    if (!/^[-+*/(). 0-9]+$/.test(expr) || !/\d/.test(expr)) continue; // symbolic — ignore
    let v;
    try {
      // eslint-disable-next-line no-new-func
      v = Function(`"use strict"; return (${expr});`)();
    } catch { continue; }
    if (typeof v === 'number' && isFinite(v)) numeric.push({ side, v });
  }
  if (numeric.length < 2) return null;
  const off = numeric.find((n) => Math.abs(n.v - numeric[0].v) > 1e-9);
  if (!off) return null;
  return `"${numeric[0].side}" is ${numeric[0].v}, but "${off.side}" is ${off.v}`;
}

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

  // badArithmetic is the newest and least obvious of these, and it is the one
  // that has to catch a class nothing caught before. Prove it both ways: that it
  // fires on the real bug, and that it stays quiet on every legitimate step shape
  // in the file — a false positive here would block authoring for no reason.
  const arith = (step, shouldFail, label) => {
    const got = badArithmetic(step);
    if (!!got !== shouldFail) {
      fail('check-practice', `badArithmetic ${shouldFail ? 'missed' : 'false-flagged'}: ${label}`,
        `${step}${got ? `\n        -> ${got}` : ''}`);
    }
  };
  // The actual bug, in the shape each of the six sites produced it.
  arith('\\det A = 14 - 2(-3) = 10', true, 'fused product in a determinant');
  arith('\\det A = 53 - (-3)(-1) = 12', true, 'fused product, both operands');
  arith('3k - 43 = 0', false, 'symbolic, cannot be judged');   // has k — skipped, not flagged
  arith('2 + 2 = 5', true, 'plain false arithmetic');
  // Correct working, in every shape the file legitimately uses.
  arith('\\det A = 1(4) - 2(-3) = 10', false, 'bracketed product is right');
  arith('24 - 0 = 24', false, 'a zero term in a definite integral');
  arith('5(5) + 0(-2) = 25', false, 'dot product with a zero component');
  arith('-6(2) + 3(4) = 0', false, 'signs and brackets together');
  arith('x = 6', false, 'has a variable');
  arith('y = \\frac{-9}{-3} = 3', false, 'contains a frac — skipped');
  arith('|\\vec a| = 5.831', false, 'single value, no chain');
  arith('\\theta \\approx 47.73^\\circ', false, 'approximate, not an equality claim');
  arith('3x + 2y = 12', false, 'an equation about unknowns, not a computation');
  arith('2 \\cdot 3 = 6', false, 'explicit cdot');
  // Several claims on one line: each is its own chain, and comparing across them
  // flagged all 500 coord-distance generations as false when none were.
  arith('\\Delta x = 24 - 12 = 12, \\quad \\Delta y = -20 - (-4) = -16', false,
    'two independent claims in one step');
  arith('\\Delta x = 24 - 12 = 99, \\quad \\Delta y = -20 - (-4) = -16', true,
    '...and a false one among them is still caught');
  arith('M = (-4, 8)', false, 'a comma inside brackets is not a claim separator');
  // Powers. Absent from the numeric whitelist, `^` made every side carrying one
  // look symbolic, so the chain was skipped — which is how quad-formula's
  // discriminant stayed hidden while being false in 100% of generations.
  arith('\\Delta = b^2 - 4ac = 7^2 - 426 = 1', true, 'fused product beside a power');
  arith('\\Delta = b^2 - 4ac = 7^2 - 4(2)(6) = 1', false, '...and the bracketed form is right');
  arith('\\Delta = 5^{2} - 4(1)(6) = 1', false, 'braced exponent');
  arith('16 = 4^2', false, 'a power alone, agreeing');
  arith('15 = 4^2', true, 'a power alone, disagreeing');
  arith('2^{-1} = 0.5', false, 'negative braced exponent');
  arith('\\theta = 30^\\circ', false, 'degrees are not an exponent to evaluate');

  // Two signs in a row. Six templates shipped this and every one was found by
  // eye, separately — so the rule has to be proven on the shapes they produced.
  const dbl = (s, expect, label) => {
    if (DOUBLED_SIGN.test(s) !== expect) {
      fail('check-practice', `DOUBLED_SIGN ${expect ? 'missed' : 'false-flagged'}: ${label}`, s);
    }
  };
  dbl('\\tfrac{8}{2}(10 + -14)', true, 'seq-arith, negative common difference');
  dbl('A(3 - -4) \\Rightarrow A = 5', true, 'partial-distinct cover-up, negative root');
  dbl('4A - -3C = 6', true, 'partial-quadratic constants');
  dbl('= 16 + 8i + -4i + -2i^2', true, 'complex-product expansion');
  dbl('\\frac{dy}{dx} = -2(-3x - 2) + -3(-2x - 6)', true, 'product rule');
  // ...and quiet on every legitimate shape, or it blocks authoring for no reason.
  dbl('\\tfrac{8}{2}(10 - 14)', false, 'the same line, fixed');
  dbl('A(3 - (-4))', false, 'bracketed negative is the fix, not the bug');
  dbl('x^2 - 6x + 9', false, 'ordinary signed polynomial');
  dbl('\\frac{-9}{-3} = 3', false, 'negatives in a fraction');
  dbl('2^{-1} = 0.5', false, 'negative exponent');
  dbl('\\Delta = 5^2 - 4(2)(-7) = 81', false, 'a bracketed negative operand');
  dbl('(-4, 8) \\text{ and } (-2, -6)', false, 'coordinate pairs');
  dbl('y = -2x + -0', true, 'a doubled sign before 0 is still one');
}

// --- source-level: PR.par where a product was meant -------------------------
// badArithmetic judges rendered output, which means it can only ever see a step
// whose sides are numeric. Two of the three fused-product variants found so far
// were invisible to it — quad-formula's hid behind a `^` for the life of the
// template, and rational-complex's sides carry \frac and x, so nothing numeric
// will ever reach it.
//
// These two patterns are the ones that can be judged from the source with no
// ambiguity at all. PR.par emits bare digits for anything non-negative, so:
//
//   `4${PR.par(a)}`              4 and a fuse whenever a >= 0
//   `${PR.par(b)}${PR.par(c)}`   b and c fuse whenever c >= 0
//
// Neither has a legitimate reading. PR.par's two real jobs both leave a
// character behind it: an exponent base is followed by `^`, and a bracketed
// first operand is followed by `\cdot`, a literal `(`, or a sign-carrying
// helper. Every one of the 22 uses in the file satisfies that.
//
// Deliberately not checked here: `${p}${q}x`, rational-complex's shape. Whether
// two adjacent interpolations are a product or a coefficient-and-variable needs
// to know what the values mean, and a rule that guesses would fire on
// `x^2${nBx}` and the pluralising ternaries. HANDOVER §4 carries the grep.
{
  const src = require('fs').readFileSync(path.join(R, 'practice-data.js'), 'utf8');
  const RULES = [
    [/[0-9]\$\{PR\.par\(/g, 'a digit immediately followed by PR.par — the two numbers fuse'],
    [/\}\$\{PR\.par\(/g, 'PR.par immediately after another interpolation — the two numbers fuse'],
  ];
  for (const [re, why] of RULES) {
    for (const m of src.matchAll(re)) {
      const line = src.slice(0, m.index).split('\n').length;
      // The explanatory comments beside PR.brk quote both shapes on purpose.
      if (/^\s*\/\//.test(src.split('\n')[line - 1])) continue;
      fail('practice-data', `${why} (use PR.brk for a product)`,
        `practice-data.js:${line}  ${src.split('\n')[line - 1].trim().slice(0, 120)}`);
    }
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
      if (DOUBLED_SIGN.test(text)) fail(t.id, `step ${i + 1} prints two signs in a row`, text);
      const wrong = badArithmetic(text);
      if (wrong) fail(t.id, `step ${i + 1} states arithmetic that is false`, `${text}\n        ${wrong}`);
    }
    for (const [field, text] of [['question', q.question], ['answer', q.answer]]) {
      if (UNBRACKETED_POWER.test(text)) {
        fail(t.id, `${field} raises a negative to a power without brackets`, text);
      }
      if (DOUBLED_SIGN.test(text)) fail(t.id, `${field} prints two signs in a row`, text);
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
    }

    // The answer must not be identifiable by its FORM alone.
    //
    // The rule is specifically that the answer shares its shape with at least
    // one distractor — not that all four match. Four options in three different
    // shapes give nothing away, because no single one stands out; what is fatal
    // is three options looking alike and the answer being the fourth.
    if (!t.mcqShapeVaries) {
      const shapes = choices.options.map((o) => shapeOf(o.latex));
      const answerShape = shapes[choices.answerIndex];
      if (shapes.filter((s) => s === answerShape).length === 1) {
        fail(t.id, 'the answer is the only option of its form — pickable without any maths',
          choices.options.map((o, i) =>
            `${i === choices.answerIndex ? '*' : ' '} ${o.latex}  ->  ${shapes[i]}`).join('\n        '));
      }
    }
  }

  if (t.distractors) {
    const n = mcqOk + mcqNull;
    const rate = mcqNull / n;
    stats.push({ id: t.id, rate, sampled });
    // A high fallback rate means the distractors collide with the answer too
    // often, so the student keeps getting bumped back to self-marking.
    //
    // Judged on the lower end of the interval, not on the rate itself. `rate` is
    // a sample, and at 500 runs a true 3% lands anywhere from 1.6% to 5.4% —
    // measured, across twenty seeds. Comparing the point estimate to the bar
    // therefore failed `indices` about one seed in twenty with nothing wrong,
    // and a gate that cries wolf is how the next real failure gets waved through.
    // Fail only when the evidence says the TRUE rate is above the bar.
    if (wilsonLower(mcqNull, n) > FALLBACK_MAX) {
      fail(t.id, `falls back to self-mark ${(rate * 100).toFixed(1)}% of the time`
        + ` (${mcqNull}/${n}, at least ${(wilsonLower(mcqNull, n) * 100).toFixed(1)}%)`);
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
console.log(`\n${withMcq}/${stats.length} templates offer multiple choice `
  + `(${RUNS} runs each, seed ${usedSeed})`);
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
