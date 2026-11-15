/* COPY CAT: watch, then TAP the same order. Clear WATCH / YOUR TURN banners. Preview only. */
(function () {
  'use strict';
  SD.art.addIcons({
    copytap: '<circle cx="18" cy="22" r="8" fill="#ffd84d" stroke="' + SD.art.INK + '" stroke-width="4"/><circle cx="46" cy="22" r="8" fill="#6fcfff" stroke="' + SD.art.INK + '" stroke-width="4"/><circle cx="18" cy="46" r="8" fill="#76e6a8" stroke="' + SD.art.INK + '" stroke-width="4"/><circle cx="46" cy="46" r="8" fill="#ff8cc3" stroke="' + SD.art.INK + '" stroke-width="4"/>'
  });
  SD.games.push({
    id: 'copytap', pack: 3, title: 'COPY CAT', tip: 'WATCH FIRST. BANNER SAYS WHEN IT IS YOUR TURN', icon: 'copytap',
    start: function (A) {
      var P = A.players, score = [0, 0], seq = [], step = [0, 0], finished = false, t = 0, LIMIT = 24;
      var lock = true, round = 0, LEN = 3, doneP = [false, false];
      P.forEach(function (i) {
        var cells = '', k;
        for (k = 0; k < 4; k++) cells += '<button type="button" class="cp-cell ng-hit" data-k="' + k + '"></button>';
        A.stage(i).innerHTML = '<div class="cp-wrap is-watch"><div class="mem-head"><span class="ng-hint">WATCH</span><b class="ng-score">0</b></div>' +
          '<div class="cp-turn">WATCH THE LIGHTS</div><div class="cp-grid">' + cells + '</div></div>';
        A.face(i, 'idle');
        Array.prototype.forEach.call(A.stage(i).querySelectorAll('.cp-cell'), function (el) {
          el.addEventListener('pointerdown', function (e) {
            e.preventDefault(); e.stopPropagation();
            tap(i, +el.getAttribute('data-k'));
          });
        });
      });
      function wrap(i) { return A.stage(i).querySelector('.cp-wrap'); }
      function cell(i, k) { return A.stage(i).querySelectorAll('.cp-cell')[k]; }
      function setTurn(mode) {
        P.forEach(function (i) {
          var w = wrap(i), banner = w.querySelector('.cp-turn'), hint = w.querySelector('.ng-hint');
          w.classList.toggle('is-watch', mode === 'watch');
          w.classList.toggle('is-play', mode === 'play');
          A.padEl(i).classList.toggle('your-turn', mode === 'play');
          if (mode === 'watch') {
            banner.textContent = 'WATCH — DON\'T TAP';
            hint.textContent = 'WATCH';
            A.face(i, 'worry');
          } else {
            banner.textContent = 'YOUR TURN · TAP THE ORDER';
            hint.textContent = 'TAP NOW';
            A.face(i, 'idle');
          }
        });
      }
      function flash(i, k, on) { var el = cell(i, k); if (el) el.classList.toggle('on', !!on); }
      function playSeq() {
        if (finished) return;
        lock = true; step = [0, 0]; doneP = [false, false];
        LEN = Math.min(5, 3 + round);
        seq = [];
        var n;
        for (n = 0; n < LEN; n++) seq.push(Math.floor(A.rand() * 4));
        setTurn('watch');
        var idx = 0;
        function beat() {
          if (finished) return;
          if (idx >= seq.length) {
            setTurn('play');
            lock = false;
            return;
          }
          var k = seq[idx];
          P.forEach(function (i) { flash(i, k, true); });
          SD.audio.sfx.tap();
          A.later(function () {
            P.forEach(function (i) { flash(i, k, false); });
            idx++;
            A.later(beat, 180);
          }, 340);
        }
        A.later(beat, 400);
      }
      function tap(i, k) {
        if (finished || lock || doneP[i]) return;
        flash(i, k, true);
        A.later(function () { flash(i, k, false); }, 140);
        if (k !== seq[step[i]]) {
          doneP[i] = true;
          A.face(i, 'dizzy'); SD.audio.sfx.bwoop(); A.pop(i, 'NOPE', 'bad');
          wrap(i).querySelector('.cp-turn').textContent = 'MISS';
          wrap(i).querySelector('.ng-hint').textContent = 'MISS';
          A.padEl(i).classList.remove('your-turn');
          if (doneP[0] && doneP[1]) A.later(next, 500);
          return;
        }
        SD.audio.sfx.tap();
        step[i]++;
        wrap(i).querySelector('.cp-turn').textContent = step[i] + ' / ' + seq.length;
        if (step[i] >= seq.length) {
          doneP[i] = true;
          var pts = 20 + LEN * 12;
          score[i] += pts;
          A.stage(i).querySelector('.ng-score').textContent = score[i];
          A.face(i, 'cheer'); SD.audio.sfx.coin(); A.pop(i, '+' + pts, 'good');
          wrap(i).querySelector('.cp-turn').textContent = 'YES!';
          wrap(i).querySelector('.ng-hint').textContent = 'YES';
          A.padEl(i).classList.remove('your-turn');
          if (doneP[0] && doneP[1]) A.later(next, 550);
          else A.later(function () { if (doneP[0] && doneP[1] && !finished) next(); }, 1200);
        }
      }
      function next() {
        if (finished) return;
        P.forEach(function (i) { A.padEl(i).classList.remove('your-turn'); });
        round++;
        if (round >= 6) {
          finished = true;
          A.end(P.map(function (i) { return { p: score[i], label: score[i] + ' PTS' }; }));
          return;
        }
        playSeq();
      }
      A.onDown(function () {});
      playSeq();
      A.frame(function (dt) {
        if (finished) return;
        t += dt;
        if (t > LIMIT) {
          finished = true;
          P.forEach(function (i) { A.padEl(i).classList.remove('your-turn'); });
          A.end(P.map(function (i) { return { p: score[i], label: score[i] + ' PTS' }; }));
        }
      });
    }
  });
})();
