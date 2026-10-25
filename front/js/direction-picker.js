(() => {
 const setup=()=>{
  const G=window.GradeProgress,P=window.Platform,root=document.getElementById('direction-options');if(!root||!G)return;
  const e=P.escape,tech=document.getElementById('technology-options'),next=document.getElementById('continue-direction'),back=document.getElementById('back-direction'),title=document.getElementById('direction-heading'),description=document.getElementById('direction-description'),stepLabel=document.getElementById('direction-step');
  if(new URLSearchParams(location.search).get('new-profile')==='1'){const link=document.querySelector('.auth-page > a');if(link){link.href='profile-1.html';link.textContent='← Вернуться к текущему профилю';}}
  let direction=new URLSearchParams(location.search).get('direction')||G.state()?.direction||null,track=G.state()?.track||null,step=1;if(!G.tracks[direction])direction=null;
  const labels={'Frontend Developer':'Frontend-разработка','Backend Developer':'Backend-разработка','QA Engineer':'Тестирование','Data Analyst':'Аналитика и работа с данными'};
  const option=(id,label,description,kind,chosen)=>`<button type="button" class="tc ui-card" data-${kind}="${e(id)}" role="radio" aria-checked="${chosen}" aria-pressed="${chosen}"><img src="../images/icons/ic-target.svg" alt=""><span><strong>${e(label)}</strong><span class="muted">${e(description)}</span></span><img class="mode-chevron" src="../images/icons/ic-chevron-right.svg" alt=""></button>`;
  const render=()=>{
   root.hidden=step!==1;tech.hidden=step!==2;back.hidden=step!==2;stepLabel.textContent=`Шаг ${step} из 2`;
   title.textContent=step===1?'Выберите направление':'Выберите язык или технологию';
   description.textContent=step===1?'Сначала выберите общую область, затем — язык или технологию для подготовки.':`${labels[direction]}. Тест из 6 вопросов и персональный план будут учитывать ваш выбор.`;
   root.innerHTML=Object.entries(G.directions).map(([name,data])=>option(name,labels[name],data.topics.slice(0,3).join(' · '),'direction',direction===name)).join('');
   tech.innerHTML=step===2?G.tracks[direction].map(t=>option(t.id,t.label,t.topics.join(' · '),'track',track===t.id)).join(''):'';
   next.textContent=step===1?'Выбрать технологию':'Пройти диагностику';next.disabled=step===1?!direction:!G.tracks[direction]?.some(t=>t.id===track);
  };
  root.addEventListener('click',event=>{const b=event.target.closest('[data-direction]');if(!b)return;if(direction!==b.dataset.direction)track=null;direction=b.dataset.direction;render();root.querySelector(`[data-direction="${direction}"]`).focus();});
  tech.addEventListener('click',event=>{const b=event.target.closest('[data-track]');if(!b)return;track=b.dataset.track;render();tech.querySelector(`[data-track="${track}"]`).focus();});
  const radioKeys=(event,container)=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key))return;const buttons=[...container.querySelectorAll('[role=radio]')],index=buttons.indexOf(document.activeElement);if(index<0)return;event.preventDefault();const target=event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(['ArrowLeft','ArrowUp'].includes(event.key)?-1:1)+buttons.length)%buttons.length;buttons[target].click();};
  root.addEventListener('keydown',e=>radioKeys(e,root));tech.addEventListener('keydown',e=>radioKeys(e,tech));
  next.addEventListener('click',()=>{
   if(step===1){if(!direction)return;step=2;render();title.focus();return;}
   const current=G.state();if(current?.direction===direction&&current.track===track&&!current.baselineCompleted&&P.active()?.mode==='diagnostic'){location.assign('training-question-1.html?mode=diagnostic');return;}
   if(G.chooseDirection(direction,track))window.TrainingEngine.begin('diagnostic',false,5);else window.AppToast.show('Не удалось сохранить выбор. Проверьте настройки хранения браузера.','error');
  });
  back.addEventListener('click',()=>{step=1;render();title.focus();});render();
 };if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
})();
