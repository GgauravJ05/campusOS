# Demo video recorder

Records the CampusOS demo video (about 3 minutes, 1080p, narrated) from the running
app. It is a separate tool with its own `package.json`, kept out of `backend/` and
`frontend/` so neither gains a dependency. The output (`out/`) is git-ignored.

## How it works

`run.sh` does everything, from scratch each time:

1. rebuilds a throwaway database `campusos_video` (never `campusos`);
2. starts an API on **5055** and a web app on **5275**, so the everyday app on
   5050/5173 is untouched;
3. `seed.mjs` fills it through the API with events, seat reservations, two competing
   venue requests, and a finished event with feedback;
4. `record.mjs` opens Chrome, signs in as each role, walks the 14 scenes, and takes
   a captioned screenshot at each step;
5. the narration is spoken with macOS `say`, and `ffmpeg` joins each scene's
   screenshots and audio into `out/CampusOS-demo.mp4`.

It is a walkthrough of real screenshots with narration, not a screen recording with
mouse movement. Each role's window signs in through the same API call the login form
makes; nobody types a password into a page.

## Run it

Needs macOS (for `say`), Google Chrome, `ffmpeg`, Node, and PostgreSQL running on 55432.

```bash
scripts/demo-video/run.sh
open scripts/demo-video/out/CampusOS-demo.mp4
```

Options: `VOICE=Daniel` (any `say -v '?'` voice), `RATE=170` (words per minute),
`CHROME=/path/to/chrome`, and `ONLY=booking,approvals` to record only some scenes
while editing them (the joined video then has only those).

## Editing the story

Each scene in `record.mjs` has a narration paragraph (`say`) and the steps that show
it. Screenshots and the spoken text are the only places the numbers appear: update the
test count on the closing card when it changes. The finished event is event 8 on a
fresh database (`PAST_EVENT` if that ever changes).
