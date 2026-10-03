export const resourceKinds = ['models', 'datasets', 'tools', 'benchmarks', 'metrics'];
export const defaults = {tab:'models', q:'', domain:'All', type:'All', architecture:'All', paradigm:'All', paired:'All', annotation:'All', duration:'All', purpose:'All', dimension:'All', sort:'curated', op:'', page:1};
export const pageSize = tab => tab === 'benchmarks' ? 6 : 10;
export function filterRecords(data, state, operationIds = null) {
  const query = state.q.toLocaleLowerCase().trim();
  const words = query.split(/\s+/).filter(Boolean);
  let records = data[state.tab].filter(r => {
    if (state.domain !== 'All' && !(state.domain === 'Unified' ? r.group === 'Unified' : r.domains.includes(state.domain))) return false;
    if (state.type !== 'All' && !r.categories?.includes(state.type)) return false;
    if (state.architecture !== 'All' && !r.architectures?.includes(state.architecture)) return false;
    if (state.paradigm !== 'All' && r.paradigm !== state.paradigm) return false;
    if (state.paired !== 'All' && r.paired !== (state.paired === 'Paired')) return false;
    if (state.annotation !== 'All' && !r.annotationTypes?.includes(state.annotation)) return false;
    if (state.duration !== 'All') {
      const range = {'under10':[0,10], '10to100':[10,100], '100to1000':[100,1000], 'over1000':[1000,Infinity]}[state.duration];
      if (!range || r.hours < range[0] || r.hours >= range[1]) return false;
    }
    if (state.purpose !== 'All' && r.purpose !== state.purpose) return false;
    if (state.dimension !== 'All' && r.dimension !== state.dimension) return false;
    if (operationIds && !operationIds.includes(r.id)) return false;
    const searchable = [r.name, r.editing, r.architecture, r.paradigm, r.group, ...r.domains, r.annotation, r.modalities, r.description, r.level, r.dimension, r.inputs, r.evaluation].filter(Boolean).join(' ').toLocaleLowerCase();
    return words.every(word => searchable.includes(word));
  });
  if (state.sort === 'name') records.sort((a,b) => a.name.localeCompare(b.name));
  if (state.sort === 'duration') records.sort((a,b) => b.hours-a.hours);
  if (state.sort === 'curated') records = records.map((r,i) => ({r,i})).sort((a,b) => (a.r.group === 'Unified' ? 0 : 1) - (b.r.group === 'Unified' ? 0 : 1) || a.i-b.i).map(x=>x.r);
  return records;
}

export const taxonomy = {
  Acoustic: {symbol:'∿', subtitle:'CHANGE THE SOUND', definition:'Modify low-level perceptual attributes while preserving content and source characteristics.', preserve:'Linguistic content, source identity, and overall structure.'},
  Semantic: {symbol:'Aa', subtitle:'CHANGE THE MEANING', definition:'Modify interpretable content, expression, or style while keeping task-irrelevant properties intact.', preserve:'Identity and scene context outside the requested change.'},
  Instance: {symbol:'⊞', subtitle:'CHANGE THE SOURCES', definition:'Manipulate identifiable sources or events while preserving the rest of the audio scene.', preserve:'Non-target sources and their relationships.'}
};

// Operations follow the survey taxonomy. Model mappings are optional and
// use capabilities in the English README, including suitable Unified models.
export const operations = [
  {id:'speech-loudness',domain:'Speech',category:'Acoustic',label:'Loudness',models:['ming-uniaudio-edit','auk-auk-flash']},
  {id:'speech-restoration',domain:'Speech',category:'Acoustic',label:'Denoising & restoration',models:['ming-uniaudio-edit','auk-auk-flash']},
  {id:'speech-reverb',domain:'Speech',category:'Acoustic',label:'Reverberation editing',models:[]},
  {id:'speech-eq',domain:'Speech',category:'Acoustic',label:'Audio equalization (EQ)',models:[]},
  {id:'speech-words',domain:'Speech',category:'Semantic',label:'Linguistic editing',models:['ming-uniaudio-edit','cosyedit','voicecraft-x','voicecraft','ssr-speech','f5-tts','fluentspeech','editts','auk-auk-flash','vevo2']},
  {id:'speech-expression',domain:'Speech',category:'Semantic',label:'Emotion & delivery',models:['step-audio-editx','ming-uniaudio-edit','auk-auk-flash','vevo2']},
  {id:'speech-prosody',domain:'Speech',category:'Semantic',label:'Pitch & prosody',models:['ming-uniaudio-edit','vevo2','editts','audiomorphix']},
  {id:'speech-identity',domain:'Speech',category:'Instance',label:'Voice identity',models:['auk-auk-flash','vevo2']},
  {id:'speech-extraction',domain:'Speech',category:'Instance',label:'Source extraction',models:['auk-auk-flash','audio-omni']},
  {id:'music-loudness',domain:'Music',category:'Acoustic',label:'Loudness',models:['auk-auk-flash']},
  {id:'music-restoration',domain:'Music',category:'Acoustic',label:'Denoising & restoration',models:['auk-auk-flash']},
  {id:'music-reverb',domain:'Music',category:'Acoustic',label:'Reverberation editing',models:[]},
  {id:'music-eq',domain:'Music',category:'Acoustic',label:'Audio equalization (EQ)',models:[]},
  {id:'music-style',domain:'Music',category:'Semantic',label:'Genre & style',models:['melodyflow','ap-adapter','anchorsteer','ace-step-1-5','ddpm-inversion-zeta','vevo2']},
  {id:'music-lyrics',domain:'Music',category:'Semantic',label:'Lyric editing',models:['yingmusic-singer-plus','auk-auk-flash','vevo2']},
  {id:'music-pitch',domain:'Music',category:'Semantic',label:'Pitch & tempo',models:['audiomorphix']},
  {id:'music-stems',domain:'Music',category:'Instance',label:'Stem addition & removal',models:['instruct-musicgen','musicgen-stem','ace-step-1-5','audio-omni','directaudioedit','audiomorphix']},
  {id:'music-instruments',domain:'Music',category:'Instance',label:'Instrument replacement',models:['melodyflow','ap-adapter','anchorsteer','ddpm-inversion-zeta','musicgen-stem']},
  {id:'music-singer',domain:'Music',category:'Instance',label:'Singer identity',models:['yingmusic-singer-plus','vevo2','auk-auk-flash']},
  {id:'audio-loudness',domain:'Audio',category:'Acoustic',label:'Volume & mixing',models:['mmedit','smartdj-editor']},
  {id:'audio-reverb',domain:'Audio',category:'Acoustic',label:'Reverberation editing',models:['smartdj-editor']},
  {id:'audio-eq',domain:'Audio',category:'Acoustic',label:'Audio equalization (EQ)',models:[]},
  {id:'audio-restore',domain:'Audio',category:'Acoustic',label:'Denoising & restoration',models:['sao-instruct']},
  {id:'audio-pitch',domain:'Audio',category:'Semantic',label:'Pitch & rate',models:['sao-instruct','audiomorphix']},
  {id:'audio-events',domain:'Audio',category:'Instance',label:'Add, remove & replace',models:['audio-omni','audiomorphix','directaudioedit','audioeditor','mmedit','sao-instruct','smartdj-editor']},
  {id:'audio-order',domain:'Audio',category:'Instance',label:'Event timing',models:['audiomorphix','mmedit','smartdj-editor']},
  {id:'audio-video',domain:'Audio',category:'Instance',label:'Video-guided replacement',models:['coherentavedit']}
];
