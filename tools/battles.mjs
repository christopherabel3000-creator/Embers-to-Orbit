// Fights many auto-resolved battles to check combat balance.
// Run with: node tools/battles.mjs
import { newGame } from '../js/engine/game.js';
import { living } from '../js/engine/state.js';
import { createBattle, autoBattle } from '../js/engine/battle.js';
import { raidOdds } from '../js/engine/advisors.js';

function trial({ raiders, warned = true, palisade = false, side = 'defend', fighters = 12, spears = false }) {
  let wins = 0; let deaths = 0; let wounded = 0; let rounds = 0;
  const N = 400;
  for (let i = 0; i < N; i++) {
    const s = newGame({ seed: 5000 + i });
    s.people = s.people.slice(0, fighters);
    if (palisade) s.buildings.palisade = 1;
    if (spears) s.knowledge.learned.push('spears');
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
  // The war chief judges the same battle: an attack or a defense.
  s0.neighbors.skarn.known = true;
  const ev0 = { type: 'raid', raiders, warned, from: 'skarn', side };
  s0.pendingEvent = { ...ev0, battle: createBattle(s0, ev0) };
  const odds = raidOdds(s0, living(s0), warned, raiders).word;
  return `${side} ${raiders} raiders vs ${fighters}${palisade ? ' +palisade' : ''}${warned ? '' : ' surprised'}${spears ? ' +spears' : ''}: win ${(100 * wins / N).toFixed(0)}% | deaths ${(deaths / N).toFixed(2)} | wounded ${(wounded / N).toFixed(1)} | rounds ${(rounds / N).toFixed(1)} | advisor says "${odds}"`;
}

for (const cfg of [
  { raiders: 5 }, { raiders: 9 }, { raiders: 13 }, { raiders: 17 }, { raiders: 13, warned: false },
  { raiders: 13, palisade: true }, { raiders: 17, palisade: true }, { raiders: 21, palisade: true },
  { raiders: 9, fighters: 6 }, { raiders: 13, spears: true },
  { side: 'attack', raiders: 10 }, { side: 'attack', raiders: 14 }, { side: 'attack', raiders: 18 },
]) console.log(trial(cfg));
