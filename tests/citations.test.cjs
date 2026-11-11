// Checks the plain citations front page against references.json: every source present, anchored and linked, plus the AR button.
const fs=require('fs'),assert=require('assert');const {JSDOM}=require('jsdom');
const refs=JSON.parse(fs.readFileSync('dist/references.json','utf8'));
const dom=new JSDOM(fs.readFileSync('dist/index.html','utf8'),{url:'https://poster.example/'});
const d=dom.window.document;
const cards=[...d.querySelectorAll('li.cite')];
assert.equal(cards.length,refs.length,'One entry per reference');
cards.forEach((c,i)=>assert.equal(c.id,'ref-'+refs[i].number,'Entries are in printed order'));
for(const r of refs){
  const c=d.getElementById('ref-'+r.number);assert(c,`#ref-${r.number} exists`);
  assert.equal(c.querySelector('.num').textContent,`[${r.number}]`);
  assert(c.querySelector('cite').textContent===r.title,`Title matches for [${r.number}]`);
  assert(c.querySelector('.citation').textContent.includes(r.author),`Authors shown for [${r.number}]`);
  assert.equal(c.querySelector('a.open').getAttribute('href'),r.url,`Source link for [${r.number}]`);
}
const ar=d.querySelectorAll('a[href^="poster.html"]');assert.equal(ar.length,1,'Exactly one AR button');
assert(ar[0].compareDocumentPosition(cards[0])&4,'The AR button comes before the list');
assert.equal(d.querySelectorAll('script,video,img').length,0,'The front page stays plain: no scripts, video or images');
dom.window.close();
console.log(`PASS: ${refs.length} plain citations in printed order, anchors, source links and one AR button.`);
