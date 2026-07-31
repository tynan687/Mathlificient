# Mathlificient

A maths tutor for HSC students and undergrad engineering units, for **Android tablets/phones** and **Windows PCs**.

Most of it works **completely offline and free** — no account, no sign-up, no API key:

- **Practice Studio** — unlimited generated questions across 33 topics (algebra, quadratics, trig, calculus, vectors, matrices, statistics, partial fractions and more), each with step-by-step worked solutions and a diagram drawn from the actual numbers in your question: the real parabola with its roots marked, the triangle to scale, asymptotes, Argand diagrams, bar charts.
- **Work it out by hand** — a drawing canvas sits under every question. On Android that's the S Pen (with palm rejection, hold-the-button to erase, and pinch-to-zoom for more room). On Windows it's your mouse, or a graphics tablet if you have one.
- **Quiz mode and printable worksheets** (Windows) — run a scored set of 5/10/20 questions with a review of what you missed, or print a worksheet with working space and a separate answer key.
- **Formula sheet** — 182 formulas across 15 topic groups, 82 of them interactive solvers: type your values in, get the answer plus LaTeX you can paste into Word or Samsung Notes.
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

**Needs Android 14 or newer.** (Check under Settings → About phone/tablet → Software information. Older versions can't run this build.)

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

**Quiz mode (Windows):** pick a question count, work through them one at a time, and mark yourself **✓ Got it** / **✗ Missed it** after each answer. You get a score and a list of the ones you missed at the end. **🖨 Worksheet** generates a printable page instead — questions with blank working space, then an answer key.

### Formula sheet

182 formulas, searchable. 82 of them are live solvers — click one, type your values, press Solve, then copy the result or the LaTeX. Handles the awkward cases properly (complex quadratic roots as a ± b*i*, singular matrices, divide-by-zero).

### Live voice tutoring (needs your own API key)

1. Get a key from [platform.openai.com/api-keys](https://platform.openai.com/api-keys) with billing set up, paste it into the app, and save. It's encrypted on your device and only ever sent to OpenAI.
2. On Android, pick your course (`hsc-advanced`, `hsc-ext1`, `hsc-ext2` or `engineering`) and set your current topic, then press **Start tutor** and grant microphone, notification, "display over other apps" and screen-capture permission. Android asks for screen capture every session by design.
3. A π bubble appears. **Hold** it to talk, **tap** for the quick menu, **double-tap** for a hint. The mic is locked unless you're holding it, so nothing is sent while you work quietly.

**Watch mode** checks your working as you write and speaks up when you go wrong, which costs about A$0.30–1 per hour. The status card and notification show live spend, and the app automatically eases off its own reasoning effort if a session heads over your cap.

---

## Privacy

Everything personal stays on your device: the API key (encrypted), the tutor's memory, your study log and spend history. Screenshots and audio go only to OpenAI's API, under your own key, and only when you're running a live session. No accounts, no server, no analytics, and nothing is shared between the Android and Windows versions.

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

---

## Licence

[MIT](LICENSE) — use it, change it, share it.
