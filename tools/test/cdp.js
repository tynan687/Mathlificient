// Minimal CDP driver for an Android WebView reached over `adb forward`.
// Electron's Node has a global WebSocket, so no dependency is needed.
const PORT = process.env.CDP_PORT || 9223;

async function targets() {
  const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
  return res.json();
}

/** Open a session on the first page target whose URL matches, and eval in it. */
async function attach(match) {
  const list = await targets();
  // LAST match, not first: an activity left in the back stack keeps its WebView
  // registered, so the first hit is often a stale page showing pre-test state.
  const hits = list.filter((t) => t.type === 'page' && (!match || t.url.includes(match)));
  const page = hits[hits.length - 1];
  if (!page) throw new Error(`no page target matching "${match}". Saw: ` +
    list.map((t) => `${t.type}:${t.url}`).join(', '));
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

  let id = 0;
  const pending = new Map();
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    }
  };
  const send = (method, params) => new Promise((resolve, reject) => {
    const n = ++id;
    pending.set(n, { resolve, reject });
    ws.send(JSON.stringify({ id: n, method, params }));
  });

  return {
    url: page.url,
    async eval(expression) {
      const r = await send('Runtime.evaluate', {
        expression, awaitPromise: true, returnByValue: true,
      });
      if (r.exceptionDetails) {
        throw new Error(r.exceptionDetails.exception
          ? r.exceptionDetails.exception.description
          : r.exceptionDetails.text);
      }
      return r.result.value;
    },
    close() { ws.close(); },
  };
}

module.exports = { attach, targets };
