// Offline practice: generate a question, reveal worked steps one at a time.
// Runs in the PC tool window AND the Android WebView (environment-guarded).

const isElectron = typeof window.tutor !== 'undefined';
const hasBridge = typeof Android !== 'undefined';

const topicSel = document.getElementById('topic');
const qEl = document.getElementById('question');
const stepsEl = document.getElementById('steps');
const answerEl = document.getElementById('answer');
const srcEl = document.getElementById('src');
const nextBtn = document.getElementById('nextStep');
const answerBtn = document.getElementById('showAnswer');
const copyBtn = document.getElementById('copyQ');
const formulasEl = document.getElementById('formulas');
const vizBar = document.getElementById('vizBar');
const vizWrap = document.getElementById('vizWrap');
const vizCanvas = document.getElementById('viz');
const gradingEl = document.getElementById('grading');
const gotItBtn = document.getElementById('gotIt');
const missedItBtn = document.getElementById('missedIt');

let vizOpen = false;
let paperColors = null; // set by applyPaper (Android); PC derives from page styles

let current = null;   // { question, steps, answer, choices, fromTutor }
let revealed = 0;
let shownAt = 0;      // when the current question appeared, for the attempt's `ms`
let graded = false;   // one attempt per question — see recordAttempt() below
let advanced = false; // separate from `graded`: MCQ records now, advances on Next
// Whether the question ON SCREEN is being answered by picking. Frozen when the
// question is shown, never re-read from `answerMode`: a student who flips the
// selector mid-question would otherwise be left with neither answering path
// live — the grid was never drawn, and the self-mark row now thinks a grid is
// showing — which inside a quiz means nothing ever advances.
let usingMcq = false;
let preferredTopic = '';
let focusSkill = '';  // set by the progress screen: "practise this one"

// ---- Answering mode ------------------------------------------------------------------
//
// "Work it out" is the default and stays the default: this app is built around
// writing a solution by hand, and options on screen change how you read a
// question. Multiple choice is opt-in, and remembered.
//
// localStorage rather than a new setting plumbed through Electron's settings.json
// and Android's SecureKeyStore — this is a UI preference, not part of the study
// record. The key is namespaced because file:// pages all share one bucket.
const MODE_KEY = 'mathlificient.answerMode';
const modeSel = document.getElementById('answerMode');
const modeNoteEl = document.getElementById('modeNote');

function readMode() {
  try {
    return window.localStorage.getItem(MODE_KEY) === 'mcq' ? 'mcq' : 'self';
  } catch {
    return 'self'; // storage disabled — fall back to the default, don't throw
  }
}
let answerMode = readMode();

/**
 * The floating PracticeActivity popup only ever shows tutor-pushed questions,
 * which have no template and therefore never have options — so multiple choice
 * there would say "no options for this one" every single time. Checked lazily
 * because Android injects the class in onPageFinished, after this script runs.
 */
function miniMode() {
  return typeof document !== 'undefined' && document.body.classList.contains('mini');
}

function mcqActive() {
  return answerMode === 'mcq' && !miniMode();
}

function tex(el, latex, display = true) {
  try {
    katex.render(latex, el, { throwOnError: false, displayMode: display });
  } catch {
    el.textContent = latex;
  }
}

/**
 * The picker lists SKILLS grouped by area, not the legacy free-form `topic`
 * strings (which are inconsistent — "Statistics" vs "Statistics & probability").
 * Option values are skill ids; topic strings survive only as internal labels.
 * Skills with no questions yet are skipped, so the list grows as content lands.
 */
function buildTopics() {
  topicSel.innerHTML = '';
  const auto = document.createElement('option');
  auto.value = '';
  auto.textContent = preferredTopic
    ? `Match my topic (${preferredTopic.slice(0, 30)})`
    : 'All topics';
  topicSel.appendChild(auto);

  if (typeof AREAS === 'undefined') { // skill graph absent — fall back to topics
    for (const t of [...new Set(PRACTICE.map((p) => p.topic))]) {
      const o = document.createElement('option');
      o.value = 'topic::' + t;
      o.textContent = t;
      topicSel.appendChild(o);
    }
    return;
  }

  for (const area of AREAS) {
    const skills = skillsInArea(area.id).filter((s) => templatesForSkill(s.id).length);
    if (!skills.length) continue;
    const group = document.createElement('optgroup');
    group.label = area.name;
    for (const skill of skills) {
      const o = document.createElement('option');
      o.value = skill.id;
      o.textContent = skill.name;
      group.appendChild(o);
    }
    topicSel.appendChild(group);
  }
}

