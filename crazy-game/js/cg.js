/* CrazyGames SDK: Data module for saves, silent user name, gameplay events. No outside account storage.
   SDK / ad failures never block the game. */
window.SD = window.SD || {};
(function () {
  'use strict';
  var st = SD.store, C = SD.cg = { user: null, ready: false, available: false }, playing = false;

  function sdk() { try { return window.CrazyGames && window.CrazyGames.SDK; } catch (e) { return null; } }
  function settle(p) {
    try {
      if (p && typeof p.then === 'function') return p.then(function (v) { return v; }, function () {});
    } catch (e) {}
    return p;
  }
  function safe(fn) { try { return settle(fn()); } catch (e) {} }

  C.play = function () {
    try {
      if (playing) return; playing = true;
      var s = sdk();
      if (C.ready && s && s.game) safe(function () { return s.game.gameplayStart(); });
    } catch (e) { playing = true; }
  };
  C.stop = function () {
    try {
      if (!playing) return; playing = false;
      var s = sdk();
      if (C.ready && s && s.game) safe(function () { return s.game.gameplayStop(); });
    } catch (e) { playing = false; }
  };
  C.happy = function () {
    try {
      var s = sdk();
      if (C.ready && s && s.game && s.game.happytime) safe(function () { return s.game.happytime(); });
    } catch (e) {}
  };

  function apply(u) {
    try {
      C.user = u && u.username ? u : null;
      if (C.user) {
        var n = st.cleanName(C.user.username);
        if (n.length >= 3 && st.get('acct') !== 'cg') {
          st.setName(0, n);
          st.set('acct', 'cg');
        }
      }
      if (SD.main) SD.main.refresh();
    } catch (e) {}
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

  function timedInit(s) {
    return new Promise(function (res) {
      var done = false;
      function fin(ok) { if (done) return; done = true; res(!!ok); }
      setTimeout(function () { fin(false); }, 5000);
      try {
        Promise.resolve(s.init()).then(function () { fin(true); }, function () { fin(false); });
      } catch (e) { fin(false); }
    });
  }

  C.init = function () {
    return waitSdk().then(function () {
      var s = sdk();
      if (!s || typeof s.init !== 'function') return;
      var stopped = false;
      function stopLoad() {
        if (stopped) return; stopped = true;
        if (!C.ready) return;
        var s2 = sdk();
        if (s2 && s2.game && s2.game.loadingStop) safe(function () { return s2.game.loadingStop(); });
      }
      setTimeout(stopLoad, 8000);
      return timedInit(s).then(function (ok) {
        if (!ok || !sdk()) return;
        C.ready = true;
        if (s.game && s.game.loadingStart) safe(function () { return s.game.loadingStart(); });
        if (s.data && SD.store && SD.store.attach) {
          try { SD.store.attach(s.data); } catch (e) {}
          try { if (SD.main) SD.main.refresh(); } catch (e) {}
        }
        if (SD.ads) {
          try {
            SD.ads.init();
            SD.ads.ready();
            if (SD.ads.showHomeBanner) SD.ads.showHomeBanner();
          } catch (e) {}
        }
        try {
          C.available = !!(s.user && s.user.isUserAccountAvailable);
          if (C.available && s.user.addAuthListener) safe(function () { return s.user.addAuthListener(apply); });
          if (C.available && s.user.getUser) {
            return Promise.resolve(s.user.getUser()).then(apply, function () { apply(null); });
          }
        } catch (e) {}
      }).then(stopLoad, stopLoad);
    }).then(function () { return C; }, function () { return C; });
  };
})();
