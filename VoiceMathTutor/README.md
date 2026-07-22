# Voice Math Tutor

A screen-aware, voice-only Socratic math tutor for the Samsung Galaxy Tab S9 FE.
It connects to OpenAI's `gpt-realtime-2.1` over WebRTC, watches your S Pen work via
on-demand screenshots, and talks to you through a floating π bubble — staying silent
while you work.

## What it does

- **Voice conversation** with `gpt-realtime-2.1` (reasoning effort **high**, semantic
  VAD eagerness **low**) over WebRTC, with echo cancellation so the open mic and the
  tablet speaker coexist.
- **Screen awareness**: when you speak or tap the bubble, it captures one frame of
  your screen (any app — Samsung Notes, PDFs), downscales it to ≤1024 px JPEG q65,
  and sends it to the model as an image. No OCR; the model reads your handwriting.
- **Floating bubble** (draggable, over any app) animates through loading / idle /
  listening / thinking / searching / talking / response-done states.
- **Cost meter**: tallies real token usage from every `response.done`, converts to
  AUD including 10% GST, projects an hourly rate, and **auto-downshifts reasoning to
  medium** if the projection crosses your soft cap (default A$12/hr; hard budget A$15).
- **Push-to-talk fallback** (Settings toggle): the mic stays muted except while you
  hold the bubble — guarantees the tutor never hears/interrupts you otherwise.
- **Voice-only**: `output_modalities: ["audio"]`, no transcript rendered, and the
  system prompt forbids dictating final answers.
- **Personalisation memory**: the tutor saves short durable facts about you
  (misconceptions, mastered skills, preferences) via a `save_student_note` tool
  call, and reads them back at the start of every session. You can view, delete,
  or clear every note in Settings, or turn personalisation off entirely.
- **Editable current topic** in Settings — the tutor centers its hints there and
  updates it itself as you move through the course.
- **Study log & spend tracking**: every session is logged locally (date, length,
  cost, topic), and the status card shows today's and this week's total A$ spend.
- **Mute button** on the notification (bubble shows a slash while muted) and the
  bubble snaps to the nearest screen edge after dragging.
- **Silent snapshot mode** (Settings → Bubble tap = snapshot): tapping the bubble
  pushes a screenshot into the conversation with no spoken reply (green flash
  confirms) — the tutor sees it the next time you talk.
