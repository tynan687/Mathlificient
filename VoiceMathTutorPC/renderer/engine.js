// Session engine — port of the Android RealtimeService. Runs hidden; owns the
// WebRTC connection, watch loop, memory tool, and cost meter.

const audioEl = document.getElementById('out');

let pc = null;
let dc = null;
let micTrack = null;
let settings = null;
let meter = null;

let running = false;
let stopping = false;
let muted = false;
let watchActive = false;
let watchTimer = null;
let responseActive = false;
let userSpeaking = false;
let pttHolding = false;
let awaitingReport = false;
let reportResolve = null;
let sessionAlerts = [];
let pendingToolResponse = false;
let queuedResponse = null; // a response.create event to fire once the current one ends

/** Start a response now, or queue it if one is already streaming (avoids API errors). */
function startOrQueueResponse(responseObj) {
  const evt = responseObj ? { type: 'response.create', response: responseObj }
    : { type: 'response.create' };
  if (responseActive) queuedResponse = evt;
  else { send(evt); setState('THINKING'); }
}
let lastWatchHash = null;
let lastAutoCapture = 0;
let downshifted = false;
let sessionStart = 0;
let notesSaved = 0;
let lastFlushedAud = 0;
let reconnectAttempts = 0;

const AUTO_CAPTURE_MIN_INTERVAL_MS = 10_000;
const MAX_RECONNECTS = 3;

let captureFallbackNoted = false;

/** Capture the configured target (a specific window, or the full screen). */
async function captureScreen() {
  const target = settings.captureTargetName
    ? { type: 'window', name: settings.captureTargetName }
    : { type: 'screen' };
  const result = await window.tutor.invoke('capture:screen', target);
  if (!result || !result.b64) return null;
  if (result.fellBack && !captureFallbackNoted) {
    captureFallbackNoted = true;
    uiUpdate({ lastError: `Capture window "${settings.captureTargetName}" not found — using full screen` });
  }
  return result.b64;
}

// ---- Wiring ----------------------------------------------------------------------

window.tutor.on('engine:start', () => start());
window.tutor.on('engine:stop', () => stop());
window.tutor.on('bubble:tap', () => onTap());
window.tutor.on('bubble:hold', (down) => onHold(down));
window.tutor.on('engine:toggle-mute', () => toggleMute());
window.tutor.on('engine:toggle-watch', () => toggleWatch());
window.tutor.on('engine:snapshot', () => sendSnapshot());
window.tutor.on('engine:practice', () => requestPractice());
window.tutor.on('engine:web-search', (query) => requestWebSearch(query));
window.tutor.on('engine:textbook-search', (query) => requestTextbookSearch(query));

function setState(state) { window.tutor.send('bubble:state', state); }
function setFlags() { window.tutor.send('bubble:flags', { muted, watching: watchActive }); }

function uiUpdate(partial) {
  uiUpdate.current = { ...uiUpdate.current, ...partial };
  window.tutor.send('ui:state', uiUpdate.current);
}
uiUpdate.current = {
  running: false, status: 'Not running', sessionCostAud: 0, projectedHourlyAud: 0,
  budgetGuardTripped: false, micMuted: false, watchActive: false, lastError: null,
};

function send(obj) {
  if (dc && dc.readyState === 'open') dc.send(JSON.stringify(obj));
}

// ---- Session lifecycle -----------------------------------------------------------

async function start() {
  if (running) return;
  running = true;
  stopping = false;
  downshifted = false;
  muted = false;
  notesSaved = 0;
  lastFlushedAud = 0;
  lastWatchHash = null;
  captureFallbackNoted = false;
  sessionAlerts = [];
  reconnectAttempts = 0;
  sessionStart = Date.now();
  settings = await window.tutor.invoke('settings:get');
  // Expose whether the student has uploaded any textbooks so the tool is offered.
  const books = await window.tutor.invoke('pdf:list');
  settings.hasPdfs = Array.isArray(books) && books.length > 0;
  meter = new CostMeter(settings.model);
  // Assessment mode implies watch-style checking at the configured interval.
  watchActive = !!settings.watchMode || !!settings.assessmentMode;
  setState('LOADING');
  setFlags();
  uiUpdate({ running: true, status: 'Connecting…', lastError: null, budgetGuardTripped: false, micMuted: false, watchActive });
  await connect();
}

