/* TIGHTROPE: walk the rope. Hold to lean right, let go to lean left. The wind pushes, and the more
   you lean, the faster you fall. Stay up the longest. */
(function () {
  'use strict';
  var INK = SD.art.INK, st = ' stroke="' + INK + '" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"';
  SD.art.addIcons({
    balance: '<path d="M4 50H60" fill="none"' + st + '/><circle cx="32" cy="18" r="9" fill="#ffd84d"' + st + '/><path d="M32 27V46M10 34H54" fill="none"' + st + '/><circle cx="10" cy="34" r="4" fill="#ff7ab2"' + st + '/><circle cx="54" cy="34" r="4" fill="#ff7ab2"' + st + '/>'
  });
  var K = 5, F = 3.2, C = 1.2, DUR = 12;
  SD.games.push({
    id: 'balance', title: 'TIGHTROPE', tip: 'HOLD = LEAN RIGHT. LET GO = LEAN LEFT', icon: 'balance',
    start: function (A) {
      var P = A.players, G = {}, t = 0, finished = false, over = false;
      var WS = 2.6 * (1 + 0.5 * A.hard), a1 = WS * (0.6 + A.rand() * 0.4), w1 = 1.2 + A.rand() * 1.2, p1 = A.rand() * 6, a2 = WS * (0.3 + A.rand() * 0.3), w2 = 2.6 + A.rand() * 1.6, p2 = A.rand() * 6;
      P.forEach(function (i) {
        G[i] = { x: 0, v: 0, held: false, dead: false, tt: 0, sum: 0, lim: A.power(i, 'pole') ? 1.5 : 1, nz: 0, nt: 0, dec: 0, bu: -1 };
        A.stage(i).innerHTML = '<div class="bl"><b class="bl-t">0.0</b><div class="bl-sky"><div class="bl-man"><span class="bl-pole"></span><span class="bl-head"></span></div></div><div class="bl-rope"><i class="bl-l"></i><i class="bl-r"></i></div></div>';
      });
      A.live(function (slot, id) { if (id === 'pole' && G[slot]) G[slot].lim = 1.5; });
      function man(i) { return A.stage(i).querySelector('.bl-man'); }
      function done() {
        if (finished) return; finished = true;
        A.end(P.map(function (i) { var g = G[i], full = !g.dead; return { p: g.tt + (full ? 1 - Math.min(1, g.sum / Math.max(0.1, g.tt)) : 0), label: g.tt.toFixed(1) + 's' }; }));
      }
      A.onDown(function (i) { G[i].held = true; });
      A.onUp(function (i) { G[i].held = false; });
      A.frame(function (dt) {
        t += dt;
        var wind = a1 * Math.sin(w1 * t + p1) + a2 * Math.sin(w2 * t + p2), alive = false;
        P.forEach(function (i) {
          var g = G[i]; if (g.dead) return;
          if ((A.bots || []).indexOf(i) >= 0) {                                    // bot: steers back to the middle, sloppier when less skilled
            g.nt -= dt; if (g.nt <= 0) { g.nz = (A.rand() - 0.5) * (1 - A.skill) * 0.9; g.nt = 0.15; }
            g.dec -= dt;
            if (g.dec <= 0) { g.dec = 0.05 + (1 - A.skill) * 0.12; var want = (g.x + 0.45 * g.v + g.nz) < 0; if (want !== g.held) { g.held = want; if (want) A.press(i); else A.release(i); } }
          }
          g.v += (K * g.x + wind + (g.held ? F : -F) - C * g.v) * dt; g.x += g.v * dt; g.tt += dt; g.sum += Math.abs(g.x) * dt;
          var m = man(i); m.style.transform = 'translateX(' + (g.x / g.lim * 38) + 'cqw) rotate(' + (g.x * 28) + 'deg)';
          A.stage(i).querySelector('.bl-t').textContent = g.tt.toFixed(1);
          if (Math.abs(g.x) > g.lim) {
            g.dead = true; m.classList.add('fall'); A.face(i, 'dizzy'); A.pop(i, 'AAAH!', 'bad'); SD.audio.sfx.fall(0.6);
          } else alive = true;
        });
        if (!over && (!alive || t >= DUR)) { over = true; A.later(done, 700); }
      });
    }
  });
})();
