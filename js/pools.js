/* Which games a match is made of, by level. Every game has a "pack" (default 1):
     pack 1 = the first 10 games (level 1+)      pack 2 = new games from level 20
     pack 3 = new games from level 30            pack 4 = the hardest games, level 45 (new era)
     pack 5 = the two trickiest games, level 48
   As you climb, the simple games (SIMPLE below) show up less and less, then disappear at level 30,
   and at level 48 only the hardest games are left. A game with no files yet is simply skipped, its
   share goes to the others. The same level is used on both phones online, so the deck is the same. */
(function () {
  'use strict';
  var UNLOCK = { 1: 1, 2: 20, 3: 30, 4: 45, 5: 48 };
  var SIMPLE = ['pinata', 'snack', 'beat', 'dodge'];

  function hardOf(level) { return Math.max(0, Math.min(1, ((level | 0) - 1) / 47)); }
  function pk(g) { return g.pack || 1; }

  function pool(level) {
    var avail = SD.games.filter(function (g) { return UNLOCK[pk(g)] <= level; });
    function of(p, simple) { return avail.filter(function (g) { return pk(g) === p && (simple == null || (SIMPLE.indexOf(g.id) >= 0) === simple); }); }
    var groups;
    if (level >= 48) groups = [[0.4, of(4)], [0.6, of(5)]];
    else if (level >= 45) groups = [[0.1, of(1, false)], [0.2, of(2)], [0.3, of(3)], [0.4, of(4)]];
    else if (level >= 30) groups = [[0.1, of(1, false)], [0.3, of(2)], [0.6, of(3)]];
    else if (level >= 20) groups = [[0.1, of(1, true)], [0.2, of(1, false)], [0.7, of(2)]];
    else groups = [[1, of(1)]];
    groups = groups.filter(function (g) { return g[1].length; });
    if (!groups.length) groups = [[1, avail.length ? avail : SD.games]];
    var tot = groups.reduce(function (a, g) { return a + g[0]; }, 0), out = [];
    groups.forEach(function (g) { g[1].forEach(function (x) { out.push({ g: x, w: g[0] / tot / g[1].length }); }); });
    return out;
  }

  function draw(list, rng) {                              // one weighted pick; rng() is 0..1
    var sum = list.reduce(function (a, x) { return a + x.w; }, 0), r = rng() * sum, i;
    for (i = 0; i < list.length; i++) { r -= list[i].w; if (r <= 0) return i; }
    return list.length - 1;
  }

  /* n games, no repeats while there are enough different ones */
  function deck(level, n, rng) {
    var base = pool(level), left = base.slice(), out = [];
    while (out.length < n) {
      if (!left.length) left = base.slice();
      var i = draw(left, rng); out.push(left[i].g); left.splice(i, 1);
    }
    return out;
  }
  function one(level, exclude, rng) {
    var list = pool(level).filter(function (x) { return x.g.id !== exclude; });
    if (!list.length) list = pool(level);
    return list[draw(list, rng)].g;
  }

  SD.pools = { hardOf: hardOf, pool: pool, deck: deck, one: one, UNLOCK: UNLOCK, SIMPLE: SIMPLE };
})();
