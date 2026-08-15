# dsh-sound-alert 🔊

A sound-alert plugin for DSH (DeepSeek Harness): plays a notification sound in the browser when a **user-specified goal completes**, the **agent asks you a question**, or the **agent finishes answering**.

- ✅ Installs and works out of the box — enabled by default, no extra setup
- ✅ Synthesized tones (Web Audio) by default, **custom audio files supported** (common formats, ≤ 1 MB)
- ✅ Zero build step, zero npm dependencies (only the platform's bundled react)
- ✅ Settings persist in localStorage across restarts and sessions

## Features

| Event | Trigger | Default sound |
|---|---|---|
| Goal completed (`update_goal complete` / automatic completion) | session `goal` projection flips to `complete` | 880 Hz sine ×2 |
| Question asked (`ask_user_question` shown) | a new running `ask_user_question` call appears in the conversation snapshot | 660 Hz triangle ×3 |
| Answer done (a thinking/working round finished, final answer given) | a new turn/end lands in the conversation snapshot | 784 Hz sine ×2 |

> Opening an old session does not replay past events (the first render only records, never plays).

## Customizing the sounds

- **Per-event switches**: besides the master switch, each of the three events (goal / question / answer) has its own on/off toggle in the settings page — mute any one independently.
- **Custom audio**: Settings → "提示音" (Sound Alerts) → each event can upload its own audio file (mp3 / wav / ogg / m4a and other formats the browser can decode, **≤ 1 MB each**, stored as a data URL in localStorage). When set, the custom audio plays first; if playback fails it falls back to the synthesized tone. Click "清除" (Clear) to restore the tone.
- **Tone parameters**: per event you can adjust waveform / frequency / duration / volume / repeats / gap, and preview with "试听" (Preview).
- **Status strip**: a minimal one-line status above the composer (🔔 sound alerts on / 🔕 off).

## Installation

Requirements: DSH installed and run at least once (Web UI), with a user config directory `~/.dsh/profiles/<profile>` (the default profile name is `web`). If the `DSH_HOME` environment variable is set, the config directory lives at `$DSH_HOME/profiles/<profile>` instead.

No tools to install (no npm / dsh / pnpm needed). Download from GitHub and install with one click:

### Windows 10 / 11

1. On the GitHub repo page click **Code → Download ZIP**, then extract it
2. Enter the extracted folder and **double-click `install.cmd`** (or run `.\install.cmd` in a terminal there)
3. When you see "OK. Installed." **fully restart DSH**

The status strip appears above the composer once the web UI is open.

> Install into another profile: run `.\install.cmd <profile-name>` in a terminal (default is `web`).

### macOS / Linux

1. Download and extract the ZIP, then open a terminal in that folder
2. Run `./install.sh`
3. **Fully restart DSH**

### Or let Harness install it for you

Tell the DSH agent in a conversation "Install the dsh-sound-alert plugin for me" and put the downloaded plugin folder into the workspace — the agent completes the install, you only restart DSH.

> The `install.cmd` / `install.ps1` / `install.sh` files in this repo are three forms of the same installer (Windows double-click, PowerShell, and bash respectively) — pick whichever fits.

## Uninstall

You can also ask Harness to uninstall it for you; or do it manually:

1. Remove the `sound-alert` block you appended in `cordis.patch.yml`
2. Delete `~/.dsh/profiles/<profile>/node_modules/dsh-sound-alert/`
3. Restart DSH

## How it works (for developers)

DSH plugins are npm packages. What the installers (`install.cmd` / `install.ps1` / `install.sh`) do is: copy the package to `~/.dsh/profiles/<profile>/node_modules/dsh-sound-alert/`, then `insert` a mount entry in the profile's `cordis.patch.yml`:

- `package.json` declares the browser half via `dsh.client` (`platform: "web"` + injection order)
- `exports["./client"]` points to a client bundle in the `window.__ModuleLoader__.load({ id, factory })` format (hand-written here — no build step)
- `lib/index.js` is the host-half placeholder (empty `apply`, so the Loader recognizes the package; all logic lives in the browser)

Detection logic (`lib/client.js`):

- **Goal completed**: subscribes to the session's `goal` projection (the same data source the official GoalBar renders); plays when phase transitions from non-`complete` to `complete`
- **Question asked**: `ask_user_question` stays "running" until the human answers, so a new `callId` with that name appearing in the snapshot's `runningCalls` means the question was just shown — play immediately
- **Answer done**: watches for new turn/end entries in the snapshot's `turnEnds` (the moment a thinking/working round closes and the final answer lands); the first render only records existing turns, never replays history
- **Custom audio**: `<input type="file" accept="audio/*">` → FileReader → data URL (≤ 1 MB) stored in the config; playback prefers `new Audio(dataUrl)` and falls back to the synthesized tone on failure

## License

[Apache-2.0](LICENSE) · Copyright 2026 [314159264](https://github.com/314159264)
