# TrainerBOT — Simple exercise routine builder

This is a small static web app that helps create a simple exercise routine (sets + rest) and runs timers for each set and rest period.

Files:
- `index.html` — main page
- `styles.css` — styles
- `app.js` — application logic

How to run
1. Open `index.html` in any modern browser (Chrome, Edge, Firefox). On Windows, double-click the file or right-click -> Open with -> Browser.
2. Set an exercise, reps (or seconds for timed exercises), number of sets, and rest time.
3. Click `Generate Routine` to preview the steps.
4. Click `Start` to run the routine. Use `Pause` to pause/resume and `Reset` to stop.

Extras
- Toggle "Notify on transitions" to enable a short beep and vibration (if supported) at transitions.
- Use `Save` to store the current routine in LocalStorage and `Load` to restore it.
- Keyboard shortcuts: G (generate), S (start), P (pause/resume), R (reset).

Notes
- This is a local static page — no server required.
- Timers will run only while the page/tab is active. Browser throttling on background tabs may affect timing.

License: MIT
