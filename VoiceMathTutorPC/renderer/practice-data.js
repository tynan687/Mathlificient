// Offline practice-question generators — shared by the PC and Android apps.
// Each template generates a fresh question with real step-by-step working and an
// answer, all as LaTeX. Zero network, zero cost.

const PR = {
  int: (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1)),
  nz(lo, hi) { let v = 0; while (v === 0) v = this.int(lo, hi); return v; },
  choice: (arr) => arr[Math.floor(Math.random() * arr.length)],
  r: (x, dp = 4) => parseFloat(Number(x).toFixed(dp)),
  s: (n) => (n < 0 ? `- ${Math.abs(n)}` : `+ ${n}`), // signed term
  par: (n) => (n < 0 ? `(${n})` : `${n}`),
  // A signed variable term for a polynomial chain: "0x" vanishes, "1x" loses the 1.
  // Leading space included so `x^2${PR.xt(b)} ${PR.s(c)}` spaces correctly.
  xt(n, v = 'x') {
    if (n === 0) return '';
    return ` ${n < 0 ? '-' : '+'} ${Math.abs(n) === 1 ? '' : Math.abs(n)}${v}`;
  },
  // An unsigned leading coefficient: "1x" -> "x", "-1x" -> "-x".
  lead: (n, v = 'x') => (n === 1 ? v : n === -1 ? `-${v}` : `${n}${v}`),
  // A signed constant that vanishes when zero (so no "+ 0" tails).
  ct: (n) => (n === 0 ? '' : ` ${n < 0 ? `- ${Math.abs(n)}` : `+ ${n}`}`),
};

/**
 * The named slips behind every multiple-choice distractor.
 *
 * A wrong option is only worth offering if it is the answer a real student would
 * reach by making a specific, nameable mistake — otherwise it is noise the
 * student eliminates on sight, and the question stops measuring anything.
 * Declaring the slip here rather than inline means the same key powers two
 * things: the sentence shown the moment they pick it, and the "you keep …" line
 * on the progress screen once they've done it more than once.
 *
 * Both fields are PLAIN TEXT, never LaTeX — `label` is spliced into a sentence
 * that the progress screen renders with textContent, so markup would show up
 * verbatim. Unicode maths (², √, −, ÷) is fine and reads better than \frac.
 *
 * `label` completes "you keep …"; `hint` is a whole sentence.
 */
const MISCONCEPTIONS = {
  // Quadratics
  'disc-sign': { label: 'using b² + 4ac', hint: 'That is b² + 4ac. The discriminant is b² − 4ac.' },
  'disc-no-a': { label: 'leaving a out of the discriminant', hint: 'It is b² − 4ac. The a belongs in there too.' },
  'formula-b-sign': { label: 'forgetting to negate b', hint: 'The formula starts −b, not +b.' },
  'formula-2a': { label: 'dividing by a instead of 2a', hint: 'The whole numerator sits over 2a, not a.' },
  'root-sign': { label: 'not flipping the sign of the roots', hint: '(x + 3) = 0 gives x = −3, not x = 3. The root is the opposite sign to the number in the bracket.' },
  'root-one-sign': { label: 'flipping only one root', hint: 'Both brackets flip sign, not just one.' },
  'root-is-coeff': { label: 'reading the roots off the coefficients', hint: 'The sum and product of the roots are not the roots themselves.' },
  'cs-h-sign': { label: 'not halving b with its sign', hint: 'Inside the bracket you need half of b, keeping its sign.' },
  'cs-k-sign': { label: 'adding h² instead of subtracting it', hint: 'Completing the square adds h² inside, so it must come back off outside.' },
  'cs-no-halve': { label: 'using b instead of half of b', hint: 'The bracket holds half of b, not b.' },

  // Algebra
  'move-sign': { label: 'moving a term across without changing its sign', hint: 'A term changes sign when it crosses the equals.' },
  'divide-early': { label: 'dividing before collecting like terms', hint: 'Collect the x terms on one side first, then divide once.' },
  'no-divide': { label: 'stopping before the last division', hint: 'You had ax = something — there is still a divide by a to go.' },
  'ignore-constant': { label: 'dividing before moving the constant', hint: 'The constant has to come across first, then you divide what is left.' },
  'cross-term': { label: 'forgetting the cross term', hint: 'Expanding two brackets gives four products — the two middle ones add together.' },
  'cross-term-sign': { label: 'getting the middle term the wrong way round', hint: 'The two cross products keep the signs of the numbers they came from, and then add.' },
  'sign-last': { label: 'getting the sign of the last term wrong', hint: 'The constant is the product of the two second terms, signs included.' },
  'cancel-wrong': { label: 'cancelling the factor that survives', hint: 'The factor that appears on both top and bottom is the one that cancels.' },
  'index-add-all': { label: 'adding every index', hint: 'Dividing subtracts an index; only multiplication adds them.' },
  'index-multiply': { label: 'multiplying indices when they should be added', hint: 'Multiplying powers of the same base adds the indices.' },
  'index-forget-divide': { label: 'ignoring the division', hint: 'The division still takes its index off the total.' },
  'log-multiply': { label: 'multiplying the logs', hint: 'log(MN) is log M + log N, not log M × log N.' },
  'log-subtract': { label: 'subtracting when the law adds', hint: 'A product inside a log adds the logs; a quotient subtracts them.' },
  'exp-off-by-one': { label: 'landing one power out', hint: 'Count the powers again — it is off by one.' },
  'exp-divide': { label: 'dividing instead of taking a log', hint: 'To undo an exponent you take a log, not divide by the base.' },
  'exp-read-off': { label: 'reading the answer straight off the right-hand side', hint: 'x is the power you raise the base to, not the number itself.' },

  // Rational expressions and partial fractions
  'add-denominators': { label: 'adding the denominators', hint: 'Adding fractions keeps the common denominator — you never add the bottoms.' },
  'no-cross-multiply': { label: 'not cross-multiplying the numerators', hint: 'Each numerator has to be multiplied by the other denominator first.' },
  'factors-added': { label: 'adding the factor constants instead of multiplying', hint: 'Multiplying brackets multiplies through — it does not add the constants.' },
  'exclusion-wrong': { label: 'excluding the wrong values', hint: 'The excluded values are the ones that made the ORIGINAL denominator zero, including the one that cancelled.' },
  'reciprocal-not-flipped': { label: 'not flipping the divisor', hint: 'Dividing by a fraction multiplies by its reciprocal — the divisor turns upside down.' },
  'pf-swapped': { label: 'swapping the two numerators', hint: 'Check which numerator belongs over which factor by substituting a root back in.' },
  'pf-root-sign': { label: 'not negating the root in the denominator', hint: 'A root at x = 3 gives a factor (x − 3).' },

  // Trigonometry
  'cos-rule-sign': { label: 'adding the 2ab cos C term', hint: 'The cosine rule subtracts 2ab cos C.' },
  'cos-rule-pythag': { label: 'falling back on Pythagoras', hint: 'Pythagoras only works when the angle is 90°. Here it is not.' },
  'no-sqrt': { label: 'forgetting the square root', hint: 'That is c², not c.' },
  'ref-angle-only': { label: 'giving only the reference angle', hint: 'Sine is positive in two quadrants, so there is a second solution in the given range.' },
  'quadrant-wrong': { label: 'picking the wrong second quadrant', hint: 'For sine the second solution is 180° − the reference angle.' },
  'exact-value-swap': { label: 'mixing up the exact values', hint: 'Check the exact-value triangle again — that is a different angle.' },

  // Calculus
  'chain-no-inner': { label: 'forgetting to multiply by the inner derivative', hint: 'The chain rule multiplies by the derivative of what is inside the bracket.' },
  'power-not-dropped': { label: 'not dropping the power by one', hint: 'Differentiating takes the power down by one.' },
  'power-not-multiplied': { label: 'not multiplying by the old power', hint: 'The old power comes down as a coefficient.' },
  'chain-inner-twice': { label: 'applying the inner derivative twice', hint: 'The inner derivative is multiplied in once, not squared.' },
  'int-divide-n': { label: 'dividing by n instead of n + 1', hint: 'Integrating raises the power to n + 1 and divides by the same n + 1.' },
  'int-power-down': { label: 'lowering the power instead of raising it', hint: 'Integrating raises the power; differentiating lowers it.' },
  'limits-swapped': { label: 'subtracting the limits the wrong way round', hint: 'It is F(top) − F(bottom).' },
  'upper-only': { label: 'only substituting the upper limit', hint: 'Both limits go in, and the lower one is subtracted.' },

  // Complex numbers, vectors, sequences, statistics
  'complex-real-sign': { label: 'adding bd instead of subtracting it', hint: 'i² = −1, so the bd term comes off the real part.' },
  'complex-swap': { label: 'swapping the real and imaginary parts', hint: 'The real part has no i attached to it.' },
  'arg-inverted': { label: 'taking the angle as arctan(a/b)', hint: 'The argument is arctan(imaginary ÷ real), that way round.' },
  'mod-sum': { label: 'adding the parts instead of using Pythagoras', hint: 'The modulus is √(a² + b²), not a + b.' },
  'demoivre-multiply-r': { label: 'multiplying the modulus by n', hint: 'De Moivre raises the modulus to the power n and multiplies the angle by n.' },
  'demoivre-add-angle': { label: 'adding n to the angle', hint: 'The angle is multiplied by n, not added to.' },
  'dot-magnitudes': { label: 'multiplying the magnitudes', hint: 'The dot product multiplies matching components and adds them.' },
  'angle-no-arccos': { label: 'stopping at cos θ', hint: 'That is cos θ. Take the inverse cosine to get the angle.' },
  'nth-off-by-one': { label: 'using n instead of n − 1', hint: 'The nth term adds the difference n − 1 times, not n.' },
  'sum-wrong-n': { label: 'summing one term too many', hint: 'Count the terms again — the sum runs to n, not n + 1.' },
  'geo-no-divide': { label: 'leaving off the ÷ (r − 1)', hint: 'The geometric sum divides by r − 1.' },
  'sd-population': { label: 'dividing by n instead of n − 1', hint: 'For a sample standard deviation you divide by n − 1, not n.' },
  'mean-is-median': { label: 'giving the median instead of the mean', hint: 'That is the middle value. The mean adds them all up and divides by how many there are.' },
  'sd-no-sqrt': { label: 'stopping at the variance', hint: 'That is the variance. The standard deviation is its square root.' },
  'binom-no-coeff': { label: 'leaving out the nCk', hint: 'There are nCk different orders that give k successes, and all of them count.' },
  'binom-swapped': { label: 'swapping the powers of p and 1 − p', hint: 'p is raised to the number of successes, 1 − p to the failures.' },
  'binom-complement': { label: 'giving the complement', hint: 'That is the chance of it NOT happening. The question asks for P(X = k) itself.' },
};

