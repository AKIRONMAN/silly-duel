/* Phones: menu screens sit on a 390 x 780 canvas scaled to the screen.
   Desktop / wide landscape: drop the phone scale so the home page can fill the window. */
(function () {
  'use strict';
  var IDS = ['home', 'online', 'party', 'wardrobe', 'settings', 'simSearch', 'offline', 'powers', 'arenas'], DW = 390, DH = 780;
  function fit() {
    var w = window.innerWidth, h = window.innerHeight;
    var desk = w >= 900 && w / h >= 1.05;
    document.body.classList.toggle('desk', desk);
    if (desk) {
      IDS.forEach(function (id) {
        var el = document.getElementById(id); if (!el) return;
        var st = el.style;
        st.position = 'absolute'; st.inset = '0'; st.left = '0'; st.top = '0';
        st.width = '100%'; st.height = '100%'; st.transform = 'none';
      });
      document.documentElement.style.setProperty('--fit', 1);
      return;
    }
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
