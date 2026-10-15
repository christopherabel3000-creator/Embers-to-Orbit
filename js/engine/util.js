// Small shared helpers for the engine.

import { nextRandom } from './rng.js';

export function shuffle(state, list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(nextRandom(state) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function listNames(people) {
  return listWords(people.map((p) => p.name));
}

export function listWords(words) {
  if (words.length <= 1) return words.join('');
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
}

export function clamp(v) {
  return Math.max(0, Math.min(100, Math.round(v)));
}

export function capital(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// "The Ostran delta" to "the Ostran delta", for the middle of a sentence.
export function lowerFirst(text) {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

export function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}
