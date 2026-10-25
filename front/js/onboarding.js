(() => {
 const sync=()=>document.querySelectorAll('[data-dark-art]').forEach(s=>s.media=document.documentElement.dataset.theme==='dark'?'all':'not all');sync();
 new MutationObserver(sync).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
})();
