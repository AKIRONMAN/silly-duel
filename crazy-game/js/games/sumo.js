/* SUMO BELLY: HOLD to brace, TAP to shove. First off the ring gets pied. */
(function () {
  'use strict';
  var INK = SD.art.INK, st = ' stroke="' + INK + '" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"';
  SD.art.addIcons({
    sumo: '<ellipse cx="32" cy="38" rx="20" ry="16" fill="#ffd84d"' + st + '/><circle cx="32" cy="18" r="10" fill="#ffd84d"' + st + '/><path d="M18 38H46M24 50L20 60M40 50L44 60" fill="none"' + st + '/>'
  });
  SD.games.push({
    id: 'sumo', pack: 3, title: 'SUMO BELLY', tip: 'HOLD = BRACE. TAP = SHOVE', icon: 'sumo', hostAuth: true,
    start: function (A) {
      var P = A.players, pos = 0, hold = {}, cool = {}, finished = false, t = 0, LIMIT = 14;
      P.forEach(function (i) {
        hold[i] = false; cool[i] = 0;
        A.stage(i).innerHTML = '<div class="duel sm"><span class="duel-hint">HOLD BRACE · TAP SHOVE</span>' +
          '<div class="sm-ring"></div><div class="sm-body you" data-who="riv"></div><div class="sm-body me" data-who="me"></div></div>';
      });
      function paint() {
        P.forEach(function (i) {
          var stg = A.stage(i), local = i === 0 ? pos : -pos;
          var me = stg.querySelector('[data-who="me"]'), riv = stg.querySelector('[data-who="riv"]');
          if (me) {
            me.classList.toggle('brace', !!hold[i]);
            me.innerHTML = SD.art.face(i, hold[i] ? 'worry' : 'idle');
            me.style.bottom = (16 - local * 10) + '%';
          }
          if (riv) {
            riv.classList.toggle('brace', !!hold[1 - i]);
            riv.innerHTML = SD.art.face(1 - i, hold[1 - i] ? 'worry' : 'idle');
            riv.style.top = (16 + local * 10) + '%';
          }
        });
      }
      paint();
      A.onDown(function (i) {
        if (finished) return;
        hold[i] = true;
        if (cool[i] > 0) return;
        cool[i] = 0.18;
        var power = hold[1 - i] ? 0.07 : 0.15;
        pos += (i === 0 ? 1 : -1) * power;
        SD.audio.sfx.toss(); paint();
      });
      A.onUp(function (i) { hold[i] = false; });
      function out(who) {
        if (finished) return; finished = true;
        P.forEach(function (i) { A.stage(i).querySelector('.duel').classList.add('sm-out'); });
        A.face(who, 'dizzy'); A.face(1 - who, 'cheer');
        A.pop(who, 'OUT!', 'bad'); SD.audio.sfx.bwoop(); SD.fx.shake(320);
        A.later(function () {
          A.end(P.map(function (i) { return i === who ? { p: -1, label: 'OUT' } : { p: 1, label: 'SHOVE' }; }));
        }, 900);
      }
      A.frame(function (dt) {
        if (finished) return;
        t += dt;
        P.forEach(function (i) { cool[i] = Math.max(0, cool[i] - dt); });
        pos += (hold[0] ? 0.08 : 0) * dt;
        pos -= (hold[1] ? 0.08 : 0) * dt;
        pos *= (1 - 0.08 * dt);
        if (pos > 1) pos = 1; if (pos < -1) pos = -1;
        paint();
        if (pos >= 0.9) return out(1);
        if (pos <= -0.9) return out(0);
        if (t > LIMIT) {
          finished = true;
          var w = Math.abs(pos) < 0.04 ? -1 : (pos > 0 ? 0 : 1);
          A.end(P.map(function (i) { return { p: i === w ? 1 : 0, label: i === w ? 'RING' : 'TIE' }; }));
        }
      });
    }
  });
})();
