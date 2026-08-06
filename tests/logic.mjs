/*
 * Прогон чистой логики md-reader без Obsidian: подсовываем заглушку модуля
 * 'obsidian' и вытаскиваем внутренние функции/классы через хвостовой экспорт.
 * Запуск: node tests/logic.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import Module from 'node:module';

const SRC = fileURLToPath(new URL('../main.js', import.meta.url));
const source = readFileSync(SRC, 'utf8') +
  '\nmodule.exports.__test = { scanHeadings, splitChapters, chunkBySize, txtToMarkdown,' +
  ' normHeading, escapeMd, escapeBlockStart, decodeBuffer, ReaderView, sanitizeFilename,' +
  ' guessLang };\n';

class Stub { constructor() {} }
class ItemViewStub { constructor(leaf) { this.leaf = leaf; } }
const obsidian = {
  Plugin: Stub, ItemView: ItemViewStub, PluginSettingTab: Stub, Setting: Stub,
  Scope: Stub, Component: Stub, TFile: Stub, TFolder: Stub, Notice: Stub,
  MarkdownRenderer: {}, SuggestModal: Stub, Modal: Stub, Menu: Stub,
  Platform: { isMobile: false, isDesktop: true },
};

const sandboxRequire = (name) => (name === 'obsidian' ? obsidian : Module.createRequire(SRC)(name));
const module_ = { exports: {} };
vm.createContext(globalThis);
new vm.Script(`(function (require, module, exports) {${source}\n})`, { filename: SRC })
  .runInThisContext()(sandboxRequire, module_, module_.exports);

const T = module_.exports.__test;
let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; return; }
  fail++;
  console.log('  FAIL: ' + name + (extra === undefined ? '' : '  -> ' + JSON.stringify(extra)));
};
const eq = (name, a, b) => ok(name, JSON.stringify(a) === JSON.stringify(b), { got: a, want: b });

/* ---------- заголовки ---------- */
const h = T.scanHeadings(`# Один
текст
Сетекст
=====
не заголовок --- в тексте

## Два ##
\`\`\`
# внутри кода
\`\`\`
Подзаголовок
---`.split('\n'));
eq('scanHeadings: уровни', h.map((x) => x.level), [1, 1, 2, 2]);
// сетекст-заголовок = ВЕСЬ предыдущий абзац (как в CommonMark)
eq('scanHeadings: тексты', h.map((x) => x.text), ['Один', 'текст Сетекст', 'Два', 'Подзаголовок']);
eq('normHeading: снимает разметку', T.normHeading('**[[ссылка|Глава *1*]]**'), 'глава 1');

/* ---------- разбиение книги ---------- */
const bigChapter = (n) => `## Глава ${n}\n\n` + ('текст абзаца. '.repeat(400) + '\n\n').repeat(30);
const book = Array.from({ length: 12 }, (_, i) => bigChapter(i + 1)).join('\n');
const split = T.splitChapters(book);
ok('splitChapters: книга разрезана', split.chapters.length > 1, split.chapters.length);
eq('splitChapters: оглавление полное', split.toc.length, 12);
eq('splitChapters: chars совпадает с главами', split.chars, split.chapters.map((c) => c.length));
ok('splitChapters: главы не длиннее лимита*1.2',
  split.chapters.every((c) => c.length <= 200000 * 1.2), split.chapters.map((c) => c.length));
ok('splitChapters: номера блоков в оглавлении валидны',
  split.toc.every((e) => e.chapter >= 0 && e.chapter < split.chapters.length));
// hIndex должен совпадать с порядком заголовка внутри своего блока
const perBlock = {};
split.toc.forEach((e) => { perBlock[e.chapter] = (perBlock[e.chapter] || []); perBlock[e.chapter].push(e.hIndex); });
ok('splitChapters: hIndex по порядку с нуля',
  Object.values(perBlock).every((list) => list.every((v, i) => v === i)), perBlock);
