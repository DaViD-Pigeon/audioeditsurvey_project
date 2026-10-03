import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {operations} from '../assets/catalog.js';
import {matchingSamples, sampleOperation, sampleURL} from '../assets/sample-routing.js';

const manifests = await Promise.all(['speech-examples.json', 'media-examples.json'].map(async name =>
  JSON.parse(await readFile(new URL('../data/' + name, import.meta.url)))));
const examples = manifests.flatMap(manifest => manifest.examples.map(example => ({...example, domain: example.domain || manifest.domain})));

test('taxonomy links resolve to samples and preserve independent resource filters', () => {
  const url = sampleURL('http://localhost:8000/audioeditsurvey_project/?tab=datasets&domain=Audio#resources', 'music-lyrics');
  assert.equal(url.hash, '#audio-examples');
  assert.equal(url.searchParams.get('tab'), 'datasets');
  assert.equal(url.searchParams.get('domain'), 'Audio');
  assert.equal(sampleOperation(url.search).domain, 'Music');
  assert.equal(sampleOperation(url.search).category, 'Semantic');
  assert.equal(sampleOperation('?sample=unknown'), null);
});

test('available operations select the matching recordings, including speech expression versus words', () => {
  const expected = {
    'speech-loudness': ['volume-global', 'volume-local'],
    'speech-reverb': ['speech-dereverb'],
    'speech-eq': ['speech-eq-bright'],
    'speech-restoration': ['speech-denoise'],
    'speech-words': ['auk-content', 'omni-word'],
    'speech-expression': ['step-whisper'],
    'speech-prosody': ['seed-prosody'],
    'speech-identity': ['seed-identity'],
    'music-loudness': ['music-volume-global', 'music-volume-local'],
    'music-reverb': ['music-dereverb'],
    'music-eq': ['music-eq-bright'],
    'music-restoration': ['music-denoise'],
    'music-lyrics': ['auk-lyric'],
    'music-instruments': ['omni-instrument'],
    'audio-loudness': ['audio-volume-global', 'audio-volume-local'],
    'audio-reverb': ['audio-dereverb'],
    'audio-eq': ['audio-eq-bright'],
    'audio-restore': ['audio-denoise'],
    'audio-events': ['omni-add', 'omni-remove'],
  };
  for (const operation of operations) {
    assert.deepEqual(matchingSamples(examples, operation.domain, operation.category, operation.id).map(example => example.id), expected[operation.id] || [], operation.id);
  }
});

test('every sample annotation agrees with the taxonomy domain and category', () => {
  for (const example of examples) {
    assert.ok(example.operationIds.length > 0, example.id);
    for (const id of example.operationIds) {
      const operation = operations.find(item => item.id === id);
      assert.ok(operation, `${example.id}: ${id}`);
      assert.equal(operation.domain, example.domain, example.id);
      assert.equal(operation.category, example.category, example.id);
    }
  }
});
