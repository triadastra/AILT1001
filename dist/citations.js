'use strict';
// Citations front page: filter chips, pause control, and only animating cards that are on screen.
(()=>{
  const all=s=>[...document.querySelectorAll(s)];
  const cards=all('.cite'),count=document.getElementById('count'),motion=document.getElementById('motion');
  const reduce=matchMedia('(prefers-reduced-motion: reduce)');
  const KEY='cites-paused';
  const store={get(){try{return localStorage.getItem(KEY)}catch{return null}},set(v){try{localStorage.setItem(KEY,v)}catch{}}};

  function playVideos(){
    for(const v of all('.cite video')){
      const on=v.closest('.cite').classList.contains('live')&&!document.body.classList.contains('paused')&&!reduce.matches;
      if(on){v.preload='auto';const p=v.play&&v.play();if(p&&p.catch)p.catch(()=>{})}else if(v.pause)v.pause();
    }
  }
  function setPaused(p){
    document.body.classList.toggle('paused',p);
    motion.setAttribute('aria-pressed',String(p));
    motion.textContent=p?'Play animations':'Pause animations';
    store.set(p?'1':'0');playVideos();
  }
  motion.addEventListener('click',()=>setPaused(!document.body.classList.contains('paused')));
  setPaused(store.get()==='1');

  if('IntersectionObserver' in window){
    const io=new IntersectionObserver(es=>{for(const e of es)e.target.classList.toggle('live',e.isIntersecting);playVideos()},{rootMargin:'80px 0px'});
    cards.forEach(c=>io.observe(c));
  }else cards.forEach(c=>c.classList.add('live'));

  const total=cards.length;
  function filter(g){
    all('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.filter===g)));
    let n=0;for(const c of cards){const show=g==='all'||c.dataset.group===g;c.hidden=!show;if(show)n++}
    count.textContent=g==='all'?`Showing all ${total} citations`:`Showing ${n} of ${total} citations`;
  }
  all('[data-filter]').forEach(b=>b.addEventListener('click',()=>filter(b.dataset.filter)));

  // A #ref-N link always shows its card, even if a filter would hide it.
  function reveal(){const t=/^#ref-\d+$/.test(location.hash)&&document.querySelector(location.hash);if(t&&t.hidden){filter('all');t.scrollIntoView()}}
  addEventListener('hashchange',reveal);reveal();
})();
