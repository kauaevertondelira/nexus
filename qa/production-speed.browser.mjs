import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {siteURL,serveLocalSite} from './site-fixture.mjs';

const browser=await chromium.launch({headless:true,...(process.env.NEXUS_BROWSER_PATH?{executablePath:process.env.NEXUS_BROWSER_PATH}:{})});
try {
  for(const fallback of [false,true]) {
    const errors=[];
    const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce',serviceWorkers:'block'});
    await serveLocalSite(context);
    await context.addInitScript(({fallback})=>{
      const nativeFrame=HTMLVideoElement.prototype.requestVideoFrameCallback;
      if(fallback)Object.defineProperty(HTMLVideoElement.prototype,'requestVideoFrameCallback',{value:undefined});
      const canvas=document.createElement('canvas');canvas.width=640;canvas.height=480;
      const ctx=canvas.getContext('2d');
      window.testSensor={present:false,small:false,frozen:false,tracks:[],nextFrame:video=>new Promise(resolve=>nativeFrame.call(video,resolve))};
      const draw=()=>{
        ctx.fillStyle='#505050';ctx.fillRect(0,0,640,480);
        if(testSensor.present) {
          ctx.fillStyle=testSensor.small?'#626262':'#d0d0d0';
          if(testSensor.small)ctx.fillRect(240,210,70,44);
          else ctx.fillRect(180,160,160,120);
        }
      };
      testSensor.draw=draw;
      setInterval(()=>{if(!testSensor.frozen){draw();testSensor.tracks.at(-1)?.requestFrame();}},40);
      Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:async()=>{
        const stream=canvas.captureStream(0);testSensor.tracks.push(...stream.getTracks());return stream;
      }});
    },{fallback});
    const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
    await page.goto(new URL('public/pages/producao.html?demo=1',siteURL).href);
    await page.locator('[data-action="production-new"][data-id="M-204"]').click();
    await page.locator('#simple-form').evaluate(form=>form.requestSubmit());
    await page.waitForSelector('#camera-start');
    assert.equal(await page.locator('#camera-sensitivity').inputValue(),'high');
    assert.equal(await page.locator('#camera-cooldown').inputValue(),'80');
    await page.locator('#camera-start').click();
    await page.locator('#camera-calibrate:not([disabled])').waitFor();
    await page.locator('#camera-calibrate').click();
    await page.waitForFunction(()=>document.querySelector('#camera-status').textContent.includes('Sensor pronto'));
    await page.evaluate(()=>{testSensor.frozen=true;testSensor.present=true;testSensor.draw();testSensor.tracks.at(-1).requestFrame();});
    await page.waitForTimeout(300);
    assert.equal(await page.locator('#camera-session-count').textContent(),'0','Um único quadro congelado gerou contagem');
    await page.evaluate(()=>{testSensor.present=false;testSensor.frozen=false;});
    await page.waitForTimeout(120);
    await page.evaluate(()=>testSensor.present=testSensor.small=true);
    await page.waitForFunction(()=>document.querySelector('#camera-session-count').textContent==='1');
    await page.waitForTimeout(1000);
    assert.equal(await page.locator('#camera-session-count').textContent(),'1','Peça pequena parada repetiu a contagem');
    await page.evaluate(()=>testSensor.present=testSensor.small=false);
    await page.waitForFunction(()=>document.querySelector('#camera-status').textContent.includes('Sensor pronto'));
    // Quatro quadros por fase incluem a transição do canvas e deixam uma folga
    // de apenas cerca de 160 ms: menos que a antiga liberação de 220 ms.
    await page.evaluate(async()=>{
      const video=document.querySelector('#production-video');
      for(let piece=0;piece<12;piece++)for(const present of [true,false]) {
        testSensor.present=present;
        for(let frame=0;frame<4;frame++)await testSensor.nextFrame(video);
      }
    });
    await page.waitForFunction(()=>document.querySelector('#camera-session-count').textContent==='13');
    assert.equal(await page.evaluate(()=>Nexus.productionCount('M-204')),13);
    // O valor zero deve ser aceito também pela validação da interface.
    await page.locator('#camera-cooldown').fill('0');await page.locator('#camera-cooldown').blur();
    await page.locator('#camera-calibrate').click();
    await page.waitForFunction(()=>document.querySelector('#camera-status').textContent.includes('Sensor pronto'));
    await page.evaluate(()=>testSensor.present=true);
    await page.waitForFunction(()=>document.querySelector('#camera-session-count').textContent==='14');
    assert.equal(await page.locator('#camera-error').textContent(),'');
    await page.locator('#camera-pause').click();
    assert.ok(await page.evaluate(()=>testSensor.tracks.every(track=>track.readyState==='ended')));
    assert.deepEqual(errors,[]);
    console.log('PASS · '+(fallback?'fallback requestAnimationFrame':'requestVideoFrameCallback')+': quadro congelado ignorado, peça pequena de baixo contraste, objeto parado, 12 passagens próximas, intervalo 0 e pausa.');
    await context.close();
  }
}finally{await browser.close();}
