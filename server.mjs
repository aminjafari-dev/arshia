import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DATA = process.env.ARSHIA_DATA_DIR || path.join(ROOT, 'data');
const SCREENSHOTS = process.env.ARSHIA_SCREENSHOT_DIR || path.join(ROOT, 'screenshots');
const STATE = path.join(DATA, 'state.json');
const PORT = Number(process.env.PORT || 4317);
const HOST = '127.0.0.1';
const clients = new Set();
let revision = '';
let serial = Promise.resolve();
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
const hash = text => createHash('sha256').update(text).digest('hex');
const readState = async () => JSON.parse(await fs.readFile(STATE, 'utf8'));
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
function json(res, value, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(value));
}
async function body(req) {
  if (!req.headers['content-type']?.startsWith('application/json')) throw fail('محتوای درخواست باید JSON باشد.', 415);
  let size = 0; const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 18 * 1024 * 1024) throw fail('حجم درخواست بیش از حد مجاز است.', 413);
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString()); } catch { throw fail('ساختار JSON معتبر نیست.'); }
}
function broadcast(text) {
  revision = hash(text);
  for (const client of clients) client.write(`event: state\ndata: ${text.replaceAll('\n', '')}\n\n`);
}
async function save(state) {
  state.updatedAt = new Date().toISOString();
  await fs.mkdir(path.join(DATA, 'backups'), { recursive: true });
  const old = await fs.readFile(STATE, 'utf8');
  await fs.writeFile(path.join(DATA, 'backups', `${Date.now()}-${randomUUID().slice(0, 6)}.json`), old);
  const backups = (await fs.readdir(path.join(DATA, 'backups'))).sort().reverse();
  await Promise.all(backups.slice(20).map(file => fs.unlink(path.join(DATA, 'backups', file))));
  const temp = path.join(DATA, `.state-${randomUUID()}.tmp`);
  const text = JSON.stringify(state, null, 2);
  await fs.writeFile(temp, text); await fs.rename(temp, STATE); broadcast(JSON.stringify(state));
}
async function mutate(action) {
  const work = serial.then(async () => { const state = await readState(); const result = await action(state); await save(state); return result; });
  serial = work.catch(() => {}); return work;
}
function textField(value, name, max = 20000) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw fail(`${name} معتبر نیست.`);
  return value.trim();
}
function imageData(image) {
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(image.data || '');
  if (!match) throw fail('فقط تصویر PNG، JPEG یا WebP پذیرفته می‌شود.');
  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.length > 5 * 1024 * 1024) throw fail('هر تصویر باید کمتر از ۵ مگابایت باشد.');
  const valid = match[1] === 'png' ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) : match[1] === 'jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 : bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  if (!valid) throw fail('فایل تصویر معتبر نیست.');
  return { bytes, extension: match[1] === 'jpeg' ? 'jpg' : match[1], caption: String(image.caption || '').slice(0, 1000) };
}

