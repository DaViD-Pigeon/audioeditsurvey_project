import {operations} from './catalog.js';

export function sampleOperation(search) {
  const id = new URLSearchParams(search).get('sample');
  return operations.find(operation => operation.id === id) || null;
}

export function sampleURL(currentURL, operationId) {
  const url = new URL(currentURL);
  url.searchParams.set('sample', operationId);
  url.hash = 'audio-examples';
  return url;
}

export function matchingSamples(examples, domain, category, operationId = '') {
  return examples.filter(example => example.domain === domain
    && (category === 'All' || example.category === category)
    && (!operationId || example.operationIds?.includes(operationId)));
}
