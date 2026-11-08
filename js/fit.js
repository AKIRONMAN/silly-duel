/* One look on every phone: the menu screens are laid out on a fixed 390 x 780 canvas that is
   scaled to fit the real screen, so nothing scrolls and nothing looks zoomed in or out. */
(function () {
  'use strict';
  var IDS = ['home', 'online', 'party', 'wardrobe', 'settings', 'simSearch', 'offline', 'powers', 'arenas'], DW = 390, DH = 780;
  function fit() {
    var w = window.innerWidth, h = window.innerHeight;
    var s = Math.max(0.45, Math.min(1.7, Math.min(w / DW, h / DH)));
    IDS.forEach(function (id) {
      var el = document.getElementById(id); if (!el) return;
      var st = el.style;
      st.position = 'absolute'; st.inset = 'auto'; st.left = '0'; st.top = '0';
      st.width = (w / s) + 'px'; st.height = (h / s) + 'px';
      st.transformOrigin = '0 0'; st.transform = 'scale(' + s + ')';
    });
    document.documentElement.style.setProperty('--fit', s);
  }
  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', function () { setTimeout(fit, 120); });
  fit();
})();
