# Embers to Orbit

An accessible, turn-based strategy game. Lead a handful of survivors from a single campfire to a nation among the stars.

Built screen-reader first: fully playable with VoiceOver on iPhone and with a screen reader on a computer.

## Play

The game runs in any modern browser. Once GitHub Pages is enabled for this repository, it is playable at:

https://christopherabel3000-creator.github.io/Embers-to-Orbit/

## Current state

The Survival era and the Settlement era: twelve named survivors in a forest valley. Assign tasks each season, build shelter and defenses, scout the land, survive winters and raids, and listen to your advisors. Grow strong enough and your camp can become a village run by its council, deal with the rising nations of the valley, and found a second settlement to begin the Nation era, where you rule a growing nation of settlements through their roles, demands, and governors, send expeditions into the wider world, meet the seven great nations beyond it, raise armies to make war and peace, and at last send a ship across the open sea. The Age of Discovery comes next. See [DESIGN.md](DESIGN.md) for the full design.

## Development

Plain HTML, CSS, and JavaScript modules. No build step.

- `npm run serve` serves the game at http://localhost:8000 (modules don't load from a `file://` path).
- `npm test` runs the engine tests.
- `npm run simulate` plays hundreds of automatic games to check balance.
- `npm run battles` fights hundreds of battles to check combat balance.

Results of these checks are kept in [BALANCE.md](BALANCE.md).

Code layout:

- `js/engine/` holds all game rules and state. It has no knowledge of the page.
- `js/ui/app.js` wires up the screens and the player's clicks, and sends actions to the engine.
- `js/ui/core.js` holds what every screen shares: the game being played, announcements, and drawing the current screen.
- `js/ui/screens/` has one file per screen (Report, Village, Map, and so on).
- `js/storage.js` is the only place saves are read or written.

See [BACKLOG.md](BACKLOG.md) for what comes next.
