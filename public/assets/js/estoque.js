import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, onValue, set, push, remove, update } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyD6gj_6e0WuGr6C_hJDkXBK7cI2EopWV1s",
    authDomain: "nexus-iot-senai.firebaseapp.com",
    databaseURL: "https://nexus-iot-senai-default-rtdb.firebaseio.com",
    projectId: "nexus-iot-senai"
};
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

let currentUserInfo = { name: "Operador", uid: "null" };

// 🔒 SISTEMA DE PROTEÇÃO DE ACESSO E PERFIL (RBAC)
onAuthStateChanged(auth, (user) => {
    if (user) {
        onValue(ref(db, 'users/' + user.uid), (snapshot) => {
            const userData = snapshot.val();
            if (userData) {
                const cargo = userData.role || "Operador";

                // 🛑 BLOQUEIO ATIVO PARA OPERADORES
                if (cargo === "Operador") {
                    Swal.fire({
                        icon: 'error',
                        title: 'Acesso Recusado',
                        text: 'O seu cargo (Operador) não possui permissões acadêmicas ou industriais para modificar ou ler o Stock MRO.',
                        confirmButtonColor: '#3b82f6',
                        allowOutsideClick: false
                    }).then(() => {
                        window.location.href = 'menu.html';
                    });
                    return;
                }

                // 🔒 Limpeza visual da sidebar se logado como Técnico
                if (cargo === "Técnico") {
                    document.querySelectorAll('a[href*="financeiro.html"]').forEach(el => el.remove());
                }

                document.getElementById('user-name').innerText = userData.name || "Almoxarife";
                document.getElementById('user-role').innerText = cargo;
                if (userData.photoURL) {
                    document.getElementById('user-photo').innerHTML = `<img src="${userData.photoURL}" class="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-dark-700" alt="Avatar">`;
                }
                currentUserInfo = { name: userData.name || "Usuário", uid: user.uid };
            }
        });
    } else {
        window.location.href = 'index.html';
    }
});

const getSwalTheme = () => document.documentElement.classList.contains('dark') ? {
    background: '#1e293b', color: '#cbd5e1', confirmButtonColor: '#3b82f6', cancelButtonColor: '#475569'
} : { confirmButtonColor: '#3b82f6', cancelButtonColor: '#94a3b8' };

function esc(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
}

const inventoryRef = ref(db, 'inventory');

