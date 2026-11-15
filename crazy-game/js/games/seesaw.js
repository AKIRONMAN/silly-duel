/* SEE-SAW PIE: the plank sits in the gap between pads. HOLD your end down so the pie rolls onto them. */
(function () {
  'use strict';
  var INK = SD.art.INK, st = ' stroke="' + INK + '" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"';
  SD.art.addIcons({
    seesaw: '<path d="M8 40H56" fill="none"' + st + '/><path d="M32 40L24 56H40Z" fill="#2a1650"/><circle cx="20" cy="32" r="8" fill="#fffdf3"' + st.replace('4', '3') + '/>'
  });
  function pieSvg() {
    return '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="34" r="22" fill="#fffdf3"' + st + '/><circle cx="32" cy="34" r="8" fill="#ff3d5e"' + st.replace('4', '3') + '/><path d="M18 18Q32 8 46 18" fill="#ff8cc3"' + st + '/></svg>';
  }
  function lerp(a, b, t) { return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; }
  SD.games.push({
    id: 'seesaw', pack: 3, title: 'SEE-SAW PIE', tip: 'HOLD = WEIGH YOUR END. DUMP THE PIE ON THEM', icon: 'seesaw', hostAuth: true, needLand: true, needGap: true,
    start: function (A) {
      var P = A.players, pie = 0, hold = {}, finished = false, t = 0, LIMIT = 14;
      var seam = A.seam();
      seam.innerHTML = '<div class="seam-line plank" id="ssPlank"></div><div class="seam-dot" id="ssFul"></div><div class="fly" id="ssPie">' + pieSvg() + '</div>';
      P.forEach(function (i) {
        hold[i] = false;
        A.stage(i).innerHTML = '<span class="ng-hint">HOLD TO WEIGH</span><div class="ng-hero">' + SD.art.face(i, 'idle') + '</div>';
        A.face(i, 'idle');
      });
      var plank = seam.querySelector('#ssPlank'), ful = seam.querySelector('#ssFul'), pieEl = seam.querySelector('#ssPie');
      function layout() {
        var a = A.padCenter(0), b = A.padCenter(1);
        var dx = b.x - a.x, dy = b.y - a.y, len = Math.sqrt(dx * dx + dy * dy) || 1;
        var ang = Math.atan2(dy, dx) * 180 / Math.PI - 90;
        plank.style.height = len + 'px';
        plank.style.transform = 'translate(' + a.x + 'px,' + a.y + 'px) rotate(' + ang + 'deg)';
        var mid = lerp(a, b, 0.5);
        ful.style.transform = 'translate(' + mid.x + 'px,' + mid.y + 'px)';
        var p = lerp(a, b, (pie + 1) / 2);
        pieEl.style.transform = 'translate(' + p.x + 'px,' + p.y + 'px)';
      }
      layout();
      A.onDown(function (i) { if (!finished) { hold[i] = true; SD.audio.sfx.tap(); } });
      A.onUp(function (i) { hold[i] = false; });
      function dump(who) {
        if (finished) return; finished = true;
        A.face(who, 'pied'); A.face(1 - who, 'cheer');
        A.pop(who, 'DUMP!', 'bad'); SD.audio.sfx.boom();
        var c = SD.fx.center(A.padEl(who)); SD.fx.cream(c.x, c.y, 12); SD.fx.shake(320);
        A.later(function () {
          A.end(P.map(function (i) { return i === who ? { p: -1, label: 'DUMP' } : { p: 1, label: 'TILT' }; }));
        }, 800);
      }
      A.frame(function (dt) {
        if (finished) return;
        t += dt;
        var w0 = hold[0] ? 1.15 : 0.2, w1 = hold[1] ? 1.15 : 0.2;
        pie += (w0 - w1) * 0.85 * dt;
        pie *= (1 - 0.05 * dt);
        if (pie > 1) pie = 1; if (pie < -1) pie = -1;
        layout();
        if (pie >= 0.9) return dump(1);
        if (pie <= -0.9) return dump(0);
        if (t > LIMIT) {
          finished = true;
          var w = pie > 0 ? 0 : 1;
          A.end(P.map(function (i) { return { p: i === w ? 1 : 0, label: i === w ? 'TILT' : '' }; }));
        }
      });
    }
  });
})();
