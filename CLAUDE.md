# Working on Embers to Orbit

Read DESIGN.md before making design decisions. It is the source of truth for the game's design; update it when a decision changes.

## Rules for the code

- **Accessibility first.** Every feature must work with VoiceOver on iPhone and a desktop screen reader. Use native controls (button, select, checkbox, radio, headings, lists). No custom gestures, no drag-and-drop, no information carried only by color or sound. Each screen has one h1, which receives focus when the screen opens. Use the `announce()` live region for short confirmations, not for long text.
- **Engine and UI stay separate.** All game rules live in `js/engine/` and never touch the DOM. The UI only changes the game through `applyAction(state, action)`, which returns a new state. Every player decision is an action object; this keeps future multiplayer possible.
- **Deterministic randomness.** Use the helpers in `js/engine/rng.js`, never `Math.random()`, inside the engine. The RNG state lives in the game state.
- **Saves go through `js/storage.js` only**, so storage can later be swapped for native app storage or Steam Cloud.
- **Offline and portable.** No CDNs or outside servers; relative paths only. The game will later be packaged for the App Store, Google Play (Capacitor), and Steam (Electron or Tauri).
- **Player-facing text** is plain, short, and leads with what changed.
- **Where things go.** Each screen has its own file in `js/ui/screens/`; what screens share is in `js/ui/core.js`. Small helpers (joining names with "and", capitals, plurals, shuffling) live in `js/engine/util.js`: use them rather than writing new copies.

## Checks before committing

- `npm test` must pass.
- After balance changes, run `npm run simulate` and compare the results with BALANCE.md, then add a dated note there.
