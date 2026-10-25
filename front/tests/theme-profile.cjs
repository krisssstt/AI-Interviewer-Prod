const {chromium}=require('playwright');
const fs=require('fs'),path=require('path'),http=require('http');
const root=path.resolve(__dirname,'..'),output=path.join(__dirname,'artifacts');
const assert=(ok,message)=>{if(!ok)throw Error(message);};
(async()=>{
 fs.mkdirSync(output,{recursive:true});
 const server=http.createServer((req,res)=>{try{const f=path.join(root,decodeURIComponent(req.url.split('?')[0]));res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'})[path.extname(f)]||'application/octet-stream');res.end(fs.readFileSync(f));}catch{res.statusCode=404;res.end();}});
 await new Promise(r=>server.listen(8042,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));page.setDefaultTimeout(10000);
  const go=name=>page.goto('http://127.0.0.1:8042/pages/'+name,{waitUntil:'domcontentloaded'});
  await go('analytics.html');await page.evaluate(()=>localStorage.setItem('inis.theme.v3','dark'));await page.reload();
  const css=selector=>page.locator(selector).first().evaluate(el=>({bg:getComputedStyle(el).backgroundColor,color:getComputedStyle(el).color,filter:getComputedStyle(el).filter}));
  assert((await css('.app-header-group')).bg==='rgb(23, 41, 31)','period header has dark background');
  assert((await css('.header-period-controls')).bg==='rgb(23, 41, 31)','period controls have dark background');
  assert((await css('.recommendation')).bg!==(await css('.dashboard-grid .ui-card')).bg,'AI and metrics have distinct colors');
  await page.screenshot({path:path.join(output,'theme-v4-analytics.png')});
  await page.click('#custom-period');await page.click('#choose-period-start');
  assert((await css('.calendar-back')).bg==='rgba(0, 0, 0, 0)','calendar back is transparent');
  assert((await css('.period-dialog')).bg==='rgb(41, 70, 55)','calendar has raised surface');
  await page.screenshot({path:path.join(output,'theme-v4-calendar.png')});
  await page.evaluate(()=>GradeProgress.chooseDirection('QA Engineer','qa-manual'));await go('kb-1.html');await page.locator('.starb').first().click();
  assert((await css('.starb[aria-pressed=true]')).bg==='rgb(56, 81, 58)','saved star has dark warm background');
  const selected=await css('.starb[aria-pressed=true]'),unselected=await css('.starb[aria-pressed=false]');assert(selected.bg!==unselected.bg,'saved and unsaved stars have distinct backgrounds');
  await go('kb-1.html?view=favorites');assert(await page.locator('.kcard:visible').count()===1,'favorites preserved');await page.screenshot({path:path.join(output,'theme-v4-favorites.png')});
  await go('profile-1.html');const input=page.locator('#profile-photo-file'),avatar=page.locator('.profile-summary .avatar-content');
  const file=async(data,mime='image/png',name='avatar.png')=>{await input.setInputFiles({name,mimeType:mime,buffer:data});};
  await file(Buffer.from('not an image'));await page.locator('#profile-photo-error:not([hidden])').waitFor();assert(await avatar.locator('img').count()===0,'invalid signature rejected');
  await file(Buffer.alloc(5*1024*1024+1));await page.getByText('Размер фото должен быть от 1 байта до 5 МБ.').waitFor();
  await file(Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0]));await page.getByText('Не удалось открыть изображение. Выберите другой файл.').waitFor();
  const fixture=async color=>Buffer.from(await page.evaluate(color=>{const c=document.createElement('canvas');c.width=180;c.height=120;const ctx=c.getContext('2d');ctx.fillStyle=color;ctx.fillRect(0,0,180,120);ctx.fillStyle='#fff';ctx.fillRect(70,40,40,40);return c.toDataURL('image/png').split(',')[1];},color),'base64');
  const first=await fixture('#52699a'),second=await fixture('#9a6552');await file(first);await page.getByText('Фото сохранено',{exact:true}).waitFor();const original=await avatar.locator('img').getAttribute('src');
  const dimensions=await avatar.locator('img').evaluate(img=>({w:img.naturalWidth,h:img.naturalHeight}));assert(dimensions.w===dimensions.h,'avatar cropped square');
  await page.reload();assert(await avatar.locator('img').getAttribute('src')===original,'photo persists across reload');
  await page.fill('#fn','Анна');await page.locator('#pf button[type=submit]').click();await page.reload();assert(await avatar.locator('img').getAttribute('src')===original,'saving profile preserves photo');
  await file(second);await page.getByText('Фото сохранено',{exact:true}).waitFor();assert(await avatar.locator('img').getAttribute('src')!==original,'photo replaced');
  const replacement=await avatar.locator('img').getAttribute('src');
  await page.evaluate(()=>{window.originalStorageSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='inis.profile.photo.v1')throw new DOMException('Quota exceeded','QuotaExceededError');return window.originalStorageSet.call(this,k,v);};});
  await file(first);await page.getByText('Не удалось сохранить фото. Освободите место или разрешите сохранение данных в браузере.').waitFor();assert(await avatar.locator('img').getAttribute('src')===replacement,'quota failure preserves previous photo');
  await page.evaluate(()=>{Storage.prototype.setItem=window.originalStorageSet;});
  await page.reload();await page.screenshot({path:path.join(output,'theme-v4-profile.png')});
  await page.click('#choose-profile-photo');await page.click('#remove-profile-photo');assert(await avatar.locator('img').count()===0,'photo removed');assert((await avatar.innerText()).startsWith('А'),'initials restored');await page.reload();assert(await avatar.locator('img').count()===0,'removal persists');
  await file(first);await page.getByText('Фото сохранено',{exact:true}).waitFor();
  for(const theme of ['dark','light']){
   await page.evaluate(t=>localStorage.setItem('inis.theme.v3',t),theme);
   for(const width of [320,390,1440]){await page.setViewportSize({width,height:844});for(const name of ['analytics.html','profile-1.html','kb-1.html?view=favorites']){await go(name);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`no overflow ${theme} ${width} ${name}`);if(name==='analytics.html'){await page.click('#custom-period');const b=await page.locator('#period-dialog').boundingBox();assert(b.x>=0&&b.x+b.width<=width&&b.y>=0&&b.y+b.height<=844,'period dialog fits');await page.click('#close-period');}}}
  }
  await go('register.html');await page.fill('#name','Новый');await page.fill('#email','new@example.com');await page.fill('#password','Password123');await page.fill('#password2','Password123');await page.check('#agree');await page.locator('button[type=submit]').click();await page.locator('#direction-options').waitFor();assert(await page.evaluate(()=>localStorage.getItem('inis.profile.photo.v1'))===null,'new profile has no previous avatar');
  assert(!errors.length,JSON.stringify(errors));console.log('THEME AND PROFILE PHOTO PASS');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(error=>{console.error(error);process.exitCode=1;});
