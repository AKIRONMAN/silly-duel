/* Paste your Firebase web config here (Firebase console > Project settings > Your apps > Web app).
   These values are public by design. Safety comes from the Firestore rules in firestore.rules.
   Leave it as null and the game still works fully offline (ONLINE shows a setup hint). */
window.SD = window.SD || {};
SD.firebaseConfig = {
  apiKey: "AIzaSyAFCEK8RcmuzDue3NrcFrKVGLULti6o4og",
  authDomain: "silly-duel.firebaseapp.com",
  projectId: "silly-duel",
  storageBucket: "silly-duel.firebasestorage.app",
  messagingSenderId: "310400577260",
  appId: "1:310400577260:web:1f7877b8e1604c36d87fc9"
};
/* Example:
SD.firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  appId: "1:123:web:abc"
};
*/

/* Optional: add a TURN server here if some players cannot connect directly (strict networks).
   SD.iceServers = [{ urls: 'turn:YOUR_TURN_HOST:3478', username: '...', credential: '...' }]; */
