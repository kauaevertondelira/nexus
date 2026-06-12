import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
        import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
        import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

        const firebaseConfig = {
            apiKey: "AIzaSyD6gj_6e0WuGr6C_hJDkXBK7cI2EopWV1s",
            authDomain: "nexus-iot-senai.firebaseapp.com",
            databaseURL: "https://nexus-iot-senai-default-rtdb.firebaseio.com",
            projectId: "nexus-iot-senai"
        };
        const app = initializeApp(firebaseConfig);
        const db = getDatabase(app);
        const auth = getAuth(app);

        // --- SISTEMA DE PERFIL ---
        if (firebaseConfig.apiKey === "SUA_API_KEY") {
            document.getElementById('user-name').innerText = "Diretor Financeiro";
            document.getElementById('user-role').innerText = "Gestão / Controladoria";
            document.getElementById('user-photo').innerHTML = '<i class="fas fa-chart-line text-xl"></i>';
        } else {
            onAuthStateChanged(auth, (user) => {
                if (user) {
                    onValue(ref(db, 'users/' + user.uid), (snapshot) => {
                        const data = snapshot.val();
                        if(data) {
                            document.getElementById('user-name').innerText = data.name;
                            document.getElementById('user-role').innerText = data.role;
                            if(data.photoURL) {
                                document.getElementById('user-photo').style.backgroundImage = `url(${data.photoURL})`;
                                document.getElementById('user-photo').innerHTML = '';
                            } else {
                                document.getElementById('user-photo').innerHTML = '<i class="fas fa-user text-xl"></i>';
                            }
                        }
                    });
                } else {
                    window.location.href = '../../index.html';
                }
            });
        }

        let chartDoughnut;

        onValue(ref(db, 'work_orders'), (snapshot) => {
            const data = snapshot.val();
            let totalDone = 0; let urgentCount = 0; let normalCount = 0;
            
            if (data) {
                Object.values(data).forEach(os => {
                    if (os.status === 'done') totalDone++;
                    if (os.priority === 'urgent' || os.priority === 'danger') urgentCount++;
                    else normalCount++;
                });
            }

            document.getElementById('kpi-os-done').innerText = totalDone;
            
            if(chartDoughnut) {
                chartDoughnut.data.datasets[0].data = [urgentCount, normalCount];
                chartDoughnut.update();
            }

            // Simula tabela de custos
            document.getElementById('cost-table').innerHTML = `
                <tr class="table-row-hover text-slate-700 dark:text-slate-300">
                    <td class="py-3 font-medium">Extrusora Principal <span class="text-xs text-slate-500 block">#EXT-001</span></td>
                    <td class="py-3 text-center">4</td>
                    <td class="py-3 text-right text-red-500 font-bold">R$ 5.200,00</td>
                </tr>
                <tr class="table-row-hover text-slate-700 dark:text-slate-300">
                    <td class="py-3 font-medium">Compressor Ar Linha B <span class="text-xs text-slate-500 block">#CMP-02</span></td>
                    <td class="py-3 text-center">2</td>
                    <td class="py-3 text-right">R$ 1.850,00</td>
                </tr>
            `;
            document.getElementById('kpi-downtime').innerText = "R$ 7.050,00";
        });

        const getGridColor = () => document.documentElement.classList.contains('dark') ? '#1e293b' : '#f1f5f9';
        const getTextColor = () => document.documentElement.classList.contains('dark') ? '#64748b' : '#94a3b8';

        // Gráfico de Barras
        const ctxBar = document.getElementById('costChart').getContext('2d');
        window.chartBar = new Chart(ctxBar, {
            type: 'bar',
            data: {
                labels: ['Out', 'Nov', 'Dez', 'Jan', 'Fev', 'Mar'],
                datasets: [{
                    label: 'Custo Downtime (R$)',
                    data: [3000, 1500, 5200, 1200, 2400, 800],
                    backgroundColor: '#ef4444',
                    borderRadius: 4,
                    barPercentage: 0.5
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { grid: { color: getGridColor() }, ticks: { color: getTextColor(), callback: (val) => 'R$ ' + val } },
                    x: { grid: { display: false }, ticks: { color: getTextColor() } }
                }
            }
        });

        // Gráfico Doughnut
        const ctxDist = document.getElementById('distributionChart').getContext('2d');
        chartDoughnut = new Chart(ctxDist, {
            type: 'doughnut',
            data: {
                labels: ['Urgente / Falha', 'Manutenção Normal'],
                datasets: [{
                    data: [1, 1],
                    backgroundColor: ['#ef4444', '#3b82f6'],
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom', labels: { color: getTextColor(), padding: 20 } } },
                cutout: '70%'
            }
        });

        // ==========================================
// CONTROLE DO MODO ESCURO (THEME)
// ==========================================
function toggleTheme() {
    const html = document.documentElement;
    if (html.classList.contains('dark')) {
        html.classList.remove('dark');
    } else {
        html.classList.add('dark');
    }
}

// Garante que o clique seja ouvido no novo ID do botão
const themeBtn = document.getElementById('theme-toggle');
if (themeBtn) {
    themeBtn.addEventListener('click', toggleTheme);
}