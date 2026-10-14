// Routine lines for the season report: what the season's work brought in
// and used up, and who grew more skilled. They come every season, so the
// report keeps them few and short, under their own heading after the news.

import { inVillage } from './state.js';
import { SKILLS } from './data.js';
import { listWords, capital } from './util.js';

// "Brought in: 38 food from hunting and foraging, 18 food from the herds,
// 12 wood, 18 stone, and 8 goods."
export function incomeLine({ food = 0, herds = 0, wood = 0, stone = 0, goods = 0, foodWorkers = 0 }) {
  const parts = [];
  if (food > 0) parts.push(`${food} food from hunting and foraging`);
  if (herds > 0) parts.push(`${herds} food from the herds`);
  if (wood > 0) parts.push(`${wood} wood`);
  if (stone > 0) parts.push(`${stone} stone`);
  if (goods > 0) parts.push(`${goods} goods`);
  const lines = [];
  if (parts.length) lines.push(`Brought in: ${listWords(parts)}.`);
  if (food <= 0 && foodWorkers > 0) lines.push('Hunters and foragers found nothing.');
  return lines.length ? lines.join(' ') : null;
}

// "Used: 18 wood for the fires, 6 goods for comforts, and 3 goods to arm
// the guards. 5 food spoiled in storage."
export function upkeepLine({ fires = 0, comforts = 0, arms = 0, spoiled = 0 }) {
  const parts = [];
  if (fires > 0) parts.push(`${fires} wood for the fires`);
  if (comforts > 0) parts.push(`${comforts} goods for comforts`);
  if (arms > 0) parts.push(`${arms} goods to arm the guards`);
  const lines = [];
  if (parts.length) lines.push(`Used: ${listWords(parts)}.`);
  if (spoiled > 0) lines.push(`${spoiled} food spoiled in storage.`);
  return lines.length ? lines.join(' ') : null;
}

// Who grew more skilled, grouped by skill, highest levels first.
// In a camp every survivor is named. A village names those who reach 4 or
// more, and counts the rest.
export const NAMED_IN_VILLAGE = 4;

export function skillLine(state, gains) {
  if (!gains.length) return null;
  const village = inVillage(state);
  const groups = [];
  for (const skill of SKILLS) {
    const here = gains.filter((g) => g.skill === skill);
    if (!here.length) continue;
    const named = here.filter((g) => !village || g.level >= NAMED_IN_VILLAGE);
    const others = here.length - named.length;
    const levels = [...new Set(named.map((g) => g.level))].sort((a, b) => b - a);
    const bits = levels.map((level) => `${listWords(named.filter((g) => g.level === level).map((g) => g.name))} to ${level}`);
    if (others) bits.push(named.length ? `${others} ${others === 1 ? 'other' : 'others'} a level` : `${others} ${others === 1 ? 'person' : 'people'} a level`);
    groups.push(`${capital(skill)}: ${listWords(bits)}.`);
  }
  return `Skills grew. ${groups.join(' ')}`;
}
