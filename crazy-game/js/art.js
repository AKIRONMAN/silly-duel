/* All pictures are drawn in code (SVG), so there are no image files to load. */
window.SD = window.SD || {};
(function () {
  'use strict';
  var INK = '#2a1650';

  var CHARS = [
    { name: 'BUBBLES', fill: '#ff8cc3', deep: '#e5559b', pad: '#ffd6ea', key: 'Q' },
    { name: 'NOODLE', fill: '#6fcfff', deep: '#2fa6e8', pad: '#d4f1ff', key: 'P' },
    { name: 'WAFFLE', fill: '#ffd84d', deep: '#e6a800', pad: '#fff2b3', key: 'Z' },
    { name: 'PICKLE', fill: '#76e6a8', deep: '#35b97a', pad: '#d0f8e1', key: 'M' }
  ];

  function stroke(w) { return ' stroke="' + INK + '" stroke-width="' + w + '" stroke-linecap="round" stroke-linejoin="round"'; }

  /* Mix a hex toward white so inner bits follow the chosen tint. */
  function lite(hex, t) {
    hex = String(hex || '#ffffff').replace('#', '');
    if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    var n = parseInt(hex, 16); if (isNaN(n)) n = 0xffffff;
    t = t == null ? 0.42 : t;
    var r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    r = Math.round(r + (255 - r) * t);
    g = Math.round(g + (255 - g) * t);
    b = Math.round(b + (255 - b) * t);
    return '#' + (0x1000000 + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  /* 10 recolors. 0 = the skin's own colors. Each tint is a different hue. */
  var PALETTES = [
    { name: 'OWN', fill: null, deep: null },
    { name: 'PINK', fill: '#ff3d9a', deep: '#c21864' },
    { name: 'SKY', fill: '#00b8f0', deep: '#0077aa' },
    { name: 'LEMON', fill: '#ffe135', deep: '#d4a800' },
    { name: 'MINT', fill: '#1edc72', deep: '#0e9a48' },
    { name: 'GRAPE', fill: '#7a3dff', deep: '#4a14c4' },
    { name: 'CORAL', fill: '#ff2a3e', deep: '#c41022' },
    { name: 'ORANGE', fill: '#ff7a00', deep: '#c75a00' },
    { name: 'ICE', fill: '#d7e4ff', deep: '#6d86b8' },
    { name: 'NAVY', fill: '#1f2260', deep: '#0c0e30' }
  ];
  var liveTint = [null, null];
  function slotTint(i) {
    if (liveTint[i] != null) return liveTint[i] | 0;
    var t = SD.store && SD.store.get('tints');
    return t && t[i] != null ? t[i] | 0 : 0;
  }
  function cols(id, tint) {
    var b = SKINS[id] || SKINS[0], p = PALETTES[tint | 0];
    if (!p || !p.fill) return b;
    return { name: b.name, fill: p.fill, deep: p.deep };
  }

  /* 10 skins. 0 and 1 are free. Skin k (2..9) is won by beating the boss at level (k-1)*10. */
  var SKINS = [
    { name: 'KITTY', fill: '#ff8cc3', deep: '#e5559b' },
    { name: 'PUPPY', fill: '#6fcfff', deep: '#2fa6e8' },
    { name: 'BUNNY', fill: '#ffe27a', deep: '#e6b400' },
    { name: 'FROGGY', fill: '#76e6a8', deep: '#35b97a' },
    { name: 'PANDA', fill: '#ffffff', deep: '#d9d2e6' },
    { name: 'FOXY', fill: '#ffb38a', deep: '#ee8458' },
    { name: 'OWLY', fill: '#eaf2ff', deep: '#c3d3f2' },
    { name: 'ROBO', fill: '#9fb8d6', deep: '#6f8fb5' },
    { name: 'ALIEN', fill: '#c58bff', deep: '#9a55e0' },
    { name: 'LION', fill: '#ffc233', deep: '#e08a00' },
    { name: 'DRAGON', fill: '#7be08a', deep: '#3fae56' },
    { name: 'ASTRO', fill: '#5b3fd1', deep: '#34227f' },
    { name: 'TIGER', fill: '#ffb43a', deep: '#d97a00' },
    { name: 'UNICORN', fill: '#fff0fa', deep: '#f6b8e4' },
    { name: 'PHOENIX', fill: '#ff8a3d', deep: '#e0451d' },
    { name: 'ANGEL', fill: '#d6f2ff', deep: '#8fc4ff' }
  ];
  /* rarity of every skin, like trading-card tiers */
  var TIERS = [
    { id: 'common', name: 'COMMON', color: '#8e98ad' }, { id: 'uncommon', name: 'UNCOMMON', color: '#2fbf6c' },
    { id: 'rare', name: 'RARE', color: '#2f8cff' }, { id: 'epic', name: 'EPIC', color: '#a45cff' },
    { id: 'legendary', name: 'LEGENDARY', color: '#ffb300' }, { id: 'mythic', name: 'MYTHIC', color: '#ff4fd8' }
  ];
  var TIER_OF = [0, 0, 0, 1, 1, 1, 2, 2, 3, 3, 4, 4, 5, 3, 4, 5];
  /* level needed and coin price of every skin */
  var REQ = [[1,0],[1,0],[3,60],[6,90],[9,120],[12,160],[16,200],[20,260],[25,340],[30,450],[40,700],[44,900],[48,1200],[27,400],[36,600],[50,1800]];
  var live = [null, null];          // temporary skin per slot (used for the bot)

  /* every skin is a creature with a soft squared head (no ovals, no diamonds) */
  function sq(c, s, x, y, w, h, r, fill) { return '<rect x="' + (x == null ? 14 : x) + '" y="' + (y == null ? 26 : y) + '" width="' + (w || 92) + '" height="' + (h || 84) + '" rx="' + (r || 30) + '" fill="' + (fill || c.fill) + '"' + s + '/>'; }
  function ear(x, y, rot, c, s, inner) {   // rounded triangle ear
    return '<g transform="translate(' + x + ' ' + y + ') rotate(' + rot + ')"><path d="M-16 14Q-18 -10 0 -24Q18 -10 16 14Z" fill="' + c + '"' + s + '/>' + (inner ? '<path d="M-8 10Q-9 -4 0 -13Q9 -4 8 10Z" fill="' + inner + '"/>' : '') + '</g>';
  }
  function body(id, tint) {
    var c = cols(id, tint), s = stroke(4), d = c.deep;
    switch (id) {
      case 0: // KITTY
        return ear(30, 34, -18, c.fill, s, lite(c.fill)) + ear(90, 34, 18, c.fill, s, lite(c.fill)) + sq(c, s) +
          '<path d="M52 34V44M60 32V44M68 34V44" fill="none" stroke="' + d + '" stroke-width="3.5" stroke-linecap="round"/>' +
          '<path d="M6 70H20M8 82L20 77M114 70H100M112 82L100 77" fill="none"' + stroke(3) + '/>';
      case 1: // PUPPY
        return '<rect x="2" y="30" width="26" height="52" rx="13" fill="' + d + '"' + s + ' transform="rotate(10 15 56)"/><rect x="92" y="30" width="26" height="52" rx="13" fill="' + d + '"' + s + ' transform="rotate(-10 105 56)"/>' +
          sq(c, s) + '<rect x="38" y="66" width="44" height="36" rx="16" fill="#fff" opacity=".85"/><rect x="26" y="48" width="26" height="26" rx="10" fill="' + d + '" opacity=".35"/>';
      case 2: // BUNNY
        return '<rect x="26" y="-2" width="24" height="50" rx="12" fill="' + c.fill + '"' + s + '/><rect x="70" y="-2" width="24" height="50" rx="12" fill="' + c.fill + '"' + s + '/>' +
          '<rect x="33" y="8" width="10" height="30" rx="5" fill="' + lite(c.fill) + '"/><rect x="77" y="8" width="10" height="30" rx="5" fill="' + lite(c.fill) + '"/>' + sq(c, s, 14, 30, 92, 80, 30) +
          '<rect x="52" y="90" width="16" height="14" rx="4" fill="#fff"' + stroke(2.5) + '/>';
      case 3: // FROGGY
        return '<circle cx="34" cy="30" r="17" fill="' + c.fill + '"' + s + '/><circle cx="86" cy="30" r="17" fill="' + c.fill + '"' + s + '/>' + sq(c, s, 10, 34, 100, 76, 32) +
          '<circle cx="34" cy="30" r="8" fill="#fff"' + stroke(2.5) + '/><circle cx="86" cy="30" r="8" fill="#fff"' + stroke(2.5) + '/><circle cx="35" cy="31" r="3.4" fill="' + INK + '"/><circle cx="85" cy="31" r="3.4" fill="' + INK + '"/>' +
          '<g fill="' + d + '" opacity=".7"><circle cx="24" cy="96" r="4"/><circle cx="96" cy="98" r="4"/><circle cx="60" cy="48" r="3"/></g>';
      case 4: // PANDA
        return '<circle cx="26" cy="32" r="15" fill="#4b3a6e"' + s + '/><circle cx="94" cy="32" r="15" fill="#4b3a6e"' + s + '/>' + sq(c, s) +
          '<rect x="26" y="48" width="36" height="36" rx="15" fill="#6b5b8c" transform="rotate(-14 44 66)"/><rect x="58" y="48" width="36" height="36" rx="15" fill="#6b5b8c" transform="rotate(14 76 66)"/>';
      case 5: // FOXY
        return ear(28, 34, -14, c.fill, s, '#4b3a6e') + ear(92, 34, 14, c.fill, s, '#4b3a6e') + sq(c, s) +
          '<path d="M14 84Q34 74 46 98Q54 108 60 108Q66 108 74 98Q86 74 106 84V96Q106 110 90 110H30Q14 110 14 96Z" fill="#fffdf3"/>' +
          '<path d="M14 84Q34 74 46 98Q54 108 60 108Q66 108 74 98Q86 74 106 84" fill="none"' + stroke(3) + '/>' + '<path d="M52 36H68L60 46Z" fill="#fffdf3"/>';
      case 6: // OWLY
        return '<path d="M20 44L12 14L42 30Z" fill="' + d + '"' + s + '/><path d="M100 44L108 14L78 30Z" fill="' + d + '"' + s + '/>' + sq(c, s) +
          '<rect x="24" y="46" width="34" height="34" rx="14" fill="#fff" opacity=".9"/><rect x="62" y="46" width="34" height="34" rx="14" fill="#fff" opacity=".9"/>' +
          '<path d="M50 70L60 82L70 70Z" fill="#ffb02e"' + stroke(3) + '/><path d="M34 98Q40 92 46 98M54 100Q60 94 66 100M74 98Q80 92 86 98" fill="none" stroke="' + d + '" stroke-width="3" stroke-linecap="round"/>';
      case 7: // ROBO
        return '<path d="M60 24V10" fill="none"' + stroke(4.5) + '/><circle cx="60" cy="8" r="6.5" fill="#ff4d6d"' + stroke(3.5) + '/>' +
          '<rect x="5" y="58" width="12" height="26" rx="5" fill="' + d + '"' + stroke(3.5) + '/><rect x="103" y="58" width="12" height="26" rx="5" fill="' + d + '"' + stroke(3.5) + '/>' +
          sq(c, s, 14, 22, 92, 88, 22) + '<path d="M24 34H34M86 34H96" fill="none" stroke="#fff" stroke-width="4" opacity=".7" stroke-linecap="round"/>' +
          '<g fill="' + d + '"><circle cx="24" cy="100" r="3"/><circle cx="96" cy="100" r="3"/></g><path d="M44 100H76" stroke="' + d + '" stroke-width="3" stroke-dasharray="4 5" stroke-linecap="round"/>';
      case 8: // ALIEN
        return '<path d="M44 32Q36 12 26 10M76 32Q84 12 94 10" fill="none"' + stroke(4) + '/><circle cx="26" cy="10" r="6.5" fill="' + d + '"' + stroke(3.5) + '/><circle cx="94" cy="10" r="6.5" fill="' + d + '"' + stroke(3.5) + '/>' +
          '<path d="M14 54Q14 26 42 26H78Q106 26 106 54Q106 92 80 110H40Q14 92 14 54Z" fill="' + c.fill + '"' + s + '/>' +
          '<g fill="' + d + '"><circle cx="30" cy="96" r="3"/><circle cx="92" cy="94" r="3"/><circle cx="96" cy="44" r="2.6"/></g>';
      case 9: // LION
        var m = '', i, a;
        for (i = 0; i < 10; i++) { a = i / 10 * 6.2832; m += '<circle cx="' + (60 + Math.cos(a) * 44).toFixed(1) + '" cy="' + (68 + Math.sin(a) * 42).toFixed(1) + '" r="17" fill="#e08a00"' + s + '/>'; }
        return '<circle cx="30" cy="32" r="12" fill="' + c.fill + '"' + s + '/><circle cx="90" cy="32" r="12" fill="' + c.fill + '"' + s + '/>' + m + sq(c, s, 22, 34, 76, 72, 28) +
          '<rect x="42" y="72" width="36" height="28" rx="13" fill="#fff3c8"/>';
      case 10: // DRAGON
        return '<path d="M30 40L22 10L48 30Z" fill="#ffd23f"' + s + '/><path d="M90 40L98 10L72 30Z" fill="#ffd23f"' + s + '/>' +
          '<path d="M8 62L22 52V80Z M112 62L98 52V80Z" fill="' + d + '"' + stroke(3.5) + '/>' + sq(c, s) +
          '<path d="M40 30L46 20L52 30M54 28L60 16L66 28M68 30L74 20L80 30" fill="' + d + '"' + stroke(3) + '/>' +
          '<rect x="36" y="76" width="48" height="32" rx="14" fill="#c9f5cf" opacity=".85"/><circle cx="52" cy="84" r="2.4" fill="' + d + '"/><circle cx="68" cy="84" r="2.4" fill="' + d + '"/>';
      case 11: // ASTRO
        return '<path d="M60 26V10" fill="none"' + stroke(4.5) + '/><circle cx="60" cy="8" r="6" fill="#ffd23f"' + stroke(3.5) + '/>' + sq(c, s, 10, 24, 100, 90, 34) +
          '<rect x="22" y="40" width="76" height="62" rx="24" fill="#8d78f0"' + stroke(3.5) + '/><path d="M30 52Q34 46 44 45" fill="none" stroke="#fff" stroke-width="4" opacity=".7" stroke-linecap="round"/>' +
          '<g fill="#fff"><circle cx="86" cy="94" r="2"/><circle cx="30" cy="92" r="1.8"/><circle cx="92" cy="50" r="1.6"/></g><rect x="4" y="62" width="12" height="26" rx="6" fill="' + d + '"' + stroke(3.5) + '/><rect x="104" y="62" width="12" height="26" rx="6" fill="' + d + '"' + stroke(3.5) + '/>';
      case 12: // TIGER
        return '<circle cx="28" cy="32" r="13" fill="' + c.fill + '"' + s + '/><circle cx="92" cy="32" r="13" fill="' + c.fill + '"' + s + '/>' + sq(c, s) +
          '<path d="M60 34V48M46 36L50 48M74 36L70 48M14 60L28 62M14 76L26 74M106 60L92 62M106 76L94 74" fill="none" stroke="#7a3d00" stroke-width="5" stroke-linecap="round"/>' +
          '<rect x="40" y="74" width="40" height="30" rx="14" fill="#fff3c8"/><path d="M30 8L38 22L50 14L60 4L70 14L82 22L90 8" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity="0"/>' +
          '<path d="M44 20L48 6L56 14L60 2L64 14L72 6L76 20Z" fill="#ff4d6d"' + stroke(3.5) + '/>' +
          '<g fill="#fff"><path d="M100 50l3 7 7 3-7 3-3 7-3-7-7-3 7-3z"/><path d="M16 96l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/></g>';
      case 13: // UNICORN
        return '<path d="M26 38Q4 54 14 96Q22 80 30 78Z" fill="#ff7ab8"' + stroke(3.5) + '/><path d="M22 50Q8 66 18 92" fill="none" stroke="#7fd6ff" stroke-width="5" stroke-linecap="round"/>' +
          ear(34, 34, -10, c.fill, s, lite(c.fill)) + ear(86, 34, 10, c.fill, s, lite(c.fill)) + sq(c, s) +
          '<path d="M60 0L49 34H71Z" fill="#ffd23f"' + stroke(3.5) + '/><path d="M53 22H67M55 12H65" stroke="#e08a00" stroke-width="3" stroke-linecap="round"/>' +
          '<rect x="40" y="76" width="40" height="28" rx="13" fill="#ffd9ef" opacity=".8"/><path d="M98 46l3 6 6 3-6 3-3 6-3-6-6-3 6-3z" fill="#fff"/>';
      case 14: // PHOENIX
        return '<path d="M18 80Q-6 66 6 34Q12 56 32 66Z" fill="#ffc233"' + stroke(3.5) + '/><path d="M102 80Q126 66 114 34Q108 56 88 66Z" fill="#ffc233"' + stroke(3.5) + '/>' +
          '<path d="M42 34Q32 18 44 2Q46 18 54 20Q52 6 64 -2Q66 14 72 18Q86 8 80 28Q92 20 86 38Z" fill="#ff4d2e"' + stroke(3.5) + '/><path d="M54 30Q54 18 62 10Q64 22 68 30Z" fill="#ffd23f"/>' + sq(c, s) +
          '<rect x="34" y="94" width="52" height="10" rx="5" fill="#ffd23f" opacity=".0"/><path d="M50 72L60 86L70 72Z" fill="#ffd23f"' + stroke(3) + '/>';
      default: // 15 ANGEL
        return '<path d="M16 64Q-8 52 2 24Q10 36 26 40Z" fill="#fff"' + stroke(3.5) + '/><path d="M104 64Q128 52 118 24Q110 36 94 40Z" fill="#fff"' + stroke(3.5) + '/>' +
          '<rect x="34" y="6" width="52" height="14" rx="7" fill="none" stroke="#ffd23f" stroke-width="6"/>' + sq(c, s) +
          '<path d="M30 46Q34 38 48 36" fill="none" stroke="#fff" stroke-width="5" opacity=".7" stroke-linecap="round"/>' +
          '<g fill="#fff"' + stroke(2) + '><path d="M104 96l3 6 6 3-6 3-3 6-3-6-6-3 6-3z"/><path d="M10 100l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/></g>';
    }
  }

  function eyesIdle() {
    return '<g class="blink"><ellipse cx="44" cy="64" rx="5.5" ry="7" fill="' + INK + '"/><circle cx="46" cy="61" r="2.2" fill="#fff"/></g>' +
      '<g class="blink"><ellipse cx="76" cy="64" rx="5.5" ry="7" fill="' + INK + '"/><circle cx="78" cy="61" r="2.2" fill="#fff"/></g>';
  }
  function eyesHappy(y) {
    y = y || 66;
    return '<path d="M37 ' + y + 'Q44 ' + (y - 12) + ' 51 ' + y + '" fill="none"' + stroke(4.5) + '/>' +
      '<path d="M69 ' + y + 'Q76 ' + (y - 12) + ' 83 ' + y + '" fill="none"' + stroke(4.5) + '/>';
  }
  function tear(x, y) { return '<path d="M' + x + ' ' + y + 'q-5 8 0 11q5 -3 0 -11z" fill="#7fd8ff"' + stroke(2.5) + '/>'; }

  function features(mood) {
    var m = '';
    switch (mood) {
      case 'cheer':
      case 'win':
        return eyesHappy(66) +
          '<path d="M46 76Q60 102 74 76Z" fill="' + INK + '"' + stroke(3) + '/><path d="M52 87Q60 80 68 87Q60 96 52 87Z" fill="#ff6f8e"/>';
      case 'laugh':
        return eyesHappy(64) + tear(32, 70) + tear(88, 70) +
          '<path d="M40 74Q60 110 80 74Z" fill="' + INK + '"' + stroke(3) + '/><path d="M49 92Q60 82 71 92Q60 102 49 92Z" fill="#ff6f8e"/>';
      case 'worry':
        return '<circle cx="44" cy="62" r="10" fill="#fff"' + stroke(3) + '/><circle cx="76" cy="62" r="10" fill="#fff"' + stroke(3) + '/>' +
          '<circle cx="45" cy="64" r="3.8" fill="' + INK + '"/><circle cx="75" cy="64" r="3.8" fill="' + INK + '"/>' +
          '<path d="M33 46L52 52M87 46L68 52" fill="none"' + stroke(4) + '/>' +
          '<path d="M48 88Q54 80 60 86Q66 92 72 84" fill="none"' + stroke(4) + '/>';
      case 'sad':
        return '<ellipse cx="44" cy="64" rx="5.5" ry="7" fill="' + INK + '"/><circle cx="46" cy="61" r="2.2" fill="#fff"/><ellipse cx="76" cy="64" rx="5.5" ry="7" fill="' + INK + '"/><circle cx="78" cy="61" r="2.2" fill="#fff"/>' +
          '<path d="M34 54L52 46M86 54L68 46" fill="none"' + stroke(4) + '/>' + tear(36, 74) +
          '<path d="M50 88Q60 76 70 88" fill="none"' + stroke(4.5) + '/>';
      case 'dizzy':
        return '<path d="M38 58L50 70M50 58L38 70M70 58L82 70M82 58L70 70" fill="none"' + stroke(4.5) + '/>' +
          '<ellipse cx="60" cy="86" rx="6" ry="7" fill="' + INK + '"/>';
      case 'pied':
        return '<ellipse cx="44" cy="52" rx="5" ry="6.5" fill="' + INK + '"/><ellipse cx="76" cy="52" rx="5" ry="6.5" fill="' + INK + '"/>' +
          '<path d="M34 44L52 38M86 44L68 38" fill="none"' + stroke(3.5) + '/>' +
          '<path d="M20 72Q28 60 44 68Q60 58 76 68Q92 60 100 74Q110 92 96 104Q84 116 62 110Q42 116 28 106Q12 92 20 72Z" fill="#fffdf3"' + stroke(3.5) + '/>' +
          '<path d="M34 104q-3 14 4 14q7 0 4 -14M80 106q-3 12 3 12q6 0 4 -12" fill="#fffdf3"' + stroke(3) + '/>' +
          '<circle cx="62" cy="88" r="7" fill="#ff3d5e"' + stroke(3) + '/><circle cx="60" cy="86" r="2" fill="#fff"/>';
      default:
        return eyesIdle() + '<path d="M51 79Q60 88 69 79" fill="none"' + stroke(4) + '/>';
    }
  }

  function slotSkin(i) {
    if (live[i] != null) return live[i];
    var sk = SD.store && SD.store.get('skins');
    return sk && sk[i] != null ? sk[i] : i;
  }

  function face(i, mood, opts) {
    opts = opts || {};
    var id = opts.skin != null ? opts.skin : slotSkin(i);
    var tint = opts.tint != null ? (opts.tint | 0) : (opts.skin != null ? 0 : slotTint(i));
    var blush = lite((cols(id, tint).fill || '#ff6f8e'), 0.2);
    var cheeks = mood === 'pied' || mood === 'dizzy' ? '' :
      '<ellipse cx="32" cy="78" rx="7" ry="5" fill="' + blush + '" opacity=".55"/><ellipse cx="88" cy="78" rx="7" ry="5" fill="' + blush + '" opacity=".55"/>';
    var crown = opts.crown && id < 9 ?
      '<path d="M36 26L42 6L54 18L60 2L66 18L78 6L84 26Z" fill="#ffd23f"' + stroke(3.5) + '/><circle cx="60" cy="14" r="3" fill="#ff4d6d"/>' : '';
    return '<svg class="face f' + i + ' rar-' + TIER_OF[id] + ' m-' + (mood || 'idle') + '" viewBox="0 0 120 120" aria-hidden="true" focusable="false">' +
      body(id, tint) + cheeks + features(mood || 'idle') + crown + '</svg>';
  }

  /* --- icons: sticker style, viewBox 64 --- */
  var ICONS = {
    balloon: '<ellipse cx="32" cy="26" rx="18" ry="21" fill="#ff7aa8"' + stroke(4) + '/><path d="M32 47L26 54H38Z" fill="#ff7aa8"' + stroke(3.5) + '/><path d="M32 54Q24 58 32 61Q40 64 32 68" fill="none"' + stroke(3) + '/><ellipse cx="24" cy="18" rx="4" ry="7" fill="#fff" opacity=".75"/>',
    clock: '<circle cx="32" cy="35" r="22" fill="#fff"' + stroke(4) + '/><path d="M32 35V21M32 35L42 41" fill="none"' + stroke(4.5) + '/><path d="M16 11L24 17M48 11L40 17" fill="none"' + stroke(5) + '/><circle cx="32" cy="35" r="2.5" fill="' + INK + '"/>',
    bolt: '<path d="M38 5L13 37H28L23 60L51 25H35Z" fill="#ffd23f"' + stroke(4) + '/>',
    light: '<rect x="18" y="4" width="28" height="56" rx="12" fill="#5a3d94"' + stroke(4) + '/><circle cx="32" cy="17" r="6.5" fill="#ff4d6d"' + stroke(2.5) + '/><circle cx="32" cy="32" r="6.5" fill="#ffd23f"' + stroke(2.5) + '/><circle cx="32" cy="47" r="6.5" fill="#37e08d"' + stroke(2.5) + '/>',
    bomb: '<circle cx="30" cy="38" r="21" fill="#3d2670"' + stroke(4) + '/><ellipse cx="22" cy="30" rx="5" ry="7" fill="#fff" opacity=".35"/><path d="M42 22Q48 14 54 14" fill="none"' + stroke(4) + '/><path d="M54 6L56 12L62 14L56 16L54 22L52 16L46 14L52 12Z" fill="#ffd23f"' + stroke(2.5) + '/>',
    pie: '<path d="M6 36H58L52 56H12Z" fill="#e8a24a"' + stroke(4) + '/><path d="M8 36Q8 18 32 18Q56 18 56 36Z" fill="#fffdf3"' + stroke(4) + '/><circle cx="32" cy="14" r="6" fill="#ff3d5e"' + stroke(3.5) + '/><circle cx="30" cy="12" r="1.8" fill="#fff"/>',
    bill: '<circle cx="32" cy="32" r="24" fill="#ffd23f"' + stroke(4) + '/><circle cx="32" cy="32" r="16" fill="none" stroke="#e6a800" stroke-width="3"/><path d="M32 21V43M38 26Q38 22 32 22Q26 22 26 27Q26 31 32 32Q38 33 38 38Q38 42 32 42Q26 42 26 38" fill="none"' + stroke(3.5) + '/>',
    gear: '<circle cx="32" cy="32" r="11" fill="none" stroke="currentColor" stroke-width="6"/><path d="M32 6V14M32 50V58M6 32H14M50 32H58M14 14L20 20M44 44L50 50M50 14L44 20M20 44L14 50" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>',
    trophy: '<path d="M18 8H46V26Q46 40 32 42Q18 40 18 26Z" fill="#ffd23f"' + stroke(4) + '/><path d="M18 14H8Q8 28 20 30M46 14H56Q56 28 44 30" fill="none"' + stroke(4) + '/><path d="M32 42V50M20 58H44L42 50H22Z" fill="#ffd23f"' + stroke(4) + '/>',
    wheel: '<circle cx="32" cy="35" r="23" fill="#fff"' + stroke(4) + '/><path d="M32 35V12A23 23 0 0 1 55 35Z" fill="#ff8cc3"/><path d="M32 35H55A23 23 0 0 1 32 58Z" fill="#6fcfff"/><path d="M32 35V58A23 23 0 0 1 9 35Z" fill="#ffd84d"/><path d="M32 35H9A23 23 0 0 1 32 12Z" fill="#76e6a8"/><circle cx="32" cy="35" r="23" fill="none"' + stroke(4) + '/><path d="M32 35V12M32 35H55M32 35V58M32 35H9" stroke="' + INK + '" stroke-width="3"/><path d="M26 2L38 2L32 12Z" fill="#ff4d6d"' + stroke(3) + '/>',
    finger: '<circle cx="32" cy="32" r="8" fill="#fff"' + stroke(4) + '/><circle cx="32" cy="32" r="17" fill="none"' + stroke(3.5) + ' opacity=".55"/><circle cx="32" cy="32" r="26" fill="none"' + stroke(3) + ' opacity=".3"/>',
    crown: '<path d="M8 50L12 16L26 30L32 10L38 30L52 16L56 50Z" fill="#ffd23f"' + stroke(4) + '/><circle cx="32" cy="42" r="4" fill="#ff4d6d"' + stroke(2.5) + '/>',
    eye: '<ellipse cx="32" cy="32" rx="26" ry="18" fill="#fff"' + stroke(4) + '/><circle cx="32" cy="32" r="11" fill="#ff4d6d"' + stroke(3) + '/><circle cx="32" cy="32" r="5" fill="' + INK + '"/><circle cx="28" cy="28" r="2.5" fill="#fff"/>',
    note: '<circle cx="20" cy="46" r="10" fill="#9b6bff"' + stroke(4) + '/><circle cx="44" cy="40" r="10" fill="#9b6bff"' + stroke(4) + '/><path d="M30 44V12L54 6V38" fill="none"' + stroke(5) + '/>',
    candy: '<path d="M10 20L22 32L10 44Z" fill="#ff8cc3"' + stroke(3.5) + '/><path d="M54 20L42 32L54 44Z" fill="#ff8cc3"' + stroke(3.5) + '/><circle cx="32" cy="32" r="15" fill="#ffd84d"' + stroke(4) + '/><path d="M23 26Q32 40 41 26" fill="none"' + stroke(3) + '/>',
    check: '<path d="M12 34L26 48L52 18" fill="none"' + stroke(9) + '/>',
    cross: '<path d="M16 16L48 48M48 16L16 48" fill="none"' + stroke(9) + '/>',
    lock: '<rect x="14" y="28" width="36" height="28" rx="7" fill="#ffd23f"' + stroke(4) + '/><path d="M22 28V21Q22 9 32 9Q42 9 42 21V28" fill="none"' + stroke(4) + '/><circle cx="32" cy="42" r="4" fill="' + INK + '"/>',
    skull: '<path d="M12 30Q12 8 32 8Q52 8 52 30Q52 38 46 42V54H18V42Q12 38 12 30Z" fill="#fff"' + stroke(4) + '/><circle cx="24" cy="31" r="6" fill="' + INK + '"/><circle cx="40" cy="31" r="6" fill="' + INK + '"/><path d="M28 44V54M36 44V54" fill="none"' + stroke(3) + '/>',
    star: '<path d="M32 5L40 24L60 26L45 39L49 59L32 48L15 59L19 39L4 26L24 24Z" fill="#ffd23f"' + stroke(4) + '/>',
    starOff: '<path d="M32 5L40 24L60 26L45 39L49 59L32 48L15 59L19 39L4 26L24 24Z" fill="#fff"' + stroke(4) + '/>',
    bot: '<rect x="10" y="20" width="44" height="36" rx="11" fill="#9fb8d6"' + stroke(4) + '/><path d="M32 20V10" fill="none"' + stroke(4) + '/><circle cx="32" cy="8" r="4.5" fill="#ff4d6d"' + stroke(3) + '/><circle cx="23" cy="36" r="5.5" fill="#fff"' + stroke(3) + '/><circle cx="41" cy="36" r="5.5" fill="#fff"' + stroke(3) + '/><path d="M24 47H40" fill="none"' + stroke(3.5) + '/>',
    thumbdown: '<g transform="translate(0 64) scale(1 -1)"><rect x="5" y="28" width="13" height="28" rx="3" fill="#9b6bff"' + stroke(4) + '/><path d="M22 30L31 8Q38 5 41 12L38 24H52Q59 24 57 32L53 49Q51 56 44 56H22Z" fill="#ff8aa0"' + stroke(4) + '/></g>',
    globe: '<circle cx="32" cy="32" r="24" fill="#6fcfff"' + stroke(4) + '/><path d="M20 16Q30 20 26 30Q18 34 14 28M40 34Q50 32 52 42Q46 52 38 50Q34 42 40 34Z" fill="#76e6a8"' + stroke(3) + '/><ellipse cx="24" cy="20" rx="4" ry="7" fill="#fff" opacity=".6"/>',
    offline: '<circle cx="32" cy="32" r="24" fill="#6fcfff"' + stroke(4) + '/><path d="M20 16Q30 20 26 30Q18 34 14 28M40 34Q50 32 52 42Q46 52 38 50Q34 42 40 34Z" fill="#76e6a8"' + stroke(3) + '/><ellipse cx="24" cy="20" rx="4" ry="7" fill="#fff" opacity=".6"/>' + '<path d="M10 54L54 10" stroke="#fff" stroke-width="11" stroke-linecap="round"/><path d="M10 54L54 10" stroke="#ff4d6d" stroke-width="6" stroke-linecap="round"/>',
    friend: '<circle cx="22" cy="24" r="10" fill="#ffd0e6"' + stroke(4) + '/><circle cx="44" cy="28" r="10" fill="#d4f1ff"' + stroke(4) + '/><path d="M6 56Q6 40 22 40Q38 40 38 56Z" fill="#ffd0e6"' + stroke(4) + '/><path d="M30 58Q30 44 44 44Q58 44 58 58Z" fill="#d4f1ff"' + stroke(4) + '/>',
    playgo: '<circle cx="32" cy="32" r="24" fill="#76e6a8"' + stroke(4) + '/><path d="M26 18L48 32L26 46Z" fill="#fff"' + stroke(4) + '/>',
    medal: '<path d="M20 4L30 24M44 4L34 24" fill="none"' + stroke(5) + '/><circle cx="32" cy="40" r="18" fill="#ffd23f"' + stroke(4) + '/><path d="M32 30V50M26 35L32 30" fill="none"' + stroke(4) + '/>',
    /* plain UI icons that follow the button colour */
    music: '<path d="M24 46V14L50 8V40" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="18" cy="48" r="8" fill="currentColor"/><circle cx="44" cy="42" r="8" fill="currentColor"/>',
    speaker: '<path d="M8 25H18L30 14V50L18 39H8Z" fill="currentColor" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M40 22Q46 32 40 42M47 15Q58 32 47 49" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>',
    voice: '<rect x="22" y="6" width="20" height="30" rx="10" fill="currentColor"/><path d="M14 30Q14 48 32 48Q50 48 50 30M32 48V58M22 58H42" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>',
    home: '<path d="M8 32L32 10L56 32M14 28V54H26V38H38V54H50V28" fill="none" stroke="currentColor" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/>',
    again: '<path d="M50 24A20 20 0 1 0 52 36" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/><path d="M52 8V26H34" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>',
    share: '<path d="M32 40V8M20 20L32 8L44 20M12 30V54H52V30" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>',
    close: '<path d="M14 14L50 50M50 14L14 50" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>',
    slash: '<path d="M10 54L54 10" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>',
    back: '<path d="M38 10L14 32L38 54" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 32H52" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>',
    fwd: '<path d="M26 10L50 32L26 54" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><path d="M46 32H12" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>',
    zap: '<path d="M38 5L13 37H28L23 60L51 25H35Z" fill="#9b6bff"' + stroke(4) + '/><path d="M30 16L26 28" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" opacity=".85"/>',
    cup: '<path d="M18 8H46V26Q46 40 32 42Q18 40 18 26Z" fill="#ff7a32"' + stroke(4) + '/><path d="M18 14H8Q8 28 20 30M46 14H56Q56 28 44 30" fill="none"' + stroke(4) + '/><path d="M32 42V50M20 58H44L42 50H22Z" fill="#ff7a32"' + stroke(4) + '/><ellipse cx="28" cy="16" rx="5" ry="7" fill="#fff" opacity=".55"/>',
    spark: '<path d="M32 5L40 24L60 26L45 39L49 59L32 48L15 59L19 39L4 26L24 24Z" fill="#ff4d6d"' + stroke(4) + '/><path d="M32 16L35 26" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" opacity=".85"/>',
    more: '<circle cx="14" cy="32" r="6" fill="currentColor"/><circle cx="32" cy="32" r="6" fill="currentColor"/><circle cx="50" cy="32" r="6" fill="currentColor"/>'
  };

  function icon(name, size, cls) {
    var s = size ? ' width="' + size + '" height="' + size + '"' : '';
    return '<svg class="ico ' + (cls || '') + '" viewBox="0 0 64 64"' + s + ' aria-hidden="true" focusable="false">' + (ICONS[name] || '') + '</svg>';
  }

  SD.art = {
    CHARS: CHARS, SKINS: SKINS, PALETTES: PALETTES, INK: INK, face: face, icon: icon, slotSkin: slotSkin, slotTint: slotTint,
    skinName: function (id) { return SKINS[id].name; },
    addIcons: function (o) { Object.keys(o).forEach(function (k) { ICONS[k] = o[k]; }); },
    setLive: function (i, id) { live[i] = id; },
    setLiveTint: function (i, t) { liveTint[i] = t; },
    botSkin: function () { var mine = slotSkin(0); return mine === 7 ? 6 : 7; },     // the bot is always ROBO (GHOSTY if you wear ROBO)
    tiers: TIERS, rarity: function (id) { var t = TIERS[TIER_OF[id]]; return { rank: TIER_OF[id], id: t.id, name: t.name, color: t.color }; },
    skinReq: function (id) { return { lvl: REQ[id][0], cost: REQ[id][1] }; },
    unlockLevel: function (id) { return REQ[id][0]; }
  };
})();
