import { db } from "./firebase.js";
import { onValue, ref } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

let initialized = false;

function ensureBanner() {
    let banner = document.getElementById("nexus-connection-status");
    if (banner) return banner;

    banner = document.createElement("div");
    banner.id = "nexus-connection-status";
    banner.setAttribute("role", "status");
    banner.setAttribute("aria-live", "polite");
    banner.innerHTML = '<i class="fas fa-wifi" aria-hidden="true"></i><span></span>';
    document.body.appendChild(banner);
    return banner;
}

function setStatus(connected, message) {
    const banner = ensureBanner();
    banner.dataset.state = connected ? "online" : "offline";
    banner.querySelector("span").textContent = message;
    banner.classList.toggle("is-visible", !connected);
}

export function initSystemStatus() {
    if (initialized) return;
    initialized = true;

    window.addEventListener("offline", () => setStatus(false, "Sem internet. As alterações serão retomadas quando a conexão voltar."));
    window.addEventListener("online", () => setStatus(true, "Conexão restaurada."));

    onValue(ref(db, ".info/connected"), (snapshot) => {
        const connected = snapshot.val() === true;
        setStatus(connected, connected ? "Conectado ao Nexus." : "Firebase indisponível. Verifique a internet e tente novamente.");
        if (connected) window.nexusToast?.("success", "Conexão com os dados restaurada.");
    }, () => setStatus(false, "Não foi possível verificar a conexão com os dados."));
}

initSystemStatus();
