/* Standalone harness for new shared duels. Does not start a match or touch pools. */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var pads = [], onDown = null, onUp = null, accepting = false, raf = 0, frameFn = null, last = 0;
  var timers = [], ended = false, activeGame = null, pendingId = null;
  var KEYS = ['Q', 'P'];
  var IDS = ['piedodge', 'memory', 'fillcard', 'oddone', 'whack', 'quiettwin'];
  var DUR = { piedodge: 16, memory: 32, fillcard: 28, oddone: 22, whack: 18, quiettwin: 22 };

  function later(fn, ms) {
    var id = setTimeout(fn, ms);
    timers.push(id);
    return id;
  }
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }
  function setCenter(html, cls) {
    var c = $('#centerInner');
    c.className = cls || '';
    c.innerHTML = html || '';
  }
  function showGo() {
    var g = $('#goText');
    g.textContent = 'GO!';
    g.classList.remove('on'); void g.offsetWidth; g.classList.add('on');
    later(function () { g.classList.remove('on'); }, 800);
  }
  function showTimer(ms) {
    var t = $('#timer'), i = t && t.querySelector('i');
    if (!t || !i) return;
    t.classList.add('on');
    i.style.transition = 'none'; i.style.width = '100%';
    void i.offsetWidth;
    i.style.transition = 'width ' + ms + 'ms linear';
    i.style.width = '0%';
  }
  function hideTimer() { var t = $('#timer'); if (t) t.classList.remove('on'); }
  function isWide() { return window.innerWidth > window.innerHeight * 1.05; }

  function colorOf(i) {
    var sk = SD.art.slotSkin(i), s = (SD.art.SKINS && SD.art.SKINS[sk]) || SD.art.CHARS[i] || SD.art.CHARS[0];
    return { pad: s.pad || s.fill, fill: s.fill, deep: s.deep };
  }
  function setFace(i, mood) {
    var p = pads[i]; if (!p) return;
    var html = SD.art.face(i, mood);
    if (p.mood !== mood) { p.mood = mood; p.faceEl.innerHTML = html; }
    if (!p.stage) return;
    var nodes = p.stage.querySelectorAll('.ng-hero, .ng-face, .dd-hero');
    if (!nodes.length) return;
    if (p.heroMood === mood) return;
    p.heroMood = mood;
    for (var n = 0; n < nodes.length; n++) nodes[n].innerHTML = html;
  }
  function padCenter(i) {
    var arena = $('#arena').getBoundingClientRect();
    var r = pads[i].el.getBoundingClientRect();
    return { x: r.left + r.width / 2 - arena.left, y: r.top + r.height / 2 - arena.top };
  }
  function buildPads() {
    var el = $('#pads'); el.innerHTML = ''; pads = [];
    $('#arena').dataset.count = 2;
    for (var i = 0; i < 2; i++) (function (i) {
      var c = colorOf(i), pad = document.createElement('div');
      pad.className = 'pad p' + i;
      pad.style.setProperty('--pc', c.pad); pad.style.setProperty('--pf', c.fill); pad.style.setProperty('--pd', c.deep);
      pad.innerHTML = '<div class="pad-top"><span class="pad-face"></span><span class="pad-name">' + (i ? 'P2' : 'P1') +
        '</span><kbd>' + KEYS[i] + '</kbd></div><div class="pad-stage"></div><div class="pad-dock"></div><div class="pad-badge"></div>';
      el.appendChild(pad);
      var p = { el: pad, faceEl: pad.querySelector('.pad-face'), stage: pad.querySelector('.pad-stage'), held: null, mood: '' };
      pads.push(p);
      setFace(i, 'idle');
      pad.addEventListener('pointerdown', function (e) {
        if (e.target && e.target.closest && e.target.closest('.ng-hit')) return;
        e.preventDefault();
        if (p.held !== null) return;
        p.held = e.pointerId;
        try { pad.setPointerCapture(e.pointerId); } catch (_) {}
        press(i);
      });
      var up = function (e) { if (p.held !== e.pointerId) return; p.held = null; release(i); };
      pad.addEventListener('pointerup', up);
      pad.addEventListener('pointercancel', up);
      pad.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    })(i);
  }
  function press(i) {
    if (!pads[i]) return;
    pads[i].el.classList.add('down');
    if (accepting && onDown) onDown(i);
  }
  function release(i) {
    if (!pads[i]) return;
    pads[i].el.classList.remove('down');
    if (accepting && onUp) onUp(i);
  }
  window.addEventListener('keydown', function (e) {
    if (e.repeat) return;
    var k = (e.key || '').toUpperCase();
    if (k === 'ESCAPE') { e.preventDefault(); stopToMenu(); return; }
    var i = KEYS.indexOf(k === ' ' ? 'Q' : k);
    if (i < 0) return;
    e.preventDefault();
    press(i);
  });
  window.addEventListener('keyup', function (e) {
    var k = (e.key || '').toUpperCase();
    var i = KEYS.indexOf(k === ' ' ? 'Q' : k);
    if (i < 0) return;
    release(i);
  });

  function tick(now) {
    if (!frameFn) { raf = 0; return; }
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    frameFn(dt, now);
    raf = frameFn ? requestAnimationFrame(tick) : 0;
  }
  function makeCtx() {
    return {
      players: [0, 1],
      stage: function (i) { return pads[i].stage; },
      padEl: function (i) { return pads[i].el; },
      seam: function () { return $('#seam'); },
      padCenter: padCenter,
      wide: isWide,
      face: setFace,
      onDown: function (fn) { onDown = fn; },
      onUp: function (fn) { onUp = fn; },
      bots: [], skill: 0.4, hard: 0, level: 1, rand: Math.random,
      press: press, release: release, tap: function (i) { press(i); later(function () { release(i); }, 90); },
      power: function () { return false; },
      live: function () {},
      later: later,
      frame: function (fn) { frameFn = fn; last = performance.now(); if (!raf) raf = requestAnimationFrame(tick); },
      timer: showTimer,
      end: endRound,
      now: function () { return performance.now(); },
      used: function () {},
      fx: function () {},
      pop: function (i, text, cls) { var c = SD.fx.center(pads[i].stage); SD.fx.popText(c.x, c.y, text, cls); }
    };
  }

  function byId(id) {
    for (var i = 0; i < SD.games.length; i++) if (SD.games[i].id === id) return SD.games[i];
    return null;
  }
  function hideLand() { $('#landAsk').hidden = true; pendingId = null; }
  function askLand(id) {
    pendingId = id;
    $('#pick').hidden = true;
    $('#arena').hidden = false;
    $('#landAsk').hidden = false;
    if (isWide()) { hideLand(); begin(id); }
  }
  function play(id) {
    var g = byId(id); if (!g) return;
    try { SD.audio.unlock(); } catch (e) {}
    if (g.needLand && !isWide()) return askLand(id);
    begin(id);
  }
  function begin(id) {
    var g = byId(id); if (!g) return;
    try { SD.audio.music.start('game'); } catch (e) {}
    $('#pick').hidden = true;
    $('#arena').hidden = false;
    hideLand();
    ended = false; accepting = false; onDown = onUp = null; frameFn = null;
    activeGame = g;
    $('#center').classList.toggle('peek-mode', !!g.peek);
    $('#seam').innerHTML = '';
    $('#arena').classList.toggle('gap-on', !!g.needGap);
    buildPads();
    pads.forEach(function (p) { p.stage.innerHTML = ''; });
    setCenter('<div class="intro">' + SD.art.icon(g.icon, 72) + '<b>' + g.title + '</b><span>' + g.tip + '</span><span>P1 = Q / blue. P2 = P / pink.</span></div>', 'pop');
    later(function () { countdown(3); }, 1400);
  }
  function countdown(n) {
    if (n === 3 && activeGame && activeGame.setup) activeGame.setup(makeCtx());
    if (n > 0) {
      if (activeGame && activeGame.peek) setCenter('<div class="count-peek">MEMORIZE · ' + n + '</div>', 'pop');
      else setCenter('<div class="count-num n' + n + '">' + n + '</div>', 'pop');
      try { SD.audio.sfx.count(n); } catch (e) {}
      later(function () { countdown(n - 1); }, activeGame && activeGame.peek ? 1100 : 700);
    } else {
      setCenter('');
      $('#center').classList.remove('peek-mode');
      showGo();
      try { SD.audio.sfx.count(0); SD.fx.flash('#fff'); } catch (e) {}
      if (ended || !activeGame) return;
      accepting = true;
      if (DUR[activeGame.id]) showTimer(DUR[activeGame.id] * 1000);
      activeGame.start(makeCtx());
    }
  }
  function endRound(results) {
    if (ended) return;
    ended = true; accepting = false; frameFn = null;
    hideTimer();
    var best = -999, win = 0, i;
    for (i = 0; i < results.length; i++) if ((results[i].p || 0) > best) { best = results[i].p; win = i; }
    var tie = results[0] && results[1] && results[0].p === results[1].p;
    setCenter('<div class="ng-win">' + (tie ? 'TIE!' : ('P' + (win + 1) + ' WINS')) +
      '<small>' + (results[0] && results[0].label || '') + ' · ' + (results[1] && results[1].label || '') +
      '<br>tap EXIT or wait</small></div>', 'pop');
    later(stopToMenu, 2200);
  }
  function stopToMenu() {
    ended = true; accepting = false; frameFn = null; activeGame = null; pendingId = null;
    clearTimers(); hideTimer(); setCenter('');
    $('#seam').innerHTML = '';
    $('#pads').innerHTML = '';
    pads = [];
    $('#arena').classList.remove('gap-on');
    $('#center').classList.remove('peek-mode');
    $('#arena').hidden = true;
    hideLand();
    $('#pick').hidden = false;
    try { SD.audio.music.start('menu'); } catch (e) {}
  }

  function fillMenu() {
    var box = $('#ngList'); if (!box) return;
    box.innerHTML = '';
    IDS.forEach(function (id) {
      var g = byId(id); if (!g) return;
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'ng-card';
      b.innerHTML = SD.art.icon(g.icon, 52) + '<span><b>' + g.title + '</b><small>' + g.tip + (g.needLand ? ' · LANDSCAPE' : '') + '</small></span>';
      b.addEventListener('click', function () { play(id); });
      box.appendChild(b);
    });
  }

  function fitPick() {
    var el = $('#pick'); if (!el) return;
    var w = window.innerWidth, h = window.innerHeight, DW = 390, DH = 780;
    var s = Math.max(0.45, Math.min(1.7, Math.min(w / DW, h / DH)));
    el.style.position = 'absolute';
    el.style.left = Math.round((w - DW * s) / 2) + 'px';
    el.style.top = Math.round((h - DH * s) / 2) + 'px';
    el.style.width = DW + 'px';
    el.style.height = DH + 'px';
    el.style.transformOrigin = '0 0';
    el.style.transform = 'scale(' + s + ')';
    if (pendingId && !$('#landAsk').hidden && isWide()) { hideLand(); begin(pendingId); }
  }

  function boot() {
    SD.games = SD.games || [];
    try { SD.art.setLive(0, 1); SD.art.setLive(1, 0); } catch (e) {}
    try { SD.fx.init(); } catch (e) {}
    fillMenu();
    fitPick();
    window.addEventListener('resize', fitPick);
    window.addEventListener('orientationchange', function () { setTimeout(fitPick, 200); });
    $('#btnExit').addEventListener('click', stopToMenu);
    $('#landGo').addEventListener('click', function () {
      if (pendingId) { var id = pendingId; hideLand(); begin(id); }
    });
    $('#landSkip').addEventListener('click', function () {
      if (pendingId) { var id = pendingId; hideLand(); begin(id); }
    });
    document.addEventListener('pointerdown', function () { try { SD.audio.unlock(); } catch (e) {} }, { once: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