- **Watch mode** (Settings toggle or the notification's Watch button): every
  ~20 s (configurable 10/20/40) the tutor checks your screen — only when it has
  actually changed — via a *silent text-only* verdict ("OK" or "ALERT: …"). You
  hear nothing unless it spots a clear mistake, in which case it interrupts
  briefly and points at the line. Each new watch screenshot replaces the previous
  one server-side so context never bloats. Adds roughly A$1–3/hour while enabled;
  a white dot on the bubble shows it's armed.

### Why the memory doesn't blow the budget

The memory summary is hard-capped at ~600 tokens and appended to the *static*
system prompt, which the API serves from its prompt cache after the first turn at
$0.40/1M tokens. That works out to roughly $0.002 on the first turn plus ~$0.005
per hour of cached re-billing — **under one AU cent per hour**. The Settings card
shows the live size (~N tokens). Saving a note costs a few hundred text tokens
(fractions of a cent). If you want zero overhead anyway, flip Personalisation off
— the session then contains no tools and no profile.

## Build (on any PC — Android Studio does everything)

1. Install [Android Studio](https://developer.android.com/studio) (it bundles the
   JDK and downloads the Android SDK + Gradle 8.9 automatically).
2. **Recommended:** copy this `VoiceMathTutor` folder out of OneDrive (e.g. to
   `C:\dev\VoiceMathTutor`) before building — OneDrive file locking can break Gradle
   builds. At minimum, pause OneDrive sync while building.
3. Open the folder in Android Studio and let Gradle sync finish (first sync
   downloads everything; if it complains about a missing Gradle wrapper jar, accept
   the IDE's offer to fix it, or just pick "Use Gradle from: 'wrapper' task in build
   script" — the `gradle-wrapper.properties` is already configured).
4. If the `io.getstream:stream-webrtc-android` version in
   `gradle/libs.versions.toml` is flagged as unavailable, bump it to the latest
   version Android Studio suggests — the API used here (org.webrtc classes) is stable.
5. **Signed APK**: Build → Generate Signed Bundle / APK → APK → Create new keystore
   (save the `.jks` somewhere safe) → build **release**.
   The APK lands in `app/release/`.

## Sideload to the Tab S9 FE

1. Copy the APK to the tablet (USB cable, or upload to Drive/OneDrive and download).
2. Tap the APK in the Files app → allow "Install unknown apps" for that app when
   prompted → install.

## First-run setup (in order)

1. Open the app and **paste your OpenAI API key** → Save key. It is stored in
   EncryptedSharedPreferences behind an Android Keystore AES-256-GCM master key and
   only ever used to mint ~1-minute ephemeral session tokens on-device.
2. Press **Start tutor** and grant, as prompted:
   - Microphone + notifications,
   - **Display over other apps** (you'll bounce to Settings; come back and press
     Start again),
   - the **screen-capture consent** dialog. Android 15 requires this *every*
     session — that's by design, not a bug.
3. **Samsung battery setup** (once, or One UI will kill the session):
   - Settings → Apps → Voice Math Tutor → Battery → **Unrestricted**.
   - Settings → Battery → Background usage limits → **Never sleeping apps** → add
     Voice Math Tutor, and turn off **Put unused apps to sleep**.
   - The in-app card deep-links near these screens.

## Using it

- Start a session, then switch to Samsung Notes / your PDF and work normally.
  The bubble sits on top; drag it anywhere.
- **Just talk** — semantic VAD (eagerness low) waits for you and won't interrupt.
  When you speak, a fresh screenshot (throttled to ≥10 s apart) is attached so the
  tutor can see your working.
- **Tap the bubble** for "look at my screen and help": captures + asks for one
  Socratic hint.
- **Push-to-talk mode** (Settings): hold the bubble while speaking, release to send.
- **Mute** from the notification when you want guaranteed silence without ending
  the session (VAD mode only — PTT already gates the mic).
- **Stop** from the notification or the app.

## First-run test checklist (on device)

1. Personalisation ON → tell the tutor something durable ("I always forget to
   check for repeated roots") → the bubble flashes the amber searching state →
   the note appears in Settings → View memory. Next session, it should reference it.
2. Personalisation OFF → start a session → the tutor works normally with no
   memory or tools.
3. Tap **Mute** on the notification → bubble shows a slash and the tutor stops
   hearing you; Unmute restores.
4. Drag the bubble to mid-screen and release → it glides to the nearest edge.
5. Press **Stop** → the study log shows the session; Today/This-week spend
   increments match the session cost.
6. Bubble tap = snapshot → tap → green flash, no speech; ask "what do you see?"
   → the tutor references the snapped screen.
7. Watch mode on → write a deliberate sign error → within a check interval or
   two the tutor speaks up naming the line; correct working stays silent, and an
   unchanged screen adds nothing to the cost meter.

## Cost expectations

Typical tutoring hour on the flagship at high reasoning: **~A$2–6 all-in** (GST
included) — silence isn't billed. The status card and notification show live session
cost and projected A$/hr. The budget guard lowers reasoning to medium if the
projection crosses the soft cap; if a session consistently runs hot, switch the
model to `gpt-realtime-2.1-mini` in Settings (applies next session).

Biggest cost levers, in order: assistant talk time (audio out $64/1M), cache
discipline (screenshots bust the audio cache — that's why captures are on-demand
and throttled), reasoning effort.

## Known first-build fixups (expected, minor)

- **Library versions**: `stream-webrtc-android` and the Compose BOM pins may need a
  bump to whatever is current — Android Studio will tell you.
- **Realtime API drift**: event names target the GA WebRTC interface
  (`output_audio_buffer.started/stopped`, `session.update` with nested
  `audio.input.turn_detection`, `POST /v1/realtime/client_secrets`,
  `POST /v1/realtime/calls?model=…`). If OpenAI has shifted a field name since
  July 2026, the error event will say so — check the `error` line in the app's
  status card and the [Realtime API docs](https://platform.openai.com/docs/guides/realtime).
- **Semantic VAD misbehaving** (responding while you mutter to yourself): flip on
  Push-to-talk in Settings.

## Architecture map

| Piece | File |
|---|---|
| Permission cascade + settings UI host | `app/src/main/java/com/tynan/mathtutor/MainActivity.kt` |
| Compose settings screen + live cost display | `ui/SettingsScreen.kt` |
| Session orchestration (FGS `microphone\|mediaProjection`) | `service/RealtimeService.kt` |
| WebRTC peer connection + `oai-events` data channel | `realtime/RealtimeTransport.kt` |
| Token tally → AUD → budget guard | `realtime/CostMeter.kt` |
| MediaProjection single-frame capture → JPEG base64 | `capture/ScreenCaptureManager.kt` |
| Draggable bubble + tap/hold gestures + edge snap | `overlay/OverlayController.kt` |
| Animated state rendering (incl. muted) | `overlay/BubbleView.kt` |
| System prompt + Realtime session JSON + memory tool | `config/TutorConfig.kt` |
| Tutor's persistent notes about the student | `memory/TutorMemory.kt` |
| Local session history | `memory/StudyLog.kt` |
| Daily/weekly A$ spend buckets | `memory/SpendTracker.kt` |
| Encrypted key + settings storage | `security/SecureKeyStore.kt` |
| Ephemeral token mint | `api/EphemeralTokenClient.kt` |
