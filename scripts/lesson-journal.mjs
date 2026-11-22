import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { basename, dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Read and write the journal without putting the application or full journal
// in the lesson chat's context. Print compact results only.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const base = `http://127.0.0.1:${process.env.ARSHIA_JOURNAL_PORT || 4317}`;
const [id, command] = process.argv.slice(2);
const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }).trim();
const lessonPath = `/api/lessons/${id}`;
const json = value => console.log(JSON.stringify(value));

async function request(path, method = 'GET', input) {
  const response = await fetch(base + path, {
    method,
    headers: input === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: input === undefined ? undefined : JSON.stringify(input),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`${method} ${path}: ${response.status} ${(await response.text()).slice(0, 250)}`);
  return response.json();
}

function imageForApi(image) {
  const type = { '.jpg': 'jpeg', '.jpeg': 'jpeg', '.png': 'png', '.webp': 'webp' }[extname(image.file).toLowerCase()];
  if (!type) throw new Error('Use a JPG, PNG or WebP source frame.');
  return { data: `data:image/${type};base64,${readFileSync(image.file).toString('base64')}`, caption: image.caption };
}

function noteKey(note) {
  return JSON.stringify([note.startSeconds, note.endSeconds, note.kind, note.title]);
}

function statistics(state, lesson) {
  const notes = state.notes.filter(note => note.lessonId === id);
  return {
    id, status: lesson.status, durationSeconds: lesson.durationSeconds, watchedSeconds: lesson.watchedSeconds,
    notes: notes.length, uncertainties: notes.filter(note => note.kind === 'uncertain').length,
    images: notes.reduce((sum, note) => sum + note.images.length, 0),
  };
}

function commitLesson(lesson, state) {
  const previous = JSON.parse(git('show', 'HEAD:data/state.json'));
  const other = value => JSON.stringify({
    lessons: value.lessons.filter(item => item.id !== id),
    notes: value.notes.filter(note => note.lessonId !== id),
  });
  if (other(state) !== other(previous)) throw new Error('Journal contains uncommitted changes for another lesson. The coordinator must review them.');
  const priorLesson = previous.lessons.find(item => item.id === id);
  if (priorLesson?.status === 'completed' && JSON.stringify(priorLesson) === JSON.stringify(lesson) && git('diff', 'HEAD', '--name-only', '--', 'data/state.json') === '') {
    return git('log', '-1', '--format=%H', '--', 'data/state.json');
  }
  const files = state.notes.filter(note => note.lessonId === id).flatMap(note => note.images).map(image => {
    const file = basename(image.src);
    if (!file.startsWith(`${id}-`)) throw new Error('Unexpected image path in this lesson.');
    return `screenshots/${file}`;
  });
  const paths = ['data/state.json', ...new Set(files)];
  if (git('diff', '--cached', '--name-only', '--', ...paths)) throw new Error('Lesson files already have staged changes. The coordinator must review them.');
  if (files.length) git('add', '--', ...new Set(files));
  try {
    git('commit', '--only', '-m', `Study Arshia lesson ${lesson.order - 1} (${id})`, '--', ...paths);
  } catch (error) {
    if (files.length) git('restore', '--staged', '--', ...new Set(files));
    throw error;
  }
  return git('rev-parse', 'HEAD');
}

async function run() {
  if (!/^[A-Za-z0-9_-]{11}$/.test(id ?? '') || !['status', 'save', 'commit'].includes(command)) {
    throw new Error('Usage: lesson-journal.mjs VIDEO_ID status|save|commit. The save command reads JSON from stdin.');
  }
  let state = await request('/api/state');
  let lesson = state.lessons.find(item => item.id === id);
  if (!lesson) throw new Error('Lesson is missing from the journal.');
  if (command === 'status') return json(statistics(state, lesson));
  if (command === 'commit') {
    if (lesson.status !== 'completed') throw new Error('Complete and verify the lesson before committing.');
    for (const note of state.notes.filter(item => item.lessonId === id)) {
      for (const image of note.images) {
        const result = await fetch(base + image.src, { method: 'HEAD', signal: AbortSignal.timeout(10000) });
        if (!result.ok || !result.headers.get('content-type')?.startsWith('image/')) throw new Error('A source frame cannot be loaded from the journal.');
      }
    }
    return json({ ...statistics(state, lesson), commit: commitLesson(lesson, state) });
  }
  const input = JSON.parse(readFileSync(0, 'utf8'));
  if (lesson.status === 'completed' && (input.lesson || input.notes?.length)) throw new Error('This lesson is already complete.');
  const notes = (input.notes ?? []).map(note => ({
    lessonId: id, title: note.title, content: note.content,
    startSeconds: note.startSeconds, endSeconds: note.endSeconds,
    kind: note.kind ?? 'arshia', topicIds: note.topicIds ?? [],
    images: (note.images ?? []).map(imageForApi),
  }));
  const update = { ...input.lesson };
  if (update.durationSeconds !== undefined && update.durationSeconds !== lesson.durationSeconds) {
    lesson = await request(lessonPath, 'PATCH', { durationSeconds: update.durationSeconds, durationApproximate: update.durationApproximate ?? false });
    delete update.durationSeconds;
    delete update.durationApproximate;
  }
  const existing = new Set(state.notes.filter(note => note.lessonId === id).map(noteKey));
  for (const note of notes) {
    const key = noteKey(note);
    if (existing.has(key)) continue;
    await request('/api/notes', 'POST', note);
    existing.add(key);
  }
  if (Object.keys(update).length) lesson = await request(lessonPath, 'PATCH', update);
  if (input.workflow) {
    const next = state.lessons.find(item => item.order === lesson.order + 1);
    await request('/api/workflow', 'PATCH', { ...input.workflow, lessonId: lesson.status === 'completed' ? next?.id ?? null : id });
  }
  state = await request('/api/state');
  return json(statistics(state, lesson));
}

try { await run(); } catch (error) { console.error(error.message); process.exitCode = 1; }
