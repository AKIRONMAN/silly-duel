/* ZIGZAG (level 20 pack): tap to switch direction and stay on the road. Go as far as you can. */
(function () {
  'use strict';
  var INK = SD.art.INK, st = ' stroke="' + INK + '" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"';
  SD.art.addIcons({
    zig: '<path d="M10 58L10 40L34 28L34 14L54 4" fill="none" stroke="' + INK + '" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 58L10 40L34 28L34 14L54 4" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><circle cx="34" cy="28" r="7" fill="#ff7ab2"' + st + '/>',
    p_net: '<path d="M6 20Q32 60 58 20" fill="none"' + st + '/><path d="M6 20H58M14 33H50M22 45H42M20 20L26 49M32 20V53M44 20L38 49" fill="none" stroke="' + INK + '" stroke-width="3" stroke-linecap="round"/>'
  });
  SD.games.push({
    id: 'zig', pack: 2, title: 'ZIGZAG', tip: 'TAP TO TURN. STAY ON THE ROAD', icon: 'zig',
    start: function (A) {
      var P = A.players, G = {}, finished = false, hard = A.hard, t = 0, k;
      var stg = A.stage(P[0]), W0 = stg.clientWidth || 160, H0 = stg.clientHeight || 220, u = Math.min(W0, H0 * 0.7) / 100;
      var verts = [{ x: -40 * u, y: -40 * u, c: 0 }], x = 0, y = 0, dir = 1, ys = [], len;
      for (k = 0; k < 40; k++) { len = (36 - 14 * hard + A.rand() * (26 - 6 * hard)) * u; y += len; x += dir * len; dir = -dir; verts.push({ x: x, y: y, c: x }); }
      // verts: the road centre line has slope +1 / -1 between the points; first segment goes +x
      A.live(function (slot, id) { if (id === 'net' && G[slot]) G[slot].net = true; });
      function centre(yy) {
        var j = 1; while (j < verts.length - 1 && verts[j].y < yy) j++;
        var a = verts[j - 1], b = verts[j], s = (b.x - a.x) / (b.y - a.y); return a.x + s * (yy - a.y);
      }
      var HW = (13 - 4.5 * hard) * u;
      P.forEach(function (i) {
        var s = A.stage(i), W = s.clientWidth || W0, H = s.clientHeight || H0;
        s.innerHTML = '<div class="zg"><b class="zg-n">0</b><svg class="zg-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none"><polygon class="zg-road"/><polyline class="zg-mid"/></svg><div class="zg-ball"></div></div>';
        var ball = s.querySelector('.zg-ball'); ball.style.width = ball.style.height = (12 * u) + 'px'; ball.innerHTML = SD.art.face(i, 'idle');
        G[i] = { W: W, H: H, x: 0, y: 0, dir: 1, dead: false, net: A.power(i, 'net'), s: s, ball: ball, road: s.querySelector('.zg-road'), mid: s.querySelector('.zg-mid'), n: s.querySelector('.zg-n'), nextTurn: 1, fell: 0 };
      });
      function sp() { return (30 + 15 * hard + 1.1 * t) * u; }
      A.onDown(function (i) { var g = G[i]; if (g.dead || finished) return; g.dir = -g.dir; SD.audio.sfx.blip(4); });
      function draw(g) {
        var by = H0 * 0 + g.H * 0.72, pts = [], L = [], R = [], j;
        var y0 = g.y - g.H * 0.8, y1 = g.y + g.H * 0.35;
        function sx(wx) { return g.W / 2 + (wx - g.x); } function sy(wy) { return by - (wy - g.y); }
        var lo = [{ y: y0 }], hi = [];
        for (j = 0; j < verts.length; j++) if (verts[j].y > y0 && verts[j].y < y1) lo.push(verts[j]);
        lo.push({ y: y1 });
        lo.forEach(function (v) { var c = centre(v.y); L.push(sx(c - HW) + ',' + sy(v.y)); R.unshift(sx(c + HW) + ',' + sy(v.y)); });
        g.road.setAttribute('points', L.concat(R).join(' '));
      }
      var over = false;
      function done() { if (finished) return; finished = true; A.end(P.map(function (i) { return { p: G[i].y / u, label: Math.round(G[i].y / u) + ' M' }; })); }
      A.frame(function (dt) {
        t += dt;
        P.forEach(function (i) {
          var g = G[i]; if (g.dead) { if (g.fell) { g.fell += dt; g.ball.style.transform = 'translateY(' + (g.fell * 120) + 'px) scale(' + Math.max(0.1, 1 - g.fell) + ')'; } return; }
          var v = sp(); g.y += v * dt; g.x += g.dir * v * dt;
          var off = g.x - centre(g.y);
          if (Math.abs(off) > HW) {
            if (g.net) { g.net = false; g.x = centre(g.y); g.dir = verts.length ? Math.sign(centre(g.y + 3) - centre(g.y - 3)) || 1 : 1; A.used(i, 'net', 'SAVED!'); }
            else { g.dead = true; g.fell = 0.001; A.face(i, 'dizzy'); A.pop(i, 'AAAH!', 'bad'); SD.audio.sfx.fall(0.6); }
          }
          g.n.textContent = Math.round(g.y / u); draw(g);
        });
        (A.bots || []).forEach(function (b) {                       // the bot taps when the road turns, a little early or late
          var g = G[b]; if (!g || g.dead) return;
          var vt = verts[g.nextTurn]; if (!vt) return;
          g.lead = g.lead == null ? (A.rand() - 0.5) * 2 : g.lead;
          var tgt = vt.y - sp() * (0.02 + g.lead * (1 - A.skill) * 0.28);
          if (g.y >= tgt) { g.nextTurn++; g.lead = null; A.tap(b); }
        });
        if (!over && (P.every(function (j) { return G[j].dead && G[j].fell > 0.9; }) || t > 22)) { over = true; A.later(done, 400); }
      });
    }
  });
})();
