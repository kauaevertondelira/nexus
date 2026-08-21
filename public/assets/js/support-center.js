(function () {
    'use strict';

    const openButton = document.getElementById('support-center-open');
    if (!openButton) return;

    const ROUTES = {
        menu: { label: 'Abrir Visão Global', href: 'menu.html' },
        ativos: { label: 'Abrir Parque de Ativos', href: 'ativos.html' },
        ativo: { label: 'Abrir Parque de Ativos', href: 'ativos.html' },
        os: { label: 'Abrir Ordens de Serviço', href: 'os.html' },
        planejamento: { label: 'Abrir Planejamento', href: 'planejamento.html' },
        preventiva: { label: 'Abrir Manutenção Preventiva', href: 'preventiva.html' },
        solicitacoes: { label: 'Abrir Solicitações', href: 'solicitacoes.html' },
        tecnico: { label: 'Abrir Espaço do Técnico', href: 'tecnico.html' },
        inspecoes: { label: 'Abrir Inspeções Digitais', href: 'inspecoes.html' },
        confiabilidade: { label: 'Abrir Confiabilidade', href: 'confiabilidade.html' },
        fornecedores: { label: 'Abrir Fornecedores', href: 'fornecedores.html' },
        compras: { label: 'Abrir Compras MRO', href: 'compras.html' },
        contratos: { label: 'Abrir Contratos e Garantias', href: 'contratos.html' },
        executivo: { label: 'Abrir Painel Executivo', href: 'executivo.html' },
        estoque: { label: 'Abrir Estoque', href: 'estoque.html' },
        financeiro: { label: 'Abrir Financeiro', href: 'financeiro.html' },
        mapa: { label: 'Abrir Planta Industrial', href: 'mapa.html' },
        consumo: { label: 'Abrir Mapa de Consumo', href: 'mapa-consumo.html' },
        iot: { label: 'Abrir Central IoT', href: 'iot.html' },
        notificacoes: { label: 'Abrir Notificações', href: 'notificacoes.html' },
        continuidade: { label: 'Abrir Continuidade', href: 'continuidade.html' }
    };

    const READ_ONLY_NOTICE = 'Sou um assistente somente de consulta. Não altero máquinas, O.S., estoque, usuários ou permissões.';
    const VLIBRAS_CONFIG = Object.freeze({
        scriptUrl: 'https://vlibras.gov.br/app/vlibras-plugin.js',
        appUrl: 'https://vlibras.gov.br/app',
        loadTimeoutMs: 12000,
        openRetryLimit: 20,
        openRetryDelayMs: 150
    });
    const KNOWLEDGE_URL = new URL('../data/assistant-knowledge.json', import.meta.url);
    let previousFocus = null;
    let vlibrasState = 'idle';
    let vlibrasWidgetCreated = false;
    let vlibrasLoadTimer = null;
    let knowledgeEntries = [];

    function normalizeText(value) {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    async function loadKnowledgeBase() {
        try {
            const response = await fetch(KNOWLEDGE_URL, { cache: 'no-cache' });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            knowledgeEntries = Array.isArray(data.entries) ? data.entries : [];
        } catch (error) {
            console.warn('Base de conhecimento local indisponível.', error);
            knowledgeEntries = [];
        }
    }

    function createPanel() {
        const overlay = document.createElement('div');
        overlay.id = 'nexus-support-overlay';
        overlay.className = 'nexus-support-overlay';
        overlay.hidden = true;
        overlay.innerHTML = `
            <section class="nexus-support-dialog" role="dialog" aria-modal="true" aria-labelledby="nexus-support-title">
                <header class="nexus-support-header">
                    <div>
                        <p class="nexus-support-eyebrow">Central Nexus</p>
                        <h2 id="nexus-support-title">Suporte e Acessibilidade</h2>
                    </div>
                    <button type="button" class="nexus-support-close" aria-label="Fechar suporte">
                        <i class="fas fa-xmark" aria-hidden="true"></i>
                    </button>
                </header>

                <div class="nexus-support-tabs" role="tablist" aria-label="Opções de suporte">
                    <button type="button" id="support-tab-assistant" role="tab" aria-selected="true" aria-controls="support-panel-assistant" data-support-tab="assistant">
                        <i class="fas fa-comments" aria-hidden="true"></i>
                        Assistente Nexus
                    </button>
                    <button type="button" id="support-tab-vlibras" role="tab" aria-selected="false" aria-controls="support-panel-vlibras" data-support-tab="vlibras" tabindex="-1">
                        <i class="fas fa-hands-asl-interpreting" aria-hidden="true"></i>
                        VLibras
                    </button>
                    <button type="button" id="support-tab-app" role="tab" aria-selected="false" aria-controls="support-panel-app" data-support-tab="app" tabindex="-1">
                        <i class="fas fa-mobile-screen-button" aria-hidden="true"></i>
                        Aplicativo
                    </button>
                </div>

                <div id="support-panel-assistant" class="nexus-support-panel nexus-assistant-panel" role="tabpanel" aria-labelledby="support-tab-assistant">
                    <div class="nexus-assistant-status">
                        <span><i class="fas fa-shield-halved" aria-hidden="true"></i> Somente consulta</span>
                        <small>As respostas são processadas localmente nesta página.</small>
                    </div>
                    <div id="nexus-chat-log" class="nexus-chat-log" role="log" aria-live="polite" aria-relevant="additions"></div>
                    <div class="nexus-quick-questions" aria-label="Perguntas rápidas">
                        <button type="button" data-chat-question="Como criar uma O.S.?">Criar O.S.</button>
                        <button type="button" data-chat-question="Explique os alertas atuais">Alertas atuais</button>
                        <button type="button" data-chat-question="Onde encontro cada função?">Localizar funções</button>
                        <button type="button" data-chat-question="Mostre o resumo desta tela">Resumo desta tela</button>
                    </div>
                    <form id="nexus-chat-form" class="nexus-chat-form">
                        <label for="nexus-chat-input" class="sr-only">Pergunte ao Assistente Nexus</label>
                        <input id="nexus-chat-input" type="text" maxlength="240" autocomplete="off" placeholder="Ex.: Como abrir uma ordem de serviço?" required>
                        <button type="submit" aria-label="Enviar pergunta">
                            <i class="fas fa-paper-plane" aria-hidden="true"></i>
                        </button>
                    </form>
                    <p class="nexus-assistant-disclaimer">O assistente orienta sobre o sistema, mas não substitui procedimentos de segurança ou avaliação técnica.</p>
                </div>

                <div id="support-panel-vlibras" class="nexus-support-panel nexus-vlibras-panel" role="tabpanel" aria-labelledby="support-tab-vlibras" hidden>
                    <div class="nexus-vlibras-symbol" aria-hidden="true"><i class="fas fa-hands-asl-interpreting"></i></div>
                    <h3>Tradução de conteúdo para Libras</h3>
                    <p>Ative o recurso oficial VLibras para traduzir textos desta tela por meio de um avatar.</p>
                    <ul>
                        <li>O recurso é carregado somente quando você solicitar.</li>
                        <li>A tradução automática é complementar às demais opções de acessibilidade.</li>
                        <li>Para fechar, utilize os controles da própria janela do VLibras.</li>
                    </ul>
                    <button type="button" id="nexus-vlibras-activate" class="nexus-vlibras-activate">
                        <i class="fas fa-hands-asl-interpreting" aria-hidden="true"></i>
                        <span>Ativar VLibras</span>
                    </button>
                    <p id="nexus-vlibras-status" class="nexus-vlibras-status" role="status" aria-live="polite"></p>
                </div>

                <div id="support-panel-app" class="nexus-support-panel nexus-app-panel" role="tabpanel" aria-labelledby="support-tab-app" hidden>
                    <div class="nexus-vlibras-symbol" aria-hidden="true"><i class="fas fa-mobile-screen-button"></i></div>
                    <h3>Aplicativo Nexus e notificações</h3>
                    <p>Instale o Nexus no computador ou celular e receba avisos do navegador para novos alertas críticos.</p>
                    <div class="nexus-app-actions">
                        <button type="button" id="nexus-pwa-install"><i class="fas fa-download" aria-hidden="true"></i><span>Instalar Nexus</span></button>
                        <button type="button" id="nexus-notifications-enable"><i class="fas fa-bell" aria-hidden="true"></i><span>Ativar notificações</span></button>
                    </div>
                    <p id="nexus-pwa-status" class="nexus-vlibras-status" role="status" aria-live="polite">Verificando compatibilidade do navegador…</p>
                    <p class="nexus-app-note">A estrutura pode abrir sem internet, mas dados industriais e autenticação continuam exigindo conexão com o Firebase.</p>
                </div>
            </section>`;
        document.body.appendChild(overlay);
        return overlay;
    }

    const overlay = createPanel();
    const dialog = overlay.querySelector('.nexus-support-dialog');
    const closeButton = overlay.querySelector('.nexus-support-close');
    const chatLog = overlay.querySelector('#nexus-chat-log');
    const chatForm = overlay.querySelector('#nexus-chat-form');
    const chatInput = overlay.querySelector('#nexus-chat-input');
    const vlibrasButton = overlay.querySelector('#nexus-vlibras-activate');
    const vlibrasStatus = overlay.querySelector('#nexus-vlibras-status');
    const pwaInstallButton = overlay.querySelector('#nexus-pwa-install');
    const notificationsButton = overlay.querySelector('#nexus-notifications-enable');
    const pwaStatus = overlay.querySelector('#nexus-pwa-status');

    function routeAvailable(routeKey) {
        if (routeKey === 'menu') return true;
        const pageKey = routeKey === 'consumo' ? 'mapa-consumo' : routeKey;
        const link = document.querySelector(`#sidebar [data-page="${pageKey}"]`);
        return Boolean(link && !link.hidden && link.style.display !== 'none');
    }

    function readText(id, fallback = '—') {
        const value = document.getElementById(id)?.textContent?.trim();
        return value || fallback;
    }

    function currentPageKey() {
        const filename = (window.location.pathname.split('/').pop() || 'menu.html').toLowerCase();
        const key = filename.replace(/\.html$/, '');
        return key === 'mapa-consumo' ? 'consumo' : key;
    }

    function dashboardSummary() {
        return `Disponibilidade: ${readText('kpi-oee')}%. Ativos cadastrados: ${readText('kpi-ativos')}. O.S. abertas: ${readText('kpi-os')}. Itens com estoque crítico: ${readText('kpi-stock')}.`;
    }

    function contextSummary() {
        const page = currentPageKey();
        if (page === 'menu') return dashboardSummary();
        if (page === 'os') return `Nesta tela: ${readText('kpi-todo', '0')} O.S. pendente(s), ${readText('kpi-doing', '0')} em execução e ${readText('kpi-done', '0')} concluída(s).`;
        if (page === 'estoque') return `Nesta tela: ${readText('kpi-total')} item(ns) cadastrados, valor total ${readText('kpi-value')} e ${readText('kpi-crit')} item(ns) em nível crítico.`;
        if (page === 'financeiro') return `Nesta tela: manutenção ${readText('kpi-maintenance')}, downtime ${readText('kpi-downtime')} e ${readText('kpi-os-done')} O.S. concluída(s).`;
        if (page === 'consumo') return `Nesta tela: energia ${readText('kpi-energia')} kWh, manutenção R$ ${readText('kpi-manutencao')} e insumos MRO R$ ${readText('kpi-mro')}.`;
        if (page === 'ativos') {
            const rows = [...document.querySelectorAll('#assets-list tr')].filter((row) => !/nenhum|carregar|não foi possível/i.test(row.textContent || ''));
            return `O Parque de Ativos está aberto e mostra ${rows.length} equipamento(s) na tabela atual.`;
        }
        if (page === 'mapa') return 'A Planta Industrial está aberta. Os equipamentos podem ser consultados visualmente e filtrados por estado operacional.';
        return 'Esta tela faz parte do Nexus Industrial. Posso explicar suas funções e indicar outros módulos disponíveis.';
    }

    function alertsSummary() {
        if (currentPageKey() !== 'menu') {
            return 'Os alertas consolidados ficam na Visão Global. Alertas vermelhos indicam falha ou temperatura elevada; alertas amarelos indicam atenção, como estoque abaixo do mínimo.';
        }
        const count = readText('notification-count', '0');
        const criticalList = document.getElementById('critical-list');
        const hasCritical = criticalList && !/nenhum alerta/i.test(criticalList.textContent || '');
        const detail = hasCritical
            ? 'Há alerta crítico de ativo na Visão Global. Abra o sino ou a lista de alertas e encaminhe a ocorrência ao responsável técnico.'
            : 'A lista de ativos não mostra alerta crítico neste momento.';
        return `O painel registra ${count} notificação(ões). ${detail} Alertas vermelhos indicam falha ou temperatura elevada; alertas amarelos indicam atenção, como estoque abaixo do mínimo.`;
    }

    function availableRoutes() {
        return Object.keys(ROUTES).filter(routeAvailable);
    }

    function answerFromKnowledge(text) {
        let bestEntry = null;
        let bestScore = 0;

        knowledgeEntries.forEach((entry) => {
            const score = (entry.keywords || []).reduce((total, keyword) => {
                const normalizedKeyword = normalizeText(keyword);
                if (!normalizedKeyword || !text.includes(normalizedKeyword)) return total;
                return total + Math.max(1, normalizedKeyword.split(' ').length);
            }, 0);
            if (score > bestScore) {
                bestEntry = entry;
                bestScore = score;
            }
        });

        if (!bestEntry || bestScore === 0) return null;
        return {
            text: bestEntry.answer,
            links: (bestEntry.routes || []).filter((route) => ROUTES[route] && routeAvailable(route))
        };
    }

    function answerQuestion(question) {
        const text = normalizeText(question);

        if (/excluir|apagar|deletar|alterar|editar|autorizar|mudar status|controlar maquina|ligar maquina|desligar maquina/.test(text)) {
            return { text: `${READ_ONLY_NOTICE} Posso explicar onde a ação autorizada é realizada e quais cuidados devem ser observados.` };
        }
        if (/alerta|notificacao|critico|falha|temperatura/.test(text)) {
            return { text: alertsSummary(), links: ['menu', ...(routeAvailable('ativos') ? ['ativos'] : [])] };
        }
        if ((/criar|abrir|nova|cadastrar/.test(text) && /os|ordem/.test(text)) || /ordem de servico/.test(text)) {
            return {
                text: 'Abra Ordens de Serviço e selecione “Nova O.S.”. Informe título, tipo, prioridade, ativo e prazo. O sistema sugere um SLA pela prioridade e registra usuário, data e observação na conclusão.',
                links: routeAvailable('os') ? ['os'] : []
            };
        }
        if (/resumo|indicador|dashboard|situacao|status do sistema/.test(text)) {
            const page = currentPageKey();
            return { text: contextSummary(), links: ROUTES[page] ? [page] : ['menu'] };
        }
        if (/estoque|peca|mro|csv/.test(text)) {
            return { text: 'O Estoque MRO permite pesquisar peças, acompanhar quantidade mínima, cadastrar itens e exportar CSV. Ao informar o consumo médio mensal, o sistema estima os dias de cobertura e o risco de ruptura.', links: routeAvailable('estoque') ? ['estoque'] : [] };
        }
        if (/ativo|maquina|equipamento/.test(text)) {
            return { text: 'O Parque de Ativos reúne condição, temperatura e setor, calcula um risco preventivo por regras e gera etiquetas QR para localizar cada equipamento. A pontuação é apoio operacional, não diagnóstico técnico.', links: routeAvailable('ativos') ? ['ativos'] : [] };
        }
        if (/financeiro|custo|downtime|administrador|cargo|permissao/.test(text)) {
            return { text: 'O Financeiro reúne custos, downtime, relatórios e a administração de cargos. A autorização de outro administrador só pode ser feita por um administrador já autenticado.', links: routeAvailable('financeiro') ? ['financeiro'] : [] };
        }
        if (/planta|mapa industrial|gemeo digital|localizacao/.test(text)) {
            return { text: 'A Planta Industrial mostra a posição e o estado visual das máquinas. Use os filtros para destacar equipamentos operando, em alerta ou parados.', links: routeAvailable('mapa') ? ['mapa'] : [] };
        }
        if (/consumo|energia|insumo|manutencao/.test(text)) {
            return { text: 'O Mapa de Consumo compara energia, manutenção e insumos. Também identifica equipamentos 25% acima da média de sua área e estima um potencial comparativo de redução.', links: routeAvailable('consumo') ? ['consumo'] : [] };
        }
        if (/vlibras|libras|acessibilidade|surdo/.test(text)) {
            return { text: 'Selecione a aba “VLibras” nesta Central e pressione “Ativar VLibras”. O tradutor será carregado apenas nessa tela.' };
        }
        if (/onde|funcao|menu|pagina|tela|navegar|localizar/.test(text)) {
            return { text: 'Use os atalhos abaixo para abrir as funções disponíveis para o seu cargo. A barra lateral também permite pesquisar pelo nome de cada módulo.', links: availableRoutes().filter((route) => route !== 'menu') };
        }
        const knowledgeAnswer = answerFromKnowledge(text);
        if (knowledgeAnswer) return knowledgeAnswer;
        if (/ola|oi|ajuda|o que voce faz|pode fazer/.test(text)) {
            return { text: `${READ_ONLY_NOTICE} Posso explicar alertas, mostrar o resumo do painel, orientar a criação de O.S. e localizar os módulos disponíveis.` };
        }
        return { text: 'Não encontrei uma resposta específica. Tente perguntar sobre alertas, criação de O.S., ativos, estoque, financeiro, planta industrial, consumo ou acessibilidade.', links: availableRoutes().filter((route) => route !== 'menu') };
    }

    function appendMessage(role, response) {
        const message = document.createElement('div');
        message.className = `nexus-chat-message is-${role}`;
        const label = document.createElement('span');
        label.className = 'nexus-chat-message-label';
        label.textContent = role === 'user' ? 'Você' : 'Assistente Nexus';
        const bubble = document.createElement('div');
        bubble.className = 'nexus-chat-bubble';
        const paragraph = document.createElement('p');
        paragraph.textContent = response.text;
        bubble.appendChild(paragraph);

        const links = (response.links || []).filter((route, index, all) => ROUTES[route] && all.indexOf(route) === index);
        if (links.length) {
            const actions = document.createElement('div');
            actions.className = 'nexus-chat-links';
            links.forEach((route) => {
                const anchor = document.createElement('a');
                anchor.href = ROUTES[route].href;
                anchor.textContent = ROUTES[route].label;
                actions.appendChild(anchor);
            });
            bubble.appendChild(actions);
        }
        message.append(label, bubble);
        chatLog.appendChild(message);
        chatLog.scrollTop = chatLog.scrollHeight;
    }

    function ask(question) {
        const cleanQuestion = String(question || '').trim().slice(0, 240);
        if (!cleanQuestion) return;
        appendMessage('user', { text: cleanQuestion });
        appendMessage('bot', answerQuestion(cleanQuestion));
    }

    function selectTab(tabName, focusTab = false) {
        overlay.querySelectorAll('[data-support-tab]').forEach((tab) => {
            const selected = tab.dataset.supportTab === tabName;
            tab.setAttribute('aria-selected', String(selected));
            tab.tabIndex = selected ? 0 : -1;
            if (selected && focusTab) tab.focus();
        });
        overlay.querySelector('#support-panel-assistant').hidden = tabName !== 'assistant';
        overlay.querySelector('#support-panel-vlibras').hidden = tabName !== 'vlibras';
        overlay.querySelector('#support-panel-app').hidden = tabName !== 'app';
        if (tabName === 'app') syncPwaPanel();
    }

    function openPanel() {
        previousFocus = document.activeElement;
        overlay.hidden = false;
        openButton.setAttribute('aria-expanded', 'true');
        document.documentElement.classList.add('nexus-support-open');
        document.documentElement.classList.remove('sidebar-mobile-open');
        selectTab('assistant');
        window.setTimeout(() => chatInput.focus(), 0);
    }

    function closePanel() {
        overlay.hidden = true;
        openButton.setAttribute('aria-expanded', 'false');
        document.documentElement.classList.remove('nexus-support-open');
        if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus();
    }

    function trapFocus(event) {
        if (event.key !== 'Tab') return;
        const focusable = [...dialog.querySelectorAll('button:not([disabled]):not([hidden]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')].filter((element) => element.offsetParent !== null);
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    }

    function ensureVlibrasHost() {
        let host = document.querySelector('[data-nexus-vlibras-host]');
        if (host) return host;
        host = document.createElement('div');
        host.className = 'enabled nexus-vlibras-host';
        host.setAttribute('vw', '');
        host.setAttribute('data-nexus-vlibras-host', '');
        host.innerHTML = '<div vw-access-button class="active"></div><div vw-plugin-wrapper><div class="vw-plugin-top-wrapper"></div></div>';
        document.body.appendChild(host);
        return host;
    }

    function openVlibrasWidget(attempt = 0) {
        const accessButton = document.querySelector('[data-nexus-vlibras-host] [vw-access-button]');
        if (accessButton && vlibrasWidgetCreated) {
            accessButton.click();
            vlibrasStatus.textContent = 'VLibras aberto.';
            vlibrasButton.querySelector('span').textContent = 'Abrir VLibras novamente';
            closePanel();
            return;
        }
        if (attempt < VLIBRAS_CONFIG.openRetryLimit) {
            window.setTimeout(() => openVlibrasWidget(attempt + 1), VLIBRAS_CONFIG.openRetryDelayMs);
            return;
        }
        vlibrasState = 'error';
        vlibrasButton.disabled = false;
        vlibrasButton.removeAttribute('aria-busy');
        vlibrasStatus.textContent = 'Não foi possível abrir o VLibras. Verifique a conexão e tente novamente.';
    }

    function initializeVlibras() {
        window.clearTimeout(vlibrasLoadTimer);
        vlibrasLoadTimer = null;
        ensureVlibrasHost();
        try {
            if (!vlibrasWidgetCreated) {
                new window.VLibras.Widget(VLIBRAS_CONFIG.appUrl);
                vlibrasWidgetCreated = true;
            }
            vlibrasState = 'ready';
            vlibrasButton.disabled = false;
            vlibrasButton.removeAttribute('aria-busy');
            window.setTimeout(() => openVlibrasWidget(), 350);
        } catch (error) {
            console.warn('Falha ao iniciar VLibras.', error);
            vlibrasState = 'error';
            vlibrasButton.disabled = false;
            vlibrasButton.removeAttribute('aria-busy');
            vlibrasStatus.textContent = 'Não foi possível iniciar o VLibras. Tente novamente.';
        }
    }

    function activateVlibras() {
        if (vlibrasState === 'loading') return;
        if (vlibrasState === 'ready' && vlibrasWidgetCreated) {
            openVlibrasWidget();
            return;
        }
        vlibrasState = 'loading';
        vlibrasButton.disabled = true;
        vlibrasButton.setAttribute('aria-busy', 'true');
        vlibrasStatus.textContent = 'Carregando o recurso oficial VLibras…';

        if (window.VLibras?.Widget) {
            initializeVlibras();
            return;
        }
        let script = document.querySelector('script[data-nexus-vlibras-script]');
        if (!script) {
            script = document.createElement('script');
            script.src = VLIBRAS_CONFIG.scriptUrl;
            script.async = true;
            script.setAttribute('data-nexus-vlibras-script', '');
            document.head.appendChild(script);
        }
        script.addEventListener('load', initializeVlibras, { once: true });
        script.addEventListener('error', () => {
            window.clearTimeout(vlibrasLoadTimer);
            vlibrasLoadTimer = null;
            script.remove();
            vlibrasState = 'error';
            vlibrasButton.disabled = false;
            vlibrasButton.removeAttribute('aria-busy');
            vlibrasStatus.textContent = 'Não foi possível carregar o VLibras. Verifique a conexão.';
        }, { once: true });
        window.clearTimeout(vlibrasLoadTimer);
        vlibrasLoadTimer = window.setTimeout(() => {
            if (vlibrasState !== 'loading') return;
            script.remove();
            vlibrasState = 'error';
            vlibrasButton.disabled = false;
            vlibrasButton.removeAttribute('aria-busy');
            vlibrasStatus.textContent = 'O VLibras demorou para responder. Verifique a conexão e tente novamente.';
        }, VLIBRAS_CONFIG.loadTimeoutMs);
    }

    function syncPwaPanel() {
        const api = window.NexusPWA;
        if (!api) {
            pwaInstallButton.disabled = true;
            notificationsButton.disabled = true;
            pwaStatus.textContent = 'Os recursos do aplicativo ainda estão sendo carregados.';
            return;
        }

        const state = api.getState();
        pwaInstallButton.disabled = state.installed || !state.installAvailable;
        pwaInstallButton.querySelector('span').textContent = state.installed
            ? 'Nexus instalado'
            : state.installAvailable ? 'Instalar Nexus' : 'Instalação pelo navegador';

        notificationsButton.disabled = !state.notificationsSupported || state.notificationPermission === 'denied';
        notificationsButton.querySelector('span').textContent = state.notificationPermission === 'granted' && state.notificationsEnabled
            ? 'Notificações ativadas'
            : state.notificationPermission === 'denied' ? 'Notificações bloqueadas' : 'Ativar notificações';

        const installStatus = state.installed
            ? 'Aplicativo instalado.'
            : state.installAvailable ? 'Instalação disponível.' : 'Use a opção “Instalar aplicativo” do navegador, quando disponível.';
        const notificationStatus = !state.notificationsSupported
            ? 'Este navegador não oferece notificações.'
            : state.notificationPermission === 'denied'
                ? 'Notificações bloqueadas nas configurações do navegador.'
                : state.notificationPermission === 'granted' && state.notificationsEnabled
                    ? 'Alertas críticos do painel serão notificados enquanto o aplicativo estiver ativo.'
                    : 'Notificações ainda não foram autorizadas.';
        pwaStatus.textContent = `${installStatus} ${notificationStatus}`;
    }

    async function handlePwaInstall() {
        const result = await window.NexusPWA?.install();
        if (result?.status === 'accepted') pwaStatus.textContent = 'Instalação aceita. O Nexus será adicionado aos seus aplicativos.';
        else if (result?.status === 'dismissed') pwaStatus.textContent = 'Instalação cancelada. Você pode tentar novamente pelo navegador.';
        else if (result?.status === 'installed') pwaStatus.textContent = 'O Nexus já está instalado.';
        else pwaStatus.textContent = 'Use a opção “Instalar aplicativo” no menu do navegador.';
        window.setTimeout(syncPwaPanel, 800);
    }

    async function handleNotifications() {
        const result = await window.NexusPWA?.requestNotifications();
        if (result?.status === 'granted') pwaStatus.textContent = 'Notificações ativadas. Novos alertas críticos poderão aparecer no navegador.';
        else if (result?.status === 'denied') pwaStatus.textContent = 'Notificações bloqueadas. Altere a permissão nas configurações do navegador para ativá-las.';
        else pwaStatus.textContent = 'Notificações não são compatíveis com este navegador.';
        window.setTimeout(syncPwaPanel, 800);
    }

    openButton.addEventListener('click', openPanel);
    closeButton.addEventListener('click', closePanel);
    overlay.addEventListener('click', (event) => {
        if (event.target === overlay) closePanel();
    });
    overlay.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            closePanel();
            return;
        }
        trapFocus(event);
    });
    overlay.querySelectorAll('[data-support-tab]').forEach((tab) => {
        tab.addEventListener('click', () => selectTab(tab.dataset.supportTab));
        tab.addEventListener('keydown', (event) => {
            if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
            event.preventDefault();
            const tabs = [...overlay.querySelectorAll('[data-support-tab]')];
            const direction = event.key === 'ArrowRight' ? 1 : -1;
            const nextIndex = (tabs.indexOf(tab) + direction + tabs.length) % tabs.length;
            selectTab(tabs[nextIndex].dataset.supportTab, true);
        });
    });
    overlay.querySelectorAll('[data-chat-question]').forEach((button) => {
        button.addEventListener('click', () => ask(button.dataset.chatQuestion));
    });
    chatForm.addEventListener('submit', (event) => {
        event.preventDefault();
        ask(chatInput.value);
        chatInput.value = '';
        chatInput.focus();
    });
    vlibrasButton.addEventListener('click', activateVlibras);
    pwaInstallButton.addEventListener('click', handlePwaInstall);
    notificationsButton.addEventListener('click', handleNotifications);
    window.addEventListener('nexus:pwa-state', syncPwaPanel);

    appendMessage('bot', { text: 'Olá! Posso explicar os alertas, orientar a criação de O.S., mostrar o resumo do painel e localizar funções. Não realizo alterações no sistema.' });
    loadKnowledgeBase();
    syncPwaPanel();
})();
