(function () {
  try {
    var root = document.documentElement;
    var pref = localStorage.getItem('pf.theme') || 'system';
    var dark = pref === 'dark' || (pref === 'system' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    root.setAttribute('data-theme', dark ? 'dark' : 'light');
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#141b2e' : '#ffffff');

    var lang = localStorage.getItem('pf.lang');
    if (lang !== 'pt-BR' && lang !== 'en' && lang !== 'es') {
      var nav = String((navigator.languages && navigator.languages[0]) || navigator.language || 'pt-BR').toLowerCase();
      lang = nav.indexOf('es') === 0 ? 'es' : nav.indexOf('en') === 0 ? 'en' : 'pt-BR';
    }
    root.setAttribute('lang', lang);
  } catch (e) {}
})();
