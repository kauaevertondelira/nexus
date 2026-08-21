import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pagesDir = path.join(root, 'public/pages');
const protectedPages = ['menu.html', 'mapa.html', 'mapa-consumo.html', 'ativos.html', 'ativo-detalhes.html', 'os.html', 'estoque.html', 'financeiro.html', 'planejamento.html', 'preventiva.html', 'inspecoes.html', 'confiabilidade.html', 'solicitacoes.html', 'tecnico.html', 'os-detalhes.html', 'iot.html', 'notificacoes.html', 'continuidade.html', 'fornecedores.html', 'compras.html', 'contratos.html', 'executivo.html'];
const htmlFiles = [path.join(root, 'index.html'), path.join(root, 'offline.html'), ...fs.readdirSync(pagesDir).filter((file) => file.endsWith('.html')).map((file) => path.join(pagesDir, file))];

for (const file of htmlFiles) {
    const source = fs.readFileSync(file, 'utf8');
    const relative = path.relative(root, file);
    assert.match(source, /<html[^>]+lang=["']pt-BR["']/i, `${relative}: idioma pt-BR ausente.`);
    assert.match(source, /<meta[^>]+name=["']viewport["']/i, `${relative}: viewport responsivo ausente.`);
    for (const match of source.matchAll(/<img\b[^>]*>/gi)) {
        assert.match(match[0], /\balt=["'][^"']*["']/i, `${relative}: imagem sem atributo alt.`);
    }
}

for (const page of protectedPages) {
    const source = fs.readFileSync(path.join(pagesDir, page), 'utf8');
    assert.match(source, /<html[^>]+nexus-auth-pending/i, `${page}: bloqueio visual inicial ausente.`);
    assert.ok(source.includes('src="../assets/js/auth-gate.js"'), `${page}: controle de acesso inicial ausente.`);
    assert.ok(source.includes('src="../assets/js/ui-enhancements.js"'), `${page}: suporte compartilhado ausente.`);
}

const css = fs.readFileSync(path.join(root, 'public/assets/css/nexus-ui.css'), 'utf8');
assert.ok(css.includes(':focus-visible'), 'CSS: foco visível ausente.');
assert.ok(css.includes('prefers-reduced-motion: reduce'), 'CSS: redução de movimento ausente.');

const support = fs.readFileSync(path.join(root, 'public/assets/js/support-center.js'), 'utf8');
for (const marker of ['role="dialog"', 'role="tablist"', 'role="log"', 'aria-live="polite"', 'aria-modal="true"', 'trapFocus(event)', "['ArrowLeft', 'ArrowRight']"]) {
    assert.ok(support.includes(marker), `Central: requisito acessível ausente (${marker}).`);
}

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8'));
assert.equal(manifest.lang, 'pt-BR', 'Manifesto: idioma incorreto.');
assert.equal(manifest.display, 'standalone', 'Manifesto: modo instalável ausente.');
assert.ok(fs.existsSync(path.join(root, 'service-worker.js')), 'Service Worker ausente.');
assert.ok(fs.existsSync(path.join(root, 'offline.html')), 'Página offline ausente.');
assert.ok(fs.existsSync(path.join(root, 'public/assets/data/assistant-knowledge.json')), 'Base local do assistente ausente.');

console.log(`OK: acessibilidade estrutural em ${htmlFiles.length} páginas, foco, teclado, movimento reduzido e PWA.`);
