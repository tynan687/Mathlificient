// The one list of things the app can do.
//
// The quick-action menu and the home screen both offer the same actions, and
// before this they were two hardcoded lists that had no way of staying in step.
// Every entry dispatches through `menu:action`, which main.js already routes —
// so adding something here needs a case there and nothing else.
//
// `session: true` marks an action that only means anything while the tutor is
// running. The home screen greys those out when it is not; the menu is only
// reachable from the bubble, so it shows them regardless.

const NAV_GROUPS = [
  {
    name: 'Tutor',
    items: [
      { action: 'ask', icon: '💡', label: 'Ask about my screen', session: true },
      { action: 'snapshot', icon: '📸', label: 'Silent snapshot', session: true },
      { action: 'practice', icon: '🎯', label: 'New practice problem' },
      { prompt: 'web', icon: '🌐', label: 'Web search…', session: true },
      { prompt: 'textbook', icon: '📚', label: 'Search my textbooks…', session: true },
    ],
  },
  {
    name: 'Session',
    items: [
      { action: 'watch', icon: '👁️', label: 'Toggle watch mode', session: true },
      { action: 'mute', icon: '🔇', label: 'Toggle mute', session: true },
    ],
  },
  {
    name: 'Tools',
    items: [
      { action: 'converter', icon: '📐', label: 'Unit & constant converter' },
      { action: 'timer', icon: '⏱️', label: 'Focus timer' },
      { action: 'ambient', icon: '🌧', label: 'Ambient sound' },
      { action: 'formulas', icon: '🧮', label: 'Formula cheat-sheet' },
      { action: 'symbols', icon: '∫', label: 'Symbols & how to read them' },
      { action: 'progress', icon: '📊', label: 'My progress' },
      { action: 'chat', icon: '📝', label: 'Worked examples' },
    ],
  },
];

/** Flat, for anything that does not care about the grouping. */
const NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

/** The two searches open an inline prompt rather than firing straight away. */
const NAV_PROMPTS = {
  web: { label: 'Search the web for:', channel: 'engine:web-search' },
  textbook: { label: 'Find in my textbooks:', channel: 'engine:textbook-search' },
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { NAV_GROUPS, NAV_ITEMS, NAV_PROMPTS };
}
