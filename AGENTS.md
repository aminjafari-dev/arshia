# Arshia learning workspace

This project is a local Persian learning journal for Trade city pro. The user wants to observe real progress through the website. Keep it on localhost unless explicitly asked to deploy.

## Source fidelity

- Do not invent lessons, quotes, trading rules, screenshots, learning progress, or source timestamps.
- The catalog was verified from the three source YouTube playlists. Initial topic assignments are based on titles only, not completed study. Some titles were displayed by YouTube in English or truncated; preserve this provenance.
- Distinguish `arshia` (source-backed paraphrase), `user` (personal note), and `uncertain` (needs verification). Store concise paraphrases, not full copyrighted transcripts in the visible notes.
- Real learning artifacts live in `data/state.json`, optional transcript source files in `data/transcripts/`, and screenshots in `screenshots/`. Link every educational note to a real video and time range. All screenshots must be actual source frames.
- No lessons have been fully studied at initial setup. Catalog inspection is not lesson study.

## Update the live journal as you work

- Start a learning task by updating `/api/workflow` (PATCH) to `working`, with current task, lesson, and next step. Do not claim an autonomous background learner exists.
- Add notes as meaningful sections are reviewed, using `POST /api/notes` or atomic updates to `data/state.json`. Do not wait until the entire course is over to save work.
- Update `/api/lessons/:id` (PATCH) after each completed study section: `watchedSeconds`, `status`, and `coverage`. `watchedSeconds` is actual studied coverage, not a guessed estimate. Adjust approximate catalog duration to actual duration when it is verified.
- Mark a lesson `completed` only after source-backed notes, full coverage, necessary audio checks, visual examples, and final review are complete. Preserve ambiguities and later revisions rather than guessing.
- At the end of a turn set workflow to `ready`, `paused`, or `blocked` as appropriate, describing the next step. `paused` here is a journal activity label, not a Codex goal status. Do not leave a stale `working` indicator.
- The browser receives server-sent events and direct file replacements within about one second. Use atomic writes (`temp` then rename), maintain JSON schema, and preserve all existing user notes and images.
- Do not rerun `scripts/seed.mjs` on an existing journal. It intentionally refuses to overwrite data.

## Course coordination

- The coordinating chat follows `lessons[].order` in the journal, starting with the introduction (lesson zero). Start one local Codex chat per lesson in this project, using `gpt-6.2-sol` with reasoning effort `high`; reuse that lesson's chat if it needs to resume. The coordinator tracks the lesson and chat IDs in `data/lesson-chats.json`.
- Give the lesson chat the source URL, video ID, and any relevant findings from the previous lesson, including reliable ways to access captions or visuals. The lesson chat studies only its assigned video and writes its notes and progress to the shared journal as it goes.
- Prefer the original time-coded Persian captions. Compare unclear phrases, numbers, and trading terminology with the original audio when available. Use local transcription when it materially improves coverage or source fidelity. Capture actual frames where the visual changes the understanding of the lesson.
- The introduction study verified that `yt-dlp --no-playlist --write-auto-subs --sub-langs fa-orig --sub-format json3 -f 'best[height<=720]/best'` can retrieve the original Persian track and media. Check available tracks per video. The browser transcript export returned English for this introduction, so check the actual language before using any export. Use a temporary directory for media, captions, and intermediate frames. `ffmpeg` can produce contact sheets to locate visual changes and extract exact frames. Reuse locally cached Whisper models when a second reading is needed.
- End each lesson chat with a brief Persian report: study and verification status, actual coverage, types and counts of notes and images, and any unresolved questions or useful source-access findings. The coordinator receives the final report by waiting for the chat and verifies the result against the journal before initiating the next lesson. Resolve material gaps in the current lesson before moving on.

## Run and verify

`npm start` runs a dependency-free Node server at `http://127.0.0.1:4317`. `npm test` uses an isolated temporary journal; tests must never touch real learning data. Static UI changes require a browser reload. Do not create test notes in the user's real journal.

See `README.md` for API examples and persistence details. Bind to loopback only; retain origin/host checks and do not serve data directories or backups as static files.
