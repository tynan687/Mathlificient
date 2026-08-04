// Quiz mode for the Practice window (PC and Android): pick a topic + question
// count, work through them one at a time in the existing step-reveal UI,
// self-mark each after seeing the answer, then review the missed ones. Also
// runs the 12-question placement check that seeds a fresh progress screen.
//
// Grading itself lives in practice.js — the Got it / Missed it buttons and the
// multiple-choice grid work outside a quiz too, and that's where most attempts
// happen. This file just registers a `gradeHooks` callback to advance the queue.
// Reuses globals from practice.js (tex, show, buildQuestion, newQuestion,
// topicSel, currentPool, clearAnswerUI, gradeHooks, gradeFlow) — classic
// <script> tags share one top-level scope, the same trick practice.js already
// uses to read practice-data.js.
(function () {
  const quizCountEl = document.getElementById('quizCount');
  const startQuizBtn = document.getElementById('startQuiz');
  const cancelQuizBtn = document.getElementById('cancelQuiz');
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
    gradeFlow = placement ? 'placement' : 'quiz';
    quiz = { queue, index: 0, score: 0, missed: [], placement };
    topicSel.disabled = true;
    newQBtn.disabled = true;
    if (cancelQuizBtn) cancelQuizBtn.classList.remove('hidden');
    quizSummaryEl.classList.add('hidden');
    quizSummaryEl.innerHTML = '';
    showQuizQuestion();
  }

  /**
   * Leave a quiz part-way through.
   *
   * Starting one disables the topic picker and New question, so without this there
   * was no way out at all: the only exits were finishing every question or closing
   * the window. Attempts already marked stay marked — they happened.
   */
  function cancelQuiz() {
    if (!quiz) return;
    quiz = null;
    gradeFlow = 'practice';
    clearAnswerUI();
    quizProgressEl.classList.add('hidden');
    quizSummaryEl.classList.add('hidden');
    quizSummaryEl.innerHTML = '';
    topicSel.disabled = false;
    newQBtn.disabled = false;
    if (cancelQuizBtn) cancelQuizBtn.classList.add('hidden');
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
      const q = buildQuestion(pool[Math.floor(Math.random() * pool.length)]);
      // Placement is always self-marked. It seeds every bar on the progress
      // screen, and not all twelve gateway skills have options — a seed built
      // from two different weightings and two different guess floors is worse
      // than a uniform one, even if the uniform one is the noisier signal.
      return { ...q, choices: null };
    });
  }

  // practice.js owns both answering paths — Got it / Missed it, and the option
  // grid — and logs the attempt. The quiz only needs the verdict, and only once
  // the student has moved on (which for multiple choice is after they've read
  // why they were wrong).
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

    gradeFlow = 'practice';
    // The option grid, its feedback line and the Next button all belong to the
    // question that just ended — without this they sit above the summary card
    // with Next still bound to a quiz that no longer exists.
    clearAnswerUI();
    quizProgressEl.classList.add('hidden');
    topicSel.disabled = false;
    newQBtn.disabled = false;
    if (cancelQuizBtn) cancelQuizBtn.classList.add('hidden');

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
    again.addEventListener('click', () => startQuiz(Number(quizCountEl.value)));
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

  startQuizBtn.addEventListener('click', () => startQuiz(Number(quizCountEl.value)));
  if (cancelQuizBtn) cancelQuizBtn.addEventListener('click', cancelQuiz);

  /** Called by the progress screen (PC IPC / Android intent extra). */
  window.startPlacement = () => startQuiz(12, { placement: true });
  if (typeof window.tutor !== 'undefined') {
    window.tutor.on('practice:placement', () => window.startPlacement());
  }

  if (printWorksheetBtn) {
    printWorksheetBtn.addEventListener('click', () => {
      if (typeof window.tutor === 'undefined') return; // PC-only feature
      const count = Number(quizCountEl.value);
      // The worksheet window is a separate BrowserWindow with its own file://
      // localStorage bucket, so it cannot read the answering mode itself — send it.
      window.tutor.send('worksheet:open', {
        questions: generateQuestionSet(count),
        mode: typeof answerMode !== 'undefined' ? answerMode : 'self',
      });
    });
  }
})();
