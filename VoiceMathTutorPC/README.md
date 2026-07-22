# Voice Math Tutor — PC (Windows)

Electron port of the Android tutor. Same brain, same features: voice conversation
with `gpt-realtime-2.1` over WebRTC, on-demand screenshots of your PC screen,
floating always-on-top π bubble, personalisation memory, watch mode, silent
snapshot tap, cost meter with budget guard, study log, and spend tracking.

PC differences vs the tablet app:
- **Capture target picker** — Settings → Capture lets you point the tutor at a
  single window instead of the whole screen: pick your **browser window with Word
  for the web open** (the primary workflow — it reads your typed equations), or a
  math-game window. The choice is matched by window title so it survives
  restarts; if the window disappears mid-session it falls back to full screen
  and says so in the status area.
- **No screen-capture consent prompt** — Windows lets the app capture directly
  (with "Entire screen" it sees whatever is on screen, so close anything private
  before starting a session — or just pick a single window).
- **Assessment mode** (Settings card): early intervention for writing projects —
  rides the watch-check machinery but intervenes *directly*: it stops you as soon
  as a lengthy derivation goes wrong, names the line, says what went wrong (sign
  flip, bad factor, illegal cancellation) and how to get back on track, then lets
  you continue. If the same kind of mistake recurs, it points you to your
  **textbook** (set it in the same card — section names, page numbers only when
  it's confident, no invented pages). Pressing Stop generates a **study report**:
  mistakes grouped by topic, likely misconceptions, textbook sections to reread,
  and search phrases — saved under the session in the study log. Use in line with
  your course's AI policy.
- **Textbook window (Kindle)** — Settings → Capture has a second slot for your
  e-book reader. Open your book in Kindle Cloud Reader (read.amazon.com) or the
  Kindle desktop app — signed in yourself; the app never touches your Amazon
  account — and pick that window. The tutor gets a `view_textbook` tool: it can
  look at whichever page you currently have open, ask you to flip to a section
  and look again, and cite the real page numbers it sees. No book content is
  copied or stored, and DRM is untouched — it only ever sees single pages you
  have displayed, exactly like any other screenshot.
- **Web search** — the tutor has a `web_search` tool backed by Wikipedia's open
  API (no key, reliable for concepts/formulas). It searches, then summarises and
  cites the source. Trigger it by asking, or from the bubble menu → Web search.
- **Textbook PDF library** — Settings → "Textbook library": upload PDF books you
  own. The app extracts the text on-device and the tutor can look up where a topic
  is covered and cite page numbers via a `search_textbooks` tool. **Token-efficient
  by design**: your whole book stays on this PC; a cheap helper model (set in
  Settings, default `gpt-4.1-mini`) reranks at most 8 candidate pages; the voice
  model only ever receives ~3 lines of page references. Scanned/image-only PDFs
  (no text layer) can't be searched — the app detects this and warns you on upload.
- **Quick-action menu** — right-click the bubble for: ask about screen, silent
  snapshot, new practice problem, web search, search my textbooks, toggle
  watch/mute, and the offline tools below.
- **Offline mini-tools** (zero tokens, work without a session):
  - *Unit & constant converter* — length/mass/force/energy/pressure/power/angle/
    time/temperature conversions + a click-to-copy physical-constants table.
  - *Focus timer* — Pomodoro-style, with a session goal; remaining time shows on
    the bubble. A nudge to move on when you're stuck too long on one problem.
  - *Formula sheet* — **182 LaTeX-rendered formulas** (KaTeX, fully offline)
    across 15 groups: algebra, logs/exponentials, complex numbers, geometry &
    functions, trigonometry, differentiation, integration, sequences & series,
    vectors, matrices, statistics & probability, mensuration, numerical methods,
    differential equations, plus engineering extras. Searchable; **82 are
    interactive solvers** (incl. the DE auxiliary-equation → general-solution
    classifier, Newton's cooling, half-life, Euler's method) — click,
    type your values, Solve, then Copy result or Copy LaTeX. Handles edge cases
    (complex quadratic roots as a±bi, singular matrices, divergent series,
    divide-by-zero, and blank-tolerant list inputs for stats / Simpson's rule).
- **Worked-examples panel** — the tutor has a `show_working` tool: whenever it
  demonstrates how to solve something, it pushes the steps as LaTeX into a panel
  while it talks (open it any time from the bubble menu). Each example is
  KaTeX-rendered, copyable as LaTeX, and the last 50 persist between sessions.
  Costs pennies — the steps arrive as tool text, the session stays audio-only.
- **Themes** — Settings → Theme: System, Light, Dark, or Sepia, applied live
  across every window.
- **Bubble customisation** — Settings → Bubble: colour (presets or custom), glyph
  (π ∑ ∫ √ ƒ Δ), size, and opacity. Changes apply live.
- **Click-through bubble** — only the visible π disc captures the mouse; clicking
  anywhere else (including the transparent area around it) passes straight through
  to whatever is underneath, so the bubble never blocks your work in Word or any
  other app. Hover the disc to drag/tap/right-click it as normal.
- **No audio-mode juggling** — Chromium mixes tutor audio with your music
  natively and applies echo cancellation; headphones/mic follow Windows' default
  device settings (change them in Windows Sound settings).
- Mute and Watch toggles live as buttons in the app window (no notification).
- Data (settings, encrypted API key, memory, study log, spend) lives in
  `%APPDATA%\voice-math-tutor-pc\` — separate from the tablet's data.

## Running it

The packaged app needs no Node.js or anything else:

```
%LOCALAPPDATA%\Programs\VoiceMathTutor\VoiceMathTutor.exe
```

Installed like a normal app: it has its own π icon, a **Desktop shortcut**, and a
**Start Menu entry** — press the Windows key, type "voice", and open it (pin it to
the taskbar from there if you like).

First run: paste your OpenAI API key → Save key (stored encrypted via Windows
DPAPI) → Start tutor → allow the microphone if Windows asks. The π bubble
appears; drag it anywhere (it snaps to screen edges), tap it for a hint or a
silent snapshot (per Settings), hold it to talk in push-to-talk mode.

## Rebuilding from source

Source of truth: this folder. Build tools (portable, no installs):
- Node: `%LOCALAPPDATA%\ntool\node-v22.23.1-win-x64`
- Build dir (node_modules lives here, outside OneDrive): `%LOCALAPPDATA%\vmt-build`

```powershell
$nd = "$env:LOCALAPPDATA\ntool\node-v22.23.1-win-x64"
$env:PATH = "$nd;$env:PATH"
# copy source over build dir, then:
cd $env:LOCALAPPDATA\vmt-build
npx @electron/packager . VoiceMathTutor --platform=win32 --arch=x64 --out=dist --overwrite
```

Or for quick dev iteration without packaging: `npx electron .` in the build dir.

## File map

| Piece | File |
|---|---|
| App entry: windows, IPC, storage, key (DPAPI), token mint, screen capture | `main.js` |
| IPC bridge | `preload.js` |
| Prompt + session JSON + pricing/cost meter (shared) | `renderer/shared.js` |
| Session engine (WebRTC, events, watch loop, memory tool) — hidden window | `renderer/engine.js` |
| Floating bubble (canvas states, tap/hold/drag/snap) | `renderer/bubble.js` |
| Settings/status UI | `renderer/settings.html` + `settings.js` |
