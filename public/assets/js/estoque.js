import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
        import { getDatabase, ref, onValue, set, push, remove, update } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
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

        // --- SISTEMA DE RASTREABILIDADE ---
        let currentUserInfo = { name: "Operador", uid: "null" };

        if (firebaseConfig.apiKey === "SUA_API_KEY") {
            currentUserInfo = { name: "Gestor Operacional", uid: "simulado" };
            document.getElementById('user-name').innerText = currentUserInfo.name;
            document.getElementById('user-role').innerText = "Almoxarifado";
            document.getElementById('user-photo').innerHTML = '<i class="fas fa-user-tie text-xl"></i>';
        } else {
            onAuthStateChanged(auth, (user) => {
                if (user) {
                    onValue(ref(db, 'users/' + user.uid), (snapshot) => {
                        const data = snapshot.val();
                        if(data) {
                            currentUserInfo = { name: data.name, uid: user.uid };
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
        
        const getSwalTheme = () => document.documentElement.classList.contains('dark') ? { background: '#1e293b', color: '#f8fafc', confirmButtonColor: '#3b82f6', cancelButtonColor: '#ef4444' } : { confirmButtonColor: '#3b82f6', cancelButtonColor: '#ef4444' };

        onValue(ref(db, 'inventory'), (snapshot) => {
            const data = snapshot.val();
            const list = document.getElementById('inventory-list');
            list.innerHTML = '';
            
            let totalItems = 0; let critItems = 0; let totalVal = 0;

            if (data) {
                Object.entries(data).forEach(([id, item]) => {
                    totalItems++;
                    totalVal += (item.qty * (item.price || 0));
                    
                    let qtyHtml = '';
                    if (item.qty <= item.min) {
                        critItems++;
                        qtyHtml = `<div class="mx-auto w-32 flex items-center justify-between px-3 py-1 bg-red-100 text-red-600 dark:bg-red-500/10 dark:text-red-400 rounded-lg border border-red-200 dark:border-red-900/50 font-bold"><i class="fas fa-arrow-down animate-bounce"></i> <span>${item.qty} <span class="text-xs text-red-400 dark:text-red-500/70">/ ${item.min}</span></span></div>`;
                    } else if (item.qty <= item.min * 1.5) {
                        qtyHtml = `<div class="mx-auto w-32 flex items-center justify-between px-3 py-1 bg-amber-100 text-amber-600 dark:bg-amber-500/10 dark:text-amber-500 rounded-lg font-bold"><span>${item.qty} <span class="text-xs text-amber-400 dark:text-amber-600/70">/ ${item.min}</span></span></div>`;
                    } else {
                        qtyHtml = `<div class="mx-auto w-32 flex items-center justify-between px-3 py-1 bg-green-100 text-green-600 dark:bg-green-500/10 dark:text-green-500 rounded-lg font-bold"><span>${item.qty} <span class="text-xs text-green-400 dark:text-green-600/70">/ ${item.min}</span></span></div>`;
                    }

                    list.innerHTML += `
                        <tr class="table-row-hover transition-colors text-slate-700 dark:text-slate-300">
                            <td class="px-5 py-4 font-mono text-xs text-slate-500">MRO-${id.substring(1, 6).toUpperCase()}</td>
                            <td class="px-5 py-4 font-medium">${item.name}</td>
                            <td class="px-5 py-4 text-center">${qtyHtml}</td>
                            <td class="px-5 py-4 text-slate-500 dark:text-slate-400">R$ ${(item.price || 0).toFixed(2)}</td>
                            <td class="px-5 py-4 text-xs text-slate-400"><i class="fas fa-user-edit mr-1"></i> ${item.lastUpdatedBy || 'Sistema'}</td>
                            <td class="px-5 py-4 text-right space-x-2">
                                <button onclick="adjustQty('${id}', 1)" class="text-green-500 hover:text-green-600 bg-green-50 dark:bg-green-500/10 p-2 rounded-md transition"><i class="fas fa-plus"></i></button>
                                <button onclick="adjustQty('${id}', -1)" class="text-red-500 hover:text-red-600 bg-red-50 dark:bg-red-500/10 p-2 rounded-md transition"><i class="fas fa-minus"></i></button>
                                <button onclick="editItem('${id}')" class="text-slate-400 hover:text-brand transition ml-2"><i class="fas fa-edit"></i></button>
                                <button onclick="deleteItem('${id}')" class="text-slate-400 hover:text-red-500 transition"><i class="fas fa-trash"></i></button>
                            </td>
                        </tr>
                    `;
                });
            } else {
                list.innerHTML = `<tr><td colspan="6" class="px-5 py-8 text-center text-slate-500">Estoque vazio.</td></tr>`;
            }

            document.getElementById('kpi-total').innerText = totalItems;
            document.getElementById('kpi-crit').innerText = critItems;
            document.getElementById('kpi-value').innerText = 'R$ ' + totalVal.toFixed(2);
        });

        window.addItem = () => {
            Swal.fire({
                title: 'Nova Peça/Material',
                html: `
                    <input id="n-name" class="swal2-input" placeholder="Descrição do Item">
                    <input id="n-qty" type="number" class="swal2-input" placeholder="Quantidade Inicial">
                    <input id="n-min" type="number" class="swal2-input" placeholder="Stock Mínimo (Alerta)">
                    <input id="n-price" type="number" step="0.01" class="swal2-input" placeholder="Custo Unitário">
                `,
                showCancelButton: true, ...getSwalTheme(), confirmButtonText: 'Guardar',
                preConfirm: () => {
                    return {
                        name: document.getElementById('n-name').value || 'Item S/N',
                        qty: parseInt(document.getElementById('n-qty').value) || 0,
                        min: parseInt(document.getElementById('n-min').value) || 0,
                        price: parseFloat(document.getElementById('n-price').value) || 0,
                        lastUpdatedBy: currentUserInfo.name // Regista o autor
                    }
                }
            }).then((res) => { if (res.isConfirmed) push(ref(db, 'inventory'), res.value); });
        };

        window.adjustQty = (id, amount) => {
            onValue(ref(db, 'inventory/' + id), (snapshot) => {
                const data = snapshot.val();
                if(data) {
                    let newQty = data.qty + amount;
                    if(newQty >= 0) update(ref(db, 'inventory/' + id), { 
                        qty: newQty,
                        lastUpdatedBy: currentUserInfo.name // Atualiza quem fez a mudança
                    });
                }
            }, { onlyOnce: true });
        };

        window.editItem = (id) => {
            onValue(ref(db, 'inventory/' + id), (snap) => {
                const item = snap.val();
                Swal.fire({
                    title: 'Editar Item',
                    html: `
                        <input id="e-name" class="swal2-input" value="${item.name}">
                        <input id="e-qty" type="number" class="swal2-input" value="${item.qty}">
                        <input id="e-min" type="number" class="swal2-input" value="${item.min}">
                        <input id="e-price" type="number" step="0.01" class="swal2-input" value="${item.price || 0}">
                    `,
                    showCancelButton: true, ...getSwalTheme(), confirmButtonText: 'Atualizar',
                    preConfirm: () => {
                        return {
                            name: document.getElementById('e-name').value,
                            qty: parseInt(document.getElementById('e-qty').value),
                            min: parseInt(document.getElementById('e-min').value),
                            price: parseFloat(document.getElementById('e-price').value),
                            lastUpdatedBy: currentUserInfo.name // Atualiza o autor
                        }
                    }
                }).then((res) => { if (res.isConfirmed) update(ref(db, 'inventory/' + id), res.value); });
            }, { onlyOnce: true });
        };

        window.deleteItem = (id) => {
            Swal.fire({ title: 'Remover Item?', text: "Será excluído do estoque.", icon: 'warning', showCancelButton: true, ...getSwalTheme(), confirmButtonText: 'Sim' })
            .then((res) => { if (res.isConfirmed) remove(ref(db, 'inventory/' + id)); });
        };

        window.exportCSV = () => {
            let csv = ["SKU;Descricao;Qtd_Atual;Qtd_Minima;Atualizado_Por"];
            let rows = document.querySelectorAll("#inventoryTable tr");
            for (let i = 1; i < rows.length; i++) {
                let cols = rows[i].querySelectorAll("td");
                if (cols.length < 5) continue;
                let sku = cols[0].innerText.trim();
                let desc = cols[1].innerText.trim();
                let qtyText = cols[2].innerText;
                let numbers = qtyText.match(/\d+/g); 
                let qty = numbers ? numbers[0] : 0; let min = numbers && numbers.length > 1 ? numbers[1] : 0;
                let autor = cols[4].innerText.trim();
                csv.push(`"${sku}";"${desc}";"${qty}";"${min}";"${autor}"`);
            }
            let csvFile = new Blob(["\uFEFF" + csv.join("\n")], {type: "text/csv;charset=utf-8;"});
            let downloadLink = document.createElement("a");
            downloadLink.download = "Relatorio_Stock_Nexus.csv";
            downloadLink.href = window.URL.createObjectURL(csvFile);
            downloadLink.click();
        };

        document.getElementById('searchInput')?.addEventListener('keyup', (e) => {
            const term = e.target.value.toLowerCase();
            document.querySelectorAll('#inventory-list tr').forEach(row => {
                if(!row.innerText.toLowerCase().includes('carregar')) row.style.display = row.innerText.toLowerCase().includes(term) ? '' : 'none';
            });
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