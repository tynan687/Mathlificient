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

let current = null;   // { question, steps, answer, fromTutor }
let revealed = 0;
let preferredTopic = '';

function tex(el, latex, display = true) {
  try {
    katex.render(latex, el, { throwOnError: false, displayMode: display });
  } catch {
    el.textContent = latex;
  }
}

function buildTopics() {
  topicSel.innerHTML = '';
  const auto = document.createElement('option');
  auto.value = '';
  auto.textContent = preferredTopic
    ? `Match my topic (${preferredTopic.slice(0, 30)})`
    : 'All topics';
  topicSel.appendChild(auto);
  for (const t of [...new Set(PRACTICE.map((p) => p.topic))]) {
    const o = document.createElement('option');
    o.value = t;
    o.textContent = t;
    topicSel.appendChild(o);
  }
}

function newQuestion() {
  const pool = topicSel.value
    ? PRACTICE.filter((p) => p.topic === topicSel.value)
    : practiceTemplatesFor(preferredTopic);
  const template = pool[Math.floor(Math.random() * pool.length)];
  show({ ...template.generate(), fromTutor: false }, template.topic);
}

function show(item, label) {
  current = item;
  revealed = 0;
  srcEl.textContent = item.fromTutor ? '✨ From your tutor' : label || '';
  tex(qEl, item.question, false); // inline: long questions wrap instead of clipping
  stepsEl.innerHTML = '';
  answerEl.classList.add('hidden');
  answerEl.innerHTML = '';
  nextBtn.disabled = false;
  nextBtn.textContent = 'Show next step';
  answerBtn.disabled = false;
  copyBtn.disabled = false;
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
});

copyBtn.addEventListener('click', () => {
  if (!current) return;
  const text = current.question;
  if (hasBridge) Android.copyText(text);
  else navigator.clipboard.writeText(text).catch(() => {});
});

document.getElementById('newQ').addEventListener('click', newQuestion);

// A tutor-generated question pushed from a live session.
function showTutorQuestion(payload) {
  const steps = Array.isArray(payload.steps) ? payload.steps : [String(payload.steps || '')];
  show({
    question: String(payload.question || ''),
    steps,
    answer: String(payload.answer || steps[steps.length - 1] || ''),
    fromTutor: true,
  });
}
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
(async () => {
  if (isElectron) {
    try {
      const settings = await window.tutor.invoke('settings:get');
      preferredTopic = settings.currentTopic || '';
    } catch { /* defaults */ }
  }
  buildTopics();
})();
