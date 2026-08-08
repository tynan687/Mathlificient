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
  // ALWAYS brackets, for the second operand of a product where the bracket is
  // what says "multiply". PR.par brackets only negatives, which is right for an
  // exponent base and was wrong here: `${a}${PR.par(d)}` fused "1" and "4" into
  // "14" in six templates, so the worked steps read as false arithmetic while the
  // stated answers stayed correct.
  brk: (n) => `(${n})`,
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
  gcd(p, q) { p = Math.abs(p); q = Math.abs(q); while (q) { const r = p % q; p = q; q = r; } return p; },
  // The least each equation must be scaled by to make a coefficient match, so the
  // elimination working reads the way it is taught — scale by the smallest amount
  // that works, not blindly by the other coefficient.
  lcm(p, q) { return Math.abs(p * q) / this.gcd(p, q); },
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

  // Coordinate geometry
  'midpoint-difference': { label: 'subtracting the coordinates for the midpoint', hint: 'The midpoint averages the coordinates — you add them and halve, not subtract.' },
  'midpoint-no-halve': { label: 'forgetting to halve for the midpoint', hint: 'You added the coordinates but did not divide by 2.' },
  'distance-added': { label: 'adding the two gaps instead of using Pythagoras', hint: 'The distance is √(Δx² + Δy²), not Δx + Δy.' },
  'gradient-inverted': { label: 'using run over rise', hint: 'Gradient is rise over run — the y difference goes on top.' },
  'gradient-sign': { label: 'getting the sign of the gradient wrong', hint: 'Check which point you subtracted from which — do it the same way on top and bottom.' },
  'perp-no-negate': { label: 'taking the reciprocal without the minus', hint: 'Perpendicular gradients multiply to −1, so you flip it AND change the sign.' },
  'perp-no-reciprocal': { label: 'changing the sign without flipping', hint: 'Perpendicular gradients multiply to −1, so you change the sign AND flip it.' },
  'perp-is-parallel': { label: 'giving the parallel line', hint: 'Same gradient means parallel. Perpendicular needs the negative reciprocal.' },
  'coords-swapped': { label: 'writing the coordinates the wrong way round', hint: 'A point is (x, y) — the x you solved for comes first.' },
  'substituted-wrong': { label: 'substituting back into the wrong equation', hint: 'x goes back into either line, but the whole line — coefficient and constant together.' },
  'centre-not-negated': { label: 'reading the centre straight off the coefficients', hint: 'The centre is (−D/2, −E/2) — halve them and change the sign.' },
  'radius-is-constant': { label: 'treating the constant term as the radius', hint: 'The constant is not r². You have to complete the square first.' },

  // Functions
  'inverse-sign': { label: 'getting the sign wrong when you undo the function', hint: 'Undo the steps in reverse: take the constant off first, then divide.' },
  'inverse-is-reciprocal': { label: 'taking the reciprocal instead of the inverse', hint: 'An inverse undoes the function. It is not 1 over it.' },
  'composite-order': { label: 'composing them the other way round', hint: 'f(g(x)) puts g inside f — g acts first.' },
  'composite-no-distribute': { label: 'not multiplying through the bracket', hint: 'The outer coefficient multiplies everything inside, constant included.' },
  'composite-added': { label: 'adding the two functions', hint: 'Composing substitutes one into the other; it does not add them.' },
  'transform-x-direction': { label: 'shifting x the way the bracket reads', hint: 'f(x − h) moves the graph h to the RIGHT — the bracket reads backwards.' },
  'transform-order': { label: 'shifting before stretching', hint: 'The stretch applies first, then the vertical shift.' },
  'transform-no-scale': { label: 'skipping the vertical stretch', hint: 'The coefficient in front multiplies the y value too.' },
  'asymptote-sign': { label: 'not changing the sign for the vertical asymptote', hint: 'The bottom is zero where x + c = 0, so the asymptote is at x = −c.' },
  'asymptote-constant': { label: 'reading the horizontal asymptote off the constant', hint: 'For large x only the leading terms matter, so it is the ratio of the x coefficients.' },

  // Trigonometry
  'cos-rule-sign': { label: 'adding the 2ab cos C term', hint: 'The cosine rule subtracts 2ab cos C.' },
  'cos-rule-pythag': { label: 'falling back on Pythagoras', hint: 'Pythagoras only works when the angle is 90°. Here it is not.' },
  'no-sqrt': { label: 'forgetting the square root', hint: 'That is c², not c.' },
  'ref-angle-only': { label: 'giving only the reference angle', hint: 'Sine is positive in two quadrants, so there is a second solution in the given range.' },
  'quadrant-wrong': { label: 'picking the wrong second quadrant', hint: 'For sine the second solution is 180° − the reference angle.' },
  'exact-value-swap': { label: 'mixing up the exact values', hint: 'Check the exact-value triangle again — that is a different angle.' },
  'radian-conversion': { label: 'converting to radians wrongly', hint: 'Multiply degrees by π/180 and simplify the fraction.' },
  'sector-no-half': { label: 'leaving the half out of the sector area', hint: 'Sector area is ½r²θ — the half is easy to drop.' },
  'sector-radius-not-squared': { label: 'not squaring the radius for the area', hint: 'An area needs r², not r.' },
  'arc-radius-squared': { label: 'squaring the radius for the arc length', hint: 'Arc length is rθ. Only the area squares the radius.' },
  'arc-is-circumference': { label: 'giving the whole circle', hint: 'That is the full circumference or area. The sector is only part of it.' },
  'segment-is-sector': { label: 'giving the sector instead of the segment', hint: 'The segment is the sector with the triangle cut off.' },
  'segment-is-triangle': { label: 'giving the triangle instead of the segment', hint: 'That is the triangle. The segment is the sector minus it.' },
  'segment-reversed': { label: 'subtracting the sector from the triangle', hint: 'It is sector minus triangle, that way round.' },
  'pythag-identity': { label: 'mixing up which of sin and cos the identity leaves', hint: '1 − cos²θ is sin²θ, and 1 − sin²θ is cos²θ. Check which one you started with.' },
  'period-multiplied': { label: 'multiplying by b instead of dividing', hint: 'A bigger b squeezes the wave, so the period is 360°/b.' },
  'period-ignored-b': { label: 'ignoring b in the period', hint: 'The coefficient of x changes how fast the wave repeats.' },
  'amplitude-is-b': { label: 'reading the amplitude off the wrong number', hint: 'The amplitude is the coefficient in FRONT of sin, not the one with x.' },
  'amplitude-doubled': { label: 'doubling the amplitude', hint: 'The amplitude is |a| itself — peak to centre, not peak to trough.' },
  'double-angle-no-two': { label: 'dropping the 2 from sin 2θ', hint: 'sin 2θ = 2 sin θ cos θ. The 2 is part of it.' },
  'double-angle-doubled-sin': { label: 'doubling sin θ', hint: 'sin 2θ is not 2 sin θ — doubling the angle is not doubling the ratio.' },
  'double-angle-wrong-identity': { label: 'using the cos 2θ identity', hint: 'cos²θ − sin²θ is cos 2θ. For sin 2θ you want 2 sin θ cos θ.' },
  'double-angle-added': { label: 'adding sin and cos', hint: 'The identity multiplies them, and then doubles.' },
  'harmonic-alpha-inverted': { label: 'taking tan α as a over b', hint: 'For R sin(x + α) the auxiliary angle has tan α = b/a.' },
  'harmonic-r-added': { label: 'adding a and b instead of using Pythagoras', hint: 'R = √(a² + b²).' },
  'domain-not-divided': { label: 'not dividing back to get x', hint: 'You solved for 2x over a domain twice as wide. Divide by 2 to finish.' },

  // Calculus
  'chain-no-inner': { label: 'forgetting to multiply by the inner derivative', hint: 'The chain rule multiplies by the derivative of what is inside the bracket.' },
  'power-not-dropped': { label: 'not dropping the power by one', hint: 'Differentiating takes the power down by one.' },
  'power-not-multiplied': { label: 'not multiplying by the old power', hint: 'The old power comes down as a coefficient.' },
  'chain-inner-twice': { label: 'applying the inner derivative twice', hint: 'The inner derivative is multiplied in once, not squared.' },
  'product-one-term': { label: 'using only one half of the product rule', hint: 'The product rule has two terms: u′v AND uv′.' },
  'product-rule-sign': { label: 'subtracting the two product-rule terms', hint: 'The product rule adds them. It is the quotient rule that subtracts.' },
  'product-multiplied-derivatives': { label: 'multiplying the two derivatives', hint: 'The derivative of a product is not the product of the derivatives.' },
  'quotient-order': { label: 'writing the quotient rule the wrong way round', hint: 'It is u′v − uv′ on top, in that order. Swapping them flips the sign.' },
  'quotient-added': { label: 'adding the two quotient-rule terms', hint: 'The quotient rule subtracts on top. It is the product rule that adds.' },
  'quotient-one-term': { label: 'using only one half of the quotient rule', hint: 'The numerator needs both u′v and uv′.' },
  'trig-derivative-sign': { label: 'putting a minus on the derivative of sin', hint: 'sin differentiates to +cos. It is cos that differentiates to −sin.' },
  'implicit-swapped': { label: 'writing the fraction upside down', hint: 'Collect the dy/dx terms on one side; what multiplies dy/dx ends up on the BOTTOM.' },
  'implicit-y-constant': { label: 'treating y as a constant', hint: 'y is a function of x, so every y term needs a dy/dx by the chain rule.' },
  'int-divide-n': { label: 'dividing by n instead of n + 1', hint: 'Integrating raises the power to n + 1 and divides by the same n + 1.' },
  'int-power-down': { label: 'lowering the power instead of raising it', hint: 'Integrating raises the power; differentiating lowers it.' },
  'classification-swapped': { label: 'calling the maximum a minimum', hint: 'The second derivative is negative at a maximum and positive at a minimum.' },
  'stationary-not-solved': { label: 'not finishing the equation for x', hint: 'You had 3x² = 3k². Take the square root to get x.' },
  'answered-the-wrong-quantity': { label: 'giving a length where an area was asked for', hint: 'Read the question again — it wants the area, not the side.' },
  'optimisation-wrong-constraint': { label: 'using the perimeter as a side', hint: 'The perimeter is all four sides. Each pair of sides adds to half of it.' },
  'parts-sign': { label: 'adding the second integral instead of subtracting', hint: 'By parts is uv − ∫v du. That second piece comes off.' },
  'parts-no-second-term': { label: 'stopping at uv', hint: 'By parts leaves a second integral to do; it is not finished at uv.' },
  'area-reversed': { label: 'subtracting the curves the wrong way round', hint: 'Take the upper curve minus the lower one, or you get a negative area.' },
  'area-one-curve': { label: 'integrating only one of the two curves', hint: 'The area between them is the integral of the difference.' },
  'volume-not-squared': { label: 'not squaring y in the volume formula', hint: 'V = π∫y² dx — the radius of each disc is y, and its area needs y².' },
  'limits-swapped': { label: 'subtracting the limits the wrong way round', hint: 'It is F(top) − F(bottom).' },
  'upper-only': { label: 'only substituting the upper limit', hint: 'Both limits go in, and the lower one is subtracted.' },

  // Differential equations
  'de-integration-slip': { label: 'integrating the right-hand side wrongly', hint: 'Integrate it properly before exponentiating — kx becomes kx²/2, not kx.' },
  'de-constant-misplaced': { label: 'putting the initial value in the exponent', hint: 'The initial condition fixes the constant out the front, not the power.' },
  'if-sign': { label: 'getting the sign of the integrating factor wrong', hint: 'The factor is e raised to ∫P dx, with P exactly as it appears in dy/dx + Py = Q.' },
  'if-no-integral': { label: 'not integrating P at all', hint: 'The integrating factor exponentiates the INTEGRAL of P, not P itself.' },
  'aux-root-sign': { label: 'reading the roots off without changing sign', hint: 'A factor (m − 3) gives the root m = 3, so the solution carries e^{3x}.' },
  'aux-coefficients-as-roots': { label: 'using the coefficients as the roots', hint: 'The coefficients of the auxiliary equation are not its solutions — solve it first.' },
  'growth-ratio-inverted': { label: 'dividing the readings the wrong way round', hint: 'It is the later value over the earlier one, so a growing population gives a positive k.' },
  'growth-is-linear': { label: 'treating the growth as a straight line', hint: 'Exponential growth is not a constant amount per year — you need a log.' },
  'growth-forgot-n0': { label: 'leaving out the starting value', hint: 'It is ln of the RATIO, so the starting value has to be divided out first.' },
  'growth-no-log': { label: 'not taking a log at all', hint: 'To bring k down out of the exponent you take a natural log of both sides.' },

  // Simultaneous equations and linear systems
  //
  // The x/y swap is the one that matters here, and it is the reason every
  // multi-value template in this group sets `mcqOrdered: true` — without it the
  // framework reads the swap as the answer reordered and throws it away, which
  // deletes the single most common mistake in the topic.
  'sim-swap-vars': { label: 'attaching the values to the wrong letters', hint: 'Every number is right — they are on the wrong variables. The one you eliminated first is the one you solved for last.' },
  'sim-elim-sign': { label: 'adding the equations when the signs already matched', hint: 'You add to cancel when the signs are opposite, and subtract when they match. Adding here doubled the term instead of removing it.' },
  'sim-no-scale': { label: 'adding the equations without matching a coefficient first', hint: 'Nothing cancels until one variable has the same sized coefficient in both equations. Multiply one equation through first.' },
  'cramer-col': { label: 'replacing the wrong column with the constants', hint: 'For x you replace the x column, for y the y column. Exactly one column changes each time.' },
  'cramer-no-det': { label: 'forgetting to divide by the determinant', hint: "Cramer's rule gives a fraction — the replaced determinant sits over det A, not on its own." },
  'inv-order': { label: 'multiplying the two matrices the wrong way round', hint: 'Matrix multiplication does not commute. AX = B gives X = A⁻¹B, with the inverse on the LEFT.' },
  'inv-no-recip': { label: 'leaving out the 1 ÷ det factor', hint: 'The inverse is 1/det times the swapped-and-negated matrix. Rearranging the entries is only half of it.' },
  'inv-no-swap': { label: 'not swapping the leading diagonal in the inverse', hint: 'The inverse swaps a and d, and negates b and c. Leaving a and d where they were is the commonest inverse slip.' },
  'det-sign': { label: 'getting the sign wrong in ad − bc', hint: 'The determinant subtracts: ad − bc. Adding bc instead flips the answer.' },
  // Not "det = 0 means no solutions" — that student still computes the right k.
  // The slip that changes the number is looking at the coefficient of x instead
  // of the determinant, which lands on zero.
  'det-zero-coeff': { label: 'setting the coefficient to zero instead of the determinant', hint: 'It is the determinant that has to be zero, not the coefficient of x. Set ad − bc = 0 and solve for k from there.' },

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

/**
 * A 2×2 system with an integer solution, plus the wrong values a student
 * actually reaches. Shared by the two elimination templates below: the
 * arithmetic is the same whether the equations are handed over or have to be
 * built out of a word problem, and keeping two copies of the guard list invited
 * them to drift apart.
 *
 * Every exclusion here protects a named distractor. Do not relax one without
 * reading which:
 *
 *   x0 !== y0, both non-zero  the `sim-swap-vars` option IS the answer otherwise
 *   a1 !== a2, |b1| !== |b2|  a coefficient that already matches makes
 *                             `sim-no-scale` the correct method
 *   det !== 0                 there has to BE a unique solution
 *   finite, distinct wrongs   an option that is non-finite or lands on the
 *                             answer gets thrown away and the template falls
 *                             back to self-marking
 */
