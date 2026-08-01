// Proficiency — shared by the PC and Android apps, and by main.js via require().
//
// What gets stored is an append-only log of ATTEMPTS, never the computed
// mastery. Recomputing on read costs a few milliseconds and buys a lot: the
// Kotlin side implements no maths at all (it just appends a line), two windows
// writing at once lose one attempt instead of clobbering a whole record, and
// the record of *which wrong answer* was picked doubles as a misconception log.
//
// The rule, in one sentence a student can follow: each bar is a running average
// of how you've gone on that skill, weighted to your recent attempts, and it
// fades the longer you leave a topic alone.

const PROF_VERSION = 1;

/** Mastery below this counts as shaky; above the upper bound counts as solid. */
const SHAKY = 0.30;
const SOLID = 0.60;

// Self-marked answers are worth less than objectively-graded ones — a student
// marking their own work is a noisier signal than a picked option, and pretending
// otherwise would make the bars overconfident. `placement` isn't listed because
// it's self-marked too; it gets the 0.8 default, and only carries its own mode
// so a placement run stays identifiable in the log.
const WEIGHT = { mcq: 1.0, self: 0.8 };

const DAY_MS = 86400000;

function clamp(x, lo, hi) { return x < lo ? lo : x > hi ? hi : x; }

/** Build one attempt record. `score`: 1 right, 0.5 right-after-hint, 0 wrong. */
function attemptFrom(skill, templateId, score, mode, ms, miss) {
  const a = {
    t: Date.now(),
    skill,
    tmpl: templateId || null,
    score: clamp(Number(score) || 0, 0, 1),
    mode: mode || 'self',
  };
  if (ms != null) a.ms = Math.round(ms);
  if (miss) a.miss = miss;
  return a;
}

/**
 * Fold the attempt log into per-skill and per-area state.
 *
 * `p` moves fast for the first few attempts then settles — alpha decays as
 * 1/(n+1) but never below 0.18, so a skill can still recover from a bad patch
 * without needing a reset button.
 */
function computeProficiency(log, now) {
  now = now || Date.now();
  const attempts = (log && log.attempts) || [];
  const skills = {};

  for (const a of attempts) {
    if (!a || !a.skill) continue;
    const s = skills[a.skill] || (skills[a.skill] = {
      p: 0, n: 0, correct: 0, streak: 0, last: 0, miss: {},
    });
    const weight = WEIGHT[a.mode] != null ? WEIGHT[a.mode] : 0.8;
    const alpha = Math.max(0.18, 1 / (s.n + 1));
    s.p += alpha * weight * (a.score - s.p);
    s.n += 1;
    if (a.score >= 0.5) { s.correct += 1; s.streak += 1; } else { s.streak = 0; }
    s.last = Math.max(s.last, a.t || 0);
    if (a.miss) s.miss[a.miss] = (s.miss[a.miss] || 0) + 1;
  }

  // Derived-at-read-time, never stored: bars must not drift while the app is shut.
  for (const id of Object.keys(skills)) {
    const s = skills[id];
    s.p = clamp(s.p, 0, 1);
    const days = s.last ? (now - s.last) / DAY_MS : 0;
    const halfLife = 2 * Math.pow(2, Math.min(s.streak, 5)); // 2,4,8,16,32,64 days
    s.recall = s.last ? Math.pow(0.5, days / halfLife) : 0;
    s.daysSince = s.last ? days : null;
    s.confident = s.n >= 3;
  }

  // Areas average their skills, weighted by how much evidence each carries.
  const areas = {};
  if (typeof SKILL_BY_ID !== 'undefined') {
    for (const [id, s] of Object.entries(skills)) {
      const skill = SKILL_BY_ID[id];
      if (!skill) continue;
      const a = areas[skill.area] || (areas[skill.area] = { p: 0, n: 0, skillIds: [], _w: 0 });
      const w = Math.min(s.n, 8); // cap so one heavily-drilled skill can't dominate
      a.p += s.p * w;
      a._w += w;
      a.n += s.n;
      a.skillIds.push(id);
    }
    for (const a of Object.values(areas)) { a.p = a._w ? a.p / a._w : 0; delete a._w; }
  }

  return { skills, areas, totals: { attempts: attempts.length } };
}

