/* Opening movie (about 28 seconds): what Silly Duel is, in 8 quick scenes. SD.intro.play(done) */
(function () {
  'use strict';
  var art = SD.art, au = SD.audio, CG = (window.SD_BUILD === 'cg') || (typeof SD.BUILD !== 'undefined' && SD.BUILD === 'cg');
  var $ = function (s, r) { if (typeof r === 'string') r = document.querySelector(r); return (r || document).querySelector(s); };
  var timers = [], root = null, finished = false, cb = null;

  function at(ms, fn) { timers.push(setTimeout(fn, ms)); }
  function sfx(n, a) { try { au.sfx[n] && au.sfx[n](a); } catch (e) {} }
  function face(skin, mood, extra) { return '<span class="in-face ' + (extra || '') + '">' + art.face(0, mood || 'idle', { skin: skin }) + '</span>'; }
  function cap(text, cls) { return '<div class="in-cap ' + (cls || '') + '">' + text + '</div>'; }
  function confetti(n) {
    var c = ['#ff7ab8', '#ffd23f', '#6fcfff', '#76e6a8', '#a45cff', '#ff9b54'], h = '';
    for (var i = 0; i < n; i++) h += '<i class="in-cf" style="left:' + (Math.random() * 100).toFixed(1) + '%;background:' + c[i % 6] + ';animation-delay:' + (Math.random() * .5).toFixed(2) + 's;--dx:' + ((Math.random() - .5) * 160).toFixed(0) + 'px;--r:' + ((Math.random() - .5) * 900).toFixed(0) + 'deg"></i>';
    var d = document.createElement('div'); d.className = 'in-cfwrap'; d.innerHTML = h; $('.in-stage', root).appendChild(d); setTimeout(function () { d.remove(); }, 2600);
  }
  function scene(n, bg, html) {
    var st = $('.in-stage', root), prev = st.querySelector('.in-sc.on');
    if (prev) { prev.classList.remove('on'); prev.classList.add('off'); setTimeout(function () { prev.remove(); }, 500); }
    var d = document.createElement('div'); d.className = 'in-sc s' + n + ' on'; d.innerHTML = html; st.appendChild(d);
    root.style.setProperty('--ibg', bg);
  }

  function tiles() {
    var names = (SD.games || []).slice(0, 12).map(function (g) { return g.icon; }), h = '';
    while (names.length < 12) names.push('trophy');
    names.forEach(function (n, i) { h += '<div class="in-tile" style="animation-delay:' + (0.25 + i * 0.25).toFixed(2) + 's">' + art.icon(n, 56) + '</div>'; });
    return h;
  }
  function marquee(skins, dir) {
    var row = skins.map(function (s) { return face(s, 'cheer'); }).join('');
    return '<div class="in-row ' + dir + '"><div>' + row + row + '</div></div>';
  }

  function run() {
    var rev = [0, 1, 2, 3, 4, 5, 6, 7], more = [8, 9, 10, 11, 12, 13, 14, 15];
    /* 1: title */
    scene(1, 'linear-gradient(160deg,#ffe27a,#ff9ecf)', '<div class="in-title"><b class="t1">SILLY</b><b class="t2">DUEL</b></div>' + cap('WHO WINS THE TROPHY?', 'late'));
    sfx('boom'); at(350, function () { sfx('airhorn'); confetti(46); }); at(1500, function () { sfx('kazoo'); });
    /* 2: the bill */
    at(3000, function () {
      scene(2, 'linear-gradient(160deg,#bfe6ff,#d9c8ff)',
        '<div class="in-duo">' + face(1, 'idle', 'l') + '<div class="in-prize">' + art.icon('trophy', 90) + '</div>' + face(0, 'idle', 'r') + '</div>' + cap('TWO PLAYERS.<br>ONE TROPHY.', 'c1') + cap('WHO WINS?!', 'c2'));
      sfx('whoosh'); at(900, function () { sfx('ding'); }); at(1700, function () { sfx('gasp'); $$('.in-face', '.s2').forEach(function (f) { f.classList.add('worry'); f.innerHTML = art.face(0, 'worry', { skin: f.classList.contains('l') ? 1 : 0 }); }); });
    });
    /* 3: games montage */
    at(7500, function () {
      scene(3, 'linear-gradient(160deg,#c9f5cf,#fff3a8)', '<div class="in-grid">' + tiles() + '</div>' + cap('5 MINI GAMES!', 'top') + cap('TAP · HOLD · DODGE · STACK · FLAP', 'sub'));
      sfx('whoosh'); for (var i = 0; i < 12; i++) (function (k) { at(250 + k * 250, function () { sfx('blip', k); }); })(i);
      at(3500, function () { sfx('tada'); });
    });
    /* 4: the duel */
    at(12000, function () {
      scene(4, 'linear-gradient(160deg,#ffd0d8,#ffe9a8)',
        '<div class="in-score"><b>0</b><i>-</i><b>0</b></div><div class="in-duo">' + face(1, 'idle', 'l w') + '<div class="in-vs">VS</div>' + face(0, 'idle', 'r') + '</div>' + cap('PLAY 5 GAMES.', 'c1') + cap('MOST WINS TAKES THE TROPHY!', 'c2 sm') + '<div class="in-pie"></div><div class="in-prize stick">' + art.icon('trophy', 90) + '</div>');
      var sc = $$('.in-score b', '.s4'), l = $('.in-face.l', '.s4'), r = $('.in-face.r', '.s4');
      [[600, 1, 0], [1100, 1, 1], [1600, 2, 1], [2100, 2, 2], [2600, 3, 2]].forEach(function (a) { at(a[0], function () { var k = a[1] !== +sc[0].textContent ? 0 : 1; sc[0].textContent = a[1]; sc[1].textContent = a[2]; sc[k].classList.remove('bump'); void sc[k].offsetWidth; sc[k].classList.add('bump'); sfx(k ? 'roundLose' : 'roundWin'); }); });
      at(3200, function () { $('.in-pie', root).classList.add('go'); sfx('splat'); r.innerHTML = art.face(0, 'sad', { skin: 0 }); l.innerHTML = art.face(0, 'win', { skin: 1 }); l.classList.add('jump'); confetti(36); sfx('cheer'); });
      at(3700, function () { $('.in-prize.stick', root).classList.add('go'); sfx('tada'); });
    });
    /* 5: power-ups */
    at(16500, function () {
      var P = [['p_second', 'SECOND CHANCE'], ['p_lucky', 'LUCKY TIE'], ['p_double', 'DOUBLE POINT'], ['p_steal', 'STEALER']];
      scene(5, 'linear-gradient(160deg,#e3d2ff,#ffc9ec)', '<div class="in-fan">' + P.map(function (p, i) { return '<div class="in-card c' + i + '">' + art.icon(p[0], 64) + '<b>' + p[1] + '</b></div>'; }).join('') + '</div>' + cap('POWER-UPS!', 'top') + cap('PICK 3. USE 1 EACH GAME.', 'sub'));
      sfx('whoosh'); [0, 1, 2, 3].forEach(function (i) { at(400 + i * 350, function () { sfx('pop'); }); });
      at(2300, function () { $('.in-card.c2', root).classList.add('use'); sfx('perfect'); sfx('coin'); });
    });
    /* 6: collect */
    at(20500, function () {
      scene(6, 'linear-gradient(160deg,#a8e8ff,#ffe27a)', marquee(rev, 'a') + marquee(more, 'b') + cap('COLLECT 16 CREATURES', 'top') + cap('10 ARENAS · LEVEL UP · EARN COINS', 'sub'));
      sfx('whoosh'); at(500, function () { sfx('ding'); }); at(1700, function () { sfx('coin'); sfx('count'); });
    });
    /* 7: friends */
    at(24000, function () {
      var all = [0, 5, 9, 11, 13, 14, 1, 3];
      scene(7, 'linear-gradient(160deg,#ffcf9e,#ff9ecf)', CG ?
        '<div class="in-duo">' + face(1, 'cheer', 'l') + face(0, 'cheer', 'r') + '</div>' + cap('PLAY WITH A FRIEND', 'top') + cap('ON ONE PHONE. NO SETUP!', 'sub') :
        '<div class="in-ring">' + all.map(function (s, i) { return face(s, 'cheer', 'p' + i); }).join('') + '<div class="in-tr">' + art.icon('trophy', 80) + '</div></div>' + cap('PLAY WITH FRIENDS', 'top') + cap('ROOMS · BRACKETS · WINNER WINNER!', 'sub'));
      sfx('whoosh'); at(600, function () { sfx('tada'); confetti(30); }); at(1800, function () { sfx('cheer'); });
    });
    /* 8: ready */
    at(27000, function () {
      scene(8, 'linear-gradient(160deg,#ff7ab8,#ffb36b)', '<div class="in-ready"><b>READY?</b></div>' + cap('LET\'S PLAY!', 'c2 big'));
      sfx('airhorn'); at(300, function () { confetti(50); });
    });
    at(28800, finish);
  }
  function $$(s, p) { return Array.prototype.slice.call(document.querySelectorAll((p ? p + ' ' : '') + s)); }

  function seen() {
    try {
      if (SD.store && SD.store.extraGet && SD.store.extraGet('sd_intro')) return true;
      if (typeof localStorage !== 'undefined' && localStorage.getItem('sd_intro')) return true;
      if (SD.store && (SD.store.get('plays') | 0) > 0) return true;
    } catch (e) {}
    return false;
  }
  function markSeen() {
    try { if (SD.store && SD.store.extraSet) SD.store.extraSet('sd_intro', '1'); else localStorage.setItem('sd_intro', '1'); } catch (e) {}
  }

  function finish() {
    if (finished) return; finished = true; timers.forEach(clearTimeout); timers = [];
    if (root) { root.classList.add('out'); var r = root; setTimeout(function () { r.remove(); }, 500); }
    markSeen();
    if (cb) { var f = cb; cb = null; f(); }
  }

  SD.intro = {
    seen: seen,
    play: function (done) {
      if (seen()) { if (done) done(); return; }
      cb = done; finished = false;
      root = document.createElement('div'); root.id = 'intro';
      root.innerHTML = '<div class="in-bgshapes"></div><div class="in-stage"></div><div class="in-bar"><i></i></div><button type="button" class="in-skip">SKIP</button>';
      document.body.appendChild(root);
      $('.in-skip', root).addEventListener('click', function () { sfx('tap'); finish(); });
      window.addEventListener('keydown', function esc(e) { if (finished) { window.removeEventListener('keydown', esc); return; } if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') { e.preventDefault(); finish(); } });
      run();
    },
    stop: finish
  };
})();
