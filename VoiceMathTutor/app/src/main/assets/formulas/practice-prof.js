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

// How the answer was graded, which is a statement about signal quality. A
// student marking their own work is noisier than a picked option, and pretending
// otherwise would make the bars overconfident.
//
// This is deliberately NOT the same axis as which flow the question came from
// (free practice / quiz / placement) — that lives in `a.flow`. Conflating them
// would mean a multiple-choice question answered inside a quiz got logged as
// self-marked, which is exactly the sort of quiet mis-weighting that makes a
// progress bar untrustworthy.
const WEIGHT = { mcq: 1.0, self: 0.8 };

const DAY_MS = 86400000;

function clamp(x, lo, hi) { return x < lo ? lo : x > hi ? hi : x; }

/**
 * Build one attempt record. `score`: 1 right, 0.5 right-after-hint, 0 wrong.
 * `extra` carries the optional fields: `{ miss, flow, k }` — the misconception
 * key behind a wrong pick, the flow it happened in, and how many options were
 * on offer (see chanceAdjusted).
 */
function attemptFrom(skill, templateId, score, mode, ms, extra) {
  const e = extra || {};
  const a = {
    t: Date.now(),
    skill,
    tmpl: templateId || null,
    score: clamp(Number(score) || 0, 0, 1),
    mode: mode || 'self',
  };
  if (ms != null) a.ms = Math.round(ms);
  if (e.miss) a.miss = e.miss;
  if (e.flow) a.flow = e.flow;
  if (e.k > 1) a.k = e.k;
  return a;
}

/**
 * Discount the free 1/k a multiple-choice question hands out for guessing.
 *
 * Without this, mastery converges to the mean raw score, and on four options a
 * student who genuinely knows half of a skill converges to 0.5 + 0.5x0.25 =
 * 0.625 — above SOLID — where the same student self-marking sits at 0.5. Moving
 * a skill to multiple choice would turn its bar green with no change in ability,
 * and the recommender would then route them away from it.
 *
 * The result is deliberately NOT clamped to [0,1]: a wrong pick on four options
 * is worth -1/3, and that is the whole mechanism. Clamping here would make the
 * correction a no-op, because on a binary score it maps 1 to 1 and 0 to 0 and
 * changes nothing — the discount only shows up once the negatives are averaged
 * against the wins. `s.p` is clamped after the fold instead, so nothing outside
 * this function ever sees a negative.
 *
 * Attempts with no `k` (every self-mark, and everything written before this
 * existed) pass through untouched. Changing this formula needs no migration
 * precisely because the log stores attempts and never the computed mastery.
 */
function chanceAdjusted(a) {
  if (!a.k || a.k < 2) return a.score;
  const floor = 1 / a.k;
  return (a.score - floor) / (1 - floor);
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
    s.p += alpha * weight * (chanceAdjusted(a) - s.p);
    s.n += 1;
    // Streaks and the correct count stay on the RAW score — they describe what
    // the student did, not what it's worth. "3 in a row" must mean three right.
    if (a.score >= 0.5) { s.correct += 1; s.streak += 1; } else { s.streak = 0; }
    s.last = Math.max(s.last, a.t || 0);
    // Only wrong answers carry a misconception. Counting one off a correct
    // answer would poison the "you keep…" line on the progress screen.
    if (a.miss && a.score < 0.5) s.miss[a.miss] = (s.miss[a.miss] || 0) + 1;
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

/**
 * The misconception this skill trips on most, as a sentence fragment that reads
 * after "Shaky at 22% — ". Returns null rather than leaking the raw key when a
 * `why` has no entry: an unexplained slip is better than "you keep disc-sgn."
 */
function topMiss(s) {
  const entries = Object.entries(s.miss || {});
  if (!entries.length) return null;
  entries.sort((a, b) => b[1] - a[1]);
  const [why, count] = entries[0];
  if (count < 2) return null; // one slip is noise, not a pattern
  if (typeof MISCONCEPTIONS === 'undefined') return null;
  const entry = MISCONCEPTIONS[why];
  return entry && entry.label ? `you keep ${entry.label}.` : null;
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
    PROF_VERSION, SHAKY, SOLID, WEIGHT, computeProficiency, recommend, dueForReview,
    attemptFrom, chanceAdjusted, placementPlan, readinessOf, evidenceOf, blankSkill,
  };
}
