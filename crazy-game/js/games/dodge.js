/* DODGE!: pies fall from the sky. Tap to hop aside at the last moment.
   A shadow on the ground shows where each pie will land. Fewest hops with most dodges wins. */
(function () {
  'use strict';
  var STEP = 0.36, COOL = 0.22;

  SD.games.push({
    id: 'dodge', title: 'DODGE!', tip: 'TAP TO HOP ASIDE', icon: 'pie',
    start: function (A) {
      var P = A.players, sched = [], t = 1.0, k, G = {};
      for (k = 0; k < 8; k++) { sched.push({ t: t, d: Math.max(0.45, 0.98 - k * 0.05) * (1 - 0.3 * A.hard) }); t += 1.0 + A.rand() * 0.4; }
      sched.push({ t: sched[7].t + 0.55, d: 0.62 });                     // surprise double pie at the end
      var N = sched.length, t0 = A.now();

      P.forEach(function (i) {
        var stage = A.stage(i), W = stage.clientWidth, H = stage.clientHeight;
        var m = Math.min(W * 0.44, H * 0.3), pw = m * 0.8, base = H * 0.05, laneX = W * 0.3, sideX = W * 0.72;
        var html = '<div class="dg"><div class="dg-me" style="width:' + m + 'px;bottom:' + base + 'px">' + SD.art.face(i, 'worry') + '</div>';
        for (var q = 0; q < N; q++) {
          html += '<div class="dg-shadow" style="width:' + m + 'px;height:' + (m * 0.22) + 'px;left:' + (laneX - m / 2) + 'px;top:' + (H - base - m * 0.1) + 'px"></div>' +
            '<div class="dg-pie" style="width:' + pw + 'px">' + SD.art.icon('pie') + '</div>';
        }
        stage.innerHTML = html + '</div>';
        var me = stage.querySelector('.dg-me');
        if (A.power(i, 'umbrella')) me.insertAdjacentHTML('beforeend', '<span class="dg-umb">' + SD.art.icon('p_umbrella') + '</span>');          // power-up: the umbrella you can see over your head
        G[i] = {
          stage: stage, W: W, H: H, m: m, pw: pw, laneX: laneX, sideX: sideX, me: me,
          pies: stage.querySelectorAll('.dg-pie'), sh: stage.querySelectorAll('.dg-shadow'),
          yEnd: (H - base - m) + m * 0.3 - pw * 0.75, res: [], dodged: 0, hits: 0, steps: 0, stepUntil: -1, stepping: false
        };
        me.style.transform = 'translate(' + (laneX - m / 2) + 'px,0)';
      });

      function now() { return (A.now() - t0) / 1000; }

      A.onDown(function (i) {
        var g = G[i], n = now();
        if (n < g.stepUntil + COOL * (1 + 0.9 * A.hard)) return;
        g.stepUntil = n + STEP; g.stepping = true; g.steps++;
        g.me.style.transform = 'translate(' + (g.sideX - g.m / 2) + 'px,0)';
        SD.audio.sfx.toss();
      });

      sched.forEach(function (s) { A.later(function () { SD.audio.sfx.fall(s.d); }, s.t * 1000); });

      var umb = {};
      function resolve(i, k) {
        var g = G[i], c;
        if (now() >= g.stepUntil && A.power(i, 'umbrella') && !umb[i]) { umb[i] = true; g.res[k] = 'dodge'; g.dodged++; A.used(i, 'umbrella', 'BLOCKED!'); var um = g.me.querySelector('.dg-umb'); if (um) um.classList.add('flip'); return; }
        if (now() < g.stepUntil) {
          g.res[k] = 'dodge'; g.dodged++;
          SD.audio.sfx.blip(6 + g.dodged * 2);
          A.pop(i, '+1', 'ha');
        } else {
          g.res[k] = 'hit'; g.hits++;
          g.pies[k].style.display = 'none';
          g.me.innerHTML = SD.art.face(i, 'pied');
          A.later(function () { g.me.innerHTML = SD.art.face(i, 'worry'); }, 550);
          c = SD.fx.center(g.me);
          SD.fx.cream(c.x, c.y, 14); SD.audio.sfx.splat(); SD.fx.vibrate(30);
          A.face(i, 'sad'); A.later(function () { A.face(i, 'idle'); }, 600);
        }
      }

      A.frame(function () {
        var n = now();
        P.forEach(function (i) {
          var g = G[i];
          if (g.stepping && n >= g.stepUntil) { g.stepping = false; g.me.style.transform = 'translate(' + (g.laneX - g.m / 2) + 'px,0)'; }
          for (var q = 0; q < N; q++) {
            var s = sched[q], tau = (n - s.t) / s.d;
            if (tau < 0 || g.res[q] === 'hit') continue;
            var pie = g.pies[q], y = -g.pw + (g.yEnd + g.pw) * tau;
            if (y > g.H) { pie.style.display = 'none'; continue; }
            pie.style.display = 'block';
            pie.style.transform = 'translate(' + (g.laneX - g.pw / 2) + 'px,' + y + 'px)';
            if (tau < 1) { g.sh[q].style.display = 'block'; g.sh[q].style.transform = 'scale(' + (0.3 + 0.7 * tau) + ')'; }
            else g.sh[q].style.display = 'none';
            if (tau >= 1 && !g.res[q]) resolve(i, q);
          }
        });
      });

      /* bot: hops just before each pie lands; misses some when less skilled */
      (A.bots || []).forEach(function (b) {
        sched.forEach(function (s) {
          if (A.rand() < (1 - A.skill) * 0.4) return;
          var at = s.t + s.d - STEP * (0.2 + A.rand() * 0.5);
          A.later(function () { A.tap(b); }, at * 1000);
        });
      });

      var last = sched[N - 1];
      A.later(function () {
        A.end(P.map(function (i) { return { p: G[i].dodged - G[i].steps * 0.01, label: G[i].dodged + '/' + N }; }));
      }, (last.t + last.d + 0.85) * 1000);
    }
  });
})();
