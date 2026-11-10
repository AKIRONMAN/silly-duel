# How to go live (cheap and stable)

Split the work:

| Piece | Where | Why |
|---|---|---|
| The game website (HTML, JS, CSS, fonts) | **Firebase Hosting** | Free CDN, HTTPS, already your Firebase project |
| MATCH / ROOM / PARTY sockets | **Render $7** | Only WebSockets. No game files. More players on 512 MB |
| CrazyGames | Zip `crazy-game/` and upload there | Separate. No Render. |

Do **not** put the website on Render. Players open Firebase. MATCH talks to Render in the background.

GitHub Pages also works for the website, but Firebase is the better fit here: login, TOP 100, and hosting stay in one project (`silly-duel`).

---

## 1. Render = match server only

Your service is already `silly-duel.onrender.com`. Keep the **$7 Starter**.

1. Start command: `npm start`
2. You do **not** need a `SERVE_FILES` variable. On Render the server skips game files by itself.
3. Optional: `MAX_PLAYERS=250`
4. Check [https://silly-duel.onrender.com/health](https://silly-duel.onrender.com/health) — you should see `ok 0/250`, not the game page.

`js/server-config.js` already points MATCH at:

`wss://silly-duel.onrender.com/ws`

Redeploy Render after you pull these server changes.

---

## 2. Firebase Hosting = the game players open

In a terminal, from this folder:

```bash
npx -y firebase-tools@latest login
npx -y firebase-tools@latest use silly-duel
npx -y firebase-tools@latest deploy --only hosting
```

The site will be:

- https://silly-duel.web.app
- https://silly-duel.firebaseapp.com

That is the URL you share. Not the Render URL.

### First time: allow this site to sign in

Firebase console → **Authentication** → **Settings** → **Authorized domains**

Add:

- `silly-duel.web.app`
- `silly-duel.firebaseapp.com`
- your own domain later, if you buy one

### Later updates

Change files, bump `VERSION` in `sw.js`, then run the same deploy command.

---

## 3. Play a test match

1. Open https://silly-duel.web.app on two phones (or a phone and a PC).
2. Tap **MATCH** on both.
3. If it pairs, Render is doing its job and Firebase is serving the game.

If MATCH says it cannot reach the server, Render is asleep or the WebSocket URL in `js/server-config.js` is wrong.

---

## Local wifi (unchanged)

`node server/server.js` on a laptop still serves the game **and** MATCH on the same address. Friends on that wifi open `http://YOUR-IP:3000`. That does not use Firebase or Render.

---

## CrazyGames

Still a separate zip of `crazy-game/`. See `crazy-game/CRAZYGAMES-STEPS.md`. No Render, no Firebase Hosting.
