(() => {
  'use strict';
  const setup = () => {
    const root = document.querySelector('main.screen, main.session-screen');
    if (!root) return;
    document.body.classList.add('application');
    root.classList.add('app-shell');
    const headerSlot = root.querySelector('#session-header-slot');
    const header = headerSlot || root.querySelector('.app-header-group') || root.querySelector('.app-header');
    if (header?.matches('.app-header-group')) root.classList.add('has-header-controls');
    let nav = root.querySelector('.app-nav');
    // Active interviews expose only a confirmed exit.
    if (root.matches('[data-training-question]')) { nav?.remove(); nav = null; }
    if(nav){const icons=['ic-nav-home-off.svg','ic-nav-chat.svg','ic-nav-books.svg','ic-nav-chart.svg','ic-nav-profile.svg'];nav.querySelectorAll('a img').forEach((img,i)=>{if(icons[i])img.src='../images/icons/'+icons[i];});}
    nav?.remove();
    const content = document.createElement('div'); content.className = 'app-content';
    if (root.querySelector('.support-layout')) content.classList.add('support-content');
    const nodes = [...root.childNodes].filter(n => n !== header && !(n.nodeType===1 && n.matches('.hint-overlay,.review-overlay')));
    nodes.forEach(n => content.append(n));
    root.prepend(header); header.after(content);
    if (nav) root.append(nav); else root.classList.add('no-bottom-nav');
    if (root.querySelector('.hint-overlay') && nav) nav.inert = true;
    ['question-content','results-content'].forEach(id => document.getElementById(id)?.classList.add('content-inner','session-content'));
    if (root.matches('[data-training-question]')) {
      document.body.classList.add('interview-active');
      return;
    }
    document.querySelectorAll('[data-open-menu]').forEach(button => button.setAttribute('aria-expanded','false'));
    const dialog = document.createElement('dialog'); dialog.className = 'side-menu'; dialog.id = 'side-menu'; dialog.setAttribute('aria-labelledby','menu-title');
    dialog.innerHTML = `
      <header class="app-header">
        <span class="header-action"><img src="../images/logo.svg" alt=""></span>
        <h2 class="brand-title" id="menu-title">AI-Интервьюер</h2>
        <button class="header-action" type="button" data-close-menu aria-label="Закрыть меню"><img src="../images/icons/ic-close.svg" alt=""></button>
      </header>
      <div class="side-menu-content"><p>Дополнительно</p><nav class="side-menu-links" aria-label="Дополнительная навигация">
        <a href="kb-1.html?view=favorites"><img src="../images/icons/ic-hist-star.svg" alt=""><span>Избранное</span></a>
        <a href="profile-4.html" data-open-notifications><img src="../images/icons/ic-m-bell.svg" alt=""><span>Уведомления</span></a>
        <a href="profile-2.html"><img src="../images/icons/ic-m-support.svg" alt=""><span>Поддержка</span></a>
        <a href="profile-3.html"><img src="../images/icons/ic-m-gear.svg" alt=""><span>Мои данные</span></a>
      </nav>
        <button class="side-menu-theme" type="button" role="switch" aria-checked="false">
          <img class="theme-icon" src="../images/icons/ic-m-moon.svg" alt=""><span>Тёмная тема</span><span class="theme-switch" aria-hidden="true"></span>
        </button>
        <nav class="side-menu-links side-menu-logout" aria-label="Выход"><a href="login.html" data-logout><img src="../images/icons/ic-logout.svg" alt=""><span>Выйти</span></a></nav>
      </div>`;
    document.body.append(dialog);window.ThemeUI?.sync();
    const current = new URL(location.href); current.searchParams.delete('menu'); current.searchParams.delete('notifications');
    dialog.querySelectorAll('a').forEach(link => {
      const target = new URL(link.href);
      const notificationSettings = current.pathname.endsWith('/notification-settings.html') && target.pathname.endsWith('/profile-4.html');
      if (notificationSettings || (target.pathname===current.pathname && target.search===current.search)) {
        link.setAttribute('aria-current','page');
        if (!notificationSettings) link.addEventListener('click',e=>{ e.preventDefault(); closeMenu(); });
      }
    });
    let trigger = null, closing = null;
    const closeMenu = () => {
      if (!dialog.open) return Promise.resolve();
      if (closing) return closing;
      closing = new Promise(resolve => {
        dialog.classList.add('is-closing');
        const finish = () => { clearTimeout(timer); dialog.removeEventListener('animationend', onEnd); dialog.close(); dialog.classList.remove('is-closing'); closing = null; resolve(); };
        const onEnd = event => { if (event.target === dialog) finish(); };
        const timer = setTimeout(finish, 220);
        dialog.addEventListener('animationend', onEnd);
      });
      return closing;
    };
    const open = button => { trigger = button; button?.setAttribute('aria-expanded','true'); dialog.showModal(); };
    window.InisUI = { closeMenu };
    document.querySelectorAll('[data-open-menu]').forEach(button => button.addEventListener('click',()=>open(button)));
    dialog.querySelector('[data-close-menu]').addEventListener('click',closeMenu);
    dialog.addEventListener('cancel',event=>{ event.preventDefault(); closeMenu(); });
    dialog.addEventListener('click',event=>{
      if (event.target!==dialog) return;
      const r=dialog.getBoundingClientRect();
      if (event.clientX<r.left || event.clientX>r.right || event.clientY<r.top || event.clientY>r.bottom) closeMenu();
    });
    dialog.addEventListener('close',()=>{ trigger?.setAttribute('aria-expanded','false'); trigger?.focus({preventScroll:true}); });
    try { sessionStorage.setItem('inis.last-page',current.pathname.split('/').pop()+current.search); } catch {}
    if (new URLSearchParams(location.search).get('menu')==='open') {
      history.replaceState(history.state,'',current.href);
      open(document.querySelector('[data-open-menu]'));
    }
  };
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',setup,{once:true}); else setup();
})();
