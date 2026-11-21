const $ = selector => document.querySelector(selector);
const fa = n => new Intl.NumberFormat('fa-IR').format(n);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const icons = {
  logo: '<path d="m3 18 5-12 5 9 4-12 4 15"/>',
  dashboard: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  play: '<path d="m9 5 11 7-11 7z"/>',
  video: '<rect x="3" y="4" width="18" height="16" rx="4"/><path d="m10 9 5 3-5 3z"/>',
  grid: '<path d="M3 8h18M3 16h18M8 3v18M16 3v18"/><rect x="3" y="3" width="18" height="18" rx="3"/>',
  book: '<path d="M12 5c-3-2-6-2-10-1v15c4-1 7-1 10 1 3-2 6-2 10-1V4c-4-1-7-1-10 1zm0 0v15"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 6-6 4 4 3-3 5 5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  layers: '<path d="m12 3 10 5-10 5L2 8zm-9 10 9 5 9-5M3 18l9 5 9-5"/>',
  trend: '<path d="m3 17 6-7 5 4 7-10M16 4h5v5"/>',
  candles: '<path d="M6 2v5m0 10v5M18 2v9m0 7v4"/><rect x="3" y="7" width="6" height="10" rx="1"/><rect x="15" y="11" width="6" height="7" rx="1"/>',
  chart: '<path d="M4 20V10m8 10V4m8 16v-7"/>',
  sliders: '<path d="M4 7h7m5 0h4M4 17h3m5 0h8"/><circle cx="13" cy="7" r="3"/><circle cx="9" cy="17" r="3"/>',
  shield: '<path d="m12 2 9 4v6c0 5-5 8-9 10-4-2-9-5-9-10V6z"/><path d="m8 12 3 3 5-6"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m16 8-2 6-6 2 2-6z"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  activity: '<path d="M2 12h5l3-8 4 16 3-8h5"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  chevron: '<path d="m14 6-6 6 6 6"/>',
  link: '<path d="m10 13 4-4m-6 6-2 2a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m4 2 2-2a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0" transform="translate(1 0)"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v.1"/>',
  flag: '<path d="M5 22V3c6-4 8 4 15 0v12c-7 4-9-4-15 0"/>',
};
const icon = (name, cls = '') => `<svg class="icon ${cls}" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.book}</svg>`;
const statuses = { not_started: ['شروع نشده', 'muted'], studying: ['در حال مطالعه', 'green'], review: ['نیازمند مرور', 'orange'], completed: ['تکمیل شده', 'green'], blocked: ['نیازمند بررسی', 'pink'] };
const nav = [['dashboard', 'dashboard', 'داشبورد'], ['lessons', 'video', 'مسیر ویدیوها'], ['topics', 'layers', 'نقشهٔ موضوعات'], ['notes', 'book', 'دفتر یادداشت‌ها'], ['gallery', 'image', 'آرشیو تصاویر'], ['activity', 'activity', 'گزارش فعالیت']];
let state;
let connection = false;
let query = '';
let playlistFilter = 'all';
let statusFilter = 'all';
let noteKindFilter = 'all';
let playerLesson = null;
let lastPayload = '';
let reconnecting = false;
const route = () => { const [page = 'dashboard', id] = location.hash.slice(1).split('/'); return { page: page || 'dashboard', id }; };
const duration = seconds => `${fa(Math.floor(seconds / 60))}:${fa(seconds % 60).padStart(2, '۰')}`;
const latinTime = seconds => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
const date = value => new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Yerevan', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
const lessonNotes = id => state.notes.filter(note => note.lessonId === id);
const screenshots = () => state.notes.flatMap(note => (note.images || []).map(image => ({ ...image, note })));
const completed = () => state.lessons.filter(l => l.status === 'completed');
const studied = () => state.lessons.filter(l => l.watchedSeconds > 0 || l.status === 'completed');
const progress = () => Math.round(completed().length / state.lessons.length * 100);
const topicName = id => state.topics.find(t => t.id === id)?.title || id;
const playlist = id => state.playlists.find(p => p.id === id);
const sourceUrl = (lesson, second = 0) => `${lesson.url}&t=${Math.floor(second)}s`;
const badge = status => `<span class="badge ${statuses[status]?.[1] || 'muted'}">${esc(statuses[status]?.[0] || status)}</span>`;
const safeImage = src => /^\/screenshots\/[a-zA-Z0-9_.-]+$/.test(src || '') ? src : '';
const matches = text => String(text).normalize('NFKC').replaceAll('ي','ی').replaceAll('ك','ک').toLocaleLowerCase().includes(query.normalize('NFKC').replaceAll('ي','ی').replaceAll('ك','ک').toLocaleLowerCase());