/** sin of the standard angles, for the compound-angle exercise. */
const SIN_EXACT = {
  30: '\\tfrac{1}{2}',
  45: '\\tfrac{\\sqrt{2}}{2}',
  60: '\\tfrac{\\sqrt{3}}{2}',
  90: '1',
  120: '\\tfrac{\\sqrt{3}}{2}',
  135: '\\tfrac{\\sqrt{2}}{2}',
  150: '\\tfrac{1}{2}',
};
/** The distinct values, ordered by how readily a student reaches for them. */
const SIN_EXACT_VALUES = [
  '\\tfrac{\\sqrt{3}}{2}', '\\tfrac{\\sqrt{2}}{2}', '\\tfrac{1}{2}', '1', '0',
];

const PRACTICE = [
  {
    id: 'linear-eq', skill: 'linear-equations', topic: 'Linear equations', keywords: ['linear', 'equation', 'solve'],
    generate() {
      // Non-zero: at x0 = 0 both the sign-slip and the forgot-to-divide options
      // collapse onto the answer, and "solve 3x + 5 = 5" is a dull question anyway.
      const x0 = PR.nz(-6, 8);
      const a = PR.nz(2, 7);
      const b = PR.nz(-9, 9);
      const c = a * x0 + b;
      return {
        question: `\\text{Solve } ${a}x ${PR.s(b)} = ${c}`,
        steps: [
          `${a}x = ${c} ${PR.s(-b)} = ${c - b}`,
          `x = \\frac{${c - b}}{${a}}`,
          `x = ${x0}`,
        ],
        answer: `x = ${x0}`,
        viz: { type: 'poly', coeffs: [b, a], extra: [{ coeffs: [c] }], mark: [x0, c] },
        w: { x0, a, b, c },
      };
    },
    distractors({ x0, a, b, c }) {
      return [
        { latex: `x = ${-x0}`, why: 'move-sign' },
        { latex: `x = ${c - b}`, why: 'no-divide' },
        { latex: `x = ${PR.r((c + b) / a, 2)}`, why: 'move-sign' },
        { latex: `x = ${PR.r(c / a, 2)}`, why: 'ignore-constant' },
      ];
    },
  },
  {
    id: 'linear-both-sides', skill: 'linear-equations', topic: 'Linear equations', keywords: ['linear', 'both sides'],
    generate() {
      const x0 = PR.nz(-5, 7); // non-zero, same reason as linear-eq
      const a = PR.int(3, 9);
      let c = PR.int(1, 6); if (c === a) c += 1;
      const b = PR.nz(-8, 8);
      const d = (a - c) * x0 + b;
      return {
        question: `\\text{Solve } ${PR.lead(a)} ${PR.s(b)} = ${PR.lead(c)}${PR.ct(d)}`,
        steps: [
          `${PR.lead(a)} - ${PR.lead(c)} = ${d} ${PR.s(-b)}`,
          `${PR.lead(a - c)} = ${d - b}`,
          `x = \\frac{${d - b}}{${a - c}} = ${x0}`,
        ],
        answer: `x = ${x0}`,
        viz: {
          type: 'poly', coeffs: [b, a],
          extra: [{ coeffs: [d, c] }],
          mark: [x0, a * x0 + b],
        },
        w: { x0, a, b, c, d },
      };
    },
    distractors({ x0, a, b, c, d }) {
      return [
        { latex: `x = ${-x0}`, why: 'move-sign' },
        { latex: `x = ${PR.r((d + b) / (a - c), 2)}`, why: 'move-sign' },
        { latex: `x = ${PR.r((d - b) / (a + c), 2)}`, why: 'divide-early' },
        { latex: `x = ${d - b}`, why: 'no-divide' },
      ];
    },
  },
  {
    id: 'quad-factorise', skill: 'quadratics', topic: 'Quadratics', keywords: ['quadratic', 'factorise', 'factoring', 'roots'],
    generate() {
      // Both roots non-zero and distinct, so no "(x + 0)" factor appears.
      let p, q;
      do {
        p = PR.nz(-7, 7);
        q = PR.nz(-7, 7); if (q === p) q = p + PR.choice([1, 2]);
      } while (q === 0 || q === p);
      const B = p + q; const C = p * q;
      return {
        question: `\\text{Solve by factorising: } x^2${PR.xt(B)}${PR.ct(C)} = 0`,
        steps: [
          `\\text{Find two numbers with product } ${C} \\text{ and sum } ${B}: \\ ${p} \\text{ and } ${q}`,
          `(x ${PR.s(p)})(x ${PR.s(q)}) = 0`,
          `x ${PR.s(p)} = 0 \\ \\text{or} \\ x ${PR.s(q)} = 0`,
          `x = ${-p} \\ \\text{or} \\ x = ${-q}`,
        ],
        answer: `x = ${-p}, \\ x = ${-q}`,
        viz: { type: 'poly', coeffs: [C, B, 1], roots: [-p, -q] },
        w: { p, q, B, C },
      };
    },
    distractors({ p, q, B, C }) {
      // The sign-flip is the classic here. Note that when q === -p the first of
      // these IS the answer reordered — buildChoices spots that and drops it,
      // which is why there are four candidates for three slots.
      return [
        { latex: `x = ${p}, \\ x = ${q}`, why: 'root-sign' },
        { latex: `x = ${-p}, \\ x = ${q}`, why: 'root-one-sign' },
        { latex: `x = ${p}, \\ x = ${-q}`, why: 'root-one-sign' },
        { latex: `x = ${B}, \\ x = ${C}`, why: 'root-is-coeff' },
      ];
    },
  },
  {
    id: 'quad-formula', skill: 'quadratics', topic: 'Quadratics', keywords: ['quadratic', 'formula', 'discriminant'],
    generate() {
      // a >= 2 and c non-zero, deliberately: with a = 1 the "forgot the a in
      // b^2 - 4ac" and "divided by a not 2a" slips both produce the correct
      // answer, and with c = 0 so does "b^2 + 4ac" — so a third of questions
      // would have had no honest distractors left. It also puts the emphasis
      // where the formula actually earns its keep; monic quadratics are covered
      // by quad-factorise.
      const a = PR.int(2, 3);
      const b = PR.nz(-8, 8);
      let c = PR.nz(-6, 6);
      let disc = b * b - 4 * a * c;
      if (disc <= 0) { c = -Math.abs(c) - 1; disc = b * b - 4 * a * c; }
      const r1 = PR.r((-b + Math.sqrt(disc)) / (2 * a));
      const r2 = PR.r((-b - Math.sqrt(disc)) / (2 * a));
      return {
        question: `\\text{Solve using the quadratic formula: } ${a === 1 ? '' : a}x^2${PR.xt(b)}${PR.ct(c)} = 0`,
        steps: [
          `a = ${a}, \\ b = ${b}, \\ c = ${c}`,
          `\\Delta = b^2 - 4ac = ${PR.par(b)}^2 - 4${PR.par(a)}${PR.par(c)} = ${disc}`,
          `x = \\frac{-b \\pm \\sqrt{\\Delta}}{2a} = \\frac{${-b} \\pm \\sqrt{${disc}}}{${2 * a}}`,
          `x \\approx ${r1} \\ \\text{or} \\ x \\approx ${r2}`,
        ],
        answer: `x = \\frac{${-b} \\pm \\sqrt{${disc}}}{${2 * a}} \\approx ${r1}, \\ ${r2}`,
        viz: { type: 'poly', coeffs: [c, b, a], roots: [r1, r2] },
        w: { a, b, c, disc },
      };
    },
    distractors({ a, b, c, disc }) {
      // Each option is the whole formula rebuilt with one thing wrong, so the
      // surd and the decimals stay consistent with each other — an option whose
      // decimals didn't match its own surd would be spotted without any maths.
      const form = (top, d, den, why) => {
        if (d <= 0) return null; // a negative discriminant gives the slip away
        const root = Math.sqrt(d);
        return {
          latex: `x = \\frac{${top} \\pm \\sqrt{${d}}}{${den}} \\approx `
            + `${PR.r((top + root) / den)}, \\ ${PR.r((top - root) / den)}`,
          why,
        };
      };
      return [
        form(-b, b * b + 4 * a * c, 2 * a, 'disc-sign'),
        form(b, disc, 2 * a, 'formula-b-sign'),
        form(-b, disc, a, 'formula-2a'),
        form(-b, b * b - 4 * c, 2 * a, 'disc-no-a'),
      ].filter(Boolean);
    },
  },
  {
    id: 'expand-binomial', skill: 'expand-factorise', topic: 'Expanding', keywords: ['expand', 'binomial', 'brackets', 'foil'],
    generate() {
      // The middle term must survive: PR.xt drops it at zero, and an answer of
      // "4x^2 + 3" against three distractors that all carry an x term is the odd
      // one out on sight, before any algebra.
      let a, b, c, d, A, B, C;
      do {
        a = PR.int(1, 4); b = PR.nz(-6, 6);
        c = PR.int(1, 4); d = PR.nz(-6, 6);
        A = a * c; B = a * d + b * c; C = b * d;
      } while (B === 0 || a * d === 0 || b * c === 0);
      return {
        question: `\\text{Expand } (${a === 1 ? '' : a}x ${PR.s(b)})(${c === 1 ? '' : c}x ${PR.s(d)})`,
        steps: [
          `${PR.lead(a)} \\cdot ${PR.lead(c)} = ${PR.lead(A, 'x^2')}`,
          `${PR.lead(a)} \\cdot ${PR.par(d)} + ${PR.par(b)} \\cdot ${PR.lead(c)} = ${B === 0 ? '0' : PR.lead(B)}`,
          `${PR.par(b)} \\cdot ${PR.par(d)} = ${C}`,
          `${PR.lead(A, 'x^2')}${PR.xt(B)}${PR.ct(C)}`,
        ],
        answer: `${PR.lead(A, 'x^2')}${PR.xt(B)}${PR.ct(C)}`,
        w: { a, b, c, d, A, B, C },
      };
    },
    distractors({ a, b, c, d, A, B, C }) {
      // Same three formatters as the answer. A term that lands on zero is
      // dropped by PR.xt/PR.ct, which would leave the option visibly shorter
      // than the rest — so those candidates are skipped rather than shown.
      const form = (p, q, r, why) =>
        (q === 0 || r === 0 ? null
          : { latex: `${PR.lead(p, 'x^2')}${PR.xt(q)}${PR.ct(r)}`, why });
      return [
        form(A, a * d, C, 'cross-term'),          // only one of the two middle products
        form(A, B, -C, 'sign-last'),              // signs mishandled on the last pair
        form(A, -B, C, 'cross-term-sign'),        // middle term the wrong way round
        form(A, b * c, C, 'cross-term'),          // the other single product
        form(A, a * d - b * c, C, 'cross-term-sign'), // subtracted the middle products
        form(a + c, B, b + d, 'factors-added'),   // added the brackets instead of expanding
      ].filter(Boolean);
    },
  },
  {
    id: 'complete-square', skill: 'quadratics', topic: 'Quadratics', keywords: ['completing the square', 'vertex'],
    generate() {
      const h = PR.nz(-6, 6);
      const b = 2 * h;
      // k must be non-zero for the same reason as expand-binomial: PR.ct drops a
      // zero tail, leaving "(x - 3)^2" visibly shorter than every distractor.
      let c, k;
      do { c = PR.int(-8, 8); k = c - h * h; } while (k === 0);
      return {
        question: `\\text{Complete the square: } x^2${PR.xt(b)}${PR.ct(c)}`,
        steps: [
          `\\text{Half of } ${b} \\text{ is } ${h}`,
          `x^2${PR.xt(b)} = (x ${PR.s(h)})^2 - ${h * h}`,
          `(x ${PR.s(h)})^2 - ${h * h}${PR.ct(c)} = (x ${PR.s(h)})^2${PR.ct(k)}`,
        ],
        answer: `(x ${PR.s(h)})^2${PR.ct(k)}`,
        viz: { type: 'poly', coeffs: [c, b, 1], vertex: [-h, k] },
        w: { h, b, c, k },
      };
    },
    distractors({ h, b, c, k }) {
      // PR.ct drops a zero tail, which would make an option visibly shorter than
      // the rest — so skip any whose constant vanishes.
      const form = (inner, tail, why) =>
        (tail === 0 ? null : { latex: `(x ${PR.s(inner)})^2${PR.ct(tail)}`, why });
      return [
        form(h, c + h * h, 'cs-k-sign'),
        form(-h, k, 'cs-h-sign'),
        form(b, c - b * b, 'cs-no-halve'),
        form(h, c, 'cs-k-sign'),
        form(-h, c + h * h, 'cs-h-sign'),
        form(h, -k, 'cs-k-sign'),
      ].filter(Boolean);
    },
  },
  {
    id: 'alg-fraction', skill: 'algebraic-fractions', topic: 'Algebraic fractions', keywords: ['fraction', 'simplify', 'cancel'],
    generate() {
      const p = PR.int(1, 7);
      // q must differ from both p and -p: at q = -p the numerator becomes a
      // difference of squares, the "sum" step reads oddly, and two of the
      // distractors collapse onto each other.
      let q;
      do { q = PR.nz(-7, 7); } while (q === p || q === -p);
      const B = p + q; const C = p * q;
      return {
        question: `\\text{Simplify } \\frac{x^2${PR.xt(B)}${PR.ct(C)}}{x ${PR.s(p)}}`,
        steps: [
          `\\text{Factorise the numerator: } x^2${PR.xt(B)}${PR.ct(C)} = (x ${PR.s(p)})(x ${PR.s(q)})`,
          `\\frac{(x ${PR.s(p)})(x ${PR.s(q)})}{x ${PR.s(p)}}`,
          `\\text{Cancel } (x ${PR.s(p)}): \\quad x ${PR.s(q)}, \\ x \\ne ${-p}`,
        ],
        answer: `x ${PR.s(q)}`,
        w: { p, q, B, C },
      };
    },
    distractors({ p, q, B, C }) {
      // PR.s always emits a sign, so a zero would render "x + 0" — B is p + q
      // and can land there.
      const term = (n, why) => (n === 0 ? null : { latex: `x ${PR.s(n)}`, why });
      return [
        term(p, 'cancel-wrong'),
        term(-q, 'root-sign'),
        term(B, 'cancel-wrong'),
        term(C, 'cancel-wrong'),
      ].filter(Boolean);
    },
  },
  {
    id: 'indices', skill: 'indices-surds', topic: 'Indices', keywords: ['indices', 'exponent', 'power', 'index laws'],
    generate() {
      const a = PR.int(2, 7); const b = PR.int(2, 6); const c = PR.int(1, 4);
      return {
        question: `\\text{Simplify } \\frac{x^{${a}} \\cdot x^{${b}}}{x^{${c}}}`,
        steps: [
          `x^{${a}} \\cdot x^{${b}} = x^{${a} + ${b}} = x^{${a + b}}`,
          `\\frac{x^{${a + b}}}{x^{${c}}} = x^{${a + b} - ${c}}`,
          `x^{${a + b - c}}`,
        ],
        answer: `x^{${a + b - c}}`,
        w: { a, b, c },
      };
    },
    distractors({ a, b, c }) {
      // Note x^{0} and x^{1} are avoided by construction: a >= 2 and b >= 2 put
      // a + b - c at 3 or more, so no option can render as a bare 1 or x and be
      // right for a reason other than the one it claims.
      return [
        { latex: `x^{${a + b + c}}`, why: 'index-add-all' },
        { latex: `x^{${a * b - c}}`, why: 'index-multiply' },
        { latex: `x^{${a + b}}`, why: 'index-forget-divide' },
        { latex: `x^{${a * b + c}}`, why: 'index-multiply' },
      ];
    },
  },
  {
    id: 'solve-exp', skill: 'logs-exponentials', topic: 'Exponentials & logs', keywords: ['exponential', 'solve', 'logarithm'],
    generate() {
      const a = PR.choice([2, 3, 5]);
      const k = PR.int(2, a === 5 ? 4 : 5);
      const N = Math.pow(a, k);
      return {
        question: `\\text{Solve } ${a}^x = ${N}`,
        steps: [
          `\\text{Write } ${N} \\text{ as a power of } ${a}: \\ ${N} = ${a}^{${k}}`,
          `${a}^x = ${a}^{${k}}`,
          `\\text{Equal bases} \\Rightarrow x = ${k}`,
        ],
        answer: `x = ${k}`,
        w: { a, k, N },
      };
    },
    distractors({ a, k, N }) {
      // The answer space here is tiny (k is 2 to 5), so these have to come from
      // the size of N rather than from nudging k, or they collide constantly.
      // At a = 2, k = 2 three of these land on 2 at once, hence five candidates.
      return [
        { latex: `x = ${N / a}`, why: 'exp-divide' },
        { latex: `x = ${N}`, why: 'exp-read-off' },
        { latex: `x = ${k + 1}`, why: 'exp-off-by-one' },
        { latex: `x = ${N - a}`, why: 'exp-divide' },
        { latex: `x = ${k - 1}`, why: 'exp-off-by-one' },
      ];
    },
  },
  {
    id: 'log-laws', skill: 'logs-exponentials', topic: 'Exponentials & logs', keywords: ['log', 'logarithm', 'laws'],
    generate() {
      const a = PR.choice([2, 3]);
      const m = PR.int(1, 3); const n = PR.int(1, 3);
      const M = Math.pow(a, m); const N = Math.pow(a, n);
      return {
        question: `\\text{Evaluate } \\log_{${a}} ${M} + \\log_{${a}} ${N}`,
        steps: [
          `\\log_{${a}} ${M} + \\log_{${a}} ${N} = \\log_{${a}}(${M} \\times ${N}) = \\log_{${a}} ${M * N}`,
          `${M * N} = ${a}^{${m + n}}`,
          `\\log_{${a}} ${a}^{${m + n}} = ${m + n}`,
        ],
        answer: `${m + n}`,
        w: { a, m, n, M, N },
      };
    },
    distractors({ a, m, n, M, N }) {
      // m + n only ever lands between 2 and 6, so a distractor built by nudging
      // it collides with the answer far too often. These come from the numbers
      // actually on screen, which is also what a confused student reaches for.
      return [
        { latex: `${m * n}`, why: 'log-multiply' },
        { latex: `${M + N}`, why: 'log-multiply' },
        { latex: `${Math.abs(m - n)}`, why: 'log-subtract' },
        { latex: `${M * N}`, why: 'log-multiply' },
        { latex: `${m + n + 1}`, why: 'log-subtract' },
      ];
    },
  },
  {
    id: 'complex-modarg', skill: 'complex-numbers', topic: 'Complex numbers', keywords: ['complex', 'modulus', 'argument'],
    // Position carries meaning in this answer, so a distractor can share its
    // numbers without being the same answer - see mcqOrdered in practice-mcq.js.
    mcqOrdered: true,
    generate() {
      const pairs = [[3, 4, 5], [6, 8, 10], [5, 12, 13], [8, 15, 17]];
      const [a, b, m] = PR.choice(pairs);
      const sa = PR.choice([1, -1]); const sb = PR.choice([1, -1]);
      const A = sa * a; const B = sb * b;
      const arg = PR.r(Math.atan2(B, A) * 180 / Math.PI, 2);
      return {
        question: `\\text{Find } |z| \\text{ and } \\arg z \\text{ for } z = ${A} ${PR.s(B)}i`,
        steps: [
          `|z| = \\sqrt{${PR.par(A)}^2 + ${PR.par(B)}^2} = \\sqrt{${A * A + B * B}} = ${m}`,
          `\\arg z = \\arctan\\left(\\frac{${B}}{${A}}\\right) \\ \\text{(adjust for the quadrant)}`,
          `\\arg z \\approx ${arg}^\\circ`,
        ],
        answer: `|z| = ${m}, \\ \\arg z \\approx ${arg}^\\circ`,
        viz: { type: 'argand', points: [[A, B]], circle: m },
        w: { A, B, m, arg },
      };
    },
    distractors({ A, B, m, arg }) {
      const form = (mod, ang, why) =>
        ({ latex: `|z| = ${mod}, \\ \\arg z \\approx ${PR.r(ang, 2)}^\\circ`, why });
      return [
        form(m, Math.atan2(A, B) * 180 / Math.PI, 'arg-inverted'),
        form(Math.abs(A) + Math.abs(B), arg, 'mod-sum'),
        // arctan without the quadrant adjustment: always lands in I or IV.
        form(m, Math.atan(B / A) * 180 / Math.PI, 'quadrant-wrong'),
        form(Math.abs(A) + Math.abs(B), Math.atan2(A, B) * 180 / Math.PI, 'mod-sum'),
        form(A * A + B * B, arg, 'no-sqrt'),
      ];
    },
  },
  {
    id: 'complex-product', skill: 'complex-numbers', topic: 'Complex numbers', keywords: ['complex', 'multiply', 'product'],
    generate() {
      const a = PR.nz(-4, 4); const b = PR.nz(-4, 4);
      const c = PR.nz(-4, 4); const d = PR.nz(-4, 4);
      const re = a * c - b * d; const im = a * d + b * c;
      return {
        question: `\\text{Expand } (${a} ${PR.s(b)}i)(${c} ${PR.s(d)}i)`,
        steps: [
          `${a} \\cdot ${PR.par(c)} + ${a} \\cdot ${PR.par(d)}i + ${PR.par(b)}i \\cdot ${PR.par(c)} + ${PR.par(b)}i \\cdot ${PR.par(d)}i`,
          `= ${a * c} + ${a * d}i + ${b * c}i + ${b * d}i^2`,
          `i^2 = -1: \\quad ${a * c} - ${PR.par(b * d)} + (${a * d} + ${b * c})i`,
          `= ${re} ${PR.s(im)}i`,
        ],
        answer: `${re} ${PR.s(im)}i`,
        w: { a, b, c, d, re, im },
      };
    },
    distractors({ a, b, c, d, re, im }) {
      return [
        { latex: `${a * c + b * d} ${PR.s(im)}i`, why: 'complex-real-sign' },
        { latex: `${im} ${PR.s(re)}i`, why: 'complex-swap' },
        { latex: `${re} ${PR.s(a * d - b * c)}i`, why: 'complex-real-sign' },
        { latex: `${a * c} ${PR.s(b * d)}i`, why: 'cross-term' },
        { latex: `${a * c + b * d} ${PR.s(a * d - b * c)}i`, why: 'complex-real-sign' },
      ];
    },
  },
  {
    id: 'demoivre', skill: 'complex-polar', topic: 'Complex numbers', keywords: ['de moivre', 'polar', 'power'],
    // Position carries meaning in this answer, so a distractor can share its
    // numbers without being the same answer - see mcqOrdered in practice-mcq.js.
    mcqOrdered: true,
    generate() {
      const r = PR.choice([1, 2]);
      const th = PR.choice([30, 45, 60]);
      const n = PR.choice([2, 3]);
      const rn = Math.pow(r, n); const nth = th * n;
      const rad = nth * Math.PI / 180;
      const re = PR.r(rn * Math.cos(rad), 3);
      const im = PR.r(rn * Math.sin(rad), 3);
      return {
        question: `\\text{Use De Moivre: } \\left[${r}(\\cos ${th}^\\circ + i\\sin ${th}^\\circ)\\right]^{${n}}`,
        steps: [
          `r^{${n}} = ${r}^{${n}} = ${rn}, \\quad n\\theta = ${n} \\times ${th}^\\circ = ${nth}^\\circ`,
          `${rn}(\\cos ${nth}^\\circ + i \\sin ${nth}^\\circ)`,
          `\\approx ${re} ${PR.s(im)}i`,
        ],
        answer: `${rn}(\\cos ${nth}^\\circ + i\\sin ${nth}^\\circ) \\approx ${re} ${PR.s(im)}i`,
        viz: { type: 'argand', points: [[re, im]], circle: rn },
        w: { r, th, n, rn, nth },
      };
    },
    distractors({ r, th, n }) {
      // Rebuild the whole thing from a wrong modulus or angle, so the polar form
      // and its decimal approximation always agree with each other.
      const form = (mod, ang, why) => {
        const rad = ang * Math.PI / 180;
        return {
          latex: `${mod}(\\cos ${ang}^\\circ + i\\sin ${ang}^\\circ) \\approx `
            + `${PR.r(mod * Math.cos(rad), 3)} ${PR.s(PR.r(mod * Math.sin(rad), 3))}i`,
          why,
        };
      };
      return [
        form(r * n, th * n, 'demoivre-multiply-r'),
        form(Math.pow(r, n), th + n, 'demoivre-add-angle'),
        form(r * n, th + n, 'demoivre-multiply-r'),
        form(Math.pow(r, n), th, 'demoivre-add-angle'),
        form(r, th * n, 'demoivre-multiply-r'),
      ];
    },
  },
  {
    id: 'trig-solve', skill: 'trig-equations', topic: 'Trigonometry', keywords: ['trig', 'solve', 'sin', 'equation'],
    generate() {
      const opts = [
        { k: '\\tfrac{1}{2}', kv: 0.5, ref: 30 },
        { k: '\\tfrac{\\sqrt{2}}{2}', kv: 0.7071, ref: 45 },
        { k: '\\tfrac{\\sqrt{3}}{2}', kv: 0.866, ref: 60 },
      ];
      const o = PR.choice(opts);
      return {
        question: `\\text{Solve } \\sin x = ${o.k} \\ \\text{for } 0^\\circ \\le x \\le 360^\\circ`,
        steps: [
          `\\text{Reference angle: } \\sin^{-1}(${o.k}) = ${o.ref}^\\circ`,
          `\\sin \\text{ is positive in quadrants I and II}`,
          `x = ${o.ref}^\\circ \\ \\text{or} \\ x = 180^\\circ - ${o.ref}^\\circ = ${180 - o.ref}^\\circ`,
        ],
        answer: `x = ${o.ref}^\\circ, \\ ${180 - o.ref}^\\circ`,
        viz: { type: 'sine', k: o.kv, sols: [o.ref, 180 - o.ref] },
        w: { ref: o.ref },
      };
    },
    distractors({ ref }) {
      // Every wrong pair is a real quadrant mistake: the cosine pair (360 - ref),
      // the tangent pair (180 + ref), or doubling up on the first quadrant.
      return [
        { latex: `x = ${ref}^\\circ, \\ ${180 + ref}^\\circ`, why: 'quadrant-wrong' },
        { latex: `x = ${ref}^\\circ, \\ ${360 - ref}^\\circ`, why: 'quadrant-wrong' },
        { latex: `x = ${180 - ref}^\\circ, \\ ${180 + ref}^\\circ`, why: 'ref-angle-only' },
        { latex: `x = ${90 - ref}^\\circ, \\ ${90 + ref}^\\circ`, why: 'ref-angle-only' },
      ];
    },
  },
  {
    id: 'cosine-rule', skill: 'trig-ratios', topic: 'Trigonometry', keywords: ['cosine rule', 'triangle', 'side'],
    generate() {
      const a = PR.int(4, 9); const b = PR.int(4, 9);
      const C = PR.choice([40, 55, 60, 75, 100, 120]);
      const c2 = a * a + b * b - 2 * a * b * Math.cos(C * Math.PI / 180);
      const c = PR.r(Math.sqrt(c2), 3);
      return {
        question: `\\text{Find } c: \\ a = ${a}, \\ b = ${b}, \\ C = ${C}^\\circ`,
        steps: [
          `c^2 = a^2 + b^2 - 2ab\\cos C`,
          `c^2 = ${a * a} + ${b * b} - ${2 * a * b}\\cos ${C}^\\circ = ${PR.r(c2, 3)}`,
          `c = \\sqrt{${PR.r(c2, 3)}} \\approx ${c}`,
        ],
        answer: `c \\approx ${c}`,
        viz: { type: 'triangle', a, b, C },
        w: { a, b, C, c2 },
      };
    },
    distractors({ a, b, C, c2 }) {
      const cosC = Math.cos(C * Math.PI / 180);
      const val = (x, why) => ({ latex: `c \\approx ${PR.r(x, 3)}`, why });
      return [
        val(Math.sqrt(a * a + b * b + 2 * a * b * cosC), 'cos-rule-sign'),
        val(Math.sqrt(a * a + b * b), 'cos-rule-pythag'),
        val(c2, 'no-sqrt'),
        val(Math.sqrt(Math.abs(a * a + b * b - 2 * a * b * C)), 'cos-rule-sign'),
      ];
    },
  },
  {
    id: 'exact-value', skill: 'trig-identities', topic: 'Trigonometry', keywords: ['exact value', 'compound angle'],
    // The exact values differ in form (1 vs a surd fraction vs a plain fraction),
    // so option shapes legitimately vary here — see tools/check-practice.js.
    mcqShapeVaries: true,
    generate() {
      // Every pair used to sum to 90, so the answer was ALWAYS literally 1 and
      // the other branch of the ternary was unreachable. These sums spread across
      // the standard angles instead, which is the point of the exercise.
      const [A, B] = PR.choice([
        [20, 10], [30, 15], [45, 15], [30, 30], [60, 30], [45, 45], [80, 40], [100, 50],
      ]);
      const sum = A + B;
      const exact = SIN_EXACT[sum];
      return {
        question: `\\text{Find the exact value of } \\sin ${A}^\\circ \\cos ${B}^\\circ + \\cos ${A}^\\circ \\sin ${B}^\\circ`,
        steps: [
          `\\text{This is the compound-angle expansion of } \\sin(A + B)`,
          `\\sin(${A}^\\circ + ${B}^\\circ) = \\sin ${sum}^\\circ`,
          `\\sin ${sum}^\\circ = ${exact}`,
        ],
        answer: `${exact}`,
        viz: { type: 'unitcircle', angles: [A, B, sum] },
        w: { A, B, sum, exact },
      };
    },
    distractors({ exact }) {
      // The other exact values, in the order a student is most likely to reach
      // for. Something like "2" would be eliminated on sight and measure nothing.
      return SIN_EXACT_VALUES
        .filter((v) => v !== exact)
        .map((latex) => ({ latex, why: 'exact-value-swap' }));
    },
  },
  {
    id: 'diff-poly', skill: 'differentiation', topic: 'Differentiation', keywords: ['differentiate', 'derivative', 'polynomial'],
    generate() {
      const a = PR.nz(-5, 6); const n = PR.int(3, 5);
      const b = PR.nz(-6, 6); const c = PR.nz(-9, 9);
      return {
        question: `\\text{Differentiate } f(x) = ${PR.lead(a, `x^{${n}}`)}${PR.xt(b, 'x^2')}${PR.xt(c)}`,
        steps: [
          `\\frac{d}{dx}${PR.par(a)}x^{${n}} = ${PR.lead(a * n, `x^{${n - 1}}`)}`,
          `\\frac{d}{dx}${PR.par(b)}x^2 = ${PR.lead(2 * b)}, \\quad \\frac{d}{dx}${PR.lead(c)} = ${c}`,
          `f'(x) = ${PR.lead(a * n, `x^{${n - 1}}`)}${PR.xt(2 * b)}${PR.ct(c)}`,
        ],
        answer: `f'(x) = ${PR.lead(a * n, `x^{${n - 1}}`)}${PR.xt(2 * b)}${PR.ct(c)}`,
        viz: {
          type: 'poly',
          coeffs: (() => {
            const cf = Array(n + 1).fill(0);
            cf[n] += a; cf[2] += b; cf[1] += c;
            return cf;
          })(),
          tangentAt: 1,
        },
        w: { a, b, c, n },
      };
    },
    distractors({ a, b, c, n }) {
      const form = (lead, pow, mid, tail, why) =>
        ({ latex: `f'(x) = ${PR.lead(lead, `x^{${pow}}`)}${PR.xt(mid)}${PR.ct(tail)}`, why });
      return [
        form(a, n - 1, 2 * b, c, 'power-not-multiplied'),
        form(a * n, n, 2 * b, c, 'power-not-dropped'),
        form(a * n, n - 1, b, c, 'power-not-multiplied'),
        form(a * (n - 1), n - 1, 2 * b, c, 'power-not-multiplied'),
        form(a, n, b, c, 'power-not-dropped'),
      ];
    },
  },
  {
    id: 'diff-chain', skill: 'diff-rules', topic: 'Differentiation', keywords: ['chain rule', 'composite'],
    generate() {
      const a = PR.int(2, 5); const b = PR.nz(-6, 6); const n = PR.int(3, 6);
      return {
        question: `\\text{Differentiate } y = (${a}x ${PR.s(b)})^{${n}}`,
        steps: [
          `\\text{Chain rule: outer } u^{${n}}, \\text{ inner } u = ${a}x ${PR.s(b)}`,
          `\\frac{dy}{du} = ${n}u^{${n - 1}}, \\quad \\frac{du}{dx} = ${a}`,
          `\\frac{dy}{dx} = ${n} \\times ${a} \\, (${a}x ${PR.s(b)})^{${n - 1}} = ${n * a}(${a}x ${PR.s(b)})^{${n - 1}}`,
        ],
        answer: `\\frac{dy}{dx} = ${n * a}(${a}x ${PR.s(b)})^{${n - 1}}`,
        viz: {
          type: 'poly',
          coeffs: (() => {
            // Binomial expansion of (ax+b)^n, ascending powers of x.
            const cf = Array(n + 1).fill(0);
            let comb = 1;
            for (let k = 0; k <= n; k++) {
              if (k > 0) comb = (comb * (n - k + 1)) / k;
              cf[k] = comb * Math.pow(a, k) * Math.pow(b, n - k);
            }
            return cf;
          })(),
          tangentAt: PR.r((1 - b) / a, 3), // inner = 1 → y = 1, slope = n·a
        },
        w: { a, b, n },
      };
    },
    distractors({ a, b, n }) {
      const form = (coef, pow, why) =>
        ({ latex: `\\frac{dy}{dx} = ${PR.lead(coef, `(${a}x ${PR.s(b)})^{${pow}}`)}`, why });
      return [
        form(n, n - 1, 'chain-no-inner'),
        form(n * a, n, 'power-not-dropped'),
        form(n * a * a, n - 1, 'chain-inner-twice'),
        form(n, n, 'chain-no-inner'),
        form(a, n - 1, 'power-not-multiplied'),
      ];
    },
  },
  {
    id: 'int-poly', skill: 'integration', topic: 'Integration', keywords: ['integrate', 'antiderivative', 'indefinite'],
    generate() {
      const n = PR.int(2, 5); const k = (n + 1) * PR.int(1, 3); const b = PR.nz(-7, 7);
      return {
        question: `\\text{Find } \\int \\left(${k}x^{${n}} ${PR.s(b)}\\right) dx`,
        steps: [
          `\\int ${k}x^{${n}}\\,dx = \\frac{${k}}{${n + 1}}x^{${n + 1}} = ${PR.lead(k / (n + 1), `x^{${n + 1}}`)}`,
          `\\int ${PR.par(b)}\\,dx = ${PR.lead(b)}`,
          `${PR.lead(k / (n + 1), `x^{${n + 1}}`)}${PR.xt(b)} + C`,
        ],
        answer: `${PR.lead(k / (n + 1), `x^{${n + 1}}`)}${PR.xt(b)} + C`,
        w: { n, k, b },
      };
    },
    distractors({ n, k, b }) {
      // "Forgot + C" is the obvious slip but it changes the option's shape, so
      // it would stand out without any calculus. These all keep the + C and get
      // the antiderivative itself wrong, which is the harder and better test.
      const form = (coef, pow, why) =>
        ({ latex: `${PR.lead(coef, `x^{${pow}}`)}${PR.xt(b)} + C`, why });
      return [
        form(PR.r(k / n, 3), n + 1, 'int-divide-n'),
        form(PR.r(k / (n + 1), 3), n, 'int-power-down'),
        form(PR.r(k / n, 3), n, 'int-divide-n'),
        form(k, n + 1, 'int-divide-n'),
        form(PR.r(k * (n + 1), 3), n + 1, 'int-divide-n'),
      ];
    },
  },
  {
    id: 'int-definite', skill: 'integration', topic: 'Integration', keywords: ['definite integral', 'evaluate', 'area'],
    generate() {
      // Lower limit at least 1: at p = 0 the lower substitution is zero, so
      // "only substituted the top limit" and "added instead of subtracted" both
      // give the right answer and the question stops testing the thing it names.
      const b = PR.int(2, 5); const p = PR.int(1, 3); const q = p + PR.int(2, 4);
      const F = (x) => x * x + b * x;
      return {
        question: `\\text{Evaluate } \\int_{${p}}^{${q}} (2x ${PR.s(b)})\\,dx`,
        steps: [
          `\\int (2x ${PR.s(b)})\\,dx = x^2 ${PR.s(b)}x`,
          `\\left[x^2 ${PR.s(b)}x\\right]_{${p}}^{${q}} = (${q}^2 ${PR.s(b)} \\times ${q}) - (${p}^2 ${PR.s(b)} \\times ${p})`,
          `= ${F(q)} - ${F(p)} = ${F(q) - F(p)}`,
        ],
        answer: `${F(q) - F(p)}`,
        viz: { type: 'area', coeffs: [b, 2], a: p, b: q },
        w: { b, p, q, Fp: F(p), Fq: F(q) },
      };
    },
    distractors({ b, p, q, Fp, Fq }) {
      return [
        { latex: `${Fp - Fq}`, why: 'limits-swapped' },
        { latex: `${Fq}`, why: 'upper-only' },
        { latex: `${Fq + Fp}`, why: 'limits-swapped' },
        { latex: `${(q - p) * (q - p) + b * (q - p)}`, why: 'upper-only' },
      ];
    },
  },
  {
    id: 'seq-arith', skill: 'sequences-series', topic: 'Sequences & series', keywords: ['arithmetic', 'sequence', 'nth term'],
    // Position carries meaning in this answer, so a distractor can share its
    // numbers without being the same answer - see mcqOrdered in practice-mcq.js.
    mcqOrdered: true,
    generate() {
      const a = PR.int(1, 9); const d = PR.nz(-4, 6); const n = PR.int(8, 20);
      const an = a + (n - 1) * d;
      const Sn = (n / 2) * (2 * a + (n - 1) * d);
      return {
        question: `\\text{For the arithmetic sequence } a = ${a}, \\ d = ${d}: \\text{ find } a_{${n}} \\text{ and } S_{${n}}`,
        steps: [
          `a_{${n}} = a + (n-1)d = ${a} + ${n - 1} \\times ${PR.par(d)} = ${an}`,
          `S_{${n}} = \\tfrac{n}{2}(2a + (n-1)d) = \\tfrac{${n}}{2}(${2 * a} + ${(n - 1) * d})`,
          `S_{${n}} = ${Sn}`,
        ],
        answer: `a_{${n}} = ${an}, \\quad S_{${n}} = ${Sn}`,
        viz: { type: 'bars', values: Array.from({ length: 8 }, (_, i) => a + i * d) },
        w: { a, d, n, an, Sn },
      };
    },
    distractors({ a, d, n, an, Sn }) {
      const form = (term, sum, why) =>
        ({ latex: `a_{${n}} = ${PR.r(term, 3)}, \\quad S_{${n}} = ${PR.r(sum, 3)}`, why });
      const sumOf = (t) => (n / 2) * (a + t);
      return [
        form(a + n * d, sumOf(a + n * d), 'nth-off-by-one'),
        form(an, ((n + 1) / 2) * (2 * a + n * d), 'sum-wrong-n'),
        form(a + n * d, Sn, 'nth-off-by-one'),
        form(an, n * an, 'sum-wrong-n'),
        form(a + (n - 1) * d * 2, Sn, 'nth-off-by-one'),
      ];
    },
  },
  {
    id: 'seq-geo', skill: 'sequences-series', topic: 'Sequences & series', keywords: ['geometric', 'series', 'sum'],
    generate() {
      const a = PR.int(1, 5); const r = PR.choice([2, 3]); const n = PR.int(4, 6);
      const Sn = a * (Math.pow(r, n) - 1) / (r - 1);
      return {
        question: `\\text{Find } S_{${n}} \\text{ for the geometric series } a = ${a}, \\ r = ${r}`,
        steps: [
          `S_n = a\\,\\frac{r^n - 1}{r - 1} = ${a} \\times \\frac{${r}^{${n}} - 1}{${r - 1}}`,
          `${r}^{${n}} = ${Math.pow(r, n)}`,
          `S_{${n}} = ${a} \\times \\frac{${Math.pow(r, n) - 1}}{${r - 1}} = ${Sn}`,
        ],
        answer: `S_{${n}} = ${Sn}`,
        viz: { type: 'bars', values: Array.from({ length: 6 }, (_, i) => a * Math.pow(r, i)) },
        w: { a, r, n, Sn },
      };
    },
    distractors({ a, r, n }) {
      const val = (x, why) => ({ latex: `S_{${n}} = ${PR.r(x, 3)}`, why });
      return [
        val(a * (Math.pow(r, n) - 1), 'geo-no-divide'),
        val(a * Math.pow(r, n), 'geo-no-divide'),
        val(a * (Math.pow(r, n - 1) - 1) / (r - 1), 'nth-off-by-one'),
        val(a * (Math.pow(r, n) - 1) / r, 'geo-no-divide'),
      ];
    },
  },
  {
    id: 'vector-dot', skill: 'vectors', topic: 'Vectors', keywords: ['vector', 'dot product', 'angle'],
    // Position carries meaning in this answer, so a distractor can share its
    // numbers without being the same answer - see mcqOrdered in practice-mcq.js.
    mcqOrdered: true,
    generate() {
      const a = [PR.nz(-5, 5), PR.nz(-5, 5), PR.int(-3, 3)];
      const b = [PR.nz(-5, 5), PR.nz(-5, 5), PR.int(-3, 3)];
      const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      const ma = Math.hypot(...a); const mb = Math.hypot(...b);
      const ang = PR.r(Math.acos(Math.max(-1, Math.min(1, dot / (ma * mb)))) * 180 / Math.PI, 2);
      return {
        question: `\\text{Find } \\vec a \\cdot \\vec b \\text{ and the angle between } \\vec a = (${a}) \\text{ and } \\vec b = (${b})`,
        steps: [
          `\\vec a \\cdot \\vec b = ${a[0]}${PR.par(b[0])} + ${a[1]}${PR.par(b[1])} + ${a[2]}${PR.par(b[2])} = ${dot}`,
          `|\\vec a| = ${PR.r(ma, 3)}, \\quad |\\vec b| = ${PR.r(mb, 3)}`,
          `\\cos\\theta = \\frac{${dot}}{${PR.r(ma * mb, 3)}} \\Rightarrow \\theta \\approx ${ang}^\\circ`,
        ],
        answer: `\\vec a \\cdot \\vec b = ${dot}, \\quad \\theta \\approx ${ang}^\\circ`,
        viz: { type: 'vectors', a: [a[0], a[1]], b: [b[0], b[1]] },
        w: { a, b, dot, ma, mb, ang },
      };
    },
    distractors({ a, b, dot, ma, mb, ang }) {
      const form = (d, t, why) =>
        ({ latex: `\\vec a \\cdot \\vec b = ${PR.r(d, 3)}, \\quad \\theta \\approx ${PR.r(t, 2)}^\\circ`, why });
      const cos = dot / (ma * mb);
      return [
        form(dot, cos, 'angle-no-arccos'),
        form(PR.r(ma * mb, 3), ang, 'dot-magnitudes'),
        form(a[0] * b[0] + a[1] * b[1], ang, 'cross-term'),
        form(dot, 90 - ang, 'angle-no-arccos'),
        form(PR.r(ma * mb, 3), cos, 'dot-magnitudes'),
      ];
    },
  },
  {
    id: 'matrix-det-inv', skill: 'matrices', topic: 'Matrices', keywords: ['matrix', 'determinant', 'inverse'],
    // Deliberately no distractors(): the question asks for det A AND the
    // inverse, but `answer` carries only the determinant (the inverse lives in
    // the steps). A list of four determinants would not be answering the
    // question on screen, so this one stays self-marked until the question is
    // split in two.
    generate() {
      let a, b, c, d, det;
      do {
        a = PR.nz(-5, 5); b = PR.nz(-5, 5); c = PR.nz(-5, 5); d = PR.nz(-5, 5);
        det = a * d - b * c;
      } while (det === 0);
      return {
        question: `\\text{Find } \\det A \\text{ and } A^{-1} \\text{ for } A = \\begin{pmatrix} ${a} & ${b} \\\\ ${c} & ${d} \\end{pmatrix}`,
        steps: [
          `\\det A = ad - bc = ${a}${PR.par(d)} - ${PR.par(b)}${PR.par(c)} = ${det}`,
          `A^{-1} = \\frac{1}{${det}}\\begin{pmatrix} ${d} & ${-b} \\\\ ${-c} & ${a} \\end{pmatrix}`,
          `A^{-1} = \\begin{pmatrix} ${PR.r(d / det, 3)} & ${PR.r(-b / det, 3)} \\\\ ${PR.r(-c / det, 3)} & ${PR.r(a / det, 3)} \\end{pmatrix}`,
        ],
        answer: `\\det A = ${det}`,
      };
    },
  },
  {
    id: 'stats-mean-sd', skill: 'statistics', topic: 'Statistics', keywords: ['mean', 'standard deviation', 'data'],
    // Position carries meaning in this answer, so a distractor can share its
    // numbers without being the same answer - see mcqOrdered in practice-mcq.js.
    mcqOrdered: true,
    generate() {
      const xs = Array.from({ length: 5 }, () => PR.int(2, 14));
      const mean = xs.reduce((s, x) => s + x, 0) / 5;
      const ss = xs.reduce((s, x) => s + (x - mean) ** 2, 0);
      const sd = PR.r(Math.sqrt(ss / 4), 3);
      return {
        question: `\\text{Find the mean and sample standard deviation of } ${xs.join(', ')}`,
        steps: [
          `\\bar x = \\frac{${xs.join(' + ')}}{5} = ${PR.r(mean, 3)}`,
          `\\sum (x_i - \\bar x)^2 = ${PR.r(ss, 3)}`,
          `s = \\sqrt{\\frac{${PR.r(ss, 3)}}{4}} \\approx ${sd}`,
        ],
        answer: `\\bar x = ${PR.r(mean, 3)}, \\quad s \\approx ${sd}`,
        viz: { type: 'dots', values: xs, mean: PR.r(mean, 3) },
        w: { xs, mean, ss, sd },
      };
    },
    distractors({ xs, mean, ss }) {
      const form = (m, s, why) =>
        ({ latex: `\\bar x = ${PR.r(m, 3)}, \\quad s \\approx ${PR.r(s, 3)}`, why });
      const median = [...xs].sort((p, q) => p - q)[2];
      return [
        // The one everybody gets wrong: sample SD divides by n - 1, not n.
        form(mean, Math.sqrt(ss / 5), 'sd-population'),
        form(mean, ss / 4, 'sd-no-sqrt'),
        form(median, Math.sqrt(ss / 4), 'mean-is-median'),
        form(mean, Math.sqrt(ss) / 4, 'sd-no-sqrt'),
        form(median, Math.sqrt(ss / 5), 'mean-is-median'),
      ];
    },
  },
  {
    id: 'binom-prob', skill: 'distributions', topic: 'Statistics', keywords: ['binomial', 'probability', 'combinations'],
    generate() {
      const n = PR.int(4, 6); const k = PR.int(1, n - 1);
      // No p = 0.5: the distribution is symmetric there, so "swapped the powers
      // of p and 1 - p" lands on the right answer and stops being a mistake the
      // question can catch.
      const p = PR.choice([0.2, 0.3, 0.4, 0.6, 0.7]);
      let C = 1;
      for (let i = 0; i < k; i++) C = (C * (n - i)) / (i + 1);
      C = Math.round(C);
      const prob = PR.r(C * Math.pow(p, k) * Math.pow(1 - p, n - k), 4);
      return {
        question: `X \\sim B(${n}, ${p}). \\ \\text{Find } P(X = ${k})`,
        steps: [
          `\\binom{${n}}{${k}} = ${C}`,
          `P(X = ${k}) = ${C} \\times ${p}^{${k}} \\times ${PR.r(1 - p, 2)}^{${n - k}}`,
          `P(X = ${k}) \\approx ${prob}`,
        ],
        answer: `P(X = ${k}) \\approx ${prob}`,
        viz: {
          type: 'bars',
          values: Array.from({ length: n + 1 }, (_, i) => {
            let ci = 1;
            for (let j = 0; j < i; j++) ci = (ci * (n - j)) / (j + 1);
            return PR.r(ci * Math.pow(p, i) * Math.pow(1 - p, n - i), 4);
          }),
          highlight: k,
          startIndex: 0,
        },
        w: { n, k, p, C, prob },
      };
    },
    distractors({ n, k, p, C, prob }) {
      // Only ever offer a number that could actually be a probability. An option
      // above 1 is eliminated on sight without knowing any of the binomial.
      const val = (x, why) =>
        (x <= 0 || x >= 1 ? null : { latex: `P(X = ${k}) \\approx ${PR.r(x, 4)}`, why });
      return [
        val(Math.pow(p, k) * Math.pow(1 - p, n - k), 'binom-no-coeff'),
        val(C * Math.pow(p, n - k) * Math.pow(1 - p, k), 'binom-swapped'),
        val(Math.pow(p, n - k) * Math.pow(1 - p, k), 'binom-no-coeff'),
        val(1 - prob, 'binom-complement'),
        val(k / n, 'binom-no-coeff'),
      ].filter(Boolean);
    },
  },

  // ---- Rational expressions ------------------------------------------------------
  {
    id: 'rational-simplify', skill: 'rational-expressions', topic: 'Rational expressions',
    // Position carries meaning in this answer, so a distractor can share its
    // numbers without being the same answer - see mcqOrdered in practice-mcq.js.
    mcqOrdered: true,
    keywords: ['rational', 'simplify', 'algebraic fraction', 'cancel'],
    generate() {
      // (x+p)(x+q) / (x+p)(x+r) — cancel the shared factor.
      // Redraw until the factors are distinct and non-zero and neither
      // quadratic's x-coefficient is 0 (avoids "(x + 0)" and "+ 0x").
      let p, q, r, nB, dB;
      do {
        p = PR.nz(-6, 6);
        q = PR.nz(-6, 6); if (q === p) q = p + 1;
        r = PR.nz(-6, 6); if (r === p || r === q) r = p + q + 1;
        nB = p + q; dB = p + r;
      } while (q === 0 || r === 0 || q === p || r === p || r === q ||
               nB === 0 || dB === 0);
      const nC = p * q, dC = p * r;
      const nBx = ` ${PR.s(nB)}x`.replace('+ 1x', '+ x').replace('- 1x', '- x');
      const dBx = ` ${PR.s(dB)}x`.replace('+ 1x', '+ x').replace('- 1x', '- x');
      return {
        question: `\\text{Simplify } \\frac{x^2${nBx} ${PR.s(nC)}}{x^2${dBx} ${PR.s(dC)}}`,
        steps: [
          `\\text{Factorise the numerator: } x^2${nBx} ${PR.s(nC)} = (x ${PR.s(p)})(x ${PR.s(q)})`,
          `\\text{Factorise the denominator: } x^2${dBx} ${PR.s(dC)} = (x ${PR.s(p)})(x ${PR.s(r)})`,
          `\\frac{(x ${PR.s(p)})(x ${PR.s(q)})}{(x ${PR.s(p)})(x ${PR.s(r)})} \\quad \\text{cancel } (x ${PR.s(p)})`,
          `= \\frac{x ${PR.s(q)}}{x ${PR.s(r)}}, \\quad x \\ne ${-p},\\; ${-r}`,
        ],
        answer: `\\frac{x ${PR.s(q)}}{x ${PR.s(r)}}, \\quad x \\ne ${-p},\\; ${-r}`,
        viz: { type: 'rational', num: [nC, nB, 1], den: [dC, dB, 1], asym: [-r], holes: [-p] },
        w: { p, q, r },
      };
    },
    distractors({ p, q, r }) {
      const form = (top, bot, e1, e2, why) =>
        ({ latex: `\\frac{x ${PR.s(top)}}{x ${PR.s(bot)}}, \\quad x \\ne ${e1},\\; ${e2}`, why });
      return [
        // Cancelled the wrong factor: kept p and lost the one that survives.
        form(p, r, -q, -r, 'cancel-wrong'),
        form(q, p, -q, -r, 'cancel-wrong'),
        // Right fraction, but the hole from the cancelled factor is forgotten.
        form(q, r, -q, -r, 'exclusion-wrong'),
        form(q, r, -p, -q, 'exclusion-wrong'),
        form(p, q, -p, -r, 'cancel-wrong'),
      ];
    },
  },
  {
    id: 'rational-multiply', skill: 'rational-expressions', topic: 'Rational expressions',
    keywords: ['rational', 'multiply', 'divide', 'algebraic fraction'],
    generate() {
      // (x+a)(x+b)/(x+c) · (x+c)(x+d)/(x+a) = (x+b)(x+d)
      // Redraw until all four factors are distinct and non-zero (the nudges below
      // can land on 0, giving "(x + 0)") and the product has an x term.
      let a, b, c, d;
      do {
        a = PR.nz(-6, 6);
        b = PR.nz(-6, 6); if (b === a) b = a + 1;
        c = PR.nz(-6, 6); if (c === a || c === b) c = a + b + 1;
        d = PR.nz(-6, 6); if (d === c || d === a) d = c + 1;
      } while (b === 0 || c === 0 || d === 0 || b + d === 0 ||
               c === a || c === b || d === c || d === a);
      const sumBx = ` ${PR.s(b + d)}x`.replace('+ 1x', '+ x').replace('- 1x', '- x');
      return {
        question: `\\text{Simplify } \\frac{(x ${PR.s(a)})(x ${PR.s(b)})}{x ${PR.s(c)}} \\times \\frac{(x ${PR.s(c)})(x ${PR.s(d)})}{x ${PR.s(a)}}`,
        steps: [
          `\\text{Multiply numerators and denominators:}`,
          `\\frac{(x ${PR.s(a)})(x ${PR.s(b)})(x ${PR.s(c)})(x ${PR.s(d)})}{(x ${PR.s(c)})(x ${PR.s(a)})}`,
          `\\text{Cancel } (x ${PR.s(a)}) \\text{ and } (x ${PR.s(c)})`,
          `= (x ${PR.s(b)})(x ${PR.s(d)}) = x^2${sumBx} ${PR.s(b * d)}`,
        ],
        answer: `(x ${PR.s(b)})(x ${PR.s(d)})`,
        w: { a, b, c, d },
      };
    },
    distractors({ a, b, c, d }) {
      const form = (m, n, why) => ({ latex: `(x ${PR.s(m)})(x ${PR.s(n)})`, why });
      return [
        form(a, c, 'cancel-wrong'),   // kept the pair that cancels
        form(b, c, 'cancel-wrong'),
        form(a, d, 'cancel-wrong'),
        form(b + d, b * d, 'factors-added'),
        form(a, b, 'cancel-wrong'),
      ];
    },
  },
  {
    id: 'rational-add', skill: 'rational-expressions', topic: 'Rational expressions',
    // Position carries meaning in this answer, so a distractor can share its
    // numbers without being the same answer - see mcqOrdered in practice-mcq.js.
    mcqOrdered: true,
    keywords: ['rational', 'add', 'subtract', 'lcd', 'common denominator'],
    generate() {
      // Redraw until the denominators are distinct and non-zero and the
      // combined numerator has a non-zero constant term.
      let a, b, p, q, nc;
      do {
        a = PR.int(1, 6); b = PR.int(1, 6);
        p = PR.nz(-6, 6);
        q = PR.nz(-6, 6); if (q === p) q = p + 2;
        nc = a * q + b * p;
      } while (q === 0 || q === p || nc === 0);
      const nx = a + b;                      // a, b >= 1, so never 0 or 1
      const ax = a === 1 ? 'x' : `${a}x`;    // "1x" reads badly
      const bx = b === 1 ? 'x' : `${b}x`;
      return {
        question: `\\text{Express as a single fraction: } \\frac{${a}}{x ${PR.s(p)}} + \\frac{${b}}{x ${PR.s(q)}}`,
        steps: [
          `\\text{LCD} = (x ${PR.s(p)})(x ${PR.s(q)})`,
          `= \\frac{${a}(x ${PR.s(q)}) + ${b}(x ${PR.s(p)})}{(x ${PR.s(p)})(x ${PR.s(q)})}`,
          `\\text{Expand the numerator: } ${ax} ${PR.s(a * q)} + ${bx} ${PR.s(b * p)} = ${nx}x ${PR.s(nc)}`,
          `= \\frac{${nx}x ${PR.s(nc)}}{(x ${PR.s(p)})(x ${PR.s(q)})}`,
        ],
        answer: `\\frac{${nx}x ${PR.s(nc)}}{(x ${PR.s(p)})(x ${PR.s(q)})}`,
        w: { a, b, p, q, nx, nc },
      };
    },
    distractors({ a, b, p, q, nx, nc }) {
      // A zero denominator constant would print "(x + 0)"; p + q can land there.
      const form = (coef, konst, d1, d2, why) =>
        (konst === 0 || d1 === 0 || d2 === 0 ? null : {
          latex: `\\frac{${PR.lead(coef)} ${PR.s(konst)}}{(x ${PR.s(d1)})(x ${PR.s(d2)})}`, why,
        });
      return [
        // Added straight across the tops and the bottoms.
        form(nx, a + b, p + q, p * q, 'add-denominators'),
        // Never cross-multiplied, so the numerator kept only the constants.
        form(nx, a + b, p, q, 'no-cross-multiply'),
        // Cross-multiplied the wrong way round.
        form(nx, a * p + b * q, p, q, 'no-cross-multiply'),
        form(a * b, nc, p, q, 'no-cross-multiply'),
        form(nx, nc - a - b, p, q, 'no-cross-multiply'),
      ].filter(Boolean);
    },
  },
  {
    id: 'rational-complex', skill: 'rational-expressions', topic: 'Complex rational expressions',
    // Position carries meaning in this answer, so a distractor can share its
    // numbers without being the same answer - see mcqOrdered in practice-mcq.js.
    mcqOrdered: true,
    keywords: ['complex rational', 'compound fraction', 'complex fraction', 'rational'],
    generate() {
      // (1/x + 1/p) / (1/x - 1/q) = q(p + x) / (p(q - x))
      const p = PR.int(2, 9);
      let q = PR.int(2, 9); if (q === p) q = p + 1;
      return {
        question: `\\text{Simplify } \\dfrac{\\frac{1}{x} + \\frac{1}{${p}}}{\\frac{1}{x} - \\frac{1}{${q}}}`,
        steps: [
          `\\text{Multiply top and bottom by the overall LCD } ${p}${q}x`,
          `\\text{Numerator: } ${p}${q}x\\left(\\frac{1}{x} + \\frac{1}{${p}}\\right) = ${p * q} + ${q}x`,
          `\\text{Denominator: } ${p}${q}x\\left(\\frac{1}{x} - \\frac{1}{${q}}\\right) = ${p * q} - ${p}x`,
          `= \\frac{${q}(${p} + x)}{${p}(${q} - x)}, \\quad x \\ne 0,\\; ${q}`,
        ],
        answer: `\\frac{${q}(${p} + x)}{${p}(${q} - x)}`,
        w: { p, q },
      };
    },
    distractors({ p, q }) {
      const form = (t1, t2, b1, b2, why) =>
        ({ latex: `\\frac{${t1}(${t2} + x)}{${b1}(${b2} - x)}`, why });
      return [
        form(p, q, q, p, 'reciprocal-not-flipped'),
        form(p, p, q, q, 'reciprocal-not-flipped'),
        form(q, q, p, p, 'reciprocal-not-flipped'),
        form(p, q, p, q, 'reciprocal-not-flipped'),
      ];
    },
  },

  // ---- Decomposing expressions (partial fractions) --------------------------------
  {
    id: 'partial-distinct', skill: 'partial-fractions', topic: 'Decomposing expressions',
    // Position carries meaning in this answer, so a distractor can share its
    // numbers without being the same answer - see mcqOrdered in practice-mcq.js.
    mcqOrdered: true,
    keywords: ['partial fraction', 'decompos', 'distinct linear', 'rational'],
    generate() {
      // Built from the answer so A and B are always whole numbers. Redraw when
      // the numerator would show a 0x or +0 term, or a root lands on 0 (the
      // b = a + 2 nudge can) and prints an "(x + 0)" factor.
      let A, B, a, b, p, q;
      do {
        A = PR.nz(-5, 6); B = PR.nz(-5, 6);
        a = PR.nz(-5, 5);
        b = PR.nz(-5, 5); if (b === a) b = a + 2;
        p = A + B;                // numerator: A(x-b) + B(x-a)
        q = -(A * b + B * a);
      } while (p === 0 || q === 0 || b === 0 || b === a);
      const px = p === 1 ? 'x' : p === -1 ? '-x' : `${p}x`;
      return {
        question: `\\text{Express in partial fractions: } \\frac{${px} ${PR.s(q)}}{(x ${PR.s(-a)})(x ${PR.s(-b)})}`,
        steps: [
          `\\text{Write } \\frac{${px} ${PR.s(q)}}{(x ${PR.s(-a)})(x ${PR.s(-b)})} = \\frac{A}{x ${PR.s(-a)}} + \\frac{B}{x ${PR.s(-b)}}`,
          `\\text{Multiply through: } ${px} ${PR.s(q)} = A(x ${PR.s(-b)}) + B(x ${PR.s(-a)})`,
          `\\text{Cover-up, } x = ${a}: \\; ${p}(${a}) ${PR.s(q)} = A(${a} - ${b}) \\Rightarrow A = ${A}`,
          `\\text{Cover-up, } x = ${b}: \\; ${p}(${b}) ${PR.s(q)} = B(${b} - ${a}) \\Rightarrow B = ${B}`,
          `= \\frac{${A}}{x ${PR.s(-a)}} + \\frac{${B}}{x ${PR.s(-b)}}`,
        ],
        answer: `\\frac{${A}}{x ${PR.s(-a)}} + \\frac{${B}}{x ${PR.s(-b)}}`,
        viz: { type: 'rational', num: [q, p], den: [a * b, -(a + b), 1], asym: [a, b] },
        w: { A, B, a, b },
      };
    },
    distractors({ A, B, a, b }) {
      const form = (n1, d1, n2, d2, why) =>
        ({ latex: `\\frac{${n1}}{x ${PR.s(d1)}} + \\frac{${n2}}{x ${PR.s(d2)}}`, why });
      // Note there is deliberately no `form(A, -b, B, -a)` here: that is the same
      // sum with its two terms written the other way round, which is the right
      // answer, not a distractor.
      return [
        form(B, -a, A, -b, 'pf-swapped'),   // A and B over the wrong factors
        form(A, a, B, b, 'pf-root-sign'),
        form(B, a, A, b, 'pf-swapped'),
        form(-A, -a, -B, -b, 'pf-swapped'),
        form(A, -a, -B, -b, 'pf-swapped'),
      ];
    },
  },
  {
    id: 'partial-repeated', skill: 'partial-fractions', topic: 'Decomposing expressions',
    // Position carries meaning in this answer, so a distractor can share its
    // numbers without being the same answer - see mcqOrdered in practice-mcq.js.
    mcqOrdered: true,
    keywords: ['partial fraction', 'decompos', 'repeated root', 'rational'],
    generate() {
      // Redraw when the numerator would show a +0 constant term.
      let A, B, a, p, q;
      do {
        A = PR.nz(-5, 6); B = PR.nz(-6, 6);
        a = PR.nz(-5, 5);
        p = A;                     // numerator: A(x-a) + B
        q = B - A * a;
      } while (q === 0);
      const px = p === 1 ? 'x' : p === -1 ? '-x' : `${p}x`;
      return {
        question: `\\text{Express in partial fractions: } \\frac{${px} ${PR.s(q)}}{(x ${PR.s(-a)})^2}`,
        steps: [
          `\\text{Repeated factor} \\Rightarrow \\frac{A}{x ${PR.s(-a)}} + \\frac{B}{(x ${PR.s(-a)})^2}`,
          `${px} ${PR.s(q)} = A(x ${PR.s(-a)}) + B`,
          `\\text{Let } x = ${a}: \\; ${p}(${a}) ${PR.s(q)} = B \\Rightarrow B = ${B}`,
          `\\text{Compare } x \\text{ coefficients: } A = ${A}`,
          `= \\frac{${A}}{x ${PR.s(-a)}} + \\frac{${B}}{(x ${PR.s(-a)})^2}`,
        ],
        answer: `\\frac{${A}}{x ${PR.s(-a)}} + \\frac{${B}}{(x ${PR.s(-a)})^2}`,
        viz: { type: 'rational', num: [q, p], den: [a * a, -2 * a, 1], asym: [a] },
        w: { A, B, a, q },
      };
    },
    distractors({ A, B, a, q }) {
      const form = (n1, n2, root, why) =>
        ({ latex: `\\frac{${n1}}{x ${PR.s(root)}} + \\frac{${n2}}{(x ${PR.s(root)})^2}`, why });
      return [
        form(B, A, -a, 'pf-swapped'),
        form(A, B, a, 'pf-root-sign'),
        form(A, q, -a, 'pf-swapped'),
        form(q, B, -a, 'pf-swapped'),
        form(B, q, -a, 'pf-swapped'),
      ];
    },
  },
  {
    id: 'partial-quadratic', skill: 'partial-fractions', topic: 'Decomposing expressions',
    // Position carries meaning in this answer, so a distractor can share its
    // numbers without being the same answer - see mcqOrdered in practice-mcq.js.
    mcqOrdered: true,
    keywords: ['partial fraction', 'decompos', 'irreducible quadratic', 'rational'],
    generate() {
      // Redraw when any numerator term would render as 0x^2, 0x or +0.
      let A, B, C, a, c, p, q, r;
      do {
        A = PR.nz(-4, 5); B = PR.nz(-4, 5); C = PR.nz(-5, 5);
        a = PR.nz(-4, 4);
        c = PR.choice([1, 4, 9]);
        // A(x^2+c) + (Bx+C)(x-a)
        p = A + B;
        q = C - a * B;
        r = A * c - a * C;
      } while (p === 0 || q === 0 || r === 0);
      const px = p === 1 ? 'x^2' : p === -1 ? '-x^2' : `${p}x^2`;
      const qx = q === 1 ? '+ x' : q === -1 ? '- x' : `${PR.s(q)}x`;
      return {
        question: `\\text{Express in partial fractions: } \\frac{${px} ${qx} ${PR.s(r)}}{(x ${PR.s(-a)})(x^2 + ${c})}`,
        steps: [
          `\\text{Irreducible quadratic} \\Rightarrow \\frac{A}{x ${PR.s(-a)}} + \\frac{Bx + C}{x^2 + ${c}}`,
          `${px} ${qx} ${PR.s(r)} = A(x^2 + ${c}) + (Bx + C)(x ${PR.s(-a)})`,
          `\\text{Let } x = ${a}: \\; A(${a * a} + ${c}) = ${A * (a * a + c)} \\Rightarrow A = ${A}`,
          `\\text{Compare } x^2: \\; A + B = ${p} \\Rightarrow B = ${B}`,
          `\\text{Compare constants: } ${c}A - ${a}C = ${r} \\Rightarrow C = ${C}`,
          `= \\frac{${A}}{x ${PR.s(-a)}} + \\frac{${PR.lead(B)} ${PR.s(C)}}{x^2 + ${c}}`,
        ],
        answer: `\\frac{${A}}{x ${PR.s(-a)}} + \\frac{${PR.lead(B)} ${PR.s(C)}}{x^2 + ${c}}`,
        w: { A, B, C, a, c },
      };
    },
    distractors({ A, B, C, a, c }) {
      const form = (n1, root, bCo, cCo, why) =>
        ({ latex: `\\frac{${n1}}{x ${PR.s(root)}} + \\frac{${PR.lead(bCo)} ${PR.s(cCo)}}{x^2 + ${c}}`, why });
      return [
        form(A, -a, C, B, 'pf-swapped'),
        form(A, a, B, C, 'pf-root-sign'),
        form(B, -a, A, C, 'pf-swapped'),
        form(A, -a, B, -C, 'pf-swapped'),
        form(C, -a, B, A, 'pf-swapped'),
      ];
    },
  },
];

