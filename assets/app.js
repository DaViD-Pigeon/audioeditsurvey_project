import {resourceKinds, defaults, filterRecords, taxonomy, operations} from './catalog.js';
import {sampleURL} from './sample-routing.js';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const title = text => text.charAt(0).toUpperCase()+text.slice(1);
let data, state = {...defaults}, currentRecords = [], taxDomain = 'Speech', resourceTable = null;
const descriptions = {
  models: 'Representative editors with public implementations and model weights. Unified groups models supporting multiple audio domains; their exact domains are listed below.',
  datasets: 'A non-exhaustive selection of editing datasets and widely used audio corpora, with availability checked by the repository maintainers.',
  tools: 'Open-source tools for data generation and annotation. Task types describe the editing supervision each tool can help construct.',
  benchmarks: 'Public evaluation resources for edit success and non-target preservation. Composite requests cross editing categories.',
  metrics: 'Four evaluation dimensions, plus reusable multi-dimensional evaluators. Select metrics for both the requested change and the content that should stay intact.'
};
const notes = {
  models: 'Base links identify pretrained backbones; adapter links identify additional learned weights. Each release retains its own license.',
  datasets: 'Paired = source–target audio, mixture–stem correspondence, or matched control takes. † = task construction or adaptation needed. Durations are approximate.',
  tools: '', benchmarks: '', metrics: '↑ Higher is better · ↓ Lower is better. Reference / inputs lists what is needed alongside the edited output.'
};

