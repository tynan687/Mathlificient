// Worked-examples panel: the tutor pushes step-by-step LaTeX here (show_working
// tool) while it talks; each example renders with KaTeX and can be copied.

const feed = document.getElementById('feed');

function flash(el, text = 'copied') {
  const note = document.createElement('span');
  note.className = 'copied';
  note.textContent = text;
  el.after(note);
  setTimeout(() => note.remove(), 1200);
}

/** Copy, and only say "copied" if it actually copied. */
function copyAndFlash(el, text) {
  navigator.clipboard.writeText(text)
    .then(() => flash(el))
    .catch(() => flash(el, 'copy failed'));
}

function renderExample(example, { prepend = false } = {}) {
  const card = document.createElement('div');
  card.className = 'example';

  const title = document.createElement('div');
  title.className = 'title';
  title.textContent = example.title || 'Worked example';
  if (example.when) {
    const when = document.createElement('span');
    when.className = 'when';
    when.textContent = example.when;
    title.appendChild(when);
  }
  card.appendChild(title);

  const steps = Array.isArray(example.steps) ? example.steps : [String(example.steps || '')];
  for (const step of steps) {
    const div = document.createElement('div');
    div.className = 'step';
    try {
      katex.render(step, div, { throwOnError: false, displayMode: true });
    } catch {
      div.textContent = step;
    }
    card.appendChild(div);
  }

  if (example.note) {
    const note = document.createElement('div');
    note.className = 'note';
    note.textContent = example.note;
    card.appendChild(note);
  }

  const btns = document.createElement('div');
  btns.className = 'btns';
  const copyLatex = document.createElement('button');
  copyLatex.textContent = 'Copy LaTeX';
  copyLatex.addEventListener('click', () => {
    copyAndFlash(copyLatex, steps.join('\n'));
  });
  btns.appendChild(copyLatex);
  card.appendChild(btns);

  if (prepend && feed.firstChild) feed.insertBefore(card, feed.firstChild);
  else feed.appendChild(card);
}

function renderEmpty() {
  feed.innerHTML = '<div class="empty">When the tutor demonstrates how to solve ' +
    'something, the steps appear here — ask it to "show me the working".</div>';
}

async function load() {
  const items = await window.tutor.invoke('working:list');
  feed.innerHTML = '';
  if (!items.length) return renderEmpty();
  // newest first
  [...items].reverse().forEach((ex) => renderExample(ex));
}

window.tutor.on('working:new', (example) => {
  if (feed.querySelector('.empty')) feed.innerHTML = '';
  renderExample(example, { prepend: true });
});

document.getElementById('clearAll').addEventListener('click', async () => {
  await window.tutor.invoke('working:clear');
  renderEmpty();
});

load();
