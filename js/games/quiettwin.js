/* QUIET TWIN: 16 face-up cards. Only one pair matches. Tap both. Faster find scores more. */
(function () {
  'use strict';
  var POOL = ['star', 'candy', 'note', 'cup', 'zap', 'spark', 'crown', 'eye', 'pie', 'bomb', 'bolt', 'trophy', 'balloon', 'lock', 'skull', 'check'];
  var N = 16;
  SD.art.addIcons({
    quiettwin: '<rect x="8" y="16" width="22" height="32" rx="5" fill="#fff" stroke="' + SD.art.INK + '" stroke-width="4"/><rect x="34" y="16" width="22" height="32" rx="5" fill="#fff" stroke="' + SD.art.INK + '" stroke-width="4"/><circle cx="19" cy="32" r="5" fill="#ffd84d"/><circle cx="45" cy="32" r="5" fill="#ffd84d"/>'
  });
  function shuffle(a, rand) {
    var i, j, t, b = a.slice();
    for (i = b.length - 1; i > 0; i--) { j = Math.floor(rand() * (i + 1)); t = b[i]; b[i] = b[j]; b[j] = t; }
    return b;
  }
  SD.games.push({
    id: 'quiettwin', pack: 2, title: 'QUIET TWIN', tip: '16 CARDS. ONLY ONE PAIR MATCHES. TAP BOTH', icon: 'quiettwin',
    start: function (A) {
      var P = A.players, score = [0, 0], board = [[], []], pick = [null, null], answered = [false, false];
      var finished = false, t = 0, LIMIT = 22, phase = 'wait', shownAt = 0, round = 0, twin = '', tok = 0;
      P.forEach(function (i) {
        A.stage(i).innerHTML = '<div class="fc-wrap"><div class="mem-head"><span class="ng-hint">FIND THE PAIR</span><b class="ng-score">0</b></div><div class="fc-grid g4"></div></div>';
        A.face(i, 'idle');
      });
      function deal() {
        if (finished) return;
        phase = 'pick'; answered = [false, false]; pick = [null, null]; shownAt = A.now(); tok++;
        var bag = shuffle(POOL, A.rand);
        twin = bag[0];
        var decoys = bag.slice(1, 15);
        P.forEach(function (i) {
          board[i] = shuffle([twin, twin].concat(decoys), A.rand);
          var grid = A.stage(i).querySelector('.fc-grid');
          grid.innerHTML = '';
          board[i].forEach(function (id, k) {
            var el = document.createElement('button');
            el.type = 'button'; el.className = 'fc-cell ng-hit'; el.setAttribute('data-k', k);
            el.style.animationDelay = (k * 16) + 'ms';
            el.innerHTML = SD.art.icon(id, 30);
            if (!A.mine || A.mine(i)) {
              el.addEventListener('pointerdown', function (e) {
                e.preventDefault(); e.stopPropagation();
                tap(i, +this.getAttribute('data-k'), false);
              });
            }
            grid.appendChild(el);
          });
          A.face(i, 'idle');
        });
        (A.bots || []).forEach(function (b) {
          var my = tok, pair = [];
          board[b].forEach(function (id, k) { if (id === twin) pair.push(k); });
          var wait = 380 + (1 - A.skill) * 1100;
          if (A.rand() < 0.22 + A.skill * 0.72 && pair.length === 2) {
            A.later(function () { if (tok === my) tap(b, pair[0]); }, wait);
            A.later(function () { if (tok === my) tap(b, pair[1]); }, wait + 160 + (1 - A.skill) * 180);
          } else {
            A.later(function () { if (tok === my) tap(b, Math.floor(A.rand() * N)); }, wait);
            A.later(function () { if (tok === my) tap(b, Math.floor(A.rand() * N)); }, wait + 220);
          }
        });
      }
      function cells(i) { return A.stage(i).querySelectorAll('.fc-cell'); }
      function tap(i, k, fromNet) {
        if (finished || phase !== 'pick' || answered[i]) return;
        var els = cells(i);
        if (!els[k]) return;
        if (!fromNet && A.hit && (!A.mine || A.mine(i))) A.hit(k);
        if (pick[i] === k) {
          els[k].classList.remove('pick');
          pick[i] = null;
          return;
        }
        if (pick[i] == null) {
          pick[i] = k;
          els[k].classList.add('pick');
          SD.audio.sfx.tap();
          return;
        }
        var a = pick[i], b = k;
        if (board[i][a] === board[i][b] && board[i][a] === twin) {
          answered[i] = true;
          els[a].classList.add('stamped'); els[b].classList.add('stamped');
          els[a].classList.remove('pick'); els[b].classList.remove('pick');
          var first = !answered[1 - i];
          var pts = Math.max(20, Math.round((first ? 130 : 70) - ((A.now() - shownAt) / 1000) * 36));
          score[i] += pts;
          A.stage(i).querySelector('.ng-score').textContent = score[i];
          A.face(i, 'cheer'); SD.audio.sfx.coin();
          A.pop(i, (first ? 'FIRST +' : '+') + pts, 'ha');
          if (!A.net && P.every(function (j) { return answered[j]; })) A.later(next, 420);
        } else {
          els[a].classList.add('no'); els[b].classList.add('no');
          els[a].classList.remove('pick');
          pick[i] = null;
          A.face(i, 'worry'); SD.audio.sfx.bwoop();
          A.later(function () {
            els[a].classList.remove('no'); els[b].classList.remove('no');
            if (!answered[i]) A.face(i, 'idle');
          }, 220);
        }
      }
      function next() {
        if (finished) return;
        round++;
        if (round >= 7) return done();
        deal();
      }
      function done() {
        if (finished) return; finished = true;
        A.end(P.map(function (i) { return { p: score[i], label: score[i] + ' PTS' }; }));
      }
      A.onDown(function () {});
      A.onHit(function (i, k) { tap(i, k, true); });
      deal();
      A.frame(function (dt) {
        if (finished) return;
        t += dt;
        if (phase === 'pick' && (A.now() - shownAt) > 3200 - 400 * A.hard) next();
        if (t > LIMIT) done();
      });
    }
  });
})();
