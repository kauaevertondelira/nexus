"""Regressão da interface 4.5. Requer Playwright para Python e navegador Chromium.

NEXUS_URL define a prévia (padrão http://127.0.0.1:4173/nexus/).
NEXUS_BROWSER_PATH aponta para um Chromium local, se necessário.
NEXUS_AXE_SCRIPT aponta opcionalmente para axe-core/axe.min.js.
"""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = os.environ.get('NEXUS_URL', 'http://127.0.0.1:4173/nexus/')
RESULTS = Path(__file__).parent / 'results'
RESULTS.mkdir(exist_ok=True)
AXE = os.environ.get('NEXUS_AXE_SCRIPT')
report = {'checks': [], 'accessibility': {}, 'performance': {}}


def check(value, description):
    assert value, description
    report['checks'].append(description)
    print('PASS · ' + description)


def loaded(page, route):
    page.wait_for_function('(route) => window.Nexus?.route === route', arg=route)
    if route not in ('index', 'login'):
        page.wait_for_selector('#view-body > :first-child')
    page.wait_for_load_state('networkidle')


def audit(page, name, include=None):
    if not AXE:
        return
    page.add_script_tag(path=AXE)
    result = page.evaluate("""async include => {
      const context = include ? {include} : document;
      return axe.run(context, {runOnly:{type:'tag', values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}});
    }""", include)
    violations = [{'id': v['id'], 'impact': v['impact'],
                   'nodes': [n['target'] for n in v['nodes']]} for v in result['violations']]
    report['accessibility'][name] = violations
    check(not violations, 'Verificação automatizada de acessibilidade: ' + name + ' · ' + json.dumps(violations))


