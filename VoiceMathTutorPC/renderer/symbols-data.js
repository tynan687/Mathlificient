// Maths notation — what every symbol means and how to say it out loud.
// Shared by the PC and Android apps.
//
// The gap this fills: a student can know what an integral does and still stall
// on a page because they cannot READ it. Textbooks define symbols the first time
// they appear and never again, so anyone who joins a topic late is stuck. This
// is the lookup that should have existed.
//
// Each entry carries:
//   glyph        the symbol itself, as LaTeX
//   name         what it is called
//   meaning      what it means, in plain words
//   say          how you read the glyph aloud on its own
//   example      a real expression using it
//   exampleSay   how you read that whole expression aloud — the point of the file
//   confusableWith  ids that look or sound similar; drives both the "easily
//                   confused with" card and the quiz's distractors, from one field
//   level        1 = you will meet it in HSC Advanced
//                2 = Extension, or first-year engineering
//
// `say` and `exampleSay` are plain text. They get read by eye and, where the
// platform supports it, by a speech synthesiser — so they are written the way a
// person would actually say them, not transliterated symbol by symbol.

const SYMBOL_CATEGORIES = [
  { id: 'relations', name: 'Equals, and its relatives', order: 1 },
  { id: 'arithmetic', name: 'Arithmetic & grouping', order: 2 },
  { id: 'powers', name: 'Powers, roots & size', order: 3 },
  { id: 'sets', name: 'Sets & number systems', order: 4 },
  { id: 'logic', name: 'Logic & proof', order: 5 },
  { id: 'intervals', name: 'Intervals & infinity', order: 6 },
  { id: 'functions', name: 'Functions & limits', order: 7 },
  { id: 'series', name: 'Sums, products & sequences', order: 8 },
  { id: 'calculus', name: 'Calculus', order: 9 },
  { id: 'trig', name: 'Angles & trigonometry', order: 10 },
  { id: 'linalg', name: 'Vectors & matrices', order: 11 },
  { id: 'stats', name: 'Probability & statistics', order: 12 },
  // Level 3, for first year. Split out rather than piled into `calculus` and
  // `linalg`: those two are already the biggest categories, and a student
  // looking for div and curl is not browsing the same shelf as one looking for
  // the chain rule.
  { id: 'vectorcalc', name: 'Vector calculus', order: 13 },
  { id: 'engnotation', name: 'Engineering notation', order: 14 },
  { id: 'greek', name: 'Greek letters', order: 15 },
];

