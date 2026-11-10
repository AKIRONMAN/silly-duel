/* SWEET OR BOOM: candies and bombs pop up one after another. Tap the candy fast. Never tap a bomb! */
(function () {
  'use strict';
  var INK = SD.art.INK, st = ' stroke="' + INK + '" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"';
  var CANDY = '<svg viewBox="0 0 64 64"><path d="M6 20L19 32L6 44Z" fill="#ff8cc3"' + st + '/><path d="M58 20L45 32L58 44Z" fill="#ff8cc3"' + st + '/><circle cx="32" cy="32" r="18" fill="#ffd84d"' + st + '/><path d="M22 26Q32 42 42 26" fill="none"' + st + '/></svg>';
  var BOMB = '<svg viewBox="0 0 64 64"><circle cx="30" cy="38" r="20" fill="#3d2670"' + st + '/><path d="M44 24Q50 14 58 14" fill="none"' + st + '/><path d="M54 6L58 14L50 12Z" fill="#ff4d6d"' + st + '/><path d="M20 34Q22 28 28 28" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/></svg>';
  SD.art.addIcons({
    candybomb: '<path d="M4 18L13 27L4 36Z" fill="#ff8cc3"' + st + '/><circle cx="20" cy="27" r="11" fill="#ffd84d"' + st + '/><circle cx="44" cy="40" r="14" fill="#3d2670"' + st + '/><path d="M52 29Q56 22 61 22" fill="none"' + st + '/>'
  });
  var N = 14, SHOW0 = 0.8;
  SD.games.push({
    id: 'snack', title: 'SWEET OR BOOM', tip: 'TAP CANDY. NEVER TAP BOMBS!', icon: 'candybomb',
    start: function (A) {
      var SHOW = SHOW0 * (1 - 0.4 * A.hard), P = A.players, seq = [], t = 1.1, k, G = {}, finished = false, t0 = A.now(), cur = -1, shownAt = 0;
      for (k = 0; k < N; k++) { seq.push({ at: t, bomb: A.rand() < 0.38 + 0.14 * A.hard }); t += (0.85 + A.rand() * 0.45) * (1 - 0.25 * A.hard); }
      P.forEach(function (i) {
        G[i] = { s: 0, ans: {}, shield: A.power(i, 'shield') };
        A.stage(i).innerHTML = '<div class="sb"><b class="sb-s">0</b><div class="sb-item"></div></div>';
      });
      A.live(function (slot, id) { if (id === 'shield' && G[slot]) G[slot].shield = true; });
      function item(i) { return A.stage(i).querySelector('.sb-item'); }
      function setScore(i) { A.stage(i).querySelector('.sb-s').textContent = Math.round(G[i].s * 10) / 10; }
      seq.forEach(function (q, n) {
        A.later(function () {
          cur = n; shownAt = A.now();
          P.forEach(function (i) { item(i).innerHTML = q.bomb ? BOMB : CANDY; item(i).className = 'sb-item on'; });
          if (q.bomb) SD.audio.sfx.tick(1.6);
        }, q.at * 1000);
        A.later(function () { if (cur === n) { cur = -1; P.forEach(function (i) { item(i).className = 'sb-item'; item(i).innerHTML = ''; }); } }, (q.at + SHOW) * 1000);
      });
      A.onDown(function (i) {
        var g = G[i]; if (finished) return;
        var q = cur >= 0 ? seq[cur] : null;
        if (!q || g.ans[cur]) { if (!q) { g.s -= 0.5; setScore(i); SD.audio.sfx.bwoop(); } return; }
        g.ans[cur] = true; var el = item(i);
        if (q.bomb) {
          if (g.shield) { g.shield = false; el.className = 'sb-item on pop'; A.used(i, 'shield', 'BLOCKED!'); return; }   // power-up: shield
          g.s -= 2; el.className = 'sb-item on boom'; A.pop(i, 'BOOM -2', 'bad'); A.face(i, 'dizzy'); SD.audio.sfx.boom(); SD.fx.vibrate([50, 30, 60]);
          A.later(function () { A.face(i, 'idle'); }, 500);
        } else {
          var fast = Math.max(0, 1 - (A.now() - shownAt) / (SHOW * 1000)); g.s += 1 + fast;
          el.className = 'sb-item on pop'; A.pop(i, '+' + (1 + fast).toFixed(1), 'ha'); A.face(i, 'cheer'); SD.audio.sfx.coin();
          A.later(function () { A.face(i, 'idle'); }, 300);
        }
        setScore(i);
      });
      (A.bots || []).forEach(function (b) {
        seq.forEach(function (q) {
          var go = q.bomb ? A.rand() < (1 - A.skill) * 0.3 : A.rand() > (1 - A.skill) * 0.18;
          if (!go) return;
          A.later(function () { A.tap(b); }, (q.at + 0.22 + (1 - A.skill) * 0.35 + A.rand() * 0.12) * 1000);
        });
      });
      A.later(function () {
        if (finished) return; finished = true;
        A.end(P.map(function (i) { return { p: G[i].s, label: (Math.round(G[i].s * 10) / 10) + '' }; }));
      }, (seq[N - 1].at + SHOW + 0.5) * 1000);
    }
  });
})();
