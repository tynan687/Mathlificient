// Shared theme applier: System / Light / Dark / Sepia.
// Dark/light work by forcing `color-scheme` (pages use Canvas/CanvasText system
// colors, which flip automatically). Sepia injects explicit overrides.

(function applyThemeSupport() {
  const SEPIA_CSS = `
    html[data-theme="sepia"] body {
      background: #f4ecd8 !important;
      color: #5b4636 !important;
    }
    html[data-theme="sepia"] .card,
    html[data-theme="sepia"] .example,
    html[data-theme="sepia"] .f {
      background: #efe3c8 !important;
      border-color: #d8c9a3 !important;
    }
    html[data-theme="sepia"] input,
    html[data-theme="sepia"] select,
    html[data-theme="sepia"] button {
      background: #faf3e3 !important;
      color: #5b4636 !important;
      border-color: #c9b990 !important;
    }
    html[data-theme="sepia"] button.primary { background: #a0703c !important;
      border-color: #a0703c !important; color: #fff !important; }
    html[data-theme="sepia"] .menu {
      background: #efe3c8 !important; color: #5b4636 !important;
    }
    html[data-theme="sepia"] .menu .item:hover { background: #e2d3ae !important; }
    html[data-theme="sepia"] .menu .sep { background: #d8c9a3 !important; }
  `;

  const style = document.createElement('style');
  style.textContent = SEPIA_CSS;
  document.head.appendChild(style);

  async function apply() {
    let theme = 'system';
    try {
      const settings = await window.tutor.invoke('settings:get');
      theme = settings.theme || 'system';
    } catch { /* default */ }
    const root = document.documentElement;
    root.removeAttribute('data-theme');
    if (theme === 'dark') {
      root.style.colorScheme = 'dark';
    } else if (theme === 'light') {
      root.style.colorScheme = 'light';
    } else if (theme === 'sepia') {
      root.style.colorScheme = 'light';
      root.setAttribute('data-theme', 'sepia');
    } else {
      root.style.colorScheme = '';
    }
  }

  window.tutor.on('theme:changed', apply);
  apply();
})();