const small = T.splitChapters('# Заметка\n\nкороткий текст');
eq('splitChapters: мелкая заметка = одна глава', small.chapters.length, 1);
eq('splitChapters: оглавление мелкой заметки', small.toc.length, 1);

/* ---------- позиция в книге (то, что правил аудит) ---------- */
const view = Object.create(T.ReaderView.prototype);
view.chapters = ['a', 'b', 'c'];
view.chapterChars = [100, 100, 100];
view.charsBefore = [0, 100, 200];
view.totalChars = 300;
eq('blockForG: 0 -> начало первого блока', view.blockForG(0), { chapter: 0, within: 0 });
eq('blockForG: стык блоков = конец предыдущего', view.blockForG(1 / 3), { chapter: 0, within: 1 });
eq('blockForG: середина второго', view.blockForG(0.5), { chapter: 1, within: 0.5 });
eq('blockForG: 1 -> конец последнего', view.blockForG(1), { chapter: 2, within: 1 });
// туда-обратно: позиция последней страницы блока восстанавливается в тот же блок
view.chapterIndex = 1; view.page = 9; view.totalPages = 10;
const g = view.currentG();
eq('currentG на последней странице блока', g, 2 / 3);
eq('восстановление той же позиции', view.blockForG(g), { chapter: 1, within: 1 });
// одностраничный блок = прочитан целиком
view.chapters = ['a']; view.chapterChars = [100]; view.charsBefore = [0]; view.totalChars = 100;
view.chapterIndex = 0; view.page = 0; view.totalPages = 1;
eq('currentG: одностраничная заметка = 100%', view.currentG(), 1);

/* ---------- поиск по книге ---------- */
const mkView = (chapters) => {
  const v = Object.create(T.ReaderView.prototype);
  v.chapters = chapters;
  v.chapterChars = chapters.map((c) => c.length);
  v.charsBefore = [];
  let acc = 0;
  chapters.forEach((c, i) => { v.charsBefore[i] = acc; acc += c.length; });
  v.totalChars = acc;
  v.chapterIndex = 0;
  v.file = { path: 'книга.md' };
  v._searchIndex = null;
  return v;
};
const v4 = mkView(['Первый блок про Пьера.', 'Второй блок, снова Пьер и Наташа.', 'Третий блок.']);
const hits = v4.searchBook('пьер');
eq('поиск: нашлись оба вхождения', hits.length, 2);
eq('поиск: блоки вхождений', hits.map((h) => h.chapter), [0, 1]);
ok('поиск: процент по книге растёт', hits[0].pct <= hits[1].pct, hits.map((h) => h.pct));
eq('поиск: однобуквенный запрос не ищем', v4.searchBook('п').length, 0);
eq('поиск: регистр не важен', v4.searchBook('ПЬЕР').length, 2);
// лень индекса: если совпадений набралось до лимита, дальние блоки не трогаем
const v5 = mkView(['пьер '.repeat(300), 'Пьер во втором блоке.']);
const many = v5.searchBook('пьер');
eq('поиск: упёрлись в лимит', many.length, 200);
ok('поиск: второй блок в нижний регистр не переводили', v5._searchIndex.low[1] === undefined);

