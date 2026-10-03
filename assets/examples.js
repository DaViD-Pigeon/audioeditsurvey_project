import {sampleOperation, sampleURL, matchingSamples} from './sample-routing.js';
import {operations} from './catalog.js';

const root = document.querySelector('#audio-examples');
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const speechHeaders = ['Input audio', 'Input text', 'Instruction', 'Output audio', 'Output text'];
const mediaHeaders = ['Input audio', 'Instruction', 'Output audio'];
const domains = ['Speech', 'Music', 'Audio'];
const categoryOrder = ['Acoustic', 'Semantic', 'Instance'];
const descriptions = {
  Speech: 'Read the input and output transcripts alongside the edit. Highlighted text marks the target words or region.',
  Music: 'Compare acoustic, lyric, and instrument edits, listening for preservation of the surrounding music.',
  Audio: 'Compare acoustic and sound-event edits, listening for preservation of the surrounding scene.',
};
const selectedCategories = {Speech: 'Acoustic', Music: 'All', Audio: 'All'};
let examples = [];
let domain = 'Speech';
let activeOperation = null;
let examplesLoaded = false;

function textWithHighlight(text, highlight) {
  if (!highlight || !text.includes(highlight)) return escapeHTML(text);
  const start = text.indexOf(highlight);
  return escapeHTML(text.slice(0, start)) + '<mark>' + escapeHTML(highlight) + '</mark>' + escapeHTML(text.slice(start + highlight.length));
}

function pausePlayers() {
  root.querySelectorAll('audio').forEach(audio => audio.pause());
}

function player(example, side) {
  const url = side === 'input' ? example.inputAudio : example.outputAudio;
  const label = `${example.title} — ${side} audio`;
  return `<audio controls preload="none" src="${escapeHTML(url)}" aria-label="${escapeHTML(label)}" data-example="${escapeHTML(example.id)}" data-side="${side}"></audio><p class="audio-error" hidden>Audio unavailable. <a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">Open audio</a>.</p>`;
}

function row(example, headers) {
  const input = `<strong class="example-title">${escapeHTML(example.title)}</strong>${player(example, 'input')}`;
  const output = player(example, 'output');
  const category = `<span class="example-category">${escapeHTML(example.category)}${example.operation ? ` · ${escapeHTML(example.operation)}` : ''}</span>`;
  const instruction = `${category}<p>${escapeHTML(example.instruction)}</p>`;
  const cells = example.domain === 'Speech'
    ? [input, `<p>${textWithHighlight(example.inputText, example.inputHighlight)}</p>`, instruction, output, `<p>${textWithHighlight(example.outputText, example.outputHighlight)}</p>`]
    : [input, `${instruction}<p class="example-preservation"><strong>Preserve:</strong> ${escapeHTML(example.preservation)}</p>`, output];
  return `<tbody data-edit-example="${escapeHTML(example.id)}"><tr>${cells.map((cell, i) => `<td data-label="${headers[i]}">${cell}</td>`).join('')}</tr></tbody>`;
}

