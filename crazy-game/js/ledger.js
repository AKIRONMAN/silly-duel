/* Match, coin and point log. CrazyGames keeps it in the local/CG save.
   The web build copies it to Firestore (hm/hc/hp on the save doc) and reads it back. */
window.SD = window.SD || {};
(function () {
  'use strict';
  var KEY = 'sd_ledger', MAX = 80;

  function load() {
    var o = { m: [], c: [], p: [] };
    try {
      var raw = SD.store && SD.store.extraGet ? SD.store.extraGet(KEY) : localStorage.getItem(KEY);
      var n = JSON.parse(raw || '{}');
      if (n && typeof n === 'object') {
        if (Array.isArray(n.m)) o.m = n.m;
        if (Array.isArray(n.c)) o.c = n.c;
        if (Array.isArray(n.p)) o.p = n.p;
        if ((!o.c.length) && Array.isArray(n.b)) {
          o.c = n.b.map(function (r) {
            return { t: r.t | 0, n: -(Math.abs(r.c | 0)), bal: r.bal | 0, why: String(r.k || 'BUY').toUpperCase(), name: r.n || '', opp: '' };
          });
        }
      }
    } catch (e) {}
    return o;
  }
  function save(o) {
    try {
      var t = JSON.stringify(o);
      if (SD.store && SD.store.extraSet) SD.store.extraSet(KEY, t);
      else localStorage.setItem(KEY, t);
    } catch (e) {}
  }
  function cap(a) { if (a.length > MAX) a.splice(0, a.length - MAX); }
  function who() {
    try {
      if (SD.cg && SD.cg.user && SD.cg.user.username) return String(SD.cg.user.username).slice(0, 16);
    } catch (e) {}
    try { return (SD.store && SD.store.name(0)) || 'GUEST'; } catch (e) { return 'GUEST'; }
  }
  function push(list, row) {
    var o = load();
    o[list].push(row);
    cap(o[list]);
    save(o);
  }
  function packList(arr, map) {
    var out = [], i, r;
    for (i = 0; i < arr.length; i++) { r = map(arr[i]); if (r) out.push(r); }
    return out.slice(-MAX);
  }

  SD.ledger = {
    logMatch: function (row) {
      if (!row) return;
      push('m', {
        t: Date.now(),
        w: !!row.won,
        opp: String(row.opp || 'RIVAL').slice(0, 16),
        who: who()
      });
    },
    logCoins: function (row) {
      if (!row || !(row.n | 0)) return;
      push('c', {
        t: Date.now(),
        n: row.n | 0,
        bal: row.bal | 0,
        why: String(row.why || 'PLAY').slice(0, 10),
        name: String(row.name || '').slice(0, 22),
        opp: String(row.opp || '').slice(0, 16)
      });
    },
    logPts: function (row) {
      if (!row || !(row.n | 0)) return;
      push('p', {
        t: Date.now(),
        n: row.n | 0,
        xp: row.xp | 0,
        lvl: row.lvl | 0,
        opp: String(row.opp || '').slice(0, 16)
      });
    },
    logBuy: function (row) {
      if (!row) return;
      SD.ledger.logCoins({
        n: -(Math.abs(row.cost | 0)),
        bal: row.bal | 0,
        why: String(row.kind || 'BUY').toUpperCase().slice(0, 10),
        name: row.name || ''
      });
    },
    matches: function () { return load().m.slice().reverse(); },
    coins: function () { return load().c.slice().reverse(); },
    points: function () { return load().p.slice().reverse(); },
    buys: function () { return load().c.filter(function (r) { return (r.n | 0) < 0 && r.why && r.why !== 'PLAY'; }).slice().reverse(); },
    stats: function () {
      var o = load(), w = 0, l = 0;
      o.m.forEach(function (r) { if (r.w) w++; else l++; });
      return { wins: w, losses: l, nMatch: o.m.length, nCoin: o.c.length, nPts: o.p.length };
    },
    packCloud: function () {
      var o = load();
      return {
        hm: packList(o.m, function (r) { return { t: r.t | 0, w: !!r.w, o: String(r.opp || '').slice(0, 16) }; }),
        hc: packList(o.c, function (r) { return { t: r.t | 0, n: r.n | 0, b: r.bal | 0, k: String(r.why || 'PLAY').slice(0, 10), o: String(r.opp || r.name || '').slice(0, 16) }; }),
        hp: packList(o.p, function (r) { return { t: r.t | 0, n: r.n | 0, x: r.xp | 0, l: r.lvl | 0, o: String(r.opp || '').slice(0, 16) }; })
      };
    },
    applyCloud: function (s) {
      if (!s || typeof s !== 'object') return false;
      if (!Array.isArray(s.hm) && !Array.isArray(s.hc) && !Array.isArray(s.hp)) return false;
      var o = {
        m: (s.hm || []).map(function (r) { return { t: r.t | 0, w: !!r.w, opp: String(r.o || r.opp || '').slice(0, 16) }; }),
        c: (s.hc || []).map(function (r) { return { t: r.t | 0, n: r.n | 0, bal: r.b | r.bal | 0, why: String(r.k || r.why || 'PLAY').slice(0, 10), opp: String(r.o || '').slice(0, 16), name: String(r.name || '').slice(0, 22) }; }),
        p: (s.hp || []).map(function (r) { return { t: r.t | 0, n: r.n | 0, xp: r.x | r.xp | 0, lvl: r.l | r.lvl | 0, opp: String(r.o || '').slice(0, 16) }; })
      };
      cap(o.m); cap(o.c); cap(o.p);
      save(o);
      return true;
    }
  };
})();
