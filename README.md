# Mathlificient

A maths tutor for HSC students and undergrad engineering units, for **Android tablets/phones** and **Windows PCs**.

Most of it works **completely offline and free** — no account, no sign-up, no API key:

- **Practice Studio** — unlimited generated questions across 66 topics (algebra, quadratics, coordinate geometry, circles, functions, trigonometry, differentiation, integration, differential equations, vectors, matrices, statistics, partial fractions and more), each with step-by-step worked solutions and a diagram drawn from the actual numbers in your question: the real parabola with its roots marked, the triangle to scale, your two points with the midpoint between them, the circle at its actual centre and radius, the area you're integrating shaded in, asymptotes, Argand diagrams, bar charts.
- **Work it out by hand** — a drawing canvas sits under every question. On Android that's the S Pen (with palm rejection, hold-the-button to erase, and pinch-to-zoom for more room). On Windows it's your mouse, or a graphics tablet if you have one.
- **Quiz mode** — run a scored set of 5/10/20 questions with a review of what you missed. On Windows you can also print a worksheet with working space and a separate answer key.
- **Multiple choice that actually teaches** — switch any question to four options, and the three wrong ones are real mistakes, not filler: `b² + 4ac`, dividing by *n* instead of *n − 1*, forgetting to multiply by the inside of the bracket. Pick one and it tells you exactly which slip you made. Repeat the same slip and your progress screen starts saying so.
- **Progress tracking that tells you what to study next** — mark each question ✓ Got it / ✗ Missed it and the app builds a picture of where you're strong and where you're not, across 47 named skills in 10 areas. A **Focus next** list names three things to work on *and why* ("Shaky at 22%", "You had this at 80% but haven't practised in 19 days", "Quadratics first would make this easier"). A twelve-question placement check gets you started from scratch in about ten minutes.
- **Formula sheet** — 182 formulas across 15 topic groups, 82 of them interactive solvers: type your values in, get the answer plus LaTeX you can paste into Word or Samsung Notes.
- **Symbols, and how to read them out loud** — 100 symbols with what each one means, how you actually say it, and what it gets mixed up with (∈ and ε, ∂ and δ, `f⁻¹` and "one over f"). Plus 20 whole expressions broken into the fragments you say, in the order you say them — because knowing every symbol separately still leaves you stuck on a line you can't read.
- **Focus timer** (Pomodoro) and **ambient background noise** (rain, brown, pink, fan), all generated on-device.

