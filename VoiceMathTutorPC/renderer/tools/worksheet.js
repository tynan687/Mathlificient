// Renders a generated question set as a printable worksheet: numbered
// questions with blank working space, then a page-broken answer key. Data
// arrives via the 'worksheet:data' IPC push from main.js (see practice-quiz.js
// -> ipcMain.on('worksheet:open', ...)).

function tex(el, latex, display = false) {
  try {
    katex.render(latex, el, { throwOnError: false, displayMode: display });
  } catch {
    el.textContent = latex;
  }
}

const LETTERS = 'ABCD';

/**
 * The lettered option list for one question, or null.
 *
 * `buildQuestion` already put the fully-assembled, already-shuffled option set on
 * the question, so nothing is generated here — this only lays it out. It reads
 * `.latex` and NOTHING else: `why` is null on exactly the correct option, so
 * putting the option objects into the page would make the answer machine-readable
 * in the printed HTML.
 */
function optionList(q) {
  const opts = q.choices && Array.isArray(q.choices.options) ? q.choices.options : null;
  if (!opts || !opts.length) return null;
  const grid = document.createElement('div');
  grid.className = 'options';
  opts.forEach((opt, i) => {
    const cell = document.createElement('div');
    cell.className = 'option';
    const letter = document.createElement('span');
    letter.className = 'olabel';
    letter.textContent = `${LETTERS[i] || i + 1})`;
    const body = document.createElement('span');
    tex(body, opt.latex, false);
    cell.appendChild(letter);
    cell.appendChild(body);
    grid.appendChild(cell);
  });
  return grid;
}

function render(questions, mode) {
  const sub = document.getElementById('sub');
  const qWrap = document.getElementById('questions');
  const aWrap = document.getElementById('answers');
  const mcq = mode === 'mcq';
  sub.textContent = `${questions.length} question${questions.length === 1 ? '' : 's'}`
    + (mcq ? ' · multiple choice' : '');
  qWrap.innerHTML = '';
  aWrap.innerHTML = '';

  questions.forEach((q, i) => {
    const item = document.createElement('div');
    item.className = 'qitem';
    const num = document.createElement('span');
    num.className = 'qnum';
    num.textContent = `${i + 1}.`;
    const qtext = document.createElement('span');
    qtext.className = 'qtext';
    tex(qtext, q.question, false);
    item.appendChild(num);
    item.appendChild(qtext);

    // Per question, not per sheet: a template with no honest option set returns
    // choices: null, and that one item falls back to a working box inside an
    // otherwise multiple-choice worksheet — the same contract the screen has.
    const options = mcq ? optionList(q) : null;
    if (options) {
      item.appendChild(options);
    } else {
      const ws = document.createElement('div');
      ws.className = 'workspace';
      item.appendChild(ws);
    }
    qWrap.appendChild(item);

    const arow = document.createElement('div');
    arow.className = 'arow';
    const anum = document.createElement('span');
    anum.className = 'qnum';
    anum.textContent = `${i + 1}.`;
    if (options) {
      const letter = document.createElement('span');
      letter.className = 'akey';
      letter.textContent = `${LETTERS[q.choices.answerIndex] || '?'} — `;
      arow.appendChild(anum);
      arow.appendChild(letter);
    } else {
      arow.appendChild(anum);
    }
    const atext = document.createElement('span');
    tex(atext, q.answer, false);
    arow.appendChild(atext);
    aWrap.appendChild(arow);
  });
}

document.getElementById('printBtn').addEventListener('click', () => window.print());

if (typeof window.tutor !== 'undefined') {
  window.tutor.on('worksheet:data', (payload) => {
    const questions = Array.isArray(payload && payload.questions) ? payload.questions : [];
    render(questions, payload && payload.mode);
  });
}
