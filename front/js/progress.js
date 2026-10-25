(() => {
  'use strict';
  const controls = document.getElementById('progress-period');
  if (!controls) return;
  const dialog = document.getElementById('period-dialog');
  const custom = document.getElementById('custom-period');
  const days = document.getElementById('calendar-days');
  const apply = document.getElementById('apply-period');
  const next = document.getElementById('next-month');
  const calendar = document.getElementById('period-calendar');
  const fields = document.getElementById('period-range-fields');
  const actions = dialog.querySelector('.period-actions');
  const dateFields = {start: document.getElementById('choose-period-start'), end: document.getElementById('choose-period-end')};
  const storageKey = 'inis.progress.period.v1';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const iso = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const parse = value => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const [y,m,d] = value.split('-').map(Number), date = new Date(y,m-1,d);
    return iso(date) === value ? date : null;
  };
  const offset = (date, amount) => { const copy = new Date(date); copy.setDate(copy.getDate()+amount); return copy; };
  const shortDate = new Intl.DateTimeFormat('ru-RU', {day:'2-digit',month:'2-digit',year:'numeric'});
  const fullDate = new Intl.DateTimeFormat('ru-RU', {day:'numeric',month:'long',year:'numeric'});
  const monthName = new Intl.DateTimeFormat('ru-RU', {month:'long',year:'numeric'});
  const preset = count => ({mode:String(count),start:iso(offset(today,1-count)),end:iso(today)});
  let selected = preset(7);
  try {
    const saved = JSON.parse(sessionStorage.getItem(storageKey));
    if (saved?.mode === '7' || saved?.mode === '30') selected = preset(Number(saved.mode));
    else if (saved?.mode === 'custom' && parse(saved.start) && parse(saved.end) && saved.start <= saved.end && saved.end <= iso(today)) selected = saved;
  } catch {}
  let draft, month, focusDate, editing = null;
  const updateSelection = () => {
    controls.querySelectorAll('button').forEach(button => {
      const active = (button.dataset.days || 'custom') === selected.mode;
      button.classList.toggle('on', active); button.setAttribute('aria-pressed', String(active));
    });
    const range = `${shortDate.format(parse(selected.start))} — ${shortDate.format(parse(selected.end))}`;
    document.getElementById('selected-period').textContent = `Период: ${range}`;
    document.getElementById('progress-duration').textContent = selected.mode === 'custom' ? 'за выбранный период' : `за ${selected.mode} дней`;
    custom.setAttribute('aria-label', selected.mode === 'custom' ? `Период: ${range}. Изменить период` : 'Выбрать период');
    try { sessionStorage.setItem(storageKey, JSON.stringify(selected)); } catch {}
    window.dispatchEvent(new CustomEvent('inis:period-change',{detail:selected}));
  };
  const render = (restoreFocus = false) => {
    document.getElementById('calendar-month').textContent = monthName.format(month);
    document.getElementById('period-start').textContent = draft.start ? shortDate.format(parse(draft.start)) : 'Выберите дату';
    document.getElementById('period-end').textContent = draft.end ? shortDate.format(parse(draft.end)) : 'Выберите дату';
    document.getElementById('period-title').textContent = editing === 'start' ? 'Выберите начало' : editing === 'end' ? 'Выберите конец' : 'Выберите период';
    document.getElementById('period-instruction').textContent = editing ? 'Нажмите на нужную дату в календаре.' : 'Нажмите «Начало» или «Конец», чтобы выбрать дату.';
    const invalid = Boolean(draft.start && draft.end && draft.start > draft.end);
    document.getElementById('period-error').hidden = Boolean(editing) || !invalid;
    apply.disabled = !draft.start || !draft.end || invalid;
    fields.hidden = Boolean(editing); actions.hidden = Boolean(editing); calendar.hidden = !editing;
    Object.entries(dateFields).forEach(([key, button]) => {
      button.setAttribute('aria-expanded', String(editing === key));
      button.setAttribute('aria-label', `${key === 'start' ? 'Начало' : 'Конец'} периода: ${draft[key] ? shortDate.format(parse(draft[key])) : 'выберите дату'}`);
    });
    next.disabled = month.getFullYear() === today.getFullYear() && month.getMonth() === today.getMonth();
    const blanks = (month.getDay()+6)%7, count = new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
    const fragment = document.createDocumentFragment();
    for (let i=0;i<blanks;i++) { const blank=document.createElement('span');blank.setAttribute('aria-hidden','true');fragment.append(blank); }
    for (let day=1;day<=count;day++) {
      const date = new Date(month.getFullYear(),month.getMonth(),day), key = iso(date);
      const button = document.createElement('button');button.type='button';button.dataset.date=key;button.textContent=String(day);
      button.disabled = date > today;button.tabIndex = key === focusDate ? 0 : -1;
      const endpoint = key === draft.start || key === draft.end;
      const inRange = Boolean(draft.start && draft.end && key >= draft.start && key <= draft.end);
      button.classList.toggle('range-endpoint',endpoint);button.classList.toggle('in-range',inRange);
      button.setAttribute('aria-pressed',String(endpoint || inRange));
      button.setAttribute('aria-label',fullDate.format(date)+(key === draft.start ? ', начало периода' : '')+(key === draft.end ? ', конец периода' : ''));
      if (key === iso(today)) button.setAttribute('aria-current','date');
      fragment.append(button);
    }
    days.replaceChildren(fragment);
    if (restoreFocus) days.querySelector(`[data-date="${focusDate}"]`)?.focus({preventScroll:true});
  };
  controls.addEventListener('click', event => {
    const button=event.target.closest('button');if(!button)return;
    if (button.dataset.days) { selected=preset(Number(button.dataset.days));updateSelection();return; }
    draft={start:selected.start,end:selected.end};focusDate=draft.end;editing=null;
    const end=parse(draft.end);month=new Date(end.getFullYear(),end.getMonth(),1);render();
    custom.setAttribute('aria-expanded','true');dialog.showModal();dateFields.start.focus({preventScroll:true});
  });
  Object.entries(dateFields).forEach(([key, button]) => button.addEventListener('click', () => {
    editing = key; focusDate = draft[key] || draft.start || iso(today);
    const date = parse(focusDate); month = new Date(date.getFullYear(), date.getMonth(), 1);
    render(true);
  }));
  const showRange = () => {
    const field = editing; editing = null; render();
    dateFields[field]?.focus({preventScroll:true});
  };
  document.getElementById('back-to-period').addEventListener('click', showRange);
  dialog.addEventListener('cancel', event => {
    if (editing) { event.preventDefault(); showRange(); }
  });
  days.addEventListener('click', event => {
    const button=event.target.closest('[data-date]');if(!button || button.disabled || !editing)return;
    const date=button.dataset.date;focusDate=date;
    draft[editing]=date;
    showRange();
  });
  const moveMonth = amount => {
    const target=new Date(month.getFullYear(),month.getMonth()+amount,1);
    if(target > today)return;
    month=target;
    const day=Math.min(parse(focusDate).getDate(),new Date(month.getFullYear(),month.getMonth()+1,0).getDate());
    let focus=new Date(month.getFullYear(),month.getMonth(),day);if(focus>today)focus=new Date(today);
    focusDate=iso(focus);render();
  };
  document.getElementById('previous-month').addEventListener('click',()=>moveMonth(-1));
  next.addEventListener('click',()=>moveMonth(1));
  days.addEventListener('keydown', event => {
    const button=event.target.closest('[data-date]');if(!button)return;
    const current=parse(button.dataset.date);let target;
    const offsets={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7};
    if(event.key in offsets)target=offset(current,offsets[event.key]);
    else if(event.key==='Home')target=offset(current,-((current.getDay()+6)%7));
    else if(event.key==='End')target=offset(current,6-((current.getDay()+6)%7));
    else if(event.key==='PageUp' || event.key==='PageDown') {event.preventDefault();moveMonth(event.key==='PageUp' ? -1 : 1);render(true);return;}
    else return;
    event.preventDefault();if(target>today)target=new Date(today);
    focusDate=iso(target);month=new Date(target.getFullYear(),target.getMonth(),1);render(true);
  });
  apply.addEventListener('click',()=>{if(!draft.start || !draft.end || draft.start > draft.end)return;selected={mode:'custom',...draft};updateSelection();dialog.close();});
  ['close-period','cancel-period'].forEach(id=>document.getElementById(id).addEventListener('click',()=>dialog.close()));
  dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left || event.clientX>r.right || event.clientY<r.top || event.clientY>r.bottom)dialog.close();});
  dialog.addEventListener('close',()=>{custom.setAttribute('aria-expanded','false');custom.focus({preventScroll:true});});
  custom.setAttribute('aria-expanded','false');updateSelection();
})();
