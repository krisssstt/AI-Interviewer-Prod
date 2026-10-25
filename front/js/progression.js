(() => {
 'use strict';const P=window.Platform;if(!P)return;const {store,escape:e}=P;
 const add=(id,topic,title,options,correct,explanation,hint)=>P.questions.push({id,topic,title,options,correct,expected:options[correct],explanation,hint,type:'choice'});
 add('html-semantic','HTML','Для чего нужны семантические элементы HTML?',['Чтобы описать смысл и структуру содержимого','Только для изменения цвета','Для SQL-запросов','Для выполнения Java'],0,'Семантические элементы передают назначение частей документа.','Вспомните назначение main, nav и article.');
 add('html-label','HTML','Как связать label с полем ввода?',['Одинаковым цветом','Через for, совпадающий с id поля','Только через placeholder','Через SQL JOIN'],1,'Атрибут for метки должен совпасть с id поля.','Связь метки и поля задаётся идентификатором.');
 add('html-alt','HTML','Для чего нужен alt у содержательного изображения?',['Для CSS-анимации','Для смены расширения','Для текстовой альтернативы изображению','Для загрузки JavaScript'],2,'alt предоставляет текстовую альтернативу изображению.','Подумайте о пользователе программы чтения с экрана.');
 add('css-box','CSS','Что включает стандартная CSS-модель блока?',['Только width','Содержимое, padding, border и margin','Только margin','Только позиционирование'],1,'Внешний размер зависит от содержимого, внутренних отступов, границ и внешних отступов.','Рассмотрите слои от содержимого к окружающему пространству.');
 add('css-flex','CSS','Для чего подходит Flexbox?',['Для одномерного расположения элементов по строке или столбцу','Для SQL','Только для изображений','Для создания сервера'],0,'Flexbox организует элементы по главной оси с дополнительной поперечной осью.','Сравните расположение в одном направлении и двумерную сетку.');
 add('css-query','CSS','Что позволяет сделать media query?',['Удалить DOM','Заменить HTTP','Применить стили при заданных условиях среды','Изменить тип переменной'],2,'Media queries позволяют учитывать, например, ширину области просмотра.','Подумайте об адаптации к узкому экрану.');
 add('js-const','JavaScript','Что запрещает const?',['Любое изменение объекта','Переназначение переменной','Чтение переменной','Создание массива'],1,'const запрещает переназначение привязки; содержимое объекта может изменяться.','Отличайте привязку переменной и свойства объекта.');
 add('js-promise','JavaScript','Что представляет Promise?',['Результат асинхронной операции, который может появиться позже','Только число','HTML-элемент','CSS-селектор'],0,'Promise представляет будущее успешное или ошибочное завершение операции.','Вспомните состояния pending, fulfilled и rejected.');
 add('js-equality','JavaScript','Чем === отличается от ==?',['Сравнивает только строки','Всегда возвращает true','Не выполняет приведение типов при сравнении','Изменяет аргументы'],2,'Строгое равенство не приводит операнды к одному типу.','Сравните 1 и строку "1".');
 add('stats-mean','Статистика','Чему равно среднее значений 2, 4 и 9?',['3','5','9','15'],1,'Сумма равна 15, количество значений — 3; среднее равно 5.','Сложите значения и разделите на их количество.');
 add('stats-median','Статистика','Какова медиана набора 1, 2, 100?',['1','2','100','103/3'],1,'После сортировки медиана — центральное значение: 2.','Среднее и медиана — разные показатели.');
 add('stats-outlier','Статистика','Какой показатель обычно менее чувствителен к одиночному выбросу?',['Медиана','Среднее','Сумма','Максимум'],0,'Медиана определяется центральной позицией отсортированных значений.','Подумайте, изменится ли центральная позиция при росте крайнего значения.');
 add('python-list','Python','Чем список отличается от кортежа?',['Список изменяемый, кортеж неизменяемый','Они оба всегда неизменяемые','Кортеж хранит только числа','Список нельзя перебрать'],0,'Список можно изменять; кортеж не допускает изменения своей структуры.','Сравните операции добавления и замены элементов.');
 add('python-dict','Python','Для чего используют dict?',['Для CSS','Для сопоставления ключей значениям','Только для чисел','Для замены HTTP'],1,'Словарь хранит пары ключ—значение.','Нужен быстрый поиск значения по ключу.');
 add('python-set','Python','Какое свойство есть у set?',['Хранит только строки','Всегда упорядочен по индексу','Хранит уникальные элементы','Не поддерживает проверку наличия'],2,'Множество исключает повторяющиеся элементы.','Подумайте об удалении дубликатов.');
 add('data-quality','Качество данных','Как проверить дубли ключа в SQL?',['GROUP BY ключ и HAVING COUNT(*) > 1','ORDER BY без группировки','DELETE без WHERE','Только LIMIT'],0,'Группировка и подсчёт позволяют найти ключи с несколькими строками.','Проверьте количество строк для каждого ключа.');
 add('data-null','Качество данных','Что нужно сделать с отсутствующими значениями перед анализом?',['Всегда заменить нулём','Оценить их причину и долю, выбрать обоснованный способ обработки','Игнорировать требования','Всегда удалить всю таблицу'],1,'Обработка пропусков зависит от значения данных и цели анализа.','Ноль и отсутствие значения не всегда означают одно и то же.');
 add('sql-count','SQL','Чем COUNT(column) отличается от COUNT(*)?',['COUNT(column) не считает NULL в указанном столбце','Всегда одинаковы','COUNT(*) удаляет строки','COUNT(column) сортирует'],0,'COUNT(*) считает строки, COUNT(column) — ненулевые значения столбца.','Вспомните поведение агрегатов с NULL.');
 const directions={
  'QA Engineer':{topics:['HTTP','Тест дизайн','API Testing','SQL','Docker','Java'],diagnostic:['http-get','test-boundary','q1','sql-left','test-partition','api-auth']},
  'Backend Developer':{topics:['HTTP','API Testing','SQL','Docker','Java'],diagnostic:['http-idempotent','api-content','sql-group','docker-volume','java-equals','sql-null']},
  'Frontend Developer':{topics:['HTML','CSS','JavaScript','HTTP','API Testing','Тест дизайн'],diagnostic:['html-semantic','html-label','css-box','css-flex','js-const','js-promise']},
  'Data Analyst':{topics:['SQL','Статистика','Python','Качество данных','HTTP','Docker'],diagnostic:['sql-count','sql-left','stats-median','stats-mean','python-dict','data-quality']}
 };
 const levels=['Intern','Junior','Middle','Senior'],key='inis.progression.v3';
 const state=()=>{const s=store.get(key);return s&&directions[s.direction]&&typeof s.stageId==='string'?s:null;};
 const chooseDirection=direction=>{if(!directions[direction])return false;store.set(key,{direction,grade:null,stageId:crypto.randomUUID(),stageStartedAt:new Date().toISOString(),baselineCompleted:false,completedStages:[]});const p=store.get('inis.profile.v2',{});store.set('inis.profile.v2',{...p,specialization:direction,grade:'Не определён'});return true;};
 const requirements=()=>{
  const s=state();if(!s?.baselineCompleted)return {ready:false,next:null,steps:[]};const next=levels[levels.indexOf(s.grade)+1];if(!next)return {ready:false,next:null,steps:[]};
  const scope=P.history().filter(r=>r.direction===s.direction&&r.stageId===s.stageId&&!r.early&&['quick','topic','full','daily'].includes(r.mode));
  const topics=(window.GradeProgress.currentTrack(s)?.topics||directions[s.direction].topics).slice(0,s.grade==='Intern'?3:s.grade==='Junior'?4:6),passed=topics.filter(t=>scope.some(r=>r.mode==='topic'&&r.topic===t&&r.score>=80));
  const practice=scope.filter(r=>r.score>=70).length,target=s.grade==='Middle'?10:5,full=scope.filter(r=>r.mode==='full'&&r.score>=80).length,fullTarget=s.grade==='Middle'?2:1;
  const steps=[{title:'Закрепить темы',description:`Не менее 80% в тематическом тесте по каждой теме: ${topics.join(', ')}.`,count:passed.length,total:topics.length,done:passed.length===topics.length},{title:'Регулярная практика',description:'Завершённые тренировки с результатом не менее 70%.',count:Math.min(practice,target),total:target,done:practice>=target},{title:'Полная симуляция',description:'Самостоятельные ответы с результатом не менее 80%.',count:Math.min(full,fullTarget),total:fullTarget,done:full>=fullTarget}];return {ready:steps.every(x=>x.done),next,steps,topics};
 };
 const assessmentIds=mode=>{const s=state();if(!s)return [];if(mode==='diagnostic')return window.GradeProgress.currentTrack(s)?.diagnostic||directions[s.direction].diagnostic;if(mode==='gradecheck'&&requirements().ready){const topics=requirements().topics;return topics.map(t=>P.questions.filter(q=>q.topic===t).at(-1)?.id).filter(Boolean);}return [];};
 const accept=result=>{
  const s=state();if(!s||result.direction!==s.direction||result.stageId!==s.stageId||result.early)return;
  if(result.mode==='diagnostic'&&!s.baselineCompleted){s.grade=result.score>=83?'Middle':result.score>=50?'Junior':'Intern';s.baselineCompleted=true;s.diagnosticId=result.id;s.completedStages=[{kind:'diagnostic',grade:s.grade,date:result.finishedAt}];}
  else if(result.mode==='gradecheck'&&result.score>=80&&requirements().ready){const next=requirements().next;s.completedStages??=[];s.completedStages.push({kind:'promotion',grade:s.grade,next,date:result.finishedAt});s.grade=next;}else return;
  s.stageId=crypto.randomUUID();s.stageStartedAt=new Date().toISOString();store.set(key,s);const p=store.get('inis.profile.v2',{});store.set('inis.profile.v2',{...p,grade:s.grade,specialization:s.direction});result.assignedGrade=s.grade;result.nextGrade=levels[levels.indexOf(s.grade)+1]||null;store.set('inis.result.v2',result);const h=P.history();const i=h.findIndex(r=>r.id===result.id);if(i>=0){h[i]=result;store.set('inis.history.v2',h);}
 };
 window.GradeProgress={state,chooseDirection,requirements,assessmentIds,accept,directions,levels};
 P.modes.diagnostic='Определение грейда';P.modes.gradecheck='Тест на следующий грейд';
 const previousPlan=P.planTopics;
 P.planTopics=()=>{const s=state();if(!s)return previousPlan();const list=(window.GradeProgress.currentTrack(s)?.topics||directions[s.direction].topics),scope=P.history().filter(r=>r.direction===s.direction&&(s.grade==='Senior'||r.stageId===s.stageId)&&!r.early),firstIncomplete=list.findIndex(name=>!scope.some(r=>r.mode==='topic'&&r.topic===name&&r.score>=80));return list.map((name,i)=>({name,description:`${window.GradeProgress.pathLabel()} · ${s.grade||'Стартовая диагностика'}${requirements().next?' → '+requirements().next:''}`,status:scope.some(r=>r.mode==='topic'&&r.topic===name&&r.score>=80)?'done':i<=Math.max(0,firstIncomplete)?'current':'future'}));};
 const oldAdd=P.addHistory;P.addHistory=result=>{const s=state();if(s){result.direction??=s.direction;result.stageId??=s.stageId;}oldAdd(result);accept(result);};
 const sources={
  HTTP:{title:'RFC 9110 — HTTP Semantics',url:'https://www.rfc-editor.org/rfc/rfc9110.html'},
  'API Testing':{title:'RFC 9110 — HTTP Semantics',url:'https://www.rfc-editor.org/rfc/rfc9110.html'},
  SQL:{title:'PostgreSQL — Queries',url:'https://www.postgresql.org/docs/current/queries.html'},
  'Тест дизайн':{title:'ISTQB — Glossary',url:'https://glossary.istqb.org/'},
  Docker:{title:'Docker — Container concepts',url:'https://docs.docker.com/get-started/docker-concepts/the-basics/what-is-a-container/'},
  Java:{title:'Java SE 21 — String',url:'https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/lang/String.html'},
  HTML:{title:'MDN — HTML',url:'https://developer.mozilla.org/en-US/docs/Web/HTML'},
  CSS:{title:'MDN — CSS',url:'https://developer.mozilla.org/en-US/docs/Web/CSS'},
  JavaScript:{title:'MDN — JavaScript Guide',url:'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide'},
  'Статистика':{title:'Python — statistics',url:'https://docs.python.org/3/library/statistics.html'},
  Python:{title:'Python — Built-in Types',url:'https://docs.python.org/3/builtins/stdtypes.html'},
  'Качество данных':{title:'Локальная база — качество данных',url:'kb-case.html?case=data'}
 };
 P.sourcesFor=q=>{
  if(q?.id==='log-task')return [{title:'Учебный кейс — журнал API',url:'kb-case.html?case=logs'}];
  if(q?.id==='q2'||q?.id==='sql-left')return [{title:'PostgreSQL — Joins Between Tables',url:'https://www.postgresql.org/docs/current/tutorial-join.html'}];
  if(q?.id==='q4')return [{title:'Mockito — Documentation',url:'https://site.mockito.org/'}];
  if(q?.id==='q1'||/PUT.*PATCH/.test(q?.title||''))return [sources.HTTP,{title:'RFC 5789 — PATCH',url:'https://www.rfc-editor.org/rfc/rfc5789.html'}];
  return [sources[q?.topic]||sources.HTTP];
 };
 P.sourceHTML=(q,cls='answer-source')=>`<p class="${cls}">Источник: ${P.sourcesFor(q).map(s=>`<a href="${e(s.url)}" ${s.url.startsWith('https:')?'target="_blank" rel="noopener noreferrer"':''}>${e(s.title)}</a>`).join(' · ')}</p>`;
 const rubrics={q1:[['пол','цел','замен'],['част','patch']], 'http-get':[['get','гет']], 'http-idempotent':[['повтор'],['эффект','результат']], 'http-head':[['head','хед']], 'http-options':[['options','возможност']], 'http-safe':[['get','гет']], 'http-delete':[['delete','делит']], 'api-created':[['201']], 'api-content':[['content-type']], 'api-auth':[['401']], 'api-empty':[['204','содержим']],q2:[['совпад','услов','соответств']], 'sql-left':[['лев','слева'],['null']], 'sql-null':[['is null']], 'sql-group':[['груп'],['после','агрег']], 'test-boundary':[['0'],['100'],['101']], 'test-partition':[['груп','класс'],['представ','значен']], 'test-regression':[['измен'],['ранее','работ','побоч']], 'test-smoke':[['основ','баз'],['работ','сборк']],q3:[['шаблон','сло'],['экземпляр']], 'docker-volume':[['данн'],['сохран','вне','независ']], 'docker-port':[['8080'],['80'],['хост']],q4:[['подмен','mock','мок'],['тест']], 'java-equals':[['содержим','значен']]};
 P.openQuestion=q=>q.type==='choice'?{...q,type:'text',rubric:rubrics[q.id]||[[q.expected.toLowerCase()]],title:q.title.replace('Какой ответ связан','Какой статус связан')}:q;
})();
(() => {
 const P=window.Platform;if(!P)return;
 P.practical.push(
 {id:'html-practice',topic:'HTML',type:'code',title:'Напишите доступное поле email',context:'Создайте label и input type="email" с обязательным заполнением. Свяжите метку с полем.',expected:'<label for="email">Email</label>\n<input id="email" type="email" required>',explanation:'Метка связана через for/id; type=email задаёт проверку формата, required — обязательность.',hint:'Свяжите for с id и используйте подходящий type.',rubric:[['label'],['for=','for ='],['id=','id ='],['email'],['required']]},
 {id:'js-practice',topic:'JavaScript',type:'code',title:'Найдите ошибку сравнения',context:'const value = "1";\nif (value == 1) {\n  console.log("same type and value");\n}',expected:'== приводит типы, поэтому условие истинно для строки "1" и числа 1. Чтобы сравнить тип и значение, используйте ===.',explanation:'Строгое равенство не выполняет приведение типов.',hint:'Разделите сравнение с приведением типов и строгое сравнение.',rubric:[['прив','coerc'],['тип','type'],['===']]},
 {id:'python-practice',topic:'Python',type:'code',title:'Найдите ошибку в обработке списка',context:'values = [1, 1, 2, 3]\nfor value in values:\n    if value == 1:\n        values.remove(value)\nprint(values)',expected:'Удаление элементов во время обхода меняет индексы и может пропустить соседний элемент. Создайте новый список: values = [v for v in values if v != 1].',explanation:'Не меняйте список, по которому в тот же момент идёт обход; используйте фильтрацию в новый список.',hint:'Проверьте изменение индексов после удаления элемента.',rubric:[['обход','итера','iteration','индекс'],['спис','list'],['нов','[','filter','фильтр']]}
 );
})();
