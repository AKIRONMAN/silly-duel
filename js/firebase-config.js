/* Paste your Firebase web config here (Firebase console > Project settings > Your apps > Web app).
   These values are public by design. Safety comes from the Firestore rules in firestore.rules.
   Leave it as null and the game still works fully offline (ONLINE shows a setup hint). */
window.SD = window.SD || {};
SD.firebaseConfig = null;
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
