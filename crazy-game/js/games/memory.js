/* FACE MATCH: peek during 3-2-1, flip on GO. Match 2 or 3 of a kind. */
(function () {
  'use strict';
  var POOL = ['star', 'candy', 'note', 'cup', 'zap', 'spark', 'crown', 'eye', 'pie', 'bomb', 'bolt', 'trophy'];
  var M = null;
  SD.art.addIcons({
    memory: '<rect x="8" y="12" width="22" height="28" rx="5" fill="#fff" stroke="' + SD.art.INK + '" stroke-width="4"/><rect x="34" y="20" width="22" height="28" rx="5" fill="#ffd84d" stroke="' + SD.art.INK + '" stroke-width="4"/><circle cx="19" cy="26" r="4" fill="#ff8cc3"/>'
  });
  function shuffle(a, rand) {
    var i, j, t, b = a.slice();
    for (i = b.length - 1; i > 0; i--) { j = Math.floor(rand() * (i + 1)); t = b[i]; b[i] = b[j]; b[j] = t; }
    return b;
  }
  function makeGroups(rand) {
    var pool = shuffle(POOL, rand), groups = [], i, roll = rand();
    if (roll < 0.34) {
      for (i = 0; i < 6; i++) groups.push({ id: pool[i], n: 2 });
    } else if (roll < 0.72) {
      groups.push({ id: pool[0], n: 3 }, { id: pool[1], n: 3 });
      groups.push({ id: pool[2], n: 2 }, { id: pool[3], n: 2 }, { id: pool[4], n: 2 });
    } else {
      for (i = 0; i < 4; i++) groups.push({ id: pool[i], n: 3 });
    }
    return groups;
  }
  function flatten(groups) {
    var d = [], g, k;
    for (g = 0; g < groups.length; g++) for (k = 0; k < groups[g].n; k++) d.push(groups[g].id);
    return d;
  }
  function cardHtml(i, id, k, peek) {
    return '<button type="button" class="mem-card ng-hit' + (peek ? ' open' : ' back') + '" data-k="' + k + '">' +
      '<span class="mem-a">' + SD.art.face(i, 'idle') + '</span>' +
      '<span class="mem-b">' + SD.art.icon(id, 40) + '</span></button>';
  }
  function paint(A, peek) {
    A.players.forEach(function (i) {
      var hint = peek ? 'MEMORIZE!' : 'MATCH 2 OR 3';
      var cards = M.deck[i].map(function (id, k) { return cardHtml(i, id, k, peek); }).join('');
      A.stage(i).innerHTML = '<div class="mem-wrap"><div class="mem-head"><span class="ng-hint">' + hint +
        '</span><b class="ng-score">' + M.score[i] + '</b></div><div class="mem-grid">' + cards + '</div></div>';
      M.els[i] = A.stage(i).querySelectorAll('.mem-card');
      A.face(i, peek ? 'worry' : 'idle');
    });
  }
  function bind(A) {
    A.players.forEach(function (i) {
      if (A.mine && !A.mine(i)) return;
      Array.prototype.forEach.call(M.els[i], function (el) {
        el.addEventListener('pointerdown', function (e) {
          e.preventDefault(); e.stopPropagation();
          flip(A, i, +el.getAttribute('data-k'), false);
        });
      });
    });
  }
  function setScore(A, i) {
    var el = A.stage(i).querySelector('.ng-score');
    if (el) el.textContent = M.score[i];
  }
  function flip(A, i, k, fromNet) {
    var g = M, el = g.els[i][k], id = g.deck[i][k], need = g.need[id], a, n;
    if (g.finished || g.peek || g.lock[i] || !el) return;
    if (el.classList.contains('done') || el.classList.contains('open')) return;
    if (!fromNet && A.hit && (!A.mine || A.mine(i))) A.hit(k);
    el.classList.remove('back'); el.classList.add('open');
    g.open[i].push(k); SD.audio.sfx.tap();
    n = g.open[i].length;
    if (!g.open[i].every(function (idx) { return g.deck[i][idx] === id; })) {
      g.lock[i] = true; A.face(i, 'worry'); SD.audio.sfx.bwoop();
      a = g.open[i].slice();
      g.open[i] = [];
      A.later(function () {
        a.forEach(function (idx) {
          if (g.els[i][idx]) { g.els[i][idx].classList.add('back'); g.els[i][idx].classList.remove('open'); }
        });
        g.lock[i] = false;
        if (!g.finished) A.face(i, 'idle');
      }, 520);
      return;
    }
    if (n < need) return;
    g.open[i].forEach(function (idx) { g.els[i][idx].classList.add('done'); });
    g.score[i] += need;
    g.open[i] = [];
    setScore(A, i);
    A.face(i, 'cheer'); SD.audio.sfx.coin();
    A.pop(i, '+' + need, 'ha');
    A.later(function () { if (!g.finished) A.face(i, 'idle'); }, 280);
    if (g.score[i] >= 12) win(A, i);
  }
  function win(A, who) {
    if (M.finished) return; M.finished = true;
    A.face(who, 'cheer');
    A.players.forEach(function (i) { if (i !== who) A.face(i, 'dizzy'); });
    A.pop(who, 'CLEAR!', 'ha'); SD.audio.sfx.tada();
    A.later(function () {
      A.end(A.players.map(function (i) { return { p: M.score[i], label: M.score[i] + ' CARDS' }; }));
    }, 700);
  }
  function boot(A) {
    var groups = makeGroups(A.rand), need = {};
    groups.forEach(function (g) { need[g.id] = g.n; });
    M = {
      deck: {}, els: {}, open: {}, lock: {}, score: {}, need: need, peek: true, finished: false, t: 0, known: {}
    };
    A.players.forEach(function (i) {
      M.deck[i] = shuffle(flatten(groups), A.rand);
      M.open[i] = []; M.lock[i] = false; M.score[i] = 0; M.known[i] = {};
    });
    paint(A, true);
  }
  function botPlay(A, b) {
    function think() {
      if (!M || M.finished || M.peek) return;
      if (M.lock[b]) { A.later(think, 180); return; }
      var closed = [], k, id, need, have, pick = -1, map = {}, list;
      for (k = 0; k < M.els[b].length; k++) {
        if (M.els[b][k].classList.contains('done') || M.els[b][k].classList.contains('open')) continue;
        closed.push(k);
        id = M.deck[b][k];
        if (!map[id]) map[id] = [];
        map[id].push(k);
      }
      if (!closed.length) return;
      if (A.rand() < 0.22 + A.skill * 0.7) {
        for (id in map) {
          need = M.need[id]; have = (M.open[b].length && M.deck[b][M.open[b][0]] === id) ? M.open[b].length : 0;
          list = map[id];
          if (list.length && have + list.length >= need) { pick = list[0]; break; }
        }
      }
      if (pick < 0) pick = closed[Math.floor(A.rand() * closed.length)];
      flip(A, b, pick);
      A.later(think, 280 + (1 - A.skill) * 420);
    }
    A.later(think, 500);
  }
  SD.games.push({
    id: 'memory', pack: 2, title: 'FACE MATCH', tip: 'MEMORIZE ON 3-2-1. GO FLIPS THEM. MATCH 2 OR 3', icon: 'memory', peek: true,
    setup: function (A) { boot(A); },
    start: function (A) {
      if (!M) boot(A);
      M.peek = false; M.t = 0; M.finished = false;
      paint(A, false);
      bind(A);
      A.onHit(function (i, k) { flip(A, i, k, true); });
      A.onDown(function () {});
      (A.bots || []).forEach(function (b) { botPlay(A, b); });
      A.frame(function (dt) {
        if (!M || M.finished) return;
        M.t += dt;
        if (M.t > 32) {
          M.finished = true;
          A.end(A.players.map(function (i) { return { p: M.score[i], label: M.score[i] + ' CARDS' }; }));
        }
      });
    },
    cleanup: function () { M = null; }
  });
})();
