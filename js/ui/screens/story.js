// A choice event, on its own screen.

import { describePending } from '../../engine/events.js';
import { state, esc } from '../core.js';

export function storyScreen() {
  const view = describePending(state);
  let html = `<h1>${esc(view.title)}</h1><p>${esc(view.text)}</p>`;
  if (view.advice.length) {
    html += `<h2>Advice</h2><ul>${view.advice.map((a) => `<li>${esc(a.name)}, ${esc(a.title.toLowerCase())}: ${esc(a.text)}</li>`).join('')}</ul>`;
  }
  html += `<form id="storyForm"><fieldset><legend>What will you do?</legend>
    ${view.options.map((o) => `<label class="choice"><input type="radio" name="choice" value="${esc(o.id)}"> ${esc(o.label)}</label>`).join('')}
    </fieldset>
    <div class="actions"><button type="submit" class="primary">Confirm</button></div>
  </form>`;
  return html;
}
