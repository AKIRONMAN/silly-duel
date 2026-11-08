/* BOSS GAMES: very hard, one player, played on a single big pad.
   Beat one at level 10, 20 ... 80 to win a new skin. A.tier (1 to 8) makes each one harder.
   Three games repeat with rising difficulty: TIGHT BEAT, STOP THE BAR, PIE STORM. */
(function () {
  'use strict';
  SD.bosses = SD.bosses || [];
  var off = null;                                   // removes keyboard / pointer listeners of the running boss

  function pips(n, used) {
    var h = '';
    for (var k = 0; k < n; k++) h += '<i' + (k < used ? ' class="x"' : '') + '></i>';
    return h;
  }
  function hudHtml(label, n, used) { return '<div class="bs-hud"><span>' + label + '</span><b class="bs-pips">' + pips(n, used) + '</b></div>'; }
  function setPips(A, n, used) { var e = A.stage(0).querySelector('.bs-pips'); if (e) e.innerHTML = pips(n, used); }
  function cleanup() { if (off) { off(); off = null; } }

  /* ---------- 1. TIGHT BEAT: like Beat Pop, but a tiny hit window and almost no mistakes ---------- */
  SD.bosses.push({
    id: 'bossbeat', title: 'BOSS: TIGHT BEAT', tip: 'ALMOST NO MISTAKES', icon: 'note', cleanup: cleanup,
    start: function (A) {
      var T = A.tier, N = 10 + Math.ceil(T / 2), unit = 0.22 - 0.008 * T, W = 0.15 - 0.006 * T, allow = T < 4 ? 3 : T < 7 ? 2 : 1;
      var FALL = 1.0, steps = [2, 2, 3, 2, 4, 3], notes = [], t = 1.6, k, fails = 0, hits = 0, done = false, judged = [];
      for (k = 0; k < N; k++) { notes.push(t); t += unit * steps[Math.floor(Math.random() * steps.length)]; }
      var t0 = A.now(), stage = A.stage(0);
      stage.innerHTML = '<div class="bp"><div class="bp-lane"><span class="bp-ring"></span></div></div>' + hudHtml('MISS', allow + 1, 0);
      var lane = stage.querySelector('.bp-lane'), Hl = lane.clientHeight, ns = Math.min(lane.clientWidth * 0.64, 42);
      var ringY = Hl * 0.84, ring = lane.querySelector('.bp-ring'), els = [];
      ring.style.top = ringY + 'px'; ring.style.width = (ns + 12) + 'px';
      for (k = 0; k < N; k++) {
        var e = document.createElement('span');
        e.className = 'bp-note'; e.style.width = e.style.height = ns + 'px'; e.style.display = 'none';
        lane.appendChild(e); els.push(e);
      }
      function now() { return (A.now() - t0) / 1000; }
      function fail(msg) {
        if (done) return;
        fails++; setPips(A, allow + 1, fails);
        A.pop(0, msg, 'bad'); SD.audio.sfx.bwoop(); A.face(0, 'worry');
        if (fails > allow) { done = true; A.later(function () { A.end([{ p: 0, label: 'FAILED' }]); }, 600); }
      }
      notes.forEach(function (tn) { A.later(function () { SD.audio.sfx.kick(); }, tn * 1000); });

      A.onDown(function () {
        if (done) return;
        var n = now(), best = -1, bd = 9, q;
        for (q = 0; q < N; q++) {
          if (judged[q]) continue;
          var d = Math.abs(n - notes[q]);
          if (d <= W && d < bd) { bd = d; best = q; }
        }
        ring.classList.remove('flash'); void ring.offsetWidth;
        if (best < 0) { ring.classList.add('flash'); fail('STRAY'); return; }
        judged[best] = 'hit'; hits++; els[best].style.display = 'none';
        A.pop(0, bd < W * 0.4 ? 'PERFECT' : 'OK', 'ha');
        SD.audio.sfx.perfect(); A.face(0, 'cheer'); A.later(function () { A.face(0, 'idle'); }, 220);
      });

      A.frame(function () {
        var n = now();
        for (var q = 0; q < N; q++) {
          var el = els[q], dt = notes[q] - n;
          if (judged[q] === 'hit') continue;
          if (dt > FALL || dt < -0.5) { el.style.display = 'none'; continue; }
          if (dt < -W && !judged[q]) { judged[q] = 'miss'; el.style.opacity = '.35'; fail('MISS'); }
          el.style.display = 'block';
          el.style.transform = 'translate(-50%,' + (ringY - (dt / FALL) * ringY - ns / 2) + 'px)';
        }
      });
      A.later(function () {
        if (done) return; done = true;
        A.end([{ p: fails <= allow ? 1 : 0, label: fails <= allow ? 'CLEAR!' : 'FAILED' }]);
      }, (notes[N - 1] + 0.9) * 1000);
    }
  });

  /* ---------- 2. STOP THE BAR: stop the marker inside a shrinking zone, again and again ---------- */
  SD.bosses.push({
    id: 'bossbar', title: 'BOSS: STOP THE BAR', tip: 'HIT THE GREEN ZONE', icon: 'clock', cleanup: cleanup,
    start: function (A) {
      var T = A.tier, R = 5, allow = 2, zone = 0.17 - 0.006 * (T - 1), speed = 1.1 + 0.07 * (T - 1);
      var hits = 0, fails = 0, ph = 0, center, done = false, stage = A.stage(0);
      stage.innerHTML = '<div class="bb"><div class="bb-count">0/' + R + '</div><div class="bb-track"><span class="bb-zone"></span><span class="bb-mark"></span></div></div>' + hudHtml('MISS', allow + 1, 0);
      var zoneEl = stage.querySelector('.bb-zone'), mark = stage.querySelector('.bb-mark'), cnt = stage.querySelector('.bb-count');
      function newZone() {
        var prev = center, c;
        do { c = zone / 2 + 0.03 + Math.random() * (1 - zone - 0.06); } while (prev != null && Math.abs(c - prev) < 0.22);
        center = c;
        zoneEl.style.left = ((c - zone / 2) * 100) + '%'; zoneEl.style.width = (zone * 100) + '%';
      }
      newZone();
      function pos() { var m = ph % 2; return m < 1 ? m : 2 - m; }

      A.onDown(function () {
        if (done) return;
        var m = pos(), ok = Math.abs(m - center) <= zone / 2;
        if (ok) {
          hits++; cnt.textContent = hits + '/' + R;
          A.pop(0, 'YES', 'ha'); SD.audio.sfx.perfect(); A.face(0, 'cheer'); A.later(function () { A.face(0, 'idle'); }, 260);
          speed *= 1.07;
          if (hits >= R) { done = true; A.later(function () { A.end([{ p: 1, label: 'CLEAR!' }]); }, 500); return; }
          newZone();
        } else {
          fails++; setPips(A, allow + 1, fails);
          A.pop(0, 'MISS', 'bad'); SD.audio.sfx.bwoop(); A.face(0, 'worry'); SD.fx.vibrate(30);
          if (fails > allow) { done = true; A.later(function () { A.end([{ p: 0, label: 'FAILED' }]); }, 600); }
        }
      });
      A.frame(function (dt) {
        if (done) return;
        ph += dt * speed;
        mark.style.left = (pos() * 100) + '%';
      });
      A.timer(40000, function () { if (!done) { done = true; A.end([{ p: 0, label: 'TIME UP' }]); } });
    }
  });

  /* ---------- 3. PIE STORM: three lanes, pies fall, move to a safe lane ---------- */
  SD.bosses.push({
    id: 'bossstorm', title: 'BOSS: PIE STORM', tip: 'TAP A LANE TO MOVE', icon: 'pie', cleanup: cleanup,
    start: function (A) {
      var T = A.tier, allow = T < 4 ? 2 : 1, count = 12 + T, D = Math.max(0.62, 1.0 - 0.045 * T), gap = Math.max(0.5, 0.95 - 0.04 * T);
      var stage = A.stage(0), pad = A.padEl(0), waves = [], t = 1.3, k, q, lane = 1, hits = 0, done = false;
      for (k = 0; k < count; k++) {
        var lanes, safe = Math.floor(Math.random() * 3);
        if (Math.random() < Math.min(0.85, 0.2 + T * 0.1)) lanes = [0, 1, 2].filter(function (x) { return x !== safe; });
        else lanes = [Math.floor(Math.random() * 3)];
        waves.push({ t: t, lanes: lanes, res: [] });
        t += gap * (0.8 + Math.random() * 0.5);
      }
      var W = stage.clientWidth, H = stage.clientHeight, lw = W / 3, m = Math.min(lw * 0.82, H * 0.2), pw = m * 0.8, base = H * 0.04;
      var html = '<div class="dg bc"><div class="bc-lane" style="width:' + lw + 'px;left:0"></div><div class="bc-lane" style="width:' + lw + 'px;left:' + lw + 'px"></div><div class="bc-lane" style="width:' + lw + 'px;left:' + (2 * lw) + 'px"></div>' +
        '<div class="dg-me" style="width:' + m + 'px;bottom:' + base + 'px">' + SD.art.face(0, 'worry') + '</div>';
      for (k = 0; k < count * 2; k++) html += '<div class="dg-pie" style="width:' + pw + 'px">' + SD.art.icon('pie') + '</div>';
      stage.innerHTML = html + '</div>' + hudHtml('HIT', allow + 1, 0);
      var me = stage.querySelector('.dg-me'), pies = stage.querySelectorAll('.dg-pie');
      var yEnd = (H - base - m) + m * 0.3 - pw * 0.75, t0 = A.now();
      function laneX(l) { return l * lw + lw / 2 - m / 2; }
      function moveTo(l) { if (done || l === lane) return; lane = l; me.style.transform = 'translate(' + laneX(l) + 'px,0)'; SD.audio.sfx.toss(); }
      me.style.transform = 'translate(' + laneX(lane) + 'px,0)';

      function onPtr(e) {
        var r = pad.getBoundingClientRect(), x = (e.clientX - r.left) / r.width;
        moveTo(x < 1 / 3 ? 0 : x < 2 / 3 ? 1 : 2);
      }
      function onKey(e) {
        var key = (e.key || '').toLowerCase();
        if (key === 'arrowleft' || key === 'a') moveTo(Math.max(0, lane - 1));
        else if (key === 'arrowright' || key === 'd') moveTo(Math.min(2, lane + 1));
      }
      pad.addEventListener('pointerdown', onPtr); window.addEventListener('keydown', onKey);
      off = function () { pad.removeEventListener('pointerdown', onPtr); window.removeEventListener('keydown', onKey); };

      function now() { return (A.now() - t0) / 1000; }
      waves.forEach(function (w) { A.later(function () { SD.audio.sfx.fall(D); }, w.t * 1000); });

      function resolve(w, l, idx) {
        if (w.res[l]) return;
        if (lane === l) {
          w.res[l] = 'hit'; hits++; setPips(A, allow + 1, hits);
          pies[idx].style.display = 'none';
          me.innerHTML = SD.art.face(0, 'pied'); A.later(function () { me.innerHTML = SD.art.face(0, 'worry'); }, 500);
          var c = SD.fx.center(me); SD.fx.cream(c.x, c.y, 14); SD.audio.sfx.splat(); SD.fx.vibrate(30);
          if (hits > allow && !done) { done = true; A.later(function () { A.end([{ p: 0, label: 'FAILED' }]); }, 700); }
        } else { w.res[l] = 'ok'; }
      }

      A.frame(function () {
        if (done) return;
        var n = now(), idx = 0;
        waves.forEach(function (w) {
          for (q = 0; q < 2; q++, idx++) {
            var l = w.lanes[q], pie = pies[idx];
            if (l == null) { pie.style.display = 'none'; continue; }
            var tau = (n - w.t) / D;
            if (tau < 0 || w.res[l] === 'hit') continue;
            var y = -pw + (yEnd + pw) * tau;
            if (y > H) { pie.style.display = 'none'; continue; }
            pie.style.display = 'block';
            pie.style.transform = 'translate(' + (l * lw + lw / 2 - pw / 2) + 'px,' + y + 'px)';
            if (tau >= 1 && !w.res[l]) resolve(w, l, idx);
          }
        });
      });
      var last = waves[waves.length - 1];
      A.later(function () {
        if (done) return; done = true;
        A.end([{ p: hits <= allow ? 1 : 0, label: hits <= allow ? 'CLEAR!' : 'FAILED' }]);
      }, (last.t + D + 0.8) * 1000);
    }
  });
})();