async function memorySummary() {
  if (!settings.personalisationEnabled) return null;
  const memory = await window.tutor.invoke('memory:get');
  return TutorConfig.memorySummary(memory) || null;
}

async function connect() {
  try {
    const summary = await memorySummary();
    const token = await window.tutor.invoke(
      'realtime:mint',
      TutorConfig.sessionObject(settings, { includeModel: true, memorySummary: summary })
    );

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    micTrack = stream.getAudioTracks()[0];
    micTrack.enabled = !settings.pushToTalk;

    pc = new RTCPeerConnection();
    pc.addTrack(micTrack, stream);
    pc.ontrack = (e) => {
      audioEl.srcObject = e.streams[0];
      audioEl.play().catch(() => {});
    };
    pc.onconnectionstatechange = () => {
      if (stopping || !pc) return;
      if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) {
        onDisconnected(`Peer connection ${pc.connectionState}`);
      }
    };
    dc = pc.createDataChannel('oai-events');
    dc.onopen = onChannelOpen;
    dc.onmessage = (e) => {
      try { handleEvent(JSON.parse(e.data)); } catch { /* ignore */ }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await waitIceComplete(pc, 2000);

    const resp = await fetch(
      `https://api.openai.com/v1/realtime/calls?model=${settings.model}`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/sdp' },
        body: pc.localDescription.sdp,
      }
    );
    if (!resp.ok) throw new Error(`SDP exchange failed (${resp.status}): ${await resp.text()}`);
    await pc.setRemoteDescription({ type: 'answer', sdp: await resp.text() });
    reconnectAttempts = 0;
  } catch (err) {
    console.error('connect failed', err);
    uiUpdate({ status: 'Connection failed', lastError: String(err.message || err) });
    setState('ERROR');
    scheduleReconnect();
  }
}

async function onChannelOpen() {
  const summary = await memorySummary();
  send({
    type: 'session.update',
    session: TutorConfig.sessionObject(settings, {
      includeModel: false,
      effortOverride: downshifted ? 'medium' : null,
      memorySummary: summary,
    }),
  });
  setState('IDLE');
  uiUpdate({ status: 'Listening — silent until you speak' });
  startWatchLoopIfNeeded();
}

function onDisconnected(reason) {
  if (stopping) return;
  uiUpdate({ status: 'Disconnected', lastError: reason });
  setState('ERROR');
  scheduleReconnect();
}

function scheduleReconnect() {
  if (stopping) return;
  if (reconnectAttempts >= MAX_RECONNECTS) {
    // `running: false` has to ride the SAME payload. Setting the local after the
    // broadcast left `uiUpdate.current.running` true, so every screen disabled
    // Start while printing "press Start to resume" — a dead button under an
    // instruction to press it, and Stop could not clear it either (see stop()).
    running = false;
    uiUpdate({ status: 'Disconnected — press Start to resume', running: false });
    return;
  }
  reconnectAttempts++;
  setTimeout(async () => {
    closeTransport();
    setState('LOADING');
    await connect();
  }, 1500 * reconnectAttempts);
}

function closeTransport() {
  clearInterval(watchTimer);
  watchTimer = null;
  try { dc && dc.close(); } catch { /* ignore */ }
  try { pc && pc.close(); } catch { /* ignore */ }
  try { micTrack && micTrack.stop(); } catch { /* ignore */ }
  dc = null; pc = null; micTrack = null;
}