/** Templates for whatever the picker is currently set to. */
function currentPool() {
  // A skill sent over from the progress screen wins until the student touches
  // the picker — it may not even be listed there, if its only questions are
  // reached through a broader skill.
  if (focusSkill) {
    const focused = templatesForSkill(focusSkill);
    if (focused.length) return focused;
  }
  const v = topicSel.value;
  if (!v) return practiceTemplatesFor(preferredTopic);
  if (v.startsWith('topic::')) {
    return PRACTICE.filter((p) => p.topic === v.slice(7));
  }
  const bySkill = templatesForSkill(v);
  return bySkill.length ? bySkill : PRACTICE;
}

/**
 * One generated question, tagged with everything the proficiency log needs, and
 * with its multiple-choice options already built.
 *
 * The options are frozen here rather than derived when the question is drawn,
 * for four reasons: the workings bag `w` stays a local and never rides along
 * into the worksheet's IPC payload; the options can't reshuffle under the
 * student on a re-render; a tutor-pushed question has no template and so gets no
 * options without any special case; and a question whose distractors happen to
 * collide can simply be regenerated, because we are still upstream of show().
 */
function buildQuestion(template) {
  const formulas = (typeof PRACTICE_FORMULAS !== 'undefined' && PRACTICE_FORMULAS[template.id]) || [];
  const tag = {
    formulas,
    fromTutor: false,
    templateId: template.id,
    topic: template.topic,
    skill: typeof skillOf === 'function' ? skillOf(template) : null,
  };
  const canBuild = typeof buildChoices === 'function' && template.distractors;

  let last = null;
  // generate() is pure and costs microseconds, so a few extra draws are free.
  for (let tries = 0; tries < (canBuild ? 5 : 1); tries++) {
    const { w, ...gen } = template.generate();
    last = gen;
    if (!canBuild) break;
    const choices = buildChoices(gen.answer, template.distractors, w,
      { ordered: template.mcqOrdered });
    if (choices) return { ...gen, ...tag, choices };
  }
  // No honest option set for this instance — self-mark it. The template is not
  // disabled; the next question may well manage four distinct options.
  return { ...last, ...tag, choices: null };
}

function newQuestion() {
  const pool = currentPool();
  const template = pool[Math.floor(Math.random() * pool.length)];
  show(buildQuestion(template), template.topic);
}

function show(item, label) {
  current = item;
  revealed = 0;
  shownAt = Date.now();
  graded = false;
  advanced = false;
  clearAnswerUI();
  srcEl.textContent = item.fromTutor ? '✨ From your tutor' : label || '';
  tex(qEl, item.question, false); // inline: long questions wrap instead of clipping
  stepsEl.innerHTML = '';
  answerEl.classList.add('hidden');
  answerEl.innerHTML = '';

  // Formulas you may need — shown inline so there's no need to leave for the sheet.
  if (formulasEl) {
    const formulas = Array.isArray(item.formulas) ? item.formulas : [];
    formulasEl.innerHTML = '';
    if (formulas.length) {
      const label2 = document.createElement('div');
      label2.className = 'flabel';
      label2.textContent = '📐 Formulas you may need';
      formulasEl.appendChild(label2);
      for (const f of formulas) {
        const row = document.createElement('div');
        row.className = 'frow';
        tex(row, f, false);
        formulasEl.appendChild(row);
      }
      formulasEl.classList.remove('hidden');
    } else {
      formulasEl.classList.add('hidden');
    }
  }

  copyBtn.disabled = false;
  nextBtn.textContent = 'Show next step';

  // Multiple choice: draw the grid and lock the reveal buttons until a pick.
  // Reading the last step first would hand over the answer, and banking an
  // objectively-graded score for copying it is worse than the self-marking it
  // replaces. They reopen the moment a pick lands.
  usingMcq = mcqActive() && mcqShow(item);
  nextBtn.disabled = usingMcq;
  answerBtn.disabled = usingMcq;
  if (mcqActive() && !usingMcq && item.skill && !item.fromTutor) {
    setModeNote('No options for this one — work it out and mark yourself.');
  }
  updateViz();
}

