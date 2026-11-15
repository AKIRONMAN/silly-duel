/* BALLOON BETWEEN: balloon lives in the gap. HOLD to blow it into their pad, TAP to poke. */
(function () {
  'use strict';
  var INK = SD.art.INK, st = ' stroke="' + INK + '" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"';
  SD.art.addIcons({
    balloon: '<ellipse cx="32" cy="28" rx="16" ry="20" fill="#ff8cc3"' + st + '/><path d="M32 48L32 58M26 58H38" fill="none"' + st + '/>'
  });
  function lerp(a, b, t) { return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; }
  SD.games.push({
    id: 'balloon', pack: 3, title: 'BALLOON BETWEEN', tip: 'HOLD = BLOW IT INTO THEIR PAD. TAP = POKE', icon: 'balloon', hostAuth: true, needGap: true,
    start: function (A) {
      var P = A.players, x = 0, size = 0.7, hold = {}, finished = false, t = 0, LIMIT = 12;
      var seam = A.seam();
      seam.innerHTML = '<div class="fly balloon" id="blBall"><i></i></div>';
      var el = seam.querySelector('#blBall');
      P.forEach(function (i) {
        hold[i] = false;
        A.stage(i).innerHTML = '<span class="ng-hint">HOLD BLOW · TAP POKE</span><div class="ng-hero">' + SD.art.face(i, 'idle') + '</div>';
        A.face(i, 'idle');
      });
      function layout() {
        var a = A.padCenter(0), b = A.padCenter(1);
        var p = lerp(a, b, (x + 1) / 2);
        var s = 0.7 + size * 0.55;
        el.style.transform = 'translate(' + p.x + 'px,' + p.y + 'px) scale(' + s + ')';
      }
      layout();
      A.onDown(function (i) {
        if (finished) return;
        hold[i] = true;
        x += (i === 0 ? 1 : -1) * 0.1;
        A.face(i, 'worry'); SD.audio.sfx.tap();
      });
      A.onUp(function (i) { hold[i] = false; if (!finished) A.face(i, 'idle'); });
      function popOn(who) {
        if (finished) return; finished = true;
        A.face(who, 'pied'); A.face(1 - who, 'cheer');
        A.pop(who, 'POP!', 'bad'); SD.audio.sfx.boom();
        var c = SD.fx.center(A.padEl(who)); SD.fx.burst(c.x, c.y, 12, ['#ff8cc3', '#fff', '#ffd84d']);
        el.hidden = true;
        A.later(function () {
          A.end(P.map(function (i) { return i === who ? { p: -1, label: 'POP' } : { p: 1, label: 'BLOW' }; }));
        }, 800);
      }
      A.frame(function (dt) {
        if (finished) return;
        t += dt; size = Math.min(1.2, size + dt * 0.03);
        P.forEach(function (i) { if (hold[i]) x += (i === 0 ? 1 : -1) * 0.48 * dt; });
        x *= (1 - 0.05 * dt);
        if (x > 1) x = 1; if (x < -1) x = -1;
        layout();
        if (x >= 0.88) return popOn(1);
        if (x <= -0.88) return popOn(0);
        if (size >= 1.18 && Math.abs(x) < 0.18) return popOn(x >= 0 ? 1 : 0);
        if (t > LIMIT) {
          finished = true;
          var w = x > 0 ? 0 : 1;
          A.end(P.map(function (i) { return { p: i === w ? 1 : 0, label: i === w ? 'AIR' : '' }; }));
        }
      });
    }
  });
})();
