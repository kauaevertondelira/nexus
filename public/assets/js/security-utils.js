export function escapeHtml(value = "") {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

export function asNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

export function nonNegative(value, fallback = 0) {
    return Math.max(0, asNumber(value, fallback));
}

export function formatCurrency(value) {
    return nonNegative(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function csvCell(value) {
    return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export function downloadFile(contents, filename, type = "text/plain;charset=utf-8") {
    const blob = contents instanceof Blob ? contents : new Blob([contents], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function periodStart(days) {
    if (!days || days === "all") return 0;
    const numericDays = Math.max(1, Number(days) || 30);
    return Date.now() - numericDays * 86400000;
}

export function monthKey(timestamp = Date.now()) {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
