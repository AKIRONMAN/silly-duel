/* FREEZE!: hold to run to the finish. When the watcher turns around, let go at once.
   Move while she is looking and you get busted and sent back. Classic playground tension. */
(function () {
  'use strict';
  var INK = SD.art.INK;

  function watcher(state) {
    var hair = state === 'back' ? '#7a4fd6' : '#c9a7ff', st = ' stroke="' + INK + '" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"';
    var out = '<svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="18" r="13" fill="#7a4fd6"' + st + '/><circle cx="60" cy="66" r="42" fill="' + hair + '"' + st + '/>';
    if (state === 'back') {
      out += '<path d="M36 56Q60 38 84 56M32 76Q60 56 88 76" fill="none" stroke="#a37af0" stroke-width="5" stroke-linecap="round"/><path d="M52 100Q60 108 68 100" fill="none" stroke="#a37af0" stroke-width="5" stroke-linecap="round"/>';
    } else if (state === 'warn') {
      out += '<ellipse cx="42" cy="62" rx="10" ry="7" fill="#fff"' + st.replace('5', '3.5') + '/><ellipse cx="78" cy="62" rx="10" ry="7" fill="#fff"' + st.replace('5', '3.5') + '/>' +
        '<circle cx="37" cy="62" r="3.6" fill="' + INK + '"/><circle cx="73" cy="62" r="3.6" fill="' + INK + '"/>' +
        '<path d="M30 50H54M66 50H90M50 86H70" fill="none"' + st.replace('5', '4') + '/>';
    } else {
      out += '<circle cx="42" cy="62" r="13" fill="#fff"' + st.replace('5', '3.5') + '/><circle cx="78" cy="62" r="13" fill="#fff"' + st.replace('5', '3.5') + '/>' +
        '<circle cx="42" cy="62" r="6" fill="#ff4d6d"/><circle cx="78" cy="62" r="6" fill="#ff4d6d"/>' +
        '<path d="M26 42L54 52M94 42L66 52" fill="none"' + st.replace('5', '5') + '/>' +
        '<path d="M40 82Q60 104 80 82Z" fill="#fff"' + st.replace('5', '3.5') + '/><path d="M50 84V94M60 86V98M70 84V94" stroke="' + INK + '" stroke-width="2.5"/>';
    }
    return out + '</svg>';
  }

  SD.games.push({
    id: 'freeze', title: 'FREEZE!', tip: 'HOLD TO RUN. CAUGHT = START OVER', icon: 'eye',
    start: function (A) {
      var P = A.players, prog = {}, hold = {}, stun = {}, fin = {}, finished = false;
      P.forEach(function (i) {
        prog[i] = 0; hold[i] = false; stun[i] = 0;
        A.stage(i).innerHTML = '<div class="fr"><div class="fr-watch s-back">' + watcher('back') + '</div>' +
          '<div class="fr-track"><span class="fr-finish"></span><div class="fr-runner">' + SD.art.face(i, 'idle') + '</div></div></div>';
      });
      function runner(i) { return A.stage(i).querySelector('.fr-runner'); }
      function place(i) { var r = runner(i); r.style.bottom = (prog[i] * 100) + '%'; r.style.transform = 'translateY(' + (prog[i] * 100) + '%)'; }
      function setPhase(name) {
        P.forEach(function (i) {
          var w = A.stage(i).querySelector('.fr-watch');
          w.className = 'fr-watch s-' + name; w.innerHTML = watcher(name);
        });
      }

      /* bot: runs while the watcher looks away, lets go when she starts to warn (later when less skilled) */
      var B = {};
      (A.bots || []).forEach(function (i) { B[i] = { ph: '', t: 0, relAt: 0, prAt: 0.2, held: false }; });
      function botTick(dt) {
        (A.bots || []).forEach(function (i) {
          var b = B[i]; if (fin[i] != null) return;
          if (b.ph !== phase) {
            b.ph = phase; b.t = 0;
            if (phase === 'warn') b.relAt = (1 - A.skill) * 1.0 + A.rand() * 0.25;
            if (phase === 'back') b.prAt = 0.05 + (1 - A.skill) * A.rand() * 0.5;
          }
          b.t += dt;
          if (b.held && ((phase === 'warn' && b.t >= b.relAt) || (phase === 'look' && b.t > 0.02))) { b.held = false; A.release(i); }
          else if (!b.held && phase === 'back' && b.t >= b.prAt) { b.held = true; A.press(i); }
        });
      }

      var phase = 'back', pt = 0, dur = 1.1 + A.rand() * 0.7, lookAge = 0, tickT = 0, t = 0;

      function endNow() {
        A.end(P.map(function (i) {
          return { p: fin[i] != null ? 10 + (30 - fin[i]) : prog[i], label: fin[i] != null ? 'WIN' : Math.round(prog[i] * 100) + '%' };
        }));
      }
      function win(i) {
        fin[i] = t; runner(i).classList.remove('run');
        if (finished) return;
        finished = true;
        A.pop(i, 'FINISH!', 'ha'); A.face(i, 'cheer'); SD.audio.sfx.tada();
        A.later(endNow, 700);
      }
      var ghostUsed = {}, forgive = {};
      function caught(i) {
        if (A.power(i, 'ghost') && !ghostUsed[i]) { ghostUsed[i] = true; forgive[i] = true; A.used(i, 'ghost', 'FORGIVEN!'); return; }   // power-up: first bust is forgiven
        stun[i] = 1.0; prog[i] = 0; place(i);          // busted: back to the start line
        var r = runner(i); r.classList.remove('run'); r.classList.add('stun');
        A.face(i, 'dizzy'); A.pop(i, 'BUSTED!', 'bad');
        SD.audio.sfx.busted(); SD.fx.vibrate([40, 30, 60]);
      }

      A.onDown(function (i) {
        hold[i] = true;
        if (!stun[i] || stun[i] <= 0) runner(i).classList.add('run');
        SD.audio.sfx.tap();
      });
      A.onUp(function (i) { hold[i] = false; runner(i).classList.remove('run'); });

      A.frame(function (dt) {
        t += dt; pt += dt;
        botTick(dt);
        if (phase === 'look') lookAge += dt;
        if (phase === 'warn') { tickT += dt; if (tickT > 0.15) { tickT = 0; SD.audio.sfx.tick(1.3); } }
        if (pt >= dur) {
          pt = 0; lookAge = 0; tickT = 0;
          if (phase === 'back') { phase = 'warn'; dur = 0.65 * (1 - 0.4 * A.hard); }
          else if (phase === 'warn') { phase = 'look'; dur = 0.9 + A.rand() * 0.7; SD.audio.sfx.gasp(); SD.fx.flash('#ffb3c1'); }
          else { phase = 'back'; dur = (1.2 + A.rand() * 1.4) * (1 - 0.35 * A.hard); }
          setPhase(phase);
        }
        P.forEach(function (i) {
          if (fin[i] != null) return;
          if (stun[i] > 0) {
            stun[i] -= dt;
            if (stun[i] <= 0) { runner(i).classList.remove('stun'); A.face(i, 'idle'); if (hold[i]) runner(i).classList.add('run'); }
            return;
          }
          if (hold[i]) {
            if (phase !== 'look') forgive[i] = false;
            if (phase === 'look' && lookAge > 0.14 * (1 - 0.5 * A.hard) && !forgive[i]) { caught(i); if (!forgive[i]) return; }
            prog[i] = Math.min(1, prog[i] + dt * 0.115); place(i);
            if (prog[i] >= 1) win(i);
          }
        });
      });
      A.timer(19000, endNow);
    }
  });
})();
