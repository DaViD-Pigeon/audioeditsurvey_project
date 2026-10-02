import assert from 'node:assert/strict';
import {mkdtemp,readFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const out=await mkdtemp(path.join(os.tmpdir(),'audioedit-site-test-'));
const base=process.env.PREVIEW_URL || 'http://127.0.0.1:8000/audioeditsurvey_project/';
// This uses an isolated test profile, never the user's browsing session.
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},permissions:['clipboard-read','clipboard-write'],reducedMotion:'reduce'});
const page=await context.newPage();
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('response',r=>{if(r.url().startsWith(base)&&r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
try{
  await page.goto(base,{waitUntil:'networkidle'});
  await page.locator('#results-count').filter({hasText:'27'}).waitFor();
  await page.locator('img[src]').evaluateAll(imgs=>Promise.all(imgs.map(img=>{img.loading='eager';return img.decode();})));
  await page.screenshot({path:path.join(out,'desktop-hero.png')});
  await page.screenshot({path:path.join(out,'desktop-full.png'),fullPage:true});
  await page.getByRole('link',{name:'Taxonomy',exact:true}).click();
  assert.equal(new URL(page.url()).hash,'#taxonomy');
  await page.locator('#taxonomy').screenshot({path:path.join(out,'desktop-taxonomy.png')});
  await page.locator('#methods').screenshot({path:path.join(out,'desktop-methods.png')});
  await page.goto(base+'#top',{waitUntil:'networkidle'});
  assert.equal(await page.locator('h1').count(),1);
  assert.equal(await page.locator('.author-list .author-block').count(),16);
  assert.equal(await page.locator('#audio-examples audio').count(),4);
  assert.equal(await page.locator('audio[autoplay],video').count(),0);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.equal(await page.locator('img[src]').evaluateAll(imgs=>imgs.filter(i=>!i.complete||!i.naturalWidth).length),0);


  // The actual 3DGS DataTables bundle must sort the full set, not a page subset.
  assert.equal(await page.locator('#results tbody tr').count(),27);
  await page.locator('#results thead th').first().click();
  await page.waitForFunction(()=>document.querySelector('#results tbody tr .resource-name').textContent==='ACE-Step 1.5');
  assert.equal(await page.locator('#results tbody tr .resource-name').first().innerText(),'ACE-Step 1.5');
  await page.locator('.column-controls input[data-column="3"]').uncheck();
  assert.equal(await page.locator('#results thead th').count(),7);
  await page.locator('.column-controls input[data-column="3"]').check();
  assert.equal(await page.locator('#results thead th').count(),8);
  await page.getByRole('button',{name:'Reset filters',exact:true}).click();
  await page.locator('#resources').scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(out,'desktop-resources.png')});

  await page.getByRole('button',{name:'Music',exact:true}).click();
  await page.getByRole('link',{name:'Listen to Lyric editing samples for Music',exact:true}).click();
  assert.equal(new URL(page.url()).hash,'#audio-examples');
  assert.equal(await page.locator('#example-domain-music').getAttribute('aria-selected'),'true');
  assert.deepEqual(await page.locator('#example-results [data-edit-example]').evaluateAll(rows=>rows.map(row=>row.dataset.editExample)),['auk-lyric']);
  assert.match(await page.locator('#results-count').innerText(),/^27 of 27/);
  await page.reload({waitUntil:'networkidle'});
  assert.deepEqual(await page.locator('#example-results [data-edit-example]').evaluateAll(rows=>rows.map(row=>row.dataset.editExample)),['auk-lyric']);
  await page.getByRole('button',{name:'Reset filters',exact:true}).click();
  await page.getByRole('combobox',{name:'Paradigm',exact:true}).selectOption('Training-free');
  await page.getByRole('combobox',{name:'Audio domain',exact:true}).selectOption('Music');
  await page.getByRole('combobox',{name:'Architecture',exact:true}).selectOption('Flow matching');
  assert.match(await page.locator('#results-count').innerText(),/^1 of 27/);
  assert.match(await page.locator('#resource-results').innerText(),/MelodyFlow/);
  assert.match(await page.locator('#resource-results').innerText(),/Audio Imagination Workshop/);
  await page.screenshot({path:path.join(out,'desktop-filter.png')});

  await page.getByRole('tab',{name:/Datasets/}).click();
  await page.getByRole('combobox',{name:'Audio pairs',exact:true}).selectOption('Paired');
  await page.getByRole('combobox',{name:'Audio domain',exact:true}).selectOption('Unified');
  await page.getByRole('combobox',{name:'Annotation',exact:true}).selectOption('Instruction');
  assert.match(await page.locator('#results-count').innerText(),/^1 of 30/);
  assert.match(await page.locator('#resource-results').innerText(),/966,794/);
  const downloadPromise=page.waitForEvent('download');
  await page.getByRole('button',{name:'Export JSON'}).click();
  const download=await downloadPromise;
  const exported=JSON.parse(await readFile(await download.path(),'utf8'));
  assert.equal(exported.entries.length,1);
  assert.equal(exported.entries[0].name,'AudioEdit (Audio-Omni)');
  await page.getByRole('tab',{name:/Tools/}).click();
  await page.getByRole('combobox',{name:'Tool purpose',exact:true}).selectOption('Annotation');
  assert.match(await page.locator('#results-count').innerText(),/^20 of 37/);
  await page.getByRole('tab',{name:/Metrics/}).click();
  await page.getByLabel('Search resources',{exact:true}).fill('speechjudge');
  assert.match(await page.locator('#results-count').innerText(),/^1 of 36/);
  await page.getByLabel('Search resources',{exact:true}).fill('zz-no-match');
  assert.equal(await page.getByRole('heading',{name:'No matching resources.'}).count(),1);
  await page.getByLabel('Search resources',{exact:true}).fill('');
  await page.getByRole('combobox',{name:'Evaluation dimension',exact:true}).selectOption('Multi-dimensional Evaluators');
  assert.match(await page.locator('#results-count').innerText(),/^6 of 36/);

  await page.getByRole('tab',{name:/Benchmarks/}).click();
  await page.locator('#resource-mmae .results-toggle').click();
  assert.equal(await page.locator('#results-mmae').isVisible(),true);
  assert.match(await page.locator('#results-mmae').innerText(),/1,003-case single-operation/);
  assert.equal(await page.locator('#resource-ave-compass .results-toggle').count(),1);
  assert.equal(await page.locator('.benchmark-entry').count(),9);

  await page.getByRole('button',{name:'Copy citation'}).click();
  await page.locator('#copy-status').filter({hasText:'Citation copied.'}).waitFor();
  assert.equal(await page.locator('#copy-status').innerText(),'Citation copied.');
  assert.match(await page.evaluate(()=>navigator.clipboard.readText()),/pan2026audio/);
  await page.getByRole('button',{name:'Enlarge taxonomy overview',exact:true}).click();
  assert.equal(await page.locator('#figure-dialog').isVisible(),true);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#figure-dialog').isVisible(),false);
  await page.getByRole('button',{name:'Training-free',exact:true}).click();
  assert.equal(await page.locator('#method-panel [data-model]').count(),6);
  await page.locator('#method-panel [data-paradigm]').click();
  assert.match(await page.locator('#results-count').innerText(),/^6 of 27/);
  await page.goBack({waitUntil:'networkidle'});
  assert.equal(await page.locator('#tab-benchmarks').getAttribute('aria-selected'),'true');

  const missing=await page.locator('a[href^="#"]').evaluateAll(links=>links.map(a=>a.getAttribute('href')).filter(h=>h!=='#'&&!document.getElementById(h.slice(1))));
  assert.deepEqual(missing,[]);
  assert.equal((await context.request.get(new URL('.git/config',base).href)).status(),404);
  assert.equal((await context.request.get(new URL('../AudioEditSurvey/README.md',base).href)).status(),404);

  const mobile=await context.newPage();
  await mobile.setViewportSize({width:390,height:844});
  await mobile.goto(base,{waitUntil:'networkidle'});
  await mobile.locator('img[src]').evaluateAll(imgs=>Promise.all(imgs.map(img=>{img.loading='eager';return img.decode();})));
  await mobile.screenshot({path:path.join(out,'mobile-hero.png')});
  await mobile.screenshot({path:path.join(out,'mobile-full.png'),fullPage:true});
  assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await mobile.getByRole('tab',{name:/Datasets/}).click();
  await mobile.getByRole('combobox',{name:'Audio pairs',exact:true}).selectOption('Paired');
  await mobile.locator('#explorer').scrollIntoViewIfNeeded();
  await mobile.screenshot({path:path.join(out,'mobile-resources.png')});
  assert.ok(await mobile.locator('#resource-results tr[data-resource]').count()>0);
  assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(errors,[]);
  console.log('PASS: template desktop/mobile layout, all resource types, full-table sorting, column visibility, compound filters, taxonomy route, reload/history, export, citation, figures, links, restricted preview.');
} finally {
  console.log('Screenshots:',out);
  await browser.close();
}
