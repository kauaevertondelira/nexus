(function(N){
  'use strict';
  const e=N.escape;let frame,bootSequence=0,notificationsSeen=new Set(),installPrompt;
  N.renderShell=function(){
    const groups=['Operação','Manutenção','Inteligência','Suprimentos','Gestão','Sistema'];
    const hidden=['ativo-detalhes','os-detalhes','perfil'];
    const links=groups.map(group=>{const entries=Object.entries(this.routes).filter(([page,data])=>data[1]===group&&!hidden.includes(page)&&this.canAccess(page));if(!entries.length)return '';return '<div class="nav-group"><span class="nav-group-title">'+e(group)+'</span>'+entries.map(([page,data])=>'<a class="nav-link '+((page===this.route||(page==='ativos'&&this.route==='ativo-detalhes')||(page==='os'&&this.route==='os-detalhes'))?'active':'')+'" '+(page===this.route?'aria-current="page" ':'')+'data-swup href="'+this.href(page)+'">'+this.icon(data[2])+'<span>'+e(data[0])+'</span></a>').join('')+'</div>';}).join('');
    const initials=(this.user.name||'NX').split(' ').map(s=>s[0]).slice(0,2).join('');
    const plant=this.entries('companies')[0]?.name||this.user.company||'Minha unidade';
    document.querySelector('#swup').innerHTML='<div class="app-shell"><aside class="sidebar" id="sidebar"><a class="brand" data-swup href="'+this.href('menu')+'"><span class="brand-mark" aria-hidden="true"></span>NEXUS</a><div class="plant-selector">'+this.icon('machine')+'<div><strong>'+e(plant)+'</strong><small>Manutenção & operação</small></div></div><nav aria-label="Módulos do sistema">'+links+'</nav><div class="sidebar-footer"><button class="sidebar-support" data-action="support">'+this.icon('help')+'Central de suporte</button><div class="sidebar-person"><a class="avatar" data-swup href="'+this.href('perfil')+'" aria-label="Meu perfil">'+e(initials)+'</a><div class="grow"><a data-swup href="'+this.href('perfil')+'"><strong>'+e(this.user.name)+'</strong></a><small>'+e(this.user.role)+'</small></div><button class="icon-btn" data-action="logout" aria-label="Sair do sistema">'+this.icon('logout')+'</button></div></div></aside><div class="app-workspace"><header class="topbar"><div class="flex"><button class="icon-btn menu-button" data-action="mobile-menu" aria-label="Abrir navegação" aria-controls="sidebar" aria-expanded="false">'+this.icon('menu')+'</button><div class="breadcrumb"><span>'+e(this.routes[this.route]?.[1]||'Sistema')+'</span><span aria-hidden="true">/</span><strong>'+e(this.routes[this.route]?.[0]||'NEXUS')+'</strong></div></div><div class="topbar-actions"><span class="status-connection '+(this.mode==='demo'?'demo':this.online?'online':'offline')+'" id="connection-status"><span class="dot"></span>'+(this.mode==='demo'?'Demonstração local':this.online?'Firebase conectado':'Sem conexão')+'</span><button class="icon-btn" data-action="global-search" aria-label="Buscar em todos os módulos">'+this.icon('search')+'</button><button class="icon-btn" data-action="theme" aria-label="Alternar tema">'+this.icon('moon')+'</button><a class="icon-btn" data-swup href="'+this.href('notificacoes')+'" aria-label="Abrir notificações">'+this.icon('bell')+'</a><a class="avatar" data-swup href="'+this.href('perfil')+'" aria-label="Abrir perfil">'+e(initials)+'</a></div></header>'+(this.mode==='demo'?'<div class="demo-banner"><span><strong>DEMONSTRAÇÃO</strong> · Dados fictícios salvos apenas neste navegador.</span><a href="'+this.href('login')+'" data-action="leave-demo">Entrar com minha conta</a></div>':'')+'<main class="workspace" id="conteudo"><div id="view-body"></div><footer class="workspace-footer"><span>NEXUS / INDUSTRIAL OPERATING SYSTEM</span><span>4.0 · '+(this.mode==='demo'?'DEMO':'REALTIME DATABASE')+'</span></footer></main></div></div>';
  };
  N.refresh=function(animate=false){
    if(!document.querySelector('#view-body')||!this.user)return;
    cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{
      const active=document.activeElement,id=active?.id,selection=active?.tagName==='INPUT'&&['search','text'].includes(active.type)?[active.selectionStart,active.selectionEnd]:null;
      const view=this.views[this.route];this.exportRows=[];this.exportColumns=[];if(this.route==='mapa')this.twinDispose?.();
      try{const notice=this.mode==='firebase'&&Object.keys(this.readErrors||{}).length?'<div class="notice warning" style="margin-bottom:22px" role="status">Algumas coleções não puderam ser carregadas. Reconecte ou confira as permissões antes de interpretar indicadores ou exportar um backup.</div>':'';document.querySelector('#view-body').innerHTML=notice+(view?view.call(this):this.empty('Página indisponível','Use o menu para navegar.'));}catch(error){console.error('Falha na página',error);document.querySelector('#view-body').innerHTML='<div class="notice error">'+e('Não foi possível exibir esta página. '+this.errorText(error))+'</div>';} 
      if(id&&document.querySelector('#'+CSS.escape(id))){const field=document.querySelector('#'+CSS.escape(id));field.focus({preventScroll:true});if(selection)field.setSelectionRange(...selection);}
      if(animate)this.animateView?.();if(this.route==='mapa')this.startTwin?.();
    });
  };
  N.errorScreen=function(title,text){document.querySelector('#swup').innerHTML='<main class="boot-state" id="conteudo"><a class="brand" href="'+this.base.href+'"><span class="brand-mark" aria-hidden="true"></span>NEXUS</a>'+this.icon('shield')+'<h1>'+e(title)+'</h1><p>'+e(text)+'</p><div class="hero-actions"><a class="btn btn-primary" href="'+this.href('login')+'">Voltar ao acesso</a><button class="btn" data-action="retry">Tentar novamente</button><a class="btn" href="'+this.href('login','?demo=1')+'">Explorar demonstração</a></div></main>';};
  N.boot=async function(){
    const sequence=++bootSequence,container=document.querySelector('#swup');if(!container)return;
    this.twinDispose?.();this.heroDispose?.();this.closeModal(false);this.search='';this.filter='all';this.route=container.dataset.page||'index';this.currentOrder=null;this.currentAsset=null;
    if(this.route==='index'){this.initLanding?.();return;}
    if(this.route==='login'){this.initLogin();return;}
    if(this.route==='offline')return;
    if(new URLSearchParams(location.search).get('demo')==='1')this.beginDemo();
    try{
      const result=await this.connect();if(sequence!==bootSequence)return;
      if(result!==true){
        if(result?.blocked)this.errorScreen(result.blocked==='pending'?'Sua conta aguarda aprovação':'Acesso bloqueado',result.blocked==='pending'?'Um administrador precisa aprovar seu cadastro antes de liberar os dados da planta.':'Consulte o administrador responsável pela sua unidade.');
        else if(result?.missing)this.errorScreen('Complete seu perfil','Sua conta existe no Authentication, mas não possui um perfil na Nexus. Entre na página de acesso e selecione Completar perfil.');
        else this.errorScreen('Entre para abrir a Nexus','Use uma conta autorizada ou explore o ambiente de demonstração.');return;
      }
      if(!this.canAccess(this.route)){this.errorScreen('Acesso restrito ao seu cargo','Entre com uma conta autorizada para este módulo.');return;}
      this.renderShell();this.refresh(true);this.registerPWA();
      notificationsSeen=new Set(this.notifications().map(n=>n.id));
    }catch(error){if(sequence===bootSequence)this.errorScreen('Não foi possível conectar',this.errorText(error));}
  };
  N.initLogin=function(){
    if(new URLSearchParams(location.search).get('demo')==='1'){this.beginDemo();location.assign(this.href('menu'));return;}
    document.querySelector('#auth-error')?.replaceChildren();
  };
  N.go=function(page,query=''){const url=this.href(page,query);if(this.swup)this.swup.navigate(url);else location.assign(url);};
  N.simpleForm=function(title,fields,save,note='',extra=''){
    const root=this.modal(title,(note?'<div class="notice" style="margin-bottom:22px">'+e(note)+'</div>':'')+'<form id="simple-form"><p class="form-error" id="simple-error" role="alert"></p><div class="form-grid">'+fields.map(f=>this.formField(f)).join('')+'</div></form>'+extra,'<button class="btn" data-action="close-modal">Cancelar</button><button class="btn btn-primary" type="submit" form="simple-form">Confirmar</button>');
    root.querySelector('form').addEventListener('submit',async event=>{event.preventDefault();const btn=root.querySelector('[type=submit]');btn.disabled=true;try{await save(new FormData(event.currentTarget));this.closeModal();this.refresh();}catch(error){root.querySelector('#simple-error').textContent=this.errorText(error);btn.disabled=false;}});return root;
  };
  const f=(key,label,type='text',extra={})=>({key,label,type,...extra});
  N.changeOrder=async function(id,values,description){
    const order=this.data.work_orders?.[id];if(!order||!this.canOrder(order))throw new Error('Você não pode alterar esta ordem.');
    await this.save('work_orders',id,values);const ev=this.id('EVT');
    await this.batch({['work_order_activity/'+id+'/'+ev]:{description,createdAt:Date.now(),createdByUid:this.uid}});this.refresh();
  };
  N.generatePlan=function(id){
    const p=this.data.maintenance_plans?.[id];if(!p)return;
    this.confirm('Gerar ordem preventiva','Criar uma O.S. para '+p.name+' e avançar a próxima execução do plano?',async()=>{
      if(!this.canWrite('work_orders')||!this.canWrite('maintenance_plans'))throw new Error('Seu cargo não permite gerar esta ordem.');
      const orderId='OS-P-'+id+'-'+Math.floor(p.nextDueAt/86400000),now=Date.now(),updates={};
      const order={title:p.name,assetId:p.assetId,type:'preventive',priority:'normal',status:'scheduled',dueAt:p.nextDueAt,estimatedCost:0,downtimeHours:0,description:p.checklist||'Executar conforme o plano preventivo.',sourcePlanId:id,createdAt:now,createdByUid:this.uid};
      if(!this.data.work_orders?.[orderId])updates['work_orders/'+orderId]=order;
      const steps=String(p.checklist||'').split('\n').filter(Boolean);steps.forEach((title,i)=>{if(title.length>180)throw new Error('Cada etapa deve ter no máximo 180 caracteres.');updates['work_order_checklists/'+orderId+'/'+i]={title,done:false};});
      updates['maintenance_plans/'+id+'/nextDueAt']=Math.max(now,this.num(p.nextDueAt))+this.num(p.frequencyDays)*86400000;
      // Técnicos e administradores podem criar checklists; planejadores geram a O.S. sem estes lançamentos.
      if(!this.canWrite('work_order_checklists'))Object.keys(updates).filter(k=>k.startsWith('work_order_checklists/')).forEach(k=>delete updates[k]);
      await this.batch(updates);await this.audit('Gerou preventiva '+orderId,'maintenance_plans',id);this.toast('Ordem preventiva gerada.');this.refresh();
    },'Gerar O.S.');
  };
  N.convertRequest=function(id){
    const r=this.data.maintenance_requests?.[id];if(!r)return;
    this.confirm('Encaminhar para manutenção','Criar uma ordem de serviço vinculada à ocorrência '+r.title+'?',async()=>{
      if(!this.canWrite('work_orders'))throw new Error('Seu cargo não permite encaminhar esta ocorrência.');
      const key='OS-S-'+id,now=Date.now();if(this.data.work_orders?.[key])throw new Error('Já existe uma O.S. vinculada a esta solicitação.');
      const order={title:r.title,description:r.description,assetId:r.assetId,priority:r.priority,type:'corrective',status:'open',dueAt:now+({danger:4,urgent:24,normal:72,low:168}[r.priority]||72)*3600000,estimatedCost:0,downtimeHours:0,requestId:id,createdByUid:this.uid,createdAt:now};
      await this.batch({['work_orders/'+key]:order,['maintenance_requests/'+id+'/status']:'converted',['maintenance_requests/'+id+'/orderId']:key});await this.audit('Converteu solicitação '+id+' em '+key,'maintenance_requests',id);this.toast('Ocorrência encaminhada.');this.refresh();
    },'Criar ordem');
  };
  N.executeInspection=function(id){
    const route=this.data.inspection_routes?.[id];if(!route)return;const assets=(route.assetIds||[]).filter(id=>this.data.assets?.[id]);if(!assets.length){this.toast('Vincule equipamentos à rota antes de executá-la.','error');return;}
    const points=String(route.checkpoints||'Verificação geral').split('\n').filter(Boolean),fields=[];
    if(assets.length*points.length>200){this.toast('Uma execução aceita até 200 pontos. Divida esta rota.','error');return;}
    assets.forEach((assetId,i)=>{fields.push(f('status-'+i,assetId+' · '+this.asset(assetId).name,'select',{options:[['ok','Conforme'],['attention','Atenção'],['critical','Crítica']],full:true}),f('temp-'+i,'Temperatura medida (°C)','number',{required:true,min:-40,max:250,step:'0.1',default:this.mode==='demo'?(this.asset(assetId).temp||25):''}),f('vib-'+i,'Vibração medida (mm/s)','number',{required:true,min:0,max:100,step:'0.1',default:this.mode==='demo'?(this.asset(assetId).vibration||0):''}),f('note-'+i,'Observação da inspeção','textarea',{max:300,full:true}));points.forEach((p,j)=>fields.push(f('point-'+i+'-'+j,p,'checkbox',{required:true,default:false,full:true})));});
    const root=this.simpleForm('Executar · '+route.name,fields,async data=>{
      const key=this.id('INS'),now=Date.now(),updates={};
      assets.forEach((assetId,i)=>{const checks=points.map((p,j)=>({title:p,checked:data.has('point-'+i+'-'+j)}));if(checks.some(p=>!p.checked))throw new Error('Confirme todos os pontos de verificação antes de concluir.');const status=data.get('status-'+i);if(status!=='ok'&&String(data.get('note-'+i)).trim().length<5)throw new Error('Descreva a condição encontrada em '+assetId+'.');updates['inspection_results/'+key+'/'+assetId]={assetId,status,temperature:Number(data.get('temp-'+i)),vibration:Number(data.get('vib-'+i)),note:String(data.get('note-'+i)).trim(),checkpoints:checks};});
      updates['inspection_executions/'+key]={routeId:id,routeName:route.name,checkpointCount:assets.length*points.length,status:'completed',inspectorUid:this.uid,inspectorName:this.user.name,createdAt:now};updates['inspection_routes/'+id+'/nextDueAt']=now+this.num(route.frequencyDays)*86400000;
      await this.batch(updates);await this.audit('Concluiu inspeção '+route.name,'inspection_executions',key);this.toast('Inspeção registrada.');
    },'Registre os valores medidos e confirme cada ponto da rota. Não use valores simulados no ambiente real.');
    root.querySelectorAll('input[type=checkbox]').forEach(input=>input.required=true);
  };
  N.showInspection=function(id){const x=this.data.inspection_executions?.[id];if(!x)return;const results=Object.values(this.data.inspection_results?.[id]||{});this.modal(x.routeName||'Resultados da inspeção','<p class="tagline" style="margin-bottom:22px">'+e(x.inspectorName||x.inspectorUid)+' · '+this.date(x.createdAt,true)+'</p>'+results.map(r=>'<section class="panel" style="margin-bottom:15px"><div class="panel-body"><div class="spaced"><h3>'+e(assetLabel(r.assetId))+'</h3>'+this.badge(r.status)+'</div><p class="mono" style="margin:14px 0">'+this.number(r.temperature,1)+' °C · '+this.number(r.vibration,1)+' mm/s</p><p class="detail-description">'+e(r.note||'Sem observações adicionais')+'</p></div></section>').join(''),'<button class="btn" data-action="close-modal">Fechar</button>');};
  const assetLabel=id=>N.asset(id).name||id||'—';
  N.manageUser=function(id){
    if(!this.isAdmin())return;const u=this.data.users?.[id];if(!u)return;
    const fields=[f('role','Cargo','select',{options:this.roles.map(r=>[r,r]),default:u.role,full:true}),f('accessStatus','Situação do acesso','select',{options:[['active','Aprovado'],['pending','Aguardando aprovação'],['blocked','Bloqueado']],default:u.accessStatus||'active',full:true})];
    this.simpleForm('Acesso · '+u.name,fields,async data=>{if(id===this.uid&&(data.get('role')!=='Administrador'||data.get('accessStatus')!=='active'))throw new Error('Sua própria conta administrativa precisa permanecer aprovada e com cargo Administrador.');await this.save('users',id,{role:String(data.get('role')),accessStatus:String(data.get('accessStatus'))});this.toast('Acesso atualizado.');},'O cargo define módulos e ações. Confira a pessoa antes de aprovar o acesso.');
  };
  N.backup=function(){if(!this.isAdmin())return;const data={};[...this.collections,'users','audit_logs','backup_jobs'].forEach(path=>{if(this.data[path])data[path]=this.data[path];});this.download('nexus-backup-'+this.dateInput()+'.json',JSON.stringify({product:'nexus-industrial',schemaVersion:4,exportedAt:new Date().toISOString(),mode:this.mode,data},null,2));this.audit('Exportou backup operacional','backup_jobs');this.toast('Backup exportado.');};
  N.restore=function(){
    if(!this.isAdmin())return;
    const root=this.modal('Restaurar registros','<p class="detail-description" style="margin-bottom:20px">Escolha um backup JSON da Nexus 4.0. Cadastros, documentos, checklists, horas, peças, comentários e inspeções serão mesclados por identificador. Contas, auditoria, atividades imutáveis e telemetria permanecem preservadas.</p><label class="form-field"><span class="label">Arquivo de backup</span><input class="input" type="file" id="backup-file" accept=".json,application/json"></label><p class="form-error" id="backup-error" role="alert"></p><div id="backup-preview" style="margin-top:22px"></div>','<button class="btn" data-action="close-modal">Cancelar</button><button class="btn btn-primary" id="restore-confirm" disabled>Restaurar registros</button>');
    let updates={};
    root.querySelector('#backup-file').addEventListener('change',async event=>{
      const file=event.target.files?.[0];root.querySelector('#restore-confirm').disabled=true;
      try{
        if(!file) return;if(file.size>10*1024*1024)throw new Error('Use um arquivo de até 10 MB.');
        const prepared=this.prepareBackup(JSON.parse(await file.text()));updates=prepared.updates;const counts=prepared.counts;
        root.querySelector('#backup-preview').innerHTML='<div class="notice">'+e(counts.join(' · '))+'</div><p class="tagline" style="margin-top:12px">'+Object.keys(updates).length+' registros serão inseridos ou atualizados. Registros ausentes no arquivo não serão excluídos.</p>';
        root.querySelector('#restore-confirm').disabled=false;root.querySelector('#backup-error').textContent='';
      }catch(error){updates={};root.querySelector('#backup-error').textContent=this.errorText(error);}
    });
    root.querySelector('#restore-confirm').addEventListener('click',async event=>{event.currentTarget.disabled=true;try{await this.batch(updates);await this.audit('Restaurou '+Object.keys(updates).length+' cadastros de backup','backup_jobs');this.closeModal();this.toast('Registros restaurados.');this.refresh();}catch(error){root.querySelector('#backup-error').textContent=this.errorText(error);event.currentTarget.disabled=false;}});
  };
  N.support=function(){
    const root=this.modal('Central de suporte','<div class="support-tabs"><button class="filter-button selected" data-support-tab="assistant">Orientações</button><button class="filter-button" data-support-tab="accessibility">Acessibilidade</button><button class="filter-button" data-support-tab="app">Aplicativo</button></div><div id="support-content"></div>','<button class="btn" data-action="close-modal">Fechar</button>');
    const answers={
      'Abrir uma O.S.':'Abra Ordens de serviço → Nova ordem. Selecione o equipamento, descreva o serviço, defina prioridade, prazo e responsável. Na ficha da ordem, registre checklist, horas e peças. Para concluir, complete as etapas e descreva o resultado.',
      'Entender o risco':'A pontuação combina condição cadastrada, temperatura e criticidade. O resultado orienta a fila de inspeção. Ele não prevê falhas nem substitui a avaliação técnica. Confirme as medições na Central IoT e nas inspeções.',
      'Movimentar estoque':'Abra Estoque MRO → Movimentar no item. Informe entrada ou saída, quantidade e justificativa. O saldo é validado em uma transação. O registro de peças em uma O.S. não baixa automaticamente o estoque físico.',
      'Configurar o Firebase':'A configuração Web está em public/assets/js/firebase-config.js. No Console Firebase, ative E-mail/Senha, autorize o domínio do GitHub Pages e publique database.rules.json em Realtime Database → Regras. Contas novas aguardam aprovação de um administrador.',
      'Publicar no GitHub Pages':'Copie todo o conteúdo de nexus/ para a raiz do seu repositório. Pelo GitHub Desktop, faça Commit e Push origin. No GitHub, Settings → Pages → Deploy from a branch → main → /(root). Preserve public/ e .nojekyll. O guia completo está em LEIA-ME-PUBLICACAO.md.',
      'Conectar sensores':'Vincule um dispositivo na Central IoT. O gateway confiável escreve em telemetry/latest/ID-DO-DISPOSITIVO com temperature, vibration, energyKwh e receivedAt. A interface acompanha essas leituras. Não coloque credenciais de servidor no site.'
    };
    const show=tab=>{const content=root.querySelector('#support-content');root.querySelectorAll('[data-support-tab]').forEach(b=>b.classList.toggle('selected',b.dataset.supportTab===tab));
      if(tab==='assistant'){content.innerHTML='<p class="tagline" style="margin-bottom:18px">Orientações locais. Esta central não altera dados nem executa ações na planta.</p><div class="support-topics">'+Object.keys(answers).map(t=>'<button class="btn" data-topic="'+e(t)+'">'+e(t)+'</button>').join('')+'</div><div class="support-answer" id="support-answer">Escolha um assunto para ver o procedimento.</div>';content.querySelectorAll('[data-topic]').forEach(b=>b.addEventListener('click',()=>{content.querySelector('#support-answer').textContent=answers[b.dataset.topic];}));}
      else if(tab==='accessibility'){content.innerHTML='<h3 style="margin-bottom:15px">Acesso e leitura</h3><p class="detail-description">Use Tab para navegar, Enter para acionar e Esc para fechar diálogos. A Nexus respeita a preferência do sistema por movimento reduzido e permite ampliar o texto.</p><button class="btn" style="margin-top:22px" data-action="vlibras">Carregar tradutor VLibras</button><p class="tagline" style="margin-top:16px">O botão carrega o serviço oficial externo do governo. Traduções dependem da disponibilidade do serviço.</p>';}
      else content.innerHTML='<p class="detail-description">Instale a Nexus para abrir a interface em uma janela própria. Os dados reais exigem conexão. A demonstração funciona localmente após o cache da interface.</p><div class="hero-actions"><button class="btn btn-primary" data-action="pwa-install">Instalar aplicativo</button><button class="btn" data-action="notify-enable">Ativar avisos locais</button></div>';};
    root.querySelectorAll('[data-support-tab]').forEach(b=>b.addEventListener('click',()=>show(b.dataset.supportTab)));show('assistant');
  };
  N.globalSearch=function(){const root=this.modal('Buscar na Nexus','<label class="search-field" style="width:100%;margin-bottom:20px">'+this.icon('search')+'<span class="sr-only">Buscar ativos, ordens e páginas</span><input id="global-query" type="search" placeholder="Ativo, ordem ou módulo"></label><div class="global-search-results" id="global-results"></div>');
    const render=q=>{const items=[];Object.entries(this.routes).filter(([page,data])=>this.canAccess(page)&&!['ativo-detalhes','os-detalhes'].includes(page)&&data[0].toLowerCase().includes(q)).forEach(([page,data])=>items.push([data[0],this.href(page),data[2]]));if(q){if(this.canAccess('ativos'))this.entries('assets').filter(a=>(a.name+' '+a.id+' '+a.tag).toLowerCase().includes(q)).forEach(a=>items.push([a.name+' · '+(a.tag||a.id),this.href('ativo-detalhes','?id='+encodeURIComponent(a.id)),'machine']));if(this.canAccess('os'))this.entries('work_orders').filter(o=>(o.title+' '+o.id).toLowerCase().includes(q)).forEach(o=>items.push([o.title+' · '+o.id,this.href('os-detalhes','?id='+encodeURIComponent(o.id)),'tool']));}root.querySelector('#global-results').innerHTML=items.slice(0,14).map(([text,url,i])=>'<a href="'+url+'" data-swup>'+this.icon(i)+e(text)+'</a>').join('')||this.empty('Nenhum resultado');};root.querySelector('#global-query').addEventListener('input',event=>render(event.target.value.trim().toLowerCase()));render('');root.querySelector('#global-query').focus();};
  N.qr=function(id){const a=this.data.assets?.[id];if(!a)return;const root=this.modal('Etiqueta do equipamento','<div class="qr-panel"><span class="eyebrow">NEXUS / ATIVO INDUSTRIAL</span><h3>'+e(a.tag||id)+'</h3><p>'+e(a.name)+' · '+e(a.area)+'</p><div id="qr-code" class="qr-code"></div><p>O QR abre a ficha técnica. Uma conta autorizada é necessária para visualizar os dados reais.</p></div>','<button class="btn" data-action="close-modal">Fechar</button><button class="btn btn-primary" id="qr-download">Baixar etiqueta PNG</button>');if(!window.QRCode){root.querySelector('#qr-code').textContent='Biblioteca QR indisponível';return;}new QRCode(root.querySelector('#qr-code'),{text:this.href('ativo-detalhes','?id='+encodeURIComponent(id)),width:220,height:220,colorDark:'#202322',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.M});root.querySelector('#qr-download').addEventListener('click',()=>{const source=root.querySelector('#qr-code canvas');if(!source)return;const canvas=document.createElement('canvas');canvas.width=420;canvas.height=500;const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,420,500);ctx.fillStyle='#202322';ctx.textAlign='center';ctx.font='bold 22px Arial';ctx.fillText('NEXUS / '+(a.tag||id),210,45);ctx.font='16px Arial';ctx.fillText(a.name.slice(0,42),210,75);ctx.imageSmoothingEnabled=false;ctx.drawImage(source,60,110,300,300);ctx.font='14px Arial';ctx.fillText(a.area||'Ativo industrial',210,448);ctx.fillText('Acesso por conta autorizada',210,474);const download=document.createElement('a');download.href=canvas.toDataURL();download.download='etiqueta-'+(a.tag||id)+'.png';download.click();});};
  N.assetPDF=function(id){const a=this.data.assets?.[id];if(!a)return;this.pdf('Ficha técnica · '+a.name,['Identificação: '+(a.tag||id),'Área: '+a.area,'Condição: '+this.statusText(a.status),'Criticidade: '+a.criticality,'Fabricante: '+(a.manufacturer||'—'),'Modelo: '+(a.model||'—'),'Série: '+(a.serialNumber||'—'),'Instalação: '+this.date(a.installDate),'Temperatura cadastrada: '+this.number(a.temp,1)+' °C','Estratégia: '+(a.maintenanceStrategy||'—'),'Observações: '+(a.description||'—'),'','Histórico de ordens:',...this.entries('work_orders').filter(o=>o.assetId===id).map(o=>o.id+' | '+o.title+' | '+this.orderState(o.status)+' | '+this.date(o.createdAt))]);};
  N.orderPDF=function(id){const o=this.data.work_orders?.[id];if(!o)return;const nested=path=>Object.values(this.data[path]?.[id]||{});this.pdf('Ordem de serviço · '+id,['Serviço: '+o.title,'Equipamento: '+assetLabel(o.assetId),'Situação: '+this.orderState(o.status),'Prioridade: '+this.statusText(o.priority),'Responsável: '+(o.assignedTo||'—'),'Prazo: '+this.date(o.dueAt,true),'Descrição: '+(o.description||'—'),'Custo previsto: '+this.money(o.estimatedCost),'Parada registrada: '+this.number(o.downtimeHours,2)+' h','','Checklist:',...nested('work_order_checklists').map(c=>(c.done?'[OK] ':'[ ] ')+c.title),'','Apontamentos:',...nested('work_order_time_entries').map(t=>this.number(t.hours,2)+' h | '+t.note),'','Peças:',...nested('work_order_parts').map(p=>p.name+' | '+this.number(p.qty)+' un | '+this.money(this.num(p.qty)*this.num(p.unitPrice))),'','Conclusão: '+(o.completionNote||'Ainda não concluída')]);};
  N.contractPDF=function(id){const c=this.data.supplier_contracts?.[id];if(!c)return;this.pdf('Resumo administrativo de contrato',['Objeto: '+c.title,'Fornecedor: '+(this.data.suppliers?.[c.supplierId]?.name||c.supplierId),'Responsável: '+c.owner,'Vigência: '+this.date(c.startDate)+' até '+this.date(c.endDate),'Valor total cadastrado: '+this.money(c.totalValue),'Aviso de renovação: '+c.renewalNoticeDays+' dias','Condições: '+(c.notes||'—'),'Documento vinculado: '+(this.safeURL(c.documentUrl||c.document?.url)||'Não informado'),'','Este resumo reproduz o cadastro e não substitui o instrumento contratual assinado.']);};
  N.handleAction=async function(action,target){
    const {id,path,status}=target.dataset;
    switch(action){
      case 'new':this.openEditor(path,'',target.dataset.nested||'');break;
      case 'edit':this.openEditor(path,id,target.dataset.nested||'');break;
      case 'delete':this.confirm('Excluir cadastro','Excluir '+id+'? Esta operação remove o cadastro do banco. Exporte uma cópia se precisar preservar este registro.',async()=>{await this.remove(path,id);this.toast('Cadastro excluído.');this.refresh();},'Excluir');break;
      case 'close-modal':this.closeModal();break;
      case 'retry':this.disconnect();this.boot();break;
      case 'layout':this.layout=target.dataset.layout;this.refresh();break;
      case 'calendar':this.calendarOffset=target.dataset.offset==='0'?0:this.calendarOffset+Number(target.dataset.offset);this.refresh();break;
      case 'contract-tab':this.contractTab=target.dataset.tab;this.search='';this.filter='all';this.refresh();break;
      case 'export-csv':this.exportCSV();break;case 'export-pdf':this.report();break;
      case 'qr':this.qr(id);break;case 'asset-pdf':this.assetPDF(id);break;case 'order-pdf':this.orderPDF(id);break;case 'contract-pdf':this.contractPDF(id);break;
      case 'asset-order':this.openEditor('work_orders');document.querySelector('#field-assetId').value=id;break;
      case 'plan-generate':this.generatePlan(id);break;case 'request-convert':this.convertRequest(id);break;
      case 'request-reject':this.confirm('Rejeitar solicitação','Marcar esta solicitação como rejeitada?',async()=>{await this.save('maintenance_requests',id,{status:'rejected'});this.toast('Solicitação rejeitada.');this.refresh();});break;
      case 'order-start':await this.changeOrder(id,{status:'in_progress',startedAt:Date.now()},'Serviço iniciado');this.toast('Serviço iniciado.');break;
      case 'order-finish':{
        const pending=Object.values(this.data.work_order_checklists?.[id]||{}).some(c=>!c.done);if(pending)throw new Error('Complete todas as etapas do checklist antes de concluir.');
        this.simpleForm('Concluir ordem de serviço',[f('note','Descreva a execução e o resultado','textarea',{required:true,minLength:5,max:300,full:true}),f('hours','Parada total do equipamento (h)','number',{required:true,min:0,step:'0.25',default:this.data.work_orders?.[id]?.downtimeHours||0})],async data=>{await this.changeOrder(id,{status:'completed',completionNote:String(data.get('note')).trim(),downtimeHours:Number(data.get('hours')),completedAt:Date.now(),completedByUid:this.uid,completedByName:this.user.name},'Ordem concluída e resultado registrado');this.toast('Ordem concluída.');});break;
      }
      case 'order-check-add':this.simpleForm('Adicionar etapa',[f('title','Etapa do procedimento','text',{required:true,max:180,full:true})],async data=>{await this.save('work_order_checklists/'+id,'',{title:String(data.get('title')).trim(),done:false});this.toast('Etapa adicionada.');});break;
      case 'order-time':this.simpleForm('Apontar horas',[f('hours','Horas trabalhadas','number',{required:true,min:0.25,max:24,step:'0.25',default:1}),f('note','Atividade realizada','textarea',{required:true,max:240,full:true})],async data=>{await this.save('work_order_time_entries/'+id,'',{hours:Number(data.get('hours')),note:String(data.get('note')).trim(),userUid:this.uid,userName:this.user.name});this.toast('Horas registradas.');});break;
      case 'order-part':this.simpleForm('Registrar peça utilizada',[f('item','Item do estoque','inventory',{required:true,full:true}),f('qty','Quantidade utilizada','number',{required:true,min:0.01,step:'0.01',default:1})],async data=>{const item=this.data.inventory?.[data.get('item')];if(!item)throw new Error('Selecione um item existente.');await this.save('work_order_parts/'+id,'',{name:item.name,inventoryId:String(data.get('item')),qty:Number(data.get('qty')),unitPrice:this.num(item.price),unit:item.unit||'un'});this.toast('Peça registrada na O.S. Confirme a baixa no estoque físico.');},'Este registro documenta a peça na ordem. A equipe de suprimentos registra a saída física em Estoque MRO.');break;
      case 'stock-move':{
        const item=this.data.inventory?.[id];if(!item)return;const movements=Object.values(item.movements||{}).sort((a,b)=>b.createdAt-a.createdAt).slice(0,5);
        this.simpleForm('Movimentar · '+item.name,[f('kind','Tipo de movimentação','select',{options:[['in','Entrada'],['out','Saída']]}),f('qty','Quantidade ('+(item.unit||'un')+')','number',{required:true,min:0.01,step:'0.01',default:1}),f('note','Justificativa / O.S. vinculada','textarea',{required:true,minLength:5,max:300,full:true})],async data=>{await this.moveInventory(id,Number(data.get('qty'))*(data.get('kind')==='out'?-1:1),String(data.get('note')).trim());this.toast('Movimentação registrada.');},'Saldo atual: '+this.number(item.qty)+' '+(item.unit||'un')+'.',movements.length?'<h3 style="font-size:1rem;margin:25px 0 10px">Últimas movimentações</h3><div class="mini-list">'+movements.map(m=>'<div class="mini-list-item"><div><strong>'+e(m.note)+'</strong><small>'+this.date(m.createdAt,true)+'</small></div><span class="mono">'+(m.delta>0?'+':'')+this.number(m.delta,2)+'</span></div>').join('')+'</div>':'');break;
      }
      case 'purchase-status':{
        const r=this.data.purchase_requests?.[id];if(!r)return;this.confirm('Atualizar etapa da compra','Alterar '+r.itemName+' para '+this.statusText(status)+'?',async()=>{await this.save('purchase_requests',id,{status,[status+'At']:Date.now(),[status+'ByUid']:this.uid});this.toast('Etapa da compra atualizada.');this.refresh();});break;
      }
      case 'inspection-run':this.executeInspection(id);break;case 'inspection-details':this.showInspection(id);break;
      case 'alert-ack':await this.save('iot_alerts',id,{acknowledged:true,acknowledgedAt:Date.now(),acknowledgedByUid:this.uid});this.toast('Alerta reconhecido.');this.refresh();break;
      case 'user-edit':this.manageUser(id);break;case 'backup-export':this.backup();break;case 'backup-import':this.restore();break;
      case 'demo-reset':this.confirm('Restaurar demonstração','Substituir os registros locais pelos exemplos iniciais?',async()=>{this.resetDemo();this.toast('Demonstração restaurada.');this.refresh();});break;
      case 'demo-enter':this.beginDemo();location.assign(this.href('menu'));break;
      case 'password-reset':{
        const email=document.querySelector('#auth-email')?.value.trim();if(!email)throw new Error('Informe seu e-mail no campo de acesso para receber o link de recuperação.');
        await this.sdk();await this.auth.sendPasswordResetEmail(email);this.toast('Se o e-mail estiver cadastrado, você receberá as instruções de recuperação.');break;
      }
      case 'complete-profile':await this.sdk();await this.authReady();if(!this.auth.currentUser)throw new Error('Entre com e-mail e senha. Se sua conta estiver sem perfil, o formulário abrirá em seguida.');this.showCompleteProfile();break;
      case 'theme':document.documentElement.dataset.theme=document.documentElement.dataset.theme==='dark'?'light':'dark';localStorage.setItem('nexus-theme',document.documentElement.dataset.theme);break;
      case 'support':this.support();break;case 'global-search':this.globalSearch();break;
      case 'mobile-menu':this.toggleMenu();break;case 'mobile-close':this.toggleMenu(false);break;
      case 'logout':case 'leave-demo':sessionStorage.removeItem('nexus-mode');this.disconnect();if(this.auth?.currentUser)await this.auth.signOut();location.assign(this.href('login'));break;
      case 'twin-select':this.selectTwin?.(id);break;case 'twin-reset':this.twinReset?.();break;
      case 'vlibras':if(document.querySelector('[vw]')){this.toast('O VLibras já está carregado.');break;} {const box=document.createElement('div');box.setAttribute('vw','');box.className='enabled';box.innerHTML='<div vw-access-button class="active"></div><div vw-plugin-wrapper><div class="vw-plugin-top-wrapper"></div></div>';document.body.append(box);const script=document.createElement('script');script.src='https://vlibras.gov.br/app/vlibras-plugin.js';script.onload=()=>{if(window.VLibras)new VLibras.Widget('https://vlibras.gov.br/app');this.toast('VLibras carregado.');};script.onerror=()=>{box.remove();script.remove();this.toast('O serviço VLibras está indisponível.','error');};document.head.append(script);this.toast('Carregando o serviço oficial VLibras.');}break;
      case 'notify-enable':if(!('Notification'in window))throw new Error('Este navegador não oferece notificações.');{const permission=await Notification.requestPermission();if(permission==='granted'){localStorage.setItem('nexus-notifications','enabled');this.toast('Avisos locais ativados.');}else this.toast('Notificações não foram autorizadas.','warning');}break;
      case 'pwa-install':if(installPrompt){await installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;}else this.toast('Use o menu do navegador → Instalar aplicativo. A opção aparece em navegadores compatíveis, com HTTPS.','warning');break;
    }
  };
  N.toggleMenu=function(open){document.querySelector('.mobile-scrim')?.remove();const sidebar=document.querySelector('#sidebar');if(!sidebar)return;open=open??!sidebar.classList.contains('is-open');sidebar.classList.toggle('is-open',open);document.querySelector('[data-action=mobile-menu]')?.setAttribute('aria-expanded',String(open));if(open){const scrim=document.createElement('button');scrim.className='mobile-scrim';scrim.dataset.action='mobile-close';scrim.setAttribute('aria-label','Fechar navegação');document.body.append(scrim);}};
  N.loginSubmit=async function(form){
    const error=document.querySelector('#auth-error'),button=form.querySelector('[type=submit]'),data=new FormData(form),email=String(data.get('email')||'').trim(),password=String(data.get('password')||''),tab=form.dataset.tab||'login';button.disabled=true;error.textContent='';
    try{
      sessionStorage.removeItem('nexus-mode');this.disconnect();await this.sdk();
      if(tab==='register'){
        if(password.length<8)throw new Error('Use uma senha com pelo menos 8 caracteres.');
        const name=String(data.get('name')||'').trim();if(name.length<2)throw new Error('Informe seu nome.');
        const role=String(data.get('role'));if(!['Técnico de Manutenção','Almoxarifado / Suprimentos','Supervisor de Produção'].includes(role))throw new Error('Cargo não permitido no cadastro público.');
        const result=await this.auth.createUserWithEmailAndPassword(email,password);
        this.uid=result.user.uid;
        try{await this.db.ref('users/'+this.uid).set({name,email:result.user.email,role,accessStatus:'pending',createdAt:Date.now()});}catch(saveError){throw new Error('Sua conta foi criada, mas o perfil não pôde ser salvo. Publique as regras e use Completar perfil. '+this.errorText(saveError));}
        await this.auth.signOut();this.toast('Conta criada. Aguarde aprovação do administrador.');form.reset();
      }else{
        await this.auth.signInWithEmailAndPassword(email,password);this.user=null;
        const profile=await this.getProfile();
        if(profile?.missing){this.showCompleteProfile();return;}
        if(profile?.blocked)throw new Error(profile.blocked==='pending'?'Sua conta aguarda aprovação do administrador.':'Seu acesso foi bloqueado. Consulte o administrador.');
        if(profile?.invalid)throw new Error('O cargo do seu perfil não é válido. Consulte o administrador.');
        location.assign(this.href('menu'));
      }
    }catch(err){error.textContent=this.errorText(err);}finally{button.disabled=false;}
  };
  N.showCompleteProfile=function(){
    this.simpleForm('Completar perfil',[f('name','Nome completo','text',{required:true,minLength:2,max:120,full:true}),f('role','Área de atuação','select',{options:[['Técnico de Manutenção','Técnico de Manutenção'],['Almoxarifado / Suprimentos','Almoxarifado / Suprimentos'],['Supervisor de Produção','Supervisor de Produção']],full:true})],async data=>{const user=this.auth.currentUser;if(!user)throw new Error('Entre com e-mail e senha primeiro.');const snap=await this.db.ref('users/'+user.uid).once('value');if(snap.exists())throw new Error('Seu perfil já existe. Consulte o administrador para aprovar o acesso.');await this.db.ref('users/'+user.uid).set({name:String(data.get('name')).trim(),email:user.email,role:String(data.get('role')),accessStatus:'pending',createdAt:Date.now()});await this.auth.signOut();this.toast('Perfil criado. Aguarde aprovação do administrador.');},'A conta foi encontrada no Authentication. Crie o perfil da Nexus para solicitar acesso.');
  };
  N.registerPWA=function(){if('serviceWorker'in navigator&&['http:','https:'].includes(location.protocol)&&!this.pwaRegistered){this.pwaRegistered=true;navigator.serviceWorker.register(new URL('service-worker.js',this.base),{scope:this.base.pathname,updateViaCache:'none'}).then(reg=>reg.update()).catch(error=>console.warn('PWA: '+error.message));}};
  document.addEventListener('click',async event=>{
    const target=event.target.closest('[data-action]');if(target){event.preventDefault();try{await N.handleAction(target.dataset.action,target);}catch(error){N.toast(N.errorText(error),'error');}return;}
    const tab=event.target.closest('[data-auth-tab]');if(tab){const mode=tab.dataset.authTab;document.querySelectorAll('[data-auth-tab]').forEach(b=>{b.classList.toggle('active',b===tab);b.setAttribute('aria-selected',String(b===tab));});const form=document.querySelector('#auth-form');form.dataset.tab=mode;document.querySelectorAll('[data-register-field]').forEach(field=>{field.hidden=mode!=='register';field.querySelectorAll('input,select').forEach(i=>i.disabled=mode!=='register');});document.querySelector('#auth-submit').textContent=mode==='register'?'Solicitar acesso':'Entrar na Nexus';document.querySelector('#auth-error').textContent='';}
  });
  document.addEventListener('input',event=>{if(event.target.id==='view-search'){N.search=event.target.value;N.refresh();}});
  document.addEventListener('change',async event=>{
    const target=event.target;
    if(target.id==='view-filter'){N.filter=target.value;N.refresh();}
    if(target.id==='demo-role'){sessionStorage.setItem('nexus-demo-role',target.value);N.user.role=target.value;N.renderShell();N.refresh();}
    if(target.matches('[data-check-id]')){try{await N.save('work_order_checklists/'+target.dataset.orderId,target.dataset.checkId,{done:target.checked});}catch(error){target.checked=!target.checked;N.toast(N.errorText(error),'error');}}
  });
  document.addEventListener('submit',async event=>{
    const form=event.target;
    if(form.id==='auth-form'){event.preventDefault();await N.loginSubmit(form);}
    if(form.id==='comment-form'){event.preventDefault();const button=form.querySelector('button');button.disabled=true;try{await N.save('work_order_comments/'+form.dataset.orderId,'',{text:String(new FormData(form).get('text')).trim(),userUid:N.uid,userName:N.user.name,link:''});form.reset();N.refresh();N.toast('Mensagem registrada.');}catch(error){N.toast(N.errorText(error),'error');button.disabled=false;}}
    if(form.id==='profile-form'){event.preventDefault();const button=form.querySelector('button');button.disabled=true;try{const data=new FormData(form),value={name:String(data.get('name')).trim(),company:String(data.get('company')).trim()};if(N.mode==='demo'){N.user={...N.user,...value};N.data.users.demo={...N.data.users.demo,...value};N.persist();}else await N.db.ref('users/'+N.uid).update(value);N.renderShell();N.refresh();N.toast('Perfil salvo.');}catch(error){document.querySelector('#profile-error').textContent=N.errorText(error);button.disabled=false;}}
  });
  document.addEventListener('nexus:data',event=>{if(N.route==='mapa'&&!['assets','batch','all'].includes(event.detail?.path)){N.twinUpdate?.();}else N.refresh();if(localStorage.getItem('nexus-notifications')==='enabled'&&window.Notification?.permission==='granted'&&N.user){const current=N.notifications();current.filter(n=>!notificationsSeen.has(n.id)).forEach(n=>{new Notification('Nexus · '+n.title,{body:n.text,tag:n.id});notificationsSeen.add(n.id);});}});
  document.addEventListener('nexus:profile',()=>{if(!N.user)return;if(!N.canAccess(N.route)){N.errorScreen('Seu acesso foi atualizado','O administrador alterou seu acesso a este módulo.');return;}N.renderShell();N.refresh();});
  document.addEventListener('nexus:connection',()=>{const target=document.querySelector('#connection-status');if(target){target.className='status-connection '+(N.mode==='demo'?'demo':N.online?'online':'offline');target.innerHTML='<span class="dot"></span>'+(N.mode==='demo'?'Demonstração local':N.online?'Firebase conectado':'Sem conexão');}});
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;});
  window.addEventListener('online',()=>{N.online=true;});window.addEventListener('offline',()=>{N.online=false;document.dispatchEvent(new CustomEvent('nexus:connection'));});
  document.addEventListener('keydown',event=>{if(event.key==='Escape')N.toggleMenu(false);if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'&&N.user){event.preventDefault();N.globalSearch();}});
  try{document.documentElement.dataset.theme=localStorage.getItem('nexus-theme')||'light';}catch{}
  document.addEventListener('DOMContentLoaded',()=>{N.initMotion?.();N.boot();});
})(window.Nexus);
