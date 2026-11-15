/* Slim Firebase client for CrazyGames: anonymous auth + feedback writes only. */
window.SD = window.SD || {};
(function () {
  'use strict';
  var st = SD.store;
  var V = '10.14.1', BASE = 'https://www.gstatic.com/firebasejs/' + V + '/';
  var FB = null, loadP = null;

  function configured() { var c = SD.firebaseConfig; return !!(c && c.apiKey && c.projectId); }
  function nice(e) {
    var c = (e && (e.code || e.message)) || '';
    if (/network|NETWORK/.test(c)) return 'CANNOT REACH THE SERVER. CHECK INTERNET';
    if (/permission-denied/.test(c)) return 'FIREBASE RULES BLOCKED THIS';
    if (/unauthorized-domain/.test(c)) return 'ADD THIS SITE IN FIREBASE AUTHORIZED DOMAINS';
    if (/too-many/.test(c)) return 'WAIT A MINUTE, TRY AGAIN';
    return 'SOMETHING WENT WRONG';
  }
  function load() {
    if (loadP) return loadP;
    loadP = Promise.all([
      import(BASE + 'firebase-app.js'),
      import(BASE + 'firebase-auth.js'),
      import(BASE + 'firebase-firestore.js')
    ]).then(function (m) {
      var app = m[0].initializeApp(SD.firebaseConfig);
      FB = { a: m[1], f: m[2], auth: m[1].getAuth(app), db: m[2].getFirestore(app) };
      return FB;
    });
    return loadP;
  }
  function ensureAuth() {
    return load().then(function () {
      return FB.auth.authStateReady ? FB.auth.authStateReady() : null;
    }).then(function () {
      if (!FB.auth.currentUser) return FB.a.signInAnonymously(FB.auth);
    });
  }

  SD.net = {
    nice: nice,
    sendFeedback: function (msg, stars) {
      msg = String(msg || '').replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim();
      stars = stars | 0;
      if (stars < 1 || stars > 5) return Promise.reject({ code: 'stars' });
      if (msg.length > 400) msg = msg.slice(0, 400);
      if (!configured()) return Promise.reject({ code: 'offline' });
      return ensureAuth().then(function () {
        var u = FB.auth.currentUser;
        if (!u) return Promise.reject({ code: 'no-auth' });
        var name = String((st && st.name) ? st.name(0) : 'GUEST').slice(0, 14) || 'GUEST';
        return FB.f.addDoc(FB.f.collection(FB.db, 'feedback'), {
          uid: u.uid,
          name: name,
          msg: msg,
          stars: stars,
          ts: Date.now(),
          src: 'cg'
        });
      });
    }
  };
})();
