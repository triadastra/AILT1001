// Checks the citations front page against references.json: every source present, anchored, linked and summarised.
const fs=require('fs'),assert=require('assert');const {JSDOM}=require('jsdom');
const refs=JSON.parse(fs.readFileSync('dist/references.json','utf8'));
const dom=new JSDOM(fs.readFileSync('dist/index.html','utf8'),{url:'https://poster.example/',runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window,d=w.document;
w.matchMedia=()=>({matches:false});w.HTMLMediaElement.prototype.play=async function(){};w.HTMLMediaElement.prototype.pause=function(){};
w.eval(fs.readFileSync('dist/citations.js','utf8'));
const cards=[...d.querySelectorAll('li.cite')];
assert.equal(cards.length,refs.length,'One card per reference');
for(const r of refs){
  const c=d.getElementById('ref-'+r.number);assert(c,`#ref-${r.number} exists`);
  assert.equal(c.querySelector('.num').textContent,`[${r.number}]`);
  assert(c.querySelector('cite').textContent===r.title,`Title matches for [${r.number}]`);
  assert.equal(c.querySelector('a.open').getAttribute('href'),r.url,`Source link for [${r.number}]`);
  assert.equal(c.querySelectorAll('.beats li').length,3,`Three summary lines for [${r.number}]`);
  for(const img of c.querySelectorAll('img,video'))assert(fs.existsSync('dist/'+(img.getAttribute('src'))),`Asset exists: ${img.getAttribute('src')}`);
}
assert(d.querySelector('a[href="poster.html"]'),'Link to the interactive poster');
d.querySelector('[data-filter="models"]').click();
assert(cards.some(c=>c.hidden)&&!d.getElementById('ref-7').hidden,'Filter hides other groups');
assert(/Showing \d+ of 26/.test(d.getElementById('count').textContent));
d.querySelector('[data-filter="all"]').click();assert(cards.every(c=>!c.hidden));
d.getElementById('motion').click();assert(d.body.classList.contains('paused'));
assert.equal(d.getElementById('motion').getAttribute('aria-pressed'),'true');
dom.window.close();
console.log(`PASS: ${refs.length} citation cards, anchors, source links, summaries, assets, filters and pause.`);
