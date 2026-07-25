# F3 Pace Race

A mobile-first installable web app for a two-team, four-mile out-and-back pace race.

## Current prototype

- Gazelles and Clydesdales team selection
- Team-specific weighted pace ranges
- Quarter-mile check-ins
- Shared line-style race status
- 16 total segments for a 4-mile workout
- 3D motion-reactive stopwatch on supported phones
- Local persistence with `localStorage`
- Installable PWA and offline shell

## Pace ranges

- Gazelles: **7:00–11:00 per mile**
- Clydesdales: **9:00–13:00 per mile**

The distributions overlap. A Gazelle can draw a slower pace than a Clydesdale. A modest catch-up adjustment helps the trailing team without guaranteeing a result.

## Run locally

Because the app uses a service worker, serve it over HTTP rather than opening `index.html` directly.

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## Deploy to GitHub Pages

1. Create a new GitHub repository.
2. Upload the contents of this folder.
3. Open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select the `main` branch and `/root`.
6. Save.

## iPhone installation

1. Open the deployed site in Safari.
2. Tap Share.
3. Tap **Add to Home Screen**.
4. Launch the installed app.
5. Tap **Enable 3D** to grant motion access.

## Logo note

The current watch face uses a text placeholder reading `F3`. Replace it with an official logo asset that you have permission to use.

## Next build

- Create/join room codes
- Supabase real-time synchronization
- Separate captain and Q views
- Undo and correction controls
- Race history
- Course presets
