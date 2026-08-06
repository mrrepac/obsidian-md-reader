/*
 * Дымовой прогон интерфейса md-reader без Obsidian: подсовываем минимальный DOM
 * и заглушки API, прогоняем библиотеку, панель оформления и вкладку настроек.
 * Ловит опечатки в построении разметки и обращения к несуществующим методам.
 * Запуск: node tests/ui.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import Module from 'node:module';

const SRC = fileURLToPath(new URL('../main.js', import.meta.url));
const source = readFileSync(SRC, 'utf8') +
  '\nmodule.exports.__test = { LibraryModal, AppearanceModal, NotePickModal, ReaderSettingTab,' +
  ' MdReaderPlugin, DEFAULT_SETTINGS };\n';

/* ---------- минимальный DOM ---------- */
class El {
  constructor(tag = 'div', cls = '') {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.classes = new Set(String(cls).split(' ').filter(Boolean));
    this.text = '';
    this.style = new Proxy({ setProperty() {} }, { get: (o, k) => o[k] || '', set: (o, k, v) => { o[k] = v; return true; } });
    this.listeners = {};
    this.attrs = {};
  }
  _add(tag, o) {
    const opts = typeof o === 'string' ? { cls: o } : (o || {});
    const el = new El(tag, opts.cls || '');
    if (opts.text) el.text = opts.text;
    if (opts.attr) Object.assign(el.attrs, opts.attr);
    this.children.push(el);
    return el;
  }
  createDiv(o) { return this._add('div', o); }
  createSpan(o) { return this._add('span', o); }
  createEl(tag, o) { return this._add(tag, o); }
  setText(s) { this.text = String(s); return this; }
  empty() { this.children = []; this.text = ''; return this; }
  addClass(c) { this.classes.add(c); return this; }
  removeClass(c) { this.classes.delete(c); return this; }
  toggleClass(c, on) { if (on) this.classes.add(c); else this.classes.delete(c); return this; }
  hasClass(c) { return this.classes.has(c); }
  addEventListener(k, fn) { (this.listeners[k] = this.listeners[k] || []).push(fn); }
  removeEventListener() {}
  remove() {}
  setAttribute(k, v) { this.attrs[k] = v; }
  getAttribute(k) { return this.attrs[k]; }
  focus() {}
  fire(k, ev) { (this.listeners[k] || []).forEach((f) => f(ev || { stopPropagation() {}, preventDefault() {} })); }
  all(pred, out = []) {
    this.children.forEach((c) => { if (pred(c)) out.push(c); c.all(pred, out); });
    return out;
  }
  querySelectorAll(sel) {
    const cls = String(sel).replace(/^\./, '');
    return this.all((c) => c.classes.has(cls));
  }
  find(cls) { return this.all((c) => c.classes.has(cls))[0] || null; }
  get textDump() { return (this.text + ' ' + this.children.map((c) => c.textDump).join(' ')).trim(); }
}

