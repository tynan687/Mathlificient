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

let vizOpen = false;
let paperColors = null; // set by applyPaper (Android); PC derives from page styles

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
  const formulas = (typeof PRACTICE_FORMULAS !== 'undefined' && PRACTICE_FORMULAS[template.id]) || [];
  show({ ...template.generate(), formulas, fromTutor: false }, template.topic);
}

function show(item, label) {
  current = item;
  revealed = 0;
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

  nextBtn.disabled = false;
  nextBtn.textContent = 'Show next step';
  answerBtn.disabled = false;
  copyBtn.disabled = false;
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
    formulas: Array.isArray(payload.formulas) ? payload.formulas : [],
    fromTutor: true,
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
    `.step{border-top-color:${fg}33!important}`;
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
(async () => {
  if (isElectron) {
    try {
      const settings = await window.tutor.invoke('settings:get');
      preferredTopic = settings.currentTopic || '';
    } catch { /* defaults */ }
  }
  buildTopics();
})();