function pick2x2(positive) {
  let x0, y0, a1, b1, a2, b2, c1, c2, m, k1, k2, yAdd, yRaw;
  do {
    // `positive` is for the word problem, where the unknowns are prices: a
    // negative answer there is not a harder question, it is a nonsensical one.
    x0 = positive ? PR.int(1, 9) : PR.nz(-6, 7);
    y0 = positive ? PR.int(1, 9) : PR.nz(-6, 7);
    a1 = PR.int(2, 4);
    a2 = PR.int(2, 5);
    b1 = positive ? PR.int(1, 5) : PR.nz(-5, 5);
    b2 = positive ? PR.int(1, 5) : PR.nz(-5, 5);
    m = PR.lcm(a1, a2); k1 = m / a1; k2 = m / a2;
    c1 = a1 * x0 + b1 * y0;
    c2 = a2 * x0 + b2 * y0;
    // Adding the scaled equations when the x terms already match, instead of
    // subtracting: the y term doubles rather than cancelling.
    yAdd = (c1 * k1 + c2 * k2) / (b1 * k1 + b2 * k2);
    // Subtracting the equations as they stand, ignoring the x term left behind.
    yRaw = (c1 - c2) / (b1 - b2);
  } while (
    x0 === y0
    || a1 === a2 || Math.abs(b1) === Math.abs(b2)
    || a1 * b2 - a2 * b1 === 0
    || b1 * k1 + b2 * k2 === 0 || b1 === b2
    || yAdd === y0 || yRaw === y0
  );
  return { x0, y0, a1, b1, a2, b2, c1, c2, m, k1, k2, yAdd, yRaw };
}

