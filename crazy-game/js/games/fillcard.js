/* FLASH FIND: giant object, then cards flicker in. Faster correct tap scores more. */
(function () {
  'use strict';
  var POOL = ['star', 'candy', 'note', 'cup', 'zap', 'spark', 'crown', 'eye', 'pie', 'bomb', 'bolt', 'trophy'];
  SD.art.addIcons({
    fillcard: '<rect x="10" y="8" width="44" height="48" rx="6" fill="#fff" stroke="' + SD.art.INK + '" stroke-width="4"/><path d="M22 20H42M22 32H42M22 44H42M18 14V50" fill="none" stroke="' + SD.art.INK + '" stroke-width="3"/>'
  });
  function shuffle(a, rand) {
    var i, j, t, b = a.slice();
    for (i = b.length - 1; i > 0; i--) { j = Math.floor(rand() * (i + 1)); t = b[i]; b[i] = b[j]; b[j] = t; }
    return b;
  }
  SD.games.push({
    id: 'fillcard', pack: 2, title: 'FLASH FIND', tip: 'BIG PICTURE, THEN TAP IT IN THE CARDS. FASTER = MORE POINTS', icon: 'fillcard',
    start: function (A) {
      var P = A.players, score = [0, 0], board = [[], []], finished = false, t = 0, LIMIT = 28;
      var phase = 'idle', target = '', shownAt = 0, answered = [false, false], round = 0, MAX = 7;
      var roundTimer = 0;
      P.forEach(function (i) {
        A.stage(i).innerHTML = '<div class="fc-wrap"><div class="mem-head"><span class="ng-hint">LOOK</span><b class="ng-score">0</b></div>' +
          '<div class="fc-big" hidden><span class="fc-big-ico"></span></div>' +
          '<div class="fc-grid g4" hidden></div></div>';
        A.face(i, 'idle');
      });
      function ptsFor(elapsed) { return Math.max(15, Math.round(110 - elapsed * 48)); }
      function setScore(i) { A.stage(i).querySelector('.ng-score').textContent = score[i]; }
      function showBig() {
        if (finished) return;
        phase = 'big'; answered = [false, false]; roundTimer = 0;
        target = POOL[Math.floor(A.rand() * POOL.length)];
        P.forEach(function (i) {
          var wrap = A.stage(i).querySelector('.fc-wrap');
          var big = wrap.querySelector('.fc-big');
          var grid = wrap.querySelector('.fc-grid');
          grid.hidden = true; grid.innerHTML = '';
          big.hidden = false;
          big.classList.remove('flash');
          void big.offsetWidth;
          big.classList.add('flash');
          wrap.querySelector('.ng-hint').textContent = 'LOOK';
          big.querySelector('.fc-big-ico').innerHTML = SD.art.icon(target, 112);
          A.face(i, 'worry');
        });
        SD.audio.sfx.whoosh();
        A.later(deal, 1150);
      }
      function deal() {
        if (finished || phase !== 'big') return;
        phase = 'pick'; shownAt = A.now(); roundTimer = 0;
        P.forEach(function (i) {
          var rest = shuffle(POOL.filter(function (id) { return id !== target; }), A.rand);
          board[i] = shuffle([target].concat(rest, rest).slice(0, 16), A.rand);
          var wrap = A.stage(i).querySelector('.fc-wrap');
          var big = wrap.querySelector('.fc-big');
          var grid = wrap.querySelector('.fc-grid');
          big.hidden = true;
          big.classList.remove('flash');
          grid.hidden = false;
          wrap.querySelector('.ng-hint').textContent = 'FIND IT';
          grid.innerHTML = board[i].map(function (id, k) {
            return '<button type="button" class="fc-cell ng-hit" data-k="' + k + '" style="animation-delay:' + (k * 38) + 'ms">' +
              SD.art.icon(id, 36) + '</button>';
          }).join('');
          if (!A.mine || A.mine(i)) {
            Array.prototype.forEach.call(grid.querySelectorAll('.fc-cell'), function (el) {
              el.addEventListener('pointerdown', function (e) {
                e.preventDefault(); e.stopPropagation();
                pick(i, +el.getAttribute('data-k'), false);
              });
            });
          }
          A.face(i, 'idle');
        });
        (A.bots || []).forEach(function (b) {
          var k, hit = 0;
          for (k = 0; k < board[b].length; k++) if (board[b][k] === target) { hit = k; break; }
          if (A.rand() < 0.18 + A.skill * 0.75) A.later(function () { pick(b, hit); }, 280 + (1 - A.skill) * 900 + A.rand() * 220);
          else A.later(function () { pick(b, Math.floor(A.rand() * 16)); }, 400 + A.rand() * 600);
        });
      }
      function pick(i, k, fromNet) {
        if (finished || phase !== 'pick' || answered[i]) return;
        var el = A.stage(i).querySelectorAll('.fc-cell')[k];
        if (!el) return;
        if (!fromNet && A.hit && (!A.mine || A.mine(i))) A.hit(k);
        if (board[i][k] !== target) {
          A.face(i, 'worry'); SD.audio.sfx.bwoop();
          el.classList.add('no');
          A.later(function () { el.classList.remove('no'); if (!finished && !answered[i]) A.face(i, 'idle'); }, 220);
          return;
        }
        answered[i] = true;
        el.classList.add('stamped');
        var pts = ptsFor((A.now() - shownAt) / 1000);
        score[i] += pts; setScore(i);
        A.face(i, 'cheer'); SD.audio.sfx.coin();
        A.pop(i, '+' + pts, 'ha');
        if (!A.net && P.every(function (j) { return answered[j]; })) A.later(nextRound, 450);
      }
      function nextRound() {
        if (finished || phase === 'gap') return;
        phase = 'gap';
        round++;
        if (round >= MAX) return done();
        showBig();
      }
      function done() {
        if (finished) return; finished = true; phase = 'idle';
        A.later(function () {
          A.end(P.map(function (i) { return { p: score[i], label: score[i] + ' PTS' }; }));
        }, 500);
      }
      A.onDown(function () {});
      A.onHit(function (i, k) { pick(i, k, true); });
      showBig();
      A.frame(function (dt) {
        if (finished) return;
        t += dt;
        if (phase === 'pick') {
          roundTimer += dt;
          if (roundTimer > 2.6 - 0.4 * A.hard) nextRound();
        }
        if (t > LIMIT) done();
      });
    }
  });
})();
