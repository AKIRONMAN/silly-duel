/* HOT BOMB: tap to toss the bomb to the next player. Nobody knows when it goes off. */
(function () {
  'use strict';
  var INK = SD.art.INK;
  var BOMB = '<div class="bomb"><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="46" cy="58" r="34" fill="#3d2670" stroke="' + INK + '" stroke-width="5"/>' +
    '<ellipse cx="34" cy="46" rx="8" ry="12" fill="#fff" opacity=".35"/><path d="M66 32Q76 18 88 20" fill="none" stroke="' + INK + '" stroke-width="5" stroke-linecap="round"/>' +
    '<g class="spark"><path d="M90 6L93 15L102 18L93 21L90 30L87 21L78 18L87 15Z" fill="#ffd23f" stroke="' + INK + '" stroke-width="3" stroke-linejoin="round"/></g></svg></div>';

  SD.games.push({
    id: 'bomb', title: 'HOT BOMB', tip: 'PASS IT FAST!', icon: 'bomb', hostAuth: true,
    start: function (A) {
      var P = A.players, holder = P[Math.floor(A.rand() * P.length)], fuse = (6500 + A.rand() * 6000) * (1 - 0.3 * A.hard);
      var t0 = A.now(), received = t0, lastTick = 0, exploded = false;

      function render() {
        if ((A.bots || []).indexOf(holder) >= 0) {           // bot holds it: pass after a short think
          var h = holder;
          A.later(function () { if (!exploded && holder === h) A.tap(h); }, (260 + (1 - A.skill) * 520 + A.rand() * 280));
        }
        P.forEach(function (i) {
          var has = i === holder;
          A.stage(i).innerHTML = has ? BOMB : '<div class="wait">' + SD.art.icon('finger', 64) + '</div>';
          A.padEl(i).classList.toggle('hot', has);
          A.face(i, has ? 'worry' : 'idle');
        });
      }
      render();

      A.onDown(function (i) {
        if (exploded || i !== holder) return;
        var now = A.now(); if (now - received < 140) return;
        received = now;
        holder = P[(P.indexOf(i) + 1) % P.length];
        SD.audio.sfx.toss(); render();
      });

      A.frame(function (dt, now) {
        if (exploded) return;
        var el = now - t0, p = Math.min(1, el / fuse);
        var interval = 560 - p * 450;
        if (now - lastTick > interval) { lastTick = now; SD.audio.sfx.tick(1 + p * 1.1); }
        var st = A.stage(holder); if (st) st.style.setProperty('--p', p.toFixed(3));
        if (el >= fuse) boom();
      });

      var defused = {};
      function boom() {
        if (A.power(holder, 'defuse') && !defused[holder]) {   // power-up: first blast is defused and the bomb is passed on
          defused[holder] = true; var from = holder;
          A.used(from, 'defuse', 'DEFUSED!');
          holder = P[(P.indexOf(from) + 1) % P.length]; fuse = (A.now() - t0) + 2200 + A.rand() * 1800; received = A.now(); render(); return;
        }
        exploded = true;
        var st = A.stage(holder), c = SD.fx.center(st);
        st.innerHTML = '<div class="boom-word">KABOOM</div>';
        A.padEl(holder).classList.remove('hot');
        A.face(holder, 'pied');
        SD.audio.sfx.boom(); SD.fx.cream(c.x, c.y, 40); SD.fx.burst(c.x, c.y, 18); SD.fx.shake(520); SD.fx.flash('#fff3b0'); SD.fx.vibrate([60, 30, 140]);
        A.later(function () {
          A.end(P.map(function (i) { return i === holder ? { p: -1, label: 'BOOM' } : { p: 0, label: '' }; }));
        }, 900);
      }
    },
    cleanup: function () {}
  });
})();
