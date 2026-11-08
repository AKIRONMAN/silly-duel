/* Levels, progress points, coins and the skin unlock boss. Player 1 (slot 0) is the profile owner.
   Only rated matches change level and coins: random online players (and, in the CrazyGames build, the
   simulated online players). Each level needs 10 progress points = 10 wins.
   Level 10, 20 ... 80: the bar stops full and a very hard boss game must be beaten for a skin. */
(function () {
  'use strict';
  var st = SD.store;
  var LAST_BOSS_LEVEL = 80, PTS = 10, BOSS_GATE = false;   // skins are now bought with coins at their level; boss code kept but off
  var LOSS_EQUAL = 4, LOSS_HIGHER = 1;          // points lost for a defeat vs equal/lower level, vs higher level

  function need() { return PTS; }
  function bossSkin() {                               // skin id waiting behind a boss, or -1
    var L = st.get('level');
    if (!BOSS_GATE) return -1;
    if (L % 10 !== 0 || L > LAST_BOSS_LEVEL) return -1;
    var id = L / 10 + 1;
    return st.get('unlocked').indexOf(id) < 0 ? id : -1;
  }
  function gateAt(L) { return BOSS_GATE && L % 10 === 0 && L <= LAST_BOSS_LEVEL && st.get('unlocked').indexOf(L / 10 + 1) < 0; }
  function clampXp() { var x = Math.max(0, Math.min(PTS, st.get('xp') | 0)); if (x !== st.get('xp')) st.set('xp', x); return x; }
  function info() {
    var L = st.get('level'), x = clampXp(), skin = bossSkin(), gated = skin >= 0 && x >= PTS;
    return { level: L, xp: x, need: PTS, gated: gated, bossSkin: skin, coins: st.get('coins') | 0 };
  }

  /* a rated result. oppLevel = level of the other player. Returns what changed so the screen can show it. */
  function rate(won, oppLevel) {
    var before = info(), L = before.level, x = before.xp, out = { won: won, before: before, pts: 0, ups: [], downs: 0 };
    oppLevel = oppLevel | 0 || L;
    if (won) {
      if (bossSkin() >= 0 && x >= PTS) { out.pts = 0; out.after = before; out.gated = true; return out; }   // bar is full: beat the boss
      var gain = oppLevel > L ? 2 : 1;                          // beating a higher level is worth more
      x += gain; out.pts = gain;
      while (x >= PTS) {
        L++; out.ups.push(L); x -= PTS;
        if (gateAt(L)) { x = PTS; break; }                        // boss gate: bar stays full until the boss is beaten
      }
    } else {
      var loss = oppLevel > L ? LOSS_HIGHER : LOSS_EQUAL;       // a higher level beat you: small loss, never a level
      out.pts = -loss;
      x -= loss;
      if (x < 0) {
        if (oppLevel > L || L <= 1) x = 0;
        else { L--; out.downs = 1; x = Math.max(0, PTS + x); }  // bar was empty: down one level, partly filled
      }
    }
    st.set('level', L); st.set('xp', x);
    out.after = info();
    return out;
  }

  function addCoins(n) {
    var before = st.get('coins') | 0, now = Math.max(0, before + (n | 0));
    st.set('coins', now);
    return now - before;                                         // what really changed (never below 0)
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
    addCoins(-SD.art.skinReq(id).cost);
    var u = st.get('unlocked').slice(); u.push(id); st.set('unlocked', u);
    var sk = st.get('skins').slice(); sk[0] = id; st.set('skins', sk);
    return true;
  }

  SD.progress = {
    canBuySkin: canBuySkin, buySkin: buySkin,
    need: need, info: info, rate: rate, addCoins: addCoins, winBoss: winBoss, bossSkin: bossSkin, PTS: PTS,
    tier: function () { return Math.max(1, Math.floor(st.get('level') / 10)); },
    isUnlocked: function (id) { return st.get('unlocked').indexOf(id) >= 0; },
    equip: function (slot, id) {
      if (!SD.progress.isUnlocked(id)) return false;
      var sk = st.get('skins').slice(); sk[slot] = id; st.set('skins', sk); return true;
    }
  };
})();
