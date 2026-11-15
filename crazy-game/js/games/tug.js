/* TUG FACE: rope in the gap. TAP or HOLD to pull the pie onto the other pad. */
(function () {
  'use strict';
  var INK = SD.art.INK, st = ' stroke="' + INK + '" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"';
  SD.art.addIcons({
    tug: '<circle cx="18" cy="32" r="12" fill="#6fcfff"' + st + '/><circle cx="46" cy="32" r="12" fill="#ff8cc3"' + st + '/><path d="M28 32H36" fill="none"' + st + '/><circle cx="32" cy="32" r="6" fill="#fffdf3"' + st.replace('4', '3') + '/>'
  });
  function pieSvg() {
    return '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="34" r="22" fill="#fffdf3"' + st + '/><circle cx="32" cy="34" r="8" fill="#ff3d5e"' + st.replace('4', '3') + '/><path d="M18 18Q32 8 46 18" fill="#ff8cc3"' + st + '/></svg>';
  }
  function lerp(a, b, t) { return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; }
  SD.games.push({
    id: 'tug', pack: 3, title: 'TUG FACE', tip: 'TAP OR HOLD TO PULL THE PIE ONTO THEM', icon: 'tug', hostAuth: true, needGap: true,
    start: function (A) {
      var P = A.players, pos = 0, hold = {}, finished = false, t = 0, LIMIT = 12;
      var seam = A.seam();
      seam.innerHTML = '<div class="seam-line" id="tgRope"></div><div class="fly" id="tgPie">' + pieSvg() + '</div>';
      var rope = seam.querySelector('#tgRope'), pieEl = seam.querySelector('#tgPie');
      P.forEach(function (i) {
        hold[i] = false;
        A.stage(i).innerHTML = '<span class="ng-hint">TAP / HOLD = PULL</span><div class="ng-hero">' + SD.art.face(i, 'idle') + '</div>';
        A.face(i, 'idle');
      });
      function layout() {
        var a = A.padCenter(0), b = A.padCenter(1);
        var dx = b.x - a.x, dy = b.y - a.y, len = Math.sqrt(dx * dx + dy * dy) || 1;
        var ang = Math.atan2(dy, dx) * 180 / Math.PI - 90;
        rope.style.height = len + 'px';
        rope.style.transform = 'translate(' + a.x + 'px,' + a.y + 'px) rotate(' + ang + 'deg)';
        var p = lerp(a, b, (pos + 1) / 2);
        pieEl.style.transform = 'translate(' + p.x + 'px,' + p.y + 'px)';
      }
      layout();
      A.onDown(function (i) {
        if (finished) return;
        hold[i] = true;
        pos += (i === 0 ? 1 : -1) * 0.07;
        A.face(i, 'worry'); SD.audio.sfx.tap();
      });
      A.onUp(function (i) { hold[i] = false; if (!finished) A.face(i, 'idle'); });
      function lose(who) {
        if (finished) return; finished = true;
        A.face(who, 'pied'); A.face(1 - who, 'cheer');
        A.pop(who, 'PIED!', 'bad'); SD.audio.sfx.boom();
        var c = SD.fx.center(A.padEl(who)); SD.fx.cream(c.x, c.y, 12); SD.fx.shake(320);
        A.later(function () {
          A.end(P.map(function (i) { return i === who ? { p: -1, label: 'PIED' } : { p: 1, label: 'YANK' }; }));
        }, 800);
      }
      A.frame(function (dt) {
        if (finished) return;
        t += dt;
        P.forEach(function (i) { if (hold[i]) pos += (i === 0 ? 1 : -1) * 0.55 * dt; });
        pos *= (1 - 0.1 * dt);
        if (pos > 1) pos = 1; if (pos < -1) pos = -1;
        layout();
        if (pos >= 0.9) return lose(1);
        if (pos <= -0.9) return lose(0);
        if (t > LIMIT) {
          finished = true;
          var w = pos > 0 ? 0 : 1;
          A.end(P.map(function (i) { return { p: i === w ? 1 : 0, label: i === w ? 'PULL' : '' }; }));
        }
      });
    }
  });
})();
