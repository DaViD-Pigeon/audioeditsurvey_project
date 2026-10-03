import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resourceKinds, defaults, filterRecords, operations} from '../assets/catalog.js';
const data=JSON.parse(await readFile(new URL('../data/resources.json',import.meta.url)));

test('all source resource groups and citations are retained',()=>{
  assert.deepEqual(resourceKinds.map(k=>data[k].length),[27,30,37,9,36]);
  for(const k of resourceKinds)for(const r of data[k]){
    assert.ok(r.domains.length,`${k}: ${r.name}`);
    for(const link of r.links)assert.match(link.url,/^https:\/\//);
  }
  assert.ok(data.citation.includes('pan2026audio'));
  assert.ok(data.metrics.some(r=>r.name.includes('SpeechJudge')));
  assert.ok(data.metrics.some(r=>r.name.includes('Audiobox')));
  assert.ok(!data.benchmarks.some(r=>r.name.includes('PolyEval')));
});
test('multi-domain models are searchable by both Unified and their actual domains',()=>{
  const unified=filterRecords(data,{...defaults,domain:'Unified'});
  assert.equal(unified.length,6);
  assert.ok(unified.some(r=>r.name==='AuK / AuK-Flash'));
  assert.ok(!filterRecords(data,{...defaults,domain:'Audio'}).some(r=>r.name==='AuK / AuK-Flash'));
  assert.ok(filterRecords(data,{...defaults,domain:'Music'}).some(r=>r.name==='AuK / AuK-Flash'));
});
test('compound filters preserve six documented training-free entries and hybrid architectures',()=>{
  const free=filterRecords(data,{...defaults,paradigm:'Training-free'});
  assert.equal(free.length,6);
  assert.equal(free.find(r=>r.name==='AudioEditor').venue,'ICASSP 2025');
  assert.match(free.find(r=>r.name==='MelodyFlow').venue,/Workshop/);
  assert.deepEqual(filterRecords(data,{...defaults,domain:'Music',paradigm:'Training-free',architecture:'Flow matching'}).map(r=>r.name),['MelodyFlow']);
  assert.ok(filterRecords(data,{...defaults,architecture:'Codec language model'}).some(r=>r.name==='Vevo2'));
  assert.ok(filterRecords(data,{...defaults,architecture:'Flow matching'}).some(r=>r.name==='Vevo2'));
});
test('dataset filters distinguish pairing from alignment and retain adaptation markers',()=>{
  const paired=filterRecords(data,{...defaults,tab:'datasets',paired:'Paired'});
  assert.ok(paired.some(r=>r.name==='GTSinger'));
  assert.ok(!paired.some(r=>r.name==='MAESTRO v3'));
  const instruction=filterRecords(data,{...defaults,tab:'datasets',domain:'Unified',annotation:'Instruction'});
  assert.equal(instruction[0].name,'AudioEdit (Audio-Omni)');
  assert.ok(filterRecords(data,{...defaults,tab:'datasets',duration:'over1000'}).every(r=>r.hours>=1000));
  assert.ok(data.datasets.find(r=>r.name==='LibriSpeech').editing.includes('†'));
});
test('tool purposes and evaluation dimensions remain distinct',()=>{
  assert.equal(filterRecords(data,{...defaults,tab:'tools',purpose:'Generation'}).length,17);
  assert.equal(filterRecords(data,{...defaults,tab:'tools',purpose:'Annotation'}).length,20);
  assert.equal(filterRecords(data,{...defaults,tab:'metrics',dimension:'Multi-dimensional Evaluators'}).length,6);
  assert.equal(filterRecords(data,{...defaults,q:'does not exist'}).length,0);
  assert.ok(data.benchmarks.find(r=>r.name==='ZoME-Bench').links.some(l=>l.note?.includes('source audio')));
});
test('linked taxonomy models match their operation domain and category',()=>{
  for(const op of operations){
    const matches=filterRecords(data,{...defaults,domain:op.domain,type:op.category},op.models);
    assert.equal(matches.length,op.models.length,op.id);
    // A task can have a prepared sample without a linked foundation model.
  }
});
