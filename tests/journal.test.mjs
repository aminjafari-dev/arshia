import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

let child, folder, base, statePath, original, fixture;
const request = async (url, method, data, headers = {}) => fetch(base + url, { method, headers: { 'Content-Type': 'application/json', ...headers }, ...(data === undefined ? {} : { body: JSON.stringify(data) }) });
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN1sAAAAASUVORK5CYII=';
before(async () => {
  original = await readFile(new URL('../data/state.json', import.meta.url), 'utf8');
  fixture = JSON.parse(original); fixture.notes = []; fixture.activity = [];
  for (const lesson of fixture.lessons) { lesson.status = 'not_started'; lesson.watchedSeconds = 0; lesson.coverage = { transcript: false, audio: false, visuals: false, verified: false }; }
  folder = await mkdtemp(path.join(tmpdir(), 'arshia-test-'));
  await mkdir(path.join(folder, 'data'));
  statePath = path.join(folder, 'data/state.json');
  await writeFile(statePath, JSON.stringify(fixture));
  const probe = net.createServer(); probe.listen(0, '127.0.0.1'); await once(probe, 'listening');
  const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
  base = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, ['server.mjs'], { cwd: new URL('..', import.meta.url), env: { ...process.env, PORT: String(port), ARSHIA_DATA_DIR: path.join(folder, 'data'), ARSHIA_SCREENSHOT_DIR: path.join(folder, 'screenshots') }, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = ''; child.stderr.on('data', chunk => { output += chunk; });
  await Promise.race([once(child.stdout, 'data'), once(child, 'exit').then(() => { throw new Error(output || 'server exited'); }), new Promise((_, reject) => setTimeout(() => reject(new Error('server startup timeout')), 5000).unref())]);
});
after(async () => {
  if (child && child.exitCode === null) { child.kill(); await once(child, 'exit'); }
  if (folder) await rm(folder, { recursive: true, force: true });
  assert.equal(await readFile(new URL('../data/state.json', import.meta.url), 'utf8'), original, 'tests must not modify the real journal');
});

test('catalog has all 97 real unique videos, source groups and honest initial progress', async () => {
  const response = await fetch(base + '/api/state'); assert.equal(response.status, 200);
  const state = await response.json();
  assert.equal(state.lessons.length, 97); assert.equal(new Set(state.lessons.map(l => l.id)).size, 97);
  assert.deepEqual(state.playlists.map(p => state.lessons.filter(l => l.playlistId === p.id).length), [19, 43, 35]);
  assert.equal(state.lessons.filter(l => l.status === 'completed').length, 0);
  assert.equal(state.notes.length, 0);
  const home = await fetch(base + '/'); assert.match(await home.text(), /lang="fa" dir="rtl"/);
  assert.equal((await fetch(base + '/assets/vazirmatn.woff2')).status, 200);
});
test('private data and backup directories cannot be fetched as static files', async () => {
  for (const url of ['/data/state.json', '/data/backups/', '/server.mjs', '/AGENTS.md', '/screenshots/%2e%2e%2fdata%2fstate.json']) {
    const response = await fetch(base + url); assert.ok([403, 404].includes(response.status), `${url}: ${response.status}`);
  }
  const rejectedHost = await new Promise((resolve, reject) => {
    const req = http.get(base + '/', { headers: { Host: 'untrusted.example' } }, response => { response.resume(); resolve(response.statusCode); });
    req.on('error', reject);
  });
  assert.equal(rejectedHost, 403);
  const crossOrigin = await request('/api/workflow', 'PATCH', { phase: 'ready', title: 'x', detail: 'x', next: 'x' }, { Origin: 'https://untrusted.example' });
  assert.equal(crossOrigin.status, 403);
});
test('invalid timestamps, images and unverified completion never mutate data', async () => {
  const before = await readFile(statePath, 'utf8');
  const note = { lessonId: '-5oNwNoU3Z0', title: 'test', content: 'test only', kind: 'user', startSeconds: 0, endSeconds: 600, topicIds: ['foundations'], images: [] };
  assert.equal((await request('/api/notes', 'POST', { ...note, startSeconds: 601 })).status, 400);
  assert.equal((await request('/api/notes', 'POST', { ...note, images: [{ data: 'data:image/png;base64,YmFk' }] })).status, 400);
  assert.equal((await request('/api/notes', 'POST', { ...note, topicIds: ['missing'] })).status, 400);
  assert.equal((await request('/api/lessons/-5oNwNoU3Z0', 'PATCH', { status: 'completed' })).status, 400);
  assert.equal((await request('/api/lessons/-5oNwNoU3Z0', 'PATCH', { coverage: { verified: 'yes' } })).status, 400);
  assert.equal(await readFile(statePath, 'utf8'), before);
});
test('note and actual image bytes persist together, source time is retained, and export includes notes', async () => {
  const response = await request('/api/notes', 'POST', { lessonId: '-5oNwNoU3Z0', title: 'یادداشت آزمایشی در محیط جداگانه', content: 'Only an isolated persistence test; not a trading lesson.', kind: 'user', startSeconds: 120, endSeconds: 600, topicIds: ['foundations'], images: [{ data: `data:image/png;base64,${png}`, caption: 'تصویر آزمایشی' }] });
  assert.equal(response.status, 201); const note = await response.json();
  assert.equal(note.images[0].seconds, 120);
  const image = await fetch(base + note.images[0].src); assert.equal(image.status, 200);
  assert.equal(image.headers.get('content-type'), 'image/png');
  assert.deepEqual(Buffer.from(await image.arrayBuffer()), Buffer.from(png, 'base64'));
  const onDisk = JSON.parse(await readFile(statePath, 'utf8')); assert.equal(onDisk.notes[0].id, note.id);
  const exported = await fetch(base + '/api/export'); assert.match(exported.headers.get('content-disposition'), /attachment/);
  assert.equal((await exported.json()).notes[0].id, note.id);
  assert.ok((await readdir(path.join(folder, 'data/backups'))).length > 0);
});
test('concurrent note writes preserve both notes', async () => {
  const payload = { lessonId: '-5oNwNoU3Z0', title: 'Concurrent test', content: 'Isolated fixture.', kind: 'user', startSeconds: 0, endSeconds: 10, topicIds: [], images: [] };
  const responses = await Promise.all([request('/api/notes', 'POST', payload), request('/api/notes', 'POST', { ...payload, title: 'Second concurrent test' })]);
  assert.deepEqual(responses.map(r => r.status), [201, 201]);
  assert.equal(JSON.parse(await readFile(statePath, 'utf8')).notes.length, 3);
});
test('complete requires actual source notes and all review criteria', async () => {
  const payload = { lessonId: '-5oNwNoU3Z0', title: 'Source note test fixture', content: 'Test only, not educational content.', kind: 'arshia', startSeconds: 0, endSeconds: 10, topicIds: [], images: [] };
  assert.equal((await request('/api/notes', 'POST', payload)).status, 201);
  assert.equal((await request('/api/lessons/-5oNwNoU3Z0', 'PATCH', { status: 'completed', watchedSeconds: 10 })).status, 400);
  const response = await request('/api/lessons/-5oNwNoU3Z0', 'PATCH', { status: 'completed', watchedSeconds: 1020, coverage: { transcript: true, audio: true, visuals: true, verified: true } });
  assert.equal(response.status, 200); assert.equal((await response.json()).status, 'completed');
});
test('a direct atomic data replacement streams to connected browsers', async () => {
  const controller = new AbortController();
  const response = await fetch(base + '/api/events', { signal: controller.signal });
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let initial = '';
  while (!initial.includes('\n\n')) initial += decoder.decode((await reader.read()).value, { stream: true });
  assert.ok(initial.includes('event: state'));
  const state = JSON.parse(await readFile(statePath, 'utf8')); state.workflow.title = 'live file update test';
  const { rename } = await import('node:fs/promises');
  await writeFile(statePath + '.tmp', JSON.stringify(state)); await rename(statePath + '.tmp', statePath);
  let next = '';
  try {
    await Promise.race([(async () => {
      while (!next.includes('live file update test')) {
        const chunk = await reader.read(); if (chunk.done) throw new Error('SSE stream ended');
        next += decoder.decode(chunk.value, { stream: true });
      }
    })(), new Promise((_, reject) => setTimeout(() => reject(new Error('SSE file update timeout')), 3500).unref())]);
    assert.ok(next.includes('live file update test'));
  } finally { controller.abort(); }
});