const SYMBOLS = [
  // ---- Equals, and its relatives -------------------------------------------------
  {
    id: 'equals', glyph: '=', name: 'Equals', category: 'relations', level: 1,
    meaning: 'The two sides are the same number.',
    say: 'equals',
    example: '3x + 1 = 10', exampleSay: 'three x plus one equals ten',
    confusableWith: ['identical', 'approx', 'defined-as'],
  },
  {
    id: 'not-equals', glyph: '\\neq', name: 'Not equal to', category: 'relations', level: 1,
    meaning: 'The two sides are different. Often used to rule out a value that would break a fraction.',
    say: 'is not equal to',
    example: 'x \\neq 3', exampleSay: 'x is not equal to three',
    confusableWith: ['equals'],
  },
  {
    id: 'approx', glyph: '\\approx', name: 'Approximately equal to', category: 'relations', level: 1,
    meaning: 'Close enough for the purpose — usually because the exact value is a decimal that never ends.',
    say: 'is approximately',
    example: '\\pi \\approx 3.142', exampleSay: 'pi is approximately three point one four two',
    confusableWith: ['equals', 'identical', 'proportional'],
  },
  {
    id: 'identical', glyph: '\\equiv', name: 'Identically equal to', category: 'relations', level: 2,
    meaning: 'True for every value, not just some. An identity rather than an equation to solve.',
    say: 'is identically equal to',
    example: '\\sin^2\\theta + \\cos^2\\theta \\equiv 1',
    exampleSay: 'sine squared theta plus cosine squared theta is identically equal to one',
    confusableWith: ['equals', 'approx', 'defined-as'],
  },
  {
    id: 'defined-as', glyph: '\\triangleq', name: 'Is defined as', category: 'relations', level: 2,
    meaning: 'This is a definition, not something being derived. Common in engineering texts.',
    say: 'is defined as',
    example: 'j \\triangleq \\sqrt{-1}', exampleSay: 'j is defined as the square root of minus one',
    confusableWith: ['equals', 'identical'],
  },
  {
    id: 'less-than', glyph: '<', name: 'Less than', category: 'relations', level: 1,
    meaning: 'Strictly smaller. The open end faces the bigger number.',
    say: 'is less than',
    example: 'x < 5', exampleSay: 'x is less than five',
    viz: { type: 'numberline', lo: -4, hi: 8, to: 3, openTo: true, label: 'x < 3' },
    confusableWith: ['greater-than', 'leq'],
  },
  {
    id: 'greater-than', glyph: '>', name: 'Greater than', category: 'relations', level: 1,
    meaning: 'Strictly bigger. The wide end faces the larger side and the point faces the smaller, whichever way round it is written.',
    say: 'is greater than',
    example: '2x > 7', exampleSay: 'two x is greater than seven',
    viz: { type: 'numberline', lo: -4, hi: 8, from: 2, openFrom: true, label: 'x > 2' },
    confusableWith: ['less-than', 'geq'],
  },
  {
    id: 'leq', glyph: '\\le', name: 'Less than or equal to', category: 'relations', level: 1,
    meaning: 'Smaller, or exactly equal. The line underneath is the "or equal to" part.',
    say: 'is less than or equal to',
    example: '0 \\le x \\le 360', exampleSay: 'x is between zero and three hundred and sixty inclusive',
    viz: { type: 'numberline', lo: -4, hi: 8, to: 3, label: 'x ≤ 3 — 3 is included' },
    confusableWith: ['less-than', 'geq'],
  },
  {
    id: 'geq', glyph: '\\ge', name: 'Greater than or equal to', category: 'relations', level: 1,
    meaning: 'Bigger, or exactly equal. Worth reading carefully: whether the endpoint counts changes the answer to most inequality questions.',
    say: 'is greater than or equal to',
    example: 'n \\ge 1', exampleSay: 'n is greater than or equal to one',
    viz: { type: 'numberline', lo: -4, hi: 8, from: 2, label: 'x ≥ 2 — 2 is included' },
    confusableWith: ['greater-than', 'leq'],
  },
  {
    id: 'proportional', glyph: '\\propto', name: 'Proportional to', category: 'relations', level: 2,
    meaning: 'One is a constant multiple of the other — double one and you double the other.',
    say: 'is proportional to',
    example: 'F \\propto \\frac{1}{r^2}',
    exampleSay: 'F is proportional to one over r squared',
    viz: { type: 'poly', coeffs: [0, 1.5], mark: [2, 3] },
    confusableWith: ['approx', 'element-of'],
  },
  {
    id: 'plus-minus', glyph: '\\pm', name: 'Plus or minus', category: 'relations', level: 1,
    meaning: 'Both answers at once — one with the plus, one with the minus.',
    say: 'plus or minus',
    example: 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}',
    exampleSay: 'x equals minus b, plus or minus the square root of b squared minus four a c, all over two a',
    viz: { type: 'numberline', lo: -6, hi: 6, point: 4, from: -4, to: -4, label: 'both ±4' },
    confusableWith: ['equals'],
  },

  // ---- Arithmetic & grouping ------------------------------------------------------
  {
    id: 'times', glyph: '\\times', name: 'Multiplied by', category: 'arithmetic', level: 1,
    meaning: 'Multiplication. Usually dropped entirely in algebra: 3x already means 3 times x.',
    say: 'times',
    example: '3 \\times 4 = 12', exampleSay: 'three times four equals twelve',
    confusableWith: ['cdot', 'cross-product', 'x-variable'],
  },
  {
    id: 'cdot', glyph: '\\cdot', name: 'Multiplication dot', category: 'arithmetic', level: 1,
    meaning: 'Also multiplication. Preferred over × in algebra so it is not mistaken for the letter x.',
    say: 'times',
    example: '2 \\cdot 3 = 6', exampleSay: 'two times three equals six',
    confusableWith: ['times', 'dot-product'],
  },
  {
    id: 'divide', glyph: '\\div', name: 'Divided by', category: 'arithmetic', level: 1,
    meaning: 'Division. Beyond school it is almost always written as a fraction instead.',
    say: 'divided by',
    example: '12 \\div 4 = 3', exampleSay: 'twelve divided by four equals three',
    confusableWith: ['frac'],
  },
  {
    id: 'frac', glyph: '\\frac{a}{b}', name: 'Fraction', category: 'arithmetic', level: 1,
    meaning: 'a divided by b. The bar groups everything above it and everything below it.',
    say: 'a over b',
    example: '\\frac{x + 1}{2}', exampleSay: 'x plus one, all over two',
    confusableWith: ['divide'],
  },
  {
    id: 'parentheses', glyph: '(\\;)', name: 'Brackets', category: 'arithmetic', level: 1,
    meaning: 'Do this part first. They also show what a function is being applied to.',
    say: 'bracket … close bracket',
    example: '2(x + 3)', exampleSay: 'two times, bracket, x plus three, close bracket',
    confusableWith: ['interval-open', 'coordinate'],
  },
  {
    id: 'percent', glyph: '\\%', name: 'Per cent', category: 'arithmetic', level: 1,
    meaning: 'Out of a hundred. 15% is the number 0.15.',
    say: 'per cent',
    example: '15\\% \\text{ of } 80 = 12', exampleSay: 'fifteen per cent of eighty equals twelve',
    confusableWith: [],
  },
  {
    id: 'therefore', glyph: '\\therefore', name: 'Therefore', category: 'arithmetic', level: 1,
    meaning: 'The line that follows is the conclusion. Three dots in a triangle pointing up.',
    say: 'therefore',
    example: '\\therefore x = 4', exampleSay: 'therefore x equals four',
    confusableWith: ['because', 'implies'],
  },
  {
    id: 'because', glyph: '\\because', name: 'Because', category: 'arithmetic', level: 2,
    meaning: 'The reason for the previous line. The same three dots, pointing down.',
    say: 'because',
    example: '\\because a = b', exampleSay: 'because a equals b',
    confusableWith: ['therefore'],
  },

  // ---- Powers, roots & size --------------------------------------------------------
  {
    id: 'power', glyph: 'x^{n}', name: 'Power / index', category: 'powers', level: 1,
    meaning: 'x multiplied by itself n times. The small raised number is the index or exponent.',
    say: 'x to the power n',
    example: '2^5 = 32', exampleSay: 'two to the power five equals thirty two',
    viz: { type: 'poly', coeffs: [0, 0, 1], extra: [{ coeffs: [0, 0, 0, 1] }], mark: [2, 4] },
    confusableWith: ['subscript', 'inverse-fn', 'squared'],
  },
  {
    id: 'squared', glyph: 'x^2', name: 'Squared', category: 'powers', level: 1,
    meaning: 'x times x. Called "squared" because it is the area of a square of side x.',
    say: 'x squared',
    example: 'A = \\pi r^2', exampleSay: 'A equals pi r squared',
    viz: { type: 'poly', coeffs: [0, 0, 1], mark: [3, 9] },
    confusableWith: ['power', 'sqrt'],
  },
  {
    id: 'negative-power', glyph: 'x^{-1}', name: 'Negative index', category: 'powers', level: 1,
    meaning: 'One over. A negative index flips the number, it does not make it negative.',
    say: 'x to the minus one',
    example: '2^{-3} = \\frac{1}{8}', exampleSay: 'two to the minus three equals one eighth',
    // x^-2 rather than x^-1, so this does not draw the identical picture to
    // `arrow`, which uses 1/x to show a value tending to a limit.
    viz: { type: 'rational', num: [1], den: [0, 0, 1], asym: [0] },
    confusableWith: ['inverse-fn', 'power'],
  },
  {
    id: 'frac-power', glyph: 'x^{1/n}', name: 'Fractional index', category: 'powers', level: 2,
    meaning: 'The nth root. A power of one half is a square root.',
    say: 'x to the power one over n',
    example: '8^{2/3} = 4', exampleSay: 'eight to the power two thirds equals four',
    confusableWith: ['sqrt', 'power'],
  },
  {
    id: 'sqrt', glyph: '\\sqrt{x}', name: 'Square root', category: 'powers', level: 1,
    meaning: 'The positive number that squares to give x. The bar over the top says how far the root reaches.',
    say: 'the square root of x',
    example: '\\sqrt{x^2 + 9}', exampleSay: 'the square root of, x squared plus nine',
    confusableWith: ['nth-root', 'squared', 'frac-power'],
  },
  {
    id: 'nth-root', glyph: '\\sqrt[n]{x}', name: 'nth root', category: 'powers', level: 2,
    meaning: 'The number that gives x when raised to the power n.',
    say: 'the nth root of x',
    example: '\\sqrt[3]{27} = 3', exampleSay: 'the cube root of twenty seven equals three',
    confusableWith: ['sqrt', 'frac-power'],
  },
  {
    id: 'abs', glyph: '|x|', name: 'Absolute value', category: 'powers', level: 1,
    meaning: 'How far x is from zero, ignoring the sign. Always zero or positive.',
    say: 'the absolute value of x',
    example: '|{-4}| = 4', exampleSay: 'the absolute value of minus four equals four',
    viz: { type: 'numberline', lo: -3, hi: 9, from: 1, to: 5, point: 3, label: '|x − 3| < 2 IS an interval' },
    confusableWith: ['magnitude', 'determinant', 'given-that'],
  },
  {
    id: 'factorial', glyph: 'n!', name: 'Factorial', category: 'powers', level: 2,
    meaning: 'Multiply every whole number from n down to 1. Counts the ways to order n things.',
    say: 'n factorial',
    example: '5! = 120', exampleSay: 'five factorial equals one hundred and twenty',
    viz: { type: 'stack', values: [1, 2, 3, 4], mode: 'product' },
    confusableWith: [],
  },

  // ---- Sets & number systems --------------------------------------------------------
  {
    id: 'element-of', glyph: '\\in', name: 'Is an element of', category: 'sets', level: 1,
    meaning: 'Belongs to that set. A curly E, for "element".',
    say: 'is in',
    example: 'x \\in \\mathbb{R}', exampleSay: 'x is a real number',
    viz: { type: 'numberline', lo: -4, hi: 6, point: 3, label: '3 is one of them' },
    confusableWith: ['not-element-of', 'subset', 'epsilon'],
  },
  {
    id: 'not-element-of', glyph: '\\notin', name: 'Is not an element of', category: 'sets', level: 2,
    meaning: 'Does not belong to that set.',
    say: 'is not in',
    example: '\\sqrt{2} \\notin \\mathbb{Q}', exampleSay: 'root two is not a rational number',
    confusableWith: ['element-of'],
  },
  {
    id: 'subset', glyph: '\\subset', name: 'Is a subset of', category: 'sets', level: 2,
    meaning: 'Every member of the first set is also in the second.',
    say: 'is a subset of',
    example: '\\mathbb{N} \\subset \\mathbb{Z}', exampleSay: 'the naturals are a subset of the integers',
    viz: { type: 'setdiagram', labels: ['B', 'A'], layout: 'subset', shade: 'subset', caption: 'every A is also a B' },
    confusableWith: ['element-of', 'less-than'],
  },
  {
    id: 'union', glyph: '\\cup', name: 'Union', category: 'sets', level: 2,
    meaning: 'Everything in either set. The cup that holds both.',
    say: 'union',
    example: 'A \\cup B', exampleSay: 'A union B',
    viz: { type: 'setdiagram', labels: ['A', 'B'], shade: 'union', caption: 'in A, or B, or both' },
    confusableWith: ['intersection'],
  },
  {
    id: 'intersection', glyph: '\\cap', name: 'Intersection', category: 'sets', level: 2,
    meaning: 'Only what is in both sets at once.',
    say: 'intersection',
    example: 'A \\cap B', exampleSay: 'A intersection B',
    viz: { type: 'setdiagram', labels: ['A', 'B'], shade: 'intersection', caption: 'in A AND in B' },
    confusableWith: ['union'],
  },
  {
    id: 'empty-set', glyph: '\\emptyset', name: 'Empty set', category: 'sets', level: 2,
    meaning: 'The set with nothing in it. Not the same as zero — zero is a number, this is a set.',
    say: 'the empty set',
    example: 'A \\cap B = \\emptyset', exampleSay: 'A intersection B is empty',
    viz: { type: 'setdiagram', labels: ['A', 'B'], layout: 'disjoint', shade: 'none', caption: 'no members in common' },
    confusableWith: ['zero-vs-empty'],
  },
  {
    id: 'reals', glyph: '\\mathbb{R}', name: 'The real numbers', category: 'sets', level: 1,
    meaning: 'Every number on the number line — whole, fraction, decimal, irrational.',
    say: 'the reals',
    example: 'f: \\mathbb{R} \\to \\mathbb{R}', exampleSay: 'f maps the reals to the reals',
    viz: { type: 'numberline', lo: -5, hi: 5, from: -5, to: 5, label: 'every point on the line' },
    confusableWith: ['integers', 'naturals', 'rationals'],
  },
  {
    id: 'integers', glyph: '\\mathbb{Z}', name: 'The integers', category: 'sets', level: 1,
    meaning: 'Whole numbers, positive, negative and zero. Z is for the German Zahlen.',
    say: 'the integers',
    example: 'n \\in \\mathbb{Z}', exampleSay: 'n is an integer',
    confusableWith: ['reals', 'naturals'],
  },
  {
    id: 'naturals', glyph: '\\mathbb{N}', name: 'The natural numbers', category: 'sets', level: 2,
    meaning: 'The counting numbers, 1, 2, 3 and on.',
    say: 'the naturals',
    example: 'n \\in \\mathbb{N}', exampleSay: 'n is a natural number',
    confusableWith: ['integers', 'reals'],
  },
  {
    id: 'rationals', glyph: '\\mathbb{Q}', name: 'The rational numbers', category: 'sets', level: 2,
    meaning: 'Anything writable as one whole number over another. Q is for quotient.',
    say: 'the rationals',
    example: '\\tfrac{3}{4} \\in \\mathbb{Q}', exampleSay: 'three quarters is rational',
    confusableWith: ['reals', 'integers'],
  },

  // ---- Logic & proof ------------------------------------------------------------------
  {
    id: 'implies', glyph: '\\Rightarrow', name: 'Implies', category: 'logic', level: 1,
    meaning: 'If the left is true then the right follows. It does not promise the reverse.',
    say: 'implies',
    example: 'x = 3 \\Rightarrow x^2 = 9', exampleSay: 'x equals three implies x squared equals nine',
    viz: { type: 'setdiagram', labels: ['B', 'A'], layout: 'subset', shade: 'subset', caption: 'A ⇒ B: no A sits outside B' },
    confusableWith: ['iff', 'maps-to', 'therefore'],
  },
  {
    id: 'iff', glyph: '\\iff', name: 'If and only if', category: 'logic', level: 2,
    meaning: 'Each side implies the other. They are true in exactly the same cases.',
    say: 'if and only if',
    example: 'x^2 = 9 \\iff x = \\pm 3',
    exampleSay: 'x squared equals nine if and only if x is plus or minus three',
    confusableWith: ['implies'],
  },
  {
    id: 'for-all', glyph: '\\forall', name: 'For all', category: 'logic', level: 2,
    meaning: 'True for every value. An upside-down A, for "all".',
    say: 'for all',
    example: '\\forall x \\in \\mathbb{R}, \\ x^2 \\ge 0',
    exampleSay: 'for every real x, x squared is greater than or equal to zero',
    confusableWith: ['exists'],
  },
  {
    id: 'exists', glyph: '\\exists', name: 'There exists', category: 'logic', level: 2,
    meaning: 'At least one value works. A back-to-front E, for "exists".',
    say: 'there exists',
    example: '\\exists x: x^2 = 2', exampleSay: 'there exists an x such that x squared equals two',
    confusableWith: ['for-all', 'element-of'],
  },

  // ---- Intervals & infinity -------------------------------------------------------------
  {
    id: 'infinity', glyph: '\\infty', name: 'Infinity', category: 'intervals', level: 1,
    meaning: 'Larger than any number. Not itself a number — you cannot do arithmetic with it.',
    say: 'infinity',
    example: '\\lim_{x \\to \\infty}', exampleSay: 'the limit as x tends to infinity',
    viz: { type: 'numberline', lo: -5, hi: 5, from: 2, label: 'runs on without end' },
    confusableWith: [],
  },
  {
    id: 'interval-closed', glyph: '[a, b]', name: 'Closed interval', category: 'intervals', level: 2,
    meaning: 'Every number from a to b, with both ends included. Square brackets mean included.',
    say: 'the closed interval a to b',
    example: 'x \\in [0, 1]', exampleSay: 'x is between zero and one, inclusive',
    viz: { type: 'numberline', lo: -3, hi: 8, from: 1, to: 5, label: '[1, 5] — both ends in' },
    confusableWith: ['interval-open', 'coordinate'],
  },
  {
    id: 'interval-open', glyph: '(a, b)', name: 'Open interval', category: 'intervals', level: 2,
    meaning: 'Everything strictly between a and b. Round brackets mean the end is left out.',
    say: 'the open interval a to b',
    example: 'x \\in (0, \\infty)', exampleSay: 'x is greater than zero',
    viz: { type: 'numberline', lo: -3, hi: 8, from: 1, to: 5, openFrom: true, openTo: true, label: '(1, 5) — both ends out' },
    confusableWith: ['interval-closed', 'coordinate', 'parentheses'],
  },
  {
    id: 'coordinate', glyph: '(x, y)', name: 'Coordinate pair', category: 'intervals', level: 1,
    meaning: 'A point in the plane: across first, then up. Identical in appearance to an open interval, so context decides.',
    say: 'the point x comma y',
    example: '(3, -2)', exampleSay: 'the point three, minus two',
    viz: { type: 'points', points: [[3, 2, '(3, 2)']] },
    confusableWith: ['interval-open', 'parentheses'],
  },

  // ---- Functions & limits ----------------------------------------------------------------
  {
    id: 'function', glyph: 'f(x)', name: 'Function notation', category: 'functions', level: 1,
    meaning: 'The output of f when the input is x. NOT f multiplied by x.',
    say: 'f of x',
    example: 'f(x) = 2x + 1', exampleSay: 'f of x equals two x plus one',
    viz: { type: 'poly', coeffs: [1, 0, 0.5], mark: [2, 3] },
    confusableWith: ['parentheses', 'times'],
  },
  {
    id: 'inverse-fn', glyph: 'f^{-1}(x)', name: 'Inverse function', category: 'functions', level: 2,
    meaning: 'The function that undoes f. Despite the notation this is NOT one over f.',
    say: 'f inverse of x',
    example: 'f^{-1}(f(x)) = x', exampleSay: 'f inverse of f of x equals x',
    viz: { type: 'points', lines: [{ m: 2, c: 1 }, { m: 0.5, c: -0.5 }, { m: 1, c: 0 }] },
    confusableWith: ['negative-power', 'inverse-matrix'],
  },
  {
    id: 'composite', glyph: 'f \\circ g', name: 'Composite function', category: 'functions', level: 2,
    meaning: 'Do g first, then f. The one written second acts first.',
    say: 'f composed with g',
    example: '(f \\circ g)(x) = f(g(x))',
    exampleSay: 'f composed with g of x equals f of g of x',
    confusableWith: ['times', 'degrees'],
  },
  {
    id: 'maps-to', glyph: '\\mapsto', name: 'Maps to', category: 'functions', level: 2,
    meaning: 'Sends this input to that output. The bar on the tail distinguishes it from a plain arrow.',
    say: 'maps to',
    example: 'x \\mapsto x^2', exampleSay: 'x maps to x squared',
    confusableWith: ['arrow', 'implies'],
  },
  {
    id: 'arrow', glyph: '\\to', name: 'Tends to / goes to', category: 'functions', level: 1,
    meaning: 'Approaches a value, or names the sets a function runs between.',
    say: 'tends to',
    example: 'x \\to 0^{+}', exampleSay: 'x tends to zero from above',
    viz: { type: 'rational', num: [1], den: [0, 1], asym: [0] },
    confusableWith: ['maps-to', 'implies'],
  },
  {
    id: 'limit', glyph: '\\lim_{x \\to a}', name: 'Limit', category: 'functions', level: 2,
    meaning: 'What the expression heads towards as x gets close to a — whether or not it ever arrives.',
    say: 'the limit as x tends to a',
    example: '\\lim_{h \\to 0}\\frac{f(x+h) - f(x)}{h}',
    exampleSay: 'the limit as h tends to zero of, f of x plus h minus f of x, all over h',
    viz: { type: 'rational', num: [-1, 0, 1], den: [-1, 1], holes: [1] },
    confusableWith: ['arrow'],
  },

  // ---- Sums, products & sequences ------------------------------------------------------
  {
    id: 'sigma-sum', glyph: '\\sum', name: 'Summation', category: 'series', level: 1,
    meaning: 'Add up a list. Capital Greek sigma, S for sum. Below it is where to start, above it where to stop.',
    say: 'the sum of',
    example: '\\sum_{n=1}^{5} n = 15',
    exampleSay: 'the sum, from n equals one to five, of n, equals fifteen',
    viz: { type: 'stack', values: [2, 3, 4, 5], mode: 'sum' },
    confusableWith: ['pi-product', 'sigma-sd', 'integral'],
  },
  {
    id: 'pi-product', glyph: '\\prod', name: 'Product', category: 'series', level: 2,
    meaning: 'Multiply a list together. Capital pi, P for product — the multiplying twin of sigma.',
    say: 'the product of',
    example: '\\prod_{n=1}^{4} n = 24',
    exampleSay: 'the product, from n equals one to four, of n, equals twenty four',
    viz: { type: 'stack', values: [2, 3, 4], mode: 'product' },
    confusableWith: ['sigma-sum', 'pi-number'],
  },
  {
    id: 'subscript', glyph: 'a_n', name: 'Subscript', category: 'series', level: 1,
    meaning: 'A label, not a multiplication: the nth term of the sequence a.',
    say: 'a sub n',
    example: 'a_{10} = 31', exampleSay: 'a ten equals thirty one',
    confusableWith: ['power'],
  },
  {
    id: 'ellipsis', glyph: '\\cdots', name: 'Ellipsis', category: 'series', level: 1,
    meaning: 'Carry on the obvious pattern. Dots on the line for a list, raised for a sum.',
    say: 'and so on',
    example: '1 + 2 + \\cdots + n', exampleSay: 'one plus two plus, and so on, plus n',
    confusableWith: ['therefore'],
  },

  // ---- Calculus ---------------------------------------------------------------------------
  {
    id: 'derivative', glyph: '\\frac{dy}{dx}', name: 'Derivative', category: 'calculus', level: 1,
    meaning: 'The rate at which y changes as x changes — the gradient of the curve. One symbol, not a fraction to cancel.',
    say: 'd y by d x',
    example: '\\frac{dy}{dx} = 3x^2', exampleSay: 'd y by d x equals three x squared',
    viz: { type: 'poly', coeffs: [0, 0, 1], tangentAt: 1.5 },
    confusableWith: ['prime', 'partial', 'delta'],
  },
  {
    id: 'prime', glyph: "f'(x)", name: 'Prime (derivative)', category: 'calculus', level: 1,
    meaning: 'The derivative of f. A second prime means differentiate twice.',
    say: 'f dashed of x',
    example: "f''(x) = 6x", exampleSay: 'f double dashed of x equals six x',
    viz: { type: 'poly', coeffs: [1, 0, 0.6], tangentAt: -1.5 },
    confusableWith: ['derivative', 'power'],
  },
  {
    id: 'second-derivative', glyph: '\\frac{d^2y}{dx^2}', name: 'Second derivative',
    category: 'calculus', level: 2,
    meaning: 'Differentiate twice. Tells you which way the curve bends, and so whether a stationary point is a max or a min.',
    say: 'd two y by d x squared',
    example: '\\frac{d^2y}{dx^2} < 0', exampleSay: 'the second derivative is negative, so it is a maximum',
    viz: { type: 'poly', coeffs: [0, 0, 0, 0.4], tangentAt: 0 },
    confusableWith: ['derivative', 'partial'],
  },
  {
    id: 'partial', glyph: '\\partial', name: 'Partial derivative', category: 'calculus', level: 2,
    meaning: 'Differentiate with respect to one variable and hold the others still. A curly d.',
    say: 'partial',
    example: '\\frac{\\partial f}{\\partial x}', exampleSay: 'partial f by partial x',
    viz: { type: 'surfaceslice', field: 'saddle', at: 0.8, caption: 'vary x, hold y still' },
    confusableWith: ['derivative', 'delta', 'delta-small'],
  },
  {
    id: 'integral', glyph: '\\int', name: 'Integral', category: 'calculus', level: 1,
    meaning: 'Add up infinitely many infinitely thin slices. A stretched S, for sum.',
    say: 'the integral of',
    example: '\\int x^2\\,dx = \\frac{x^3}{3} + C',
    exampleSay: 'the integral of x squared, d x, equals x cubed over three, plus C',
    viz: { type: 'riemann', coeffs: [0.6, 0.5, 0.06], a: 0, b: 6, n: 10 },
    confusableWith: ['definite-integral', 'sigma-sum', 'contour-integral'],
  },
  {
    id: 'definite-integral', glyph: '\\int_a^b', name: 'Definite integral',
    category: 'calculus', level: 1,
    meaning: 'The same sum, but between two limits — so it comes out as a number, usually an area.',
    say: 'the integral from a to b',
    example: '\\int_0^3 2x\\,dx = 9',
    exampleSay: 'the integral from zero to three of two x, d x, equals nine',
    viz: { type: 'area', coeffs: [0.5, 0.4, 0.12], a: 1, b: 4 },
    confusableWith: ['integral', 'sigma-sum'],
  },
  {
    id: 'dx', glyph: 'dx', name: 'The dx', category: 'calculus', level: 1,
    meaning: 'Names the variable you are integrating or differentiating along. Not a multiplication — but it does mark where the integral ends.',
    say: 'd x',
    example: '\\int (x + 1)\\,dx', exampleSay: 'the integral of x plus one, d x',
    viz: { type: 'riemann', coeffs: [1, 0.3, 0.05], a: 0, b: 5, n: 12 },
    confusableWith: ['derivative', 'delta-small'],
  },
  {
    id: 'plus-c', glyph: '+\\,C', name: 'Constant of integration', category: 'calculus', level: 1,
    meaning: 'Any constant differentiates to zero, so an indefinite integral is only known up to one. Leaving it off is the most common mark lost in the topic.',
    say: 'plus C',
    example: '\\int 2x\\,dx = x^2 + C',
    exampleSay: 'the integral of two x, d x, equals x squared plus C',
    viz: { type: 'poly', coeffs: [0, 0, 0.5], extra: [{ coeffs: [2, 0, 0.5] }, { coeffs: [-2, 0, 0.5] }] },
    confusableWith: [],
  },
  {
    id: 'delta', glyph: '\\Delta', name: 'Change in', category: 'calculus', level: 1,
    meaning: 'The change in a quantity: final minus initial. Capital Greek delta, D for difference.',
    say: 'delta',
    example: 'm = \\frac{\\Delta y}{\\Delta x}',
    exampleSay: 'the gradient is delta y over delta x',
    viz: { type: 'points', points: [[1, 2, 'start'], [4, 6, 'end']], segments: [[0, 1]] },
    confusableWith: ['delta-small', 'derivative', 'discriminant'],
  },
  {
    id: 'discriminant', glyph: '\\Delta', name: 'Discriminant', category: 'calculus', level: 1,
    meaning: 'The same letter, a different job: b² − 4ac, which says how many roots a quadratic has. Context tells you which is meant.',
    say: 'the discriminant',
    example: '\\Delta = b^2 - 4ac > 0',
    exampleSay: 'the discriminant is positive, so there are two real roots',
    viz: { type: 'poly', coeffs: [1, -2, 1], extra: [{ coeffs: [-2, -2, 1] }, { coeffs: [3, -2, 1] }] },
    confusableWith: ['delta'],
  },
  {
    id: 'contour-integral', glyph: '\\oint', name: 'Closed integral', category: 'calculus', level: 2,
    meaning: 'An integral all the way around a closed loop. Common in electrical and fluid engineering.',
    say: 'the closed integral of',
    example: '\\oint \\vec{E} \\cdot d\\vec{l} = 0',
    exampleSay: 'the closed integral of E dot d l equals zero',
    viz: { type: 'contourpath', caption: 'all the way round, back to the start' },
    confusableWith: ['integral'],
  },
  {
    id: 'nabla', glyph: '\\nabla', name: 'Nabla (gradient)', category: 'vectorcalc', level: 3,
    meaning: 'Points the way the surface climbs fastest, and its length says how steep that climb is.',
    say: 'grad',
    example: '\\nabla f = \\left( \\frac{\\partial f}{\\partial x}, \\frac{\\partial f}{\\partial y} \\right)',
    exampleSay: 'grad f equals the partial of f with respect to x, and the partial with respect to y',
    viz: { type: 'vectorfield', field: 'bowl', caption: 'every arrow points straight uphill' },
    confusableWith: ['partial', 'delta', 'derivative'],
  },

  // ---- Angles & trigonometry ---------------------------------------------------------------
  {
    id: 'theta', glyph: '\\theta', name: 'Theta', category: 'trig', level: 1,
    meaning: 'The default name for an unknown angle.',
    say: 'theta',
    example: '\\sin\\theta = 0.5', exampleSay: 'sine theta equals nought point five',
    viz: { type: 'unitcircle', angles: [50] },
    confusableWith: ['phi', 'zero-vs-empty'],
  },
  {
    id: 'degrees', glyph: '^\\circ', name: 'Degrees', category: 'trig', level: 1,
    meaning: 'Angle measured in degrees, 360 to a full turn.',
    say: 'degrees',
    example: '\\sin 30^\\circ = \\tfrac{1}{2}', exampleSay: 'sine thirty degrees equals a half',
    viz: { type: 'unitcircle', angles: [90, 180, 270, 45] },
    confusableWith: ['composite', 'radians'],
  },
  {
    id: 'radians', glyph: '\\text{rad}', name: 'Radians', category: 'trig', level: 1,
    meaning: 'The other angle unit: 2π to a full turn. Calculus formulas only work in radians.',
    say: 'radians',
    example: '\\pi \\text{ rad} = 180^\\circ', exampleSay: 'pi radians equals one hundred and eighty degrees',
    viz: { type: 'unitcircle', angles: [57] },
    confusableWith: ['degrees'],
  },
  {
    id: 'pi-number', glyph: '\\pi', name: 'Pi', category: 'trig', level: 1,
    meaning: 'The circumference of a circle divided by its diameter, about 3.14159.',
    say: 'pi',
    example: 'C = 2\\pi r', exampleSay: 'the circumference equals two pi r',
    confusableWith: ['pi-product'],
  },
  {
    id: 'arcsin', glyph: '\\sin^{-1}', name: 'Inverse sine', category: 'trig', level: 2,
    meaning: 'The angle whose sine is that value. The −1 means inverse, NOT one over sine.',
    say: 'inverse sine',
    example: '\\sin^{-1}(0.5) = 30^\\circ', exampleSay: 'inverse sine of nought point five equals thirty degrees',
    viz: { type: 'sine', a: 1, b: 1, xmax: 360, k: 0.5, sols: [30, 150] },
    confusableWith: ['negative-power', 'inverse-fn'],
  },

  // ---- Vectors & matrices ---------------------------------------------------------------------
  {
    id: 'vector', glyph: '\\vec{a}', name: 'Vector', category: 'linalg', level: 2,
    meaning: 'A quantity with both size and direction. Written with an arrow, or in bold, or underlined by hand.',
    say: 'vector a',
    example: '\\vec{a} = (3, 4)', exampleSay: 'vector a equals three, four',
    viz: { type: 'vectors', a: [3, 2], b: [1, -2] },
    confusableWith: ['magnitude', 'arrow'],
  },
  {
    id: 'magnitude', glyph: '|\\vec{a}|', name: 'Magnitude', category: 'linalg', level: 2,
    meaning: 'The length of the vector, with its direction thrown away.',
    say: 'the magnitude of a',
    example: '|\\vec{a}| = 5', exampleSay: 'the magnitude of a equals five',
    viz: { type: 'vectors', a: [4, 3], b: [4, 0] },
    confusableWith: ['abs', 'determinant'],
  },
  {
    id: 'dot-product', glyph: '\\vec{a} \\cdot \\vec{b}', name: 'Dot product',
    category: 'linalg', level: 2,
    meaning: 'Multiply matching components and add. Gives a NUMBER, and tells you the angle between them.',
    say: 'a dot b',
    example: '\\vec{a} \\cdot \\vec{b} = |\\vec{a}||\\vec{b}|\\cos\\theta',
    exampleSay: 'a dot b equals the magnitude of a, times the magnitude of b, times cosine theta',
    viz: { type: 'vectors', a: [4, 1], b: [1, 3] },
    confusableWith: ['cross-product', 'cdot'],
  },
  {
    id: 'cross-product', glyph: '\\vec{a} \\times \\vec{b}', name: 'Cross product',
    category: 'linalg', level: 2,
    meaning: 'Gives a VECTOR at right angles to both. Only exists in three dimensions.',
    say: 'a cross b',
    example: '|\\vec{a} \\times \\vec{b}| = |\\vec{a}||\\vec{b}|\\sin\\theta',
    exampleSay: 'the magnitude of a cross b equals a b sine theta',
    viz: { type: 'vectors', a: [3, 1], b: [1, 3] },
    confusableWith: ['dot-product', 'times'],
  },
  {
    id: 'determinant', glyph: '\\det A', name: 'Determinant', category: 'linalg', level: 2,
    meaning: 'A single number from a square matrix. Zero means the matrix has no inverse.',
    say: 'the determinant of A',
    example: '\\det A = ad - bc', exampleSay: 'the determinant of A equals a d minus b c',
    viz: { type: 'vectors', a: [3, 1], b: [1, 2] },
    confusableWith: ['abs', 'magnitude'],
  },
  {
    id: 'inverse-matrix', glyph: 'A^{-1}', name: 'Inverse matrix', category: 'linalg', level: 2,
    meaning: 'The matrix that undoes A. Again not one over A — you cannot divide by a matrix.',
    say: 'A inverse',
    example: 'AA^{-1} = I', exampleSay: 'A times A inverse equals the identity',
    confusableWith: ['inverse-fn', 'negative-power', 'transpose'],
  },
  {
    id: 'transpose', glyph: 'A^{T}', name: 'Transpose', category: 'linalg', level: 2,
    meaning: 'Flip the matrix over its diagonal — rows become columns.',
    say: 'A transpose',
    example: '(AB)^{T} = B^{T}A^{T}',
    exampleSay: 'A B transpose equals B transpose A transpose',
    confusableWith: ['inverse-matrix', 'power'],
  },

  // ---- Probability & statistics -----------------------------------------------------------------
  {
    id: 'probability', glyph: 'P(A)', name: 'Probability of A', category: 'stats', level: 1,
    meaning: 'How likely A is, between 0 and 1.',
    say: 'the probability of A',
    example: 'P(A) = 0.25', exampleSay: 'the probability of A equals nought point two five',
    viz: { type: 'setdiagram', labels: ['A', 'S'], layout: 'subset', shade: 'subset', caption: 'A as a slice of everything' },
    confusableWith: ['conditional', 'function'],
  },
  {
    id: 'conditional', glyph: 'P(A \\mid B)', name: 'Conditional probability',
    category: 'stats', level: 2,
    meaning: 'The chance of A GIVEN that B already happened. The bar means "given".',
    say: 'the probability of A given B',
    example: 'P(A \\mid B) = \\frac{P(A \\cap B)}{P(B)}',
    exampleSay: 'the probability of A given B equals the probability of A and B, over the probability of B',
    viz: { type: 'tree', given: 0, caption: 'given B, you read only the top branch', branches: [{ p: '0.6', label: 'B', children: [{ p: '0.7', label: 'A' }, { p: '0.3', label: 'not A' }] }, { p: '0.4', label: 'not B', children: [{ p: '0.2', label: 'A' }, { p: '0.8', label: 'not A' }] }] },
    confusableWith: ['probability', 'given-that', 'abs'],
  },
  {
    id: 'given-that', glyph: '\\mid', name: 'The vertical bar', category: 'stats', level: 2,
    meaning: 'Three different jobs depending on where it appears: "given" in probability, "divides" in number theory, and absolute value in a pair.',
    say: 'given',
    example: 'P(A \\mid B)', exampleSay: 'the probability of A given B',
    viz: { type: 'tree', given: 1, caption: 'the bar picks one branch to stand on', branches: [{ p: '0.5', label: 'rain', children: [{ p: '0.8', label: 'late' }, { p: '0.2', label: 'on time' }] }, { p: '0.5', label: 'dry', children: [{ p: '0.1', label: 'late' }, { p: '0.9', label: 'on time' }] }] },
    confusableWith: ['abs', 'conditional'],
  },
  {
    id: 'xbar', glyph: '\\bar{x}', name: 'Sample mean', category: 'stats', level: 1,
    meaning: 'The average of your data. The bar on top says "mean of".',
    say: 'x bar',
    example: '\\bar{x} = \\frac{\\sum x}{n}', exampleSay: 'x bar equals the sum of x over n',
    viz: { type: 'dots', values: [3, 4, 4, 5, 6, 6, 7], mean: 5 },
    confusableWith: ['mu', 'xhat'],
  },
  {
    id: 'mu', glyph: '\\mu', name: 'Population mean', category: 'stats', level: 2,
    meaning: 'The true mean of the whole population, as opposed to the mean of your sample.',
    say: 'mu',
    example: 'X \\sim N(\\mu, \\sigma^2)',
    exampleSay: 'X is normally distributed with mean mu and variance sigma squared',
    viz: { type: 'dots', values: [2, 4, 5, 5, 6, 8], mean: 5 },
    confusableWith: ['xbar', 'sigma-sd'],
  },
  {
    id: 'sigma-sd', glyph: '\\sigma', name: 'Standard deviation', category: 'stats', level: 1,
    meaning: 'How spread out the data is. Lower case sigma — its capital is the summation sign.',
    say: 'sigma',
    example: '\\sigma = 2.5', exampleSay: 'the standard deviation equals two point five',
    viz: { type: 'dots', values: [1, 3, 5, 5, 7, 9], mean: 5 },
    confusableWith: ['sigma-sum', 'mu'],
  },
  {
    id: 'variance', glyph: '\\sigma^2', name: 'Variance', category: 'stats', level: 2,
    meaning: 'The standard deviation squared. Easier to do algebra with, harder to interpret.',
    say: 'sigma squared',
    example: '\\sigma^2 = 6.25', exampleSay: 'the variance equals six point two five',
    confusableWith: ['sigma-sd'],
  },
  {
    id: 'distributed-as', glyph: '\\sim', name: 'Is distributed as', category: 'stats', level: 2,
    meaning: 'This random variable follows that distribution.',
    say: 'is distributed as',
    example: 'X \\sim B(10, 0.5)',
    exampleSay: 'X is binomially distributed with n equals ten and p equals nought point five',
    confusableWith: ['approx', 'proportional'],
  },
  {
    id: 'ncr', glyph: '\\binom{n}{k}', name: 'Binomial coefficient', category: 'stats', level: 2,
    meaning: 'How many ways to choose k things from n, order not mattering. Also written nCk.',
    say: 'n choose k',
    example: '\\binom{5}{2} = 10', exampleSay: 'five choose two equals ten',
    viz: { type: 'bars', values: [1, 5, 10, 10, 5, 1], highlight: 2, startIndex: 0 },
    confusableWith: ['frac', 'coordinate'],
  },

  // ---- Greek letters -----------------------------------------------------------------------------
  {
    id: 'alpha', glyph: '\\alpha', name: 'Alpha', category: 'greek', level: 1,
    meaning: 'Usually an angle, or the first of a set of constants.',
    say: 'alpha',
    example: '\\alpha + \\beta = 90^\\circ', exampleSay: 'alpha plus beta equals ninety degrees',
    confusableWith: ['beta'],
  },
  {
    id: 'beta', glyph: '\\beta', name: 'Beta', category: 'greek', level: 1,
    meaning: 'The second angle or constant, after alpha.',
    say: 'beta',
    example: '\\tan\\beta = 2', exampleSay: 'tan beta equals two',
    confusableWith: ['alpha'],
  },
  {
    id: 'delta-small', glyph: '\\delta', name: 'Small delta', category: 'greek', level: 2,
    meaning: 'A very small change — smaller than a capital-delta change, on the way to becoming a derivative.',
    say: 'delta',
    example: '\\delta x \\to 0', exampleSay: 'delta x tends to zero',
    confusableWith: ['delta', 'partial'],
  },
  {
    id: 'epsilon', glyph: '\\varepsilon', name: 'Epsilon', category: 'greek', level: 2,
    meaning: 'A tiny positive amount, in limit proofs. Looks like the "is an element of" sign but is a letter.',
    say: 'epsilon',
    example: '|f(x) - L| < \\varepsilon',
    exampleSay: 'the absolute value of f of x minus L is less than epsilon',
    confusableWith: ['element-of'],
  },
  {
    id: 'lambda', glyph: '\\lambda', name: 'Lambda', category: 'greek', level: 2,
    meaning: 'Wavelength in physics, an eigenvalue in linear algebra, a rate in statistics.',
    say: 'lambda',
    example: 'v = f\\lambda', exampleSay: 'v equals f lambda',
    confusableWith: [],
  },
  {
    id: 'phi', glyph: '\\phi', name: 'Phi', category: 'greek', level: 2,
    meaning: 'A second angle name after theta; also the golden ratio, and phase in engineering.',
    say: 'phi',
    example: '\\phi = 30^\\circ', exampleSay: 'phi equals thirty degrees',
    confusableWith: ['theta'],
  },
  {
    id: 'omega', glyph: '\\omega', name: 'Omega', category: 'greek', level: 2,
    meaning: 'Angular velocity — how fast something turns, in radians per second.',
    say: 'omega',
    example: '\\omega = 2\\pi f', exampleSay: 'omega equals two pi f',
    confusableWith: ['ohm'],
  },
  {
    id: 'ohm', glyph: '\\Omega', name: 'Capital omega (ohm)', category: 'greek', level: 2,
    meaning: 'The unit of electrical resistance. Same letter as omega, capitalised.',
    say: 'ohms',
    example: 'R = 47\\,\\Omega', exampleSay: 'R equals forty seven ohms',
    confusableWith: ['omega'],
  },
  {
    id: 'rho', glyph: '\\rho', name: 'Rho', category: 'greek', level: 2,
    meaning: 'Density, or resistivity. Looks like a lower-case p with a tail.',
    say: 'rho',
    example: '\\rho = \\frac{m}{V}', exampleSay: 'rho equals m over V',
    confusableWith: [],
  },
  {
    id: 'tau', glyph: '\\tau', name: 'Tau', category: 'greek', level: 2,
    meaning: 'A time constant, or torque.',
    say: 'tau',
    example: '\\tau = RC', exampleSay: 'tau equals R C',
    confusableWith: [],
  },

  // ---- Traps worth their own entry -------------------------------------------------------------------
  {
    id: 'x-variable', glyph: 'x', name: 'x, the letter', category: 'arithmetic', level: 1,
    meaning: 'The usual name for an unknown. Written × for multiplication it is a different symbol entirely, which is why algebra drops the multiplication sign.',
    say: 'x',
    example: '3x \\times 2 = 6x', exampleSay: 'three x times two equals six x',
    confusableWith: ['times', 'cross-product'],
  },
  {
    id: 'zero-vs-empty', glyph: '0 \\ \\text{vs} \\ \\emptyset',
    name: 'Zero versus the empty set', category: 'sets', level: 2,
    meaning: 'Zero is a number. The empty set is a set with no members. A set containing zero is not empty.',
    say: 'zero, and the empty set',
    example: '\\{0\\} \\neq \\emptyset', exampleSay: 'the set containing zero is not the empty set',
    viz: { type: 'setdiagram', labels: ['{0}', '∅'], layout: 'disjoint', shade: 'left', caption: 'a set holding 0 is not empty' },
    confusableWith: ['empty-set', 'theta'],
  },
  {
    id: 'xhat', glyph: '\\hat{x}', name: 'Hat', category: 'linalg', level: 2,
    meaning: 'A unit vector — length exactly one, direction only. In statistics it means an estimate instead.',
    say: 'x hat',
    example: '\\hat{a} = \\frac{\\vec{a}}{|\\vec{a}|}',
    exampleSay: 'a hat equals vector a over the magnitude of a',
    viz: { type: 'vectors', a: [1, 0], b: [3, 2] },
    confusableWith: ['xbar', 'vector'],
  },

  // ---- Vector calculus (level 3) ---------------------------------------------------------
  // The ∇ family is where first year loses people: the same upside-down triangle
  // means three different operations depending on what follows it, and nobody
  // says so out loud. Each entry leads with that distinction.
  {
    id: 'divergence', glyph: '\\nabla \\cdot \\vec{F}', name: 'Divergence',
    category: 'vectorcalc', level: 3,
    meaning: 'How much the field is spreading out from a point. A dot after nabla, so the answer is a number.',
    say: 'div F',
    example: '\\nabla \\cdot \\vec{F} = \\frac{\\partial P}{\\partial x} + \\frac{\\partial Q}{\\partial y}',
    exampleSay: 'div F equals the partial of P by x plus the partial of Q by y',
    viz: { type: 'vectorfield', field: 'bowl', caption: 'arrows flowing outward: positive divergence' },
    confusableWith: ['nabla', 'curl', 'dot-product'],
  },
  {
    id: 'curl', glyph: '\\nabla \\times \\vec{F}', name: 'Curl', category: 'vectorcalc', level: 3,
    meaning: 'How much the field swirls around a point. A cross after nabla, so the answer is a vector.',
    say: 'curl F',
    example: '\\nabla \\times \\vec{F} = \\vec{0}',
    exampleSay: 'curl F equals the zero vector, so the field is irrotational',
    viz: { type: 'contourpath', caption: 'circulation around a loop' },
    confusableWith: ['nabla', 'divergence', 'cross-product'],
  },
  {
    id: 'laplacian', glyph: '\\nabla^2 f', name: 'Laplacian', category: 'vectorcalc', level: 3,
    meaning: 'The divergence of the gradient. It compares a point to the average of its neighbours.',
    say: 'del squared f',
    example: '\\nabla^2 f = \\frac{\\partial^2 f}{\\partial x^2} + \\frac{\\partial^2 f}{\\partial y^2}',
    exampleSay: 'del squared f equals the second partial by x plus the second partial by y',
    viz: { type: 'surfaceslice', field: 'bowl', at: 0, caption: 'curvature added up over every direction' },
    confusableWith: ['nabla', 'divergence', 'second-derivative'],
  },
  {
    id: 'double-integral', glyph: '\\iint', name: 'Double integral', category: 'vectorcalc', level: 3,
    meaning: 'Add up over a flat region instead of along a line. Two signs, two variables to integrate.',
    say: 'the double integral of',
    example: '\\iint_R f(x, y)\\, dA',
    exampleSay: 'the double integral over R of f of x y, d A',
    viz: { type: 'riemann', coeffs: [0.8, 0.4, 0.05], a: 0, b: 5, n: 8 },
    confusableWith: ['integral', 'triple-integral', 'definite-integral'],
  },
  {
    id: 'triple-integral', glyph: '\\iiint', name: 'Triple integral', category: 'vectorcalc', level: 3,
    meaning: 'Add up over a solid. Three signs, three variables, and the result is usually a volume or a mass.',
    say: 'the triple integral of',
    example: '\\iiint_V \\rho \\, dV',
    exampleSay: 'the triple integral over V of rho, d V',
    confusableWith: ['double-integral', 'integral'],
  },
  {
    id: 'closed-surface-integral', glyph: '\\oiint', name: 'Closed surface integral',
    category: 'vectorcalc', level: 3,
    meaning: 'An integral over a surface that seals a volume, like the sphere in Gauss law.',
    say: 'the closed surface integral of',
    example: '\\oiint_S \\vec{F} \\cdot d\\vec{S} = Q',
    exampleSay: 'the closed surface integral of F dot d S equals Q',
    confusableWith: ['contour-integral', 'double-integral'],
  },
  {
    id: 'normal-vector', glyph: '\\hat{n}', name: 'Unit normal', category: 'vectorcalc', level: 3,
    meaning: 'A vector of length one sticking straight out of a surface, used to measure flow through it.',
    say: 'n hat',
    example: '\\vec{F} \\cdot \\hat{n} \\, dS',
    exampleSay: 'F dot n hat, d S',
    viz: { type: 'vectors', a: [0, 2.5], b: [3, 0] },
    confusableWith: ['xhat', 'vector', 'flux'],
  },
  {
    id: 'flux', glyph: '\\Phi', name: 'Flux', category: 'vectorcalc', level: 3,
    meaning: 'How much of a field passes through a surface. Capital phi, and it is a number, not a vector.',
    say: 'phi',
    example: '\\Phi = \\iint_S \\vec{F} \\cdot \\hat{n} \\, dS',
    exampleSay: 'phi equals the double integral over S of F dot n hat, d S',
    confusableWith: ['phi', 'normal-vector', 'divergence'],
  },
  {
    id: 'line-element', glyph: 'd\\vec{r}', name: 'Line element', category: 'vectorcalc', level: 3,
    meaning: 'A tiny step along a path, pointing the way you are travelling. It carries a direction.',
    say: 'd r vector',
    example: '\\int_C \\vec{F} \\cdot d\\vec{r}',
    exampleSay: 'the integral along C of F dot d r vector',
    confusableWith: ['dx', 'vector', 'contour-integral'],
  },
  {
    id: 'directional-derivative', glyph: 'D_{\\vec{u}} f', name: 'Directional derivative',
    category: 'vectorcalc', level: 3,
    meaning: 'The slope you feel walking in one chosen direction, rather than along an axis.',
    say: 'the directional derivative of f in the direction u',
    example: 'D_{\\vec{u}} f = \\nabla f \\cdot \\hat{u}',
    exampleSay: 'the directional derivative of f equals grad f dot u hat',
    viz: { type: 'surfaceslice', field: 'hill', at: -0.8, caption: 'one direction, one slope' },
    confusableWith: ['nabla', 'partial', 'dot-product'],
  },
  {
    id: 'jacobian', glyph: 'J', name: 'Jacobian', category: 'vectorcalc', level: 3,
    meaning: 'The stretch factor when you change coordinates. It is why polar integrals grow an extra r.',
    say: 'the Jacobian',
    example: 'dx\\,dy = r\\,dr\\,d\\theta',
    exampleSay: 'd x d y equals r, d r, d theta',
    confusableWith: ['determinant', 'partial'],
  },

  // ---- Engineering notation (level 3) ---------------------------------------------------
  {
    // The single most useful entry in the level-3 set. HSC teaches i, first-year
    // electrical uses j because i is already current, and nobody tells students.
    id: 'imaginary-j', glyph: 'j', name: 'j — the imaginary unit, in engineering',
    category: 'engnotation', level: 3,
    meaning: 'Exactly the same thing as i. Electrical engineering writes j because i already means current.',
    say: 'j',
    example: 'j^2 = -1, \\quad Z = R + jX',
    exampleSay: 'j squared equals minus one, and Z equals R plus j X',
    confusableWith: ['imaginary-unit-i'],
  },
  {
    id: 'imaginary-unit-i', glyph: 'i', name: 'i — the imaginary unit, in maths',
    category: 'engnotation', level: 3,
    meaning: 'The square root of minus one, as every maths course writes it. Engineering calls the same thing j.',
    say: 'i',
    example: 'i^2 = -1, \\quad z = 3 + 4i',
    exampleSay: 'i squared equals minus one, and z equals three plus four i',
    confusableWith: ['imaginary-j'],
  },
  {
    id: 'laplace', glyph: '\\mathcal{L}', name: 'Laplace transform', category: 'engnotation', level: 3,
    meaning: 'Turns a differential equation in time into an algebra problem in s. Script capital L.',
    say: 'the Laplace transform of',
    example: '\\mathcal{L}\\{f(t)\\} = F(s)',
    exampleSay: 'the Laplace transform of f of t equals capital F of s',
    confusableWith: ['fourier', 'function'],
  },
  {
    id: 'fourier', glyph: '\\mathcal{F}', name: 'Fourier transform', category: 'engnotation', level: 3,
    meaning: 'Breaks a signal into the frequencies it is made of. Script capital F, not the letter F.',
    say: 'the Fourier transform of',
    example: '\\mathcal{F}\\{f(t)\\} = F(\\omega)',
    exampleSay: 'the Fourier transform of f of t equals capital F of omega',
    confusableWith: ['laplace', 'function'],
  },
  {
    id: 'convolution', glyph: '*', name: 'Convolution', category: 'engnotation', level: 3,
    meaning: 'Sliding one signal over another and integrating the overlap. Not ordinary multiplication.',
    say: 'convolved with',
    example: '(f * g)(t) = \\int f(\\tau) g(t - \\tau)\\, d\\tau',
    exampleSay: 'f convolved with g, at t, equals the integral of f of tau times g of t minus tau, d tau',
    confusableWith: ['times', 'cdot', 'conjugate'],
  },
  {
    id: 'conjugate', glyph: 'z^*', name: 'Complex conjugate', category: 'engnotation', level: 3,
    meaning: 'Flip the sign of the imaginary part. A star, and in some texts a bar over the letter instead.',
    say: 'z star',
    example: '(3 + 4j)^* = 3 - 4j',
    exampleSay: 'three plus four j, conjugated, equals three minus four j',
    confusableWith: ['convolution', 'imaginary-j', 'xbar'],
  },
  {
    id: 'big-o', glyph: 'O(n^2)', name: 'Big O', category: 'engnotation', level: 3,
    meaning: 'How fast something grows once the input is large. It hides constants deliberately.',
    say: 'big oh of n squared',
    example: 'T(n) = O(n \\log n)',
    exampleSay: 'T of n is big oh of n log n',
    confusableWith: ['proportional', 'asymptotic'],
  },
  {
    id: 'asymptotic', glyph: '\\sim', name: 'Behaves like', category: 'engnotation', level: 3,
    meaning: 'The two sides approach the same behaviour in the limit, even if they never become equal.',
    say: 'behaves like',
    example: 'n! \\sim \\sqrt{2\\pi n}\\left(\\frac{n}{e}\\right)^n',
    exampleSay: 'n factorial behaves like the square root of two pi n, times n over e, all to the n',
    confusableWith: ['approx', 'big-o', 'distributed-as'],
  },
  {
    id: 'much-less', glyph: '\\ll', name: 'Much less than', category: 'engnotation', level: 3,
    meaning: 'Smaller by enough that you are about to neglect it. An engineering judgement, not a fixed ratio.',
    say: 'is much less than',
    example: 'R \\ll \\omega L',
    exampleSay: 'R is much less than omega L',
    confusableWith: ['less-than', 'much-greater'],
  },
  {
    id: 'much-greater', glyph: '\\gg', name: 'Much greater than', category: 'engnotation', level: 3,
    meaning: 'Bigger by enough that the other term can be dropped. The usual excuse for an approximation.',
    say: 'is much greater than',
    example: '\\omega \\gg \\frac{1}{RC}',
    exampleSay: 'omega is much greater than one over R C',
    confusableWith: ['greater-than', 'much-less'],
  },
  {
    id: 'norm', glyph: '\\|x\\|', name: 'Norm', category: 'engnotation', level: 3,
    meaning: 'The length of a vector, written with double bars to distinguish it from absolute value.',
    say: 'the norm of x',
    example: '\\|\\vec{v}\\| = \\sqrt{v_1^2 + v_2^2}',
    exampleSay: 'the norm of v equals the square root of v one squared plus v two squared',
    viz: { type: 'vectors', a: [3, 4], b: [3, 0] },
    confusableWith: ['abs', 'magnitude', 'determinant'],
  },
  {
    id: 'inner-product', glyph: '\\langle u, v \\rangle', name: 'Inner product',
    category: 'engnotation', level: 3,
    meaning: 'A dot product written in angle brackets, used once vectors stop being arrows in space.',
    say: 'the inner product of u and v',
    example: '\\langle u, v \\rangle = 0',
    exampleSay: 'the inner product of u and v equals zero, so they are orthogonal',
    confusableWith: ['dot-product', 'expectation'],
  },
  {
    id: 'expectation', glyph: '\\langle x \\rangle', name: 'Average value',
    category: 'engnotation', level: 3,
    meaning: 'Angle brackets around one thing mean its average, in physics and signals rather than statistics.',
    say: 'the average of x',
    example: '\\langle x \\rangle = \\frac{1}{T}\\int_0^T x(t)\\, dt',
    exampleSay: 'the average of x equals one over T, times the integral from zero to T of x of t, d t',
    viz: { type: 'dots', values: [2, 3, 4, 4, 5, 6], mean: 4 },
    confusableWith: ['xbar', 'mu', 'inner-product'],
  },
  {
    id: 'defined-triangle', glyph: '\\triangleq', name: 'Is defined to be',
    category: 'engnotation', level: 3,
    meaning: 'This is a definition, not something being derived. The triangle says stop looking for a proof.',
    say: 'is defined to be',
    example: '\\tau \\triangleq RC',
    exampleSay: 'tau is defined to be R C',
    confusableWith: ['defined-as', 'equals', 'identical'],
  },
  {
    id: 'phase-angle', glyph: '\\angle \\theta', name: 'Phase angle', category: 'engnotation', level: 3,
    meaning: 'The angle part of a phasor, written after the magnitude. Polar form for alternating current.',
    say: 'at an angle of theta',
    example: 'V = 240 \\angle 30^\\circ',
    exampleSay: 'V equals two hundred and forty, at an angle of thirty degrees',
    viz: { type: 'unitcircle', angles: [30] },
    confusableWith: ['theta', 'degrees', 'imaginary-j'],
  },
  {
    id: 'dirac-delta', glyph: '\\delta(t)', name: 'Dirac delta', category: 'engnotation', level: 3,
    meaning: 'An idealised spike: zero everywhere, infinite at one instant, with total area exactly one.',
    say: 'delta of t',
    example: '\\int_{-\\infty}^{\\infty} \\delta(t)\\, dt = 1',
    exampleSay: 'the integral of delta of t over all t equals one',
    confusableWith: ['delta', 'delta-small', 'unit-step'],
  },
  {
    id: 'unit-step', glyph: 'u(t)', name: 'Unit step', category: 'engnotation', level: 3,
    meaning: 'Zero before the switch is thrown and one after it. The building block of every switching problem.',
    say: 'u of t',
    example: 'u(t) = \\begin{cases} 0 & t < 0 \\\\ 1 & t \\ge 0 \\end{cases}',
    exampleSay: 'u of t is zero for t less than zero, and one for t at least zero',
    confusableWith: ['dirac-delta', 'function'],
  },
  {
    id: 'sgn', glyph: '\\mathrm{sgn}(x)', name: 'Sign function', category: 'engnotation', level: 3,
    meaning: 'Reports only the sign: minus one, zero, or plus one. It throws the size away.',
    say: 'sign of x',
    example: '\\mathrm{sgn}(-7) = -1',
    exampleSay: 'sign of minus seven equals minus one',
    confusableWith: ['abs', 'unit-step'],
  },
  {
    id: 'tensor-product', glyph: '\\otimes', name: 'Tensor product', category: 'engnotation', level: 3,
    meaning: 'Combines two spaces into a bigger one. A circled cross, not an ordinary multiplication.',
    say: 'tensor',
    example: 'u \\otimes v',
    exampleSay: 'u tensor v',
    confusableWith: ['times', 'cross-product', 'hadamard'],
  },
  {
    id: 'hadamard', glyph: '\\odot', name: 'Elementwise product', category: 'engnotation', level: 3,
    meaning: 'Multiply matching entries and nothing else. A circled dot, common in signal and array code.',
    say: 'elementwise times',
    example: '(A \\odot B)_{ij} = A_{ij} B_{ij}',
    exampleSay: 'entry i j of A elementwise times B equals entry i j of A times entry i j of B',
    confusableWith: ['tensor-product', 'cdot', 'times'],
  },
  {
    id: 'decibel', glyph: '\\mathrm{dB}', name: 'Decibel', category: 'engnotation', level: 3,
    meaning: 'A logarithmic ratio, so gains add instead of multiplying. Twenty log for amplitude, ten for power.',
    say: 'decibels',
    example: 'G_{\\mathrm{dB}} = 20 \\log_{10} \\frac{V_{out}}{V_{in}}',
    exampleSay: 'gain in decibels equals twenty log base ten of V out over V in',
    confusableWith: ['proportional', 'asymptotic'],
  },

  // ---- Level 3 additions to the existing categories --------------------------------------
  // These belong on the shelf a student already knows to look at, so they stay in
  // their parent category rather than moving to the two new ones.
  {
    id: 'eigenvalue', glyph: '\\lambda', name: 'Eigenvalue', category: 'linalg', level: 3,
    meaning: 'The factor a matrix stretches one special direction by, without turning it at all.',
    say: 'lambda',
    example: 'A\\vec{v} = \\lambda \\vec{v}',
    exampleSay: 'A times v equals lambda times v',
    confusableWith: ['lambda', 'eigenvector', 'determinant'],
  },
  {
    id: 'eigenvector', glyph: '\\vec{v}', name: 'Eigenvector', category: 'linalg', level: 3,
    meaning: 'A direction the matrix leaves pointing the same way, only longer or shorter.',
    say: 'the eigenvector v',
    example: '(A - \\lambda I)\\vec{v} = \\vec{0}',
    exampleSay: 'A minus lambda I, times v, equals the zero vector',
    viz: { type: 'vectors', a: [3, 1], b: [1.5, 0.5] },
    confusableWith: ['eigenvalue', 'vector'],
  },
  {
    id: 'identity-matrix', glyph: 'I', name: 'Identity matrix', category: 'linalg', level: 3,
    meaning: 'Ones down the leading diagonal, zeros everywhere else. Multiplying by it changes nothing.',
    say: 'the identity matrix',
    example: 'AI = IA = A',
    exampleSay: 'A times I equals I times A equals A',
    confusableWith: ['inverse-matrix', 'determinant'],
  },
  {
    id: 'trace', glyph: '\\mathrm{tr}(A)', name: 'Trace', category: 'linalg', level: 3,
    meaning: 'Add up the leading diagonal. It equals the sum of the eigenvalues, which is why it turns up.',
    say: 'the trace of A',
    example: '\\mathrm{tr}(A) = a_{11} + a_{22}',
    exampleSay: 'the trace of A equals a one one plus a two two',
    confusableWith: ['determinant', 'eigenvalue', 'transpose'],
  },
  {
    id: 'rank', glyph: '\\mathrm{rank}(A)', name: 'Rank', category: 'linalg', level: 3,
    meaning: 'How many genuinely independent rows a matrix has. It tells you whether a system can be solved.',
    say: 'the rank of A',
    example: '\\mathrm{rank}(A) = 2',
    exampleSay: 'the rank of A equals two',
    confusableWith: ['determinant', 'identity-matrix'],
  },
  {
    id: 'orthogonal', glyph: '\\perp', name: 'Perpendicular to', category: 'linalg', level: 3,
    meaning: 'At right angles. For vectors it is the same statement as their dot product being zero.',
    say: 'is perpendicular to',
    example: '\\vec{u} \\perp \\vec{v} \\iff \\vec{u} \\cdot \\vec{v} = 0',
    exampleSay: 'u is perpendicular to v exactly when u dot v equals zero',
    viz: { type: 'vectors', a: [3, 1], b: [-1, 3] },
    confusableWith: ['dot-product', 'inner-product'],
  },
  {
    id: 'span', glyph: '\\mathrm{span}\\{u, v\\}', name: 'Span', category: 'linalg', level: 3,
    meaning: 'Everywhere you can reach by scaling and adding the given vectors. A line, a plane, or more.',
    say: 'the span of u and v',
    example: '\\mathrm{span}\\{\\hat{i}, \\hat{j}\\} = \\mathbb{R}^2',
    exampleSay: 'the span of i hat and j hat is all of R two',
    confusableWith: ['vector', 'reals', 'rank'],
  },
  {
    id: 'projection', glyph: '\\mathrm{proj}_{\\vec{b}}\\,\\vec{a}', name: 'Projection',
    category: 'linalg', level: 3,
    meaning: 'The shadow one vector casts along another. It is the part of a that points the way b does.',
    say: 'the projection of a onto b',
    example: '\\mathrm{proj}_{\\vec{b}}\\,\\vec{a} = \\frac{\\vec{a} \\cdot \\vec{b}}{\\|\\vec{b}\\|^2}\\,\\vec{b}',
    exampleSay: 'the projection of a onto b equals a dot b over the norm of b squared, times b',
    viz: { type: 'vectors', a: [2, 3], b: [4, 0] },
    confusableWith: ['dot-product', 'norm', 'orthogonal'],
  },
  {
    id: 'expectation-e', glyph: 'E[X]', name: 'Expected value', category: 'stats', level: 3,
    meaning: 'The long-run average of a random variable, weighted by how likely each outcome is.',
    say: 'the expected value of X',
    example: 'E[X] = \\sum x_i p_i',
    exampleSay: 'the expected value of X equals the sum of x i times p i',
    viz: { type: 'dots', values: [1, 2, 2, 3, 3, 3, 4], mean: 2.6 },
    confusableWith: ['mu', 'xbar', 'expectation'],
  },
  {
    id: 'covariance', glyph: '\\mathrm{Cov}(X, Y)', name: 'Covariance', category: 'stats', level: 3,
    meaning: 'Whether two quantities move together or in opposite directions. Zero means no linear link.',
    say: 'the covariance of X and Y',
    example: '\\mathrm{Cov}(X, Y) = E[XY] - E[X]E[Y]',
    exampleSay: 'the covariance of X and Y equals the expected value of X Y, minus the expected value of X times the expected value of Y',
    confusableWith: ['variance', 'expectation-e'],
  },
  {
    id: 'iid', glyph: '\\text{i.i.d.}', name: 'Independent and identically distributed',
    category: 'stats', level: 3,
    meaning: 'Every sample comes from the same distribution and none of them affect each other.',
    say: 'independent and identically distributed',
    example: 'X_1, \\ldots, X_n \\overset{iid}{\\sim} N(\\mu, \\sigma^2)',
    exampleSay: 'X one through X n are independent and identically distributed as normal mu sigma squared',
    confusableWith: ['distributed-as', 'probability'],
  },
  {
    id: 'sample-space', glyph: 'S', name: 'Sample space', category: 'stats', level: 3,
    meaning: 'Every outcome that could possibly happen. Probabilities across the whole of it add to one.',
    say: 'the sample space S',
    example: 'P(S) = 1',
    exampleSay: 'the probability of the sample space equals one',
    viz: { type: 'setdiagram', labels: ['A', 'S'], layout: 'subset', shade: 'subset', caption: 'A inside everything that could happen' },
    confusableWith: ['probability', 'complement-event', 'union'],
  },
  {
    id: 'complement-event', glyph: "A'", name: 'Complement', category: 'stats', level: 3,
    meaning: 'Everything in the sample space that is not A. Its probability is one minus the probability of A.',
    say: 'A complement',
    example: "P(A') = 1 - P(A)",
    exampleSay: 'the probability of A complement equals one minus the probability of A',
    viz: { type: 'setdiagram', labels: ['A', 'S'], layout: 'subset', shade: 'left', caption: 'everything outside A' },
    confusableWith: ['probability', 'sample-space', 'prime'],
  },
  {
    id: 'total-derivative', glyph: '\\frac{Df}{Dt}', name: 'Total derivative',
    category: 'calculus', level: 3,
    meaning: 'The rate of change following the motion, counting every variable that is itself changing.',
    say: 'capital D f by capital D t',
    example: '\\frac{Df}{Dt} = \\frac{\\partial f}{\\partial t} + \\vec{v} \\cdot \\nabla f',
    exampleSay: 'capital D f by capital D t equals the partial of f by t, plus v dot grad f',
    confusableWith: ['derivative', 'partial', 'nabla'],
  },
  {
    id: 'taylor-series', glyph: '\\sum \\frac{f^{(n)}(a)}{n!}(x-a)^n', name: 'Taylor series',
    category: 'series', level: 3,
    meaning: 'Rebuild a function near one point out of its derivatives there. Cut it short for an approximation.',
    say: 'the Taylor series of f about a',
    example: 'e^x \\approx 1 + x + \\frac{x^2}{2}',
    exampleSay: 'e to the x is about one plus x plus x squared over two',
    viz: { type: 'poly', coeffs: [1, 1, 0.5], extra: [{ coeffs: [1, 1] }], mark: [0, 1] },
    confusableWith: ['sigma-sum', 'factorial', 'approx'],
  },
  {
    id: 'not', glyph: '\\neg', name: 'Not', category: 'logic', level: 3,
    meaning: 'Flips a statement from true to false. Sometimes written as a tilde or an overbar instead.',
    say: 'not',
    example: '\\neg(p \\land q) \\equiv \\neg p \\lor \\neg q',
    exampleSay: 'not, p and q, is the same as not p, or not q',
    confusableWith: ['and', 'or', 'complement-event'],
  },
  {
    id: 'and', glyph: '\\land', name: 'Logical and', category: 'logic', level: 3,
    meaning: 'True only when both sides are true. It points up, and it matches intersection in set language.',
    say: 'and',
    example: 'p \\land q',
    exampleSay: 'p and q',
    viz: { type: 'setdiagram', labels: ['p', 'q'], shade: 'intersection', caption: 'true in both' },
    confusableWith: ['or', 'intersection', 'not'],
  },
  {
    id: 'or', glyph: '\\lor', name: 'Logical or', category: 'logic', level: 3,
    meaning: 'True when either side is true, or both. It points down, and it matches union in set language.',
    say: 'or',
    example: 'p \\lor q',
    exampleSay: 'p or q',
    viz: { type: 'setdiagram', labels: ['p', 'q'], shade: 'union', caption: 'true in either, or both' },
    confusableWith: ['and', 'union', 'not'],
  },
  {
    id: 'qed', glyph: '\\blacksquare', name: 'End of proof', category: 'logic', level: 3,
    meaning: 'The proof finishes here. Older books write QED, and some use an open square instead.',
    say: 'which was to be shown',
    example: '\\therefore n \\text{ is even} \\quad \\blacksquare',
    exampleSay: 'therefore n is even, which was to be shown',
    confusableWith: ['therefore', 'implies'],
  },
  {
    id: 'cartesian-product', glyph: 'A \\times B', name: 'Cartesian product', category: 'sets', level: 3,
    meaning: 'Every ordered pair you can make, one part from each set. It is where coordinates come from.',
    say: 'A cross B',
    example: '\\mathbb{R} \\times \\mathbb{R} = \\mathbb{R}^2',
    exampleSay: 'R cross R is R two, the plane',
    confusableWith: ['times', 'cross-product', 'coordinate'],
  },
  {
    id: 'set-complement', glyph: 'A^c', name: 'Set complement', category: 'sets', level: 3,
    meaning: 'Everything in the universal set that is not in A. Written with a c, a dash, or an overbar.',
    say: 'A complement',
    example: 'A \\cup A^c = U',
    exampleSay: 'A union A complement is the universal set',
    viz: { type: 'setdiagram', labels: ['A', 'U'], layout: 'subset', shade: 'left', caption: 'everything but A' },
    confusableWith: ['complement-event', 'empty-set', 'union'],
  },
  {
    id: 'congruent-mod', glyph: '\\equiv \\pmod{n}', name: 'Congruent modulo n',
    category: 'relations', level: 3,
    meaning: 'The two numbers leave the same remainder when divided by n. Central to cryptography and checksums.',
    say: 'is congruent to, modulo n',
    example: '17 \\equiv 2 \\pmod{5}',
    exampleSay: 'seventeen is congruent to two, modulo five',
    confusableWith: ['identical', 'equals', 'approx'],
  },
  {
    id: 'piecewise', glyph: '\\begin{cases} \\ \\end{cases}', name: 'Piecewise definition',
    category: 'functions', level: 3,
    meaning: 'One function with different rules on different parts of its domain, gathered under a brace.',
    say: 'defined piecewise',
    example: '|x| = \\begin{cases} x & x \\ge 0 \\\\ -x & x < 0 \\end{cases}',
    exampleSay: 'the absolute value of x is x when x is at least zero, and minus x otherwise',
    viz: { type: 'numberline', lo: -5, hi: 5, from: 0, to: 5, label: 'a different rule each side of 0' },
    confusableWith: ['function', 'abs', 'unit-step'],
  },
  {
    id: 'floor', glyph: '\\lfloor x \\rfloor', name: 'Floor', category: 'functions', level: 3,
    meaning: 'Round down to the whole number below. The corners point down, which is the way to remember it.',
    say: 'the floor of x',
    example: '\\lfloor 3.7 \\rfloor = 3',
    exampleSay: 'the floor of three point seven equals three',
    confusableWith: ['ceiling', 'abs', 'norm'],
  },
  {
    id: 'ceiling', glyph: '\\lceil x \\rceil', name: 'Ceiling', category: 'functions', level: 3,
    meaning: 'Round up to the whole number above. The corners point up, matching the direction you move.',
    say: 'the ceiling of x',
    example: '\\lceil 3.2 \\rceil = 4',
    exampleSay: 'the ceiling of three point two equals four',
    confusableWith: ['floor', 'abs'],
  },
  {
    id: 'summation-limits', glyph: '\\sum_{n=1}^{N}', name: 'Sum with limits',
    category: 'series', level: 3,
    meaning: 'The counter starts at the bottom number and finishes at the top one, inclusive at both ends.',
    say: 'the sum from n equals one to capital N of',
    example: '\\sum_{n=1}^{4} n^2 = 30',
    exampleSay: 'the sum from n equals one to four of n squared equals thirty',
    viz: { type: 'stack', values: [1, 4, 9, 16], mode: 'sum' },
    confusableWith: ['sigma-sum', 'subscript', 'pi-product'],
  },
];

