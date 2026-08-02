#!/usr/bin/env node
/**
 * Hammer markAnswer against every template's REAL answer strings.
 *
 * This is the piece the voice tutor's verdict rests on, and it is the one place
 * where being wrong is worse than being unsure: telling a student they got it
 * wrong when they did not is the failure that loses their trust in the whole
 * app. So the bar here is asymmetric —
 *
 *   * the answer itself must read `right`, always;
 *   * a perturbed number must read `wrong`, nearly always;
 *   * a SWAPPED multi-value answer must read `wrong` — it is the commonest slip
 *     in the topic and the unordered comparison would wave it through;
 *   * anything unparseable must read `unsure`, never `wrong`.
 *
 * A high `unsure` rate is a cost problem (each one escalates to the model). A
 * single false `wrong` is a correctness problem. They are reported separately.
 *
 *   node tools/check-marking.js
 *   node tools/check-marking.js --runs 200
 */
const path = require('path');

const R = path.resolve(__dirname, '..', 'VoiceMathTutorPC', 'renderer');
const skills = require(path.join(R, 'practice-skills.js'));
Object.assign(globalThis, skills);
const { PRACTICE } = require(path.join(R, 'practice-data.js'));
const { markAnswer, numbersInOrder } = require(path.join(R, 'practice-mcq.js'));

const args = process.argv.slice(2);
const idx = args.indexOf('--runs');
const RUNS = idx >= 0 && Number.isFinite(Number(args[idx + 1])) ? Number(args[idx + 1]) : 60;

let failures = 0;
const seen = new Set();
const fail = (msg, detail) => {
  const key = `${msg}|${detail || ''}`;
  if (seen.has(key)) return;
  seen.add(key);
  failures++;
  console.log(`  FAIL  ${msg}${detail ? `\n        ${detail}` : ''}`);
};

// ---- hand-written cases, the ones a real session produces ---------------------------
const SPOKEN = [
  // [heard, answer, expected]
  ['x = 2', 'x = 2', 'right'],
  ['x=2', 'x = 2', 'right'],
  ['x = 3', 'x = 2', 'wrong'],
  ['2', 'x = 2', 'right'],                        // just the value, said aloud
  ['x = 2, y = 3', 'x = 2, \\ y = 3', 'right'],
  ['x = 3, y = 2', 'x = 2, \\ y = 3', 'wrong'],   // THE swap — must not pass
  ['x = -3', 'x = -3', 'right'],
  ['x = 3', 'x = -3', 'wrong'],
  ['x^{3}', 'x^3', 'right'],                      // brace normalisation
  ['\\tfrac{1}{2}', '\\frac{1}{2}', 'right'],
  ['0.5', '\\frac{1}{2}', 'unsure'],              // 1 number vs 2 — cannot tell, must not say wrong
  ['', 'x = 2', 'unsure'],
  ['no idea', 'x = 2', 'unsure'],
  ['x = 2', '', 'unsure'],
  ['x = 5, \\ x = -3', 'x = -3, \\ x = 5', 'wrong'], // roots reordered: strict here by design

  // Spoken transcripts — the case this whole feature exists for. Without the
  // spoken-number pass every one of these returns `unsure` and costs a call.
  ['x equals two', 'x = 2', 'right'],
  ['I got x equals two', 'x = 2', 'right'],
  ['x equals three', 'x = 2', 'wrong'],
  ['minus three', 'x = -3', 'right'],
  ['negative three', 'x = -3', 'right'],
  ['x equals twenty three', 'x = 23', 'right'],
  ['x equals twenty three', 'x = 24', 'wrong'],
  ['x is two and y is three', 'x = 2, \\ y = 3', 'right'],
  ['x is three and y is two', 'x = 2, \\ y = 3', 'wrong'],   // the swap, spoken
  ['x equals one hundred', 'x = 100', 'right'],
  ['three point five', 'x = 3.5', 'right'],
  ['x equals seven', 'x = -7', 'wrong'],
  ['erm, can I have a hint', 'x = 2', 'unsure'],
];

for (const [heard, answer, expect] of SPOKEN) {
  const got = markAnswer(heard, answer).verdict;
  if (got !== expect) {
    fail(`"${heard}" vs "${answer}" read ${got}, expected ${expect}`);
  }
}

// ---- every template's real answers ---------------------------------------------------
let total = 0;
let unsureSelf = 0;
let falseWrong = 0;
let missedWrong = 0;
const unsureBy = {};

for (const t of PRACTICE) {
  for (let i = 0; i < RUNS; i++) {
    const { w, ...q } = t.generate();
    const answer = q.answer;
    total++;

    // 1. The answer itself must never read `wrong`.
    const self = markAnswer(answer, answer);
    if (self.verdict === 'wrong') {
      fail(`${t.id}: its own answer reads WRONG`, `${answer} :: ${self.why}`);
    } else if (self.verdict === 'unsure') {
      unsureSelf++;
      unsureBy[t.id] = (unsureBy[t.id] || 0) + 1;
    }

    // 2. A perturbed value must not read `right`.
    const nums = numbersInOrder(answer);
    if (nums.length) {
      // Nudge the first number by 1 — the cheapest wrong answer there is.
      const bumped = answer.replace(String(nums[0]), String(nums[0] + 1));
      if (bumped !== answer) {
        const v = markAnswer(bumped, answer).verdict;
        if (v === 'right') {
          falseWrong++;
          fail(`${t.id}: a changed value still reads RIGHT`, `${answer}  ->  ${bumped}`);
        } else if (v === 'unsure') {
          missedWrong++;
        }
      }
    }

    // 3. Gibberish must read `unsure`, never `wrong`.
    const junk = markAnswer('erm, I think I need a hint', answer);
    if (junk.verdict !== 'unsure') {
      fail(`${t.id}: gibberish read ${junk.verdict}`, answer);
    }
  }
}

const pct = (n) => `${((n / total) * 100).toFixed(1)}%`;
console.log(`\n${total} answers from ${PRACTICE.length} templates`);
console.log(`  own answer unsure : ${unsureSelf} (${pct(unsureSelf)})  <- these escalate to the model`);
console.log(`  changed value not caught: ${missedWrong} (${pct(missedWrong)})  <- read unsure, not wrong`);
console.log(`  changed value read RIGHT: ${falseWrong}  <- must be 0`);
const worst = Object.entries(unsureBy).sort((a, b) => b[1] - a[1]).slice(0, 6);
if (worst.length) {
  console.log(`  templates escalating most: ${worst.map(([id, n]) => `${id} ${n}`).join(' · ')}`);
}

console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL PASS');
process.exit(failures ? 1 : 0);