onValue(inventoryRef, (snapshot) => {
    const data = snapshot.val() || {};
    const tbody = document.getElementById('inventory-list');
    if (!tbody) return;

    tbody.innerHTML = '';
    const keys = Object.keys(data);

    if (keys.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="px-5 py-8 text-center text-slate-500"><i class="fas fa-box-open mr-2"></i> Nenhum insumo cadastrado no inventário MRO.</td></tr>`;
        return;
    }

    keys.forEach(id => {
        const item = data[id];
        const qty = parseInt(item.quantity) || 0;
        const min = parseInt(item.minStock) || 0;
        const isLow = qty <= min;

        const row = document.createElement('tr');
        row.className = "table-row-hover border-b border-slate-100 dark:border-dark-800/50 text-xs text-slate-600 dark:text-slate-300 transition-colors";
        row.innerHTML = `
            <td class="px-5 py-4 font-mono font-medium text-brand">${esc(item.sku)}</td>
            <td class="px-5 py-4 font-medium text-slate-800 dark:text-slate-200">${esc(item.name)}</td>
            <td class="px-5 py-4 text-center">
                <div class="flex flex-col items-center gap-1">
                    <span class="font-bold ${isLow ? 'text-red-500' : 'text-slate-700 dark:text-slate-200'}">${qty} / ${min}</span>
                    <div class="w-24 bg-slate-200 dark:bg-dark-700 h-1.5 rounded-full overflow-hidden">
                        <div class="h-full ${isLow ? 'bg-red-500' : 'bg-green-500'}" style="width: ${Math.min((qty/Math.max(min,1))*100, 100)}%"></div>
                    </div>
                </div>
            </td>
            <td class="px-5 py-4 font-medium text-slate-700 dark:text-slate-300">R$ ${parseFloat(item.price || 0).toFixed(2)}</td>
            <td class="px-5 py-4 text-slate-400 text-xxs flex items-center gap-1.5 mt-2 border-none">
                <div class="w-1.5 h-1.5 rounded-full bg-brand"></div> ${esc(item.updatedBy || 'Sistema')}
            </td>
            <td class="px-5 py-4 text-right whitespace-nowrap">
                <button onclick="editItem('${id}')" class="h-7 w-7 text-slate-500 hover:text-brand bg-slate-100 dark:bg-dark-700 rounded-md transition-colors mr-1"><i class="fas fa-edit text-xs"></i></button>
                <button onclick="deleteItem('${id}')" class="h-7 w-7 text-slate-500 hover:text-red-500 bg-slate-100 dark:bg-dark-700 rounded-md transition-colors"><i class="fas fa-trash-alt text-xs"></i></button>
            </td>
        `;
        tbody.appendChild(row);
    });
});

window.addItem = async () => {
    const { value } = await Swal.fire({
        title: 'Adicionar Insumo MRO',
        html: `
            <div class="space-y-3 text-left">
                <div><label class="text-xs text-slate-400 font-medium">Código SKU</label><input id="swal-sku" class="swal2-input !w-full !m-0 bg-dark-900 text-white !h-9 text-xs" placeholder="EX: MRO-ROL-023"></div>
                <div><label class="text-xs text-slate-400 font-medium">Descrição / Item</label><input id="swal-name" class="swal2-input !w-full !m-0 bg-dark-900 text-white !h-9 text-xs" placeholder="EX: Rolamento Esférico Skf"></div>
                <div class="grid grid-cols-2 gap-2">
                    <div><label class="text-xs text-slate-400 font-medium">Qtd Atual</label><input id="swal-qty" type="number" class="swal2-input !w-full !m-0 bg-dark-900 text-white !h-9 text-xs" value="10"></div>
                    <div><label class="text-xs text-slate-400 font-medium">Qtd Mínima</label><input id="swal-min" type="number" class="swal2-input !w-full !m-0 bg-dark-900 text-white !h-9 text-xs" value="5"></div>
                </div>
                <div><label class="text-xs text-slate-400 font-medium">Custo Unitário (R$)</label><input id="swal-price" type="number" step="0.01" class="swal2-input !w-full !m-0 bg-dark-900 text-white !h-9 text-xs" placeholder="45.50"></div>
            </div>`,
        showCancelButton: true, confirmButtonText: 'Cadastrar', cancelButtonText: 'Cancelar',
        ...getSwalTheme(),
        preConfirm: () => {
            const sku = document.getElementById('swal-sku').value.trim();
            const name = document.getElementById('swal-name').value.trim();
            const quantity = parseInt(document.getElementById('swal-qty').value) || 0;
            const minStock = parseInt(document.getElementById('swal-min').value) || 0;
            const price = parseFloat(document.getElementById('swal-price').value) || 0;

            if(!sku || !name) { Swal.showValidationMessage('SKU e Descrição são obrigatórios.'); return false; }
            if(quantity < 0 || minStock < 0) { Swal.showValidationMessage('As quantidades não podem ser negativas.'); return false; }
            return { sku, name, quantity, minStock, price, updatedBy: currentUserInfo.name };
        }
    });
    if(value) push(inventoryRef, value);
};

window.editItem = (id) => {
    onValue(ref(db, 'inventory/' + id), async (snapshot) => {
        const item = snapshot.val();
        if(!item) return;

        const { value } = await Swal.fire({
            title: 'Editar Insumo MRO',
            html: `
                <div class="space-y-3 text-left">
                    <div><label class="text-xs text-slate-400 font-medium">Código SKU</label><input id="swal-sku" class="swal2-input !w-full !m-0 bg-dark-900 text-white !h-9 text-xs" value="${esc(item.sku)}" disabled></div>
                    <div><label class="text-xs text-slate-400 font-medium">Descrição / Item</label><input id="swal-name" class="swal2-input !w-full !m-0 bg-dark-900 text-white !h-9 text-xs" value="${esc(item.name)}"></div>
                    <div class="grid grid-cols-2 gap-2">
                        <div><label class="text-xs text-slate-400 font-medium">Qtd Atual</label><input id="swal-qty" type="number" class="swal2-input !w-full !m-0 bg-dark-900 text-white !h-9 text-xs" value="${item.quantity}"></div>
                        <div><label class="text-xs text-slate-400 font-medium">Qtd Mínima</label><input id="swal-min" type="number" class="swal2-input !w-full !m-0 bg-dark-900 text-white !h-9 text-xs" value="${item.minStock}"></div>
                    </div>
                    <div><label class="text-xs text-slate-400 font-medium">Custo Unitário (R$)</label><input id="swal-price" type="number" step="0.01" class="swal2-input !w-full !m-0 bg-dark-900 text-white !h-9 text-xs" value="${item.price || 0}"></div>
                </div>`,
            showCancelButton: true, confirmButtonText: 'Salvar', cancelButtonText: 'Cancelar',
            ...getSwalTheme(),
            preConfirm: () => {
                const name = document.getElementById('swal-name').value.trim();
                const quantity = parseInt(document.getElementById('swal-qty').value) || 0;
                const minStock = parseInt(document.getElementById('swal-min').value) || 0;
                const price = parseFloat(document.getElementById('swal-price').value) || 0;

                if(!name) { Swal.showValidationMessage('A descrição do item é obrigatória.'); return false; }
                return { ...item, name, quantity, minStock, price, updatedBy: currentUserInfo.name };
            }
        });
        if (value) update(ref(db, 'inventory/' + id), value);
    }, { onlyOnce: true });
};

window.deleteItem = (id) => {
    Swal.fire({
        title: 'Eliminar Registro MRO?',
        text: 'Esta ação removerá permanentemente o insumo do banco do chão de fábrica.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sim, deletar',
        cancelButtonText: 'Cancelar',
        ...getSwalTheme()
    }).then((res) => {
        if (res.isConfirmed) remove(ref(db, 'inventory/' + id));
    });
};

window.exportToCSV = () => {
    const table = document.getElementById('inventoryTable');
    if (!table) return;
    const rows = table.querySelectorAll('tr');
    let csv = ['"CÓDIGO SKU";"DESCRIÇÃO";"STOCK ATUAL";"STOCK MÍNIMO";"ATUALIZADO POR"'];

    for (let i = 1; i < rows.length; i++) {
        const cols = rows[i].querySelectorAll('td');
        if (cols.length < 5) continue;
        let sku = cols[0].innerText.trim();
        let desc = cols[1].innerText.trim();
        let numbers = cols[2].innerText.match(/\d+/g);
        let qty = numbers ? numbers[0] : 0;
        let min = numbers && numbers.length > 1 ? numbers[1] : 0;
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

window.toggleTheme = function() {
    const html = document.documentElement;
    if (html.classList.contains('dark')) {
        html.classList.remove('dark');
        localStorage.theme = 'light';
    } else {
        html.classList.add('dark');
        localStorage.theme = 'dark';
    }
};

const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => signOut(auth).then(() => window.location.href = 'index.html'));
}