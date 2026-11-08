/* Tiny local save. Settings, pie counters, level, XP and unlocked skins.
   Lives on the device; when signed in with Google, js/net.js copies it to the player's private Firebase save. */
window.SD = window.SD || {};
(function () {
  'use strict';
  var KEY = 'sillyduel.v1';
  var EXTRA = ['sd_arena', 'sd_seen'];         // small extra keys kept outside the main save
  var defaults = {
    pies: [0, 0], plays: 0, music: true, sfx: true, voice: true,
    opp: 'friend',                 // 'friend' (same phone) or 'bot'
    skins: [1, 0],                 // equipped skin for player 1 and player 2
    rooms: ['bubble'],             // play rooms the player bought
    unlocked: [0, 1],              // skin ids the player owns
    level: 1, xp: 0, wins: 0, losses: 0, owins: 0, olosses: 0, guestName: '', coins: 0, inv: {}, keys: ['Q', 'P'], ctrlV: 'bottom', ctrlH: 'right', names: ['', 'FRIEND'], acct: ''
  };
  var data = {}, onChange = null;

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
    if (!(data.level >= 1)) data.level = 1;
    if (data.opp !== 'bot') data.opp = 'friend';
    if (!Array.isArray(data.names) || data.names.length !== 2) data.names = ['', 'FRIEND'];
    if (!data.names[0]) {                                  // a funny name is picked automatically
      var A = ['BOBA', 'TOFU', 'MANGO', 'NACHO', 'MOCHI', 'PICKLE', 'WAFFLE', 'DONUT', 'TACO', 'JELLY', 'MUFFIN', 'PANCAKE'];
      data.names[0] = A[Math.floor(Math.random() * A.length)] + (10 + Math.floor(Math.random() * 90));
    }
    if (!data.names[1]) data.names[1] = 'FRIEND';
  }
  try { data = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { data = {}; }
  normalize();

  function write() { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {} }
  function save() { write(); if (onChange) onChange(); }

  SD.store = {
    get: function (k) { return data[k]; },
    set: function (k, v) { data[k] = v; save(); },
    /* change a value without triggering a cloud save (bookkeeping such as the account id) */
    quiet: function (k, v) { data[k] = v; write(); },
    addPie: function (i) { if (i < 2) { data.pies[i] = (data.pies[i] || 0) + 1; save(); } },
    addPlay: function () { data.plays = (data.plays || 0) + 1; save(); },
    pies: function () { return data.pies.slice(); },
    cleanName: function (n) { return String(n || '').replace(/[^A-Za-z0-9_ ]/g, '').replace(/\s+/g, ' ').trim().toUpperCase().slice(0, 12); },
    setName: function (i, n) { n = SD.store.cleanName(n); if (!n) return false; data.names[i] = n; save(); return true; },
    name: function (i) { return data.names[i]; },
    save: save,
    onChange: function (fn) { onChange = fn; },
    /* the whole save as text, for the cloud copy */
    dump: function () {
      var d = JSON.parse(JSON.stringify(data)), x = {};
      delete d.acct; delete d.cloudTs;
      EXTRA.forEach(function (k) { try { var v = localStorage.getItem(k); if (v != null) x[k] = v; } catch (e) {} });
      return JSON.stringify({ d: d, x: x });
    },
    /* replace the save with a cloud copy (keeps this device's account bookkeeping) */
    load: function (text) {
      var o; try { o = JSON.parse(text); } catch (e) { return false; }
      if (!o || typeof o.d !== 'object') return false;
      var keep = { acct: data.acct, cloudTs: data.cloudTs };
      data = o.d; data.acct = keep.acct; data.cloudTs = keep.cloudTs;
      normalize(); write();
      EXTRA.forEach(function (k) { try { if (o.x && o.x[k] != null) localStorage.setItem(k, o.x[k]); else localStorage.removeItem(k); } catch (e) {} });
      return true;
    },
    /* back to a fresh guest on this phone; sound and control settings stay */
    reset: function () {
      var keep = {}; ['music', 'sfx', 'voice', 'keys', 'ctrlV', 'ctrlH', 'skinSwap'].forEach(function (k) { keep[k] = data[k]; });
      data = keep; normalize(); write();
      EXTRA.forEach(function (k) { try { localStorage.removeItem(k); } catch (e) {} });
    }
  };
})();
