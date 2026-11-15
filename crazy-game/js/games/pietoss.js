/* PIE TOSS: TAP to throw a pie into the other pad. HOLD to block. One pie in the air. */
(function () {
  'use strict';
  var INK = SD.art.INK, st = ' stroke="' + INK + '" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"';
  SD.art.addIcons({
    pietoss: '<circle cx="22" cy="40" r="12" fill="#fffdf3"' + st + '/><path d="M34 28L52 14" fill="none"' + st + '/><circle cx="54" cy="12" r="6" fill="#ff8cc3"' + st.replace('4', '3') + '/>'
  });
  function pieSvg() {
    return '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="34" r="22" fill="#fffdf3"' + st + '/><circle cx="32" cy="34" r="8" fill="#ff3d5e"' + st.replace('4', '3') + '/><path d="M18 18Q32 8 46 18" fill="#ff8cc3"' + st + '/></svg>';
  }
  SD.games.push({
    id: 'pietoss', pack: 3, title: 'PIE TOSS', tip: 'TAP = THROW INTO THEIR PAD. HOLD = BLOCK', icon: 'pietoss', hostAuth: true, needLand: true, needGap: true,
    start: function (A) {
      var P = A.players, hold = {}, score = [0, 0], cool = [0, 0], fly = null, finished = false, t = 0, LIMIT = 14;
      var seam = A.seam();
      seam.innerHTML = '<div class="fly" id="ptPie" hidden>' + pieSvg() + '</div>';
      var pieEl = seam.querySelector('#ptPie');
      P.forEach(function (i) {
        hold[i] = false;
        A.stage(i).innerHTML = '<span class="ng-hint">TAP THROW · HOLD BLOCK</span><div class="ng-hero">' + SD.art.face(i, 'idle') + '</div><div class="ng-shield"></div><b class="ng-score">0</b>';
        A.face(i, 'idle');
      });
      function setScore(i) { A.stage(i).querySelector('.ng-score').textContent = score[i]; }
      function placePie(from, to, u) {
        var a = A.padCenter(from), b = A.padCenter(to);
        var x = a.x + (b.x - a.x) * u, y = a.y + (b.y - a.y) * u;
        var lift = Math.sin(u * Math.PI) * 56;
        pieEl.hidden = false;
        pieEl.style.transform = 'translate(' + x + 'px,' + (y - lift) + 'px) rotate(' + (u * 260) + 'deg)';
      }
      A.onDown(function (i) {
        if (finished) return;
        hold[i] = true;
        A.stage(i).querySelector('.ng-shield').classList.add('on');
        A.face(i, 'worry');
        if (fly && fly.to === i && fly.u > 0.55) {
          fly = { from: i, to: 1 - i, u: 0, spd: Math.min(1.7, fly.spd + 0.12) };
          SD.audio.sfx.toss();
          return;
        }
        if (!fly && cool[i] <= 0) {
          cool[i] = 0.45;
          fly = { from: i, to: 1 - i, u: 0, spd: 1.15 };
          SD.audio.sfx.toss();
        }
      });
      A.onUp(function (i) {
        hold[i] = false;
        var sh = A.stage(i).querySelector('.ng-shield');
        if (sh) sh.classList.remove('on');
        if (!finished) A.face(i, 'idle');
      });
      function hit(who) {
        score[1 - who]++; setScore(1 - who);
        A.face(who, 'pied'); A.pop(who, 'SPLAT!', 'bad');
        SD.audio.sfx.boom();
        var c = SD.fx.center(A.padEl(who)); SD.fx.cream(c.x, c.y, 10);
        pieEl.hidden = true; fly = null;
        A.later(function () { if (!finished) A.face(who, 'idle'); }, 500);
        if (score[1 - who] >= 3) {
          finished = true;
          A.face(1 - who, 'cheer');
          A.later(function () {
            A.end(P.map(function (i) { return { p: score[i], label: score[i] + ' HITS' }; }));
          }, 700);
        }
      }
      A.frame(function (dt) {
        if (finished) return;
        t += dt;
        cool[0] = Math.max(0, cool[0] - dt); cool[1] = Math.max(0, cool[1] - dt);
        if (fly) {
          fly.u += fly.spd * dt;
          if (fly.u >= 1) {
            if (hold[fly.to]) {
              fly = { from: fly.to, to: fly.from, u: 0, spd: Math.min(1.7, fly.spd + 0.08) };
              SD.audio.sfx.coin();
            } else hit(fly.to);
          } else placePie(fly.from, fly.to, fly.u);
        }
        if (!finished && t > LIMIT) {
          finished = true;
          A.end(P.map(function (i) { return { p: score[i], label: score[i] + ' HITS' }; }));
        }
      });
    }
  });
})();
