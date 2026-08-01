// The skill graph — shared by the PC and Android apps.
//
// Proficiency is tracked per SKILL, not per topic and not per question template.
// A topic ("Trigonometry") is too coarse to act on: one bar would average
// cosine-rule arithmetic with compound-angle identities. A template id is too
// fine and too unstable — it's an implementation detail, and splitting a
// generator later would orphan the history. A skill is the thing a student
// actually says out loud ("I'm bad at the chain rule"), it's the granularity
// prerequisites are expressed at, and one skill spanning several templates lets
// the app rotate question shapes so they can't be memorised.
//
// `level`: 1 = HSC Advanced core · 2 = Extension · 3 = first-year engineering.
// `prereqs` are SOFT — they order the recommendations and explain them; they
// never lock a topic away.

const AREAS = [
  { id: 'algebra', name: 'Algebra', order: 1 },
  { id: 'functions', name: 'Functions & coordinate geometry', order: 2 },
  { id: 'trig', name: 'Trigonometry', order: 3 },
  { id: 'calculus', name: 'Calculus', order: 4 },
  { id: 'de', name: 'Differential equations', order: 5 },
  { id: 'series', name: 'Sequences & series', order: 6 },
  { id: 'linalg', name: 'Vectors & matrices', order: 7 },
  { id: 'complex', name: 'Complex numbers', order: 8 },
  { id: 'stats', name: 'Statistics & probability', order: 9 },
  { id: 'notation', name: 'Notation & symbols', order: 10 },
];

