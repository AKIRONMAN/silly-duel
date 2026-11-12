/* PIE DODGE: tap a lane to hop. Dodge falling pies, catch candy. */
(function () {
  'use strict';
  var INK = SD.art.INK, st = ' stroke="' + INK + '" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"';
  SD.art.addIcons({
    piedodge: '<path d="M14 18L32 8L50 18" fill="none"' + st + '/><circle cx="32" cy="40" r="16" fill="#fffdf3"' + st + '/><path d="M20 30Q32 22 44 30" fill="#ff8cc3"' + st + '/>'
  });
  SD.games.push({
    id: 'piedodge', pack: 2, title: 'PIE DODGE', tip: 'TAP A LANE TO HOP. DODGE PIES. CATCH CANDY', icon: 'piedodge',
    start: function (A) {
      var P = A.players, G = {}, finished = false, t = 0, LIMIT = 16, spawnIn = 0.32;
      var umb = {};
      P.forEach(function (i) {
        A.stage(i).innerHTML = '<div class="dd-wrap"><div class="mem-head"><span class="ng-hint">DODGE PIES · CATCH SWEETS</span><b class="ng-score">0</b></div>' +
          '<div class="dd-track">' +
          '<button type="button" class="dd-lane ng-hit" data-k="0"></button>' +
          '<button type="button" class="dd-lane ng-hit" data-k="1"></button>' +
          '<button type="button" class="dd-lane ng-hit" data-k="2"></button>' +
          '<div class="dd-items"></div>' +
          '<div class="dd-hero">' + SD.art.face(i, 'idle') + '</div>' +
          '</div></div>';
        A.face(i, 'idle');
        G[i] = { lane: 1, items: [], score: 0, stun: 0, box: A.stage(i).querySelector('.dd-items'), hero: A.stage(i).querySelector('.dd-hero'), lanes: A.stage(i).querySelectorAll('.dd-lane') };
        placeHero(i, false);
        if (!A.mine || A.mine(i)) {
          Array.prototype.forEach.call(G[i].lanes, function (el) {
            el.addEventListener('pointerdown', function (e) {
              e.preventDefault(); e.stopPropagation();
              hop(i, +el.getAttribute('data-k'), true);
            });
          });
        }
      });
      A.live(function (slot, id) { if (id === 'umbrella' && G[slot]) umb[slot] = false; });
      function placeHero(i, hopped) {
        var g = G[i], n;
        if (!g || !g.hero) return;
        g.hero.style.left = ((g.lane + 0.5) / 3 * 100) + '%';
        for (n = 0; n < g.lanes.length; n++) g.lanes[n].classList.toggle('on', n === g.lane);
        g.hero.classList.toggle('stun', g.stun > 0);
        if (hopped) {
          g.hero.classList.remove('hop');
          void g.hero.offsetWidth;
          g.hero.classList.add('hop');
        }
      }
      function hop(i, lane, send) {
        if (finished || !G[i] || G[i].stun > 0) return;
        if (send && A.hit && (!A.mine || A.mine(i))) A.hit(lane);
        if (G[i].lane === lane) return;
        G[i].lane = lane;
        placeHero(i, true);
        SD.audio.sfx.toss();
      }
      function kind() {
        var r = A.rand();
        if (r < 0.5 + 0.06 * A.hard) return 'pie';
        if (r < 0.68 + 0.04 * A.hard) return 'bomb';
        if (r < 0.9) return 'candy';
        return 'star';
      }
      function spawn(i) {
        var g = G[i], lane = Math.floor(A.rand() * 3), id = kind();
        var last = g.items[g.items.length - 1];
        if (last && last.lane === lane && last.y < 0.28 && (id === 'pie' || id === 'bomb')) lane = (lane + 1 + Math.floor(A.rand() * 2)) % 3;
        var el = document.createElement('div');
        el.className = 'dd-fall';
        el.innerHTML = SD.art.icon(id, 40);
        g.box.appendChild(el);
        g.items.push({ lane: lane, y: -0.12, id: id, el: el, hit: false });
      }
      function addScore(i, n, label) {
        G[i].score = Math.max(0, G[i].score + n);
        A.stage(i).querySelector('.ng-score').textContent = G[i].score;
        if (label) A.pop(i, label, n > 0 ? 'ha' : 'bad');
      }
      A.onDown(function (i) { hop(i, (G[i].lane + 1) % 3, false); });
      A.onHit(function (i, k) { hop(i, k, false); });
      (A.bots || []).forEach(function (b) {
        function think() {
          if (finished || !G[b]) return;
          var g = G[b], best = g.lane, i, it, threat = false;
          for (i = 0; i < g.items.length; i++) {
            it = g.items[i];
            if (it.y < 0.48 || it.y > 0.9) continue;
            if (it.id === 'candy' || it.id === 'star') { best = it.lane; break; }
            if ((it.id === 'pie' || it.id === 'bomb') && it.lane === g.lane) { threat = true; best = (g.lane + 1) % 3; }
          }
          if (best !== g.lane && (threat || A.rand() < 0.28 + A.skill * 0.7)) hop(b, best);
          A.later(think, 80 + (1 - A.skill) * 220);
        }
        A.later(think, 380);
      });
      A.frame(function (dt) {
        if (finished) return;
        t += dt;
        spawnIn -= dt;
        if (spawnIn <= 0) {
          P.forEach(spawn);
          spawnIn = Math.max(0.32, (0.82 - t * 0.03) * (1 - 0.22 * A.hard));
        }
        P.forEach(function (i) {
          var g = G[i];
          if (g.stun > 0) { g.stun -= dt; if (g.stun <= 0) g.hero.classList.remove('stun'); }
          var keep = [];
          g.items.forEach(function (it) {
            it.y += (0.42 + t * 0.032 + A.hard * 0.08) * dt;
            it.el.style.left = ((it.lane + 0.5) / 3 * 100) + '%';
            it.el.style.top = (it.y * 100) + '%';
            var overlap = !it.hit && it.lane === g.lane && it.y > 0.72 && it.y < 0.92;
            if (overlap) {
              it.hit = true;
              if (it.id === 'candy' || it.id === 'star') {
                var pts = it.id === 'star' ? 35 : 18;
                addScore(i, pts, '+' + pts);
                A.face(i, 'cheer'); SD.audio.sfx.coin();
                A.later(function () { if (!finished && g.stun <= 0) A.face(i, 'idle'); }, 220);
              } else if (A.power(i, 'umbrella') && !umb[i]) {
                umb[i] = true; A.used(i, 'umbrella', 'BLOCKED!');
              } else {
                addScore(i, -16, 'SPLAT');
                g.stun = 0.35;
                g.hero.classList.add('stun');
                A.face(i, 'pied'); SD.audio.sfx.splat(); SD.fx.vibrate(30);
                var c = SD.fx.center(g.hero); SD.fx.cream(c.x, c.y, 12);
                A.later(function () { if (!finished) A.face(i, 'idle'); }, 360);
              }
              it.el.remove();
            } else if (it.y > 1.12) {
              it.el.remove();
            } else keep.push(it);
          });
          g.items = keep;
        });
        if (t > LIMIT) {
          finished = true;
          A.end(P.map(function (i) { return { p: G[i].score, label: G[i].score + ' PTS' }; }));
        }
      });
    }
  });
})();
