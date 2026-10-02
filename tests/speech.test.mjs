import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import test from 'node:test';

const audioRoot = new URL('../assets/audio/', import.meta.url);
const metadata = JSON.parse(await readFile(new URL('volume-generation.json', audioRoot)));

async function readPCM(name) {
  const bytes = await readFile(new URL(name, audioRoot));
  assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
  assert.equal(bytes.toString('ascii', 8, 12), 'WAVE');
  assert.equal(createHash('sha256').update(bytes).digest('hex'), metadata.sha256[name]);
  let format, samples;
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const id = bytes.toString('ascii', offset, offset + 4);
    const size = bytes.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (id === 'fmt ') format = {
      encoding: bytes.readUInt16LE(start), channels: bytes.readUInt16LE(start + 2),
      rate: bytes.readUInt32LE(start + 4), bits: bytes.readUInt16LE(start + 14),
    };
    if (id === 'data') samples = Array.from({length: size / 2}, (_, i) => bytes.readInt16LE(start + i * 2));
    offset = start + size + (size % 2);
  }
  assert.deepEqual(format, {encoding: 1, channels: 1, rate: 24000, bits: 16});
  assert.ok(samples?.length);
  return samples;
}

const source = await readPCM('volume-input.wav');
const louder = await readPCM('volume-global-plus6.wav');
const quieter = await readPCM('volume-second-minus10.wav');
const energy = samples => samples.reduce((sum, x) => sum + x * x, 0);
const gainDb = (edited, original) => 10 * Math.log10(energy(edited) / energy(original));

test('volume processing preserves sample count and avoids clipping', () => {
  assert.equal(source.length, louder.length);
  assert.equal(source.length, quieter.length);
  assert.equal(source.length / metadata.sampleRate, metadata.duration);
  for (const samples of [source, louder, quieter]) {
    assert.ok(samples.every(x => Math.abs(x) < 32767));
  }
});

test('the global example applies +6 dB to the full utterance', () => {
  const split = Math.round(metadata.secondClauseStart * metadata.sampleRate);
  for (const [start, end] of [[0, split], [split, source.length]]) {
    assert.ok(Math.abs(gainDb(louder.slice(start, end), source.slice(start, end)) - 6) < 0.01);
  }
});

test('the local example preserves clause one and applies −10 dB to clause two', () => {
  const split = Math.round(metadata.secondClauseStart * metadata.sampleRate);
  assert.deepEqual(quieter.slice(0, split), source.slice(0, split));
  assert.ok(Math.abs(gainDb(quieter.slice(split), source.slice(split)) + 10) < 0.01);
});