/* ---------- подпись главы в строке состояния ---------- */
const v2 = Object.create(T.ReaderView.prototype);
v2.toc = [
  { text: 'Том первый', level: 1, chapter: 0, hIndex: 0 },
  { text: 'Часть первая', level: 2, chapter: 0, hIndex: 1 },
  { text: 'I', level: 3, chapter: 0, hIndex: 2 },
  { text: 'II', level: 3, chapter: 1, hIndex: 0 },
];
v2.chapterIndex = 0;
v2._headPages = [{ page: 0, toc: 0 }, { page: 0, toc: 1 }, { page: 2, toc: 2 }];
v2.page = 0;
eq('глава: длинное название без родителя', v2.currentChapterLabel(), 'Часть первая');
v2.page = 1;
eq('глава: на странице без заголовка держим прежний', v2.currentChapterLabel(), 'Часть первая');
v2.page = 3;
eq('глава: короткий номер дополняется родителем', v2.currentChapterLabel(), 'Часть первая · I');
v2.chapterIndex = 1; v2._headPages = null; v2.page = 0;
eq('глава: блок ещё не размечен — берём последний из прошлых', v2.currentChapterLabel(), 'Часть первая · I');
v2.toc = []; eq('глава: без оглавления пусто', v2.currentChapterLabel(), '');
v2.toc = [{ text: 'x'.repeat(60), level: 1, chapter: 0, hIndex: 0 }];
v2.chapterIndex = 0; v2._headPages = [{ page: 0, toc: 0 }]; v2.page = 0;
ok('глава: длинная подпись обрезана', v2.currentChapterLabel().length === 48, v2.currentChapterLabel().length);

/* ---------- стек «назад» ---------- */
const v3 = Object.create(T.ReaderView.prototype);
v3._jumps = []; v3._measured = false; v3.chapters = ['a'];
v3.chapterIndex = 0; v3.page = 0; v3.totalPages = 5;
v3.chapterChars = [100]; v3.charsBefore = [0]; v3.totalChars = 100;
v3.pushJump();
eq('назад: до замера ничего не пишем', v3._jumps.length, 0);
v3._measured = true;
v3.page = 2; v3.pushJump();
v3.page = 4; v3.pushJump();
eq('назад: стек копится', v3._jumps, [0.5, 1]);
for (let i = 0; i < 25; i++) v3.pushJump();
eq('назад: стек ограничен', v3._jumps.length, 20);

/* ---------- TXT -> Markdown ---------- */
const txt = T.txtToMarkdown('Глава 1\n\nПервый абзац,\nразорванный по словам.\n\n- реплика с тире\n\n1. не список\n', 'Книга');
ok('txt: заголовок файла', txt.markdown.startsWith('# Книга'));
ok('txt: русская глава стала заголовком', txt.markdown.includes('## Глава 1'), txt.markdown);
const txtEn = T.txtToMarkdown('Chapter 1\n\nPlain text.\n', 'Book');
ok('txt: английская глава стала заголовком', txtEn.markdown.includes('## Chapter 1'), txtEn.markdown);
const txtWord = T.txtToMarkdown('Главарь\n\nПлохой человек.\n', 'Книга');
ok('txt: «Главарь» не считается главой', !txtWord.markdown.includes('## Главарь'), txtWord.markdown);
ok('txt: абзац склеен', txt.markdown.includes('Первый абзац, разорванный по словам.'));
ok('txt: тире экранировано', txt.markdown.includes('\\- реплика'), txt.markdown);
ok('txt: номер экранирован', txt.markdown.includes('1\\. не список'), txt.markdown);
eq('escapeBlockStart: решётка', T.escapeBlockStart('# не заголовок'), '\\# не заголовок');
eq('escapeMd: спецсимволы', T.escapeMd('a*b[c]<d>'), 'a\\*b\\[c\\]\\<d\\>');

/* ---------- кодировки ---------- */
const utf8 = new TextEncoder().encode('Привет, мир');
eq('decodeBuffer: utf-8', T.decodeBuffer(utf8.buffer), 'Привет, мир');
const bom = new Uint8Array([0xEF, 0xBB, 0xBF, ...new TextEncoder().encode('BOM')]);
eq('decodeBuffer: BOM снят', T.decodeBuffer(bom.buffer), 'BOM');
// windows-1251: «Привет» в однобайтовой кириллице
const cp1251 = new Uint8Array([0xCF, 0xF0, 0xE8, 0xE2, 0xE5, 0xF2]);
eq('decodeBuffer: windows-1251 угадан', T.decodeBuffer(cp1251.buffer), 'Привет');
const declared = new TextEncoder().encode('<?xml version="1.0" encoding="utf-8"?><FictionBook/>');
ok('decodeBuffer: объявленная кодировка', T.decodeBuffer(declared.buffer).includes('FictionBook'));

