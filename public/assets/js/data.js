(function(N) {
  'use strict';
  const DEMO_KEY='nexus-industrial-demo-v4';
  N.collections=['assets','inventory','work_orders','maintenance_plans','maintenance_requests','suppliers','purchase_requests','supplier_contracts','asset_warranties','inspection_routes','inspection_executions','inspection_results','telemetry','iot_device_config','iot_alerts','asset_documents','work_order_checklists','work_order_time_entries','work_order_parts','work_order_comments','work_order_activity','companies'];
  let sdkPromise, authPromise, readyPromise;
  N.sdk = async function() {
    if (sdkPromise) return sdkPromise;
    sdkPromise=(async()=>{
      const load=file=>new Promise((resolve,reject)=>{
        const s=document.createElement('script'); let done=false;
        const timer=setTimeout(()=>{if(!done){done=true;reject(new Error('O Firebase não respondeu. Verifique a conexão ou entre no ambiente de demonstração.'));}},12000);
        s.src='https://www.gstatic.com/firebasejs/10.12.2/'+file+'-compat.js';
        s.onload=()=>{if(!done){done=true;clearTimeout(timer);resolve();}}; s.onerror=()=>{if(!done){done=true;clearTimeout(timer);s.remove();reject(new Error('Não foi possível carregar o Firebase. Verifique sua conexão.'));}}; document.head.append(s);
      });
      await load('firebase-app'); await load('firebase-auth'); await load('firebase-database');
      if (!firebase.apps.length) firebase.initializeApp(window.NEXUS_FIREBASE_CONFIG);
      N.auth=firebase.auth(); N.db=firebase.database();
      return firebase;
    })().catch(error=>{sdkPromise=null;throw error;});
    return sdkPromise;
  };
  N.authReady = async function() {
    await this.sdk();
    if(!authPromise)authPromise=new Promise((resolve,reject)=>{let off;const timer=setTimeout(()=>{off?.();reject(new Error('Não foi possível confirmar sua sessão. Reconecte e tente novamente.'));},10000);off=this.auth.onAuthStateChanged(user=>{clearTimeout(timer);off?.();resolve(user);},error=>{clearTimeout(timer);off?.();reject(error);});}).catch(error=>{authPromise=null;throw error;});
    await authPromise; return this.auth.currentUser;
  };
  N.getProfile=async function() {
    const user=await this.authReady(); if(!user)return null;
    const snap=await Promise.race([this.db.ref('users/'+user.uid).once('value'),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Seu perfil não pôde ser confirmado. Reconecte e tente novamente.')),12000))]);
    this.uid=user.uid; this.user=snap.val();
    if (!this.user) return {missing:true};
    if (!this.roles.includes(this.user.role)) return {invalid:true};
    if (['pending','blocked','disabled','suspended'].includes(this.user.accessStatus)) return {blocked:this.user.accessStatus};
    return this.user;
  };
  N.seed = function() {
    const day=86400000, now=Date.now(), due=d=>now+d*day;
    const assets={
      'M-204':{name:'Centro de usinagem CNC',tag:'M-204',area:'Usinagem',companyId:'planta-01',status:'danger',temp:82,vibration:5.2,criticality:'A',manufacturer:'Romi',model:'D 800',serialNumber:'CNC-204-2024',installDate:'2024-03-12',assetClass:'Centro de usinagem',maintenanceStrategy:'Baseada em condição',energyKwh:1240,mroCost:1800,operatingHours:416,targetAvailability:98,tempWarning:70,tempCritical:85,description:'Usinagem de precisão de componentes metálicos.'},
      'C-102':{name:'Compressor de ar',tag:'C-102',area:'Utilidades',companyId:'planta-01',status:'online',temp:54,vibration:1.8,criticality:'A',manufacturer:'Atlas Copco',model:'GA 37',serialNumber:'CMP-102-2023',installDate:'2023-06-20',assetClass:'Compressor',maintenanceStrategy:'Preventiva',energyKwh:980,mroCost:750,operatingHours:608,targetAvailability:98,tempWarning:70,tempCritical:85},
      'P-301':{name:'Prensa hidráulica',tag:'P-301',area:'Estamparia',companyId:'planta-01',status:'online',temp:48,vibration:2.1,criticality:'A',manufacturer:'Schuler',model:'HP 200',serialNumber:'PH-301-2022',installDate:'2022-10-05',assetClass:'Prensa',maintenanceStrategy:'Preventiva',energyKwh:720,mroCost:1300,operatingHours:352,targetAvailability:97,tempWarning:70,tempCritical:85},
      'E-015':{name:'Esteira transportadora',tag:'E-015',area:'Envase',companyId:'planta-01',status:'offline',temp:31,vibration:0,criticality:'B',manufacturer:'SEW',model:'Linha 03',serialNumber:'EST-015-2024',installDate:'2024-01-17',assetClass:'Transportador',maintenanceStrategy:'Preventiva',energyKwh:210,mroCost:420,operatingHours:320,targetAvailability:95,tempWarning:70,tempCritical:85},
      'B-008':{name:'Bomba centrífuga',tag:'B-008',area:'Utilidades',companyId:'planta-01',status:'online',temp:42,vibration:1.3,criticality:'B',manufacturer:'KSB',model:'Meganorm 50',serialNumber:'BMB-008-2023',installDate:'2023-02-14',assetClass:'Bomba',maintenanceStrategy:'Baseada em condição',energyKwh:450,mroCost:360,operatingHours:640,targetAvailability:96,tempWarning:70,tempCritical:85},
      'R-011':{name:'Célula robotizada',tag:'R-011',area:'Montagem',companyId:'planta-01',status:'online',temp:39,vibration:0.9,criticality:'A',manufacturer:'ABB',model:'IRB 2600',serialNumber:'ROB-011-2025',installDate:'2025-05-10',assetClass:'Robô',maintenanceStrategy:'Preventiva',energyKwh:860,mroCost:920,operatingHours:408,targetAvailability:98,tempWarning:70,tempCritical:85},
      'F-002':{name:'Forno de tratamento',tag:'F-002',area:'Tratamento',companyId:'planta-01',status:'online',temp:64,vibration:1.2,criticality:'B',manufacturer:'Jung',model:'Industrial 1000',serialNumber:'FRN-002-2022',installDate:'2022-08-01',assetClass:'Forno',maintenanceStrategy:'Preventiva',energyKwh:1600,mroCost:650,operatingHours:512,targetAvailability:95,tempWarning:90,tempCritical:120},
      'T-006':{name:'Torno mecânico',tag:'T-006',area:'Usinagem',companyId:'planta-01',status:'online',temp:45,vibration:1.6,criticality:'C',manufacturer:'Romi',model:'T 240',serialNumber:'TRN-006-2021',installDate:'2021-11-15',assetClass:'Torno',maintenanceStrategy:'Preventiva',energyKwh:360,mroCost:250,operatingHours:288,targetAvailability:94,tempWarning:70,tempCritical:85}
    };
    const work_orders={
      'OS-2026-048':{title:'Inspecionar vibração do spindle',assetId:'M-204',type:'corrective',priority:'urgent',status:'in_progress',dueAt:due(-1),createdAt:due(-2),createdByUid:'demo',assignedToUid:'demo',assignedTo:'Rafael Martins',estimatedCost:1850,downtimeHours:2,description:'Vibração acima do limite de atenção. Verificar rolamentos e alinhamento conforme procedimento da área.'},
      'OS-2026-049':{title:'Trocar correia da esteira',assetId:'E-015',type:'corrective',priority:'danger',status:'open',dueAt:due(0.5),createdAt:due(-1),createdByUid:'demo',assignedToUid:'demo',assignedTo:'Camila Souza',estimatedCost:680,downtimeHours:4,description:'Transportador parado para substituição da correia. Aplicar bloqueio antes da intervenção.'},
      'OS-2026-050':{title:'Preventiva do compressor',assetId:'C-102',type:'preventive',priority:'normal',status:'scheduled',dueAt:due(1),createdAt:due(-3),createdByUid:'demo',assignedTo:'João Ferreira',estimatedCost:420,downtimeHours:1,description:'Verificar filtros, nível de óleo e pressão de trabalho.'},
      'OS-2026-051':{title:'Calibrar sensores da prensa',assetId:'P-301',type:'inspection',priority:'normal',status:'open',dueAt:due(3),createdAt:due(-1),createdByUid:'demo',assignedToUid:'demo',assignedTo:'Rafael Martins',estimatedCost:260,downtimeHours:0.5,description:'Comparar instrumentos com padrão rastreável.'},
      'OS-2026-046':{title:'Corrigir vedação da bomba',assetId:'B-008',type:'corrective',priority:'urgent',status:'completed',dueAt:due(-5),createdAt:due(-8),completedAt:due(-5),createdByUid:'demo',assignedTo:'João Ferreira',estimatedCost:320,downtimeHours:1.5,completionNote:'Vedação substituída e teste de estanqueidade concluído.'},
      'OS-2026-047':{title:'Lubrificar célula robotizada',assetId:'R-011',type:'preventive',priority:'low',status:'completed',dueAt:due(-3),createdAt:due(-7),completedAt:due(-3),createdByUid:'demo',assignedTo:'Camila Souza',estimatedCost:180,downtimeHours:0.75,completionNote:'Pontos de lubrificação conferidos e ciclo de teste aprovado.'}
    };
    const inventory={
      'PEC-001':{name:'Rolamento 6205-2RS',sku:'ROL-6205',qty:3,min:5,price:85,monthlyUse:8,unit:'un',location:'A-01',category:'Rolamentos'},
      'PEC-002':{name:'Óleo hidráulico ISO VG 46',sku:'OLE-046',qty:80,min:40,price:32,monthlyUse:24,unit:'L',location:'B-03',category:'Lubrificantes'},
      'PEC-003':{name:'Correia dentada HTD 8M',sku:'COR-8M',qty:1,min:3,price:220,monthlyUse:2,unit:'un',location:'A-04',category:'Transmissão'},
      'PEC-004':{name:'Sensor indutivo M18',sku:'SEN-M18',qty:12,min:4,price:145,monthlyUse:3,unit:'un',location:'C-02',category:'Automação'},
      'PEC-005':{name:'Filtro de ar compressor',sku:'FLT-GA37',qty:6,min:3,price:168,monthlyUse:2,unit:'un',location:'B-01',category:'Filtros'},
      'PEC-006':{name:'Vedação mecânica 25 mm',sku:'VED-025',qty:0,min:2,price:180,monthlyUse:1,unit:'un',location:'A-02',category:'Vedações'}
    };
    const suppliers={
      'FOR-001':{name:'Mecânica Sul',taxId:'12.345.678/0001-90',category:'Componentes mecânicos',contact:'Mariana Lopes',email:'contato@example.com',phone:'(11) 3000-1000',leadTimeDays:5,rating:4.8,active:true},
      'FOR-002':{name:'Automação Integrada',taxId:'98.765.432/0001-10',category:'Automação e sensores',contact:'Pedro Lima',email:'vendas@example.com',phone:'(11) 3000-2000',leadTimeDays:3,rating:4.6,active:true},
      'FOR-003':{name:'Lubritec Industrial',taxId:'11.222.333/0001-44',category:'Lubrificantes',contact:'Ana Ribeiro',email:'suporte@example.com',phone:'(11) 3000-3000',leadTimeDays:7,rating:4.9,active:true}
    };
    const plans={
      'PM-001':{name:'Rotina mensal do compressor',assetId:'C-102',frequencyDays:30,nextDueAt:due(1),estimatedHours:1.5,active:true,checklist:'Verificar nível de óleo\nInspecionar filtros\nMedir pressão\nRegistrar ruídos'},
      'PM-002':{name:'Inspeção semanal do CNC',assetId:'M-204',frequencyDays:7,nextDueAt:due(-1),estimatedHours:1,active:true,checklist:'Verificar spindle\nConferir lubrificação\nMedir vibração'},
      'PM-003':{name:'Lubrificação da prensa',assetId:'P-301',frequencyDays:15,nextDueAt:due(4),estimatedHours:2,active:true,checklist:'Inspecionar mangueiras\nLubrificar guias\nVerificar pressão'},
      'PM-004':{name:'Revisão da célula robotizada',assetId:'R-011',frequencyDays:90,nextDueAt:due(11),estimatedHours:3,active:true,checklist:'Conferir cabos\nInspecionar redutor\nValidar ciclo'}
    };
    return {assets,inventory,work_orders,maintenance_plans:plans,suppliers,
      companies:{'planta-01':{name:'Planta industrial · Demonstração',city:'São Paulo'}},
      maintenance_requests:{'SOL-001':{title:'Ruído no eixo do CNC',assetId:'M-204',description:'Ruído intermitente durante a usinagem em alta rotação.',priority:'urgent',status:'new',requesterUid:'demo',requesterName:'Produção · Turno A',createdAt:due(-0.25)}},
      purchase_requests:{'SC-001':{itemName:'Rolamento 6205-2RS',inventoryId:'PEC-001',supplierId:'FOR-001',qty:10,estimatedUnitCost:85,justification:'Reposição do estoque mínimo para atender as preventivas.',priority:'urgent',status:'submitted',requesterUid:'demo',createdAt:due(-2)},'SC-002':{itemName:'Correia dentada HTD 8M',inventoryId:'PEC-003',supplierId:'FOR-001',qty:4,estimatedUnitCost:220,justification:'Reposição para a linha de envase.',priority:'normal',status:'ordered',requesterUid:'demo',createdAt:due(-5)}},
      supplier_contracts:{'CT-001':{title:'Manutenção dos compressores',supplierId:'FOR-001',startDate:N.dateInput(due(-150)),endDate:N.dateInput(due(25)),totalValue:24000,owner:'Gestão de Manutenção',renewalNoticeDays:30,templateKey:'maintenance',active:true,notes:'Visitas mensais e suporte corretivo em horário comercial.'}},
      asset_warranties:{'GA-001':{assetId:'R-011',supplierId:'FOR-002',endDate:N.dateInput(due(120)),coverageType:'Componentes e mão de obra',reference:'NF-2025-114',notes:'Conforme documento do fornecedor.'}},
      inspection_routes:{'RT-001':{name:'Ronda de utilidades',frequencyDays:1,nextDueAt:due(0),active:true,assetIds:['C-102','B-008'],checkpoints:'Temperatura\nVibração\nVazamentos'},'RT-002':{name:'Inspeção de usinagem',frequencyDays:7,nextDueAt:due(2),active:true,assetIds:['M-204','T-006'],checkpoints:'Lubrificação\nRuído\nProteções'}},
      inspection_executions:{},inspection_results:{},
      telemetry:{latest:Object.fromEntries(Object.entries(assets).slice(0,4).map(([id,a])=>['DEV-'+id,{assetId:id,temperature:a.temp,vibration:a.vibration,energyKwh:a.energyKwh,receivedAt:now-30000}])),history:{}},
      iot_device_config:Object.fromEntries(Object.entries(assets).slice(0,4).map(([id,a])=>['DEV-'+id,{label:'Sensor · '+id,assetId:id,tempWarning:70,tempCritical:85,vibrationWarning:4.5,vibrationCritical:7.1,active:true}])),
      iot_alerts:{'ALT-001':{assetId:'M-204',deviceId:'DEV-M-204',message:'Vibração acima de 4,5 mm/s',severity:'warning',acknowledged:false,createdAt:due(-0.1)}},
      work_order_checklists:{'OS-2026-048':{'1':{title:'Confirmar bloqueio e liberação da área',done:true},'2':{title:'Medir vibração conforme procedimento',done:false},'3':{title:'Inspecionar rolamentos',done:false}}},
      work_order_time_entries:{'OS-2026-048':{'1':{hours:0.5,note:'Inspeção inicial e diagnóstico',createdAt:due(-0.2),userUid:'demo'}}},work_order_parts:{},work_order_comments:{},work_order_activity:{},asset_documents:{},
      users:{demo:{name:'Rafael Martins',email:'rafael@example.com',role:'Administrador',accessStatus:'active',company:'Planta industrial · Demonstração'}},
      audit_logs:{'EVT-001':{description:'Ambiente de demonstração iniciado',createdByUid:'demo',createdAt:now,action:'demo'}},backup_jobs:{},notification_preferences:{}
    };
  };
  N.beginDemo = function(role='Administrador') { sessionStorage.setItem('nexus-mode','demo'); sessionStorage.setItem('nexus-demo-role',this.roles.includes(role)?role:'Administrador'); };
  N.persist = function() { localStorage.setItem(DEMO_KEY,JSON.stringify(this.data)); };
  N.changed = function(path) { document.dispatchEvent(new CustomEvent('nexus:data',{detail:{path}})); };
  N.connect = async function() {
    const targetMode=sessionStorage.getItem('nexus-mode')==='demo'?'demo':'firebase';
    if(readyPromise&&this.mode!==targetMode)this.disconnect();
    if (readyPromise) return readyPromise;
    readyPromise=(async()=>{
      if(sessionStorage.getItem('nexus-mode')==='demo') {
        this.mode='demo'; this.uid='demo';
        try { this.data=JSON.parse(localStorage.getItem(DEMO_KEY)||'null') || this.seed(); } catch { this.data=this.seed(); }
        this.user={...(this.data.users?.demo || {}),name:this.data.users?.demo?.name||'Rafael Martins',email:this.data.users?.demo?.email||'rafael@example.com',role:sessionStorage.getItem('nexus-demo-role')||'Administrador',accessStatus:'active'};
        this.sync='demo'; this.persist(); return true;
      }
      this.mode='firebase';
      const profile=await this.getProfile(); if(!profile || profile.missing || profile.invalid || profile.blocked) return profile;
      this.sync='connecting'; this.data={};
      const paths=[...this.collections,'notification_preferences/'+this.uid];
      if(this.isAdmin()) paths.push('users','audit_logs','backup_jobs');
      await Promise.all(paths.map(path=>new Promise(resolve=>{
        const ref=this.db.ref(path); const timed=setTimeout(()=>{this.readErrors=this.readErrors||{};this.readErrors[path]='Os dados ainda não chegaram. Reconecte para confirmar esta coleção.';resolve();this.changed(path);},10000);
        const callback=snap=>{this.data[path]=snap.val()||{};if(this.readErrors)delete this.readErrors[path];clearTimeout(timed);resolve();this.changed(path);};
        ref.on('value',callback,error=>{clearTimeout(timed);this.data[path]={};this.readErrors=this.readErrors||{};this.readErrors[path]=N.errorText(error);resolve();this.changed(path);});
        this.unsubscribers.push(()=>ref.off('value',callback));
      })));
      this.db.ref('.info/connected').on('value',snap=>{this.online=!!snap.val();this.sync=this.online?'online':'offline';document.dispatchEvent(new CustomEvent('nexus:connection'));});
      this.profileRef=this.db.ref('users/'+this.uid);
      this.profileCallback=snap=>{const p=snap.val();if(!p||['blocked','disabled','pending','suspended'].includes(p.accessStatus)){this.disconnect();this.auth.signOut().finally(()=>location.assign(this.href('login')));return;} this.user=p;document.dispatchEvent(new CustomEvent('nexus:profile'));};
      this.profileRef.on('value',this.profileCallback);
      this.sync=this.online?'online':'offline'; return true;
    })().catch(error=>{readyPromise=null;throw error;});
    return readyPromise;
  };
  N.disconnect = function() { this.unsubscribers.forEach(fn=>fn());this.unsubscribers=[];if(this.profileRef)this.profileRef.off('value',this.profileCallback);if(this.db)this.db.ref('.info/connected').off();readyPromise=null;authPromise=null;this.user=null;this.data={};this.readErrors={}; };
  N.getNested = function(path) { return path.split('/').reduce((obj,key)=>obj?.[key],this.data); };
  N.setNested = function(path,value) { const keys=path.split('/');let obj=this.data;keys.slice(0,-1).forEach(k=>{obj[k]=obj[k]||{};obj=obj[k];});if(value===null)delete obj[keys.at(-1)];else obj[keys.at(-1)]=value; };
  N.checkWritable = function(path) {
    if(!this.user)throw new Error('Entre em uma conta para continuar.');
    if(!this.canWrite(path) && !(this.isAdmin()&&path==='backup_jobs'))throw new Error('Seu cargo não permite esta alteração.');
    if(this.mode==='firebase'&&!this.online)throw new Error('Sem conexão. Reconecte para salvar no Firebase.');
  };
  N.save = async function(path,id,value) {
    if(path.split('/').some(k=>!k||/[.#$\[\]]/.test(k)||['__proto__','prototype','constructor'].includes(k)))throw new Error('Caminho inválido.');
    this.checkWritable(path); id=id || this.id(path.split('/')[0].slice(0,3).toUpperCase());
    if(/[.#$\[\]/]/.test(id)||['__proto__','prototype','constructor'].includes(id))throw new Error('Identificador inválido.');
    const target=path+'/'+id, old=this.getNested(target)||{};
    const record={...old,...value,updatedAt:Date.now(),updatedByUid:this.uid};
    if(!old.createdAt)record.createdAt=Date.now();
    if(!old.createdByUid)record.createdByUid=this.uid;
    if(path==='work_orders'&&!this.canOrder(old))throw new Error('Esta ordem está atribuída a outro técnico.');
    if(this.mode==='demo'){this.setNested(target,record);this.persist();this.changed(path);}else if(Object.keys(old).length)await this.db.ref(target).update({...value,updatedAt:record.updatedAt,updatedByUid:this.uid,...(!old.createdByUid?{createdByUid:this.uid}:{}),...(!old.createdAt?{createdAt:record.createdAt}:{})});else await this.db.ref(target).set(record);
    await this.audit((old.createdAt?'Atualizou':'Registrou')+' '+(record.name||record.title||record.itemName||id),path,id);
    return id;
  };
  N.remove = async function(path,id) {
    if((path+'/'+id).split('/').some(k=>!k||/[.#$\[\]]/.test(k)||['__proto__','prototype','constructor'].includes(k)))throw new Error('Caminho inválido.');
    this.checkWritable(path);if(path==='work_orders'&&!this.isAdmin())throw new Error('Somente o administrador pode excluir ordens.');
    if(path==='assets'&&this.entries('work_orders').some(o=>o.assetId===id))throw new Error('Este ativo possui ordens vinculadas. Preserve seu histórico e altere o status para Parada.');
    if(path==='suppliers'&&this.entries('supplier_contracts').some(c=>c.supplierId===id))throw new Error('Este fornecedor possui contratos vinculados. Desative o cadastro.');
    if(this.mode==='demo'){this.setNested(path+'/'+id,null);this.persist();this.changed(path);}else await this.db.ref(path+'/'+id).remove();
    await this.audit('Excluiu '+id,path,id);
  };
  N.audit = async function(description,path='',recordId='') {
    const id=this.id('LOG'),record={description:String(description).slice(0,300),collection:path,recordId,createdAt:Date.now(),createdByUid:this.uid,userName:this.user?.name||'',action:'change'};
    if(this.mode==='demo'){this.data.audit_logs=this.data.audit_logs||{};this.data.audit_logs[id]=record;this.persist();}
    else {try{await this.db.ref('audit_logs/'+id).set(record);}catch(error){console.warn('Auditoria: registro não gravado',error.code);this.toast?.('Alteração salva. O registro de auditoria não pôde ser gravado.','warning');}}
  };
  N.moveInventory = async function(id,delta,note) {
    this.checkWritable('inventory');delta=Number(delta);if(!Number.isFinite(delta)||!delta)throw new Error('Informe uma quantidade válida.');
    const movement={delta,note,createdAt:Date.now(),createdByUid:this.uid,userName:this.user.name};
    if(this.mode==='demo'){
      const item=this.data.inventory[id];if(!item||Number(item.qty)+delta<0)throw new Error('Saldo insuficiente para esta saída.');
      item.qty=Number(item.qty)+delta;item.movements=item.movements||{};item.movements[this.id('MOV')]=movement;this.persist();this.changed('inventory');
    }else{
      const key=this.db.ref('inventory/'+id+'/movements').push().key;
      const result=await this.db.ref('inventory/'+id).transaction(item=>{if(!item||Number(item.qty)+delta<0)return;item.qty=Number(item.qty)+delta;item.movements=item.movements||{};item.movements[key]=movement;return item;});
      if(!result.committed)throw new Error('Saldo insuficiente ou cadastro indisponível.');
    }
    await this.audit((delta>0?'Entrada':'Saída')+' de '+Math.abs(delta)+' em '+id+': '+note,'inventory',id);
  };
  N.batch = async function(updates) {
    if(!this.user)throw new Error('Entre para continuar.');
    if(this.mode==='firebase'&&!this.online)throw new Error('Reconecte para salvar as alterações.');
    for(const path of Object.keys(updates)){if(path.split('/').some(k=>['__proto__','prototype','constructor'].includes(k)))throw new Error('Caminho inválido.');if(!this.canWrite(path))throw new Error('Seu perfil não pode alterar '+path.split('/')[0]+'.');}
    if(this.mode==='demo'){Object.entries(updates).forEach(([path,value])=>this.setNested(path,value));this.persist();this.changed('batch');}
    else await this.db.ref().update(updates);
  };
  N.resetDemo=function(){this.data=this.seed();this.user={...this.data.users.demo,role:sessionStorage.getItem('nexus-demo-role')||'Administrador'};this.persist();this.changed('all');};
})(window.Nexus);
