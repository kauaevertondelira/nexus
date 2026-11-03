(function(N) {
  'use strict';
  const roles=['Administrador','Técnico de Manutenção','Gestor de Manutenção','Supervisor de Produção'];
  const validKey=value=>typeof value==='string'&&value.length>0&&value.length<=100&&!/[.#$\[\]\/\u0000-\u001f\u007f]/.test(value)&&!['__proto__','prototype','constructor'].includes(value);
  const uniqueId=prefix=>prefix+'-'+(crypto.randomUUID?crypto.randomUUID():Array.from(crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join(''));
  const timestamp=()=>({'.sv':'timestamp'}),increment=()=>({'.sv':{increment:1}});
  let flushing=null,flushKey='',syncTimer=null;
  N.productionSync={busy:false,error:''};
  N.canProduce=function(){return !!this.user&&roles.includes(this.role())&&this.canAccess('producao')&&!['pending','blocked','disabled','suspended'].includes(this.user.accessStatus);};
  N.requireProduction=function(){if(!this.canProduce())throw new Error('Seu perfil não permite registrar produção.');};
  N.productionQueuePrefix=function(){return 'nexus-production-v1:'+encodeURIComponent(this.base.href+'|'+(window.NEXUS_FIREBASE_CONFIG?.databaseURL||'')+'|'+this.mode+'|'+this.uid)+':';};
  N.pendingProduction=function(){
    const prefix=this.productionQueuePrefix(),events=[];
    for(let i=0;i<localStorage.length;i++) {
      const key=localStorage.key(i);if(!key?.startsWith(prefix))continue;
      let event;try{event=JSON.parse(localStorage.getItem(key));}catch{throw new Error('Há um registro de produção local ilegível. Preserve o armazenamento e contate o administrador.');}
      if(!event||!validKey(event.id)||!validKey(event.sessionId)||!validKey(event.assetId)||event.createdByUid!==this.uid||!['camera','manual'].includes(event.source)||!Number.isFinite(event.detectedAt))throw new Error('Há um registro de produção local inválido. Preserve o armazenamento para recuperação.');
      events.push(event);
    }
    return events.sort((a,b)=>a.detectedAt-b.detectedAt||a.id.localeCompare(b.id));
  };
  N.notifyProduction=function(){document.dispatchEvent(new CustomEvent('nexus:production'));};
  N.productionRequest=async function(method,path,body) {
    const token=await this.auth.currentUser.getIdToken(),baseURL=window.NEXUS_FIREBASE_CONFIG.databaseURL.replace(/\/$/,'');
    const url=new URL(baseURL+'/'+path.split('/').map(encodeURIComponent).join('/')+'.json');url.searchParams.set('auth',token);
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
    try {
      const response=await fetch(url,{method,signal:controller.signal,cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',headers:{'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
      if(!response.ok){const error=new Error([401,403].includes(response.status)?'O banco recusou o registro. Confira a aprovação da conta, a sessão e as regras de produção publicadas.':'O banco não confirmou o registro. A peça continua na fila para nova tentativa.');error.code=[401,403].includes(response.status)?'PERMISSION_DENIED':'production/unavailable';throw error;}
      return await response.json();
    }finally{clearTimeout(timer);}
  };
  N.createProductionSession=async function(assetId,label) {
    this.requireProduction();
    if(!validKey(assetId)||!this.data.assets?.[assetId])throw new Error('Selecione uma máquina cadastrada.');
    label=String(label||'').trim();if(label.length<2||label.length>100)throw new Error('Informe uma identificação de 2 a 100 caracteres.');
    if(this.mode==='firebase'&&!this.online)throw new Error('Reconecte para iniciar uma sessão no banco.');
    const id=uniqueId('SES'),record={assetId,label,status:'open',createdByUid:this.uid,startedAt:Date.now()};
    if(this.mode==='demo'){this.data.production_sessions??={};this.data.production_sessions[id]=record;this.persist();this.changed('production_sessions');}
    else await this.db.ref('production_sessions/'+id).set({...record,startedAt:timestamp()});
    return id;
  };
  N.queueProductionPiece=function(sessionId,source='camera') {
    this.requireProduction();
    const session=this.data.production_sessions?.[sessionId];
    if(!validKey(sessionId)||!session||session.status!=='open'||session.createdByUid!==this.uid||!this.data.assets?.[session.assetId])throw new Error('Abra uma sessão sua para uma máquina existente.');
    if(!['camera','manual'].includes(source))throw new Error('Origem de contagem inválida.');
    if(this.pendingProduction().length>=300)throw new Error('A fila chegou a 300 peças. Sincronize os registros antes de continuar.');
    const event={id:uniqueId('PEC'),assetId:session.assetId,sessionId,source,createdByUid:this.uid,detectedAt:Date.now()};
    try{localStorage.setItem(this.productionQueuePrefix()+event.id,JSON.stringify(event));}catch{throw new Error('Não foi possível guardar a peça neste aparelho. Libere espaço antes de continuar a contagem.');}
    this.notifyProduction();void this.flushProduction();return event.id;
  };
  N.productionPatch=function(event) {
    const {id,...record}=event;
    const common={count:increment(),lastEventId:id,updatedAt:timestamp()};
    const patch={['production_events/'+event.assetId+'/'+id]:{...record,receivedAt:timestamp()}};
    for(const [path,summary]of Object.entries({['production_totals/'+event.assetId]:{...common,lastSessionId:event.sessionId},['production_session_totals/'+event.sessionId]:{...common,assetId:event.assetId}})) {
      for(const [key,value]of Object.entries(summary))patch[path+'/'+key]=value;
    }
    return patch;
  };
  N.commitProductionDemo=function(event) {
    if(this.data.production_events?.[event.assetId]?.[event.id])return;
    const previous=this.data;this.data=JSON.parse(JSON.stringify(previous));
    this.data.production_events??={};const events=this.data.production_events[event.assetId]??={};
    const {id,...record}=event;events[id]={...record,receivedAt:Date.now()};
    this.data.production_totals??={};this.data.production_session_totals??={};
    for(const [collection,key,extra]of [['production_totals',event.assetId,{lastSessionId:event.sessionId}],['production_session_totals',event.sessionId,{assetId:event.assetId}]]) {
      const old=this.data[collection][key]||{};
      this.data[collection][key]={count:(old.count||0)+1,lastEventId:id,updatedAt:Date.now(),...extra};
    }
    try{this.persist();}catch(error){this.data=previous;throw error;}this.changed('production_totals');
  };
  N.flushProduction=function() {
    if(!this.user||!this.canProduce()||this.mode==='firebase'&&!this.online)return Promise.resolve();
    const key=this.productionQueuePrefix(),uid=this.uid,mode=this.mode;
    if(flushing)return flushKey===key?flushing:Promise.resolve();
    flushKey=key;this.productionSync={busy:true,error:''};
    flushing=Promise.resolve().then(async()=>{
      try {
        for(const event of this.pendingProduction()) {
          if(this.uid!==uid||this.mode!==mode||!this.user||mode==='firebase'&&!this.online)break;
          if(mode==='demo')this.commitProductionDemo(event);
          else {
            try{await this.productionRequest('PATCH','',this.productionPatch(event));}
            catch(error) {
              // Uma resposta perdida pode ter ocorrido depois do commit. Reusar o ID
              // e conferir o evento evita incrementar novamente na reconexão.
              let existing;try{existing=await this.productionRequest('GET','production_events/'+event.assetId+'/'+event.id);}catch{}
              if(!existing||!['assetId','sessionId','source','createdByUid','detectedAt'].every(k=>existing[k]===event[k]))throw error;
            }
          }
          localStorage.removeItem(key+event.id);
          if(this.uid===uid&&this.mode===mode)this.notifyProduction();
        }
      }catch(error){if(this.uid===uid&&this.mode===mode)this.productionSync.error=this.errorText(error);}
      finally{if(this.uid===uid&&this.mode===mode){this.productionSync.busy=false;this.notifyProduction();}flushing=null;}
    });
    return flushing;
  };
  N.finishProductionSession=async function(id) {
    this.requireProduction();const session=this.data.production_sessions?.[id];
    if(!session||session.createdByUid!==this.uid||session.status!=='open')throw new Error('Esta sessão não está aberta na sua conta.');
    await this.flushProduction();
    if(this.pendingProduction().some(e=>e.sessionId===id))throw new Error('Sincronize todas as peças desta sessão antes de encerrar.');
    if(this.mode==='firebase'&&!this.online)throw new Error('Reconecte para encerrar a sessão.');
    if(this.mode==='demo'){Object.assign(session,{status:'closed',endedAt:Date.now()});this.persist();this.changed('production_sessions');}
    else await this.db.ref('production_sessions/'+id).update({status:'closed',endedAt:timestamp()});
  };
  N.startProductionSync=function(){if(!syncTimer)syncTimer=setInterval(()=>{if(!document.hidden)void this.flushProduction();},5000);void this.flushProduction();};
  N.stopProductionSync=function(){clearInterval(syncTimer);syncTimer=null;this.stopProductionCamera?.();this.stopProductionWatch?.();};
  N.productionCount=function(assetId){return this.num(this.data.production_totals?.[assetId]?.count);};
})(window.Nexus);
