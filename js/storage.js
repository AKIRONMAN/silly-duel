/* Tiny local cache. Progress is copied to Firestore for guests and Google accounts.
   The phone copy is overwritten from the cloud when we are online. */
window.SD = window.SD || {};
(function () {
  'use strict';
  var KEY = 'sillyduel.v1';
  var EXTRA = ['sd_arena', 'sd_seen', 'sd_ledger'];         // small extra keys kept outside the main save
  var UID_KEY = 'sd_uid';                       // device id used to fetch this player's Firestore save
  var defaults = {
    pies: [0, 0], plays: 0, music: true, sfx: true, voice: true,
    opp: 'friend',                 // 'friend' (same phone) or 'bot'
    skins: [1, 0],                 // equipped skin for player 1 and player 2
    tints: [0, 0],                 // color palette index per player (0 = skin's own colors)
    rooms: ['bubble'],             // play rooms the player bought
    unlocked: [0, 1],              // skin ids the player owns
    level: 1, xp: 0, wins: 0, losses: 0, owins: 0, olosses: 0, guestName: '', coins: 0, inv: {}, keys: ['Q', 'P'], ctrlV: 'bottom', ctrlH: 'right', names: ['', 'FRIEND'], acct: '', games: 5, named: 0, editedAt: 0
  };
  var data = {}, onChange = null, mute = false, editedAt = 0;
  var CG = SD.BUILD === 'cg';
  var persist = {
    getItem: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    setItem: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    removeItem: function (k) { try { localStorage.removeItem(k); } catch (e) {} }
  };

  function normalize() {
    Object.keys(defaults).forEach(function (k) { if (data[k] === undefined) data[k] = JSON.parse(JSON.stringify(defaults[k])); });
    if (!Array.isArray(data.pies)) data.pies = [0, 0];
    data.pies = [data.pies[0] | 0, data.pies[1] | 0];
    if (!Array.isArray(data.rooms) || data.rooms.indexOf('bubble') < 0) data.rooms = ['bubble'];
    if (!Array.isArray(data.unlocked) || data.unlocked.indexOf(0) < 0) data.unlocked = [0, 1];
    if (data.unlocked.indexOf(1) < 0) data.unlocked.push(1);
    if (!Array.isArray(data.skins) || data.skins.length !== 2) data.skins = [1, 0];
    if (!data.skinSwap) { data.skinSwap = 1; if (data.skins[0] === 0 && data.skins[1] === 1) data.skins = [1, 0]; }          // player one is blue by default, player two pink
    data.skins = data.skins.map(function (s, i) { return data.unlocked.indexOf(s) >= 0 ? s : 1 - i; });
    if (!Array.isArray(data.tints) || data.tints.length !== 2) data.tints = [0, 0];
    data.tints = [data.tints[0] | 0, data.tints[1] | 0];
    if (!(data.level >= 1)) data.level = 1;
    if (!(data.wins > 0) && data.pies) data.wins = data.pies[1] | 0;   // old saves: friend pies ≈ your local wins
    if (data.opp !== 'bot') data.opp = 'friend';
    if (data.games !== 3 && data.games !== 8) data.games = 5;
    if (!Array.isArray(data.names) || data.names.length !== 2) data.names = ['', 'FRIEND'];
    if (!data.names[0]) {                                  // a funny name is picked automatically
      var A = ['BOBA', 'TOFU', 'MANGO', 'NACHO', 'MOCHI', 'PICKLE', 'WAFFLE', 'DONUT', 'TACO', 'JELLY', 'MUFFIN', 'PANCAKE'];
      data.names[0] = A[Math.floor(Math.random() * A.length)] + (10 + Math.floor(Math.random() * 90));
    }
    if (!data.names[1]) data.names[1] = 'FRIEND';
  }
  try { data = JSON.parse(persist.getItem(KEY)) || {}; } catch (e) { data = {}; }
  normalize();
  editedAt = +data.editedAt || 0;

  function write() {
    var raw;
    try { raw = JSON.stringify(data); } catch (e) { return; }
    try { persist.setItem(KEY, raw); } catch (e) {}
    if (CG) { try { localStorage.setItem(KEY, raw); } catch (e) {} }
  }
  function save() {
    if (!mute) {
      data.editedAt = Date.now();
      editedAt = data.editedAt;
    }
    write();
    if (!mute && onChange) onChange();
  }
  function ints(arr, n) { var a = Array.isArray(arr) ? arr.slice(0, n) : []; while (a.length < n) a.push(0); return a.map(function (x) { return x | 0; }); }

  SD.store = {
    get: function (k) { return data[k]; },
    set: function (k, v) { data[k] = v; save(); },
    /* change a value without triggering a cloud save (bookkeeping such as the account id) */
    quiet: function (k, v) { data[k] = v; write(); },
    addPie: function (i) { if (i < 2) { data.pies[i] = (data.pies[i] || 0) + 1; save(); } },
    addPlay: function () { data.plays = (data.plays || 0) + 1; save(); },
    pies: function () { return data.pies.slice(); },
    cleanName: function (n) { return String(n || '').replace(/[^A-Za-z0-9_ ]/g, '').replace(/\s+/g, ' ').trim().toUpperCase().slice(0, 12); },
    setName: function (i, n, opts) {
      n = SD.store.cleanName(n); if (!n) return false;
      var same = data.names[i] === n;
      var mark = i === 0 && !(opts && opts.soft);
      if (same && (!mark || data.named)) return true;
      data.names[i] = n;
      if (mark) data.named = 1;
      save();
      return true;
    },
    editedAt: function () { return Math.max(+editedAt || 0, +data.editedAt || 0); },
    markSynced: function (ts) { editedAt = +ts || 0; data.editedAt = editedAt; write(); },
    name: function (i) { return data.names[i]; },
    save: save,
    onChange: function (fn) { onChange = fn; },
    extraGet: function (k) { try { return persist.getItem(k); } catch (e) { return null; } },
    extraSet: function (k, v) { try { if (v == null) persist.removeItem(k); else persist.setItem(k, String(v)); } catch (e) {} },
    attach: function (backend) {
      if (!backend || typeof backend.getItem !== 'function') return false;
      var prev = data, prevEdit = +editedAt || 0;
      persist = backend;
      try {
        var raw = persist.getItem(KEY), remote = null;
        if (raw) {
          try { remote = JSON.parse(raw); } catch (er) { remote = null; }
        }
        var remoteTs = remote ? ((+remote.editedAt || 0) || (+remote.cloudTs || 0)) : 0;
        if (remote && typeof remote === 'object' && !(prevEdit && prevEdit > remoteTs)) data = remote;
        else data = prev;
      } catch (e) { data = prev; }
      normalize();
      write();
      EXTRA.forEach(function (k) {
        try {
          if (persist.getItem(k) != null) return;
          var old = null; try { old = localStorage.getItem(k); } catch (er) {}
          if (old != null) persist.setItem(k, old);
        } catch (er) {}
      });
      return true;
    },
    /* the whole save as text, for the cloud copy */
    dump: function () {
      var d = JSON.parse(JSON.stringify(data)), x = {};
      delete d.acct; delete d.cloudTs;
      EXTRA.forEach(function (k) { try { var v = persist.getItem(k); if (v != null) x[k] = v; } catch (e) {} });
      return JSON.stringify({ d: d, x: x });
    },
    /* replace the save with a cloud copy (keeps this device's account bookkeeping) */
    load: function (text) {
      var o; try { o = JSON.parse(text); } catch (e) { return false; }
      if (!o || typeof o.d !== 'object') return false;
      var keep = { acct: data.acct, cloudTs: data.cloudTs, nameLock: data.nameLock };
      data = o.d; data.acct = keep.acct; data.cloudTs = keep.cloudTs; data.nameLock = keep.nameLock;
      normalize(); write();
      EXTRA.forEach(function (k) { try { if (o.x && o.x[k] != null) persist.setItem(k, o.x[k]); else persist.removeItem(k); } catch (e) {} });
      return true;
    },
    /* back to a fresh guest on this phone; sound and control settings stay */
    reset: function () {
      var keep = {}; ['music', 'sfx', 'voice', 'keys', 'ctrlV', 'ctrlH', 'skinSwap'].forEach(function (k) { keep[k] = data[k]; });
      data = keep; editedAt = 0; normalize(); write();
      EXTRA.forEach(function (k) {
        if (k === 'sd_ledger') return;
        try { localStorage.removeItem(k); } catch (e) {}
      });
    },
    /* local save looks like it was edited (level/coins/unlocks) before any cloud copy exists */
    boosted: function () {
      var inv = data.inv && typeof data.inv === 'object' ? Object.keys(data.inv).length : 0;
      return (data.level | 0) > 1 || (data.coins | 0) > 0 || (data.owins | 0) > 0
        || (data.unlocked && data.unlocked.length > 2) || (data.rooms && data.rooms.length > 1) || inv > 0;
    },
    packCloud: function () {
      var inv = {}, src = data.inv && typeof data.inv === 'object' && !Array.isArray(data.inv) ? data.inv : {};
      Object.keys(src).forEach(function (k) { var n = src[k] | 0; if (n > 0) inv[k] = Math.min(9, n); });
      var arena = ''; try { arena = localStorage.getItem('sd_arena') || ''; } catch (e) {}
      var pack = {
        name: String((data.names && data.names[0]) || 'PLAYER').slice(0, 14),
        level: Math.max(1, Math.min(200, data.level | 0)),
        xp: Math.max(0, Math.min(3000, data.xp | 0)),
        coins: Math.max(0, Math.min(999999, data.coins | 0)),
        pies0: data.pies[0] | 0, pies1: data.pies[1] | 0,
        wins: data.wins | 0, losses: data.losses | 0,
        owins: Math.max(0, Math.min(500, data.owins | 0)), olosses: data.olosses | 0,
        unlocked: (data.unlocked || [0, 1]).slice(0, 16),
        rooms: (data.rooms || ['bubble']).slice(0, 10),
        skins: ints(data.skins, 2), tints: ints(data.tints, 2),
        inv: inv, arena: String(arena).slice(0, 16), named: data.named ? 1 : 0,
        ts: Math.max(Date.now(), +data.editedAt || 0, +editedAt || 0)
      };
      try {
        if (SD.ledger && SD.ledger.packCloud) {
          var h = SD.ledger.packCloud();
          pack.hm = h.hm; pack.hc = h.hc; pack.hp = h.hp;
        } else { pack.hm = []; pack.hc = []; pack.hp = []; }
      } catch (e) { pack.hm = []; pack.hc = []; pack.hp = []; }
      return pack;
    },
    uid: function () { try { return localStorage.getItem(UID_KEY) || data.acct || ''; } catch (e) { return data.acct || ''; } },
    setUid: function (id) {
      try { if (id) localStorage.setItem(UID_KEY, id); else localStorage.removeItem(UID_KEY); } catch (e) {}
    },
    applyCloud: function (s) {
      if (!s || typeof s !== 'object' || !(s.level >= 1)) return false;
      mute = true;
      data.level = s.level | 0; data.xp = s.xp | 0; data.coins = s.coins | 0;
      data.pies = [s.pies0 | 0, s.pies1 | 0];
      data.wins = s.wins | 0; data.losses = s.losses | 0;
      data.owins = s.owins | 0; data.olosses = s.olosses | 0;
      if (Array.isArray(s.unlocked)) data.unlocked = s.unlocked.slice();
      if (Array.isArray(s.rooms)) data.rooms = s.rooms.slice();
      if (Array.isArray(s.skins)) data.skins = ints(s.skins, 2);
      if (Array.isArray(s.tints)) data.tints = ints(s.tints, 2);
      data.inv = s.inv && typeof s.inv === 'object' && !Array.isArray(s.inv) ? s.inv : {};
      if (s.name) {
        if (!Array.isArray(data.names)) data.names = ['', 'FRIEND'];
        data.names[0] = SD.store.cleanName(s.name) || data.names[0];
      }
      if (s.named) data.named = 1;
      try { if (s.arena) localStorage.setItem('sd_arena', s.arena); } catch (e) {}
      try { if (SD.ledger && SD.ledger.applyCloud) SD.ledger.applyCloud(s); } catch (e) {}
      normalize(); write();
      mute = false;
      return true;
    }
  };
})();