// ---- Visual panel (collapsible; never covers the board or formulas) ----------------

function vizColors() {
  if (paperColors) return paperColors;
  const cs = getComputedStyle(document.body);
  return { bg: cs.backgroundColor, fg: cs.color, accent: '#4F7DF7' };
}

function updateViz() {
  if (!vizBar) return;
  const has = !!(current && current.viz && typeof renderVisual === 'function');
  vizBar.classList.toggle('hidden', !has);
  if (!has) {
    vizWrap.classList.add('hidden');
    return;
  }
  vizBar.textContent = vizOpen ? '📉 Hide visual' : '📈 Visual available — tap to show';
  vizWrap.classList.toggle('hidden', !vizOpen);
  if (vizOpen) {
    // Render after layout so the canvas has its final size.
    requestAnimationFrame(() => renderVisual(vizCanvas, current.viz, vizColors()));
  }
}

if (vizBar) {
  vizBar.addEventListener('click', () => {
    vizOpen = !vizOpen;
    updateViz();
  });
}

nextBtn.addEventListener('click', () => {
  if (!current) return;
  if (revealed < current.steps.length) {
    const div = document.createElement('div');
    div.className = 'step';
    tex(div, current.steps[revealed]);
    stepsEl.appendChild(div);
    revealed++;
  }
  if (revealed >= current.steps.length) {
    nextBtn.disabled = true;
    nextBtn.textContent = 'All steps shown';
  }
});

answerBtn.addEventListener('click', () => {
  if (!current) return;
  answerEl.classList.remove('hidden');
  tex(answerEl, current.answer);
  // Grading is offered on every question, not just inside a quiz — that's where
  // most attempts happen, and a proficiency bar built only from quizzes would be
  // built from a small minority of the work. Hidden when there's no skill to
  // credit, and never alongside a live option grid.
  if (gradingEl && !graded && current.skill && !usingMcq) {
    gradingEl.classList.remove('hidden');
  }
});

// ---- Grading -----------------------------------------------------------------------
//
// Two steps, deliberately kept apart. Multiple choice records the moment an
// option is picked — so the attempt survives the window being closed — but must
// not jump to the next question until the student has read why they were wrong.
// Self-marking does both at once.
//
// `flow` (practice / quiz / placement) is a different axis from `mode` (mcq /
// self). Conflating them, as an earlier version did, meant a multiple-choice
// question answered inside a quiz was logged as self-marked and quietly given
// the lower weight.

const gradeHooks = []; // quiz mode registers here rather than binding the buttons
let gradeFlow = 'practice';
let lastVerdict = false; // what to hand the hooks when advance() eventually runs

/** Write one attempt. `extra` carries { k, miss } for a picked option. */
function recordAttempt(score, mode, extra) {
  if (!current || graded) return;
  graded = true;
  lastVerdict = score >= 0.5;
  if (gradingEl) gradingEl.classList.add('hidden');
  if (current.skill && typeof Store !== 'undefined' && typeof attemptFrom === 'function') {
    Store.profAppend(attemptFrom(
      current.skill, current.templateId, score, mode, Date.now() - shownAt,
      { ...(extra || {}), flow: gradeFlow },
    ));
  }
}

/** Move on — in a quiz that means the next question, otherwise nothing. */
function advance() {
  if (advanced) return; // a second Next press must not skip a question
  advanced = true;
  for (const fn of gradeHooks) fn(lastVerdict);
}

/** Self-marked: recording and moving on happen together. */
function grade(gotIt) {
  if (!current || graded) return;
  recordAttempt(gotIt ? 1 : 0, 'self', {});
  advance();
}

/**
 * Answer the tutor's `check_my_answer` tool call.
 *
 * The page does the marking, not the host and not the model. That is not
 * ceremony: `current.answer` lives here, the comparison lives in JavaScript, and
 * — the point — the model is never told what the answer is. It asks, it gets a
 * verdict, and it finds out whether the student was right at the same moment they
 * do. That is what keeps "you never read out final answers" true while still
 * letting the tutor say "yes, that's it".
 *
 * Called from Kotlin via evaluateJavascript on Android, and from main.js via
 * executeJavaScript on Windows. Returns a plain OBJECT, which suits both: Android
 * gets it as JSON text it can hand straight to the model, and Electron gets the
 * value itself.
 */
