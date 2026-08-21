import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../public/assets/js/auth-gate.js', import.meta.url), 'utf8');

function createGate(protocol = 'https:') {
    const classes = new Set(['dark', 'nexus-auth-pending']);
    let pendingTimer;
    let clearedTimer;
    const document = {
        documentElement: {
            classList: {
                contains: (name) => classes.has(name),
                remove: (name) => classes.delete(name)
            }
        },
        body: { innerHTML: '' }
    };
    const window = {
        location: { protocol, reload() {} },
        setTimeout(callback) { pendingTimer = callback; return 7; },
        clearTimeout(id) { clearedTimer = id; }
    };
    vm.runInNewContext(source, { document, window });
    return { classes, document, window, runTimeout: () => pendingTimer(), get clearedTimer() { return clearedTimer; } };
}

const success = createGate();
success.window.NexusAccessGate.release();
assert.equal(success.classes.has('nexus-auth-pending'), false, 'A página deve ser liberada após autorização.');
assert.equal(success.clearedTimer, 7, 'O temporizador precisa ser cancelado após autorização.');

const fileMode = createGate('file:');
fileMode.runTimeout();
assert.match(fileMode.document.body.innerHTML, /Live Server/, 'A abertura direta deve exibir orientação útil.');
assert.equal(fileMode.classes.has('nexus-auth-pending'), false, 'A tela de erro deve ficar visível.');

console.log('OK: proteção inicial, liberação e recuperação verificadas.');
