/* Smooth ads: Google AdSense (web) or CrazyGames SDK (cg). Video only after a finished match.
   A 320x50 bar sits at the bottom of menu screens (home, about, offline, match, room, top 100). */
window.SD = window.SD || {};
(function () {
  'use strict';
  var CG = SD.BUILD === 'cg';
  var cfg = SD.ADS_CFG || {};
  var ready = false, busy = false, lastVideo = 0, GAP = 90000, barOn = false, requested = false;
  var MENU = { home: 1, offline: 1, info: 1, online: 1, party: 1 };
  var A = SD.ads = {};

  function $(s) { return document.querySelector(s); }
  function sdk() { try { return window.CrazyGames && window.CrazyGames.SDK; } catch (e) { return null; } }
  function webOn() { return !CG && !!(cfg.client && String(cfg.client).indexOf('ca-pub-') === 0); }
  function appEl() { return document.getElementById('app'); }
  function slot() { return cfg.bannerHome || cfg.banner || cfg.bannerMore || ''; }

  function pauseGame() {
    if (SD.audio && SD.audio.setPaused) SD.audio.setPaused(true);
    try { if ('speechSynthesis' in window) speechSynthesis.cancel(); } catch (e) {}
  }
  function resumeGame() {
    if (SD.audio && SD.audio.setPaused) SD.audio.setPaused(false);
  }

  function veil(on, title) {
    var el = $('#adVeil');
    if (!el) return;
    if (on) {
      var t = el.querySelector('.ad-veil-t');
      if (t) t.textContent = title || 'ONE SEC';
      el.hidden = false;
    } else el.hidden = true;
  }

  function pushAd(o) {
    try { (window.adsbygoogle = window.adsbygoogle || []).push(o); } catch (e) {}
  }

  function loadGoogle() {
    if (!webOn() || document.getElementById('adsbygoogle-js')) return;
    var s = document.createElement('script');
    s.id = 'adsbygoogle-js';
    s.async = true;
    s.crossOrigin = 'anonymous';
    s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + encodeURIComponent(cfg.client);
    s.setAttribute('data-ad-frequency-hint', cfg.freq || '90s');
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
  }

  function fillBanner(el, unit, w, h) {
    if (!el || !webOn() || !unit) { if (el) el.hidden = true; return false; }
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
  }

  A.showBar = function () {
    var box = $('#adBar');
    var app = appEl();
    if (!box) return;
    if (app) app.classList.add('ad-on');
    if (CG) {
      box.hidden = false;
      box.style.width = '320px';
      box.style.height = '50px';
      if (ready && !(SD.cg && !SD.cg.ready) && !requested) {
        requested = true;
        try {
          var s = sdk();
          var p = s && s.banner && s.banner.requestBanner({ id: 'adBar', width: 320, height: 50 });
          if (p && p.catch) p.catch(function () { requested = false; });
          else if (!p) requested = false;
        } catch (e) { requested = false; }
      }
      barOn = true;
      return;
    }
    if (barOn && !box.hidden && box.firstChild) return;
    barOn = fillBanner(box, slot(), 320, 50);
    if (!barOn && app) app.classList.remove('ad-on');
  };

  A.showHomeBanner = function () { A.showBar(); };
  A.showMoreBanner = function () { A.showBar(); };

  A.onScreen = function (id) {
    if (MENU[id]) A.showBar();
    else A.hideBanners();
  };

  A.hideBanners = function () {
    barOn = false;
    requested = false;
    var app = appEl();
    if (app) app.classList.remove('ad-on');
    if (CG) {
      try {
        var s = sdk();
        if (s && s.banner && s.banner.clearAllBanners) s.banner.clearAllBanners();
      } catch (e) {}
    }
    var el = $('#adBar');
    if (el) { el.hidden = true; if (!CG) el.innerHTML = ''; }
  };

  function doneVideo(cb) {
    busy = false;
    veil(false);
    resumeGame();
    if (cb) cb();
  }

  A.afterMatch = function (cb) {
    cb = cb || function () {};
    if (busy) return cb();
    var now = Date.now();
    if (now - lastVideo < GAP) return cb();
    var can = false;
    if (CG) {
      try { can = !!(ready && sdk() && sdk().ad); } catch (e) { can = false; }
    } else can = webOn();
    if (!can) return cb();
    lastVideo = now;
    busy = true;
    A.hideBanners();
    veil(true, 'A TINY BREAK');
    pauseGame();

    var finished = false;
    function fin() { if (finished) return; finished = true; doneVideo(cb); }
    setTimeout(fin, 14000);

    if (CG) {
      try {
        var s = sdk();
        if (!s || !s.ad || !ready) return fin();
        s.ad.requestAd('midgame', {
          adStarted: function () { pauseGame(); },
          adFinished: fin,
          adError: fin
        });
      } catch (e) { fin(); }
      return;
    }

    if (!webOn()) return fin();
    try {
      pushAd({
        type: 'next',
        name: 'after-match',
        beforeAd: function () { pauseGame(); },
        afterAd: fin,
        adBreakDone: function () { fin(); }
      });
    } catch (e) { fin(); }
  };

  A.init = function () {
    if (CG) {
      try { var s = sdk(); ready = !!(s && s.ad); } catch (e) { ready = false; }
      return;
    }
    loadGoogle();
    ready = webOn();
  };

  A.ready = function () {
    ready = true;
    if (barOn) { requested = false; A.showBar(); }
  };
})();
