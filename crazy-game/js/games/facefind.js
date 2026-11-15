/* FIND ME: your avatar is hiding in the grid. TAP it. Faster = more points. Preview only. */
(function () {
  'use strict';
  var POOL = ['star', 'candy', 'note', 'cup', 'zap', 'spark', 'crown', 'eye', 'pie', 'bomb'];
  SD.art.addIcons({
    facefind: '<circle cx="32" cy="30" r="16" fill="#6fcfff" stroke="' + SD.art.INK + '" stroke-width="4"/><path d="M8 56H56" fill="none" stroke="' + SD.art.INK + '" stroke-width="4"/><circle cx="48" cy="14" r="6" fill="#ffd84d" stroke="' + SD.art.INK + '" stroke-width="3"/>'
  });
  function shuffle(a, rand) {
    var i, j, t, b = a.slice();
    for (i = b.length - 1; i > 0; i--) { j = Math.floor(rand() * (i + 1)); t = b[i]; b[i] = b[j]; b[j] = t; }
    return b;
  }
  SD.games.push({
    id: 'facefind', pack: 3, title: 'FIND ME', tip: 'TAP YOUR FACE HIDING IN THE CARDS', icon: 'facefind',
    start: function (A) {
      var P = A.players, score = [0, 0], spot = [0, 0], finished = false, t = 0, LIMIT = 18;
      var phase = 'wait', shownAt = 0, answered = [false, false], round = 0;
      P.forEach(function (i) {
        A.stage(i).innerHTML = '<div class="fc-wrap"><div class="mem-head"><span class="ng-hint">FIND YOUR FACE</span><b class="ng-score">0</b></div><div class="fc-grid"></div></div>';
        A.face(i, 'idle');
      });
      function deal() {
        if (finished) return;
        phase = 'pick'; answered = [false, false]; shownAt = A.now();
        P.forEach(function (i) {
          var decoys = shuffle(POOL, A.rand).slice(0, 7);
          var items = decoys.map(function (id) { return { kind: 'ico', id: id }; });
          items.push({ kind: 'me' });
          items.push({ kind: 'foe' });
          items = shuffle(items, A.rand);
          spot[i] = -1;
          var grid = A.stage(i).querySelector('.fc-grid');
          grid.innerHTML = '';
          items.forEach(function (it, k) {
            if (it.kind === 'me') spot[i] = k;
            var el = document.createElement('button');
            el.type = 'button'; el.className = 'fc-cell ng-hit ff-cell'; el.setAttribute('data-k', k);
            el.style.animationDelay = (k * 28) + 'ms';
            if (it.kind === 'me') el.innerHTML = SD.art.face(i, 'idle');
            else if (it.kind === 'foe') el.innerHTML = SD.art.face(1 - i, 'idle');
            else el.innerHTML = SD.art.icon(it.id, 36);
            el.addEventListener('pointerdown', function (e) {
              e.preventDefault(); e.stopPropagation();
              pick(i, +this.getAttribute('data-k'));
            });
            grid.appendChild(el);
          });
        });
      }
      function pick(i, k) {
        if (finished || phase !== 'pick' || answered[i]) return;
        var cells = A.stage(i).querySelectorAll('.fc-cell');
        if (k !== spot[i]) {
          cells[k].classList.add('no'); SD.audio.sfx.bwoop(); A.face(i, 'worry');
          A.later(function () { cells[k].classList.remove('no'); if (!answered[i]) A.face(i, 'idle'); }, 200);
          return;
        }
        answered[i] = true;
        cells[k].classList.add('stamped');
        var pts = Math.max(15, Math.round(110 - ((A.now() - shownAt) / 1000) * 50));
        score[i] += pts;
        A.stage(i).querySelector('.ng-score').textContent = score[i];
        A.face(i, 'cheer'); SD.audio.sfx.coin(); A.pop(i, '+' + pts, 'good');
        if (answered[0] && answered[1]) A.later(next, 400);
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
      deal();
      A.frame(function (dt) {
        if (finished) return;
        t += dt;
        if (phase === 'pick' && (A.now() - shownAt) > 2800) next();
        if (t > LIMIT) done();
      });
    }
  });
})();
