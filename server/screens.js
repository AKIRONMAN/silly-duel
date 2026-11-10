/* HTML for HOME / POWERS / ARENAS. Built on the server so those screens are
   files, not strings cooked in the browser. Lock state is still applied from
   the Firestore save after the page loads. */
'use strict';
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
  });
}

var POWERS = [
  { id: 'second', kind: 'common', icon: 'p_second', name: 'SECOND CHANCE', desc: 'If you LOSE a game, it counts as a DRAW instead. Nobody gets a point.', lvl: 2 },
  { id: 'lucky', kind: 'common', icon: 'p_lucky', name: 'LUCKY TIE', desc: 'If a game ends in a DRAW, you WIN it and get the point.', lvl: 3 },
  { id: 'double', kind: 'common', icon: 'p_double', name: 'DOUBLE POINT', desc: 'If you WIN a game, your points from that game are doubled.', lvl: 4 },
  { id: 'steal', kind: 'common', icon: 'p_steal', name: 'STEALER', desc: 'If you WIN a game, your rival LOSES 1 point.', lvl: 7 },
  { id: 'head', kind: 'common', icon: 'p_head', name: 'HEAD START', desc: 'You start the match with +1 point. Used up right away.', lvl: 10 },
  { id: 'ghost', kind: 'game', icon: 'p_ghost', name: 'GHOST STEP', desc: 'The first time the guard catches you moving, nothing happens.', lvl: 2 },
  { id: 'umbrella', kind: 'game', icon: 'p_umbrella', name: 'UMBRELLA', desc: 'An umbrella opens over you and blocks the first pie that would hit you.', lvl: 3 },
  { id: 'wide', kind: 'game', icon: 'p_wide', name: 'WIDE BEAT', desc: 'The perfect-tap window is 60% bigger, so it is easier to hit the beats.', lvl: 5 },
  { id: 'gold', kind: 'game', icon: 'p_gold', name: 'GOLDEN GRAB', desc: 'Your grab of the pot is worth 40% more.', lvl: 6 },
  { id: 'defuse', kind: 'game', icon: 'p_defuse', name: 'DEFUSER', desc: 'The first time the bomb would blow up in your hands, it is defused and passed on.', lvl: 8 },
  { id: 'gap', kind: 'game', icon: 'p_gap', name: 'BIG GAP', desc: 'The gaps you fly through are 35% bigger.', lvl: 2 },
  { id: 'pads', kind: 'game', icon: 'p_pads', name: 'WIDE LILY', desc: 'The lily pads you land on are 40% wider.', lvl: 4 },
  { id: 'glue', kind: 'game', icon: 'p_glue', name: 'SUPER GLUE', desc: 'Your first sloppy drop keeps its full width, so the tower stays fat.', lvl: 5 },
  { id: 'pole', kind: 'game', icon: 'p_pole', name: 'LONG POLE', desc: 'You can lean much further before you fall off the rope.', lvl: 6 },
  { id: 'shield', kind: 'game', icon: 'p_shield', name: 'SWEET SHIELD', desc: 'The first bomb you tap by mistake is blocked, no points lost.', lvl: 9 },
  { id: 'slowlog', kind: 'game', icon: 'p_slowlog', name: 'SLOW LOG', desc: 'The log turns 35% slower for you, so it is easier to find a gap.', lvl: 20 },
  { id: 'net', kind: 'game', icon: 'p_net', name: 'SAFETY NET', desc: 'The first time you would fall off the road, a net puts you back on it.', lvl: 20 },
  { id: 'slowrope', kind: 'game', icon: 'p_slowrope', name: 'SLOW ROPE', desc: 'The rope swings 25% slower for you.', lvl: 20 },
  { id: 'echo2', kind: 'game', icon: 'p_echo2', name: 'ECHO TWICE', desc: 'Each rhythm is played a second time before you have to copy it.', lvl: 20 },
  { id: 'tank', kind: 'game', icon: 'p_tank', name: 'EXTRA TANK', desc: 'Your rocket carries 40% more fuel.', lvl: 20 }
];

