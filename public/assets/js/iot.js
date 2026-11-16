(function(N){
  'use strict';
  const e=N.escape,finite=value=>typeof value==='number'&&Number.isFinite(value);
  N.sensorValue=function(value,decimals=1){return finite(value)?this.number(value,decimals):'—';};
  N.sensorState=function(config,reading,now=Date.now()){
    if(!config.active)return {status:'offline',label:'Inativo'};
    const timestamp=reading?.measuredAt??reading?.receivedAt;
    if(!reading||!finite(timestamp)||timestamp>now+300000||now-timestamp>300000)return {status:'offline',label:reading?'Leitura antiga':'Aguardando dados'};
    const exceeds=(field,limit)=>finite(reading[field])&&finite(config[limit])&&reading[field]>=config[limit];
    if(exceeds('temperature','tempCritical')||exceeds('vibration','vibrationCritical'))return {status:'critical',label:'Crítico'};
    if(exceeds('temperature','tempWarning')||exceeds('vibration','vibrationWarning'))return {status:'warning',label:'Atenção'};
    return {status:'ok',label:reading.simulated?'Simulação · normal':'Normal'};
  };
  N.sensorValues=function(reading){
    return '<div class="sensor-values iot-sensor-values">'+[['Temperatura','temperature',1,'°C'],['Vibração','vibration',2,'mm/s'],['Rotação','rpm',0,'RPM'],['Nível de fluido','fluidLevel',0,'%']].map(([label,field,decimals,unit])=>'<div><small>'+label+'</small><strong>'+this.sensorValue(reading?.[field],decimals)+'<small> '+unit+'</small></strong></div>').join('')+'</div>';
  };
  N.machineTelemetryPanel=function(assetId){
    const configs=this.entries('iot_device_config').filter(config=>config.assetId===assetId);
    if(!configs.length)return '';
    return '<section class="panel"><header class="panel-header"><h2>Sensores da máquina</h2><a class="btn btn-sm" data-swup href="'+this.href('iot','?asset='+encodeURIComponent(assetId))+'">Central IoT</a></header><div class="panel-body">'+configs.map(config=>{
      const reading=this.data.telemetry?.latest?.[config.id],state=this.sensorState(config,reading);
      return '<div class="spaced"><strong>'+e(config.label)+'</strong>'+this.badge(state.status,state.label)+'</div>'+this.sensorValues(reading)+'<p class="tagline">Medido · '+(reading?this.date(reading.measuredAt??reading.receivedAt,true):'Aguardando dados')+'</p>';
    }).join('')+'</div></section>';
  };
  N.pythonProductionPanel=function(assetId=''){
    const rows=Object.values(this.data.telemetry?.firestoreProduction||{}).filter(row=>(!assetId||row.assetId===assetId)&&this.data.assets?.[row.assetId]);
    if(!rows.length)return '';
    return '<section class="panel production-section"><header class="panel-header"><h2>Lotes do sistema Python</h2><span class="tagline">Ações de lote disponíveis na IHM</span></header><div class="panel-body"><p class="tagline">Contagem informada pela IHM. A contagem por câmera é apresentada nas sessões de passagem.</p><div class="iot-orders">'+rows.map(row=>'<article class="iot-order" data-python-asset="'+e(row.assetId)+'"><div class="spaced"><strong>'+e(this.asset(row.assetId).name||row.assetId)+'</strong><span class="chip">'+e(row.orderCode)+'</span></div><p>'+e(row.product||'Produto não informado')+'</p><div class="production-total">'+this.sensorValue(row.producedPieces,0)+'<small> / '+this.sensorValue(row.targetPieces,0)+' peças</small></div><p class="tagline">'+e(row.status)+' · '+e(row.shift)+'</p><p class="tagline">Operador · '+e(row.operator||'—')+'</p>'+(row.sourceUpdatedAt?'<p class="tagline">Última atualização · '+this.date(row.sourceUpdatedAt,true)+'</p>':'')+'</article>').join('')+'</div></div></section>';
  };
  N.iotView=function(){
    const assetQuery=new URLSearchParams(location.search||'').get('asset');
    if(this.iotAssetQuery===undefined){this.iotAssetQuery=assetQuery;if(this.iotAssetId===undefined)this.iotAssetId=assetQuery||'';}
    else if(this.iotAssetQuery!==assetQuery){this.iotAssetQuery=assetQuery;this.iotAssetId=assetQuery||'';}
    const selected=this.iotAssetId||'',all=this.entries('iot_device_config'),configs=all.filter(config=>!selected||config.assetId===selected);
    const latest=this.data.telemetry?.latest||{},sync=this.data.telemetry?.integrations?.firestorePython;
    const syncing=sync?.state==='connected'&&finite(sync.checkedAt)&&Date.now()-sync.checkedAt<150000;
    const alerts=this.entries('iot_alerts').filter(alert=>!alert.acknowledged&&(!selected||alert.assetId===selected));
    const history=configs.flatMap(config=>Object.values(this.data.telemetry?.history?.[config.id]||{})).sort((a,b)=>(b.measuredAt??b.receivedAt)-(a.measuredAt??a.receivedAt)).slice(0,30);
    this.exportRows=configs.map(config=>({...config,...latest[config.id]}));
    this.exportColumns=[{label:'Dispositivo',key:'label'},{label:'Máquina',key:'assetId'},{label:'Temperatura °C',key:'temperature'},{label:'Vibração mm/s',key:'vibration'},{label:'Rotação RPM',key:'rpm'},{label:'Nível de fluido %',key:'fluidLevel'},{label:'OP',key:'orderCode'},{label:'Data da leitura',key:'receivedAt',value:row=>row.receivedAt?this.date(row.measuredAt??row.receivedAt,true):'—'}];
    const notice=this.mode==='demo'?'As leituras da demonstração são fictícias. A integração com o Python aparece ao entrar com sua conta.':sync?(syncing?'Sincronização com o sistema Python ativa.':'Sincronização com o Python sem confirmação recente. Abra a IHM para retomar.'):'Aguardando a primeira sincronização do sistema Python.';
    return this.heading('Central IoT','Sensores por máquina, leituras do Python e alertas de condição.',this.exportButtons()+'<a class="btn" data-swup href="'+this.href('producao')+'">'+this.icon('camera')+'Produção</a>'+this.newButton('iot_device_config','Vincular dispositivo'))+
      '<div class="notice iot-notice" role="status">'+this.icon('radio')+'<span>'+e(notice)+(sync?.lastError?' '+e(sync.lastError):'')+'</span></div>'+
      '<div class="view-toolbar"><label class="production-filter" for="iot-asset-filter">Máquina<select class="input" id="iot-asset-filter"><option value="">Todas as máquinas</option>'+this.entries('assets').map(asset=>'<option value="'+e(asset.id)+'"'+(asset.id===selected?' selected':'')+'>'+e((asset.tag||asset.id)+' · '+asset.name)+'</option>').join('')+'</select></label><p class="tagline">Valores ausentes aguardam leitura. O horário indica quando o Python mediu os dados.</p></div>'+
      '<div class="sensor-grid">'+configs.map(config=>{
        const reading=latest[config.id],state=this.sensorState(config,reading),python=reading?.source==='firestore-python'||config.id.startsWith('PY-');
        return '<article class="sensor-card" data-sensor-id="'+e(config.id)+'"><div class="spaced"><h3>'+e(config.label)+'</h3>'+this.badge(state.status,state.label)+'</div><p class="tagline iot-machine-name">'+e(this.asset(config.assetId).name||config.assetId)+'</p>'+this.sensorValues(reading)+
          '<dl class="spec-list"><div><dt>Atenção / crítico · temperatura</dt><dd>'+this.sensorValue(config.tempWarning,0)+' / '+this.sensorValue(config.tempCritical,0)+' °C</dd></div><div><dt>Atenção / crítico · vibração</dt><dd>'+this.sensorValue(config.vibrationWarning,1)+' / '+this.sensorValue(config.vibrationCritical,1)+' mm/s</dd></div></dl>'+
          '<footer class="sensor-card-footer"><span>'+e(python?'Sistema Python':'Gateway')+(reading?.simulated?' · Simulação':'')+'<br>Medido · '+(reading?this.date(reading.measuredAt??reading.receivedAt,true):'—')+(reading?.orderCode?'<br>OP · '+e(reading.orderCode):'')+'</span>'+(this.canWrite('iot_device_config')?'<button class="icon-btn" data-action="edit" data-path="iot_device_config" data-id="'+e(config.id)+'" aria-label="Configurar '+e(config.label)+'">'+this.icon('edit')+'</button>':'')+'</footer></article>';
      }).join('')+'</div>'+(configs.length?'':this.empty('Nenhum dispositivo vinculado','Os dispositivos da integração são criados para as máquinas cadastradas.','radio'))+
      this.pythonProductionPanel(selected)+
      '<section class="panel production-section"><header class="panel-header"><h2>Últimas leituras</h2><span class="tagline">Até 30 registros na seleção</span></header>'+(history.length?'<div class="table-wrap"><table class="data-table"><thead><tr><th>Máquina / horário</th><th>Temperatura</th><th>Vibração</th><th>Rotação</th><th>Fluido</th><th>OP</th></tr></thead><tbody>'+history.map(row=>'<tr><td><strong>'+e(this.asset(row.assetId).name||row.assetId)+'</strong><small>'+this.date(row.measuredAt??row.receivedAt,true)+'</small></td><td>'+this.sensorValue(row.temperature,1)+' °C</td><td>'+this.sensorValue(row.vibration,2)+' mm/s</td><td>'+this.sensorValue(row.rpm,0)+' RPM</td><td>'+this.sensorValue(row.fluidLevel,0)+' %</td><td>'+e(row.orderCode||'—')+'</td></tr>').join('')+'</tbody></table></div>':'<div class="panel-body"><p class="tagline">Nenhuma leitura recebida para esta seleção.</p></div>')+'</section>'+
      '<section class="panel production-section"><header class="panel-header"><h2>Alertas não reconhecidos</h2></header><div class="panel-body">'+(alerts.length?'<div class="mini-list">'+alerts.map(alert=>'<div class="mini-list-item"><div><strong>'+e(alert.message)+'</strong><small>'+e(this.asset(alert.assetId).name||alert.assetId)+' · '+this.date(alert.createdAt,true)+'</small></div>'+this.badge(alert.severity)+(this.canWrite('iot_alerts')?'<button class="btn btn-sm" data-action="alert-ack" data-id="'+e(alert.id)+'">Reconhecer</button>':'')+'</div>').join('')+'</div>':'<p class="tagline">Nenhum alerta pendente.</p>')+'</div></section>'+
      this.pythonStopsPanel(selected);
  };
  N.pythonStopsPanel=function(assetId=''){
    const rows=Object.entries(this.data.telemetry?.firestoreStops||{}).filter(([id])=>!assetId||id===assetId).flatMap(([,items])=>Object.values(items)).sort((a,b)=>b.createdAt-a.createdAt).slice(0,30);
    if(!rows.length)return '';
    return '<section class="panel production-section"><header class="panel-header"><h2>Paradas registradas na IHM</h2></header><div class="panel-body mini-list">'+rows.map(row=>'<div class="mini-list-item"><div><strong>'+e(row.code)+' · '+e(row.reason)+'</strong><small>'+e(this.asset(row.assetId).name||row.assetId)+' · '+e(row.orderCode)+' · '+this.date(row.createdAt,true)+'</small><p class="tagline">'+e(row.note)+'</p></div></div>').join('')+'</div></section>';
  };
  document.addEventListener('change',event=>{if(event.target.id==='iot-asset-filter'){N.iotAssetId=event.target.value;N.refresh();}});
})(window.Nexus);
