/* Menu screens sit on a 390 x 780 phone canvas, scaled to the screen.
   Desktop keeps that same column and centers it. Live games still fill the window. */
(function () {
  'use strict';
  var IDS = ['home', 'online', 'party', 'wardrobe', 'settings', 'simSearch', 'offline', 'powers', 'arenas', 'info'], DW = 390, DH = 780;
  function fit() {
    var w = window.innerWidth, h = window.innerHeight;
    var desk = w >= 900 && w / h >= 1.05;
    document.body.classList.toggle('desk', desk);
    var s = Math.max(0.45, Math.min(1.7, Math.min(w / DW, h / DH)));
    var cw = desk ? DW : (w / s);
    var ch = desk ? DH : (h / s);
    var left = desk ? Math.round((w - cw * s) / 2) : 0;
    var top = desk ? Math.round((h - ch * s) / 2) : 0;
    IDS.forEach(function (id) {
      var el = document.getElementById(id); if (!el) return;
      var st = el.style;
      st.position = 'absolute';
      st.inset = 'auto';
      st.left = left + 'px';
      st.top = top + 'px';
      st.width = cw + 'px';
      st.height = ch + 'px';
      st.transformOrigin = '0 0';
      st.transform = 'scale(' + s + ')';
    });
    document.documentElement.style.setProperty('--fit', s);
  }
  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', function () { setTimeout(fit, 120); });
  fit();
})();
