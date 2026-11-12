/* Which games a match is made of, by level. Every game has a "pack" (default 1):
     pack 1 = the first 10 games (level 1+)      pack 2 = the extra 5, also from level 1
     pack 3 = new games from level 30            pack 4 = the hardest games, level 45 (new era)
     pack 5 = the two trickiest games, level 48
   Simple games show up a bit more at low levels. The same level is used on both phones
   online, so the deck is the same. Local matches also skip games you just played. */
(function () {
  'use strict';
  var UNLOCK = { 1: 1, 2: 1, 3: 30, 4: 45, 5: 48 };
  var SIMPLE = ['pinata', 'snack', 'beat', 'dodge', 'piedodge', 'whack'];

  function hardOf(level) { return Math.max(0, Math.min(1, ((level | 0) - 1) / 47)); }
  function pk(g) { return g.pack || 1; }

  function unique(list) {
    var seen = {}, out = [];
    list.forEach(function (x) {
      var id = x.g && x.g.id;
      if (!id || seen[id]) return;
      seen[id] = 1; out.push(x);
    });
    return out;
  }
  function bias(list, seen) {
    if (!seen || typeof seen !== 'object') return list;
    return list.map(function (x) {
      var c = seen[x.g.id] | 0;
      return { g: x.g, w: x.w / (1 + c) };
    });
  }

  function pool(level) {
    var avail = SD.games.filter(function (g) { return g && g.id && g.start && UNLOCK[pk(g)] <= level; });
    function of(p, simple) { return avail.filter(function (g) { return pk(g) === p && (simple == null || (SIMPLE.indexOf(g.id) >= 0) === simple); }); }
    var groups;
    if (level >= 48) groups = [[0.4, of(4)], [0.6, of(5)]];
    else if (level >= 45) groups = [[0.1, of(1, false)], [0.2, of(2)], [0.3, of(3)], [0.4, of(4)]];
    else if (level >= 30) groups = [[0.1, of(1, false)], [0.3, of(2)], [0.6, of(3)]];
    else if (level >= 20) groups = [[0.1, of(1, true)], [0.2, of(1, false)], [0.7, of(2)]];
    else groups = [[0.32, of(1, true)], [0.38, of(1, false)], [0.3, of(2)]];
    groups = groups.filter(function (g) { return g[1].length; });
    if (!groups.length) groups = [[1, avail.length ? avail : SD.games.filter(function (g) { return g && g.start; })]];
    var tot = groups.reduce(function (a, g) { return a + g[0]; }, 0), out = [];
    groups.forEach(function (g) { g[1].forEach(function (x) { out.push({ g: x, w: g[0] / tot / g[1].length }); }); });
    return unique(out);
  }

  function draw(list, rng) {                              // one weighted pick; rng() is 0..1
    var sum = list.reduce(function (a, x) { return a + x.w; }, 0), r = rng() * sum, i;
    for (i = 0; i < list.length; i++) { r -= list[i].w; if (r <= 0) return i; }
    return list.length - 1;
  }

  /* n games, no repeats while there are enough different ones */
  function deck(level, n, rng, seen) {
    var base = bias(pool(level), seen), left = base.slice(), out = [], used = {};
    while (out.length < n) {
      if (!left.length) { left = base.slice(); used = {}; }
      var i = draw(left, rng), g = left[i].g;
      left.splice(i, 1);
      if (used[g.id]) continue;
      used[g.id] = 1;
      out.push(g);
    }
    return out;
  }
  function one(level, exclude, rng, seen) {
    var skip = {};
    if (typeof exclude === 'string') skip[exclude] = 1;
    else if (Array.isArray(exclude)) exclude.forEach(function (id) { if (id) skip[id] = 1; });
    var list = bias(pool(level).filter(function (x) { return !skip[x.g.id]; }), seen);
    if (!list.length) list = bias(pool(level), seen);
    return list[draw(list, rng)].g;
  }

  SD.pools = { hardOf: hardOf, pool: pool, deck: deck, one: one, UNLOCK: UNLOCK, SIMPLE: SIMPLE };
})();
