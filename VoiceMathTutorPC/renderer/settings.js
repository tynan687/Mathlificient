// Settings window logic.

const $ = (id) => document.getElementById(id);
let settings = null;

const SELECTS = {
  model: TutorConfig.MODELS,
  reasoningEffort: TutorConfig.EFFORTS,
  vadEagerness: TutorConfig.EAGERNESS,
  voice: TutorConfig.VOICES,
  tapAction: TutorConfig.TAP_ACTIONS,
  watchIntervalSec: TutorConfig.WATCH_INTERVALS,
};
const CHECKS = ['pushToTalk', 'personalisationEnabled', 'watchMode', 'assessmentMode'];
// Note: pushToTalk now defaults ON (mic locked; hold the bubble to talk).

/**
 * Run one piece of setup, and let the rest happen even if it fails.
 *
 * init() wires a dozen controls in sequence, so a single rejected invoke used to
 * abandon every line after it — silently, since nothing was catching. Losing the
 * spend readout because the capture list failed is a bad trade, and losing it
 * without a word is worse.
 */
async function safely(what, fn) {
  try {
    return await fn();
  } catch (err) {
    console.error(`settings: ${what} failed`, err);
    const box = $('error');
    if (box) box.textContent = `Could not load ${what}: ${err && err.message}`;
    return null;
  }
}

async function init() {
  settings = await window.tutor.invoke('settings:get');

  for (const [id, options] of Object.entries(SELECTS)) {
    const select = $(id);
    for (const option of options) {
      const el = document.createElement('option');
      el.value = String(option);
      el.textContent = String(option);
      select.appendChild(el);
    }
    select.value = String(settings[id]);
    select.addEventListener('change', () => {
      settings[id] = id === 'watchIntervalSec' ? Number(select.value) : select.value;
      save();
    });
  }

  for (const id of CHECKS) {
    $(id).checked = !!settings[id];
    $(id).addEventListener('change', () => {
      settings[id] = $(id).checked;
      save();
    });
  }

  $('currentTopic').value = settings.currentTopic;
  $('currentTopic').addEventListener('input', () => {
    settings.currentTopic = $('currentTopic').value;
    save();
  });

  $('textbook').value = settings.textbook || '';
  $('textbook').addEventListener('input', () => {
    settings.textbook = $('textbook').value;
    save();
  });

  const themeSel = $('theme');
  for (const t of ['system', 'light', 'dark', 'sepia']) {
    themeSel.appendChild(new Option(t, t));
  }
  themeSel.value = settings.theme || 'system';
  themeSel.addEventListener('change', () => {
    settings.theme = themeSel.value;
    save();
    window.tutor.send('theme:changed');
  });

  $('retrievalModel').value = settings.retrievalModel || '';
  $('retrievalModel').addEventListener('input', () => {
    settings.retrievalModel = $('retrievalModel').value.trim();
    save();
  });
  $('addPdf').addEventListener('click', async () => {
    $('addPdf').disabled = true;
    $('addPdf').textContent = 'Indexing…';
    let result = null;
    try { result = await window.tutor.invoke('pdf:add'); } catch (e) { /* ignore */ }
    $('addPdf').disabled = false;
    $('addPdf').textContent = 'Add PDF…';
    if (result && result.warning) alert(result.warning);
    renderPdfs();
  });
  renderPdfs();

  initBubbleControls();

  $('softCapAud').value = settings.softCapAud;
  $('capLabel').textContent = `A$${settings.softCapAud}/hour`;
  $('softCapAud').addEventListener('input', () => {
    settings.softCapAud = Number($('softCapAud').value);
    $('capLabel').textContent = `A$${settings.softCapAud}/hour`;
    save();
  });

  await safely('the key status', async () => {
    $('keyHint').textContent = (await window.tutor.invoke('apikey:exists'))
      ? 'A key is saved (encrypted on-device). Enter a new one to replace it.'
      : 'Paste your OpenAI API key to get started.';
  });

  await safely('the capture list', refreshCaptureList);
  $('captureTarget').addEventListener('change', () => {
    settings.captureTargetName = $('captureTarget').value;
    save();
  });
  $('textbookWindow').addEventListener('change', () => {
    settings.textbookWindowName = $('textbookWindow').value;
    save();
  });
  $('refreshCapture').addEventListener('click', refreshCaptureList);

  safely('spend so far', refreshSpend);
  safely('the study log', refreshStudyLog);
}

