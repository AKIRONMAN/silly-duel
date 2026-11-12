/* Play rooms (arenas). A new one opens at levels 5, 10, 15, 20, 25, 30, then 37, 44 and the best one at 48. */
(function () {
  'use strict';
  var LIST = [
    { id: 'bubble', lvl: 1, name: 'BUBBLE PARK', bg: 'linear-gradient(160deg,#b9deff,#eaf8ff)', ac: '#ffffff', g: '●', c: '#ffffff', mv: 'up' },
    { id: 'beach', lvl: 5, name: 'SUNNY BEACH', bg: 'linear-gradient(180deg,#7fd6ff 0%,#bfeeff 55%,#ffe7a6 56%,#ffd37a 100%)', ac: '#ffd23f', g: '✺', c: '#fff3a8', mv: 'sway' },
    { id: 'candy', lvl: 10, name: 'CANDY LAND', bg: 'linear-gradient(160deg,#ffc2e2,#ffe3f2 50%,#c8f0ff)', ac: '#ff5fa8', g: '♥', c: '#ff7fbc', mv: 'down' },
    { id: 'disco', lvl: 15, name: 'SPACE DISCO', bg: 'radial-gradient(circle at 50% 30%,#6b3fd1,#2a1650 70%)', ac: '#ffe066', g: '★', c: '#ffe066', mv: 'twinkle' },
    { id: 'snow', lvl: 20, name: 'SNOW MOUNTAIN', bg: 'linear-gradient(180deg,#a9d7ff,#e9f6ff 70%,#ffffff)', ac: '#7fc4ff', g: '❄', c: '#ffffff', mv: 'down' },
    { id: 'jungle', lvl: 25, name: 'JUNGLE TEMPLE', bg: 'linear-gradient(160deg,#2f8f4f,#7fd37a 60%,#d8f59a)', ac: '#ffd23f', g: '❦', c: '#1f6b36', mv: 'down' },
    { id: 'lava', lvl: 30, name: 'LAVA FORGE', bg: 'linear-gradient(180deg,#2b0d12,#6a1d12 60%,#ff6a1f)', ac: '#ff8a3d', g: '✹', c: '#ffb347', mv: 'up' },
    { id: 'neon', lvl: 37, name: 'NEON CITY', bg: 'linear-gradient(180deg,#0a0e2e,#1b1060 60%,#4a1a8c)', ac: '#4dd2ff', g: '◆', c: '#ff4fd8', mv: 'up' },
    { id: 'cloud', lvl: 44, name: 'CLOUD PALACE', bg: 'linear-gradient(180deg,#ffd6ec,#d7c6ff 50%,#bfe6ff)', ac: '#ffffff', g: '✦', c: '#ffffff', mv: 'sway' },
    { id: 'throne', lvl: 48, name: 'GOLDEN THRONE', bg: 'radial-gradient(circle at 50% 18%,#fff2a8,#ffc233 35%,#7a2bd1 85%)', ac: '#ffd23f', g: '✦', c: '#fff6b0', mv: 'up' }
  ];
  var SCENES = {"bubble": "<g fill='none' stroke='#fff' stroke-width='4' opacity='.9'><circle cx='40' cy='700' r='34'/><circle cx='350' cy='90' r='42'/><circle cx='330' cy='690' r='22'/><circle cx='60' cy='80' r='20'/><circle cx='200' cy='760' r='28'/></g><g fill='#fff' opacity='.5'><circle cx='30' cy='690' r='7'/><circle cx='340' cy='78' r='8'/></g>", "beach": "<circle cx='330' cy='60' r='46' fill='#ffd23f' stroke='#2a1650' stroke-width='4'/><g stroke='#ffd23f' stroke-width='6' stroke-linecap='round'><path d='M330 -6v-10M396 60h10M376 14l8-8M376 106l8 8M284 14l-8-8'/></g><path d='M0 700Q50 676 100 700T200 700T300 700T400 700V780H0Z' fill='#4dc3ff' stroke='#2a1650' stroke-width='4'/><path d='M0 740Q50 718 100 740T200 740T300 740T400 740V780H0Z' fill='#1e9be0'/><path d='M30 700Q28 640 50 600' fill='none' stroke='#8a5a2b' stroke-width='10' stroke-linecap='round'/><path d='M50 600q-40-6-52 20M50 600q10-34 46-34M50 600q34-6 50 22' fill='none' stroke='#35b97a' stroke-width='9' stroke-linecap='round'/>", "candy": "<g stroke='#2a1650' stroke-width='4'><path d='M30 60V-10' stroke='#fff' stroke-width='7'/><circle cx='30' cy='70' r='28' fill='#ff7fbc'/><path d='M12 70a18 18 0 0 1 36 0a10 10 0 0 1-20 0' fill='none' stroke='#fff'/><path d='M360 740V660' stroke='#fff' stroke-width='7'/><circle cx='360' cy='650' r='28' fill='#7fd6ff'/><path d='M342 650a18 18 0 0 1 36 0a10 10 0 0 1-20 0' fill='none' stroke='#fff'/></g><g fill='#ffd23f' stroke='#2a1650' stroke-width='3'><path d='M340 70l16 10-6 16-16 4-6-14z'/><path d='M40 700l14 8-5 14-14 3-5-12z'/></g>", "disco": "<g stroke='#2a1650' stroke-width='4'><path d='M195 -4V40' stroke='#fff'/><circle cx='195' cy='70' r='34' fill='#cfd6ff'/><path d='M165 55h60M162 72h66M168 88h54M195 36v68M178 40v62M212 40v62' fill='none' stroke='#8a8fe0' stroke-width='3'/></g><g fill='#ffe066' opacity='.18'><path d='M195 100L0 780H120Z'/><path d='M195 100L390 780H280Z'/></g><g fill='#fff'><circle cx='30' cy='150' r='3'/><circle cx='360' cy='200' r='3'/><circle cx='40' cy='600' r='3'/><circle cx='350' cy='560' r='3'/></g>", "snow": "<path d='M-10 780L70 620L120 690L190 580L260 700L330 630L400 780Z' fill='#cfe8ff' stroke='#2a1650' stroke-width='4'/><path d='M70 620l-24 36l16-6l12 14l10-16l8 10z' fill='#fff'/><path d='M190 580l-30 46l18-8l12 16l14-20l12 14z' fill='#fff'/><g fill='#fff' stroke='#2a1650' stroke-width='3'><ellipse cx='40' cy='60' rx='34' ry='16'/><ellipse cx='350' cy='40' rx='38' ry='16'/></g>", "jungle": "<g fill='#1f6b36' stroke='#2a1650' stroke-width='4'><path d='M-6 0Q60 20 40 120Q-10 90 -6 0Z'/><path d='M396 0Q330 30 350 140Q400 100 396 0Z'/><path d='M-6 780Q40 730 70 660Q10 690 -6 780Z'/><path d='M396 780Q350 730 320 660Q380 690 396 780Z'/></g><g fill='none' stroke='#8a5a2b' stroke-width='5'><path d='M120 -4Q110 40 130 80M270 -4Q290 50 262 90'/></g><circle cx='130' cy='84' r='6' fill='#ffd23f'/><circle cx='262' cy='94' r='6' fill='#ffd23f'/>", "lava": "<path d='M0 780V700Q60 650 120 700Q180 640 240 700Q310 650 400 700V780Z' fill='#ff6a1f' stroke='#2a1650' stroke-width='4'/><path d='M0 780V735Q70 700 140 735T290 735T400 730V780Z' fill='#ffc233'/><path d='M150 700L190 600L230 700Z' fill='#3a1a14' stroke='#2a1650' stroke-width='4'/><circle cx='190' cy='590' r='10' fill='#ff8a3d'/><g fill='#ffb347'><circle cx='40' cy='120' r='3'/><circle cx='350' cy='160' r='4'/><circle cx='360' cy='480' r='3'/></g>", "neon": "<g stroke='#4dd2ff' stroke-width='3' fill='#0a0e2e'><path d='M0 780V690H30V650H70V700H100V620H140V710H180V670H220V700H260V630H300V690H340V660H390V780Z'/></g><g fill='#ff4fd8'><rect x='40' y='662' width='6' height='6'/><rect x='108' y='634' width='6' height='6'/><rect x='270' y='644' width='6' height='6'/><rect x='350' y='672' width='6' height='6'/></g><g fill='#4dd2ff'><rect x='80' y='712' width='6' height='6'/><rect x='190' y='684' width='6' height='6'/><rect x='310' y='704' width='6' height='6'/></g><path d='M0 40H70M320 60H390M0 90H40' stroke='#ff4fd8' stroke-width='4' stroke-linecap='round'/>", "cloud": "<g fill='#fff' stroke='#2a1650' stroke-width='4'><path d='M-10 120q0-40 36-40q10-30 46-18q30-6 40 30q22 4 22 28H-10Z'/><path d='M300 70q0-36 34-36q14-24 44-8q20 8 22 44H300Z'/><path d='M-10 780V690q30-30 70-14q20-34 62-10q36-8 44 34V780Z'/><path d='M280 780V700q24-30 64-18q20-30 56-6V780Z'/></g><g fill='#ffd23f' stroke='#2a1650' stroke-width='3'><path d='M180 70l8 18l20 2l-15 13l5 20l-18-10l-18 10l5-20l-15-13l20-2z'/></g>", "throne": "<g fill='#fff6b0' opacity='.35'><path d='M195 760L-20 -10H60Z'/><path d='M195 760L120 -10H200Z'/><path d='M195 760L280 -10H360Z'/><path d='M195 760L420 -10H470Z'/></g><g fill='#fff2a8' stroke='#2a1650' stroke-width='4'><rect x='8' y='80' width='26' height='700'/><rect x='356' y='80' width='26' height='700'/><rect x='2' y='64' width='38' height='20'/><rect x='350' y='64' width='38' height='20'/></g><g fill='#ffd23f' stroke='#2a1650' stroke-width='3'><path d='M150 40L158 8L176 26L195 -2L214 26L232 8L240 40Z'/></g>"};
  LIST.forEach(function (a) { a.scene = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 390 780" preserveAspectRatio="xMidYMid slice">' + SCENES[a.id] + '</svg>'; });
  function lvl() { return SD.store.get('level') | 0 || 1; }
  var COST = { bubble: 0, beach: 100, candy: 200, disco: 320, snow: 450, jungle: 600, lava: 800, neon: 1000, cloud: 1300, throne: 2000 };
  LIST.forEach(function (a) { a.cost = COST[a.id]; });
  function owned(a) { return (SD.store.get('rooms') || []).indexOf(a.id) >= 0; }
  function state(a) { return owned(a) ? 'own' : a.lvl > lvl() ? 'shadow' : 'buy'; }
  function buy(a) {
    if (state(a) !== 'buy' || (SD.store.get('coins') | 0) < a.cost) return false;
    SD.progress.addCoins(-a.cost); var r = (SD.store.get('rooms') || []).slice(); r.push(a.id); SD.store.set('rooms', r); pin(a.id);
    try {
      if (SD.ledger) SD.ledger.logBuy({
        kind: 'arena',
        name: a.name || a.id,
        cost: a.cost,
        bal: SD.store.get('coins') | 0
      });
    } catch (e) {}
    return true;
  }
  function newest(L) { var r = LIST[0]; LIST.forEach(function (a) { if (a.lvl <= L && owned(a)) r = a; }); return r; }
  function byId(id) { for (var i = 0; i < LIST.length; i++) if (LIST[i].id === id) return LIST[i]; return null; }
  function pinned() { return (SD.store.extraGet && SD.store.extraGet('sd_arena')) || null; }
  function pin(id) { if (SD.store.extraSet) SD.store.extraSet('sd_arena', id || null); }
  var forced = null;
  function current() { if (forced) return newest(forced); var p = byId(pinned()); return p && owned(p) ? p : newest(lvl()); }
  function forLevel(L) { return LIST.filter(function (a) { return a.lvl === L; })[0] || null; }

  var fxEl = null;
  function enter(arenaEl, id) {
    var a = (id && byId(id)) || current(), b = document.body;
    b.dataset.arena = a.id;
    b.style.setProperty('--ar-bg', a.bg); b.style.setProperty('--ar-ac', a.ac);
    if (!fxEl) { fxEl = document.createElement('div'); fxEl.className = 'arena-fx'; fxEl.setAttribute('aria-hidden', 'true'); }
    var sc = arenaEl.querySelector('.arena-scene');
    if (!sc) { sc = document.createElement('div'); sc.className = 'arena-scene'; sc.setAttribute('aria-hidden', 'true'); arenaEl.insertBefore(sc, arenaEl.firstChild); }
    sc.innerHTML = a.scene;
    arenaEl.appendChild(fxEl);
    var h = '', i;
    for (i = 0; i < 8; i++) {
      var x = (i * 37 + 11) % 100, d = 5 + (i * 7) % 6, dl = -((i * 13) % 10), sz = 14 + (i * 5) % 14;
      h += '<i class="mv-' + a.mv + '" style="left:' + x + '%;font-size:' + sz + 'px;color:' + a.c + ';animation-duration:' + d + 's;animation-delay:' + dl + 's">' + a.g + '</i>';
    }
    fxEl.innerHTML = h;
    return a;
  }
  function force(l) { forced = l ? (l | 0) : null; }
  function leave() { forced = null; delete document.body.dataset.arena; var sc = document.querySelector('.arena-scene'); if (sc) sc.innerHTML = ''; if (fxEl) fxEl.innerHTML = ''; }

  SD.arenas = { state: state, buy: buy, owned: owned, list: LIST, lvl: lvl, current: current, forLevel: forLevel, byId: byId, pin: pin, pinned: pinned, enter: enter, leave: leave, force: force };
})();
