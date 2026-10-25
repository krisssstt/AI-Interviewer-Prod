(function(){
var modes=document.getElementById('modes');
if(modes){modes.addEventListener('click',function(e){var b=e.target.closest('.tc');if(!b){return;}modes.querySelectorAll('.tc').forEach(function(x){var on=x===b;x.classList.toggle('on',on);x.setAttribute('aria-checked',on?'true':'false');});});}
var hints=document.getElementById('hints');
if(hints){hints.addEventListener('click',function(e){var b=e.target.closest('.hintc');if(!b){return;}hints.querySelectorAll('.hintc').forEach(function(x){x.classList.toggle('on',x===b);});});}
var ans=document.getElementById('ans'),cnt=document.getElementById('cnt');
if(ans&&cnt){ans.addEventListener('input',function(){cnt.textContent=ans.value.length;});}
var mic=document.getElementById('micb');
if(mic){mic.addEventListener('click',function(){mic.setAttribute('aria-pressed',mic.getAttribute('aria-pressed')==='true'?'false':'true');});}
var sb=document.getElementById('sendb');
if(sb&&ans){sb.addEventListener('click',function(e){if(!ans.value.trim()){e.preventDefault();ans.focus();}});}
document.querySelectorAll('.tgb').forEach(function(b){b.addEventListener('click',function(){var on=b.getAttribute('aria-checked')!=='true';b.setAttribute('aria-checked',on?'true':'false');b.querySelector('img').src='../images/icons/ic-toggle-'+(on?'on':'off')+'.svg';});});
})();
