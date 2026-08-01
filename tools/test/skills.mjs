// Phase 0: every template carries a valid skill, the graph is sane, and the
// new topic matcher no longer over-matches.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const R = fileURLToPath(new URL('../../VoiceMathTutorPC/renderer/', import.meta.url));
const ctx = { console, module: undefined };
vm.createContext(ctx);
vm.runInContext(readFileSync(`${R}/practice-skills.js`, 'utf8') +
  '\n;globalThis.__s={AREAS,SKILLS,SKILL_BY_ID,skillsInArea,resolveSkill,skillOf,prereqChain};', ctx);
vm.runInContext(readFileSync(`${R}/practice-data.js`, 'utf8') +
  '\n;globalThis.__d={PRACTICE,practiceTemplatesFor,templatesForSkill,PRACTICE_FORMULAS};', ctx);

const { AREAS, SKILLS, SKILL_BY_ID, skillsInArea, resolveSkill, skillOf, prereqChain } = ctx.__s;
const { PRACTICE, practiceTemplatesFor, templatesForSkill } = ctx.__d;

let fail = 0;
const ok = (label, cond, extra) => {
  if (!cond) fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${label}${extra ? ' :: ' + extra : ''}`);
};

// ---- graph integrity ----
ok('areas defined', AREAS.length === 10, AREAS.length + ' areas');
ok('skills defined', SKILLS.length >= 40, SKILLS.length + ' skills');

const badArea = SKILLS.filter((s) => !AREAS.some((a) => a.id === s.area));
ok('every skill has a real area', badArea.length === 0, badArea.map((s) => s.id).join(','));

const badPrereq = SKILLS.flatMap((s) => s.prereqs.filter((p) => !SKILL_BY_ID[p]).map((p) => `${s.id}->${p}`));
ok('every prereq resolves', badPrereq.length === 0, badPrereq.join(', '));

// cycle check via prereqChain (it guards with `seen`, so assert self-exclusion)
const selfDep = SKILLS.filter((s) => prereqChain(s.id).includes(s.id));
ok('no skill is its own prerequisite', selfDep.length === 0, selfDep.map((s) => s.id).join(','));

const dupIds = SKILLS.map((s) => s.id).filter((id, i, a) => a.indexOf(id) !== i);
ok('skill ids unique', dupIds.length === 0, dupIds.join(','));

// ---- templates ----
ok('templates present', PRACTICE.length >= 50, String(PRACTICE.length));
const noSkill = PRACTICE.filter((t) => !t.skill);
ok('every template tagged', noSkill.length === 0, noSkill.map((t) => t.id).join(','));
const unknownSkill = PRACTICE.filter((t) => t.skill && !SKILL_BY_ID[t.skill]);
ok('every template skill exists in the graph', unknownSkill.length === 0,
  unknownSkill.map((t) => `${t.id}->${t.skill}`).join(', '));

// ---- the over-matching fix ----
const rational = practiceTemplatesFor('rational');
ok('"rational" no longer drags in 7 templates', rational.length === 4,
  `${rational.length}: ${rational.map((t) => t.id).join(', ')}`);
ok('  ...and they are all one skill',
  new Set(rational.map((t) => t.skill)).size === 1,
  [...new Set(rational.map((t) => t.skill))].join(','));

const pf = practiceTemplatesFor('partial fraction decomposition'); // the shipped default
ok('tutor default topic resolves to partial fractions',
  pf.length === 3 && pf.every((t) => t.skill === 'partial-fractions'),
  `${pf.length}: ${pf.map((t) => t.id).join(', ')}`);

const chain = practiceTemplatesFor('chain rule');
ok('"chain rule" -> diff-rules', chain.every((t) => t.skill === 'diff-rules'),
  chain.map((t) => t.id).join(', '));

ok('empty topic returns everything', practiceTemplatesFor('').length === PRACTICE.length);
ok('nonsense topic falls back to everything',
  practiceTemplatesFor('zzzz').length === PRACTICE.length);

// ---- picker coverage ----
const withQuestions = SKILLS.filter((s) => templatesForSkill(s.id).length);
console.log(`\nskills with questions today: ${withQuestions.length}/${SKILLS.length}`);
const areasShown = AREAS.filter((a) => skillsInArea(a.id).some((s) => templatesForSkill(s.id).length));
console.log('areas in the picker:', areasShown.map((a) => a.name).join(' · '));
const empty = SKILLS.filter((s) => !templatesForSkill(s.id).length).map((s) => s.id);
console.log(`awaiting content (${empty.length}):`, empty.join(', '));

console.log(fail ? `\n${fail} FAILURE(S)` : '\nALL PASS');
process.exit(fail ? 1 : 0);
