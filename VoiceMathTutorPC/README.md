# Mathlificient — PC (Windows)

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
  watch/mute, my progress, and the offline tools below.
- **Offline mini-tools** (zero tokens, work without a session):
  - *Practice Studio* — full parity with the tablet app, offline and free. A
    generated question (50 templates across 21 topics, auto-drawn diagrams —
    real parabolas with roots marked, triangles to scale, your two points with
    the midpoint between them, circles at their actual centre and radius,
    asymptotes, Argand diagrams and more) sits above a drawing canvas: **draw with the mouse, or
    plug in a graphics tablet/pen** (Wacom, Huion, Surface Pen — the browser's
    native Pointer Events API picks up pressure and the pen's eraser end/barrel
    button automatically, no drivers to install). An eraser tool sits next to
    the ink colours; mouse wheel (or trackpad pinch) zooms the canvas out for
    more room to work, with a one-click reset back to 1:1. Paper colour
    (White/Grey/Sepia/Dark/custom) themes the whole window and is remembered.
    **Quiz mode**: pick a question count (5/10/20), work through them one at a
    time, self-mark each "Got it"/"Missed it" after seeing the answer, get a
    score and a review of what you missed at the end. **🖨 Worksheet**:
    generates the same kind of question set as a printable page — numbered
    questions with blank working space, then an answer key — via your system
    print dialog (choose "Microsoft Print to PDF" to save a file instead).
    Grading isn't quiz-only: every question offers Got it / Missed it once the
    answer is shown, and each mark feeds the progress screen below. A dropdown
    switches to **multiple choice** (remembered; applies from the next
    question), where 49 of the 50 templates offer four options built from named
    misconceptions — `b² + 4ac`, population vs sample SD, forgetting the inner
    derivative — so a wrong pick can name the actual slip rather than just
    marking it wrong. One pick per question; the worked steps stay locked until
    it's answered, and revealing them first drops the attempt to self-marked
    half credit rather than banking an objective score for copying. The ink
    panel is a collapsible `<details>` — closing it frees ~460px, which is what
    makes room for the option grid at the window's minimum height.
  - *My progress* — a bar per skill across **47 skills in 10 areas**, folded up
    into an area bar you can expand. **Focus next** names three skills to work
    on and *why* each ("Shaky at 22%", "you had this at 80% but haven't
    practised in 19 days", "Quadratics first would make this easier"), with a
    Practise button that jumps the practice window straight to that skill.
    **Due for review** catches what's decayed. A skippable **12-question
    placement check** seeds it on a fresh install, since otherwise every bar
    reads zero and the recommendation would be arbitrary.
    Implementation: `renderer/practice-prof.js` folds an append-only attempt log
    (`proficiency.json` in userData, via `prof:all` / `prof:append` /
    `prof:reset`) into mastery on every read — nothing derived is ever stored,
    so bars can't drift while the app is shut and two windows practising at once
    can at worst lose one attempt rather than clobber a record. Attempts record
    *how* they were graded (`mcq` / `self`) separately from *which flow* they
    came from (`practice` / `quiz` / `placement`), and multiple-choice attempts
    carry the option count so the free 1/k a guess earns can be discounted —
    without which a student who knows half a skill would read as solid.
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
  `%APPDATA%\Mathlificient\` — separate from the tablet's data. Electron derives
  that folder from `productName`, so renaming the app moves it; `main.js`'s
  `migrateLegacyUserData()` copies data over from the pre-1.0 `VoiceMathTutor`
  folder on first run.

## Running it

Install with `Mathlificient-Setup-<version>.exe` from the
[Releases page](https://github.com/tynan687/Mathlificient/releases/latest) —
nothing else is needed, no Node.js. SmartScreen will warn that the publisher is
unknown (the installer isn't code-signed): **More info → Run anyway**.

You get a **Start Menu entry** and a **Desktop shortcut** with the π icon — press
the Windows key, type "math", and open it (pin it to the taskbar from there if you
like). The installer lets you choose the location, so there's no fixed path.

Data (settings, encrypted API key, memory, study log, spend, uploaded PDFs) lives
in `%APPDATA%\Mathlificient\`. If you used a pre-1.0 build, that data was under
`%APPDATA%\VoiceMathTutor\` and is copied across automatically the first time
1.0 starts.

First run: paste your OpenAI API key → Save key (stored encrypted via Windows
DPAPI) → Start tutor → allow the microphone if Windows asks. The π bubble
appears; drag it anywhere (it snaps to screen edges), tap it for a hint or a
silent snapshot (per Settings), hold it to talk in push-to-talk mode.

## Rebuilding from source

Source of truth: this folder. Build tools (portable, no installs):
- Node: `%LOCALAPPDATA%\ntool\node-v22.23.1-win-x64`
- Build dir (node_modules lives here, outside OneDrive): `%LOCALAPPDATA%\vmt-build`

**Proper installer** (`Setup.exe` — Start Menu shortcut, uninstaller, "just works" for
someone who isn't you):
```powershell
$nd = "$env:LOCALAPPDATA\ntool\node-v22.23.1-win-x64"
$env:PATH = "$nd;$env:PATH"
# copy source over build dir, npm install, then:
cd $env:LOCALAPPDATA\vmt-build
npm run dist
```
Output: `dist/Mathlificient Setup <version>.exe` (~89 MB, single file).

**Known snag on Windows.** electron-builder downloads a macOS code-signing helper
on first run even for a Windows-only build, and its archive contains symlinks that
need the "create symbolic links" privilege to extract. Without it you get:

```
Cannot create symbolic link : A required privilege is not held by the client
```

Only the two `darwin/*.dylib` symlinks actually fail — every Windows tool in the
archive extracts fine — so the fix is to hand electron-builder the already-extracted
folder under the name it looks for. In
`%LOCALAPPDATA%\electron-builder\Cache\winCodeSign\` you'll find the partial
extraction(s) in numerically-named folders; copy one to `winCodeSign-2.6.0`
alongside them and re-run. It's then a cache hit and the download is skipped
entirely.

(Turning on **Settings → Privacy & security → For developers → Developer Mode**
also works, if you'd rather grant the privilege than patch the cache.)

**Portable fallback** (no installer, no extra Windows privilege needed — this is
what ships today if the above isn't available):
```powershell
cd $env:LOCALAPPDATA\vmt-build
npx @electron/packager . Mathlificient --platform=win32 --arch=x64 --out=dist --overwrite --icon=icon.ico
```
Produces `dist/Mathlificient-win32-x64/Mathlificient.exe` — copy the whole folder
wherever you like and shortcut it yourself.

Or for quick dev iteration without packaging either way: `npx electron .` in the build dir.

## File map

| Piece | File |
|---|---|
| App entry: windows, IPC, storage, key (DPAPI), token mint, screen capture | `main.js` |
| IPC bridge | `preload.js` |
| Prompt + session JSON + pricing/cost meter (shared) | `renderer/shared.js` |
| Session engine (WebRTC, events, watch loop, memory tool) — hidden window | `renderer/engine.js` |
| Floating bubble (canvas states, tap/hold/drag/snap) | `renderer/bubble.js` |
| Settings/status UI | `renderer/settings.html` + `settings.js` |
