# Embers to Orbit

An accessible, turn-based strategy game. Lead a handful of survivors from a single campfire to a nation among the stars.

Built screen-reader first: fully playable with VoiceOver on iPhone and with a screen reader on a computer.

## Play

The game runs in any modern browser. Once GitHub Pages is enabled for this repository, it is playable at:

https://christopherabel3000-creator.github.io/Embers-to-Orbit/

## Current state

Phase 1, the Survival era, and the start of the Settlement era: twelve named survivors in a forest valley. Assign tasks each season, build shelter and defenses, scout the land, survive winters and raids, and listen to your advisors. Grow strong enough and your camp can become a village run by its council. See [DESIGN.md](DESIGN.md) for the full design.

## Development

Plain HTML, CSS, and JavaScript modules. No build step.

- `npm run serve` serves the game at http://localhost:8000 (modules don't load from a `file://` path).
- `npm test` runs the engine tests.
- `npm run simulate` plays hundreds of automatic games to check balance.
- `npm run battles` fights hundreds of battles to check combat balance.

Code layout:

- `js/engine/` holds all game rules and state. It has no knowledge of the page.
- `js/ui/app.js` draws the screens and sends actions to the engine.
- `js/storage.js` is the only place saves are read or written.

See [BACKLOG.md](BACKLOG.md) for what comes next.
