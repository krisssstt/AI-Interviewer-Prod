(function(){function fit(){document.querySelectorAll('[data-w]').forEach(function(el){el.style.letterSpacing='0px';var w=el.getBoundingClientRect().width,t=parseFloat(el.getAttribute('data-w'))+1,n=(el.textContent||'').length;if(n>1){var ls=(t-w)/(n-1);if(Math.abs(ls)<3){el.style.letterSpacing=ls.toFixed(2)+'px';}}});}
if(document.fonts&&document.fonts.ready){document.fonts.ready.then(fit);}else{window.addEventListener('load',fit);}
document.querySelectorAll('a[aria-label="Уведомления"]').forEach(function(a){a.setAttribute('href','profile-4.html');});})();
