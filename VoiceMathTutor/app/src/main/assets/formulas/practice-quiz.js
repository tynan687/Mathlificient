// Quiz mode for the Practice window (PC and Android): pick a topic + question
// count, work through them one at a time in the existing step-reveal UI,
// self-mark each after seeing the answer, then review the missed ones. Also
// runs the 12-question placement check that seeds a fresh progress screen.
//
// Grading itself lives in practice.js — the Got it / Missed it buttons work
// outside a quiz too, and that's where most attempts happen. This file just
// registers a `gradeHooks` callback to advance the queue. Reuses globals from
// practice.js (tex, show, buildQuestion, newQuestion, topicSel, currentPool,
// gradeHooks, gradeMode) — classic <script> tags share one top-level scope,
// the same trick practice.js already uses to read practice-data.js.
(function () {
  const quizCountEl = document.getElementById('quizCount');
  const startQuizBtn = document.getElementById('startQuiz');
  const printWorksheetBtn = document.getElementById('printWorksheet');
  const quizProgressEl = document.getElementById('quizProgress');
  const gradingEl = document.getElementById('grading');
  const quizSummaryEl = document.getElementById('quizSummary');
  const newQBtn = document.getElementById('newQ');
  if (!startQuizBtn || !quizSummaryEl) return; // markup not present — no-op

  let quiz = null; // { queue, index, score, missed, placement }

  // Shares practice.js's picker logic so the quiz always draws from whatever
  // the topic dropdown is showing.
  function questionPool() {
    return typeof currentPool === 'function' ? currentPool()
                                             : practiceTemplatesFor(preferredTopic);
  }

  function generateQuestionSet(count) {
    const pool = questionPool();
    return Array.from({ length: count }, () =>
      buildQuestion(pool[Math.floor(Math.random() * pool.length)]));
  }

  function updateQuizProgress() {
    quizProgressEl.classList.remove('hidden');
    const label = quiz.placement ? 'Placement check' : 'Score ' + quiz.score;
    quizProgressEl.textContent =
      `Question ${quiz.index + 1} of ${quiz.queue.length} · ${label}`;
  }

  function showQuizQuestion() {
    const item = quiz.queue[quiz.index];
    const kind = quiz.placement ? 'Placement' : 'Quiz';
    show(item, `${kind} — ${item.topic} (Q${quiz.index + 1}/${quiz.queue.length})`);
    updateQuizProgress();
  }

  function startQuiz(count, opts) {
    const placement = !!(opts && opts.placement);
    const queue = placement ? placementQuestions() : generateQuestionSet(count);
    if (!queue.length) return;
    quiz = { queue, index: 0, score: 0, missed: [], placement };
    topicSel.disabled = true;
    newQBtn.disabled = true;
    quizSummaryEl.classList.add('hidden');
    quizSummaryEl.innerHTML = '';
    showQuizQuestion();
  }

  /**
   * One question per gateway skill. On a fresh install every bar reads zero and
   * "focus next" has nothing to go on, so this is what turns the progress screen
   * from a blank slate into a recommendation.
   */
  function placementQuestions() {
    if (typeof placementPlan !== 'function') return generateQuestionSet(12);
    const withQuestions = SKILLS.filter((s) => templatesForSkill(s.id).length).map((s) => s.id);
    return placementPlan(withQuestions, 12).map((skillId) => {
      const pool = templatesForSkill(skillId);
      return buildQuestion(pool[Math.floor(Math.random() * pool.length)]);
    });
  }

  // practice.js owns the Got it / Missed it buttons (they work outside a quiz
  // too) and logs the attempt; the quiz only needs to know the verdict.
  gradeHooks.push((gotIt) => {
    if (!quiz) return;
    if (gotIt) quiz.score++; else quiz.missed.push(quiz.queue[quiz.index]);
    quiz.index++;
    if (quiz.index < quiz.queue.length) showQuizQuestion();
    else finishQuiz();
  });

  function finishQuiz() {
    const total = quiz.queue.length;
    const score = quiz.score;
    const missed = quiz.missed;
    const wasPlacement = quiz.placement;

    gradeMode = 'self';
    gradingEl.classList.add('hidden');
    quizProgressEl.classList.add('hidden');
    topicSel.disabled = false;
    newQBtn.disabled = false;

    quizSummaryEl.innerHTML = '';
    const title = document.createElement('div');
    title.className = 'flabel';
    title.textContent = wasPlacement
      ? `Placement check done — ${score}/${total}. Your progress screen now knows where to start you.`
      : `Quiz complete — ${score}/${total} correct`;
    quizSummaryEl.appendChild(title);

    if (missed.length) {
      for (const m of missed) {
        const row = document.createElement('div');
        row.className = 'missed-item';
        const q = document.createElement('div');
        tex(q, m.question, false);
        const a = document.createElement('div');
        a.style.fontWeight = '600';
        a.style.marginTop = '4px';
        tex(a, m.answer, false);
        row.appendChild(q);
        row.appendChild(a);
        quizSummaryEl.appendChild(row);
      }
    } else {
      const p = document.createElement('div');
      p.className = 'hint';
      p.textContent = 'Perfect score — no missed questions.';
      quizSummaryEl.appendChild(p);
    }

    const btnRow = document.createElement('div');
    btnRow.className = 'bar';
    const again = document.createElement('button');
    again.className = 'primary';
    again.textContent = 'New quiz';
    again.addEventListener('click', () => {
      gradeMode = 'self';
      startQuiz(Number(quizCountEl.value));
    });
    const back = document.createElement('button');
    back.textContent = 'Back to practice';
    back.addEventListener('click', () => {
      quizSummaryEl.classList.add('hidden');
      newQuestion();
    });
    btnRow.appendChild(again);
    btnRow.appendChild(back);
    quizSummaryEl.appendChild(btnRow);
    quizSummaryEl.classList.remove('hidden');

    quiz = null;
  }

  startQuizBtn.addEventListener('click', () => {
    gradeMode = 'self';
    startQuiz(Number(quizCountEl.value));
  });

  /** Called by the progress screen (PC IPC / Android intent extra). */
  window.startPlacement = () => {
    gradeMode = 'placement';
    startQuiz(12, { placement: true });
  };
  if (typeof window.tutor !== 'undefined') {
    window.tutor.on('practice:placement', () => window.startPlacement());
  }

  if (printWorksheetBtn) {
    printWorksheetBtn.addEventListener('click', () => {
      if (typeof window.tutor === 'undefined') return; // PC-only feature
      const count = Number(quizCountEl.value);
      window.tutor.send('worksheet:open', { questions: generateQuestionSet(count) });
    });
  }
})();
