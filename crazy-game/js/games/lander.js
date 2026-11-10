/* MOON LANDING (level 20 pack): hold to fire the engine and land softly on three planets in a row. Fuel is shared by all three. */
(function () {
  'use strict';
  var INK = SD.art.INK, st = ' stroke="' + INK + '" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"';
  SD.art.addIcons({
    lander: '<path d="M18 30Q18 10 32 10Q46 10 46 30Z" fill="#fff"' + st + '/><rect x="16" y="30" width="32" height="12" rx="4" fill="#ffd84d"' + st + '/><path d="M20 42L12 56M44 42L52 56M8 56H18M46 56H56" fill="none"' + st + '/>',
    p_tank: '<rect x="14" y="14" width="32" height="42" rx="7" fill="#ff7a59"' + st + '/><path d="M46 24H54V38H46M22 8H38V14H22" fill="none"' + st + '/><path d="M24 38L30 26L36 38" fill="#fff"' + st + '/>'
  });
  var PLANETS = [['MOON', 14], ['MARS', 20], ['JUPITER', 26]], A0 = 58, BURN = 34, REFILL = 35, DT = 0.8;
  SD.games.push({
    id: 'lander', pack: 2, title: 'MOON LANDING', tip: 'HOLD = ENGINE. LAND SOFTLY, SAVE FUEL', icon: 'lander',
    start: function (A) {
      var P = A.players, G = {}, finished = false, hard = A.hard, SAFE = 14 * (1 - 0.15 * hard), k;
      P.forEach(function (i) {
        var cap = 100 * (A.power(i, 'tank') ? 1.4 : 1), s = A.stage(i);
        s.innerHTML = '<div class="ln"><b class="ln-p">MOON</b><div class="ln-fuel"><i></i></div><div class="ln-spd"><i></i></div><div class="ln-ship"><svg class="ln-hull" viewBox="0 0 100 120"><path d="M30 78L8 108L8 84L24 60Z M70 78L92 108L92 84L76 60Z" fill="#ff4d6d" stroke="#2a1650" stroke-width="4" stroke-linejoin="round"/><path d="M50 4Q86 28 80 84L72 98H28L20 84Q14 28 50 4Z" fill="#eef2ff" stroke="#2a1650" stroke-width="4" stroke-linejoin="round"/><path d="M26 92H74" stroke="#2a1650" stroke-width="4" stroke-linecap="round"/><path d="M36 20Q44 12 52 10" stroke="#fff" stroke-width="5" stroke-linecap="round" fill="none"/><circle cx="50" cy="52" r="26" fill="#8fd8ff" stroke="#2a1650" stroke-width="4"/><rect x="38" y="98" width="24" height="10" rx="3" fill="#6f7aa8" stroke="#2a1650" stroke-width="3"/></svg><span class="ln-face"></span><span class="ln-fire"></span></div><div class="ln-ground"></div></div>';
        G[i] = { r: 0, y: 100, vy: 0, fuel: cap, cap: cap, held: false, lands: 0, ph: 'wait', wait: 0.5, dead: false, fin: false, el: s.querySelector('.ln-ship'), face: s.querySelector('.ln-face'), fire: s.querySelector('.ln-fire'), pn: s.querySelector('.ln-p'), fu: s.querySelector('.ln-fuel i'), sp: s.querySelector('.ln-spd i'), m: 1 };
        G[i].face.innerHTML = SD.art.face(i, 'idle'); setup(i);
      });
      A.live(function (slot, id) { var g = G[slot]; if (id === 'tank' && g) { g.cap *= 1.4; g.fuel = Math.min(g.cap, g.fuel + 40); } });
      function grav(g) { return PLANETS[g.r][1] * (1 + 0.2 * hard); }
      function setup(i) {
        var g = G[i]; g.y = 100; g.vy = -A.rand() * 8; g.ph = 'wait'; g.wait = DT; g.el.parentNode.setAttribute('data-p', g.r); g.pn.textContent = PLANETS[g.r][0] + ' ' + (g.r + 1) + '/3'; g.m = 1 + (1 - A.skill) * 1.2 * (A.rand() - 0.4);
      }
      A.onDown(function (i) { G[i].held = true; });
      A.onUp(function (i) { G[i].held = false; });
      function score(i) { return G[i].lands * 100 + Math.max(0, G[i].fuel) * 0.3; }
      function done() { if (finished) return; finished = true; A.end(P.map(function (i) { return { p: score(i), label: G[i].lands + '/3 LANDED' }; })); }
      function check() { if (P.every(function (j) { return G[j].fin; })) A.later(done, 600); }
      A.frame(function (dt) {
        P.forEach(function (i) {
          var g = G[i]; if (g.fin) return;
          if (g.ph === 'wait') { g.wait -= dt; if (g.wait <= 0) g.ph = 'fly'; draw(g, false); return; }
          if (g.ph === 'over') { g.wait -= dt; if (g.wait <= 0) { if (g.dead || g.r >= 3) { g.fin = true; check(); } else setup(i); } return; }
          var G0 = grav(g), net = A0 - G0, on;
          if ((A.bots || []).indexOf(i) >= 0) {
            var stop = g.vy < 0 ? (g.vy * g.vy - SAFE * SAFE * 0.5) / (2 * net) : 0, want = g.y <= stop * g.m + 1 && g.fuel > 0 && -g.vy > SAFE * 0.4;
            if (want !== g.held) { g.held = want; if (want) A.press(i); else A.release(i); }
          }
          on = g.held && g.fuel > 0;
          g.vy += (on ? net : -G0) * dt; if (on) g.fuel -= BURN * dt; g.y += g.vy * dt;
          if (g.y > 140) { g.y = 140; g.vy = Math.min(g.vy, 0); }
          if (g.y <= 0) {
            g.y = 0; g.ph = 'over'; g.wait = 1.3; g.held = false; g.fire.classList.remove('on');
            if (-g.vy <= SAFE) { g.lands++; g.r++; g.fuel = Math.min(g.cap, g.fuel + REFILL); A.face(i, 'cheer'); A.pop(i, g.r >= 3 ? 'ALL 3!' : 'LANDED!', 'ha'); SD.audio.sfx.coin(); }
            else { g.dead = true; g.el.classList.add('crash'); A.face(i, 'dizzy'); A.pop(i, 'CRASH!', 'bad'); SD.audio.sfx.boom(); SD.fx.vibrate([40, 30, 80]); }
            g.r = g.dead ? g.r : g.r; if (g.r >= 3 && !g.dead) g.ph = 'over';
          }
          draw(g, on);
        });
      });
      function draw(g, on) {
        g.el.style.bottom = (8 + Math.max(0, Math.min(100, g.y)) * 0.46) + '%'; g.el.classList.toggle('high', g.y > 100); g.fire.classList.toggle('on', !!on);
        g.fu.style.height = Math.max(0, Math.min(100, g.fuel / g.cap * 100)) + '%'; var s = Math.max(0, -g.vy);
        g.sp.style.height = Math.min(100, s / (SAFE * 3) * 100) + '%'; g.sp.className = s <= SAFE ? 'ok' : 'bad';
      }
    }
  });
})();