/* ---------- заглушки obsidian ---------- */
// цепочка вида sl.setLimits().setValue().onChange(fn): обработчики НЕ дёргаем,
// иначе onChange прилетел бы прокси вместо значения
const chain = () => new Proxy(function () {}, {
  get: (target, prop) => {
    if (prop === 'then') return undefined;
    return () => chain();
  },
  apply: () => chain(),
});
class SettingStub {
  constructor(containerEl) { this.containerEl = containerEl; containerEl.createDiv('setting-item'); }
  setName() { return this; }
  setDesc() { return this; }
  setHeading() { return this; }
  addSlider(cb) { cb(chain()); return this; }
  addToggle(cb) { cb(chain()); return this; }
  addDropdown(cb) { cb(chain()); return this; }
  addText(cb) { cb(chain()); return this; }
  addButton(cb) { cb(chain()); return this; }
}
class ModalStub {
  constructor(app) { this.app = app; this.contentEl = new El(); this.titleEl = new El(); }
  open() { this.onOpen(); }
  close() { this.closed = true; }
}
class TFileStub { constructor(path, mtime = 0) { this.path = path; this.basename = path.split('/').pop().replace(/\.md$/, ''); this.extension = 'md'; this.stat = { mtime }; } }
class TFolderStub { constructor(path, children = []) { this.path = path; this.name = path.split('/').pop(); this.children = children; } }
const notices = [];
const obsidian = {
  Plugin: class {}, ItemView: class { constructor(leaf) { this.leaf = leaf; } },
  PluginSettingTab: class { constructor(app, plugin) { this.app = app; this.plugin = plugin; this.containerEl = new El(); } },
  Setting: SettingStub, Scope: class {}, Component: class {},
  // SuggestModal умеет чуть больше обычной модалки

  TFile: TFileStub, TFolder: TFolderStub,
  Notice: class { constructor(m) { notices.push(m); } },
  MarkdownRenderer: {},
  SuggestModal: class extends ModalStub {
    setPlaceholder(s) { this.placeholder = s; }
    get inputEl() { return this._inp || (this._inp = new El('input')); }
  },
  Modal: ModalStub, Menu: class {},
  Platform: { isMobile: false, isDesktop: true },
};

const module_ = { exports: {} };
new vm.Script(`(function (require, module, exports) {${source}\n})`, { filename: SRC })
  .runInThisContext()((n) => (n === 'obsidian' ? obsidian : Module.createRequire(SRC)(n)), module_, module_.exports);
const T = module_.exports.__test;

/* ---------- фальшивое хранилище ---------- */
const files = [
  new TFileStub('Books/Война и мир.md', 1),
  new TFileStub('Books/Чума.md', 2),
  new TFileStub('Заметки/Дневник.md', 3),
  new TFileStub('Заметки/Черновик.md', 4),
];
const byPath = new Map(files.map((f) => [f.path, f]));
const booksFolder = new TFolderStub('Books', files.filter((f) => f.path.startsWith('Books/')));
byPath.set('Books', booksFolder);
const app = {
  vault: {
    getAbstractFileByPath: (p) => byPath.get(p) || null,
    getMarkdownFiles: () => files,
  },
  workspace: { getLeavesOfType: () => [], getActiveViewOfType: () => null },
};

const plugin = Object.create(T.MdReaderPlugin.prototype);
plugin.app = app;
plugin.settings = Object.assign({}, T.DEFAULT_SETTINGS, { importFolder: 'Books' });
plugin.db = {
  'Books/Война и мир.md': { g: 0.7, t: 3000 },
  'Books/Чума.md': { g: 0.18, t: 1000 },
  'Заметки/Дневник.md': { g: 0.5, t: 2000 },
  'Заметки/Старое.md': { fraction: 0.4 },   // легаси без времени — не «недавнее»
  'Заметки/Пропало.md': { g: 0.1, t: 5000 }, // файла нет в хранилище
};
plugin.library = [];
plugin.saveAll = async () => {};
plugin.refreshOpenViews = () => {};
plugin.openReader = (f) => { plugin._opened = f.path; };
plugin.openLibrary = () => {};
plugin.importBook = () => {};

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { if (cond) { pass++; return; } fail++; console.log('  FAIL: ' + name + (extra === undefined ? '' : '  -> ' + JSON.stringify(extra))); };
const eq = (name, a, b) => ok(name, JSON.stringify(a) === JSON.stringify(b), { got: a, want: b });

/* ---------- состав библиотеки ---------- */
const items = plugin.libraryFiles();
eq('библиотека: состав и порядок', items.map((x) => x.file.path),
  ['Books/Война и мир.md', 'Заметки/Дневник.md', 'Books/Чума.md']);
eq('библиотека: «недавнее» помечено', items.filter((x) => x.recent).map((x) => x.file.path), ['Заметки/Дневник.md']);
eq('последняя читанная = самая свежая существующая', plugin.lastReadFile().path, 'Books/Война и мир.md');

