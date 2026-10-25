(() => {
  const form=document.getElementById('cf'),input=document.getElementById('msg'),more=document.getElementById('more'),chat=document.getElementById('chat');
  form.addEventListener('submit',event=>{
    event.preventDefault(); const value=input.value.trim(); if(!value) return;
    const row=document.createElement('div'); row.className='m-out';
    const bubble=document.createElement('p'); bubble.className='bub-d'; bubble.textContent=value;
    const time=document.createElement('time'); time.className='time'; time.textContent=new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});
    row.append(bubble,time); more.append(row); input.value=''; chat.scrollTop=chat.scrollHeight; input.focus();
  });
})();
