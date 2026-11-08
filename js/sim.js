/* CrazyGames build: the PLAY button starts a match against a simulated player. They look like real people (name, level, look),
   are matched at your level up to 3 levels higher, and play with the same moves a person would. */
window.SD = window.SD || {};
(function () {
  'use strict';
  var NAMES = ['NOVA', 'PIXEL', 'TACO', 'ZIGZAG', 'MOCHI', 'BLAZE', 'COCO', 'LUNA', 'TURBO', 'NINJA', 'PANDA', 'KIWI', 'JETT', 'ECHO', 'RAVEN', 'SUNNY',
    'COMET', 'FOXY', 'BOLT', 'MAYA', 'ARJUN', 'RIYA', 'KABIR', 'ZARA', 'LEO', 'NIA', 'OTTO', 'YUKI', 'HANA', 'DEV', 'SAM', 'ROCKY', 'MINT', 'DUSTY', 'QUACK'];
  var token = 0, el = null;

  function rint(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function pick() {
    var L = SD.store.get('level') | 0 || 1;
    var name = NAMES[rint(0, NAMES.length - 1)] + (Math.random() < 0.6 ? rint(1, 99) : '');
    return { name: name.slice(0, 12), level: L + rint(0, 3), skin: (function () { var ok = []; SD.art.SKINS.forEach(function (x, id) { if (SD.art.skinReq(id).lvl <= L + 3) ok.push(id); }); return ok[rint(0, ok.length - 1)]; })() };
  }
  SD.art.addIcons({ playgo: '<path d="M18 10L54 32L18 54Z" fill="#fff" stroke="' + SD.art.INK + '" stroke-width="5" stroke-linejoin="round"/>' });
  /* no search screen: PLAY starts a match straight away against a player that looks like any other */
  function play() { SD.engine.startSim(pick()); }
  SD.sim = { pick: pick, play: play };
})();
