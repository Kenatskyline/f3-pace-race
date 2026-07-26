# F3 Pace Race

A mobile-first installable web app for a two-team, four-mile out-and-back pace race.

## Current app

- Fixed leadership roles:
  - **Q** leads Gazelles (12/front) and controls workout setup/start/end, Gazelles spin/check-in, undo/correction, and reset.
  - **SQ** leads Clydesdales (6/rear) and controls Clydesdales spin/check-in.
- Guided setup flow:
  1. Start workout
  2. Set pace ranges
  3. Confirm fixed 4-mile route (2 out, 2 back, 16 × ¼ mile)
  4. Open SQ slot
  5. SQ joins and workout begins
- Team-specific weighted pace ranges with adjustable limits
- Quarter-mile check-ins with undo for corrections
- Shared line-style race status
- 3D motion-reactive stopwatch on supported phones
- Local persistence with `localStorage`
- Installable PWA and offline shell

## Adjustable pace ranges (minutes per mile)

Default ranges:

- Gazelles: **7:00 (fastest) to 11:00 (slowest)**
- Clydesdales: **9:00 (fastest) to 13:00 (slowest)**

Setup uses 30-second increments with validation (`fastest <= slowest`). The spinner always stays inside each team range while keeping existing weighted balancing. Last-used ranges are saved and reloaded from `localStorage`, and you can reset ranges to defaults during setup.

## Advanced testing override

A secondary **Advanced testing overrides** panel allows manual Q/SQ team remapping for testing scenarios. Normal mode keeps fixed Q→Gazelles and SQ→Clydesdales assignments.

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
