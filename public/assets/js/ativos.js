
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
import { escapeHtml, nonNegative } from "./security-utils.js";

        // --- SISTEMA DE RASTREABILIDADE ---
        let currentUserInfo = { name: "Operador", uid: "null" };
        let canManageAssets = true;

        function calculateAssetRisk(asset = {}) {
            const temperature = nonNegative(asset.temp);
            let score = 0;
            const reasons = [];
            if (asset.status === 'danger') { score += 55; reasons.push('falha registrada'); }
            else if (asset.status === 'offline') { score += 15; reasons.push('equipamento parado'); }
            if (temperature > 80) { score += 40; reasons.push('temperatura crítica'); }
            else if (temperature > 60) { score += 22; reasons.push('temperatura elevada'); }
            const bounded = Math.min(100, score);
            if (bounded >= 70) return { score: bounded, label: 'Risco alto', className: 'text-red-600 bg-red-500/10', reasons };
            if (bounded >= 30) return { score: bounded, label: 'Atenção', className: 'text-amber-600 bg-amber-500/10', reasons };
            return { score: bounded, label: 'Risco baixo', className: 'text-green-600 bg-green-500/10', reasons: reasons.length ? reasons : ['operação dentro das regras cadastradas'] };
        }

        function highlightRequestedAsset() {
            const requestedId = new URLSearchParams(window.location.search).get('ativo');
            if (!requestedId) return;
            const row = document.querySelector(`[data-asset-id="${CSS.escape(requestedId)}"]`);
            if (!row) return;
            row.classList.add('ring-2', 'ring-brand', 'ring-inset');
            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        onAuthStateChanged(auth, (user) => {
                if (user) {
                    onValue(ref(db, 'users/' + user.uid), (snapshot) => {
                        const data = snapshot.val();
                        if(data) {
                            currentUserInfo = { name: data.name, uid: user.uid, role: data.role };
                            canManageAssets = ['Administrador', 'Técnico de Manutenção'].includes(data.role);
                            const addButton = document.querySelector('[onclick="addAsset()"]');
                            if (addButton) addButton.classList.toggle('hidden', !canManageAssets);
                            if (!canManageAssets) {
                                document.querySelectorAll('#assets-list button').forEach((button) => button.remove());
                            }
                            document.getElementById('user-name').innerText = data.name;
                            document.getElementById('user-role').innerText = data.role;
                            if (!checkPageAccess('ativos', data)) return;
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
                    const currentPage = window.location.pathname.split('/').pop() || 'ativos.html';
                    window.location.replace('login.html?return=' + encodeURIComponent(currentPage));
                }
        });
        
        const getSwalTheme = () => document.documentElement.classList.contains('dark') ? { background: '#223249', color: '#f8fafc', confirmButtonColor: '#3b82f6', cancelButtonColor: '#ef4444' } : { confirmButtonColor: '#3b82f6', cancelButtonColor: '#ef4444' };

        // Renderizar Tabela
        onValue(ref(db, 'assets'), (snapshot) => {
            const data = snapshot.val();
            const list = document.getElementById('assets-list');
            list.innerHTML = ''; 
            
            if (data) {
                Object.entries(data).forEach(([id, ativo]) => {
                    const safeName = escapeHtml(ativo.name || 'Ativo sem nome');
                    const safeArea = escapeHtml(ativo.area || 'não definida');
                    const safeAuthor = escapeHtml(ativo.lastUpdatedBy || ativo.createdBy || 'Sistema');
                    const manageButtons = canManageAssets ? `
                        <button onclick="editAsset('${id}')" aria-label="Editar ativo ${safeName}" class="text-slate-400 hover:text-brand transition-colors p-2 rounded-md hover:bg-blue-50 dark:hover:bg-blue-500/10"><i class="fas fa-edit"></i></button>
                        <button onclick="deleteAsset('${id}')" aria-label="Remover ativo ${safeName}" class="text-slate-400 hover:text-red-500 transition-colors p-2 rounded-md hover:bg-red-50 dark:hover:bg-red-500/10"><i class="fas fa-trash"></i></button>` : '<span class="text-[10px] text-slate-400">Somente leitura</span>';
                    const actionButtons = `<a href="ativo-detalhes.html?id=${encodeURIComponent(id)}" aria-label="Abrir Ativo 360° de ${safeName}" class="inline-flex text-slate-400 hover:text-emerald-500 transition-colors p-2 rounded-md hover:bg-emerald-50 dark:hover:bg-emerald-500/10"><i class="fas fa-up-right-from-square"></i></a><button onclick="showAssetQr('${id}')" aria-label="Gerar etiqueta QR do ativo ${safeName}" class="text-slate-400 hover:text-purple-500 transition-colors p-2 rounded-md hover:bg-purple-50 dark:hover:bg-purple-500/10"><i class="fas fa-qrcode"></i></button>${manageButtons}`;
                    const risk = calculateAssetRisk(ativo);
                    let statusBadge = '';
                    if(ativo.status === 'online') statusBadge = '<span class="px-2 py-1 bg-green-100 text-green-600 dark:bg-green-500/10 dark:text-green-400 rounded-md text-xxs font-bold uppercase"><i class="fas fa-circle text-[8px] mr-1"></i> Operando</span>';
                    else if(ativo.status === 'offline') statusBadge = '<span class="px-2 py-1 bg-slate-200 text-slate-600 dark:bg-slate-500/10 dark:text-slate-400 rounded-md text-xxs font-bold uppercase"><i class="fas fa-power-off mr-1"></i> Desligada</span>';
                    else statusBadge = '<span class="px-2 py-1 bg-red-100 text-red-600 dark:bg-red-500/10 dark:text-red-400 rounded-md text-xxs font-bold uppercase animate-pulse"><i class="fas fa-exclamation-triangle mr-1"></i> Falha</span>';

                    let tempColor = ativo.temp > 80 ? 'text-red-500 font-bold' : (ativo.temp > 60 ? 'text-amber-500' : 'text-slate-600 dark:text-slate-400');

                    list.innerHTML += `
                        <tr data-asset-id="${id}" class="table-row-hover transition-colors text-slate-700 dark:text-slate-300">
                            <td class="px-5 py-4 text-xs font-mono text-slate-500">#${id.substring(1, 6).toUpperCase()}</td>
                            <td class="px-5 py-4 font-medium">${safeName}<span class="block text-[10px] uppercase text-slate-400 mt-1">${safeArea}</span><span title="Análise preventiva por regras: ${escapeHtml(risk.reasons.join(', '))}" class="inline-flex mt-1 px-2 py-0.5 rounded-md text-[9px] font-bold uppercase ${risk.className}">${risk.label} · ${risk.score}%</span></td>
                            <td class="px-5 py-4">${statusBadge}</td>
                            <td class="px-5 py-4 ${tempColor}"><i class="fas fa-thermometer-half mr-1"></i> ${ativo.temp} °C</td>
                            <td class="px-5 py-4 text-xs text-slate-500 dark:text-slate-400"><i class="fas fa-user-tag mr-1"></i> ${safeAuthor}</td>
                            <td class="px-5 py-4 text-right space-x-2">
                                ${actionButtons}
                            </td>
                        </tr>
                    `;
                });
                window.setTimeout(highlightRequestedAsset, 0);
            } else {
                list.innerHTML = `<tr><td colspan="6" class="px-5 py-8"><div class="nexus-empty-state"><i class="fas fa-industry text-2xl"></i><strong>Nenhum equipamento cadastrado</strong><span>Use "Novo Ativo" para incluir a primeira maquina monitorada.</span></div></td></tr>`;
            }
        }, () => {
            document.getElementById('assets-list').innerHTML = '<tr><td colspan="6" class="px-5 py-8 text-center text-red-500">Não foi possível carregar os ativos. Verifique a conexão.</td></tr>';
        });

        window.addAsset = () => {
            Swal.fire({
                title: 'Novo Ativo',
                html: `
                    <input id="swal-name" class="swal2-input" placeholder="Nome / Linha da Máquina">
                    <select id="swal-status" class="swal2-select">
                        <option value="online">Operando (Online)</option>
                        <option value="offline">Desligada (Offline)</option>
                        <option value="danger">Falha Crítica (Danger)</option>
                    </select>
                    <select id="swal-area" class="swal2-select">
                        <option value="producao">Produção</option>
                        <option value="utilidades">Utilidades</option>
                        <option value="logistica">Logística</option>
                    </select>
                    <input id="swal-temp" type="number" min="0" max="500" step="0.1" class="swal2-input" placeholder="Temperatura atual (°C)">
                    <input id="swal-ip" class="swal2-input" placeholder="IP / Identificação IoT (opcional)">
                    <input id="swal-energy" type="number" min="0" step="0.01" class="swal2-input" placeholder="Energia mensal (kWh)">
                    <input id="swal-mro" type="number" min="0" step="0.01" class="swal2-input" placeholder="Insumos MRO mensais (R$)">
                `,
                showCancelButton: true,
                ...getSwalTheme(),
                confirmButtonText: 'Registar',
                cancelButtonText: 'Cancelar',
                preConfirm: () => {
                    const name = document.getElementById('swal-name').value.trim();
                    if (!name) {
                        Swal.showValidationMessage('O nome do ativo é obrigatório.');
                        return false;
                    }
                    return {
                        name,
                        status: document.getElementById('swal-status').value,
                        area: document.getElementById('swal-area').value,
                        ip: document.getElementById('swal-ip').value.trim(),
                        energyKwh: nonNegative(document.getElementById('swal-energy').value),
                        mroCost: nonNegative(document.getElementById('swal-mro').value),
                        temp: nonNegative(document.getElementById('swal-temp').value),
                        createdAt: Date.now(),
                        createdBy: currentUserInfo.name
                    };
                }
            }).then(async (res) => {
                if (res.isConfirmed) {
                    try {
                        const created = await push(ref(db, 'assets'), res.value);
                        await writeAuditLog({ action: 'create', entity: 'asset', entityId: created.key, description: `Ativo ${res.value.name} criado.` });
                        window.nexusToast?.('success', 'Ativo registado com sucesso.');
                    } catch (error) {
                        window.nexusToast?.('error', 'Não foi possível cadastrar o ativo.');
                    }
                }
            });
        };

        window.showAssetQr = (id) => {
            onValue(ref(db, 'assets/' + id), (snapshot) => {
                const asset = snapshot.val();
                if (!asset) return;
                const assetUrl = new URL('ativo-detalhes.html', window.location.href);
                assetUrl.searchParams.set('id', id);
                const safeName = escapeHtml(asset.name || 'Ativo Nexus');
                Swal.fire({
                    title: 'Etiqueta digital do ativo',
                    html: `<div class="grid place-items-center gap-3"><div id="asset-qr" role="img" aria-label="QR Code do ativo"></div><p class="font-bold">${safeName}</p><p class="text-xs opacity-70 font-mono">#${escapeHtml(id)}</p><button type="button" id="print-asset-label" class="swal2-confirm swal2-styled"><i class="fas fa-print mr-2"></i>Imprimir etiqueta</button></div>`,
                    showConfirmButton: false,
                    showCloseButton: true,
                    ...getSwalTheme(),
                    didOpen: () => {
                        const qrHolder = document.getElementById('asset-qr');
                        if (!window.QRCode) {
                            qrHolder.replaceWith(Object.assign(document.createElement('p'), { textContent: 'Gerador QR indisponível. Verifique a internet.' }));
                            return;
                        }
                        new window.QRCode(qrHolder, {
                            text: assetUrl.href,
                            width: 220,
                            height: 220,
                            colorDark: '#111827',
                            colorLight: '#ffffff',
                            correctLevel: window.QRCode.CorrectLevel.H
                        });
                        document.getElementById('print-asset-label').addEventListener('click', () => {
                            const canvas = qrHolder.querySelector('canvas');
                            const image = qrHolder.querySelector('img');
                            const qrImage = canvas?.toDataURL('image/png') || image?.src;
                            if (!qrImage) return window.nexusToast?.('error', 'Aguarde a geração do QR Code.');
                            const popup = window.open('', '_blank', 'width=520,height=640');
                            if (!popup) return window.nexusToast?.('warning', 'Permita pop-ups para imprimir a etiqueta.');
                            popup.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Etiqueta ${safeName}</title><style>body{font-family:Arial,sans-serif;display:grid;place-items:center;min-height:90vh;text-align:center}.label{border:2px solid #111;border-radius:16px;padding:24px;width:300px}.label img{width:220px;height:220px}.label p{font-family:monospace;font-size:11px;word-break:break-all}</style></head><body><div class="label"><img src="${qrImage}" alt="QR Code"><h1>${safeName}</h1><p>${escapeHtml(id)}</p></div><script>window.onload=()=>window.print()<\/script></body></html>`);
                            popup.document.close();
                        });
                    }
                });
            }, { onlyOnce: true });
        };

        window.editAsset = (id) => {
            onValue(ref(db, 'assets/' + id), (snapshot) => {
                const asset = snapshot.val();
                if (!asset) {
                    window.nexusToast?.('error', 'Ativo não encontrado.');
                    return;
                }

                Swal.fire({
                    title: 'Editar Status',
                    html: `
                        <input id="swal-name" class="swal2-input" placeholder="Nome do ativo">
                        <select id="swal-status" class="swal2-select">
                            <option value="online">Operando</option>
                            <option value="offline">Desligada</option>
                            <option value="danger">Falha</option>
                        </select>
                        <select id="swal-area" class="swal2-select">
                            <option value="producao">Produção</option>
                            <option value="utilidades">Utilidades</option>
                            <option value="logistica">Logística</option>
                        </select>
                        <input type="number" id="swal-temp" min="0" max="500" class="swal2-input" placeholder="Temperatura atual (°C)">
                        <input id="swal-ip" class="swal2-input" placeholder="IP / Identificação IoT">
                        <input id="swal-energy" type="number" min="0" step="0.01" class="swal2-input" placeholder="Energia mensal (kWh)">
                        <input id="swal-mro" type="number" min="0" step="0.01" class="swal2-input" placeholder="Insumos MRO mensais (R$)">
                    `,
                    showCancelButton: true,
                    ...getSwalTheme(),
                    confirmButtonText: 'Salvar',
                    cancelButtonText: 'Cancelar',
                    didOpen: () => {
                        document.getElementById('swal-name').value = asset.name || '';
                        document.getElementById('swal-status').value = asset.status || 'offline';
                        document.getElementById('swal-area').value = asset.area || 'producao';
                        document.getElementById('swal-temp').value = Number.isFinite(Number(asset.temp)) ? asset.temp : 0;
                        document.getElementById('swal-ip').value = asset.ip || '';
                        document.getElementById('swal-energy').value = nonNegative(asset.energyKwh);
                        document.getElementById('swal-mro').value = nonNegative(asset.mroCost);
                    },
                    preConfirm: () => {
                        const name = document.getElementById('swal-name').value.trim();
                        if (!name) {
                            Swal.showValidationMessage('O nome do ativo é obrigatório.');
                            return false;
                        }
                        return {
                            name,
                            status: document.getElementById('swal-status').value,
                            area: document.getElementById('swal-area').value,
                            temp: parseInt(document.getElementById('swal-temp').value, 10) || 0,
                            ip: document.getElementById('swal-ip').value.trim(),
                            energyKwh: nonNegative(document.getElementById('swal-energy').value),
                            mroCost: nonNegative(document.getElementById('swal-mro').value),
                            updatedAt: Date.now(),
                            lastUpdatedBy: currentUserInfo.name
                        };
                    }
                }).then(async (res) => {
                    if (res.isConfirmed) {
                        try {
                            await update(ref(db, 'assets/' + id), res.value);
                            await writeAuditLog({ action: 'update', entity: 'asset', entityId: id, description: `Ativo ${res.value.name} atualizado.` });
                            window.nexusToast?.('success', 'Ativo atualizado.');
                        } catch (error) {
                            window.nexusToast?.('error', 'Não foi possível atualizar o ativo.');
                        }
                    }
                });
            }, { onlyOnce: true });
        };

        window.deleteAsset = (id) => {
            Swal.fire({
                title: 'Remover ativo?',
                text: "Esta ação apagará o histórico da máquina.",
                icon: 'warning',
                showCancelButton: true,
                ...getSwalTheme(),
                confirmButtonText: 'Sim, remover',
                cancelButtonText: 'Cancelar'
            }).then(async (res) => {
                if (res.isConfirmed) {
                    try {
                        await remove(ref(db, 'assets/' + id));
                        await writeAuditLog({ action: 'delete', entity: 'asset', entityId: id, description: 'Ativo removido.' });
                        window.nexusToast?.('warning', 'Ativo removido.');
                    } catch (error) {
                        window.nexusToast?.('error', 'Não foi possível remover o ativo.');
                    }
                }
            });
        };

        document.getElementById('searchInput')?.addEventListener('keyup', (e) => {
            const term = e.target.value.toLowerCase();
            document.querySelectorAll('#assets-list tr').forEach(row => {
                if (!row.innerText.toLowerCase().includes('sincronizando') && !row.innerText.toLowerCase().includes('nenhum')) {
                    row.style.display = row.innerText.toLowerCase().includes(term) ? '' : 'none';
                }
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
