/* Executado na entrada do documento, antes de montar as telas da Nexus. */
(() => {
  const root = document.documentElement;
  // O Swup altera o endereço entre a raiz e public/pages sem trocar o head.
  for (const link of document.head.querySelectorAll('link[href]')) {
    link.href = new URL(link.getAttribute('href'), document.baseURI).href;
  }
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  let motion = 'system';
  try {
    root.dataset.theme = localStorage.getItem('nexus-theme') === 'dark' ? 'dark' : 'light';
    motion = localStorage.getItem('nexus-motion') || 'system';
  } catch {}
  const reduced = () => motion === 'reduced' || (motion !== 'full' && media.matches);
  root.dataset.motion = reduced() ? 'reduced' : 'full';
  if (reduced() || document.visibilityState === 'hidden') return;

  const base = new URL('../../../', document.currentScript.src);
  const key = 'nexus-harpia-intro:' + base.pathname;
  try {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
  } catch {}
  const intro = document.createElement('div');
  intro.className = 'brand-intro';
  intro.setAttribute('aria-hidden', 'true');
  intro.innerHTML = '<div class="intro-frame"><span class="intro-mark intro-n"></span><span class="intro-mark intro-harpy"></span></div>';
  function dismiss() {
    intro.remove();
    clearTimeout(timeout);
    document.removeEventListener('keydown', dismiss, true);
    document.removeEventListener('pointerdown', dismiss, true);
    window.removeEventListener('pagehide', dismiss);
    media.removeEventListener('change', onPreference);
  }
  function onPreference() { if (reduced()) dismiss(); }
  const timeout = setTimeout(dismiss, 2100);
  intro.addEventListener('animationend', event => {
    if (event.target === intro) dismiss();
  });
  document.addEventListener('keydown', dismiss, true);
  document.addEventListener('pointerdown', dismiss, true);
  window.addEventListener('pagehide', dismiss);
  media.addEventListener('change', onPreference);
  document.body.prepend(intro);
})();
