/* Levels, progress points, coins and the skin unlock boss. Player 1 (slot 0) is the profile owner.
   Only rated matches change level and coins: random online players (and, in the CrazyGames build, the
   simulated online players). Each level has its own point need. A loss can drop a level and strip
   arenas, powers and skins that the new level cannot keep. */
(function () {
  'use strict';
  var st = SD.store;
  var LAST_BOSS_LEVEL = 80, BOSS_GATE = false;

  function needFor(L) {
    L = Math.max(1, L | 0);
    if (L <= 5) return 100;
    if (L <= 10) return 200;
    if (L <= 15) return 300;
    if (L <= 20) return 400;
    if (L <= 25) return 500;
    if (L <= 29) return 600;
    if (L <= 35) return 500;
    if (L <= 40) return 1000;
    if (L <= 45) return 2000;
    return 2500;
  }
  function amt(n, pct) { return Math.max(1, Math.round(n * pct)); }
  function winPts(n, higher) { return amt(n, higher ? 0.18 : 0.10); }
  function lossPts(n, higher) { return amt(n, higher ? 0.05 : 0.12); }

  function migrateXp() {
    if (st.get('xpv') === 2) return;
    var L = st.get('level') | 0, x = st.get('xp') | 0, n = needFor(L);
    if (n > 10 && x > 0 && x <= 10) st.set('xp', Math.round(x / 10 * n));
    st.set('xpv', 2);
  }

  function bossSkin() {
    var L = st.get('level');
    if (!BOSS_GATE) return -1;
    if (L % 10 !== 0 || L > LAST_BOSS_LEVEL) return -1;
    var id = L / 10 + 1;
    return st.get('unlocked').indexOf(id) < 0 ? id : -1;
  }
  function gateAt(L) { return BOSS_GATE && L % 10 === 0 && L <= LAST_BOSS_LEVEL && st.get('unlocked').indexOf(L / 10 + 1) < 0; }
  function clampXp() {
    migrateXp();
    var L = st.get('level') | 0, n = needFor(L), x = Math.max(0, Math.min(n, st.get('xp') | 0));
    if (x !== (st.get('xp') | 0)) st.set('xp', x);
    return x;
  }
  function info() {
    var L = st.get('level') | 0, n = needFor(L), x = clampXp(), skin = bossSkin(), gated = skin >= 0 && x >= n;
    return { level: L, xp: x, need: n, gated: gated, bossSkin: skin, coins: st.get('coins') | 0 };
  }

  function stripGear(L) {
    var lost = { powers: [], arenas: [], skins: [] };
    if (SD.powers && SD.powers.list) {
      SD.powers.list.forEach(function (p) {
        if (p.lvl > L && SD.powers.own(p.id) > 0) {
          lost.powers.push(p.name);
          SD.powers.setOwn(p.id, 0);
        }
      });
    }
    if (SD.arenas) {
      var rooms = (st.get('rooms') || []).slice(), keep = [];
      rooms.forEach(function (id) {
        var a = SD.arenas.byId(id);
        if (!a || a.id === 'bubble' || a.lvl <= L) keep.push(id);
        else lost.arenas.push(a.name);
      });
      if (keep.indexOf('bubble') < 0) keep.unshift('bubble');
      st.set('rooms', keep);
      var pin = SD.arenas.pinned && SD.arenas.pinned();
      if (pin && keep.indexOf(pin) < 0 && SD.arenas.pin) SD.arenas.pin('bubble');
    }
    var unlocked = (st.get('unlocked') || []).slice(), keepU = [];
    unlocked.forEach(function (id) {
      id = id | 0;
      if (id === 0 || id === 1) { if (keepU.indexOf(id) < 0) keepU.push(id); return; }
      var req = SD.art && SD.art.skinReq ? SD.art.skinReq(id) : { lvl: 1 };
      if ((req.lvl | 0) <= L) { if (keepU.indexOf(id) < 0) keepU.push(id); }
      else if (SD.art) lost.skins.push(SD.art.skinName(id));
    });
    if (keepU.indexOf(0) < 0) keepU.unshift(0);
    if (keepU.indexOf(1) < 0) keepU.push(1);
    st.set('unlocked', keepU);
    var skins = (st.get('skins') || [1, 0]).slice();
    skins = skins.map(function (s, i) { return keepU.indexOf(s) >= 0 ? s : (i === 0 ? 1 : 0); });
    st.set('skins', skins);
    return lost;
  }

  /* a rated result. oppLevel = level of the other player. Returns what changed so the screen can show it. */
  function rate(won, oppLevel) {
    var before = info(), L = before.level, x = before.xp, n = before.need;
    var out = { won: won, before: before, pts: 0, ups: [], downs: 0, lost: { powers: [], arenas: [], skins: [] } };
    oppLevel = oppLevel | 0 || L;
    var higher = oppLevel > L;
    if (won) {
      if (bossSkin() >= 0 && x >= n) { out.pts = 0; out.after = before; out.gated = true; return out; }
      var gain = winPts(n, higher);
      x += gain; out.pts = gain;
      while (x >= needFor(L)) {
        x -= needFor(L);
        L++; out.ups.push(L);
        if (gateAt(L)) { x = needFor(L); break; }
      }
    } else {
      var loss = lossPts(n, higher);
      out.pts = -loss;
      x -= loss;
      if (x < 0) {
        if (higher || L <= 1) x = 0;
        else {
          L--; out.downs = 1;
          x = Math.max(0, needFor(L) + x);
          out.lost = stripGear(L);
        }
      }
    }
    st.set('level', L); st.set('xp', x);
    out.after = info();
    return out;
  }

  function addCoins(n) {
    var before = st.get('coins') | 0, now = Math.max(0, before + (n | 0));
    st.set('coins', now);
    return now - before;
  }

  function winBoss() {
    var id = bossSkin();
    if (id < 0) return -1;
    var u = st.get('unlocked').slice(); u.push(id);
    st.set('unlocked', u);
    var sk = st.get('skins').slice(); sk[0] = id; st.set('skins', sk);
    st.set('level', st.get('level') + 1); st.set('xp', 0);
    return id;
  }

  function canBuySkin(id) {
    if (st.get('unlocked').indexOf(id) >= 0) return 'OWNED';
    if (st.get('level') < SD.art.skinReq(id).lvl) return 'LEVEL';
    if ((st.get('coins') | 0) < SD.art.skinReq(id).cost) return 'COINS';
    return '';
  }
  function buySkin(id) {
    if (canBuySkin(id) !== '') return false;
    var cost = SD.art.skinReq(id).cost;
    addCoins(-cost);
    var u = st.get('unlocked').slice(); u.push(id); st.set('unlocked', u);
    var sk = st.get('skins').slice(); sk[0] = id; st.set('skins', sk);
    try {
      if (SD.ledger) SD.ledger.logCoins({ n: -cost, why: 'SKIN', name: SD.art.skinName(id), bal: st.get('coins') | 0 });
    } catch (e) {}
    return true;
  }

  SD.progress = {
    canBuySkin: canBuySkin, buySkin: buySkin,
    need: function (L) { return needFor(L == null ? st.get('level') : L); },
    info: info, rate: rate, addCoins: addCoins, winBoss: winBoss, bossSkin: bossSkin,
    PTS: 100,
    tier: function () { return Math.max(1, Math.floor(st.get('level') / 10)); },
    isUnlocked: function (id) { return st.get('unlocked').indexOf(id) >= 0; },
    equip: function (slot, id) {
      if (!SD.progress.isUnlocked(id)) return false;
      var sk = st.get('skins').slice(); sk[slot] = id; st.set('skins', sk); return true;
    }
  };
})();
