(() => {
  const setup=()=>{
    const form=document.getElementById('pf');if(!form)return;const P=window.Platform,store=P.store,chips=document.getElementById('chips'),input=document.getElementById('newSkill'),save=form.querySelector('.save');
    const saved=store.get('inis.profile.v2');
    if(saved){[['fn','firstName'],['ln','lastName'],['em','email']].forEach(([id,key])=>{if(typeof saved[key]==='string')document.getElementById(id).value=saved[key];});}
    const G=window.GradeProgress,currentDirection=G.state()?.direction||saved?.specialization||'Не выбрано',currentTechnology=G.state()?.track?G.currentTrack().label:saved?.technology||'Не выбрана';
    document.getElementById('gr').value=G.state()?.grade||'Не определён';
    document.getElementById('profile-direction').textContent=currentDirection;document.getElementById('profile-technology').textContent=currentTechnology;
    const refreshSummary=()=>{const first=document.getElementById('fn').value.trim(),last=document.getElementById('ln').value.trim();document.querySelector('.profile-summary h2').textContent=`${first} ${last}`.trim();document.querySelector('.profile-summary p').textContent=`${currentDirection}${currentTechnology!=='Не выбрана'?' · '+currentTechnology:''} · ${document.getElementById('gr').value}`;const avatar=document.querySelector('.avatar-content');if(!avatar.querySelector('img'))avatar.textContent=`${first[0]||''}${last[0]||''}`.toUpperCase();};refreshSummary();
    const change=document.getElementById('change-technology'),dialog=document.createElement('dialog');dialog.className='ui-dialog';dialog.id='change-preparation-dialog';dialog.setAttribute('aria-labelledby','change-preparation-title');dialog.setAttribute('aria-describedby','change-preparation-copy');
    dialog.innerHTML='<div class="dialog-heading"><h2 id="change-preparation-title">Создать новый профиль подготовки?</h2><button class="icon-button" type="button" data-close aria-label="Закрыть"><img src="../images/icons/ic-close.svg" alt=""></button></div><p id="change-preparation-copy">Для смены направления или технологии нужен новый профиль подготовки и повторная диагностика. Текущий грейд и прогресс персонального плана не перенесутся в новый профиль.</p><p class="muted">Личные данные, фото и история тренировок сохранятся. Новый путь начнётся после выбора технологии.</p><div class="preparation-actions"><button class="form-button secondary" type="button" data-cancel>Оставить текущий профиль</button><a class="form-button" href="choose-direction.html?new-profile=1" id="confirm-new-profile">Создать новый профиль</a></div>';document.body.append(dialog);
    change.addEventListener('click',()=>dialog.showModal());dialog.querySelectorAll('[data-close],[data-cancel]').forEach(b=>b.addEventListener('click',()=>dialog.close()));dialog.addEventListener('close',()=>change.focus({preventScroll:true}));
    // Keep the compressed avatar separate from editable profile fields.
    const photoKey='inis.profile.photo.v1',avatar=document.querySelector('.avatar-content'),fileInput=document.getElementById('profile-photo-file'),choosePhoto=document.getElementById('choose-profile-photo'),cameraInput=document.getElementById('profile-camera-file'),photoError=document.getElementById('profile-photo-error');
    const photoDialog=document.createElement('dialog');photoDialog.className='ui-dialog photo-actions-sheet';photoDialog.id='profile-photo-dialog';photoDialog.setAttribute('aria-labelledby','profile-photo-title');photoDialog.innerHTML='<div class="dialog-heading"><h2 id="profile-photo-title">Фото профиля</h2><button type="button" class="icon-button" data-close-photo aria-label="Закрыть"><img src="../images/icons/ic-close.svg" alt=""></button></div><div class="option-list photo-menu"><button type="button" id="gallery-profile-photo"><img src="../images/icons/ic-gallery.svg" alt=""><span>Выбрать из галереи</span></button><button type="button" id="camera-profile-photo"><img src="../images/icons/ic-camera.svg" alt=""><span>Сделать новое фото</span></button><button type="button" id="remove-profile-photo" class="photo-remove" hidden><img src="../images/icons/ic-trash.svg" alt=""><span>Удалить фото</span></button></div><button type="button" class="form-button secondary" data-close-photo>Отмена</button>';document.body.append(photoDialog);const removePhoto=photoDialog.querySelector('#remove-profile-photo');
    let photo=null,photoRequest=0;
    try{const value=JSON.parse(localStorage.getItem(photoKey));if(typeof value==='string'&&/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(value)&&value.length<400000)photo=value;}catch{}
    const renderPhoto=()=>{
      avatar.replaceChildren();
      if(photo){const img=document.createElement('img');img.src=photo;img.alt='Фото профиля';avatar.removeAttribute('aria-hidden');avatar.append(img);}
      else{avatar.setAttribute('aria-hidden','true');refreshSummary();}
      removePhoto.hidden=!photo;choosePhoto.setAttribute('aria-label',photo?'Изменить фото профиля':'Добавить фото профиля');
    };
    const failPhoto=message=>{photoError.hidden=false;photoError.textContent=message;};
    const setPhotoBusy=busy=>{choosePhoto.disabled=busy;choosePhoto.setAttribute('aria-busy',String(busy));};
    renderPhoto();
    choosePhoto.addEventListener('click',()=>{removePhoto.hidden=!photo;photoDialog.showModal();});
    photoDialog.querySelectorAll('[data-close-photo]').forEach(b=>b.addEventListener('click',()=>photoDialog.close()));
    photoDialog.addEventListener('close',()=>choosePhoto.focus({preventScroll:true}));
    photoDialog.addEventListener('click',event=>{if(event.target!==photoDialog)return;const b=photoDialog.getBoundingClientRect();if(event.clientX<b.left||event.clientX>b.right||event.clientY<b.top||event.clientY>b.bottom)photoDialog.close();});
    photoDialog.querySelector('#gallery-profile-photo').addEventListener('click',()=>{photoDialog.close();fileInput.click();});
    photoDialog.querySelector('#camera-profile-photo').addEventListener('click',()=>{photoDialog.close();cameraInput.click();});
    removePhoto.addEventListener('click',()=>{
      photoRequest++;setPhotoBusy(false);photoError.hidden=true;
      try{localStorage.removeItem(photoKey);}catch{photoDialog.close();failPhoto('Не удалось удалить фото. Разрешите сохранение данных в браузере и повторите.');return;}
      photo=null;fileInput.value='';cameraInput.value='';renderPhoto();photoDialog.close();window.AppToast.show('Фото удалено');
    });
    const uploadPhoto=async event=>{
      const source=event.currentTarget,file=source.files?.[0];if(!file)return;
      const request=++photoRequest;photoError.hidden=true;setPhotoBusy(true);
      let url;
      try{
        if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Выберите изображение в формате JPG, PNG или WebP.');
        if(!file.size||file.size>5*1024*1024)throw Error('Размер фото должен быть от 1 байта до 5 МБ.');
        const header=new Uint8Array(await file.slice(0,12).arrayBuffer());
        const png=[137,80,78,71,13,10,26,10].every((n,i)=>header[i]===n),jpeg=header[0]===255&&header[1]===216&&header[2]===255,webp=String.fromCharCode(...header.slice(0,4))==='RIFF'&&String.fromCharCode(...header.slice(8,12))==='WEBP';
        if(!({ 'image/jpeg':jpeg,'image/png':png,'image/webp':webp })[file.type])throw Error('Содержимое файла не соответствует выбранному формату.');
        url=URL.createObjectURL(file);const img=new Image();
        await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('Не удалось открыть изображение. Выберите другой файл.'));img.src=url;});
        if(img.naturalWidth*img.naturalHeight>40000000)throw Error('Изображение слишком большое. Выберите фото до 40 мегапикселей.');
        const size=Math.min(img.naturalWidth,img.naturalHeight),edge=Math.min(512,size),canvas=document.createElement('canvas');canvas.width=canvas.height=edge;
        const ctx=canvas.getContext('2d');if(!ctx)throw Error('Не удалось обработать фото в этом браузере.');
        ctx.fillStyle='#cfe8dd';ctx.fillRect(0,0,edge,edge);ctx.drawImage(img,(img.naturalWidth-size)/2,(img.naturalHeight-size)/2,size,size,0,0,edge,edge);
        const data=canvas.toDataURL('image/jpeg',.86);if(data.length>=400000)throw Error('Не удалось уменьшить фото. Выберите другое изображение.');
        if(request!==photoRequest)return;
        try{localStorage.setItem(photoKey,JSON.stringify(data));}catch{throw Error('Не удалось сохранить фото. Освободите место или разрешите сохранение данных в браузере.');}
        photo=data;renderPhoto();window.AppToast.show('Фото сохранено');
      }catch(error){if(request===photoRequest)failPhoto(error.message||'Не удалось загрузить фото.');}
      finally{if(url)URL.revokeObjectURL(url);if(request===photoRequest){source.value='';setPhotoBusy(false);}}
    };
    fileInput.addEventListener('change',uploadPhoto);cameraInput.addEventListener('change',uploadPhoto);
    const notice=document.createElement('p');notice.className='field-error';notice.id='skill-error';notice.setAttribute('role','alert');notice.hidden=true;input.closest('.form-field').append(notice);
    const status=document.createElement('p');status.className='field-error';status.setAttribute('role','alert');status.hidden=true;save.after(status);
    const append=value=>{const li=document.createElement('li');li.className='chip2';const text=document.createElement('span');text.textContent=value;const b=document.createElement('button');b.type='button';b.setAttribute('aria-label',`Удалить навык ${value}`);const img=document.createElement('img');img.src='../images/icons/ic-x.svg';img.alt='';b.append(img);li.append(text,b);chips.append(li);};
    if(Array.isArray(saved?.skills)){chips.replaceChildren();saved.skills.forEach(append);}
    const catalog=window.SkillCatalog,suggestions=document.createElement('div');suggestions.id='skill-suggestions';suggestions.className='skill-suggestions';suggestions.setAttribute('role','listbox');suggestions.setAttribute('aria-label','Навыки из каталога');suggestions.hidden=true;input.closest('.form-field').append(suggestions);let matches=[],active=-1;
    const closeSuggestions=()=>{suggestions.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');active=-1;};
    const add=()=>{const raw=input.value.trim(),value=catalog.resolve(raw),names=[...chips.querySelectorAll('li > span')].map(s=>s.textContent.toLowerCase());let error='';if(!raw)error='Введите название навыка.';else if(!value)error='Такого навыка нет в каталоге. Выберите навык из списка.';else if(names.includes(value.toLowerCase()))error='Такой навык уже добавлен.';else if(names.length>=20)error='Можно добавить не более 20 навыков.';notice.textContent=error;notice.hidden=!error;input.setAttribute('aria-invalid',String(Boolean(error)));if(error){input.focus();return false;}append(value);input.value='';closeSuggestions();input.focus();return true;};
    const updateSuggestions=()=>{const value=input.value.trim();matches=value?catalog.search(value).slice(0,6):[];active=-1;suggestions.innerHTML=matches.map((name,i)=>`<button type="button" id="skill-option-${i}" role="option" aria-selected="false" data-skill-index="${i}">${P.escape(name)}</button>`).join('');suggestions.hidden=!matches.length;input.setAttribute('aria-expanded',String(matches.length>0));input.removeAttribute('aria-activedescendant');};
    // Migrate old aliases and discard arbitrary text that is absent from the catalog.
    const existing=[...chips.querySelectorAll('li > span')].map(s=>catalog.resolve(s.textContent)).filter(Boolean);chips.replaceChildren();[...new Set(existing)].forEach(append);
    document.getElementById('addSkill').addEventListener('click',add);input.addEventListener('input',()=>{notice.hidden=true;input.setAttribute('aria-invalid','false');updateSuggestions();});input.addEventListener('keydown',event=>{
      if(['ArrowDown','ArrowUp'].includes(event.key)&&matches.length){event.preventDefault();active=(active+(event.key==='ArrowDown'?1:-1)+matches.length)%matches.length;suggestions.querySelectorAll('button').forEach((b,i)=>b.setAttribute('aria-selected',String(i===active)));input.setAttribute('aria-activedescendant',`skill-option-${active}`);suggestions.children[active].scrollIntoView({block:'nearest'});}
      else if(event.key==='Enter'){event.preventDefault();if(active>=0)input.value=matches[active];add();}else if(event.key==='Escape')closeSuggestions();
    });suggestions.addEventListener('pointerdown',event=>event.preventDefault());suggestions.addEventListener('click',event=>{const b=event.target.closest('[data-skill-index]');if(b){input.value=matches[Number(b.dataset.skillIndex)];add();}});input.addEventListener('blur',()=>setTimeout(closeSuggestions,120));chips.addEventListener('click',event=>event.target.closest('button')?.closest('li')?.remove());
    form.addEventListener('submit',event=>{event.preventDefault();if(input.value.trim()&&!add())return;const data={...store.get('inis.profile.v2',{}),firstName:document.getElementById('fn').value.trim(),lastName:document.getElementById('ln').value.trim(),email:document.getElementById('em').value.trim(),grade:G.state()?.grade||'Не определён',specialization:currentDirection,technology:currentTechnology,skills:[...chips.querySelectorAll('li > span')].map(x=>x.textContent)};if(store.set('inis.profile.v2',data)){status.hidden=true;window.AppToast.show('Данные сохранены');}else{status.hidden=false;status.textContent='Не удалось сохранить данные в этом браузере';}refreshSummary();});
  };if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
})();
