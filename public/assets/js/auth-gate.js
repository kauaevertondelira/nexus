(function () {
    const root = document.documentElement;
    const timeoutMs = 12000;
    let timerId;

    function release() {
        if (timerId) window.clearTimeout(timerId);
        root.classList.remove('nexus-auth-pending');
    }

    function block(message) {
        if (!document.body) return;
        document.body.innerHTML = `
            <main class="nexus-access-error" role="alert">
                <div class="nexus-access-error__icon" aria-hidden="true"><i class="fas fa-shield-alt"></i></div>
                <h1>Não foi possível validar o acesso</h1>
                <p>${message}</p>
                <div class="nexus-access-error__actions">
                    <button type="button" onclick="window.location.reload()">Tentar novamente</button>
                    <a href="login.html">Voltar ao login</a>
                </div>
            </main>`;
        release();
    }

    window.NexusAccessGate = { release, block };
    timerId = window.setTimeout(() => {
        if (!root.classList.contains('nexus-auth-pending')) return;
        const message = window.location.protocol === 'file:'
            ? 'Abra o projeto usando o Live Server do VS Code. Páginas protegidas não funcionam quando abertas diretamente pelo arquivo.'
            : 'A conexão com o sistema demorou mais que o esperado. Verifique a internet e tente novamente.';
        block(message);
    }, timeoutMs);
})();
