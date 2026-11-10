/* SKIP ROPE (level 20 pack): the rope swings faster and faster. Tap to jump at the right moment. */
(function () {
  'use strict';
  var INK = SD.art.INK, st = ' stroke="' + INK + '" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"';
  SD.art.addIcons({
    skip: '<path d="M8 40Q8 8 32 8Q56 8 56 40" fill="none" stroke="#ff7ab2" stroke-width="6" stroke-linecap="round"/><rect x="2" y="36" width="10" height="20" rx="4" fill="#ffd84d"' + st + '/><rect x="52" y="36" width="10" height="20" rx="4" fill="#ffd84d"' + st + '/>',
    p_slowrope: '<path d="M8 38Q8 8 32 8Q56 8 56 38" fill="none" stroke="#ff7ab2" stroke-width="6" stroke-linecap="round"/><circle cx="32" cy="42" r="14" fill="#fff"' + st + '/><path d="M32 42V34M32 42L38 46" fill="none"' + st + '/>'
  });
  var AIR = 0.42, N = 22;
  SD.games.push({
    id: 'skip', pack: 2, title: 'SKIP ROPE', tip: 'TAP TO JUMP OVER THE ROPE', icon: 'skip',
    start: function (A) {
      var P = A.players, G = {}, t0 = A.now(), finished = false, hard = A.hard, k;
      var base = [], tt = 1.5;                                          // when the rope hits the floor (shared pattern of gaps)
      for (k = 0; k < N; k++) { base.push(tt); tt += Math.max(0.64 - 0.1 * hard, 1.0 - 0.036 * k - 0.15 * hard) * (0.9 + A.rand() * 0.2); }
      P.forEach(function (i) {
        var m = A.power(i, 'slowrope') ? 1.25 : 1, hits = base.map(function (x) { return 1.5 + (x - 1.5) * m; });
        A.stage(i).innerHTML = '<div class="sr"><b class="sr-n">0</b><svg class="sr-rope" viewBox="0 0 100 100" preserveAspectRatio="none"><path class="sr-r" d=""/></svg><div class="sr-me"></div><div class="sr-floor"></div></div>';
        var me = A.stage(i).querySelector('.sr-me'); me.innerHTML = SD.art.face(i, 'idle');
        G[i] = { hits: hits, k: 0, cleared: 0, js: -9, dead: false, me: me, rope: A.stage(i).querySelector('.sr-r'), n: A.stage(i).querySelector('.sr-n'), air: false };
      });
      A.live(function (slot, id) { var g = G[slot]; if (id !== 'slowrope' || !g) return; var t = (A.now() - t0) / 1000; for (var j = g.k; j < g.hits.length; j++) g.hits[j] = t + (g.hits[j] - t) * 1.25; });
      function now() { return (A.now() - t0) / 1000; }
      A.onDown(function (i) {
        var g = G[i], t = now(); if (finished || g.dead || t < g.js + AIR) return;
        g.js = t; g.me.classList.add('jump'); SD.audio.sfx.toss();
        A.later(function () { g.me.classList.remove('jump'); }, AIR * 1000);
      });
      function done() { if (finished) return; finished = true; A.end(P.map(function (i) { return { p: G[i].cleared + (G[i].dead ? 0 : 0.5), label: G[i].cleared + ' JUMPS' }; })); }
      function rope(g, t) {                                              // phase 0 = rope on the floor, 0.5 = over the head
        var prev = g.k > 0 ? g.hits[g.k - 1] : g.hits[0] - 1.1, nxt = g.hits[Math.min(g.k, N - 1)], p = Math.max(0, Math.min(1, (t - prev) / (nxt - prev)));
        var h = (1 - Math.cos(6.2832 * (1 - p))) / 2, cy = 114 - h * 148;       // control point: from below the feet to high above the head
        g.rope.setAttribute('d', 'M8 62 Q50 ' + cy + ' 92 62');
      }
      A.frame(function () {
        var t = now(), alive = false;
        P.forEach(function (i) {
          var g = G[i]; if (g.dead) return;
          while (g.k < N && t > g.hits[g.k] + 0.02) {
            var ht = g.hits[g.k], safe = ht > g.js + 0.07 && ht < g.js + AIR - 0.07;
            if (safe) { g.cleared++; g.n.textContent = g.cleared; SD.audio.sfx.blip(3 + g.cleared); if (g.cleared % 5 === 0) A.pop(i, g.cleared + '!', 'ha'); }
            else { g.dead = true; g.me.classList.add('trip'); A.face(i, 'dizzy'); A.pop(i, 'TRIPPED!', 'bad'); SD.audio.sfx.bwoop(); SD.fx.vibrate(40); break; }
            g.k++;
          }
          if (!g.dead) { rope(g, t); if (g.k < N) alive = true; }
        });
        (A.bots || []).forEach(function (b) {
          var g = G[b]; if (!g || g.dead || g.k >= N) return;
          if (g.plan !== g.k) { g.plan = g.k; g.at = g.hits[g.k] - AIR * 0.5 + (A.rand() - 0.5) * 2 * (1 - A.skill) * 0.22; }
          if (t >= g.at && t >= g.js + AIR) { g.plan = -1; g.at = 1e9; A.tap(b); g.plan = g.k; }
        });
        if (!alive && !finished) A.later(done, 600);
      });
    }
  });
})();