function linkLabel(link, all) {
  let label = link.label;
  if (link.kind === 'Paper') return /Record|Release/.test(label) ? label : 'Paper';
  if (link.kind === 'Code' && all.filter(x=>x.kind==='Code').length===1) return 'Code';
  if (link.kind === 'Model') return /^(Weights|Hugging.?Face.Model|Model Checkpoint)$/i.test(label) ? 'Model' : label.replace(/Hugging.?Face[ _-]?/i,'').replace(/^Model /,'');
  if (link.kind === 'Dataset') return label.replace(/Hugging.?Face[ _-]?/i,'HF ').replace(/GitHub[ _-]?/i,'GitHub ').replace('Project Page','Project');
  if (link.kind === 'Project Page') return 'Project page';
  return label.replace(/^(GitHub|Hugging.?Face)[ _-]?/i,'');
}
function resourceLinks(items) {
  return `<div class="resource-links">${items.map(link => `<span class="link-wrap"><a class="resource-link" href="${esc(link.url)}" target="_blank" rel="noopener noreferrer" title="${esc(link.kind+': '+link.label)}">${esc(linkLabel(link,items))}</a>${link.note?`<span class="link-note">${esc(link.note)}</span>`:''}</span>`).join('')}</div>`;
}
function domainText(r) {
  return (r.group==='Unified' ? '<b>Unified</b><br>' : '')+esc(r.domains.join(', '))+(r.domainNote && r.domainNote.replace(/[.;]/g,'').trim()!==r.domains.join('; ').replace(/[.;]/g,'').trim()?`<small class="resource-meta">${esc(r.domainNote)}</small>`:'');
}
function resourceName(r) {
  const link=r.links.find(x=>x.kind==='Paper') || r.links[0];
  return `<a class="resource-name" href="${esc(link.url)}" target="_blank" rel="noopener noreferrer">${esc(r.name)}</a>`;
}
function options(values) {return values.map(v=>{const [value,label]=Array.isArray(v)?v:[v,v];return `<option value="${esc(value)}">${esc(label)}</option>`;}).join('');}
function selectFilter(key,label,values) {return `<label class="filter-field"><span>${label}</span><select name="${key}" aria-label="${label}">${options(values)}</select></label>`;}
function buildFilters() {
  let filters=selectFilter('domain','Audio domain',[['All','All domains'],'Unified','Speech','Music',['Audio','General audio']]);
  if (state.tab!=='metrics') filters+=selectFilter('type','Editing category',[['All','All categories'],'Acoustic','Semantic','Instance',...(state.tab==='benchmarks'?['Composite']:[])]);
  if (state.tab==='models') filters+=selectFilter('architecture','Architecture',[['All','All architectures'],'Codec language model','Language model','Diffusion','Flow matching'])+selectFilter('paradigm','Paradigm',[['All','All paradigms'],'Training-based','Training-free']);
  if (state.tab==='datasets') filters+=selectFilter('paired','Audio pairs',[['All','Any pairing'],'Paired','Unpaired'])+selectFilter('annotation','Annotation',[['All','Any annotation'],'Instruction','Caption','Transcript','Label','MIDI / score'])+selectFilter('duration','Duration',[['All','Any duration'],['under10','Under 10 hours'],['10to100','10–100 hours'],['100to1000','100–1,000 hours'],['over1000','1,000+ hours']]);
  if (state.tab==='tools') filters+=selectFilter('purpose','Tool purpose',[['All','Generation & annotation'],'Generation','Annotation']);
  if (state.tab==='metrics') filters+=selectFilter('dimension','Evaluation dimension',[['All','All dimensions'],...new Set(data.metrics.map(r=>r.dimension))]);
  filters+=selectFilter('sort','Sort by',[['curated','Curated order'],['name','Name A–Z'],...(state.tab==='datasets'?[['duration','Duration: high to low']]:[])]);
  $('#filter-fields').innerHTML=filters;
  $$('#filter-fields select').forEach(el=>el.value=state[el.name]);
  $('#resource-search').value=state.q;
  $('#resource-search').placeholder=`Search ${state.tab}, capabilities, and descriptions…`;
  $('#resource-description').innerHTML=esc(descriptions[state.tab])+(notes[state.tab]?`<small>${esc(notes[state.tab])}</small>`:'');
}
function renderTabs() {
  $('#resource-tabs').innerHTML=resourceKinds.map(kind=>`<button type="button" role="tab" id="tab-${kind}" class="resource-tab ${state.tab===kind?'active':''}" data-tab="${kind}" aria-controls="resource-panel" aria-selected="${state.tab===kind}" tabindex="${state.tab===kind?0:-1}">${title(kind)} <span class="tab-count">${data[kind].length}</span></button>`).join('');
  $('#resource-panel').setAttribute('aria-labelledby',`tab-${state.tab}`);
}
const plain = value => `<div class="cell-copy">${esc(value)}</div>`;
function tableRow(r) {
  let cells=[];
  const links=kind=>resourceLinks(r.links.filter(x=>x.kind===kind)) || '—';
  if (state.tab==='models') {
    cells=[resourceName(r), domainText(r), `<div class="capabilities">${esc(r.editing)}</div>`, plain(r.architecture), plain(r.paradigm)+(r.venue?`<span class="resource-meta">${esc(r.venue)}</span>`:''), links('Paper'),links('Code'),links('Model')];
  } else if (state.tab==='datasets') {
    cells=[resourceName(r),domainText(r),plain(r.duration),`<span>${r.paired?'✅':'❌'}</span>${r.pairing?`<span class="resource-meta">${esc(r.pairing)}</span>`:''}`,plain(r.editing),plain(r.annotation),plain(r.modalities),links('Paper'),resourceLinks(r.links.filter(x=>x.kind!=='Paper'))];
  } else if (state.tab==='tools') {
    cells=[resourceName(r)+`<span class="resource-meta">${esc(r.purpose)}</span>`,domainText(r),plain(r.editing),`<div class="capabilities">${esc(r.description)}</div>`,plain(r.level),resourceLinks(r.links)+(r.access?`<span class="resource-meta">${esc(r.access)}</span>`:'')];
  } else {
    cells=[resourceName(r),domainText(r),plain(r.dimension),`<div class="capabilities">${esc(r.description)}</div>`,plain(r.inputs),resourceLinks(r.links)];
  }
  return `<tr id="resource-${esc(r.id)}" data-resource="${esc(r.id)}">${cells.map((cell,i)=>`<td${state.tab==='datasets'&&i===2?` data-order="${r.hours}"`:""}>${cell||'—'}</td>`).join('')}</tr>`;
}
function benchmarkEntry(r) {
  return `<article class="benchmark-entry content" id="resource-${esc(r.id)}" data-resource="${esc(r.id)}"><h3>${esc(r.name)}${r.venue?` (${esc(r.venue)})`:''}</h3><p>${esc(r.description)}</p>${resourceLinks(r.links)}<ul><li><b>Audio domains:</b> ${esc(r.domainNote || r.domains.join(', '))}</li><li><b>Editing categories:</b> ${esc(r.editing)}</li><li><b>Evaluation:</b> ${esc(r.evaluation)}</li></ul>${r.results.length?`<button type="button" class="inline-link results-toggle" data-results="${esc(r.id)}" aria-expanded="false" aria-controls="results-${esc(r.id)}">Reported results <span aria-hidden="true">＋</span></button><div class="benchmark-results" id="results-${esc(r.id)}" hidden>${r.results.map(result=>`<section><p><strong>${esc(result.label)}</strong></p><p>${esc(result.text)}</p>${resourceLinks(result.links)}</section>`).join('')}</div>`:''}</article>`;
}
function renderResults() {
  if(resourceTable){resourceTable.destroy();resourceTable=null;}
  const operation=operations.find(op=>op.id===state.op);
  currentRecords=filterRecords(data,state,operation?.models);
  $('#results-count').innerHTML=`<strong>${currentRecords.length}</strong> of ${data[state.tab].length} ${state.tab}`;
  $('#operation-context').innerHTML=operation?`<div class="operation-context"><span>Selected operation: <strong>${esc(operation.label)}</strong> · ${operation.domain}</span><button class="inline-link" id="clear-operation" aria-label="Clear operation filter">Clear ×</button></div>`:'';
  if(!currentRecords.length) $('#resource-results').innerHTML='<div class="empty-state"><h3>No matching resources.</h3><p>Try a broader domain, category, or search term.</p><button class="inline-link" type="button" data-reset>Reset filters</button></div>';
  else if(state.tab==='benchmarks') $('#resource-results').innerHTML=`<div class="benchmark-list">${currentRecords.map(benchmarkEntry).join('')}</div>`;
  else {
    const headers={models:['Model','Audio domain','Editing types','Model architecture','Paradigm / venue','Paper','Code','Model weights'],datasets:['Dataset','Audio domain','Duration','Paired','Editing types','Annotation','Modalities','Paper','Dataset links'],tools:['Tool / purpose','Audio domain','Task types','What it constructs / annotates','Control / annotation level','Code / Model'],metrics:['Metric','Audio domain','Evaluation dimension','What it measures','Reference / inputs','Resources']}[state.tab];
    $('#resource-results').innerHTML=`<div class="tablecontainer table-scroll" role="region" aria-label="${title(state.tab)} table, scroll horizontally on small screens" tabindex="0"><table class="resource-table display compact stripe" id="results"><caption class="visually-hidden">${title(state.tab)} matching the selected filters</caption><thead><tr>${headers.map(h=>`<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${currentRecords.map(tableRow).join('')}</tbody></table></div><div class="selection-container column-controls"><div class="selection"><div class="selection-col"><b>Visible columns</b>${headers.slice(1).map((h,i)=>`<label><input type="checkbox" class="column-toggle" data-column="${i+1}" checked> ${h}</label>`).join('')}</div></div></div>`;
    // Same DataTables distribution as 3DGS.zip. Each filter renders all matches,
    // so header sorting always operates on the complete filtered collection.
    resourceTable=new window.DataTable('#results',{lengthChange:false,searching:false,info:false,paging:false,autoWidth:false,orderClasses:false,order:[]});
  }
  $('#export-results').disabled=!currentRecords.length;
}
function syncURL(push=false) {
  const url=new URL(location.href);url.search='';
  for (const [key,value] of Object.entries(state)) if(value!==defaults[key] && value!=='') url.searchParams.set(key,value);
  if(push)url.hash='resources';
  history[push?'pushState':'replaceState']({},'',url);
}
function readURL() {
  const parsed={...defaults};
  for(const [key,value] of new URLSearchParams(location.search)) if(key in defaults)parsed[key]=key==='page'?Math.max(1,parseInt(value)||1):value;
  if(!resourceKinds.includes(parsed.tab)) parsed.tab='models';
  if(!operations.some(op=>op.id===parsed.op))parsed.op='';
  state=parsed;
}
function renderExplorer(){renderTabs();buildFilters();renderResults();}
function goToResources(update) {state={...defaults,...update};renderExplorer();syncURL(true);$('#resources').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}
function resetFilters(){state={...defaults,tab:state.tab};buildFilters();renderResults();syncURL();}
function renderTaxonomy() {
  $('#taxonomy-list').innerHTML=Object.entries(taxonomy).map(([category,t])=>`<article class="taxonomy-entry"><h3>${category} editing</h3><p>${esc(t.definition)} <b>Preserve:</b> ${esc(t.preserve)}</p><p class="operation-links"><b>Examples:</b> ${operations.filter(op=>op.domain===taxDomain&&op.category===category).map(op=>`<a class="inline-link" data-sample-operation="${op.id}" href="${esc(sampleURL(location.href, op.id).href)}" aria-label="Listen to ${op.label} samples for ${taxDomain}">${esc(op.label)}</a>`).join('')}</p></article>`).join('');
}
const methods = {
  based:{description:'Learn editing behavior from supervised pairs, pseudo-pairs, or instruction–input–output triplets. Training teaches the model to follow conditions and preserve non-target content.',figure:'train-based',caption:'Overview of training-based audio editing',paradigm:'Training-based',mechanisms:[['Task-specific','Optimize a model for predefined editing tasks or domains.'],['Reference & attribute','Use reference audio, style examples, or attribute labels to specify the change.'],['Instruction-conditioned','Learn to follow natural-language requests from editing triplets.']],models:['Audio-Omni','AuK / AuK-Flash','VoiceCraft','Instruct-MusicGen']},
  free:{description:'Adapt pretrained generators to editing without updating their parameters. Inversion, attention control, guidance, and masks connect the original recording to the requested change.',figure:'train-free',caption:'Overview of training-free audio editing',paradigm:'Training-free',mechanisms:[['Inversion','Recover a latent state or trajectory that reconstructs the source.'],['Attention control','Reuse or modify attention to localize changes and preserve structure.'],['Masks & regions','Constrain which waveform, spectrogram, latent, or source regions change.'],['Token-level operations','Use masking, infilling, or selective regeneration in compatible pretrained codec models.']],models:['DirectAudioEdit','AudioMorphix','AudioEditor','MelodyFlow','DDPM Inversion (ZETA)','EdiTTS']}
};
function renderMethod(kind) {
  const m=methods[kind];
  $$('.method-tab').forEach(el=>{el.setAttribute('aria-pressed',el.dataset.method===kind);el.classList.toggle('active',el.dataset.method===kind);});
  $('#method-panel').innerHTML=`<p>${m.description}</p><figure class="paper-figure"><button type="button" class="figure-button" data-figure="assets/${m.figure}.png" data-caption="${m.caption}" aria-label="Enlarge ${m.caption}"><img src="assets/${m.figure}.png" alt="${m.caption}" loading="lazy"></button><figcaption>${m.caption}. Select the figure to enlarge it.</figcaption></figure><ul>${m.mechanisms.map(([name,description])=>`<li><b>${name}.</b> ${description}</li>`).join('')}</ul><p class="representatives"><b>Representative work:</b> ${m.models.map(name=>`<button type="button" class="inline-link" data-model="${esc(name)}">${esc(name)}</button>`).join('')}</p><p><button type="button" class="inline-link" data-paradigm="${m.paradigm}">Browse all ${m.paradigm.toLowerCase()} models</button></p>`;
}
function setupEvents() {
  $('#filter-form').addEventListener('submit',e=>e.preventDefault());
  $('#resource-search').addEventListener('input',e=>{state.q=e.target.value;state.page=1;renderResults();syncURL();});
  $('#filter-fields').addEventListener('change',e=>{if(!e.target.name)return;state[e.target.name]=e.target.value;state.page=1;renderResults();syncURL();});
  $('#clear-filters').addEventListener('click',resetFilters);
  $('#resource-tabs').addEventListener('click',e=>{const tab=e.target.closest('[data-tab]');if(!tab)return;state={...defaults,tab:tab.dataset.tab};renderExplorer();syncURL();$(`#tab-${state.tab}`).focus();});
  $('#resource-tabs').addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const i=resourceKinds.indexOf(state.tab),n=resourceKinds.length;const next=e.key==='Home'?0:e.key==='End'?n-1:(i+(e.key==='ArrowRight'?1:-1)+n)%n;$(`#tab-${resourceKinds[next]}`).click();});
  $('#resource-results').addEventListener('change',e=>{if(e.target.matches('[data-column]')) resourceTable?.column(Number(e.target.dataset.column)).visible(e.target.checked);});
  document.addEventListener('click',e=>{
    let control;
    if((control=e.target.closest('[data-tax-domain]'))){taxDomain=control.dataset.taxDomain;$$('[data-tax-domain]').forEach(el=>{el.setAttribute('aria-pressed',el===control);el.classList.toggle('active',el===control);});renderTaxonomy();}
    if((control=e.target.closest('[data-architecture]')))goToResources({architecture:control.dataset.architecture});
    if((control=e.target.closest('[data-method]')))renderMethod(control.dataset.method);
    if((control=e.target.closest('[data-paradigm]')))goToResources({paradigm:control.dataset.paradigm});
    if((control=e.target.closest('[data-model]')))goToResources({q:control.dataset.model});
    if(e.target.closest('[data-reset]'))resetFilters();
    if(e.target.closest('#clear-operation')){state.op='';state.page=1;renderResults();syncURL();}
    if((control=e.target.closest('[data-results]'))){const panel=$(`#results-${control.dataset.results}`),open=control.getAttribute('aria-expanded')!=='true';control.setAttribute('aria-expanded',open);panel.hidden=!open;control.querySelector('span').textContent=open?'−':'＋';}
    if((control=e.target.closest('[data-figure]'))){$('#dialog-image').src=control.dataset.figure;$('#dialog-image').alt=control.dataset.caption;$('#figure-dialog-title').textContent=control.dataset.caption;$('#figure-dialog').showModal();}
  });
  $('#export-results').addEventListener('click',()=>{const blob=new Blob([JSON.stringify({source:data.meta,filters:state,entries:currentRecords},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`audioeditsurvey-${state.tab}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
  window.addEventListener('popstate',()=>{readURL();renderExplorer();});
  document.addEventListener('keydown',e=>{if(e.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)&&!$('#figure-dialog').open){e.preventDefault();$('#resource-search').focus();}});
}
$('#close-figure').addEventListener('click',()=>$('#figure-dialog').close());
$('#figure-dialog').addEventListener('click',e=>{if(e.target===$('#figure-dialog'))$('#figure-dialog').close();});
$('#copy-citation').addEventListener('click',async()=>{
  try{await navigator.clipboard.writeText($('#bibtex-code').textContent.trim());$('#copy-status').textContent='Citation copied.';}
  catch{const range=document.createRange();range.selectNodeContents($('#bibtex-code'));const sel=getSelection();sel.removeAllRanges();sel.addRange(range);$('#copy-status').textContent='Citation selected. Press Ctrl+C or ⌘C to copy.';}
});
renderTaxonomy();renderMethod('based');
try {
  const response=await fetch(new URL('../data/resources.json',import.meta.url));
  if(!response.ok)throw new Error(`HTTP ${response.status}`);
  data=await response.json();
  const snapshot=$('.catalog-source time');snapshot.dateTime=data.meta.updated;snapshot.textContent=new Date(data.meta.updated+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'});
  readURL();renderExplorer();setupEvents();
  if(location.hash==='#resources')requestAnimationFrame(()=>$('#resources').scrollIntoView({behavior:'instant'}));
}catch(error){$('#results-count').textContent='Resource directory unavailable.';$('#resource-results').innerHTML='<p class="error-message">The catalog could not load. Reload this page or <a href="https://github.com/MM-Speech/AudioEditSurvey">browse the resource repository</a>.</p>';console.error('Catalog load failed:',error);}