/** Empty state for a skill that has never been attempted. */
function blankSkill() {
  return { p: 0, n: 0, correct: 0, streak: 0, last: 0, miss: {}, recall: 0, daysSince: null, confident: false };
}

/** How much the app actually knows about a skill: 0 (nothing) → 1 (enough). */
function evidenceOf(s) { return Math.min(s.n, 4) / 4; }

/** Untouched prerequisites are *unknown*, not failed — see readinessOf. */
const UNKNOWN_PREREQ = 0.6;

/**
 * How ready the student is for a skill, from its prerequisites: 0 when a prereq
 * is known to be shaky, 1 once they're solid. Deliberately a multiplier with a
 * floor rather than a lock — their class may already be past a topic they never
 * drilled here, and hiding it would be patronising.
 *
 * A prereq with no attempts scores UNKNOWN_PREREQ rather than 0. Treating "never
 * practised in this app" as "can't do it" would bury every intermediate skill
 * behind a wall of foundations on a fresh install, which is both wrong and
 * demoralising. Only *evidence* of a weak prereq pushes a skill down.
 */
function readinessOf(skillId, skills) {
  if (typeof SKILL_BY_ID === 'undefined') return 1;
  const skill = SKILL_BY_ID[skillId];
  if (!skill || !skill.prereqs.length) return 1;
  return Math.min(...skill.prereqs.map((p) => {
    const s = skills[p];
    if (!s || !s.n) return UNKNOWN_PREREQ;
    return clamp((s.p - SHAKY) / (SOLID - SHAKY), 0, 1);
  }));
}

/** How deep in the prerequisite graph a skill sits — 0 for a foundation. */
function depthOf(skillId) {
  return typeof prereqChain === 'function' ? prereqChain(skillId).length : 0;
}

/**
 * Rank what to work on next, with a reason for each — the reason is the point.
 * `pool` limits to skills that actually have questions.
 *
 * Three competing pulls, and the balance between them is the whole design:
 *
 *   weak  — you got this wrong, and we have enough attempts to believe it.
 *           Scaled by evidence so a single unlucky miss doesn't dominate.
 *   stale — you had it, and it's been long enough that you probably don't now.
 *   fresh — we've never seen you try. Sits at a middling constant, so a
 *           demonstrated weakness always outranks an unknown, and shallower
 *           skills come first among equal unknowns.
 */
function recommend(state, pool, limit) {
  if (typeof SKILLS === 'undefined') return [];
  const has = pool ? new Set(pool) : null;
  const out = [];

  for (const skill of SKILLS) {
    if (has && !has.has(skill.id)) continue;
    const s = state.skills[skill.id] || blankSkill();
    const readiness = readinessOf(skill.id, state.skills);
    const evidence = evidenceOf(s);

    const weak = 0.55 * (1 - s.p) * evidence;
    const stale = 0.30 * (1 - s.recall) * s.p;
    const fresh = 0.30 * 0.5 * (1 - evidence) / (1 + 0.35 * depthOf(skill.id));
    const urgency = (weak + stale + fresh) * (0.15 + 0.85 * readiness);

    out.push({
      skill, s, readiness, urgency,
      reason: reasonFor(skill, s, readiness, state),
    });
  }
  out.sort((a, b) => b.urgency - a.urgency);
  return limit ? out.slice(0, limit) : out;
}

