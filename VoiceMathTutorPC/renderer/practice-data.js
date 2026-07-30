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
        viz: { type: 'poly', coeffs: [b, a], extra: [{ coeffs: [c] }], mark: [x0, c] },
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
      };
    },
  },
  {
    id: 'quad-factorise', topic: 'Quadratics', keywords: ['quadratic', 'factorise', 'factoring', 'roots'],
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
        question: `\\text{Solve using the quadratic formula: } ${a === 1 ? '' : a}x^2${PR.xt(b)}${PR.ct(c)} = 0`,
        steps: [
          `a = ${a}, \\ b = ${b}, \\ c = ${c}`,
          `\\Delta = b^2 - 4ac = ${PR.par(b)}^2 - 4${PR.par(a)}${PR.par(c)} = ${disc}`,
          `x = \\frac{-b \\pm \\sqrt{\\Delta}}{2a} = \\frac{${-b} \\pm \\sqrt{${disc}}}{${2 * a}}`,
          `x \\approx ${r1} \\ \\text{or} \\ x \\approx ${r2}`,
        ],
        answer: `x = \\frac{${-b} \\pm \\sqrt{${disc}}}{${2 * a}} \\approx ${r1}, \\ ${r2}`,
        viz: { type: 'poly', coeffs: [c, b, a], roots: [r1, r2] },
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
          `${PR.lead(a)} \\cdot ${PR.lead(c)} = ${PR.lead(A, 'x^2')}`,
          `${PR.lead(a)} \\cdot ${PR.par(d)} + ${PR.par(b)} \\cdot ${PR.lead(c)} = ${B === 0 ? '0' : PR.lead(B)}`,
          `${PR.par(b)} \\cdot ${PR.par(d)} = ${C}`,
          `${PR.lead(A, 'x^2')}${PR.xt(B)}${PR.ct(C)}`,
        ],
        answer: `${PR.lead(A, 'x^2')}${PR.xt(B)}${PR.ct(C)}`,
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
        question: `\\text{Complete the square: } x^2${PR.xt(b)}${PR.ct(c)}`,
        steps: [
          `\\text{Half of } ${b} \\text{ is } ${h}`,
          `x^2${PR.xt(b)} = (x ${PR.s(h)})^2 - ${h * h}`,
          `(x ${PR.s(h)})^2 - ${h * h}${PR.ct(c)} = (x ${PR.s(h)})^2${PR.ct(k)}`,
        ],
        answer: `(x ${PR.s(h)})^2${PR.ct(k)}`,
        viz: { type: 'poly', coeffs: [c, b, 1], vertex: [-h, k] },
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
        question: `\\text{Simplify } \\frac{x^2${PR.xt(B)}${PR.ct(C)}}{x ${PR.s(p)}}`,
        steps: [
          `\\text{Factorise the numerator: } x^2${PR.xt(B)}${PR.ct(C)} = (x ${PR.s(p)})(x ${PR.s(q)})`,
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
        viz: { type: 'argand', points: [[A, B]], circle: m },
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
        viz: { type: 'argand', points: [[re, im]], circle: rn },
      };
    },
  },
  {
    id: 'trig-solve', topic: 'Trigonometry', keywords: ['trig', 'solve', 'sin', 'equation'],
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
        viz: { type: 'triangle', a, b, C },
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
        viz: { type: 'unitcircle', angles: [A, B, A + B] },
      };
    },
  },
  {
    id: 'diff-poly', topic: 'Differentiation', keywords: ['differentiate', 'derivative', 'polynomial'],
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
          `\\int ${k}x^{${n}}\\,dx = \\frac{${k}}{${n + 1}}x^{${n + 1}} = ${PR.lead(k / (n + 1), `x^{${n + 1}}`)}`,
          `\\int ${PR.par(b)}\\,dx = ${PR.lead(b)}`,
          `${PR.lead(k / (n + 1), `x^{${n + 1}}`)}${PR.xt(b)} + C`,
        ],
        answer: `${PR.lead(k / (n + 1), `x^{${n + 1}}`)}${PR.xt(b)} + C`,
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
        viz: { type: 'area', coeffs: [b, 2], a: p, b: q },
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
        viz: { type: 'bars', values: Array.from({ length: 8 }, (_, i) => a + i * d) },
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
        viz: { type: 'bars', values: Array.from({ length: 6 }, (_, i) => a * Math.pow(r, i)) },
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
        viz: { type: 'vectors', a: [a[0], a[1]], b: [b[0], b[1]] },
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
        viz: { type: 'dots', values: xs, mean: PR.r(mean, 3) },
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
      };
    },
  },

  // ---- Rational expressions ------------------------------------------------------
  {
    id: 'rational-simplify', topic: 'Rational expressions',
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
      };
    },
  },
  {
    id: 'rational-multiply', topic: 'Rational expressions',
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
      };
    },
  },
  {
    id: 'rational-add', topic: 'Rational expressions',
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
      };
    },
  },
  {
    id: 'rational-complex', topic: 'Complex rational expressions',
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
      };
    },
  },

  // ---- Decomposing expressions (partial fractions) --------------------------------
  {
    id: 'partial-distinct', topic: 'Decomposing expressions',
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
      };
    },
  },
  {
    id: 'partial-repeated', topic: 'Decomposing expressions',
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
      };
    },
  },
  {
    id: 'partial-quadratic', topic: 'Decomposing expressions',
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
      };
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