var ARENAS = [
  { id: 'bubble', lvl: 1, name: 'BUBBLE PARK', bg: 'linear-gradient(160deg,#b9deff,#eaf8ff)' },
  { id: 'beach', lvl: 5, name: 'SUNNY BEACH', bg: 'linear-gradient(180deg,#7fd6ff 0%,#bfeeff 55%,#ffe7a6 56%,#ffd37a 100%)' },
  { id: 'candy', lvl: 10, name: 'CANDY LAND', bg: 'linear-gradient(160deg,#ffc2e2,#ffe3f2 50%,#c8f0ff)' },
  { id: 'disco', lvl: 15, name: 'SPACE DISCO', bg: 'radial-gradient(circle at 50% 30%,#6b3fd1,#2a1650 70%)' },
  { id: 'snow', lvl: 20, name: 'SNOW MOUNTAIN', bg: 'linear-gradient(180deg,#a9d7ff,#e9f6ff 70%,#ffffff)' },
  { id: 'jungle', lvl: 25, name: 'JUNGLE TEMPLE', bg: 'linear-gradient(160deg,#2f8f4f,#7fd37a 60%,#d8f59a)' },
  { id: 'lava', lvl: 30, name: 'LAVA FORGE', bg: 'linear-gradient(180deg,#2b0d12,#6a1d12 60%,#ff6a1f)' },
  { id: 'neon', lvl: 37, name: 'NEON CITY', bg: 'linear-gradient(180deg,#0a0e2e,#1b1060 60%,#4a1a8c)' },
  { id: 'cloud', lvl: 44, name: 'CLOUD PALACE', bg: 'linear-gradient(180deg,#ffd6ec,#d7c6ff 50%,#bfe6ff)' },
  { id: 'throne', lvl: 48, name: 'GOLDEN THRONE', bg: 'radial-gradient(circle at 50% 18%,#fff2a8,#ffc233 35%,#7a2bd1 85%)' }
];

function pwCard(p) {
  return '<div class="pw-card" data-id="' + esc(p.id) + '" data-lvl="' + (p.lvl | 0) + '">' +
    '<div class="pw-ico" data-icon="' + esc(p.icon) + '"></div>' +
    '<b class="pw-name">' + esc(p.name) + '</b>' +
    '<span class="pw-desc">' + esc(p.desc) + '</span>' +
    '<div class="pw-foot"><span class="pw-own">HAVE 0</span>' +
    '<button type="button" class="pw-buy" data-id="' + esc(p.id) + '" disabled>…</button></div></div>';
}
function pwGroup(title, list) {
  if (!list.length) return '';
  return '<h3 class="pw-sec">' + esc(title) + '</h3><div class="pw-sgrid">' + list.map(pwCard).join('') + '</div>';
}

exports.powers = function () {
  var games = POWERS.filter(function (p) { return p.kind === 'game'; });
  return pwGroup('WORK IN EVERY GAME', POWERS.filter(function (p) { return p.kind === 'common'; })) +
    pwGroup('GAMES 1-5', games.slice(0, 5)) +
    pwGroup('GAMES 6-10', games.slice(5, 10)) +
    pwGroup('GAMES 11-15', games.slice(10));
};

exports.arenas = function () {
  return ARENAS.map(function (a) {
    return '<button type="button" class="ar-card" data-id="' + esc(a.id) + '" data-lvl="' + (a.lvl | 0) + '">' +
      '<span class="ar-thumb" style="background:' + esc(a.bg) + '"></span>' +
      '<b class="ar-name">' + esc(a.name) + '</b>' +
      '<span class="ar-desc"></span>' +
      '<span class="ar-prev" data-id="' + esc(a.id) + '">PREVIEW</span></button>';
  }).join('');
};

exports.home = function () {
  return '<div class="mode-grid">' +
    '<button class="gel mode pay offline wide" type="button" data-mode="pay"><span class="mode-ico" data-icon="offline"></span><span>PLAY</span></button>' +
    '<button class="gel mode online" type="button" data-mode="quick"><span class="mode-ico" data-icon="globe"></span><span>MATCH</span></button>' +
    '<button class="gel mode invite" type="button" data-mode="room"><span class="mode-ico" data-icon="friend"></span><span>ROOM</span></button>' +
    '</div>';
};

exports.homeFoot = function () {
  return '<button class="gel mode-pw" type="button" id="btnPowers"><span class="mode-ico" data-icon="zap" data-sz="26"></span><span>POWERS</span></button>' +
    '<button class="gel mode-pw" type="button" id="btnArena"><span class="mode-ico" data-icon="spark" data-sz="26"></span><span>ARENAS</span></button>' +
    '<button class="gel mode-board" type="button" id="btnBoard"><span class="mode-ico" data-icon="cup" data-sz="26"></span><span>TOP 100</span></button>';
};
