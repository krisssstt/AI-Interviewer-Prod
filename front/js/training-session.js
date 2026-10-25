(() => {
  'use strict';

  const DRAFT_KEY = 'inis.training.draft.v1';
  const RESULT_KEY = 'inis.training.result.v1';
  const RETURN_KEY = 'inis.training.hint-return.v1';
  const MAX_LENGTH = 1000;

  // Storage can be unavailable in private mode or when opening local files.
  const storage = {
    get(key) {
      try { return JSON.parse(sessionStorage.getItem(key)); }
      catch { return null; }
    },
    set(key, value) {
      try { sessionStorage.setItem(key, JSON.stringify(value)); }
      catch { /* The form remains usable without storage. */ }
    },
    remove(key) {
      try { sessionStorage.removeItem(key); }
      catch { /* Storage is optional for navigation. */ }
    }
  };

  const header = `
    <header class="app-header">
      <button class="header-action" type="button" data-open-menu aria-label="Открыть меню" aria-haspopup="dialog" aria-controls="side-menu">
        <img src="../images/icons/ic-menu.svg" alt="">
      </button>
      <h1>Симуляция интервью</h1>
      <a class="header-action" href="profile-4.html" aria-label="Уведомления">
        <img src="../images/icons/ic-bell.svg" alt="">
      </a>
    </header>`;

  const simulationHeader = `
    <header class="app-header">
      <span class="header-action" aria-hidden="true"></span>
      <h1>Симуляция интервью</h1>
      <button class="header-action" id="finish-session" type="button" aria-label="Выйти из симуляции" title="Выйти из симуляции" aria-haspopup="dialog" aria-controls="exit-dialog">
        <img src="../images/icons/ic-close.svg" alt="">
      </button>
    </header>`;

  const question = new URLSearchParams(location.search).has('daily') ? document.querySelector('[data-training-question]') : null;
  if (question) {
    const daily = window.DailyTasks?.resolve();
    const dailyTask = daily && window.DailyTasks.find(daily.id);
    const dailyQuestion = dailyTask?.questions[daily.index];
    question.innerHTML = `${simulationHeader}
      <div id="question-content">
        <div class="session-context">
        <div class="question-meta"><p>QA Engineer · Middle</p><p>Вопрос 3 из 10</p></div>
        <div class="question-progress" role="progressbar" aria-label="Прогресс сессии" aria-valuemin="0" aria-valuemax="10" aria-valuenow="3"></div>
        <p class="question-rag"><img src="../images/icons/ic-sparkle.svg" alt=""><span>RAG-контекст подключен</span></p>
        </div>
        <section class="question-card" aria-labelledby="question-title">
          <div class="question-card-meta"><p class="question-tag">API Testing</p><p class="question-time"><img src="../images/icons/ic-clock.svg" alt=""><time datetime="PT1M42S">01:42</time></p></div>
          <h2 id="question-title">Чем отличаются методы PUT и PATCH?</h2>
          <p class="question-instructions">Ответьте так, как на реальном собеседовании.</p>
          <div class="question-separator" aria-hidden="true"></div>
          <a class="question-hint" id="hintb" href="training-question-2.html" aria-haspopup="dialog">
            <img src="../images/icons/ic-bulb.svg" alt="">Получить подсказку
          </a>
        </section>
        <form class="answer-form" id="answer-form" action="training-results.html" novalidate>
          <label class="answer-label" for="ans">Ваш ответ</label>
          <textarea class="answer-input" id="ans" name="answer" required maxlength="1000" aria-describedby="answer-count answer-error" placeholder="Введите ответ или нажмите на микрофон для голосового ввода..."></textarea>
          <div class="answer-tools">
          <p class="answer-counter" id="answer-count"><span id="cnt">0</span>/1000</p>
          <button class="answer-mic" type="button" id="micb" aria-label="Голосовой ввод" aria-pressed="false"><img src="../images/icons/ic-mic.svg" alt=""></button>
          </div>
          <button class="answer-submit" type="submit" id="sendb"><img src="../images/icons/ic-plane.svg" alt="">Отправить ответ</button>
          <p class="answer-error" id="answer-error" role="alert" hidden></p>
        </form>
        <p class="session-status" id="session-status" role="status"></p>
      </div>`;

    const answer = document.getElementById('ans');
    const counter = document.getElementById('cnt');
    const error = document.getElementById('answer-error');
    const status = document.getElementById('session-status');
    const form = document.getElementById('answer-form');
    const hintLink = document.getElementById('hintb');
    const draft = storage.get(DRAFT_KEY);
    if (!dailyQuestion && typeof draft?.answer === 'string') answer.value = draft.answer.slice(0, MAX_LENGTH);

    if (dailyQuestion) {
      question.classList.add('daily-session');
      question.querySelector('.app-header h1').textContent = 'Ежедневные задания';
      question.querySelector('#finish-session').setAttribute('aria-label','Выйти из задания');
      question.querySelector('.question-meta p').textContent = dailyTask.topic;
      question.querySelector('.question-meta p:last-child').textContent = `Вопрос ${daily.index+1} из ${dailyTask.questions.length}`;
      const progress = question.querySelector('.question-progress');
      progress.setAttribute('aria-label','Прогресс задания');progress.setAttribute('aria-valuemax',dailyTask.questions.length);progress.setAttribute('aria-valuenow',daily.index);
      progress.style.setProperty('--question-progress',`${daily.index/dailyTask.questions.length*100}%`);
      question.querySelector('.question-rag span').textContent = 'Ежедневное задание';
      question.querySelector('.question-tag').textContent = dailyTask.topic;
      question.querySelector('.question-time').hidden = true;
      question.querySelector('#question-title').textContent = dailyQuestion.title;
      question.querySelector('.question-instructions').textContent = 'Выберите один верный ответ.';
      answer.hidden = true;answer.required = false;
      question.querySelector('.answer-label').hidden = true;question.querySelector('.answer-tools').hidden = true;
      const options = document.createElement('fieldset');options.className='daily-answer-options';
      const legend=document.createElement('legend');legend.className='answer-label';legend.textContent='Выберите ответ';options.append(legend);
      dailyQuestion.options.forEach((text,i)=>{
        const label=document.createElement('label');label.className='daily-answer-choice';
        const input=document.createElement('input');input.type='radio';input.name='daily-answer';input.value=String(i);input.checked=daily.pick===i;
        const span=document.createElement('span');span.textContent=text;label.append(input,span);options.append(label);
        input.addEventListener('change',()=>{window.DailyTasks.select(i);answer.value=text;setError('');});
      });
      form.prepend(options);
      if(daily.pick!==null)answer.value=dailyQuestion.options[daily.pick];else answer.value='';
      form.querySelector('#sendb').lastChild.textContent = daily.index===dailyTask.questions.length-1 ? ' Завершить задание' : ' Следующий вопрос';
      hintLink.href=`training-question-2.html?daily=${daily.id}`;
      const hintsEnabled=window.Platform?.store.get('inis.training.options.v2',{hints:true})?.hints!==false;if(!hintsEnabled){hintLink.hidden=true;question.querySelector('.question-rag').hidden=true;}
    }

    const setError = message => {
      error.textContent = message;
      error.hidden = !message;
      answer.setAttribute('aria-invalid', String(Boolean(message)));
      answer.setCustomValidity(message);
    };

    const saveDraft = () => {
      counter.textContent = answer.value.length;
      if(dailyQuestion)return;
      storage.set(DRAFT_KEY, {
        answer: answer.value,
        selectionStart: answer.selectionStart,
        selectionEnd: answer.selectionEnd
      });
    };

    const updateAnswer = () => {
      saveDraft();
      if (answer.value.length > MAX_LENGTH) setError('Ответ должен содержать не более 1000 символов.');
      else if (answer.value.trim()) setError('');
    };

    counter.textContent = answer.value.length;
    answer.addEventListener('input', updateAnswer);
    answer.addEventListener('blur', saveDraft);
    window.addEventListener('pagehide', saveDraft);
    answer.addEventListener('keydown', event => {
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        form.requestSubmit();
      }
    });

    let recognition = null;
    let listening = false;
    const mic = document.getElementById('micb');
    const stopListening = () => {
      if (recognition && listening) recognition.stop();
    };

    form.addEventListener('submit', event => {
      event.preventDefault();
      if (dailyQuestion) {
        const selected=form.querySelector('input[name="daily-answer"]:checked');
        if(!selected){setError('Выберите один ответ.');form.querySelector('input[name="daily-answer"]').focus();return;}
        const outcome=window.DailyTasks.submit(Number(selected.value));
        if(!outcome)return;
        stopListening();
        if(outcome.next){window.location.assign(`training-question-1.html?daily=${daily.id}`);return;}
        storage.set(RESULT_KEY,{answer:answer.value,submitted:true,daily:outcome.result});
        window.location.assign('training-results.html');return;
      }
      if (!answer.value.trim()) {
        setError('Введите ответ: поле не может быть пустым.');
        answer.focus();
        return;
      }
      if (answer.value.length > MAX_LENGTH) {
        setError('Ответ должен содержать не более 1000 символов.');
        answer.focus();
        return;
      }
      stopListening();
      saveDraft();
      storage.set(RESULT_KEY, { answer: answer.value.trim(), submitted: true });
      window.location.assign('training-results.html');
    });

    const exitTrigger = document.getElementById('finish-session');
    const exitDialog = document.createElement('dialog');
    exitDialog.id = 'exit-dialog';
    exitDialog.className = 'session-exit-dialog';
    exitDialog.setAttribute('aria-labelledby', 'exit-title');
    exitDialog.setAttribute('aria-describedby', 'exit-description');
    exitDialog.innerHTML = `
      <h2 id="exit-title">Завершить симуляцию?</h2>
      <p id="exit-description">Текущий ответ сохранится. Вы перейдёте к итогам сессии.</p>
      <div class="exit-actions">
        <button class="form-button secondary" id="cancel-exit" type="button" autofocus>Продолжить интервью</button>
        <button class="form-button" id="confirm-exit" type="button">Завершить</button>
      </div>`;
    if(dailyQuestion){exitDialog.querySelector('#exit-title').textContent='Выйти из задания?';exitDialog.querySelector('#exit-description').textContent='Прогресс сохранится. Задание можно продолжить позже.';exitDialog.querySelector('#cancel-exit').textContent='Продолжить задание';exitDialog.querySelector('#confirm-exit').textContent='Завершить досрочно';const pause=document.createElement('button');pause.type='button';pause.className='form-button secondary';pause.textContent='Сохранить и выйти';pause.addEventListener('click',()=>{stopListening();window.location.assign('main.html');});exitDialog.querySelector('.exit-actions').prepend(pause);}
    document.body.append(exitDialog);
    exitTrigger.addEventListener('click', () => {
      stopListening();
      saveDraft();
      exitDialog.showModal();
    });
    exitDialog.querySelector('#cancel-exit').addEventListener('click', () => exitDialog.close());
    exitDialog.addEventListener('close', () => exitTrigger.focus({ preventScroll: true }));
    exitDialog.addEventListener('click', event => {
      if (event.target !== exitDialog) return;
      const rect = exitDialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) exitDialog.close();
    });
    exitDialog.querySelector('#confirm-exit').addEventListener('click', () => {
      stopListening();
      saveDraft();
      storage.set(RESULT_KEY, { answer: answer.value.trim(), submitted: false, ...(dailyQuestion ? {daily:window.DailyTasks.finishEarly()} : {}) });
      if(dailyQuestion)window.DailyTasks.stop();
      window.location.assign('training-results.html');
    });

    hintLink.addEventListener('click', () => {
      stopListening();
      saveDraft();
      storage.set(RETURN_KEY, true);
    });

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    mic.addEventListener('click', () => {
      if (!SpeechRecognition) {
        status.textContent = 'Голосовой ввод недоступен в этом браузере. Введите ответ с клавиатуры.';
        answer.focus();
        return;
      }
      if (listening) { stopListening(); return; }
      recognition = new SpeechRecognition();
      recognition.lang = 'ru-RU';
      recognition.interimResults = false;
      recognition.continuous = false;
      recognition.onstart = () => {
        listening = true;
        mic.setAttribute('aria-pressed', 'true');
        status.textContent = 'Слушаю… Нажмите на микрофон, чтобы остановить запись.';
      };
      recognition.onresult = event => {
        const text = event.results[event.resultIndex][0].transcript;
        const separator = answer.value && !/\s$/.test(answer.value) ? ' ' : '';
        const next = answer.value + separator + text;
        answer.value = next.slice(0, MAX_LENGTH);
        updateAnswer();
        status.textContent = next.length > MAX_LENGTH
          ? 'Достигнут лимит 1000 символов. Проверьте распознанный ответ.'
          : 'Голосовой ввод завершён. Проверьте распознанный ответ.';
      };
      recognition.onerror = event => {
        status.textContent = event.error === 'not-allowed'
          ? 'Доступ к микрофону не разрешён. Введите ответ с клавиатуры.'
          : 'Не удалось распознать речь. Попробуйте ещё раз или введите ответ с клавиатуры.';
      };
      recognition.onend = () => {
        listening = false;
        mic.setAttribute('aria-pressed', 'false');
        if (status.textContent.startsWith('Слушаю')) status.textContent = 'Запись остановлена.';
      };
      try { recognition.start(); }
      catch { status.textContent = 'Не удалось включить микрофон. Введите ответ с клавиатуры.'; }
    });

    if (question.dataset.trainingQuestion === 'hint' && !hintLink.hidden) {
      const overlay = document.createElement('div');
      overlay.className = 'hint-overlay';
      overlay.innerHTML = `
        <div class="hint-highlight" aria-hidden="true"><img src="../images/icons/ic-bulb.svg" alt="">Получить подсказку</div>
        <section class="hint-dialog" role="dialog" aria-modal="true" aria-labelledby="hint-title" aria-describedby="hint-copy">
          <h2 class="hint-heading" id="hint-title"><img src="../images/icons/ic-rag-hint.svg" alt="">RAG-подсказки</h2>
          <p class="hint-copy" id="hint-copy">Если вопрос вызывает затруднения, нажмите сюда. Система подберёт ориентир из базы знаний, не раскрывая готовый ответ.</p>
          <a class="hint-dismiss" href="training-question-1.html">Понятно</a>
        </section>`;
      question.append(overlay);
      if(dailyQuestion)overlay.querySelector('#hint-copy').textContent=dailyQuestion.hint;
      const dismiss = overlay.querySelector('.hint-dismiss');
      // Returning through history preserves the draft, focus and scroll position.
      const closeHint = event => {
        event?.preventDefault();
        const fromQuestion = document.referrer && new URL(document.referrer).pathname.endsWith('/training-question-1.html');
        if (fromQuestion && storage.get(RETURN_KEY) && window.history.length > 1) window.history.back();
        else window.location.replace(dailyQuestion ? `training-question-1.html?daily=${daily.id}` : 'training-question-1.html');
      };
      const background = document.getElementById('question-content');
      background.inert = true;
      question.querySelector('.app-header').inert = true;
      dismiss.addEventListener('click', closeHint);
      overlay.addEventListener('click', event => {
        if (event.target === overlay) closeHint(event);
      });
      overlay.addEventListener('keydown', event => {
        if (event.key === 'Escape') closeHint(event);
        if (event.key === 'Tab') { event.preventDefault(); dismiss.focus(); }
      });
      dismiss.focus({ preventScroll: true });
    } else {
      window.addEventListener('pageshow', () => {
        if (!storage.get(RETURN_KEY)) return;
        storage.remove(RETURN_KEY);
        const saved = storage.get(DRAFT_KEY);
        if (typeof saved?.answer === 'string') answer.value = saved.answer.slice(0, MAX_LENGTH);
        counter.textContent = answer.value.length;
        answer.setSelectionRange(saved?.selectionStart || 0, saved?.selectionEnd || 0);
        hintLink.focus({ preventScroll: true });
      });
    }
  }

  const results = document.querySelector('[data-training-results]');
  if (results) {
    document.getElementById('session-header-slot').innerHTML = header;
    const overlay = document.getElementById('review-overlay');
    const trigger = document.getElementById('review-answers');
    const close = document.getElementById('close-review');
    const result = storage.get(RESULT_KEY);
    if(result?.daily){
      const daily=result.daily;
      results.querySelector('.app-header h1').textContent='Ежедневные задания';
      results.querySelector('.results-title').textContent=daily.completed?'Итоги ежедневного задания':'Задание завершено досрочно';
      const score=results.querySelector('.results-score');score.querySelector('span').textContent=`${daily.score}%`;
      score.setAttribute('aria-label',daily.completed?`Результат задания: ${daily.score} процентов`:`Решено ${daily.answers.length} из ${daily.total}`);
      score.style.background=`conic-gradient(var(--meter-fill) ${daily.score}%, var(--meter-track) 0)`;
      const resultIsToday=daily.day===window.DailyTasks.state().day;
      results.querySelector('.results-caption').textContent=daily.completed&&!resultIsToday?`Задание за ${daily.day} завершено. Сегодня доступен новый план.`:daily.completed?(daily.passed?'Задание выполнено. Пункт отмечен в плане на сегодня.':'Нужно повторить. Пункт выделен в плане на сегодня.'):'Досрочное завершение не отмечает задание выполненным. Можно начать новую попытку.';
      const skills=results.querySelector('.results-skills');skills.replaceChildren();
      const row=document.createElement('div');row.className='result-skill';const name=document.createElement('dt');name.textContent=daily.title;const value=document.createElement('dd');value.textContent=`${daily.correct} / ${daily.total}`;const bar=document.createElement('progress');bar.max=daily.total;bar.value=daily.correct;bar.setAttribute('aria-label',`Верных ответов: ${daily.correct} из ${daily.total}`);row.append(name,value,bar);skills.append(row);
      results.querySelector('#recommendation-title').textContent='Рекомендация';
      results.querySelector('.results-recommendation p').textContent=daily.completed?(daily.passed?'Продолжайте с оставшимися заданиями. В разборе можно проверить каждый ответ.':'Откройте разбор ответов, повторите слабые темы и пройдите задание заново. Для выполнения нужно не менее 70%.'):'Досрочное завершение не отмечает задание выполненным. Начните новую попытку.';
      const link=results.querySelector('.results-analytics');link.href=`daily-tasks.html?task=${daily.id}`;link.textContent=daily.completed?'К ежедневным заданиям':'Начать задание заново';
      const home=document.createElement('a');home.href='main.html';home.className='form-button secondary';home.textContent='К плану на сегодня';link.after(home);
      const review=document.getElementById('review-dialog');const title=document.createElement('h2');title.id='review-title';title.textContent='Разбор задания';const reviewStatus=document.createElement('p');reviewStatus.id='review-status';reviewStatus.textContent=`Верных ответов: ${daily.correct} из ${daily.total}`;
      const lastAnswer=document.createElement('p');lastAnswer.id='review-answer';lastAnswer.textContent=result.answer||'Ответ не был отправлен.';lastAnswer.hidden=true;
      review.replaceChildren(title,reviewStatus,lastAnswer);
      if(!daily.answers.length){const empty=document.createElement('p');empty.textContent='Ещё нет отправленных ответов.';review.append(empty);}
      daily.answers.forEach((item,i)=>{const group=document.createElement('section');group.className='daily-review-item';const heading=document.createElement('h3');heading.textContent=`${i+1}. ${item.title}`;const answer=document.createElement('p');answer.textContent=`${item.correct?'✓':'!'} Ваш ответ: ${item.answer}`;const expected=document.createElement('p');expected.textContent=`Верный ответ: ${item.expected}`;const detail=document.createElement('p');detail.textContent=item.explanation;group.append(heading,answer,expected,detail);review.append(group);});
      review.append(close);
    }
    // User input is always inserted as text, never interpreted as HTML.
    document.getElementById('review-answer').textContent = result?.answer || 'Ответ не был отправлен.';
    if(!result?.daily)document.getElementById('review-status').textContent = result?.submitted
      ? 'Ответ отправлен.'
      : 'Сессия завершена без отправки ответа.';
    const content = document.getElementById('results-content');
    const setReview = open => {
      overlay.hidden = !open;
      content.inert = open;
      document.getElementById('session-header-slot').inert = open;
      results.querySelector('.app-nav').inert = open;
      (open ? close : trigger).focus({ preventScroll: true });
    };
    trigger.addEventListener('click', () => setReview(true));
    close.addEventListener('click', () => setReview(false));
    overlay.addEventListener('click', event => {
      if (event.target === overlay) setReview(false);
    });
    overlay.addEventListener('keydown', event => {
      if (event.key === 'Escape') setReview(false);
      if(event.key==='Tab'){const focusable=[...overlay.querySelectorAll('a[href],button')].filter(x=>!x.disabled);const first=focusable[0],last=focusable.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}
    });
  }

  // A fresh training starts a fresh draft; navigating back from the hint does not.
  document.querySelectorAll('a[href="training-question-1.html"]').forEach(link => {
    if (question || results) return;
    link.addEventListener('click', () => {
      window.DailyTasks?.stop();
      storage.remove(DRAFT_KEY);
      storage.remove(RESULT_KEY);
      storage.remove(RETURN_KEY);
    });
  });
})();