eq('sanitizeFilename: чистит запрещённое', T.sanitizeFilename('А/Б: "В" <Г>|#^[]'), 'А Б В Г');

/* ---------- язык текста (переносы) ---------- */
eq('язык: русская проза', T.guessLang('Князь Андрей вышел из комнаты и затворил за собою дверь.'), 'ru');
eq('язык: английская проза', T.guessLang('It was the best of times, it was the worst of times.'), 'en');
eq('язык: не гадаем по цифрам', T.guessLang('12 + 34 = 46\n\n2026-08-06'), '');

/* ---------- строка исходника в оглавлении ---------- */
const lined = T.splitChapters('преамбула\n\n# Первая\n\nтекст\n\n## Вторая\n\nещё');
eq('оглавление: номера строк заголовков', lined.toc.map((e) => e.line), [2, 6]);
const bigLined = T.splitChapters(Array.from({ length: 12 }, (_, i) => bigChapter(i + 1)).join('\n'));
ok('оглавление: строки есть и у разрезанной книги',
  bigLined.toc.every((e) => typeof e.line === 'number' && e.line >= 0), bigLined.toc.slice(0, 3));
ok('оглавление: строки растут', bigLined.toc.every((e, i, a) => i === 0 || e.line > a[i - 1].line));

/* ---------- шаг по главам и края книги ---------- */
const nav = Object.create(T.ReaderView.prototype);
nav.toc = [
  { text: 'Глава 1', level: 2, chapter: 0, hIndex: 0, line: 0 },
  { text: 'Глава 2', level: 2, chapter: 0, hIndex: 1, line: 40 },
  { text: 'Глава 3', level: 2, chapter: 1, hIndex: 0, line: 90 },
];
nav.chapters = ['a', 'b'];
nav.chapterIndex = 0;
nav._headPages = [{ page: 0, toc: 0 }, { page: 4, toc: 1 }];
nav.page = 5;
eq('глава: где мы сейчас', nav.currentTocIndex(), 1);
ok('глава: середина главы — не её начало', !nav.atChapterStart(1));
nav.page = 4;
ok('глава: начало главы распознано', nav.atChapterStart(1));
// шаг назад из середины главы возвращает к её началу, а не к предыдущей
const jumped = [];
nav.savePos = () => {};
nav.pushJump = () => {};
nav.goToHeading = () => jumped.push('same-block');
nav.resolveHeadingEl = () => ({});
nav.renderChapter = (ch, opts) => jumped.push(ch + ':' + opts.heading.text);
nav.page = 5;
nav.stepChapter(-1);
eq('глава: назад из середины — к началу главы', jumped, ['same-block']);
nav.page = 4;         // ровно на начале второй главы
nav.stepChapter(1);
eq('глава: вперёд уходит в следующий блок', jumped[1], '1:Глава 3');
nav.page = 4;
nav.stepChapter(-1);
eq('глава: назад с начала — к предыдущей главе', jumped[2], 'same-block');
// у книги без заголовков шагать нечем — и это не должно падать
const noToc = Object.create(T.ReaderView.prototype);
noToc.toc = [];
noToc.stepChapter(1);
ok('глава: без оглавления не падаем', true);

/* ---------- открыть исходник на текущем месте ---------- */
const ed = Object.create(T.ReaderView.prototype);
const opened = [];
ed.file = { path: 'книга.md', basename: 'книга' };
ed.bodyLine0 = 4;                       // выше тела — frontmatter из четырёх строк
ed.toc = nav.toc;
ed.chapterIndex = 0;
ed._headPages = [{ page: 0, toc: 0 }, { page: 4, toc: 1 }];
ed.page = 5;
ed.savePos = () => {};
ed.app = { workspace: { getLeaf: () => ({ openFile: (f, o) => opened.push([f.path, o.eState.line]) }) } };
ed.openInEditor();
eq('редактор: строка = frontmatter + строка главы', opened[0], ['книга.md', 44]);
ed.toc = [];
ed._headPages = null;
ed.openInEditor();
eq('редактор: без оглавления открываем с начала', opened[1], ['книга.md', 0]);

