(() => {
  'use strict';
  const setup = () => {
    const root = document.querySelector('.app-shell');
    if (!root || root.matches('[data-training-question]')) return;
    const readKey = 'inis.notifications.read.v1', settingsKey = 'inis.notifications.settings.v1';
    const readJSON = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
    const saveJSON = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } };
    const guides = [
      {id:'results',icon:'ic-nav-chart.svg',title:'Начните первую тренировку',text:'Выберите режим, ответьте на вопросы и получите разбор результатов.',time:'Подготовка к интервью',href:'training.html'},
      {id:'plan',icon:'ic-nav-chat.svg',title:'Персональный план готов',text:'Посмотрите пройденные, текущие и будущие темы в полном плане подготовки.',time:'Персональный план',href:'main.html?plan=open#personal-plan'},
      {id:'knowledge',icon:'ic-nav-books.svg',title:'Повторите API Testing',text:'Освежите знания о HTTP-методах перед следующей тренировкой.',time:'База знаний',href:'kb-2.html'}
    ];
    const savedEntries=readJSON('inis.notifications.entries.v2',[]);
    const entries=[...guides,...(Array.isArray(savedEntries)?savedEntries:[])].filter(item=>item&&typeof item.id==='string'&&/^ic-[a-z-]+\.svg$/.test(item.icon)&&/^(training-results|training|main|kb-[12])\.html(?:[?#].*)?$/.test(item.href));
    const esc=window.Platform?.escape||String;
    const panel = document.createElement('dialog');panel.id='notification-panel';panel.className='notification-panel';panel.setAttribute('aria-labelledby','notification-panel-title');
    panel.innerHTML=`<div class="notification-panel-heading"><h2 id="notification-panel-title">Оповещения</h2><a class="icon-button" href="notification-settings.html" aria-label="Настройки оповещений" title="Настройки оповещений"><img src="../images/icons/ic-m-gear.svg" alt=""></a><button class="icon-button" type="button" data-close-notifications aria-label="Закрыть оповещения"><img src="../images/icons/ic-close.svg" alt=""></button></div>
      <div class="notification-panel-body"><div class="notifications-toolbar"><p class="muted" id="notifications-count" role="status"></p><button class="text-button" type="button" id="read-all-notifications">Прочитать все</button></div><ul class="notification-list" aria-label="Оповещения">${entries.map(item=>`<li><a class="notification-item ui-card" data-notification="${esc(item.id)}" href="${esc(item.href)}"><div class="notification-heading"><img src="../images/icons/${esc(item.icon)}" alt=""><div><h3>${esc(item.title)}</h3><p class="muted">${esc(item.time)}</p></div><span class="unread-dot" aria-label="Не прочитано"></span></div><p>${esc(item.text)}</p></a></li>`).join('')}</ul></div>`;
    document.body.append(panel);
    // Replace every bell with a real popup trigger, including generated results headers.
    document.querySelectorAll('.app-header a[aria-label="Уведомления"]').forEach(link=>{
      const button=document.createElement('button');button.className=link.className;button.type='button';button.innerHTML=link.innerHTML;button.setAttribute('aria-label','Уведомления');button.dataset.openNotifications='';link.replaceWith(button);
    });
    const triggers=[...document.querySelectorAll('[data-open-notifications]')];
    triggers.forEach(button=>{button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-controls',panel.id);button.setAttribute('aria-expanded','false');});
    const stored=readJSON(readKey,[]),read=new Set(Array.isArray(stored)?stored.filter(id=>typeof id==='string'):[]);
    const items=[...panel.querySelectorAll('[data-notification]')],all=panel.querySelector('#read-all-notifications');
    const update=()=>{
      let count=0;items.forEach(item=>{const done=read.has(item.dataset.notification);item.classList.toggle('is-read',done);item.closest('li').hidden=done;item.querySelector('.unread-dot').hidden=done;if(!done)count++;});
      panel.querySelector('#notifications-count').textContent=count?`Непрочитанных: ${count}`:'Новых оповещений нет';all.disabled=count===0;all.hidden=count===0;
      triggers.forEach(trigger=>{if(!trigger.matches('.header-action'))return;let badge=trigger.querySelector('.notification-badge');if(!badge){badge=document.createElement('span');badge.className='notification-badge';badge.setAttribute('aria-hidden','true');trigger.append(badge);}badge.textContent=String(count);badge.hidden=count===0;trigger.setAttribute('aria-label',count?`Уведомления: ${count} непрочитанных`:'Уведомления');});
    };
    update();
    window.addEventListener('storage',event=>{if(event.key===readKey){read.clear();const next=readJSON(readKey,[]);if(Array.isArray(next))next.forEach(id=>read.add(id));update();}});
    items.forEach(item=>item.addEventListener('click',()=>{read.add(item.dataset.notification);saveJSON(readKey,[...read]);update();}));
    all.addEventListener('click',()=>{items.forEach(item=>read.add(item.dataset.notification));saveJSON(readKey,[...read]);update();});
    let trigger=null;
    const position=()=>{const h=root.querySelector('.app-header-group,#session-header-slot,.app-header');panel.style.setProperty('--notifications-top',`${h.getBoundingClientRect().bottom+8}px`);};
    const open=async button=>{await window.InisUI?.closeMenu();trigger=button?.closest('.side-menu')?document.querySelector('.app-header [data-open-notifications]'):button;trigger?.setAttribute('aria-expanded','true');position();update();if(!panel.open)panel.showModal();};
    triggers.forEach(button=>button.addEventListener('click',event=>{event.preventDefault();open(button);}));
    panel.querySelector('[data-close-notifications]').addEventListener('click',()=>panel.close());
    panel.addEventListener('click',event=>{if(event.target!==panel)return;const r=panel.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)panel.close();});
    panel.addEventListener('close',()=>{trigger?.setAttribute('aria-expanded','false');trigger?.focus({preventScroll:true});});
    window.addEventListener('resize',()=>{if(panel.open)position();});
    panel.querySelector('a[aria-label="Настройки оповещений"]').addEventListener('click',()=>{try{sessionStorage.setItem('inis.notifications.return-page',location.pathname.split('/').pop()+location.search);}catch{}});
    const back=document.getElementById('back-to-notifications');
    if(back){try{const previous=sessionStorage.getItem('inis.notifications.return-page');if(/^(main|training|analytics|training-history|documents|achievements|kb-[12]|profile-[123]|daily-tasks|training-results)\.html(?:\?[^#]*)?$/.test(previous||'')){const url=new URL(previous,location.href);url.searchParams.set('notifications','open');back.href=url.href;}}catch{}}
    const current=new URL(location.href);
    if(current.searchParams.get('notifications')==='open'){current.searchParams.delete('notifications');history.replaceState(history.state,'',current.href);open(document.querySelector('.app-header [data-open-notifications]'));}
    const settings=document.querySelector('.notification-settings');
    if(settings){
      const saved=readJSON(settingsKey,{}),buttons=[...settings.querySelectorAll('[data-setting]')];
      const set=(button,value)=>{button.setAttribute('aria-checked',String(value));button.querySelector('img').src=`../images/icons/ic-toggle-${value?'on':'off'}.svg`;};
      buttons.forEach(button=>{if(saved&&typeof saved[button.dataset.setting]==='boolean')set(button,saved[button.dataset.setting]);button.addEventListener('click',()=>{set(button,button.getAttribute('aria-checked')!=='true');document.getElementById('settings-status').textContent='';});});
      document.getElementById('save-notification-settings').addEventListener('click',()=>{const persisted=saveJSON(settingsKey,Object.fromEntries(buttons.map(button=>[button.dataset.setting,button.getAttribute('aria-checked')==='true'])));if(persisted){document.getElementById('settings-status').textContent='';window.AppToast.show('Настройки сохранены');}else document.getElementById('settings-status').textContent='Не удалось сохранить настройки в этом браузере';});
    }
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
})();
