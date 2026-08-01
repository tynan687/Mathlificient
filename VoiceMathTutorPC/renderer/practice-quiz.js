// Quiz mode for the PC Practice window: pick a topic + question count, work
// through them one at a time in the existing step-reveal UI, self-mark each
// after seeing the answer (this app has no answer-parser anywhere, so a
// self-report "Got it / Missed it" is the honest way to score), then review
// the missed ones. Reuses globals from practice.js (PRACTICE, tex, show,
// newQuestion, topicSel, preferredTopic, practiceTemplatesFor,
// PRACTICE_FORMULAS) — classic <script> tags share one top-level scope, same
// trick practice.js already uses to read practice-data.js/practice-viz.js.
(function () {
  const quizCountEl = document.getElementById('quizCount');
  const startQuizBtn = document.getElementById('startQuiz');
  const printWorksheetBtn = document.getElementById('printWorksheet');
  const quizProgressEl = document.getElementById('quizProgress');
  const gradingEl = document.getElementById('grading');
  const gotItBtn = document.getElementById('gotIt');
  const missedItBtn = document.getElementById('missedIt');
  const quizSummaryEl = document.getElementById('quizSummary');
  const answerBtn = document.getElementById('showAnswer');
  const newQBtn = document.getElementById('newQ');
  if (!startQuizBtn || !quizSummaryEl) return; // markup not present — no-op

  let quiz = null; // { queue, index, score, missed }

  // Shares practice.js's picker logic so the quiz always draws from whatever
  // the topic dropdown is showing.
  function questionPool() {
    return typeof currentPool === 'function' ? currentPool()
                                             : practiceTemplatesFor(preferredTopic);
  }

  function generateQuestionSet(count) {
    const pool = questionPool();
    return Array.from({ length: count }, () => {
      const t = pool[Math.floor(Math.random() * pool.length)];
      const formulas = (typeof PRACTICE_FORMULAS !== 'undefined' && PRACTICE_FORMULAS[t.id]) || [];
      return { ...t.generate(), formulas, topic: t.topic, templateId: t.id };
    });
  }

  function updateQuizProgress() {
    quizProgressEl.classList.remove('hidden');
    quizProgressEl.textContent = `Question ${quiz.index + 1} of ${quiz.queue.length} · Score ${quiz.score}`;
  }

  function showQuizQuestion() {
    gradingEl.classList.add('hidden');
    const item = quiz.queue[quiz.index];
    show(item, `Quiz — ${item.topic} (Q${quiz.index + 1}/${quiz.queue.length})`);
    updateQuizProgress();
  }

  function startQuiz(count) {
    quiz = { queue: generateQuestionSet(count), index: 0, score: 0, missed: [] };
    topicSel.disabled = true;
    newQBtn.disabled = true;
    quizSummaryEl.classList.add('hidden');
    quizSummaryEl.innerHTML = '';
    showQuizQuestion();
  }

  function recordAnswer(gotIt) {
    if (!quiz) return;
    if (gotIt) quiz.score++; else quiz.missed.push(quiz.queue[quiz.index]);
    quiz.index++;
    if (quiz.index < quiz.queue.length) showQuizQuestion();
    else finishQuiz();
  }

  function finishQuiz() {
    const total = quiz.queue.length;
    const score = quiz.score;
    const missed = quiz.missed;

    gradingEl.classList.add('hidden');
    quizProgressEl.classList.add('hidden');
    topicSel.disabled = false;
    newQBtn.disabled = false;

    quizSummaryEl.innerHTML = '';
    const title = document.createElement('div');
    title.className = 'flabel';
    title.textContent = `Quiz complete — ${score}/${total} correct`;
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
  gotItBtn.addEventListener('click', () => recordAnswer(true));
  missedItBtn.addEventListener('click', () => recordAnswer(false));

  // Grading buttons only make sense once the answer's been revealed, and only
  // mid-quiz — practice.js has its own "Show answer" listener; this is an
  // additional one on the same button, which is valid DOM.
  if (answerBtn) {
    answerBtn.addEventListener('click', () => {
      if (quiz) gradingEl.classList.remove('hidden');
    });
  }

  if (printWorksheetBtn) {
    printWorksheetBtn.addEventListener('click', () => {
      if (typeof window.tutor === 'undefined') return; // PC-only feature
      const count = Number(quizCountEl.value);
      window.tutor.send('worksheet:open', { questions: generateQuestionSet(count) });
    });
  }
})();
