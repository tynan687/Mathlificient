// Shared theme applier: System / Light / Dark / Sepia, plus the accent colour.
//
// Every page loads this and app.css. Light and dark need no colour values at
// all — pages are built on `Canvas`/`CanvasText` through the tokens in app.css,
// and those flip on their own once `color-scheme` is set. Sepia is a set of
// values on `html[data-theme="sepia"]`, also in app.css.
//
// It used to inject a block of `!important` overrides here instead, aimed at a
// hardcoded list of four selectors. Anything added to the app after that list
// was written — the slips panel, the symbol cards, the option grid, the tabs —
// simply stayed unthemed, and there was no way to notice short of looking.
// Nothing is injected now; this file only decides which token set is live.

(function applyThemeSupport() {
  const DEFAULT_ACCENT = '#4F7DF7';

  const rgb = (hex) => {
    const h = String(hex).replace('#', '');
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  };
  const hex6 = (c) => `#${c.map((v) => Math.max(0, Math.min(255, Math.round(v)))
    .toString(16).padStart(2, '0')).join('')}`;
  const lin = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const lum = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
  const ratio = (a, b) => {
    const [x, y] = [lum(a), lum(b)];
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  };

  /**
   * A fill of the chosen accent that a label can actually be read on, and the
   * label colour to use.
   *
   * Two things go wrong if you skip this. Picking black or white by a luminance
   * threshold puts white on amber at 2.1:1 — the threshold sits right where
   * amber lands, and it is the colour a student is most likely to pick. And even
   * the default blue only manages 3.7:1 against white, under the 4.5:1 floor for
   * normal text, which a button label is.
   *
   * So: take whichever of black/white contrasts better, then walk the fill
   * toward the far end until the pair clears 4.5:1. The shift is small for a
   * colour that was nearly there and larger for one that was not, which is
   * exactly the trade you want — the accent stays recognisably what was asked
   * for, and the label is always legible.
   */
  function fillAndInk(hex) {
    if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return { fill: hex, ink: '#ffffff' };
    const white = [255, 255, 255];
    const black = [17, 17, 17];
    let fill = rgb(hex);
    const ink = ratio(fill, white) >= ratio(fill, black) ? white : black;
    // Toward black if the label is white, toward white if the label is black.
    const target = ink === white ? [0, 0, 0] : [255, 255, 255];
    for (let step = 0; step < 24 && ratio(fill, ink) < 4.5; step++) {
      fill = fill.map((v, i) => v + (target[i] - v) * 0.06);
    }
    return { fill: hex6(fill), ink: hex6(ink) };
  }

  async function apply() {
    let theme = 'system';
    let accent = DEFAULT_ACCENT;
    try {
      const settings = await window.tutor.invoke('settings:get');
      theme = settings.theme || 'system';
      if (/^#[0-9a-fA-F]{6}$/.test(settings.accent || '')) accent = settings.accent;
    } catch { /* defaults */ }

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

    // --accent is the colour as chosen: borders, links, focus rings, diagrams.
    // --accent-fill is the same colour adjusted until a label on it is readable,
    // and is what filled surfaces use.
    const { fill, ink } = fillAndInk(accent);
    root.style.setProperty('--accent', accent);
    root.style.setProperty('--accent-fill', fill);
    root.style.setProperty('--on-accent', ink);
    // A canvas cannot read a CSS variable, so the pages that draw diagrams
    // listen for this and re-read their colours.
    window.dispatchEvent(new CustomEvent('theme-applied', { detail: { theme, accent } }));
  }

  try { window.tutor.on('theme:changed', apply); } catch { /* no host */ }
  apply();
})();
