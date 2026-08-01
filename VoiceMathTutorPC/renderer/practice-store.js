// Storage shim for proficiency — shared by the PC and Android apps.
//
// Three backends behind one promise-returning API, following the same
// environment-guard convention the rest of the shared code uses:
//   • Electron  -> window.tutor IPC        (proficiency.json in userData)
//   • Android   -> the Android JS bridge   (proficiency.json in filesDir)
//   • neither   -> in-memory               (browser testing, the worksheet
//                                           window, anything without a host)
//
// The in-memory fallback means nothing here ever throws just because it's
// running somewhere unexpected — a page that records attempts still works, it
// simply forgets them.

const Store = (() => {
  const isElectron = typeof window !== 'undefined' && typeof window.tutor !== 'undefined';
  const hasBridge = typeof Android !== 'undefined' && typeof Android.profAll === 'function';

  const EMPTY = () => ({ version: 1, attempts: [] });
  let memory = EMPTY();

  function parse(raw) {
    try {
      const o = JSON.parse(raw);
      return o && Array.isArray(o.attempts) ? o : EMPTY();
    } catch { return EMPTY(); }
  }

  return {
    backend: isElectron ? 'electron' : hasBridge ? 'android' : 'memory',

    /** The whole attempt log. Never rejects — a broken file reads as empty. */
    async profAll() {
      try {
        if (isElectron) return (await window.tutor.invoke('prof:all')) || EMPTY();
        if (hasBridge) return parse(Android.profAll());
      } catch { /* fall through to memory */ }
      return memory;
    },

    /** Append one attempt. Fire-and-forget from the caller's point of view. */
    async profAppend(attempt) {
      if (!attempt || !attempt.skill) return;
      try {
        if (isElectron) { await window.tutor.invoke('prof:append', attempt); return; }
        if (hasBridge) { Android.profAppend(JSON.stringify(attempt)); return; }
      } catch { /* fall through to memory */ }
      memory.attempts.push(attempt);
    },

    async profReset() {
      try {
        if (isElectron) { await window.tutor.invoke('prof:reset'); return; }
        if (hasBridge) { Android.profReset(); return; }
      } catch { /* fall through */ }
      memory = EMPTY();
    },

    /** Jump to the practice page focused on a skill. No-op where unsupported. */
    openSkill(skillId) {
      try {
        if (isElectron) { window.tutor.send('practice:skill', skillId); return true; }
        if (typeof Android !== 'undefined' && typeof Android.openSkill === 'function') {
          Android.openSkill(skillId); return true;
        }
      } catch { /* ignore */ }
      return false;
    },
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = { Store };
