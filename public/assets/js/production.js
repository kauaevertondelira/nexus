(function(N) {
  'use strict';
  const e=N.escape,icon=N.icon;
  let camera=null,watch=null,recent=[],watchError='';
  const sourceLabel=value=>value==='camera'?'Câmera':'Manual';
  N.productionSummary=function(assetId='') {
    const count=assetId?this.productionCount(assetId):Object.values(this.data.production_totals||{}).reduce((sum,row)=>sum+this.num(row.count),0);
    return '<section class="panel"><header class="panel-header"><h2>Produção contabilizada</h2>'+(this.canAccess('producao')?'<a class="btn btn-sm" data-swup href="'+this.href('producao',assetId?'?asset='+encodeURIComponent(assetId):'')+'">'+icon('chart')+'Acompanhar produção</a>':'')+'</header><div class="panel-body"><div class="big-stat">'+this.number(count)+'<small> peças</small></div><p class="tagline">Passagens registradas desde o início da contagem. Inclui câmera e lançamentos manuais identificados no histórico.</p></div></section>';
  };
  N.stopProductionWatch=function(){if(watch){watch.ref.off('value',watch.callback);watch=null;}recent=[];watchError='';};
  N.watchProductionEvents=function(assetId) {
    if(this.mode==='demo')return Object.entries(this.data.production_events?.[assetId]||{}).map(([id,value])=>({id,...value})).sort((a,b)=>b.receivedAt-a.receivedAt).slice(0,30);
    if(watch?.assetId===assetId)return recent;
    this.stopProductionWatch();if(!assetId)return [];
    const ref=this.db.ref('production_events/'+assetId).orderByChild('receivedAt').limitToLast(30);
    const callback=snap=>{recent=Object.entries(snap.val()||{}).map(([id,value])=>({id,...value})).sort((a,b)=>b.receivedAt-a.receivedAt);this.changed('production_events');};
    watch={assetId,ref,callback};ref.on('value',callback,()=>{watchError='Não foi possível carregar o histórico desta máquina. Confira a conexão e as regras.';this.changed('production_events');});return [];
  };
  N.productionView=function() {
    const assets=this.entries('assets'),sessions=this.entries('production_sessions').sort((a,b)=>b.startedAt-a.startedAt),open=sessions.filter(s=>s.status==='open');
    const selected=this.productionAssetId||'',rows=assets.filter(a=>!selected||a.id===selected);
    const total=rows.reduce((sum,a)=>sum+this.productionCount(a.id),0),pending=this.pendingProduction(),can=this.canProduce();
    const current=sessions.filter(s=>!selected||s.assetId===selected).slice(0,30);
    const history=selected?this.watchProductionEvents(selected):[];
    if(!selected&&watch)this.stopProductionWatch();
    this.exportRows=rows.map(a=>({id:a.id,name:a.name,count:this.productionCount(a.id),updatedAt:this.data.production_totals?.[a.id]?.updatedAt}));
    this.exportColumns=[{label:'Máquina',key:'id'},{label:'Equipamento',key:'name'},{label:'Peças contabilizadas',key:'count'},{label:'Último registro',key:'updatedAt',value:r=>this.date(r.updatedAt,true)}];
    return this.heading('Produção','Cada passagem registrada soma uma peça à máquina e à sessão.',this.exportButtons()+(can?'<button class="btn btn-primary" data-action="production-new">'+icon('camera')+'Nova sessão</button>':''))+
      (this.mode==='demo'?'<div class="notice production-notice">'+icon('help')+'<span>Ambiente de demonstração. A câmera funciona, mas os registros ficam somente neste navegador. Entre com uma conta aprovada para sincronizar com o sistema web e o Firebase.</span></div>':'')+
      (pending.length||this.productionSync.error?'<div class="notice warning production-notice" role="status"><span>'+pending.length+' peça(s) aguardando confirmação neste aparelho. '+e(this.productionSync.error||'A fila será reenviada ao conectar. Não apague o armazenamento antes de sincronizar.')+'</span><button class="btn btn-sm" data-action="production-sync">Tentar sincronizar</button></div>':'')+
      '<div class="metrics">'+this.metric('Peças contabilizadas',this.number(total),'Total acumulado nas máquinas selecionadas','box',true)+this.metric('Máquinas com produção',rows.filter(a=>this.productionCount(a.id)>0).length,rows.length+' máquinas cadastradas','machine')+this.metric('Sessões abertas',open.filter(s=>!selected||s.assetId===selected).length,'Câmeras podem estar pausadas','radio')+this.metric('Na fila deste aparelho',pending.length,this.mode==='demo'?'Armazenamento local':'Aguardando confirmação do banco','repeat')+'</div>'+
      '<div class="view-toolbar"><label class="production-filter" for="production-asset">Máquina<select class="input" id="production-asset"><option value="">Todas as máquinas</option>'+assets.map(a=>'<option value="'+e(a.id)+'"'+(a.id===selected?' selected':'')+'>'+e((a.tag||a.id)+' · '+a.name)+'</option>').join('')+'</select></label><p class="tagline">Use um celular fixo por ponto de passagem. A contagem pela câmera simula um sensor.</p></div>'+
      '<div class="sensor-grid">'+rows.map(a=>{const summary=this.data.production_totals?.[a.id];return '<article class="sensor-card"><div class="spaced"><h3>'+e(a.name)+'</h3><span class="chip">'+e(a.tag||a.id)+'</span></div><p class="tagline">'+e(a.area)+'</p><div class="production-total">'+this.number(this.productionCount(a.id))+'<small> peças</small></div><p class="tagline">Última peça · '+this.date(summary?.updatedAt,true)+'</p>'+(can?'<button class="btn btn-sm" data-action="production-new" data-id="'+e(a.id)+'">'+icon('camera')+'Contar nesta máquina</button>':'')+'</article>';}).join('')+'</div>'+
      (assets.length?'':this.empty('Cadastre uma máquina para iniciar','Os totais serão vinculados ao cadastro do ativo.','machine'))+
      '<section class="panel production-section"><header class="panel-header"><h2>Sessões de contagem</h2><span class="tagline">Até 30 mais recentes</span></header><div class="table-wrap"><table class="data-table"><thead><tr><th>Sessão / máquina</th><th>Início</th><th>Peças</th><th>Situação</th><th>Ações</th></tr></thead><tbody>'+current.map(s=>'<tr><td><strong>'+e(s.label)+'</strong><small>'+e(this.asset(s.assetId).name||s.assetId)+'</small></td><td>'+this.date(s.startedAt,true)+'</td><td class="mono">'+this.number(this.data.production_session_totals?.[s.id]?.count||0)+'</td><td>'+this.badge(s.status==='open'?'active':'completed',s.status==='open'?'Aberta':'Encerrada')+'</td><td>'+(can&&s.createdByUid===this.uid&&s.status==='open'?'<button class="btn btn-sm" data-action="production-camera" data-id="'+e(s.id)+'">'+icon('camera')+'Continuar sessão</button>':'—')+'</td></tr>').join('')+'</tbody></table></div>'+(current.length?'':'<div class="panel-body"><p class="tagline">Nenhuma sessão iniciada para esta seleção.</p></div>')+'</section>'+
      '<section class="panel production-section"><header class="panel-header"><h2>Últimas passagens</h2><span class="tagline">30 registros mais recentes por máquina</span></header><div class="panel-body">'+(watchError?'<p class="form-error" role="alert">'+e(watchError)+'</p>':'')+(!selected?'<p class="tagline">Selecione uma máquina para consultar os eventos recebidos e a origem de cada peça.</p>':history.length?'<div class="mini-list">'+history.map(v=>'<div class="mini-list-item"><div><strong>+1 peça · '+e(sourceLabel(v.source))+'</strong><small>'+e(this.data.production_sessions?.[v.sessionId]?.label||v.sessionId)+' · '+this.date(v.receivedAt,true)+'</small></div><span class="mono production-event-id" title="'+e(v.id)+'">'+e(v.id.slice(-8))+'</span></div>').join('')+'</div>':'<p class="tagline">Nenhuma passagem recebida para esta máquina.</p>')+'</div></section>'+
      '<div class="notice production-section">'+icon('help')+'<span>Este total representa passagens. Qualidade da peça, refugo e OEE exigem apontamentos próprios. As imagens são processadas no aparelho; somente os eventos de contagem são enviados.</span></div>';
  };
  N.newProductionSession=function(assetId='') {
    this.requireProduction();if(!this.entries('assets').length){this.toast('Cadastre uma máquina no Parque de ativos antes de iniciar.','warning');return;}
    const field=(key,label,type,extra={})=>({key,label,type,...extra});
    this.simpleForm('Nova sessão de produção',[field('assetId','Máquina que receberá as peças','asset',{required:true,default:assetId||this.productionAssetId||'',full:true}),field('label','Identificação da sessão / turno','text',{required:true,minLength:2,max:100,default:'Câmera · '+this.dateInput(Date.now()),full:true})],async data=>{
      const id=await this.createProductionSession(String(data.get('assetId')),String(data.get('label')));
      setTimeout(()=>this.openProductionCamera(id),0);
    },'Fixe o celular, mantenha a iluminação estável e deixe a área de passagem livre para calibrar. Cada nova passagem contará uma peça.');
  };
  N.stopProductionCamera=function() {
    if(!camera)return;const state=camera;camera=null;
    clearTimeout(state.timer);state.stream?.getTracks().forEach(track=>track.stop());
    if(state.video)state.video.srcObject=null;
    state.releaseLock?.();state.wakeLock?.release().catch(()=>{});
  };
  N.pauseProductionCamera=function(){if(!camera)return;const root=camera.root;this.stopProductionCamera();root.querySelector('#camera-start').disabled=false;root.querySelector('#camera-calibrate').disabled=true;root.querySelector('#camera-pause').disabled=true;root.querySelector('#camera-placeholder').hidden=false;root.querySelector('#camera-status').textContent='Câmera pausada porque a Nexus saiu do primeiro plano. Ative e calibre para continuar.';};
  const cameraError=error=>({NotAllowedError:'O acesso à câmera foi negado. Autorize a câmera nas permissões do navegador ou do aplicativo e tente novamente.',NotFoundError:'Nenhuma câmera foi encontrada neste aparelho.',NotReadableError:'A câmera está ocupada. Feche o outro aplicativo que está usando a câmera.',OverconstrainedError:'Esta câmera não oferece a configuração solicitada.'}[error.name]||N.errorText(error));
  N.openProductionCamera=function(id) {
    this.requireProduction();const session=this.data.production_sessions?.[id];
    if(!session||session.createdByUid!==this.uid||session.status!=='open')throw new Error('Abra uma sessão de produção da sua conta.');
    const root=this.modal('Sensor por câmera · '+session.label,
      '<p class="tagline">'+e(this.asset(session.assetId).name||session.assetId)+' · '+e(session.assetId)+'</p><div class="camera-preview"><video id="production-video" autoplay muted playsinline aria-label="Prévia local da câmera"></video><div class="camera-region" aria-hidden="true"><span>Área de passagem</span></div><p id="camera-placeholder">Ative a câmera e mantenha esta área livre.</p></div>'+
      '<div class="production-camera-stats"><div><small>Peças nesta sessão</small><strong id="camera-session-count">0</strong></div><div><small>Total da máquina</small><strong id="camera-asset-count">0</strong></div><div><small>Na fila deste aparelho</small><strong id="camera-pending">0</strong></div></div>'+
      '<p class="notice" id="camera-status" role="status" aria-live="polite">Câmera desativada. Nenhuma passagem será contada até calibrar.</p><p class="tagline" id="camera-sync" aria-live="polite"></p><p class="form-error" id="camera-sync-error" role="alert"></p><button class="btn btn-sm" id="camera-sync-retry" data-action="production-sync" hidden>Sincronizar fila</button><p class="form-error" id="camera-error" role="alert"></p>'+
      '<div class="form-grid production-section"><div class="form-field"><label for="camera-sensitivity">Sensibilidade</label><select class="input" id="camera-sensitivity"><option value="normal">Normal</option><option value="high">Alta · objetos menores</option><option value="low">Baixa · menos interferência</option></select></div><div class="form-field"><label for="camera-cooldown">Intervalo mínimo entre peças (ms)</label><input class="input" id="camera-cooldown" type="number" min="300" max="10000" step="100" value="800"></div></div>'+
      '<div class="hero-actions"><button class="btn btn-primary" id="camera-start">'+icon('camera')+'Ativar câmera</button><button class="btn" id="camera-calibrate" disabled>Calibrar área livre</button><button class="btn" id="camera-pause" disabled>Pausar câmera</button></div>'+
      '<p class="tagline production-section">Passe uma peça ou mão pelo retângulo e retire-a completamente antes da próxima passagem. Um objeto parado conta uma vez. Fechar ou sair desta tela pausa a câmera; a sessão permanece aberta para continuar depois.</p><details class="production-section"><summary>Lançamento manual</summary><p class="tagline">Use para registrar uma peça observada sem a câmera. A origem ficará identificada como Manual.</p><button class="btn btn-sm" id="camera-manual">Registrar +1 manual</button></details>',
      '<button class="btn" data-action="close-modal">Fechar / pausar</button><button class="btn btn-primary" id="camera-finish">Encerrar sessão</button>');
    const dialog=root.querySelector('.modal');dialog.classList.add('production-sensor-modal');dialog.tabIndex=-1;dialog.focus({preventScroll:true});dialog.scrollTop=0;
    const status=root.querySelector('#camera-status'),error=root.querySelector('#camera-error'),video=root.querySelector('video');
    const start=root.querySelector('#camera-start'),calibrate=root.querySelector('#camera-calibrate'),pause=root.querySelector('#camera-pause');
    let starting=false;
    const stop=message=>{this.stopProductionCamera();start.disabled=false;calibrate.disabled=true;pause.disabled=true;root.querySelector('#camera-placeholder').hidden=false;status.textContent=message;};
    const guarded=fn=>async()=>{error.textContent='';try{await fn();}catch(err){error.textContent=cameraError(err);}};
    const beginCalibration=()=>{
      if(!camera||camera.root!==root)return;
      const cooldown=Number(root.querySelector('#camera-cooldown').value);
      if(!Number.isFinite(cooldown)||cooldown<300||cooldown>10000)throw new Error('Use um intervalo entre 300 e 10.000 ms.');
      camera.detector=new this.PassageDetector({sensitivity:root.querySelector('#camera-sensitivity').value,cooldownMs:cooldown});
      camera.calibrating=true;status.textContent='Calibrando. Mantenha a área de passagem livre por dois segundos.';
      dialog.focus({preventScroll:true});root.querySelector('.modal-body').scrollTop=0;
    };
    start.addEventListener('click',guarded(async()=>{
      if(starting||camera)return;
      if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia)throw new Error('A câmera exige HTTPS ou localhost e um navegador com suporte a vídeo. Abra a Nexus publicada por HTTPS.');
      starting=true;start.disabled=true;
      const state={root,sessionId:id,video,detector:null};camera=state;
      try {
        if(navigator.locks) {
          let acquired;const ready=new Promise(resolve=>{acquired=resolve;});
          void navigator.locks.request('nexus-camera:'+this.productionQueuePrefix()+id,{ifAvailable:true},async lock=>{
            if(!lock){acquired(false);return;}
            const held=new Promise(resolve=>{state.releaseLock=resolve;});acquired(true);await held;
          });
          if(!await ready)throw new Error('Esta sessão já está usando a câmera em outra aba. Pause a outra aba antes de continuar.');
        }
        const stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:640},height:{ideal:480}}});
        if(camera!==state||!root.isConnected){stream.getTracks().forEach(t=>t.stop());return;}
        state.stream=stream;video.srcObject=stream;await video.play();
        if(camera!==state)return;
        root.querySelector('.camera-preview').style.aspectRatio=video.videoWidth+'/'+video.videoHeight;
        root.querySelector('#camera-placeholder').hidden=true;calibrate.disabled=false;pause.disabled=false;
        status.textContent='Câmera ativa. Deixe o retângulo livre e toque em Calibrar área livre para começar a contar.';
        stream.getVideoTracks()[0].addEventListener('ended',()=>{if(camera===state)stop('A câmera foi desconectada. Ative novamente e calibre para continuar.');});
        if(navigator.wakeLock)try{state.wakeLock=await navigator.wakeLock.request('screen');if(camera!==state)await state.wakeLock.release();}catch{}
        const canvas=document.createElement('canvas');canvas.width=80;canvas.height=60;const ctx=canvas.getContext('2d',{willReadFrequently:true});
        const referenceCanvas=document.createElement('canvas');referenceCanvas.width=16;referenceCanvas.height=4;const referenceCtx=referenceCanvas.getContext('2d',{willReadFrequently:true});
        const tick=()=>{
          if(camera!==state)return;
          try {
            const live=this.data.production_sessions?.[id];
            if(!this.canProduce()||live?.status!=='open'||live.createdByUid!==this.uid){stop('Sessão encerrada ou acesso atualizado. A câmera foi pausada.');return;}
            if(this.productionSync.error){stop('Contagem pausada. Resolva a sincronização das peças pendentes antes de continuar.');return;}
            if(state.detector&&video.readyState>=2) {
              const w=video.videoWidth,h=video.videoHeight;
              ctx.drawImage(video,w*.2,h*.25,w*.6,h*.5,0,0,80,60);
              referenceCtx.drawImage(video,0,0,w,h*.08,0,0,16,4);
              const pixels=referenceCtx.getImageData(0,0,16,4).data;let reference=0;for(let i=0;i<pixels.length;i+=4)reference+=(pixels[i]+pixels[i+1]+pixels[i+2])/3;reference/=pixels.length/4;
              const result=state.detector.process(ctx.getImageData(0,0,80,60).data,performance.now(),reference);
              if(result.count)this.queueProductionPiece(id,'camera');
              const messages={calibrating:'Calibrando · '+Math.round((result.progress||0)*100)+'%. Mantenha a área livre.',ready:'Sensor pronto. Passe uma peça pela área marcada.',occupied:'Passagem detectada. Retire o objeto para liberar a próxima peça.',lighting:'A iluminação mudou muito. Mantenha a câmera fixa e calibre novamente com a área livre.'};
              if(status.textContent!==messages[result.state])status.textContent=messages[result.state];root.querySelector('.camera-region').classList.toggle('is-occupied',result.state==='occupied');
            }
            state.timer=setTimeout(tick,100);
          }catch(err){error.textContent=cameraError(err);stop('Contagem pausada. Confira a mensagem antes de continuar.');}
        };
        tick();
      }catch(err){if(camera===state)stop('Câmera desativada. Corrija a permissão ou disponibilidade e tente novamente.');throw err;}
      finally{starting=false;if(!camera&&root.isConnected)start.disabled=false;}
    }));
    calibrate.addEventListener('click',guarded(beginCalibration));
    pause.addEventListener('click',()=>stop('Câmera pausada. Ative e calibre novamente para continuar a mesma sessão.'));
    root.querySelector('#camera-sensitivity').addEventListener('change',()=>{if(camera?.root===root){camera.detector=null;status.textContent='Sensibilidade alterada. Calibre a área livre para retomar.';}});
    root.querySelector('#camera-cooldown').addEventListener('change',()=>{if(camera?.root===root){camera.detector=null;status.textContent='Intervalo alterado. Calibre a área livre para retomar.';}});
    root.querySelector('#camera-manual').addEventListener('click',guarded(async()=>{if(camera?.detector)throw new Error('Pause a câmera antes de lançar uma peça manualmente.');this.queueProductionPiece(id,'manual');}));
    root.querySelector('#camera-finish').addEventListener('click',guarded(async()=>{stop('Encerrando sessão. Aguardando confirmação das peças pendentes.');await this.finishProductionSession(id);this.closeModal();this.refresh();this.toast('Sessão encerrada. O histórico e os totais foram preservados.');}));
    this.productionModal={root,sessionId:id};this.updateProductionModal();
  };
  N.updateProductionModal=function(){
    const modal=this.productionModal;if(!modal?.root.isConnected)return;
    const s=this.data.production_sessions?.[modal.sessionId],pending=this.pendingProduction().filter(v=>v.sessionId===modal.sessionId);
    modal.root.querySelector('#camera-session-count').textContent=this.number(this.data.production_session_totals?.[modal.sessionId]?.count||0);
    modal.root.querySelector('#camera-asset-count').textContent=this.number(this.productionCount(s?.assetId));
    modal.root.querySelector('#camera-pending').textContent=this.number(pending.length);
    modal.root.querySelector('#camera-sync').textContent=this.mode==='demo'?'Demonstração · registros locais':pending.length?pending.length+' peça(s) aguardando confirmação do Firebase neste aparelho.':this.online?'Todos os registros deste aparelho foram confirmados.':'Sem conexão. Os novos registros ficarão na fila deste aparelho.';
    modal.root.querySelector('#camera-sync-error').textContent=this.productionSync.error||'';
    modal.root.querySelector('#camera-sync-retry').hidden=!pending.length&&!this.productionSync.error;
  };
  document.addEventListener('nexus:modal-close',()=>{N.stopProductionCamera();N.productionModal=null;});
  document.addEventListener('nexus:production',()=>{N.updateProductionModal();if(N.route==='producao')N.refresh();});
  document.addEventListener('nexus:data',()=>N.updateProductionModal());
  document.addEventListener('nexus:connection',()=>{N.updateProductionModal();if(N.online)void N.flushProduction();});
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden)N.pauseProductionCamera();
    if(!document.hidden)void N.flushProduction();
  });
  window.addEventListener('pagehide',()=>N.stopProductionCamera());
  window.addEventListener('storage',event=>{if(N.user&&event.key?.startsWith(N.productionQueuePrefix())){N.notifyProduction();void N.flushProduction();}});
})(window.Nexus);