function renderCategory(category) {
  pausePlayers();
  selectedCategories[domain] = category;
  root.querySelectorAll('[data-example-category]').forEach(button => {
    const active = button.dataset.exampleCategory === category;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  const visible = matchingSamples(examples, domain, category, activeOperation?.id);
  if (!visible.length) {
    const label = activeOperation?.label || category;
    root.querySelector('#example-results').innerHTML = `<div class="empty-state"><h3>${escapeHTML(domain)} · ${escapeHTML(label)}</h3><p>No sample for this operation yet.</p><button type="button" class="inline-link" data-clear-sample-filter>Show all ${escapeHTML(domain)} samples</button></div>`;
    return;
  }
  const headers = domain === 'Speech' ? speechHeaders : mediaHeaders;
  const tableClass = domain === 'Speech' ? 'speech-examples-table' : 'media-examples-table';
  const context = activeOperation ? `<p class="small-note">Samples: <strong>${escapeHTML(activeOperation.label)}</strong> · <button type="button" class="inline-link" data-clear-sample-filter>Show all ${escapeHTML(domain)} samples</button></p>` : '';
  root.querySelector('#example-results').innerHTML = `${context}<table class="editing-examples-table ${tableClass}"><caption class="visually-hidden">${domain} ${category === 'All' ? '' : category.toLowerCase() + ' '}editing examples</caption><colgroup>${headers.map(() => '<col>').join('')}</colgroup><thead><tr>${headers.map(header => `<th scope="col">${header}</th>`).join('')}</tr></thead>${visible.map(example => row(example, headers)).join('')}</table>`;
}

function renderDomain(nextDomain) {
  domain = nextDomain;
  root.querySelectorAll('[data-example-domain]').forEach(button => {
    const active = button.dataset.exampleDomain === domain;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
    button.tabIndex = active ? 0 : -1;
  });
  root.querySelector('#example-domain-panel').setAttribute('aria-labelledby', `example-domain-${domain.toLowerCase()}`);
  root.querySelector('#example-domain-description').textContent = descriptions[domain];
  const available = examples.filter(example => example.domain === domain);
  const categories = categoryOrder.filter(category => available.some(example => example.category === category) || selectedCategories[domain] === category);
  const filters = root.querySelector('#example-category-filters');
  filters.hidden = categories.length < 2;
  filters.innerHTML = ['All', ...categories].map(category => `<button type="button" data-example-category="${category}" aria-controls="example-results" aria-pressed="false">${category} <span class="tab-count">${available.filter(example => category === 'All' || example.category === category).length}</span></button>`).join('');
  renderCategory(selectedCategories[domain]);
}

function clearSampleRoute() {
  activeOperation = null;
  const url = new URL(location.href);
  if (url.searchParams.has('sample')) {
    url.searchParams.delete('sample');
    history.replaceState({}, '', url);
  }
}

function restoreSampleRoute(scroll = false) {
  activeOperation = sampleOperation(location.search);
  if (activeOperation) {
    domain = activeOperation.domain;
    selectedCategories[domain] = activeOperation.category;
  }
  if (!examplesLoaded) return;
  renderDomain(domain);
  if (scroll && location.hash === '#audio-examples') {
    requestAnimationFrame(() => root.scrollIntoView({behavior: 'instant'}));
  }
}

// Real anchor URLs support reloads, history, and opening a sample in a new tab.
document.addEventListener('click', event => {
  const link = event.target.closest('[data-sample-operation]');
  if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  if (!operations.some(operation => operation.id === link.dataset.sampleOperation)) return;
  event.preventDefault();
  history.pushState({}, '', sampleURL(location.href, link.dataset.sampleOperation));
  restoreSampleRoute(true);
});
window.addEventListener('popstate', () => restoreSampleRoute(location.hash === '#audio-examples'));
root.addEventListener('click', event => {
  if (!event.target.closest('[data-clear-sample-filter]')) return;
  clearSampleRoute();
  selectedCategories[domain] = 'All';
  renderDomain(domain);
});

// One player at a time across all domains, including when changing filters.
root.addEventListener('play', event => {
  if (event.target.tagName !== 'AUDIO') return;
  root.querySelectorAll('audio').forEach(audio => {
    if (audio !== event.target) audio.pause();
  });
}, true);
root.addEventListener('error', event => {
  if (event.target.tagName === 'AUDIO') event.target.nextElementSibling.hidden = false;
}, true);
root.addEventListener('canplay', event => {
  if (event.target.tagName === 'AUDIO') event.target.nextElementSibling.hidden = true;
}, true);

function keyboardSwitch(event, selector) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const buttons = [...event.currentTarget.querySelectorAll(selector)];
  const i = buttons.indexOf(event.target.closest(selector));
  if (i < 0) return;
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (i + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
  buttons[next].click();
  buttons[next].focus();
}

try {
  const manifests = await Promise.all(['speech-examples.json', 'media-examples.json'].map(async file => {
    const response = await fetch(new URL(`../data/${file}`, import.meta.url));
    if (!response.ok) throw new Error(`${file}: HTTP ${response.status}`);
    return response.json();
  }));
  examples = manifests.flatMap(manifest => manifest.examples.map(example => ({...example, domain: example.domain || manifest.domain})));
  const tabs = root.querySelector('#example-domain-tabs');
  tabs.innerHTML = domains.map(name => `<button type="button" role="tab" id="example-domain-${name.toLowerCase()}" data-example-domain="${name}" aria-controls="example-domain-panel" aria-selected="false" tabindex="-1">${name} <span class="tab-count">${examples.filter(example => example.domain === name).length}</span></button>`).join('');
  tabs.addEventListener('click', event => {
    const button = event.target.closest('[data-example-domain]');
    if (button) { clearSampleRoute(); renderDomain(button.dataset.exampleDomain); }
  });
  tabs.addEventListener('keydown', event => keyboardSwitch(event, '[data-example-domain]'));
  const filters = root.querySelector('#example-category-filters');
  filters.addEventListener('click', event => {
    const button = event.target.closest('[data-example-category]');
    if (button) { clearSampleRoute(); renderCategory(button.dataset.exampleCategory); }
  });
  filters.addEventListener('keydown', event => keyboardSwitch(event, '[data-example-category]'));
  examplesLoaded = true;
  restoreSampleRoute(location.hash === '#audio-examples');
} catch (error) {
  root.querySelector('#example-results').innerHTML = '<p>Audio examples could not load. Please reload the page.</p>';
  console.error('Audio examples:', error);
}
