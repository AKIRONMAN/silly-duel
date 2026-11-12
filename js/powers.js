/* Power-ups: bought with coins (a level is needed to unlock each one). Before game 1 and again after
   game 3 each player picks up to 2 power-ups (the loadout). COMMON ones work in every game and are used
   up when they kick in. GAME ones only work when their game shows up (otherwise they are not used up).
   Both phones know both players' picks, so the effect is the same on every screen. */
(function () {
  'use strict';
  var st = SD.store, INK = SD.art.INK;
  function s(w) { return ' stroke="' + INK + '" stroke-width="' + w + '" stroke-linecap="round" stroke-linejoin="round"'; }

  SD.art.addIcons({
    p_second: '<path d="M32 56C10 40 8 24 18 16C26 10 32 18 32 18C32 18 38 10 46 16C56 24 54 40 32 56Z" fill="#ff7ab2"' + s(4) + '/><path d="M20 24Q22 20 26 20" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/>',
    p_double: '<circle cx="32" cy="32" r="26" fill="#ffd23f"' + s(4) + '/><path d="M17 24L27 40M27 24L17 40" fill="none"' + s(5) + '/><path d="M36 25Q38 21 43 21Q49 21 49 26Q49 29 44 33L36 40H50" fill="none"' + s(4.5) + '/>',
    p_lucky: '<circle cx="32" cy="32" r="26" fill="#76e6a8"' + s(4) + '/><path d="M32 32C32 22 40 16 44 20C48 24 42 32 32 32C42 32 48 40 44 44C40 48 32 42 32 32C32 42 24 48 20 44C16 40 22 32 32 32C22 32 16 24 20 20C24 16 32 22 32 32Z" fill="#fff"' + s(3) + '/>',
    p_steal: '<path d="M10 34L28 14L40 24L30 34L52 34L52 48L30 48L10 34Z" fill="#c9a7ff"' + s(4) + '/><circle cx="46" cy="22" r="9" fill="#ffd23f"' + s(3.5) + '/><path d="M46 18V26M42 22H50" stroke="#2a1650" stroke-width="3" stroke-linecap="round"/>',
    p_boost: '<path d="M32 6L52 30H40V58H24V30H12Z" fill="#6fcfff"' + s(4.5) + '/><path d="M28 36V50M36 36V50" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/>',
    p_head: '<path d="M14 8V58" fill="none"' + s(5) + '/><path d="M16 10H52L43 22L52 34H16Z" fill="#76e6a8"' + s(4) + '/>',
    p_gap: '<rect x="8" y="2" width="16" height="22" rx="3" fill="#76e6a8"' + s(4) + '/><rect x="8" y="42" width="16" height="22" rx="3" fill="#76e6a8"' + s(4) + '/><path d="M36 20L36 44M36 20L31 26M36 20L41 26M36 44L31 38M36 44L41 38" fill="none"' + s(4) + '/>',
    p_pads: '<ellipse cx="32" cy="38" rx="28" ry="13" fill="#4fd18b"' + s(4) + '/><path d="M4 38H60" fill="none" stroke="#fff" stroke-width="3" opacity=".6"/><path d="M12 18H52M12 18L18 12M12 18L18 24M52 18L46 12M52 18L46 24" fill="none"' + s(3.5) + '/>',
    p_glue: '<path d="M32 5C32 5 13 28 13 40A19 19 0 0 0 51 40C51 28 32 5 32 5Z" fill="#ffd23f"' + s(4) + '/><path d="M22 40Q22 33 27 29" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>',
    p_pole: '<path d="M3 34H61" fill="none"' + s(5) + '/><circle cx="8" cy="34" r="6" fill="#ff7ab2"' + s(3.5) + '/><circle cx="56" cy="34" r="6" fill="#ff7ab2"' + s(3.5) + '/><path d="M32 34V54M24 54H40" fill="none"' + s(4) + '/>',
    p_shield: '<path d="M32 5L55 13V32C55 46 45 55 32 59C19 55 9 46 9 32V13Z" fill="#6fcfff"' + s(4.5) + '/><path d="M21 32L29 40L44 24" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>',
    p_ghost: '<path d="M14 54V28C14 16 22 8 32 8C42 8 50 16 50 28V54L43 48L36 54L28 48L21 54Z" fill="#fff"' + s(4) + '/><circle cx="25" cy="28" r="3.6" fill="#2a1650"/><circle cx="39" cy="28" r="3.6" fill="#2a1650"/><ellipse cx="32" cy="38" rx="4" ry="5" fill="#2a1650"/>',
    p_umbrella: '<path d="M6 32C6 18 18 8 32 8C46 8 58 18 58 32Z" fill="#ff7ab2"' + s(4.5) + '/><path d="M32 32V52Q32 58 26 58" fill="none"' + s(4.5) + '/><path d="M20 32Q20 22 32 8M44 32Q44 22 32 8" fill="none" stroke="#fff" stroke-width="3" opacity=".7"/>',
    p_wide: '<circle cx="32" cy="32" r="24" fill="#fff"' + s(4) + '/><circle cx="32" cy="32" r="15" fill="#d4f1ff"' + s(3.5) + '/><circle cx="32" cy="32" r="6" fill="#7a4fd6"' + s(3) + '/><path d="M4 32H14M50 32H60" stroke="#2a1650" stroke-width="4.5" stroke-linecap="round"/>',
    p_gold: '<path d="M32 4L40 22L60 24L45 38L50 58L32 48L14 58L19 38L4 24L24 22Z" fill="#ffd23f"' + s(4) + '/><path d="M32 16L36 26L46 27L38 34L41 44L32 39L23 44L26 34L18 27L28 26Z" fill="#fff" opacity=".7"/>',
    p_defuse: '<circle cx="30" cy="38" r="20" fill="#3d2670"' + s(4) + '/><path d="M44 24Q50 14 58 14" fill="none"' + s(4) + '/><path d="M16 6L30 20M30 6L16 20" fill="none" stroke="#ff4d6d" stroke-width="6" stroke-linecap="round"/>'
  });

  var LIST = [
    { id: 'second', kind: 'common', icon: 'p_second', name: 'SECOND CHANCE', short: 'LOSS = DRAW', desc: 'If you LOSE a game, it counts as a DRAW instead. Nobody gets a point.', lvl: 2, cost: 30 },
    { id: 'lucky', kind: 'common', icon: 'p_lucky', name: 'LUCKY TIE', short: 'DRAW = WIN', desc: 'If a game ends in a DRAW, you WIN it and get the point.', lvl: 3, cost: 40 },
    { id: 'double', kind: 'common', icon: 'p_double', name: 'DOUBLE POINT', short: 'WIN = x2 POINTS', desc: 'If you WIN a game, your points from that game are doubled.', lvl: 4, cost: 60 },
    { id: 'steal', kind: 'common', icon: 'p_steal', name: 'STEALER', short: 'RIVAL -1 POINT', desc: 'If you WIN a game, your rival LOSES 1 point.', lvl: 7, cost: 90 },
    { id: 'head', kind: 'common', icon: 'p_head', name: 'HEAD START', short: '+1 POINT NOW', desc: 'You start the match with +1 point. Used up right away.', lvl: 10, cost: 120 },
    { id: 'ghost', kind: 'game', game: 'freeze', icon: 'p_ghost', name: 'GHOST STEP', short: 'FORGIVES 1 MISTAKE', desc: 'The first time the guard catches you moving, nothing happens.', lvl: 2, cost: 35 },
    { id: 'umbrella', kind: 'game', game: 'dodge', icon: 'p_umbrella', name: 'UMBRELLA', short: 'BLOCKS 1 PIE', desc: 'An umbrella opens over you and blocks the first pie that would hit you.', lvl: 3, cost: 35 },
    { id: 'wide', kind: 'game', game: 'beat', icon: 'p_wide', name: 'WIDE BEAT', short: 'BIGGER WINDOW', desc: 'The perfect-tap window is 60% bigger, so it is easier to hit the beats.', lvl: 5, cost: 45 },
    { id: 'gold', kind: 'game', game: 'pinata', icon: 'p_gold', name: 'GOLDEN GRAB', short: 'GRAB +40%', desc: 'Your grab of the pot is worth 40% more.', lvl: 6, cost: 55 },
    { id: 'defuse', kind: 'game', game: 'bomb', icon: 'p_defuse', name: 'DEFUSER', short: 'SAVES 1 BLAST', desc: 'The first time the bomb would blow up in your hands, it is defused and passed on.', lvl: 8, cost: 70 },
    { id: 'gap', kind: 'game', game: 'flap', icon: 'p_gap', name: 'BIG GAP', short: 'BIGGER GAPS', desc: 'The gaps you fly through are 35% bigger.', lvl: 2, cost: 35 },
    { id: 'pads', kind: 'game', game: 'hop', icon: 'p_pads', name: 'WIDE LILY', short: 'WIDER PADS', desc: 'The lily pads you land on are 40% wider.', lvl: 4, cost: 40 },
    { id: 'glue', kind: 'game', game: 'stack', icon: 'p_glue', name: 'SUPER GLUE', short: 'SAVES 1 DROP', desc: 'Your first sloppy drop keeps its full width, so the tower stays fat.', lvl: 5, cost: 45 },
    { id: 'pole', kind: 'game', game: 'balance', icon: 'p_pole', name: 'LONG POLE', short: 'LONG POLE', desc: 'You can lean much further before you fall off the rope.', lvl: 6, cost: 55 },
    { id: 'shield', kind: 'game', game: 'snack', icon: 'p_shield', name: 'SWEET SHIELD', short: 'BLOCKS 1 BOMB', desc: 'The first bomb you tap by mistake is blocked, no points lost.', lvl: 9, cost: 65 },
    { id: 'slowlog', kind: 'game', game: 'knife', icon: 'p_slowlog', name: 'SLOW LOG', short: 'LOG 35% SLOWER', desc: 'The log turns 35% slower for you, so it is easier to find a gap.', lvl: 20, cost: 160 },
    { id: 'net', kind: 'game', game: 'zig', icon: 'p_net', name: 'SAFETY NET', short: 'SAVES 1 FALL', desc: 'The first time you would fall off the road, a net puts you back on it.', lvl: 20, cost: 160 },
    { id: 'slowrope', kind: 'game', game: 'skip', icon: 'p_slowrope', name: 'SLOW ROPE', short: 'ROPE 25% SLOWER', desc: 'The rope swings 25% slower for you.', lvl: 20, cost: 160 },
    { id: 'echo2', kind: 'game', game: 'echo', icon: 'p_echo2', name: 'ECHO TWICE', short: 'HEAR IT TWICE', desc: 'Each rhythm is played a second time before you have to copy it.', lvl: 20, cost: 160 },
    { id: 'tank', kind: 'game', game: 'lander', icon: 'p_tank', name: 'EXTRA TANK', short: '+40% FUEL', desc: 'Your rocket carries 40% more fuel.', lvl: 20, cost: 160 }
  ];
  var BY = {}; LIST.forEach(function (p) { BY[p.id] = p; });
  var CAP = 9;

  function inv() { var v = st.get('inv'); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }
  function own(id) { return inv()[id] | 0; }
  function setOwn(id, n) { var v = Object.assign({}, inv()); v[id] = Math.max(0, Math.min(CAP, n | 0)); st.set('inv', v); }
  function ownedOf(kind) { return LIST.filter(function (p) { return p.kind === kind && own(p.id) > 0; }); }
  /* every level makes each power-up 10 coins dearer */
  function price(id) { var p = BY[id]; return p ? p.cost + 10 * Math.max(0, (st.get('level') | 0) - 1) : 0; }
  function canBuy(id) {
    var p = BY[id]; if (!p) return 'NO';
    if ((st.get('level') | 0) < p.lvl) return 'LEVEL';
    if (own(id) >= CAP) return 'FULL';
    if ((st.get('coins') | 0) < price(id)) return 'COINS';
    return '';
  }
  function buy(id) {
    if (canBuy(id)) return false;
    var cost = price(id);
    SD.progress.addCoins(-cost); setOwn(id, own(id) + 1);
    try {
      if (SD.ledger) SD.ledger.logBuy({ kind: 'power', name: (BY[id] && BY[id].name) || id, cost: cost, bal: st.get('coins') | 0 });
    } catch (e) {}
    return true;
  }
  /* a computer player (bot or simulated online player) picks up to 2 like a person would */
  function botPick(level) {
    var chance = Math.min(0.75, 0.3 + (level | 0) * 0.04), out = [], pool = LIST.slice();
    for (var k = 0; k < 2; k++) {
      if (Math.random() >= chance || !pool.length) continue;
      out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0].id);
    }
    return out;
  }
  SD.powers = { list: LIST, by: BY, cap: CAP, own: own, setOwn: setOwn, ownedOf: ownedOf, canBuy: canBuy, buy: buy, price: price, botPick: botPick,
    anyOwned: function () { return LIST.some(function (p) { return own(p.id) > 0; }); } };
})();