**Optional: live voice tutoring.** Bring your own [OpenAI API key](https://platform.openai.com/api-keys) and a floating bubble will listen, watch your screen or your handwriting, and talk you through problems Socratically — nudging rather than handing over answers. Roughly **A$2–6 per hour** of actual conversation, with a hard budget cap built in. Everything above still works without it.

---

## Download

Grab the latest from the [**Releases page**](https://github.com/tynan687/Mathlificient/releases/latest):

| Platform | File | Size |
|---|---|---|
| Android (tablet or phone) | `Mathlificient-1.0.0.apk` | 63 MB |
| Windows 10/11 (64-bit) | `Mathlificient-Setup-1.0.0.exe` | 89 MB |

No Mac build — Windows and Android only.

### Install on Android

**Needs Android 10 or newer** — that's most phones still in use. (Check under Settings → About phone/tablet → Software information.)

1. Download `Mathlificient-1.0.0.apk` onto the device — or copy it across by USB.
2. Tap the file. Android will say installing from this source isn't allowed yet → tap **Settings** → turn on **Allow from this source** → go back.
3. Tap **Install**, then **Open**.

Android may warn that the app is from an unknown developer. That's expected for any app not distributed through the Play Store; it isn't a sign anything is wrong.

**Samsung tablets:** go to Settings → Battery → Mathlificient → set to **Unrestricted**, and add it to never-sleeping apps. One UI will otherwise kill a live tutoring session as soon as you switch to another app.

### Install on Windows

1. Download and run `Mathlificient-Setup-1.0.0.exe`.
2. Windows SmartScreen will show **"Windows protected your PC"**. This is because the installer isn't code-signed (a certificate costs a few hundred dollars a year). Click **More info** → **Run anyway**.
3. Pick an install location if you want to change it, then finish. You'll get a Start Menu entry and a desktop shortcut.

---

## How to use it

### Practice (no key needed — start here)

Open **Practice Studio** — on Android from the main screen or the bubble menu, on Windows by right-clicking the π bubble.

- Pick a topic from the dropdown, or leave it on **All topics**, and press **New question**.
- Work it out on the canvas underneath. Then **Show next step** reveals the solution one line at a time, so you can check where you went wrong rather than just seeing the answer.
- **Copy LaTeX** puts the question on your clipboard for Word's equation editor.
- Where a question has a diagram, a **📈 Visual** bar appears — tap to drop it down, tap again to tuck it away.
- **Paper colour** (White / Grey / Sepia / Dark / custom) themes the whole screen. Ink colour switches automatically so your writing always contrasts.

**Drawing:** on Android, rest your palm on the screen freely — once the app has seen the S Pen it ignores finger and palm touches. Hold the pen's side button and rub to erase, or tap the **⌫** tool. Pinch with two fingers to zoom out for more space; a **⤾ 1:1** button appears to snap back. On Windows, draw with the mouse or a pen tablet (pressure and the pen's eraser end both work), and use the scroll wheel to zoom.

**Quiz mode:** pick a question count, work through them one at a time, and mark yourself **✓ Got it** / **✗ Missed it** after each answer. You get a score and a list of the ones you missed at the end. On Windows, **🖨 Worksheet** generates a printable page instead — questions with blank working space, then an answer key.

**Multiple choice:** the dropdown next to the quiz controls switches between **Work it out** (the default — write it by hand, then mark yourself) and **Multiple choice**. It's remembered, and takes effect on the next question.

Every wrong option is a mistake someone actually makes, so guessing by elimination doesn't work. Pick a wrong one and it names the slip — *"That is b² + 4ac. The discriminant is b² − 4ac."* — highlights the right answer, and unlocks the worked steps. One pick per question, so the score means something.

Two deliberate rules: the steps stay locked until you've answered (reading them first and then picking is copying, not answering — if you do reveal first, the question is scored as self-marked instead), and a few question types have no sensible wrong options, so those keep asking you to mark yourself and say so.

### My progress

Open **📊 Progress** — on Android from the main screen or the bubble menu, on Windows from the π bubble's menu.

Everything you mark, in a quiz or just while practising, feeds a bar per skill.

- **Focus next** picks three things and tells you why each one: which are shaky, which you had once and have let go stale, and which would be easier if you shored something up first. Once you've made the same mistake twice it names it — *"Shaky at 22% — you keep using b² + 4ac."* **Practise** on any of them jumps straight into questions on that skill.
- **Due for review** catches topics you'd learned and haven't touched in a while. Bars fade the longer you leave a topic alone, so this fills up on its own.
- **Every topic** opens into per-skill bars. A faded bar means too few attempts to be sure of the number yet — not a low score.
- Fresh install with no history? Take the **twelve-question placement check** — one question from each area, about ten minutes, and the recommendations have something real to work from.

Self-marked answers count for less than multiple-choice ones, because you grading yourself is a noisier signal than a picked option — the app says so on the screen. Multiple-choice scores are also discounted for the free 25% a four-option question hands out, so switching modes doesn't inflate a bar. Nothing is uploaded; it's a file on your own device, and there's a Reset button.

### The study bubble (Android, no API key needed)

Tap **🫧 Show bubble** on the main screen and a small draggable π sits on top of
whatever else you're doing. Tap it for the formula sheet, focus timer, ambient
sound or a practice question; drag it out of the way; press and hold to put it
away. It's just a shortcut shelf for the offline tools — no microphone, no screen
capture, no session, nothing billed. Android will ask once for "display over
other apps".

### Symbols

Open **Symbols** — on Android from the main screen or the bubble menu, on Windows from the π bubble's menu.

**What it means** lists 100 symbols in 13 groups, searchable. You can search the name, what it does, how it sounds, *or* the LaTeX you copied out of a PDF — `\partial`, "curly d" and "partial" all find the same entry. Tap one for what it means, an example, how to say that example, and what it's easily confused with. Those cross-links go both ways, so you get the warning from whichever side you arrived on.

**How to read it** takes 20 real expressions and breaks each into the pieces you actually say, in the order you say them — including the bits that aren't left-to-right, like saying "the integral from nought to three" before you say what's being integrated. Where the grouping is the hard part, it says so: everything under a square-root bar is one chunk, the fraction bar is said last as "all over".

Where your device supports it there's a speaker button, but the written line is always on screen — the reading is the point, the audio is a bonus.

### Formula sheet

185 formulas, searchable. 82 of them are live solvers — click one, type your values, press Solve, then copy the result or the LaTeX. Handles the awkward cases properly (complex quadratic roots as a ± b*i*, singular matrices, divide-by-zero).

### Live voice tutoring (needs your own API key)

1. Get a key from [platform.openai.com/api-keys](https://platform.openai.com/api-keys) with billing set up, paste it into the app, and save. It's encrypted on your device and only ever sent to OpenAI.
2. On Android, pick your course (`hsc-advanced`, `hsc-ext1`, `hsc-ext2` or `engineering`) and set your current topic, then press **Start tutor** and grant microphone, notification, "display over other apps" and screen-capture permission. Android asks for screen capture every session by design.
3. A π bubble appears. **Hold** it to talk, **tap** for the quick menu, **double-tap** for a hint. The mic is locked unless you're holding it, so nothing is sent while you work quietly.

**Watch mode** checks your working as you write and speaks up when you go wrong, which costs about A$0.30–1 per hour. The status card and notification show live spend, and the app automatically eases off its own reasoning effort if a session heads over your cap.

---

## Privacy

Everything personal stays on your device: the API key (encrypted), the tutor's memory, your study log, your progress record and spend history. Screenshots and audio go only to OpenAI's API, under your own key, and only when you're running a live session. No accounts, no server, no analytics, and nothing is shared between the Android and Windows versions.

---

## Build from source

Only needed if you want to change something — the downloads above are ready to use.

**Android** — needs a JDK (Android Studio optional). Generate a signing keystore once with `keytool`, point `VoiceMathTutor/keystore.properties` at it (gitignored), then:

```bash
cd VoiceMathTutor && gradlew.bat assembleRelease
```

**Windows** — needs [Node.js](https://nodejs.org/) 18+:

```bash
cd VoiceMathTutorPC && npm install && npm run dist
```

Full details, including the keystore setup and a known electron-builder snag on Windows, are in [`VoiceMathTutor/DISTRIBUTION.md`](VoiceMathTutor/DISTRIBUTION.md) and [`VoiceMathTutorPC/README.md`](VoiceMathTutorPC/README.md).

**Shared engine files.** The question generators, skill graph, proficiency maths and practice/progress pages exist as byte-identical copies in both trees, because the Android app runs them in a WebView and the Windows app runs them in Electron. They are *not* symlinked — the paths don't line up (`practice.js` sits in `renderer/tools/` on Windows and flat in `assets/formulas/` on Android). Edit the copy under `VoiceMathTutorPC/renderer/`, then:

```bash
node tools/sync-shared.js
```

`node tools/sync-shared.js --check` fails if the two trees have drifted, and prints which files are divergent on purpose (the HTML pages differ per platform, by design — see the notes in that script). It also checks that both practice pages pull in the same set of scripts, since that part of them is *not* meant to differ.

The question generators and their multiple-choice distractors have their own harness — it hammers every template a few hundred times looking for a "wrong" option that is secretly right, an option that gives itself away by its shape, and a misconception key with no explanation attached:

```bash
node tools/check-practice.js
```

Add `--sample` to print one example question per template, or `--runs 50` for a quicker pass while you're writing new ones.

---

## For engineers

If you're picking this project up rather than using it, start with
[**HANDOVER.md**](HANDOVER.md) — the shared-engine architecture, the conventions for adding
question generators safely, how verification works, and the traps that have already cost time.

---

## Licence

[MIT](LICENSE) — use it, change it, share it.