function sidebar() {
  const current = route().page === 'lesson' ? 'lessons' : route().page === 'topic' ? 'topics' : route().page;
  return `<aside class="sidebar"><a class="brand" href="#dashboard"><span class="brand-mark">${icon('logo')}</span><span>آرشیا<span class="brand-sub">دفتر یادگیری ترید</span></span></a><div class="workspace-label">فضای یادگیری شخصی <span>LOCAL</span></div><nav aria-label="ناوبری اصلی">${nav.map(([id, i, label]) => `<a href="#${id}" class="nav-item ${current === id ? 'active' : ''}" ${current === id ? 'aria-current="page"' : ''}>${icon(i)}<span>${label}</span>${id === 'lessons' ? `<span class="nav-count">${fa(state.lessons.length)}</span>` : ''}</a>`).join('')}</nav><div class="sidebar-course"><div class="small-label">مسیر اصلی</div><div class="course-line">${icon('video')}<span>آموزش‌های Trade city pro</span></div><div class="mini-progress"><span style="width:${progress()}%"></span></div><div class="sidebar-progress"><span>${fa(completed().length)} از ${fa(state.lessons.length)} درس</span><b>${fa(progress())}٪</b></div></div><div class="sidebar-bottom"><div class="local-info">${icon('shield')}<div>ذخیره روی همین دستگاه<small>یادداشت‌ها و تصاویر ماندگارند</small></div></div><a class="export" href="/api/export" download>${icon('download')} دریافت نسخهٔ داده‌ها</a><div class="profile"><span class="avatar">ا</span><div>دفتر اختصاصی امین<small>یادگیری دقیق، قدم‌به‌قدم</small></div><span class="profile-dot"></span></div></div></aside>`;
}
function header() {
  const page = route().page;
  const label = page === 'lesson' ? 'جزئیات درس' : page === 'topic' ? 'موضوع آموزشی' : nav.find(item => item[0] === page)?.[2] || 'داشبورد';
  return `<header class="topbar"><div class="breadcrumb"><span>دفتر یادگیری</span><span class="breadcrumb-slash">/</span><b>${label}</b></div><label class="search-box">${icon('search')}<input id="global-search" aria-label="جستجو در درس‌ها و یادداشت‌ها" placeholder="جستجو در درس‌ها و یادداشت‌ها…" value="${esc(query)}" autocomplete="off"><kbd>/</kbd></label><div class="connection ${connection ? '' : 'offline'}"><span></span>${connection ? 'به‌روزرسانی زنده' : 'در انتظار اتصال'}</div></header>`;
}
function heading(eyebrow, title, description, action = '') {
  return `<div class="page-heading"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${description}</p></div>${action}</div>`;
}
const noteButton = (id = '') => `<button class="button primary" data-action="new-note" data-id="${esc(id)}">${icon('plus')} ثبت یادداشت</button>`;
function empty(title, detail, i = 'book', action = '') {
  return `<div class="empty-state"><span class="empty-icon">${icon(i)}</span><h3>${title}</h3><p>${detail}</p>${action}</div>`;
}
function lessonRow(lesson, compact = false) {
  const notes = lessonNotes(lesson.id);
  return `<a class="lesson-row ${compact ? 'compact' : ''}" href="#lesson/${lesson.id}"><span class="lesson-order">${fa(lesson.order).padStart(2,'۰')}</span><span class="lesson-row-body"><span class="lesson-row-title" dir="auto">${esc(lesson.title)}</span><span class="lesson-row-meta"><span>${esc(playlist(lesson.playlistId).title)}</span><span class="meta-dot">·</span><span>${icon('clock')}${lesson.durationApproximate ? 'حدود ' : ''}${duration(lesson.durationSeconds)}</span>${notes.length ? `<span class="meta-dot">·</span><span>${fa(notes.length)} یادداشت</span>` : ''}</span></span>${badge(lesson.status)}<span class="row-chevron">${icon('chevron')}</span></a>`;
}
function courseCard(p) {
  const lessons = state.lessons.filter(l => l.playlistId === p.id);
  const done = lessons.filter(l => l.status === 'completed').length;
  const minutes = Math.round(lessons.reduce((s,l) => s + l.durationSeconds,0)/60);
  return `<a href="#lessons/${p.id}" class="course-card ${p.color}"><div class="course-card-top"><span class="course-icon">${icon(p.id === 'base' ? 'compass' : p.id === 'middle' ? 'layers' : 'target')}</span><span class="course-level">${p.id === 'base' ? 'پایه' : p.id === 'middle' ? 'میانی' : 'پیشرفته'}</span></div><h3>${p.title}</h3><p>${p.subtitle}</p><div class="course-card-meta"><span>${icon('video')} ${fa(lessons.length)} ویدیو</span><span>${icon('clock')} حدود ${fa(Math.round(minutes/60*10)/10)} ساعت</span></div><div class="mini-progress"><span style="width:${done / lessons.length *100}%"></span></div><div class="course-card-bottom"><span>${fa(done)} درس تکمیل شده</span><b>${fa(Math.round(done/lessons.length*100))}٪</b></div></a>`;
}
function activityList(limit = 20) {
  return `<div class="activity-list">${state.activity.slice(0,limit).map(item => `<div class="activity-item"><span class="activity-icon ${item.type === 'note' ? 'purple' : 'green'}">${icon(item.type === 'note' ? 'book' : item.type === 'catalog' ? 'layers' : item.type === 'research' ? 'search' : 'check')}</span><div><h3>${esc(item.title)}</h3><p>${esc(item.detail)}</p><time datetime="${esc(item.at)}">${date(item.at)}</time></div></div>`).join('')}</div>`;
}
function dashboard() {
  const next = state.lessons.find(l => l.status !== 'completed') || state.lessons[0];
  const phase = state.workflow.phase;
  return `${heading('LEARNING WORKSPACE', 'یادگیری، با ردِ روشن.', 'هر درس، هر نکته و هر تصویر؛ در یک دفتر زنده و قابل پیگیری.', `<a class="button subtle" href="#lessons">${icon('video')} مرور مسیر آموزش</a>`)}
  <section class="hero-grid"><div class="hero panel"><div class="hero-top"><span class="eyebrow">از تماشا تا فهم</span><span class="workflow-badge ${phase === 'working' ? 'working' : ''}"><span></span>${phase === 'working' ? 'در حال کار' : phase === 'blocked' ? 'نیازمند بررسی' : phase === 'paused' ? 'متوقف' : 'آمادهٔ ادامه'}</span></div><h2>یک مسیر مشخص.<br><span>یک یادگیری عمیق.</span></h2><p class="hero-description">دانش آرشیا را قدم‌به‌قدم، با منبع و شاهد تصویری، به یک مرجع قابل مراجعه تبدیل می‌کنیم.</p><div class="current-task">${icon('activity')}<div><span>وضعیت فعلی</span><strong>${esc(state.workflow.title)}</strong><p>${esc(state.workflow.detail)}</p><time class="task-time">آخرین ثبت وضعیت: ${date(state.workflow.updatedAt)}</time></div></div><div class="hero-footer"><a href="#lesson/${next.id}" class="button primary">${icon('play')} ${next.watchedSeconds ? 'ادامهٔ درس' : 'مشاهدهٔ اولین درس'}</a><span>گام بعد: ${esc(state.workflow.next)}</span></div></div>
  <div class="progress-panel panel"><div class="panel-top"><h2>مسیر طی‌شده</h2>${icon('flag')}</div><div class="progress-ring"><svg viewBox="0 0 180 180" aria-hidden="true"><circle cx="90" cy="90" r="74" class="ring-track"/><circle cx="90" cy="90" r="74" class="ring-value" stroke-dasharray="${progress()/100*465} 465"/></svg><div><strong>${fa(progress())}<small>٪</small></strong><span>از مسیر آموزش</span></div></div><div class="progress-summary"><span><b>${fa(completed().length)}</b> درس تکمیل شده</span><i></i><span><b>${fa(state.lessons.length-completed().length)}</b> درس باقی‌مانده</span></div><div class="progress-foot">${icon('info')} بررسی فهرست، به‌معنای مطالعهٔ درس نیست.</div></div></section>
  <section class="stats-grid" aria-label="آمار یادگیری">${[[fa(state.lessons.length),'ویدیو در مسیر','در سه سطح آموزشی','video','blue'],[fa(studied().length),'درس مطالعه‌شده',`${fa(state.lessons.length-completed().length)} درس باقی‌مانده`,'check','green'],[fa(state.notes.length),'یادداشت ثبت‌شده',`${fa(state.notes.filter(n=>n.kind==='arshia').length)} نکته مستند از آرشیا`,'book','purple'],[fa(screenshots().length),'تصویر آموزشی','متصل به زمان و یادداشت','image','orange']].map(([n,t,d,i,c])=>`<article class="stat panel"><span class="stat-icon ${c}">${icon(i)}</span><strong>${n}</strong><h3>${t}</h3><p>${d}</p></article>`).join('')}</section>
  <section class="section"><div class="section-heading"><div><h2>مسیر آموزش</h2><p>به ترتیب پیشنهادی آرشیا، از پایه تا پیشرفته</p></div><a class="text-link" href="#lessons">همهٔ ${fa(state.lessons.length)} ویدیو ${icon('layers')}</a></div><div class="courses-grid">${state.playlists.map(courseCard).join('')}</div></section>
  <section class="dashboard-bottom"><div class="panel next-lessons"><div class="panel-top"><div><h2>قدم‌های بعدی</h2><p>ادامهٔ مسیر، به ترتیب دوره</p></div><a class="text-link" href="#lessons">همهٔ درس‌ها</a></div>${state.lessons.filter(l=>l.status!=='completed').slice(0,3).map(l=>lessonRow(l,true)).join('')}</div><div class="panel recent-activity"><div class="panel-top"><div><h2>آخرین فعالیت‌ها</h2><p>گزارش واقعی پیشرفت کار</p></div>${icon('activity')}</div>${activityList(3)}<a class="activity-more text-link" href="#activity">مشاهدهٔ گزارش کامل</a></div></section>
  ${state.notes.length?`<section class="section"><div class="section-heading"><div><h2>تازه‌های دفتر یادگیری</h2><p>آخرین نکته‌ها، همراه منبع و تصویر</p></div><a class="text-link" href="#notes">همهٔ یادداشت‌ها</a></div><div class="notes-grid">${[...state.notes].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,2).map(noteCard).join('')}</div></section>`:''}
  <footer class="page-footer"><span>منبع آموزش: <a href="${state.channel.url}" target="_blank" rel="noopener noreferrer">Trade city pro</a></span><span>آخرین ثبت داده: ${date(state.updatedAt)}</span></footer>`;
}
function lessonsPage(id) {
  const selected = id || playlistFilter;
  let list = state.lessons.filter(l => (selected === 'all' || l.playlistId === selected) && (statusFilter === 'all' || l.status === statusFilter) && matches(l.title + ' ' + lessonNotes(l.id).map(n=>n.content).join(' ')));
  return `${heading('VIDEO LIBRARY','مسیر ویدیوها','تمام درس‌ها با ترتیب اصلی، منبع مشخص و وضعیت مطالعه.',noteButton())}<div class="filter-bar"><div class="tabs" role="group" aria-label="فیلتر دوره"><button class="tab ${selected==='all'?'selected':''}" data-action="playlist" data-id="all">همهٔ دوره‌ها <span>${fa(state.lessons.length)}</span></button>${state.playlists.map(p=>`<button class="tab ${selected===p.id?'selected':''}" data-action="playlist" data-id="${p.id}">${p.title} <span>${fa(state.lessons.filter(l=>l.playlistId===p.id).length)}</span></button>`).join('')}</div><label class="select-wrap"><select id="status-filter" aria-label="وضعیت مطالعه"><option value="all">همهٔ وضعیت‌ها</option>${Object.entries(statuses).map(([s,[label]])=>`<option value="${s}" ${statusFilter===s?'selected':''}>${label}</option>`).join('')}</select></label></div><div class="list-caption"><span>${fa(list.length)} ویدیو${query?` برای «${esc(query)}»`:''}</span><span>مدت‌ها مطابق نمایش فهرست یوتیوب و بعضاً تقریبی‌اند.</span></div><section class="panel lesson-list">${list.length ? list.map(l=>lessonRow(l)).join('') : empty('درسی پیدا نشد','عبارت جستجو یا فیلترها را تغییر بده.','search')}</section>`;
}
function topicCard(t) {
  const count = state.lessons.filter(l=>l.topicIds.includes(t.id)).length;
  const notes = state.notes.filter(n=>n.topicIds.includes(t.id));
  return `<a class="topic-card panel ${t.color}" href="#topic/${t.id}"><span class="topic-icon">${icon(t.icon)}</span><h2>${t.title}</h2><p>${t.description}</p><div class="topic-counts"><span>${fa(count)} درس مرتبط</span><b>${fa(notes.length)} یادداشت</b></div></a>`;
}
function topicsPage() {
  return `${heading('KNOWLEDGE MAP','نقشهٔ موضوعات','یک مفهوم، از تمام درس‌ها؛ همراه با مثال‌ها و منابع خودش.')}<div class="info-banner">${icon('info')} دسته‌بندی اولیه از روی عنوان ویدیوهاست؛ با مطالعهٔ هر درس دقیق‌تر می‌شود. تعداد درس مرتبط، میزان یادگیری نیست.</div><section class="topics-grid">${state.topics.filter(t=>matches(t.title+' '+t.description)).map(topicCard).join('')}</section>`;
}
function noteCard(n) {
  const l = state.lessons.find(l=>l.id===n.lessonId);
  const kind = { arshia: ['گفتهٔ آرشیا','green'], user: ['یادداشت شخصی','blue'], uncertain: ['نیازمند بررسی','orange'] }[n.kind] || ['نامشخص','muted'];
  return `<article class="note-card panel"><div class="note-top"><span class="badge ${kind[1]}">${kind[0]}</span><a class="time-link" href="${sourceUrl(l,n.startSeconds)}" target="_blank" rel="noopener noreferrer">${icon('clock')} <bdi>${duration(n.startSeconds)} — ${duration(n.endSeconds)}</bdi></a></div><h3>${esc(n.title)}</h3><p class="note-content">${esc(n.content)}</p>${n.images?.length?`<div class="note-images">${n.images.map(img=>`<button data-action="show-image" data-src="${esc(safeImage(img.src))}" data-caption="${esc(img.caption)}" aria-label="بزرگ‌نمایی ${esc(img.caption||'تصویر آموزشی')}"><img src="${esc(safeImage(img.src))}" alt="${esc(img.caption||n.title)}" loading="lazy"></button>`).join('')}</div>`:''}<div class="note-topics">${n.topicIds.map(id=>`<a href="#topic/${id}">${esc(topicName(id))}</a>`).join('')}</div><a href="#lesson/${l.id}" class="note-source">${icon('video')}<span dir="auto">${esc(l.title)}</span></a></article>`;
}
function notesPage() {
  const notes=state.notes.filter(n=>(noteKindFilter==='all'||n.kind===noteKindFilter)&&matches(n.title+' '+n.content)).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  return `${heading('FIELD NOTES','دفتر یادداشت‌ها','نکته‌ها، شرط‌ها، استثناها و سؤال‌ها؛ همیشه متصل به منبع.',noteButton())}<div class="tabs note-tabs" role="group" aria-label="نوع یادداشت">${[['all','همهٔ یادداشت‌ها'],['arshia','گفته‌های آرشیا'],['user','یادداشت شخصی'],['uncertain','نیازمند بررسی']].map(([id,title])=>`<button data-action="note-filter" data-id="${id}" class="tab ${noteKindFilter===id?'selected':''}">${title}</button>`).join('')}</div>${notes.length?`<div class="notes-grid">${notes.map(noteCard).join('')}</div>`:`<section class="panel">${empty(query?'یادداشتی پیدا نشد':'این دفتر، منتظر اولین نکته است.',query?'عبارت جستجو یا فیلتر را تغییر بده.':'بعد از مطالعهٔ هر بخش، نکته‌ها با زمان ویدیو و تصاویر همان قسمت اینجا ذخیره می‌شوند.','book',noteButton())}</section>`}`;
}
function galleryPage() {
  const images=screenshots().filter(img=>matches(img.caption+' '+img.note.title));
  return `${heading('VISUAL EVIDENCE','آرشیو تصاویر','شاهدهای تصویری آموزش، متصل به درس و لحظهٔ مربوط به آن.')}<div class="list-caption"><span>${fa(images.length)} تصویر ذخیره‌شده</span><span>تصاویر اصلی در پوشهٔ screenshots نگهداری می‌شوند.</span></div>${images.length?`<div class="gallery-grid">${images.map(img=>`<article class="gallery-card panel"><button data-action="show-image" data-src="${esc(safeImage(img.src))}" data-caption="${esc(img.caption)}" aria-label="بزرگ‌نمایی تصویر"><img src="${esc(safeImage(img.src))}" alt="${esc(img.caption||img.note.title)}" loading="lazy"></button><div><h3>${esc(img.caption||img.note.title)}</h3><a href="#lesson/${img.note.lessonId}">${icon('clock')} ${duration(img.seconds)} · مشاهدهٔ درس</a></div></article>`).join('')}</div>`:`<section class="panel">${empty('تصویر آموزشی هنوز ثبت نشده','وقتی مثال‌های نموداری بررسی شوند، تصاویر به همراه زمان و توضیح، اینجا و داخل همان درس ظاهر می‌شوند.','image')}</section>`}`;
}
function activityPage() {
  return `${heading('ACTIVITY LOG','گزارش فعالیت','چه کاری انجام شد، چه چیزی مانده و گام بعدی چیست.')}<section class="panel workflow-detail"><span class="eyebrow">آخرین وضعیت ثبت‌شده</span><h2>${esc(state.workflow.title)}</h2><p>${esc(state.workflow.detail)}</p><div class="next-action">${icon('flag')}<span>گام بعد: ${esc(state.workflow.next)}</span></div><time>${date(state.workflow.updatedAt)}</time></section><section class="panel activity-full"><div class="panel-top"><h2>تاریخچهٔ کار</h2><span class="small-label">${fa(state.activity.length)} رویداد</span></div>${activityList(100)}</section><section class="panel principles"><h2>اصول این دفتر</h2>${state.principles.map(p=>`<p>${icon('check')} ${esc(p)}</p>`).join('')}<small>اتصال زنده فقط تغییرات داده را منتقل می‌کند. مطالعهٔ خودکار در پس‌زمینه فعال نیست؛ آخرین وضعیت ثبت‌شده در بالا نمایش داده می‌شود.</small></section>`;
}
function topicPage(id) {
  const t=state.topics.find(t=>t.id===id);
  if(!t)return empty('موضوع پیدا نشد','به نقشهٔ موضوعات برگرد.');
  const notes=state.notes.filter(n=>n.topicIds.includes(id)&&matches(n.title+' '+n.content));
  const lessons=state.lessons.filter(l=>l.topicIds.includes(id)&&matches(l.title));
  return `<a class="back-link" href="#topics">${icon('layers')} نقشهٔ موضوعات</a>${heading('TOPIC NOTEBOOK',t.title,t.description,noteButton())}<div class="topic-summary"><span class="badge blue">${fa(lessons.length)} درس مرتبط</span><span class="badge green">${fa(notes.filter(n=>n.kind==='arshia').length)} نکته از آرشیا</span><span class="badge muted">طبقه‌بندی درس‌ها فعلاً بر اساس عنوان</span></div><section class="section"><div class="section-heading"><h2>آنچه از این موضوع ثبت شده</h2></div>${notes.length?`<div class="notes-grid">${notes.map(noteCard).join('')}</div>`:`<div class="panel">${empty('هنوز نکته‌ای از این موضوع ثبت نشده','این بخش بعد از مطالعه، با نکته‌ها و مثال‌های مستند پُر می‌شود.','book')}</div>`}</section><section class="section"><div class="section-heading"><h2>درس‌های مرتبط</h2></div><div class="panel lesson-list">${lessons.length?lessons.map(l=>lessonRow(l)).join(''):empty('درسی پیدا نشد','عبارت جستجو را تغییر بده.','search')}</div></section>`;
}
function lessonPage(id) {
  const l=state.lessons.find(l=>l.id===id);
  if(!l)return empty('درس پیدا نشد','از مسیر ویدیوها یک درس را انتخاب کن.');
  const notes=lessonNotes(l.id).filter(n=>matches(n.title+' '+n.content)).sort((a,b)=>a.startSeconds-b.startSeconds);
  const seen=Math.min(100,Math.round(l.watchedSeconds/l.durationSeconds*100));
  const previous=state.lessons.find(item=>item.order===l.order-1);
  const next=state.lessons.find(item=>item.order===l.order+1);
  return `<a class="back-link" href="#lessons/${l.playlistId}">${icon('video')} ${playlist(l.playlistId).title}</a><div class="lesson-heading"><div class="eyebrow">ویدیوی ${fa(l.order)} از ${fa(state.lessons.length)}</div><h1 dir="auto">${esc(l.title)}</h1><div class="lesson-heading-meta">${badge(l.status)}<span>${icon('clock')} ${l.durationApproximate?'حدود ':''}${duration(l.durationSeconds)}</span><span>${fa(notes.length)} یادداشت</span><span>${fa(lessonNotes(l.id).reduce((s,n)=>s+(n.images?.length||0),0))} تصویر</span></div></div><section class="lesson-layout"><div class="lesson-main"><div class="panel video-panel">${playerLesson===id?`<iframe title="پخش ویدیوی آموزش" src="https://www.youtube-nocookie.com/embed/${esc(l.id)}" allow="encrypted-media; picture-in-picture" allowfullscreen></iframe>`:`<div class="video-placeholder"><span class="video-emblem">${icon('video')}</span><div class="eyebrow">TRADE CITY PRO</div><h2>آموزش، با ارجاع به اصل منبع.</h2><p>ویدیوی اصلی را اینجا یا در یوتیوب باز کن.</p><button class="button primary" data-action="play" data-id="${id}">${icon('play')} نمایش ویدیو</button><a class="text-link" href="${l.url}" target="_blank" rel="noopener noreferrer">${icon('link')} باز کردن در یوتیوب</a></div>`}</div>${l.summary?`<section class="panel lesson-summary"><h2>خلاصهٔ ثبت‌شدهٔ درس</h2><p>${esc(l.summary)}</p></section>`:""}<div class="section-heading timeline-heading"><div><h2>یادداشت‌های زمان‌دار</h2><p>هر بخش از درس، همراه نکته‌ها و تصاویر همان بخش</p></div>${noteButton(l.id)}</div>${notes.length?`<div class="timeline">${notes.map(n=>`<div class="timeline-item"><div class="timeline-time"><bdi>${duration(n.startSeconds)}</bdi><span></span></div>${noteCard(n)}</div>`).join('')}</div>`:`<div class="panel">${empty('مطالعهٔ این درس هنوز ثبت نشده','یادداشت هر بازه، مثلاً ۰۰:۰۰ تا ۱۰:۰۰، همراه تصاویر همان بخش اینجا قرار می‌گیرد.','book',noteButton(l.id))}</div>`}<div class="lesson-pagination">${previous?`<a class="button subtle" href="#lesson/${previous.id}">درس قبلی</a>`:'<span></span>'}${next?`<a class="button subtle" href="#lesson/${next.id}">درس بعدی</a>`:''}</div></div><aside class="lesson-aside"><section class="panel study-card"><h2>وضعیت مطالعه</h2><div class="study-percent"><b>${fa(seen)}٪</b><span>پوشش ثبت‌شده</span></div><div class="mini-progress"><span style="width:${seen}%"></span></div><p>${duration(l.watchedSeconds)} از ${duration(l.durationSeconds)}</p><div class="coverage-list">${[['transcript','متن کامل درس'],['audio','بررسی صوتِ لازم'],['visuals','مثال‌های تصویری'],['verified','مرور و تطبیق نهایی']].map(([key,title])=>`<div class="${l.coverage?.[key]?'done':''}"><span>${l.coverage?.[key]?icon('check'):''}</span>${title}</div>`).join('')}</div></section><section class="panel related-topics"><h2>موضوعات مرتبط</h2><p>دسته‌بندی اولیه از روی عنوان</p>${l.topicIds.map(id=>`<a href="#topic/${id}">${esc(topicName(id))}${icon('chevron')}</a>`).join('')}</section><section class="source-card"><span>${icon('shield')}</span><h3>وفادار به منبع</h3><p>گفتهٔ آرشیا، یادداشت شخصی و برداشت نامطمئن با برچسب جدا ثبت می‌شوند.</p></section></aside></section>`;
}
function searchPage() {
  const lessons=state.lessons.filter(l=>matches(l.title));
  const notes=state.notes.filter(n=>matches(n.title+' '+n.content));
  const topics=state.topics.filter(t=>matches(t.title+' '+t.description));
  return `${heading('SEARCH','نتایج جستجو',`نتایج برای «${esc(query)}» در کل دفتر یادگیری`)}${notes.length?`<section class="section"><div class="section-heading"><h2>یادداشت‌ها · ${fa(notes.length)}</h2></div><div class="notes-grid">${notes.map(noteCard).join('')}</div></section>`:''}${topics.length?`<section class="section"><div class="section-heading"><h2>موضوعات · ${fa(topics.length)}</h2></div><div class="topics-grid">${topics.map(topicCard).join('')}</div></section>`:''}<section class="section"><div class="section-heading"><h2>ویدیوها · ${fa(lessons.length)}</h2></div><div class="panel lesson-list">${lessons.length?lessons.map(l=>lessonRow(l)).join(''):empty('ویدیویی پیدا نشد','عبارت دیگری را جستجو کن.','search')}</div></section>`;
}
// Keep an already-open source player mounted while live notes and progress update.
function patchDOM(current, next) {
  if(current.nodeType!==next.nodeType||current.nodeName!==next.nodeName){current.replaceWith(next.cloneNode(true));return;}
  if(current.nodeType===Node.TEXT_NODE){if(current.textContent!==next.textContent)current.textContent=next.textContent;return;}
  if(current.nodeType!==Node.ELEMENT_NODE)return;
  if(current.classList.contains('video-panel')&&next.classList.contains('video-panel')&&current.querySelector('iframe')?.src===next.querySelector('iframe')?.src)return;
  for(const attr of [...current.attributes])if(!next.hasAttribute(attr.name))current.removeAttribute(attr.name);
  for(const attr of [...next.attributes])if(current.getAttribute(attr.name)!==attr.value)current.setAttribute(attr.name,attr.value);
  const children=[...next.childNodes];
  for(let i=0;i<children.length;i++){if(!current.childNodes[i])current.append(children[i].cloneNode(true));else patchDOM(current.childNodes[i],children[i]);}
  while(current.childNodes.length>children.length)current.lastChild.remove();
}
function render() {
  if(!state)return;
  const focusId=document.activeElement?.id;
  const selection=document.activeElement?.selectionStart;
  const r=route();
  const views={dashboard,lessons:()=>lessonsPage(r.id),topics:topicsPage,notes:notesPage,gallery:galleryPage,activity:activityPage,lesson:()=>lessonPage(r.id),topic:()=>topicPage(r.id)};
  const content=query&&['dashboard','activity'].includes(r.page)?searchPage:(views[r.page]||dashboard);
  const markup=`${sidebar()}<div class="main-shell">${header()}<main id="main-content">${content()}</main></div>`;
  if(playerLesson&&$('.video-panel iframe')){const template=document.createElement('template');template.innerHTML=`<div id="app">${markup}</div>`;patchDOM($('#app'),template.content.firstElementChild);}else $('#app').innerHTML=markup;
  document.title=`${r.page==='lesson'?'جزئیات درس':nav.find(n=>n[0]===r.page)?.[2]||'دفتر یادگیری'} | آرشیا`;
  if(focusId){const el=document.getElementById(focusId);el?.focus({preventScroll:true});if(typeof selection==='number'&&el?.setSelectionRange)el.setSelectionRange(selection,selection);}
}
function toast(message) { $('#toast').textContent=message; $('#toast').classList.add('visible'); setTimeout(()=>$('#toast').classList.remove('visible'),3500); }
function openNote(lessonId) {
  const selected=state.lessons.find(l=>l.id===lessonId)||state.lessons[0];
  const topicId=route().page==='topic'?route().id:null;
  const d=$('#note-dialog');
  d.innerHTML=`<form id="note-form"><div class="dialog-heading"><div><span class="eyebrow">دفتر یادگیری</span><h2>ثبت یادداشت زمان‌دار</h2></div><button type="button" class="icon-button" data-action="close-dialog" aria-label="بستن">${icon('close')}</button></div><p class="dialog-description">منبع، زمان و نوع یادداشت را مشخص کن. تصویرها اختیاری‌اند.</p><label class="field">درس<select name="lessonId" required>${state.lessons.map(l=>`<option value="${l.id}" ${l.id===selected.id?'selected':''}>${fa(l.order)}. ${esc(l.title)}</option>`).join('')}</select></label><div class="form-row"><label class="field">از زمان (دقیقه:ثانیه)<input name="start" dir="ltr" placeholder="00:00" value="00:00" required pattern="[0-9۰-۹]+:[0-5۰-۵][0-9۰-۹]"></label><label class="field">تا زمان (دقیقه:ثانیه)<input name="end" dir="ltr" placeholder="10:00" value="00:00" required pattern="[0-9۰-۹]+:[0-5۰-۵][0-9۰-۹]"></label></div><label class="field">نوع یادداشت<select name="kind"><option value="user">یادداشت شخصی</option><option value="arshia">گفتهٔ مستند آرشیا در این بازه</option><option value="uncertain">نیازمند بررسی و تطبیق</option></select></label><label class="field">عنوان نکته<input name="title" required maxlength="300" placeholder="این بخش دربارهٔ چیست؟"></label><label class="field">متن یادداشت<textarea name="content" rows="4" required placeholder="نکته، شرایط، استثناها یا سؤال این بخش…"></textarea></label><fieldset class="topic-checkboxes"><legend>موضوعات مرتبط</legend>${state.topics.map(t=>`<label><input type="checkbox" name="topicIds" value="${t.id}" ${t.id===topicId?'checked':''}>${t.title}</label>`).join('')}</fieldset><label class="upload-zone">${icon('image')}<strong>افزودن تصاویر همین بخش</strong><span>حداکثر ۳ تصویر؛ PNG، JPG یا WebP، هرکدام تا ۵ مگابایت</span><input type="file" name="images" multiple accept="image/png,image/jpeg,image/webp"></label><div id="upload-preview"></div><p id="form-error" class="form-error" role="alert"></p><div class="dialog-footer"><button type="button" class="button subtle" data-action="close-dialog">انصراف</button><button class="button primary" id="save-note" type="submit">${icon('check')} ذخیرهٔ یادداشت</button></div></form>`;
  d.showModal();
}
function parseTime(value) {
  const normalized=String(value).replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
  if(!/^\d+:[0-5]\d$/.test(normalized))throw new Error('زمان را به شکل دقیقه:ثانیه وارد کن.');
  const [m,s]=normalized.split(':').map(Number);return m*60+s;
}
const fileToData=file=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('خواندن تصویر ممکن نشد.'));reader.readAsDataURL(file);});
async function saveNote(event) {
  event.preventDefault(); const form=event.target; const error=$('#form-error'); const button=$('#save-note');
  try {
    button.disabled=true; error.textContent='';
    const data=new FormData(form); const files=[...form.elements.images.files];
    if(files.length>3)throw new Error('برای هر یادداشت حداکثر ۳ تصویر انتخاب کن.');
    if(files.some(f=>f.size>5*1024*1024))throw new Error('حجم هر تصویر باید کمتر از ۵ مگابایت باشد.');
    const images=await Promise.all(files.map(async file=>({data:await fileToData(file),caption:file.name})));
    const payload={lessonId:data.get('lessonId'),title:data.get('title'),content:data.get('content'),kind:data.get('kind'),startSeconds:parseTime(data.get('start')),endSeconds:parseTime(data.get('end')),topicIds:data.getAll('topicIds'),images};
    const response=await fetch('/api/notes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    const result=await response.json();if(!response.ok)throw new Error(result.error);
    $('#note-dialog').close(); toast('یادداشت و تصاویر روی همین دستگاه ذخیره شدند.');
    const latest=await fetch('/api/state',{cache:'no-store'});applyState(await latest.json());
  }catch(e){error.textContent=e.message;}finally{button.disabled=false;}
}
function applyState(next) {
  const payload=JSON.stringify(next);
  if(payload===lastPayload)return;
  lastPayload=payload;state=next;render();
}
function connect() {
  const events=new EventSource('/api/events');
  events.addEventListener('state',e=>{connection=true;reconnecting=false;try{applyState(JSON.parse(e.data));}catch{toast('دادهٔ جدید قابل خواندن نیست.');}const el=$('.connection');if(el){el.classList.remove('offline');el.innerHTML='<span></span>به‌روزرسانی زنده';}});
  events.onerror=()=>{connection=false;const el=$('.connection');if(el){el.classList.add('offline');el.innerHTML='<span></span>اتصال قطع شد؛ تلاش مجدد';}reconnecting=true;};
}
document.addEventListener('click',event=>{
  const button=event.target.closest('[data-action]');if(!button)return;
  const {action,id}=button.dataset;
  if(action==='new-note')openNote(id);
  if(action==='playlist'){playlistFilter=id;if(location.hash!==`#lessons/${id}`)location.hash=`lessons/${id}`;else render();}
  if(action==='note-filter'){noteKindFilter=id;render();}
  if(action==='close-dialog')button.closest('dialog').close();
  if(action==='play'){playerLesson=id;render();}
  if(action==='show-image'){
    const src=safeImage(button.dataset.src);if(!src)return;
    const d=$('#image-dialog');d.innerHTML=`<button class="icon-button" data-action="close-dialog" aria-label="بستن تصویر">${icon('close')}</button><img src="${esc(src)}" alt="${esc(button.dataset.caption||'تصویر آموزشی')}"><p>${esc(button.dataset.caption)}</p>`;d.showModal();
  }
});
document.addEventListener('input',event=>{if(event.target.id==='global-search'){query=event.target.value;render();}});
document.addEventListener('change',event=>{
  if(event.target.id==='status-filter'){statusFilter=event.target.value;render();}
  if(event.target.name==='images'){
    $('#upload-preview').textContent=[...event.target.files].map(f=>f.name).join('، ');
  }
});
document.addEventListener('submit',event=>{if(event.target.id==='note-form')saveNote(event);});
document.addEventListener('keydown',event=>{if(event.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)&&!document.querySelector('dialog[open]')){event.preventDefault();$('#global-search')?.focus();}if(event.key==='Escape'&&query&&!document.querySelector('dialog[open]')){query='';render();}});
window.addEventListener('hashchange',()=>{query='';playerLesson=null;render();window.scrollTo({top:0,behavior:'instant'});});
try{const response=await fetch('/api/state',{cache:'no-store'});if(!response.ok)throw new Error();applyState(await response.json());connect();}catch{$('#app').innerHTML=`<div class="fatal-error"><h1>دفتر یادگیری در دسترس نیست</h1><p>سرور محلی را با دستور npm start اجرا کن و صفحه را دوباره باز کن.</p><button class="button primary" id="retry">تلاش دوباره</button></div>`;$('#retry').onclick=()=>location.reload();}