const server = http.createServer(async (req, res) => {
  try {
    // Reject DNS rebinding and cross-origin writes on this private, loopback-only server.
    if (![`${HOST}:${PORT}`, `localhost:${PORT}`].includes(req.headers.host)) throw fail('میزبان مجاز نیست.', 403);
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (!['GET', 'HEAD'].includes(req.method)) {
      const origin = req.headers.origin;
      if ((origin && ![`http://${HOST}:${PORT}`, `http://localhost:${PORT}`].includes(origin)) || req.headers['sec-fetch-site'] === 'cross-site') throw fail('درخواست از مبدأ دیگری پذیرفته نمی‌شود.', 403);
    }
    if (url.pathname === '/api/state' && req.method === 'GET') return json(res, await readState());
    if (url.pathname === '/api/export' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': 'attachment; filename="arshia-learning-backup.json"', 'Cache-Control': 'no-store' });
      return res.end(await fs.readFile(STATE));
    }
    if (url.pathname === '/api/events' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      res.write(`event: state\ndata: ${JSON.stringify(await readState())}\n\n`);
      clients.add(res); req.on('close', () => clients.delete(res)); return;
    }
    if (url.pathname === '/api/notes' && req.method === 'POST') {
      const input = await body(req);
      const title = textField(input.title, 'عنوان', 300);
      const content = textField(input.content, 'متن یادداشت');
      if (!Number.isInteger(input.startSeconds) || input.startSeconds < 0 || !Number.isInteger(input.endSeconds) || input.endSeconds < input.startSeconds) throw fail('بازهٔ زمانی معتبر نیست.');
      if (!Array.isArray(input.images) || input.images.length > 3) throw fail('حداکثر ۳ تصویر برای هر یادداشت مجاز است.');
      const prepared = input.images.map(imageData);
      const note = await mutate(async state => {
        const lesson = state.lessons.find(item => item.id === input.lessonId);
        if (!lesson) throw fail('درس پیدا نشد.', 404);
        if (input.endSeconds > lesson.durationSeconds) throw fail('بازهٔ یادداشت از زمان ویدیو بیشتر است.');
        if (!['user', 'arshia', 'uncertain'].includes(input.kind)) throw fail('نوع یادداشت معتبر نیست.');
        if (!Array.isArray(input.topicIds) || input.topicIds.some(id => !state.topics.some(topic => topic.id === id))) throw fail('موضوع معتبر نیست.');
        const id = randomUUID(); const images = [];
        await fs.mkdir(SCREENSHOTS, { recursive: true });
        for (const [i, image] of prepared.entries()) {
          const name = `${lesson.id}-${id}-${i}.${image.extension}`;
          await fs.writeFile(path.join(SCREENSHOTS, name), image.bytes);
          images.push({ src: `/screenshots/${name}`, caption: image.caption, seconds: input.startSeconds });
        }
        const note = { id, lessonId: lesson.id, title, content, startSeconds: input.startSeconds, endSeconds: input.endSeconds, kind: input.kind, topicIds: input.topicIds, images, createdAt: new Date().toISOString() };
        state.notes.push(note);
        state.activity.unshift({ id: randomUUID(), at: note.createdAt, title: 'یادداشت جدید ذخیره شد', detail: title, type: 'note', lessonId: lesson.id });
        return note;
      });
      return json(res, note, 201);
    }
    const lessonMatch = /^\/api\/lessons\/([\w-]+)$/.exec(url.pathname);
    if (lessonMatch && req.method === 'PATCH') {
      const input = await body(req);
      const result = await mutate(state => {
        const lesson = state.lessons.find(item => item.id === lessonMatch[1]);
        if (!lesson) throw fail('درس پیدا نشد.', 404);
        const statuses = ['not_started', 'studying', 'review', 'completed', 'blocked'];
        if (input.status !== undefined && !statuses.includes(input.status)) throw fail('وضعیت درس معتبر نیست.');
        if (input.durationSeconds !== undefined && (!Number.isInteger(input.durationSeconds) || input.durationSeconds <= 0 || input.durationSeconds > 86400)) throw fail('مدت ویدیو معتبر نیست.');
        const total = input.durationSeconds ?? lesson.durationSeconds;
        if (input.watchedSeconds !== undefined && (!Number.isInteger(input.watchedSeconds) || input.watchedSeconds < 0 || input.watchedSeconds > total)) throw fail('زمان مطالعه معتبر نیست.');
        if ((input.watchedSeconds ?? lesson.watchedSeconds) > total) throw fail('زمان مطالعه از مدت ویدیو بیشتر است.');
        if (input.summary !== undefined && (typeof input.summary !== 'string' || input.summary.length > 20000)) throw fail('خلاصه معتبر نیست.');
        if (input.durationApproximate !== undefined && typeof input.durationApproximate !== 'boolean') throw fail('دقت زمان معتبر نیست.');
        if (input.coverage !== undefined && (!input.coverage || typeof input.coverage !== 'object' || Array.isArray(input.coverage) || Object.entries(input.coverage).some(([key, value]) => !['transcript', 'audio', 'visuals', 'verified'].includes(key) || typeof value !== 'boolean'))) throw fail('چک‌لیست بررسی معتبر نیست.');
        const coverage = { ...lesson.coverage, ...input.coverage };
        if ((input.status ?? lesson.status) === 'completed') {
          if (!state.notes.some(note => note.lessonId === lesson.id && note.kind === 'arshia')) throw fail('تکمیل درس به یادداشت مستند از آرشیا نیاز دارد.');
          if (!Object.values(coverage).every(Boolean) || (input.watchedSeconds ?? lesson.watchedSeconds) !== total) throw fail('برای تکمیل درس، پوشش کامل و چک‌لیست بررسی باید ثبت شود.');
        }
        for (const key of ['status', 'watchedSeconds', 'summary', 'durationSeconds', 'durationApproximate']) if (input[key] !== undefined) lesson[key] = input[key];
        lesson.coverage = coverage;
        lesson.updatedAt = new Date().toISOString();
        const labels = { not_started: 'شروع نشده', studying: 'در حال مطالعه', review: 'نیازمند مرور', completed: 'تکمیل شده', blocked: 'نیازمند بررسی' };
        state.activity.unshift({ id: randomUUID(), at: lesson.updatedAt, title: 'وضعیت درس به‌روز شد', detail: `${lesson.title} · ${labels[lesson.status]}`, type: 'study', lessonId: lesson.id });
        return lesson;
      });
      return json(res, result);
    }
    if (url.pathname === '/api/workflow' && req.method === 'PATCH') {
      const input = await body(req);
      await mutate(state => {
        if (!['working', 'ready', 'paused', 'blocked'].includes(input.phase)) throw fail('وضعیت فعالیت معتبر نیست.');
        if (input.lessonId && !state.lessons.some(lesson => lesson.id === input.lessonId)) throw fail('درس پیدا نشد.', 404);
        state.workflow = { phase: input.phase, title: textField(input.title, 'عنوان', 300), detail: textField(input.detail, 'توضیح', 2000), next: textField(input.next, 'گام بعد', 1000), lessonId: input.lessonId || null, updatedAt: new Date().toISOString() };
        state.activity.unshift({ id: randomUUID(), at: new Date().toISOString(), title: input.title, detail: input.detail, type: 'status' });
      });
      return json(res, { ok: true });
    }
    if (url.pathname.startsWith('/api/')) throw fail('مسیر پیدا نشد.', 404);
    if (!['GET', 'HEAD'].includes(req.method)) throw fail('روش درخواست مجاز نیست.', 405);
    const isImage = url.pathname.startsWith('/screenshots/');
    const base = isImage ? SCREENSHOTS : path.join(ROOT, 'public');
    const relative = decodeURIComponent(isImage ? url.pathname.slice(13) : url.pathname === '/' ? 'index.html' : url.pathname.slice(1));
    const file = path.resolve(base, relative);
    if (!file.startsWith(path.resolve(base) + path.sep)) throw fail('مسیر مجاز نیست.', 403);
    let bytes; try { bytes = await fs.readFile(file); } catch { throw fail('فایل پیدا نشد.', 404); }
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; font-src 'self'; frame-src https://www.youtube-nocookie.com; object-src 'none'; base-uri 'self'; frame-ancestors 'self'" });
    res.end(req.method === 'HEAD' ? undefined : bytes);
  } catch (error) {
    if (!res.headersSent) json(res, { error: error.status ? error.message : 'خطا در خواندن یا ذخیرهٔ داده‌ها.' }, error.status || 500);
    else res.end();
    if (!error.status) console.error(error);
  }
});

await fs.mkdir(DATA, { recursive: true });
await fs.mkdir(SCREENSHOTS, { recursive: true });
revision = hash(JSON.stringify(await readState()));
// Also detect atomic file replacements made by the learning agent, without requiring the API.
setInterval(async () => {
  try { const state = await readState(); const text = JSON.stringify(state); if (hash(text) !== revision) broadcast(text); } catch { /* Keep the last valid browser state during an incomplete write. */ }
}, 1000).unref();
setInterval(() => { for (const res of clients) res.write(': heartbeat\n\n'); }, 15000).unref();
server.listen(PORT, HOST, () => console.log(`Arshia Learning Journal: http://${HOST}:${PORT}`));