window.__checkAnswer = (heard) => {
  const reply = (o) => o;
  if (!current) return reply({ verdict: 'none', reason: 'no question on screen' });
  if (typeof markAnswer !== 'function') return reply({ verdict: 'unsure', reason: 'no marker' });

  const { verdict, why } = markAnswer(heard, current.answer);
  const peeked = typeof revealed === 'number' && revealed > 0;
  // A live, unanswered option grid owns the marking. Recording here would leave
  // four clickable options that silently no-op, so hand the model the verdict and
  // let it nudge them to pick one instead.
  const gridLive = !!(current.choices && typeof mcqActive === 'function' && mcqActive() && !graded);

  let recorded = false;
  if ((verdict === 'right' || verdict === 'wrong') && !graded && !gridLive) {
    // Reading the steps first turns this into a copying exercise, so it does not
    // get objective credit — the same rule mcqPick applies.
    if (peeked) recordAttempt(verdict === 'right' ? 0.5 : 0, 'self', {});
    else recordAttempt(verdict === 'right' ? 1 : 0, 'tutor', {});
    recorded = true;
    enableReveal();
    // A quiz is waiting on advance() to move on; without this it stalls here.
    if (gradeFlow !== 'practice') advance();
  }
  return reply({
    verdict, why, recorded, peeked, gridLive,
    skill: current.skill || null,
    alreadyMarked: graded && !recorded,
    // Only when it went wrong, and only if they actually wrote something. A
    // correct answer needs no diagnosis, and an image of a blank page is a wasted
    // one — so the tutor is told whether looking is worth it, and asks separately.
    workingToSee: verdict === 'wrong'
      && typeof window.__inkSnapshot === 'function'
      && !!window.__inkSnapshot(),
  });
};

/**
 * The student's handwritten working, base64, or null.
 *
 * Kept separate from __checkAnswer so a verdict never drags an image along with
 * it: the tutor is told whether there is working to look at, and fetches it only
 * if it decides to.
 */
window.__working = () => (typeof window.__inkSnapshot === 'function'
  ? window.__inkSnapshot() : null);

/** Reopen the worked steps once the question has been answered. */
function enableReveal() {
  nextBtn.disabled = revealed >= (current ? current.steps.length : 0);
  answerBtn.disabled = false;
}

/** Reset every answering surface. Shared by show() and the end of a quiz. */
function clearAnswerUI() {
  if (gradingEl) gradingEl.classList.add('hidden');
  if (typeof mcqClear === 'function') mcqClear();
  setModeNote('');
}

function setModeNote(text) {
  if (!modeNoteEl) return;
  modeNoteEl.textContent = text || '';
  modeNoteEl.classList.toggle('hidden', !text);
}

if (gotItBtn) gotItBtn.addEventListener('click', () => grade(true));
if (missedItBtn) missedItBtn.addEventListener('click', () => grade(false));

copyBtn.addEventListener('click', () => {
  if (!current) return;
  const text = current.question;
  if (hasBridge) Android.copyText(text);
  else navigator.clipboard.writeText(text).catch(() => {});
});

document.getElementById('newQ').addEventListener('click', newQuestion);
topicSel.addEventListener('change', () => { focusSkill = ''; });

// A mode change takes effect on the NEXT question. Switching mid-question has no
// good answer: after a pick `graded` is already set, so the self-mark row stays
// suppressed and inside a quiz nothing would ever call advance() — the quiz
// would sit there with no way forward.
if (modeSel) {
  modeSel.value = answerMode;
  modeSel.addEventListener('change', () => {
    answerMode = modeSel.value === 'mcq' ? 'mcq' : 'self';
    try { window.localStorage.setItem(MODE_KEY, answerMode); } catch { /* not fatal */ }
    // The drawing panel is dead weight when you're picking from four options,
    // and the page needs the room for the grid. PC only; Android's studio has a
    // native canvas outside this page.
    const inkPanel = document.getElementById('inkPanel');
    if (inkPanel) inkPanel.open = answerMode !== 'mcq';
    setModeNote(answerMode === 'mcq'
      ? 'Multiple choice starts on the next question.'
      : 'Back to working it out on the next question.');
  });
}

