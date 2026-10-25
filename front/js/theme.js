(() => {
 const key='inis.theme.v3';let value='light';try{value=localStorage.getItem(key)==='dark'?'dark':'light';}catch{}
 const apply=()=>{document.documentElement.dataset.theme=value;document.documentElement.style.colorScheme=value;document.querySelectorAll('.side-menu-theme').forEach(button=>{button.disabled=false;button.removeAttribute('title');button.setAttribute('aria-checked',String(value==='dark'));});};
 apply();window.ThemeUI={sync:apply};
 document.addEventListener('click',event=>{if(!event.target.closest('.side-menu-theme'))return;value=value==='dark'?'light':'dark';try{localStorage.setItem(key,value);}catch{}apply();});
 window.addEventListener('storage',event=>{if(event.key===key){value=event.newValue==='dark'?'dark':'light';apply();}});
})();
