/* PIE VOLLEY: the pie flies pad to pad. TAP when it enters your pad to smack it back. Miss = splat. */
(function () {
  'use strict';
  var INK = SD.art.INK, st = ' stroke="' + INK + '" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"';
  SD.art.addIcons({
    volley: '<circle cx="32" cy="32" r="14" fill="#fffdf3"' + st + '/><path d="M12 32H22M42 32H52" fill="none"' + st + '/>'
  });
  function pieSvg() {
    return '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="34" r="22" fill="#fffdf3"' + st + '/><circle cx="32" cy="34" r="8" fill="#ff3d5e"' + st.replace('4', '3') + '/><path d="M18 18Q32 8 46 18" fill="#ff8cc3"' + st + '/></svg>';
  }
  SD.games.push({
    id: 'volley', pack: 3, title: 'PIE VOLLEY', tip: 'TAP WHEN THE PIE ENTERS YOUR PAD TO SMACK IT BACK', icon: 'volley', hostAuth: true, needLand: true, needGap: true,
    start: function (A) {
      var P = A.players, hits = [0, 0], to = A.rand() > 0.5 ? 1 : 0, u = 0, spd = 0.85, cool = [0, 0], finished = false, t = 0, LIMIT = 14;
      var seam = A.seam();
      seam.innerHTML = '<div class="fly" id="vlPie">' + pieSvg() + '</div>';
      var pieEl = seam.querySelector('#vlPie');
      P.forEach(function (i) {
        A.stage(i).innerHTML = '<span class="ng-hint">TAP TO RETURN</span><div class="ng-hero">' + SD.art.face(i, 'idle') + '</div><b class="ng-score">0</b>';
        A.face(i, 'idle');
      });
      function place(from, dest, v) {
        var a = A.padCenter(from), b = A.padCenter(dest);
        var x = a.x + (b.x - a.x) * v, y = a.y + (b.y - a.y) * v;
        var lift = Math.sin(v * Math.PI) * 48;
        pieEl.style.transform = 'translate(' + x + 'px,' + (y - lift) + 'px) rotate(' + (v * 220) + 'deg)';
      }
      A.onDown(function (i) {
        if (finished || cool[i] > 0) return;
        if (to === i && u > 0.42) {
          hits[i]++; A.stage(i).querySelector('.ng-score').textContent = hits[i];
          to = 1 - i; u = 0; spd = Math.min(1.65, spd + 0.1);
          cool[i] = 0.2; A.face(i, 'cheer');
          SD.audio.sfx.toss();
          A.later(function () { if (!finished) A.face(i, 'idle'); }, 220);
        }
      });
      A.onUp(function () {});
      function miss(who) {
        if (finished) return; finished = true;
        A.face(who, 'pied'); A.face(1 - who, 'cheer');
        A.pop(who, 'MISS!', 'bad'); SD.audio.sfx.boom();
        var c = SD.fx.center(A.padEl(who)); SD.fx.cream(c.x, c.y, 12); SD.fx.shake(300);
        A.later(function () {
          A.end(P.map(function (i) { return { p: hits[i] + (i === who ? 0 : 1), label: hits[i] + ' RETURNS' }; }));
        }, 800);
      }
      A.frame(function (dt) {
        if (finished) return;
        t += dt;
        cool[0] = Math.max(0, cool[0] - dt); cool[1] = Math.max(0, cool[1] - dt);
        u += spd * dt;
        var from = 1 - to;
        if (u >= 1) return miss(to);
        place(from, to, u);
        if (t > LIMIT) {
          finished = true;
          A.end(P.map(function (i) { return { p: hits[i], label: hits[i] + ' RETURNS' }; }));
        }
      });
    }
  });
})();
