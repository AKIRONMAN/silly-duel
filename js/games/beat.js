/* BEAT POP: notes fall to the ring. Tap exactly when a note touches it.
   The kick drum plays on every note, so you can feel it as well as see it. */
(function () {
  'use strict';
  var FALL = 1.15, WINDOW = 0.22;

  SD.games.push({
    id: 'beat', title: 'BEAT POP', tip: 'TAP ON THE BEAT', icon: 'note',
    start: function (A) {
      var WIN = WINDOW * (1 - 0.4 * A.hard), P = A.players, N = 16, notes = [], t = 1.7, steps = [2, 2, 2, 3, 4, 2, 2], k, G = {};
      for (k = 0; k < N; k++) { notes.push(t); t += 0.2 * steps[Math.floor(A.rand() * steps.length)]; }
      var t0 = A.now();

      P.forEach(function (i) {
        var stage = A.stage(i);
        stage.innerHTML = '<div class="bp"><div class="bp-lane"><span class="bp-ring"></span></div></div>';
        var lane = stage.querySelector('.bp-lane'), Hl = lane.clientHeight, ns = Math.min(lane.clientWidth * 0.64, 42);
        var ringY = Hl * 0.84, ring = lane.querySelector('.bp-ring');
        ring.style.top = ringY + 'px'; ring.style.width = (ns + 12) + 'px';
        var els = [];
        for (var q = 0; q < N; q++) {
          var e = document.createElement('span');
          e.className = 'bp-note'; e.style.width = e.style.height = ns + 'px'; e.style.display = 'none';
          lane.appendChild(e); els.push(e);
        }
        G[i] = { ring: ring, els: els, ringY: ringY, ns: ns, judged: [], score: 0 };
      });

      function now() { return (A.now() - t0) / 1000; }

      notes.forEach(function (tn) { A.later(function () { SD.audio.sfx.kick(); }, tn * 1000); });

      A.onDown(function (i) {
        var g = G[i], n = now(), best = -1, bd = 9, q, win = (A.power(i, 'wide') ? WIN * 1.6 : WIN);
        for (q = 0; q < N; q++) {
          if (g.judged[q]) continue;
          var d = Math.abs(n - notes[q]);
          if (d <= win && d < bd) { bd = d; best = q; }
        }
        g.ring.classList.remove('flash'); void g.ring.offsetWidth;
        if (best < 0) {                                   // stray tap
          g.score -= 1; g.ring.classList.add('flash'); SD.audio.sfx.bwoop();
          return;
        }
        g.judged[best] = 'hit';
        g.els[best].style.display = 'none';
        g.score += 3 - (bd / win) * 2;
        var label = bd < 0.07 * win / WINDOW ? 'PERFECT' : bd < 0.13 * win / WINDOW ? 'GOOD' : 'OK';
        A.pop(i, label, label === 'OK' ? '' : 'ha');
        if (label === 'PERFECT') SD.audio.sfx.perfect(); else SD.audio.sfx.tap();
        A.face(i, 'cheer'); A.later(function () { A.face(i, 'idle'); }, 220);
      });

      /* bot: taps near each note, sloppier when less skilled */
      (A.bots || []).forEach(function (b) {
        notes.forEach(function (tn) {
          if (A.rand() < (1 - A.skill) * 0.25) return;
          var err = (A.rand() - A.rand()) * (0.03 + (1 - A.skill) * 0.2);
          A.later(function () { A.tap(b); }, Math.max(0, tn + err) * 1000);
        });
      });

      A.frame(function () {
        var n = now();
        P.forEach(function (i) {
          var g = G[i];
          for (var q = 0; q < N; q++) {
            var el = g.els[q], dt = notes[q] - n;
            if (g.judged[q] === 'hit') continue;
            if (dt > FALL || dt < -0.5) { el.style.display = 'none'; continue; }
            if (dt < -(A.power(i, 'wide') ? WIN * 1.6 : WIN) && !g.judged[q]) { g.judged[q] = 'miss'; el.style.opacity = '.35'; A.face(i, 'worry'); }
            el.style.display = 'block';
            el.style.transform = 'translate(-50%,' + (g.ringY - (dt / FALL) * g.ringY - g.ns / 2) + 'px)';
          }
        });
      });

      A.later(function () {
        A.end(P.map(function (i) { return { p: G[i].score, label: Math.round(G[i].score) + '' }; }));
      }, (notes[N - 1] + 0.9) * 1000);
    }
  });
})();
