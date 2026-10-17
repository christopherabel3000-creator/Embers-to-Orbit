// Fights many auto-resolved battles to check combat balance.
// Run with: node tools/battles.mjs
import { newGame } from '../js/engine/game.js';
import { living } from '../js/engine/state.js';
import { createBattle, autoBattle } from '../js/engine/battle.js';
import { raidOdds } from '../js/engine/advisors.js';
import { startNations } from '../js/engine/nations.js';
import {
  createField, autoField, SOLDIER, WALL_COVER,
} from '../js/engine/field.js';

function trial({ raiders, warned = true, palisade = false, wall = false, side = 'defend', fighters = 12, spears = false, nation = false, bows = false }) {
  let wins = 0; let deaths = 0; let wounded = 0; let rounds = 0;
  const N = 400;
  for (let i = 0; i < N; i++) {
    const s = newGame({ seed: 5000 + i });
    s.people = s.people.slice(0, fighters);
    if (palisade) s.buildings.palisade = 1;
    if (spears) s.knowledge.learned.push('spears');
    if (wall) s.buildings.stoneWall = 1;
    if (bows) s.knowledge.learned.push('bows');
    if (nation) { s.era = 'village'; startNations(s); } // Skarn war bands now bring archers.
    s.neighbors.skarn.known = true;
    const ev = { type: 'raid', raiders, warned, from: 'skarn', side };
    s.pendingEvent = { ...ev, battle: createBattle(s, ev) };
    const before = living(s).length;
    const r = autoBattle(s, s.pendingEvent);
    const text = r.lines.join(' ');
    if (/broke and fled|has fallen/.test(text)) wins++;
    deaths += before - living(s).length;
    wounded += living(s).filter((p) => p.health < 100).length;
    const m = text.match(/lasted (\d+)/); rounds += m ? Number(m[1]) : 0;
  }
  const s0 = newGame({ seed: 1 }); s0.people = s0.people.slice(0, fighters); if (palisade) s0.buildings.palisade = 1;
  if (wall) s0.buildings.stoneWall = 1;
  if (bows) s0.knowledge.learned.push('bows');
  if (nation) { s0.era = 'village'; startNations(s0); }
  // The war chief judges the same battle: an attack or a defense.
  s0.neighbors.skarn.known = true;
  const ev0 = { type: 'raid', raiders, warned, from: 'skarn', side };
  s0.pendingEvent = { ...ev0, battle: createBattle(s0, ev0) };
  const odds = raidOdds(s0, living(s0), warned, raiders).word;
  return `${side} ${raiders} raiders vs ${fighters}${palisade ? ' +palisade' : ''}${warned ? '' : ' surprised'}${spears ? ' +spears' : ''}${wall ? ' +wall' : ''}${nation ? ' vs nation (archers)' : ''}${bows ? ' +bows' : ''}: win ${(100 * wins / N).toFixed(0)}% | deaths ${(deaths / N).toFixed(2)} | wounded ${(wounded / N).toFixed(1)} | rounds ${(rounds / N).toFixed(1)} | advisor says "${odds}"`;
}

for (const cfg of [
  { raiders: 5 }, { raiders: 9 }, { raiders: 13 }, { raiders: 17 }, { raiders: 13, warned: false },
  { raiders: 13, palisade: true }, { raiders: 17, palisade: true }, { raiders: 21, palisade: true },
  { raiders: 9, fighters: 6 }, { raiders: 13, spears: true },
  { raiders: 13, palisade: true, nation: true }, { raiders: 17, palisade: true, nation: true }, { raiders: 21, palisade: true, nation: true },
  { raiders: 21, palisade: true, wall: true, nation: true }, { raiders: 17, palisade: true, nation: true, bows: true },
  { raiders: 13, nation: true }, { raiders: 13, nation: true, bows: true },
  { side: 'attack', raiders: 10 }, { side: 'attack', raiders: 14 }, { side: 'attack', raiders: 18 },
]) console.log(trial(cfg));