// The key formula(s) needed to solve each template, shown inline in the practice
// screen so the student never has to leave for the formula sheet.
const PRACTICE_FORMULAS = {
  'linear-eq': ['ax + b = c \\;\\Rightarrow\\; x = \\dfrac{c - b}{a}'],
  'linear-both-sides': ['\\text{Collect } x \\text{ terms one side, numbers the other}'],
  'quad-factorise': ['x^2 + bx + c = (x + p)(x + q), \\quad p + q = b,\\; pq = c'],
  'quad-formula': ['x = \\dfrac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}'],
  'expand-binomial': ['(a + b)(c + d) = ac + ad + bc + bd'],
  'complete-square': ['x^2 + bx + c = \\left(x + \\tfrac{b}{2}\\right)^2 + c - \\tfrac{b^2}{4}'],
  'alg-fraction': ['\\text{Factorise, then cancel the common factor}'],
  'indices': ['x^a x^b = x^{a+b}, \\quad \\dfrac{x^a}{x^b} = x^{a-b}'],
  'solve-exp': ['a^x = a^k \\;\\Rightarrow\\; x = k'],
  'log-laws': ['\\log_a M + \\log_a N = \\log_a(MN)'],
  'complex-modarg': ['|z| = \\sqrt{a^2 + b^2}, \\quad \\arg z = \\arctan\\dfrac{b}{a}'],
  'complex-product': ['i^2 = -1, \\quad (a+bi)(c+di) = (ac-bd) + (ad+bc)i'],
  'demoivre': ['[r(\\cos\\theta + i\\sin\\theta)]^n = r^n(\\cos n\\theta + i\\sin n\\theta)'],
  'trig-solve': ['\\sin x = k \\;\\Rightarrow\\; x = \\sin^{-1}k \\text{ or } 180^\\circ - \\sin^{-1}k'],
  'cosine-rule': ['c^2 = a^2 + b^2 - 2ab\\cos C'],
  'exact-value': ['\\sin(A + B) = \\sin A\\cos B + \\cos A\\sin B'],
  'diff-poly': ['\\dfrac{d}{dx}x^n = n x^{n-1}'],
  'diff-chain': ['\\dfrac{dy}{dx} = \\dfrac{dy}{du}\\cdot\\dfrac{du}{dx}'],
  'int-poly': ['\\int x^n\\,dx = \\dfrac{x^{n+1}}{n+1} + C'],
  'int-definite': ['\\int_a^b f(x)\\,dx = F(b) - F(a)'],
  'seq-arith': ['a_n = a + (n-1)d, \\quad S_n = \\tfrac{n}{2}\\big(2a + (n-1)d\\big)'],
  'seq-geo': ['S_n = a\\,\\dfrac{r^n - 1}{r - 1}'],
  'vector-dot': [
    '\\vec a \\cdot \\vec b = a_1 b_1 + a_2 b_2 + a_3 b_3',
    '\\cos\\theta = \\dfrac{\\vec a \\cdot \\vec b}{|\\vec a|\\,|\\vec b|}',
  ],
  'matrix-det-inv': [
    '\\det A = ad - bc',
    'A^{-1} = \\dfrac{1}{ad - bc}\\begin{pmatrix} d & -b \\\\ -c & a \\end{pmatrix}',
  ],
  'stats-mean-sd': ['\\bar x = \\dfrac{\\sum x}{n}, \\quad s = \\sqrt{\\dfrac{\\sum (x - \\bar x)^2}{n - 1}}'],
  'binom-prob': ['P(X = k) = \\dbinom{n}{k} p^k (1 - p)^{n-k}'],
  'rational-simplify': [
    'x^2 + bx + c = (x + p)(x + q), \\quad p + q = b,\\; pq = c',
    '\\text{Cancel common factors; exclude values making a denominator } 0',
  ],
  'rational-multiply': ['\\dfrac{a}{b} \\times \\dfrac{c}{d} = \\dfrac{ac}{bd} \\;\\; \\text{(factor first, then cancel)}'],
  'rational-add': ['\\dfrac{a}{P} + \\dfrac{b}{Q} = \\dfrac{aQ + bP}{PQ}'],
  'rational-complex': ['\\text{Multiply numerator and denominator by the overall LCD}'],
  'partial-distinct': [
    '\\dfrac{px + q}{(x-a)(x-b)} = \\dfrac{A}{x-a} + \\dfrac{B}{x-b}',
    '\\text{Cover-up: substitute } x = a \\text{ to find } A,\\; x = b \\text{ to find } B',
  ],
  'partial-repeated': ['\\dfrac{px + q}{(x-a)^2} = \\dfrac{A}{x-a} + \\dfrac{B}{(x-a)^2}'],
  'partial-quadratic': ['\\dfrac{px^2 + qx + r}{(x-a)(x^2+c)} = \\dfrac{A}{x-a} + \\dfrac{Bx + C}{x^2+c}'],
};