const SKILLS = [
  // ---- Algebra ----------------------------------------------------------------
  { id: 'linear-equations', area: 'algebra', level: 1, name: 'Linear equations', prereqs: [],
    blurb: 'Solve for x, including terms on both sides.',
    aliases: ['linear equation', 'linear', 'solve for x', 'both sides'] },
  { id: 'indices-surds', area: 'algebra', level: 1, name: 'Indices & surds', prereqs: [],
    blurb: 'Index laws, negative and fractional powers.',
    aliases: ['indices', 'index law', 'exponent', 'surd', 'powers'] },
  { id: 'expand-factorise', area: 'algebra', level: 1, name: 'Expanding & factorising', prereqs: [],
    blurb: 'Expand brackets and factorise back.',
    aliases: ['expand', 'expanding', 'factorise', 'factoring', 'binomial product'] },
  { id: 'quadratics', area: 'algebra', level: 1, name: 'Quadratics', prereqs: ['expand-factorise'],
    blurb: 'Solve, factorise and complete the square.',
    aliases: ['quadratic', 'parabola roots', 'completing the square', 'discriminant', 'quadratic formula'] },
  { id: 'algebraic-fractions', area: 'algebra', level: 1, name: 'Algebraic fractions', prereqs: ['expand-factorise'],
    blurb: 'Simplify fractions with algebra on top and bottom.',
    aliases: ['algebraic fraction', 'simplify fraction'] },
  { id: 'rational-expressions', area: 'algebra', level: 2, name: 'Rational expressions',
    prereqs: ['algebraic-fractions', 'quadratics'],
    blurb: 'Multiply, divide and add rational expressions.',
    aliases: ['rational expression', 'rational', 'compound fraction', 'complex fraction'] },
  { id: 'partial-fractions', area: 'algebra', level: 3, name: 'Partial fractions', prereqs: ['rational-expressions'],
    blurb: 'Split a rational function into simpler pieces.',
    aliases: ['partial fraction', 'decompose', 'decomposing', 'cover-up'] },
  { id: 'logs-exponentials', area: 'algebra', level: 1, name: 'Logs & exponentials', prereqs: ['indices-surds'],
    blurb: 'Log laws and solving exponential equations.',
    aliases: ['logarithm', 'log law', 'exponential equation', 'natural log'] },
  { id: 'polynomials', area: 'algebra', level: 2, name: 'Polynomials', prereqs: ['quadratics'],
    blurb: 'Division, remainder and factor theorems.',
    aliases: ['polynomial', 'remainder theorem', 'factor theorem'] },
  { id: 'inequalities', area: 'algebra', level: 2, name: 'Inequalities', prereqs: ['linear-equations', 'quadratics'],
    blurb: 'Solve and sketch inequalities.', aliases: ['inequality', 'inequalities'] },

  // ---- Functions & coordinate geometry -----------------------------------------
  { id: 'coordinate-geometry', area: 'functions', level: 1, name: 'Coordinate geometry',
    prereqs: ['linear-equations'],
    blurb: 'Distance, midpoint, gradient and the equation of a line.',
    aliases: ['coordinate geometry', 'gradient', 'midpoint', 'distance formula', 'straight line'] },
  { id: 'circles-loci', area: 'functions', level: 2, name: 'Circles & loci',
    prereqs: ['coordinate-geometry', 'quadratics'],
    blurb: 'Centre and radius from the general form.', aliases: ['circle', 'locus', 'loci'] },
  { id: 'conics', area: 'functions', level: 3, name: 'Conic sections', prereqs: ['circles-loci'],
    blurb: 'Parabola, ellipse and hyperbola.',
    aliases: ['conic', 'ellipse', 'hyperbola', 'focus', 'directrix', 'eccentricity'] },
  { id: 'function-transformations', area: 'functions', level: 1, name: 'Transformations', prereqs: ['quadratics'],
    blurb: 'Shifts, stretches and reflections of a graph.',
    aliases: ['transformation', 'translate graph', 'stretch', 'reflection'] },
  { id: 'inverse-composite', area: 'functions', level: 2, name: 'Inverse & composite functions',
    prereqs: ['function-transformations'],
    blurb: 'f(g(x)), inverses, domain and range.',
    aliases: ['inverse function', 'composite function', 'domain', 'range'] },
  { id: 'curve-sketching', area: 'functions', level: 2, name: 'Curve sketching',
    prereqs: ['rational-expressions', 'function-transformations'],
    blurb: 'Asymptotes, intercepts and shape.', aliases: ['curve sketch', 'asymptote', 'sketch the graph'] },

  // ---- Trigonometry -------------------------------------------------------------
  { id: 'trig-ratios', area: 'trig', level: 1, name: 'Trig ratios & rules', prereqs: ['linear-equations'],
    blurb: 'SOHCAHTOA, sine rule, cosine rule, area.',
    aliases: ['trig ratio', 'sohcahtoa', 'sine rule', 'cosine rule', 'triangle area'] },
  { id: 'radians-arcs', area: 'trig', level: 1, name: 'Radians, arcs & sectors', prereqs: ['trig-ratios'],
    blurb: 'Arc length, sector and segment area.',
    aliases: ['radian', 'arc length', 'sector', 'segment'] },
  { id: 'trig-graphs', area: 'trig', level: 1, name: 'Trig graphs',
    prereqs: ['radians-arcs', 'function-transformations'],
    blurb: 'Amplitude, period and phase shift.',
    aliases: ['trig graph', 'amplitude', 'period', 'phase shift'] },
  { id: 'trig-identities', area: 'trig', level: 2, name: 'Trig identities', prereqs: ['trig-ratios'],
    blurb: 'Pythagorean, double-angle and compound-angle.',
    aliases: ['trig identity', 'identities', 'double angle', 'compound angle', 'pythagorean identity'] },
  { id: 'trig-equations', area: 'trig', level: 2, name: 'Trig equations',
    prereqs: ['trig-identities', 'trig-graphs'],
    blurb: 'Solve over a domain, with general solutions.',
    aliases: ['trig equation', 'solve trig', 'general solution', 'exact value'] },
  { id: 'trig-modelling', area: 'trig', level: 3, name: 'Harmonic form & modelling', prereqs: ['trig-identities'],
    blurb: 'a sin x + b cos x as a single wave.',
    aliases: ['harmonic form', 'auxiliary angle', 'trig modelling'] },

  // ---- Calculus -----------------------------------------------------------------
  { id: 'limits-continuity', area: 'calculus', level: 2, name: 'Limits & first principles',
    prereqs: ['function-transformations'],
    blurb: 'Limits, continuity and the derivative from scratch.',
    aliases: ['limit', 'first principles', 'continuity'] },
  { id: 'differentiation', area: 'calculus', level: 1, name: 'Differentiation basics',
    prereqs: ['limits-continuity', 'indices-surds'],
    blurb: 'Differentiate powers of x.',
    aliases: ['differentiate', 'derivative', 'differentiation'] },
  { id: 'diff-rules', area: 'calculus', level: 1, name: 'Product, quotient & chain rules',
    prereqs: ['differentiation'],
    blurb: 'The three rules for combining functions.',
    aliases: ['chain rule', 'product rule', 'quotient rule'] },
  { id: 'diff-transcendental', area: 'calculus', level: 2, name: 'Differentiating e, ln & trig',
    prereqs: ['diff-rules', 'logs-exponentials', 'trig-graphs'],
    blurb: 'Derivatives of exponential, log and trig functions.',
    aliases: ['differentiate exponential', 'differentiate log', 'differentiate trig'] },
  { id: 'implicit-related-rates', area: 'calculus', level: 3, name: 'Implicit & related rates',
    prereqs: ['diff-rules'],
    blurb: 'Differentiate implicitly and link changing quantities.',
    aliases: ['implicit differentiation', 'related rates'] },
  { id: 'curve-analysis', area: 'calculus', level: 1, name: 'Stationary points & optimisation',
    prereqs: ['diff-rules', 'curve-sketching'],
    blurb: 'Find, classify and use turning points.',
    aliases: ['stationary point', 'turning point', 'maximum', 'minimum', 'optimisation', 'second derivative'] },
  { id: 'integration', area: 'calculus', level: 1, name: 'Integration basics', prereqs: ['differentiation'],
    blurb: 'Indefinite and definite integrals of powers.',
    aliases: ['integrate', 'integral', 'integration', 'antiderivative'] },
  { id: 'int-techniques', area: 'calculus', level: 3, name: 'Integration techniques',
    prereqs: ['integration', 'partial-fractions', 'trig-identities'],
    blurb: 'Substitution and integration by parts.',
    aliases: ['substitution', 'by parts', 'integration technique'] },
  { id: 'int-applications', area: 'calculus', level: 2, name: 'Areas & volumes',
    prereqs: ['integration'],
    blurb: 'Area between curves and volumes of revolution.',
    aliases: ['area between curves', 'volume of revolution', 'solid of revolution'] },
  { id: 'numerical-methods', area: 'calculus', level: 3, name: 'Numerical methods',
    prereqs: ['integration'],
    blurb: 'Trapezoidal rule, Simpson’s rule, Newton’s method.',
    aliases: ['trapezoidal', 'simpson', 'newton raphson', 'numerical method', 'bisection'] },

  // ---- Differential equations ----------------------------------------------------
  { id: 'de-basics', area: 'de', level: 3, name: 'DE basics', prereqs: ['integration'],
    blurb: 'Order, degree, and verifying a solution.',
    aliases: ['differential equation', 'order and degree'] },
  { id: 'de-separable', area: 'de', level: 3, name: 'Separable equations', prereqs: ['integration'],
    blurb: 'Separate the variables and integrate both sides.',
    aliases: ['separable', 'separation of variables'] },
  { id: 'de-linear-first', area: 'de', level: 3, name: 'Integrating factor',
    prereqs: ['de-separable', 'int-techniques'],
    blurb: 'First-order linear equations.',
    aliases: ['integrating factor', 'first order linear'] },
  { id: 'de-second-order', area: 'de', level: 3, name: 'Second-order (auxiliary equation)',
    prereqs: ['quadratics', 'de-linear-first'],
    blurb: 'Constant-coefficient homogeneous equations.',
    aliases: ['auxiliary equation', 'second order', 'characteristic equation', 'homogeneous'] },
  { id: 'de-particular', area: 'de', level: 3, name: 'Particular integrals', prereqs: ['de-second-order'],
    blurb: 'Undetermined coefficients for a non-zero right side.',
    aliases: ['particular integral', 'undetermined coefficients'] },
  { id: 'de-applications', area: 'de', level: 3, name: 'Growth, decay & circuits',
    prereqs: ['de-separable', 'logs-exponentials'],
    blurb: 'Exponential models, cooling, RC circuits.',
    aliases: ['exponential growth', 'decay', 'half life', 'newton cooling', 'rc circuit'] },

  // ---- Sequences & series ---------------------------------------------------------
  { id: 'sequences-series', area: 'series', level: 1, name: 'Sequences & series', prereqs: [],
    blurb: 'Arithmetic and geometric progressions.',
    aliases: ['sequence', 'series', 'arithmetic', 'geometric', 'progression', 'sigma'] },
  { id: 'series-taylor', area: 'series', level: 3, name: 'Taylor & Maclaurin',
    prereqs: ['diff-transcendental', 'sequences-series'],
    blurb: 'Power-series expansions.', aliases: ['taylor', 'maclaurin', 'power series'] },

  // ---- Vectors & matrices ----------------------------------------------------------
  { id: 'vectors', area: 'linalg', level: 2, name: 'Vectors',
    prereqs: ['coordinate-geometry', 'trig-ratios'],
    blurb: 'Magnitude, dot product and the angle between.',
    aliases: ['vector', 'dot product', 'cross product', 'magnitude', 'unit vector'] },
  { id: 'matrices', area: 'linalg', level: 3, name: 'Matrices', prereqs: ['linear-equations'],
    blurb: 'Determinant, inverse and solving systems.',
    aliases: ['matrix', 'matrices', 'determinant', 'inverse matrix'] },

  // ---- Complex numbers --------------------------------------------------------------
  { id: 'complex-numbers', area: 'complex', level: 2, name: 'Complex numbers',
    prereqs: ['quadratics', 'trig-ratios'],
    blurb: 'Arithmetic, modulus and argument.',
    aliases: ['complex number', 'imaginary', 'modulus', 'argument', 'argand'] },
  { id: 'complex-polar', area: 'complex', level: 3, name: 'Polar form & De Moivre',
    prereqs: ['complex-numbers', 'trig-identities'],
    blurb: 'Powers and roots in polar form.',
    aliases: ['de moivre', 'polar form', 'cis', 'roots of unity'] },

  // ---- Statistics & probability -------------------------------------------------------
  { id: 'statistics', area: 'stats', level: 1, name: 'Summary statistics', prereqs: [],
    blurb: 'Mean, standard deviation and spread.',
    aliases: ['mean', 'standard deviation', 'statistics', 'variance', 'median'] },
  { id: 'probability', area: 'stats', level: 1, name: 'Probability', prereqs: [],
    blurb: 'Combined events, conditional probability, trees.',
    aliases: ['probability', 'conditional', 'tree diagram'] },
  { id: 'distributions', area: 'stats', level: 2, name: 'Distributions', prereqs: ['probability'],
    blurb: 'Binomial and normal distributions.',
    aliases: ['binomial', 'normal distribution', 'z score', 'distribution'] },
];

