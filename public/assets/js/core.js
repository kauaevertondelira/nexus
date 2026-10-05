(function () {
  'use strict';
  const script = document.currentScript;
  const base = new URL('../../../', script.src);
  const N = window.Nexus = {
    base, version: '4.0.0', uid: '', user: null, mode: '', data: {}, unsubscribers: [],
    route: '', online: navigator.onLine, sync: 'idle', search: '', filter: 'all', layout: 'table',
    href: (page, query = '') => new URL('public/pages/' + page + '.html' + query, base).href,
    escape: value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
    safeURL(value) { try { const url = new URL(value); return url.protocol === 'https:' ? url.href : ''; } catch { return ''; } },
    num: value => Number.isFinite(Number(value)) ? Number(value) : 0,
    money: value => new Intl.NumberFormat('pt-BR', {style:'currency',currency:'BRL'}).format(Number(value) || 0),
    number: (value, digits = 0) => new Intl.NumberFormat('pt-BR',{maximumFractionDigits:digits}).format(Number(value) || 0),
    date(value, time = false) { if (!value) return '—'; const d = new Date(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value + 'T12:00:00' : value); return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR', {day:'2-digit',month:'short', ...(time ? {hour:'2-digit',minute:'2-digit'} : {year:'numeric'})}); },
    dateInput: value => { const d = new Date(value || Date.now()); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0,10); },
    id: prefix => prefix + '-' + (crypto.randomUUID ? crypto.randomUUID().slice(0,8) : Date.now().toString(36) + Math.random().toString(36).slice(2,6)),
    entries(path) { return Object.entries(this.data[path] || {}).filter(([,v])=>v && typeof v === 'object').map(([id, v])=>({...v, id})); },
    asset(id) { return this.data.assets?.[id] || {}; },
    role() { return this.user?.role || ''; },
    isAdmin() { return this.role() === 'Administrador'; }
  };
  N.roles = ['Administrador','Técnico de Manutenção','Almoxarifado / Suprimentos','Gestor de Manutenção','Planejador de Manutenção','Comprador','Supervisor de Produção','Gestor Financeiro'];
  N.routes = {
    menu: ['Visão global','Operação','grid'],
    ativos: ['Parque de ativos','Operação','machine'],
    'ativo-detalhes': ['Ficha do ativo','Operação','machine'],
    os: ['Ordens de serviço','Manutenção','tool'],
    'os-detalhes': ['Detalhes da ordem','Manutenção','tool'],
    planejamento: ['Planejamento','Manutenção','calendar'],
    preventiva: ['Planos preventivos','Manutenção','repeat'],
    solicitacoes: ['Solicitações','Manutenção','inbox'],
    tecnico: ['Meu trabalho','Manutenção','check'],
    inspecoes: ['Inspeções digitais','Manutenção','clipboard'],
    confiabilidade: ['Confiabilidade','Inteligência','pulse'],
    mapa: ['Gêmeo digital','Inteligência','cube'],
    'mapa-consumo': ['Energia e consumo','Inteligência','bolt'],
    iot: ['Central IoT','Inteligência','radio'],
    estoque: ['Estoque MRO','Suprimentos','box'],
    fornecedores: ['Fornecedores','Suprimentos','truck'],
    compras: ['Compras','Suprimentos','cart'],
    contratos: ['Contratos e garantias','Gestão','document'],
    financeiro: ['Financeiro','Gestão','coins'],
    executivo: ['Painel executivo','Gestão','chart'],
    notificacoes: ['Notificações','Sistema','bell'],
    continuidade: ['Continuidade e auditoria','Sistema','shield'],
    perfil: ['Meu perfil','Sistema','user']
  };
  const common = ['menu','perfil','notificacoes','ativos','ativo-detalhes','mapa'];
  const maintenance = ['os','os-detalhes','planejamento','preventiva','solicitacoes','tecnico','inspecoes','confiabilidade','iot','mapa-consumo'];
  N.access = {
    'Administrador': Object.keys(N.routes),
    'Técnico de Manutenção': [...common,...maintenance],
    'Gestor de Manutenção': [...common,...maintenance,'executivo','financeiro','estoque','fornecedores','compras','contratos'],
    'Planejador de Manutenção': [...common,...maintenance,'estoque','fornecedores'],
    'Almoxarifado / Suprimentos': [...common,'estoque','fornecedores','compras','contratos','os','os-detalhes'],
    'Comprador': [...common,'estoque','fornecedores','compras','contratos'],
    'Supervisor de Produção': [...common,'solicitacoes','iot','mapa-consumo','confiabilidade','os','os-detalhes'],
    'Gestor Financeiro': [...common,'financeiro','executivo','compras','contratos','estoque','fornecedores','mapa-consumo']
  };
  N.canAccess = function(page) {
    if (!(this.access[this.role()] || []).includes(page)) return false;
    const custom = this.user?.allowedPages;
    if (!custom || this.isAdmin() || ['menu','perfil','notificacoes'].includes(page)) return true;
    const allowed = Array.isArray(custom) ? custom : Object.keys(custom).filter(key=>custom[key]);
    return !allowed.length || allowed.includes(page) || allowed.includes(page + '.html');
  };
  N.writers = {
    assets: ['Administrador','Técnico de Manutenção','Gestor de Manutenção'],
    work_orders: ['Administrador','Técnico de Manutenção','Gestor de Manutenção','Planejador de Manutenção'],
    maintenance_plans: ['Administrador','Técnico de Manutenção','Gestor de Manutenção','Planejador de Manutenção'],
    maintenance_requests: N.roles,
    inventory: ['Administrador','Almoxarifado / Suprimentos','Comprador'],
    suppliers: ['Administrador','Almoxarifado / Suprimentos','Comprador'],
    purchase_requests: N.roles,
    supplier_contracts: ['Administrador','Gestor Financeiro'],
    asset_warranties: ['Administrador','Almoxarifado / Suprimentos','Comprador'],
    inspection_routes: ['Administrador','Técnico de Manutenção','Gestor de Manutenção'],
    inspection_executions: ['Administrador','Técnico de Manutenção','Gestor de Manutenção'],
    inspection_results: ['Administrador','Técnico de Manutenção','Gestor de Manutenção'],
    iot_device_config: ['Administrador','Técnico de Manutenção','Gestor de Manutenção'],
    iot_alerts: ['Administrador','Técnico de Manutenção','Gestor de Manutenção'],
    asset_documents: ['Administrador','Técnico de Manutenção','Gestor de Manutenção'],
    work_order_parts: ['Administrador','Técnico de Manutenção','Almoxarifado / Suprimentos'],
    work_order_checklists: ['Administrador','Técnico de Manutenção'],
    work_order_time_entries: ['Administrador','Técnico de Manutenção'],
    work_order_comments: N.roles,
    work_order_activity: ['Administrador','Técnico de Manutenção','Gestor de Manutenção','Planejador de Manutenção'],
    notification_preferences: N.roles,
    users: ['Administrador']
  };
  N.canWrite = function(path) { return (this.writers[path.split('/')[0]] || []).includes(this.role()); };
  N.collectionLabel=function(path){const labels={assets:'Ativos',inventory:'Estoque MRO',work_orders:'Ordens de serviço',maintenance_plans:'Planos preventivos',maintenance_requests:'Solicitações',suppliers:'Fornecedores',purchase_requests:'Compras',supplier_contracts:'Contratos',asset_warranties:'Garantias',inspection_routes:'Rotas de inspeção',inspection_executions:'Inspeções realizadas',inspection_results:'Resultados de inspeção',iot_device_config:'Dispositivos IoT',asset_documents:'Documentos técnicos',work_order_checklists:'Checklists',work_order_time_entries:'Apontamentos de horas',work_order_parts:'Peças utilizadas',work_order_comments:'Comentários',work_order_activity:'Histórico de ordens',reports:'Relatórios',backup_jobs:'Backups',users:'Usuários',demo:'Demonstração'};const parts=String(path||'').split('/');return (labels[parts[0]]||'Sistema')+(parts[1]?' · '+parts[1]:'');};
  N.canOrder = function(order) { return this.canWrite('work_orders') && (this.role() !== 'Técnico de Manutenção' || !order?.assignedToUid || order.assignedToUid === this.uid); };
  N.orderState = value => ({open:'Aberta',new:'Aberta',pending:'Aberta',scheduled:'Programada',planned:'Programada',in_progress:'Em execução',progress:'Em execução',completed:'Concluída',done:'Concluída',closed:'Concluída',cancelled:'Cancelada'}[value] || value || 'Aberta');
  N.orderDone = value => ['completed','done','closed','cancelled'].includes(value);
  N.statusText = value => ({online:'Operacional',offline:'Parada',danger:'Crítica',low:'Baixa',normal:'Normal',urgent:'Alta',critical:'Crítica',warning:'Atenção',ok:'Conforme',attention:'Atenção',new:'Nova',approved:'Aprovada',converted:'Convertida',rejected:'Rejeitada',cancelled:'Cancelada',submitted:'Em aprovação',ordered:'Pedido emitido',received:'Recebida',pending:'Pendente',active:'Ativo',blocked:'Bloqueado',completed:'Concluída',success:'Concluído'}[value] || N.orderState(value));
  N.tone = value => ['danger','critical','offline','rejected','blocked'].includes(value) ? 'red' : ['warning','attention','urgent','new','submitted','pending','open'].includes(value) ? 'amber' : ['online','ok','completed','done','approved','active','received','success'].includes(value) ? 'green' : 'blue';
  N.badge = (value, text) => '<span class="badge badge-' + N.tone(value) + '">' + N.escape(text || N.statusText(value)) + '</span>';
  N.risk = function(a) { const temp = this.num(a.temp), warning=this.num(a.tempWarning)||70, critical=this.num(a.tempCritical)||85; return Math.min(100, (a.status==='offline'?65:a.status==='danger'?55:5) + (temp>=critical?35:temp>=warning?20:0) + (a.criticality==='A'?10:0)); };
  N.metrics = function() {
    const assets=this.entries('assets'), orders=this.entries('work_orders'), open=orders.filter(o=>!this.orderDone(o.status)), completed=orders.filter(o=>['completed','done','closed'].includes(o.status));
    const down=completed.reduce((s,o)=>s+this.num(o.downtimeHours),0), operating=assets.reduce((s,a)=>s+this.num(a.operatingHours),0);
    const repairs=completed.filter(o=>o.type==='corrective' || o.type==='corretiva');
    return {assets,orders,open,completed,availability:assets.length ? assets.filter(a=>a.status==='online').length / assets.length * 100 : null,
      critical:assets.filter(a=>a.status==='danger'||a.status==='offline'), stock:this.entries('inventory').filter(i=>this.num(i.qty)<=this.num(i.min)),
      overdue:open.filter(o=>o.dueAt && this.num(o.dueAt)<Date.now()),cost:orders.filter(o=>o.status!=='cancelled').reduce((s,o)=>s+this.num(o.estimatedCost),0),energy:assets.reduce((s,a)=>s+this.num(a.energyKwh),0),
      mttr:repairs.length?repairs.reduce((s,o)=>s+this.num(o.downtimeHours),0)/repairs.length:null,mtbf:repairs.length&&operating?operating/repairs.length:null,downtime:down};
  };
  N.icon = function(name, cls = '') {
    const paths = {
      grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
      machine:'<path d="M3 21h18M5 21V9h14v12M8 9V4h8v5M9 13h6M9 17h6"/>',
      tool:'<path d="M14.7 6.3a5 5 0 0 1 6.4-1.1l-3.6 3.6 2.8 2.8 3.6-3.6a5 5 0 0 1-6.4 6.4L8 22a2.1 2.1 0 0 1-3-3l7.6-7.6a5 5 0 0 1 2.1-5.1Z" transform="translate(-2 -1)"/>',
      calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18M8 15h2M14 15h2"/>',
      repeat:'<path d="m17 2 4 4-4 4M3 11V8a2 2 0 0 1 2-2h16M7 22l-4-4 4-4M21 13v3a2 2 0 0 1-2 2H3"/>',
      inbox:'<path d="m4 4-2 10v6h20v-6L20 4ZM2 14h6l2 3h4l2-3h6"/>',
      check:'<path d="m4 12 5 5L20 6"/>',
      clipboard:'<rect x="5" y="4" width="14" height="17" rx="2"/><rect x="8" y="2" width="8" height="4" rx="1"/><path d="m8 13 2 2 5-5"/>',
      pulse:'<path d="M2 12h5l3-9 4 18 3-9h5"/>',
      cube:'<path d="m12 2 9 5v10l-9 5-9-5V7ZM3 7l9 5 9-5M12 12v10M7.5 4.5l9 5"/>',
      bolt:'<path d="m13 2-9 12h7l-1 8 10-13h-7Z"/>',
      radio:'<path d="M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14M8 8a6 6 0 0 0 0 8M16 8a6 6 0 0 1 0 8"/><circle cx="12" cy="12" r="2"/>',
      box:'<path d="m12 3 9 5v9l-9 5-9-5V8ZM3 8l9 5 9-5M12 13v9M7 5l9 5"/>',
      truck:'<path d="M1 4h13v13H1ZM14 9h5l3 4v4h-8"/><circle cx="5" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>',
      cart:'<path d="M2 3h3l3 14h11l3-10H6"/><circle cx="9" cy="21" r="1"/><circle cx="19" cy="21" r="1"/>',
      document:'<path d="M14 2H5v20h14V7ZM14 2v6h5M8 12h8M8 16h8"/>',
      coins:'<ellipse cx="10" cy="5" rx="7" ry="3"/><path d="M3 5v5c0 4 14 4 14 0V5M3 10v5c0 3 7 4 10 2M21 11v7c0 4-8 4-8 0v-7"/><ellipse cx="17" cy="11" rx="4" ry="2"/>',
      chart:'<path d="M3 3v18h18M7 15v3M12 9v9M17 5v13"/>',
      bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
      shield:'<path d="m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6ZM8 12l3 3 5-5"/>',
      user:'<circle cx="12" cy="7" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3"/>',
      search:'<circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/>',
      plus:'<path d="M12 5v14M5 12h14"/>',
      close:'<path d="m6 6 12 12M18 6 6 18"/>',
      more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
      download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
      logout:'<path d="M9 3H3v18h6M9 12h12m-4-4 4 4-4 4"/>',
      sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1 1M18 18l1 1M5 19l1-1M18 6l1-1"/>',
      moon:'<path d="M21 13A9 9 0 0 1 11 3a9 9 0 1 0 10 10Z"/>',
      menu:'<path d="M3 6h18M3 12h18M3 18h18"/>',
      edit:'<path d="m16 3 5 5-13 13H3v-5ZM13 6l5 5"/>',
      delete:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',
      play:'<path d="m7 3 14 9-14 9Z"/>',
      help:'<circle cx="12" cy="12" r="10"/><path d="M9 9a3 3 0 1 1 5 2l-2 2M12 17h.01"/>',
      link:'<path d="m10 13 4-4M8 16l-2 2a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0M14 8l2-2a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0" transform="translate(1 -1)"/>'
    };
    return '<svg class="icon '+cls+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (paths[name] || paths.grid) + '</svg>';
  };
  N.download = function(name, text, type = 'application/json') { const url=URL.createObjectURL(new Blob([text],{type})); const a=document.createElement('a'); a.href=url; a.download=name; document.body.append(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),10000); };
  N.errorText = error => ({'auth/invalid-credential':'E-mail ou senha incorretos.','auth/wrong-password':'E-mail ou senha incorretos.','auth/user-not-found':'E-mail ou senha incorretos.','auth/email-already-in-use':'Este e-mail já possui uma conta.','auth/weak-password':'Use uma senha com pelo menos 8 caracteres.','auth/too-many-requests':'Muitas tentativas. Aguarde e tente novamente.','auth/network-request-failed':'Não foi possível conectar. Verifique sua internet.','auth/unauthorized-domain':'Autorize o domínio desta página no Console Firebase.','auth/operation-not-allowed':'Ative E-mail/Senha em Authentication no Console Firebase.','PERMISSION_DENIED':'Seu perfil não tem permissão ou as regras precisam ser atualizadas.','permission_denied':'Seu perfil não tem permissão ou as regras precisam ser atualizadas.'}[error?.code] || error?.message || 'Não foi possível concluir. Tente novamente.');
})();
