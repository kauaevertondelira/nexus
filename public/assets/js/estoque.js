
// ==========================================
// GUARD DE ACESSO — bloqueia cargo sem permissão
// ==========================================
function checkPageAccess(pageId, userData) {
    const allowed = getAllowedPages(userData);
    if (!allowed.includes(pageId)) {
        document.body.style.overflow = "hidden";
        document.body.innerHTML = `
          <div style="min-height:100vh;background:#1d2b40;display:flex;flex-direction:column;align-items:center;justify-content:center;color:white;gap:16px;padding:32px;font-family:sans-serif">
            <div style="width:64px;height:64px;border-radius:16px;background:rgba(239,68,68,0.2);display:flex;align-items:center;justify-content:center;font-size:28px">🔒</div>
            <h1 style="font-size:22px;font-weight:800;margin:0">Acesso Restrito</h1>
            <p style="color:#94a3b8;text-align:center;max-width:360px;margin:0">
              Seu cargo <strong style="color:white">${userData.role}</strong> não tem permissão para acessar esta página.
            </p>
            <a href="menu.html" style="margin-top:8px;padding:12px 24px;background:#3b82f6;border-radius:12px;font-weight:700;color:white;text-decoration:none">
              ← Voltar ao Painel
            </a>
          </div>`;
        revealProtectedPage();
        return false;
    }
    revealProtectedPage();
    return true;
}