/* ---------- окно библиотеки ---------- */
const lib = new T.LibraryModal(app, plugin);
lib.open();
const c = lib.contentEl;
eq('библиотека: заголовок окна', lib.titleEl.text, 'Library');
ok('библиотека: кнопка «Продолжить» с названием', c.find('hr-lib-continue').textDump.includes('Война и мир'), c.find('hr-lib-continue').textDump);
eq('библиотека: строк в списке', c.find('hr-lib-list').children.length, 3);
ok('библиотека: полоска прогресса нарисована', !!c.find('hr-lib-bar-fill'));
eq('библиотека: проценты', c.querySelectorAll('.hr-lib-pct').map((e) => e.text), ['70%', '50%', '18%']);
eq('библиотека: метка «недавнее»', c.querySelectorAll('.hr-lib-tag').map((e) => e.text), ['Recent']);
ok('библиотека: фильтра нет на коротком списке', !c.find('hr-lib-filter'));
// фильтр
lib.query = 'чум';
lib.renderList();
eq('библиотека: фильтр по названию', c.find('hr-lib-list').children.length, 1);
lib.query = 'нетакого';
lib.renderList();
ok('библиотека: пустой результат подписан', c.find('hr-lib-empty').text.length > 0, c.find('hr-lib-empty').text);
lib.query = '';
lib.renderList();
// клик по строке открывает книгу
c.find('hr-lib-list').children[0].fire('click');
eq('библиотека: клик открывает книгу', plugin._opened, 'Books/Война и мир.md');
// крестик у «недавнего» забывает позицию, а не файл
const recentRow = c.find('hr-lib-list').children.find((r) => r.textDump.includes('Дневник'));
recentRow.find('hr-lib-x').fire('click', { stopPropagation() {} });
ok('библиотека: «забыть» удаляет позицию', !plugin.db['Заметки/Дневник.md']);

/* ---------- панель оформления ---------- */
const ap = new T.AppearanceModal(app, plugin);
ap.open();
eq('оформление: заголовок', ap.titleEl.text, 'Appearance');
eq('оформление: кружки тонировок', ap.contentEl.querySelectorAll('.hr-ap-tint').length, 5);
eq('оформление: активна текущая тонировка', ap.contentEl.querySelectorAll('.is-active').length, 1);
const before = plugin.settings.fontSize;
ap.contentEl.find('hr-ap-big').fire('click');
ok('оформление: «А+» увеличивает шрифт', plugin.settings.fontSize > before, plugin.settings.fontSize);
eq('оформление: подпись размера обновилась', ap.contentEl.find('hr-ap-value').text, '105%');
ap.contentEl.find('hr-ap-small').fire('click');
eq('оформление: «А−» возвращает', plugin.settings.fontSize, before);
ap.contentEl.querySelectorAll('.hr-ap-tint')[4].fire('click');
eq('оформление: выбор тонировки', plugin.settings.tint, 'night');
ok('оформление: ползунки на месте', ap.contentEl.querySelectorAll('.setting-item').length >= 6,
  ap.contentEl.querySelectorAll('.setting-item').length);
plugin.settings.tint = 'none';

/* ---------- вкладка настроек ---------- */
const tab = new T.ReaderSettingTab(app, plugin);
tab.display();
ok('настройки: строк хватает', tab.containerEl.querySelectorAll('.setting-item').length > 20,
  tab.containerEl.querySelectorAll('.setting-item').length);

/* ---------- самонастройка размера блока под скорость машины ---------- */
const perf = Object.create(T.MdReaderPlugin.prototype);
perf.perf = {};
eq('блок: без замеров берём значение платформы', perf.blockTargets().pack, 60000);
eq('блок: порог «не резать» вдвое больше блока', perf.blockTargets().split, 120000);
perf.perf = { rate: 0.00028 };            // быстрый ПК: 0.28 мс на 1000 символов
eq('блок: быстрый ПК', perf.blockTargets().pack, 55000);
perf.perf = { rate: 0.00084 };            // втрое медленнее
eq('блок: медленный ПК ужимается', perf.blockTargets().pack, 20000);
perf.perf = { rate: 0.01 };               // совсем древнее железо
eq('блок: ниже нижней границы не падаем', perf.blockTargets().pack, 20000);
perf.perf = { rate: 0.00005 };            // очень быстрая машина
eq('блок: выше верхней границы не растём', perf.blockTargets().pack, 120000);

