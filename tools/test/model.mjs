// Phase 1: the mastery model behaves the way the UI claims it does.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const R = fileURLToPath(new URL('../../VoiceMathTutorPC/renderer/', import.meta.url));
const ctx = { console, module: undefined, window: undefined, Android: undefined };
vm.createContext(ctx);
const load = (f, exportsExpr) =>
  vm.runInContext(readFileSync(`${R}/${f}`, 'utf8') + `\n;globalThis.__x=${exportsExpr};`, ctx);

load('practice-skills.js', '{AREAS,SKILLS,SKILL_BY_ID,skillsInArea,resolveSkill,skillOf,prereqChain}');
const S = ctx.__x;
load('practice-data.js', '{PRACTICE,practiceTemplatesFor,templatesForSkill}');
const D = ctx.__x;
load('practice-prof.js',
  '{computeProficiency,recommend,dueForReview,attemptFrom,placementPlan,readinessOf,blankSkill,chanceAdjusted,SHAKY,SOLID}');
const P = ctx.__x;

let fail = 0;
const ok = (label, cond, extra) => {
  if (!cond) fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${label}${extra != null ? ' :: ' + extra : ''}`);
};
const DAY = 86400000;
const log = (attempts) => ({ version: 1, attempts });
const at = (skill, score, mode, daysAgo) => ({
  t: Date.now() - (daysAgo || 0) * DAY, skill, tmpl: null, score, mode: mode || 'self',
});

// ---- the update rule ------------------------------------------------------------
{
  const all = P.computeProficiency(log([at('quadratics', 1, 'mcq'), at('quadratics', 1, 'mcq')]));
  const s = all.skills.quadratics;
  ok('two right MCQ answers put a skill above the "solid" line', s.p > 0.60, s.p.toFixed(3));
  ok('  ...and n counts both', s.n === 2 && s.correct === 2 && s.streak === 2);
}
{
  const all = P.computeProficiency(log([at('quadratics', 0), at('quadratics', 0), at('quadratics', 0)]));
  ok('three misses read as shaky', all.skills.quadratics.p < 0.30, all.skills.quadratics.p.toFixed(3));
}
{
  // A bad patch must be recoverable without a reset button — alpha floors at 0.18.
  const bad = Array.from({ length: 10 }, () => at('quadratics', 0));
  const good = Array.from({ length: 8 }, () => at('quadratics', 1, 'mcq'));
  const all = P.computeProficiency(log([...bad, ...good]));
  ok('a skill recovers from a bad patch', all.skills.quadratics.p > 0.60,
    all.skills.quadratics.p.toFixed(3));
}
{
  const self = P.computeProficiency(log([at('quadratics', 1, 'self')])).skills.quadratics.p;
  const mcq = P.computeProficiency(log([at('quadratics', 1, 'mcq')])).skills.quadratics.p;
  ok('self-marking moves the bar less than MCQ', self < mcq, `${self.toFixed(2)} < ${mcq.toFixed(2)}`);
  const plc = P.computeProficiency(log([at('quadratics', 1, 'placement')])).skills.quadratics.p;
  ok('placement is weighted as self-marking (it is)', Math.abs(plc - self) < 1e-9);
}
{
  const p = P.computeProficiency(log([at('quadratics', 1, 'mcq')]));
  ok('one attempt is flagged not-confident', p.skills.quadratics.confident === false);
  const p3 = P.computeProficiency(log(Array.from({ length: 3 }, () => at('quadratics', 1, 'mcq'))));
  ok('three attempts is confident', p3.skills.quadratics.confident === true);
}

// ---- decay ----------------------------------------------------------------------
{
  const fresh = P.computeProficiency(log([at('quadratics', 1, 'mcq', 0)])).skills.quadratics;
  ok('a fresh attempt has full recall', fresh.recall > 0.99, fresh.recall.toFixed(3));
  // One right answer = streak 1 = a 4-day half-life, so 4 days out is ~0.5.
  const stale = P.computeProficiency(log([at('quadratics', 1, 'mcq', 4)])).skills.quadratics;
  ok('one right answer 4 days ago has decayed to ~half', Math.abs(stale.recall - 0.5) < 0.02,
    stale.recall.toFixed(3));
  const missed = P.computeProficiency(log([at('quadratics', 0, 'mcq', 2)])).skills.quadratics;
  ok('a miss buys no half-life extension (2-day)', Math.abs(missed.recall - 0.5) < 0.02,
    missed.recall.toFixed(3));
  // A long streak should buy a long half-life, or review nags every solid topic.
  const streak = Array.from({ length: 6 }, (_, i) => at('quadratics', 1, 'mcq', 3 + (6 - i)));
  const held = P.computeProficiency(log(streak)).skills.quadratics;
  ok('a 6-streak still reads well-retained 3 days later', held.recall > 0.9, held.recall.toFixed(3));
}

// ---- readiness + recommendations -------------------------------------------------
{
  const pool = S.SKILLS.filter((s) => D.templatesForSkill(s.id).length).map((s) => s.id);

  const cold = P.recommend(P.computeProficiency(log([])), pool, 3);
  ok('a cold start still recommends 3 things', cold.length === 3);
  ok('  ...and prefers skills with no prerequisites',
    cold.every((c) => P.readinessOf(c.skill.id, {}) === 1),
    cold.map((c) => c.skill.id).join(', '));
  console.log('     cold:', cold.map((c) => `${c.skill.name} — ${c.reason}`).join('\n           '));

  // Prereqs are SOFT: a locked-out skill must still be reachable, just lower.
  const noPrereq = P.recommend(P.computeProficiency(log([])), ['int-techniques'], 1);
  ok('a deep skill is never hidden outright', noPrereq.length === 1 && noPrereq[0].urgency > 0,
    noPrereq[0].urgency.toFixed(3));

  // Someone strong at algebra should be pushed onward, not back over quadratics.
  const strong = log([
    ...Array.from({ length: 5 }, () => at('expand-factorise', 1, 'mcq')),
    ...Array.from({ length: 5 }, () => at('quadratics', 1, 'mcq')),
    ...Array.from({ length: 4 }, () => at('differentiation', 0)),
  ]);
  const st = P.computeProficiency(strong);
  const top = P.recommend(st, pool, 3);
  ok('the weak skill outranks the mastered ones', top[0].skill.id === 'differentiation',
    top.map((t) => t.skill.id).join(', '));
  console.log('     warm:', top.map((c) => `${c.skill.name} — ${c.reason}`).join('\n           '));

  // Stale-but-learned should surface for review, and only then.
  const staleLog = log([
    ...Array.from({ length: 4 }, () => at('vectors', 1, 'mcq', 40)),
    ...Array.from({ length: 4 }, () => at('statistics', 1, 'mcq', 0)),
  ]);
  const due = P.dueForReview(P.computeProficiency(staleLog), pool, 5).map((d) => d.skill.id);
  ok('a 40-day-old skill is due for review', due.includes('vectors'), due.join(', '));
  ok('  ...and today\'s practice is not', !due.includes('statistics'), due.join(', '));
  const never = P.dueForReview(P.computeProficiency(log([])), pool, 5);
  ok('nothing is "due" before anything is learned', never.length === 0, String(never.length));
}

// ---- area rollup -----------------------------------------------------------------
{
  const st = P.computeProficiency(log([
    ...Array.from({ length: 4 }, () => at('quadratics', 1, 'mcq')),
    ...Array.from({ length: 4 }, () => at('linear-equations', 0)),
  ]));
  const a = st.areas.algebra;
  ok('an area averages its skills', a && a.p > 0.25 && a.p < 0.75, a && a.p.toFixed(3));
  ok('  ...and counts every attempt', a.n === 8, String(a.n));
  ok('an untouched area has no entry', !st.areas.complex);
  // One over-drilled skill must not swamp the area bar.
  const skew = P.computeProficiency(log([
    ...Array.from({ length: 60 }, () => at('quadratics', 1, 'mcq')),
    ...Array.from({ length: 4 }, () => at('linear-equations', 0)),
  ]));
  ok('60 attempts on one skill do not swamp the area', skew.areas.algebra.p < 0.85,
    skew.areas.algebra.p.toFixed(3));
}

// ---- placement -------------------------------------------------------------------
{
  const pool = S.SKILLS.filter((s) => D.templatesForSkill(s.id).length).map((s) => s.id);
  const plan = P.placementPlan(pool, 12);
  ok('placement picks 12 skills', plan.length === 12, String(plan.length));
  ok('  ...all distinct', new Set(plan).size === plan.length);
  ok('  ...all have questions', plan.every((id) => D.templatesForSkill(id).length),
    plan.filter((id) => !D.templatesForSkill(id).length).join(','));
  const areas = new Set(plan.map((id) => S.SKILL_BY_ID[id].area));
  const areasWithContent = new Set(pool.map((id) => S.SKILL_BY_ID[id].area));
  ok('  ...covering every area that has content', areas.size === areasWithContent.size,
    `${areas.size}/${areasWithContent.size}`);
  console.log('     plan:', plan.map((id) => S.SKILL_BY_ID[id].name).join(' · '));

  // A finished placement must actually produce a usable recommendation.
  const answers = plan.map((id, i) => at(id, i % 3 === 0 ? 0 : 1, 'placement'));
  const after = P.computeProficiency(log(answers));
  const rec = P.recommend(after, pool, 3);
  ok('after a placement, focus-next names the missed skills',
    rec.slice(0, 3).some((r) => answers.find((a) => a.skill === r.skill.id && a.score === 0)),
    rec.map((r) => r.skill.id).join(', '));
}

// ---- robustness ------------------------------------------------------------------
{
  ok('an empty log computes', P.computeProficiency(null).totals.attempts === 0);
  ok('junk attempts are skipped',
    P.computeProficiency(log([null, {}, { skill: '' }, at('quadratics', 1)])).totals.attempts === 4 &&
    Object.keys(P.computeProficiency(log([null, {}, { skill: '' }, at('quadratics', 1)])).skills).length === 1);
  ok('an unknown skill id does not break the area rollup',
    P.computeProficiency(log([at('made-up-skill', 1)])).skills['made-up-skill'].n === 1);
  const a = P.attemptFrom('quadratics', 'quad-solve', 5, 'mcq', 1234.7,
    { miss: 'disc-sign', flow: 'quiz', k: 4 });
  ok('attemptFrom clamps the score', a.score === 1, String(a.score));
  ok('  ...rounds ms and keeps miss', a.ms === 1235 && a.miss === 'disc-sign');
  ok('  ...records flow and option count', a.flow === 'quiz' && a.k === 4, JSON.stringify(a));
  const bare = P.attemptFrom('quadratics', null, 1, 'self', 10);
  ok('  ...and omits them when absent',
    !('miss' in bare) && !('flow' in bare) && !('k' in bare), JSON.stringify(bare));
  ok('  ...k of 1 is not recorded (not a choice)',
    !('k' in P.attemptFrom('q', null, 1, 'mcq', 1, { k: 1 })));
}

// ---- guessing correction ------------------------------------------------------------
{
  const mcq = (score, k, daysAgo) => ({
    t: Date.now() - (daysAgo || 0) * DAY, skill: 'quadratics', score, mode: 'mcq', k: k || 4,
  });
  ok('a right MCQ answer is still worth full marks', P.chanceAdjusted(mcq(1)) === 1);
  // Negative on purpose — see the comment on chanceAdjusted. Clamping here would
  // make the whole correction a no-op on binary scores.
  ok('a wrong one goes negative, not to zero',
    Math.abs(P.chanceAdjusted(mcq(0)) + 1 / 3) < 1e-9, String(P.chanceAdjusted(mcq(0))));
  ok('the raw guess rate maps to zero', Math.abs(P.chanceAdjusted(mcq(0.25))) < 1e-9);
  ok('a 2-option question discounts harder per wrong answer',
    P.chanceAdjusted(mcq(0, 2)) === -1, String(P.chanceAdjusted(mcq(0, 2))));
  ok('a bar never shows negative even after only wrong picks',
    P.computeProficiency(log([mcq(0), mcq(0), mcq(0)])).skills.quadratics.p === 0);
  ok('an attempt with no k is untouched',
    P.chanceAdjusted({ score: 0.25, mode: 'self' }) === 0.25);

  // A pure guesser on 4 options: right 1 time in 4.
  const guesser = Array.from({ length: 80 }, (_, i) => mcq(i % 4 === 0 ? 1 : 0));
  const g = P.computeProficiency(log(guesser)).skills.quadratics;
  ok('a pure guesser stays below the shaky line', g.p < P.SHAKY, g.p.toFixed(3));

  // Without the correction the same run would have looked like real ability.
  const uncorrected = guesser.map(({ k, ...rest }) => rest);
  const u = P.computeProficiency(log(uncorrected)).skills.quadratics;
  ok('  ...where uncorrected it read as competence', u.p > g.p && u.p > 0.15,
    `corrected ${g.p.toFixed(3)} vs raw ${u.p.toFixed(3)}`);

  // The case that motivated this: knows half outright, guesses the rest and so
  // gets a quarter of those — 62.5% right overall.
  //
  // alpha floors at 0.18, so a single run's final p is a noisy sample of an
  // oscillating average. Averaging independent randomised runs is the only
  // honest way to test a claim about where it CONVERGES.
  const settled = (withK) => {
    let total = 0;
    const runs = 300;
    for (let run = 0; run < runs; run++) {
      const attempts = Array.from({ length: 60 }, () => {
        const right = Math.random() < 0.5 ? 1 : (Math.random() < 0.25 ? 1 : 0);
        const a = mcq(right);
        if (!withK) delete a.k;
        return a;
      });
      total += P.computeProficiency(log(attempts)).skills.quadratics.p;
    }
    return total / runs;
  };
  const khRaw = settled(false);
  const kh = settled(true);
  ok('uncorrected, knowing half converges above SOLID', khRaw > P.SOLID, khRaw.toFixed(3));
  ok('  ...corrected, it settles around a half', Math.abs(kh - 0.5) < 0.08, kh.toFixed(3));
  ok('  ...i.e. below the solid line, which is the point', kh < P.SOLID,
    `${kh.toFixed(3)} < ${P.SOLID}`);

  ok('someone who actually knows it still reads solid on MCQ',
    P.computeProficiency(log(Array.from({ length: 6 }, () => mcq(1)))).skills.quadratics.p > 0.9);

  // Streaks describe what happened, so they must follow the raw score.
  const streaky = P.computeProficiency(log([mcq(1), mcq(1), mcq(1)])).skills.quadratics;
  ok('streak counts raw right answers, not adjusted ones',
    streaky.streak === 3 && streaky.correct === 3, `${streaky.streak}/${streaky.correct}`);
}

// ---- misconception log ---------------------------------------------------------------
{
  const miss = (score, why) => ({
    t: Date.now(), skill: 'quadratics', score, mode: 'mcq', k: 4, miss: why,
  });
  const st = P.computeProficiency(log([
    miss(0, 'disc-sign'), miss(0, 'disc-sign'), miss(0, 'sign-flip'), miss(1, 'disc-sign'),
  ])).skills.quadratics;
  ok('a miss on a CORRECT answer is not counted',
    st.miss['disc-sign'] === 2, JSON.stringify(st.miss));
  ok('  ...and other slips are tallied separately', st.miss['sign-flip'] === 1);
}

console.log(fail ? `\n${fail} FAILURE(S)` : '\nALL PASS');
process.exit(fail ? 1 : 0);
