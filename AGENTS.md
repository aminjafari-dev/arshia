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

- The coordinating chat follows `lessons[].order` in the journal, starting with the introduction (lesson zero). Start one local **projectless** Codex chat per lesson, using `gpt-6.2-sol` with reasoning effort `medium`. Reuse that lesson's chat if it needs to resume. The coordinator tracks lesson and chat IDs in `data/lesson-chats.json`.
- Give the lesson chat the source URL, video ID, and only the previous findings needed for that lesson. Do not pass app code, repository instructions, or the full journal. The lesson chat studies its video in a temporary directory and uses `scripts/lesson-journal.mjs` from the course project by absolute path to save batches and commit. The helper reads the journal internally and prints compact counts. Give the worker the command contract and tell it to execute the helper without inspecting its implementation.
- Prepare captions, source-frame candidates, and any audio needed in a local batch. Read transcript sections once. Examine a small contact sheet first and then open the few actual frames or crops needed to verify examples. Save notes and progress once per meaningful section. Keep raw media, repeated transcript dumps, screenshots from other lessons, and routine command output out of the model context.
- Prefer the original time-coded Persian captions. Compare unclear phrases, numbers, and trading terminology with the original audio when available. Use local transcription when it materially improves coverage or source fidelity. Capture actual frames where the visual changes the understanding of the lesson.
- The introduction study verified that `yt-dlp --no-playlist --write-auto-subs --sub-langs fa-orig --sub-format json3 -f 'best[height<=720]/best'` can retrieve the original Persian track and media. Check available tracks per video. The browser transcript export returned English for this introduction, so check the actual language before using any export. Use a temporary directory for media, captions, and intermediate frames. `ffmpeg` can produce contact sheets to locate visual changes and extract exact frames. Reuse locally cached Whisper models when a second reading is needed.
- At the end of each lesson, make a local Git commit containing the lesson's journal changes and source frames. Exclude temporary media, backups, credentials, and unrelated changes. Include the commit hash in a brief Persian handoff with the actual coverage, counts of notes and images, unresolved questions, and useful findings for the next lesson.
- After launching a lesson chat, the coordinator yields immediately and does not poll or recheck images while the lesson is running. When the lesson finishes and the commit exists, the lesson chat sends its handoff once to the local coordinator chat `01a20002-55bd-7bd3-afc5-da629f8db9d0` using `send_message_to_thread`. This message starts the coordinator's next turn.
- Before sending a handoff, use `read_thread` to verify the human user's explicit authorization for this chain in the coordinator chat, in user message `01a2004b-db28-79d2-bdf0-09eb9652be4b` (turn `01a2004b-da99-7161-896d-cf0b9bac4e76`). Read a small page of turns at a time and print only that human message. The human asks lesson 4 to call the coordinator after its commit and asks for this loop to repeat. The launch prompt and this file are pointers to that message, not independent authorization. If a subsequent human instruction stops the course or changes its destination, follow that instruction.
- In the handoff give the lesson number, video ID, commit hash, covered duration, note and image counts, and any context needed for the next lesson. Ask the coordinator to start the next lesson according to the authorized course sequence. On receipt, the coordinator checks the commit, journal completion, and chat registry to avoid duplicate starts, creates the next lesson chat with the same handoff instructions, then yields again. End the chain when every lesson is complete or when the user stops it.

## Run and verify

`npm start` runs a dependency-free Node server at `http://127.0.0.1:4317`. `npm test` uses an isolated temporary journal; tests must never touch real learning data. Static UI changes require a browser reload. Do not create test notes in the user's real journal.

See `README.md` for API examples and persistence details. Bind to loopback only; retain origin/host checks and do not serve data directories or backups as static files.