async function stop() {
  // Pressing Stop on a session that has already given up must still put the UI
  // straight, or the only control left on screen does nothing.
  if (!running && !stopping) {
    uiUpdate({ status: 'Not running', running: false });
    setState('IDLE');
    return;
  }
  if (!running || stopping) return;
  stopping = true;
  running = false;
  clearInterval(watchTimer);
  watchTimer = null;
  let report = null;
  if (settings && settings.assessmentMode && sessionAlerts.length &&
      dc && dc.readyState === 'open') {
    uiUpdate({ status: 'Writing study report…' });
    report = await requestReport();
  }
  if (meter) {
    const entry = {
      endedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
      durationMin: Math.round((Date.now() - sessionStart) / 60000),
      costAud: meter.totalAud(),
      topic: settings ? settings.currentTopic : '',
      notesAdded: notesSaved,
    };
    if (sessionAlerts.length) entry.alerts = sessionAlerts;
    if (report) entry.report = report;
    await window.tutor.invoke('studylog:append', entry);
  }
  closeTransport();
  uiUpdate({ running: false, status: 'Not running', micMuted: false, watchActive: false });
}

function waitIceComplete(peer, timeoutMs) {
  return new Promise((resolve) => {
    if (peer.iceGatheringState === 'complete') return resolve();
    const timer = setTimeout(resolve, timeoutMs);
    peer.onicegatheringstatechange = () => {
      if (peer.iceGatheringState === 'complete') {
        clearTimeout(timer);
        resolve();
      }
    };
  });
}

// ---- Event handling --------------------------------------------------------------

function handleEvent(event) {
  switch (event.type) {
    case 'input_audio_buffer.speech_started':
      userSpeaking = true;
      setState('LISTENING');
      maybeAutoCapture();
      break;

    case 'input_audio_buffer.speech_stopped':
      userSpeaking = false;
      setState('THINKING');
      break;

    case 'response.created':
      responseActive = true;
      setState('THINKING');
      break;

    case 'response.output_item.added':
      if (event.item && event.item.type === 'function_call') setState('SEARCHING');
      break;

    case 'response.output_item.done': {
      const item = event.item || {};
      if (item.type === 'function_call') {
        if (item.name === 'save_student_note') handleSaveNote(item);
        else if (item.name === 'view_textbook') handleViewTextbook(item);
        else if (item.name === 'web_search') handleWebSearch(item);
        else if (item.name === 'search_textbooks') handleSearchTextbooks(item);
        else if (item.name === 'show_working') handleShowWorking(item);
        else if (item.name === 'show_practice') handleShowPractice(item);
        else if (item.name === 'check_my_answer') handleCheckAnswer(item);
      }
      break;
    }

    case 'output_audio_buffer.started':
      setState('TALKING');
      break;

    case 'output_audio_buffer.stopped':
      setState('IDLE');
      break;

    case 'response.done': {
      responseActive = false;
      const usage = event.response && event.response.usage;
      if (usage) onUsage(usage);
      if (awaitingReport) {
        awaitingReport = false;
        if (reportResolve) {
          reportResolve(extractOutputText(event.response || {}));
          reportResolve = null;
        }
        break;
      }
      // Decide the single follow-up response to fire (never two — that errors):
      // a queued tool follow-up first, then a queued user action.
      let next = null;
      if (pendingToolResponse) next = { type: 'response.create' };
      if (!next && queuedResponse) next = queuedResponse;
      pendingToolResponse = false;
      queuedResponse = null;
      if (next) {
        send(next);
        setState('THINKING');
      } else {
        flashDone();
      }
      break;
    }

    case 'error': {
      const message = (event.error && event.error.message) || JSON.stringify(event);
      uiUpdate({ lastError: message });
      break;
    }
  }
}

let flashTimer = null;
function flashDone() {
  setState('RESPONSE_DONE');
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => setState('IDLE'), 1200);
}

