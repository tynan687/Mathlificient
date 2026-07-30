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

function render(questions) {
  const sub = document.getElementById('sub');
  const qWrap = document.getElementById('questions');
  const aWrap = document.getElementById('answers');
  sub.textContent = `${questions.length} question${questions.length === 1 ? '' : 's'}`;
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
    const ws = document.createElement('div');
    ws.className = 'workspace';
    item.appendChild(ws);
    qWrap.appendChild(item);

    const arow = document.createElement('div');
    arow.className = 'arow';
    const anum = document.createElement('span');
    anum.className = 'qnum';
    anum.textContent = `${i + 1}.`;
    const atext = document.createElement('span');
    tex(atext, q.answer, false);
    arow.appendChild(anum);
    arow.appendChild(atext);
    aWrap.appendChild(arow);
  });
}

document.getElementById('printBtn').addEventListener('click', () => window.print());

if (typeof window.tutor !== 'undefined') {
  window.tutor.on('worksheet:data', (payload) => {
    const questions = Array.isArray(payload && payload.questions) ? payload.questions : [];
    render(questions);
  });
}
