(() => {
  'use strict';
  const setup=()=>{
    const P=window.Platform;if(!P)return;const {store,escape:e}=P;
    const makeDialog=(id,title,body)=>{const d=document.createElement('dialog');d.id=id;d.className='ui-dialog';d.setAttribute('aria-labelledby',`${id}-title`);d.innerHTML=`<div class="dialog-heading"><h2 id="${id}-title">${title}</h2><button class="icon-button" type="button" data-close aria-label="Закрыть"><img src="../images/icons/ic-close.svg" alt=""></button></div>${body}`;document.body.append(d);d.querySelector('[data-close]').addEventListener('click',()=>d.close());return d;};
    // Unified validation for auth, profile, search, support and all newly added forms.
    const errorFor=(input,message)=>{
      if(input.type==='hidden')return;
      let error=document.getElementById(`${input.id}-validation`);
      if(!error&&input.id){error=document.createElement('p');error.id=`${input.id}-validation`;error.className='field-error';error.setAttribute('role','alert');input.closest('.form-field,.agreement')?.append(error);if(!error.parentNode){const composer=input.closest('.composer');if(composer)composer.after(error);else input.after(error);}input.setAttribute('aria-describedby',`${input.getAttribute('aria-describedby')||''} ${error.id}`.trim());}
      if(error){error.textContent=message;error.hidden=!message;}input.setAttribute('aria-invalid',String(Boolean(message)));input.setCustomValidity(message);
      return !message;
    };
    const validate=input=>{
      input.setCustomValidity('');let message='';const value=input.value.trim();
      if(input.disabled||input.readOnly||input.type==='hidden'||['radio','file'].includes(input.type))return true;
      if(input.type==='checkbox'){if(input.required&&!input.checked)message='Подтвердите согласие с условиями.';}
      else if(input.required&&!value)message='Заполните это поле.';
      else if(value&&input.type==='email'&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))message='Введите email в формате name@example.com.';
      else if(value&&['name','fn','ln'].includes(input.id)&&(!/^[\p{L}\p{M}][\p{L}\p{M}\s'’.-]*$/u.test(value)||value.length<2))message='Введите имя буквами, от 2 до 60 символов.';
      else if(value&&input.id==='gr'&&!['Junior','Middle','Senior','Lead','Intern'].includes(value))message='Укажите Intern, Junior, Middle, Senior или Lead.';
      else if(input.type==='password'&&input.minLength>0&&input.value.length<input.minLength)message=`Пароль должен содержать не менее ${input.minLength} символов.`;
      else if(input.id==='password2'&&input.value!==document.getElementById('password')?.value)message='Пароли не совпадают.';
      else if(input.type==='password'&&value&&!input.value.trim())message='Пароль не может состоять из пробелов.';
      else if(input.maxLength>0&&input.value.length>input.maxLength)message=`Не более ${input.maxLength} символов.`;
      else if(!input.validity.valid)message='Проверьте значение поля.';
      return errorFor(input,message);
    };
    document.querySelectorAll('input:not([type="hidden"]),textarea,select').forEach(input=>{
      if(['fn','em','msg'].includes(input.id))input.required=true;
      if(['name','fn','ln'].includes(input.id))input.maxLength=60;
      if(input.type==='email')input.maxLength=254;
      if(input.type==='password'){input.maxLength=128;if(input.autocomplete==='new-password')input.minLength=8;}
      if(['newSkill','q','gr'].includes(input.id))input.maxLength=input.id==='q'?200:50;
      if(input.id==='msg')input.maxLength=2000;
      input.addEventListener('blur',()=>setTimeout(()=>validate(input),120));input.addEventListener('input',()=>{if(input.getAttribute('aria-invalid')==='true'||input.id==='password2')validate(input);if(input.id==='password')document.getElementById('password2')?.setCustomValidity('');});
    });
    document.addEventListener('submit',event=>{
      const form=event.target;if(!(form instanceof HTMLFormElement)||form.id==='answer-form')return;
      const controls=[...form.querySelectorAll('input,textarea,select')];let first=null;for(const c of controls)if(!validate(c)&&!first)first=c;
      if(first){event.preventDefault();event.stopImmediatePropagation();first.focus();return;}
      if(form.classList.contains('auth-form')&&form.id!=='reset-password'){
        event.preventDefault();
        // Navigation-only auth prototype: never put passwords in URLs or browser storage.
        if(document.getElementById('name')){store.set('inis.profile.v2',{firstName:document.getElementById('name').value.trim(),lastName:'',email:document.getElementById('email').value.trim(),grade:'Не определён'});['inis.profile.photo.v1','inis.progression.v3','inis.session.v2','inis.sessions.v2','inis.result.v2','inis.history.v2','inis.daily.active.v1','inis.daily.tasks.v1'].forEach(k=>store.remove(k));try{sessionStorage.removeItem('inis.training.result.v1');}catch{}location.assign('choose-direction.html');return;}
        const gradeState=window.GradeProgress?.state();location.assign(gradeState&&!gradeState.baselineCompleted?'choose-direction.html':'main.html');
      }
    },true);
    document.addEventListener('click',event=>{if(event.target.closest('[data-logout]')){try{sessionStorage.removeItem('inis.last-page');}catch{}}});
    const reset=document.getElementById('reset-password');
    if(reset)reset.addEventListener('submit',async event=>{
      event.preventDefault();const status=document.getElementById('reset-status'),button=reset.querySelector('button[type="submit"]');status.hidden=false;
      const endpoint=window.InisConfig?.passwordResetEndpoint;
      if(!endpoint){status.textContent='Email проверен. Отправка ссылки станет доступна после подключения почтового сервиса.';return;}
      button.disabled=true;status.textContent='Отправляем запрос…';
      try{const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:reset.email.value.trim()})});if(!response.ok)throw Error();status.textContent='Если такой аккаунт существует, письмо со ссылкой для восстановления отправлено. Проверьте почту.';}catch{status.textContent='Не удалось отправить запрос. Попробуйте позже.';}finally{button.disabled=false;}
    });
    // Roadmap expands within the existing today's plan card.
    const plan=document.getElementById('daily-plan');
    if(plan){
      const details=document.createElement('details');details.id='personal-plan';details.className='roadmap';
      const topics=P.planTopics();
      details.innerHTML=`<summary>Полный персональный план</summary><p class="muted">Пройденные, текущие и будущие темы подготовки.</p><ol class="roadmap-list">${topics.map((t,i)=>`<li class="roadmap-step" data-status="${t.status}"><span class="roadmap-state" aria-hidden="true">${t.status==='done'?'✓':i+1}</span><div><h3>${e(t.name)}</h3><p class="muted">${e(t.description)}</p><span class="pill">${{done:'Пройдено',current:'Сейчас изучаем',future:'Впереди'}[t.status]}</span><a class="text-link" href="${t.status==='future'?`kb-case.html?topic=${encodeURIComponent(t.name)}`:`topic-selection.html?topic=${encodeURIComponent(t.name)}`}">${t.status==='future'?'Посмотреть материалы':'Потренироваться'} ›</a></div></li>`).join('')}</ol>`;plan.after(details);
      if(new URLSearchParams(location.search).get('plan')==='open'||location.hash==='#personal-plan'){details.open=true;requestAnimationFrame(()=>details.scrollIntoView({block:'start'}));}
      const active=P.active(),resume=document.getElementById('resume-interview'),box=document.querySelector('.resume-interview');
      const dailyActive=window.DailyTasks?.getActive();
      if(box){box.hidden=!active&&!dailyActive;if(active&&!dailyActive){resume.href=`training-question-1.html?mode=${active.mode}`;resume.textContent=`Продолжить: ${P.modes[active.mode]}`;}else if(dailyActive){resume.href=`training-question-1.html?daily=${dailyActive.id}`;}}
      const history=P.history(),percent=history.length?Math.round(history.reduce((sum,r)=>sum+r.score,0)/history.length):0;
      const home=document.querySelector('.dashboard-grid .skill-progress');if(home){home.querySelector('strong').textContent=`${percent}%`;const progress=home.querySelector('progress');progress.value=percent;progress.textContent=`${percent}%`;progress.setAttribute('aria-label',`Подготовка: ${percent} процентов`);home.nextElementSibling.textContent=history.length?`По ${history.length} завершённым сессиям`:'Пройдите первую тренировку для оценки';}
    }
    const duration=document.getElementById('duration-picker');
    if(duration){
      const d=makeDialog('duration-dialog','Длительность тренировки',`<div class="option-list" role="listbox" aria-label="Длительность">${[5,10,15,30].map(n=>`<button type="button" role="option" data-minutes="${n}" aria-selected="${n===15}">${n} минут</button>`).join('')}</div>`);
      duration.addEventListener('click',()=>{d.querySelectorAll('[data-minutes]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.minutes===document.getElementById('dur').value)));d.showModal();});
      d.querySelectorAll('[data-minutes]').forEach(b=>b.addEventListener('click',()=>{document.getElementById('dur').value=b.dataset.minutes;duration.querySelector('span').textContent=b.textContent;d.close();}));d.addEventListener('close',()=>duration.focus());
    }
    const quiet=document.getElementById('quiet-hours');
    if(quiet){
      const key='inis.quiet-hours.v2',saved=store.get(key,{start:'22:30',end:'07:00'}),valid=v=>typeof v==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(v);let value=valid(saved.start)&&valid(saved.end)?saved:{start:'22:30',end:'07:00'};
      quiet.textContent=`${value.start}–${value.end}`;
      const d=makeDialog('quiet-dialog','Время «не беспокоить»',`<p>Период может переходить через полночь.</p><form id="quiet-form"><div class="time-fields"><div class="form-field"><label for="quiet-start">С</label><input class="form-control" id="quiet-start" type="time" required value="${value.start}"></div><div class="form-field"><label for="quiet-end">До</label><input class="form-control" id="quiet-end" type="time" required value="${value.end}"></div></div><p class="field-error" id="quiet-error" role="alert" hidden></p><button class="form-button" type="submit">Применить</button></form>`);
      quiet.addEventListener('click',()=>d.showModal());d.querySelector('form').addEventListener('submit',event=>{event.preventDefault();const start=d.querySelector('#quiet-start').value,end=d.querySelector('#quiet-end').value,error=d.querySelector('#quiet-error');if(!valid(start)||!valid(end)||start===end){error.hidden=false;error.textContent='Выберите разное время начала и окончания.';return;}value={start,end};quiet.textContent=`${start}–${end}`;error.hidden=true;d.close();window.AppToast.show('Период выбран. Нажмите «Сохранить».');});
      document.getElementById('save-notification-settings').addEventListener('click',()=>{if(!store.set(key,value))document.getElementById('settings-status').textContent='Не удалось сохранить период.';});d.addEventListener('close',()=>quiet.focus());
    }
    // Analytics is derived from real completed attempts, including custom date ranges.
    const analytics=document.getElementById('progress-period');
    if(analytics){
      const render=range=>{
        const list=P.history().filter(r=>{const d=new Date(r.finishedAt);const iso=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;return iso>=range.start&&iso<=range.end;});
        const score=list.length?Math.round(list.reduce((sum,r)=>sum+r.score,0)/list.length):0;
        const ring=document.querySelector('.score-ring');ring.querySelector('span').textContent=`${score}%`;ring.style.background=`conic-gradient(var(--meter-fill) ${score}%, var(--meter-track) 0)`;ring.setAttribute('aria-label',`Подготовка: ${score} процентов`);
        document.querySelector('.progress-summary .pill').textContent=`${list.length} ${P.plural(list.length,['сессия','сессии','сессий'])}`;
        document.querySelectorAll('.dashboard-grid .skill-progress').forEach(row=>{const name=row.querySelector('span').textContent,answers=list.flatMap(r=>r.answers).filter(a=>a.topic===name),percent=answers.length?Math.round(answers.reduce((sum,a)=>sum+a.score,0)/answers.length):0;row.querySelector('strong').textContent=answers.length?`${percent}%`:'Нет данных';const bar=row.querySelector('progress');bar.value=percent;bar.setAttribute('aria-label',`${name}: ${answers.length?percent+' процентов':'нет данных'}`);});
        const recommendation=document.querySelector('.recommendation p');recommendation.textContent=list.length?'Проверьте разборы завершённых сессий и повторите темы с низким результатом.':'В выбранном периоде нет завершённых тренировок. Начните сессию, чтобы увидеть прогресс.';
      };
      window.addEventListener('inis:period-change',event=>render(event.detail));
      const range=(()=>{try{return JSON.parse(sessionStorage.getItem('inis.progress.period.v1'));}catch{return null;}})();if(range)render(range);
    }
    const history=P.history();
    const historyList=document.getElementById('training-history');
    if(historyList){historyList.innerHTML=[...history].reverse().map(r=>`<a class="ui-card" href="training-results.html?id=${encodeURIComponent(r.id)}"><h3><img src="../images/icons/ic-hist-clock.svg" alt="">${e(P.modes[r.mode])}</h3><p>${r.score}% · ${r.answers.length} из ${r.total} ответов${r.early?' · Досрочно':''}</p><p class="muted">${e(new Date(r.finishedAt).toLocaleString('ru-RU'))}</p><span class="text-link">Посмотреть результат и ответы ›</span></a>`).join('');document.getElementById('history-empty').hidden=history.length>0;}
    const dataRows=document.querySelectorAll('.data-list .data-row');if(dataRows.length){dataRows[0].querySelector('.muted').textContent=`${history.length} ${P.plural(history.length,['завершённая сессия','завершённые сессии','завершённых сессий'])}`;const f=store.get('inis.favorite-questions.v1',[]);dataRows[2].querySelector('.muted').textContent=`${Array.isArray(f)?f.length:0} вопросов`;}
    const achievements=document.getElementById('achievement-list');
    if(achievements){
      const dates=[...new Set(history.map(r=>new Date(r.finishedAt).toDateString()))].map(s=>new Date(s).getTime()).sort((a,b)=>a-b);let best=0,streak=0,last=null;dates.forEach(day=>{streak=last!==null&&Math.round((day-last)/86400000)===1?streak+1:1;best=Math.max(best,streak);last=day;});
      const awards=[['Первый шаг','Завершите первую тренировку',history.length>=1],['Регулярная практика','Завершите 5 тренировок',history.length>=5],['Уверенный ответ','Наберите не менее 80% в завершённой сессии',history.some(r=>r.score>=80&&!r.early)],['Интервью пройдено','Пройдите полную симуляцию до конца',history.some(r=>r.mode==='full'&&!r.early)],['7 дней подряд','Тренируйтесь каждый день в течение недели',best>=7]];
      achievements.innerHTML=awards.map(([title,description,on])=>`<section class="ui-card ${on?'':'achievement-locked'}"><h3 class="achievement-title"><img src="../images/icons/ic-hist-goal.svg" alt="">${title}</h3><p>${description}</p><span class="pill">${on?'Получено':'Пока не получено'}</span></section>`).join('');
    }
    if(document.getElementById('document-list')||dataRows.length)setupDocuments(dataRows,makeDialog);
  };
  const setupDocuments=async(dataRows,makeDialog)=>{
    const P=window.Platform,e=P.escape,list=document.getElementById('document-list'),status=document.getElementById('document-status');
    let db;try{db=await new Promise((resolve,reject)=>{const request=indexedDB.open('inis.documents.v2',1);request.onupgradeneeded=()=>request.result.createObjectStore('files',{keyPath:'id'});request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}catch{if(status)status.textContent='Хранилище файлов недоступно в этом браузере.';return;}
    const transact=(mode,callback)=>new Promise((resolve,reject)=>{const tx=db.transaction('files',mode);const request=callback(tx.objectStore('files'));let result;request.onsuccess=()=>{result=request.result;};tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});
    let urls=[];
    const render=async()=>{const files=await transact('readonly',s=>s.getAll());if(dataRows.length)dataRows[1].querySelector('.muted').textContent=`${files.length} файлов`;if(!list)return;urls.forEach(URL.revokeObjectURL);urls=[];list.innerHTML=files.map(f=>{const url=URL.createObjectURL(f.blob);urls.push(url);return `<section class="ui-card document-card"><div class="document-heading"><img src="../images/icons/ic-hist-docs.svg" alt=""><h3>${e(f.name)}</h3></div><p class="muted">${{cv:'CV / резюме',certificate:'Сертификат',other:'Документ'}[f.kind]} · ${(f.size/1024).toFixed(0)} КБ</p><div class="document-actions"><a class="form-button secondary" href="${url}" download="${e(f.name)}">Скачать</a><button class="form-button secondary" data-delete="${e(f.id)}" type="button">Удалить</button></div></section>`;}).join('');document.getElementById('document-empty').hidden=files.length>0;
      list.querySelectorAll('[data-delete]').forEach(b=>b.addEventListener('click',()=>{const d=makeDialog('delete-document','Удалить документ?','<p>Документ будет удалён из этого браузера.</p><button class="form-button" data-confirm type="button">Удалить</button><button class="form-button secondary" data-cancel type="button">Отмена</button>');d.querySelector('[data-cancel]').addEventListener('click',()=>d.close());d.querySelector('[data-confirm]').addEventListener('click',async()=>{try{await transact('readwrite',s=>s.delete(b.dataset.delete));d.close();window.AppToast.show('Документ удалён');await render();}catch{status.textContent='Не удалось удалить документ.';}});d.addEventListener('close',()=>{d.remove();b.focus();});d.showModal();}));
    };
    try{await render();}catch{if(status)status.textContent='Не удалось прочитать документы.';}
    window.addEventListener('pagehide',()=>{urls.forEach(URL.revokeObjectURL);db.close();});
    const form=document.getElementById('upload-document');if(!form)return;const choose=document.getElementById('choose-document'),chosen=document.getElementById('chosen-document-name');choose.addEventListener('click',()=>document.getElementById('document-file').click());
    form.addEventListener('submit',async event=>{
      event.preventDefault();const input=document.getElementById('document-file'),file=input.files[0],error=document.getElementById('file-error'),button=form.querySelector('button[type="submit"]');
      const fail=message=>{error.textContent=message;error.hidden=false;input.setAttribute('aria-invalid','true');choose.setAttribute('aria-invalid','true');choose.focus();};error.hidden=true;
      if(!file){fail('Выберите файл.');return;}if(!file.size||file.size>10*1024*1024){fail('Файл должен быть непустым и не больше 10 МБ.');return;}
      const extension=file.name.split('.').pop().toLowerCase();if(!['pdf','doc','docx','png','jpg','jpeg'].includes(extension)){fail('Выберите PDF, DOC, DOCX, PNG или JPG.');return;}
      button.disabled=true;
      try{
        const bytes=new Uint8Array(await file.slice(0,8).arrayBuffer()),hex=[...bytes].map(x=>x.toString(16).padStart(2,'0')).join('');
        const signature={pdf:'25504446',doc:'d0cf11e0',docx:'504b0304',png:'89504e470d0a1a0a',jpg:'ffd8ff',jpeg:'ffd8ff'}[extension];
        if(!hex.startsWith(signature)){fail('Содержимое файла не соответствует расширению.');return;}
        const files=await transact('readonly',s=>s.getAll());if(files.reduce((sum,f)=>sum+f.size,0)+file.size>50*1024*1024){fail('Лимит документов — 50 МБ. Удалите лишние файлы.');return;}
        if(files.some(f=>f.name===file.name&&f.size===file.size)){fail('Такой файл уже загружен.');return;}
        await transact('readwrite',s=>s.put({id:crypto.randomUUID(),name:file.name,size:file.size,kind:document.getElementById('document-type').value,blob:file,addedAt:new Date().toISOString()}));input.value='';chosen.textContent='Выберите файл';input.setAttribute('aria-invalid','false');choose.setAttribute('aria-invalid','false');status.textContent='';window.AppToast.show('Документ сохранён');await render();
      }catch{fail('Не удалось сохранить файл. Проверьте доступность хранилища браузера.');}finally{button.disabled=false;}
    });
    form.querySelector('#document-file').addEventListener('change',()=>{document.getElementById('file-error').hidden=true;form.querySelector('#document-file').setAttribute('aria-invalid','false');choose.setAttribute('aria-invalid','false');chosen.textContent=form.querySelector('#document-file').files[0]?.name||'Выберите файл';});
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
})();