async function handleSaveNote(item) {
  let args = {};
  try { args = JSON.parse(item.arguments || '{}'); } catch { /* ignore */ }
  if (args.note && String(args.note).trim()) {
    await window.tutor.invoke('memory:add', args.note);
    notesSaved++;
  }
  if (args.current_topic && String(args.current_topic).trim()) {
    settings.currentTopic = String(args.current_topic).trim();
    await window.tutor.invoke('settings:set', settings);
  }
  send({
    type: 'conversation.item.create',
    item: { type: 'function_call_output', call_id: item.call_id, output: '{"saved":true}' },
  });
  // New response only once the current one is done.
  pendingToolResponse = true;
}

/** The model asked to see the page currently open in the textbook reader window. */
async function handleViewTextbook(item) {
  let output = '{"error":"textbook window not found - ask the student to open their book"}';
  if (settings.textbookWindowName) {
    const result = await window.tutor.invoke('capture:screen', {
      type: 'window',
      name: settings.textbookWindowName,
    });
    if (result && result.b64 && !result.fellBack) {
      send(imageItemEvent(result.b64));
      output = '{"attached":true}';
    }
  }
  send({
    type: 'conversation.item.create',
    item: { type: 'function_call_output', call_id: item.call_id, output },
  });
  // Continue the spoken turn once the current response finishes.
  pendingToolResponse = true;
}

/** The model wrote a context-tailored practice question — show it in the popup. */
function handleShowPractice(item) {
  let args = {};
  try { args = JSON.parse(item.arguments || '{}'); } catch { /* ignore */ }
  if (args.question) window.tutor.send('practice:push', args);
  send({
    type: 'conversation.item.create',
    item: { type: 'function_call_output', call_id: item.call_id, output: '{"shown":true}' },
  });
  pendingToolResponse = true;
}

/**
 * The model wants to know whether the student got it right. The practice page
 * marks it and returns a verdict; the answer itself never crosses this boundary.
 */
async function handleCheckAnswer(item) {
  let args = {};
  try { args = JSON.parse(item.arguments || '{}'); } catch { /* ignore */ }
  let result;
  try {
    result = await window.tutor.invoke('practice:check', { heard: args.heard || '' });
  } catch (err) {
    result = { verdict: 'unsure', reason: err.message };
  }
  // Send the working WITH the verdict, not on a second request. The moment the
  // model learns they got it wrong is the moment it needs to see where — asking
  // for the image separately costs a round trip and a turn of conversation.
  if (result && result.workingToSee) {
    try {
      const b64 = await window.tutor.invoke('practice:working');
      if (b64) send(imageItemEvent(b64));
    } catch { /* the verdict alone is still useful */ }
  }
  send({
    type: 'conversation.item.create',
    item: {
      type: 'function_call_output',
      call_id: item.call_id,
      output: JSON.stringify(result || { verdict: 'unsure' }),
    },
  });
  pendingToolResponse = true;
}

/** The model is demonstrating working — push the LaTeX steps to the panel. */
function handleShowWorking(item) {
  let args = {};
  try { args = JSON.parse(item.arguments || '{}'); } catch { /* ignore */ }
  if (args.steps) window.tutor.send('working:push', args);
  send({
    type: 'conversation.item.create',
    item: { type: 'function_call_output', call_id: item.call_id, output: '{"shown":true}' },
  });
  pendingToolResponse = true;
}

async function handleWebSearch(item) {
  let args = {};
  try { args = JSON.parse(item.arguments || '{}'); } catch { /* ignore */ }
  const res = await window.tutor.invoke('search:web', args.query || '');
  send({
    type: 'conversation.item.create',
    item: {
      type: 'function_call_output',
      call_id: item.call_id,
      output: JSON.stringify(res).slice(0, 4000),
    },
  });
  pendingToolResponse = true;
}