/** Every template belonging to one skill — the exact lookup. */
function templatesForSkill(skillId) {
  if (!skillId) return [];
  const fn = typeof skillOf === 'function' ? skillOf : (t) => t.skill;
  return PRACTICE.filter((t) => fn(t) === skillId);
}

/**
 * Match templates to a free-text topic — the tutor keeps Current Topic updated,
 * so the input is prose written by a language model, not an id.
 *
 * Resolves through the skill graph's aliases (longest match wins) rather than
 * the old bidirectional substring test, which had `k.includes(t)` and so let a
 * query of "rational" drag in seven templates across three unrelated topics.
 * Falls back to keyword matching, then to everything — never returns empty.
 */
function practiceTemplatesFor(topicText) {
  const t = String(topicText || '').toLowerCase().trim();
  if (!t) return PRACTICE;

  if (typeof resolveSkill === 'function') {
    const skillId = resolveSkill(t);
    if (skillId) {
      const matched = templatesForSkill(skillId);
      if (matched.length) return matched;
    }
  }
  // No skill matched: fall back to one-directional keyword containment.
  const matched = PRACTICE.filter((p) => p.keywords.some((k) => t.includes(k)));
  return matched.length ? matched : PRACTICE;
}

// Every other shared file carries this footer; without it tools/check-practice.js
// would have to vm-evaluate the source to reach the generators. `templatesForSkill`
// leans on `skillOf` from practice-skills.js, so a Node caller must require that
// into the same scope first.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    PR, PRACTICE, PRACTICE_FORMULAS, MISCONCEPTIONS,
    templatesForSkill, practiceTemplatesFor,
  };
}
