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
};

const PRACTICE = [
  {
    id: 'linear-eq', topic: 'Linear equations', keywords: ['linear', 'equation', 'solve'],
    generate() {
      const x0 = PR.int(-6, 8);
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
      };
    },
  },
  {
    id: 'linear-both-sides', topic: 'Linear equations', keywords: ['linear', 'both sides'],
    generate() {
      const x0 = PR.int(-5, 7);
      const a = PR.int(3, 9);
      let c = PR.int(1, 6); if (c === a) c += 1;
      const b = PR.nz(-8, 8);
      const d = (a - c) * x0 + b;
      return {
        question: `\\text{Solve } ${a}x ${PR.s(b)} = ${c}x ${PR.s(d)}`,
        steps: [
          `${a}x - ${c}x = ${d} ${PR.s(-b)}`,
          `${a - c}x = ${d - b}`,
          `x = \\frac{${d - b}}{${a - c}} = ${x0}`,
        ],
        answer: `x = ${x0}`,
      };
    },
  },
  {
    id: 'quad-factorise', topic: 'Quadratics', keywords: ['quadratic', 'factorise', 'factoring', 'roots'],
    generate() {
      const p = PR.nz(-7, 7);
      let q = PR.nz(-7, 7); if (q === p) q = p + PR.choice([1, 2]);
      const B = p + q; const C = p * q;
      const bTxt = B === 0 ? '' : ` ${PR.s(B)}x`.replace('+ 1x', '+ x').replace('- 1x', '- x');
      return {
        question: `\\text{Solve by factorising: } x^2${bTxt} ${PR.s(C)} = 0`,
        steps: [
          `\\text{Find two numbers with product } ${C} \\text{ and sum } ${B}: \\ ${p} \\text{ and } ${q}`,
          `(x ${PR.s(p)})(x ${PR.s(q)}) = 0`,
          `x ${PR.s(p)} = 0 \\ \\text{or} \\ x ${PR.s(q)} = 0`,
          `x = ${-p} \\ \\text{or} \\ x = ${-q}`,
        ],
        answer: `x = ${-p}, \\ x = ${-q}`,
      };
    },
  },
  {
    id: 'quad-formula', topic: 'Quadratics', keywords: ['quadratic', 'formula', 'discriminant'],
    generate() {
      const a = PR.int(1, 3);
      const b = PR.nz(-8, 8);
      let c = PR.int(-6, 6);
      let disc = b * b - 4 * a * c;
      if (disc <= 0) { c = -Math.abs(c) - 1; disc = b * b - 4 * a * c; }
      const r1 = PR.r((-b + Math.sqrt(disc)) / (2 * a));
      const r2 = PR.r((-b - Math.sqrt(disc)) / (2 * a));
      return {
        question: `\\text{Solve using the quadratic formula: } ${a === 1 ? '' : a}x^2 ${PR.s(b)}x ${PR.s(c)} = 0`,
        steps: [
          `a = ${a}, \\ b = ${b}, \\ c = ${c}`,
          `\\Delta = b^2 - 4ac = ${PR.par(b)}^2 - 4${PR.par(a)}${PR.par(c)} = ${disc}`,
          `x = \\frac{-b \\pm \\sqrt{\\Delta}}{2a} = \\frac{${-b} \\pm \\sqrt{${disc}}}{${2 * a}}`,
          `x \\approx ${r1} \\ \\text{or} \\ x \\approx ${r2}`,
        ],
        answer: `x = \\frac{${-b} \\pm \\sqrt{${disc}}}{${2 * a}} \\approx ${r1}, \\ ${r2}`,
      };
    },
  },
  {
    id: 'expand-binomial', topic: 'Expanding', keywords: ['expand', 'binomial', 'brackets', 'foil'],
    generate() {
      const a = PR.int(1, 4); const b = PR.nz(-6, 6);
      const c = PR.int(1, 4); const d = PR.nz(-6, 6);
      const A = a * c; const B = a * d + b * c; const C = b * d;
      return {
        question: `\\text{Expand } (${a === 1 ? '' : a}x ${PR.s(b)})(${c === 1 ? '' : c}x ${PR.s(d)})`,
        steps: [
          `${a}x \\cdot ${c}x = ${A}x^2`,
          `${a}x \\cdot ${PR.par(d)} + ${PR.par(b)} \\cdot ${c}x = ${B}x`,
          `${PR.par(b)} \\cdot ${PR.par(d)} = ${C}`,
          `${A}x^2 ${PR.s(B)}x ${PR.s(C)}`,
        ],
        answer: `${A}x^2 ${PR.s(B)}x ${PR.s(C)}`,
      };
    },
  },
  {
    id: 'complete-square', topic: 'Quadratics', keywords: ['completing the square', 'vertex'],
    generate() {
      const h = PR.nz(-6, 6);
      const b = 2 * h;
      const c = PR.int(-8, 8);
      const k = c - h * h;
      return {
        question: `\\text{Complete the square: } x^2 ${PR.s(b)}x ${PR.s(c)}`,
        steps: [
          `\\text{Half of } ${b} \\text{ is } ${h}`,
          `x^2 ${PR.s(b)}x = (x ${PR.s(h)})^2 - ${h * h}`,
          `(x ${PR.s(h)})^2 - ${h * h} ${PR.s(c)} = (x ${PR.s(h)})^2 ${PR.s(k)}`,
        ],
        answer: `(x ${PR.s(h)})^2 ${PR.s(k)}`,
      };
    },
  },
  {
    id: 'alg-fraction', topic: 'Algebraic fractions', keywords: ['fraction', 'simplify', 'cancel'],
    generate() {
      const p = PR.int(1, 7);
      let q = PR.nz(-7, 7); if (q === p) q += 1;
      const B = p + q; const C = p * q;
      return {
        question: `\\text{Simplify } \\frac{x^2 ${PR.s(B)}x ${PR.s(C)}}{x ${PR.s(p)}}`,
        steps: [
          `\\text{Factorise the numerator: } x^2 ${PR.s(B)}x ${PR.s(C)} = (x ${PR.s(p)})(x ${PR.s(q)})`,
          `\\frac{(x ${PR.s(p)})(x ${PR.s(q)})}{x ${PR.s(p)}}`,
          `\\text{Cancel } (x ${PR.s(p)}): \\quad x ${PR.s(q)}, \\ x \\ne ${-p}`,
        ],
        answer: `x ${PR.s(q)}`,
      };
    },
  },
  {
    id: 'indices', topic: 'Indices', keywords: ['indices', 'exponent', 'power', 'index laws'],
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
      };
    },
  },
  {
    id: 'solve-exp', topic: 'Exponentials & logs', keywords: ['exponential', 'solve', 'logarithm'],
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
      };
    },
  },
  {
    id: 'log-laws', topic: 'Exponentials & logs', keywords: ['log', 'logarithm', 'laws'],
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
      };
    },
  },
  {
    id: 'complex-modarg', topic: 'Complex numbers', keywords: ['complex', 'modulus', 'argument'],
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
      };
    },
  },
  {
    id: 'complex-product', topic: 'Complex numbers', keywords: ['complex', 'multiply', 'product'],
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
      };
    },
  },
  {
    id: 'demoivre', topic: 'Complex numbers', keywords: ['de moivre', 'polar', 'power'],
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
      };
    },
  },
  {
    id: 'trig-solve', topic: 'Trigonometry', keywords: ['trig', 'solve', 'sin', 'equation'],
    generate() {
      const opts = [
        { k: '\\tfrac{1}{2}', ref: 30 },
        { k: '\\tfrac{\\sqrt{2}}{2}', ref: 45 },
        { k: '\\tfrac{\\sqrt{3}}{2}', ref: 60 },
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
      };
    },
  },
  {
    id: 'cosine-rule', topic: 'Trigonometry', keywords: ['cosine rule', 'triangle', 'side'],
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
      };
    },
  },
  {
    id: 'exact-value', topic: 'Trigonometry', keywords: ['exact value', 'compound angle'],
    generate() {
      const pairs = [[60, 30], [45, 45], [30, 60]];
      const [A, B] = PR.choice(pairs);
      return {
        question: `\\text{Find the exact value of } \\sin ${A}^\\circ \\cos ${B}^\\circ + \\cos ${A}^\\circ \\sin ${B}^\\circ`,
        steps: [
          `\\text{This is the compound-angle expansion of } \\sin(A + B)`,
          `\\sin(${A}^\\circ + ${B}^\\circ) = \\sin ${A + B}^\\circ`,
          `\\sin ${A + B}^\\circ = ${A + B === 90 ? '1' : '\\tfrac{\\sqrt{3}}{2}'}`,
        ],
        answer: `${A + B === 90 ? '1' : '\\tfrac{\\sqrt{3}}{2}'}`,
      };
    },
  },
  {
    id: 'diff-poly', topic: 'Differentiation', keywords: ['differentiate', 'derivative', 'polynomial'],
    generate() {
      const a = PR.nz(-5, 6); const n = PR.int(3, 5);
      const b = PR.nz(-6, 6); const c = PR.nz(-9, 9);
      return {
        question: `\\text{Differentiate } f(x) = ${a}x^{${n}} ${PR.s(b)}x^2 ${PR.s(c)}x`,
        steps: [
          `\\frac{d}{dx}${PR.par(a)}x^{${n}} = ${a * n}x^{${n - 1}}`,
          `\\frac{d}{dx}${PR.par(b)}x^2 = ${2 * b}x, \\quad \\frac{d}{dx}${PR.par(c)}x = ${c}`,
          `f'(x) = ${a * n}x^{${n - 1}} ${PR.s(2 * b)}x ${PR.s(c)}`,
        ],
        answer: `f'(x) = ${a * n}x^{${n - 1}} ${PR.s(2 * b)}x ${PR.s(c)}`,
      };
    },
  },
  {
    id: 'diff-chain', topic: 'Differentiation', keywords: ['chain rule', 'composite'],
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
      };
    },
  },
  {
    id: 'int-poly', topic: 'Integration', keywords: ['integrate', 'antiderivative', 'indefinite'],
    generate() {
      const n = PR.int(2, 5); const k = (n + 1) * PR.int(1, 3); const b = PR.nz(-7, 7);
      return {
        question: `\\text{Find } \\int \\left(${k}x^{${n}} ${PR.s(b)}\\right) dx`,
        steps: [
          `\\int ${k}x^{${n}}\\,dx = \\frac{${k}}{${n + 1}}x^{${n + 1}} = ${k / (n + 1)}x^{${n + 1}}`,
          `\\int ${PR.par(b)}\\,dx = ${b}x`,
          `${k / (n + 1)}x^{${n + 1}} ${PR.s(b)}x + C`,
        ],
        answer: `${k / (n + 1)}x^{${n + 1}} ${PR.s(b)}x + C`,
      };
    },
  },
  {
    id: 'int-definite', topic: 'Integration', keywords: ['definite integral', 'evaluate', 'area'],
    generate() {
      const b = PR.int(2, 5); const p = PR.int(0, 2); const q = p + PR.int(2, 4);
      const F = (x) => x * x + b * x;
      return {
        question: `\\text{Evaluate } \\int_{${p}}^{${q}} (2x ${PR.s(b)})\\,dx`,
        steps: [
          `\\int (2x ${PR.s(b)})\\,dx = x^2 ${PR.s(b)}x`,
          `\\left[x^2 ${PR.s(b)}x\\right]_{${p}}^{${q}} = (${q}^2 ${PR.s(b)} \\times ${q}) - (${p}^2 ${PR.s(b)} \\times ${p})`,
          `= ${F(q)} - ${F(p)} = ${F(q) - F(p)}`,
        ],
        answer: `${F(q) - F(p)}`,
      };
    },
  },
  {
    id: 'seq-arith', topic: 'Sequences & series', keywords: ['arithmetic', 'sequence', 'nth term'],
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
      };
    },
  },
  {
    id: 'seq-geo', topic: 'Sequences & series', keywords: ['geometric', 'series', 'sum'],
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
      };
    },
  },
  {
    id: 'vector-dot', topic: 'Vectors', keywords: ['vector', 'dot product', 'angle'],
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
      };
    },
  },
  {
    id: 'matrix-det-inv', topic: 'Matrices', keywords: ['matrix', 'determinant', 'inverse'],
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
    id: 'stats-mean-sd', topic: 'Statistics', keywords: ['mean', 'standard deviation', 'data'],
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
      };
    },
  },
  {
    id: 'binom-prob', topic: 'Statistics', keywords: ['binomial', 'probability', 'combinations'],
    generate() {
      const n = PR.int(4, 6); const k = PR.int(1, n - 1);
      const p = PR.choice([0.5, 0.2, 0.3]);
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
      };
    },
  },
];

// Match templates to a free-text topic (the tutor keeps Current Topic updated).
function practiceTemplatesFor(topicText) {
  const t = String(topicText || '').toLowerCase();
  if (!t) return PRACTICE;
  const matched = PRACTICE.filter(
    (p) => p.topic.toLowerCase().split(/\W+/).some((w) => w && t.includes(w)) ||
      p.keywords.some((k) => t.includes(k) || k.includes(t))
  );
  return matched.length ? matched : PRACTICE;
}
