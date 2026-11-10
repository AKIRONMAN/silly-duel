/* LILY HOP: hold to charge the frog, let go to jump to the next lily pad. The red dot shows where you
   would land. Miss and you splash and lose time. Most pads wins. */
(function () {
  'use strict';
  var INK = SD.art.INK, st = ' stroke="' + INK + '" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"';
  SD.art.addIcons({
    lily: '<ellipse cx="32" cy="44" rx="26" ry="11" fill="#4fd18b"' + st + '/><circle cx="32" cy="24" r="14" fill="#a8e86b"' + st + '/><circle cx="26" cy="20" r="4.5" fill="#fff"' + st.replace('4', '2.5') + '/><circle cx="38" cy="20" r="4.5" fill="#fff"' + st.replace('4', '2.5') + '/><circle cx="26" cy="20" r="1.8" fill="' + INK + '"/><circle cx="38" cy="20" r="1.8" fill="' + INK + '"/>'
  });
  var DUR = 16000, FULL = 1.0;
  SD.games.push({
    id: 'hop', title: 'LILY HOP', tip: 'HOLD TO CHARGE. LET GO TO JUMP', icon: 'lily',
    start: function (A) {
      var P = A.players, G = {}, finished = false, t = 0, dist = [], k;
      for (k = 0; k < 14; k++) dist.push((0.26 + A.rand() * 0.2) * (1 + 0.25 * A.hard));               // distance to the next pad, in screen widths
      P.forEach(function (i) {
        var stage = A.stage(i);
        stage.innerHTML = '<div class="hp"><b class="hp-n">0</b><div class="hp-box"><div class="hp-world"></div><div class="hp-bar"><i></i></div></div></div>';
        var box = stage.querySelector('.hp-box'), W = box.clientWidth, H = box.clientHeight, world = box.querySelector('.hp-world'), fs = Math.max(30, Math.min(W * 0.17, H * 0.2));
        var wide = A.power(i, 'pads') ? 1.4 : 1, cx = [0], pads = [];
        for (k = 0; k < 14; k++) cx.push(cx[k] + dist[k] * W);
        for (k = 0; k <= 14; k++) {
          var hw = Math.max(0.04, 0.105 - k * 0.0045) * (1 - 0.35 * A.hard) * W * wide, el = document.createElement('div'); el.className = 'hp-pad';
          el.style.left = (cx[k] - hw) + 'px'; el.style.width = (hw * 2) + 'px'; world.appendChild(el); pads.push(hw);
        }
        var mark = document.createElement('div'); mark.className = 'hp-mark'; world.appendChild(mark);
        var frog = document.createElement('div'); frog.className = 'hp-frog'; frog.style.width = frog.style.height = fs + 'px'; frog.innerHTML = SD.art.face(i, 'idle'); world.appendChild(frog);
        G[i] = { W: W, H: H, world: world, frog: frog, mark: mark, bar: box.querySelector('.hp-bar i'), fs: fs, cx: cx, hw: pads, k: 0, fx: 0, ph: 'idle', held: 0, from: 0, L: 0, u: 0, dur: 0, wait: 0, score: 0, lastAt: 0, bw: 0.4 + A.rand() * 0.5 };
      });
      A.live(function (slot, id) {
        var g = G[slot]; if (id !== 'pads' || !g) return;
        Array.prototype.forEach.call(g.world.querySelectorAll('.hp-pad'), function (el, k) { if (k < g.k) return; var o = g.hw[k]; g.hw[k] = o * 1.4; el.style.left = (g.cx[k] - g.hw[k]) + 'px'; el.style.width = (g.hw[k] * 2) + 'px'; });
      });
      function reach(g, c) { return (0.08 + 0.52 * c) * g.W; }
      function draw(g, y) {
        var gy = g.H * 0.55 - g.fs * 0.82 - y;
        g.frog.style.transform = 'translate(' + (g.fx - g.fs / 2) + 'px,' + gy + 'px)';
        g.world.style.transform = 'translateX(' + (g.W * 0.2 - g.fx) + 'px)';
      }
      A.onDown(function (i) { var g = G[i]; if (g.ph !== 'idle' || finished) return; g.ph = 'charge'; g.held = 0; SD.audio.sfx.tap(); });
      A.onUp(function (i) {
        var g = G[i]; if (g.ph !== 'charge') return;
        var c = Math.min(1, g.held / FULL); g.L = reach(g, c); g.from = g.fx; g.ph = 'fly'; g.u = 0; g.dur = 0.3 + 0.25 * c;
        g.mark.style.display = 'none'; g.bar.style.width = '0%'; SD.audio.sfx.boing();
      });
      function land(i) {
        var g = G[i], x = g.from + g.L, nk = g.k + 1;
        if (Math.abs(x - g.cx[nk]) <= g.hw[nk] + g.fs * 0.1 && nk <= 14) {
          g.k = nk; g.fx = x; g.score++; g.lastAt = t; g.ph = 'idle';
          g.frog.parentNode.parentNode.parentNode.querySelector('.hp-n').textContent = g.score;
          A.face(i, 'cheer'); A.later(function () { A.face(i, 'idle'); }, 300); SD.audio.sfx.coin();
          if (Math.abs(x - g.cx[nk]) < g.hw[nk] * 0.3) A.pop(i, 'PERFECT', 'ha');
        } else if (Math.abs(x - g.cx[g.k]) <= g.hw[g.k]) { g.fx = x; g.ph = 'idle'; }            // a tiny hop: still on the same pad
        else { g.ph = 'splash'; g.wait = 1.1; g.fx = x; g.frog.classList.add('splash'); A.face(i, 'dizzy'); A.pop(i, 'SPLASH!', 'bad'); SD.audio.sfx.splat && SD.audio.sfx.pop(); }
      }
      function done() {
        if (finished) return; finished = true;
        A.end(P.map(function (i) { var g = G[i]; return { p: g.score - g.lastAt * 0.001, label: g.score + ' PADS' }; }));
      }
      A.frame(function (dt) {
        t += dt;
        P.forEach(function (i) {
          var g = G[i], y = 0;
          if ((A.bots || []).indexOf(i) >= 0 && g.ph === 'idle') {                  // bot: charges for about the right time
            g.wait -= dt;
            if (g.wait <= 0) {
              var need = ((g.cx[g.k + 1] - g.fx) / g.W - 0.08) / 0.52, c = Math.max(0.05, Math.min(1, need + (A.rand() - 0.5) * (1 - A.skill) * 0.4));
              g.wait = FULL * c + 0.55 + A.rand() * 0.3; A.press(i); A.later(function () { A.release(i); }, c * FULL * 1000);
            }
          }
          if (g.ph === 'charge') {
            g.held += dt; var c = Math.min(1, g.held / FULL);
            g.mark.style.display = 'block'; g.mark.style.left = (g.fx + reach(g, c)) + 'px'; g.bar.style.width = (c * 100) + '%';
          } else if (g.ph === 'fly') {
            g.u += dt / g.dur; var u = Math.min(1, g.u); g.fx = g.from + g.L * u; y = Math.sin(Math.PI * u) * g.H * 0.28;
            if (u >= 1) land(i);
          } else if (g.ph === 'splash') {
            y = -g.H * 0.05; g.wait -= dt;
            if (g.wait <= 0) { g.fx = g.cx[g.k]; g.ph = 'idle'; g.frog.classList.remove('splash'); A.face(i, 'idle'); g.wait = 0; }
          }
          draw(g, y);
        });
      });
      A.timer(DUR, done);
    }
  });
})();
