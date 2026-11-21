import { readFile, writeFile, access } from 'node:fs/promises';
const target = new URL('../data/state.json', import.meta.url);
try { await access(target); throw new Error('state.json already exists; seed will never overwrite your journal.'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const now = new Date().toISOString();
const playlists = [
  { id: 'base', title: 'از صفر تا ۳۰', subtitle: 'پایه‌های یک نگاه درست', youtubeId: 'PLRZx7LpGZLGkOkVtf9MCYyygMYQ89v6Dk', description: 'شروع مسیر، حمایت و مقاومت، کندل‌ها و مدیریت سرمایه', color: 'green' },
  { id: 'middle', title: 'از ۳۰ تا ۶۰', subtitle: 'عمیق‌تر در رفتار بازار', youtubeId: 'PLRZx7LpGZLGndRgtOCTfVJlxn_4Wh589M', description: 'روند، حجم، ستاپ‌ها، اوردر بوک و اندیکاتورها', color: 'purple' },
  { id: 'advanced', title: 'از ۶۰ تا ۱۰۰', subtitle: 'اتصال مفاهیم به استراتژی', youtubeId: 'PLRZx7LpGZLGnXABmisKijEhwotw2uejyn', description: 'ساختار بازار، فیبوناچی، مدیریت سرمایه و روانشناسی', color: 'orange' },
];
const topics = [
  { id: 'foundations', title: 'مبانی و ابزارها', description: 'مسیر یادگیری و ابزارهای مشاهدهٔ بازار', icon: 'compass', color: 'green' },
  { id: 'levels', title: 'حمایت و مقاومت', description: 'سطوح، شکست‌ها و ناحیه‌های قیمتی', icon: 'layers', color: 'blue' },
  { id: 'structure', title: 'روند و ساختار بازار', description: 'جهت، سلامت روند و حرکت‌های بازار', icon: 'trend', color: 'purple' },
  { id: 'candles', title: 'کندل‌ها و ستاپ‌ها', description: 'رفتار کندل و نمونه‌های عملی ورود', icon: 'candles', color: 'orange' },
  { id: 'volume', title: 'حجم و اوردر بوک', description: 'حجم معاملات، سفارش‌ها و اوپن اینترست', icon: 'chart', color: 'blue' },
  { id: 'indicators', title: 'اندیکاتورها', description: 'ابزارها، تنظیمات و کاربردهای مطرح‌شده', icon: 'sliders', color: 'purple' },
  { id: 'risk', title: 'سرمایه و مدیریت ریسک', description: 'حدضرر، اندازهٔ معامله و مدیریت خروج', icon: 'shield', color: 'green' },
  { id: 'strategy', title: 'استراتژی و اجرای معامله', description: 'قواعد ورود، خروج و چک‌لیست‌ها', icon: 'target', color: 'orange' },
  { id: 'psychology', title: 'روانشناسی و ژورنال', description: 'احتمال، روتین، رفتار و ثبت تجربه‌ها', icon: 'book', color: 'pink' },
  { id: 'fibonacci', title: 'فیبوناچی', description: 'موج‌ها، نسبت‌ها و ناحیه‌ها', icon: 'grid', color: 'blue' },
];
const rules = [ ['foundations', /شروع|Roadmap|تریدینگ ویو|وبسایت|تنسور|Learned Trading/i], ['levels', /حمایت|مقاومت|support|resistance/i], ['structure', /روند|ترند|ساختار|سایکل|مومنتوم|market movements/i], ['candles', /کندل|Candlestick/i], ['volume', /حجم|اوردر|اُردر|اردور|Volume|اینترست/i], ['indicators', /اندیکاتور|اوسیلاتور|اسیلاتور|مووینگ|RSI|MACD|bollinger|BB &|ROC|ADX|پیوت/i], ['risk', /سرمایه|ریسک|حدضرر|استاپ|سیو سود|خروج|لوریج|DCA/i], ['strategy', /استراتژی|ستاپ|ورود|چک لیست|پوزیشن|فرمان/i], ['psychology', /روانشناسی|ژورنال|احتمال|روتین|Trader Behavior/i], ['fibonacci', /فیبوناچی|Fibonacci/i] ];
let playlistId; let index = 0; const lessons = [];
for (const line of (await readFile(new URL('../data/catalog.tsv', import.meta.url), 'utf8')).split('\n').filter(Boolean)) {
  if (line.startsWith('# ')) { playlistId = line.slice(2); index = 0; continue; }
  const [id, duration, title] = line.split('\t');
  const [minutes, seconds] = duration.split(':').map(Number);
  const topicIds = rules.filter(([, pattern]) => pattern.test(title)).map(([id]) => id);
  lessons.push({ id, playlistId, index: ++index, order: lessons.length + 1, title, durationSeconds: minutes * 60 + seconds, durationApproximate: seconds === 0, url: `https://www.youtube.com/watch?v=${id}`, status: 'not_started', watchedSeconds: 0, summary: '', topicIds: topicIds.length ? topicIds : ['foundations'], topicAssignment: 'title_only', coverage: { transcript: false, audio: false, visuals: false, verified: false }, updatedAt: now });
}
if (lessons.length !== 97 || new Set(lessons.map(l => l.id)).size !== 97) throw new Error('Catalog must contain 97 unique source videos.');
const state = { schemaVersion: 1, updatedAt: now, catalogVerifiedAt: now, channel: { title: 'Trade city pro', url: 'https://www.youtube.com/@Tradecitypro' }, playlists, topics, lessons, notes: [], workflow: { phase: 'working', title: 'در حال ساخت دفتر یادگیری', detail: 'فهرست ۹۷ ویدیو ثبت شده و امکانات ثبت یادداشت، تصویر و گزارش زنده در حال بررسی است.', next: 'تکمیل داشبورد و آماده‌سازی برای مطالعهٔ ویدیوی معرفی', lessonId: null, updatedAt: now }, activity: [ { id: 'catalog', at: now, title: 'فهرست دوره‌ها ثبت شد', detail: '۹۷ ویدیو با لینک منبع و مدت نمایش‌داده‌شده در یوتیوب؛ هیچ درس کاملی هنوز مطالعه نشده است.', type: 'catalog' }, { id: 'overview', at: now, title: 'مسیر کلی آموزش بررسی شد', detail: 'صفحهٔ کانال، توضیحات ویدیوی معرفی و ترتیب سه پلی‌لیست بررسی شد.', type: 'research' } ], questions: [], principles: ['هر نکته به ویدیو و زمان منبع متصل می‌شود.', 'گفتهٔ آرشیا، یادداشت شخصی و موارد نامطمئن جدا ثبت می‌شوند.', 'مثال‌های نموداری همراه تصاویر و ترتیب اتفاقات بررسی می‌شوند.', 'درس پس از بررسی متن، صوت لازم، تصاویر و مرور نهایی تکمیل می‌شود.'] };
await writeFile(target, JSON.stringify(state, null, 2));
console.log(`Seeded ${lessons.length} lessons across ${playlists.length} playlists.`);
