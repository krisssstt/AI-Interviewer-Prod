(() => {
  'use strict';
  const api = window.Api.request, page = location.pathname.split('/').pop();
  const params = new URLSearchParams(location.search);
  const e = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const modes = {diagnostic:'Диагностика',practice:'Учебная практика',exam:'Контрольное интервью'};
  const states = {active:'В процессе',paused:'На паузе',completed:'Завершена',expired:'Время истекло'};
  const key = () => crypto.randomUUID();
  const date = epoch => new Date(epoch * 1000).toLocaleString('ru-RU');
  const links = [['main.html','План'],['training.html','Практика'],['training-history.html','История'],['kb-1.html','Каталог'],['profile-1.html','Профиль']];
  const sources = list => `<ul>${(list || []).map(s => {
    const url = /^https?:\/\//.test(s.url) ? s.url : '';
    return `<li>${url ? `<a href="${e(url)}" target="_blank" rel="noopener noreferrer">${e(s.title)}</a>` : e(s.title)} · ${e(s.version)}</li>`;
  }).join('')}</ul>`;
  document.body.className = 'application server-app';
  let content, user;

  function shell(title) {
    const main = document.querySelector('main');
    main.className = 'server-shell';
    main.innerHTML = `<header class="server-header"><a href="main.html" aria-label="Главная">QA</a><h1>${e(title)}</h1><button type="button" class="side-menu-theme" role="switch" aria-label="Тёмная тема" aria-checked="false">◐</button></header><div class="server-content"><section class="content-inner"><p id="server-status" class="server-status" role="status" aria-live="polite"></p><div id="server-content" class="content-inner" style="padding:0"><p>Загрузка…</p></div></section></div><nav class="server-nav" aria-label="Основная навигация">${links.map(([url,label]) => `<a href="${url}" ${page===url?'aria-current="page"':''}>${label}</a>`).join('')}</nav>`;
    content = document.getElementById('server-content');
    window.ThemeUI?.sync();
  }
  function status(message, isError = false) {
    const node = document.getElementById('server-status');
    node.textContent = message; node.classList.toggle('error', isError);
  }
  function showError(error) {
    status(error.message, true);
    if (error.status === 401 && !document.getElementById('reauth-link')) {
      const link = document.createElement('a'); link.id='reauth-link'; link.href='login.html';
      link.textContent='Войти снова'; document.getElementById('server-status').after(link);
    }
  }
  async function run(button, operation) {
    if (button?.disabled) return;
    if (button) button.disabled = true;
    status('Загрузка…');
    try { await operation(); status(''); }
    catch (error) { showError(error); }
    finally { if (button?.isConnected) button.disabled=false; }
  }
  function readDraft(id) { try { return JSON.parse(sessionStorage.getItem(id) || 'null'); } catch { return null; } }
  function saveDraft(id, data) { try { sessionStorage.setItem(id, JSON.stringify(data)); } catch {} }

  async function auth() {
    const form = document.querySelector('.auth-form');
    const node = document.createElement('p'); node.id='server-status'; node.className='server-status'; node.setAttribute('role','status'); form.append(node);
    // Original OAuth link was a navigation-only success; disclose availability.
    document.querySelector('a[href="main.html"].secondary')?.replaceWith(Object.assign(document.createElement('p'), {textContent:'Вход через GitHub пока не подключён.'}));
    form.removeAttribute('action'); form.method='post';
    const password = form.querySelector('#password'); password.minLength=8; password.maxLength=128;
    if (form.querySelector('#password2')) form.querySelector('#password2').minLength=8;
    form.addEventListener('submit', event => {
      event.preventDefault();
      if (form.querySelector('#password2') && form.querySelector('#password2').value !== password.value) { status('Пароли не совпадают.',true); return; }
      run(form.querySelector('button[type=submit]'), async () => {
        const registering = page==='register.html';
        await api('/auth/' + (registering?'register':'login'), {method:'POST',body:{email:form.querySelector('#email').value.trim(),password:password.value,...(registering?{name:form.querySelector('#name').value.trim()}:{})}});
        location.assign('main.html');
      });
    });
  }

  async function plan() {
    shell('Персональный план');
    const plan = await api('/plan');
    content.innerHTML = `<h2>Здравствуйте, ${e(user.name)}</h2><p>QA Engineer · учебный прототип серверной версии. RAG и открытые ответы ещё не подключены.</p><div class="server-actions"><button class="form-button" id="diagnostic">Начать диагностику</button><a class="form-button secondary" href="training.html">К тренировкам</a></div><p class="server-meta">План v${plan.version} · ${e(plan.rules_version)}. Посещение материала и ответ с подсказкой не подтверждают знание. Уровни — внутренняя учебная модель.</p>${plan.items.map(item => `<article class="server-card"><h3>${e(item.topic)}</h3><p>${e(item.description)}</p><p>${e(item.reason)}</p><p class="server-meta">Самостоятельных ответов: ${item.independent_attempts}; балл: ${item.score??'нет данных'}; ${e(item.confidence)}</p>${item.prerequisites_to_review.length?`<p class="server-meta">Предварительно повторить: ${e(item.prerequisites_to_review.join(', '))}</p>`:''}<a href="training.html?competency=${encodeURIComponent(item.competency_id)}">Практика по компетенции →</a></article>`).join('')}`;
    document.getElementById('diagnostic').onclick = event => start(event.target, 'diagnostic', null);
  }
  async function start(button, mode, competency_id) {
    const request_key = button.dataset.requestKey || (button.dataset.requestKey=key());
    await run(button, async () => {
      const s = await api('/sessions',{method:'POST',body:{mode,competency_id,request_key}});
      location.assign('training-question-1.html?id='+encodeURIComponent(s.id));
    });
  }
  async function training() {
    shell('Тренировки QA');
    const catalog = await api('/catalog');
    content.innerHTML = `<h2>Выберите режим</h2><p>Практика допускает подсказки. Диагностика и контроль проходят самостоятельно. В текущем этапе используются объективные задания, не LLM-оценка.</p><label for="competency">Компетенция</label><select id="competency" class="form-control"><option value="">Все компетенции</option>${catalog.competencies.map(c=>`<option value="${e(c.id)}">${e(c.topic)} · ${e(c.description)}</option>`).join('')}</select><div class="server-actions"><button id="practice" class="form-button">Начать практику</button><button id="exam" class="form-button secondary">Контрольное интервью</button></div><p>Контроль: 30 минут по серверному времени, включая паузу. Подсказок нет. Задания опубликованы в seed; экспертная проверка ещё предстоит.</p><a href="training-history.html">Продолжить сохранённую сессию →</a>`;
    const select = document.getElementById('competency');
    if(catalog.competencies.some(c=>c.id===params.get('competency'))) select.value=params.get('competency');
    select.onchange=()=>document.querySelectorAll('[data-request-key]').forEach(b=>delete b.dataset.requestKey);
    document.getElementById('practice').onclick=event=>start(event.target,'practice',select.value||null);
    document.getElementById('exam').onclick=event=>start(event.target,'exam',null);
  }

  let timer;
  async function session() {
    shell('Сессия QA');
    const id = params.get('id');
    if (!id) { content.innerHTML='<p>Сессия не выбрана.</p><a href="training.html">Начать тренировку</a>'; return; }
    const base='/sessions/'+encodeURIComponent(id);
    const render = s => {
      clearInterval(timer);
      if(['completed','expired'].includes(s.status)) { report(s); return; }
      content.innerHTML=`<h2>${e(modes[s.mode])}</h2><p class="server-count">${e(states[s.status])} · вопрос ${s.position+1} из ${s.total}</p>${s.deadline?'<p id="countdown" aria-label="Оставшееся время"></p>':''}${s.status==='paused'?'<p>Ответ сохранён на сервере. Текущий черновик остаётся в этой вкладке.</p><button id="resume" class="form-button">Продолжить</button>':`<form id="answer-form" class="server-card"><fieldset><legend>${e(s.question.title)}</legend>${s.question.options.map((value,i)=>`<label class="server-option"><input type="radio" name="answer" value="${i}" required><span>${e(value)}</span></label>`).join('')}</fieldset><button class="form-button" type="submit">Отправить ответ</button></form><div class="server-actions">${s.hint_available?'<button id="hint" class="form-button secondary">Получить подсказку</button>':''}<button id="pause" class="form-button secondary">Пауза</button></div><aside id="hint-text" class="server-status" role="status"></aside>`}<button id="finish" class="form-button secondary">Завершить досрочно</button><p class="server-meta">Оценки и разбор появятся после завершения. Неотвеченные задания учитываются как 0; сбой проверки не является ответом.</p>`;
      const draftId=`qa-draft:${user.id}:${id}:${s.question?.id}`;
      const form=document.getElementById('answer-form');
      if(form) {
        let draft=readDraft(draftId)||{value:null,request_key:key()};
        if(draft.value!==null) form.querySelector(`input[value="${draft.value}"]`)?.setAttribute('checked','checked');
        form.onchange=()=>{draft={value:form.querySelector('input:checked')?.value,request_key:key()};saveDraft(draftId,draft);};
        form.onsubmit=event=>{event.preventDefault();run(form.querySelector('button'),async()=>{
          const next=await api(base+'/answers',{method:'POST',body:{question_version_id:s.question.id,value:draft.value,request_key:draft.request_key}});
          try{sessionStorage.removeItem(draftId);}catch{} render(next);
        });};
      }
      for(const [element,action] of [['pause','pause'],['resume','resume'],['finish','finish']]) {
        const button=document.getElementById(element);
        if(button) button.onclick=()=>run(button,async()=>render(await api(base+'/state/'+action,{method:'POST',body:{}})));
      }
      document.getElementById('hint')?.addEventListener('click',event=>run(event.target,async()=>{
        const hint=await api(base+'/hint',{method:'POST',body:{}});
        document.getElementById('hint-text').textContent=hint.text+'\n'+hint.notice;
      }));
      if(s.deadline) {
        const received=Date.now(), remaining=(s.deadline-s.server_time)*1000;
        const tick=()=>{
          const seconds=Math.max(0,Math.ceil((remaining-(Date.now()-received))/1000));
          const node=document.getElementById('countdown');
          if(node) node.textContent=`Осталось: ${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
          if(!seconds) {clearInterval(timer);api(base).then(render).catch(showError);}
        }; tick();timer=setInterval(tick,1000);
      }
    };
    render(await api(base));
  }

  function report(s) {
    content.innerHTML=`<h2>Результат: ${s.score}%</h2><p>${e(modes[s.mode])} · ${e(states[s.status])}. Ответов: ${s.answered} из ${s.total}.</p><p>${e(s.unanswered_policy)}</p>${s.report.map((r,i)=>`<article class="server-card"><h3>${i+1}. ${e(r.title)}</h3><p>Балл: ${r.score??'нет ответа'}${r.hint_used?' · с подсказкой':''}</p><p>Ваш ответ: ${e(r.value_text??'Не отправлен')}</p><p><strong>Ожидаемый ответ:</strong> ${e(r.expected)}</p><p>${e(r.explanation)}</p>${sources(r.sources)}<p class="server-meta">Версия: ${e(r.question_version_id)} · ${e(r.evaluation?.method||r.status)}</p></article>`).join('')}<a class="form-button" href="main.html">К обновлённому плану</a><a href="analytics.html">Аналитика по режимам →</a>`;
  }

  async function history() {
    shell('История сессий');
    const sessions=await api('/sessions');
    content.innerHTML=sessions.length?sessions.map(s=>`<article class="server-card"><h2>${e(modes[s.mode])}</h2><p>${e(states[s.status])} · ${s.position} из ${s.total} · ${date(s.created_at)}</p><a href="training-question-1.html?id=${encodeURIComponent(s.id)}">${['completed','expired'].includes(s.status)?'Открыть разбор':'Продолжить'} →</a></article>`).join(''):'<p>Сессий пока нет.</p><a href="training.html">Начать практику</a>';
  }
  async function analytics() {
    shell('Аналитика');
    const data=await api('/analytics');
    content.innerHTML=`<p>${e(data.notice)}</p>${Object.entries(data.modes).map(([mode,values])=>`<article class="server-card"><h2>${e(modes[mode])}</h2><p>Ответов: ${values.answers} · средний балл: ${values.mean??'нет данных'}</p></article>`).join('')}<p>Средний балл описывает полученные ответы; достаточность свидетельств отдельно отражается в плане. Режимы не объединяются в единую квалификацию.</p>`;
  }
  async function catalog() {
    shell('Компетенции и избранное');
    const [catalog,favorites]=await Promise.all([api('/catalog'),api('/favorites')]);
    const onlyFavorites=params.get('view')==='favorites';
    const selected=catalog.competencies.filter(c=>!onlyFavorites||favorites.includes(c.id));
    content.innerHTML=`<h2>Поиск учебных материалов</h2><form id="knowledge-search" class="server-card"><label for="search-query">Тема или вопрос</label><input id="search-query" class="form-control" minlength="2" maxlength="300" required><label for="search-mode">Способ поиска</label><select id="search-mode" class="form-control"><option value="lexical">По тексту</option><option value="vector">По смыслу</option><option value="hybrid">Комбинированный</option></select><button class="form-button">Найти материалы</button></form><div id="search-results" class="content-inner" style="padding:0" aria-live="polite"></div><a href="documents.html">Мои документы${user.is_admin?' и управление общей базой':''} →</a><a href="kb-1.html${onlyFavorites?'':'?view=favorites'}">${onlyFavorites?'Все компетенции':'Только избранное'}</a>${selected.length?'':'<p>Избранных компетенций пока нет.</p>'}${selected.map(c=>`<article class="server-card"><h2>${e(c.topic)}</h2><p>${e(c.description)}</p><p class="server-meta">${e(c.id)} · ${e(c.levels.join(', '))}</p>${sources(c.sources)}<div class="server-actions"><button class="form-button secondary" data-favorite="${e(c.id)}" aria-pressed="${favorites.includes(c.id)}">${favorites.includes(c.id)?'Убрать из избранного':'В избранное'}</button><a href="training.html?competency=${encodeURIComponent(c.id)}">Практика →</a></div></article>`).join('')}`;
    document.getElementById('knowledge-search').onsubmit=event=>{event.preventDefault();run(event.target.querySelector('button'),async()=>{
      const result=await api('/knowledge/search',{method:'POST',body:{query:document.getElementById('search-query').value,mode:document.getElementById('search-mode').value}});
      document.getElementById('search-results').innerHTML=result.sources.length?result.sources.map(source=>`<article class="server-card"><h3>${e(source.title)}</h3><p class="server-meta">Версия ${source.version} · ${e(source.section)}</p><pre>${e(source.text)}</pre><a href="documents.html?document=${encodeURIComponent(source.document_id)}">Открыть материал</a></article>`).join(''):'<p>Источники не найдены. Попробуйте другую формулировку или добавьте материал.</p>';
    });};
    content.querySelectorAll('[data-favorite]').forEach(button=>button.onclick=()=>run(button,async()=>{
      const active=button.getAttribute('aria-pressed')==='true';
      await api('/favorites/'+encodeURIComponent(button.dataset.favorite),{method:active?'DELETE':'PUT',body:{}});
      button.setAttribute('aria-pressed',String(!active));button.textContent=active?'В избранное':'Убрать из избранного';
    }));
  }
  async function profile() {
    shell('Профиль');
    content.innerHTML=`<form id="server-profile" class="server-card"><label for="profile-name">Имя</label><input class="form-control" id="profile-name" value="${e(user.name)}" minlength="2" maxlength="60" required><p>Email: ${e(user.email)}</p><p>Направление: QA Engineer. Другие направления находятся в backlog.</p><button class="form-button">Сохранить профиль</button><p id="profile-saved" role="status"></p></form><button id="logout" class="form-button secondary">Выйти</button>`;
    document.getElementById('server-profile').onsubmit=event=>{event.preventDefault();run(event.target.querySelector('button'),async()=>{
      user=await api('/me',{method:'PATCH',body:{name:document.getElementById('profile-name').value.trim()}});
      document.getElementById('profile-saved').textContent='Профиль сохранён на сервере.';
    });};
    document.getElementById('logout').onclick=event=>run(event.target,async()=>{await api('/auth/logout',{method:'POST',body:{}});location.assign('login.html');});
  }

  async function documents() {
    shell('Документы и база знаний');
    const [catalog,documentList]=await Promise.all([api('/catalog'),api('/knowledge/documents')]);
    content.innerHTML=`<p>Добавьте собственный материал в TXT или Markdown. Частные материалы доступны только вам. PDF, DOCX и OCR пока не поддерживаются.</p><form id="document-upload" class="server-card"><h2 id="upload-heading">Новый документ</h2><label for="document-title">Название</label><input id="document-title" class="form-control" minlength="2" maxlength="200" required><label for="document-file">Файл TXT/MD, до 20 КБ</label><input id="document-file" type="file" accept=".txt,.md,text/plain,text/markdown"><label for="document-text">Текст (можно исправить перед отправкой)</label><textarea id="document-text" class="form-control" rows="8" minlength="40" maxlength="20000" required></textarea><label for="document-competency">Компетенция</label><select id="document-competency" class="form-control">${catalog.competencies.map(c=>`<option value="${e(c.id)}">${e(c.description)}</option>`).join('')}</select><label for="document-scope">Доступ</label><select id="document-scope" class="form-control"><option value="private">Только мне</option>${user.is_admin?'<option value="public">Общая база знаний</option>':''}</select><label for="document-license">Право использования</label><input id="document-license" class="form-control" value="Собственный учебный материал" minlength="2" maxlength="200" required><button class="form-button">Сохранить и обработать</button><button type="button" id="cancel-document-edit" class="form-button secondary" hidden>Отменить обновление</button><p id="upload-result" role="status"></p></form><h2>Доступные материалы</h2><button id="refresh-documents" class="form-button secondary">Обновить статусы</button><div id="document-detail"></div>${documentList.length?documentList.map(d=>`<article class="server-card"><h3>${e(d.title)}</h3><p>Версия ${d.version} · ${d.scope==='private'?'Личный':'Общий'} · ${e({queued:'Ожидает обработки',text_ready:'Текст доступен; смысловой индекс ещё не готов',ready:'Обработан',failed:'Ошибка обработки'}[d.status]||d.status)}</p><button class="form-button secondary" data-open-document="${e(d.id)}">Читать</button>${d.can_edit?`<div class="server-actions"><button class="form-button secondary" data-edit-document="${e(d.id)}">Новая версия</button><button class="form-button secondary" data-reindex-document="${e(d.id)}">Повторить индексацию</button><button class="form-button secondary" data-delete-document="${e(d.id)}">Удалить документ</button></div>`:''}</article>`).join(''):'<p>Материалов пока нет.</p>'}`;
    const form=document.getElementById('document-upload');let editing=null;
    document.getElementById('document-file').onchange=event=>run(null,async()=>{
      const file=event.target.files[0];if(!file)return;
      if(file.size>20000||!(/\.(txt|md)$/i.test(file.name))) throw Error('Выберите TXT/MD до 20 КБ. Текст формы сохранён.');
      let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer());}catch{throw Error('Файл должен быть текстом в UTF-8.');}
      document.getElementById('document-text').value=text;
      if(!document.getElementById('document-title').value) document.getElementById('document-title').value=file.name;
    });
    form.onsubmit=event=>{event.preventDefault();run(form.querySelector('button'),async()=>{
      const result=await api('/knowledge/documents'+(editing?'/'+encodeURIComponent(editing)+'/versions':''),{method:'POST',body:{title:document.getElementById('document-title').value,text:document.getElementById('document-text').value,competency_id:document.getElementById('document-competency').value,scope:document.getElementById('document-scope').value,license:document.getElementById('document-license').value}});
      document.getElementById('upload-result').textContent=`Версия ${result.version} сохранена. Документ ожидает обработки.`;
      form.reset();editing=null;document.getElementById('document-scope').disabled=false;document.getElementById('upload-heading').textContent='Новый документ';document.getElementById('cancel-document-edit').hidden=true;
    });};
    document.getElementById('refresh-documents').onclick=event=>run(event.target,documentsPage);
    async function documentsPage(){await documents();}
    const open=async id=>{
      const doc=await api('/knowledge/documents/'+encodeURIComponent(id));
      document.getElementById('document-detail').innerHTML=`<article class="server-card"><h2>${e(doc.title)}</h2><p>Версия ${doc.version}</p><pre>${e(doc.text)}</pre></article>`;
      document.getElementById('document-detail').scrollIntoView({block:'start'});return doc;
    };
    content.querySelectorAll('[data-open-document]').forEach(button=>button.onclick=()=>run(button,()=>open(button.dataset.openDocument)));
    content.querySelectorAll('[data-edit-document]').forEach(button=>button.onclick=()=>run(button,async()=>{
      const doc=await api('/knowledge/documents/'+encodeURIComponent(button.dataset.editDocument));editing=doc.id;
      for(const [field,value] of [['title',doc.title],['text',doc.text],['competency',doc.competency_id],['scope',doc.scope],['license',doc.license]]) document.getElementById('document-'+field).value=value;
      document.getElementById('document-scope').disabled=true;document.getElementById('upload-heading').textContent='Новая версия документа';document.getElementById('cancel-document-edit').hidden=false;form.scrollIntoView({block:'start'});
    }));
    document.getElementById('cancel-document-edit').onclick=()=>{editing=null;form.reset();document.getElementById('document-scope').disabled=false;document.getElementById('cancel-document-edit').hidden=true;document.getElementById('upload-heading').textContent='Новый документ';};
    content.querySelectorAll('[data-reindex-document]').forEach(button=>button.onclick=()=>run(button,async()=>{
      const job=await api('/knowledge/documents/'+encodeURIComponent(button.dataset.reindexDocument)+'/reindex',{method:'POST',body:{}});
      button.textContent=job.status==='queued'?'Индексация запрошена':'Обрабатывается';
    }));
    content.querySelectorAll('[data-delete-document]').forEach(button=>button.onclick=()=>{
      if(!confirm('Удалить документ, все версии и фрагменты без возможности восстановления?'))return;
      run(button,async()=>{await api('/knowledge/documents/'+encodeURIComponent(button.dataset.deleteDocument),{method:'DELETE',body:{}});await documentsPage();});
    });
    if(params.get('document')) await open(params.get('document'));
  }

  async function boot() {
    if(['login.html','register.html'].includes(page)) { await auth();return; }
    if(page==='forgot-password.html') {
      shell('Восстановление пароля');content.innerHTML='<p>Почтовый сервис ещё не подключён. Восстановление пароля недоступно, письмо не отправляется.</p><a href="login.html">Вернуться ко входу</a>';return;
    }
    shell('QA Interviewer');
    user=await api('/me');
    if(page==='main.html') await plan();
    else if(['training.html','quick-session.html','topic-selection.html','full-interview.html','choose-direction.html'].includes(page)) await training();
    else if(['training-question-1.html','training-question-2.html','training-results.html'].includes(page)) await session();
    else if(page==='training-history.html') await history();
    else if(page==='analytics.html') await analytics();
    else if(['kb-1.html','kb-2.html'].includes(page)) await catalog();
    else if(page==='documents.html') await documents();
    else if(page==='profile-1.html') await profile();
    else {
      content.innerHTML='<h2>Функция ещё не перенесена на сервер</h2><p>Этот экран доступен в исходном прототипе. Серверная версия пока поддерживает авторизацию, объективные QA-сессии, план, историю, аналитику и избранное. Документы, RAG и ИИ-оценивание находятся в разработке.</p><a href="main.html">К учебному плану</a>';
    }
  }
  boot().catch(showError);
})();
