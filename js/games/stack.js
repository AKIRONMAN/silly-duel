/* STACK IT: a block slides left and right. Tap to drop it on the tower. The overhang is cut off,
   so the tower gets thinner. Build the highest tower. */
(function () {
  'use strict';
  var INK = SD.art.INK, st = ' stroke="' + INK + '" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"';
  SD.art.addIcons({
    tower: '<rect x="14" y="44" width="36" height="12" rx="3" fill="#6fcfff"' + st + '/><rect x="19" y="30" width="28" height="12" rx="3" fill="#ff7ab2"' + st + '/><rect x="22" y="16" width="20" height="12" rx="3" fill="#ffd84d"' + st + '/><path d="M10 8L18 14M54 8L46 14" fill="none"' + st + '/>'
  });
  var MAXL = 8, H = 10;   // levels to win, % height of a block
  SD.games.push({
    id: 'stack', title: 'STACK IT', tip: 'TAP TO DROP THE BLOCK', icon: 'tower',
    start: function (A) {
      var P = A.players, G = {}, finished = false, speed0 = (55 + A.rand() * 15) * (1 + 0.7 * A.hard);
      P.forEach(function (i) {
        G[i] = { x: 0, w: 50, bx: 0, bw: 50, dir: 1, lvl: 0, tx: 25, tw: 50, dead: false, glue: A.power(i, 'glue'), cool: 0, tol: 2 + (1 - A.skill) * 12 + A.rand() * 3 };
        G[i].bx = 5; G[i].dir = A.rand() < 0.5 ? 1 : -1;
        A.stage(i).innerHTML = '<div class="sk"><b class="sk-n">0</b><div class="sk-box"><div class="sk-base"></div><div class="sk-cur"></div></div></div>';
        place(i);
      });
      A.live(function (slot, id) { if (id === 'glue' && G[slot]) G[slot].glue = true; });
      function box(i) { return A.stage(i).querySelector('.sk-box'); }
      function place(i) {
        var g = G[i], cur = A.stage(i).querySelector('.sk-cur');
        cur.style.left = g.bx + '%'; cur.style.width = g.bw + '%'; cur.style.bottom = ((g.lvl + 1) * H) + '%'; cur.style.display = g.dead ? 'none' : '';
      }
      function score(i) { return G[i].lvl + G[i].tw / 100; }
      function done() {
        if (finished) return; finished = true;
        A.end(P.map(function (i) { return { p: score(i), label: G[i].lvl + ' HIGH' }; }));
      }
      function check() { if (P.every(function (j) { return G[j].dead; })) A.later(done, 800); }
      function stop(i, why) { G[i].dead = true; place(i); A.face(i, why ? 'cheer' : 'sad'); check(); }
      A.onDown(function (i) {
        var g = G[i]; if (finished || g.dead) return;
        var l = Math.max(g.bx, g.tx), r = Math.min(g.bx + g.bw, g.tx + g.tw), ov = r - l, perfect = Math.abs(g.bx - g.tx) < 2.2;
        if (perfect) { ov = g.tw; l = g.tx; }
        else if (g.glue && ov < g.tw - 0.1) { g.glue = false; ov = Math.max(ov, g.tw); l = g.tx; A.used(i, 'glue', 'GLUED!'); }   // power-up: super glue
        if (ov <= 1) {                                                       // missed completely: the block falls
          var f = document.createElement('div'); f.className = 'sk-blk fall'; f.style.left = g.bx + '%'; f.style.width = g.bw + '%'; f.style.bottom = ((g.lvl + 1) * H) + '%'; box(i).appendChild(f);
          SD.audio.sfx.bwoop(); A.pop(i, 'OOPS', 'bad'); return stop(i, false);
        }
        var b = document.createElement('div'); b.className = 'sk-blk'; b.style.left = l + '%'; b.style.width = ov + '%'; b.style.bottom = ((g.lvl + 1) * H) + '%'; box(i).appendChild(b);
        if (!perfect && !(ov >= g.tw)) {                                      // the cut-off piece falls away
          var cut = document.createElement('div'); cut.className = 'sk-blk fall'; cut.style.width = (g.bw - ov) + '%'; cut.style.left = (g.bx < g.tx ? g.bx : l + ov) + '%'; cut.style.bottom = ((g.lvl + 1) * H) + '%'; box(i).appendChild(cut);
        }
        g.lvl++; g.tx = l; g.tw = ov; g.bw = ov; g.bx = Math.max(0, Math.min(100 - ov, g.bx));
        A.stage(i).querySelector('.sk-n').textContent = g.lvl;
        if (perfect) { A.pop(i, 'PERFECT', 'ha'); SD.audio.sfx.perfect(); } else SD.audio.sfx.tap();
        if (g.lvl >= MAXL) { A.pop(i, 'TOP!', 'ha'); return stop(i, true); }
        place(i);
      });
      A.frame(function (dt) {
        P.forEach(function (i) {
          var g = G[i]; if (g.dead) return;
          g.bx += g.dir * (speed0 + g.lvl * 7) * dt;
          if (g.bx <= 0) { g.bx = 0; g.dir = 1; } else if (g.bx + g.bw >= 100) { g.bx = 100 - g.bw; g.dir = -1; }
          place(i);
        });
        (A.bots || []).forEach(function (b) {
          var g = G[b]; if (!g || g.dead) return; g.cool -= dt;
          if (g.cool <= 0 && Math.abs(g.bx - g.tx) < g.tol) { g.cool = 0.5; g.tol = 2 + (1 - A.skill) * 12 + A.rand() * 3; A.tap(b); }
        });
      });
      A.timer(16000, done);
    }
  });
})();
