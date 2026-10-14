// Difficulty: how many enemies come against your people. It is part of the
// game, saved with it, and can be changed at any time from the Menu screen.
//
// Raids on the camp and outlaw bands are scaled when they set out. The Skarn
// nation keeps that many more warriors under arms, and that many more hill
// clansmen join it, so its war bands, great hosts, sieges, and ambushes, and
// the defenders of its hold, grow in step, and the numbers on the Neighbors
// screen stay true.

export const DIFFICULTIES = {
  easy: { name: 'Easy', raid: 1, about: 'Raids come as the game was first balanced: the gentlest way to play.' },
  normal: { name: 'Normal', raid: 1.25, about: 'Every raid, war band, siege, and ambush brings a quarter more enemies than on Easy.' },
  hard: { name: 'Hard', raid: 1.5, about: 'Half again as many enemies as on Easy.' },
  insane: { name: 'Insane', raid: 2, about: 'Twice as many enemies as on Easy.' },
};
export const DIFFICULTY_ORDER = ['easy', 'normal', 'hard', 'insane'];
export const DEFAULT_DIFFICULTY = 'normal';

// How many enemies come, compared with Easy.
export function raidScale(state) {
  return (DIFFICULTIES[state.difficulty] || DIFFICULTIES.easy).raid;
}
