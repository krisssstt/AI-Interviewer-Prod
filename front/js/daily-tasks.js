(() => {
  'use strict';
  const q = (title, options, correct, explanation, hint) => ({title,options,correct,explanation,hint});
  // Objective questions keep completion tied to actual answers, without inventing an AI score.
  const http = [
    q('Чем отличаются PUT и PATCH?', ['PUT задаёт полное представление, PATCH применяет частичные изменения','Оба метода предназначены только для чтения','PATCH всегда удаляет ресурс','PUT изменяет только одно поле'],0,'PUT передаёт новое представление ресурса целиком; PATCH описывает частичные изменения.','Сравните полную замену представления и изменение отдельных полей.'),
    q('Какой метод обычно используют для получения представления ресурса?', ['POST','GET','DELETE','PATCH'],1,'GET запрашивает представление ресурса.','Вспомните метод для чтения данных.'),
    q('Что означает идемпотентность HTTP-метода?', ['Ответ всегда имеет код 200','Запрос не может содержать тело','Повтор одинакового запроса имеет тот же ожидаемый эффект, что один запрос','Сервер отвечает одинаково быстро'],2,'Идемпотентность относится к ожидаемому эффекту повторного запроса, а не к одинаковому ответу.','Сравните эффект одного запроса и его повторения.')
  ];
  const api = [
    http[1],
    q('Какой код сообщает об успешном создании ресурса?', ['404','500','201','401'],2,'201 Created сообщает о создании ресурса.','Нужен код успешного ответа из семейства 2xx.'),
    q('Какой заголовок описывает тип содержимого сообщения?', ['Content-Type','Location','Allow','ETag'],0,'Content-Type указывает медиатип передаваемого содержимого.','Речь о формате содержимого, а не об адресе ресурса.'),
    q('Что означает ответ 401?', ['Ресурс успешно удалён','Не хватает действительных данных аутентификации','Ресурс перемещён навсегда','Запрос выполнен без содержимого'],1,'401 означает отсутствие подходящих данных аутентификации.','Отличайте проверку личности от успешного ответа.'),
    q('Что означает ответ 403?', ['Запрос обязательно содержит неверный JSON','Ресурс создан','Сервер не распознал HTTP-метод','Сервер понял запрос, но отказывается его выполнять'],3,'403 Forbidden означает отказ сервера выполнить понятый запрос.','Запрос понятен серверу, но выполнение запрещено.'),
    q('Что означает код 404?', ['Представление ресурса не найдено или его наличие не раскрывается','Операция успешно завершена','Сервер ждёт подтверждения оплаты','Ответ содержит перенаправление'],0,'404 сообщает, что представление не найдено либо сервер не раскрывает его наличие.','Вспомните типичный ответ для неизвестного адреса.'),
    q('Какой HTTP-метод запрашивает заголовки ответа без его содержимого?', ['DELETE','POST','HEAD','PATCH'],2,'HEAD похож на GET, но сервер не отправляет содержимое ответа.','Название метода связано с заголовочной частью ответа.'),
    q('Какой метод предназначен для частичного изменения ресурса?', ['GET','PATCH','HEAD','OPTIONS'],1,'PATCH предназначен для частичных изменений ресурса.','Изменяется часть ресурса, а не всё представление.'),
    q('Какой заголовок сообщает поддерживаемые методы в ответе 405?', ['Host','Content-Length','Authorization','Allow'],3,'Allow перечисляет поддерживаемые методы для ресурса.','Ищите список разрешённых методов.'),
    q('Что означает успешный ответ 204?', ['Ответ обязательно содержит JSON','Запрос не прошёл аутентификацию','Запрос успешно выполнен, содержимого ответа нет','Сервер не поддерживает HTTP'],2,'204 No Content означает успех без содержимого ответа.','Статус успешный, но передавать содержимое не требуется.')
  ];
  const sql = [
    q('Какие строки возвращает INNER JOIN?', ['Все строки левой таблицы','Только пары строк, соответствующие условию соединения','Только несовпадающие строки','Все возможные пары без условия'],1,'INNER JOIN оставляет пары, для которых выполняется условие соединения.','Вспомните, что происходит со строкой без совпадения.'),
    q('Что возвращает LEFT JOIN, если справа нет совпадения?', ['Строку слева, а в столбцах справа — NULL','Ни одной строки','Случайную строку справа','Только строку справа'],0,'LEFT JOIN сохраняет строку слева и дополняет правую часть значениями NULL.','LEFT JOIN сохраняет все строки левой стороны.'),
    q('Что делает CROSS JOIN?', ['Удаляет дубликаты','Сортирует строки','Отбирает только равные ключи','Создаёт все комбинации строк двух таблиц'],3,'CROSS JOIN создаёт декартово произведение строк.','У такого соединения нет условия совпадения ключей.')
  ];
  const tasks = [
    {id:'http',title:'Повторить HTTP-методы',topic:'HTTP',questions:http},
    {id:'api',title:'Пройти 10 вопросов по API',topic:'API Testing',questions:api},
    {id:'sql',title:'Разобрать ошибки по SQL JOIN',topic:'SQL',questions:sql}
  ];
  const threshold=70,activeKey='inis.daily.active.v1',stateKey='inis.daily.tasks.v1';
  const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
  const read=(area,key)=>{try{return JSON.parse(window[area].getItem(key));}catch{return null;}};
  const write=(area,key,value)=>{try{window[area].setItem(key,JSON.stringify(value));}catch{}};
  const remove=(area,key)=>{try{window[area].removeItem(key);}catch{}};
  const find=id=>tasks.find(task=>task.id===id);
  const state=()=>{
    const saved=read('localStorage',stateKey),s={day:today(),tasks:{}};
    if(saved?.day===s.day&&saved.tasks&&typeof saved.tasks==='object')tasks.forEach(task=>{const value=saved.tasks[task.id];if(['completed','needs-review'].includes(value?.status)&&Number.isFinite(value.score)&&value.score>=0&&value.score<=100)s.tasks[task.id]=value;});
    return s;
  };
  const getActive=()=>{
    const a=read('localStorage',activeKey),task=find(a?.id);
    if(!task||typeof a.day!=='string'||!Number.isInteger(a.index)||a.index<0||a.index>=task.questions.length||!Array.isArray(a.answers)||a.answers.length!==a.index)return null;
    if(!a.answers.every((value,i)=>Number.isInteger(value)&&value>=0&&value<task.questions[i].options.length))return null;
    if(a.pick!==null&&(!Number.isInteger(a.pick)||a.pick<0||a.pick>=task.questions[a.index].options.length))a.pick=null;
    return a;
  };
  const stop=()=>remove('localStorage',activeKey);
  const begin=(id,force=false)=>{
    const task=find(id);if(!task)return null;
    const old=getActive();if(!force&&old?.id===id&&old.day===today())return old;
    const stage=window.GradeProgress?.state(),a={id,day:today(),index:0,answers:[],pick:null,direction:stage?.direction||null,stageId:stage?.stageId||null};write('localStorage',activeKey,a);
    ['inis.training.draft.v1','inis.training.result.v1','inis.training.hint-return.v1'].forEach(key=>remove('sessionStorage',key));return a;
  };
  const resolve=()=>{const id=new URLSearchParams(location.search).get('daily');return find(id)?begin(id):getActive();};
  const select=pick=>{const a=getActive();if(a){a.pick=pick;write('localStorage',activeKey,a);}};
  const summary=(a,completed)=>{
    const task=find(a.id),correct=a.answers.reduce((sum,pick,i)=>sum+Number(pick===task.questions[i].correct),0);
    const score=Math.round(correct/task.questions.length*100);
    return {direction:a.direction,stageId:a.stageId,id:a.id,title:task.title,day:a.day,completed,score,correct,total:task.questions.length,passed:completed&&score>=threshold,answers:a.answers.map((pick,i)=>({title:task.questions[i].title,answer:task.questions[i].options[pick],correct:pick===task.questions[i].correct,expected:task.questions[i].options[task.questions[i].correct],explanation:task.questions[i].explanation}))};
  };
  const record=(result,early)=>window.Platform?.addHistory({id:`daily-${result.id}-${Date.now()}`,mode:'daily',direction:result.direction,stageId:result.stageId,ids:find(result.id).questions.map((_,i)=>`daily-${result.id}-${i}`),answers:result.answers.map((v,i)=>({...v,id:`daily-${result.id}-${i}`,topic:find(result.id).topic,score:v.correct?100:0,type:'choice'})),score:result.score,total:result.total,early,finishedAt:new Date().toISOString()});
  const finishEarly=()=>{const a=getActive();if(!a)return null;const result=summary(a,false);record(result,true);stop();return result;};
  const submit=pick=>{
    const a=getActive();if(!a)return null;const task=find(a.id);
    if(!Number.isInteger(pick)||pick<0||pick>=task.questions[a.index].options.length)return null;
    a.answers.push(pick);a.index++;a.pick=null;
    if(a.index<task.questions.length){write('localStorage',activeKey,a);return {next:true};}
    const result=summary(a,true);
    if(a.day===today()){const s=state();s.tasks[a.id]={status:result.passed?'completed':'needs-review',score:result.score};write('localStorage',stateKey,s);}
    record(result,false);
    stop();return {next:false,result};
  };
  const pause=()=>{const a=getActive();return a?summary(a,false):null;};
  window.DailyTasks={tasks,threshold,find,getActive,resolve,select,submit,pause,finishEarly,stop,state};
  const setup=()=>{
    const s=state(),active=getActive();
    const status=task=>{const value=s.tasks[task.id];if(value?.status==='completed')return {className:'is-complete',text:`Выполнено · ${value.score}%`};if(value?.status==='needs-review')return {className:'needs-review',text:`Нужно повторить · ${value.score}%`};return {className:'',text:active?.id===task.id&&active.day===today()?'В процессе':'Не выполнено'};};
    const plan=document.getElementById('daily-plan');
    if(plan)plan.innerHTML=tasks.map(task=>{const st=status(task);return `<li><a class="daily-plan-item ${st.className}" href="training.html?daily=${task.id}"><span class="task-state-icon" aria-hidden="true">${st.className==='is-complete'?'✓':st.className==='needs-review'?'!':'›'}</span><span><span class="task-title">${task.title}</span><span class="task-status">${st.text}</span></span></a></li>`;}).join('');
    const list=document.getElementById('daily-task-list');
    if(list){
      const selected=new URLSearchParams(location.search).get('task');
      list.innerHTML=tasks.map(task=>{const st=status(task),resume=active?.id===task.id&&active.day===today();return `<section class="ui-card daily-task ${st.className}${selected===task.id?' is-selected':''}" data-task="${task.id}"><span class="pill">${task.topic}</span><h2>${task.title}</h2><p class="muted">${task.questions.length===10?'10 вопросов':'3 вопроса'} · Выберите один ответ в каждом вопросе</p><p class="task-status">${st.text}</p><a class="form-button" href="training-question-1.html?daily=${task.id}" data-start-daily="${task.id}">${resume?'Продолжить задание':st.className?'Пройти заново':'Начать задание'}</a></section>`;}).join('');
      const count=tasks.filter(task=>s.tasks[task.id]?.status==='completed').length;document.getElementById('daily-count').textContent=`Выполнено ${count} из ${tasks.length}`;document.getElementById('daily-progress').value=count;
      list.querySelectorAll('[data-start-daily]').forEach(link=>link.addEventListener('click',()=>begin(link.dataset.startDaily)));
      if(selected)requestAnimationFrame(()=>list.querySelector(`[data-task="${find(selected)?.id}"]`)?.scrollIntoView({block:'nearest'}));
    }
    const dailyLink=document.getElementById('daily-mode-link'),selected=new URLSearchParams(location.search).get('daily');
    if(dailyLink&&find(selected)){dailyLink.href=`daily-tasks.html?task=${selected}`;dailyLink.classList.add('on');document.querySelectorAll('#modes .tc').forEach(button=>{button.classList.remove('on');button.setAttribute('aria-checked','false');});}
    if(dailyLink)document.getElementById('modes')?.addEventListener('click',()=>dailyLink.classList.remove('on'));
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
  window.addEventListener('pageshow',event=>{if(event.persisted)setup();});
  window.addEventListener('storage',event=>{if(event.key===stateKey)setup();});
})();
