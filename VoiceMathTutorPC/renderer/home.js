// The home screen — the app's front door.
//
// Until this existed, launching Mathlificient opened the settings form: a
// 560x900 page of controls, which was also the window whose closing quit the
// app. Everything a student actually came to do was behind the bubble's
// right-click menu.
//
// Nothing here is new machinery. The session controls send the same four
// channels the settings page sends; the tools dispatch `menu:action`, which
// main.js already routes; and "continue studying" is the same recommend() and
// dueForReview() the progress screen shows, read through the same Store.

const $ = (id) => document.getElementById(id);

// ---- Tools -----------------------------------------------------------------------
//
// From nav.js, so this and the quick-action menu cannot drift apart.

let running = false;

function buildNav() {
  const wrap = $('nav');
  wrap.innerHTML = '';
  for (const group of NAV_GROUPS) {
    const heading = document.createElement('div');
    heading.className = 'grp';
    heading.textContent = group.name;
    wrap.appendChild(heading);

    const grid = document.createElement('div');
    grid.className = 'tools';
    for (const item of group.items) {
      const b = document.createElement('button');
      b.className = 'tool';
      b.dataset.action = item.action || `prompt:${item.prompt}`;
      if (item.session) b.dataset.session = '1';
      const ico = document.createElement('span');
      ico.className = 'ico';
      ico.textContent = item.icon;
      b.appendChild(ico);
      b.appendChild(document.createTextNode(item.label));
      b.addEventListener('click', () => {
        // The two searches need a term. The menu asks inline because it is a
        // popup with nowhere to go; here the bubble's menu is the right place
        // for that, so the home screen just opens it rather than growing its
        // own prompt.
        if (item.prompt) window.tutor.send('menu:open');
        else window.tutor.send('menu:action', item.action);
      });
      grid.appendChild(b);
    }
    wrap.appendChild(grid);
  }
  paintSessionState();
}

/** Session-only actions are dead weight when nothing is running. */
function paintSessionState() {
  for (const b of document.querySelectorAll('.tool[data-session]')) b.disabled = !running;
}

// ---- Continue studying --------------------------------------------------------------

async function renderContinue() {
  const wrap = $('continueWrap');
  const list = $('continue');
  if (typeof computeProficiency !== 'function' || typeof Store === 'undefined') {
    wrap.classList.add('hidden');
    return;
  }
  const log = await Store.profAll();
  const state = computeProficiency(log);

  // Same pool rule the progress screen uses: only skills that have questions.
  const pool = (typeof SKILLS !== 'undefined' && typeof templatesForSkill === 'function')
    ? SKILLS.filter((s) => templatesForSkill(s.id).length).map((s) => s.id)
    : null;

  const due = typeof dueForReview === 'function' ? dueForReview(state, pool, 1) : [];
  const picks = [
    // Something gone stale outranks something new — it is the cheaper win.
    ...due.map((d) => ({ skill: d.skill, why: 'Due for review' })),
    ...recommend(state, pool, 3).map((p) => ({ skill: p.skill, why: p.reason })),
  ];

  const seen = new Set();
  const unique = picks.filter((p) => p.skill && !seen.has(p.skill.id) && seen.add(p.skill.id))
    .slice(0, 3);

  list.innerHTML = '';
  if (!unique.length) {
    wrap.classList.add('hidden');
    return;
  }
  wrap.classList.remove('hidden');
  for (const pick of unique) {
    const row = document.createElement('div');
    row.className = 'pick';
    const text = document.createElement('div');
    const name = document.createElement('div');
    name.className = 'pick-name';
    name.textContent = pick.skill.name;
    const why = document.createElement('div');
    why.className = 'pick-why';
    why.textContent = pick.why;
    text.appendChild(name);
    text.appendChild(why);
    const go = document.createElement('button');
    go.textContent = 'Practise';
    go.addEventListener('click', () => Store.openSkill(pick.skill.id));
    row.appendChild(text);
    row.appendChild(go);
    list.appendChild(row);
  }
}

// ---- Session ---------------------------------------------------------------------------
//
// The same four channels settings.js sends. Both windows can be open at once and
// both get `ui:state`, so neither owns the session.

$('start').addEventListener('click', () => window.tutor.send('engine:start'));
$('stopBtn').addEventListener('click', () => window.tutor.send('engine:stop'));
$('muteBtn').addEventListener('click', () => window.tutor.send('engine:toggle-mute'));
$('watchBtn').addEventListener('click', () => window.tutor.send('engine:toggle-watch'));
$('practiseBtn').addEventListener('click', () => window.tutor.send('menu:action', 'practice'));
$('settingsBtn').addEventListener('click', () => window.tutor.send('menu:action', 'settings'));

window.tutor.on('ui:state', (state) => {
  running = !!state.running;
  // No glyph in the text — the dot beside it already says this, and two
  // indicators for one fact reads like a rendering bug.
  $('status').textContent = state.running ? state.status : 'Not running';
  $('dot').classList.toggle('on', running);
  $('cost').textContent = state.running
    ? `Session A$${(state.sessionCostAud || 0).toFixed(2)} (incl. GST)`
      + ` · projected A$${(state.projectedHourlyAud || 0).toFixed(2)}/hr`
    : '';
  const flags = [];
  if (state.micMuted) flags.push('Mic muted');
  if (state.watchActive) flags.push('Watch mode on');
  if (state.budgetGuardTripped) flags.push('Budget guard: reasoning lowered');
  $('flags').textContent = flags.join(' · ');
  $('error').textContent = state.lastError ? `Last error: ${state.lastError}` : '';
  $('start').disabled = running;
  $('stopBtn').disabled = !running;
  $('muteBtn').disabled = !running;
  $('muteBtn').textContent = state.micMuted ? 'Unmute' : 'Mute';
  $('watchBtn').disabled = !running;
  $('watchBtn').textContent = state.watchActive ? 'Watching ✓' : 'Watch';
  paintSessionState();
  if (!running) refreshSpend();
});

async function refreshSpend() {
  try {
    const spend = await window.tutor.invoke('spend:get');
    $('spend').textContent = `A$${spend.today.toFixed(2)} today · A$${spend.week.toFixed(2)} this week`;
  } catch { /* the rest of the screen still works */ }
}

async function init() {
  buildNav();
  try {
    const settings = await window.tutor.invoke('settings:get');
    $('topicLine').textContent = settings.currentTopic ? `working on ${settings.currentTopic}` : '';
  } catch { /* no topic line, no harm */ }
  await refreshSpend();
  await renderContinue();
}

init().catch((err) => {
  console.error('home: init failed', err);
  $('error').textContent = `Home failed to load: ${err && err.message}`;
});

// Coming back from a practice run should show the new recommendations.
window.addEventListener('focus', () => { renderContinue().catch(() => {}); });
