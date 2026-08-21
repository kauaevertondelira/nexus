(function () {
    const html = document.documentElement;
    const storageKey = 'nexus-theme';

    function safeGet(key) {
        try {
            return localStorage.getItem(key);
        } catch (_) {
            return null;
        }
    }

    function safeSet(key, value) {
        try {
            localStorage.setItem(key, value);
        } catch (_) {
            // O tema continua funcional durante a sessão mesmo sem armazenamento local.
        }
    }

    function readTheme() {
        const saved = safeGet(storageKey) || safeGet('theme');
        if (saved === 'light' || saved === 'dark') return saved;
        return 'dark';
    }

    function syncThemeControls() {
        const isDark = html.classList.contains('dark');
        document.querySelectorAll('#theme-toggle, [onclick="toggleTheme()"]')
            .forEach((control) => {
                control.setAttribute('aria-label', isDark ? 'Ativar modo claro' : 'Ativar modo escuro');
                control.setAttribute('aria-pressed', String(isDark));
                if (!control.getAttribute('title')) {
                    control.setAttribute('title', isDark ? 'Ativar modo claro' : 'Ativar modo escuro');
                }
            });

        document.querySelectorAll('.theme-text-btn').forEach((label) => {
            label.textContent = isDark ? 'Modo Claro' : 'Modo Escuro';
        });

        let themeColor = document.querySelector('meta[name="theme-color"]');
        if (!themeColor) {
            themeColor = document.createElement('meta');
            themeColor.setAttribute('name', 'theme-color');
            document.head.appendChild(themeColor);
        }
        themeColor.setAttribute('content', isDark ? '#172234' : '#f4f8fc');
    }

    function persistCurrentTheme() {
        const theme = html.classList.contains('dark') ? 'dark' : 'light';
        safeSet(storageKey, theme);
        safeSet('theme', theme);
        syncThemeControls();
    }

    html.classList.toggle('dark', readTheme() === 'dark');

    new MutationObserver((mutations) => {
        if (mutations.some((mutation) => mutation.attributeName === 'class')) {
            persistCurrentTheme();
        }
    }).observe(html, { attributes: true, attributeFilter: ['class'] });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', syncThemeControls, { once: true });
    } else {
        syncThemeControls();
    }

    window.NexusTheme = {
        get: () => html.classList.contains('dark') ? 'dark' : 'light',
        set: (theme) => html.classList.toggle('dark', theme === 'dark')
    };
})();
