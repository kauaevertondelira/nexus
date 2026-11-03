import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {siteURL,serveLocalSite} from './site-fixture.mjs';

const browser=await chromium.launch({headless:true,...(process.env.NEXUS_BROWSER_PATH?{executablePath:process.env.NEXUS_BROWSER_PATH}:{})});
try {
  for(const mobile of [false,true]) {
    const errors=[];
    const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},reducedMotion:'reduce',serviceWorkers:'block'});
    await serveLocalSite(context);
    const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
    await page.goto(siteURL);
    await page.waitForFunction(()=>window.Nexus?.swup&&Nexus.route==='index');
    const documentId=await page.evaluate(()=>window.navigationTestId=crypto.randomUUID());
    if(mobile) {
      await page.getByRole('link',{name:'Acessar sistema',exact:true}).click();
      await page.waitForFunction(()=>window.Nexus?.route==='login');
      await page.locator('[data-action="demo-enter"]').click();
    }else await page.getByRole('link',{name:'Explorar a Nexus',exact:true}).click();
    async function rendered(route) {
      await page.waitForFunction(value=>Nexus.route===value&&document.querySelector('#view-body')?.children.length>0,route);
      const text=await page.locator('#view-body').innerText();
      assert.equal(await page.locator('#view-body > .notice.error').count(),0,text);
      assert.equal(await page.evaluate(()=>window.navigationTestId),documentId,'A navegação recarregou o documento e deixou de testar o Swup');
    }
    async function navigate(route) {
      if(mobile)await page.locator('[data-action="mobile-menu"]').click();
      await page.locator('.nav-link[href$="/'+route+'.html"]').click();
      await rendered(route);
    }
    await rendered('menu');
    assert.ok(await page.getByRole('heading',{name:'Produção contabilizada',exact:true}).isVisible());
    await navigate('producao');
    await page.waitForSelector('#production-asset');
    assert.equal(await page.evaluate(()=>typeof Nexus.productionView),'function');
    await navigate('executivo');
    assert.ok(await page.getByRole('heading',{name:'Produção contabilizada',exact:true}).isVisible());
    await navigate('ativos');
    await page.locator('#view-body a[href*="ativo-detalhes.html?id="]').first().click();
    await rendered('ativo-detalhes');
    assert.ok(await page.getByRole('heading',{name:'Produção contabilizada',exact:true}).isVisible());
    assert.deepEqual(errors,[]);
    console.log('PASS · '+(mobile?'celular: início → acesso → demonstração':'desktop: início → demonstração')+' → visão global → produção → executivo → ativo, com Swup e o mesmo documento.');
    await context.close();
  }
}finally{await browser.close();}
