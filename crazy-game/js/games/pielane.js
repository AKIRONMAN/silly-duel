/* PIE LANES: tap a lane, dodge falling pies with your face. Not a card game. Preview only. */
(function () {
  'use strict';
  var INK = SD.art.INK, st = ' stroke="' + INK + '" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"';
  function pieSvg() {
    return '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="34" r="22" fill="#fffdf3"' + st + '/><circle cx="32" cy="34" r="8" fill="#ff3d5e"' + st.replace('4', '3') + '/><path d="M18 18Q32 8 46 18" fill="#ff8cc3"' + st + '/></svg>';
  }
  SD.art.addIcons({
    pielane: '<rect x="8" y="8" width="14" height="48" rx="5" fill="#fff"' + st.replace('4', '3') + '/><rect x="25" y="8" width="14" height="48" rx="5" fill="#fff"' + st.replace('4', '3') + '/><rect x="42" y="8" width="14" height="48" rx="5" fill="#fff"' + st.replace('4', '3') + '/><circle cx="32" cy="44" r="8" fill="#ff8cc3"' + st.replace('4', '3') + '/>'
  });
  SD.games.push({
    id: 'pielane', pack: 3, title: 'PIE LANES', tip: 'TAP A LANE. KEEP YOUR FACE OFF THE PIES', icon: 'pielane',
    start: function (A) {
      var P = A.players, G = {}, finished = false, t = 0, LIMIT = 14, spawn = 0;
      P.forEach(function (i) {
        var lanes = '', k;
        for (k = 0; k < 3; k++) {
          lanes += '<button type="button" class="ln-lane ng-hit" data-k="' + k + '">' +
            (k === 1 ? '<div class="ln-hero">' + SD.art.face(i, 'idle') + '</div>' : '') +
            '</button>';
        }
        A.stage(i).innerHTML = '<div class="ln-wrap"><div class="mem-head"><span class="ng-hint">TAP A LANE</span><b class="ng-score">0</b></div><div class="ln-track">' + lanes + '</div></div>';
        G[i] = { lane: 1, score: 0, hit: 0, pies: [] };
        A.face(i, 'idle');
        Array.prototype.forEach.call(A.stage(i).querySelectorAll('.ln-lane'), function (el) {
          el.addEventListener('pointerdown', function (e) {
            e.preventDefault(); e.stopPropagation();
            hop(i, +el.getAttribute('data-k'));
          });
        });
      });
      function hero(i) { return A.stage(i).querySelector('.ln-hero'); }
      function hop(i, k) {
        if (finished || G[i].hit > 0) return;
        G[i].lane = k;
        var h = hero(i), lane = A.stage(i).querySelectorAll('.ln-lane')[k];
        if (h && lane) lane.appendChild(h);
        SD.audio.sfx.tap();
      }
      function addPie() {
        var blocked = Math.floor(A.rand() * 3);
        var n = A.rand() > 0.55 ? 2 : 1;
        var used = {};
        var c = 0;
        while (c < n) {
          var lane = Math.floor(A.rand() * 3);
          if (lane === blocked || used[lane]) continue;
          used[lane] = 1; c++;
          P.forEach(function (i) {
            var el = document.createElement('div');
            el.className = 'ln-pie';
            el.innerHTML = pieSvg();
            A.stage(i).querySelectorAll('.ln-lane')[lane].appendChild(el);
            G[i].pies.push({ lane: lane, y: -0.18, spd: 0.55 + t * 0.04, el: el, scored: false });
          });
        }
      }
      A.onDown(function () {});
      addPie();
      A.frame(function (dt) {
        if (finished) return;
        t += dt; spawn += dt;
        if (spawn > Math.max(0.55, 0.95 - t * 0.03)) { spawn = 0; addPie(); }
        P.forEach(function (i) {
          var g = G[i];
          if (g.hit > 0) { g.hit -= dt; if (g.hit <= 0) A.face(i, 'idle'); }
          g.pies = g.pies.filter(function (p) {
            p.y += p.spd * dt;
            p.el.style.top = (p.y * 100) + '%';
            if (!p.scored && p.y > 0.74 && p.y < 0.96 && p.lane === g.lane && g.hit <= 0) {
              g.hit = 0.45; A.face(i, 'pied'); A.pop(i, 'SPLAT!', 'bad');
              SD.audio.sfx.boom();
              var c = SD.fx.center(A.padEl(i)); SD.fx.cream(c.x, c.y, 8);
              p.el.remove();
              return false;
            }
            if (p.y > 0.78 && !p.scored && p.lane !== g.lane) {
              p.scored = true; g.score++;
              A.stage(i).querySelector('.ng-score').textContent = g.score;
            }
            if (p.y > 1.15) { p.el.remove(); return false; }
            return true;
          });
        });
        if (t > LIMIT) {
          finished = true;
          A.end(P.map(function (i) { return { p: G[i].score, label: G[i].score + ' DODGE' }; }));
        }
      });
    }
  });
})();
