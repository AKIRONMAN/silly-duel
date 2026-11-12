/* Ads never block play. Google AdSense (web) or CrazyGames SDK (cg).
   Video only after a finished match. If an ad is missing, blocked, or errors, the game continues. */
window.SD = window.SD || {};
(function () {
  'use strict';
  var CG = SD.BUILD === 'cg';
  var cfg = SD.ADS_CFG || {};
  var ready = false, busy = false, lastVideo = 0, GAP = 90000, barOn = false, requested = false;
  var MENU = { home: 1, offline: 1, info: 1, online: 1, party: 1, ledger: 1 };
  var A = SD.ads = {};

  function $(s) { return document.querySelector(s); }
  function sdk() { try { return window.CrazyGames && window.CrazyGames.SDK; } catch (e) { return null; } }
  function webOn() { return !CG && !!(cfg.client && String(cfg.client).indexOf('ca-pub-') === 0); }
  function appEl() { return document.getElementById('app'); }
  function slot() { return cfg.bannerHome || cfg.banner || cfg.bannerMore || ''; }
  function cgLive() { return !!(CG && ready && SD.cg && SD.cg.ready && sdk()); }

  function settle(p) {
    try {
      if (p && typeof p.then === 'function') return p.then(function (v) { return v; }, function () {});
    } catch (e) {}
    return p;
  }
  function quiet(fn) {
    try { return settle(fn()); } catch (e) { return undefined; }
  }

  function pauseGame() {
    try { if (SD.audio && SD.audio.setPaused) SD.audio.setPaused(true); } catch (e) {}
    try { if ('speechSynthesis' in window) speechSynthesis.cancel(); } catch (e) {}
  }
  function resumeGame() {
    try { if (SD.audio && SD.audio.setPaused) SD.audio.setPaused(false); } catch (e) {}
  }

  function veil(on, title) {
    try {
      var el = $('#adVeil');
      if (!el) return;
      if (on) {
        var t = el.querySelector('.ad-veil-t');
        if (t) t.textContent = title || 'ONE SEC';
        el.hidden = false;
      } else el.hidden = true;
    } catch (e) {}
  }

  function pushAd(o) {
    return quiet(function () {
      window.adsbygoogle = window.adsbygoogle || [];
      return window.adsbygoogle.push(o);
    });
  }

  function loadGoogle() {
    if (!webOn() || document.getElementById('adsbygoogle-js') || document.querySelector('script[src*="adsbygoogle.js"]')) return;
    try {
      var s = document.createElement('script');
      s.id = 'adsbygoogle-js';
      s.async = true;
      s.crossOrigin = 'anonymous';
      s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + encodeURIComponent(cfg.client);
      s.setAttribute('data-ad-frequency-hint', cfg.freq || '90s');
      s.onerror = function () { ready = false; };
      document.head.appendChild(s);
      var meta = document.querySelector('meta[name="google-adsense-account"]');
      if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'google-adsense-account';
        document.head.appendChild(meta);
      }
      meta.content = cfg.client;
      window.adsbygoogle = window.adsbygoogle || [];
      pushAd({ preloadAdBreaks: 'on', sound: 'on' });
    } catch (e) { ready = false; }
  }

  function fillBanner(el, unit, w, h) {
    if (!el || !webOn() || !unit) { if (el) el.hidden = true; return false; }
    try {
      el.hidden = false;
      el.innerHTML = '';
      var ins = document.createElement('ins');
      ins.className = 'adsbygoogle';
      ins.style.display = 'inline-block';
      ins.style.width = w + 'px';
      ins.style.height = h + 'px';
      ins.setAttribute('data-ad-client', cfg.client);
      ins.setAttribute('data-ad-slot', unit);
      el.appendChild(ins);
      pushAd({});
      return true;
    } catch (e) {
      el.hidden = true;
      el.innerHTML = '';
      return false;
    }
  }

  A.showBar = function () {
    try {
      var box = $('#adBar');
      var app = appEl();
      if (!box) return;
      if (CG) {
        if (!cgLive()) {
          box.hidden = true;
          if (app) app.classList.remove('ad-on');
          barOn = true;
          return;
        }
        if (app) app.classList.add('ad-on');
        box.hidden = false;
        box.style.width = '320px';
        box.style.height = '50px';
        if (!requested) {
          requested = true;
          var p = quiet(function () {
            var s = sdk();
            return s && s.banner && s.banner.requestBanner({ id: 'adBar', width: 320, height: 50 });
          });
          if (p && p.then) p.then(function () {}, function () { requested = false; });
          else if (!p) requested = false;
        }
        barOn = true;
        return;
      }
      if (!webOn()) {
        box.hidden = true;
        if (app) app.classList.remove('ad-on');
        return;
      }
      if (barOn && !box.hidden && box.firstChild) return;
      if (app) app.classList.add('ad-on');
      barOn = fillBanner(box, slot(), 320, 50);
      if (!barOn && app) app.classList.remove('ad-on');
    } catch (e) {
      try { var a = appEl(); if (a) a.classList.remove('ad-on'); } catch (x) {}
    }
  };

  A.showHomeBanner = function () { A.showBar(); };
  A.showMoreBanner = function () { A.showBar(); };

  A.onScreen = function (id) {
    try {
      if (MENU[id]) A.showBar();
      else A.hideBanners();
    } catch (e) {}
  };

  A.hideBanners = function () {
    try {
      barOn = false;
      requested = false;
      var app = appEl();
      if (app) app.classList.remove('ad-on');
      if (CG && cgLive()) {
        quiet(function () {
          var s = sdk();
          return s && s.banner && s.banner.clearAllBanners && s.banner.clearAllBanners();
        });
      }
      var el = $('#adBar');
      if (el) { el.hidden = true; if (!CG) el.innerHTML = ''; }
    } catch (e) {}
  };

  function doneVideo(cb) {
    busy = false;
    veil(false);
    resumeGame();
    try { if (cb) cb(); } catch (e) {}
  }

  A.afterMatch = function (cb) {
    cb = cb || function () {};
    try {
      if (busy) return cb();
      var now = Date.now();
      if (now - lastVideo < GAP) return cb();
      var can = false;
      if (CG) can = cgLive() && !!(sdk() && sdk().ad);
      else can = webOn() && ready;
      if (!can) return cb();
      lastVideo = now;
      busy = true;

      var finished = false, started = false;
      function fin() {
        if (finished) return;
        finished = true;
        doneVideo(cb);
      }
      function beginAd() {
        if (finished || started) return;
        started = true;
        try { A.hideBanners(); } catch (e) {}
        veil(true, 'A TINY BREAK');
        pauseGame();
      }
      setTimeout(function () { if (!started) fin(); }, 3000);
      setTimeout(fin, 20000);

      if (CG) {
        quiet(function () {
          var s = sdk();
          if (!s || !s.ad || !cgLive()) { fin(); return; }
          return s.ad.requestAd('midgame', {
            adStarted: beginAd,
            adFinished: fin,
            adError: fin
          });
        });
        return;
      }

      if (!webOn()) return fin();
      quiet(function () {
        return pushAd({
          type: 'next',
          name: 'after-match',
          beforeAd: beginAd,
          afterAd: fin,
          adBreakDone: function () { fin(); }
        });
      });
    } catch (e) {
      busy = false;
      veil(false);
      resumeGame();
      try { cb(); } catch (x) {}
    }
  };

  A.init = function () {
    try {
      if (CG) {
        ready = !!(SD.cg && SD.cg.ready);
        return;
      }
      loadGoogle();
      ready = webOn();
    } catch (e) { ready = false; }
  };

  A.ready = function () {
    try {
      if (CG) ready = !!(SD.cg && SD.cg.ready && sdk());
      else ready = webOn();
      if (ready && barOn) { requested = false; A.showBar(); }
    } catch (e) { ready = false; }
  };

  try {
    window.addEventListener('unhandledrejection', function (ev) {
      try {
        var r = ev && ev.reason, m = '', stack = '';
        if (r && r.message) m = String(r.message);
        else if (r && r.code) m = String(r.code);
        else m = String(r || '');
        if (r && r.stack) stack = String(r.stack);
        try { if (r && typeof r === 'object') m += ' ' + JSON.stringify(r); } catch (x) {}
        if (/crazy|sdkNotInitialized|adsbygoogle|tagerror|no.?fill|requestBanner|requestAd/i.test(m + ' ' + stack)) {
          ev.preventDefault();
        }
      } catch (e) {}
    });
  } catch (e) {}
})();