import { auth, db, getAllowedPages, applyAllowedMenu, revealProtectedPage, writeAuditLog } from "./firebase.js";
import { ref, onValue, push, remove, update } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { escapeHtml, csvCell, downloadFile, nonNegative } from "./security-utils.js";

        // --- SISTEMA DE RASTREABILIDADE ---
        let currentUserInfo = { name: "Operador", uid: "null" };

        onAuthStateChanged(auth, (user) => {
                if (user) {
                    onValue(ref(db, 'users/' + user.uid), (snapshot) => {
                        const data = snapshot.val();
                        if(data) {
                            currentUserInfo = { name: data.name, uid: user.uid, role: data.role };
                            document.getElementById('user-name').innerText = data.name;
                            document.getElementById('user-role').innerText = data.role;
                            if (!checkPageAccess('estoque', data)) return;
                            applyAllowedMenu(data);
                            if(data.photoURL) {
                                document.getElementById('user-photo').style.backgroundImage = `url(${data.photoURL})`;
                                document.getElementById('user-photo').innerHTML = '';
                            } else {
                                document.getElementById('user-photo').innerHTML = '<i class="fas fa-user text-xl"></i>';
                            }
                        }
                    });
                } else {
                    const currentPage = window.location.pathname.split('/').pop() || 'estoque.html';
                    window.location.replace('login.html?return=' + encodeURIComponent(currentPage));
                }
        });
        
        const getSwalTheme = () => document.documentElement.classList.contains('dark') ? { background: '#223249', color: '#f8fafc', confirmButtonColor: '#3b82f6', cancelButtonColor: '#ef4444' } : { confirmButtonColor: '#3b82f6', cancelButtonColor: '#ef4444' };

        onValue(ref(db, 'inventory'), (snapshot) => {
            const data = snapshot.val();
            const list = document.getElementById('inventory-list');
            list.innerHTML = '';
            
            let totalItems = 0; let critItems = 0; let forecastItems = 0; let totalVal = 0;

            if (data) {
                Object.entries(data).forEach(([id, item]) => {
                    const qty = nonNegative(item.qty);
                    const min = nonNegative(item.min);
                    const price = nonNegative(item.price);
                    const monthlyUse = nonNegative(item.monthlyUse);
                    const coverageDays = monthlyUse > 0 ? Math.floor((qty / monthlyUse) * 30) : null;
                    if (coverageDays !== null && coverageDays <= 30) forecastItems++;
                    const safeName = escapeHtml(item.name || 'Item sem nome');
                    const safeAuthor = escapeHtml(item.lastUpdatedBy || 'Sistema');
                    totalItems++;
                    totalVal += qty * price;
                    
                    let qtyHtml = '';
                    if (qty <= min) {
                        critItems++;
                        qtyHtml = `<div class="mx-auto w-32 flex items-center justify-between px-3 py-1 bg-red-100 text-red-600 dark:bg-red-500/10 dark:text-red-400 rounded-lg border border-red-200 dark:border-red-900/50 font-bold"><i class="fas fa-arrow-down animate-bounce"></i> <span>${qty} <span class="text-xs text-red-400 dark:text-red-500/70">/ ${min}</span></span></div>`;
                    } else if (qty <= min * 1.5) {
                        qtyHtml = `<div class="mx-auto w-32 flex items-center justify-between px-3 py-1 bg-amber-100 text-amber-600 dark:bg-amber-500/10 dark:text-amber-500 rounded-lg font-bold"><span>${qty} <span class="text-xs text-amber-400 dark:text-amber-600/70">/ ${min}</span></span></div>`;
                    } else {
                        qtyHtml = `<div class="mx-auto w-32 flex items-center justify-between px-3 py-1 bg-green-100 text-green-600 dark:bg-green-500/10 dark:text-green-500 rounded-lg font-bold"><span>${qty} <span class="text-xs text-green-400 dark:text-green-600/70">/ ${min}</span></span></div>`;
                    }

                    list.innerHTML += `
                        <tr class="table-row-hover transition-colors text-slate-700 dark:text-slate-300">
                            <td class="px-5 py-4 font-mono text-xs text-slate-500">MRO-${id.substring(1, 6).toUpperCase()}</td>
                            <td class="px-5 py-4 font-medium">${safeName}<span class="block text-[10px] mt-1 ${coverageDays !== null && coverageDays <= 30 ? 'text-amber-500 font-bold' : 'text-slate-400'}"><i class="fas fa-chart-line mr-1"></i>${coverageDays === null ? 'Informe o consumo médio para prever ruptura' : `Cobertura estimada: ${coverageDays} dia(s)`}</span></td>
                            <td class="px-5 py-4 text-center">${qtyHtml}</td>
                            <td class="px-5 py-4 text-slate-500 dark:text-slate-400">R$ ${price.toFixed(2)}</td>
                            <td class="px-5 py-4 text-xs text-slate-400"><i class="fas fa-user-edit mr-1"></i> ${safeAuthor}</td>
                            <td class="px-5 py-4 text-right space-x-2">
                                <button onclick="adjustQty('${id}', 1)" aria-label="Adicionar uma unidade de ${safeName}" class="text-green-500 hover:text-green-600 bg-green-50 dark:bg-green-500/10 p-2 rounded-md transition"><i class="fas fa-plus"></i></button>
                                <button onclick="adjustQty('${id}', -1)" aria-label="Remover uma unidade de ${safeName}" class="text-red-500 hover:text-red-600 bg-red-50 dark:bg-red-500/10 p-2 rounded-md transition"><i class="fas fa-minus"></i></button>
                                <button onclick="editItem('${id}')" aria-label="Editar item ${safeName}" class="text-slate-400 hover:text-brand transition ml-2 p-2 rounded-md hover:bg-blue-50 dark:hover:bg-blue-500/10"><i class="fas fa-edit"></i></button>
                                <button onclick="deleteItem('${id}')" aria-label="Remover item ${safeName}" class="text-slate-400 hover:text-red-500 transition p-2 rounded-md hover:bg-red-50 dark:hover:bg-red-500/10"><i class="fas fa-trash"></i></button>
                            </td>
                        </tr>
                    `;
                });
            } else {
                list.innerHTML = `<tr><td colspan="6" class="px-5 py-8"><div class="nexus-empty-state"><i class="fas fa-box-open text-2xl"></i><strong>Estoque vazio</strong><span>Use "Nova Peça" para cadastrar o primeiro item MRO.</span></div></td></tr>`;
            }

            document.getElementById('kpi-total').innerText = totalItems;
            document.getElementById('kpi-crit').innerText = critItems;
            document.getElementById('kpi-value').innerText = 'R$ ' + totalVal.toFixed(2);
            document.getElementById('kpi-forecast').innerText = forecastItems;
        }, () => {
            document.getElementById('inventory-list').innerHTML = '<tr><td colspan="6" class="px-5 py-8 text-center text-red-500">Não foi possível carregar o estoque.</td></tr>';
        });

        window.addItem = () => {
            Swal.fire({
                title: 'Nova Peça/Material',
                html: `
                    <input id="n-name" class="swal2-input" placeholder="Descrição do Item">
                    <input id="n-qty" type="number" min="0" class="swal2-input" placeholder="Quantidade Inicial">
                    <input id="n-min" type="number" min="0" class="swal2-input" placeholder="Estoque Mínimo (Alerta)">
                    <input id="n-price" type="number" min="0" step="0.01" class="swal2-input" placeholder="Custo Unitário">
                    <input id="n-use" type="number" min="0" step="0.1" class="swal2-input" placeholder="Consumo médio mensal (unidades)">
                `,
                showCancelButton: true, ...getSwalTheme(), confirmButtonText: 'Guardar',
                preConfirm: () => {
                    return {
                        name: document.getElementById('n-name').value || 'Item S/N',
                        qty: nonNegative(document.getElementById('n-qty').value),
                        min: nonNegative(document.getElementById('n-min').value),
                        price: nonNegative(document.getElementById('n-price').value),
                        monthlyUse: nonNegative(document.getElementById('n-use').value),
                        lastUpdatedBy: currentUserInfo.name // Regista o autor
                    }
                }
            }).then(async (res) => {
                if (res.isConfirmed) {
                    try {
                        const created = await push(ref(db, 'inventory'), { ...res.value, createdAt: Date.now() });
                        await writeAuditLog({ action: 'create', entity: 'inventory', entityId: created.key, description: `Item ${res.value.name} criado.` });
                        window.nexusToast?.('success', 'Item cadastrado no estoque.');
                    } catch (error) {
                        window.nexusToast?.('error', 'Não foi possível cadastrar o item.');
                    }
                }
            });
        };

        window.adjustQty = (id, amount) => {
            onValue(ref(db, 'inventory/' + id), (snapshot) => {
                const data = snapshot.val();
                if(data) {
                    let newQty = data.qty + amount;
                    if(newQty >= 0) {
                        update(ref(db, 'inventory/' + id), {
                            qty: newQty,
                            updatedAt: Date.now(),
                            lastUpdatedBy: currentUserInfo.name
                        }).then(() => writeAuditLog({ action: 'quantity', entity: 'inventory', entityId: id, description: `Quantidade alterada em ${amount > 0 ? '+' : ''}${amount}.`, metadata: { quantity: newQty, delta: amount } }));
                        window.nexusToast?.('success', 'Quantidade atualizada.');
                    }
                }
            }, { onlyOnce: true });
        };

        window.editItem = (id) => {
            onValue(ref(db, 'inventory/' + id), (snap) => {
                const item = snap.val();
                if (!item) {
                    window.nexusToast?.('error', 'Item não encontrado.');
                    return;
                }
                Swal.fire({
                    title: 'Editar Item',
                    html: `
                        <input id="e-name" class="swal2-input" placeholder="Descrição do item">
                        <input id="e-qty" type="number" min="0" class="swal2-input" placeholder="Quantidade">
                        <input id="e-min" type="number" min="0" class="swal2-input" placeholder="Estoque mínimo">
                        <input id="e-price" type="number" min="0" step="0.01" class="swal2-input" placeholder="Custo unitário">
                        <input id="e-use" type="number" min="0" step="0.1" class="swal2-input" placeholder="Consumo médio mensal (unidades)">
                    `,
                    showCancelButton: true, ...getSwalTheme(), confirmButtonText: 'Atualizar',
                    didOpen: () => {
                        document.getElementById('e-name').value = item.name || '';
                        document.getElementById('e-qty').value = item.qty ?? 0;
                        document.getElementById('e-min').value = item.min ?? 0;
                        document.getElementById('e-price').value = item.price ?? 0;
                        document.getElementById('e-use').value = item.monthlyUse ?? 0;
                    },
                    preConfirm: () => {
                        const name = document.getElementById('e-name').value.trim();
                        if (!name) {
                            Swal.showValidationMessage('A descrição do item é obrigatória.');
                            return false;
                        }
                        return {
                            name,
                            qty: Math.max(0, parseInt(document.getElementById('e-qty').value, 10) || 0),
                            min: Math.max(0, parseInt(document.getElementById('e-min').value, 10) || 0),
                            price: Math.max(0, parseFloat(document.getElementById('e-price').value) || 0),
                            monthlyUse: Math.max(0, parseFloat(document.getElementById('e-use').value) || 0),
                            lastUpdatedBy: currentUserInfo.name // Atualiza o autor
                        }
                    }
                }).then(async (res) => {
                    if (res.isConfirmed) {
                        try {
                            await update(ref(db, 'inventory/' + id), { ...res.value, updatedAt: Date.now() });
                            await writeAuditLog({ action: 'update', entity: 'inventory', entityId: id, description: `Item ${res.value.name} atualizado.` });
                            window.nexusToast?.('success', 'Item atualizado.');
                        } catch (error) {
                            window.nexusToast?.('error', 'Não foi possível atualizar o item.');
                        }
                    }
                });
            }, { onlyOnce: true });
        };

        window.deleteItem = (id) => {
            Swal.fire({ title: 'Remover Item?', text: "Será excluído do estoque.", icon: 'warning', showCancelButton: true, ...getSwalTheme(), confirmButtonText: 'Sim' })
            .then(async (res) => {
                if (res.isConfirmed) {
                    try {
                        await remove(ref(db, 'inventory/' + id));
                        await writeAuditLog({ action: 'delete', entity: 'inventory', entityId: id, description: 'Item removido do estoque.' });
                        window.nexusToast?.('warning', 'Item removido do estoque.');
                    } catch (error) {
                        window.nexusToast?.('error', 'Não foi possível remover o item.');
                    }
                }
            });
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
                csv.push([sku, desc, qty, min, autor].map(csvCell).join(';'));
            }
            downloadFile("\uFEFF" + csv.join("\n"), "Relatorio_Estoque_Nexus.csv", "text/csv;charset=utf-8");
            window.nexusToast?.('success', 'CSV exportado.');
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