perf.perf = {};
perf.noteLayoutRate(0.2, 60000);
ok('замер: слишком быстрый замер игнорируем', !perf.perf.rate);
perf.noteLayoutRate(17, 1000);
ok('замер: слишком мелкий блок игнорируем', !perf.perf.rate);
perf.noteLayoutRate(17, 60000);
ok('замер: первая оценка записана', perf.perf.rate > 0, perf.perf.rate);
const rate0 = perf.perf.rate;
perf.noteLayoutRate(18, 60000);
eq('замер: шум не трогает data.json', perf.perf.rate, rate0);
perf.noteLayoutRate(60, 60000);
ok('замер: заметное замедление записывается', perf.perf.rate > rate0, perf.perf.rate);

/* ---------- выбор заметки ---------- */
const pick = new T.NotePickModal(app, plugin, () => {});
const sugg = pick.getSuggestions('');
ok('добавить заметку: книги из папки скрыты', !sugg.some((f) => f.path.startsWith('Books/')), sugg.map((f) => f.path));
ok('добавить заметку: «недавнее» доступно для закрепления', sugg.some((f) => f.path === 'Заметки/Дневник.md'));

/* ---------- загрузка плагина целиком ---------- */
globalThis.window = globalThis.window || { setInterval: () => 1 };
const boot = Object.create(T.MdReaderPlugin.prototype);
const seen = { views: [], commands: [], ribbon: 0, tabs: 0, events: 0, intervals: 0 };
boot.app = {
  vault: Object.assign({ on: () => ({}) }, app.vault),
  workspace: Object.assign({ on: () => ({}) }, app.workspace),
};
boot.loadData = async () => ({ fontSize: 1.2, чужойКлюч: 'мусор', positions: { 'a.md': { g: 0.5, t: 7 } }, library: ['b.md'] });
boot.saveData = async () => {};
boot.registerView = (type) => seen.views.push(type);
boot.addRibbonIcon = () => { seen.ribbon++; return new El(); };
boot.addCommand = (c) => seen.commands.push(c.id);
boot.registerEvent = () => { seen.events++; };
boot.addSettingTab = () => { seen.tabs++; };
boot.registerInterval = () => { seen.intervals++; };
await boot.onload();

eq('onload: вьюха зарегистрирована', seen.views, ['horizontal-reader-view']);
eq('onload: панель настроек и иконка ленты', [seen.tabs, seen.ribbon], [1, 1]);
ok('onload: события подписаны', seen.events >= 4, seen.events);
const need = ['open-library', 'continue-reading', 'open-current-in-reader', 'open-toc', 'search-book',
  'toggle-bookmark', 'open-bookmarks', 'appearance', 'jump-back', 'font-bigger', 'font-smaller',
  'cycle-tint', 'import-book', 'toggle-fullscreen'];
eq('onload: все команды на месте', need.filter((id) => !seen.commands.includes(id)), []);
eq('onload: настройка из data.json подхвачена', boot.settings.fontSize, 1.2);
ok('onload: чужие ключи в настройки не попали', boot.settings['чужойКлюч'] === undefined);
eq('onload: позиции и библиотека прочитаны', [Object.keys(boot.db).length, boot.library], [1, ['b.md']]);
ok('onload: замер скорости инициализирован', typeof boot.perf === 'object' && !boot.perf.rate);
ok('onload: perf уходит в data.json', 'perf' in boot.dataBlob());

console.log(`\n${pass} прошло, ${fail} упало`);
process.exit(fail ? 1 : 0);
