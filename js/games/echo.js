/* ECHO BEAT (level 20 pack): watch a rhythm light up, then tap the same rhythm back. Three rounds, longer each time. */
(function () {
  'use strict';
  var INK = SD.art.INK, st = ' stroke="' + INK + '" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"';
  SD.art.addIcons({
    echo: '<circle cx="22" cy="32" r="8" fill="#ffd84d"' + st + '/><path d="M36 20Q44 32 36 44M44 12Q58 32 44 52" fill="none"' + st + '/>',
    p_echo2: '<circle cx="32" cy="32" r="14" fill="#fff"' + st + '/><path d="M26 32H38M32 26V38" fill="none"' + st + '/><path d="M8 20Q4 32 8 44M56 20Q60 32 56 44" fill="none"' + st + '/>'
  });
  SD.games.push({
    id: 'echo', pack: 2, title: 'ECHO BEAT', tip: 'WATCH THE RHYTHM, THEN TAP IT BACK', icon: 'echo',
    start: function (A) {
      var P = A.players, G = {}, finished = false, hard = A.hard, R = 3, pats = [], r, k, gaps = [0.3, 0.45, 0.6, 0.8];
      for (r = 0; r < R; r++) {
        var n = 4 + r + (hard > 0.6 ? 1 : 0), a = [];
        for (k = 0; k < n - 1; k++) a.push(gaps[Math.floor(A.rand() * (hard > 0.3 ? 3 : 4))] * (hard > 0.5 ? 0.85 : 1));
        pats.push(a);
      }
      var TOL = 0.13 * (1 - 0.35 * hard);
      P.forEach(function (i) {
        A.stage(i).innerHTML = '<div class="ec"><b class="ec-n">0</b><small class="ec-msg">WATCH</small><div class="ec-pad"></div><div class="ec-dots"></div></div>';
        var s = A.stage(i);
        G[i] = { r: 0, score: 0, ph: 'idle', taps: [], dbl: A.power(i, 'echo2'), pad: s.querySelector('.ec-pad'), msg: s.querySelector('.ec-msg'), dots: s.querySelector('.ec-dots'), n: s.querySelector('.ec-n'), fin: false, tok: 0 };
      });
      A.live(function (slot, id) { if (id === 'echo2' && G[slot]) G[slot].dbl = true; });
      function flash(i, on) { G[i].pad.classList.toggle('on', on); }
      function listen(i, rep) {
        var g = G[i], pat = pats[g.r], t = 0, tok = ++g.tok; g.ph = 'listen'; g.msg.textContent = 'WATCH'; g.pad.className = 'ec-pad'; g.dots.innerHTML = '';
        function beat(j) {
          if (g.tok !== tok || finished) return;
          flash(i, true); SD.audio.sfx.blip(5 + j); A.later(function () { flash(i, false); }, 130);
          if (j < pat.length) A.later(function () { beat(j + 1); }, pat[j] * 1000);
          else A.later(function () { if (g.tok !== tok) return; if (g.dbl && rep < 1) { g.msg.textContent = 'AGAIN'; A.later(function () { listen(i, rep + 1); }, 900); } else copy(i); }, 700);
        }
        A.later(function () { beat(0); }, 700);
      }
      function copy(i) {
        var g = G[i], pat = pats[g.r], total = pat.reduce(function (a, b) { return a + b; }, 0), tok = ++g.tok;
        g.ph = 'copy'; g.taps = []; g.msg.textContent = 'YOUR TURN!'; g.pad.className = 'ec-pad go'; g.dots.innerHTML = '';
        if ((A.bots || []).indexOf(i) >= 0) {                                    // bot: copies the rhythm with a little wobble
          var at = 450 + A.rand() * 300, jit = (1 - A.skill) * 0.17 * 1000, j;
          A.later(function () { A.tap(i); }, at);
          var acc = 0; for (j = 0; j < pat.length; j++) { acc += pat[j] * 1000; (function (x) { A.later(function () { A.tap(i); }, at + x + (A.rand() - 0.5) * 2 * jit); })(acc); }
        }
        A.later(function () { if (g.tok === tok && g.ph === 'copy') judge(i); }, total * 1000 + 2300);
      }
      function judge(i) {
        var g = G[i], pat = pats[g.r], exp = [0], pts = 0, k; g.ph = 'wait'; g.tok++;
        pat.forEach(function (x, j) { exp.push(exp[j] + x); });
        g.dots.innerHTML = '';
        for (k = 0; k < exp.length; k++) {
          var err = g.taps[k] == null ? 9 : Math.abs((g.taps[k] - g.taps[0]) - exp[k]), cls = err < TOL ? 'g' : err < TOL * 1.8 ? 'y' : 'r';
          pts += cls === 'g' ? 1 : cls === 'y' ? 0.5 : 0; g.dots.innerHTML += '<i class="' + cls + '"></i>';
        }
        g.score += pts; g.n.textContent = (Math.round(g.score * 10) / 10);
        g.msg.textContent = pts >= exp.length ? 'PERFECT!' : pts >= exp.length * 0.6 ? 'NICE' : 'OOPS'; g.pad.className = 'ec-pad';
        A.face(i, pts >= exp.length * 0.6 ? 'cheer' : 'worry'); SD.audio.sfx[pts >= exp.length * 0.6 ? 'coin' : 'bwoop']();
        g.r++;
        A.later(function () { A.face(i, 'idle'); if (g.r >= R) { g.fin = true; g.msg.textContent = 'DONE'; check(); } else listen(i, 0); }, 1300);
      }
      A.onDown(function (i) {
        var g = G[i]; if (finished || g.ph !== 'copy') return;
        var pat = pats[g.r]; if (g.taps.length >= pat.length + 1) return;
        g.taps.push(A.now() / 1000); flash(i, true); A.later(function () { flash(i, false); }, 90); SD.audio.sfx.blip(5 + g.taps.length - 1);
        g.dots.innerHTML += '<i></i>';
        if (g.taps.length === pat.length + 1) { var tk = g.tok; A.later(function () { if (g.tok === tk && g.ph === 'copy') judge(i); }, 350); }
      });
      function done() { if (finished) return; finished = true; A.end(P.map(function (i) { return { p: G[i].score, label: (Math.round(G[i].score * 10) / 10) + ' PTS' }; })); }
      function check() { if (P.every(function (j) { return G[j].fin; })) A.later(done, 600); }
      P.forEach(function (i) { A.later(function () { listen(i, 0); }, 200); });
    }
  });
})();
