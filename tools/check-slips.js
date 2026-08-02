#!/usr/bin/env node
/**
 * The "your most common slips" fold.
 *
 * Two namespaces meet in one `miss` field — MISCONCEPTIONS keys from practice,
 * and `sym:` keys from the symbol quiz — and the symbol ones only make sense
 * paired with the `tmpl` that says which symbol was actually meant. The failure
 * to guard against is a raw key reaching the screen: "you keep disc-sgn" is worse
 * than saying nothing, which is why slipLabel returns null rather than guessing.
 *
 *   node tools/check-slips.js
 */
const path = require('path');
const vm = require('vm');
const { readFileSync } = require('fs');

const R = path.resolve(__dirname, '..', 'VoiceMathTutorPC', 'renderer');
// Same trick model.mjs uses: these files share one global scope in the browser,
// and topSlips reaches for MISCONCEPTIONS and SYMBOL_BY_ID the way the page does.
const ctx = { module: undefined, window: undefined, console };
vm.createContext(ctx);
const load = (f, expr) =>
  vm.runInContext(`${readFileSync(`${R}/${f}`, 'utf8')}\n;globalThis.__x=${expr};`, ctx);

load('practice-skills.js', '{SKILLS}');
load('practice-data.js', '{MISCONCEPTIONS}');
const { MISCONCEPTIONS } = ctx.__x;
load('symbols-data.js', '{SYMBOL_BY_ID}');
const { SYMBOL_BY_ID } = ctx.__x;
load('practice-prof.js', '{topSlips,slipLabel,computeProficiency}');
const P = ctx.__x;

let fail = 0;
const ok = (label, cond, extra) => {
  if (!cond) fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${label}${extra != null ? ' :: ' + extra : ''}`);
};

const now = Date.UTC(2026, 7, 2);
const DAY = 86400000;
const at = (miss, opts) => ({
  t: now - ((opts && opts.daysAgo) || 0) * DAY,
  skill: (opts && opts.skill) || 'quadratics',
  tmpl: (opts && opts.tmpl) || null,
  score: (opts && opts.score) != null ? opts.score : 0,
  mode: 'mcq', k: 4, miss,
});
const log = (attempts) => ({ version: 1, attempts });
const slips = (attempts, opts) => P.topSlips(log(attempts), { now, ...(opts || {}) });

// ---- the empty and near-empty cases --------------------------------------------------
ok('an empty log yields nothing', slips([]).length === 0);
ok('a log with no misses yields nothing',
  slips([at(null, { score: 1 }), at(null, { score: 1 })]).length === 0);
ok('one slip is noise, not a pattern', slips([at('disc-sign')]).length === 0);
ok('two of the same slip is a pattern', slips([at('disc-sign'), at('disc-sign')]).length === 1);

// ---- a miss on a CORRECT answer must not count ---------------------------------------
ok('a miss recorded against a right answer is ignored',
  slips([at('disc-sign', { score: 1 }), at('disc-sign', { score: 1 })]).length === 0);

// ---- recency -------------------------------------------------------------------------
ok('slips outside the window are dropped',
  slips([at('disc-sign', { daysAgo: 200 }), at('disc-sign', { daysAgo: 200 })]).length === 0);
ok('  ...and inside it are kept',
  slips([at('disc-sign', { daysAgo: 3 }), at('disc-sign', { daysAgo: 3 })]).length === 1);

// ---- ranking and the limit -----------------------------------------------------------
{
  const many = [
    ...Array(5).fill(0).map(() => at('disc-sign')),
    ...Array(4).fill(0).map(() => at('move-sign')),
    ...Array(3).fill(0).map(() => at('no-divide')),
    ...Array(2).fill(0).map(() => at('cross-term')),
  ];
  const top = slips(many);
  ok('the top three come back, commonest first', top.length === 3,
    top.map((s) => `${s.why} ${s.count}`).join(' · '));
  ok('  ...in descending order',
    top[0].count === 5 && top[1].count === 4 && top[2].count === 3);
  ok('  ...each with a readable label and hint',
    top.every((s) => s.label && s.hint && !/[a-z]+-[a-z]+/.test(s.label.split(' ')[0])),
    top.map((s) => s.label).join(' | '));
}

// ---- an unknown key must NOT reach the screen ----------------------------------------
ok('an unresolvable misconception key is dropped, not shown raw',
  slips([at('not-a-real-key'), at('not-a-real-key')]).length === 0);
ok('  ...and slipLabel returns null for it', P.slipLabel('not-a-real-key', null) === null);
ok('  ...and for an unknown symbol id', P.slipLabel('sym:not-a-symbol', 'integral') === null);

// ---- symbol confusions ---------------------------------------------------------------
{
  const pair = [
    at('sym:contour-integral', { skill: 'sym-calculus', tmpl: 'integral' }),
    at('sym:contour-integral', { skill: 'sym-calculus', tmpl: 'integral' }),
  ];
  const [s] = slips(pair);
  ok('a symbol confusion is named as a pair', !!s && /Integral/.test(s.label) && /Closed integral/.test(s.label),
    s && s.label);
  ok('  ...and the hint gives both spoken forms',
    !!s && /said/.test(s.hint) && s.hint.split('said').length === 3, s && s.hint);
  ok('  ...and it is attributed to the sym-* skill',
    !!s && s.skills.length === 1 && s.skills[0] === 'sym-calculus');
}
{
  // The SAME wrong symbol picked for two DIFFERENT right ones is two slips, not
  // one — "reading ∫ as ∮" and "reading ∬ as ∮" are different mistakes.
  const mixed = [
    at('sym:contour-integral', { tmpl: 'integral' }),
    at('sym:contour-integral', { tmpl: 'integral' }),
    at('sym:contour-integral', { tmpl: 'double-integral' }),
    at('sym:contour-integral', { tmpl: 'double-integral' }),
  ];
  ok('the same wrong symbol against two right ones is two slips', slips(mixed).length === 2,
    slips(mixed).map((x) => x.label).join(' | '));
}

// ---- the two namespaces coexist ------------------------------------------------------
{
  const both = [
    at('disc-sign'), at('disc-sign'), at('disc-sign'),
    at('sym:contour-integral', { skill: 'sym-calculus', tmpl: 'integral' }),
    at('sym:contour-integral', { skill: 'sym-calculus', tmpl: 'integral' }),
  ];
  const top = slips(both);
  ok('practice and symbol slips rank together', top.length === 2,
    top.map((s) => `${s.label} ${s.count}`).join(' | '));
  ok('  ...with the practice one first, having more', top[0].why === 'disc-sign');
}

// ---- topMiss still works, and understands sym: ---------------------------------------
{
  const st = P.computeProficiency(log([
    at('sym:contour-integral', { skill: 'sym-calculus', tmpl: 'integral' }),
    at('sym:contour-integral', { skill: 'sym-calculus', tmpl: 'integral' }),
  ]), now);
  const s = st.skills['sym-calculus'];
  ok('computeProficiency tallies a sym: miss like any other', s && s.miss['sym:contour-integral'] === 2);
}

console.log(`\n${Object.keys(MISCONCEPTIONS).length} misconceptions, `
  + `${Object.keys(SYMBOL_BY_ID).length} symbols available to name a slip`);
console.log(fail ? `\n${fail} FAILURE(S)` : '\nALL PASS');
process.exit(fail ? 1 : 0);
