(() => {
  'use strict';
  const button=document.getElementById('sp'),input=document.getElementById('specialization-value');if(!button||!input)return;
  const options=['QA Engineer','Backend Developer','Frontend Developer','Data Analyst'];
  const list=document.createElement('div');list.id='specialization-options';list.className='specialization-options';list.setAttribute('role','listbox');list.setAttribute('aria-labelledby','specialization-label');list.hidden=true;
  list.innerHTML=options.map((text,i)=>`<div class="specialization-option" id="specialization-option-${i}" role="option" aria-selected="${text===input.value}" data-index="${i}">${text}</div>`).join('');document.body.append(list);
  let active=options.indexOf(input.value);
  const highlight=()=>{list.querySelectorAll('[role=option]').forEach((el,i)=>el.classList.toggle('active',i===active));button.setAttribute('aria-activedescendant',`specialization-option-${active}`);list.children[active].scrollIntoView({block:'nearest'});};
  const position=()=>{
    const r=button.getBoundingClientRect(),content=document.querySelector('.app-content').getBoundingClientRect(),top=Math.max(8,content.top+8),bottom=Math.min(innerHeight-8,content.bottom-8);
    const below=Math.max(0,bottom-r.bottom-4),above=Math.max(0,r.top-top-4),up=below<184&&above>below,space=up?above:below;
    list.style.width=`${Math.min(r.width,innerWidth-32)}px`;list.style.left=`${Math.max(16,Math.min(r.left,innerWidth-16-Math.min(r.width,innerWidth-32)))}px`;list.style.maxHeight=`${space}px`;
    list.style.top=`${up?Math.max(top,r.top-4-Math.min(space,184)):r.bottom+4}px`;
  };
  const close=()=>{list.hidden=true;button.setAttribute('aria-expanded','false');button.removeAttribute('aria-activedescendant');};
  const open=()=>{active=options.indexOf(input.value);list.hidden=false;position();button.setAttribute('aria-expanded','true');highlight();};
  const choose=()=>{input.value=options[active];button.querySelector('span').textContent=input.value;list.querySelectorAll('[role=option]').forEach((el,i)=>el.setAttribute('aria-selected',String(i===active)));input.dispatchEvent(new Event('change',{bubbles:true}));close();button.focus({preventScroll:true});};
  button.addEventListener('click',()=>list.hidden?open():close());
  button.addEventListener('keydown',event=>{
    if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();const wasClosed=list.hidden;if(wasClosed)open();else if(event.key==='Home')active=0;else if(event.key==='End')active=options.length-1;else active=(active+(event.key==='ArrowDown'?1:-1)+options.length)%options.length;highlight();}
    else if(event.key==='Enter'||event.key===' '){event.preventDefault();list.hidden?open():choose();}
    else if(event.key==='Escape'){event.preventDefault();close();}
    else if(event.key==='Tab')close();
  });
  list.addEventListener('click',event=>{const item=event.target.closest('[role=option]');if(item){active=Number(item.dataset.index);choose();}});
  document.addEventListener('pointerdown',event=>{if(!button.contains(event.target)&&!list.contains(event.target))close();});
  document.addEventListener('scroll',event=>{if(!list.hidden&&!list.contains(event.target))position();},true);
  window.addEventListener('resize',()=>{if(!list.hidden)position();});
})();