// ---- Lookups -------------------------------------------------------------------------

const SKILL_BY_ID = Object.fromEntries(SKILLS.map((s) => [s.id, s]));
const AREA_BY_ID = Object.fromEntries(AREAS.map((a) => [a.id, a]));

/** Skills belonging to an area, in declaration order. */
function skillsInArea(areaId) {
  return SKILLS.filter((s) => s.area === areaId);
}

/**
 * Resolve free text to a skill id, or null.
 *
 * The tutor writes free text into `currentTopic` (default "partial fraction
 * decomposition"), so this has to cope with prose. Aliases are matched
 * longest-first so "partial fraction" wins over "fraction", and the old
 * bidirectional substring test is gone — it made a query of "rational" return
 * seven templates spread across three different topics.
 */
function resolveSkill(freeText) {
  const t = String(freeText || '').toLowerCase().trim();
  if (!t) return null;
  let best = null;
  let bestLen = 0;
  for (const skill of SKILLS) {
    const candidates = [skill.name.toLowerCase(), ...skill.aliases];
    for (const c of candidates) {
      if (c.length > bestLen && t.includes(c)) {
        best = skill.id;
        bestLen = c.length;
      }
    }
  }
  return best;
}

/** The skill a template belongs to; falls back so an unlabelled template still records. */
function skillOf(template) {
  if (template.skill) return template.skill;
  return 'topic:' + String(template.topic || 'other').toLowerCase().replace(/\W+/g, '-');
}

/** Prerequisite chain, deepest first — the "learning path" shown on the progress screen. */
function prereqChain(skillId, seen = new Set()) {
  const skill = SKILL_BY_ID[skillId];
  if (!skill || seen.has(skillId)) return [];
  seen.add(skillId);
  const out = [];
  for (const p of skill.prereqs) {
    for (const deep of prereqChain(p, seen)) if (!out.includes(deep)) out.push(deep);
    if (!out.includes(p)) out.push(p);
  }
  return out;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    AREAS, SKILLS, SKILL_BY_ID, AREA_BY_ID, skillsInArea, resolveSkill, skillOf, prereqChain,
  };
}
