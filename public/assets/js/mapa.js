// Função para abrir o Modal
        function openMachineModal(id, nome, status, temperatura, producao, ip) {
            const modal = document.getElementById('machine-modal');
            const modalContent = document.getElementById('modal-content');
            
            document.getElementById('modal-machine-id').innerText = id;
            document.getElementById('modal-machine-name').innerText = nome;
            document.getElementById('modal-temp').innerText = temperatura;
            document.getElementById('modal-prod').innerText = producao;
            document.getElementById('modal-machine-ip').innerText = ip;

            const badge = document.getElementById('modal-status-badge');
            badge.innerText = status;
            
            // Classes base da badge
            badge.className = "px-5 py-2 rounded-full text-xs font-bold uppercase tracking-widest border ";
            
            // Aplica cores dependendo do status recebido do Firebase
            if (status === 'OPERANDO') {
                badge.className += "bg-green-100 text-green-700 border-green-200 dark:bg-green-500/20 dark:text-green-400 dark:border-green-500/30";
            } else if (status === 'ALERTA') {
                badge.className += "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-500/20 dark:text-yellow-400 dark:border-yellow-500/30";
            } else if (status === 'PARADA') {
                badge.className += "bg-red-100 text-red-700 border-red-200 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/30";
            }

            modal.classList.remove('opacity-0', 'pointer-events-none');
            modalContent.classList.remove('scale-95');
            modalContent.classList.add('scale-100');
        }

        // Função para fechar o Modal
        function closeMachineModal() {
            const modal = document.getElementById('machine-modal');
            const modalContent = document.getElementById('modal-content');
            
            modal.classList.add('opacity-0', 'pointer-events-none');
            modalContent.classList.remove('scale-100');
            modalContent.classList.add('scale-95');
        }

        // Fechar modal ao clicar fora da caixa (no fundo escuro)
        document.getElementById('machine-modal').addEventListener('click', function(e) {
            if(e.target === this) closeMachineModal();
        });

        // Script de Modo Claro/Escuro
        document.getElementById('theme-toggle').addEventListener('click', () => {
            document.documentElement.classList.toggle('dark');
        });