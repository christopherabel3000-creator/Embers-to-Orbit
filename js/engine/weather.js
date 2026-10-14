// The weather. Each season has its own, drawn as the season begins, and
// every battle that season is fought in it. Weather is the same for both
// sides; what it changes is which tactics pay.

import { seasonIndex } from './state.js';
import { nextRandom } from './rng.js';

export const WEATHER = {
  clear: { name: 'clear skies', effect: '' },
  rain: { name: 'rain', effect: 'Arrows fall short, and the mud slows anyone who charges.' },
  fog: { name: 'fog', effect: 'Arrows fly blind, numbers are hard to judge, and raiders are harder to spot coming.' },
  snow: { name: 'snow', effect: 'Everyone fights a little weaker in the cold, and wounds are deadlier.' },
  heat: { name: 'heat', effect: 'Fighters tire: after the second round, everyone strikes weaker.' },
};

// The chance of each kind of weather, by season: spring, summer, autumn, winter.
export const WEATHER_ODDS = [
  { clear: 0.5, rain: 0.35, fog: 0.15 },
  { clear: 0.55, heat: 0.3, rain: 0.15 },
  { clear: 0.4, fog: 0.3, rain: 0.3 },
  { clear: 0.3, snow: 0.55, fog: 0.15 },
];

// Draws the weather for the season the game is now in.
export function drawWeather(state) {
  const odds = WEATHER_ODDS[seasonIndex(state)];
  let roll = nextRandom(state);
  for (const [kind, p] of Object.entries(odds)) {
    if (roll < p) return kind;
    roll -= p;
  }
  return 'clear';
}

export function weatherNow(state) {
  return state.weather || 'clear';
}

// How the weather changes a battle round. arrows and charge multiply what
// archers and charging fighters strike for; all multiplies everyone;
// woundExtra is added to the harm of every wound.
export function weatherEffects(weather, round = 1) {
  return {
    arrows: weather === 'rain' ? 0.5 : weather === 'fog' ? 0.7 : 1,
    charge: weather === 'rain' ? 0.85 : 1,
    all: weather === 'snow' ? 0.9 : weather === 'heat' && round >= 3 ? 0.85 : 1,
    woundExtra: weather === 'snow' ? 5 : 0,
  };
}

// "Weather: rain. Arrows fall short, ..." or null in clear weather.
export function weatherLine(weather) {
  if (!weather || weather === 'clear') return null;
  return `Weather: ${WEATHER[weather].name}. ${WEATHER[weather].effect}`;
}