// ---- Reading whole expressions ---------------------------------------------------------
//
// Knowing every symbol separately still leaves you stuck on a line of a
// textbook, because reading maths is about chunking: which bits group together,
// what order you say them in, and where you pause. These break real expressions
// into the fragments a person actually says, in the order they say them.
//
// `tokens` are in READING order, which is not always left-to-right — you say
// "the integral from nought to three" before you say what is being integrated.
// `note` explains a grouping decision where it isn't obvious.

const READINGS = [
  {
    id: 'quadratic-formula', level: 1, symbols: ['plus-minus', 'sqrt', 'frac'],
    latex: 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}',
    tokens: [
      { tex: 'x =', say: 'x equals' },
      { tex: '-b', say: 'minus b' },
      { tex: '\\pm', say: 'plus or minus' },
      { tex: '\\sqrt{b^2 - 4ac}', say: 'the square root of b squared minus four a c',
        note: 'Everything under the bar goes inside the root — say it as one chunk.' },
      { tex: '\\frac{\\cdots}{2a}', say: 'all over two a',
        note: 'The fraction bar is said LAST, and "all over" signals that the whole top was one piece.' },
    ],
    full: 'x equals minus b, plus or minus the square root of b squared minus four a c, all over two a',
  },
  {
    id: 'derivative-limit', level: 2, symbols: ['limit', 'frac', 'function'],
    latex: "f'(x) = \\lim_{h \\to 0}\\frac{f(x+h) - f(x)}{h}",
    tokens: [
      { tex: "f'(x) =", say: 'f dashed of x equals' },
      { tex: '\\lim_{h \\to 0}', say: 'the limit as h tends to zero of' },
      { tex: 'f(x+h) - f(x)', say: 'f of x plus h, minus f of x',
        note: 'Pause after the first bracket closes or it sounds like f of (x + h − f(x)).' },
      { tex: '\\frac{\\cdots}{h}', say: 'all over h' },
    ],
    full: 'f dashed of x equals the limit as h tends to zero of, f of x plus h minus f of x, all over h',
  },
  {
    id: 'definite-integral-read', level: 1, symbols: ['definite-integral', 'dx'],
    latex: '\\int_{0}^{3} 2x\\,dx = 9',
    tokens: [
      { tex: '\\int_{0}^{3}', say: 'the integral from nought to three',
        note: 'Bottom limit first, then the top — even though the top is written higher.' },
      { tex: '2x', say: 'of two x' },
      { tex: 'dx', say: 'd x',
        note: 'The d x closes the integral, like a closing bracket.' },
      { tex: '= 9', say: 'equals nine' },
    ],
    full: 'the integral from nought to three of two x, d x, equals nine',
  },
  {
    id: 'sigma-read', level: 1, symbols: ['sigma-sum', 'subscript'],
    latex: '\\sum_{n=1}^{5} (2n - 1) = 25',
    tokens: [
      { tex: '\\sum_{n=1}^{5}', say: 'the sum from n equals one to five' },
      { tex: '(2n - 1)', say: 'of two n minus one' },
      { tex: '= 25', say: 'equals twenty five' },
    ],
    full: 'the sum from n equals one to five of two n minus one, equals twenty five',
  },
  {
    id: 'conditional-read', level: 2, symbols: ['conditional', 'intersection', 'given-that'],
    latex: 'P(A \\mid B) = \\frac{P(A \\cap B)}{P(B)}',
    tokens: [
      { tex: 'P(A \\mid B)', say: 'the probability of A given B',
        note: 'The bar is "given", not "divided by".' },
      { tex: '=', say: 'equals' },
      { tex: 'P(A \\cap B)', say: 'the probability of A and B' },
      { tex: '\\frac{\\cdots}{P(B)}', say: 'over the probability of B' },
    ],
    full: 'the probability of A given B equals the probability of A and B, over the probability of B',
  },
  {
    id: 'normal-dist', level: 2, symbols: ['distributed-as', 'mu', 'variance'],
    latex: 'X \\sim N(\\mu, \\sigma^2)',
    tokens: [
      { tex: 'X', say: 'X' },
      { tex: '\\sim', say: 'is distributed as' },
      { tex: 'N', say: 'a normal distribution' },
      { tex: '(\\mu, \\sigma^2)', say: 'with mean mu and variance sigma squared',
        note: 'The second slot is the VARIANCE, not the standard deviation — a very common slip.' },
    ],
    full: 'X is normally distributed with mean mu and variance sigma squared',
  },
  {
    id: 'set-builder', level: 2, symbols: ['element-of', 'reals', 'given-that'],
    latex: '\\{x \\in \\mathbb{R} \\mid x > 0\\}',
    tokens: [
      { tex: '\\{', say: 'the set of' },
      { tex: 'x \\in \\mathbb{R}', say: 'real numbers x' },
      { tex: '\\mid', say: 'such that',
        note: 'Inside set brackets the bar reads "such that", a third job for the same symbol.' },
      { tex: 'x > 0', say: 'x is greater than zero' },
      { tex: '\\}', say: '' },
    ],
    full: 'the set of real numbers x such that x is greater than zero',
  },
  {
    id: 'chain-rule-read', level: 2, symbols: ['derivative', 'composite'],
    latex: '\\frac{dy}{dx} = \\frac{dy}{du} \\cdot \\frac{du}{dx}',
    tokens: [
      { tex: '\\frac{dy}{dx}', say: 'd y by d x' },
      { tex: '=', say: 'equals' },
      { tex: '\\frac{dy}{du}', say: 'd y by d u' },
      { tex: '\\cdot', say: 'times' },
      { tex: '\\frac{du}{dx}', say: 'd u by d x',
        note: 'It LOOKS like the d u cancels. It is not a fraction — that it works is a theorem, not arithmetic.' },
    ],
    full: 'd y by d x equals d y by d u, times d u by d x',
  },
  {
    id: 'partial-read', level: 2, symbols: ['partial'],
    latex: '\\frac{\\partial f}{\\partial x} = 2xy',
    tokens: [
      { tex: '\\frac{\\partial f}{\\partial x}', say: 'partial f by partial x',
        note: 'Curly d, said "partial" — it means every other variable is held still.' },
      { tex: '= 2xy', say: 'equals two x y' },
    ],
    full: 'partial f by partial x equals two x y',
  },
  {
    id: 'inverse-read', level: 2, symbols: ['inverse-fn', 'negative-power'],
    latex: 'f^{-1}(x) \\neq \\frac{1}{f(x)}',
    tokens: [
      { tex: 'f^{-1}(x)', say: 'f inverse of x',
        note: 'Said "inverse", never "to the minus one" — the notation is borrowed, the meaning is not.' },
      { tex: '\\neq', say: 'is not equal to' },
      { tex: '\\frac{1}{f(x)}', say: 'one over f of x' },
    ],
    full: 'f inverse of x is not equal to one over f of x',
  },
  {
    id: 'vector-dot-read', level: 2, symbols: ['dot-product', 'magnitude', 'theta'],
    latex: '\\vec{a} \\cdot \\vec{b} = |\\vec{a}||\\vec{b}|\\cos\\theta',
    tokens: [
      { tex: '\\vec{a} \\cdot \\vec{b}', say: 'a dot b' },
      { tex: '=', say: 'equals' },
      { tex: '|\\vec{a}||\\vec{b}|', say: 'the magnitude of a, times the magnitude of b' },
      { tex: '\\cos\\theta', say: 'cosine theta' },
    ],
    full: 'a dot b equals the magnitude of a times the magnitude of b, cosine theta',
  },
  {
    id: 'binomial-read', level: 2, symbols: ['ncr', 'power'],
    latex: 'P(X = k) = \\binom{n}{k}p^k(1-p)^{n-k}',
    tokens: [
      { tex: 'P(X = k)', say: 'the probability that X equals k' },
      { tex: '\\binom{n}{k}', say: 'n choose k',
        note: 'Not a fraction — there is no bar between them.' },
      { tex: 'p^k', say: 'p to the k' },
      { tex: '(1-p)^{n-k}', say: 'one minus p, to the n minus k' },
    ],
    full: 'the probability that X equals k, equals n choose k, p to the k, one minus p to the n minus k',
  },
  {
    id: 'compound-inequality', level: 1, symbols: ['leq', 'degrees'],
    latex: '0^\\circ \\le x \\le 360^\\circ',
    tokens: [
      { tex: '0^\\circ \\le x', say: 'x is at least nought degrees' },
      { tex: 'x \\le 360^\\circ', say: 'and at most three hundred and sixty degrees',
        note: 'Read as one range, not as two separate statements.' },
    ],
    full: 'x is between nought and three hundred and sixty degrees, inclusive',
  },
  {
    id: 'limit-infinity', level: 2, symbols: ['limit', 'infinity', 'frac'],
    latex: '\\lim_{x \\to \\infty} \\frac{2x + 1}{x - 3} = 2',
    tokens: [
      { tex: '\\lim_{x \\to \\infty}', say: 'the limit as x tends to infinity' },
      { tex: '\\frac{2x + 1}{x - 3}', say: 'of two x plus one, over x minus three' },
      { tex: '= 2', say: 'equals two' },
    ],
    full: 'the limit as x tends to infinity of two x plus one over x minus three, equals two',
  },
  {
    id: 'second-deriv-read', level: 2, symbols: ['second-derivative'],
    latex: '\\frac{d^2y}{dx^2} < 0',
    tokens: [
      { tex: '\\frac{d^2y}{dx^2}', say: 'd two y by d x squared',
        note: 'The 2 sits on the d up top and on the x underneath. It is a label, not a power.' },
      { tex: '< 0', say: 'is less than zero' },
    ],
    full: 'd two y by d x squared is less than zero, so the curve is concave down',
  },
  {
    id: 'implicit-read', level: 2, symbols: ['derivative', 'implies'],
    latex: 'x^2 + y^2 = 25 \\Rightarrow 2x + 2y\\frac{dy}{dx} = 0',
    tokens: [
      { tex: 'x^2 + y^2 = 25', say: 'x squared plus y squared equals twenty five' },
      { tex: '\\Rightarrow', say: 'implies' },
      { tex: '2x + 2y\\frac{dy}{dx} = 0', say: 'two x plus two y d y by d x equals zero',
        note: 'The d y by d x appears because y is a function of x — that is the chain rule doing its job.' },
    ],
    full: 'x squared plus y squared equals twenty five implies two x plus two y d y by d x equals zero',
  },
  {
    id: 'exponential-model', level: 1, symbols: ['subscript', 'power'],
    latex: 'N = N_0e^{kt}',
    tokens: [
      { tex: 'N', say: 'N' },
      { tex: '= N_0', say: 'equals N nought',
        note: 'The subscript zero means "at time zero" — the starting amount.' },
      { tex: 'e^{kt}', say: 'e to the k t' },
    ],
    full: 'N equals N nought, e to the k t',
  },
  {
    id: 'aux-equation-read', level: 2, symbols: ['prime'],
    latex: "y'' + 5y' + 6y = 0",
    tokens: [
      { tex: "y''", say: 'y double dashed' },
      { tex: "+ 5y'", say: 'plus five y dashed' },
      { tex: '+ 6y', say: 'plus six y' },
      { tex: '= 0', say: 'equals zero' },
    ],
    full: 'y double dashed plus five y dashed plus six y equals zero',
  },
  {
    id: 'abs-inequality', level: 2, symbols: ['abs', 'less-than'],
    latex: '|x - 3| < 2',
    tokens: [
      { tex: '|x - 3|', say: 'the distance from x to three',
        note: 'Reading it as a distance rather than "absolute value of x minus three" makes the answer obvious.' },
      { tex: '< 2', say: 'is less than two' },
    ],
    full: 'the distance from x to three is less than two, so x is between one and five',
  },
  {
    id: 'unit-vector-read', level: 2, symbols: ['xhat', 'vector', 'magnitude'],
    latex: '\\hat{a} = \\frac{\\vec{a}}{|\\vec{a}|}',
    tokens: [
      { tex: '\\hat{a}', say: 'a hat' },
      { tex: '=', say: 'equals' },
      { tex: '\\vec{a}', say: 'vector a' },
      { tex: '\\frac{\\cdots}{|\\vec{a}|}', say: 'over the magnitude of a',
        note: 'Dividing a vector by its own length leaves the direction and sets the length to one.' },
    ],
    full: 'a hat equals vector a, over the magnitude of a',
  },
];