async function renderPdfs() {
  const books = await window.tutor.invoke('pdf:list');
  $('pdfCount').textContent = books.length
    ? `${books.length} book${books.length > 1 ? 's' : ''} indexed`
    : 'No books yet';
  const list = $('pdfList');
  list.innerHTML = '';
  for (const book of books) {
    const row = document.createElement('div');
    row.className = 'note';
    const name = document.createElement('div');
    const warn = book.noText
      ? ' · ⚠ no text layer (scanned — not searchable)' : '';
    name.innerHTML = `${escapeHtml(book.title)}<br><span class="muted">${book.pageCount} pages${warn}</span>`;
    const del = document.createElement('button');
    del.textContent = 'Remove';
    del.addEventListener('click', async () => {
      await window.tutor.invoke('pdf:remove', book.id);
      renderPdfs();
    });
    row.appendChild(name);
    row.appendChild(del);
    list.appendChild(row);
  }
}

const BUBBLE_COLORS = ['#4F7DF7', '#2FB65D', '#8E5CF7', '#F0A322', '#E5484D', '#111827'];
const BUBBLE_GLYPHS = ['π', '∑', '∫', '√', 'ƒ', 'Δ'];

function initBubbleControls() {
  const swatches = $('swatches');
  BUBBLE_COLORS.forEach((c) => {
    const dot = document.createElement('span');
    dot.style.cssText = `width:22px;height:22px;border-radius:50%;background:${c};`
      + 'cursor:pointer;border:2px solid transparent';
    dot.addEventListener('click', () => { setBubble({ bubbleColor: c }); $('bubbleColor').value = c; });
    swatches.appendChild(dot);
  });
  $('bubbleColor').value = settings.bubbleColor;
  $('bubbleColor').addEventListener('input', () => setBubble({ bubbleColor: $('bubbleColor').value }));

  const glyphs = $('glyphs');
  BUBBLE_GLYPHS.forEach((g) => {
    const b = document.createElement('button');
    b.textContent = g;
    b.style.cssText = 'width:34px;font-size:16px';
    b.addEventListener('click', () => setBubble({ bubbleGlyph: g }));
    glyphs.appendChild(b);
  });

  $('bubbleSize').value = settings.bubbleSize;
  $('sizeLabel').textContent = `${settings.bubbleSize}px`;
  $('bubbleSize').addEventListener('input', () => {
    $('sizeLabel').textContent = `${$('bubbleSize').value}px`;
    setBubble({ bubbleSize: Number($('bubbleSize').value) });
  });
  $('bubbleOpacity').value = settings.bubbleOpacity;
  $('bubbleOpacity').addEventListener('input', () =>
    setBubble({ bubbleOpacity: Number($('bubbleOpacity').value) }));
}

function setBubble(partial) {
  Object.assign(settings, partial);
  save();
  window.tutor.send('bubble:restyle');
}

async function refreshCaptureList() {
  const sources = await window.tutor.invoke('capture:list-sources');
  const windows = sources.filter((s) => s.type === 'window');
  fillWindowSelect($('captureTarget'), windows, settings.captureTargetName, 'Entire screen');
  fillWindowSelect($('textbookWindow'), windows, settings.textbookWindowName, 'None');
}

function fillWindowSelect(select, windows, savedName, emptyLabel) {
  select.innerHTML = '';
  const emptyOption = document.createElement('option');
  emptyOption.value = '';
  emptyOption.textContent = emptyLabel;
  select.appendChild(emptyOption);
  let savedSeen = !savedName;
  for (const source of windows) {
    const option = document.createElement('option');
    option.value = source.name;
    option.textContent = source.name.length > 70 ? source.name.slice(0, 67) + '…' : source.name;
    select.appendChild(option);
    if (source.name === savedName) savedSeen = true;
  }
  if (!savedSeen) {
    const option = document.createElement('option');
    option.value = savedName;
    option.textContent = `(saved) ${savedName}`;
    select.appendChild(option);
  }
  select.value = savedName || '';
}

function save() {
  window.tutor.invoke('settings:set', settings);
}

// ---- Buttons ---------------------------------------------------------------------

$('saveKey').addEventListener('click', async () => {
  const key = $('apiKey').value.trim();
  if (!key) return;
  await window.tutor.invoke('apikey:save', key);
  $('apiKey').value = '';
  $('keyHint').textContent = 'Key saved (encrypted on-device).';
});

$('start').addEventListener('click', () => window.tutor.send('engine:start'));
$('stopBtn').addEventListener('click', () => window.tutor.send('engine:stop'));
$('muteBtn').addEventListener('click', () => window.tutor.send('engine:toggle-mute'));
$('watchBtn').addEventListener('click', () => window.tutor.send('engine:toggle-watch'));