// A tutor-generated question pushed from a live session.
function showTutorQuestion(payload) {
  const steps = Array.isArray(payload.steps) ? payload.steps : [String(payload.steps || '')];
  // No template to read a skill off, so infer one from whatever the session is
  // about. If that resolves to nothing the question still works — it just isn't
  // graded, rather than being logged against the wrong bar.
  const skill = typeof resolveSkill === 'function'
    ? resolveSkill(payload.topic || preferredTopic)
    : null;
  show({
    question: String(payload.question || ''),
    steps,
    answer: String(payload.answer || steps[steps.length - 1] || ''),
    formulas: Array.isArray(payload.formulas) ? payload.formulas : [],
    fromTutor: true,
    skill,
  });
}

/**
 * Paint the whole page to match the Practice Studio's paper colour (Android).
 * `bg` = paper hex, `fg` = a contrasting content hex. No-op on PC (never called).
 */
window.applyPaper = (bg, fg) => {
  // Diagram colours follow the paper; brighter accent on dark paper.
  const hex = bg.replace('#', '');
  const lum = hex.length === 6
    ? (0.299 * parseInt(hex.slice(0, 2), 16) +
       0.587 * parseInt(hex.slice(2, 4), 16) +
       0.114 * parseInt(hex.slice(4, 6), 16)) / 255
    : 1;
  paperColors = { bg, fg, accent: lum < 0.4 ? '#7DA7FF' : '#4F7DF7' };
  if (vizOpen) updateViz();

  let s = document.getElementById('paperTheme');
  if (!s) {
    s = document.createElement('style');
    s.id = 'paperTheme';
    document.head.appendChild(s);
  }
  s.textContent =
    `body{background:${bg}!important;color:${fg}!important}` +
    `.card,.formulas{background:${bg}!important;border-color:${fg}44!important}` +
    `.src,.hint,.flabel{color:${fg}!important;opacity:0.75}` +
    `select,button{color:${fg}!important;border-color:${fg}66!important;background:transparent!important}` +
    `button.primary{background:${fg}!important;color:${bg}!important;border-color:${fg}!important}` +
    `.step{border-top-color:${fg}33!important}` +
    // The options are <div>s, not <button>s, so the blanket rule above can't
    // reach them — but they still need to follow the paper, and the right/wrong
    // colours have to survive it, because they are the only feedback there is.
    `.mcq-option{color:${fg}!important;border-color:${fg}55!important}` +
    `.mcq-option.correct{border-color:#2E7D32!important;box-shadow:inset 0 0 0 2px #2E7D32}` +
    `.mcq-option.wrong{border-color:#C62828!important;box-shadow:inset 0 0 0 2px #C62828}` +
    `.mcq-feedback.good{color:#2E7D32!important}.mcq-feedback.bad{color:#C62828!important}`;
};
window.showPractice = (json) => {
  try { showTutorQuestion(JSON.parse(json)); } catch { /* ignore */ }
};
if (isElectron) {
  window.tutor.on('practice:new', (payload) => showTutorQuestion(payload));
}

// Preferred topic: PC reads settings; Android injects via setPreferredTopic().
window.setPreferredTopic = (t) => {
  preferredTopic = String(t || '');
  buildTopics();
};

/**
 * "Practise this one" from the progress screen: select the skill in the picker
 * and generate straight away, so the student lands on a question rather than on
 * a dropdown they have to find the skill in again.
 */
window.setFocusSkill = (skillId) => {
  focusSkill = String(skillId || '');
  if (!focusSkill) return;
  const match = [...topicSel.options].some((o) => o.value === focusSkill);
  if (match) topicSel.value = focusSkill;
  newQuestion();
};
if (isElectron) {
  window.tutor.on('practice:skill', (skillId) => window.setFocusSkill(skillId));
}
(async () => {
  if (isElectron) {
    try {
      const settings = await window.tutor.invoke('settings:get');
      preferredTopic = settings.currentTopic || '';
    } catch { /* defaults */ }
  }
  buildTopics();
})();
