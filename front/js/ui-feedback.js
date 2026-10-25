(() => {
 let toast,hold,exit,revision=0;
 const show=(message,kind='success')=>{
  if(!document.body)return;
  if(!toast){toast=document.createElement('div');toast.className='app-toast';toast.setAttribute('role','status');toast.setAttribute('aria-live','polite');toast.setAttribute('aria-atomic','true');if('showPopover' in toast)toast.setAttribute('popover','manual');document.body.append(toast);}
  const current=++revision;clearTimeout(hold);clearTimeout(exit);toast.dataset.kind=kind;toast.dataset.state='entering';toast.textContent=message;toast.hidden=false;
  if(toast.showPopover){try{toast.showPopover();}catch{}}toast.getBoundingClientRect();requestAnimationFrame(()=>{if(current===revision)toast.dataset.state='visible';});
  hold=setTimeout(()=>{if(current!==revision)return;toast.dataset.state='leaving';exit=setTimeout(()=>{if(current!==revision)return;if(toast.hidePopover){try{toast.hidePopover();}catch{}}toast.hidden=true;toast.textContent='';},180);},1500);
 };
 window.AppToast={show};
})();