// ---- Live status -----------------------------------------------------------------

window.tutor.on('ui:state', (state) => {
  $('status').textContent = state.running ? `● ${state.status}` : '○ Not running';
  $('cost').textContent = state.running
    ? `Session A$${state.sessionCostAud.toFixed(2)} (incl. GST) · projected A$${state.projectedHourlyAud.toFixed(2)}/hr`
    : '';
  const flags = [];
  if (state.micMuted) flags.push('Mic muted');
  if (state.watchActive) flags.push('Watch mode on — speaks up on a clear mistake');
  if (state.budgetGuardTripped) flags.push('Budget guard: reasoning lowered to medium');
  $('flags').textContent = flags.join(' · ');
  $('error').textContent = state.lastError ? `Last error: ${state.lastError}` : '';
  $('start').disabled = state.running;
  $('stopBtn').disabled = !state.running;
  $('muteBtn').disabled = !state.running || settings.pushToTalk;
  $('muteBtn').textContent = state.micMuted ? 'Unmute' : 'Mute';
  $('watchBtn').disabled = !state.running;
  $('watchBtn').textContent = state.watchActive ? 'Watching ✓' : 'Watch';
  if (!state.running) {
    refreshSpend();
    refreshStudyLog();
  }
});

async function refreshSpend() {
  const spend = await window.tutor.invoke('spend:get');
  $('spend').textContent =
    `Spend today: A$${spend.today.toFixed(2)} · this week: A$${spend.week.toFixed(2)}`;
}

async function refreshStudyLog() {
  const log = await window.tutor.invoke('studylog:get');
  const recent = (log.sessions || []).slice(-10).reverse();
  const target = $('studyLog');
  if (!recent.length) {
    target.innerHTML = '<span class="muted">Your sessions will appear here.</span>';
    return;
  }
  target.innerHTML = '';
  for (const entry of recent) {
    const div = document.createElement('div');
    div.className = 'logline';
    const notes = entry.notesAdded > 0 ? ` · ${entry.notesAdded} notes` : '';
    const stops = entry.alerts && entry.alerts.length ? ` · ${entry.alerts.length} stops` : '';
    div.textContent =
      `${entry.endedAt} · ${entry.durationMin} min · A$${Number(entry.costAud).toFixed(2)} · ${entry.topic}${notes}${stops}`;
    target.appendChild(div);
    if (entry.report) {
      const details = document.createElement('details');
      const summary = document.createElement('summary');
      summary.textContent = 'Study report';
      summary.style.cursor = 'pointer';
      details.appendChild(summary);
      const body = document.createElement('div');
      body.className = 'muted';
      body.style.whiteSpace = 'pre-wrap';
      body.textContent = entry.report;
      details.appendChild(body);
      target.appendChild(details);
    }
  }
}

// ---- Memory dialog ---------------------------------------------------------------

$('viewMemory').addEventListener('click', async () => {
  await renderMemory();
  $('memoryDialog').showModal();
});
$('closeMemory').addEventListener('click', () => $('memoryDialog').close());
$('clearMemory').addEventListener('click', async () => {
  await window.tutor.invoke('memory:clear');
  await renderMemory();
});

async function renderMemory() {
  const memory = await window.tutor.invoke('memory:get');
  const notes = memory.notes || [];
  const tokens = Math.round(TutorConfig.memorySummary(memory).length / 4);
  $('memoryMeta').textContent = `(${notes.length} notes · ~${tokens} tokens · < A$0.01/hr)`;
  const list = $('memoryList');
  list.innerHTML = '';
  if (!notes.length) {
    list.innerHTML = '<span class="muted">Nothing saved yet. The tutor adds notes as it gets to know you.</span>';
    return;
  }
  notes.map((note, index) => ({ note, index })).reverse().forEach(({ note, index }) => {
    const row = document.createElement('div');
    row.className = 'note';
    const body = document.createElement('div');
    body.innerHTML = `${escapeHtml(note.text)}<br><span class="muted">${note.date}</span>`;
    const del = document.createElement('button');
    del.textContent = 'Delete';
    del.addEventListener('click', async () => {
      await window.tutor.invoke('memory:delete', index);
      await renderMemory();
    });
    row.appendChild(body);
    row.appendChild(del);
    list.appendChild(row);
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

init().catch((err) => {
  // The last resort: init() is fired and forgotten, so without this a failure
  // before the first `safely` leaves a blank settings window and no clue why.
  console.error('settings: init failed', err);
  const box = document.getElementById('error');
  if (box) box.textContent = `Settings failed to load: ${err && err.message}`;
});
