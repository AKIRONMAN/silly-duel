/* GREEDY PINATA: candy piles up in the pinata. Tap to grab what is there and keep it.
   Wait too long and it pops, and anyone who has not grabbed gets nothing. */
(function () {
  'use strict';
  var INK = SD.art.INK, CH = SD.art.CHARS;
  var PINATA = '<svg viewBox="0 -8 120 128" aria-hidden="true"><path d="M60 -6V10" stroke="' + INK + '" stroke-width="4" stroke-linecap="round"/>' +
    '<path d="M60 10L74 42L110 46L82 68L92 104L60 84L28 104L38 68L10 46L46 42Z" fill="var(--pf)" stroke="' + INK + '" stroke-width="5" stroke-linejoin="round"/>' +
    '<path d="M60 34L67 50L84 52L71 63L76 80L60 71L44 80L49 63L36 52L53 50Z" fill="#fff" opacity=".75"/>' +
    '<circle cx="51" cy="56" r="4" fill="' + INK + '"/><circle cx="69" cy="56" r="4" fill="' + INK + '"/><path d="M52 65Q60 73 68 65" fill="none" stroke="' + INK + '" stroke-width="3.5" stroke-linecap="round"/>' +
    '<path d="M30 104L25 116M60 86V100M90 104L95 116" stroke="#ff4d6d" stroke-width="5" stroke-linecap="round"/></svg>';

  SD.games.push({
    id: 'pinata', title: 'GREEDY PINATA', tip: 'GRAB BEFORE BOOM', icon: 'candy',
    start: function (A) {
      var P = A.players, banked = {}, exploded = false, popAt = (2.4 + A.rand() * 6.4) * (1 - 0.15 * A.hard) + 0.6, t0 = A.now(), lastTick = 0, lastPot = -1;
      P.forEach(function (i) {
        var rivals = P.filter(function (j) { return j !== i; }).map(function (j) {
          return '<span class="pn-r" data-j="' + j + '" style="--c:' + SD.art.padColor(j).fill + '">...</span>';
        }).join('');
        A.stage(i).innerHTML = '<div class="pn"><div class="pn-rivals">' + rivals + '</div><div class="pn-body">' + PINATA + '</div><b class="pn-pot">0</b></div>';
      });

      /* bot: grabs after a random wait, sometimes too greedy */
      (A.bots || []).forEach(function (b) {
        A.later(function () { A.tap(b); }, (1.4 + A.rand() * (2.4 + A.skill * 3.2)) * 1000);
      });

      function body(i) { return A.stage(i).querySelector('.pn-body'); }
      function potEl(i) { return A.stage(i).querySelector('.pn-pot'); }

      function boom() {
        if (exploded) return;
        exploded = true;
        SD.audio.sfx.boom(); SD.fx.shake(520); SD.fx.flash('#fff3b0');
        P.forEach(function (i) {
          var c = SD.fx.center(A.stage(i));
          SD.fx.confetti(c.x, c.y, 26, 0.8);
          body(i).style.visibility = 'hidden';
          if (banked[i] == null) {
            potEl(i).innerHTML = '<span class="boom-word">BOOM</span>';
            A.face(i, 'pied'); SD.fx.cream(c.x, c.y, 18);
          }
        });
        A.later(function () {
          A.end(P.map(function (i) { return banked[i] != null ? { p: banked[i], label: banked[i] + '' } : { p: -1, label: '' }; }));
        }, 1000);
      }

      A.onDown(function (i) {
        if (exploded || banked[i] != null) return;
        var pot = Math.floor((A.now() - t0) / 1000 * 20);
        if (A.power(i, 'gold')) { pot = Math.round(pot * 1.4); A.fx(i, 'gold', 'GOLDEN GRAB!'); }       // power-up: golden grab
        banked[i] = pot;
        var b = body(i); b.style.opacity = '.4'; b.style.transform = 'none';
        potEl(i).innerHTML = '<span class="pn-safe">SAFE ' + pot + '</span>';
        A.face(i, 'cheer'); A.pop(i, '+' + pot, 'ha'); SD.audio.sfx.coin();
        P.forEach(function (j) {
          if (j === i) return;
          var r = A.stage(j).querySelector('.pn-r[data-j="' + i + '"]'); if (r) r.textContent = pot;
        });
        if (P.every(function (j) { return banked[j] != null; })) A.later(boom, 450);
      });

      A.frame(function () {
        if (exploded) return;
        var t = (A.now() - t0) / 1000, pot = Math.floor(t * 20), k = Math.min(1, pot / 150);
        if (t >= popAt) return boom();
        var wob = Math.sin(t * 28) * k * 7, sc = 0.62 + k * 0.38;
        P.forEach(function (i) {
          if (banked[i] != null) return;
          body(i).style.transform = 'scale(' + sc + ') rotate(' + wob + 'deg)';
          if (pot !== lastPot) potEl(i).textContent = pot;
        });
        lastPot = pot;
        var interval = 0.45 - Math.min(0.3, t * 0.04);
        if (t - lastTick > interval) { lastTick = t; SD.audio.sfx.tick(1 + k * 0.8); }
      });
    }
  });
})();
