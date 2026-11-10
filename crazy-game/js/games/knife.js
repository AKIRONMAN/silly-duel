/* KNIFE LOG (level 20 pack): throw knives into the spinning log. Hit a knife that is already stuck and you are out. */
(function () {
  'use strict';
  var INK = SD.art.INK, st = ' stroke="' + INK + '" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"';
  SD.art.addIcons({
    knife: '<circle cx="32" cy="36" r="17" fill="#d9a066"' + st + '/><path d="M32 4V26" fill="none"' + st + '/><path d="M26 4H38" fill="none"' + st + '/><path d="M18 36A14 14 0 0 1 32 22" fill="none" stroke="#b9783f" stroke-width="3" stroke-linecap="round"/>',
    p_slowlog: '<circle cx="32" cy="32" r="22" fill="#d9a066"' + st + '/><path d="M32 32V18M32 32L42 38" fill="none"' + st + '/><path d="M8 8L16 14" fill="none" stroke="#6fcfff" stroke-width="5" stroke-linecap="round"/>'
  });
  var KN = 7, SEP = 11, FLIGHT = 0.12;
  SD.games.push({
    id: 'knife', pack: 2, title: 'KNIFE LOG', tip: 'TAP TO THROW. NEVER HIT A KNIFE!', icon: 'knife',
    start: function (A) {
      var P = A.players, G = {}, t0 = A.now(), finished = false, hard = A.hard;
      var T1 = 3.2 - hard * 1.2, ph = A.rand() * 6.28, S0 = 95 + 85 * hard;                    // log speed: deg/s
      A.live(function (slot, id) { if (id === 'slowlog' && G[slot]) G[slot].m = 0.65; });
      function rotAt(t, m) { return m * S0 * (0.5 * t - 0.9 * T1 / 6.2832 * Math.cos(6.2832 * t / T1 + ph)); }
      function now() { return (A.now() - t0) / 1000; }
      var pre = 2 + Math.round(hard * 2), base = [];
      for (var k = 0; k < pre; k++) base.push((k * 360 / pre + A.rand() * 40) % 360);
      P.forEach(function (i) {
        G[i] = { m: A.power(i, 'slowlog') ? 0.65 : 1, stuck: base.slice(), thrown: 0, dead: false, cool: 0, left: KN };
        A.stage(i).innerHTML = '<div class="kn"><b class="kn-n">' + KN + '</b><div class="kn-log"><div class="kn-core"></div></div><div class="kn-hand"></div></div>';
        G[i].log = A.stage(i).querySelector('.kn-log'); G[i].hand = A.stage(i).querySelector('.kn-hand');
        G[i].stuck.forEach(function (a) { add(i, a); });
      });
      function add(i, a) {
        var el = document.createElement('i'); el.className = 'kn-k'; el.style.transform = 'rotate(' + a + 'deg)'; G[i].log.appendChild(el); return el;
      }
      function dist(a, b) { var d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; }
      function throwKnife(i) {
        var g = G[i]; if (finished || g.dead || g.left <= 0 || now() < g.cool) return;
        g.cool = now() + 0.2; g.left--; SD.audio.sfx.toss();
        A.stage(i).querySelector('.kn-n').textContent = g.left;
        var fly = document.createElement('i'); fly.className = 'kn-fly'; A.stage(i).querySelector('.kn').appendChild(fly);
        requestAnimationFrame(function () { fly.classList.add('go'); });
        A.later(function () {
          fly.remove(); if (finished || g.dead) return;
          var local = ((-rotAt(now(), g.m)) % 360 + 360) % 360, hit = g.stuck.some(function (a) { return dist(a, local) < SEP; });  // impact is at the bottom of the log
          if (hit) {
            g.dead = true; g.log.classList.add('bad'); A.face(i, 'dizzy'); A.pop(i, 'CLANG!', 'bad'); SD.audio.sfx.bwoop(); SD.fx.vibrate(40); check(); return;
          }
          g.stuck.push(local); add(i, local); g.thrown++; SD.audio.sfx.tap(); A.pop(i, '' + g.thrown, 'ha');
          if (g.thrown >= KN) { A.pop(i, 'CLEAN!', 'ha'); g.done = true; check(); }
        }, FLIGHT * 1000);
      }
      A.onDown(function (i) { throwKnife(i); });
      function score(i) { return G[i].thrown + (G[i].dead ? 0 : 0.5) + (G[i].done ? 1 : 0); }
      function done() { if (finished) return; finished = true; A.end(P.map(function (i) { return { p: score(i), label: G[i].thrown + ' KNIVES' }; })); }
      function check() { if (P.every(function (j) { return G[j].dead || G[j].done || G[j].left <= 0 && false; })) A.later(done, 700); }
      A.frame(function () {
        var t = now();
        P.forEach(function (i) { var g = G[i]; g.log.style.transform = 'rotate(' + rotAt(t, g.m) + 'deg)'; });
        (A.bots || []).forEach(function (b) {
          var g = G[b]; if (!g || g.dead || g.left <= 0 || t < g.cool) return;
          var local = ((-rotAt(t + FLIGHT, g.m)) % 360 + 360) % 360, margin = SEP + 3 + (1 - A.skill) * 26 * A.rand();
          var ok = g.stuck.every(function (a) { return dist(a, local) > margin; });
          if (ok && (A.rand() < 0.35 + A.skill * 0.5)) A.tap(b);
        });
        if (t > 22) done();
      });
      // everyone out of knives or dead: finish a moment later
      A.later(function loop() { if (finished) return; if (P.every(function (j) { return G[j].dead || G[j].done || G[j].left <= 0; })) { A.later(done, 900); return; } A.later(loop, 300); }, 2000);
    }
  });
})();