async function handleSearchTextbooks(item) {
  let args = {};
  try { args = JSON.parse(item.arguments || '{}'); } catch { /* ignore */ }
  const res = await window.tutor.invoke('pdf:search', {
    query: args.query || '',
    retrievalModel: settings.retrievalModel,
  });
  send({
    type: 'conversation.item.create',
    item: {
      type: 'function_call_output',
      call_id: item.call_id,
      output: JSON.stringify(res).slice(0, 2000),
    },
  });
  pendingToolResponse = true;
}

function onUsage(usage) {
  meter.addUsage(usage);
  const total = meter.totalAud();
  const projected = meter.projectedHourlyAud();
  uiUpdate({ sessionCostAud: total, projectedHourlyAud: projected });
  const delta = total - lastFlushedAud;
  if (delta > 0) {
    window.tutor.invoke('spend:add', delta);
    lastFlushedAud = total;
  }
  if (!downshifted && projected > settings.softCapAud) {
    downshifted = true;
    memorySummary().then((summary) => {
      send({
        type: 'session.update',
        session: TutorConfig.sessionObject(settings, {
          includeModel: false, effortOverride: 'medium', memorySummary: summary,
        }),
      });
    });
    uiUpdate({ budgetGuardTripped: true });
  }
}

// ---- Actions ---------------------------------------------------------------------

function imageItemEvent(base64Jpeg) {
  return {
    type: 'conversation.item.create',
    item: {
      type: 'message',
      role: 'user',
      content: [{
        type: 'input_image',
        detail: 'high',
        image_url: `data:image/jpeg;base64,${base64Jpeg}`,
      }],
    },
  };
}

async function onTap() {
  if (!running || !dc) return;
  if (settings.tapAction === 'snapshot') {
    const b64 = await captureScreen();
    if (b64) {
      send(imageItemEvent(b64));
      lastAutoCapture = Date.now();
      flashDone(); // green flash = captured
    }
  } else {
    setState('THINKING');
    const b64 = await captureScreen();
    if (b64) {
      send(imageItemEvent(b64));
      lastAutoCapture = Date.now();
    }
    startOrQueueResponse({
      instructions:
        'The student tapped the help bubble and shared their screen. Look at the ' +
        'latest screenshot and give one concise Socratic hint about the step they ' +
        'appear stuck on. Do not state the final answer.',
    });
  }
}

/** Menu → silent snapshot (pushes the screen into context, no spoken reply). */
async function sendSnapshot() {
  if (!running || !dc) return;
  const b64 = await captureScreen();
  if (b64) {
    send(imageItemEvent(b64));
    lastAutoCapture = Date.now();
    flashDone();
  }
}

/** Menu → generate an analogous practice problem from what's on screen. */
async function requestPractice() {
  if (!running || !dc) return;
  setState('THINKING');
  const b64 = await captureScreen();
  if (b64) send(imageItemEvent(b64));
  startOrQueueResponse({
    instructions:
      'The student wants a practice question. Write ONE question tailored to what ' +
      'you have been discussing (see the latest screenshot for their current work), ' +
      'with worked steps and the answer, and call show_practice with it. Briefly ' +
      'introduce it aloud - do not read the maths out, and do not solve their ' +
      'actual problem.',
  });
}

/** Menu → web search: ask the model, which will call its web_search tool. */
function requestWebSearch(query) {
  if (!running || !dc || !query) return;
  send({
    type: 'conversation.item.create',
    item: {
      type: 'message', role: 'user',
      content: [{ type: 'input_text', text: `Search the web for "${query}" and tell me what you find.` }],
    },
  });
  startOrQueueResponse();
}

/** Menu → textbook search: ask the model, which will call search_textbooks. */
function requestTextbookSearch(query) {
  if (!running || !dc || !query) return;
  send({
    type: 'conversation.item.create',
    item: {
      type: 'message', role: 'user',
      content: [{ type: 'input_text', text: `Where in my textbooks can I read about "${query}"?` }],
    },
  });
  startOrQueueResponse();
}

