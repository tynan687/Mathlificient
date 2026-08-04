# Installing Mathlificient on Linux

Built and tested against Debian 12 (bookworm) and Ubuntu 24.04, x86-64. Nothing in the app
is Windows-specific — there is no `process.platform` branch, no `%APPDATA%`, and both
dependencies are pure JavaScript — so the Linux build is the same application, not a port.

## Install the .deb

```sh
sha256sum -c SHA256SUMS                          # should print: OK
sudo apt install ./mathlificient_1.0.0_amd64.deb
```

**`apt`, not `dpkg -i`.** The package declares nine dependencies; `apt` resolves them and
`dpkg` simply fails on them. If you have already run `dpkg -i` and it complained, `sudo apt
--fix-broken install` will finish the job.

Then launch it from the applications menu, or run `mathlificient`.

### About that checksum

It verifies the *transfer* — that the bytes you received are the bytes that were built. It
does **not** work as a build check: `electron-builder` output is not bit-for-bit
reproducible, so a package you build yourself from the same commit will have a different
hash. That is expected and not a sign of tampering.

## Two things specific to Linux

Neither can happen on Windows, which is why both went unnoticed until the app was packaged.

### Your API key needs a keyring, or it is stored in plain text

Electron's `safeStorage` is DPAPI on Windows and always available. On Linux it needs a
keyring — libsecret with `gnome-keyring` or KWallet actually **running and unlocked**. With
no keyring, the key is written to disk as readable text.

The `.deb` depends on `libsecret-1-0`, but an installed library is not an unlocked keyring,
so the app checks at runtime and tells you on the home screen and again when you save a key.
If you see that warning:

```sh
sudo apt install gnome-keyring
```

then log out and back in, and save the key again to encrypt it. The file is `chmod 0600`
either way, which is the only protection left when it is not encrypted.

### The floating bubble needs X11

The bubble and its right-click menu position themselves on screen, sit above other windows
and pass clicks through. Wayland does not let a client place its own windows, and **Debian
12's default GNOME session is Wayland** — so the bubble will not stay where you drag it and
the menu will not open under the cursor.

If you want them, pick **GNOME on Xorg** from the gear icon on the login screen. The app
detects the session and says so on the home screen rather than just misbehaving.

Everything else — the home screen, practice, progress, symbols, the formula sheet, the
tools — is ordinary windows and works the same either way.

## What it costs to run

Measured on the packaged build, resident memory:

| | |
|---|---|
| At rest: home window, hidden engine, bubble | **664 MB** (7 processes) |
| With progress, symbols and practice open | **1030 MB** (10 processes) |
| Each additional tool window | ~122 MB |

Comfortable on 8 GB. Workable on 4 GB, but not while a browser is also open — close tool
windows you are not using. The largest single saving available is the hidden engine window,
which is created at startup and does nothing until you start a tutor session; that is
~120 MB and has not been changed yet.

## Uninstalling

```sh
sudo apt remove mathlificient
```

That leaves your data alone. It lives in `~/.config/Mathlificient` — the API key, settings,
study log, proficiency history and any indexed PDFs. Remove it deliberately if you want a
clean slate:

```sh
rm -rf ~/.config/Mathlificient
```

## Building it yourself instead

If you would rather not trust a binary someone handed you — a reasonable position — the
repo builds it in one command:

```sh
./tools/install-linux.sh              # build the .deb and install it
./tools/install-linux.sh --no-install # build only, leaves it in VoiceMathTutorPC/dist/
./tools/install-linux.sh --run        # skip packaging, run straight from source
```

Needs node 18+ (Debian 12 ships 18, which is enough) and about 1.5 GB of free disk while
building. Peak build memory is a few hundred MB.

## A note on signing

This `.deb` is unsigned, and that is normal. Debian's trust model signs *repositories*, not
individual packages: `apt install ./some.deb` performs no signature check at all, whoever
built it. Signing a loose `.deb` is done with GPG via `dpkg-sig`, which is a different key
and a different mechanism from the Android release keystore — that one signs APKs through
apksigner and cannot sign a Debian package.

So the release keystore is not needed for a Linux build, and its absence does not weaken
this one. It matters only on the Android side: an APK built without it is debug-signed,
Android will refuse to install it over a release build, and you would have to uninstall
first and lose the app's data.
