/* WHACK PIE: 4x4 holes. Pies and lookalike sweets pop together. TAP only the pie. */
(function () {
  'use strict';
  var INK = SD.art.INK, st = ' stroke="' + INK + '" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"';
  var DECOY = ['candy', 'tart', 'cake', 'donut', 'balloon', 'cup'];
  SD.art.addIcons({
    whack: '<circle cx="32" cy="34" r="18" fill="#fffdf3"' + st + '/><path d="M16 22Q32 10 48 22" fill="#ff8cc3"' + st + '/><path d="M12 54H52" fill="none"' + st.replace('4', '5') + '/>',
    tart: '<path d="M8 38H56L50 56H14Z" fill="#76e6a8"' + st + '/><path d="M10 38Q10 18 32 18Q54 18 54 38Z" fill="#fffdf3"' + st + '/><circle cx="32" cy="16" r="6" fill="#ff4d6d"' + st.replace('4', '3') + '/>',
    cake: '<path d="M10 34H54L48 56H16Z" fill="#ffd0e6"' + st + '/><path d="M12 34Q12 16 32 16Q52 16 52 34Z" fill="#fff6fb"' + st + '/><circle cx="32" cy="14" r="5" fill="#ff4d6d"' + st.replace('4', '3') + '/><path d="M20 34V46M32 34V48M44 34V46" fill="none" stroke="#ff8cc3" stroke-width="3"/>',
    donut: '<circle cx="32" cy="34" r="20" fill="#ffd84d"' + st + '/><circle cx="32" cy="34" r="8" fill="#fff8f0"' + st.replace('4', '3.5') + '/><circle cx="22" cy="26" r="3" fill="#ff8cc3"/><circle cx="42" cy="28" r="3" fill="#76e6a8"/><circle cx="30" cy="44" r="3" fill="#6fcfff"/>'
  });
  function shuffle(a, rand) {
    var i, j, t, b = a.slice();
    for (i = b.length - 1; i > 0; i--) { j = Math.floor(rand() * (i + 1)); t = b[i]; b[i] = b[j]; b[j] = t; }
    return b;
  }
  SD.games.push({
    id: 'whack', pack: 2, title: 'WHACK PIE', tip: 'MORE HOLES. TAP THE PIE, NOT THE LOOKALIKES', icon: 'whack',
    start: function (A) {
      var P = A.players, score = [0, 0], live = [{}, {}], born = [0, 0], piesLeft = [0, 0];
      var finished = false, t = 0, LIMIT = 18, N = 16, tok = [0, 0];
      P.forEach(function (i) {
        var cells = '', k;
        for (k = 0; k < N; k++) cells += '<button type="button" class="fc-cell wk-cell ng-hit" data-k="' + k + '"></button>';
        A.stage(i).innerHTML = '<div class="fc-wrap"><div class="mem-head"><span class="ng-hint">TAP THE PIE</span><b class="ng-score">0</b></div><div class="fc-grid g4">' + cells + '</div></div>';
        A.face(i, 'idle');
        if (!A.mine || A.mine(i)) {
          Array.prototype.forEach.call(A.stage(i).querySelectorAll('.wk-cell'), function (el) {
            el.addEventListener('pointerdown', function (e) {
              e.preventDefault(); e.stopPropagation();
              hit(i, +el.getAttribute('data-k'), false);
            });
          });
        }
      });
      function cellsOf(i) { return A.stage(i).querySelectorAll('.wk-cell'); }
      function clear(i) {
        live[i] = {}; piesLeft[i] = 0;
        Array.prototype.forEach.call(cellsOf(i), function (el) {
          el.innerHTML = ''; el.classList.remove('pie', 'decoy');
        });
      }
      function wave(i) {
        if (finished) return;
        clear(i);
        var spots = shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], A.rand);
        var n = 6 + Math.floor(A.rand() * 3);
        var pieN = A.rand() > 0.5 ? 2 : 1;
        var k, id, pies = [];
        tok[i]++;
        for (k = 0; k < n; k++) {
          id = k < pieN ? 'pie' : DECOY[Math.floor(A.rand() * DECOY.length)];
          live[i][spots[k]] = id;
          if (id === 'pie') { piesLeft[i]++; pies.push(spots[k]); }
          var el = cellsOf(i)[spots[k]];
          el.innerHTML = SD.art.icon(id, 32);
          el.classList.add(id === 'pie' ? 'pie' : 'decoy');
        }
        born[i] = A.now();
        if ((A.bots || []).indexOf(i) >= 0) {
          var my = tok[i];
          pies.forEach(function (spot, n) {
            if (A.rand() > 0.15 + A.skill * 0.8) return;
            A.later(function () { if (tok[i] === my) hit(i, spot); }, 180 + n * 90 + (1 - A.skill) * 280);
          });
          if (A.rand() < (1 - A.skill) * 0.22) {
            A.later(function () { if (tok[i] === my) hit(i, spots[pieN]); }, 240 + A.rand() * 200);
          }
        }
      }
      function hit(i, k, fromNet) {
        if (finished) return;
        if (!fromNet && A.hit && (!A.mine || A.mine(i))) A.hit(k);
        if (!live[i][k]) {
          if (!fromNet) { SD.audio.sfx.bwoop(); A.face(i, 'worry'); }
          return;
        }
        var id = live[i][k], el = cellsOf(i)[k];
        delete live[i][k];
        el.innerHTML = ''; el.classList.remove('pie', 'decoy');
        if (id !== 'pie') {
          score[i] = Math.max(0, score[i] - 8);
          A.stage(i).querySelector('.ng-score').textContent = score[i];
          A.face(i, 'dizzy'); SD.audio.sfx.bwoop(); A.pop(i, '-8', 'bad');
          return;
        }
        piesLeft[i]--;
        var pts = Math.max(12, Math.round(80 - ((A.now() - born[i]) / 1000) * 50));
        score[i] += pts;
        A.stage(i).querySelector('.ng-score').textContent = score[i];
        A.face(i, 'cheer'); SD.audio.sfx.pop(); A.pop(i, '+' + pts, 'ha');
        if (!A.net && piesLeft[i] <= 0) A.later(function () { if (!finished) wave(i); }, 160);
      }
      P.forEach(function (i) { wave(i); });
      A.onDown(function () {});
      A.onHit(function (i, k) { hit(i, k, true); });
      A.frame(function (dt) {
        if (finished) return;
        t += dt;
        P.forEach(function (i) {
          if (piesLeft[i] > 0 && A.now() - born[i] > 1150 - 200 * A.hard) wave(i);
        });
        if (t > LIMIT) {
          finished = true;
          A.end(P.map(function (i) { return { p: score[i], label: score[i] + ' PTS' }; }));
        }
      });
    }
  });
})();