with sync_playwright() as p:
    options = {'headless': True}
    if os.environ.get('NEXUS_BROWSER_PATH'):
        options['executable_path'] = os.environ['NEXUS_BROWSER_PATH']
    browser = p.chromium.launch(**options)
    context = browser.new_context(viewport={'width': 1440, 'height': 1000}, service_workers='block')
    context.add_init_script("sessionStorage.setItem('nexus-intro','1')")
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(BASE)
    loaded(page, 'index')
    page.wait_for_timeout(750)
    page.screenshot(path=str(RESULTS / 'inicio-desktop.png'))
    check(page.locator('#hero-motor, .landing canvas').count() == 0, 'Abertura sem motor e sem canvas 3D')
    resources = page.evaluate("performance.getEntriesByType('resource').map(x=>({url:x.name,bytes:x.encodedBodySize}))")
    check(not any('/three/' in x['url'] or '/jspdf/' in x['url'] for x in resources), 'Three.js e PDF ausentes do carregamento inicial')
    report['performance']['initialResourceBytes'] = sum(x['bytes'] for x in resources)
    page.get_by_role('button', name='Próxima imagem', exact=True).click()
    page.wait_for_function("document.querySelector('[data-hero-caption]').textContent === 'Usinagem de precisão'")
    check(page.locator('[data-hero-slide].is-active img').evaluate('(img)=>img.naturalWidth > 0'), 'Carrossel mostra uma foto carregada ao avançar')
    page.keyboard.press('ArrowLeft')
    page.wait_for_function("document.querySelector('[data-hero-count]').textContent === '01 / 03'")
    page.get_by_role('button', name='Pausar carrossel', exact=True).click()
    page.locator('#hero-title').click()
    page.clock.install()
    page.clock.fast_forward(8000)
    check(page.locator('[data-hero-count]').inner_text() == '01 / 03', 'Pausar mantém a imagem selecionada')
    page.get_by_role('button', name='Retomar carrossel', exact=True).click()
    page.locator('#hero-title').click()
    page.clock.fast_forward(8000)
    page.wait_for_function("document.querySelector('[data-hero-count]').textContent === '02 / 03'")
    check(True, 'Retomar reinicia a troca automática de imagens')
    # O relógio real evita interferir nas animações GSAP e na navegação Swup.
    page.clock.resume()
    page.get_by_role('button', name='Pausar carrossel', exact=True).click()
    audit(page, 'início')
    document_id = page.evaluate('window.nexusVisualDocument = crypto.randomUUID()')
    page.get_by_role('link', name='Explorar a Nexus', exact=True).click()
    loaded(page, 'menu')
    page.wait_for_selector('[data-slot="button"][data-action="sidebar-toggle"]')
    toggle = page.get_by_role('button', name='Recolher barra lateral', exact=True)
    toggle.focus()
    page.keyboard.press('Enter')
    page.wait_for_timeout(300)
    check(page.locator('.sidebar').bounding_box()['width'] == 80, 'Seta recolhe a barra para 80 px por teclado')
    page.locator('.nav-link').first.focus()
    check(page.get_by_role('tooltip').inner_text() == 'Visão global', 'Ícones recolhidos mostram o rótulo ao focar')
    page.keyboard.press('Escape')
    page.screenshot(path=str(RESULTS / 'painel-compacto.png'))
    page.get_by_role('link', name='Parque de ativos', exact=True).click()
    loaded(page, 'ativos')
    check(page.evaluate('window.nexusVisualDocument') == document_id, 'Swup mantém o documento ao abrir ativos')
    check(page.locator('.sidebar').bounding_box()['width'] == 80, 'Barra continua recolhida após navegar')
    page.reload()
    loaded(page, 'ativos')
    check(page.locator('.sidebar').bounding_box()['width'] == 80, 'Preferência da barra sobrevive à recarga')
    page.get_by_role('button', name='Expandir barra lateral', exact=True).click()
    page.wait_for_timeout(300)
    check(page.locator('.sidebar').bounding_box()['width'] > 200, 'Seta expande a navegação com textos')
    page.get_by_role('link', name='Visão global', exact=True).click()
    loaded(page, 'menu')
    page.wait_for_timeout(500)
    page.screenshot(path=str(RESULTS / 'painel-desktop.png'))
    audit(page, 'barra lateral e cabeçalho', ['.sidebar', '.topbar'])
    page.get_by_role('button', name='Alternar tema', exact=True).click()
    page.wait_for_timeout(500)
    page.screenshot(path=str(RESULTS / 'painel-escuro.png'))
    audit(page, 'barra lateral escura', ['.sidebar', '.topbar'])
    page.get_by_role('button', name='Alternar tema', exact=True).click()
    # O gerador continua funcionando depois de passar ao carregamento sob demanda.
    with page.expect_download() as download:
        page.evaluate("Nexus.pdf('Validação da interface', ['Arquivo de teste local'])")
    check(download.value.suggested_filename.endswith('.pdf'), 'Exportação de PDF funciona sob demanda')

    mobile = browser.new_context(viewport={'width':390,'height':844}, reduced_motion='reduce', service_workers='block')
    mobile.add_init_script("sessionStorage.setItem('nexus-intro','1')")
    phone = mobile.new_page()
    phone.on('pageerror', lambda error: errors.append(str(error)))
    phone.goto(BASE)
    loaded(phone, 'index')
    phone.clock.install()
    phone.clock.fast_forward(16000)
    check(phone.locator('[data-hero-count]').inner_text() == '01 / 03', 'Movimento reduzido impede rotação automática')
    check(phone.get_by_role('button', name='Pausar carrossel', exact=True).count() == 0, 'Pausa automática não aparece com movimento reduzido')
    phone.get_by_role('button', name='Próxima imagem', exact=True).click()
    phone.wait_for_function("document.querySelector('[data-hero-count]').textContent === '02 / 03'")
    check(phone.locator('.hero-photo.is-active').evaluate('(el)=>getComputedStyle(el).transitionDuration') == '0s', 'Troca manual permanece disponível sem animação')
    for width in (320, 390, 768):
        phone.set_viewport_size({'width':width,'height':844})
        check(not phone.evaluate('document.documentElement.scrollWidth > innerWidth'), 'Início sem rolagem horizontal em ' + str(width) + ' px')
    phone.set_viewport_size({'width':390,'height':844})
    phone.get_by_role('button', name='Imagem anterior', exact=True).click()
    phone.wait_for_function("document.querySelector('[data-hero-count]').textContent === '01 / 03'")
    phone.screenshot(path=str(RESULTS / 'inicio-celular.png'), full_page=True)
    phone.get_by_role('link', name='Acessar sistema', exact=True).click()
    loaded(phone, 'login')
    check('INDUSTRIAL OPERATING SYSTEM' not in phone.locator('body').inner_text(), 'Acesso usa textos em português')
    phone.locator('[data-action="demo-enter"]').click()
    loaded(phone, 'menu')
    phone.get_by_role('button', name='Abrir navegação', exact=True).click()
    check(phone.locator('.sidebar').is_visible(), 'Navegação móvel abre pelo botão')
    check(phone.locator('.app-workspace').evaluate('(el)=>el.inert'), 'Foco fica protegido do conteúdo atrás do menu móvel')
    phone.screenshot(path=str(RESULTS / 'menu-celular.png'))
    phone.keyboard.press('Escape')
    check(phone.get_by_role('button', name='Abrir navegação', exact=True).evaluate('(el)=>el === document.activeElement'), 'Escape devolve o foco ao botão de navegação')
    phone.get_by_role('button', name='Abrir navegação', exact=True).click()
    phone.get_by_role('link', name='Produção', exact=True).click()
    loaded(phone, 'producao')
    check(not phone.locator('.sidebar').is_visible(), 'Menu móvel fecha após escolher um módulo')
    check(not phone.locator('.app-workspace').evaluate('(el)=>el.inert'), 'Módulo fica interativo após fechar o menu')
    phone.screenshot(path=str(RESULTS / 'producao-celular.png'))
    check(not errors, 'Fluxos sem erros de JavaScript: ' + json.dumps(errors))
    browser.close()

(RESULTS / 'interface-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
