/* CrazyGames SDK: Data module for saves, silent user name, gameplay events. No outside account storage. */
window.SD = window.SD || {};
(function () {
  'use strict';
  var st = SD.store, C = SD.cg = { user: null, ready: false, available: false }, playing = false;

  function sdk() { return window.CrazyGames && window.CrazyGames.SDK; }
  function safe(fn) { try { var r = fn(); if (r && r.catch) r.catch(function () {}); return r; } catch (e) {} }

  C.play = function () {
    var s = sdk(); if (playing) return; playing = true;
    if (C.ready && s && s.game) safe(function () { return s.game.gameplayStart(); });
  };
  C.stop = function () {
    var s = sdk(); if (!playing) return; playing = false;
    if (C.ready && s && s.game) safe(function () { return s.game.gameplayStop(); });
  };
  C.happy = function () {
    var s = sdk();
    if (C.ready && s && s.game && s.game.happytime) safe(function () { return s.game.happytime(); });
  };

  function apply(u) {
    C.user = u && u.username ? u : null;
    if (C.user) {
      var n = st.cleanName(C.user.username);
      if (n.length >= 3 && st.get('acct') !== 'cg') {
        st.setName(0, n);
        st.set('acct', 'cg');
      }
    }
    if (SD.main) SD.main.refresh();
  }

  function waitSdk() {
    return new Promise(function (res) {
      if (sdk()) return res();
      var el = document.getElementById('cgsdk'), done = false;
      function fin() { if (!done) { done = true; res(); } }
      if (el) { el.addEventListener('load', fin); el.addEventListener('error', fin); }
      setTimeout(fin, 4000);
    });
  }

  C.init = function () {
    return waitSdk().then(function () {
      var s = sdk();
      if (!s) return;
      var stopped = false;
      function stopLoad() {
        if (stopped) return; stopped = true;
        var s2 = sdk();
        if (s2 && s2.game && s2.game.loadingStop) safe(function () { return s2.game.loadingStop(); });
      }
      setTimeout(stopLoad, 8000);
      return Promise.resolve().then(function () { return s.init(); }).then(function () {
        C.ready = true;
        if (s.game && s.game.loadingStart) safe(function () { return s.game.loadingStart(); });
        if (s.data && SD.store && SD.store.attach) SD.store.attach(s.data);
        if (SD.ads) {
          SD.ads.init();
          SD.ads.ready();
          if (SD.ads.showHomeBanner) SD.ads.showHomeBanner();
        }
        try {
          C.available = !!(s.user && s.user.isUserAccountAvailable);
          if (C.available && s.user.addAuthListener) safe(function () { return s.user.addAuthListener(apply); });
          if (C.available && s.user.getUser) {
            return Promise.resolve(s.user.getUser()).then(apply, function () { apply(null); });
          }
        } catch (e) {}
      }).catch(function () {}).then(stopLoad);
    });
  };
})();
