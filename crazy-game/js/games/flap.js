/* FLAPPY FACE: tap to flap. Fly through the gaps in the pipes. Crash and you are out.
   Most gaps passed wins. */
(function () {
  'use strict';
  var INK = SD.art.INK, st = ' stroke="' + INK + '" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"';
  SD.art.addIcons({
    flap: '<circle cx="30" cy="34" r="17" fill="#ffd84d"' + st + '/><circle cx="35" cy="30" r="4" fill="#fff"' + st.replace('4', '2.5') + '/><circle cx="36" cy="30" r="1.8" fill="' + INK + '"/><path d="M45 36L58 33L47 42Z" fill="#ff8c42"' + st.replace('4', '3') + '/><path d="M16 38Q8 28 14 22" fill="none"' + st + '/>'
  });
  var N = 8, GAP = 0.3, START = 1.6, EVERY = 1.3;
  SD.games.push({
    id: 'flap', title: 'FLAPPY FACE', tip: 'TAP TO FLAP. FLY THROUGH THE GAPS', icon: 'flap',
    start: function (A) {
      var P = A.players, G = {}, t = 0, finished = false, pipes = [], k;
      var EV = EVERY * (1 - 0.22 * A.hard), GP = GAP * (1 - 0.3 * A.hard);
      for (k = 0; k < N; k++) pipes.push({ ta: START + k * EV, c: 0.27 + A.rand() * 0.46 });
      P.forEach(function (i) {
        var stage = A.stage(i);
        stage.innerHTML = '<div class="fl"><b class="fl-n">0</b><div class="fl-box"><div class="fl-ground"></div></div></div>';
        var box = stage.querySelector('.fl-box'), W = box.clientWidth, H = box.clientHeight, R = Math.max(10, Math.min(W * 0.075, 18)), gap = H * GP * (A.power(i, 'gap') ? 1.35 : 1);
        var g = G[i] = { box: box, W: W, H: H, R: R, gap: gap, y: H * 0.5, vy: 0, passed: 0, dead: false, els: [], cool: 0, aim: 0, dieAt: 0 };
        var bird = document.createElement('div'); bird.className = 'fl-bird'; bird.style.width = bird.style.height = (R * 2.4) + 'px'; bird.innerHTML = SD.art.face(i, 'idle'); box.appendChild(bird); g.bird = bird;
        pipes.forEach(function (p) {
          var top = document.createElement('div'), bot = document.createElement('div'); top.className = bot.className = 'fl-pipe';
          var cy = p.c * H; top.style.height = Math.max(0, cy - gap / 2) + 'px'; top.style.top = '-3px';
          bot.style.top = (cy + gap / 2) + 'px'; bot.style.height = Math.max(0, H - cy - gap / 2) + 'px';
          top.style.width = bot.style.width = (W * 0.17) + 'px'; top.style.display = bot.style.display = 'none';
          box.appendChild(top); box.appendChild(bot); g.els.push([top, bot]);
        });
      });
      A.live(function (slot, id) {
        var g = G[slot]; if (id !== 'gap' || !g) return; g.gap *= 1.35;
        g.els.forEach(function (pr, k) { var cy = pipes[k].c * g.H; pr[0].style.height = Math.max(0, cy - g.gap / 2) + 'px'; pr[1].style.top = (cy + g.gap / 2) + 'px'; pr[1].style.height = Math.max(0, g.H - cy - g.gap / 2) + 'px'; });
      });
      function px(g, p) { return g.W * 0.3 + (p.ta - t) * g.W * 0.6; }
      function flap(i) { var g = G[i]; if (g.dead || finished) return; g.vy = -g.H * 0.78; SD.audio.sfx.tap(); }
      A.onDown(flap);
      function die(i) {
        var g = G[i]; g.dead = true; g.dieAt = t; g.bird.classList.add('dead'); A.face(i, 'dizzy'); A.pop(i, 'CRASH!', 'bad'); SD.audio.sfx.bwoop(); SD.fx.vibrate([40, 30, 50]);
        if (P.every(function (j) { return G[j].dead; })) A.later(done, 800);
      }
      function done() {
        if (finished) return; finished = true;
        A.end(P.map(function (i) { var g = G[i]; return { p: g.passed + (g.dieAt ? g.dieAt : t) * 0.001, label: g.passed + ' GAPS' }; }));
      }
      A.frame(function (dt) {
        t += dt;
        P.forEach(function (i) {
          var g = G[i];
          if (!g.dead) {
            if ((A.bots || []).indexOf(i) >= 0) {                                      // bot: flaps when it sinks below the middle of the next gap
              g.cool -= dt;
              var np = null; for (var q = 0; q < N; q++) if (px(g, pipes[q]) + g.W * 0.1 > g.W * 0.3 - g.R) { np = q; break; }
              if (np !== g.np) { g.np = np; g.aim = (A.rand() - 0.5) * (1 - A.skill) * g.H * 0.22; }
              var target = (np == null ? 0.5 : pipes[np].c) * g.H + g.H * 0.05 + g.aim;
              if (g.cool <= 0 && g.y > target && g.vy > -g.H * 0.1) { g.cool = 0.2; A.tap(i); }
            }
            g.vy += g.H * 2.9 * dt; g.y += g.vy * dt;
            if (g.y < g.R) { g.y = g.R; g.vy = 0; }
            if (g.y > g.H - g.R) { g.y = g.H - g.R; return die(i); }
            for (var k2 = 0; k2 < N; k2++) {
              var p = pipes[k2], x = px(g, p), hw = g.W * 0.085, cy = p.c * g.H;
              if (x + hw < g.W * 0.3 - g.R * 1.2 && !p.done) { p.done = p.done || {}; }
              if (Math.abs(x - g.W * 0.3) < hw + g.R * 0.8 && Math.abs(g.y - cy) > g.gap / 2 - g.R * 0.8) return die(i);
              if (x + hw < g.W * 0.3 - g.R * 0.8 && !g['p' + k2]) { g['p' + k2] = 1; g.passed++; g.box.parentNode.querySelector('.fl-n').textContent = g.passed; SD.audio.sfx.coin(); A.face(i, 'cheer'); A.later(function () { if (!g.dead) A.face(i, 'idle'); }, 250); }
            }
          } else g.y = Math.min(g.H - g.R, g.y + g.H * 0.9 * dt);
          g.bird.style.transform = 'translate(' + (g.W * 0.3 - g.R * 1.2) + 'px,' + (g.y - g.R * 1.2) + 'px) rotate(' + Math.max(-25, Math.min(60, g.vy / g.H * 40)) + 'deg)';
          pipes.forEach(function (p, q) {
            var x = px(g, p) - g.W * 0.085, on = x > -g.W * 0.2 && x < g.W * 1.05;
            g.els[q][0].style.display = g.els[q][1].style.display = on ? '' : 'none';
            if (on) g.els[q][0].style.transform = g.els[q][1].style.transform = 'translateX(' + x + 'px)';
          });
        });
        if (t > START + N * EV + 0.5) done();
      });
    }
  });
})();