/** The elimination working, as the steps both 2×2 templates show. */
function eliminationSteps(w, xv, yv) {
  const { a1, b1, a2, b2, c1, c2, m, k1, k2, x0, y0 } = w;
  const yCoeff = b1 * k1 - b2 * k2;
  const yConst = c1 * k1 - c2 * k2;
  const steps = [
    `\\text{(1) } ${PR.lead(a1, xv)}${PR.xt(b1, yv)} = ${c1}`
    + `\\quad \\text{(2) } ${PR.lead(a2, xv)}${PR.xt(b2, yv)} = ${c2}`,
  ];
  if (k1 > 1) {
    steps.push(`(1) \\times ${k1}: \\ ${PR.lead(m, xv)}${PR.xt(b1 * k1, yv)} = ${c1 * k1}`);
  }
  if (k2 > 1) {
    steps.push(`(2) \\times ${k2}: \\ ${PR.lead(m, xv)}${PR.xt(b2 * k2, yv)} = ${c2 * k2}`);
  }
  steps.push(
    `\\text{Subtract to remove } ${xv}: \\ ${PR.lead(yCoeff, yv)} = ${yConst}`,
    `${yv} = \\frac{${yConst}}{${yCoeff}} = ${y0}`,
    `\\text{Into (1): } ${PR.lead(a1, xv)} ${PR.s(b1 * y0)} = ${c1}, \\text{ so } ${xv} = ${x0}`,
  );
  return steps;
}

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
    id: 'sim-elimination', skill: 'simultaneous-equations', topic: 'Simultaneous equations',
    keywords: ['simultaneous', 'elimination', 'system', 'two unknowns'],
    // Position carries meaning: "x = 2, y = 3" and "x = 3, y = 2" are different
    // answers, and mixing the two up is the commonest slip in the whole topic.
    // Without this flag the framework reads the swap as the answer reordered and
    // drops it - see mcqOrdered in practice-mcq.js.
    mcqOrdered: true,
    generate() {
      const w = pick2x2(false);
      const { x0, y0, a1, b1, a2, b2, c1, c2 } = w;
      return {
        // gather, not one line: at 360dp a prompt beside a cases block overflows
        // the phone, and KaTeX will not wrap. Stacking keeps the width to the
        // widest single line. Every question in this group is built this way.
        question: '\\begin{gathered} \\text{Solve simultaneously} \\\\ \\begin{cases}'
          + `${PR.lead(a1)}${PR.xt(b1, 'y')} = ${c1} \\\\ ${PR.lead(a2)}${PR.xt(b2, 'y')} = ${c2}`
          + '\\end{cases} \\end{gathered}',
        steps: eliminationSteps(w, 'x', 'y'),
        answer: `x = ${x0}, \\ y = ${y0}`,
        // Two lines crossing at the solution - the picture that makes "solving a
        // system" mean something. Both b coefficients are non-zero by
        // construction, which is what lets each equation be drawn as y = f(x).
        viz: {
          type: 'poly',
          coeffs: [c1 / b1, -a1 / b1],
          extra: [{ coeffs: [c2 / b2, -a2 / b2] }],
          vertex: [x0, y0],
        },
        w,
      };
    },
    distractors({ x0, y0, a1, b1, c1, yAdd, yRaw }) {
      const xFrom = (y) => PR.r((c1 - b1 * y) / a1, 2);
      return [
        { latex: `x = ${y0}, \\ y = ${x0}`, why: 'sim-swap-vars' },
        { latex: `x = ${PR.r(xFrom(yAdd), 2)}, \\ y = ${PR.r(yAdd, 2)}`, why: 'sim-elim-sign' },
        { latex: `x = ${PR.r(xFrom(yRaw), 2)}, \\ y = ${PR.r(yRaw, 2)}`, why: 'sim-no-scale' },
        { latex: `x = ${c1 - b1 * y0}, \\ y = ${y0}`, why: 'no-divide' },
      ];
    },
  },
  {
    id: 'sim-substitution', skill: 'simultaneous-equations', topic: 'Simultaneous equations',
    keywords: ['simultaneous', 'substitution', 'system', 'two unknowns'],
    mcqOrdered: true, // same reason as sim-elimination
    generate() {
      let x0, y0, mm, kk, a, b, c, denom, xNoDist, xSign, xNoDiv;
      do {
        x0 = PR.nz(-6, 7);
        mm = PR.nz(-4, 4);
        kk = PR.nz(-8, 8);
        y0 = mm * x0 + kk;
        a = PR.nz(-5, 6);
        // |b| = 1 would print "1(2x - 1)" in the working, and at b = 1 the
        // `composite-no-distribute` option is the correct answer anyway.
        b = PR.choice([-5, -4, -3, -2, 2, 3, 4, 5]);
        denom = a + b * mm;
        c = a * x0 + b * y0;
        xNoDist = (c - kk) / denom;   // multiplied b through mx but not through k
        xSign = (c + b * kk) / denom; // moved bk across without changing its sign
        xNoDiv = c - b * kk;          // never divided by the collected coefficient
      } while (
        // Non-zero and distinct, or `sim-swap-vars` is the answer.
        x0 === y0 || y0 === 0 || denom === 0
        // At |denom| = 1 there is no final division, so `no-divide` is correct.
        || Math.abs(denom) === 1
        || xNoDist === x0 || xSign === x0
        // Two options landing on the same x land on the same option, which costs
        // the question a distractor and drops the student to self-marking.
        || xNoDist === xNoDiv || xSign === xNoDiv
        || (xNoDiv === y0 && mm * xNoDiv + kk === x0)
      );
      return {
        question: '\\begin{gathered} \\text{Solve simultaneously} \\\\ \\begin{cases}'
          + `y = ${PR.lead(mm)}${PR.ct(kk)} \\\\ ${PR.lead(a)}${PR.xt(b, 'y')} = ${c}`
          + '\\end{cases} \\end{gathered}',
        steps: [
          `\\text{Substitute } y = ${PR.lead(mm)}${PR.ct(kk)} \\text{ into (2):}`,
          `${PR.lead(a)} ${PR.s(b)}(${PR.lead(mm)}${PR.ct(kk)}) = ${c}`,
          `${PR.lead(a)}${PR.xt(b * mm)} ${PR.s(b * kk)} = ${c}`,
          `${PR.lead(denom)} = ${c} ${PR.s(-b * kk)} = ${c - b * kk}`,
          `x = \\frac{${c - b * kk}}{${denom}} = ${x0}`,
          `\\text{Then } y = ${mm * x0}${PR.ct(kk)} = ${y0}`,
        ],
        answer: `x = ${x0}, \\ y = ${y0}`,
        viz: {
          type: 'poly',
          coeffs: [kk, mm],
          extra: [{ coeffs: [c / b, -a / b] }],
          vertex: [x0, y0],
        },
        w: { x0, y0, mm, kk, a, b, c, denom, xNoDist, xSign },
      };
    },
    distractors({ x0, y0, mm, kk, b, c, denom, xNoDist, xSign }) {
      const yFrom = (x) => PR.r(mm * x + kk, 2);
      return [
        { latex: `x = ${y0}, \\ y = ${x0}`, why: 'sim-swap-vars' },
        { latex: `x = ${PR.r(xNoDist, 2)}, \\ y = ${yFrom(xNoDist)}`, why: 'composite-no-distribute' },
        { latex: `x = ${PR.r(xSign, 2)}, \\ y = ${yFrom(xSign)}`, why: 'move-sign' },
        { latex: `x = ${c - b * kk}, \\ y = ${yFrom(c - b * kk)}`, why: 'no-divide' },
      ];
    },
  },
  {
    id: 'sim-word', skill: 'simultaneous-equations', topic: 'Simultaneous equations',
    keywords: ['simultaneous', 'word problem', 'system', 'two unknowns'],
    // The arithmetic is sim-elimination's. What this template tests is turning
    // sentences into two equations, which is where the marks are actually lost -
    // so the working starts by stating the system it built.
    mcqOrdered: true,
    generate() {
      const w = pick2x2(true);
      const { x0, y0, a1, b1, a2, b2, c1, c2 } = w;
      // "1 nuts" is the same class of artifact as "1x": the maths is right and
      // the sentence is wrong, and nothing downstream would ever catch it.
      const qty = (q, word) => `${q} ${word}${q === 1 ? '' : 's'}`;
      return {
        question: '\\begin{gathered} \\text{A bolt costs } b, \\text{ a nut } n. \\\\ '
          + `\\text{${qty(a1, 'bolt')} and ${qty(b1, 'nut')} cost ${c1} dollars.} \\\\ `
          + `\\text{${qty(a2, 'bolt')} and ${qty(b2, 'nut')} cost ${c2} dollars.} \\\\ `
          + '\\text{Find } b \\text{ and } n. \\end{gathered}',
        steps: eliminationSteps(w, 'b', 'n'),
        answer: `b = ${x0}, \\ n = ${y0}`,
        w,
      };
    },
    distractors({ x0, y0, a1, b1, c1, yAdd, yRaw }) {
      const xFrom = (y) => PR.r((c1 - b1 * y) / a1, 2);
      return [
        { latex: `b = ${y0}, \\ n = ${x0}`, why: 'sim-swap-vars' },
        { latex: `b = ${PR.r(xFrom(yAdd), 2)}, \\ n = ${PR.r(yAdd, 2)}`, why: 'sim-elim-sign' },
        { latex: `b = ${PR.r(xFrom(yRaw), 2)}, \\ n = ${PR.r(yRaw, 2)}`, why: 'sim-no-scale' },
        { latex: `b = ${c1 - b1 * y0}, \\ n = ${y0}`, why: 'no-divide' },
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
          // PR.par on the base (an exponent needs brackets only when negative),
          // PR.brk on both factors: a >= 2 always, so "4${PR.par(a)}" fused every
          // single generation — "4^2 - 426" for 4^2 - 4(2)(6).
          `\\Delta = b^2 - 4ac = ${PR.par(b)}^2 - 4${PR.brk(a)}${PR.brk(c)} = ${disc}`,
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
      let a, b, c, d, re, im;
      do {
        a = PR.nz(-4, 4); b = PR.nz(-4, 4);
        c = PR.nz(-4, 4); d = PR.nz(-4, 4);
        re = a * c - b * d; im = a * d + b * c;
        // Both imaginary parts used below must be non-zero. PR.xt vanishes at 0,
        // so an im of 0 would render the answer as a bare real number while every
        // distractor still carried an i — the answer identifiable by its form
        // alone, which is the thing check-practice's shape rule exists to stop.
        // (The old PR.s spelling hid this by printing "+ 0i" instead.)
        // re is here for the same reason: the complex-swap distractor puts it in
        // the imaginary slot, so a zero re would collapse that option to a bare
        // integer.
      } while (im === 0 || re === 0 || a * d - b * c === 0);
      return {
        // PR.xt, not PR.s, for every imaginary term: it drops a coefficient of 1,
        // so this reads "(4 - i)" rather than "(4 - 1i)", and it carries its own
        // sign, so the chains below no longer print "+ -6i".
        question: `\\text{Expand } (${a}${PR.xt(b, 'i')})(${c}${PR.xt(d, 'i')})`,
        steps: [
          `${PR.par(a)} \\cdot ${PR.par(c)} + ${PR.par(a)} \\cdot ${PR.par(d)}i`
            + ` + ${PR.par(b)}i \\cdot ${PR.par(c)} + ${PR.par(b)}i \\cdot ${PR.par(d)}i`,
          `= ${a * c}${PR.xt(a * d, 'i')}${PR.xt(b * c, 'i')}${PR.xt(b * d, 'i^2')}`,
          `i^2 = -1: \\quad ${a * c} - ${PR.par(b * d)} + (${a * d} ${PR.s(b * c)})i`,
          `= ${re}${PR.xt(im, 'i')}`,
        ],
        answer: `${re}${PR.xt(im, 'i')}`,
        w: { a, b, c, d, re, im },
      };
    },
    distractors({ a, b, c, d, re, im }) {
      return [
        { latex: `${a * c + b * d}${PR.xt(im, 'i')}`, why: 'complex-real-sign' },
        { latex: `${im}${PR.xt(re, 'i')}`, why: 'complex-swap' },
        { latex: `${re}${PR.xt(a * d - b * c, 'i')}`, why: 'complex-real-sign' },
        { latex: `${a * c}${PR.xt(b * d, 'i')}`, why: 'cross-term' },
        { latex: `${a * c + b * d}${PR.xt(a * d - b * c, 'i')}`, why: 'complex-real-sign' },
      ];
    },
  },
  {
    id: 'demoivre', skill: 'complex-polar', topic: 'Complex numbers', keywords: ['de moivre', 'polar', 'power'],
    // Position carries meaning in this answer, so a distractor can share its
    // numbers without being the same answer - see mcqOrdered in practice-mcq.js.
    mcqOrdered: true,
    generate() {
      let r, th, n, nth;
      do {
        r = PR.choice([1, 2]);
        th = PR.choice([30, 45, 60]);
        n = PR.choice([2, 3]);
        nth = th * n;
        // Two draws print an artifact rather than a complex number, and both are
        // on the line the student copies down:
        //   n0 = 180  ->  sin is 0, so the answer reads "-1 + 0i"
        //   n0 = 90 with r = 1  ->  sin is exactly 1, so it reads "0 + 1i", and
        //     the demoivre-multiply-r distractor form(r, th*n) reuses r as its
        //     modulus, so it prints the same thing.
        // Excluded here rather than spelled with PR.xt, because the distractors
        // must share the answer's format and their moduli and angles are derived
        // (r*n, r^n, th+n) — there is no single format that is safe for all of
        // them. This costs 4 of the 12 parameter combinations.
      } while (nth === 180 || (nth === 90 && r === 1));
      const rn = Math.pow(r, n);
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
          `\\frac{d}{dx}${PR.lead(a, `x^{${n}}`)} = ${PR.lead(a * n, `x^{${n - 1}}`)}`,
          // PR.lead, not PR.par: at b = 1 the latter printed "1x^2".
          `\\frac{d}{dx}${PR.lead(b, 'x^2')} = ${PR.lead(2 * b)}, \\quad \\frac{d}{dx}${PR.lead(c)} = ${c}`,
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
          // PR.s carries the sign, so a negative common difference reads
          // "(10 - 14)" rather than "(10 + -14)" — about 40% of draws. Step 1 of
          // this same template already brackets d, so the two now agree.
          `S_{${n}} = \\tfrac{n}{2}(2a + (n-1)d) = \\tfrac{${n}}{2}(${2 * a} ${PR.s((n - 1) * d)})`,
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
          // PR.s carries the sign of each later component, so a negative one reads
          // "- 5(-3)" rather than "+ -5(-3)"; PR.brk keeps the product visible.
          `\\vec a \\cdot \\vec b = ${a[0]}${PR.brk(b[0])} ${PR.s(a[1])}${PR.brk(b[1])}`
            + ` ${PR.s(a[2])}${PR.brk(b[2])} = ${dot}`,
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
          `\\det A = ad - bc = ${a}${PR.brk(d)} - ${PR.par(b)}${PR.brk(c)} = ${det}`,
          `A^{-1} = \\frac{1}{${det}}\\begin{pmatrix} ${d} & ${-b} \\\\ ${-c} & ${a} \\end{pmatrix}`,
          `A^{-1} = \\begin{pmatrix} ${PR.r(d / det, 3)} & ${PR.r(-b / det, 3)} \\\\ ${PR.r(-c / det, 3)} & ${PR.r(a / det, 3)} \\end{pmatrix}`,
        ],
        answer: `\\det A = ${det}`,
      };
    },
  },
  {
    id: 'sim-3x3', skill: 'linear-systems', topic: 'Linear systems',
    keywords: ['linear system', 'three unknowns', 'elimination', 'gaussian'],
    mcqOrdered: true, // three values in fixed places - see sim-elimination
    // No viz: three planes meeting at a point is not a picture a 600x280 canvas
    // makes clearer than the working does.
    generate() {
      let x0, y0, z0, a2, b2, c2, a3, b3, c3, s1, s2, s3;
      let B2, C2, S2, B3, C3, S3, zCoeff, zConst, zAdd, yBad;
      do {
        // Distinct: any two equal and the "wrong letters" option is the answer.
        x0 = PR.nz(-5, 6); y0 = PR.nz(-5, 6); z0 = PR.nz(-5, 6);
        // Row 1 is x + y + z so the two eliminations are subtractions of a
        // multiple of it — the shape every textbook starts from.
        a2 = PR.int(2, 4); b2 = PR.nz(-3, 3); c2 = PR.nz(-3, 3);
        a3 = PR.int(2, 4); b3 = PR.nz(-3, 3); c3 = PR.nz(-3, 3);
        s1 = x0 + y0 + z0;
        s2 = a2 * x0 + b2 * y0 + c2 * z0;
        s3 = a3 * x0 + b3 * y0 + c3 * z0;
        // (2) - a2(1) and (3) - a3(1), leaving two equations in y and z.
        B2 = b2 - a2; C2 = c2 - a2; S2 = s2 - a2 * s1;
        B3 = b3 - a3; C3 = c3 - a3; S3 = s3 - a3 * s1;
        zCoeff = C2 * B3 - C3 * B2;
        zConst = S2 * B3 - S3 * B2;
        zAdd = (S2 * B3 + S3 * B2) / (C2 * B3 + C3 * B2);
        // Correct z, then the sign of the C2 z term dropped on the way back.
        // Deliberately a NEAR miss: in three variables the back-substitution
        // amplifies everything, and a distractor an order of magnitude out is
        // one the student eliminates on sight instead of doing the maths.
        yBad = (S2 + C2 * z0) / B2;
      } while (
        x0 === y0 || y0 === z0 || x0 === z0
        || zCoeff === 0 || B2 === 0 || B3 === 0
        // Every distractor below has to be finite and off the answer.
        || C2 * B3 + C3 * B2 === 0
        || zAdd === z0 || zConst === z0 || yBad === y0
      );
      return {
        question: '\\begin{gathered} \\text{Solve} \\\\ \\begin{cases}'
          + `x + y + z = ${s1} \\\\ `
          + `${PR.lead(a2)}${PR.xt(b2, 'y')}${PR.xt(c2, 'z')} = ${s2} \\\\ `
          + `${PR.lead(a3)}${PR.xt(b3, 'y')}${PR.xt(c3, 'z')} = ${s3}`
          + '\\end{cases} \\end{gathered}',
        steps: [
          `\\text{(2)} - ${a2}\\text{(1)}: \\ ${PR.lead(B2, 'y')}${PR.xt(C2, 'z')} = ${S2}`,
          `\\text{(3)} - ${a3}\\text{(1)}: \\ ${PR.lead(B3, 'y')}${PR.xt(C3, 'z')} = ${S3}`,
          `\\text{Eliminate } y: \\ ${PR.lead(zCoeff, 'z')} = ${zConst}`,
          `z = \\frac{${zConst}}{${zCoeff}} = ${z0}`,
          `\\text{Then } ${PR.lead(B2, 'y')} ${PR.s(C2 * z0)} = ${S2} \\Rightarrow y = ${y0}`,
          `\\text{Into (1): } x = ${s1} ${PR.s(-y0)} ${PR.s(-z0)} = ${x0}`,
        ],
        answer: `x = ${x0}, \\ y = ${y0}, \\ z = ${z0}`,
        w: { x0, y0, z0, B2, C2, S2, zCoeff, zConst, zAdd, yBad, s1 },
      };
    },
    distractors({ x0, y0, z0, B2, C2, S2, zConst, zAdd, yBad, s1 }) {
      // Carry each wrong z through the same back-substitution the student would.
      const from = (z) => {
        const y = (S2 - C2 * z) / B2;
        return { y: PR.r(y, 2), x: PR.r(s1 - y - z, 2) };
      };
      const a = from(zAdd); const n = from(zConst);
      return [
        { latex: `x = ${z0}, \\ y = ${x0}, \\ z = ${y0}`, why: 'sim-swap-vars' },
        { latex: `x = ${PR.r(s1 - yBad - z0, 2)}, \\ y = ${PR.r(yBad, 2)}, \\ z = ${z0}`, why: 'move-sign' },
        { latex: `x = ${a.x}, \\ y = ${a.y}, \\ z = ${PR.r(zAdd, 2)}`, why: 'sim-elim-sign' },
        { latex: `x = ${n.x}, \\ y = ${n.y}, \\ z = ${zConst}`, why: 'no-divide' },
      ];
    },
  },
  {
    id: 'sim-cramer', skill: 'linear-systems', topic: 'Linear systems',
    keywords: ['cramer', 'determinant', 'linear system', 'two unknowns'],
    mcqOrdered: true, // same reason as sim-elimination
    generate() {
      let x0, y0, a, b, c, d, e, f, det, Dx, Dy, tx, ty;
      do {
        x0 = PR.nz(-6, 7); y0 = PR.nz(-6, 7);
        a = PR.nz(-4, 5); b = PR.nz(-4, 5); c = PR.nz(-4, 5); d = PR.nz(-4, 5);
        det = a * d - b * c;
        e = a * x0 + b * y0;
        f = c * x0 + d * y0;
        Dx = e * d - b * f;
        Dy = a * f - e * c;
        // Rows instead of columns when building the replaced determinant.
        tx = (e * d - c * f) / det;
        ty = (a * f - e * b) / det;
      } while (
        x0 === y0 || det === 0
        // At |det| = 1 the division does nothing, so `cramer-no-det` is correct.
        || Math.abs(det) === 1
        || tx === x0 || ty === y0 || (tx === y0 && ty === x0)
      );
      return {
        question: "\\begin{gathered} \\text{Use Cramer's rule} \\\\ \\begin{cases}"
          + `${PR.lead(a)}${PR.xt(b, 'y')} = ${e} \\\\ ${PR.lead(c)}${PR.xt(d, 'y')} = ${f}`
          + '\\end{cases} \\end{gathered}',
        steps: [
          `\\det A = \\begin{vmatrix} ${a} & ${b} \\\\ ${c} & ${d} \\end{vmatrix}`
            + ` = ${a}${PR.brk(d)} - ${PR.par(b)}${PR.brk(c)} = ${det}`,
          // The explanation gets its own line: at 360dp a sentence beside a
          // determinant overflows the phone, and KaTeX will not wrap.
          '\\text{Swap the constants into the } x \\text{ column:}',
          `D_x = \\begin{vmatrix} ${e} & ${b} \\\\ ${f} & ${d} \\end{vmatrix} = ${Dx}`,
          `D_y = \\begin{vmatrix} ${a} & ${e} \\\\ ${c} & ${f} \\end{vmatrix} = ${Dy}`,
          `x = \\frac{${Dx}}{${det}} = ${x0}, \\quad y = \\frac{${Dy}}{${det}} = ${y0}`,
        ],
        answer: `x = ${x0}, \\ y = ${y0}`,
        viz: {
          type: 'poly',
          coeffs: [e / b, -a / b],
          extra: [{ coeffs: [f / d, -c / d] }],
          vertex: [x0, y0],
        },
        w: { x0, y0, Dx, Dy, tx, ty },
      };
    },
    distractors({ x0, y0, Dx, Dy, tx, ty }) {
      return [
        { latex: `x = ${y0}, \\ y = ${x0}`, why: 'cramer-col' },
        { latex: `x = ${Dx}, \\ y = ${Dy}`, why: 'cramer-no-det' },
        { latex: `x = ${-x0}, \\ y = ${-y0}`, why: 'det-sign' },
        { latex: `x = ${PR.r(tx, 2)}, \\ y = ${PR.r(ty, 2)}`, why: 'cramer-col' },
      ];
    },
  },
  {
    id: 'sim-matrix-solve', skill: 'linear-systems', topic: 'Linear systems',
    keywords: ['matrix', 'inverse', 'linear system', 'AX = B'],
    mcqOrdered: true, // same reason as sim-elimination
    generate() {
      let x0, y0, a, b, c, d, e, f, det, noSwapX, noSwapY, orderX, orderY;
      do {
        x0 = PR.nz(-6, 7); y0 = PR.nz(-6, 7);
        a = PR.nz(-4, 5); b = PR.nz(-4, 5); c = PR.nz(-4, 5); d = PR.nz(-4, 5);
        det = a * d - b * c;
        e = a * x0 + b * y0;
        f = c * x0 + d * y0;
        // Left a and d where they were instead of swapping them.
        noSwapX = (a * e - b * f) / det;
        noSwapY = (-c * e + d * f) / det;
        // Forced B A^-1 rather than A^-1 B: the inverse ends up transposed.
        orderX = (d * e - c * f) / det;
        orderY = (-b * e + a * f) / det;
      } while (
        x0 === y0 || det === 0
        // At |det| = 1 the 1/det factor does nothing, so `inv-no-recip` is right.
        || Math.abs(det) === 1
        || noSwapX === x0 || orderX === x0
        || (noSwapX === y0 && noSwapY === x0) || (orderX === y0 && orderY === x0)
      );
      return {
        question: '\\begin{gathered} \\text{Solve } A\\mathbf{x} = \\mathbf{b} \\text{ for} \\\\ '
          + `A = \\begin{pmatrix} ${a} & ${b} \\\\ ${c} & ${d} \\end{pmatrix},`
          + `\\ \\mathbf{b} = \\begin{pmatrix} ${e} \\\\ ${f} \\end{pmatrix} \\end{gathered}`,
        steps: [
          `\\det A = ${a}${PR.brk(d)} - ${PR.par(b)}${PR.brk(c)} = ${det}`,
          `A^{-1} = \\frac{1}{${det}}\\begin{pmatrix} ${d} & ${-b} \\\\ ${-c} & ${a} \\end{pmatrix}`,
          '\\mathbf{x} = A^{-1}\\mathbf{b} \\quad \\text{(inverse on the LEFT)}',
          `\\mathbf{x} = \\frac{1}{${det}}\\begin{pmatrix} ${d}${PR.brk(e)} ${PR.s(-b * f)} \\\\`
            + ` ${-c}${PR.brk(e)} ${PR.s(a * f)} \\end{pmatrix}`
            + ` = \\begin{pmatrix} ${x0} \\\\ ${y0} \\end{pmatrix}`,
        ],
        answer: `x = ${x0}, \\ y = ${y0}`,
        viz: {
          type: 'poly',
          coeffs: [e / b, -a / b],
          extra: [{ coeffs: [f / d, -c / d] }],
          vertex: [x0, y0],
        },
        w: { x0, y0, det, noSwapX, noSwapY, orderX, orderY },
      };
    },
    distractors({ x0, y0, det, noSwapX, noSwapY, orderX, orderY }) {
      return [
        { latex: `x = ${PR.r(noSwapX, 2)}, \\ y = ${PR.r(noSwapY, 2)}`, why: 'inv-no-swap' },
        { latex: `x = ${det * x0}, \\ y = ${det * y0}`, why: 'inv-no-recip' },
        { latex: `x = ${PR.r(orderX, 2)}, \\ y = ${PR.r(orderY, 2)}`, why: 'inv-order' },
        { latex: `x = ${y0}, \\ y = ${x0}`, why: 'sim-swap-vars' },
      ];
    },
  },
  {
    id: 'sim-consistency', skill: 'linear-systems', topic: 'Linear systems',
    keywords: ['consistency', 'determinant', 'singular', 'linear system'],
    // Single-valued, so the reordering guard must stay ON: there is nothing here
    // that a reordering could legitimately mean. No mcqOrdered.
    generate() {
      let b, d, mm, c, k0, e, f;
      do {
        b = PR.nz(-5, 5);
        // d >= 2 so there IS a division to forget - at d = 1 the `no-divide`
        // option is the answer.
        d = PR.int(2, 5);
        mm = PR.nz(-4, 4);
        c = mm * d;          // keeps k0 = bc/d a whole number
        k0 = b * mm;
        e = PR.nz(-9, 9);
        f = PR.nz(-9, 9);
      } while (
        k0 === 0 || Math.abs(k0) === Math.abs(b * c)
        // Parallel, not identical: at e/b === f/d the answer is "infinitely
        // many" rather than "none", and the question stops having one answer.
        || e * d === f * b
      );
      return {
        question: '\\begin{gathered} \\text{For which } k \\text{ does this system} \\\\ '
          + '\\text{have no unique solution?} \\\\ \\begin{cases}'
          + `kx${PR.xt(b, 'y')} = ${e} \\\\ ${PR.lead(c)}${PR.xt(d, 'y')} = ${f}`
          + '\\end{cases} \\end{gathered}',
        steps: [
          '\\text{No unique solution when } \\det A = 0.',
          `\\det \\begin{vmatrix} k & ${b} \\\\ ${c} & ${d} \\end{vmatrix}`
            + ` = ${d}k - ${PR.par(b)}${PR.brk(c)} = 0`,
          `${d}k = ${b * c}`,
          `k = \\frac{${b * c}}{${d}} = ${k0}`,
        ],
        answer: `k = ${k0}`,
        // Both lines at k = k0: the point is that they never meet.
        viz: {
          type: 'poly',
          coeffs: [e / b, -k0 / b],
          extra: [{ coeffs: [f / d, -c / d] }],
        },
        w: { b, c, d, k0 },
      };
    },
    distractors({ b, c, d, k0 }) {
      return [
        { latex: `k = ${b * c}`, why: 'no-divide' },
        { latex: `k = ${-k0}`, why: 'det-sign' },
        { latex: 'k = 0', why: 'det-zero-coeff' },
        { latex: `k = ${-b * c}`, why: 'det-sign' },
      ];
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

  // ---- Coordinate geometry ---------------------------------------------------------
  {
    id: 'coord-distance', skill: 'coordinate-geometry', topic: 'Coordinate geometry',
    keywords: ['distance', 'midpoint', 'coordinate', 'two points'],
    // "distance = 10, midpoint = (3, 4)" — two different quantities, so a
    // distractor may share its numbers without being the same answer.
    mcqOrdered: true,
    generate() {
      // Pythagorean legs so the distance comes out whole, and an even sum on
      // both coordinates so the midpoint does too. Both matter: a student
      // checking their arithmetic against an ugly surd learns nothing.
      const [dx, dy, d] = PR.choice([[3, 4, 5], [6, 8, 10], [5, 12, 13], [8, 6, 10], [9, 12, 15]]);
      const sx = PR.choice([1, -1]); const sy = PR.choice([1, -1]);
      const x1 = PR.int(-6, 6) * 2; const y1 = PR.int(-6, 6) * 2;
      const x2 = x1 + sx * dx * 2; const y2 = y1 + sy * dy * 2;
      const mx = (x1 + x2) / 2; const my = (y1 + y2) / 2;
      const dist = 2 * d;
      return {
        question: `\\text{For } A(${x1}, ${y1}) \\text{ and } B(${x2}, ${y2}), \\text{ find } AB \\text{ and the midpoint}`,
        steps: [
          `\\Delta x = ${x2} - ${PR.par(x1)} = ${x2 - x1}, \\quad \\Delta y = ${y2} - ${PR.par(y1)} = ${y2 - y1}`,
          // PR.par on both: a bare "-16^2" reads as -(16^2) = -256, which is a
          // different and wrong number from (-16)^2.
          `AB = \\sqrt{${PR.par(x2 - x1)}^2 + ${PR.par(y2 - y1)}^2} = \\sqrt{${(x2 - x1) ** 2 + (y2 - y1) ** 2}} = ${dist}`,
          `M = \\left(\\frac{${x1} + ${PR.par(x2)}}{2}, \\frac{${y1} + ${PR.par(y2)}}{2}\\right) = (${mx}, ${my})`,
        ],
        answer: `AB = ${dist}, \\quad M = (${mx}, ${my})`,
        viz: {
          type: 'points',
          points: [[x1, y1, 'A'], [x2, y2, 'B']],
          segments: [[0, 1]],
          mark: [mx, my, 'M'],
        },
        w: { x1, y1, x2, y2, mx, my, dist },
      };
    },
    distractors({ x1, y1, x2, y2, mx, my, dist }) {
      const form = (d, a, b, why) =>
        ({ latex: `AB = ${PR.r(d, 3)}, \\quad M = (${PR.r(a, 2)}, ${PR.r(b, 2)})`, why });
      return [
        // Subtracting the coordinates instead of averaging them.
        form(dist, (x2 - x1) / 2, (y2 - y1) / 2, 'midpoint-difference'),
        // Adding the legs rather than using Pythagoras.
        form(Math.abs(x2 - x1) + Math.abs(y2 - y1), mx, my, 'distance-added'),
        form(Math.abs(x2 - x1) + Math.abs(y2 - y1), (x2 - x1) / 2, (y2 - y1) / 2, 'distance-added'),
        // Forgot the square root.
        form((x2 - x1) ** 2 + (y2 - y1) ** 2, mx, my, 'no-sqrt'),
        form(dist, x1 + x2, y1 + y2, 'midpoint-no-halve'),
      ];
    },
  },
  {
    id: 'coord-line', skill: 'coordinate-geometry', topic: 'Coordinate geometry',
    keywords: ['gradient', 'equation of a line', 'straight line', 'coordinate'],
    generate() {
      // Whole-number gradient: the point of the exercise is rise over run, not
      // fraction arithmetic. Non-zero x1 and intercept, because at either of
      // those two of the distractors below land on the answer, and PR.ct drops
      // a zero intercept so the answer would be visibly shorter than the rest.
      let m, x1, y1, c;
      do {
        m = PR.nz(-4, 4);
        x1 = PR.nz(-6, 5);
        y1 = PR.nz(-8, 8); // also non-zero: "y - 0 = ..." reads badly
        c = y1 - m * x1;
      } while (c === 0);
      const run = PR.int(1, 4);
      const x2 = x1 + run; const y2 = y1 + m * run;
      return {
        question: `\\text{Find the equation of the line through } (${x1}, ${y1}) \\text{ and } (${x2}, ${y2})`,
        steps: [
          `m = \\frac{${y2} - ${PR.par(y1)}}{${x2} - ${PR.par(x1)}} = \\frac{${y2 - y1}}{${x2 - x1}} = ${m}`,
          `y - ${PR.par(y1)} = ${m}(x - ${PR.par(x1)})`,
          `y = ${PR.lead(m)}${PR.ct(c)}`,
        ],
        answer: `y = ${PR.lead(m)}${PR.ct(c)}`,
        viz: {
          type: 'points',
          points: [[x1, y1, ''], [x2, y2, '']],
          lines: [{ m, c }],
        },
        w: { m, c, x1, y1, x2, y2 },
      };
    },
    distractors({ m, c, x1, y1, x2, y2 }) {
      const form = (grad, konst, why) =>
        (konst === 0 ? null : { latex: `y = ${PR.lead(grad)}${PR.ct(konst)}`, why });
      return [
        // Run over rise.
        form(PR.r((x2 - x1) / (y2 - y1), 3), c, 'gradient-inverted'),
        form(-m, c, 'gradient-sign'),
        form(m, y1 + m * x1, 'move-sign'),
        form(m, -c, 'move-sign'),
        form(-m, -c, 'gradient-sign'),
        form(PR.r((x2 - x1) / (y2 - y1), 3), y1 + m * x1, 'gradient-inverted'),
      ].filter(Boolean);
    },
  },
  {
    id: 'coord-perpendicular', skill: 'coordinate-geometry', topic: 'Coordinate geometry',
    keywords: ['perpendicular', 'parallel', 'normal', 'gradient', 'coordinate'],
    generate() {
      // The GIVEN gradient is the fraction (1/k) and the perpendicular one is
      // the whole number, not the other way round. That way the answer and
      // every distractor go through PR.lead/PR.ct like every other template, so
      // none of them can be picked out by its shape.
      let k, sign, x1, y1, pm, c;
      do {
        k = PR.int(2, 5);
        sign = PR.choice([1, -1]);
        pm = -sign * k;                 // perpendicular to 1/k is -k
        // y1 non-zero so the point-slope step doesn't read "y - 0 = ...".
        x1 = PR.nz(-5, 5); y1 = PR.nz(-6, 6);
        c = y1 - pm * x1;
      } while (c === 0);
      const mTex = `\\tfrac{${sign}}{${k}}`;
      return {
        question: `\\text{A line has gradient } ${mTex}. \\text{ Find the line perpendicular to it through } (${x1}, ${y1})`,
        steps: [
          `\\text{Perpendicular gradients multiply to } -1`,
          `m_{\\perp} = -\\frac{1}{${mTex}} = ${pm}`,
          `y - ${PR.par(y1)} = ${pm}(x - ${PR.par(x1)})`,
          `y = ${PR.lead(pm)}${PR.ct(c)}`,
        ],
        answer: `y = ${PR.lead(pm)}${PR.ct(c)}`,
        viz: {
          type: 'points', points: [[x1, y1, '']],
          lines: [{ m: pm, c }, { m: sign / k, c: y1 - (sign / k) * x1 }],
        },
        w: { k, sign, pm, x1, y1, c },
      };
    },
    distractors({ k, sign, pm, x1, y1, c }) {
      const m = sign / k; // the given gradient
      const form = (grad, konst, why) =>
        (konst === 0 ? null
          : { latex: `y = ${PR.lead(PR.r(grad, 3))}${PR.ct(PR.r(konst, 3))}`, why });
      return [
        // Flipped but not negated — the classic slip this template exists for.
        form(sign * k, y1 - sign * k * x1, 'perp-no-negate'),
        // Negated but not flipped.
        form(-m, y1 + m * x1, 'perp-no-reciprocal'),
        // Parallel instead of perpendicular.
        form(m, y1 - m * x1, 'perp-is-parallel'),
        form(pm, y1 + pm * x1, 'move-sign'),
        form(sign * k, c, 'perp-no-negate'),
      ].filter(Boolean);
    },
  },
  {
    id: 'coord-intersect', skill: 'coordinate-geometry', topic: 'Coordinate geometry',
    keywords: ['intersection', 'simultaneous', 'point of intersection', 'coordinate'],
    mcqOrdered: true, // (x, y) — the two coordinates are different quantities
    generate() {
      // Built backwards from an integer intersection point. px non-zero: at
      // x = 0 three of the four slips below all produce the right point, since
      // every line meets the y-axis at its own intercept.
      const px = PR.nz(-5, 5); const py = PR.int(-6, 6);
      let m1, m2;
      do { m1 = PR.nz(-4, 4); m2 = PR.nz(-4, 4); } while (m1 === m2);
      const c1 = py - m1 * px; const c2 = py - m2 * px;
      return {
        question: `\\text{Where do } y = ${PR.lead(m1)}${PR.ct(c1)} \\text{ and } y = ${PR.lead(m2)}${PR.ct(c2)} \\text{ meet?}`,
        steps: [
          `${PR.lead(m1)}${PR.ct(c1)} = ${PR.lead(m2)}${PR.ct(c2)}`,
          `${PR.lead(m1 - m2)} = ${c2 - c1}`,
          `x = \\frac{${c2 - c1}}{${m1 - m2}} = ${px}`,
          `y = ${m1}(${px})${PR.ct(c1)} = ${py}`,
        ],
        answer: `(${px}, ${py})`,
        viz: {
          type: 'points', points: [], lines: [{ m: m1, c: c1 }, { m: m2, c: c2 }],
          mark: [px, py, 'meet'],
        },
        w: { m1, c1, m2, c2, px, py },
      };
    },
    distractors({ m1, c1, m2, c2, px, py }) {
      // m1 + m2 is zero whenever the gradients are opposite, and dividing by it
      // would offer the student "(NaN, 3)".
      const pt = (x, y, why) =>
        (!isFinite(x) || !isFinite(y) ? null
          : { latex: `(${PR.r(x, 2)}, ${PR.r(y, 2)})`, why });
      return [
        pt(py, px, 'coords-swapped'),
        // Subtracted the gradients the wrong way round.
        pt((c1 - c2) / (m1 - m2), py, 'move-sign'),
        pt(px, m2 * px + c1, 'substituted-wrong'),
        pt(m1 + m2 === 0 ? NaN : (c2 - c1) / (m1 + m2), py, 'move-sign'),
        pt(-px, -py, 'coords-swapped'),
      ].filter(Boolean);
    },
  },
  {
    id: 'circle-centre-radius', skill: 'circles-loci', topic: 'Coordinate geometry',
    keywords: ['circle', 'centre', 'radius', 'general form', 'locus'],
    mcqOrdered: true, // centre and radius are different quantities
    generate() {
      // x^2 + y^2 + Dx + Ey + F = 0 with integer centre and whole radius.
      // Both centre coordinates non-zero: a zero one has nothing to complete,
      // so the working degenerates to "(x + 0)^2 - 0" and the exercise stops
      // exercising the thing it is named after.
      const a = PR.nz(-5, 5); const b = PR.nz(-5, 5);
      const r = PR.int(2, 7);
      const D = -2 * a; const E = -2 * b; const F = a * a + b * b - r * r;
      return {
        question: `\\text{Find the centre and radius of } x^2 + y^2${PR.xt(D)}${PR.xt(E, 'y')}${PR.ct(F)} = 0`,
        steps: [
          `\\text{Complete the square in } x: \\ x^2${PR.xt(D)} = (x ${PR.s(-a)})^2 - ${a * a}`,
          `\\text{And in } y: \\ y^2${PR.xt(E, 'y')} = (y ${PR.s(-b)})^2 - ${b * b}`,
          // Only one value here: F is DEFINED as a^2 + b^2 - r^2, so the old
          // `= ${a*a + b*b - F} = ${r*r}` was the same number printed twice and
          // read as "= 4 = 4" in every generation, as though a substitution had
          // failed halfway.
          `(x ${PR.s(-a)})^2 + (y ${PR.s(-b)})^2 = ${r * r}`,
          `\\text{Centre } (${a}, ${b}), \\text{ radius } ${r}`,
        ],
        answer: `\\text{centre } (${a}, ${b}), \\ r = ${r}`,
        viz: { type: 'circle', cx: a, cy: b, r },
        w: { a, b, r, D, E, F },
      };
    },
    distractors({ a, b, r, D, E, F }) {
      const form = (cx, cy, rad, why) =>
        (rad <= 0 ? null
          : { latex: `\\text{centre } (${PR.r(cx, 2)}, ${PR.r(cy, 2)}), \\ r = ${PR.r(rad, 3)}`, why });
      return [
        // Centre read straight off the coefficients, without negating and halving.
        form(D, E, r, 'centre-not-negated'),
        form(-a, -b, r, 'centre-not-negated'),
        form(a, b, r * r, 'no-sqrt'),
        form(a, b, Math.abs(F) > 0 ? Math.sqrt(Math.abs(F)) : r + 1, 'radius-is-constant'),
        form(D / 2, E / 2, r, 'centre-not-negated'),
      ].filter(Boolean);
    },
  },

  // ---- Calculus: the other differentiation rules -------------------------------------
  {
    id: 'diff-product', skill: 'diff-rules', topic: 'Differentiation',
    keywords: ['product rule', 'differentiate product'],
    generate() {
      const a = PR.nz(-4, 5); const b = PR.nz(-6, 6);
      const c = PR.nz(-4, 5); const d = PR.nz(-6, 6);
      // (ax+b)(cx+d) -> a(cx+d) + c(ax+b) = 2acx + (ad + bc)
      const B = a * d + b * c;
      return {
        question: `\\text{Differentiate } y = (${PR.lead(a)}${PR.ct(b)})(${PR.lead(c)}${PR.ct(d)})`,
        steps: [
          `\\text{Product rule: } \\frac{dy}{dx} = u'v + uv'`,
          `u = ${PR.lead(a)}${PR.ct(b)}, \\ u' = ${a}; \\quad v = ${PR.lead(c)}${PR.ct(d)}, \\ v' = ${c}`,
          // PR.par on the SECOND coefficient only. The first opens the expression
          // straight after the "=", so a bare negative reads fine there; the second
          // follows a "+", and c < 0 in 43% of draws, which printed "+ -3(-2x - 6)".
          `\\frac{dy}{dx} = ${a}(${PR.lead(c)}${PR.ct(d)}) + ${PR.par(c)}(${PR.lead(a)}${PR.ct(b)})`,
          `= ${PR.lead(2 * a * c)}${PR.ct(B)}`,
        ],
        answer: `\\frac{dy}{dx} = ${PR.lead(2 * a * c)}${PR.ct(B)}`,
        w: { a, b, c, d, B },
      };
    },
    distractors({ a, b, c, d, B }) {
      const form = (p, q, why) =>
        (p === 0 || q === 0 ? null
          : { latex: `\\frac{dy}{dx} = ${PR.lead(p)}${PR.ct(q)}`, why });
      return [
        // Only one of the two products.
        form(a * c, a * d, 'product-one-term'),
        form(a * c, b * c, 'product-one-term'),
        // Signs mishandled when the two products were added.
        form(2 * a * c, a * d - b * c, 'product-rule-sign'),
        // Differentiated both factors and multiplied them.
        form(2 * a * c, b * d, 'product-multiplied-derivatives'),
        form(a * c, B, 'product-one-term'),
      ].filter(Boolean);
    },
  },
  {
    id: 'diff-quotient', skill: 'diff-rules', topic: 'Differentiation',
    keywords: ['quotient rule', 'differentiate quotient'],
    generate() {
      // (ax+b)/(cx+d) -> (ad - bc)/(cx+d)^2. The numerator must not vanish, or
      // the function is a constant and there is nothing to differentiate.
      let a, b, c, d, N;
      do {
        a = PR.nz(-5, 5); b = PR.nz(-7, 7);
        c = PR.nz(-4, 4); d = PR.nz(-7, 7);
        N = a * d - b * c;
      } while (N === 0);
      const den = `(${PR.lead(c)}${PR.ct(d)})^2`;
      return {
        question: `\\text{Differentiate } y = \\frac{${PR.lead(a)}${PR.ct(b)}}{${PR.lead(c)}${PR.ct(d)}}`,
        steps: [
          `\\text{Quotient rule: } \\frac{dy}{dx} = \\frac{u'v - uv'}{v^2}`,
          `= \\frac{${a}(${PR.lead(c)}${PR.ct(d)}) - ${PR.par(c)}(${PR.lead(a)}${PR.ct(b)})}{${den}}`,
          `= \\frac{${N}}{${den}}`,
        ],
        answer: `\\frac{dy}{dx} = \\frac{${N}}{${den}}`,
        w: { a, b, c, d, N, den },
      };
    },
    distractors({ a, b, c, d, N, den }) {
      const form = (top, why) => ({ latex: `\\frac{dy}{dx} = \\frac{${top}}{${den}}`, why });
      return [
        form(b * c - a * d, 'quotient-order'),
        form(a * d + b * c, 'quotient-added'),
        form(a * d, 'quotient-one-term'),
        form(b * c, 'quotient-one-term'),
        form(a * c, 'quotient-added'),
      ];
    },
  },
  {
    id: 'diff-transcendental', skill: 'diff-transcendental', topic: 'Differentiation',
    keywords: ['differentiate exponential', 'differentiate log', 'natural log', 'e to the'],
    generate() {
      // |a| > 1: at a = +/-1 the inner derivative is 1, so "forgot the chain
      // rule" gives the right answer and the question tests nothing.
      const a = PR.choice([-5, -4, -3, -2, 2, 3, 4, 5]);
      const b = PR.nz(-6, 6);
      const inner = `${PR.lead(a)}${PR.ct(b)}`;
      if (PR.choice([true, false])) {
        return {
          question: `\\text{Differentiate } y = e^{${inner}}`,
          steps: [
            `\\text{Chain rule on } e^{u}: \\ \\frac{dy}{dx} = u'e^{u}`,
            `u = ${inner}, \\ u' = ${a}`,
            `\\frac{dy}{dx} = ${PR.lead(a, `e^{${inner}}`)}`,
          ],
          answer: `\\frac{dy}{dx} = ${PR.lead(a, `e^{${inner}}`)}`,
          w: { a, b, inner, kind: 'exp' },
        };
      }
      return {
        question: `\\text{Differentiate } y = \\ln(${inner})`,
        steps: [
          `\\text{Chain rule on } \\ln u: \\ \\frac{dy}{dx} = \\frac{u'}{u}`,
          `u = ${inner}, \\ u' = ${a}`,
          `\\frac{dy}{dx} = \\frac{${a}}{${inner}}`,
        ],
        answer: `\\frac{dy}{dx} = \\frac{${a}}{${inner}}`,
        w: { a, b, inner, kind: 'ln' },
      };
    },
    distractors({ a, b, inner, kind }) {
      // Built in whichever form the question came out as, so the options can
      // never be told apart by their shape.
      if (kind === 'exp') {
        return [
          { latex: `\\frac{dy}{dx} = e^{${inner}}`, why: 'chain-no-inner' },
          { latex: `\\frac{dy}{dx} = ${PR.lead(a * a, `e^{${inner}}`)}`, why: 'chain-inner-twice' },
          { latex: `\\frac{dy}{dx} = ${PR.lead(-a, `e^{${inner}}`)}`, why: 'sign-last' },
          { latex: `\\frac{dy}{dx} = ${PR.lead(a, `e^{${PR.lead(a)}}`)}`, why: 'chain-no-inner' },
        ];
      }
      return [
        { latex: `\\frac{dy}{dx} = \\frac{1}{${inner}}`, why: 'chain-no-inner' },
        { latex: `\\frac{dy}{dx} = \\frac{${a * a}}{${inner}}`, why: 'chain-inner-twice' },
        { latex: `\\frac{dy}{dx} = \\frac{${-a}}{${inner}}`, why: 'sign-last' },
        { latex: `\\frac{dy}{dx} = \\frac{${b}}{${inner}}`, why: 'chain-no-inner' },
      ];
    },
  },
  {
    id: 'diff-trig-chain', skill: 'diff-transcendental', topic: 'Differentiation',
    keywords: ['differentiate trig', 'differentiate sin', 'differentiate cos'],
    generate() {
      const a = PR.nz(-5, 5); const b = PR.int(2, 6);
      // The QUESTION alternates between sin and cos rather than the options.
      // If three options said cos and one said sin, the odd one out could be
      // picked off by majority without differentiating anything — and the
      // sin-vs-cos confusion is better tested by asking about both than by
      // making it the one option that looks different.
      const isSin = PR.choice([true, false]);
      const fn = isSin ? 'sin' : 'cos';
      const dFn = isSin ? 'cos' : 'sin';
      const coef = isSin ? a * b : -a * b;
      return {
        question: `\\text{Differentiate } y = ${PR.lead(a, `\\${fn} ${b}x`)}`,
        steps: [
          `\\frac{d}{dx}\\${fn} u = ${isSin ? '' : '-'}u'\\${dFn} u, \\quad u = ${b}x, \\ u' = ${b}`,
          `\\frac{dy}{dx} = ${a} \\times ${isSin ? '' : '-'}${b}\\${dFn} ${b}x`,
          `= ${PR.lead(coef, `\\${dFn} ${b}x`)}`,
        ],
        answer: `\\frac{dy}{dx} = ${PR.lead(coef, `\\${dFn} ${b}x`)}`,
        viz: { type: 'sine', a, b, xmax: Math.round(720 / b) },
        w: { a, b, dFn, coef },
      };
    },
    distractors({ a, b, dFn, coef }) {
      const form = (c, why) =>
        ({ latex: `\\frac{dy}{dx} = ${PR.lead(c, `\\${dFn} ${b}x`)}`, why });
      return [
        // The sign is the whole point when cos is the one being differentiated.
        form(-coef, 'trig-derivative-sign'),
        // Forgot to bring the inner coefficient down.
        form(coef > 0 ? a : -a, 'chain-no-inner'),
        form(coef * b, 'chain-inner-twice'),
        form(a, 'chain-no-inner'),
        form(-a, 'chain-no-inner'),
      ];
    },
  },
  {
    id: 'diff-implicit', skill: 'implicit-related-rates', topic: 'Differentiation',
    keywords: ['implicit differentiation', 'implicit'],
    generate() {
      // ax^2 + bxy + cy^2 = k  ->  dy/dx = -(2ax + by) / (bx + 2cy)
      const a = PR.nz(-4, 4); const b = PR.nz(-4, 4); const c = PR.nz(-4, 4);
      const k = PR.nz(-9, 9);
      return {
        question: `\\text{Find } \\frac{dy}{dx} \\text{ for } ${PR.lead(a, 'x^2')}${PR.xt(b, 'xy')}${PR.xt(c, 'y^2')} = ${k}`,
        steps: [
          `\\text{Differentiate term by term, using the product rule on } ${PR.lead(b, 'xy')}`,
          `${PR.lead(2 * a)}${PR.xt(b, 'y')}${PR.xt(b, 'x\\frac{dy}{dx}')}${PR.xt(2 * c, 'y\\frac{dy}{dx}')} = 0`,
          `(${PR.lead(b)}${PR.xt(2 * c, 'y')})\\frac{dy}{dx} = -(${PR.lead(2 * a)}${PR.xt(b, 'y')})`,
          `\\frac{dy}{dx} = -\\frac{${PR.lead(2 * a)}${PR.xt(b, 'y')}}{${PR.lead(b)}${PR.xt(2 * c, 'y')}}`,
        ],
        answer: `\\frac{dy}{dx} = -\\frac{${PR.lead(2 * a)}${PR.xt(b, 'y')}}{${PR.lead(b)}${PR.xt(2 * c, 'y')}}`,
        w: { a, b, c },
      };
    },
    // The numerator and denominator are different roles, so an option can reuse
    // the answer's numbers without being the answer.
    mcqOrdered: true,
    distractors({ a, b, c }) {
      const form = (nx, ny, dx, dy, why) =>
        (nx === 0 || ny === 0 || dx === 0 || dy === 0 ? null : {
          latex: `\\frac{dy}{dx} = -\\frac{${PR.lead(nx)}${PR.xt(ny, 'y')}}{${PR.lead(dx)}${PR.xt(dy, 'y')}}`,
          why,
        });
      return [
        // Top and bottom the wrong way round.
        form(b, 2 * c, 2 * a, b, 'implicit-swapped'),
        // Treated y as a constant, so the xy term lost its dy/dx.
        form(2 * a, b, b, c, 'implicit-y-constant'),
        // Forgot to double the squared terms.
        form(a, b, b, c, 'implicit-y-constant'),
        form(2 * a, b, b, -2 * c, 'sign-last'),
        form(2 * a, -b, b, 2 * c, 'sign-last'),
      ].filter(Boolean);
    },
  },

  {
    id: 'first-principles', skill: 'limits-continuity', topic: 'Differentiation',
    keywords: ['first principles', 'limit definition', 'from first principles'],
    generate() {
      const a = PR.nz(-4, 5); const b = PR.nz(-7, 7);
      return {
        question: `\\text{Differentiate } f(x) = ${PR.lead(a, 'x^2')}${PR.xt(b)} \\text{ from first principles}`,
        steps: [
          `f'(x) = \\lim_{h \\to 0}\\frac{f(x+h) - f(x)}{h}`,
          `f(x+h) = ${PR.lead(a, '(x+h)^2')}${PR.xt(b, '(x+h)')} = ${PR.lead(a, 'x^2')}${PR.xt(2 * a, 'xh')}${PR.xt(a, 'h^2')}${PR.xt(b)}${PR.xt(b, 'h')}`,
          `f(x+h) - f(x) = ${PR.lead(2 * a, 'xh')}${PR.xt(a, 'h^2')}${PR.xt(b, 'h')}`,
          `\\frac{\\ldots}{h} = ${PR.lead(2 * a)}${PR.xt(a, 'h')}${PR.ct(b)} \\ \\xrightarrow{h \\to 0} \\ ${PR.lead(2 * a)}${PR.ct(b)}`,
        ],
        answer: `f'(x) = ${PR.lead(2 * a)}${PR.ct(b)}`,
        viz: { type: 'poly', coeffs: [0, b, a], tangentAt: 1 },
        w: { a, b },
      };
    },
    distractors({ a, b }) {
      const form = (p, q, why) =>
        (p === 0 || q === 0 ? null
          : { latex: `f'(x) = ${PR.lead(p)}${PR.ct(q)}`, why });
      return [
        // Never doubled the x^2 coefficient.
        form(a, b, 'power-not-multiplied'),
        // Differentiated the linear term as if it were quadratic too.
        form(2 * a, 2 * b, 'power-not-multiplied'),
        form(a, 2 * b, 'power-not-multiplied'),
        form(2 * a, -b, 'sign-last'),
        form(a * a, b, 'power-not-multiplied'),
      ].filter(Boolean);
    },
  },
  {
    id: 'stationary-points', skill: 'curve-analysis', topic: 'Differentiation',
    keywords: ['stationary point', 'turning point', 'maximum', 'minimum', 'second derivative'],
    // "max at x = -2, min at x = 2" — the two are different things, not a set.
    mcqOrdered: true,
    generate() {
      // y = x^3 - 3k^2 x + c has stationary points at exactly x = +/-k, which
      // keeps the arithmetic clean and the classification unambiguous. k > 1 so
      // that k and k^2 are different numbers — at k = 1 the "didn't take the
      // square root" distractor lands on the right answer.
      const k = PR.int(2, 5);
      const c = PR.nz(-9, 9);
      return {
        question: `\\text{Find and classify the stationary points of } y = x^3${PR.xt(-3 * k * k)}${PR.ct(c)}`,
        steps: [
          `\\frac{dy}{dx} = 3x^2 - ${3 * k * k} = 3(x^2 - ${k * k})`,
          `3(x - ${k})(x + ${k}) = 0 \\Rightarrow x = ${-k} \\text{ or } x = ${k}`,
          `\\frac{d^2y}{dx^2} = 6x`,
          `\\text{At } x = ${-k}: \\ 6(${-k}) < 0 \\Rightarrow \\text{maximum}; \\quad \\text{at } x = ${k}: \\ 6(${k}) > 0 \\Rightarrow \\text{minimum}`,
        ],
        answer: `\\text{max at } x = ${-k}, \\ \\text{min at } x = ${k}`,
        viz: { type: 'poly', coeffs: [c, -3 * k * k, 0, 1] },
        w: { k, c },
      };
    },
    distractors({ k, c }) {
      const form = (mx, mn, why) =>
        ({ latex: `\\text{max at } x = ${mx}, \\ \\text{min at } x = ${mn}`, why });
      return [
        // The classification the wrong way round — what the second derivative is for.
        form(k, -k, 'classification-swapped'),
        // Solved 3x^2 = 3k^2 as x = 3k^2.
        form(-3 * k * k, 3 * k * k, 'stationary-not-solved'),
        form(-k * k, k * k, 'stationary-not-solved'),
        form(k * k, -k * k, 'classification-swapped'),
      ];
    },
  },
  {
    id: 'optimisation', skill: 'curve-analysis', topic: 'Differentiation',
    keywords: ['optimisation', 'maximum area', 'maximise', 'largest'],
    generate() {
      // Fixed perimeter, maximise area: the square wins, side P/4.
      const side = PR.int(3, 15);
      const P = 4 * side;
      return {
        question: `\\text{A rectangle has perimeter } ${P}. \\text{ What is its greatest possible area?}`,
        steps: [
          `\\text{Let the sides be } x \\text{ and } ${P / 2} - x`,
          `A = x(${P / 2} - x) = ${P / 2}x - x^2`,
          `\\frac{dA}{dx} = ${P / 2} - 2x = 0 \\Rightarrow x = ${side}`,
          `A = ${side} \\times ${side} = ${side * side}`,
        ],
        answer: `${side * side}`,
        viz: { type: 'poly', coeffs: [0, P / 2, -1], vertex: [side, side * side] },
        w: { side, P },
      };
    },
    distractors({ side, P }) {
      const val = (x, why) => (x <= 0 ? null : { latex: `${PR.r(x, 2)}`, why });
      return [
        // Gave the side rather than the area.
        val(side, 'answered-the-wrong-quantity'),
        // Used the whole perimeter as one side.
        val(P * P / 4, 'optimisation-wrong-constraint'),
        val(P / 2, 'answered-the-wrong-quantity'),
        val(side * side * 2, 'optimisation-wrong-constraint'),
        val(P, 'answered-the-wrong-quantity'),
      ].filter(Boolean);
    },
  },

  // ---- Integration techniques and applications ---------------------------------------
  {
    id: 'int-substitution', skill: 'int-techniques', topic: 'Integration',
    keywords: ['substitution', 'u substitution', 'integrate by substitution'],
    generate() {
      const a = PR.nz(-6, 6); const n = PR.int(2, 5);
      return {
        question: `\\text{Find } \\int 2x(x^2 ${PR.s(a)})^{${n}}\\,dx`,
        steps: [
          `\\text{Let } u = x^2 ${PR.s(a)}, \\text{ so } \\frac{du}{dx} = 2x \\text{ and } du = 2x\\,dx`,
          `\\int u^{${n}}\\,du = \\frac{u^{${n + 1}}}{${n + 1}} + C`,
          `= \\frac{(x^2 ${PR.s(a)})^{${n + 1}}}{${n + 1}} + C`,
        ],
        answer: `\\frac{(x^2 ${PR.s(a)})^{${n + 1}}}{${n + 1}} + C`,
        w: { a, n },
      };
    },
    distractors({ a, n }) {
      const form = (pow, div, why) =>
        ({ latex: `\\frac{(x^2 ${PR.s(a)})^{${pow}}}{${div}} + C`, why });
      return [
        // Raised the power but divided by the old one.
        form(n + 1, n, 'int-divide-n'),
        // Kept the power.
        form(n, n, 'int-power-down'),
        form(n, n + 1, 'int-power-down'),
        form(n + 1, n + 2, 'int-divide-n'),
        form(n - 1, n, 'int-power-down'),
      ];
    },
  },
  {
    id: 'int-by-parts', skill: 'int-techniques', topic: 'Integration',
    keywords: ['by parts', 'integration by parts'],
    generate() {
      // int (x + b) e^x dx = (x + b - 1) e^x + C. b - 1 non-zero so the bracket
      // never collapses to a bare x, which would look shorter than every option.
      let b;
      do { b = PR.nz(-7, 7); } while (b === 1);
      const k = b - 1;
      return {
        question: `\\text{Find } \\int (x ${PR.s(b)})e^{x}\\,dx`,
        steps: [
          `\\text{By parts: } u = x ${PR.s(b)}, \\ dv = e^{x}dx \\Rightarrow du = dx, \\ v = e^{x}`,
          `\\int u\\,dv = uv - \\int v\\,du = (x ${PR.s(b)})e^{x} - \\int e^{x}dx`,
          `= (x ${PR.s(b)})e^{x} - e^{x} + C = (x ${PR.s(k)})e^{x} + C`,
        ],
        answer: `(x ${PR.s(k)})e^{x} + C`,
        w: { b, k },
      };
    },
    distractors({ b, k }) {
      const form = (konst, why) =>
        (konst === 0 ? null : { latex: `(x ${PR.s(konst)})e^{x} + C`, why });
      return [
        // Added the second term instead of subtracting it.
        form(b + 1, 'parts-sign'),
        // Stopped at uv and never did the second integral.
        form(b, 'parts-no-second-term'),
        form(-k, 'parts-sign'),
        form(k - 1, 'parts-sign'),
        form(b + 2, 'parts-sign'),
      ].filter(Boolean);
    },
  },
  {
    id: 'area-between', skill: 'int-applications', topic: 'Integration',
    keywords: ['area between curves', 'area between', 'enclosed area'],
    generate() {
      // Between y = x^2 and y = bx: they meet at 0 and b, area = b^3/6.
      const b = PR.int(2, 9);
      const area = PR.r(b ** 3 / 6, 4);
      return {
        question: `\\text{Find the area enclosed by } y = x^2 \\text{ and } y = ${b}x`,
        steps: [
          `\\text{They meet where } x^2 = ${b}x \\Rightarrow x = 0 \\text{ or } x = ${b}`,
          `A = \\int_{0}^{${b}} (${b}x - x^2)\\,dx = \\left[\\frac{${b}x^2}{2} - \\frac{x^3}{3}\\right]_{0}^{${b}}`,
          `= \\frac{${b ** 3}}{2} - \\frac{${b ** 3}}{3} = ${area}`,
        ],
        answer: `${area}`,
        viz: { type: 'area', coeffs: [0, b, -1], a: 0, b },
        w: { b, area },
      };
    },
    distractors({ b, area }) {
      const val = (x, why) => ({ latex: `${PR.r(x, 4)}`, why });
      return [
        // Subtracted the curves the other way round, giving a negative.
        val(-area, 'area-reversed'),
        // Integrated only the line, or only the parabola.
        val(b ** 3 / 2, 'area-one-curve'),
        val(b ** 3 / 3, 'area-one-curve'),
        val(b ** 3, 'area-one-curve'),
      ];
    },
  },
  {
    id: 'volume-revolution', skill: 'int-applications', topic: 'Integration',
    keywords: ['volume of revolution', 'solid of revolution', 'rotated about'],
    generate() {
      // y = ax rotated about the x-axis, 0 to h: V = pi a^2 h^3 / 3.
      // a > 1 so that a and a^2 differ — at a = 1 "forgot to square y" gives
      // the right answer and the question stops testing the thing it is for.
      const a = PR.int(2, 4); const h = PR.int(2, 5);
      const v = PR.r(a * a * h ** 3 / 3, 4);
      return {
        question: `\\text{The line } y = ${PR.lead(a)} \\text{ from } x = 0 \\text{ to } x = ${h}`
          + ` \\text{ is rotated about the } x\\text{-axis. Find the volume.}`,
        steps: [
          `V = \\pi\\int_{0}^{${h}} y^2\\,dx = \\pi\\int_{0}^{${h}} ${PR.lead(a * a, 'x^2')}\\,dx`,
          `= \\pi\\left[\\frac{${PR.lead(a * a, 'x^3')}}{3}\\right]_{0}^{${h}}`,
          `= ${v}\\pi`,
        ],
        answer: `${v}\\pi`,
        w: { a, h, v },
      };
    },
    distractors({ a, h, v }) {
      const val = (x, why) => ({ latex: `${PR.r(x, 4)}\\pi`, why });
      return [
        // Never squared y.
        val(a * h * h / 2, 'volume-not-squared'),
        // Forgot to divide by 3 when integrating x^2.
        val(a * a * h ** 3, 'int-divide-n'),
        val(a * a * h * h / 2, 'volume-not-squared'),
        val(a * h ** 3 / 3, 'volume-not-squared'),
      ];
    },
  },

  // ---- Differential equations ---------------------------------------------------------
  {
    id: 'de-separable', skill: 'de-separable', topic: 'Differential equations',
    keywords: ['separable', 'separation of variables', 'differential equation'],
    generate() {
      // dy/dx = kxy with y(0) = A  ->  y = A e^{kx^2/2}. Keep k even so the
      // exponent's coefficient stays whole.
      const half = PR.nz(-3, 3);
      const k = 2 * half;
      const A = PR.int(2, 9);
      return {
        question: `\\text{Solve } \\frac{dy}{dx} = ${PR.lead(k, 'xy')} \\text{ given } y(0) = ${A}`,
        steps: [
          `\\frac{1}{y}\\,dy = ${PR.lead(k, 'x')}\\,dx`,
          `\\ln|y| = ${PR.lead(half, 'x^2')} + c`,
          `y = Ae^{${PR.lead(half, 'x^2')}}`,
          `y(0) = ${A} \\Rightarrow A = ${A}`,
        ],
        answer: `y = ${A}e^{${PR.lead(half, 'x^2')}}`,
        w: { k, half, A },
      };
    },
    distractors({ k, half, A }) {
      const form = (coef, exp, why) =>
        ({ latex: `y = ${coef}e^{${PR.lead(exp, 'x^2')}}`, why });
      return [
        // Integrated kx as kx rather than kx^2/2.
        form(A, k, 'de-integration-slip'),
        form(A, -half, 'sign-last'),
        // Read the initial condition into the exponent.
        form(k, half, 'de-constant-misplaced'),
        form(A, half * 2, 'de-integration-slip'),
        form(A * 2, half, 'de-constant-misplaced'),
      ];
    },
  },
  {
    id: 'de-integrating-factor', skill: 'de-linear-first', topic: 'Differential equations',
    keywords: ['integrating factor', 'first order linear', 'differential equation'],
    generate() {
      // dy/dx + P y = Q. Two standard shapes of P, and the factor is built to
      // match whichever came out, so the options can never differ by form.
      const a = PR.choice([-5, -4, -3, -2, 2, 3, 4, 5]);
      if (PR.choice([true, false])) {
        const q = PR.nz(-6, 6);
        return {
          question: `\\text{Find the integrating factor for } \\frac{dy}{dx} ${PR.s(a)}y = ${q}`,
          steps: [
            `P(x) = ${a}`,
            `\\mu = e^{\\int P\\,dx} = e^{\\int ${a}\\,dx}`,
            `\\mu = e^{${PR.lead(a)}}`,
          ],
          answer: `e^{${PR.lead(a)}}`,
          w: { a, kind: 'const' },
        };
      }
      return {
        question: `\\text{Find the integrating factor for } \\frac{dy}{dx} + \\frac{${a}}{x}y = x`,
        steps: [
          `P(x) = \\frac{${a}}{x}`,
          `\\int P\\,dx = ${a}\\ln|x| = \\ln|x^{${a}}|`,
          `\\mu = e^{\\ln|x^{${a}}|} = x^{${a}}`,
        ],
        answer: `x^{${a}}`,
        w: { a, kind: 'power' },
      };
    },
    distractors({ a, kind }) {
      if (kind === 'const') {
        return [
          { latex: `e^{${PR.lead(-a)}}`, why: 'if-sign' },
          { latex: `e^{${PR.lead(a, 'x^2')}}`, why: 'de-integration-slip' },
          { latex: `e^{${a}}`, why: 'if-no-integral' },
          { latex: `e^{${PR.lead(a * a)}}`, why: 'de-integration-slip' },
        ];
      }
      return [
        { latex: `x^{${-a}}`, why: 'if-sign' },
        { latex: `x^{${a + 1}}`, why: 'de-integration-slip' },
        { latex: `x^{${a * a}}`, why: 'de-integration-slip' },
        { latex: `x^{${1 - a}}`, why: 'if-sign' },
      ];
    },
  },
  {
    id: 'de-auxiliary', skill: 'de-second-order', topic: 'Differential equations',
    keywords: ['auxiliary equation', 'second order', 'characteristic equation', 'homogeneous'],
    generate() {
      // Built backwards from two distinct integer roots, so the auxiliary
      // quadratic always factorises — same trick as quad-factorise.
      // r2 must differ from both r1 and -r1: with symmetric roots, negating
      // them gives back the same pair, so the question could not test the
      // sign slip that is the main thing worth catching here.
      let r1, r2;
      do { r1 = PR.nz(-5, 5); r2 = PR.nz(-5, 5); } while (r1 === r2 || r1 === -r2);
      const b = -(r1 + r2); const c = r1 * r2;
      // PR.xt/PR.ct throughout: b is zero whenever the roots are opposite, and
      // a root of +/-1 must print as e^{x}, not e^{1x}.
      const sol = (p, q) => `y = Ae^{${PR.lead(p, 'x')}} + Be^{${PR.lead(q, 'x')}}`;
      return {
        question: `\\text{Solve } y''${PR.xt(b, "y'")}${PR.xt(c, 'y')} = 0`,
        steps: [
          `\\text{Auxiliary equation: } m^2${PR.xt(b, 'm')}${PR.ct(c)} = 0`,
          `(m ${PR.s(-r1)})(m ${PR.s(-r2)}) = 0`,
          `m = ${r1} \\text{ or } m = ${r2}`,
          sol(r1, r2),
        ],
        answer: sol(r1, r2),
        w: { r1, r2, b, c },
      };
    },
    distractors({ r1, r2, b, c }) {
      // A and B are arbitrary constants, so swapping the two terms gives the
      // SAME general solution — buildChoices' reordering check catches that,
      // which is why this list never offers it.
      const form = (p, q, why) =>
        (p === 0 || q === 0 || p === q ? null
          : { latex: `y = Ae^{${PR.lead(p, 'x')}} + Be^{${PR.lead(q, 'x')}}`, why });
      return [
        // Roots read off without changing sign.
        form(-r1, -r2, 'aux-root-sign'),
        // Coefficients used as the roots.
        form(b, c, 'aux-coefficients-as-roots'),
        form(-r1, r2, 'aux-root-sign'),
        form(r1, -r2, 'aux-root-sign'),
        form(c, b, 'aux-coefficients-as-roots'),
      ].filter(Boolean);
    },
  },
  {
    id: 'de-growth-decay', skill: 'de-applications', topic: 'Differential equations',
    keywords: ['exponential growth', 'decay', 'half life', 'population', 'cooling'],
    generate() {
      // N = N0 e^{kt}: given two readings, find k. Chosen so N1/N0 is a whole
      // ratio and the log is a clean multiple.
      const N0 = PR.choice([100, 200, 500, 1000]);
      const ratio = PR.choice([2, 3, 4, 5]);
      const t1 = PR.int(2, 8);
      const N1 = N0 * ratio;
      const k = PR.r(Math.log(ratio) / t1, 4);
      return {
        question: `\\text{A population grows from } ${N0} \\text{ to } ${N1} \\text{ in } ${t1}`
          + ` \\text{ years. Find } k \\text{ in } N = N_0e^{kt}`,
        steps: [
          `${N1} = ${N0}e^{${t1}k}`,
          `e^{${t1}k} = ${ratio} \\Rightarrow ${t1}k = \\ln ${ratio}`,
          `k = \\frac{\\ln ${ratio}}{${t1}} \\approx ${k}`,
        ],
        answer: `k \\approx ${k}`,
        w: { N0, N1, ratio, t1, k },
      };
    },
    distractors({ N0, N1, ratio, t1, k }) {
      const val = (x, why) => (!isFinite(x) ? null : { latex: `k \\approx ${PR.r(x, 4)}`, why });
      return [
        // Ratio the wrong way up, giving a negative rate for a growing population.
        val(Math.log(1 / ratio) / t1, 'growth-ratio-inverted'),
        // Straight-line rate instead of an exponential one.
        val((N1 - N0) / t1, 'growth-is-linear'),
        val(Math.log(N1) / t1, 'growth-forgot-n0'),
        val(ratio / t1, 'growth-no-log'),
        val(Math.log(ratio) * t1, 'growth-no-log'),
      ].filter(Boolean);
    },
  },

  // ---- Trigonometry: radians, arcs and graphs ---------------------------------------
  {
    id: 'radians-convert', skill: 'radians-arcs', topic: 'Trigonometry',
    keywords: ['radian', 'degrees', 'convert', 'exact radians'],
    mcqShapeVaries: true, // some answers are a bare pi, others a fraction of it
    generate() {
      const table = [
        [30, '\\tfrac{\\pi}{6}'], [45, '\\tfrac{\\pi}{4}'], [60, '\\tfrac{\\pi}{3}'],
        [90, '\\tfrac{\\pi}{2}'], [120, '\\tfrac{2\\pi}{3}'], [135, '\\tfrac{3\\pi}{4}'],
        [150, '\\tfrac{5\\pi}{6}'], [180, '\\pi'], [225, '\\tfrac{5\\pi}{4}'],
        [270, '\\tfrac{3\\pi}{2}'], [300, '\\tfrac{5\\pi}{3}'], [315, '\\tfrac{7\\pi}{4}'],
      ];
      const [deg, rad] = PR.choice(table);
      return {
        question: `\\text{Write } ${deg}^\\circ \\text{ in radians, as an exact multiple of } \\pi`,
        steps: [
          `\\text{Multiply by } \\frac{\\pi}{180}`,
          `${deg} \\times \\frac{\\pi}{180} = \\frac{${deg}\\pi}{180}`,
          `= ${rad}`,
        ],
        answer: `${rad}`,
        w: { deg, rad, table },
      };
    },
    distractors({ rad, table }) {
      // Other entries from the same table: every option is a real angle, so
      // none can be ruled out for looking wrong.
      return table.map(([, r]) => r).filter((r) => r !== rad)
        .sort(() => Math.random() - 0.5)
        .map((latex) => ({ latex, why: 'radian-conversion' }));
    },
  },
  {
    id: 'arc-sector', skill: 'radians-arcs', topic: 'Trigonometry',
    keywords: ['arc length', 'sector', 'radian', 'sector area'],
    mcqOrdered: true, // a length and an area are different quantities
    generate() {
      // Angle as a whole number of radians keeps l = rθ and A = ½r²θ exact.
      const r = PR.int(3, 12);
      const th = PR.choice([0.5, 1, 1.5, 2, 2.5, 3]);
      const arc = PR.r(r * th, 3);
      const area = PR.r(0.5 * r * r * th, 3);
      return {
        question: `\\text{A sector has radius } ${r} \\text{ and angle } ${th} \\text{ radians.}`
          + ` \\text{ Find the arc length and the area}`,
        steps: [
          `\\ell = r\\theta = ${r} \\times ${th} = ${arc}`,
          `A = \\tfrac{1}{2}r^2\\theta = \\tfrac{1}{2} \\times ${r * r} \\times ${th}`,
          `A = ${area}`,
        ],
        answer: `\\ell = ${arc}, \\quad A = ${area}`,
        w: { r, th, arc, area },
      };
    },
    distractors({ r, th, arc, area }) {
      const form = (l, a, why) =>
        ({ latex: `\\ell = ${PR.r(l, 3)}, \\quad A = ${PR.r(a, 3)}`, why });
      return [
        // Forgot the half in the area.
        form(arc, r * r * th, 'sector-no-half'),
        // Used degrees formulas with a radian angle.
        form(arc, 0.5 * r * th, 'sector-radius-not-squared'),
        form(r * r * th, area, 'arc-radius-squared'),
        form(2 * Math.PI * r, area, 'arc-is-circumference'),
        form(arc, Math.PI * r * r, 'arc-is-circumference'),
      ];
    },
  },
  {
    id: 'segment-area', skill: 'radians-arcs', topic: 'Trigonometry',
    keywords: ['segment', 'segment area', 'minor segment', 'radian'],
    generate() {
      const r = PR.int(4, 12);
      const th = PR.choice([0.8, 1, 1.2, 1.5, 2, 2.4]);
      const area = PR.r(0.5 * r * r * (th - Math.sin(th)), 3);
      return {
        question: `\\text{Find the area of the minor segment cut off by a chord in a circle of radius }`
          + `${r}, \\text{ subtending } ${th} \\text{ radians at the centre}`,
        steps: [
          `\\text{Segment} = \\text{sector} - \\text{triangle}`,
          `= \\tfrac{1}{2}r^2\\theta - \\tfrac{1}{2}r^2\\sin\\theta = \\tfrac{1}{2}r^2(\\theta - \\sin\\theta)`,
          `= \\tfrac{1}{2}(${r * r})(${th} - ${PR.r(Math.sin(th), 4)}) = ${area}`,
        ],
        answer: `${area}`,
        w: { r, th, area },
      };
    },
    distractors({ r, th, area }) {
      const val = (x, why) => ({ latex: `${PR.r(x, 3)}`, why });
      const half = 0.5 * r * r;
      return [
        // The sector on its own — forgot to take the triangle off.
        val(half * th, 'segment-is-sector'),
        // The triangle on its own.
        val(half * Math.sin(th), 'segment-is-triangle'),
        // Dropped the half.
        val(r * r * (th - Math.sin(th)), 'sector-no-half'),
        // Subtracted the other way round.
        val(Math.abs(half * (Math.sin(th) - th)), 'segment-reversed'),
        val(half * (th + Math.sin(th)), 'segment-reversed'),
      ];
    },
  },
  {
    id: 'trig-simplify', skill: 'trig-identities', topic: 'Trigonometry',
    keywords: ['identity', 'simplify', 'pythagorean identity', 'trig identity'],
    // The answers are different kinds of thing (a ratio, a function, a number),
    // which is inherent to the topic rather than a formatting tell.
    mcqShapeVaries: true,
    generate() {
      // Every one of these reduces through sin^2 + cos^2 = 1 or tan = sin/cos.
      const cases = [
        ['\\frac{1 - \\cos^2\\theta}{\\sin\\theta}', '\\sin\\theta'],
        ['\\frac{1 - \\sin^2\\theta}{\\cos\\theta}', '\\cos\\theta'],
        ['\\tan\\theta\\cos\\theta', '\\sin\\theta'],
        ['\\frac{\\sin^2\\theta}{1 - \\cos^2\\theta}', '1'],
        ['\\frac{\\sin\\theta}{\\cos\\theta}', '\\tan\\theta'],
        ['\\frac{1 - \\cos^2\\theta}{\\sin\\theta\\cos\\theta}', '\\tan\\theta'],
        ['(1 - \\sin^2\\theta) + \\sin^2\\theta', '1'],
        ['\\frac{\\cos\\theta}{\\sin\\theta}\\tan\\theta', '1'],
      ];
      const [expr, ans] = PR.choice(cases);
      return {
        question: `\\text{Simplify } ${expr}`,
        steps: [
          `\\text{Use } \\sin^2\\theta + \\cos^2\\theta = 1 \\text{ and } \\tan\\theta = \\frac{\\sin\\theta}{\\cos\\theta}`,
          `${expr} = ${ans}`,
        ],
        answer: `${ans}`,
        w: { expr, ans },
      };
    },
    distractors({ ans }) {
      // Other plausible reductions of the same expression — each is what you get
      // by mis-remembering which of sin/cos the identity leaves behind.
      return ['\\sin\\theta', '\\cos\\theta', '\\tan\\theta', '1', '\\sin^2\\theta']
        .filter((v) => v !== ans)
        .map((latex) => ({ latex, why: 'pythag-identity' }));
    },
  },
  {
    id: 'trig-graph-features', skill: 'trig-graphs', topic: 'Trigonometry',
    keywords: ['amplitude', 'period', 'phase shift', 'trig graph'],
    mcqOrdered: true, // amplitude and period are different quantities
    generate() {
      const a = PR.choice([2, 3, 4, 5, -2, -3]);
      const b = PR.choice([2, 3, 4, 6]);
      const period = 360 / b;
      return {
        question: `\\text{For } y = ${PR.lead(a, `\\sin ${b}x`)}, \\text{ find the amplitude and the period in degrees}`,
        steps: [
          `\\text{Amplitude} = |a| = |${a}| = ${Math.abs(a)}`,
          `\\text{Period} = \\frac{360^\\circ}{b} = \\frac{360^\\circ}{${b}}`,
          `= ${period}^\\circ`,
        ],
        answer: `\\text{amplitude } ${Math.abs(a)}, \\text{ period } ${period}^\\circ`,
        viz: { type: 'sine', a, b, xmax: Math.round(period * 2) },
        w: { a, b, period },
      };
    },
    distractors({ a, b, period }) {
      const form = (amp, per, why) =>
        ({ latex: `\\text{amplitude } ${PR.r(amp, 3)}, \\text{ period } ${PR.r(per, 3)}^\\circ`, why });
      return [
        // Period multiplied by b instead of divided.
        form(Math.abs(a), 360 * b, 'period-multiplied'),
        // b read as the amplitude and a as the period.
        form(b, Math.abs(a), 'amplitude-is-b'),
        form(Math.abs(a), 360, 'period-ignored-b'),
        form(a * 2, period, 'amplitude-doubled'),
        form(b, period, 'amplitude-is-b'),
      ];
    },
  },
  {
    id: 'trig-double-angle', skill: 'trig-identities', topic: 'Trigonometry',
    keywords: ['double angle', 'identity', 'sin 2x', 'cos 2x'],
    generate() {
      // sin θ and cos θ from a Pythagorean triple, so sin 2θ is exact.
      const [p, q, h] = PR.choice([[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25]]);
      const flip = PR.choice([true, false]);
      const s = flip ? q : p;   // sin
      const c = flip ? p : q;   // cos
      const sin2 = PR.r(2 * s * c / (h * h), 4);
      return {
        question: `\\text{Given } \\sin\\theta = \\tfrac{${s}}{${h}} \\text{ and } \\cos\\theta = \\tfrac{${c}}{${h}}`
          + ` \\text{ with } \\theta \\text{ acute, find } \\sin 2\\theta`,
        steps: [
          `\\sin 2\\theta = 2\\sin\\theta\\cos\\theta`,
          `= 2 \\times \\tfrac{${s}}{${h}} \\times \\tfrac{${c}}{${h}} = \\tfrac{${2 * s * c}}{${h * h}}`,
          `= ${sin2}`,
        ],
        answer: `\\tfrac{${2 * s * c}}{${h * h}}`,
        w: { s, c, h },
      };
    },
    distractors({ s, c, h }) {
      const frac = (top, bot, why) => ({ latex: `\\tfrac{${top}}{${bot}}`, why });
      return [
        // Forgot the 2.
        frac(s * c, h * h, 'double-angle-no-two'),
        // Doubled the angle by doubling the ratio.
        frac(2 * s, h, 'double-angle-doubled-sin'),
        // Used the cos 2θ identity instead.
        frac(c * c - s * s, h * h, 'double-angle-wrong-identity'),
        frac(s + c, h, 'double-angle-added'),
        frac(2 * s * c, h, 'double-angle-no-two'),
      ];
    },
  },
  {
    id: 'trig-harmonic', skill: 'trig-modelling', topic: 'Trigonometry',
    keywords: ['harmonic form', 'auxiliary angle', 'a sin x + b cos x', 'r sin'],
    mcqOrdered: true, // R and alpha are different quantities
    generate() {
      // Pythagorean pair so R is whole.
      const [a, b, R] = PR.choice([[3, 4, 5], [4, 3, 5], [6, 8, 10], [5, 12, 13], [12, 5, 13]]);
      const alpha = PR.r(Math.atan2(b, a) * 180 / Math.PI, 2);
      return {
        question: `\\text{Write } ${a}\\sin x + ${b}\\cos x \\text{ as } R\\sin(x + \\alpha), \\ R > 0`,
        steps: [
          `R = \\sqrt{a^2 + b^2} = \\sqrt{${a * a} + ${b * b}} = ${R}`,
          `\\tan\\alpha = \\frac{b}{a} = \\frac{${b}}{${a}}`,
          `\\alpha = \\arctan\\left(\\frac{${b}}{${a}}\\right) \\approx ${alpha}^\\circ`,
        ],
        answer: `R = ${R}, \\ \\alpha \\approx ${alpha}^\\circ`,
        viz: { type: 'sine', a: R, b: 1, c: -alpha, xmax: 360 },
        w: { a, b, R, alpha },
      };
    },
    distractors({ a, b, R, alpha }) {
      const form = (r, al, why) =>
        ({ latex: `R = ${PR.r(r, 3)}, \\ \\alpha \\approx ${PR.r(al, 2)}^\\circ`, why });
      return [
        // tan α taken as a/b.
        form(R, Math.atan2(a, b) * 180 / Math.PI, 'harmonic-alpha-inverted'),
        // R as a + b rather than the hypotenuse.
        form(a + b, alpha, 'harmonic-r-added'),
        form(R * R, alpha, 'no-sqrt'),
        form(a + b, Math.atan2(a, b) * 180 / Math.PI, 'harmonic-r-added'),
        form(R, 90 - alpha, 'harmonic-alpha-inverted'),
      ];
    },
  },
  {
    id: 'trig-equation-domain', skill: 'trig-equations', topic: 'Trigonometry',
    keywords: ['trig equation', 'domain', 'solve trig', 'general solution'],
    generate() {
      // sin(bx) = k over 0..360: divide the domain by b, solve, divide back.
      // b = 2 only: at b = 3 the answer is six angles, which is more than an
      // option cell can show on a phone without scrolling.
      const b = 2;
      const o = PR.choice([
        { k: '\\tfrac{1}{2}', kv: 0.5, ref: 30 },
        { k: '\\tfrac{\\sqrt{2}}{2}', kv: 0.7071, ref: 45 },
        { k: '\\tfrac{\\sqrt{3}}{2}', kv: 0.866, ref: 60 },
      ]);
      // Solutions of sin u = k for u in [0, 360b), then x = u / b.
      const us = [];
      for (let turn = 0; turn < b; turn++) {
        us.push(o.ref + 360 * turn, 180 - o.ref + 360 * turn);
      }
      const xs = us.map((u) => PR.r(u / b, 2)).sort((p, q) => p - q);
      return {
        question: `\\text{Solve } \\sin ${b}x = ${o.k} \\ \\text{for } 0^\\circ \\le x \\le 360^\\circ`,
        steps: [
          `\\text{Let } u = ${b}x, \\text{ so } 0^\\circ \\le u \\le ${360 * b}^\\circ`,
          `\\sin u = ${o.k} \\Rightarrow u = ${us.sort((p, q) => p - q).join('^\\circ, ')}^\\circ`,
          `x = \\frac{u}{${b}} = ${xs.join('^\\circ, ')}^\\circ`,
        ],
        answer: `x = ${xs.join('^\\circ, ')}^\\circ`,
        viz: { type: 'sine', b, k: o.kv, sols: xs, xmax: 360 },
        w: { b, ref: o.ref, xs },
      };
    },
    distractors({ b, ref, xs }) {
      // Every option carries the same NUMBER of angles as the answer. An option
      // with two where the answer has four is spotted by its length alone,
      // before the student has thought about a single quadrant.
      const list = (arr, why) => ({
        latex: `x = ${arr.map((v) => PR.r(v, 2)).sort((p, q) => p - q).join('^\\circ, ')}^\\circ`,
        why,
      });
      const spread = (second) => {
        const out = [];
        for (let turn = 0; turn < b; turn++) {
          out.push((ref + 360 * turn) / b, (second + 360 * turn) / b);
        }
        return out;
      };
      return [
        // Took the cosine's second solution, 360 - ref, instead of sine's.
        list(spread(360 - ref), 'quadrant-wrong'),
        // Solved for u and never divided back, so the angles overshoot the domain.
        list(xs.map((v) => v * b), 'domain-not-divided'),
        // Divided by b a second time.
        list(xs.map((v) => v / b), 'domain-not-divided'),
        // Started from the complementary reference angle.
        list(spread(180 - (90 - ref)).map((v) => v), 'exact-value-swap'),
      ];
    },
  },

  // ---- Functions -------------------------------------------------------------------
  {
    id: 'func-inverse', skill: 'inverse-composite', topic: 'Functions',
    keywords: ['inverse function', 'inverse', 'f inverse'],
    // The numerator constant and the divisor are different roles, so an option
    // may reuse the answer's numbers without being the answer.
    mcqOrdered: true,
    generate() {
      // (ax + b) / d, chosen so the inverse has whole coefficients.
      const a = PR.nz(-5, 5);
      const b = PR.nz(-9, 9);
      return {
        question: `\\text{Find } f^{-1}(x) \\text{ for } f(x) = ${PR.lead(a)}${PR.ct(b)}`,
        steps: [
          `\\text{Write } y = ${PR.lead(a)}${PR.ct(b)}`,
          `\\text{Swap } x \\text{ and } y: \\ x = ${PR.lead(a, 'y')}${PR.ct(b)}`,
          `x ${PR.s(-b)} = ${PR.lead(a, 'y')}`,
          `f^{-1}(x) = \\frac{x ${PR.s(-b)}}{${a}}`,
        ],
        answer: `f^{-1}(x) = \\frac{x ${PR.s(-b)}}{${a}}`,
        viz: {
          type: 'points', points: [],
          // The function, its inverse, and y = x to show the reflection.
          lines: [{ m: a, c: b }, { m: 1 / a, c: -b / a }, { m: 1, c: 0 }],
        },
        w: { a, b },
      };
    },
    distractors({ a, b }) {
      const form = (top, bot, why) =>
        (top === 0 || bot === 0 ? null
          : { latex: `f^{-1}(x) = \\frac{x ${PR.s(top)}}{${bot}}`, why });
      return [
        // Subtracted b instead of adding it back, or vice versa.
        form(b, a, 'inverse-sign'),
        // Divided by the wrong thing on the way back.
        form(-b, -a, 'inverse-sign'),
        form(b, -a, 'inverse-sign'),
        // Divided by the constant rather than the coefficient. Dies when the two
        // are equal, which is what the fourth candidate is here for.
        form(-b, b, 'inverse-is-reciprocal'),
        form(b, b, 'inverse-is-reciprocal'),
      ].filter(Boolean);
    },
  },
  {
    id: 'func-composite', skill: 'inverse-composite', topic: 'Functions',
    keywords: ['composite function', 'composite', 'fog', 'f of g'],
    generate() {
      // |a| > 1: at a = +/-1 there is nothing to distribute, so "forgot to
      // multiply through the bracket" produces the right answer and the
      // question stops testing the thing it is for.
      const a = PR.choice([-4, -3, -2, 2, 3, 4]);
      const b = PR.nz(-6, 6);
      const c = PR.nz(-4, 4); const d = PR.nz(-6, 6);
      // f(g(x)) = a(cx + d) + b = acx + ad + b
      const A = a * c; const B = a * d + b;
      return {
        question: `f(x) = ${PR.lead(a)}${PR.ct(b)}, \\ g(x) = ${PR.lead(c)}${PR.ct(d)}. \\text{ Find } f(g(x))`,
        steps: [
          `f(g(x)) = ${a}(${PR.lead(c)}${PR.ct(d)})${PR.ct(b)}`,
          `= ${PR.lead(a * c)}${PR.ct(a * d)}${PR.ct(b)}`,
          `= ${PR.lead(A)}${PR.ct(B)}`,
        ],
        answer: `${PR.lead(A)}${PR.ct(B)}`,
        w: { a, b, c, d, A, B },
      };
    },
    distractors({ a, b, c, d, A, B }) {
      // PR.lead(0) prints "0x" and PR.ct(0) drops the constant, so a candidate
      // that lands on either would be spotted without doing any algebra.
      const form = (p, q, why) =>
        (p === 0 || q === 0 ? null : { latex: `${PR.lead(p)}${PR.ct(q)}`, why });
      return [
        // g(f(x)) — the other order.
        form(a * c, c * b + d, 'composite-order'),
        // Left the inner constant alone instead of multiplying it by a.
        form(A, d + b, 'composite-no-distribute'),
        // Dropped f's own constant.
        form(A, a * d, 'composite-no-distribute'),
        // Distributed a over the outer constant as well.
        form(A, a * (d + b), 'composite-no-distribute'),
        // Sign slip on the last addition. Never collides: b is non-zero.
        form(A, a * d - b, 'sign-last'),
        form(a + c, b + d, 'composite-added'),
      ].filter(Boolean);
    },
  },
  {
    id: 'func-transform', skill: 'function-transformations', topic: 'Functions',
    keywords: ['transformation', 'translate', 'shift', 'stretch', 'reflection'],
    generate() {
      // y = a·f(x − h) + k applied to a named point on y = f(x).
      const a = PR.choice([-3, -2, 2, 3]);
      const h = PR.nz(-4, 4);
      const k = PR.nz(-5, 5);
      const px = PR.nz(-4, 4); const py = PR.nz(-4, 4);
      const ix = px + h; const iy = a * py + k;
      return {
        question: `\\text{The point } (${px}, ${py}) \\text{ lies on } y = f(x).`
          + ` \\text{ Where does it move on } y = ${PR.lead(a, `f(x ${PR.s(-h)})`)}${PR.ct(k)}?`,
        steps: [
          `\\text{Inside the bracket shifts } x: \\ x ${PR.s(-h)} = ${px} \\Rightarrow x = ${ix}`,
          `\\text{Outside scales then shifts } y: \\ ${a} \\times ${PR.par(py)}${PR.ct(k)} = ${iy}`,
          `\\text{Image: } (${ix}, ${iy})`,
        ],
        answer: `(${ix}, ${iy})`,
        viz: { type: 'points', points: [[px, py, 'P']], mark: [ix, iy, 'image'] },
        w: { a, h, k, px, py, ix, iy },
      };
    },
    // (x, y) — two different coordinates, not an unordered pair.
    mcqOrdered: true,
    distractors({ a, h, k, px, py, ix, iy }) {
      const pt = (x, y, why) => ({ latex: `(${x}, ${y})`, why });
      return [
        // Shifted x the way the bracket reads rather than the opposite way.
        pt(px - h, iy, 'transform-x-direction'),
        // Added k before scaling.
        pt(ix, a * (py + k), 'transform-order'),
        pt(ix, py + k, 'transform-no-scale'),
        pt(px - h, a * (py + k), 'transform-x-direction'),
        pt(ix, a * py, 'transform-no-scale'),
      ];
    },
  },
  {
    id: 'curve-asymptotes', skill: 'curve-sketching', topic: 'Functions',
    keywords: ['asymptote', 'curve sketch', 'sketch the graph', 'vertical asymptote'],
    mcqOrdered: true, // "x = 3, y = 2" — a vertical and a horizontal, not a pair
    generate() {
      // (ax + b) / (x + c): vertical at x = -c, horizontal at y = a.
      let a, b, c;
      do {
        a = PR.nz(-5, 5); b = PR.nz(-9, 9); c = PR.nz(-6, 6);
      } while (b === a * c); // otherwise it cancels to a constant
      return {
        question: `\\text{Find the asymptotes of } y = \\frac{${PR.lead(a)}${PR.ct(b)}}{x ${PR.s(c)}}`,
        steps: [
          `\\text{The bottom is zero at } x ${PR.s(c)} = 0 \\Rightarrow x = ${-c}`,
          `\\text{As } x \\to \\pm\\infty \\text{ the } ${b} \\text{ and } ${c} \\text{ stop mattering}`,
          `y \\to \\frac{${PR.lead(a)}}{x} = ${a}`,
        ],
        answer: `x = ${-c}, \\ y = ${a}`,
        viz: { type: 'rational', num: [b, a], den: [c, 1], asym: [-c] },
        w: { a, b, c },
      };
    },
    distractors({ a, b, c }) {
      const pair = (v, hz, why) => ({ latex: `x = ${v}, \\ y = ${hz}`, why });
      return [
        // Read the vertical asymptote off without changing sign.
        pair(c, a, 'asymptote-sign'),
        // Horizontal read off the constant rather than the leading coefficient.
        pair(-c, b, 'asymptote-constant'),
        pair(c, b, 'asymptote-sign'),
        pair(-c, PR.r(b / c, 2), 'asymptote-constant'),
        pair(-b, a, 'asymptote-sign'),
      ];
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
          // The LCD is the PRODUCT pqx, so it has to be multiplied out here rather
          // than written `${p}${q}x` — that printed p and q side by side, so p=2,
          // q=3 claimed the LCD was 23x and then correctly used 6x on both lines.
          // badArithmetic cannot reach these: every side carries \frac and x.
          `\\text{Multiply top and bottom by the overall LCD } ${p * q}x`,
          `\\text{Numerator: } ${p * q}x\\left(\\frac{1}{x} + \\frac{1}{${p}}\\right) = ${p * q} + ${q}x`,
          `\\text{Denominator: } ${p * q}x\\left(\\frac{1}{x} - \\frac{1}{${q}}\\right) = ${p * q} - ${p}x`,
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
        // b === -a would make the two denominators mirror images, and then
        // form(B, a, A, b) below renders as exactly the answer with its two terms
        // swapped — a second correct option, in 10.9% of questions. mcqOrdered
        // turns the reordering guard off (it has to; see equivalentAnswers), so
        // nothing downstream catches it and the student is marked wrong for being
        // right, and charged a pf-swapped misconception they did not make.
      } while (p === 0 || q === 0 || b === 0 || b === a || b === -a);
      const px = p === 1 ? 'x' : p === -1 ? '-x' : `${p}x`;
      return {
        question: `\\text{Express in partial fractions: } \\frac{${px} ${PR.s(q)}}{(x ${PR.s(-a)})(x ${PR.s(-b)})}`,
        steps: [
          `\\text{Write } \\frac{${px} ${PR.s(q)}}{(x ${PR.s(-a)})(x ${PR.s(-b)})} = \\frac{A}{x ${PR.s(-a)}} + \\frac{B}{x ${PR.s(-b)}}`,
          `\\text{Multiply through: } ${px} ${PR.s(q)} = A(x ${PR.s(-b)}) + B(x ${PR.s(-a)})`,
          // PR.par on the subtracted root. Either root can be negative, and about
          // three questions in four printed "A(3 - -4)" without it.
          `\\text{Cover-up, } x = ${a}: \\; ${p}(${a}) ${PR.s(q)} = A(${a} - ${PR.par(b)}) \\Rightarrow A = ${A}`,
          `\\text{Cover-up, } x = ${b}: \\; ${p}(${b}) ${PR.s(q)} = B(${b} - ${PR.par(a)}) \\Rightarrow B = ${B}`,
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
          // Emit the sign once instead of subtracting a possibly-negative root:
          // "4A - -3C" invites reading it as 4A - 3C, which yields the wrong C,
          // and PR.xt also drops the coefficient in the a = 1 case that printed
          // "4A - 1C".
          `\\text{Compare constants: } ${c}A ${PR.xt(-a, 'C')} = ${r} \\Rightarrow C = ${C}`,
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
  'sim-elimination': ['\\text{Scale one equation until a coefficient matches, then subtract}'],
  'sim-substitution': ['\\text{Put the } y = mx + c \\text{ equation into the other one, brackets and all}'],
  'sim-word': ['\\text{Two unknowns need two equations — one from each sentence}'],
  'sim-3x3': ['\\text{Remove the same variable from two pairs, then solve the } 2\\times 2'],
  'sim-cramer': ['x = \\dfrac{D_x}{D}, \\quad y = \\dfrac{D_y}{D}, \\quad D = ad - bc'],
  'sim-matrix-solve': ['\\mathbf{x} = A^{-1}\\mathbf{b}, \\quad A^{-1} = \\dfrac{1}{ad - bc}\\begin{pmatrix} d & -b \\\\ -c & a \\end{pmatrix}'],
  'sim-consistency': ['\\text{No unique solution when } \\det A = 0'],
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
  'coord-distance': [
    'd = \\sqrt{(x_2 - x_1)^2 + (y_2 - y_1)^2}',
    'M = \\left(\\dfrac{x_1 + x_2}{2}, \\dfrac{y_1 + y_2}{2}\\right)',
  ],
  'coord-line': ['m = \\dfrac{y_2 - y_1}{x_2 - x_1}, \\quad y - y_1 = m(x - x_1)'],
  'coord-perpendicular': ['m_1 m_2 = -1 \\quad \\text{(perpendicular)}, \\qquad m_1 = m_2 \\quad \\text{(parallel)}'],
  'coord-intersect': ['\\text{Set the two expressions for } y \\text{ equal, solve for } x, \\text{ then substitute back}'],
  'circle-centre-radius': [
    '(x - a)^2 + (y - b)^2 = r^2',
    'x^2 + y^2 + Dx + Ey + F = 0 \\;\\Rightarrow\\; \\text{centre } \\left(-\\tfrac{D}{2}, -\\tfrac{E}{2}\\right)',
  ],
  'diff-product': ['\\dfrac{d}{dx}(uv) = u\'v + uv\''],
  'diff-quotient': ['\\dfrac{d}{dx}\\left(\\dfrac{u}{v}\\right) = \\dfrac{u\'v - uv\'}{v^2}'],
  'diff-transcendental': [
    '\\dfrac{d}{dx}e^{u} = u\'e^{u}, \\quad \\dfrac{d}{dx}\\ln u = \\dfrac{u\'}{u}',
  ],
  'diff-trig-chain': ['\\dfrac{d}{dx}\\sin u = u\'\\cos u, \\quad \\dfrac{d}{dx}\\cos u = -u\'\\sin u'],
  'diff-implicit': [
    '\\text{Differentiate both sides in } x, \\text{ writing } \\dfrac{dy}{dx} \\text{ after every } y \\text{ term}',
  ],
  'de-separable': ['\\text{Get all the } y \\text{ on one side and all the } x \\text{ on the other, then integrate both}'],
  'de-integrating-factor': ['\\dfrac{dy}{dx} + P(x)y = Q(x) \\;\\Rightarrow\\; \\mu = e^{\\int P\\,dx}'],
  'de-auxiliary': [
    'y\'\' + by\' + cy = 0 \\;\\Rightarrow\\; m^2 + bm + c = 0',
    '\\text{Distinct real roots } m_1, m_2: \\ y = Ae^{m_1x} + Be^{m_2x}',
  ],
  'de-growth-decay': ['N = N_0e^{kt}, \\quad k = \\dfrac{1}{t}\\ln\\dfrac{N}{N_0}'],
  'first-principles': ['f\'(x) = \\lim_{h \\to 0}\\dfrac{f(x+h) - f(x)}{h}'],
  'stationary-points': [
    '\\dfrac{dy}{dx} = 0 \\text{ locates them}; \\ \\dfrac{d^2y}{dx^2} < 0 \\text{ max}, \\ > 0 \\text{ min}',
  ],
  'optimisation': ['\\text{Write the quantity in one variable, then set its derivative to } 0'],
  'int-substitution': ['\\int f(u)\\,\\dfrac{du}{dx}\\,dx = \\int f(u)\\,du'],
  'int-by-parts': ['\\int u\\,dv = uv - \\int v\\,du'],
  'area-between': ['A = \\int_a^b (\\text{upper} - \\text{lower})\\,dx'],
  'volume-revolution': ['V = \\pi\\int_a^b y^2\\,dx'],
  'radians-convert': ['\\text{degrees} \\times \\dfrac{\\pi}{180} = \\text{radians}'],
  'arc-sector': ['\\ell = r\\theta, \\quad A = \\tfrac{1}{2}r^2\\theta \\quad (\\theta \\text{ in radians})'],
  'segment-area': ['A = \\tfrac{1}{2}r^2(\\theta - \\sin\\theta) \\quad (\\theta \\text{ in radians})'],
  'trig-simplify': ['\\sin^2\\theta + \\cos^2\\theta = 1, \\quad \\tan\\theta = \\dfrac{\\sin\\theta}{\\cos\\theta}'],
  'trig-graph-features': ['y = a\\sin bx: \\ \\text{amplitude } |a|, \\ \\text{period } \\dfrac{360^\\circ}{b}'],
  'trig-double-angle': ['\\sin 2\\theta = 2\\sin\\theta\\cos\\theta, \\quad \\cos 2\\theta = \\cos^2\\theta - \\sin^2\\theta'],
  'trig-harmonic': ['a\\sin x + b\\cos x = R\\sin(x + \\alpha), \\quad R = \\sqrt{a^2 + b^2}, \\ \\tan\\alpha = \\dfrac{b}{a}'],
  'trig-equation-domain': ['\\text{Substitute } u = bx, \\text{ widen the domain to } b \\times, \\text{ solve, then divide back}'],
  'func-inverse': ['\\text{Swap } x \\text{ and } y, \\text{ then make } y \\text{ the subject}'],
  'func-composite': ['f(g(x)): \\text{ substitute all of } g(x) \\text{ wherever } x \\text{ appears in } f'],
  'func-transform': [
    'y = a\\,f(x - h) + k: \\text{ right } h, \\text{ stretch } \\times a, \\text{ up } k',
  ],
  'curve-asymptotes': [
    '\\text{Vertical: where the denominator is } 0',
    '\\text{Horizontal: the ratio of the leading coefficients}',
  ],
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
