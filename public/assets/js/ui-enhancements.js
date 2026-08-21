(function () {
    const html = document.documentElement;
    const enhancementScriptUrl = document.currentScript?.src || '';

    function applySavedTheme() {
        try {
            if (localStorage.theme === 'light') {
                html.classList.remove('dark');
            } else if (localStorage.theme === 'dark') {
                html.classList.add('dark');
            }
        } catch (error) {}
    }

    function closeMobileMenu() {
        html.classList.remove('sidebar-mobile-open');
    }

    function openMobileMenu() {
        html.classList.add('sidebar-mobile-open');
    }

    function addMobileMenuButton() {
        const headerTitle = document.querySelector('main > header > div:first-child');
        const sidebar = document.getElementById('sidebar');
        if (!headerTitle || !sidebar || document.querySelector('.nexus-mobile-menu-btn')) return;

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'nexus-mobile-menu-btn';
        button.setAttribute('aria-label', 'Abrir menu');
        button.setAttribute('aria-controls', 'sidebar');
        button.innerHTML = '<i class="fas fa-bars" aria-hidden="true"></i>';
        button.addEventListener('click', openMobileMenu);
        headerTitle.prepend(button);

        const backdrop = document.createElement('button');
        backdrop.type = 'button';
        backdrop.className = 'nexus-sidebar-backdrop';
        backdrop.setAttribute('aria-label', 'Fechar menu');
        backdrop.addEventListener('click', closeMobileMenu);
        document.body.appendChild(backdrop);

        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape') closeMobileMenu();
        });

        sidebar.querySelectorAll('a').forEach(function (link) {
            link.addEventListener('click', closeMobileMenu);
        });
    }

    function addSupportMenu() {
        const sidebar = document.getElementById('sidebar');
        const navigation = sidebar?.querySelector('nav');
        if (!sidebar || !navigation) return false;
        if (document.getElementById('support-center-open')) return true;

        const mapLayout = navigation.id === 'sidebar-nav';
        const group = document.createElement('div');
        group.id = 'support-menu-group';
        group.className = 'mt-4 pt-3 border-t border-slate-200 dark:border-dark-800/70';

        const heading = document.createElement('p');
        heading.className = mapLayout
            ? 'sidebar-text text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 px-2 transition-opacity duration-300 whitespace-nowrap'
            : 'sb-text text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 px-2';
        heading.textContent = 'Suporte';

        const button = document.createElement('button');
        button.type = 'button';
        button.id = 'support-center-open';
        button.dataset.menuItem = '';
        button.className = mapLayout
            ? 'sb-link nav-link w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-300 text-left text-slate-500 hover:bg-emerald-50 hover:text-emerald-700 dark:text-slate-400 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-300'
            : 'sb-link w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 text-left text-slate-500 hover:bg-emerald-50 hover:text-emerald-700 dark:text-slate-400 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-300';
        button.setAttribute('aria-haspopup', 'dialog');
        button.setAttribute('aria-expanded', 'false');
        button.setAttribute('aria-controls', 'nexus-support-overlay');
        button.setAttribute('title', 'Suporte e Acessibilidade');
        button.setAttribute('aria-label', 'Abrir Suporte e Acessibilidade');

        const icon = document.createElement('i');
        icon.className = `fas fa-headset ${mapLayout ? 'w-6' : 'w-5'} text-center shrink-0`;
        icon.setAttribute('aria-hidden', 'true');
        const label = document.createElement('span');
        label.className = mapLayout
            ? 'sidebar-text transition-opacity duration-300 whitespace-nowrap'
            : 'sb-text';
        label.textContent = 'Suporte e Acessibilidade';

        button.append(icon, label);
        group.append(heading, button);
        navigation.appendChild(group);
        return true;
    }

    function addMaintenanceMenu() {
        const sidebar = document.getElementById('sidebar');
        const navigation = sidebar?.querySelector('nav');
        if (!sidebar || !navigation) return false;
        if (navigation.querySelector('[data-maintenance-menu]')) return true;

        const mapLayout = navigation.id === 'sidebar-nav';
        const group = document.createElement('div');
        group.dataset.maintenanceMenu = '';
        group.className = 'mt-4 pt-3 border-t border-slate-200 dark:border-dark-800/70';
        group.hidden = true;
        const textClass = mapLayout ? 'sidebar-text transition-opacity duration-300 whitespace-nowrap' : 'sb-text';
        const linkClass = mapLayout
            ? 'sb-link nav-link flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-300 text-slate-500 hover:bg-slate-100 hover:text-brand dark:text-slate-400 dark:hover:bg-dark-800 dark:hover:text-white'
            : 'sb-link flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-300 text-slate-500 hover:bg-slate-100 hover:text-brand dark:text-slate-400 dark:hover:bg-dark-800 dark:hover:text-white';
        const links = [
            ['planejamento', 'planejamento.html', 'fa-calendar-days', 'Planejamento'],
            ['preventiva', 'preventiva.html', 'fa-arrows-rotate', 'Manutenção Preventiva'],
            ['solicitacoes', 'solicitacoes.html', 'fa-bullhorn', 'Solicitações'],
            ['tecnico', 'tecnico.html', 'fa-user-gear', 'Espaço do Técnico'],
            ['inspecoes', 'inspecoes.html', 'fa-list-check', 'Inspeções Digitais'],
            ['confiabilidade', 'confiabilidade.html', 'fa-chart-line', 'Confiabilidade'],
            ['fornecedores', 'fornecedores.html', 'fa-building', 'Fornecedores'],
            ['compras', 'compras.html', 'fa-cart-shopping', 'Compras MRO'],
            ['contratos', 'contratos.html', 'fa-file-signature', 'Contratos e Garantias'],
            ['executivo', 'executivo.html', 'fa-chart-column', 'Painel Executivo']
        ];
        group.innerHTML = `<p class="${textClass} text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 px-2">Operação e Gestão</p>` + links.map(([page, href, icon, label]) => `<a href="${href}" data-page="${page}" class="${linkClass}"><i class="fas ${icon} ${mapLayout ? 'w-6' : 'w-5'} text-center shrink-0" aria-hidden="true"></i><span class="${textClass}">${label}</span></a>`).join('');
        navigation.appendChild(group);

        if (!enhancementScriptUrl) return true;
        Promise.all([
            import(new URL('./firebase.js', enhancementScriptUrl).href),
            import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js'),
            import('https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js')
        ]).then(([firebaseModule, authModule, databaseModule]) => {
            authModule.onAuthStateChanged(firebaseModule.auth, (user) => {
                if (!user) return;
                databaseModule.onValue(databaseModule.ref(firebaseModule.db, `users/${user.uid}`), (snapshot) => {
                    const profile = snapshot.val();
                    if (!profile) return;
                    const allowed = firebaseModule.getAllowedPages(profile);
                    group.querySelectorAll('[data-page]').forEach((link) => { link.style.display = allowed.includes(link.dataset.page) ? '' : 'none'; });
                    group.hidden = !Array.from(group.querySelectorAll('[data-page]')).some((link) => link.style.display !== 'none');
                }, { onlyOnce: true });
            });
        }).catch(() => { group.hidden = true; });
        return true;
    }

    function addIntegrationMenu() {
        const sidebar = document.getElementById('sidebar');
        const navigation = sidebar?.querySelector('nav');
        if (!sidebar || !navigation) return false;
        if (navigation.querySelector('[data-integration-menu]')) return true;

        const mapLayout = navigation.id === 'sidebar-nav';
        const group = document.createElement('div');
        group.dataset.integrationMenu = '';
        group.className = 'mt-4 pt-3 border-t border-slate-200 dark:border-dark-800/70';
        group.hidden = true;
        const textClass = mapLayout ? 'sidebar-text transition-opacity duration-300 whitespace-nowrap' : 'sb-text';
        const linkClass = mapLayout
            ? 'sb-link nav-link flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-300 text-slate-500 hover:bg-slate-100 hover:text-brand dark:text-slate-400 dark:hover:bg-dark-800 dark:hover:text-white'
            : 'sb-link flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-300 text-slate-500 hover:bg-slate-100 hover:text-brand dark:text-slate-400 dark:hover:bg-dark-800 dark:hover:text-white';
        const links = [
            ['iot', 'iot.html', 'fa-tower-broadcast', 'Central IoT'],
            ['notificacoes', 'notificacoes.html', 'fa-bell', 'Notificações'],
            ['continuidade', 'continuidade.html', 'fa-shield-halved', 'Continuidade']
        ];
        group.innerHTML = `<p class="${textClass} text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 px-2">Integrações</p>` + links.map(([page, href, icon, label]) => `<a href="${href}" data-page="${page}" class="${linkClass}"><i class="fas ${icon} ${mapLayout ? 'w-6' : 'w-5'} text-center shrink-0" aria-hidden="true"></i><span class="${textClass}">${label}</span></a>`).join('');
        navigation.appendChild(group);

        if (!enhancementScriptUrl) return true;
        Promise.all([
            import(new URL('./firebase.js', enhancementScriptUrl).href),
            import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js'),
            import('https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js')
        ]).then(([firebaseModule, authModule, databaseModule]) => {
            authModule.onAuthStateChanged(firebaseModule.auth, (user) => {
                if (!user) return;
                databaseModule.onValue(databaseModule.ref(firebaseModule.db, `users/${user.uid}`), (snapshot) => {
                    const profile = snapshot.val();
                    if (!profile) return;
                    const allowed = firebaseModule.getAllowedPages(profile);
                    group.querySelectorAll('[data-page]').forEach((link) => { link.style.display = allowed.includes(link.dataset.page) ? '' : 'none'; });
                    group.hidden = !Array.from(group.querySelectorAll('[data-page]')).some((link) => link.style.display !== 'none');
                }, { onlyOnce: true });
            });
        }).catch(() => { group.hidden = true; });
        return true;
    }

    function loadSupportCenter() {
        if (!enhancementScriptUrl) return;
        import(new URL('./support-center.js', enhancementScriptUrl).href).catch((error) => {
            console.warn('Central de Suporte indisponível.', error);
            window.nexusToast?.('error', 'Não foi possível abrir a Central de Suporte.');
        });
    }

    function loadPwaFeatures() {
        if (!enhancementScriptUrl) return;
        import(new URL('./pwa.js', enhancementScriptUrl).href).catch((error) => {
            console.warn('Recursos PWA indisponíveis.', error);
        });
    }

    function addSkipLink() {
        if (document.querySelector('.nexus-skip-link')) return;
        const target = document.querySelector('main') || document.querySelector('#hero') || document.querySelector('form');
        if (!target) return;
        if (!target.id) target.id = 'conteudo';
        target.setAttribute('tabindex', '-1');
        const link = document.createElement('a');
        link.className = 'nexus-skip-link';
        link.href = '#' + target.id;
        link.textContent = 'Pular para o conteúdo';
        document.body.prepend(link);
    }

    function markActiveNavigation() {
        const current = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
        document.querySelectorAll('#sidebar a[data-page]').forEach(function (link) {
            const href = (link.getAttribute('href') || '').toLowerCase();
            const text = link.textContent.trim();
            link.setAttribute('title', text);
            link.setAttribute('aria-label', text);
            if (href.endsWith(current)) {
                link.setAttribute('aria-current', 'page');
            }
        });
    }

    function wireSidebarSearch() {
        const input = document.querySelector('#sidebar input[type="text"]');
        if (!input) return;
        input.setAttribute('aria-label', 'Pesquisar no menu');
        input.addEventListener('input', function () {
            const term = input.value.trim().toLowerCase();
            document.querySelectorAll('#sidebar a[data-page], #sidebar [data-menu-item]').forEach(function (item) {
                item.style.display = item.textContent.toLowerCase().includes(term) ? '' : 'none';
            });
            const supportGroup = document.getElementById('support-menu-group');
            if (supportGroup) {
                const supportButton = supportGroup.querySelector('[data-menu-item]');
                supportGroup.style.display = supportButton?.style.display === 'none' ? 'none' : '';
            }
        });
    }

    function improveControls() {
        document.querySelectorAll('button:not([type])').forEach(function (button) {
            button.type = 'button';
        });

        document.querySelectorAll('table').forEach(function (table) {
            if (!table.closest('[role="region"]')) {
                const wrapper = table.parentElement;
                if (wrapper) {
                    wrapper.setAttribute('role', 'region');
                    wrapper.setAttribute('aria-label', 'Tabela com rolagem horizontal');
                    wrapper.setAttribute('tabindex', '0');
                }
            }
        });

        document.querySelectorAll('tbody[id], [id$="-list"]').forEach(function (region) {
            region.setAttribute('aria-live', 'polite');
        });
    }

    function syncThemePreference() {
        const button = document.getElementById('theme-toggle');
        if (!button) return;
        button.setAttribute('aria-label', 'Alternar tema');
        button.addEventListener('click', function () {
            window.setTimeout(function () {
                try {
                    localStorage.theme = html.classList.contains('dark') ? 'dark' : 'light';
                } catch (error) {}
            }, 0);
        });
    }

    function wireLogout() {
        document.querySelectorAll('a[href="../../index.html"]').forEach(function (link) {
            if (!link.querySelector('.fa-sign-out-alt')) return;

            link.addEventListener('click', async function (event) {
                event.preventDefault();
                if (link.dataset.logoutPending === 'true') return;

                link.dataset.logoutPending = 'true';
                link.setAttribute('aria-busy', 'true');

                try {
                    const [firebaseModule, { signOut }] = await Promise.all([
                        import(new URL('./firebase.js', enhancementScriptUrl).href),
                        import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js')
                    ]);
                    await firebaseModule.writeAuditLog({
                        action: 'logout',
                        entity: 'session',
                        entityId: firebaseModule.auth.currentUser?.uid || '',
                        description: 'Sessão encerrada pelo usuário.',
                        metadata: { page: window.location.pathname.split('/').pop() || 'desconhecida' }
                    });
                    await signOut(firebaseModule.auth);
                } catch (error) {
                    console.warn('Não foi possível encerrar a sessão no Firebase.', error);
                } finally {
                    window.location.replace(link.href);
                }
            });
        });
    }

    function nexusToast(type, message) {
        const toast = document.createElement('div');
        toast.className = 'nexus-toast';
        toast.dataset.type = type || 'info';
        toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
        toast.innerHTML = '<i class="fas fa-circle-info" aria-hidden="true"></i><span></span>';
        toast.querySelector('span').textContent = message || 'Ação concluída.';
        document.body.appendChild(toast);
        window.setTimeout(function () {
            toast.classList.add('is-leaving');
            window.setTimeout(function () {
                toast.remove();
            }, 220);
        }, 2600);
    }

    window.nexusToast = nexusToast;
    globalThis.nexusToast = nexusToast;

    applySavedTheme();

    document.addEventListener('DOMContentLoaded', function () {
        loadPwaFeatures();
        addSkipLink();
        addMaintenanceMenu();
        addIntegrationMenu();
        const hasSupportMenu = addSupportMenu();
        addMobileMenuButton();
        markActiveNavigation();
        wireSidebarSearch();
        improveControls();
        syncThemePreference();
        wireLogout();
        if (enhancementScriptUrl && document.querySelector('#sidebar, #login-form')) {
            import(new URL('./system-status.js', enhancementScriptUrl).href).catch((error) => {
                console.warn('Monitor de conexão indisponível.', error);
            });
        }
        if (hasSupportMenu) loadSupportCenter();
    });
})();