function onHold(down) {
  if (!running || !settings.pushToTalk || !micTrack) return;
  if (down) {
    pttHolding = true;
    micTrack.enabled = true;
    setState('LISTENING');
  } else {
    pttHolding = false;
    micTrack.enabled = false;
    setState('THINKING');
    (async () => {
      const b64 = await captureScreen();
      if (b64) send(imageItemEvent(b64));
      send({ type: 'input_audio_buffer.commit' });
      send({ type: 'response.create' });
    })();
  }
}

async function maybeAutoCapture() {
  const now = Date.now();
  if (now - lastAutoCapture < AUTO_CAPTURE_MIN_INTERVAL_MS) return;
  lastAutoCapture = now;
  const b64 = await captureScreen();
  if (b64) send(imageItemEvent(b64));
}

function toggleMute() {
  if (!running || !micTrack || settings.pushToTalk) return;
  muted = !muted;
  micTrack.enabled = !muted;
  setFlags();
  uiUpdate({ micMuted: muted });
}

// ---- Watch mode ------------------------------------------------------------------

function toggleWatch() {
  if (!running) return;
  watchActive = !watchActive;
  startWatchLoopIfNeeded();
}

function startWatchLoopIfNeeded() {
  clearInterval(watchTimer);
  watchTimer = null;
  if (watchActive) {
    watchTimer = setInterval(runWatchCheck, settings.watchIntervalSec * 1000);
  }
  setFlags();
  uiUpdate({ watchActive });
}

async function runWatchCheck() {
  if (!running || !dc) return;
  if (responseActive || userSpeaking || muted || pttHolding) return;
  const b64 = await captureScreen();
  if (!b64) return;
  const hash = simpleHash(b64);
  if (hash === lastWatchHash) return; // screen unchanged — costs nothing
  lastWatchHash = hash;
  // Checks run on the cheap vision model — the realtime session isn't touched
  // (no cache-busting, no image context growth). Only a confirmed ALERT reaches
  // the voice model, as a spoken interruption.
  const res = await window.tutor.invoke('vision:check', {
    b64,
    model: settings.retrievalModel,
  });
  if (!res || !res.verdict) return; // helper unavailable → skip quietly
  if (!/alert/i.test(res.verdict)) return;
  sessionAlerts.push(res.verdict);
  startOrQueueResponse({ instructions: alertInstructions(res.verdict) });
}

/** Spoken-interruption instructions for a watch-check ALERT. */
function alertInstructions(verdict) {
  return settings.assessmentMode
    ? `The watch system flagged a mistake in the student's working: "${verdict}". Stop ` +
      'them now, directly and briefly: name the line, say what went wrong and how to ' +
      'get back on track, then let them continue. If this kind of mistake has come up ' +
      'before this session, add one pointer to the relevant textbook section or a ' +
      'short search phrase.'
    : `The watch system flagged a mistake in the student's working: "${verdict}". ` +
      'Interrupt briefly and kindly: name the specific line and ask one question ' +
      'that helps them see the error themselves. Do not state the corrected result.';
}

/** Ask for the end-of-session study report (text-only); resolves null on timeout. */
function requestReport() {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      awaitingReport = false;
      reportResolve = null;
      resolve(null);
    }, 12_000);
    reportResolve = (text) => {
      clearTimeout(timeout);
      resolve(text || null);
    };
    awaitingReport = true;
    send({
      type: 'response.create',
      response: {
        output_modalities: ['text'],
        instructions: TutorConfig.ASSESSMENT_REPORT_INSTRUCTIONS,
        max_output_tokens: 400,
      },
    });
  });
}

function extractOutputText(response) {
  const parts = [];
  for (const item of response.output || []) {
    for (const content of item.content || []) {
      if (content.text) parts.push(content.text);
    }
  }
  return parts.join(' ').trim();
}

function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i += 7) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return hash + ':' + str.length;
}
