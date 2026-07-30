// Course formula database — pre-calc engineering maths.
// Entries with `vars` + `solve` are interactive: enter values, get results.
// Solvers are plain functions (no eval); angles in degrees where marked.

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;
const round = (x, dp = 6) => {
  if (!isFinite(x)) return x;
  const r = parseFloat(x.toPrecision(10));
  return Math.abs(r) < 1e-12 ? 0 : parseFloat(r.toFixed(dp));
};
const fact = (n) => {
  if (n < 0 || n % 1 !== 0 || n > 170) return NaN;
  let f = 1; for (let i = 2; i <= n; i++) f *= i; return f;
};
const nCrF = (n, r) => (r < 0 || r > n || n < 0) ? 0 : Math.round(fact(n) / (fact(r) * fact(n - r)));
const nPrF = (n, r) => (r < 0 || r > n || n < 0) ? 0 : Math.round(fact(n) / fact(n - r));
const seq = (v, keys) => keys.map((k) => v[k]).filter((x) => isFinite(x));

const FORMULAS = [
  // ---- Algebra & equations -------------------------------------------------------
  {
    id: 'quadratic-roots', group: 'Algebra', name: 'Quadratic formula',
    latex: 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}',
    vars: [{ key: 'a', label: 'a' }, { key: 'b', label: 'b' }, { key: 'c', label: 'c' }],
    solve: ({ a, b, c }) => {
      if (a === 0) return [{ label: 'Not quadratic (a = 0)', value: b !== 0 ? `x = ${round(-c / b)}` : 'no solution' }];
      const disc = b * b - 4 * a * c;
      if (disc >= 0) {
        const s = Math.sqrt(disc);
        return [
          { label: 'Discriminant', value: round(disc) },
          { label: 'x₁', value: round((-b + s) / (2 * a)) },
          { label: 'x₂', value: round((-b - s) / (2 * a)) },
        ];
      }
      const re = round(-b / (2 * a)); const im = round(Math.sqrt(-disc) / (2 * a));
      return [
        { label: 'Discriminant', value: `${round(disc)} (complex roots)` },
        { label: 'x', value: `${re} ± ${Math.abs(im)}i` },
      ];
    },
  },
  {
    id: 'discriminant', group: 'Algebra', name: 'Discriminant',
    latex: '\\Delta = b^2 - 4ac',
    vars: [{ key: 'a', label: 'a' }, { key: 'b', label: 'b' }, { key: 'c', label: 'c' }],
    solve: ({ a, b, c }) => {
      const d = b * b - 4 * a * c;
      const kind = d > 0 ? 'two real roots' : d === 0 ? 'one repeated real root' : 'two complex roots';
      return [{ label: 'Δ', value: round(d) }, { label: 'Nature', value: kind }];
    },
  },
  {
    id: 'vertex', group: 'Algebra', name: 'Vertex of a parabola',
    latex: 'x_v = \\frac{-b}{2a}, \\quad y_v = c - \\frac{b^2}{4a}',
    vars: [{ key: 'a', label: 'a' }, { key: 'b', label: 'b' }, { key: 'c', label: 'c' }],
    solve: ({ a, b, c }) => a === 0
      ? [{ label: 'Error', value: 'a must be non-zero' }]
      : [{ label: 'xᵥ', value: round(-b / (2 * a)) }, { label: 'yᵥ', value: round(c - b * b / (4 * a)) }],
  },
  { id: 'diff-squares', group: 'Algebra', name: 'Difference of squares', latex: 'a^2 - b^2 = (a-b)(a+b)' },
  { id: 'perfect-square', group: 'Algebra', name: 'Perfect square', latex: 'a^2 \\pm 2ab + b^2 = (a \\pm b)^2' },
  { id: 'cubes', group: 'Algebra', name: 'Sum / difference of cubes', latex: 'a^3 \\pm b^3 = (a \\pm b)(a^2 \\mp ab + b^2)' },
  { id: 'binomial-sq', group: 'Algebra', name: 'Binomial squared', latex: '(a+b)^2 = a^2 + 2ab + b^2' },
  { id: 'binomial-cu', group: 'Algebra', name: 'Binomial cubed', latex: '(a+b)^3 = a^3 + 3a^2b + 3ab^2 + b^3' },
  {
    id: 'binomial-thm', group: 'Algebra', name: 'Binomial theorem (term)',
    latex: '\\binom{n}{k} a^{\\,n-k} b^{\\,k}',
    vars: [{ key: 'n', label: 'n' }, { key: 'k', label: 'k' }],
    solve: ({ n, k }) => {
      if (k < 0 || n < 0 || k > n || n % 1 || k % 1) return [{ label: 'Error', value: 'need integers 0 ≤ k ≤ n' }];
      let c = 1;
      for (let i = 0; i < k; i++) c = (c * (n - i)) / (i + 1);
      return [{ label: 'C(n,k)', value: Math.round(c) }];
    },
  },
  { id: 'surd-rationalise', group: 'Algebra', name: 'Rationalising a denominator', latex: '\\frac{1}{\\sqrt{a}+b} = \\frac{\\sqrt{a}-b}{a-b^2}' },
  { id: 'frac-add', group: 'Algebra', name: 'Adding fractions', latex: '\\frac{a}{b} + \\frac{c}{d} = \\frac{ad + bc}{bd}' },
  { id: 'partial-fractions', group: 'Algebra', name: 'Partial fractions (distinct linear)', latex: '\\frac{px+q}{(x-a)(x-b)} = \\frac{A}{x-a} + \\frac{B}{x-b}' },
  { id: 'partial-fractions-rep', group: 'Algebra', name: 'Partial fractions (repeated root)', latex: '\\frac{px+q}{(x-a)^2} = \\frac{A}{x-a} + \\frac{B}{(x-a)^2}' },
  { id: 'partial-coverup', group: 'Algebra', name: 'Partial fractions (cover-up method)', latex: '\\text{For } \\frac{A}{x-a}: \\text{ cover } (x-a) \\text{ and substitute } x = a' },
  { id: 'rational-simplify-ref', group: 'Algebra', name: 'Simplifying rational expressions', latex: '\\frac{(x-p)(x-q)}{(x-p)(x-r)} = \\frac{x-q}{x-r}, \\quad x \\ne p,\\, r' },
  { id: 'complex-fraction', group: 'Algebra', name: 'Complex (compound) fraction', latex: '\\frac{\\;\\frac{a}{b} + \\frac{c}{d}\\;}{\\;\\frac{e}{f} - \\frac{g}{h}\\;} = \\text{multiply top and bottom by the overall LCD}' },

  // ---- Indices, exponentials & logs ---------------------------------------------
  { id: 'index-product', group: 'Logs & exponentials', name: 'Index laws', latex: 'x^a x^b = x^{a+b}, \\quad \\frac{x^a}{x^b} = x^{a-b}, \\quad (x^a)^b = x^{ab}' },
  { id: 'neg-frac-index', group: 'Logs & exponentials', name: 'Negative & fractional indices', latex: 'x^{-n} = \\frac{1}{x^n}, \\quad x^{1/n} = \\sqrt[n]{x}' },
  { id: 'log-laws', group: 'Logs & exponentials', name: 'Log laws', latex: '\\log(xy) = \\log x + \\log y, \\quad \\log\\tfrac{x}{y} = \\log x - \\log y, \\quad \\log x^n = n\\log x' },
  {
    id: 'change-base', group: 'Logs & exponentials', name: 'Change of base',
    latex: '\\log_b x = \\frac{\\ln x}{\\ln b}',
    vars: [{ key: 'b', label: 'base b' }, { key: 'x', label: 'x' }],
    solve: ({ b, x }) => (x <= 0 || b <= 0 || b === 1)
      ? [{ label: 'Error', value: 'need x > 0, b > 0, b ≠ 1' }]
      : [{ label: 'log_b(x)', value: round(Math.log(x) / Math.log(b)) }],
  },
  {
    id: 'exp-growth', group: 'Logs & exponentials', name: 'Exponential growth / decay',
    latex: 'A = A_0 e^{kt}',
    vars: [{ key: 'A0', label: 'A₀' }, { key: 'k', label: 'k (rate)' }, { key: 't', label: 't' }],
    solve: ({ A0, k, t }) => [{ label: 'A', value: round(A0 * Math.exp(k * t)) }],
  },
  {
    id: 'compound-interest', group: 'Logs & exponentials', name: 'Compound interest',
    latex: 'A = P\\left(1 + \\frac{r}{n}\\right)^{nt}',
    vars: [
      { key: 'P', label: 'P (principal)' }, { key: 'r', label: 'r (rate, e.g. 0.05)' },
      { key: 'n', label: 'n (per year)' }, { key: 't', label: 't (years)' },
    ],
    solve: ({ P, r, n, t }) => [{ label: 'A', value: round(P * Math.pow(1 + r / n, n * t), 2) }],
  },
  {
    id: 'solve-exp', group: 'Logs & exponentials', name: 'Solve aˣ = b',
    latex: 'x = \\frac{\\ln b}{\\ln a}',
    vars: [{ key: 'a', label: 'a' }, { key: 'b', label: 'b' }],
    solve: ({ a, b }) => (a <= 0 || a === 1 || b <= 0)
      ? [{ label: 'Error', value: 'need a > 0, a ≠ 1, b > 0' }]
      : [{ label: 'x', value: round(Math.log(b) / Math.log(a)) }],
  },

  // ---- Complex numbers -----------------------------------------------------------
  {
    id: 'complex-modarg', group: 'Complex numbers', name: 'Modulus & argument',
    latex: '|z| = \\sqrt{a^2+b^2}, \\quad \\arg z = \\arctan\\tfrac{b}{a}',
    vars: [{ key: 'a', label: 'a (real part)' }, { key: 'b', label: 'b (imag part)' }],
    solve: ({ a, b }) => [
      { label: '|z|', value: round(Math.hypot(a, b)) },
      { label: 'arg z (deg)', value: round(Math.atan2(b, a) * R2D, 3) },
      { label: 'arg z (rad)', value: round(Math.atan2(b, a)) },
    ],
  },
  { id: 'complex-polar', group: 'Complex numbers', name: 'Polar form', latex: 'z = r(\\cos\\theta + i\\sin\\theta) = re^{i\\theta}' },
  {
    id: 'demoivre', group: 'Complex numbers', name: "De Moivre's theorem",
    latex: 'z^n = r^n(\\cos n\\theta + i \\sin n\\theta)',
    vars: [{ key: 'r', label: 'r' }, { key: 'theta', label: 'θ (deg)' }, { key: 'n', label: 'n' }],
    solve: ({ r, theta, n }) => {
      const rn = Math.pow(r, n); const t = theta * n * D2R;
      return [
        { label: 'zⁿ (a + bi)', value: `${round(rn * Math.cos(t))} + ${round(rn * Math.sin(t))}i` },
        { label: '|zⁿ|', value: round(rn) }, { label: 'arg (deg)', value: round(((theta * n) % 360 + 540) % 360 - 180, 3) },
      ];
    },
  },
  { id: 'complex-conj', group: 'Complex numbers', name: 'Conjugate & division', latex: '\\frac{1}{a+bi} = \\frac{a-bi}{a^2+b^2}' },
  { id: 'i-powers', group: 'Complex numbers', name: 'Powers of i', latex: 'i^2 = -1, \\quad i^3 = -i, \\quad i^4 = 1' },

  // ---- Coordinate geometry & functions -------------------------------------------
  {
    id: 'distance', group: 'Geometry & functions', name: 'Distance between points',
    latex: 'd = \\sqrt{(x_2-x_1)^2 + (y_2-y_1)^2}',
    vars: [{ key: 'x1', label: 'x₁' }, { key: 'y1', label: 'y₁' }, { key: 'x2', label: 'x₂' }, { key: 'y2', label: 'y₂' }],
    solve: ({ x1, y1, x2, y2 }) => [{ label: 'd', value: round(Math.hypot(x2 - x1, y2 - y1)) }],
  },
  {
    id: 'midpoint', group: 'Geometry & functions', name: 'Midpoint',
    latex: 'M = \\left(\\frac{x_1+x_2}{2}, \\frac{y_1+y_2}{2}\\right)',
    vars: [{ key: 'x1', label: 'x₁' }, { key: 'y1', label: 'y₁' }, { key: 'x2', label: 'x₂' }, { key: 'y2', label: 'y₂' }],
    solve: ({ x1, y1, x2, y2 }) => [{ label: 'M', value: `(${round((x1 + x2) / 2)}, ${round((y1 + y2) / 2)})` }],
  },
  {
    id: 'gradient', group: 'Geometry & functions', name: 'Gradient of a line',
    latex: 'm = \\frac{y_2 - y_1}{x_2 - x_1}',
    vars: [{ key: 'x1', label: 'x₁' }, { key: 'y1', label: 'y₁' }, { key: 'x2', label: 'x₂' }, { key: 'y2', label: 'y₂' }],
    solve: ({ x1, y1, x2, y2 }) => x2 === x1
      ? [{ label: 'm', value: 'undefined (vertical line)' }]
      : [{ label: 'm', value: round((y2 - y1) / (x2 - x1)) }],
  },
  { id: 'line-point', group: 'Geometry & functions', name: 'Line through a point', latex: 'y - y_1 = m(x - x_1)' },
  { id: 'perp-gradient', group: 'Geometry & functions', name: 'Perpendicular gradients', latex: 'm_1 m_2 = -1' },
  { id: 'circle', group: 'Geometry & functions', name: 'Circle', latex: '(x-a)^2 + (y-b)^2 = r^2' },
  { id: 'function-composite', group: 'Geometry & functions', name: 'Composite function', latex: '(f \\circ g)(x) = f(g(x))' },
  { id: 'inverse-log', group: 'Geometry & functions', name: 'Inverse pairs', latex: 'y = e^x \\iff x = \\ln y, \\qquad y = a^x \\iff x = \\log_a y' },

  // ---- Trigonometry --------------------------------------------------------------
  { id: 'pythag-identity', group: 'Trigonometry', name: 'Pythagorean identities', latex: '\\sin^2\\theta + \\cos^2\\theta = 1, \\quad 1 + \\tan^2\\theta = \\sec^2\\theta' },
  { id: 'tan-def', group: 'Trigonometry', name: 'Tangent definition', latex: '\\tan\\theta = \\frac{\\sin\\theta}{\\cos\\theta}' },
  { id: 'exact-values', group: 'Trigonometry', name: 'Exact values', latex: '\\sin 30^\\circ = \\tfrac{1}{2},\\ \\sin 45^\\circ = \\tfrac{\\sqrt2}{2},\\ \\sin 60^\\circ = \\tfrac{\\sqrt3}{2}' },
  {
    id: 'sine-rule-side', group: 'Trigonometry', name: 'Sine rule (find a side)',
    latex: '\\frac{a}{\\sin A} = \\frac{b}{\\sin B}',
    vars: [{ key: 'b', label: 'b (known side)' }, { key: 'A', label: 'A° (angle opposite a)' }, { key: 'B', label: 'B° (angle opposite b)' }],
    solve: ({ b, A, B }) => Math.sin(B * D2R) === 0
      ? [{ label: 'Error', value: 'sin B = 0' }]
      : [{ label: 'a', value: round(b * Math.sin(A * D2R) / Math.sin(B * D2R)) }],
  },
  {
    id: 'cosine-rule-side', group: 'Trigonometry', name: 'Cosine rule (find a side)',
    latex: 'c^2 = a^2 + b^2 - 2ab\\cos C',
    vars: [{ key: 'a', label: 'a' }, { key: 'b', label: 'b' }, { key: 'C', label: 'C° (included angle)' }],
    solve: ({ a, b, C }) => [{ label: 'c', value: round(Math.sqrt(a * a + b * b - 2 * a * b * Math.cos(C * D2R))) }],
  },
  {
    id: 'cosine-rule-angle', group: 'Trigonometry', name: 'Cosine rule (find an angle)',
    latex: '\\cos C = \\frac{a^2 + b^2 - c^2}{2ab}',
    vars: [{ key: 'a', label: 'a' }, { key: 'b', label: 'b' }, { key: 'c', label: 'c' }],
    solve: ({ a, b, c }) => {
      const cos = (a * a + b * b - c * c) / (2 * a * b);
      return Math.abs(cos) > 1
        ? [{ label: 'Error', value: 'no such triangle (|cos C| > 1)' }]
        : [{ label: 'C', value: `${round(Math.acos(cos) * R2D, 3)}°` }];
    },
  },
  {
    id: 'triangle-area', group: 'Trigonometry', name: 'Area of a triangle',
    latex: '\\text{Area} = \\tfrac{1}{2}ab\\sin C',
    vars: [{ key: 'a', label: 'a' }, { key: 'b', label: 'b' }, { key: 'C', label: 'C°' }],
    solve: ({ a, b, C }) => [{ label: 'Area', value: round(0.5 * a * b * Math.sin(C * D2R)) }],
  },
  { id: 'double-angle', group: 'Trigonometry', name: 'Double angle', latex: '\\sin 2\\theta = 2\\sin\\theta\\cos\\theta, \\quad \\cos 2\\theta = 2\\cos^2\\theta - 1' },
  { id: 'compound-angle', group: 'Trigonometry', name: 'Compound angle', latex: '\\sin(A \\pm B) = \\sin A \\cos B \\pm \\cos A \\sin B' },
  { id: 'compound-angle-cos', group: 'Trigonometry', name: 'Compound angle (cos)', latex: '\\cos(A \\pm B) = \\cos A \\cos B \\mp \\sin A \\sin B' },
  {
    id: 'deg-rad', group: 'Trigonometry', name: 'Degrees ↔ radians',
    latex: '\\text{rad} = \\text{deg} \\times \\frac{\\pi}{180}',
    vars: [{ key: 'deg', label: 'degrees' }],
    solve: ({ deg }) => [{ label: 'radians', value: round(deg * D2R) }, { label: 'as multiple of π', value: round(deg / 180, 4) + 'π' }],
  },
  {
    id: 'arc-sector', group: 'Trigonometry', name: 'Arc length & sector area',
    latex: 's = r\\theta, \\quad A = \\tfrac{1}{2}r^2\\theta \\quad (\\theta \\text{ in rad})',
    vars: [{ key: 'r', label: 'r' }, { key: 'theta', label: 'θ (rad)' }],
    solve: ({ r, theta }) => [
      { label: 's (arc)', value: round(r * theta) },
      { label: 'A (sector)', value: round(0.5 * r * r * theta) },
    ],
  },

  // ---- Differentiation -----------------------------------------------------------
  {
    id: 'power-rule', group: 'Differentiation', name: 'Power rule (evaluate)',
    latex: '\\frac{d}{dx} x^n = n x^{n-1}',
    vars: [{ key: 'n', label: 'n' }, { key: 'x', label: 'x (evaluate at)' }],
    solve: ({ n, x }) => [{ label: "f'(x) = n·xⁿ⁻¹", value: round(n * Math.pow(x, n - 1)) }],
  },
  { id: 'product-rule', group: 'Differentiation', name: 'Product rule', latex: "(uv)' = u'v + uv'" },
  { id: 'quotient-rule', group: 'Differentiation', name: 'Quotient rule', latex: "\\left(\\frac{u}{v}\\right)' = \\frac{u'v - uv'}{v^2}" },
  { id: 'chain-rule', group: 'Differentiation', name: 'Chain rule', latex: '\\frac{dy}{dx} = \\frac{dy}{du}\\cdot\\frac{du}{dx}' },
  { id: 'std-derivs', group: 'Differentiation', name: 'Standard derivatives', latex: '\\frac{d}{dx}\\sin x = \\cos x, \\ \\frac{d}{dx}\\cos x = -\\sin x, \\ \\frac{d}{dx}\\tan x = \\sec^2 x' },
  { id: 'exp-log-derivs', group: 'Differentiation', name: 'Exponential & log derivatives', latex: '\\frac{d}{dx}e^{kx} = ke^{kx}, \\quad \\frac{d}{dx}\\ln x = \\frac{1}{x}' },
  {
    id: 'tangent-line', group: 'Differentiation', name: 'Tangent line at a point',
    latex: 'y = f(a) + f\'(a)(x - a)',
    vars: [{ key: 'fa', label: 'f(a)' }, { key: 'fpa', label: "f'(a)" }, { key: 'a', label: 'a' }],
    solve: ({ fa, fpa, a }) => [{ label: 'Tangent', value: `y = ${round(fpa)}x + ${round(fa - fpa * a)}` }],
  },
  { id: 'second-deriv', group: 'Differentiation', name: 'Concavity test', latex: "f''(x) > 0 \\Rightarrow \\text{concave up}, \\quad f''(x) < 0 \\Rightarrow \\text{concave down}" },
  { id: 'stationary', group: 'Differentiation', name: 'Stationary points', latex: "f'(x) = 0" },

  // ---- Integration ---------------------------------------------------------------
  {
    id: 'int-power', group: 'Integration', name: 'Power rule ∫xⁿ (definite)',
    latex: '\\int_a^b x^n\\,dx = \\left[\\frac{x^{n+1}}{n+1}\\right]_a^b',
    vars: [{ key: 'n', label: 'n (≠ −1)' }, { key: 'a', label: 'a (lower)' }, { key: 'b', label: 'b (upper)' }],
    solve: ({ n, a, b }) => n === -1
      ? [{ label: '∫', value: Math.sign(a) === Math.sign(b) && a !== 0 ? round(Math.log(Math.abs(b)) - Math.log(Math.abs(a))) : 'undefined across 0' }]
      : [{ label: '∫', value: round((Math.pow(b, n + 1) - Math.pow(a, n + 1)) / (n + 1)) }],
  },
  { id: 'std-integrals', group: 'Integration', name: 'Standard integrals', latex: '\\int \\sin x\\,dx = -\\cos x + C, \\ \\int \\cos x\\,dx = \\sin x + C, \\ \\int e^{kx}dx = \\tfrac{1}{k}e^{kx} + C' },
  { id: 'int-recip', group: 'Integration', name: 'Reciprocal integral', latex: '\\int \\frac{1}{x}\\,dx = \\ln|x| + C' },
  { id: 'int-linear', group: 'Integration', name: 'Linear substitution', latex: '\\int f(ax+b)\\,dx = \\tfrac{1}{a}F(ax+b) + C' },
  { id: 'int-by-parts', group: 'Integration', name: 'Integration by parts', latex: '\\int u\\,dv = uv - \\int v\\,du' },
  { id: 'ftc', group: 'Integration', name: 'Fundamental theorem', latex: '\\int_a^b f(x)\\,dx = F(b) - F(a)' },
  { id: 'area-between', group: 'Integration', name: 'Area between curves', latex: 'A = \\int_a^b \\left(f(x) - g(x)\\right)dx' },
  {
    id: 'trapezium', group: 'Integration', name: 'Trapezium rule (2 strips)',
    latex: '\\int_a^b f \\approx \\frac{h}{2}\\left[y_0 + 2y_1 + y_2\\right], \\quad h = \\tfrac{b-a}{2}',
    vars: [{ key: 'h', label: 'h (strip width)' }, { key: 'y0', label: 'y₀' }, { key: 'y1', label: 'y₁' }, { key: 'y2', label: 'y₂' }],
    solve: ({ h, y0, y1, y2 }) => [{ label: '≈ ∫', value: round((h / 2) * (y0 + 2 * y1 + y2)) }],
  },

  // ---- Engineering extras --------------------------------------------------------
  {
    id: 'pythagoras', group: 'Engineering extras', name: 'Pythagoras',
    latex: 'c = \\sqrt{a^2 + b^2}',
    vars: [{ key: 'a', label: 'a' }, { key: 'b', label: 'b' }],
    solve: ({ a, b }) => [{ label: 'c', value: round(Math.hypot(a, b)) }],
  },
  {
    id: 'percentage-error', group: 'Engineering extras', name: 'Percentage error',
    latex: '\\%\\,\\text{err} = \\left|\\frac{x_{meas} - x_{true}}{x_{true}}\\right| \\times 100',
    vars: [{ key: 'meas', label: 'measured' }, { key: 'truev', label: 'true value' }],
    solve: ({ meas, truev }) => truev === 0
      ? [{ label: 'Error', value: 'true value must be non-zero' }]
      : [{ label: '% error', value: round(Math.abs((meas - truev) / truev) * 100, 4) + '%' }],
  },
  {
    id: 'sig-scientific', group: 'Engineering extras', name: 'Scientific notation',
    latex: 'x = m \\times 10^{p}',
    vars: [{ key: 'x', label: 'x' }],
    solve: ({ x }) => {
      if (x === 0) return [{ label: 'Result', value: '0' }];
      const p = Math.floor(Math.log10(Math.abs(x)));
      return [{ label: 'Result', value: `${round(x / Math.pow(10, p), 6)} × 10^${p}` }];
    },
  },
  { id: 'suvat', group: 'Engineering extras', name: 'SUVAT (constant acceleration)', latex: 'v = u + at, \\quad s = ut + \\tfrac{1}{2}at^2, \\quad v^2 = u^2 + 2as' },
  { id: 'sigma-notation', group: 'Engineering extras', name: 'Arithmetic series', latex: '\\sum_{k=1}^{n} k = \\frac{n(n+1)}{2}' },
  {
    id: 'geometric-series', group: 'Engineering extras', name: 'Geometric series sum',
    latex: 'S_n = a\\frac{1 - r^n}{1 - r}',
    vars: [{ key: 'a', label: 'a (first term)' }, { key: 'r', label: 'r (ratio)' }, { key: 'n', label: 'n (terms)' }],
    solve: ({ a, r, n }) => r === 1
      ? [{ label: 'Sₙ', value: round(a * n) }]
      : [{ label: 'Sₙ', value: round(a * (1 - Math.pow(r, n)) / (1 - r)) }],
  },

  // ===== Deepen current course: Algebra =====
  { id: 'complete-square', group: 'Algebra', name: 'Completing the square', latex: 'ax^2+bx+c = a\\left(x+\\tfrac{b}{2a}\\right)^2 + c - \\tfrac{b^2}{4a}' },
  {
    id: 'remainder-theorem', group: 'Algebra', name: 'Remainder theorem (evaluate cubic P(a))',
    latex: 'P(x) = px^3 + qx^2 + rx + s, \\quad \\text{remainder} = P(a)',
    vars: [{ key: 'p', label: 'p' }, { key: 'q', label: 'q' }, { key: 'r', label: 'r' }, { key: 's', label: 's' }, { key: 'a', label: 'a' }],
    solve: ({ p, q, r, s, a }) => [{ label: 'P(a)', value: round(p * a ** 3 + q * a * a + r * a + s) }],
  },
  { id: 'factor-theorem', group: 'Algebra', name: 'Factor theorem', latex: 'P(a) = 0 \\iff (x-a) \\text{ is a factor of } P(x)' },
  { id: 'poly-division', group: 'Algebra', name: 'Polynomial division identity', latex: 'P(x) = D(x)\\,Q(x) + R(x)' },
  {
    id: 'abs-distance', group: 'Algebra', name: 'Absolute-value distance',
    latex: 'd = |a - b|',
    vars: [{ key: 'a', label: 'a' }, { key: 'b', label: 'b' }],
    solve: ({ a, b }) => [{ label: '|a − b|', value: round(Math.abs(a - b)) }],
  },
  { id: 'inequality-rules', group: 'Algebra', name: 'Inequality rules', latex: '\\text{multiply/divide by a negative} \\Rightarrow \\text{reverse } <,\\le,>,\\ge' },
  { id: 'surd-laws', group: 'Algebra', name: 'Surd laws', latex: '\\sqrt{ab} = \\sqrt a\\,\\sqrt b, \\quad \\sqrt{\\tfrac{a}{b}} = \\tfrac{\\sqrt a}{\\sqrt b}' },
  { id: 'partial-improper', group: 'Algebra', name: 'Partial fractions (improper)', latex: '\\frac{\\text{deg} \\ge \\text{deg}}{ } : \\text{divide first, then split the proper remainder}' },
  { id: 'partial-irreducible', group: 'Algebra', name: 'Partial fractions (irreducible quadratic)', latex: '\\frac{px+q}{(x-a)(x^2+bx+c)} = \\frac{A}{x-a} + \\frac{Bx+C}{x^2+bx+c}' },

  // ===== Sequences & series =====
  {
    id: 'arith-nth', group: 'Sequences & series', name: 'Arithmetic sequence: nth term',
    latex: 'a_n = a + (n-1)d',
    vars: [{ key: 'a', label: 'a (first term)' }, { key: 'd', label: 'd (common diff)' }, { key: 'n', label: 'n' }],
    solve: ({ a, d, n }) => [{ label: 'aₙ', value: round(a + (n - 1) * d) }],
  },
  {
    id: 'arith-sum', group: 'Sequences & series', name: 'Arithmetic series: sum',
    latex: 'S_n = \\tfrac{n}{2}\\left(2a + (n-1)d\\right)',
    vars: [{ key: 'a', label: 'a' }, { key: 'd', label: 'd' }, { key: 'n', label: 'n' }],
    solve: ({ a, d, n }) => [{ label: 'Sₙ', value: round((n / 2) * (2 * a + (n - 1) * d)) }],
  },
  {
    id: 'geo-nth', group: 'Sequences & series', name: 'Geometric sequence: nth term',
    latex: 'a_n = a\\,r^{\\,n-1}',
    vars: [{ key: 'a', label: 'a' }, { key: 'r', label: 'r' }, { key: 'n', label: 'n' }],
    solve: ({ a, r, n }) => [{ label: 'aₙ', value: round(a * Math.pow(r, n - 1)) }],
  },
  {
    id: 'geo-sum-inf', group: 'Sequences & series', name: 'Geometric series: sum to infinity',
    latex: 'S_\\infty = \\frac{a}{1 - r}, \\quad |r| < 1',
    vars: [{ key: 'a', label: 'a' }, { key: 'r', label: 'r' }],
    solve: ({ a, r }) => Math.abs(r) >= 1
      ? [{ label: 'Error', value: 'diverges (|r| ≥ 1)' }]
      : [{ label: 'S∞', value: round(a / (1 - r)) }],
  },
  {
    id: 'sum-k2', group: 'Sequences & series', name: 'Sum of squares Σk²',
    latex: '\\sum_{k=1}^{n} k^2 = \\frac{n(n+1)(2n+1)}{6}',
    vars: [{ key: 'n', label: 'n' }],
    solve: ({ n }) => [{ label: 'Σk²', value: round(n * (n + 1) * (2 * n + 1) / 6) }],
  },
  {
    id: 'sum-k3', group: 'Sequences & series', name: 'Sum of cubes Σk³',
    latex: '\\sum_{k=1}^{n} k^3 = \\left(\\frac{n(n+1)}{2}\\right)^2',
    vars: [{ key: 'n', label: 'n' }],
    solve: ({ n }) => [{ label: 'Σk³', value: round(Math.pow(n * (n + 1) / 2, 2)) }],
  },
  { id: 'binomial-series', group: 'Sequences & series', name: 'Binomial series', latex: '(1+x)^n = 1 + nx + \\frac{n(n-1)}{2!}x^2 + \\frac{n(n-1)(n-2)}{3!}x^3 + \\cdots' },
  { id: 'maclaurin', group: 'Sequences & series', name: 'Maclaurin series', latex: 'f(x) = f(0) + f\'(0)x + \\frac{f\'\'(0)}{2!}x^2 + \\frac{f\'\'\'(0)}{3!}x^3 + \\cdots' },
  { id: 'taylor', group: 'Sequences & series', name: 'Taylor series about a', latex: 'f(x) = \\sum_{n=0}^{\\infty} \\frac{f^{(n)}(a)}{n!}(x-a)^n' },
  { id: 'series-exp', group: 'Sequences & series', name: 'Series: eˣ', latex: 'e^x = \\sum_{n=0}^{\\infty} \\frac{x^n}{n!} = 1 + x + \\frac{x^2}{2!} + \\cdots' },
  { id: 'series-sin', group: 'Sequences & series', name: 'Series: sin x', latex: '\\sin x = x - \\frac{x^3}{3!} + \\frac{x^5}{5!} - \\cdots' },
  { id: 'series-cos', group: 'Sequences & series', name: 'Series: cos x', latex: '\\cos x = 1 - \\frac{x^2}{2!} + \\frac{x^4}{4!} - \\cdots' },
  { id: 'series-ln', group: 'Sequences & series', name: 'Series: ln(1+x)', latex: '\\ln(1+x) = x - \\frac{x^2}{2} + \\frac{x^3}{3} - \\cdots, \\quad |x| < 1' },

  // ===== Complex numbers (extended) =====
  { id: 'euler', group: 'Complex numbers', name: "Euler's formula", latex: 'e^{i\\theta} = \\cos\\theta + i\\sin\\theta' },
  {
    id: 'exp-to-rect', group: 'Complex numbers', name: 'Exponential → rectangular',
    latex: 'r e^{i\\theta} = r\\cos\\theta + i\\,r\\sin\\theta',
    vars: [{ key: 'r', label: 'r' }, { key: 'theta', label: 'θ (deg)' }],
    solve: ({ r, theta }) => [{ label: 'a + bi', value: `${round(r * Math.cos(theta * D2R))} + ${round(r * Math.sin(theta * D2R))}i` }],
  },
  {
    id: 'complex-nth-roots', group: 'Complex numbers', name: 'nth roots of a complex number',
    latex: 'z^{1/n} = r^{1/n}\\left[\\cos\\tfrac{\\theta + 360^\\circ k}{n} + i\\sin\\tfrac{\\theta + 360^\\circ k}{n}\\right]',
    vars: [{ key: 'r', label: 'r (modulus)' }, { key: 'theta', label: 'θ (deg)' }, { key: 'n', label: 'n (root)' }],
    solve: ({ r, theta, n }) => {
      if (n < 1 || n % 1) return [{ label: 'Error', value: 'n must be a positive integer' }];
      const rr = Math.pow(r, 1 / n);
      const out = [];
      for (let k = 0; k < n; k++) {
        const ang = (theta + 360 * k) / n;
        out.push({ label: `root ${k + 1}`, value: `${round(rr * Math.cos(ang * D2R))} + ${round(rr * Math.sin(ang * D2R))}i  (∠${round(ang, 2)}°)` });
      }
      return out;
    },
  },
  { id: 'roots-unity', group: 'Complex numbers', name: 'Roots of unity', latex: 'z^n = 1 \\Rightarrow z = e^{2\\pi i k/n}, \\ k = 0,1,\\dots,n-1' },

  // ===== Trigonometry (extended) =====
  { id: 'reciprocal-id', group: 'Trigonometry', name: 'Reciprocal identities', latex: '\\csc\\theta = \\tfrac{1}{\\sin\\theta}, \\ \\sec\\theta = \\tfrac{1}{\\cos\\theta}, \\ \\cot\\theta = \\tfrac{1}{\\tan\\theta}' },
  { id: 'cofunction', group: 'Trigonometry', name: 'Cofunction identities', latex: '\\sin(90^\\circ - \\theta) = \\cos\\theta, \\quad \\tan(90^\\circ - \\theta) = \\cot\\theta' },
  {
    id: 'r-formula', group: 'Trigonometry', name: 'R-formula: a sinθ + b cosθ',
    latex: 'a\\sin\\theta + b\\cos\\theta = R\\sin(\\theta + \\alpha), \\ R = \\sqrt{a^2+b^2}, \\ \\tan\\alpha = \\tfrac{b}{a}',
    vars: [{ key: 'a', label: 'a' }, { key: 'b', label: 'b' }],
    solve: ({ a, b }) => [
      { label: 'R', value: round(Math.hypot(a, b)) },
      { label: 'α (deg)', value: round(Math.atan2(b, a) * R2D, 3) },
    ],
  },
  { id: 'sum-to-product', group: 'Trigonometry', name: 'Sum to product', latex: '\\sin A + \\sin B = 2\\sin\\tfrac{A+B}{2}\\cos\\tfrac{A-B}{2}' },
  { id: 'product-to-sum', group: 'Trigonometry', name: 'Product to sum', latex: '2\\sin A\\cos B = \\sin(A+B) + \\sin(A-B)' },
  { id: 'half-angle', group: 'Trigonometry', name: 'Half-angle identities', latex: '\\sin^2\\tfrac{\\theta}{2} = \\tfrac{1-\\cos\\theta}{2}, \\quad \\cos^2\\tfrac{\\theta}{2} = \\tfrac{1+\\cos\\theta}{2}' },
  { id: 'inverse-trig-ranges', group: 'Trigonometry', name: 'Inverse trig principal ranges', latex: '\\arcsin \\in [-\\tfrac{\\pi}{2}, \\tfrac{\\pi}{2}], \\ \\arccos \\in [0, \\pi], \\ \\arctan \\in (-\\tfrac{\\pi}{2}, \\tfrac{\\pi}{2})' },
  { id: 'general-sol-sin', group: 'Trigonometry', name: 'General solution: sin', latex: '\\sin\\theta = k \\Rightarrow \\theta = n\\pi + (-1)^n \\arcsin k' },
  { id: 'general-sol-cos', group: 'Trigonometry', name: 'General solution: cos', latex: '\\cos\\theta = k \\Rightarrow \\theta = 2n\\pi \\pm \\arccos k' },

  // ===== Coordinate geometry (extended) =====
  { id: 'line-general', group: 'Geometry & functions', name: 'Line: general form', latex: 'ax + by + c = 0' },
  { id: 'line-intercept', group: 'Geometry & functions', name: 'Line: intercept form', latex: '\\frac{x}{a} + \\frac{y}{b} = 1' },
  {
    id: 'angle-between-lines', group: 'Geometry & functions', name: 'Angle between two lines',
    latex: '\\tan\\theta = \\left|\\frac{m_1 - m_2}{1 + m_1 m_2}\\right|',
    vars: [{ key: 'm1', label: 'm₁' }, { key: 'm2', label: 'm₂' }],
    solve: ({ m1, m2 }) => (1 + m1 * m2 === 0)
      ? [{ label: 'θ', value: '90° (perpendicular)' }]
      : [{ label: 'θ', value: `${round(Math.atan(Math.abs((m1 - m2) / (1 + m1 * m2))) * R2D, 3)}°` }],
  },
  {
    id: 'point-line-distance', group: 'Geometry & functions', name: 'Distance: point to line',
    latex: 'd = \\frac{|ax_0 + by_0 + c|}{\\sqrt{a^2 + b^2}}',
    vars: [{ key: 'a', label: 'a' }, { key: 'b', label: 'b' }, { key: 'c', label: 'c' }, { key: 'x0', label: 'x₀' }, { key: 'y0', label: 'y₀' }],
    solve: ({ a, b, c, x0, y0 }) => (a === 0 && b === 0)
      ? [{ label: 'Error', value: 'a and b cannot both be 0' }]
      : [{ label: 'd', value: round(Math.abs(a * x0 + b * y0 + c) / Math.hypot(a, b)) }],
  },
  { id: 'ellipse-eqn', group: 'Geometry & functions', name: 'Ellipse (standard)', latex: '\\frac{x^2}{a^2} + \\frac{y^2}{b^2} = 1' },
  { id: 'parabola-eqn', group: 'Geometry & functions', name: 'Parabola (standard)', latex: 'y^2 = 4ax' },
  { id: 'hyperbola-eqn', group: 'Geometry & functions', name: 'Hyperbola (standard)', latex: '\\frac{x^2}{a^2} - \\frac{y^2}{b^2} = 1' },
  {
    id: 'polar-to-cart', group: 'Geometry & functions', name: 'Polar → Cartesian',
    latex: 'x = r\\cos\\theta, \\quad y = r\\sin\\theta',
    vars: [{ key: 'r', label: 'r' }, { key: 'theta', label: 'θ (deg)' }],
    solve: ({ r, theta }) => [{ label: '(x, y)', value: `(${round(r * Math.cos(theta * D2R))}, ${round(r * Math.sin(theta * D2R))})` }],
  },
  {
    id: 'cart-to-polar', group: 'Geometry & functions', name: 'Cartesian → Polar',
    latex: 'r = \\sqrt{x^2+y^2}, \\quad \\theta = \\arctan\\tfrac{y}{x}',
    vars: [{ key: 'x', label: 'x' }, { key: 'y', label: 'y' }],
    solve: ({ x, y }) => [
      { label: 'r', value: round(Math.hypot(x, y)) },
      { label: 'θ (deg)', value: round(Math.atan2(y, x) * R2D, 3) },
    ],
  },

  // ===== Differentiation (extended) =====
  { id: 'deriv-sec', group: 'Differentiation', name: 'Derivative of sec / cosec / cot', latex: '\\tfrac{d}{dx}\\sec x = \\sec x\\tan x, \\ \\tfrac{d}{dx}\\csc x = -\\csc x\\cot x, \\ \\tfrac{d}{dx}\\cot x = -\\csc^2 x' },
  { id: 'deriv-ax', group: 'Differentiation', name: 'Derivative of aˣ and logₐx', latex: '\\tfrac{d}{dx}a^x = a^x\\ln a, \\quad \\tfrac{d}{dx}\\log_a x = \\tfrac{1}{x\\ln a}' },
  { id: 'deriv-inverse-trig', group: 'Differentiation', name: 'Derivatives of inverse trig', latex: '\\tfrac{d}{dx}\\arcsin x = \\tfrac{1}{\\sqrt{1-x^2}}, \\ \\tfrac{d}{dx}\\arctan x = \\tfrac{1}{1+x^2}' },
  { id: 'deriv-hyperbolic', group: 'Differentiation', name: 'Derivatives of hyperbolic', latex: '\\tfrac{d}{dx}\\sinh x = \\cosh x, \\ \\tfrac{d}{dx}\\cosh x = \\sinh x, \\ \\tfrac{d}{dx}\\tanh x = \\operatorname{sech}^2 x' },
  { id: 'implicit-diff', group: 'Differentiation', name: 'Implicit differentiation', latex: '\\frac{d}{dx}\\,f(y) = f\'(y)\\,\\frac{dy}{dx}' },
  { id: 'parametric-diff', group: 'Differentiation', name: 'Parametric differentiation', latex: '\\frac{dy}{dx} = \\frac{dy/dt}{dx/dt}' },
  { id: 'log-diff', group: 'Differentiation', name: 'Logarithmic differentiation', latex: 'y = f(x)^{g(x)} \\Rightarrow \\ln y = g\\ln f, \\ \\tfrac{y\'}{y} = (g\\ln f)\'' },
  { id: 'second-deriv-test', group: 'Differentiation', name: 'Second-derivative test', latex: "f'(a)=0: \\ f''(a) > 0 \\Rightarrow \\min, \\ f''(a) < 0 \\Rightarrow \\max" },
  { id: 'lhopital', group: 'Differentiation', name: "L'Hôpital's rule", latex: '\\lim_{x\\to a}\\frac{f(x)}{g(x)} = \\lim_{x\\to a}\\frac{f\'(x)}{g\'(x)} \\quad (\\tfrac{0}{0} \\text{ or } \\tfrac{\\infty}{\\infty})' },
  { id: 'related-rates', group: 'Differentiation', name: 'Related rates', latex: '\\frac{dV}{dt} = \\frac{dV}{dr}\\cdot\\frac{dr}{dt}' },

  // ===== Integration (extended) =====
  { id: 'int-sec2', group: 'Integration', name: 'Integral of sec²x', latex: '\\int \\sec^2 x\\,dx = \\tan x + C' },
  { id: 'int-arctan', group: 'Integration', name: 'Integral → arctan', latex: '\\int \\frac{dx}{a^2 + x^2} = \\frac{1}{a}\\arctan\\frac{x}{a} + C' },
  { id: 'int-arcsin', group: 'Integration', name: 'Integral → arcsin', latex: '\\int \\frac{dx}{\\sqrt{a^2 - x^2}} = \\arcsin\\frac{x}{a} + C' },
  { id: 'int-hyperbolic', group: 'Integration', name: 'Integrals of hyperbolic', latex: '\\int \\sinh x\\,dx = \\cosh x + C, \\quad \\int \\cosh x\\,dx = \\sinh x + C' },
  { id: 'int-substitution', group: 'Integration', name: 'Integration by substitution', latex: '\\int f(g(x))g\'(x)\\,dx = \\int f(u)\\,du, \\ u = g(x)' },
  {
    id: 'vol-revolution', group: 'Integration', name: 'Volume of revolution (y = xⁿ about x-axis)',
    latex: 'V = \\pi\\int_a^b y^2\\,dx',
    vars: [{ key: 'n', label: 'n (y = xⁿ)' }, { key: 'a', label: 'a' }, { key: 'b', label: 'b' }],
    solve: ({ n, a, b }) => {
      const p = 2 * n + 1;
      return p === 0
        ? [{ label: 'V', value: round(Math.PI * (Math.log(Math.abs(b)) - Math.log(Math.abs(a)))) }]
        : [{ label: 'V', value: round(Math.PI * (Math.pow(b, p) - Math.pow(a, p)) / p) }];
    },
  },
  { id: 'arc-length-int', group: 'Integration', name: 'Arc length', latex: 'L = \\int_a^b \\sqrt{1 + \\left(\\tfrac{dy}{dx}\\right)^2}\\,dx' },
  { id: 'surface-revolution', group: 'Integration', name: 'Surface of revolution', latex: 'S = 2\\pi\\int_a^b y\\sqrt{1 + \\left(\\tfrac{dy}{dx}\\right)^2}\\,dx' },
  {
    id: 'mean-value-fn', group: 'Integration', name: 'Mean value of a function (f = xⁿ)',
    latex: '\\bar f = \\frac{1}{b-a}\\int_a^b f(x)\\,dx',
    vars: [{ key: 'n', label: 'n (f = xⁿ)' }, { key: 'a', label: 'a' }, { key: 'b', label: 'b' }],
    solve: ({ n, a, b }) => {
      if (a === b) return [{ label: 'Error', value: 'a and b must differ' }];
      const p = n + 1;
      const integral = p === 0 ? (Math.log(Math.abs(b)) - Math.log(Math.abs(a))) : (Math.pow(b, p) - Math.pow(a, p)) / p;
      return [{ label: 'mean', value: round(integral / (b - a)) }];
    },
  },

  // ===== Vectors =====
  {
    id: 'vec-magnitude', group: 'Vectors', name: 'Magnitude of a vector',
    latex: '|\\vec a| = \\sqrt{a_1^2 + a_2^2 + a_3^2}',
    vars: [{ key: 'a1', label: 'a₁' }, { key: 'a2', label: 'a₂' }, { key: 'a3', label: 'a₃' }],
    solve: ({ a1, a2, a3 }) => [{ label: '|a|', value: round(Math.hypot(a1, a2, a3)) }],
  },
  {
    id: 'unit-vector', group: 'Vectors', name: 'Unit vector',
    latex: '\\hat a = \\frac{\\vec a}{|\\vec a|}',
    vars: [{ key: 'a1', label: 'a₁' }, { key: 'a2', label: 'a₂' }, { key: 'a3', label: 'a₃' }],
    solve: ({ a1, a2, a3 }) => {
      const m = Math.hypot(a1, a2, a3);
      return m === 0 ? [{ label: 'Error', value: 'zero vector has no direction' }]
        : [{ label: 'â', value: `(${round(a1 / m)}, ${round(a2 / m)}, ${round(a3 / m)})` }];
    },
  },
  {
    id: 'dot-product', group: 'Vectors', name: 'Dot product',
    latex: '\\vec a \\cdot \\vec b = a_1 b_1 + a_2 b_2 + a_3 b_3',
    vars: [{ key: 'a1', label: 'a₁' }, { key: 'a2', label: 'a₂' }, { key: 'a3', label: 'a₃' }, { key: 'b1', label: 'b₁' }, { key: 'b2', label: 'b₂' }, { key: 'b3', label: 'b₃' }],
    solve: ({ a1, a2, a3, b1, b2, b3 }) => [{ label: 'a · b', value: round(a1 * b1 + a2 * b2 + a3 * b3) }],
  },
  {
    id: 'angle-vectors', group: 'Vectors', name: 'Angle between vectors',
    latex: '\\cos\\theta = \\frac{\\vec a \\cdot \\vec b}{|\\vec a|\\,|\\vec b|}',
    vars: [{ key: 'a1', label: 'a₁' }, { key: 'a2', label: 'a₂' }, { key: 'a3', label: 'a₃' }, { key: 'b1', label: 'b₁' }, { key: 'b2', label: 'b₂' }, { key: 'b3', label: 'b₃' }],
    solve: ({ a1, a2, a3, b1, b2, b3 }) => {
      const dot = a1 * b1 + a2 * b2 + a3 * b3;
      const m = Math.hypot(a1, a2, a3) * Math.hypot(b1, b2, b3);
      if (m === 0) return [{ label: 'Error', value: 'a zero vector has no angle' }];
      return [{ label: 'θ', value: `${round(Math.acos(Math.max(-1, Math.min(1, dot / m))) * R2D, 3)}°` }];
    },
  },
  {
    id: 'cross-product', group: 'Vectors', name: 'Cross product',
    latex: '\\vec a \\times \\vec b = (a_2 b_3 - a_3 b_2,\\ a_3 b_1 - a_1 b_3,\\ a_1 b_2 - a_2 b_1)',
    vars: [{ key: 'a1', label: 'a₁' }, { key: 'a2', label: 'a₂' }, { key: 'a3', label: 'a₃' }, { key: 'b1', label: 'b₁' }, { key: 'b2', label: 'b₂' }, { key: 'b3', label: 'b₃' }],
    solve: ({ a1, a2, a3, b1, b2, b3 }) => {
      const c = [a2 * b3 - a3 * b2, a3 * b1 - a1 * b3, a1 * b2 - a2 * b1];
      return [
        { label: 'a × b', value: `(${round(c[0])}, ${round(c[1])}, ${round(c[2])})` },
        { label: '|a × b|', value: round(Math.hypot(c[0], c[1], c[2])) },
      ];
    },
  },
  {
    id: 'scalar-projection', group: 'Vectors', name: 'Scalar projection of a onto b',
    latex: '\\text{comp}_{\\vec b}\\,\\vec a = \\frac{\\vec a \\cdot \\vec b}{|\\vec b|}',
    vars: [{ key: 'a1', label: 'a₁' }, { key: 'a2', label: 'a₂' }, { key: 'a3', label: 'a₃' }, { key: 'b1', label: 'b₁' }, { key: 'b2', label: 'b₂' }, { key: 'b3', label: 'b₃' }],
    solve: ({ a1, a2, a3, b1, b2, b3 }) => {
      const mb = Math.hypot(b1, b2, b3);
      return mb === 0 ? [{ label: 'Error', value: 'b is the zero vector' }]
        : [{ label: 'projection', value: round((a1 * b1 + a2 * b2 + a3 * b3) / mb) }];
    },
  },
  { id: 'vec-line', group: 'Vectors', name: 'Vector equation of a line', latex: '\\vec r = \\vec a + t\\,\\vec d' },

  // ===== Matrices =====
  {
    id: 'det-2x2', group: 'Matrices', name: '2×2 determinant',
    latex: '\\det\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix} = ad - bc',
    vars: [{ key: 'a', label: 'a' }, { key: 'b', label: 'b' }, { key: 'c', label: 'c' }, { key: 'd', label: 'd' }],
    solve: ({ a, b, c, d }) => [{ label: 'det', value: round(a * d - b * c) }],
  },
  {
    id: 'det-3x3', group: 'Matrices', name: '3×3 determinant',
    latex: '\\det = a(ei - fh) - b(di - fg) + c(dh - eg)',
    vars: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'].map((k) => ({ key: k, label: k })),
    solve: ({ a, b, c, d, e, f, g, h, i }) => [{ label: 'det', value: round(a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g)) }],
  },
  {
    id: 'inv-2x2', group: 'Matrices', name: '2×2 inverse',
    latex: 'A^{-1} = \\frac{1}{ad - bc}\\begin{pmatrix} d & -b \\\\ -c & a \\end{pmatrix}',
    vars: [{ key: 'a', label: 'a' }, { key: 'b', label: 'b' }, { key: 'c', label: 'c' }, { key: 'd', label: 'd' }],
    solve: ({ a, b, c, d }) => {
      const det = a * d - b * c;
      return det === 0 ? [{ label: 'Error', value: 'singular (det = 0), no inverse' }]
        : [{ label: 'A⁻¹', value: `[[${round(d / det)}, ${round(-b / det)}], [${round(-c / det)}, ${round(a / det)}]]` }];
    },
  },
  {
    id: 'mat-mult-2x2', group: 'Matrices', name: '2×2 × 2×2 multiply',
    latex: '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}\\begin{pmatrix} e & f \\\\ g & h \\end{pmatrix} = \\begin{pmatrix} ae+bg & af+bh \\\\ ce+dg & cf+dh \\end{pmatrix}',
    vars: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((k) => ({ key: k, label: k })),
    solve: ({ a, b, c, d, e, f, g, h }) => [{ label: 'AB', value: `[[${round(a * e + b * g)}, ${round(a * f + b * h)}], [${round(c * e + d * g)}, ${round(c * f + d * h)}]]` }],
  },
  {
    id: 'cramer-2x2', group: 'Matrices', name: "Cramer's rule (2×2 system)",
    latex: 'ax + by = e, \\ cx + dy = f \\Rightarrow x = \\tfrac{ed - bf}{ad - bc}, \\ y = \\tfrac{af - ec}{ad - bc}',
    vars: ['a', 'b', 'c', 'd', 'e', 'f'].map((k) => ({ key: k, label: k })),
    solve: ({ a, b, c, d, e, f }) => {
      const det = a * d - b * c;
      return det === 0 ? [{ label: 'Error', value: 'no unique solution (det = 0)' }]
        : [{ label: 'x', value: round((e * d - b * f) / det) }, { label: 'y', value: round((a * f - e * c) / det) }];
    },
  },
  { id: 'mat-transpose', group: 'Matrices', name: 'Transpose & identity', latex: '(A^T)_{ij} = A_{ji}, \\quad AI = IA = A' },

  // ===== Statistics & probability =====
  {
    id: 'mean-list', group: 'Statistics & probability', name: 'Mean of a data set',
    latex: '\\bar x = \\frac{1}{n}\\sum x_i',
    optionalVars: true,
    vars: ['x1', 'x2', 'x3', 'x4', 'x5', 'x6'].map((k, i) => ({ key: k, label: `x${i + 1}` })),
    solve: (v) => {
      const xs = seq(v, ['x1', 'x2', 'x3', 'x4', 'x5', 'x6']);
      if (xs.length < 2) return [{ label: 'Error', value: 'enter at least 2 values' }];
      return [{ label: 'mean', value: round(xs.reduce((s, x) => s + x, 0) / xs.length) }, { label: 'n', value: xs.length }];
    },
  },
  {
    id: 'std-dev', group: 'Statistics & probability', name: 'Standard deviation',
    latex: 's = \\sqrt{\\frac{\\sum (x_i - \\bar x)^2}{n - 1}}, \\quad \\sigma = \\sqrt{\\frac{\\sum (x_i - \\bar x)^2}{n}}',
    optionalVars: true,
    vars: ['x1', 'x2', 'x3', 'x4', 'x5', 'x6'].map((k, i) => ({ key: k, label: `x${i + 1}` })),
    solve: (v) => {
      const xs = seq(v, ['x1', 'x2', 'x3', 'x4', 'x5', 'x6']);
      if (xs.length < 2) return [{ label: 'Error', value: 'enter at least 2 values' }];
      const m = xs.reduce((s, x) => s + x, 0) / xs.length;
      const ss = xs.reduce((s, x) => s + (x - m) ** 2, 0);
      return [
        { label: 'mean', value: round(m) },
        { label: 'sample s', value: round(Math.sqrt(ss / (xs.length - 1))) },
        { label: 'population σ', value: round(Math.sqrt(ss / xs.length)) },
      ];
    },
  },
  {
    id: 'z-score', group: 'Statistics & probability', name: 'Z-score',
    latex: 'z = \\frac{x - \\mu}{\\sigma}',
    vars: [{ key: 'x', label: 'x' }, { key: 'mu', label: 'μ (mean)' }, { key: 'sigma', label: 'σ (std dev)' }],
    solve: ({ x, mu, sigma }) => sigma === 0
      ? [{ label: 'Error', value: 'σ must be non-zero' }]
      : [{ label: 'z', value: round((x - mu) / sigma) }],
  },
  {
    id: 'nPr', group: 'Statistics & probability', name: 'Permutations ⁿPᵣ',
    latex: '^nP_r = \\frac{n!}{(n-r)!}',
    vars: [{ key: 'n', label: 'n' }, { key: 'r', label: 'r' }],
    solve: ({ n, r }) => [{ label: 'ⁿPᵣ', value: nPrF(n, r) }],
  },
  {
    id: 'nCr', group: 'Statistics & probability', name: 'Combinations ⁿCᵣ',
    latex: '^nC_r = \\binom{n}{r} = \\frac{n!}{r!\\,(n-r)!}',
    vars: [{ key: 'n', label: 'n' }, { key: 'r', label: 'r' }],
    solve: ({ n, r }) => [{ label: 'ⁿCᵣ', value: nCrF(n, r) }],
  },
  {
    id: 'binomial-prob', group: 'Statistics & probability', name: 'Binomial probability P(X = k)',
    latex: 'P(X = k) = \\binom{n}{k} p^k (1-p)^{n-k}',
    vars: [{ key: 'n', label: 'n' }, { key: 'k', label: 'k' }, { key: 'p', label: 'p (0–1)' }],
    solve: ({ n, k, p }) => (p < 0 || p > 1 || k < 0 || k > n)
      ? [{ label: 'Error', value: 'need 0 ≤ p ≤ 1 and 0 ≤ k ≤ n' }]
      : [{ label: 'P(X = k)', value: round(nCrF(n, k) * Math.pow(p, k) * Math.pow(1 - p, n - k)) }],
  },
  {
    id: 'factorial', group: 'Statistics & probability', name: 'Factorial n!',
    latex: 'n! = n \\times (n-1) \\times \\cdots \\times 2 \\times 1',
    vars: [{ key: 'n', label: 'n' }],
    solve: ({ n }) => isNaN(fact(n)) ? [{ label: 'Error', value: 'need integer 0 ≤ n ≤ 170' }] : [{ label: 'n!', value: fact(n) }],
  },
  {
    id: 'weighted-mean', group: 'Statistics & probability', name: 'Weighted mean',
    latex: '\\bar x = \\frac{\\sum w_i x_i}{\\sum w_i}',
    optionalVars: true,
    vars: [{ key: 'x1', label: 'x₁' }, { key: 'w1', label: 'w₁' }, { key: 'x2', label: 'x₂' }, { key: 'w2', label: 'w₂' }, { key: 'x3', label: 'x₃' }, { key: 'w3', label: 'w₃' }],
    solve: (v) => {
      const pairs = [['x1', 'w1'], ['x2', 'w2'], ['x3', 'w3']].filter(([x, w]) => isFinite(v[x]) && isFinite(v[w]));
      if (!pairs.length) return [{ label: 'Error', value: 'enter at least one x/w pair' }];
      const sw = pairs.reduce((s, [, w]) => s + v[w], 0);
      return sw === 0 ? [{ label: 'Error', value: 'weights sum to 0' }]
        : [{ label: 'weighted mean', value: round(pairs.reduce((s, [x, w]) => s + v[x] * v[w], 0) / sw) }];
    },
  },
  { id: 'expected-value', group: 'Statistics & probability', name: 'Expected value', latex: 'E(X) = \\sum x_i\\,P(x_i)' },

  // ===== Mensuration =====
  {
    id: 'circle-mens', group: 'Mensuration', name: 'Circle: area & circumference',
    latex: 'A = \\pi r^2, \\quad C = 2\\pi r',
    vars: [{ key: 'r', label: 'r' }],
    solve: ({ r }) => [{ label: 'Area', value: round(Math.PI * r * r) }, { label: 'Circumference', value: round(2 * Math.PI * r) }],
  },
  {
    id: 'sphere-mens', group: 'Mensuration', name: 'Sphere: volume & surface area',
    latex: 'V = \\tfrac{4}{3}\\pi r^3, \\quad S = 4\\pi r^2',
    vars: [{ key: 'r', label: 'r' }],
    solve: ({ r }) => [{ label: 'Volume', value: round(4 / 3 * Math.PI * r ** 3) }, { label: 'Surface', value: round(4 * Math.PI * r * r) }],
  },
  {
    id: 'cylinder-mens', group: 'Mensuration', name: 'Cylinder: volume & surface area',
    latex: 'V = \\pi r^2 h, \\quad S = 2\\pi r(r + h)',
    vars: [{ key: 'r', label: 'r' }, { key: 'h', label: 'h' }],
    solve: ({ r, h }) => [{ label: 'Volume', value: round(Math.PI * r * r * h) }, { label: 'Surface', value: round(2 * Math.PI * r * (r + h)) }],
  },
  {
    id: 'cone-mens', group: 'Mensuration', name: 'Cone: volume & surface area',
    latex: 'V = \\tfrac{1}{3}\\pi r^2 h, \\quad S = \\pi r(r + l), \\ l = \\sqrt{r^2 + h^2}',
    vars: [{ key: 'r', label: 'r' }, { key: 'h', label: 'h' }],
    solve: ({ r, h }) => {
      const l = Math.hypot(r, h);
      return [{ label: 'Volume', value: round(1 / 3 * Math.PI * r * r * h) }, { label: 'Slant l', value: round(l) }, { label: 'Surface', value: round(Math.PI * r * (r + l)) }];
    },
  },
  {
    id: 'box-mens', group: 'Mensuration', name: 'Rectangular box: volume & surface area',
    latex: 'V = lwh, \\quad S = 2(lw + lh + wh)',
    vars: [{ key: 'l', label: 'l' }, { key: 'w', label: 'w' }, { key: 'h', label: 'h' }],
    solve: ({ l, w, h }) => [{ label: 'Volume', value: round(l * w * h) }, { label: 'Surface', value: round(2 * (l * w + l * h + w * h)) }],
  },
  {
    id: 'pyramid-mens', group: 'Mensuration', name: 'Pyramid / cone volume (general)',
    latex: 'V = \\tfrac{1}{3} A h',
    vars: [{ key: 'A', label: 'A (base area)' }, { key: 'h', label: 'h' }],
    solve: ({ A, h }) => [{ label: 'Volume', value: round(A * h / 3) }],
  },
  {
    id: 'ellipse-area', group: 'Mensuration', name: 'Ellipse area',
    latex: 'A = \\pi a b',
    vars: [{ key: 'a', label: 'a (semi-axis)' }, { key: 'b', label: 'b (semi-axis)' }],
    solve: ({ a, b }) => [{ label: 'Area', value: round(Math.PI * a * b) }],
  },

  // ===== Numerical methods =====
  {
    id: 'simpsons-rule', group: 'Numerical methods', name: "Simpson's rule",
    latex: '\\int_a^b f \\approx \\tfrac{h}{3}\\left[y_0 + 4y_1 + 2y_2 + \\cdots + 4y_{n-1} + y_n\\right]',
    optionalVars: true,
    vars: [{ key: 'h', label: 'h (strip width)' }, ...['y0', 'y1', 'y2', 'y3', 'y4', 'y5', 'y6', 'y7', 'y8'].map((k) => ({ key: k, label: k }))],
    solve: (v) => {
      const ys = seq(v, ['y0', 'y1', 'y2', 'y3', 'y4', 'y5', 'y6', 'y7', 'y8']);
      if (!isFinite(v.h)) return [{ label: 'Error', value: 'enter h' }];
      if (ys.length < 3 || ys.length % 2 === 0) return [{ label: 'Error', value: 'need an odd number of y-values (≥3): y₀…yₙ with n even' }];
      let s = ys[0] + ys[ys.length - 1];
      for (let i = 1; i < ys.length - 1; i++) s += (i % 2 ? 4 : 2) * ys[i];
      return [{ label: '≈ ∫', value: round(v.h / 3 * s) }];
    },
  },
  {
    id: 'trapezoidal-n', group: 'Numerical methods', name: 'Trapezoidal rule (n strips)',
    latex: '\\int_a^b f \\approx h\\left[\\tfrac{1}{2}y_0 + y_1 + \\cdots + y_{n-1} + \\tfrac{1}{2}y_n\\right]',
    optionalVars: true,
    vars: [{ key: 'h', label: 'h (strip width)' }, ...['y0', 'y1', 'y2', 'y3', 'y4', 'y5', 'y6', 'y7', 'y8'].map((k) => ({ key: k, label: k }))],
    solve: (v) => {
      const ys = seq(v, ['y0', 'y1', 'y2', 'y3', 'y4', 'y5', 'y6', 'y7', 'y8']);
      if (!isFinite(v.h)) return [{ label: 'Error', value: 'enter h' }];
      if (ys.length < 2) return [{ label: 'Error', value: 'enter at least 2 y-values' }];
      let s = (ys[0] + ys[ys.length - 1]) / 2;
      for (let i = 1; i < ys.length - 1; i++) s += ys[i];
      return [{ label: '≈ ∫', value: round(v.h * s) }];
    },
  },
  {
    id: 'newton-raphson', group: 'Numerical methods', name: 'Newton–Raphson (one step)',
    latex: 'x_{n+1} = x_n - \\frac{f(x_n)}{f\'(x_n)}',
    vars: [{ key: 'x', label: 'xₙ' }, { key: 'fx', label: 'f(xₙ)' }, { key: 'fpx', label: "f'(xₙ)" }],
    solve: ({ x, fx, fpx }) => fpx === 0
      ? [{ label: 'Error', value: "f'(xₙ) = 0, step fails" }]
      : [{ label: 'xₙ₊₁', value: round(x - fx / fpx) }],
  },
  {
    id: 'bisection', group: 'Numerical methods', name: 'Bisection midpoint',
    latex: 'c = \\frac{a + b}{2}',
    vars: [{ key: 'a', label: 'a' }, { key: 'b', label: 'b' }],
    solve: ({ a, b }) => [{ label: 'midpoint c', value: round((a + b) / 2) }],
  },
  {
    id: 'linear-interp', group: 'Numerical methods', name: 'Linear interpolation',
    latex: 'y = y_0 + (x - x_0)\\frac{y_1 - y_0}{x_1 - x_0}',
    vars: [{ key: 'x0', label: 'x₀' }, { key: 'y0', label: 'y₀' }, { key: 'x1', label: 'x₁' }, { key: 'y1', label: 'y₁' }, { key: 'x', label: 'x' }],
    solve: ({ x0, y0, x1, y1, x }) => x1 === x0
      ? [{ label: 'Error', value: 'x₀ and x₁ must differ' }]
      : [{ label: 'y', value: round(y0 + (x - x0) * (y1 - y0) / (x1 - x0)) }],
  },
  {
    id: 'relative-error', group: 'Numerical methods', name: 'Relative & percentage error',
    latex: '\\text{rel} = \\frac{|x_{\\text{approx}} - x_{\\text{true}}|}{|x_{\\text{true}}|}',
    vars: [{ key: 'approx', label: 'approx' }, { key: 'truev', label: 'true' }],
    solve: ({ approx, truev }) => truev === 0
      ? [{ label: 'Error', value: 'true value must be non-zero' }]
      : [{ label: 'relative', value: round(Math.abs(approx - truev) / Math.abs(truev)) }, { label: 'percentage', value: round(Math.abs(approx - truev) / Math.abs(truev) * 100, 4) + '%' }],
  },

  // ===== Differential equations =====
  { id: 'ode-order-linearity', group: 'Differential equations', name: 'Order & linearity', latex: '\\text{order} = \\text{highest derivative}; \\ \\text{linear if } y, y\', y\'\' \\text{ appear to power 1}' },
  { id: 'ode-general-particular', group: 'Differential equations', name: 'General vs particular solution', latex: 'y = y_c + y_p \\quad (\\text{complementary function} + \\text{particular integral})' },
  { id: 'ode-separable', group: 'Differential equations', name: 'Separable equation', latex: '\\frac{dy}{dx} = f(x)g(y) \\Rightarrow \\int \\frac{dy}{g(y)} = \\int f(x)\\,dx' },
  {
    id: 'ode-exp-growth', group: 'Differential equations', name: 'Growth / decay: dy/dt = ky',
    latex: '\\frac{dy}{dt} = ky \\Rightarrow y = y_0 e^{kt}',
    vars: [{ key: 'y0', label: 'y₀' }, { key: 'k', label: 'k' }, { key: 't', label: 't' }],
    solve: ({ y0, k, t }) => [{ label: 'y(t)', value: round(y0 * Math.exp(k * t)) }],
  },
  {
    id: 'ode-cooling', group: 'Differential equations', name: "Newton's law of cooling",
    latex: 'T = T_s + (T_0 - T_s)e^{-kt}',
    vars: [{ key: 'Ts', label: 'Tₛ (surroundings)' }, { key: 'T0', label: 'T₀ (initial)' }, { key: 'k', label: 'k' }, { key: 't', label: 't' }],
    solve: ({ Ts, T0, k, t }) => [{ label: 'T(t)', value: round(Ts + (T0 - Ts) * Math.exp(-k * t)) }],
  },
  {
    id: 'ode-half-life', group: 'Differential equations', name: 'Half-life & decay constant',
    latex: 't_{1/2} = \\frac{\\ln 2}{k}',
    vars: [{ key: 'k', label: 'k (decay const)' }],
    solve: ({ k }) => k <= 0
      ? [{ label: 'Error', value: 'k must be > 0' }]
      : [{ label: 'half-life t½', value: round(Math.LN2 / k) }],
  },
  {
    id: 'ode-half-life-k', group: 'Differential equations', name: 'Decay constant from half-life',
    latex: 'k = \\frac{\\ln 2}{t_{1/2}}',
    vars: [{ key: 'th', label: 't½ (half-life)' }],
    solve: ({ th }) => th <= 0
      ? [{ label: 'Error', value: 't½ must be > 0' }]
      : [{ label: 'k', value: round(Math.LN2 / th) }],
  },
  { id: 'ode-integrating-factor', group: 'Differential equations', name: 'Linear first-order (integrating factor)', latex: '\\frac{dy}{dx} + P(x)y = Q(x), \\ \\mu = e^{\\int P\\,dx}, \\ \\frac{d}{dx}(\\mu y) = \\mu Q' },
  { id: 'ode-logistic', group: 'Differential equations', name: 'Logistic equation', latex: '\\frac{dP}{dt} = kP\\left(1 - \\frac{P}{M}\\right) \\Rightarrow P = \\frac{M}{1 + Ae^{-kt}}' },
  { id: 'ode-homogeneous', group: 'Differential equations', name: 'Second-order homogeneous & auxiliary', latex: "ay'' + by' + cy = 0 \\Rightarrow am^2 + bm + c = 0" },
  {
    id: 'ode-auxiliary-roots', group: 'Differential equations', name: 'Auxiliary equation → general solution',
    latex: 'am^2 + bm + c = 0 \\Rightarrow \\text{roots decide the form of } y_c',
    vars: [{ key: 'a', label: 'a' }, { key: 'b', label: 'b' }, { key: 'c', label: 'c' }],
    solve: ({ a, b, c }) => {
      if (a === 0) return [{ label: 'Error', value: 'a must be non-zero (not 2nd order)' }];
      const disc = b * b - 4 * a * c;
      if (disc > 0) {
        const s = Math.sqrt(disc);
        const m1 = round((-b + s) / (2 * a));
        const m2 = round((-b - s) / (2 * a));
        return [
          { label: 'roots (real distinct)', value: `m = ${m1}, ${m2}` },
          { label: 'general solution', value: `y = A e^{${m1}x} + B e^{${m2}x}` },
        ];
      }
      if (disc === 0) {
        const m = round(-b / (2 * a));
        return [
          { label: 'root (repeated)', value: `m = ${m}` },
          { label: 'general solution', value: `y = (A + Bx) e^{${m}x}` },
        ];
      }
      const al = round(-b / (2 * a));
      const be = round(Math.sqrt(-disc) / (2 * a));
      return [
        { label: 'roots (complex)', value: `m = ${al} ± ${be}i` },
        { label: 'general solution', value: `y = e^{${al}x}(A cos ${be}x + B sin ${be}x)` },
      ];
    },
  },
  { id: 'ode-form-distinct', group: 'Differential equations', name: 'Solution form: distinct real roots', latex: 'y_c = A e^{m_1 x} + B e^{m_2 x}' },
  { id: 'ode-form-repeated', group: 'Differential equations', name: 'Solution form: repeated root', latex: 'y_c = (A + Bx)e^{mx}' },
  { id: 'ode-form-complex', group: 'Differential equations', name: 'Solution form: complex roots', latex: 'm = \\alpha \\pm \\beta i \\Rightarrow y_c = e^{\\alpha x}(A\\cos\\beta x + B\\sin\\beta x)' },
  { id: 'ode-particular-trial', group: 'Differential equations', name: 'Particular integral trials', latex: '\\text{RHS poly} \\to \\text{poly}; \\ e^{kx} \\to Ce^{kx}; \\ \\sin/\\cos \\to C\\cos + D\\sin' },
  {
    id: 'ode-euler', group: 'Differential equations', name: "Euler's method (one step)",
    latex: 'y_{n+1} = y_n + h\\,f(x_n, y_n)',
    vars: [{ key: 'yn', label: 'yₙ' }, { key: 'h', label: 'h (step)' }, { key: 'f', label: "f(xₙ, yₙ)" }],
    solve: ({ yn, h, f }) => [{ label: 'yₙ₊₁', value: round(yn + h * f) }],
  },
];
