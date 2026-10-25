// Real browser + API + migrated temporary database. No paid services or mocked grades.
const {chromium}=require('playwright');
const {spawn,spawnSync}=require('child_process');
const fs=require('fs'),os=require('os'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'qa-interviewer-'));
const python=process.env.PYTHON || path.join(root,process.platform==='win32'?'.venv/Scripts/python.exe':'.venv/bin/python');
const env={...process.env,DATABASE_URL:'sqlite:///'+path.join(temporary,'e2e.db').replaceAll('\\','/'),APP_ORIGIN:'http://127.0.0.1:8050'};
const base='http://127.0.0.1:8050';
const output=path.join(root,'front/tests/artifacts');fs.mkdirSync(output,{recursive:true});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
let server,browser,logs='';
(async()=>{
  for(const args of [['-m','alembic','upgrade','head'],['-m','backend.app.seed']]) {
    const result=spawnSync(python,args,{cwd:root,env,encoding:'utf8',windowsHide:true});
    assert.equal(result.status,0,result.stderr||result.error?.message);
  }
  server=spawn(python,['-m','uvicorn','backend.app.main:app','--host','127.0.0.1','--port','8050'],{cwd:root,env,windowsHide:true,stdio:['ignore','pipe','pipe']});
  server.stdout.on('data',d=>logs+=d);server.stderr.on('data',d=>logs+=d);
  let ready=false;
  for(let i=0;i<60;i++) {try{const response=await fetch(base+'/api/health');if(response.ok){ready=true;break;}}catch{}await pause(500);}
  assert(ready,'API startup failed: '+logs);
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
  page.on('pageerror',error=>errors.push(String(error)));page.setDefaultTimeout(12000);
  const go=name=>page.goto(base+'/pages/'+name,{waitUntil:'domcontentloaded'});
  await go('main.html');await page.getByText('Войти снова',{exact:true}).waitFor();
  await go('register.html');await page.fill('#name','Анна');await page.fill('#email','browser@example.com');
  await page.fill('#password','browser-password-123');await page.fill('#password2','browser-password-123');
  await page.check('#agree');await page.getByRole('button',{name:'Создать аккаунт',exact:true}).click();
  await page.waitForURL('**/main.html');await page.getByText('Здравствуйте, Анна',{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>typeof window.Platform),'undefined');
  assert.equal(await page.locator('.server-card').count(),12);
  await go('training.html?competency=qa-http-methods');await page.click('#practice');
  await page.waitForURL('**/training-question-1.html?id=*');await page.locator('#answer-form').waitFor();
  const sessionUrl=page.url();
  await page.locator('input[name=answer]').first().check();
  await page.click('#hint');await page.getByText('Ответ с подсказкой не подтверждает самостоятельное знание.',{exact:false}).waitFor();
  await page.click('#pause');await page.locator('#resume').waitFor();await page.reload();await page.locator('#resume').waitFor();
  await page.click('#resume');await page.locator('#answer-form').waitFor();assert(await page.locator('input[name=answer]').first().isChecked());
  // Recoverable failure retains selection and request key, then real retry succeeds.
  await page.route('**/api/sessions/*/answers',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({detail:'Временная ошибка проверки. Повторите действие.'})}));
  await page.getByRole('button',{name:'Отправить ответ',exact:true}).click();await page.getByText('Временная ошибка проверки. Повторите действие.',{exact:true}).waitFor();
  assert(await page.locator('input[name=answer]').first().isChecked());
  await page.unroute('**/api/sessions/*/answers');await page.getByRole('button',{name:'Отправить ответ',exact:true}).click();
  await page.getByText('Результат: 100%',{exact:true}).waitFor();assert(await page.getByText('с подсказкой',{exact:false}).count()>0);
  await page.reload();await page.getByText('Результат: 100%',{exact:true}).waitFor();
  await go('training-history.html');await page.locator('.server-card').waitFor();assert.equal(await page.locator('.server-card').count(),1);
  await go('kb-1.html');const favorite=page.locator('[data-favorite]').first();await favorite.click();
  await page.waitForFunction(()=>document.querySelector('[data-favorite]').getAttribute('aria-pressed')==='true');
  await go('kb-1.html?view=favorites');await page.locator('.server-card').waitFor();assert.equal(await page.locator('.server-card').count(),1);
  await go('profile-1.html');await page.fill('#profile-name','Мария');await page.getByRole('button',{name:'Сохранить профиль',exact:true}).click();
  await page.getByText('Профиль сохранён на сервере.',{exact:true}).waitFor();await page.reload();await page.locator('#profile-name').waitFor();assert.equal(await page.inputValue('#profile-name'),'Мария');
  await go('training.html');await page.click('#exam');await page.locator('#answer-form').waitFor();assert.equal(await page.locator('#hint').count(),0);
  await page.locator('#countdown').waitFor();await page.click('#finish');await page.getByText('Результат: 0%',{exact:true}).waitFor();
  await go('main.html');await page.locator('#diagnostic').waitFor();
  for(const width of [320,390,768,1440]) {
    await page.setViewportSize({width,height:844});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'horizontal overflow at '+width);
  }
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(output,'server-plan-light.png')});
  await page.locator('.side-menu-theme').click();assert.equal(await page.getAttribute('html','data-theme'),'dark');await page.screenshot({path:path.join(output,'server-plan-dark.png')});
  await go('documents.html');await page.getByText('Функция ещё не перенесена на сервер',{exact:true}).waitFor();
  await go('profile-1.html');await page.click('#logout');await page.waitForURL('**/login.html');
  await page.goto(sessionUrl);await page.getByText('Войти снова',{exact:true}).waitFor();
  await go('login.html');await page.fill('#email','browser@example.com');await page.fill('#password','browser-password-123');await page.getByRole('button',{name:'Войти',exact:true}).click();
  await page.waitForURL('**/main.html');await page.getByText('Здравствуйте, Мария',{exact:true}).waitFor();
  assert.deepEqual(errors,[]);
  console.log('SERVER FLOW PASS: auth, session, pause/reload, retry, report, history, plan, favorites, profile, exam, themes, availability');
})().catch(error=>{console.error(error);if(logs)console.error(logs.slice(-3000));process.exitCode=1;}).finally(async()=>{
  await browser?.close();
  if(server && server.exitCode===null){server.kill();await new Promise(resolve=>{server.once('exit',resolve);setTimeout(resolve,5000);});}
});
