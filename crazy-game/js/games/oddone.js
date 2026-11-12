/* ODD ONE: 4x4 of lookalikes. TAP the one that does not belong. */
(function () {
  'use strict';
  var FAM = [
    ['star', 'bolt'], ['star', 'crown'], ['crown', 'trophy'], ['bolt', 'trophy'],
    ['candy', 'pie'], ['candy', 'balloon'], ['pie', 'balloon'], ['spark', 'star'],
    ['zap', 'note'], ['cup', 'trophy'], ['candy', 'spark'], ['pie', 'eye']
  ];
  var N = 16;
  SD.art.addIcons({
    oddone: '<rect x="8" y="18" width="18" height="28" rx="5" fill="#ffd84d" stroke="' + SD.art.INK + '" stroke-width="4"/><rect x="30" y="18" width="18" height="28" rx="5" fill="#ffd84d" stroke="' + SD.art.INK + '" stroke-width="4"/><rect x="52" y="14" width="18" height="32" rx="5" fill="#ff8cc3" stroke="' + SD.art.INK + '" stroke-width="4"/>'
  });
  function shuffle(a, rand) {
    var i, j, t, b = a.slice();
    for (i = b.length - 1; i > 0; i--) { j = Math.floor(rand() * (i + 1)); t = b[i]; b[i] = b[j]; b[j] = t; }
    return b;
  }
  SD.games.push({
    id: 'oddone', pack: 2, title: 'ODD ONE', tip: '16 LOOKALIKES. TAP THE ONE WITH THE WRONG SHAPE', icon: 'oddone',
    start: function (A) {
      var P = A.players, score = [0, 0], odd = [0, 0], finished = false, t = 0, LIMIT = 22;
      var phase = 'wait', shownAt = 0, answered = [false, false], round = 0;
      P.forEach(function (i) {
        A.stage(i).innerHTML = '<div class="fc-wrap"><div class="mem-head"><span class="ng-hint">TAP THE ODD ONE</span><b class="ng-score">0</b></div><div class="fc-grid g4"></div></div>';
        A.face(i, 'idle');
      });
      function deal() {
        if (finished) return;
        phase = 'pick'; answered = [false, false]; shownAt = A.now();
        var fam = FAM[Math.floor(A.rand() * FAM.length)];
        fam = shuffle(fam, A.rand);
        var main = fam[0], other = fam[1];
        P.forEach(function (i) {
          odd[i] = Math.floor(A.rand() * N);
          var grid = A.stage(i).querySelector('.fc-grid');
          grid.innerHTML = '';
          var k;
          for (k = 0; k < N; k++) {
            var id = k === odd[i] ? other : main;
            var el = document.createElement('button');
            el.type = 'button'; el.className = 'fc-cell ng-hit'; el.setAttribute('data-k', k);
            el.style.animationDelay = (k * 18) + 'ms';
            el.innerHTML = SD.art.icon(id, 30);
            if (!A.mine || A.mine(i)) {
              el.addEventListener('pointerdown', function (e) {
                e.preventDefault(); e.stopPropagation();
                pick(i, +this.getAttribute('data-k'), false);
              });
            }
            grid.appendChild(el);
          }
          A.face(i, 'idle');
        });
        (A.bots || []).forEach(function (b) {
          var wait = 220 + (1 - A.skill) * 900 + A.rand() * 200;
          if (A.rand() < 0.2 + A.skill * 0.75) A.later(function () { pick(b, odd[b]); }, wait);
          else A.later(function () { pick(b, Math.floor(A.rand() * N)); }, wait + 120);
        });
      }
      function pick(i, k, fromNet) {
        if (finished || phase !== 'pick' || answered[i]) return;
        var cells = A.stage(i).querySelectorAll('.fc-cell');
        if (!cells[k]) return;
        if (!fromNet && A.hit && (!A.mine || A.mine(i))) A.hit(k);
        if (k !== odd[i]) {
          cells[k].classList.add('no'); SD.audio.sfx.bwoop(); A.face(i, 'worry');
          A.later(function () { cells[k].classList.remove('no'); if (!answered[i]) A.face(i, 'idle'); }, 200);
          return;
        }
        answered[i] = true;
        cells[k].classList.add('stamped');
        var pts = Math.max(15, Math.round(120 - ((A.now() - shownAt) / 1000) * 42));
        score[i] += pts;
        A.stage(i).querySelector('.ng-score').textContent = score[i];
        A.face(i, 'cheer'); SD.audio.sfx.coin(); A.pop(i, '+' + pts, 'ha');
        if (!A.net && P.every(function (j) { return answered[j]; })) A.later(next, 400);
      }
      function next() {
        if (finished) return;
        round++;
        if (round >= 8) return done();
        deal();
      }
      function done() {
        if (finished) return; finished = true;
        A.end(P.map(function (i) { return { p: score[i], label: score[i] + ' PTS' }; }));
      }
      A.onDown(function () {});
      A.onHit(function (i, k) { pick(i, k, true); });
      deal();
      A.frame(function (dt) {
        if (finished) return;
        t += dt;
        if (phase === 'pick' && (A.now() - shownAt) > 2800 - 400 * A.hard) next();
        if (t > LIMIT) done();
      });
    }
  });
})();
