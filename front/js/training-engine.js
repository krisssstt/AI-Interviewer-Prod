(() => {
  'use strict';
  const P=window.Platform; if(!P)return;
  const {store,escape:e,modes}=P, params=new URLSearchParams(location.search);
  const bank=[...P.questions,...P.practical], find=id=>bank.find(q=>q.id===id);
  const shuffle=a=>[...a].sort(()=>Math.random()-.5);
  const getSaved=mode=>{const map=store.get('inis.sessions.v2',{});const a=map&&typeof map==='object'?map[mode]:null;return a&&Array.isArray(a.ids)&&a.index>=0&&a.index<a.ids.length?a:null;};
  const persist=s=>{store.set('inis.session.v2',s);const map=store.get('inis.sessions.v2',{});store.set('inis.sessions.v2',{...map,[s.mode]:s});};
  const clear=s=>{store.remove('inis.session.v2');const map=store.get('inis.sessions.v2',{});delete map[s.mode];store.set('inis.sessions.v2',map);};
  const begin=(mode,hints,minutes,topic)=>{
    const gradeState=window.GradeProgress?.state();let pool=P.questions;
    if(mode==='gradecheck'&&!window.GradeProgress.requirements().ready)return false;
    if(mode==='diagnostic'&&!gradeState)return false;
    if(mode==='quick') pool=pool.filter(q=>P.planTopics().some(t=>t.name===q.topic&&t.status==='done'));
    if(mode==='topic')pool=pool.filter(q=>q.topic===topic);
    const ids=['diagnostic','gradecheck'].includes(mode)?window.GradeProgress.assessmentIds(mode):mode==='full'?[...shuffle(P.questions.filter(q=>(window.GradeProgress.currentTrack()?.topics||['HTTP','API Testing','SQL','Тест дизайн']).includes(q.topic))).slice(0,7).map(q=>q.id),...(window.GradeProgress.currentTrack()?.practical||(gradeState?.direction==='Frontend Developer'?['html-practice','js-practice','log-task']:gradeState?.direction==='Data Analyst'?['sql-code','python-practice','log-task']:['sql-code','code-bug','log-task']))]:shuffle(pool).slice(0,mode==='quick'?10:10).map(q=>q.id);
    if(!ids.length||(mode==='quick'&&ids.length<10)){const copy=document.getElementById('setup-options');if(copy)copy.textContent='Для быстрой сессии нужно пройти темы, содержащие не менее 10 вопросов. Начните с тематической тренировки.';return false;}
    const s={track:gradeState?.track||null,direction:gradeState?.direction||null,stageId:gradeState?.stageId||null,id:globalThis.crypto?.randomUUID?.()||String(Date.now()),mode,hints,minutes,topic:topic||null,ids,index:0,answers:[],draft:'',pick:null,remaining:Math.max(30,Math.round(minutes*60/ids.length)),deadline:null,startedAt:new Date().toISOString()};
    window.DailyTasks?.stop();try{sessionStorage.removeItem('inis.training.result.v1');}catch{}persist(s);location.assign(`training-question-1.html?mode=${mode}`);
  };
  window.TrainingEngine={begin};
  if(params.get('mode')==='topic'&&document.getElementById('modes')){document.querySelectorAll('#modes .tc').forEach((b,i)=>{b.classList.toggle('on',i===1);b.setAttribute('aria-checked',String(i===1));});}
  const getOptions=()=>({hints:document.querySelector('#hints .hintc')?.classList.contains('on'),minutes:Number(document.getElementById('dur')?.value)||15});
  document.getElementById('daily-mode-link')?.addEventListener('click',()=>store.set('inis.training.options.v2',getOptions()));
  const nav=document.querySelector('[data-start-training]');
  if(nav)nav.addEventListener('click',event=>{
    event.preventDefault();store.set('inis.training.options.v2',getOptions());
    const selected=[...document.querySelectorAll('#modes .tc')].findIndex(b=>b.classList.contains('on'));
    if(document.getElementById('daily-mode-link')?.classList.contains('on')){location.assign(document.getElementById('daily-mode-link').href);return;}
    const mode=['quick','topic','full'][Math.max(0,selected)], hints=document.querySelector('#hints .hintc')?.classList.contains('on');
    const minutes=Number(document.getElementById('dur').value)||15;
    store.set('inis.training.options.v2',{hints,minutes});
    location.assign({quick:'quick-session.html',topic:'topic-selection.html',full:'full-interview.html'}[mode]+(mode==='topic'&&params.get('topic')?'?topic='+encodeURIComponent(params.get('topic')):'' ));
  });
  const setup=document.querySelector('[data-training-setup]');
  if(setup){
    const mode=setup.dataset.trainingSetup, options=store.get('inis.training.options.v2',{hints:true,minutes:15}), saved=getSaved(mode);
    document.getElementById('setup-options').textContent=`${options.hints?'С RAG-подсказками':'Без подсказок'} · ${options.minutes} минут`;
    const resume=document.getElementById('resume-mode');
    if(saved){resume.hidden=false;resume.textContent=`Продолжить: вопрос ${saved.index+1} из ${saved.ids.length}`;resume.addEventListener('click',()=>{persist(saved);location.assign(`training-question-1.html?mode=${mode}`);});}
    let selected=P.questions.some(q=>q.topic===params.get('topic'))?params.get('topic'):null;
    if(mode==='topic'){
      const fav=store.get('inis.favorite-questions.v1',[]),favoriteTopics=P.questions.filter(q=>Array.isArray(fav)&&fav.includes(q.id)).map(q=>q.topic);
      const render=filter=>{
        const pool=filter==='favorites'?P.planTopics().filter(t=>favoriteTopics.includes(t.name)):P.planTopics().filter(t=>t.status==='done'||t.status==='current'||t.name===selected);if(selected&&!pool.some(t=>t.name===selected))pool.push({name:selected,status:'current'});
        const list=document.getElementById('topic-list');list.innerHTML=pool.map(t=>`<button type="button" class="tc ui-card ${selected===t.name?'on':''}" data-topic="${e(t.name)}" aria-pressed="${selected===t.name}"><img src="../images/icons/ic-target.svg" alt=""><span><strong>${e(t.name)}</strong><span class="muted">${P.questions.filter(q=>q.topic===t.name).length} вопросов · ${filter==='favorites'?'Из избранного':t.status==='done'?'Пройденная тема':t.status==='future'?'Выбранная тема':'Текущая тема'}</span></span><img class="mode-chevron" src="../images/icons/ic-chevron-right.svg" alt=""></button>`).join('');
        document.getElementById('topic-empty').hidden=pool.length>0;
        if(!pool.some(t=>t.name===selected)){selected=null;document.getElementById('begin-mode').disabled=true;}
        document.getElementById('begin-mode').disabled=!selected;
        list.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{selected=b.dataset.topic;list.querySelectorAll('button').forEach(x=>{x.classList.toggle('on',x===b);x.setAttribute('aria-pressed',String(x===b));});document.getElementById('begin-mode').disabled=false;}));
      };
      document.querySelectorAll('[data-topic-filter]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('[data-topic-filter]').forEach(x=>{x.classList.toggle('on',x===b);x.setAttribute('aria-pressed',String(x===b));});render(b.dataset.topicFilter);}));
      render('learned');
    }
    document.getElementById('begin-mode').addEventListener('click',()=>{if(mode==='topic'&&!selected)return;begin(mode,options.hints,options.minutes,selected);});
  }
  const root=document.querySelector('[data-training-question]');
  if(root&&!params.has('daily')){
    let s=P.active();
    if(params.get('mode')&&s?.mode!==params.get('mode')){const saved=getSaved(params.get('mode'));if(saved){persist(saved);s=P.active();}else s=null;}
    if(s?.mode==='full'&&s.pick!==null&&!s.draft){s.draft=find(s.ids[s.index])?.options?.[s.pick]||'';s.pick=null;persist(s);}
    if(!s){root.innerHTML='<header class="app-header"><span></span><h1>Тренировка</h1><a class="header-action" href="training.html" aria-label="Выйти"><img src="../images/icons/ic-close.svg" alt=""></a></header><div id="question-content"><section class="ui-card"><h2>Выберите режим тренировки</h2><p>Сохранённой сессии нет. Начните новую тренировку.</p><a class="form-button" href="training.html">К тренировкам</a></section></div>';return;}
    let tick=null, paused=false, disposed=false,recognition=null;
    const sessionQuestion=()=>{const q=find(s.ids[s.index]);return s.mode==='full'?P.openQuestion(q):q;};
    const stopVoice=()=>{if(recognition){recognition.onend=null;try{recognition.stop();}catch{}recognition=null;}};
    const exit=document.createElement('dialog');exit.className='session-exit-dialog';exit.id='exit-dialog';exit.setAttribute('aria-labelledby','exit-title');
    exit.innerHTML='<h2 id="exit-title">Выйти из тренировки?</h2><p>Можно сохранить прогресс и продолжить позже или завершить сессию с текущим результатом.</p><div class="exit-actions"><button class="form-button secondary" data-cancel type="button">Продолжить тренировку</button><button class="form-button secondary" data-pause type="button">Сохранить и выйти</button><button class="form-button" data-finish type="button">Завершить досрочно</button></div>';document.body.append(exit);
    const hints=document.createElement('dialog');hints.className='ui-dialog';hints.id='rag-dialog';hints.setAttribute('aria-labelledby','rag-title');document.body.append(hints);
    const saveDraft=()=>{if(disposed)return;const input=root.querySelector('#ans');if(input)s.draft=input.value;const pick=root.querySelector('input[name="answer"]:checked');s.pick=pick?Number(pick.value):null;persist(s);};
    const freeze=()=>{stopVoice();if(s.deadline)s.remaining=Math.max(0,Math.ceil((s.deadline-Date.now())/1000));s.deadline=null;paused=true;clearInterval(tick);saveDraft();};
    const finish=early=>{freeze();const total=s.ids.length,score=Math.round(s.answers.reduce((sum,a)=>sum+a.score,0)/total);P.addHistory({...s,score,total,early,finishedAt:new Date().toISOString()});disposed=true;clear(s);location.assign('training-results.html');};
    const submit=timeout=>{
      stopVoice();saveDraft();const q=sessionQuestion();
      const error=root.querySelector('#answer-error');
      if(!timeout&&((q.type==='choice'&&s.pick===null)||(q.type!=='choice'&&!s.draft.trim()))){error.textContent=q.type==='choice'?'Выберите один ответ.':'Введите ответ: поле не может быть пустым.';error.hidden=false;root.querySelector(q.type==='choice'?'input[name="answer"]':'#ans')?.focus();return;}
      const text=q.type==='choice'?(s.pick===null?'Нет ответа':q.options[s.pick]):s.draft.trim();
      let score=q.type==='choice'?Number(s.pick===q.correct)*100:Math.round(q.rubric.filter(group=>group.some(term=>text.toLowerCase().includes(term))).length/q.rubric.length*100);
      if(timeout&&!text.trim())score=0;
      s.answers.push({id:q.id,topic:q.topic,title:q.title,type:q.type,answer:text||'Нет ответа',expected:q.expected,explanation:q.explanation,score,timeout:Boolean(timeout),hintUsed:Boolean(s.hintUsed)});
      clearInterval(tick);s.index++;s.draft='';s.pick=null;s.hintUsed=false;s.deadline=null;s.remaining=Math.max(30,Math.round(s.minutes*60/s.ids.length));
      if(s.index>=s.ids.length){finish(false);return;}
      persist(s);render();
    };
    const startTimer=()=>{
      paused=false;clearInterval(tick);if(s.mode!=='full')return;
      if(!s.deadline)s.deadline=Date.now()+s.remaining*1000;persist(s);
      const update=()=>{
        if(paused)return;const seconds=Math.max(0,Math.ceil((s.deadline-Date.now())/1000));
        const time=root.querySelector('time');if(time){time.textContent=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;time.dateTime=`PT${seconds}S`;time.parentElement.classList.toggle('is-urgent',seconds<=15);}
        if(seconds===0){if(hints.open)hints.close();submit(true);}
      };tick=setInterval(update,250);update();
    };
    const render=()=>{
      stopVoice();const q=sessionQuestion();
      root.innerHTML=`<header class="app-header"><span class="header-action" aria-hidden="true"></span><h1 class="session-name">${e(modes[s.mode])}</h1><button class="header-action" id="finish-session" type="button" aria-label="Выйти из тренировки" aria-haspopup="dialog" aria-controls="exit-dialog"><img src="../images/icons/ic-close.svg" alt=""></button></header><div id="question-content" class="content-inner session-content"><div class="session-context"><div class="question-meta"><p>${e(q.topic)}</p><p>Вопрос ${s.index+1} из ${s.ids.length}</p></div><div class="question-progress" role="progressbar" aria-label="Прогресс тренировки" aria-valuemin="0" aria-valuemax="${s.ids.length}" aria-valuenow="${s.index}" style="--question-progress:${s.index/s.ids.length*100}%"></div>${s.hints?'<p class="question-rag"><img src="../images/icons/ic-sparkle.svg" alt=""><span>Подсказки из базы знаний</span></p>':''}</div><section class="question-card"><div class="question-card-meta"><p class="question-tag">${e(q.topic)}</p>${s.mode==='full'?'<p class="question-time"><img src="../images/icons/ic-clock.svg" alt=""><time>00:00</time></p>':''}</div><h2>${e(q.title)}</h2><p class="question-instructions">${q.type==='choice'?'Выберите один верный ответ.':'Ответьте так, как на реальном собеседовании.'}</p>${q.context?`<pre class="question-code">${e(q.context)}</pre>`:''}${q.type==='logs'?'<img class="log-image" src="../images/log-task.svg" alt="12:00:01 GET /users; 12:00:01 PostgreSQL db:5432 ECONNREFUSED; 12:00:02 GET /users 503 Service Unavailable; 12:00:04 health dependency database DOWN">':''}${s.hints?'<button class="question-hint" id="hintb" type="button" aria-haspopup="dialog" aria-controls="rag-dialog"><img src="../images/icons/ic-bulb.svg" alt="">Получить подсказку</button>':''}</section><form class="answer-form" id="answer-form" novalidate>${q.type==='choice'?`<fieldset class="daily-answer-options"><legend class="answer-label">Ваш ответ</legend>${q.options.map((opt,i)=>`<label class="daily-answer-choice"><input type="radio" name="answer" value="${i}" ${s.pick===i?'checked':''}><span>${e(opt)}</span></label>`).join('')}</fieldset>`:`<label class="answer-label" for="ans">${q.type==='code'?'Ваш код или разбор':'Ваш ответ'}</label><textarea class="answer-input ${q.type==='code'?'code-answer':''}" id="ans" required maxlength="4000" aria-describedby="answer-count answer-error" placeholder="Введите ответ…">${e(s.draft)}</textarea><div class="answer-tools"><p class="answer-counter" id="answer-count"><span id="cnt">${s.draft.length}</span>/4000</p><button class="answer-mic" id="voice-answer" type="button" aria-label="Голосовой ввод" aria-pressed="false"><img src="../images/icons/ic-mic.svg" alt=""></button></div><p id="voice-status" class="muted" role="status"></p>`}<p class="answer-error" id="answer-error" role="alert" hidden></p><button class="answer-submit" type="submit"><img src="../images/icons/ic-plane.svg" alt="">${s.index===s.ids.length-1?'Завершить тренировку':'Следующий вопрос'}</button></form><p class="muted">${s.mode==='full'?'Для открытых заданий используется предварительная проверка по ключевым признакам; сравните решение с верным ответом.':''}</p></div>`;
      if(root.classList.contains('app-shell')){const content=document.createElement('div');content.className='app-content';const header=root.querySelector('.app-header'),body=root.querySelector('#question-content');content.append(body);root.replaceChildren(header,content);}
      root.querySelector('#answer-form').addEventListener('submit',event=>{event.preventDefault();submit(false);});
      root.querySelector('#ans')?.addEventListener('input',()=>{root.querySelector('#cnt').textContent=root.querySelector('#ans').value.length;root.querySelector('#answer-error').hidden=true;saveDraft();});
      root.querySelectorAll('input[name="answer"]').forEach(input=>input.addEventListener('change',()=>{root.querySelector('#answer-error').hidden=true;saveDraft();}));
      root.querySelector('#finish-session').addEventListener('click',()=>{stopVoice();saveDraft();exit.showModal();});
      root.querySelector('#hintb')?.addEventListener('click',()=>{
        stopVoice();s.hintUsed=true;persist(s);
        // Retrieve the relevant authored fragment by question and topic from the local knowledge corpus.
        hints.innerHTML=`<div class="dialog-heading"><h2 id="rag-title"><img src="../images/rag-icon.svg" alt="">RAG-подсказка</h2><button type="button" class="icon-button" data-close aria-label="Закрыть подсказку"><img src="../images/icons/ic-close.svg" alt=""></button></div><p class="rag-copy">${e(q.hint)}</p>${P.sourceHTML(q,'rag-source')}<button class="form-button" data-close type="button">Вернуться к вопросу</button>`;
        hints.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>hints.close()));hints.showModal();
      });
      root.querySelector('#voice-answer')?.addEventListener('click',()=>{
        const mic=root.querySelector('#voice-answer'),status=root.querySelector('#voice-status'),input=root.querySelector('#ans');
        if(recognition){stopVoice();mic.setAttribute('aria-pressed','false');status.textContent='Запись остановлена.';return;}
        const Speech=window.SpeechRecognition||window.webkitSpeechRecognition;if(!Speech){status.textContent='Голосовой ввод недоступен в этом браузере. Ответьте текстом.';input.focus();return;}
        const rec=new Speech();recognition=rec;rec.lang='ru-RU';rec.interimResults=false;rec.continuous=false;
        rec.onstart=()=>{mic.setAttribute('aria-pressed','true');status.textContent='Слушаю… Нажмите ещё раз для остановки.';};
        rec.onresult=event=>{const text=event.results[event.resultIndex][0].transcript;input.value=(input.value+(input.value?' ':'')+text).slice(0,4000);input.dispatchEvent(new Event('input',{bubbles:true}));status.textContent='Ответ распознан. Проверьте текст перед отправкой.';};
        rec.onerror=event=>{status.textContent=event.error==='not-allowed'?'Разрешите микрофон в браузере или ответьте текстом.':'Не удалось распознать речь. Попробуйте ещё раз.';};
        rec.onend=()=>{mic.setAttribute('aria-pressed','false');if(recognition===rec)recognition=null;};try{rec.start();}catch{recognition=null;status.textContent='Не удалось включить микрофон. Ответьте текстом.';}
      });
      startTimer();document.querySelector('.app-content')?.scrollTo(0,0);
    };
    exit.querySelector('[data-cancel]').addEventListener('click',()=>exit.close());
    exit.querySelector('[data-pause]').addEventListener('click',()=>{freeze();location.assign('main.html');});
    exit.querySelector('[data-finish]').addEventListener('click',()=>finish(true));
    exit.addEventListener('close',()=>root.querySelector('#finish-session')?.focus());
    hints.addEventListener('close',()=>root.querySelector('#hintb')?.focus());
    window.addEventListener('pagehide',()=>{stopVoice();saveDraft();});
    // Restore the question if the browser puts a running session in its back/forward cache.
    window.addEventListener('pageshow',event=>{if(event.persisted){s=P.active();if(s)render();else location.replace('training.html');}});
    render();
  }
  const results=document.querySelector('[data-training-results]');
  const resultId=params.get('id'),result=resultId?P.history().find(x=>x.id===resultId):store.get('inis.result.v2');
  let old=null;try{old=JSON.parse(sessionStorage.getItem('inis.training.result.v1'));}catch{}
  if(results&&result&&(!old?.daily||resultId)){
    results.removeAttribute('data-training-results');
    const rows=Object.values(result.answers.reduce((map,a)=>{map[a.topic]??={name:a.topic,count:0,sum:0};map[a.topic].count++;map[a.topic].sum+=a.score;return map;},{}));
    const weak=[...rows].sort((a,b)=>a.sum/a.count-b.sum/b.count)[0];
    const navHTML=`<nav class="app-nav" aria-label="Основная навигация">${[['main','home-off','Главная'],['training','chat','Тренировка'],['kb-1','books','База'],['analytics','chart-on','Прогресс'],['profile-1','profile','Профиль']].map(([page,icon,label])=>`<a href="${page}.html" ${page==='analytics'?'aria-current="page"':''}><img src="../images/icons/ic-nav-${icon}.svg" alt=""><span>${label}</span></a>`).join('')}</nav>`;
    results.innerHTML=`<header class="app-header"><button class="header-action" type="button" data-open-menu aria-label="Открыть меню"><img src="../images/icons/ic-menu.svg" alt=""></button><h1>Итоги тренировки</h1><a class="header-action" href="profile-4.html" aria-label="Уведомления"><img src="../images/icons/ic-bell.svg" alt=""></a></header><div class="content-inner session-content"><h2 class="results-title">${e(modes[result.mode])}</h2><div class="results-score" role="img" aria-label="Результат ${result.score} процентов" style="background:conic-gradient(var(--meter-fill) ${result.score}%,var(--meter-track) 0)"><span>${result.score}%</span></div><p class="results-caption">${result.early?'Сессия завершена досрочно. ':'Тренировка завершена. '}Отвечено ${result.answers.length} из ${result.total}. Неотвеченные вопросы: 0 баллов.</p><dl class="results-skills">${rows.map(r=>{const score=Math.round(r.sum/r.count);return `<div class="result-skill"><dt>${e(r.name)}</dt><dd>${score}%</dd><progress max="100" value="${score}"></progress></div>`;}).join('')}</dl><aside class="results-recommendation"><img src="../images/icons/ic-results-brain.svg" alt=""><h3>Рекомендация</h3><p>${weak?`Повторите тему «${e(weak.name)}» и проверьте правильные ответы.`:'Начните новую тренировку, чтобы оценить подготовку.'}</p></aside><button class="results-review" id="review-answers" type="button" aria-haspopup="dialog" aria-controls="answer-review">Разобрать все ответы</button><a class="results-analytics" href="analytics.html">К аналитике</a><a class="text-link" href="main.html?plan=open#personal-plan">План подготовки ›</a></div>${navHTML}`;
    if(['diagnostic','gradecheck'].includes(result.mode)){const notice=document.createElement('section');notice.className='ui-card grade-notice';notice.innerHTML=result.assignedGrade?`<h2>Ваш грейд: ${e(result.assignedGrade)}</h2><p>${result.mode==='diagnostic'?'Стартовый уровень определён. Персональный план готов.':'План выполнен, грейд повышен.'}</p>`:`<h2>Грейд пока не изменён</h2><p>${result.early?'Завершите диагностику, чтобы определить уровень.':'Повторите слабые темы. Для повышения нужно не менее 80% и выполненные шаги плана.'}</p>`;results.querySelector('.results-skills').before(notice);}
    const dialog=document.createElement('dialog');dialog.className='ui-dialog review-modal';dialog.id='answer-review';dialog.setAttribute('aria-labelledby','review-title');
    dialog.innerHTML=`<div class="dialog-heading"><h2 id="review-title">Разбор ответов</h2><button type="button" class="icon-button" data-close aria-label="Закрыть разбор"><img src="../images/icons/ic-close.svg" alt=""></button></div><div class="review-body">${result.mode==='full'?'<p class="muted review-note">Оценка открытых ответов предварительная. Сравните свою формулировку с верным ответом.</p>':''}${result.ids.map((id,i)=>{const a=result.answers[i],dailyMatch=id?.match(/^daily-(http|api|sql)-(\d+)$/),dailyQ=dailyMatch?window.DailyTasks?.find(dailyMatch[1])?.questions[Number(dailyMatch[2])]:null,original=find(id)||a||(dailyQ?{...dailyQ,expected:dailyQ.options[dailyQ.correct],type:'choice'}:null),q=result.mode==='full'&&original?P.openQuestion(original):original;return `<section class="review-item"><h3>${i+1}. ${e(q?.title)}</h3><span class="pill">${a?`${a.score}%${a.timeout?' · Время вышло':''}`:'Не отвечено'}</span><p>Ваш ответ</p><pre>${e(a?.answer||'Ответ не отправлен')}</pre><p><strong>Верный ответ</strong></p><pre>${e(q?.expected)}</pre>${P.sourceHTML(q)}<p>${e(q?.explanation)}</p>${q?.type==='code'?'<p class="muted">Код не запускался; проверьте решение перед использованием.</p>':''}</section>`;}).join('')}<button class="form-button" type="button" data-close>Понятно</button></div>`;
    document.body.append(dialog);results.querySelector('#review-answers').addEventListener('click',()=>dialog.showModal());dialog.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>dialog.close()));dialog.addEventListener('close',()=>results.querySelector('#review-answers').focus());
  }
})();