// ----- Field battles between armies (field.js) -----
// Companies of 10; ours worth 2.5 (drilled, with spears and bows), theirs 2.0
// (the Skarn at their best), unless a trial says otherwise.
console.log('\nField battles:');
const unitOf = (ours, kind, n, worth, id) => ({
  id, kind, name: `${kind} ${id}`, soldiers: n, start: n, power: SOLDIER * worth, ours, broken: false, zone: 'center',
});
function fieldTrial(label, ourKinds, theirKinds, {
  region = 'valley', foe = 'skarn', attacker = 'them', walls = false, ourWorth = 2.5, theirWorth = 2,
} = {}) {
  const N = 400;
  let wins = 0; let ourLoss = 0; let theirLoss = 0; let rounds = 0;
  for (let i = 0; i < N; i++) {
    const us = ourKinds.map((k, j) => unitOf(true, k, 10, ourWorth, j + 1));
    const them = theirKinds.map((k, j) => unitOf(false, k, 10, theirWorth, `t${j}`));
    const b = createField({
      region, foe, foeName: foe, us, them, attacker, walls: walls ? { side: 'them', cover: WALL_COVER } : null,
    });
    if (autoField({ rng: (i * 7919 + 1) >>> 0 }, b) === 'won') wins++;
    rounds += b.round;
    ourLoss += us.reduce((sum, u) => sum + u.start - u.soldiers, 0) / us.reduce((sum, u) => sum + u.start, 0);
    theirLoss += them.reduce((sum, u) => sum + u.start - u.soldiers, 0) / them.reduce((sum, u) => sum + u.start, 0);
  }
  console.log(`${label}: win ${Math.round(100 * wins / N)}% | rounds ${(rounds / N).toFixed(1)} | our losses ${Math.round(100 * ourLoss / N)}%, theirs ${Math.round(100 * theirLoss / N)}%`);
}
const line = ['spearmen', 'spearmen', 'archers'];
const skarnBand = ['warriors', 'warriors', 'bowmen'];
const riders = ['horseArchers', 'horseArchers', 'lancers', 'lancers'];
fieldTrial('3 companies against 3 of the Skarn, they attack', line, skarnBand);
fieldTrial('3 against 3, we attack', line, skarnBand, { attacker: 'us' });
fieldTrial('3 against 3, of equal worth', line, skarnBand, { ourWorth: 2 });
fieldTrial('4 against 3', [...line, 'spearmen'], skarnBand);
fieldTrial('3 against 4', line, [...skarnBand, 'warriors']);
fieldTrial('4 of infantry against 4 Orhai riders, on the plains', [...line, 'spearmen'], riders, { foe: 'orhai', region: 'plains' });
fieldTrial('the same in the forest valley', [...line, 'spearmen'], riders, { foe: 'orhai', region: 'valley' });
fieldTrial('2 spears, an archer, and cavalry against 4 riders, on the plains', ['spearmen', 'spearmen', 'archers', 'cavalry'], riders, { foe: 'orhai', region: 'plains' });
fieldTrial('4 cavalry against 4 of the Skarn, on the plains', ['cavalry', 'cavalry', 'cavalry', 'cavalry'], [...skarnBand, 'warriors'], { region: 'plains' });
fieldTrial('4 skirmishers against 4 of the Skarn, in the woods', ['skirmishers', 'skirmishers', 'skirmishers', 'skirmishers'], [...skarnBand, 'warriors'], { region: 'woods' });
fieldTrial('storming walls: 6 against 3', [...line, ...line], skarnBand, { attacker: 'us', walls: true });
fieldTrial('storming walls: 6 and 2 siege engines against 3', [...line, ...line, 'engines', 'engines'], skarnBand, { attacker: 'us', walls: true });
// A great nation's host comes against the capital (October 2026): about a
// third to a half of their strength, worth 2.2 to 2.4. Your army meets it in
// the valley, before it reaches the walls.
const greatHost = ['horseArchers', 'horseArchers', 'lancers', 'lancers', 'horseArchers'];
const dravanHost = ['warriors', 'warriors', 'bowmen', 'warriors'];
fieldTrial('a great host: 6 companies against 5 Orhai riders, in the valley', [...line, ...line], greatHost, { foe: 'orhai', theirWorth: 2.4 });
fieldTrial('a great host: 5 companies against 5 Orhai riders', [...line, 'spearmen', 'archers'], greatHost, { foe: 'orhai', theirWorth: 2.4 });
fieldTrial('a great host: 4 companies against 5 Orhai riders', [...line, 'spearmen'], greatHost, { foe: 'orhai', theirWorth: 2.4 });
fieldTrial('a great host: 5 companies against 4 Dravan companies', [...line, 'spearmen', 'archers'], dravanHost, { foe: 'dravan', theirWorth: 2.2 });
fieldTrial('a great host: 4 companies against 4 Dravan companies', [...line, 'spearmen'], dravanHost, { foe: 'dravan', theirWorth: 2.2 });