const READING_BY_ID = Object.fromEntries(READINGS.map((r) => [r.id, r]));

/** Readings that use a given symbol — shown on that symbol's card. */
function readingsUsing(symbolId) {
  return READINGS.filter((r) => (r.symbols || []).includes(symbolId));
}

// ---- Lookups -------------------------------------------------------------------------

const SYMBOL_BY_ID = Object.fromEntries(SYMBOLS.map((s) => [s.id, s]));
const SYMBOL_CATEGORY_BY_ID = Object.fromEntries(SYMBOL_CATEGORIES.map((c) => [c.id, c]));

/** Symbols in a category, in declaration order. */
function symbolsInCategory(categoryId) {
  return SYMBOLS.filter((s) => s.category === categoryId);
}

/**
 * Free-text search across name, meaning, how it is said, and the glyph's LaTeX.
 * Searching the LaTeX matters: a student who can only describe a symbol as
 * "that curly d" will not find it, but one who copied \partial out of a PDF will.
 */
function searchSymbols(query) {
  const q = String(query || '').toLowerCase().trim();
  if (!q) return SYMBOLS;
  return SYMBOLS.filter((s) => (
    s.name.toLowerCase().includes(q) ||
    s.meaning.toLowerCase().includes(q) ||
    s.say.toLowerCase().includes(q) ||
    s.glyph.toLowerCase().includes(q) ||
    s.exampleSay.toLowerCase().includes(q)
  ));
}

/**
 * The entries this one is easily mixed up with.
 *
 * Confusion runs both ways — if you can mistake ∈ for ε then you can mistake ε
 * for ∈ — so this unions the symbol's own list with everyone who names it. That
 * means each pair only has to be declared once, on whichever card it occurred
 * to write it, and neither card ends up missing the warning.
 */
const CONFUSABLE_BACKLINKS = (() => {
  const back = {};
  for (const s of SYMBOLS) {
    for (const other of s.confusableWith || []) {
      (back[other] || (back[other] = [])).push(s.id);
    }
  }
  return back;
})();

function confusablesOf(symbolId) {
  const s = SYMBOL_BY_ID[symbolId];
  if (!s) return [];
  const ids = new Set([...(s.confusableWith || []), ...(CONFUSABLE_BACKLINKS[symbolId] || [])]);
  ids.delete(symbolId);
  return [...ids].map((id) => SYMBOL_BY_ID[id]).filter(Boolean);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SYMBOL_CATEGORIES, SYMBOLS, SYMBOL_BY_ID, SYMBOL_CATEGORY_BY_ID,
    READINGS, READING_BY_ID, readingsUsing,
    symbolsInCategory, searchSymbols, confusablesOf,
  };
}