/* ---------- сколько осталось ---------- */
const left = Object.create(T.ReaderView.prototype);
left._measured = true;
left.chapters = ['a'];
left.chapterIndex = 0;
left.chapterChars = [120000];
left.charsBefore = [0];
left.totalChars = 120000;
left.totalPages = 101;
left.page = 0;
left.plugin = { readingSpeed: () => 1200 };
// в песочнице язык интерфейса английский — отсюда «h/min»
eq('остаток: часы и минуты', left.timeLeftLabel(), '≈1 h 40 min');
left.page = 100;
eq('остаток: в конце книги пусто', left.timeLeftLabel(), '');
left.page = 95;
eq('остаток: минуты', left.timeLeftLabel(), '≈5 min');
left._measured = false;
eq('остаток: до замера молчим', left.timeLeftLabel(), '');

/* ---------- Escape в два шага ---------- */
const esc = Object.create(T.ReaderView.prototype);
const body = new Set();
const doc = { body: { classList: {
  contains: (c) => body.has(c),
  remove: (...c) => c.forEach((x) => body.delete(x)),
} } };
esc.contentEl = { ownerDocument: doc };
esc.viewport = { classList: { contains: (c) => c === 'hr-hide-ui' && esc._uiHidden, remove: () => { esc._uiHidden = false; } } };
esc.leaf = { id: 'L' };
const done = [];
esc.plugin = {
  isFullscreen: () => esc._fs,
  setFullscreen: () => { esc._fs = false; },
  restoreSidebars: () => done.push('panels'),
  exitReader: (l) => done.push('exit:' + l.id),
};
body.add('hr-immersive'); body.add('hr-chrome-hidden');
ok('escape: спрятанный хром распознан', esc.chromeHidden());
esc.onEscape();
eq('escape: первый шаг вернул интерфейс', [Array.from(body), done], [[], ['panels']]);
ok('escape: хром помечен показанным вручную', esc.plugin._chromeShown === true);
ok('escape: прятать больше нечего', !esc.chromeHidden());
esc.onEscape();
eq('escape: второй шаг выходит из чтения', done, ['panels', 'exit:L']);
// полный экран тоже считается спрятанным интерфейсом
esc._fs = true;
ok('escape: полный экран — тоже спрятанный интерфейс', esc.chromeHidden());
esc.onEscape();
eq('escape: из полного экрана выходим, но из книги — нет', done.length, 3);

/* ---------- подпись при перемотке ---------- */
const scrub = Object.create(T.ReaderView.prototype);
scrub.chapters = ['a', 'b', 'c'];
scrub.chapterChars = [100, 100, 100];
scrub.charsBefore = [0, 100, 200];
scrub.totalChars = 300;
scrub.toc = [
  { text: 'Начало', level: 1, chapter: 0, hIndex: 0, line: 0 },
  { text: 'Середина', level: 1, chapter: 1, hIndex: 0, line: 10 },
  { text: 'Конец', level: 1, chapter: 2, hIndex: 0, line: 20 },
];
eq('перемотка: подпись в начале', scrub.chapterAtG(0), 'Начало');
eq('перемотка: подпись в середине', scrub.chapterAtG(0.5), 'Середина');
eq('перемотка: подпись в конце', scrub.chapterAtG(1), 'Конец');
scrub.toc = [];
eq('перемотка: без оглавления пусто', scrub.chapterAtG(0.5), '');

console.log(`\n${pass} прошло, ${fail} упало`);
process.exit(fail ? 1 : 0);