/** A plain-English "why this": what dominated the score. */
function reasonFor(skill, s, readiness, state) {
  const pct = Math.round(s.p * 100);
  if (s.n === 0) {
    const weakest = weakestPrereq(skill, state.skills);
    if (weakest && weakest.n) return `Not started — ${weakest.name} first would make this easier.`;
    if (!skill.prereqs.length) return 'Not started, and nothing needs to come first.';
    return 'Not started — you have the background for it.';
  }
  if (s.p < SHAKY) {
    const slip = topMiss(s);
    if (slip) return `Shaky at ${pct}% — ${slip}`;
    return s.n === 1
      ? 'Missed the one you tried — worth a proper go.'
      : `Your weakest at ${pct}%, over ${s.n} attempts.`;
  }
  if (s.recall < 0.6 && s.daysSince != null) {
    return `You had this at ${pct}% but haven't practised in ${Math.round(s.daysSince)} days.`;
  }
  if (readiness < 0.5) {
    const weakest = weakestPrereq(skill, state.skills);
    if (weakest) return `At ${pct}% — ${weakest.name} first would help.`;
  }
  if (s.p >= 0.85 && s.confident) return `Solid at ${pct}%. Keep it warm.`;
  if (!s.confident) return `At ${pct}% after ${s.n} — not enough to be sure yet.`;
  return `At ${pct}% — worth another go.`;
}

/**
 * The prerequisite most worth doing first, or null. Only ever names one the
 * student has actually attempted — telling someone to go back to a topic we
 * have no evidence they're weak at is guessing, and it reads as condescending.
 */
function weakestPrereq(skill, skills) {
  if (typeof SKILL_BY_ID === 'undefined' || !skill.prereqs.length) return null;
  let worst = null;
  for (const id of skill.prereqs) {
    const s = skills[id];
    if (!s || !s.n) continue;
    if (!worst || s.p < worst.p) {
      worst = { p: s.p, n: s.n, name: (SKILL_BY_ID[id] || {}).name || id };
    }
  }
  return worst && worst.p < SOLID ? worst : null;
}

/** The misconception this skill trips on most, as a sentence. */
function topMiss(s) {
  const entries = Object.entries(s.miss || {});
  if (!entries.length) return null;
  entries.sort((a, b) => b[1] - a[1]);
  const [why, count] = entries[0];
  if (count < 2) return null;
  const label = (typeof MISCONCEPTIONS !== 'undefined' && MISCONCEPTIONS[why]) || why;
  return `you keep ${label}.`;
}

/** Skills whose recall has decayed but which were once learned. */
function dueForReview(state, pool, limit) {
  if (typeof SKILLS === 'undefined') return [];
  const has = pool ? new Set(pool) : null;
  const out = SKILLS
    .filter((sk) => (!has || has.has(sk.id)))
    .map((sk) => ({ skill: sk, s: state.skills[sk.id] || blankSkill() }))
    .filter((x) => x.s.n > 0 && x.s.p >= SHAKY && x.s.recall < 0.6)
    .sort((a, b) => a.s.recall - b.s.recall);
  return limit ? out.slice(0, limit) : out;
}

/**
 * The 12 gateway skills for a placement check. Without this, a fresh install
 * has every skill at zero and "focus next" is arbitrary — so this is part of
 * the feature, not a nicety. Picks the shallowest skill with questions in each
 * area, then fills up to `count` with the next shallowest overall.
 */
function placementPlan(pool, count) {
  if (typeof SKILLS === 'undefined' || typeof AREAS === 'undefined') return [];
  count = count || 12;
  const has = pool ? new Set(pool) : null;
  const usable = SKILLS.filter((s) => !has || has.has(s.id));
  const depth = (s) => (typeof prereqChain === 'function' ? prereqChain(s.id).length : 0);

  const picked = [];
  for (const area of AREAS) {
    const inArea = usable.filter((s) => s.area === area.id).sort((a, b) => depth(a) - depth(b));
    if (inArea.length) picked.push(inArea[0]);
  }
  const rest = usable
    .filter((s) => !picked.includes(s))
    .sort((a, b) => depth(a) - depth(b) || a.level - b.level);
  while (picked.length < count && rest.length) picked.push(rest.shift());
  return picked.slice(0, count).map((s) => s.id);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    PROF_VERSION, SHAKY, SOLID, computeProficiency, recommend, dueForReview,
    attemptFrom, placementPlan, readinessOf, evidenceOf, blankSkill,
  };
}
