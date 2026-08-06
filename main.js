'use strict';

const {
  Plugin,
  ItemView,
  PluginSettingTab,
  Setting,
  Scope,
  Component,
  Platform,
  TFile,
  Notice,
  MarkdownRenderer,
  SuggestModal,
  Modal,
  Menu,
  TFolder,
} = require('obsidian');

const VIEW_TYPE_READER = 'horizontal-reader-view';

const DEFAULT_SETTINGS = {
  fontSize: 1.0,          // multiplier of theme font -> --hr-font-size (em)
  fontFamily: '',         // '' = theme font | 'serif' | 'sans' | 'mono' | 'custom'
  fontFamilyCustom: '',   // CSS font-family, used when fontFamily === 'custom'
  tint: 'none',           // page tint: 'none' | 'sepia' | 'cream' | 'gray' | 'night'
  brightness: 100,        // % — dimming veil over the page (100 = off)
  lineHeight: 1.6,        // -> --hr-line-height
  pageMode: 'auto',       // 'auto' | 'single' | 'double'
  maxPageWidth: 600,      // px — max width of ONE page (0 = no limit)
  columnGap: 2.5,         // em -> --hr-col-gap (gap between pages)
  animate: true,          // page-flip animation
  tapZones: true,         // tap/click zones (left/right flip, center toggles UI)
  rememberPosition: true, // remember position per note
  showTitle: true,        // show note title on the first page
  openIn: 'new-tab',      // 'new-tab' | 'current' | 'split' | 'window'
  collapseSidebars: true, // collapse side panels while reading; restore on leaving the reader
  immersive: true,        // hide app header & bottom bar for full-screen reading
  fullscreen: false,      // (desktop) put the whole window into real OS full screen
  hideMobileBar: false,   // (mobile) also hide the OS status bar while reading — experimental
  justify: false,         // justify paragraphs (align to both edges) + hyphenation
  verticalPadding: 1.4,   // em — empty space at the top/bottom of the page
  importFolder: '',       // vault folder for imported/converted books ('' = vault root)
};

// пресеты шрифта чтения: первым идёт «книжный» вариант, дальше — общесистемные запасные
const READING_FONTS = {
  serif: '"Literata", "Iowan Old Style", Georgia, "PT Serif", "Times New Roman", serif',
  sans: '"Inter", "Segoe UI", Roboto, system-ui, -apple-system, sans-serif',
  mono: 'var(--font-monospace)',
};
const TINTS = ['sepia', 'cream', 'gray', 'night'];
const TINT_LABEL = { none: 'optTintNone', sepia: 'optTintSepia', cream: 'optTintCream', gray: 'optTintGray', night: 'optTintNight' };

/* ---------- i18n: English by default, Russian when Obsidian language is ru ---------- */
const STRINGS = {
  en: {
    fallbackTitle: 'MD Reader',
    notFound: 'Note not found.',
    navPrev: 'Previous page',
    navNext: 'Next page',
    ribbonLib: 'MD Reader library',
    cmdLibrary: 'Open library',
    libTitle: 'Library',
    libImport: 'Import book (fb2, epub, txt)…',
    libAddNote: 'Add a note…',
    libEmpty: 'Nothing here yet. Import a book or add a note from your vault.',
    libRemove: 'Remove from library',
    notePickPlaceholder: 'Add a note to the library…',
    cmdOpen: 'Open current note in MD Reader',
    menuOpen: 'Open in MD Reader',
    sSecPage: 'Page',
    sSecText: 'Text',
    sSecColour: 'Colour',
    sSecReading: 'Reading',
    sPageMode: 'Page mode',
    sPageModeDesc: 'How many pages to show on screen',
    optAuto: 'Auto (two on a wide screen, one on a narrow one)',
    optSingle: 'Always one',
    optDouble: 'Always two (book spread)',
    sMaxWidth: 'Max page width, px',
    sMaxWidthDesc: 'Width of a single page. Smaller is a narrower, more comfortable column. 0 = no limit',
    sFontSize: 'Font size',
    sFontSizeDesc: "Multiplier relative to your theme's font",
    sFontFamily: 'Reading font',
    sFontFamilyDesc: 'Typeface for the page text — only inside the reader',
    optFontTheme: 'Theme font',
    optFontSerif: 'Serif',
    optFontSans: 'Sans-serif',
    optFontMono: 'Monospace',
    optFontCustom: 'Custom…',
    sFontCustom: 'Custom font',
    sFontCustomDesc: 'A CSS font-family, e.g. "Literata", Georgia, serif',
    sTint: 'Page tint',
    sTintDesc: 'Recolour the page for comfortable reading. Only the reader changes — the rest of Obsidian keeps your theme',
    optTintNone: 'Theme colours',
    optTintSepia: 'Sepia',
    optTintCream: 'Cream',
    optTintGray: 'Soft grey',
    optTintNight: 'Night',
    sBrightness: 'Brightness, %',
    sBrightnessDesc: 'Dim the page for reading in the dark',
    sLineHeight: 'Line height',
    sGap: 'Gap between pages, em',
    sAnimate: 'Page-flip animation',
    sTap: 'Tap zones',
    sTapDesc: 'Tap/click the left or right third to flip; the center toggles the interface',
    sRemember: 'Remember position',
    sRememberDesc: 'Reopen each note where you left off',
    sTitle: 'Show note title',
    sOpenIn: 'Open in',
    optNewTab: 'New tab',
    optCurrent: 'Current tab',
    optSplit: 'Split',
    optWindow: 'New window',
    sCollapse: 'Collapse side panels',
    sCollapseDesc: 'Hide the left and right panels when the reader opens and restore them when the tab closes',
    sImmersive: 'Immersive reading',
    sImmersiveDesc: 'Hide the app header and bottom bar. Tap the center of the page to toggle them',
    sFullscreen: 'Full screen while reading',
    sFullscreenDesc: 'Open books in real full screen and leave it when you close the reader. Esc leaves at any time',
    cmdFullscreen: 'Toggle full screen',
    menuFsOn: 'Full screen',
    menuFsOff: 'Leave full screen',
    sHideBar: 'Hide the system status bar (mobile)',
    sHideBarDesc: 'While reading on a phone, also hide the OS status bar (clock, notifications). Experimental — may not work on every device',
    sJustify: 'Justify text',
    sJustifyDesc: 'Align paragraphs to both edges, with hyphenation where the platform supports it (the desktop build has no hyphenation dictionaries). Costs about half again as much page layout — the first thing to turn off on a slow machine',
    sPadding: 'Vertical margins, em',
    sPaddingDesc: 'Empty space at the top and bottom of the page',
    cmdTint: 'Cycle page tint',
    cmdToc: 'Open table of contents',
    cmdSearch: 'Search in this book',
    cmdBookmark: 'Add / remove bookmark',
    cmdBookmarks: 'Open bookmarks',
    menuNav: 'Navigation',
    menuToc: 'Table of contents',
    menuSearch: 'Search in this book',
    menuLibrary: 'Library',
    menuEdit: 'Open the note for editing',
    menuExit: 'Leave the reader',
    cmdExit: 'Leave the reader',
    endExit: 'Leave',
    cmdNextChapter: 'Next chapter',
    cmdPrevChapter: 'Previous chapter',
    cmdEdit: 'Open the note for editing',
    scrubLabel: 'Go to a place in the book',
    unitMin: 'min',
    unitH: 'h',
    noChapters: 'This book has no chapters',
    menuBmAdd: 'Add a bookmark here',
    menuBmRemove: 'Remove the bookmark here',
    menuBmList: 'Bookmarks',
    tocPlaceholder: 'Jump to a heading…',
    tocEmpty: 'No matching headings',
    tocNone: 'This note has no headings',
    searchPlaceholder: 'Find in this book…',
    searchEmpty: 'Nothing found (type at least two characters)',
    bmPlaceholder: 'Go to a bookmark…',
    bmNone: 'No bookmarks in this note yet',
    bmAdded: 'Bookmark added',
    bmRemoved: 'Bookmark removed',
    menuAppearance: 'Appearance',
    cmdAppearance: 'Appearance: font, tint, margins',
    menuBack: 'Back to where I was',
    cmdContinue: 'Continue reading',
    libContinue: 'Continue',
    noContinue: 'Nothing to continue yet — open a book first',
    libFilter: 'Filter by title…',
    libRecent: 'Recent',
    libForget: 'Remove from recent',
    endTitle: 'The end',
    endLibrary: 'To the library',
    endClose: 'Stay',
    cmdFontBigger: 'Increase font size',
    cmdFontSmaller: 'Decrease font size',
    cmdImport: 'Import book to Markdown (fb2, epub, txt)…',
    menuConvert: 'Convert to Markdown',
    convertStart: 'Converting…',
    convertDone: 'Converted — opening in MD Reader',
    convertFail: 'Conversion failed — see the developer console for details',
    convertUnsupported: 'This file type is not supported yet',
    convertNoZip: 'This device cannot unpack EPUB (no DecompressionStream). Try a newer Obsidian, or convert the book to FB2',
    sImportSection: 'Book import',
    sImportFolder: 'Folder for imported books',
    sImportFolderDesc: 'Vault folder where converted books (and their images) are saved. Empty = vault root',
    sImportNow: 'Import a book now',
    sImportNowDesc: 'Pick an .fb2, .epub or .txt file and convert it to Markdown',
    sImportBtn: 'Choose file…',
  },
  ru: {
    fallbackTitle: 'MD Reader',
    notFound: 'Заметка не найдена.',
    navPrev: 'Предыдущая страница',
    navNext: 'Следующая страница',
    ribbonLib: 'Библиотека MD Reader',
    cmdLibrary: 'Открыть библиотеку',
    libTitle: 'Библиотека',
    libImport: 'Импортировать книгу (fb2, epub, txt)…',
    libAddNote: 'Добавить заметку…',
    libEmpty: 'Пока пусто. Импортируйте книгу или добавьте заметку из vault.',
    libRemove: 'Убрать из библиотеки',
    notePickPlaceholder: 'Какую заметку добавить в библиотеку…',
    cmdOpen: 'Открыть текущую заметку в MD Reader',
    menuOpen: 'Открыть в MD Reader',
    sSecPage: 'Страница',
    sSecText: 'Текст',
    sSecColour: 'Цвет',
    sSecReading: 'Чтение',
    sPageMode: 'Режим страниц',
    sPageModeDesc: 'Сколько страниц показывать на экране',
    optAuto: 'Авто (две на широком экране, одна на узком)',
    optSingle: 'Всегда одна',
    optDouble: 'Всегда две (книжный разворот)',
    sMaxWidth: 'Макс. ширина страницы, px',
    sMaxWidthDesc: 'Ширина одной страницы. Меньше — уже колонка, комфортнее читать. 0 — без ограничения',
    sFontSize: 'Размер шрифта',
    sFontSizeDesc: 'Множитель относительно шрифта темы',
    sFontFamily: 'Шрифт для чтения',
    sFontFamilyDesc: 'Каким шрифтом набран текст страницы — только внутри ридера',
    optFontTheme: 'Шрифт темы',
    optFontSerif: 'С засечками',
    optFontSans: 'Без засечек',
    optFontMono: 'Моноширинный',
    optFontCustom: 'Свой…',
    sFontCustom: 'Свой шрифт',
    sFontCustomDesc: 'CSS font-family, например: "Literata", Georgia, serif',
    sTint: 'Тонировка страницы',
    sTintDesc: 'Перекрасить страницу для комфортного чтения. Меняется только ридер — остальной Obsidian остаётся в своей теме',
    optTintNone: 'Цвета темы',
    optTintSepia: 'Сепия',
    optTintCream: 'Кремовый',
    optTintGray: 'Мягкий серый',
    optTintNight: 'Ночь',
    sBrightness: 'Яркость, %',
    sBrightnessDesc: 'Приглушить страницу для чтения в темноте',
    sLineHeight: 'Межстрочный интервал',
    sGap: 'Промежуток между страницами, em',
    sAnimate: 'Анимация перелистывания',
    sTap: 'Зоны нажатия',
    sTapDesc: 'Тап/клик по левой или правой трети — листать; по центру — спрятать панель',
    sRemember: 'Запоминать позицию',
    sRememberDesc: 'Открывать каждую заметку с того места, где остановился',
    sTitle: 'Показывать заголовок заметки',
    sOpenIn: 'Где открывать',
    optNewTab: 'Новая вкладка',
    optCurrent: 'Текущая вкладка',
    optSplit: 'Разделить экран',
    optWindow: 'Новое окно',
    sCollapse: 'Сворачивать боковые панели',
    sCollapseDesc: 'Прятать левую и правую панели при открытии ридера и возвращать при закрытии вкладки',
    sImmersive: 'Полноэкранное чтение',
    sImmersiveDesc: 'Прятать верхнюю шапку и нижнюю панель. Тап по центру страницы — показать/скрыть их',
    sFullscreen: 'Полный экран при чтении',
    sFullscreenDesc: 'Открывать книгу на весь экран и выходить из него при закрытии ридера. Esc выходит в любой момент',
    cmdFullscreen: 'Полный экран — включить или выключить',
    menuFsOn: 'Полный экран',
    menuFsOff: 'Выйти из полного экрана',
    sHideBar: 'Прятать системную панель (моб.)',
    sHideBarDesc: 'При чтении на телефоне прятать и системную панель ОС (часы, уведомления). Экспериментально — может не работать на некоторых устройствах',
    sJustify: 'Выравнивание по ширине',
    sJustifyDesc: 'Ровнять абзацы по обоим краям, с переносами там, где их поддерживает платформа (в десктопной сборке словарей переносов нет). Вёрстка страницы при этом дороже примерно в полтора раза — на медленной машине выключать в первую очередь',
    sPadding: 'Вертикальные поля, em',
    sPaddingDesc: 'Пустое место сверху и снизу страницы',
    cmdTint: 'Переключить тонировку страницы',
    cmdToc: 'Открыть оглавление',
    cmdSearch: 'Искать по книге',
    cmdBookmark: 'Поставить / снять закладку',
    cmdBookmarks: 'Открыть закладки',
    menuNav: 'Навигация',
    menuToc: 'Оглавление',
    menuSearch: 'Поиск по книге',
    menuLibrary: 'Библиотека',
    menuEdit: 'Открыть заметку для правки',
    menuExit: 'Выйти из чтения',
    cmdExit: 'Выйти из чтения',
    endExit: 'Выйти',
    cmdNextChapter: 'Следующая глава',
    cmdPrevChapter: 'Предыдущая глава',
    cmdEdit: 'Открыть заметку для правки',
    scrubLabel: 'Перейти в другое место книги',
    unitMin: 'мин',
    unitH: 'ч',
    noChapters: 'В этой книге нет глав',
    menuBmAdd: 'Поставить закладку',
    menuBmRemove: 'Снять закладку',
    menuBmList: 'Закладки',
    tocPlaceholder: 'Перейти к заголовку…',
    tocEmpty: 'Ничего не найдено',
    tocNone: 'В этой заметке нет заголовков',
    searchPlaceholder: 'Искать в этой книге…',
    searchEmpty: 'Ничего не найдено (нужно хотя бы два символа)',
    bmPlaceholder: 'Перейти к закладке…',
    bmNone: 'В этой заметке пока нет закладок',
    bmAdded: 'Закладка поставлена',
    bmRemoved: 'Закладка снята',
    menuAppearance: 'Оформление',
    cmdAppearance: 'Оформление: шрифт, тонировка, поля',
    menuBack: 'Назад, где читал',
    cmdContinue: 'Продолжить чтение',
    libContinue: 'Продолжить',
    noContinue: 'Пока нечего продолжать — сначала откройте книгу',
    libFilter: 'Фильтр по названию…',
    libRecent: 'Недавнее',
    libForget: 'Убрать из недавнего',
    endTitle: 'Конец',
    endLibrary: 'В библиотеку',
    endClose: 'Остаться',
    cmdFontBigger: 'Увеличить шрифт',
    cmdFontSmaller: 'Уменьшить шрифт',
    cmdImport: 'Импортировать книгу в Markdown (fb2, epub, txt)…',
    menuConvert: 'Конвертировать в Markdown',
    convertStart: 'Конвертирую…',
    convertDone: 'Готово — открываю в MD Reader',
    convertFail: 'Не удалось сконвертировать — подробности в консоли разработчика',
    convertUnsupported: 'Этот формат пока не поддерживается',
    convertNoZip: 'Это устройство не умеет распаковывать EPUB (нет DecompressionStream). Нужен Obsidian поновее — или сконвертируйте книгу в FB2',
    sImportSection: 'Импорт книг',
    sImportFolder: 'Папка для импортированных книг',
    sImportFolderDesc: 'Папка vault, куда сохраняются сконвертированные книги (и их картинки). Пусто — корень vault',
    sImportNow: 'Импортировать книгу',
    sImportNowDesc: 'Выбрать файл .fb2, .epub или .txt и сконвертировать в Markdown',
    sImportBtn: 'Выбрать файл…',
  },
};
let APP_LANG = 'en';
try {
  // Obsidian sets moment's locale to the app language — read it instead of localStorage
  const loc = (window.moment && window.moment.locale && window.moment.locale()) || '';
  const code = String(loc).toLowerCase().split('-')[0];
  if (STRINGS[code]) APP_LANG = code;
} catch (e) { /* ignore */ }
const t = (k) => (STRINGS[APP_LANG] && STRINGS[APP_LANG][k]) || STRINGS.en[k] || k;

/* ============================================================
   Table of contents — native suggester over the note's headings
   ============================================================ */
class HeadingSuggestModal extends SuggestModal {
  constructor(app, view) {
    super(app);
    this.view = view;
    this.setPlaceholder(t('tocPlaceholder'));
    this.emptyStateText = t('tocEmpty');
  }
  getSuggestions(query) {
    const items = this.view.getHeadings();
    const q = query.toLowerCase().trim();
    return q ? items.filter((h) => h.text.toLowerCase().includes(q)) : items;
  }
  renderSuggestion(h, el) {
    el.addClass('hr-toc-item');
    // отступ по уровню заголовка: h1 без отступа, каждый следующий — глубже
    el.style.paddingInlineStart = ((h.level - 1) * 1.1) + 'em';
    el.createSpan({ cls: 'hr-toc-level', text: 'H' + h.level });
    el.createSpan({ cls: 'hr-toc-text', text: h.text || '—' });
  }
  onChooseSuggestion(h) {
    this.view.goToTocEntry(h);
  }
}

/* ============================================================
   Search across the whole book (all render blocks, not just the visible one)
   ============================================================ */
class BookSearchModal extends SuggestModal {
  constructor(app, view) {
    super(app);
    this.view = view;
    this.limit = 200;
    this.setPlaceholder(t('searchPlaceholder'));
    this.emptyStateText = t('searchEmpty');
  }
  getSuggestions(query) { return this.view.searchBook(query); }
  renderSuggestion(hit, el) {
    el.addClass('hr-hit-item');
    const line = el.createDiv('hr-hit-text');
    line.createSpan({ text: hit.before });
    line.createSpan({ cls: 'hr-hit-match', text: hit.match });
    line.createSpan({ text: hit.after });
    el.createSpan({ cls: 'hr-hit-pct', text: hit.pct + '%' });
  }
  onChooseSuggestion(hit) { this.view.goToHit(hit); }
}

/* ============================================================
   Bookmarks — several per note, stored as a book-global fraction
   ============================================================ */
class BookmarkSuggestModal extends SuggestModal {
  constructor(app, view) {
    super(app);
    this.view = view;
    this.setPlaceholder(t('bmPlaceholder'));
    this.emptyStateText = t('bmNone');
  }
  getSuggestions(query) {
    const q = query.toLowerCase().trim();
    const items = this.view.bookmarks();
    return q ? items.filter((b) => (b.label || '').toLowerCase().includes(q)) : items;
  }
  renderSuggestion(b, el) {
    el.addClass('hr-bm-item');
    el.createSpan({ cls: 'hr-bm-pct', text: Math.round((b.g || 0) * 100) + '%' });
    el.createSpan({ cls: 'hr-bm-label', text: b.label || '—' });
    const x = el.createSpan({ cls: 'hr-bm-x', attr: { 'aria-label': t('menuBmRemove') } });
    x.setText('✕');
    x.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.view.removeBookmark(b);
      // пересобрать список штатным путём: свою строку удалять нельзя — SuggestModal
      // сопоставляет элементы со значениями по номеру, и следующий выбор уехал бы
      this.inputEl.dispatchEvent(new Event('input'));
    });
  }
  onChooseSuggestion(b) { this.view.pushJump(); this.view.goToG(b.g); }
}

/* ============================================================
   Library — books from the import folder + hand-added notes
   ============================================================ */
class LibraryModal extends Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
    this.query = '';
  }

  onOpen() {
    const { contentEl } = this;
    // штатный заголовок модалки (titleEl есть во всех версиях API, в отличие от setTitle)
    this.titleEl.setText(t('libTitle'));
    this.items = this.plugin.libraryFiles();

    // «Продолжить» — то, зачем библиотеку открывают чаще всего: вернуться в книгу
    const last = this.plugin.lastReadFile();
    if (last) {
      const btn = contentEl.createEl('button', { cls: 'hr-lib-continue mod-cta' });
      btn.createSpan({ cls: 'hr-lib-continue-label', text: t('libContinue') });
      btn.createSpan({ cls: 'hr-lib-continue-name', text: last.basename });
      btn.addEventListener('click', () => { this.close(); this.plugin.openReader(last); });
    }

    // фильтр — только когда список уже не окинуть взглядом. Фокус НЕ ставим:
    // на телефоне это сразу выкинуло бы клавиатуру поверх половины списка
    if (this.items.length > 8) {
      const inp = contentEl.createEl('input', {
        cls: 'hr-lib-filter',
        attr: { type: 'search', placeholder: t('libFilter') },
      });
      inp.addEventListener('input', () => {
        this.query = inp.value.toLowerCase().trim();
        this.renderList();
      });
    }

    this.listEl = contentEl.createDiv('hr-lib-list');
    this.renderList();

    const actions = contentEl.createDiv('hr-lib-actions');
    const impBtn = actions.createEl('button', { text: t('libImport') });
    impBtn.addEventListener('click', () => { this.close(); this.plugin.importBook(); });
    const addBtn = actions.createEl('button', { text: t('libAddNote') });
    addBtn.addEventListener('click', () => {
      this.close();
      new NotePickModal(this.app, this.plugin, (f) => this.plugin.addToLibrary(f.path)).open();
    });
  }

  renderList() {
    const list = this.listEl;
    list.empty();
    const items = this.query
      ? this.items.filter((x) => x.file.basename.toLowerCase().includes(this.query))
      : this.items;
    if (!items.length) {
      list.createDiv('hr-lib-empty').setText(this.query ? t('tocEmpty') : t('libEmpty'));
      return;
    }
    items.forEach((entry) => this.renderRow(list, entry));
  }

  renderRow(list, entry) {
    const { file, registered, recent } = entry;
    const row = list.createDiv('hr-lib-row');
    const main = row.createDiv('hr-lib-main');
    const head = main.createDiv('hr-lib-head');
    head.createSpan({ cls: 'hr-lib-title', text: file.basename });
    // «недавнее» — заметка не из библиотеки, а из истории чтения; помечаем, чтобы
    // было понятно, почему она в списке
    if (recent) head.createSpan({ cls: 'hr-lib-tag', text: t('libRecent') });
    const pos = this.plugin.db[file.path];
    const g = pos && (typeof pos.g === 'number' ? pos.g : pos.fraction);
    if (typeof g === 'number') {
      head.createSpan({ cls: 'hr-lib-pct', text: Math.round(g * 100) + '%' });
      const bar = main.createDiv('hr-lib-bar');
      // ширина — единственное, что тут может быть только инлайном
      bar.createDiv('hr-lib-bar-fill').style.width = Math.max(2, Math.round(g * 100)) + '%';
    }
    if (registered || recent) {
      // добавленное вручную убираем из списка, «недавнее» — из истории чтения.
      // Сам файл в обоих случаях остаётся на месте
      const x = row.createSpan({ cls: 'hr-lib-x', attr: { 'aria-label': recent ? t('libForget') : t('libRemove') } });
      x.setText('✕');
      x.addEventListener('click', (e) => {
        e.stopPropagation();
        if (recent) this.plugin.forgetPosition(file.path);
        else this.plugin.removeFromLibrary(file.path);
        this.items = this.items.filter((it) => it.file.path !== file.path);
        row.remove();
      });
    }
    row.addEventListener('click', () => { this.close(); this.plugin.openReader(file); });
  }

  onClose() { this.contentEl.empty(); }
}

/* выбор заметки vault для добавления в библиотеку */
class NotePickModal extends SuggestModal {
  constructor(app, plugin, onPick) {
    super(app);
    this.plugin = plugin;
    this.onPick = onPick;
    this.setPlaceholder(t('notePickPlaceholder'));
  }
  getSuggestions(query) {
    const q = query.toLowerCase().trim();
    // «недавнее» из списка не исключаем: такую заметку как раз и хочется закрепить
    const inLib = new Set(this.plugin.libraryFiles().filter((x) => !x.recent).map((x) => x.file.path));
    let files = this.app.vault.getMarkdownFiles().filter((f) => !inLib.has(f.path));
    if (q) files = files.filter((f) => f.path.toLowerCase().includes(q));
    return files.sort((a, b) => b.stat.mtime - a.stat.mtime).slice(0, 200);
  }
  renderSuggestion(f, el) {
    el.addClass('hr-note-pick');
    el.createDiv({ cls: 'hr-note-pick-name', text: f.basename });
    if (f.parent && f.parent.path && f.parent.path !== '/') {
      el.createDiv({ cls: 'hr-note-pick-path', text: f.parent.path });
    }
  }
  onChooseSuggestion(f) { this.onPick(f); }
}

/* ============================================================
   Appearance — the settings you actually change while reading, one tap away.
   На телефоне ридер живёт в иммерсивном режиме: чтобы добраться оттуда до
   настроек плагина, надо вернуть весь интерфейс и уйти из книги.
   ============================================================ */
class AppearanceModal extends Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass('hr-ap');
    this.titleEl.setText(t('menuAppearance'));
    const p = this.plugin;
    const save = () => { p.saveAll(); p.refreshOpenViews(); };
    // ползунок шлёт onChange на каждый шаг — писать файл на каждый нельзя,
    // отдаём это общему автосохранению (см. queueSave)
    const live = () => p.queueSave();

    // размер шрифта — двумя большими кнопками: это то, ради чего сюда заходят,
    // а ползунок в модалке пальцем не поймать
    const size = contentEl.createDiv('hr-ap-size');
    size.createSpan({ cls: 'hr-ap-name', text: t('sFontSize') });
    const smaller = size.createEl('button', { cls: 'hr-ap-step hr-ap-small', text: 'A' });
    const value = size.createSpan({ cls: 'hr-ap-value' });
    const bigger = size.createEl('button', { cls: 'hr-ap-step hr-ap-big', text: 'A' });
    const showSize = () => value.setText(Math.round(p.settings.fontSize * 100) + '%');
    showSize();
    smaller.addEventListener('click', () => { p.stepFontSize(-1); showSize(); });
    bigger.addEventListener('click', () => { p.stepFontSize(1); showSize(); });

    // тонировка — кружками с самим цветом, а не списком названий
    const tints = contentEl.createDiv('hr-ap-tints');
    ['none'].concat(TINTS).forEach((name) => {
      const b = tints.createEl('button', {
        cls: 'hr-ap-tint hr-ap-tint-' + name,
        attr: { 'aria-label': t(TINT_LABEL[name]) },
      });
      b.toggleClass('is-active', p.settings.tint === name);
      b.addEventListener('click', () => {
        p.settings.tint = name;
        tints.querySelectorAll('.hr-ap-tint').forEach((el) => el.removeClass('is-active'));
        b.addClass('is-active');
        save();
      });
    });

    const slider = (key, prop, min, max, step) => new Setting(contentEl)
      .setName(t(key))
      .addSlider((sl) => sl.setLimits(min, max, step).setValue(p.settings[prop])
        .setDynamicTooltip()
        .onChange((v) => { p.settings[prop] = v; live(); }));

    slider('sLineHeight', 'lineHeight', 1.2, 2.4, 0.05);
    slider('sPadding', 'verticalPadding', 0, 4, 0.1);
    slider('sMaxWidth', 'maxPageWidth', 0, 1000, 20);
    slider('sBrightness', 'brightness', 20, 100, 5);

    new Setting(contentEl)
      .setName(t('sPageMode'))
      .addDropdown((d) => d.addOptions({
        'auto': t('optAuto'),
        'single': t('optSingle'),
        'double': t('optDouble'),
      }).setValue(p.settings.pageMode)
        .onChange((v) => { p.settings.pageMode = v; save(); }));

    new Setting(contentEl)
      .setName(t('sJustify'))
      .addToggle((tg) => tg.setValue(p.settings.justify)
        .onChange((v) => { p.settings.justify = v; save(); }));
  }

  onClose() { this.contentEl.empty(); }
}

/* ============================================================
   Chapter splitting — big files are rendered one chapter at a time so the
   column layout doesn't choke; small notes stay a single chapter (as before).
   ============================================================ */
// Размер блока рендера. Замеры в Chromium (та же начинка, что у Obsidian) дают
// РОВНО ЛИНЕЙНУЮ зависимость колоночной раскладки от объёма: ~0.28 мс на 1000
// символов, то есть блок 200k = ~56 мс раскладки при каждом входе в него и при
// каждом пересчёте — это и есть заметные подтормаживания на больших книгах.
// Держим блок в районе 60k (~17 мс) — глазом уже не видно, а переходов между
// блоками стало больше, но они почти бесплатны из-за кэша соседних блоков.
// Закладки от размера блока не страдают: позиция хранится глобальной долей
// книги (см. savePos), а не номером блока.
// Это ЗАПАСНЫЕ значения — пока плагин не измерил скорость самой машины
// (см. blockTargets/noteLayoutRate: на медленном железе блок ужимается сам).
const CHAPTER_SPLIT_THRESHOLD = Platform.isMobile ? 60000 : 120000; // меньше — рендерим целиком
const CHAPTER_PACK_TARGET = Platform.isMobile ? 40000 : 60000;      // размер «блока рендера»
const CHAPTER_CHUNK_TARGET = Platform.isMobile ? 30000 : 45000;     // куски секции больше лимита

// нормализовать текст заголовка, чтобы сравнивать исходник с отрисованным DOM:
// снять инлайн-разметку, ссылки и экранирование, схлопнуть пробелы
function normHeading(s) {
  return String(s == null ? '' : s)
    .replace(/!?\[\[[^\]|]*\|([^\]]*)\]\]/g, '$1')   // [[ссылка|подпись]]
    .replace(/!?\[\[([^\]]*)\]\]/g, '$1')            // [[ссылка]]
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')       // [текст](url)
    .replace(/[*_`~]/g, '')
    .replace(/\\(.)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// найти заголовки вне ограждённых блоков кода: [{line, level, text}].
// Ловим ОБА вида, потому что оба рендерятся в <h1>…<h6>, а по номеру заголовка мы
// потом ищем элемент в DOM: ATX (# …, до 3 пробелов слева, допустим пустой текст)
// и setext (строка текста, подчёркнутая === или ---)
function scanHeadings(lines) {
  const out = [];
  let inFence = false, fenceCh = '';
  let paraStart = null; // первая строка текущего абзаца — кандидат в setext-заголовок
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fm = line.match(/^ {0,3}(```+|~~~+)/);
    if (fm) {
      const c = fm[1][0];
      if (!inFence) { inFence = true; fenceCh = c; } else if (c === fenceCh) { inFence = false; fenceCh = ''; }
      paraStart = null;
      continue;
    }
    if (inFence) continue;

    // ATX. Пробел после решёток обязателен, поэтому #тег заголовком не считается
    const hm = line.match(/^ {0,3}(#{1,6})(?:[ \t]+(.*?))?[ \t]*$/);
    if (hm) {
      out.push({ line: i, level: hm[1].length, text: (hm[2] || '').replace(/[ \t]+#*[ \t]*$/, '').trim() });
      paraStart = null;
      continue;
    }

    // setext: подчёркивание относится к предыдущему абзацу. Пустая строка перед ним
    // сбрасывает paraStart — тогда --- остаётся обычным разделителем, как в CommonMark
    const sm = line.match(/^ {0,3}(=+|-+)[ \t]*$/);
    if (sm && paraStart !== null) {
      out.push({ line: paraStart, level: sm[1][0] === '=' ? 1 : 2, text: lines.slice(paraStart, i).join(' ').trim() });
      paraStart = null;
      continue;
    }

    // абзацем не считаем пустые строки, пункты списков, цитаты и отступ-код
    if (/^\s*$/.test(line) || /^ {0,3}([>*+-]|\d{1,9}[.)])(\s|$)/.test(line) || /^(\t| {4,})/.test(line)) paraStart = null;
    else if (paraStart === null) paraStart = i;
  }
  return out;
}

// оглавление из цельного тела (когда файл не делится на главы) — все заголовки в главе `chapter`.
// line — номер строки заголовка в ТЕЛЕ заметки: по нему ридер открывает исходник на этом месте
function tocFromBody(body, chapter) {
  return scanHeadings(body.split('\n')).map((h, i) => ({ text: h.text, level: h.level, chapter, hIndex: i, line: h.line }));
}

// разрезать большой текст без заголовков на куски ~target символов по границам абзацев
function chunkBySize(text, target) {
  const paras = text.split(/\n{2,}/);
  const chunks = [];
  let buf = '';
  for (const p of paras) {
    if (buf && buf.length + p.length > target) { chunks.push(buf.trim()); buf = ''; }
    buf += (buf ? '\n\n' : '') + p;
  }
  if (buf.trim()) chunks.push(buf.trim());
  return chunks.length ? chunks : [text];
}

// -> { chapters: string[], toc: [{text, level, chapter, hIndex}], chars: number[] }
// Стратегия: режем тело по КАЖДОМУ заголовку любого уровня на «секции», затем ПАКУЕМ
// подряд идущие секции в блоки рендера ≤ PACK_TARGET. Так один блок не бывает слишком
// большим (нет тормозов даже у книг с огромными томами), а перерисовок мало.
function splitChapters(body, targets) {
  const T = targets || {};
  const SPLIT = T.split > 0 ? T.split : CHAPTER_SPLIT_THRESHOLD;
  const PACK = T.pack > 0 ? T.pack : CHAPTER_PACK_TARGET;
  const CHUNK = T.chunk > 0 ? T.chunk : CHAPTER_CHUNK_TARGET;
  if (body.length <= SPLIT) {
    return { chapters: [body], toc: tocFromBody(body, 0), chars: [body.length] };
  }
  const lines = body.split('\n');
  const headings = scanHeadings(lines);
  if (!headings.length) {
    const chunks = chunkBySize(body, CHUNK);
    return { chapters: chunks, toc: [], chars: chunks.map((c) => c.length) };
  }

  // секции: начало = строка 0 (преамбула) и каждая строка-заголовок
  const byLine = new Map();
  headings.forEach((h, i) => { if (!byLine.has(h.line)) byLine.set(h.line, i); });
  const starts = Array.from(new Set([0, ...headings.map((h) => h.line)])).sort((a, b) => a - b);
  const sections = starts.map((s, k) => {
    const e = k + 1 < starts.length ? starts[k + 1] : lines.length;
    return { text: lines.slice(s, e).join('\n'), heading: byLine.has(s) ? byLine.get(s) : -1 };
  });

  const chapters = [];
  const toc = [];
  let buf = '';
  let curChapter = 0;
  let curHCount = 0;
  const flush = () => {
    if (buf === '') return;
    chapters.push(buf.replace(/^\n+/, '').replace(/\n+$/, ''));
    buf = '';
    curChapter++;
    curHCount = 0;
  };

  for (const sec of sections) {
    // одиночная секция больше лимита — режем её по размеру, заголовок идёт с первым куском
    if (sec.text.length > PACK) {
      if (buf !== '') flush();
      const pieces = chunkBySize(sec.text, CHUNK);
      pieces.forEach((piece, pi) => {
        buf = piece;
        if (pi === 0 && sec.heading >= 0) {
          const h = headings[sec.heading];
          toc.push({ text: h.text, level: h.level, chapter: curChapter, hIndex: 0, line: h.line });
        }
        flush();
      });
      continue;
    }
    // не влезает в текущий блок — закрыть его и начать новый
    if (buf !== '' && buf.length + sec.text.length > PACK) flush();
    if (sec.heading >= 0) {
      const h = headings[sec.heading];
      toc.push({ text: h.text, level: h.level, chapter: curChapter, hIndex: curHCount, line: h.line });
      curHCount++;
    }
    buf += (buf ? '\n' : '') + sec.text;
  }
  flush();

  return { chapters, toc, chars: chapters.map((c) => c.length) };
}

// Язык текста — для переносов при выравнивании по ширине. Раньше брали язык
// интерфейса, и английская книга у русского Obsidian переносилась по русским
// правилам (а русская у английского — не переносилась вовсе). Хватает грубой
// прикидки по первым тысячам букв: нас интересует только кириллица vs латиница
function guessLang(text) {
  const head = String(text || '').slice(0, 4000);
  let cyr = 0, lat = 0;
  for (let i = 0; i < head.length; i++) {
    const c = head.charCodeAt(i);
    if (c >= 0x0400 && c <= 0x04FF) cyr++;
    else if ((c >= 65 && c <= 90) || (c >= 97 && c <= 122)) lat++;
  }
  if (cyr + lat < 20) return '';        // цифры, код, картинки — не гадаем
  return cyr > lat ? 'ru' : 'en';
}

// расстояние между двумя пальцами — основа щипка
function touchDist(touches) {
  return Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
}

/* ============================================================
   Reader view
   ============================================================ */
class ReaderView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.filePath = null;
    this.file = null;

    this.page = 0;
    this.totalPages = 1;
    this.pageStride = 0;

    this.renderChild = null;
    this.ro = null;
    this._scope = null;
    this._scopePushed = false;
    this._pendingFraction = 0;
    this._lastTouch = 0;
    this._debouncedRemeasure = null;
    this._renderGen = 0;
    this._raf = 0;
    this._repaginateTimer = null;
    this._measured = false;

    // разбиение на главы (большие файлы рендерятся по одной главе)
    this._pendingHeading = null;   // {index, text} — отложенный прыжок к заголовку
    this._pendingFind = null;      // {query, ordinal, fraction} — отложенный прыжок к находке
    this._searchIndex = null;      // {path, low[]} — главы в нижнем регистре для поиска
    this.chapters = null;     // markdown по главам (для мелких заметок — одна глава = весь текст)
    this.chapterIndex = 0;
    this.toc = [];            // все заголовки: {text, level, chapter, hIndex, line}
    this.chapterChars = [];
    this.charsBefore = [];
    this.totalChars = 0;
    this.bodyLine0 = 0;       // на какой строке файла начинается тело (после frontmatter)
    this.textLang = '';       // язык текста книги — от него зависят переносы

    // фоновая предзагрузка следующего блока (переход вперёд без ожидания рендера)
    this._prefetch = null;      // {index, el, comp, file}
    this._prefetchTimer = null;
    this._prefetchIdle = 0;
    this._prefetchWant = -1;
    // кэш соседних блоков: index -> {el, comp, file}. Разобранный markdown дорог,
    // держим по нему пару соседей, чтобы возврат назад не стоил ничего
    this._cache = new Map();
    this._blockReady = false;   // текущий блок отрисован целиком (можно класть в кэш)

    this._jumps = [];         // доли, откуда прыгали (оглавление/поиск/закладка) — для «назад»
    this._headPages = null;   // [{page, toc}] — заголовки текущего блока, для строки состояния
    this._endEl = null;       // отбивка «Конец» на последней странице
    this._statusEls = null;   // готовые узлы строки состояния (создаются в onOpen)
    this._speedAt = 0;        // время и место прошлого листания — из них считается скорость чтения
    this._speedG = 0;
    this._scrub = null;       // {id, g} — идёт протяжка по полосе прогресса
    this._reloadTimer = null; // отложенная перечитка после правки файла снаружи
    this._keepG = null;       // место, куда вернуться после перечитки (вместо сохранённого)
  }

  getViewType() { return VIEW_TYPE_READER; }
  getDisplayText() { return this.file ? this.file.basename : t('fallbackTitle'); }
  getIcon() { return 'book-open'; }

  getState() { return { filePath: this.filePath }; }

  async setState(state, result) {
    if (state && state.filePath && state.filePath !== this.filePath) {
      this.savePos();
      this.filePath = state.filePath;
      const f = this.app.vault.getAbstractFileByPath(state.filePath);
      this.file = (f instanceof TFile) ? f : null;
      await this.renderFile();
    }
    return super.setState(state, result);
  }

  async onOpen() {
    this.contentEl.addClass('hr-view-content');

    const vp = this.contentEl.createDiv('hr-viewport');
    this.viewport = vp;
    // official opt-out of Obsidian's mobile swipe recognizer:
    // it walks ancestors on touchstart and does not arm when it sees this attribute
    vp.dataset.ignoreSwipe = 'true';
    vp.tabIndex = 0;
    vp.setAttribute('role', 'region');
    vp.setAttribute('aria-roledescription', 'paged reader');
    // aria-label тут НЕ ставим: Obsidian показывает aria-label как всплывающий
    // тултип, и подсказка вылезала поверх текста при каждом наведении на страницу

    this.stage = vp.createDiv('hr-stage');
    this.content = this.stage.createDiv('hr-content');

    // «вуаль» яркости: затемняет страницу поверх текста. Именно наложением, а не
    // filter: brightness — фильтр создаёт containing block и ломает позиционирование
    // внутри отрисованного markdown
    this.dimmer = vp.createDiv('hr-dimmer');

    this.prevBtn = vp.createEl('button', { cls: 'hr-nav-btn hr-prev hr-ui', attr: { 'aria-label': t('navPrev') } });
    this.prevBtn.setText('‹');
    this.nextBtn = vp.createEl('button', { cls: 'hr-nav-btn hr-next hr-ui', attr: { 'aria-label': t('navNext') } });
    this.nextBtn.setText('›');

    const bar = vp.createDiv('hr-statusbar hr-ui');
    this.statusBar = bar; // высота строки статуса подпирает нижний отступ страницы
    bar.setAttribute('aria-live', 'polite');
    // полоса прогресса — ещё и перемотка по всей книге. Сама полоса тонкая, поэтому
    // ловим указатель обёрткой с отступами: пальцем в 3 пиксела не попасть
    this.scrubEl = bar.createDiv('hr-scrub');
    // без role="slider": по-настоящему это потребовало бы фокуса и своих стрелок,
    // а те же переходы уже есть с клавиатуры и в меню. Ограничиваемся подписью
    this.scrubEl.setAttribute('aria-label', t('scrubLabel'));
    this.progress = this.scrubEl.createDiv('hr-progress');
    this.progressFill = this.progress.createDiv('hr-progress-fill');
    this.setupScrub();
    // текст статуса («34%») кликабелен — открывает меню навигации. Это главная точка
    // входа на телефоне: в иммерсивном режиме нижняя панель Obsidian спрятана,
    // и до палитры команд оттуда не добраться
    this.statusText = bar.createDiv('hr-status-text');
    // три готовых узла на всю жизнь вьюхи: закладка, название главы, позиция.
    // Пустые прячет CSS (span:empty), чтобы не оставалось лишних промежутков
    this._statusEls = {
      bm: this.statusText.createSpan({ cls: 'hr-status-bm' }),
      chapter: this.statusText.createSpan({ cls: 'hr-status-chapter' }),
      pos: this.statusText.createSpan({ cls: 'hr-status-pos', text: '1 / 1' }),
      left: this.statusText.createSpan({ cls: 'hr-status-left' }),
    };
    this.statusText.setAttribute('aria-label', t('menuNav'));
    this.registerDomEvent(this.statusText, 'click', (e) => { e.stopPropagation(); this.openNavMenu(e); });

    this.registerDomEvent(this.prevBtn, 'click', (e) => { e.stopPropagation(); this.prev(); });
    this.registerDomEvent(this.nextBtn, 'click', (e) => { e.stopPropagation(); this.next(); });

    this.buildScope();
    this.registerDomEvent(vp, 'focusin', () => this.pushScope());
    this.registerDomEvent(vp, 'focusout', () => this.popScope());

    this.setupInput();
    this.setupRepagination();
    this.applySettings();
  }

  async onClose() {
    this.popScope();
    this.hideEnd();
    if (this.ro) { this.ro.disconnect(); this.ro = null; }
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = 0; }
    if (this._repaginateTimer) { clearTimeout(this._repaginateTimer); this._repaginateTimer = null; }
    if (this._reloadTimer) { clearTimeout(this._reloadTimer); this._reloadTimer = null; }
    this.discardPrefetch();
    this.clearCache();
    this.savePos();
    if (this.renderChild) { this.removeChild(this.renderChild); this.renderChild = null; }
    // Забыть ссылку на наш документ, если иммерсив висел на нём: это может быть
    // закрывающееся попап-окно, и обращение к его мёртвому body позже упало бы.
    // Классы на body НЕ трогаем: для живого окна ими управляет active-leaf-change
    // (который снимет иммерсив, если следующим активным станет не-ридер), а соседний
    // ридер в том же окне не должен потерять/перепрятать хром из-за нашего закрытия.
    const doc = (this.contentEl && this.contentEl.ownerDocument) || document;
    if (this.plugin && this.plugin._immersiveDoc === doc) this.plugin._immersiveDoc = null;
    if (this.contentEl) this.contentEl.empty();
  }

  /* ---------- render ---------- */
  async renderFile() {
    if (!this.content) return;
    // отложенная перечитка (файл правили снаружи) относилась к прежнему состоянию —
    // мы и так сейчас перечитываем всё заново
    if (this._reloadTimer) { clearTimeout(this._reloadTimer); this._reloadTimer = null; }
    this.discardPrefetch(); // предзагруженный блок относится к прежнему файлу
    this.clearCache();      // и отложенные соседние блоки — тоже
    this._searchIndex = null;
    this._jumps = [];       // «назад» — в пределах одной книги
    this._blockReady = false;
    if (!this.file) {
      this.chapters = null; this.toc = []; this.chapterIndex = 0;
      this.content.empty();
      this.content.createDiv('hr-empty').setText(t('notFound'));
      return;
    }

    const gen = ++this._renderGen;
    const raw = await this.app.vault.cachedRead(this.file);
    if (gen !== this._renderGen) return;

    const cache = this.app.metadataCache.getFileCache(this.file);
    const fmPos = cache && cache.frontmatterPosition;
    let body = fmPos
      ? raw.slice(fmPos.end.offset)
      : raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');
    body = body.replace(/^\s+/, '');
    // сколько строк файла осталось выше тела: номера строк в оглавлении считаются от
    // начала тела, а редактор открывается по строке ФАЙЛА
    this.bodyLine0 = raw.length > body.length
      ? (raw.slice(0, raw.length - body.length).match(/\n/g) || []).length
      : 0;
    this.textLang = guessLang(body);

    // разбить на главы (мелкие файлы → одна глава = весь текст) и посчитать метрики прогресса
    const split = splitChapters(body, this.plugin.blockTargets());
    this.chapters = split.chapters;
    this.toc = split.toc;
    this.chapterChars = split.chars;
    this.totalChars = split.chars.reduce((a, b) => a + b, 0);
    this.charsBefore = [];
    let acc = 0;
    for (let i = 0; i < split.chars.length; i++) { this.charsBefore[i] = acc; acc += split.chars[i]; }

    // стартовая позиция: g — глобальная доля по всей книге, НЕ зависит от разбиения
    // на блоки (у ПК и телефона оно разное). Легаси-форматы: {chapter, fraction}
    // (v1.4, поблочная) и просто {fraction} (v1.1 — тоже глобальная по смыслу)
    const keep = this._keepG;
    this._keepG = null;
    this.resetSpeedSample();
    const saved = keep == null && this.plugin.settings.rememberPosition && this.plugin.db[this.file.path];
    let g = keep == null ? 0 : keep;
    if (saved) {
      if (typeof saved.g === 'number') g = saved.g;
      else if (typeof saved.chapter === 'number' && this.totalChars > 0) {
        const ch = Math.max(0, Math.min(saved.chapter, this.chapters.length - 1));
        g = ((this.charsBefore[ch] || 0) + (saved.fraction || 0) * (this.chapterChars[ch] || 0)) / this.totalChars;
      } else g = saved.fraction || 0;
    }
    g = Math.max(0, Math.min(1, g));
    const at = this.blockForG(g);
    await this.renderChapter(at.chapter, { fraction: at.within });
  }

  // глобальная доля книги -> {chapter, within}: номер блока рендера и доля внутри него
  blockForG(g) {
    g = Math.max(0, Math.min(1, g || 0));
    if (!this.chapters || this.chapters.length < 2 || this.totalChars <= 0) return { chapter: 0, within: g };
    const target = g * this.totalChars;
    let ch = 0;
    // строго «<»: доля ровно на стыке блоков — это КОНЕЦ предыдущего (последняя
    // страница, где человек и остановился), а не начало следующего
    while (ch < this.chapters.length - 1 && this.charsBefore[ch] + this.chapterChars[ch] < target) ch++;
    const within = this.chapterChars[ch] > 0 ? (target - this.charsBefore[ch]) / this.chapterChars[ch] : 0;
    return { chapter: ch, within: Math.max(0, Math.min(1, within)) };
  }

  // текущая позиция как глобальная доля книги (взвешенно по символам).
  // Единственная страница = блок прочитан целиком (1), как и показывает статус:
  // иначе прочитанная заметка оставалась бы в библиотеке с «0 %»
  currentG() {
    const within = this.totalPages > 1 ? this.page / (this.totalPages - 1) : 1;
    if (this.chapters && this.chapters.length > 1 && this.totalChars > 0) {
      return ((this.charsBefore[this.chapterIndex] || 0) + within * (this.chapterChars[this.chapterIndex] || 0)) / this.totalChars;
    }
    return within;
  }

  // отрисовать ОДНУ главу; opts = { fraction } (0=начало, 1=конец) или { heading: {index, text} }
  async renderChapter(index, opts) {
    if (!this.content || !this.file || !this.chapters) return;
    opts = opts || {};
    const gen = ++this._renderGen;
    const from = this.chapterIndex;
    this.chapterIndex = Math.max(0, Math.min(index, this.chapters.length - 1));
    this.hideEnd();
    this._headPages = null;

    // подсветку находки уносить с собой нельзя: блок ляжет в кэш вместе с ней, и при
    // возврате прошлый запрос будет светиться посреди текста как ни в чём не бывало
    this.clearHighlight();

    // уходим из целиком отрисованного блока — откладываем его, а не выбрасываем.
    // Недорисованный (прервали на середине) в кэш класть нельзя
    if (this.renderChild && this._blockReady && from !== this.chapterIndex) this.stashBlock(from);
    if (this.renderChild) { this.removeChild(this.renderChild); this.renderChild = null; }
    this._blockReady = false;

    this.content.empty();
    this.content.style.transform = 'translateX(0px)';
    this.page = 0;
    this._measured = false;
    this._pendingHeading = opts.heading || null;
    this._pendingFind = opts.find || null;
    this._pendingFraction = (opts.heading || opts.find) ? 0 : (opts.fraction || 0);

    // блок уже разобран — отложен при уходе назад или подготовлен предзагрузкой.
    // Вставляем готовый DOM без повторного markdown-рендера (самая дорогая часть)
    const cached = this.takeCached(this.chapterIndex);
    const pf = this._prefetch;
    if (cached) {
      this.renderChild = cached.comp; // компонент всё это время жил в addChild
      while (cached.el.firstChild) this.content.appendChild(cached.el.firstChild);
    } else if (pf && pf.ready && pf.index === this.chapterIndex && pf.file === this.file.path) {
      this._prefetch = null;
      this.renderChild = pf.comp; // уже addChild-нут при предзагрузке
      while (pf.el.firstChild) this.content.appendChild(pf.el.firstChild);
    } else {
      this.renderChild = new Component();
      this.addChild(this.renderChild);
      try {
        await MarkdownRenderer.render(this.app, this.chapters[this.chapterIndex] || '', this.content, this.file.path, this.renderChild);
      } catch (e) {
        console.error('MD Reader: ошибка рендера Markdown', e);
      }
      if (gen !== this._renderGen) return;
    }
    this._blockReady = true;

    // заголовок-имя файла — только на первой главе и только если нет своего H1
    if (this.plugin.settings.showTitle && this.chapterIndex === 0) {
      const kids = this.content.children;
      let hasOwnH1 = false;
      for (let i = 0; i < kids.length && i < 4; i++) {
        if (kids[i].tagName === 'H1') { hasOwnH1 = true; break; }
      }
      if (!hasOwnH1) {
        const tt = this.content.createEl('h1', { cls: 'hr-title', text: this.file.basename });
        this.content.insertBefore(tt, this.content.firstChild);
      }
    }

    this.content.querySelectorAll('img, audio, video').forEach((el) => {
      const onload = () => { if (this._debouncedRemeasure) this._debouncedRemeasure(); };
      if (el.tagName === 'IMG') {
        if (!el.complete) el.addEventListener('load', onload, { once: true });
      } else {
        el.addEventListener('loadedmetadata', onload, { once: true });
      }
    });

    this._raf = requestAnimationFrame(() => {
      this._raf = 0;
      if (gen !== this._renderGen || !this.content || !this.content.isConnected) return;
      // measure() сам применит отложенную позицию (долю или прыжок к заголовку) после реального замера
      this.measure();
    });

    if (this.viewport) this.viewport.focus();
    if (this.leaf && this.leaf.updateHeader) this.leaf.updateHeader();
  }

  /* ---------- кэш соседних блоков ---------- */
  // Разбор markdown — самая дорогая часть перехода, а назад листают постоянно.
  // Уходя из блока, прячем его узлы в открепленный контейнер: при возврате
  // останется только раскладка (десяток миллисекунд на нынешнем размере блока)
  stashBlock(index) {
    if (!this.renderChild || !this.content || !this.file) return;
    this.dropCached(index); // перезаписывать запись нельзя: старый компонент остался бы висеть
    const el = document.createElement('div');
    while (this.content.firstChild) el.appendChild(this.content.firstChild);
    this._cache.set(index, { el, comp: this.renderChild, file: this.file.path });
    this.renderChild = null;
    this.trimCache(index);
  }

  takeCached(index) {
    const hit = this._cache.get(index);
    if (!hit || !this.file || hit.file !== this.file.path) return null;
    this._cache.delete(index);
    return hit;
  }

  // держим только ближайших соседей: дальше по книге они всё равно не пригодятся,
  // а память на разобранных узлах книги — не бесплатная
  trimCache(around) {
    Array.from(this._cache.keys())
      .sort((a, b) => Math.abs(a - around) - Math.abs(b - around))
      .slice(2)
      .forEach((i) => this.dropCached(i));
  }

  dropCached(index) {
    const rec = this._cache.get(index);
    if (!rec) return;
    this._cache.delete(index);
    this.removeChild(rec.comp);
  }

  clearCache() { Array.from(this._cache.keys()).forEach((i) => this.dropCached(i)); }

  /* ---------- background prefetch of the next block ---------- */
  schedulePrefetch() {
    if (!this.chapters || this.chapters.length < 2 || !this.file) return;
    const want = this.chapterIndex + 1;
    if (want >= this.chapters.length) return;
    if (this._prefetch && this._prefetch.index === want && this._prefetch.file === this.file.path) return;
    if (this._cache.has(want)) return; // следующий блок уже разобран и отложен
    // не рендерим следующий блок, пока читают начало текущего: это работа впустую,
    // а её пауза приходится ровно на момент, когда человек только вошёл в блок
    if (this.totalPages > 3 && this.page < (this.totalPages - 1) * 0.4) return;
    // уже запланировали этот же блок — метод зовётся на каждое перелистывание
    if (this._prefetchWant === want && (this._prefetchTimer || this._prefetchIdle)) return;
    this.cancelPrefetchTimer();
    this._prefetchWant = want;
    // ждём простоя главного потока: разбор markdown блокирующий, и посреди чтения
    // он ощущается как рывок. requestIdleCallback есть в Electron, на всякий
    // случай оставлен запасной таймер
    const start = () => {
      this._prefetchTimer = null;
      this._prefetchIdle = 0;
      this._prefetchWant = -1;
      this.prefetchChapter(want);
    };
    if (typeof window.requestIdleCallback === 'function') {
      this._prefetchIdle = window.requestIdleCallback(start, { timeout: 2000 });
    } else {
      this._prefetchTimer = setTimeout(start, 300);
    }
  }

  cancelPrefetchTimer() {
    if (this._prefetchTimer) { clearTimeout(this._prefetchTimer); this._prefetchTimer = null; }
    if (this._prefetchIdle && typeof window.cancelIdleCallback === 'function') {
      window.cancelIdleCallback(this._prefetchIdle);
    }
    this._prefetchIdle = 0;
    this._prefetchWant = -1;
  }

  async prefetchChapter(index) {
    if (!this.file || !this.chapters || index !== this.chapterIndex + 1) return;
    this.discardPrefetch();
    const comp = new Component();
    this.addChild(comp); // живой Component: дочерние рендереры (embeds) получат lifecycle
    const el = document.createElement('div'); // вне DOM — раскладка не считается, только парсинг
    const entry = { index, el, comp, file: this.file.path, ready: false };
    this._prefetch = entry;
    try {
      await MarkdownRenderer.render(this.app, this.chapters[index] || '', el, this.file.path, comp);
    } catch (e) { /* не критично: при переходе отрендерим обычным путём */ }
    // за время рендера ситуация могла смениться (другой файл/блок) — выбросить.
    // Если его уже выбросил discardPrefetch, второй раз удалять компонент нельзя
    if (this._prefetch !== entry) { if (!entry.gone) this.removeChild(comp); return; }
    entry.ready = true;
  }

  discardPrefetch() {
    this.cancelPrefetchTimer();
    if (this._prefetch) {
      this._prefetch.gone = true;
      this.removeChild(this._prefetch.comp);
      this._prefetch = null;
    }
  }

  /* ---------- measure & paginate (set content width AND column width together) ---------- */
  measure() {
    if (!this.content || !this.viewport) return;
    const s = this.plugin.settings;
    const vpW = this.viewport.clientWidth;
    if (!vpW) return;

    const gap = parseFloat(getComputedStyle(this.content).columnGap) || 0;

    const OUTER = 24;
    const avail = Math.max(120, vpW - OUTER * 2);

    let n = 1;
    if (s.pageMode === 'double') n = 2;
    else if (s.pageMode === 'auto' && Platform.isDesktop && vpW >= 820) n = 2;

    let pageW = (avail - gap * (n - 1)) / n;
    if (n === 2 && pageW < 260) { n = 1; pageW = avail; }
    const maxPage = s.maxPageWidth > 0 ? s.maxPageWidth : Infinity;
    if (pageW > maxPage) pageW = maxPage;

    const stageW = n * pageW + gap * (n - 1);

    this.stage.style.width = stageW + 'px';
    this.stage.classList.toggle('hr-two', n === 2);
    this.content.style.width = stageW + 'px';
    this.content.style.columnWidth = pageW + 'px';

    this.pageStride = stageW + gap;

    // чтение scrollWidth = принудительная раскладка колонок, самая дорогая
    // операция ридера. Заодно засекаем её: по этому времени плагин подбирает
    // размер блока под конкретную машину (см. blockTargets)
    const tLayout = performance.now();
    const sw = this.content.scrollWidth;
    this.plugin.noteLayoutRate(performance.now() - tLayout, this.chapterChars[this.chapterIndex] || 0);
    this.totalPages = Math.max(1, Math.round((sw + gap) / this.pageStride));
    this._measured = true;
    this.indexHeadingPages();

    // не финализируем восстановление позиции, пока грузятся картинки: они меняют
    // высоту и число страниц, поэтому долю/прыжок применяем заново после каждой догрузки
    const mediaLoading = Array.from(this.content.querySelectorAll('img')).some((im) => !im.complete);

    if (this._pendingFind) {
      // прыжок к найденному месту: ищем совпадение в отрисованном тексте, а если
      // разметка не дала его найти — падаем на долю по символам исходника
      const f = this._pendingFind;
      const r = this.findRangeInContent(f.query, f.ordinal);
      if (r) {
        this.page = this.pageOfRect(this.firstRect(r));
        if (!f.hl) { this.highlightRange(r); f.hl = true; }
      } else if (typeof f.fraction === 'number') {
        this.page = Math.round(f.fraction * (this.totalPages - 1));
      }
      if (!mediaLoading) this._pendingFind = null;
    } else if (this._pendingHeading) {
      // прыжок к заголовку (в т.ч. после загрузки главы из оглавления)
      const el = this.resolveHeadingEl(this._pendingHeading.index, this._pendingHeading.text);
      if (el) this.page = this.pageOfRect(el.getBoundingClientRect());
      if (!mediaLoading) this._pendingHeading = null;
    } else if (this._pendingFraction) {
      // отложенное восстановление доли — только после реального замера,
      // иначе доля умножалась бы на (totalPages-1)=0 и терялась
      this.page = Math.round(this._pendingFraction * (this.totalPages - 1));
      if (!mediaLoading) this._pendingFraction = 0;
    }
    if (this.page > this.totalPages - 1) this.page = this.totalPages - 1;
    if (this.page < 0) this.page = 0;
    if (!isFinite(this.page)) this.page = 0;

    // перепагинация и смена главы должны ПРЫГАТЬ, а не анимироваться — гасим переход
    // на момент применения; пользовательское листание (goTo) анимируется как прежде
    this.content.style.transition = 'none';
    this.applyTransform();
    void this.content.offsetWidth; // зафиксировать transform без анимации
    this.content.style.transition = this.plugin.settings.animate ? 'transform 0.2s ease' : 'none';

    this.updateStatus();
    this.savePos();

    // блок стабилен (позиция восстановлена, картинки на месте) — фоново готовим следующий
    if (!mediaLoading && !this._pendingHeading && !this._pendingFind && !this._pendingFraction) this.schedulePrefetch();
  }

  applyTransform() {
    if (this.content) {
      this.content.style.transform = 'translateX(' + (-this.page * this.pageStride) + 'px)';
    }
  }

  goTo(p) {
    const np = Math.max(0, Math.min(p, this.totalPages - 1));
    this.page = isFinite(np) ? np : 0;
    this.hideEnd();
    this.applyTransform();
    this.updateStatus();
    this.savePos();
    // подготовка следующего блока начинается ближе к концу текущего — проверяем
    // на каждом перелистывании (внутри дешёвые отсечки)
    this.schedulePrefetch();
  }

  // на весь текст сразу: Home/End в книге должны означать книгу, а не блок рендера
  // (в разрезанной книге End уводил в конец текущего блока — то есть в никуда)
  goToBookEdge(g) {
    if (!this.chapters) return;
    this.pushJump();
    this.goToG(g);
  }

  /* ---------- скорость чтения ---------- */
  // Замеряем по перелистываниям вперёд: сколько символов прочитано за сколько времени.
  // Отсюда берётся «сколько осталось» в строке состояния — своя скорость, а не средняя
  // по больнице. Прыжки (оглавление, поиск, перемотка) сбрасывают отсчёт
  noteReadStep() {
    const now = Date.now();
    const g = this.currentG();
    const prevT = this._speedAt, prevG = this._speedG;
    this._speedAt = now;
    this._speedG = g;
    if (!prevT || !this.totalChars) return;
    const dt = now - prevT;
    const chars = (g - prevG) * this.totalChars;
    // назад, прыжок, пролистывание глазами и «отошёл от телефона» — не чтение
    if (dt < 1200 || dt > 300000 || chars < 200 || chars > 20000) return;
    this.plugin.noteReadSpeed(chars, dt);
  }

  resetSpeedSample() { this._speedAt = 0; this._speedG = 0; }

  // «≈14 мин» до конца книги. Пока меньше минуты — не показываем: это шум
  timeLeftLabel() {
    if (!this.totalChars || !this._measured) return '';
    const rest = (1 - this.currentG()) * this.totalChars;
    const min = Math.round(rest / this.plugin.readingSpeed());
    if (min < 1) return '';
    if (min < 60) return '≈' + min + ' ' + t('unitMin');
    const h = Math.floor(min / 60), m = min % 60;
    return '≈' + h + ' ' + t('unitH') + (m && h < 10 ? ' ' + m + ' ' + t('unitMin') : '');
  }

  next() {
    this.noteReadStep();
    if (this.page < this.totalPages - 1) { this.goTo(this.page + 1); return; }
    // конец главы — перейти в начало следующей
    if (this.chapters && this.chapterIndex < this.chapters.length - 1) {
      this.savePos();
      this.renderChapter(this.chapterIndex + 1, { fraction: 0 });
      return;
    }
    this.showEnd();
  }
  prev() {
    if (this.page > 0) { this.goTo(this.page - 1); return; }
    // начало главы — перейти в КОНЕЦ предыдущей
    if (this.chapters && this.chapterIndex > 0) {
      this.savePos();
      this.renderChapter(this.chapterIndex - 1, { fraction: 1 });
    }
  }

  /* ---------- конец книги ---------- */
  // листать дальше некуда: вместо «ничего не произошло» — отбивка и выход из книги
  showEnd() {
    if (!this.viewport || this._endEl || !this.file) return;
    const box = this.viewport.createDiv('hr-end');
    this._endEl = box;
    box.createDiv({ cls: 'hr-end-title', text: t('endTitle') });
    const row = box.createDiv('hr-end-actions');
    const lib = row.createEl('button', { cls: 'mod-cta', text: t('endLibrary') });
    lib.addEventListener('click', () => { this.hideEnd(); this.plugin.openLibrary(); });
    // дочитал — обычно на этом чтение и заканчивается: закрыть ридер и вернуть
    // рабочее место в то положение, в каком оно было до книги
    row.createEl('button', { text: t('endExit') })
      .addEventListener('click', () => { this.hideEnd(); this.plugin.exitReader(this.leaf); });
    row.createEl('button', { text: t('endClose') })
      .addEventListener('click', () => this.hideEnd());
    // мимо кнопок — тоже закрыть: отбивка не должна мешать перечитывать последнюю страницу
    box.addEventListener('click', () => this.hideEnd());
  }

  hideEnd() {
    if (this._endEl) { this._endEl.remove(); this._endEl = null; }
  }

  /* ---------- возврат после прыжка ---------- */
  // откуда прыгнули по оглавлению / поиску / закладке — чтобы вернуться к чтению
  pushJump() {
    this.resetSpeedSample(); // прыжок — не чтение: следующий шаг мерить не от него
    if (!this._measured || !this.chapters) return;
    this._jumps.push(this.currentG());
    if (this._jumps.length > 20) this._jumps.shift();
  }

  canJumpBack() { return this._jumps.length > 0; }

  jumpBack() {
    if (!this._jumps.length) return;
    this.goToG(this._jumps.pop());
  }

  openAppearance() { new AppearanceModal(this.app, this.plugin).open(); }

  // щипок двумя пальцами: показать новый размер сразу, страницы пересчитает
  // общий дебаунс, а на диск сохраним по окончании жеста
  previewFontSize(v) {
    const size = Math.max(0.6, Math.min(2, Math.round(v * 20) / 20));
    if (size === this.plugin.settings.fontSize) return;
    this.plugin.settings.fontSize = size;
    this.plugin._dirty = true;
    if (this.content) this.content.style.setProperty('--hr-font-size', size + 'em');
    if (this._debouncedRemeasure) this._debouncedRemeasure();
  }

  /* ---------- table of contents ---------- */
  // весь список заголовков книги (построен при разбиении, а не из текущей отрисованной главы)
  getHeadings() { return this.toc || []; }

  openToc() {
    if (!this.toc || !this.toc.length) { new Notice(t('tocNone')); return; }
    new HeadingSuggestModal(this.app, this).open();
  }

  // переход по пункту оглавления: в текущей главе — сразу к элементу, иначе грузим нужную главу
  goToTocEntry(entry) {
    if (!entry || !this.chapters) return;
    this.pushJump();
    if (entry.chapter === this.chapterIndex) {
      const el = this.resolveHeadingEl(entry.hIndex, entry.text);
      if (el) this.goToHeading(el);
    } else {
      this.savePos();
      this.renderChapter(entry.chapter, { heading: { index: entry.hIndex, text: entry.text } });
    }
  }

  // заголовки САМОЙ заметки: без нашего служебного h1 и без заголовков из
  // встроенных заметок ![[…]] — в исходнике их нет, и они сбивали бы нумерацию
  headingEls() {
    if (!this.content) return [];
    return Array.from(this.content.querySelectorAll('h1, h2, h3, h4, h5, h6'))
      .filter((e) => !e.classList.contains('hr-title') && !e.closest('.markdown-embed'));
  }

  // на какой странице начинается каждый заголовок текущего блока. Считаем один раз
  // на замер: getBoundingClientRect по каждому заголовку — не то, что можно делать
  // на каждое перелистывание
  indexHeadingPages() {
    this._headPages = null;
    if (!this.toc || !this.toc.length || !this.content) return;
    const mine = [];
    for (let i = 0; i < this.toc.length; i++) if (this.toc[i].chapter === this.chapterIndex) mine.push(i);
    if (!mine.length) return;
    const els = this.headingEls();
    if (!els.length) return;
    // разметка совпала с исходником — берём по номеру; разошлась (HTML-заголовки,
    // плагины-рендереры) — ищем по тексту, как и при прыжке из оглавления
    const exact = els.length === mine.length;
    const out = [];
    mine.forEach((tocIndex, k) => {
      const entry = this.toc[tocIndex];
      const el = exact ? els[k] : this.resolveHeadingEl(entry.hIndex, entry.text);
      if (el) out.push({ page: this.pageOfRect(el.getBoundingClientRect()), toc: tocIndex });
    });
    out.sort((a, b) => a.page - b.page);
    this._headPages = out.length ? out : null;
  }

  // номер пункта оглавления, в котором мы сейчас: последний заголовок, начавшийся
  // не позже текущей страницы (-1, если до первого заголовка книги)
  currentTocIndex() {
    if (!this.toc || !this.toc.length) return -1;
    let idx = -1;
    if (this._headPages) {
      for (const h of this._headPages) { if (h.page > this.page) break; idx = h.toc; }
    }
    if (idx < 0) {
      // в этом блоке заголовков до текущей страницы не было — берём последний из прошлых
      for (let i = this.toc.length - 1; i >= 0; i--) {
        if (this.toc[i].chapter < this.chapterIndex) { idx = i; break; }
      }
    }
    return idx;
  }

  // подпись места для строки состояния. Короткий номер («IX») сам по себе ни о чём
  // не говорит — дополняем его ближайшим заголовком старшего уровня («Часть вторая · IX»)
  currentChapterLabel() {
    const idx = this.currentTocIndex();
    if (idx < 0) return '';
    const cur = this.toc[idx];
    let label = String(cur.text || '').trim();
    if (!label) return '';
    if (label.length <= 8) {
      for (let i = idx - 1; i >= 0; i--) {
        if (this.toc[i].level < cur.level) {
          const up = String(this.toc[i].text || '').trim();
          if (up) label = up + ' · ' + label;
          break;
        }
      }
    }
    return label.length > 48 ? label.slice(0, 47).trim() + '…' : label;
  }

  // элемент заголовка по номеру из оглавления. Номер — лишь подсказка: сначала ищем
  // совпадение по тексту (ближайшее к номеру), потому что DOM и исходник могут
  // разойтись — HTML-заголовки, плагины-рендереры и прочее
  resolveHeadingEl(index, text) {
    const els = this.headingEls();
    if (!els.length) return null;
    const want = normHeading(text);
    if (want) {
      let best = null, bestD = Infinity;
      for (let i = 0; i < els.length; i++) {
        if (normHeading(els[i].textContent) !== want) continue;
        const d = Math.abs(i - index);
        if (d < bestD) { bestD = d; best = els[i]; }
      }
      if (best) return best;
    }
    return els[index] || null;
  }

  /* ---------- переход по главам ---------- */
  // Шаг по ОГЛАВЛЕНИЮ, а не по блокам рендера: блок — это внутренняя единица разбиения
  // (их в томе может быть два десятка), а человек мыслит главами.
  // В стек «назад» не пишем: это обычное линейное чтение, а не прыжок
  stepChapter(dir) {
    if (!this.toc || !this.toc.length) { new Notice(t('noChapters')); return; }
    const cur = this.currentTocIndex();
    // вперёд — следующий пункт; назад — предыдущий, но если мы стоим не на самом
    // начале главы, первым шагом возвращаемся к её началу (как во всех читалках)
    let next;
    if (dir > 0) next = cur + 1;
    else next = this.atChapterStart(cur) ? cur - 1 : cur;
    if (next < 0 || next >= this.toc.length) return;
    const entry = this.toc[next];
    if (entry.chapter === this.chapterIndex) {
      const el = this.resolveHeadingEl(entry.hIndex, entry.text);
      if (el) this.goToHeading(el);
    } else {
      this.savePos();
      this.renderChapter(entry.chapter, { heading: { index: entry.hIndex, text: entry.text } });
    }
  }

  // стоим ли ровно на странице, с которой начинается глава idx
  atChapterStart(idx) {
    if (idx < 0 || !this._headPages) return false;
    return this._headPages.some((h) => h.toc === idx && h.page === this.page);
  }

  /* ---------- заметка в редакторе ---------- */
  // Читаешь свою заметку, видишь опечатку — и до сих пор её нечем было поправить:
  // приходилось искать файл руками. Открываем исходник на строке текущей главы
  openInEditor() {
    if (!this.file) return;
    const idx = this.currentTocIndex();
    const line = idx >= 0 && typeof this.toc[idx].line === 'number'
      ? this.bodyLine0 + this.toc[idx].line
      : 0;
    this.savePos();
    const leaf = this.app.workspace.getLeaf('tab');
    leaf.openFile(this.file, { eState: { line } });
  }

  /* ---------- navigation menu (главная точка входа: тап по проценту) ---------- */
  openNavMenu(evt) {
    const menu = new Menu();
    menu.addItem((i) => i.setTitle(t('menuToc')).setIcon('list').onClick(() => this.openToc()));
    menu.addItem((i) => i.setTitle(t('menuSearch')).setIcon('search').onClick(() => this.openSearch()));
    if (this.toc && this.toc.length) {
      menu.addItem((i) => i.setTitle(t('cmdPrevChapter')).setIcon('chevron-left').onClick(() => this.stepChapter(-1)));
      menu.addItem((i) => i.setTitle(t('cmdNextChapter')).setIcon('chevron-right').onClick(() => this.stepChapter(1)));
    }
    if (this.canJumpBack()) {
      menu.addItem((i) => i.setTitle(t('menuBack')).setIcon('arrow-left').onClick(() => this.jumpBack()));
    }
    menu.addSeparator();
    menu.addItem((i) => i.setTitle(t('menuAppearance')).setIcon('type').onClick(() => this.openAppearance()));
    // в иммерсивном режиме это единственная дорога наружу: шапка вкладки спрятана,
    // а на телефоне спрятана и нижняя панель Obsidian
    menu.addItem((i) => i.setTitle(t('menuLibrary')).setIcon('book-open').onClick(() => this.plugin.openLibrary()));
    menu.addItem((i) => i.setTitle(t('menuEdit')).setIcon('pencil').onClick(() => this.openInEditor()));
    menu.addSeparator();
    const here = this.bookmarkOnPage();
    menu.addItem((i) => i
      .setTitle(here ? t('menuBmRemove') : t('menuBmAdd'))
      .setIcon(here ? 'bookmark-minus' : 'bookmark-plus')
      .onClick(() => this.toggleBookmark()));
    menu.addItem((i) => i.setTitle(t('menuBmList')).setIcon('bookmark').onClick(() => this.openBookmarks()));
    if (Platform.isDesktop) {
      menu.addSeparator();
      const doc = this.contentEl.ownerDocument;
      const fs = this.plugin.isFullscreen(doc);
      menu.addItem((i) => i
        .setTitle(fs ? t('menuFsOff') : t('menuFsOn'))
        .setIcon(fs ? 'minimize' : 'maximize')
        .onClick(() => this.plugin.toggleFullscreen(doc)));
    }
    menu.addSeparator();
    menu.addItem((i) => i.setTitle(t('menuExit')).setIcon('log-out')
      .onClick(() => this.plugin.exitReader(this.leaf)));
    menu.showAtMouseEvent(evt);
  }

  /* ---------- search across the whole book ---------- */
  openSearch() {
    if (!this.chapters) return;
    new BookSearchModal(this.app, this).open();
  }

  // блок в нижнем регистре. Лениво, по одному: у книги это мегабайты, а поиск
  // обычно упирается в лимит совпадений задолго до конца текста
  lowerChapter(i) {
    const path = this.file ? this.file.path : '';
    if (!this._searchIndex || this._searchIndex.path !== path) this._searchIndex = { path, low: [] };
    const low = this._searchIndex.low;
    if (low[i] === undefined) low[i] = String(this.chapters[i] || '').toLowerCase();
    return low[i];
  }

  // ищем по ИСХОДНОМУ markdown всех блоков: так находки есть и в неотрисованных
  // частях книги. Номер вхождения внутри блока (ordinal) потом ищется уже в DOM
  searchBook(query) {
    const q = String(query || '').trim().toLowerCase();
    const out = [];
    if (q.length < 2 || !this.chapters) return out;
    const LIMIT = 200;
    const clean = (s) => s.replace(/\s+/g, ' ');
    for (let ch = 0; ch < this.chapters.length && out.length < LIMIT; ch++) {
      const hay = this.lowerChapter(ch);
      const src = this.chapters[ch];
      let idx = hay.indexOf(q);
      let ord = 0;
      while (idx >= 0 && out.length < LIMIT) {
        const from = Math.max(0, idx - 40);
        const to = Math.min(src.length, idx + q.length + 70);
        const frac = src.length ? idx / src.length : 0;
        const g = this.totalChars > 0
          ? ((this.charsBefore[ch] || 0) + frac * (this.chapterChars[ch] || 0)) / this.totalChars
          : frac;
        out.push({
          q, chapter: ch, ordinal: ord, fraction: frac,
          before: (from > 0 ? '…' : '') + clean(src.slice(from, idx)),
          match: src.substr(idx, q.length),
          after: clean(src.slice(idx + q.length, to)) + (to < src.length ? '…' : ''),
          pct: Math.round(g * 100),
        });
        ord++;
        idx = hay.indexOf(q, idx + q.length);
      }
    }
    return out;
  }

  goToHit(hit) {
    if (!hit || !this.chapters) return;
    this.pushJump();
    const find = { query: hit.q, ordinal: hit.ordinal, fraction: hit.fraction };
    if (hit.chapter !== this.chapterIndex) {
      this.savePos();
      this.renderChapter(hit.chapter, { find });
      return;
    }
    this.clearHighlight();
    const r = this.findRangeInContent(find.query, find.ordinal);
    if (r) {
      const p = this.pageOfRect(this.firstRect(r));
      this.highlightRange(r);
      this.goTo(p);
    } else {
      this.goTo(Math.round(find.fraction * (this.totalPages - 1)));
    }
  }

  // ordinal-е вхождение запроса в тексте отрисованной главы -> Range.
  // Нумерация вхождений в исходнике и в DOM может разойтись (разметка, экранирование),
  // поэтому у вызывающего всегда есть запасной путь через долю по символам
  findRangeInContent(query, ordinal) {
    const q = String(query || '').toLowerCase();
    if (!q || !this.content) return null;
    const doc = this.content.ownerDocument || document;
    const walker = doc.createTreeWalker(this.content, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let text = '';
    let n;
    while ((n = walker.nextNode())) {
      // пропускаем то, чего нет в исходнике блока: наш служебный заголовок и текст
      // встроенных заметок ![[…]] — иначе номер вхождения разошёлся бы с поиском
      const p = n.parentElement;
      if (p && (p.closest('.hr-title') || p.closest('.markdown-embed'))) continue;
      nodes.push({ node: n, start: text.length });
      text += n.nodeValue;
    }
    // шагаем БЕЗ перекрытий — ровно так же, как searchBook нумерует вхождения в исходнике
    const hay = text.toLowerCase();
    let idx = hay.indexOf(q);
    for (let k = 0; k < ordinal && idx >= 0; k++) idx = hay.indexOf(q, idx + q.length);
    if (idx < 0) return null;
    const locate = (pos) => {
      for (let i = nodes.length - 1; i >= 0; i--) {
        if (nodes[i].start <= pos) return { node: nodes[i].node, offset: pos - nodes[i].start };
      }
      return null;
    };
    const a = locate(idx);
    const b = locate(idx + q.length - 1);
    if (!a || !b) return null;
    try {
      const r = doc.createRange();
      r.setStart(a.node, a.offset);
      r.setEnd(b.node, b.offset + 1);
      return r;
    } catch (e) { return null; }
  }

  highlightRange(range) {
    try {
      const span = (this.content.ownerDocument || document).createElement('span');
      span.className = 'hr-hit';
      range.surroundContents(span); // бросит исключение, если совпадение разорвано разметкой
    } catch (e) { /* без подсветки — страница всё равно нужная */ }
  }

  clearHighlight() {
    if (!this.content) return;
    this.content.querySelectorAll('.hr-hit').forEach((el) => {
      const p = el.parentNode;
      if (!p) return;
      while (el.firstChild) p.insertBefore(el.firstChild, el);
      p.removeChild(el);
      p.normalize();
    });
  }

  /* ---------- bookmarks ---------- */
  // храним рядом с позицией: [{g, label, t}], g — та же глобальная доля книги,
  // поэтому закладка одинаково находится и на ПК, и на телефоне
  bookmarks() {
    const rec = this.file && this.plugin.db[this.file.path];
    return (rec && Array.isArray(rec.b)) ? rec.b : [];
  }

  setBookmarks(list) {
    if (!this.file) return;
    const rec = Object.assign({}, this.plugin.db[this.file.path]);
    if (list && list.length) rec.b = list; else delete rec.b;
    this.plugin.db[this.file.path] = rec;
    this.plugin._dirty = true;
  }

  // страница текущего блока, на которую попадает доля g (null — доля в другом блоке)
  gToPage(g) {
    if (!this.chapters) return null;
    const at = this.blockForG(g);
    if (at.chapter !== this.chapterIndex) return null;
    return Math.round(at.within * (this.totalPages - 1));
  }

  bookmarkOnPage() {
    if (!this._measured) return null;
    return this.bookmarks().find((b) => this.gToPage(b.g) === this.page) || null;
  }

  // подпись закладки — начало текста текущей страницы
  pageLabel() {
    if (!this.content || !this.pageStride) return '';
    const kids = this.content.children;
    let fallback = '';
    for (let i = 0; i < kids.length; i++) {
      const p = this.pageOfRect(kids[i].getBoundingClientRect());
      if (p > this.page) break;
      const s = (kids[i].textContent || '').replace(/\s+/g, ' ').trim();
      if (!s) continue;
      if (p === this.page) return s.slice(0, 90);
      fallback = s; // абзац начался раньше и накрывает эту страницу
    }
    return fallback.slice(0, 90);
  }

  toggleBookmark() {
    if (!this.file || !this._measured) return;
    const list = this.bookmarks().slice();
    const here = list.findIndex((b) => this.gToPage(b.g) === this.page);
    if (here >= 0) {
      list.splice(here, 1);
      new Notice(t('bmRemoved'));
    } else {
      list.push({ g: this.currentG(), label: this.pageLabel(), t: Date.now() });
      list.sort((a, b) => a.g - b.g);
      new Notice(t('bmAdded'));
    }
    this.setBookmarks(list);
    this.updateStatus();
  }

  removeBookmark(bm) {
    this.setBookmarks(this.bookmarks().filter((b) => b !== bm));
    this.updateStatus();
  }

  openBookmarks() {
    if (!this.bookmarks().length) { new Notice(t('bmNone')); return; }
    new BookmarkSuggestModal(this.app, this).open();
  }

  // перейти к глобальной доле книги (закладка): внутри блока — просто листаем
  goToG(g) {
    if (!this.chapters) return;
    const p = this.gToPage(g);
    if (p != null) { this.goTo(p); return; }
    const at = this.blockForG(g);
    this.savePos();
    this.renderChapter(at.chapter, { fraction: at.within });
  }

  goToHeading(el) {
    if (!el || !this.content || !this.pageStride) return;
    this.goTo(this.pageOfRect(el.getBoundingClientRect()));
  }

  // номер страницы, на которой лежит прямоугольник. Смещение в колоночном потоке =
  // разница левых краёв (общий transform сокращается, поэтому работает и во время
  // анимации листания, и на развороте). floor+epsilon: колонка чётного индекса
  // начинает разворот, нечётная — та же страница
  pageOfRect(rect) {
    if (!rect || !this.content || !this.pageStride) return this.page;
    const offset = rect.left - this.content.getBoundingClientRect().left;
    const p = Math.floor(offset / this.pageStride + 0.001);
    return isFinite(p) ? p : 0;
  }

  // первый фрагмент диапазона: у разорванного переносом совпадения getBoundingClientRect
  // вернул бы объединение по всем строкам — и левый край уехал бы на чужую колонку
  firstRect(range) {
    const rects = range.getClientRects();
    return rects.length ? rects[0] : range.getBoundingClientRect();
  }

  updateStatus() {
    if (this._scrub) return; // идёт перемотка: в строке состояния сейчас предпросмотр
    // доля внутри главы (0% на первой странице главы, 100% на последней)
    const withinFrac = this.totalPages > 1 ? this.page / (this.totalPages - 1) : 1;
    const multi = this.chapters && this.chapters.length > 1;
    // для книги — доля по ВСЕМУ тексту (по символам), чтобы % шёл через всю книгу
    let frac = withinFrac;
    if (multi && this.totalChars > 0) {
      const before = this.charsBefore[this.chapterIndex] || 0;
      const chars = this.chapterChars[this.chapterIndex] || 0;
      frac = (before + withinFrac * chars) / this.totalChars;
    }
    const pct = Math.round(frac * 100);
    if (this._statusEls) {
      // книга (много блоков) — только общий % (номер блока — деталь реализации, не «глава»);
      // обычная заметка — как раньше, «страница / всего · %».
      // Правим текст в готовых узлах: строка состояния обновляется на КАЖДОМ
      // листании, и пересборка трёх элементов каждый раз — лишняя работа
      const e = this._statusEls;
      const base = multi ? pct + '%' : ((this.page + 1) + ' / ' + this.totalPages + ' · ' + pct + '%');
      const bm = this.bookmarkOnPage() ? '🔖' : '';
      const label = this.currentChapterLabel();
      const left = this.timeLeftLabel();
      if (e.bm.textContent !== bm) e.bm.textContent = bm;
      if (e.chapter.textContent !== label) e.chapter.textContent = label;
      if (e.pos.textContent !== base) e.pos.textContent = base;
      if (e.left.textContent !== left) e.left.textContent = left;
    }
    // scaleX, а не width: ширина — свойство раскладки, и её переход заставлял
    // браузер пересчитывать полосу все 200 мс каждого листания
    if (this.progressFill) this.progressFill.style.transform = 'scaleX(' + frac + ')';
  }

  savePos() {
    const s = this.plugin.settings;
    if (!s.rememberPosition || !this.file) return;
    // не сохранять, пока вьюпорт не измерен: до первого замера totalPages=1/page=0,
    // и запись затёрла бы реальную закладку нулём при быстром закрытии/переключении
    if (!this._measured) return;
    // позиция ещё восстанавливается (ждём догрузки картинок) — не затирать сохранённую
    if (this._pendingFraction || this._pendingHeading || this._pendingFind) return;
    // g — глобальная доля по всей книге (взвешенно по символам): не зависит от
    // разбиения на блоки, поэтому позиция совпадает на ПК и телефоне,
    // хотя блоки у них разного размера.
    // t — время последнего чтения; по нему сортируется библиотека.
    // b — закладки: переносим, а легаси-поля (fraction/chapter) осознанно теряем
    const prev = this.plugin.db[this.file.path];
    const rec = { g: this.currentG(), t: Date.now() };
    if (prev && Array.isArray(prev.b) && prev.b.length) rec.b = prev.b;
    this.plugin.db[this.file.path] = rec;
    this.plugin._dirty = true;
  }

  applySettings() {
    const s = this.plugin.settings;
    const c = this.content;
    if (!c) return;
    // ЧИТАЕМ до всех записей стилей. Обе величины от наших стилей не зависят
    // (высота строки состояния и шрифт вьюпорта — от темы), а чтение после
    // записи заставляло браузер считать раскладку лишний раз: раньше каждый
    // пересчёт страниц стоил двух проходов вместо одного
    const barH = this.statusBar ? this.statusBar.offsetHeight : 0;
    const rootPx = this.viewport ? (parseFloat(getComputedStyle(this.viewport).fontSize) || 16) : 16;
    // шрифт чтения: пусто — берём шрифт темы (переменная просто не задана)
    const ff = s.fontFamily === 'custom' ? (s.fontFamilyCustom || '').trim() : (READING_FONTS[s.fontFamily] || '');
    if (ff) c.style.setProperty('--hr-font-family', ff);
    else c.style.removeProperty('--hr-font-family');
    // тонировка: класс на вьюпорте переопределяет переменные темы ЛОКАЛЬНО,
    // поэтому за цветами тянется всё внутри — фон, текст, полоса прогресса
    const vp = this.viewport;
    if (vp) {
      TINTS.forEach((n) => vp.classList.remove('hr-tint-' + n));
      const tint = TINTS.includes(s.tint) ? s.tint : '';
      vp.classList.toggle('hr-tinted', !!tint);
      if (tint) vp.classList.add('hr-tint-' + tint);
    }
    if (this.dimmer) {
      const b = Math.max(20, Math.min(100, typeof s.brightness === 'number' ? s.brightness : 100));
      this.dimmer.style.opacity = String((100 - b) / 100);
    }
    c.style.setProperty('--hr-font-size', s.fontSize + 'em');
    c.style.setProperty('--hr-line-height', String(s.lineHeight));
    c.style.setProperty('--hr-col-gap', s.columnGap + 'em');
    c.style.transition = s.animate ? 'transform 0.2s ease' : 'none';
    // вертикальные поля страницы: задаём инлайн, чтобы перебить и базовое правило,
    // и мобильный оверрайд; снизу +0.6em, чтобы последняя строка не липла к строке статуса
    const padY = (typeof s.verticalPadding === 'number') ? s.verticalPadding : 1.4;
    c.style.paddingTop = padY + 'em';
    // нижний отступ НЕ меньше фактической высоты строки статуса: она лежит поверх
    // страницы, и при малом значении ползунка последняя строка пряталась под
    // полосой прогресса. Высоту меряем, а не хардкодим — она зависит от шрифта темы
    let bottomEm = padY + 0.6;
    if (barH > 0) {
      // em страницы = шрифт вьюпорта, умноженный на наш множитель (--hr-font-size)
      const emPx = rootPx * (typeof s.fontSize === 'number' ? s.fontSize : 1);
      const minEm = emPx > 0 ? (barH + 4) / emPx : 0;
      if (minEm > bottomEm) bottomEm = minEm;
    }
    c.style.paddingBottom = bottomEm + 'em';
    // выравнивание по ширине + переносы. Язык берём у САМОГО текста, а не у интерфейса:
    // от него зависят правила переноса, и книга не обязана быть на языке Obsidian
    c.classList.toggle('hr-justify', !!s.justify);
    c.setAttribute('lang', this.textLang || APP_LANG);
  }

  /* ---------- перемотка по полосе прогресса ---------- */
  // Полоса была чисто декоративной, и «пролистнуть примерно на середину» было нечем:
  // только оглавление, поиск и закладки. Теперь по ней тянут, как в любой читалке,
  // а над пальцем видно, куда попадёшь — процент и название главы
  setupScrub() {
    const el = this.scrubEl;
    if (!el) return;
    const fracAt = (clientX) => {
      const r = this.progress.getBoundingClientRect();
      if (!r.width) return 0;
      return Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    };
    const preview = (g) => {
      if (this.progressFill) this.progressFill.style.transform = 'scaleX(' + g + ')';
      const e = this._statusEls;
      if (!e) return;
      e.bm.textContent = '';
      e.chapter.textContent = this.chapterAtG(g);
      e.pos.textContent = Math.round(g * 100) + '%';
      e.left.textContent = '';
    };
    this.registerDomEvent(el, 'pointerdown', (e) => {
      if (!this.chapters || e.button > 0) return;
      e.preventDefault();
      e.stopPropagation();
      this._scrub = { id: e.pointerId, g: fracAt(e.clientX) };
      // класс, а не :active — preventDefault выше гасит и его тоже
      el.addClass('is-scrubbing');
      try { if (el.setPointerCapture) el.setPointerCapture(e.pointerId); } catch (err) { /* без захвата тоже работает */ }
      this.hideEnd();
      preview(this._scrub.g);
    });
    this.registerDomEvent(el, 'pointermove', (e) => {
      if (!this._scrub || e.pointerId !== this._scrub.id) return;
      e.preventDefault();
      this._scrub.g = fracAt(e.clientX);
      preview(this._scrub.g);
    });
    this.registerDomEvent(el, 'pointerup', (e) => {
      if (!this._scrub || e.pointerId !== this._scrub.id) return;
      const g = this._scrub.g;
      this._scrub = null;
      el.removeClass('is-scrubbing');
      // за отпусканием пальца прилетит синтетический click по вьюпорту — он не должен
      // сойти за тап по зоне листания
      this._lastTouch = Date.now();
      // прыжок кладём в стек «назад»: промахнуться по трёхпиксельной полосе легко,
      // и вернуться к чтению должно быть одним движением
      this.pushJump();
      this.goToG(g);
      this.updateStatus();
    });
    this.registerDomEvent(el, 'pointercancel', (e) => {
      if (!this._scrub || e.pointerId !== this._scrub.id) return;
      this._scrub = null;
      el.removeClass('is-scrubbing');
      this.updateStatus();
    });
  }

  // название главы, в которую попадает доля g — подпись для перемотки.
  // Точность блока рендера: внутри блока может лежать несколько глав, берём первую
  chapterAtG(g) {
    if (!this.toc || !this.toc.length) return '';
    const ch = this.blockForG(g).chapter;
    let idx = -1;
    for (let i = 0; i < this.toc.length; i++) { if (this.toc[i].chapter > ch) break; idx = i; }
    if (idx < 0) return '';
    const s = String(this.toc[idx].text || '').trim();
    return s.length > 40 ? s.slice(0, 39).trim() + '…' : s;
  }

  /* ---------- заметку поправили снаружи ---------- */
  // Читаешь свою заметку, правишь её в соседней вкладке — ридер должен догнать.
  // Ждём паузы в наборе: перерисовывать книгу на каждое нажатие клавиши немыслимо
  scheduleReload() {
    if (this._reloadTimer) clearTimeout(this._reloadTimer);
    this._reloadTimer = setTimeout(() => {
      this._reloadTimer = null;
      if (!this.file || !this.content || !this.content.isConnected) return;
      // держимся за место долей книги, а не страницей: текст изменился, страницы поедут.
      // Через _keepG, а не через сохранённую позицию: «запоминать позицию» может быть выключено
      this._keepG = this._measured ? this.currentG() : null;
      this.renderFile();
    }, 900);
  }

  setupRepagination() {
    const repaginate = () => {
      if (this._repaginateTimer) clearTimeout(this._repaginateTimer);
      this._repaginateTimer = setTimeout(() => {
        this._repaginateTimer = null;
        if (!this.content || !this.content.isConnected) return;
        // поля зависят от размера шрифта и высоты строки статуса — пересчитать
        // перед замером (срабатывает и на смену темы: css-change ведёт сюда)
        this.applySettings();
        // позиция ещё не восстановлена (первый успешный замер после нулевой ширины) —
        // пусть measure() применит долю/прыжок к заголовку, не перетирая их текущим page=0
        if (this._pendingFraction || this._pendingHeading || this._pendingFind) { this.measure(); return; }
        const frac = this.totalPages > 1 ? this.page / (this.totalPages - 1) : 0;
        this.measure();
        this.page = Math.max(0, Math.min(Math.round(frac * (this.totalPages - 1)), this.totalPages - 1));
        if (!isFinite(this.page)) this.page = 0;
        this.applyTransform();
        this.updateStatus();
        // measure() сохранился с промежуточной страницей (её ещё не пересчитали
        // из доли) — перезаписать позицию окончательной
        this.savePos();
      }, 150);
    };
    this._debouncedRemeasure = repaginate;
    this.ro = new ResizeObserver(repaginate);
    this.ro.observe(this.viewport);
    this.registerEvent(this.app.workspace.on('css-change', repaginate));
    this.registerEvent(this.app.workspace.on('resize', repaginate));
  }

  toggleControls() {
    if (this.plugin.settings.immersive) {
      const doc = (this.contentEl && this.contentEl.ownerDocument) || document;
      const hidden = doc.body.classList.toggle('hr-chrome-hidden');
      // выбор запоминаем: иначе уход на соседнюю вкладку и обратно снова прятал бы хром
      this.plugin._chromeShown = !hidden;
    } else if (this.viewport) {
      this.viewport.classList.toggle('hr-hide-ui');
    }
  }

  // спрятано ли сейчас хоть что-то из интерфейса (иммерсив, полный экран, наши контролы)
  chromeHidden() {
    const doc = (this.contentEl && this.contentEl.ownerDocument) || document;
    if (doc.body && doc.body.classList.contains('hr-chrome-hidden')) return true;
    if (this.viewport && this.viewport.classList.contains('hr-hide-ui')) return true;
    return this.plugin ? this.plugin.isFullscreen(doc) : false;
  }

  // Escape в два шага: первый возвращает интерфейс (и книга остаётся открытой),
  // второй выходит из чтения совсем. Так «случайный Esc» ничего не теряет,
  // а выйти всё равно можно не глядя
  onEscape() {
    if (this.chromeHidden()) { this.exitReadingChrome(); return; }
    if (this.plugin) this.plugin.exitReader(this.leaf);
  }

  exitReadingChrome() {
    // Esc: «дочитал» — вернуть весь интерфейс (полный экран + боковые панели +
    // хром Obsidian + наши контролы)
    const doc = (this.contentEl && this.contentEl.ownerDocument) || document;
    if (this.plugin) this.plugin.setFullscreen(doc, false);
    doc.body.classList.remove('hr-immersive', 'hr-chrome-hidden');
    if (this.plugin) {
      this.plugin._chromeShown = true; // показали руками — сам больше не прячется
      if (this.plugin._immersiveDoc === doc) this.plugin._immersiveDoc = null;
      if (this.plugin.restoreSidebars) this.plugin.restoreSidebars();
    }
    if (this.viewport) this.viewport.classList.remove('hr-hide-ui');
  }

  buildScope() {
    const s = new Scope(this.app.scope);
    const reg = (mods, key, fn) => s.register(mods, key, () => { fn(); return false; });
    reg([], 'ArrowRight', () => this.next());
    reg([], 'ArrowLeft', () => this.prev());
    reg([], 'PageDown', () => this.next());
    reg([], 'PageUp', () => this.prev());
    reg([], ' ', () => this.next());
    reg(['Shift'], ' ', () => this.prev());
    reg(['Shift'], 'ArrowRight', () => this.stepChapter(1));
    reg(['Shift'], 'ArrowLeft', () => this.stepChapter(-1));
    // Home/End — по всей КНИГЕ. Раньше они листали текущий блок рендера, то есть
    // «в конец» уводило в случайное место где-то в первой трети тома
    reg([], 'Home', () => this.goToBookEdge(0));
    reg([], 'End', () => this.goToBookEdge(1));
    reg([], 'Escape', () => this.onEscape());
    reg([], 'Backspace', () => this.jumpBack());
    reg(['Alt'], 'ArrowLeft', () => this.jumpBack());
    reg(['Mod'], 'f', () => this.openSearch());
    reg(['Mod'], 'b', () => this.toggleBookmark());
    // размер шрифта страницы вместо масштаба всего окна: пока читаешь, нужен именно он
    reg(['Mod'], '=', () => this.plugin.stepFontSize(1));
    reg(['Mod'], '+', () => this.plugin.stepFontSize(1));          // цифровой блок
    reg(['Mod', 'Shift'], '+', () => this.plugin.stepFontSize(1)); // основной ряд: + это Shift+=
    reg(['Mod'], '-', () => this.plugin.stepFontSize(-1));
    this._scope = s;
    this._scopePushed = false;
  }
  pushScope() {
    if (this._scope && !this._scopePushed) {
      this.app.keymap.pushScope(this._scope);
      this._scopePushed = true;
    }
  }
  popScope() {
    if (this._scope && this._scopePushed) {
      this.app.keymap.popScope(this._scope);
      this._scopePushed = false;
    }
  }

  /* ---------- input: touch / click / wheel ---------- */
  setupInput() {
    const vp = this.viewport;
    // OS_EDGE only leaves the OS back-gesture sliver alone; Obsidian's drawer zone
    // is handled by data-ignore-swipe + capture-phase stopPropagation.
    const OS_EDGE = 12, SWIPE = 45, CLAIM = 6, TAP_MOVE = 10, TAP_MS = 300;
    let x0 = 0, y0 = 0, t0 = 0, dragging = false, decided = false, horizontal = false;
    let pinch = null; // {d0, base} — щипок меняет размер шрифта, а не масштаб окна

    const abortDrag = () => {
      if (dragging) {
        dragging = false; decided = false; horizontal = false;
        this.content.style.transition = this.plugin.settings.animate ? 'transform 0.2s ease' : 'none';
        this.applyTransform();
      }
    };

    const interactive = (tg) => !!(tg && tg.closest && tg.closest(
      'a, input, button, textarea, select, [contenteditable], .task-list-item-checkbox, .callout-fold, .footnote-link, audio, video, .hr-ui, .hr-end'
    ));

    this.registerDomEvent(vp, 'touchstart', (e) => {
      if (e.touches.length === 2) {
        abortDrag();
        pinch = { d0: touchDist(e.touches), base: this.plugin.settings.fontSize };
        return;
      }
      if (e.touches.length !== 1) { abortDrag(); return; }
      // палец лёг на полосу перемотки — тянут её, а не страницу
      if (e.target && e.target.closest && e.target.closest('.hr-scrub')) { abortDrag(); return; }
      const tc = e.touches[0];
      const win = (vp.ownerDocument && vp.ownerDocument.defaultView) || window;
      if (Math.min(tc.clientX, win.innerWidth - tc.clientX) < OS_EDGE) { abortDrag(); return; }
      x0 = tc.clientX; y0 = tc.clientY; t0 = Date.now();
      dragging = true; decided = false; horizontal = false;
      this.content.style.transition = 'none';
    }, { capture: true, passive: true });

    this.registerDomEvent(vp, 'touchmove', (e) => {
      if (pinch) {
        if (e.touches.length < 2) return;
        e.stopPropagation();
        e.preventDefault();
        if (pinch.d0 > 0) this.previewFontSize(pinch.base * (touchDist(e.touches) / pinch.d0));
        return;
      }
      if (!dragging) return;
      const tc = e.touches[0];
      const dx = tc.clientX - x0, dy = tc.clientY - y0;
      if (!decided) {
        if (Math.abs(dx) < CLAIM && Math.abs(dy) < CLAIM) return;
        if (Math.abs(dy) > Math.abs(dx)) { dragging = false; return; }
        decided = true; horizontal = true;
      }
      if (horizontal) {
        e.stopPropagation();
        e.preventDefault();
        this.content.style.transform = 'translateX(' + (-this.page * this.pageStride + dx) + 'px)';
      }
    }, { capture: true, passive: false });

    const endTouch = (e) => {
      if (pinch) {
        // палец оторвали — жест кончился, теперь можно сохранить размер на диск
        if (e.touches.length < 2) { pinch = null; this._lastTouch = Date.now(); this.plugin.commitFontSize(); }
        return;
      }
      if (!dragging) return;
      dragging = false;
      this._lastTouch = Date.now();
      this.content.style.transition = this.plugin.settings.animate ? 'transform 0.2s ease' : 'none';
      const tc = e.changedTouches[0];
      const dx = tc.clientX - x0, dy = tc.clientY - y0, dt = Date.now() - t0;

      if (Math.abs(dx) < TAP_MOVE && Math.abs(dy) < TAP_MOVE && dt < TAP_MS) {
        decided = false; horizontal = false;
        if (interactive(e.target)) { this.applyTransform(); return; }
        if (!this.plugin.settings.tapZones) { this.applyTransform(); return; }
        const r = vp.getBoundingClientRect();
        const x = tc.clientX - r.left, w = vp.clientWidth;
        if (x < w * 0.3) this.prev();
        else if (x > w * 0.7) this.next();
        else this.toggleControls();
        return;
      }
      if (horizontal && Math.abs(dx) >= SWIPE && Math.abs(dx) > Math.abs(dy) * 1.5) {
        if (dx < 0) this.next(); else this.prev();
      } else {
        this.applyTransform();
      }
      decided = false; horizontal = false;
    };
    this.registerDomEvent(vp, 'touchend', endTouch, { capture: true, passive: true });
    this.registerDomEvent(vp, 'touchcancel', () => { pinch = null; abortDrag(); }, { capture: true, passive: true });

    // мышью по странице ещё и ВЫДЕЛЯЮТ текст: клик в конце протяжки не должен
    // листать (иначе выделил цитату — и уехал со страницы)
    let downX = 0, downY = 0;
    this.registerDomEvent(vp, 'mousedown', (e) => { downX = e.clientX; downY = e.clientY; });

    this.registerDomEvent(vp, 'click', (e) => {
      if (this._lastTouch && Date.now() - this._lastTouch < 700) return;
      if (interactive(e.target)) return;
      if (!this.plugin.settings.tapZones) return;
      if (e.detail > 1) return; // двойной/тройной клик — это выделение слова или абзаца
      if (Math.abs(e.clientX - downX) > 6 || Math.abs(e.clientY - downY) > 6) return;
      const sel = (vp.ownerDocument || document).getSelection();
      if (sel && !sel.isCollapsed && sel.anchorNode && vp.contains(sel.anchorNode)) return;
      const r = vp.getBoundingClientRect();
      const x = e.clientX - r.left, w = vp.clientWidth;
      if (x < w * 0.3) this.prev();
      else if (x > w * 0.7) this.next();
      else this.toggleControls();
    });

    // A/D — то же самое, что стрелки. Ловим по e.code, а не через Scope по key:
    // на русской раскладке key будет «ф» и «в», а code остаётся KeyA/KeyD
    this.registerDomEvent(vp, 'keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      if (e.code !== 'KeyA' && e.code !== 'KeyD') return;
      e.preventDefault();
      e.stopPropagation();
      if (e.code === 'KeyA') this.prev(); else this.next();
    });

    if (Platform.isDesktop) {
      let wheelLock = false;
      this.registerDomEvent(vp, 'wheel', (e) => {
        const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        if (Math.abs(d) < 20) return;
        e.preventDefault();
        if (wheelLock) return;
        wheelLock = true;
        // ровно столько, чтобы одна прокрутка колеса не улистнула три страницы;
        // больше — и листание колесом само по себе кажется тормозящим
        setTimeout(() => { wheelLock = false; }, 200);
        if (d > 0) this.next(); else this.prev();
      }, { passive: false });
    }
  }
}

/* ============================================================
   Settings
   ============================================================ */
class ReaderSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();

    const save = async () => {
      await this.plugin.saveAll();
      this.plugin.refreshOpenViews();
    };
    // ползунки: onChange на каждый шаг, поэтому запись на диск откладываем
    // общему автосохранению — иначе одна протяжка = десятки записей data.json
    const live = () => this.plugin.queueSave();
    // разделы вместо сплошного списка: настроек два десятка, и половина из них
    // про одно и то же (геометрия страницы / текст / цвет / поведение)
    const section = (key) => new Setting(containerEl).setName(t(key)).setHeading();

    section('sSecPage');

    new Setting(containerEl)
      .setName(t('sPageMode'))
      .setDesc(t('sPageModeDesc'))
      .addDropdown((d) => d.addOptions({
        'auto': t('optAuto'),
        'single': t('optSingle'),
        'double': t('optDouble'),
      }).setValue(this.plugin.settings.pageMode)
        .onChange(async (v) => { this.plugin.settings.pageMode = v; await save(); }));

    new Setting(containerEl)
      .setName(t('sMaxWidth'))
      .setDesc(t('sMaxWidthDesc'))
      .addSlider((sl) => sl.setLimits(0, 1000, 20).setValue(this.plugin.settings.maxPageWidth)
        .setDynamicTooltip().onChange((v) => { this.plugin.settings.maxPageWidth = v; live(); }));

    new Setting(containerEl)
      .setName(t('sGap'))
      .addSlider((sl) => sl.setLimits(0.5, 5, 0.25).setValue(this.plugin.settings.columnGap)
        .setDynamicTooltip().onChange((v) => { this.plugin.settings.columnGap = v; live(); }));

    new Setting(containerEl)
      .setName(t('sPadding'))
      .setDesc(t('sPaddingDesc'))
      .addSlider((sl) => sl.setLimits(0, 4, 0.1).setValue(this.plugin.settings.verticalPadding)
        .setDynamicTooltip().onChange((v) => { this.plugin.settings.verticalPadding = v; live(); }));

    section('sSecText');

    new Setting(containerEl)
      .setName(t('sFontSize'))
      .setDesc(t('sFontSizeDesc'))
      .addSlider((sl) => sl.setLimits(0.6, 2.0, 0.05).setValue(this.plugin.settings.fontSize)
        .setDynamicTooltip().onChange((v) => { this.plugin.settings.fontSize = v; live(); }));

    new Setting(containerEl)
      .setName(t('sFontFamily'))
      .setDesc(t('sFontFamilyDesc'))
      .addDropdown((d) => d.addOptions({
        '': t('optFontTheme'),
        'serif': t('optFontSerif'),
        'sans': t('optFontSans'),
        'mono': t('optFontMono'),
        'custom': t('optFontCustom'),
      }).setValue(this.plugin.settings.fontFamily)
        // перерисовываем вкладку: поле «свой шрифт» показываем только когда оно нужно
        .onChange(async (v) => { this.plugin.settings.fontFamily = v; await save(); this.display(); }));

    if (this.plugin.settings.fontFamily === 'custom') {
      new Setting(containerEl)
        .setName(t('sFontCustom'))
        .setDesc(t('sFontCustomDesc'))
        .addText((tx) => tx.setPlaceholder('Georgia, serif')
          .setValue(this.plugin.settings.fontFamilyCustom)
          .onChange(async (v) => { this.plugin.settings.fontFamilyCustom = v; await save(); }));
    }

    new Setting(containerEl)
      .setName(t('sLineHeight'))
      .addSlider((sl) => sl.setLimits(1.2, 2.4, 0.05).setValue(this.plugin.settings.lineHeight)
        .setDynamicTooltip().onChange((v) => { this.plugin.settings.lineHeight = v; live(); }));

    new Setting(containerEl)
      .setName(t('sJustify'))
      .setDesc(t('sJustifyDesc'))
      .addToggle((tg) => tg.setValue(this.plugin.settings.justify)
        .onChange(async (v) => { this.plugin.settings.justify = v; await save(); }));

    section('sSecColour');

    new Setting(containerEl)
      .setName(t('sTint'))
      .setDesc(t('sTintDesc'))
      .addDropdown((d) => d.addOptions({
        'none': t('optTintNone'),
        'sepia': t('optTintSepia'),
        'cream': t('optTintCream'),
        'gray': t('optTintGray'),
        'night': t('optTintNight'),
      }).setValue(this.plugin.settings.tint)
        .onChange(async (v) => { this.plugin.settings.tint = v; await save(); }));

    new Setting(containerEl)
      .setName(t('sBrightness'))
      .setDesc(t('sBrightnessDesc'))
      .addSlider((sl) => sl.setLimits(20, 100, 5).setValue(this.plugin.settings.brightness)
        .setDynamicTooltip().onChange((v) => { this.plugin.settings.brightness = v; live(); }));

    section('sSecReading');

    new Setting(containerEl)
      .setName(t('sAnimate'))
      .addToggle((tg) => tg.setValue(this.plugin.settings.animate)
        .onChange(async (v) => { this.plugin.settings.animate = v; await save(); }));

    new Setting(containerEl)
      .setName(t('sTap'))
      .setDesc(t('sTapDesc'))
      .addToggle((tg) => tg.setValue(this.plugin.settings.tapZones)
        .onChange(async (v) => { this.plugin.settings.tapZones = v; await save(); }));

    new Setting(containerEl)
      .setName(t('sRemember'))
      .setDesc(t('sRememberDesc'))
      .addToggle((tg) => tg.setValue(this.plugin.settings.rememberPosition)
        .onChange(async (v) => { this.plugin.settings.rememberPosition = v; await save(); }));

    new Setting(containerEl)
      .setName(t('sTitle'))
      .addToggle((tg) => tg.setValue(this.plugin.settings.showTitle)
        .onChange(async (v) => { this.plugin.settings.showTitle = v; await save(); }));

    new Setting(containerEl)
      .setName(t('sOpenIn'))
      .addDropdown((d) => d.addOptions({
        'new-tab': t('optNewTab'),
        'current': t('optCurrent'),
        'split': t('optSplit'),
        'window': t('optWindow'),
      }).setValue(this.plugin.settings.openIn)
        .onChange(async (v) => { this.plugin.settings.openIn = v; await save(); }));

    new Setting(containerEl)
      .setName(t('sCollapse'))
      .setDesc(t('sCollapseDesc'))
      .addToggle((tg) => tg.setValue(this.plugin.settings.collapseSidebars)
        .onChange(async (v) => { this.plugin.settings.collapseSidebars = v; await save(); }));

    new Setting(containerEl)
      .setName(t('sImmersive'))
      .setDesc(t('sImmersiveDesc'))
      .addToggle((tg) => tg.setValue(this.plugin.settings.immersive)
        .onChange(async (v) => { this.plugin.settings.immersive = v; await save(); }));

    if (Platform.isDesktop) {
      new Setting(containerEl)
        .setName(t('sFullscreen'))
        .setDesc(t('sFullscreenDesc'))
        .addToggle((tg) => tg.setValue(this.plugin.settings.fullscreen)
          .onChange(async (v) => { this.plugin.settings.fullscreen = v; await save(); }));
    }

    if (Platform.isMobile) {
      new Setting(containerEl)
        .setName(t('sHideBar'))
        .setDesc(t('sHideBarDesc'))
        .addToggle((tg) => tg.setValue(this.plugin.settings.hideMobileBar)
          .onChange(async (v) => { this.plugin.settings.hideMobileBar = v; await save(); }));
    }

    section('sImportSection');

    new Setting(containerEl)
      .setName(t('sImportNow'))
      .setDesc(t('sImportNowDesc'))
      .addButton((b) => b.setButtonText(t('sImportBtn')).setCta()
        .onClick(() => this.plugin.importBook()));

    new Setting(containerEl)
      .setName(t('sImportFolder'))
      .setDesc(t('sImportFolderDesc'))
      .addText((tx) => tx.setPlaceholder('Books')
        .setValue(this.plugin.settings.importFolder)
        .onChange(async (v) => { this.plugin.settings.importFolder = v.replace(/^\/+|\/+$/g, '').trim(); await this.plugin.saveAll(); }));
  }
}

/* ============================================================
   Book import — convert fb2 / txt to Markdown (epub / docx later)
   ============================================================ */

const XLINK_NS = 'http://www.w3.org/1999/xlink';

// какие расширения умеем конвертировать (ext -> тип)
const CONVERTERS = { fb2: 'fb2', epub: 'epub', txt: 'txt' };
const IMPORT_ACCEPT = '.fb2,.epub,.txt';

function sanitizeFilename(name) {
  return String(name || '')
    .replace(/[\\/:*?"<>|#^[\]]/g, ' ') // запрещённые в именах ФС и мешающие Obsidian
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120) || 'book';
}
function slugify(name) {
  return sanitizeFilename(name).replace(/\s+/g, '_');
}

// экранировать markdown-спецсимволы в тексте книги (чтобы литеральные *_[]<> не форматировались)
function escapeMd(s) {
  return String(s).replace(/([\\`*_[\]<>])/g, '\\$1');
}
// экранировать символ в начале абзаца, который иначе стал бы разметкой блока
// (важно для реплик через дефис "- ..." и строк, начинающихся с # > | =)
function escapeBlockStart(s) {
  return s
    .replace(/^(\s*)([#>+|=-])/, '$1\\$2')
    .replace(/^(\s*)(\d+)([.)])(\s)/, '$1$2\\$3$4');
}
// декодировать бинарный буфер в строку с учётом кодировки
// (FB2 объявляет её в XML-декларации; для TXT — угадываем; частый случай рус. книг — windows-1251)
function decodeBuffer(buf) {
  const bytes = new Uint8Array(buf);
  if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF)
    return new TextDecoder('utf-8').decode(bytes.subarray(3));
  if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xFE)
    return new TextDecoder('utf-16le').decode(bytes.subarray(2));
  if (bytes.length >= 2 && bytes[0] === 0xFE && bytes[1] === 0xFF)
    return new TextDecoder('utf-16be').decode(bytes.subarray(2));

  const head = new TextDecoder('latin1').decode(bytes.subarray(0, 200));
  const m = head.match(/encoding=["']([\w-]+)["']/i);
  const enc = m ? m[1] : '';
  if (enc) {
    const norm = enc.toLowerCase().replace(/^cp/, 'windows-').replace('win-', 'windows-');
    try { return new TextDecoder(norm).decode(bytes); } catch (e) { /* пробуем дальше */ }
  }
  // строгий UTF-8; если не разбирается — считаем windows-1251
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch (e) { return new TextDecoder('windows-1251').decode(bytes); }
}

function getHref(el) {
  return el.getAttributeNS(XLINK_NS, 'href')
    || el.getAttribute('xlink:href')
    || el.getAttribute('l:href')
    || el.getAttribute('href') || '';
}
function extFromContentType(ct) {
  const map = {
    'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png',
    'image/gif': 'gif', 'image/svg+xml': 'svg', 'image/webp': 'webp',
  };
  return map[String(ct || '').toLowerCase()] || '';
}
function base64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/* ---------- FB2 (XML) -> Markdown ---------- */
class Fb2Converter {
  constructor(slug) {
    this.slug = slug || 'book';
    this.images = [];         // {name, bytes}
    this.binaries = {};       // id -> {type, data(base64)}
    this.noteSectionIds = new Set();
    this.notesById = {};
    this.bookTitle = '';
    this._seenImg = new Set();
  }

  convert(xmlText) {
    const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) throw new Error('FB2 XML parse error');
    const root = doc.documentElement;

    // индекс бинарников (картинок). Спрашиваем по имени тега в ЛЮБОМ пространстве
    // имён: перебирать все элементы книги ради двух десятков картинок — это
    // лишний массив на сотни тысяч узлов
    Array.from(doc.getElementsByTagNameNS('*', 'binary')).forEach((el) => {
      const id = el.getAttribute('id');
      if (id) this.binaries[id] = { type: el.getAttribute('content-type') || 'image/jpeg', data: (el.textContent || '').replace(/\s+/g, '') };
    });

    const bodies = this.childrenByName(root, 'body');
    // ids секций-сносок — ссылки на них инлайним в текст скобками
    bodies.forEach((b) => {
      const nm = (b.getAttribute('name') || '').toLowerCase();
      if (nm === 'notes' || nm === 'comments')
        this.childrenByName(b, 'section').forEach((s) => { const id = s.getAttribute('id'); if (id) this.noteSectionIds.add(id); });
    });
    // тексты сносок собираем ДО рендера тел: link() подставляет их на месте ссылки
    this.notesById = this.collectNotes(bodies);

    const titleInfo = this.first(root, 'title-info');
    this.bookTitle = titleInfo ? this.textOf(this.first(titleInfo, 'book-title')) : '';
    const authors = titleInfo ? this.authors(titleInfo) : [];

    const out = [];
    out.push('# ' + escapeMd(this.bookTitle || this.slug));
    if (authors.length) out.push('*' + escapeMd(authors.join(', ')) + '*');
    const cover = titleInfo && this.first(titleInfo, 'coverpage');
    if (cover) { const e = this.imageEmbed(this.first(cover, 'image')); if (e) out.push(e); }

    // основные тела (не сноски) — в порядке документа
    bodies.forEach((b) => {
      const nm = (b.getAttribute('name') || '').toLowerCase();
      if (nm === 'notes' || nm === 'comments') return;
      this.renderBody(b, out);
    });

    return out.filter((s) => s != null && s !== '').join('\n\n') + '\n';
  }

  renderBody(b, out) {
    Array.from(b.children).forEach((ch) => {
      const n = ch.localName;
      if (n === 'title') { const s = this.blockText(ch).trim(); if (s) out.push('## ' + s); }
      else if (n === 'epigraph') this.quote(ch, out);
      else if (n === 'section') this.renderSection(ch, 2, out);
      else this.block(ch, out);
    });
  }

  renderSection(sec, level, out) {
    const titleEl = this.directChild(sec, 'title');
    if (titleEl) { const s = this.blockText(titleEl).trim(); out.push('#'.repeat(Math.min(level, 6)) + ' ' + (s || '∗')); }
    Array.from(sec.children).forEach((ch) => {
      const n = ch.localName;
      if (n === 'title') return;
      if (n === 'section') this.renderSection(ch, level + 1, out);
      else this.block(ch, out);
    });
  }

  block(el, out) {
    switch (el.localName) {
      case 'p': { let s = this.inline(el).trim(); if (s) out.push(escapeBlockStart(s)); break; }
      case 'subtitle': { const s = this.inline(el).trim(); if (s) out.push('**' + s + '**'); break; }
      case 'empty-line': out.push('&nbsp;'); break;
      case 'image': { const e = this.imageEmbed(el); if (e) out.push(e); break; }
      case 'poem': this.poem(el, out); break;
      case 'epigraph':
      case 'cite':
      case 'annotation': this.quote(el, out); break;
      case 'text-author': { const s = this.inline(el).trim(); if (s) out.push('> — ' + s); break; }
      default: { const s = this.blockText(el).trim(); if (s) out.push(escapeBlockStart(s)); }
    }
  }

  poem(el, out) {
    const title = this.directChild(el, 'title');
    if (title) { const s = this.blockText(title).trim(); if (s) out.push('**' + s + '**'); }
    this.childrenByName(el, 'stanza').forEach((st) => {
      const vs = this.childrenByName(st, 'v').map((v) => this.inline(v).trim()).filter((x) => x !== '');
      if (vs.length) out.push(vs.join('  \n')); // строфа = абзац, стихи разделены жёстким переносом
    });
  }

  quote(el, out) {
    const inner = [];
    Array.from(el.children).forEach((ch) => {
      if (ch.localName === 'text-author') { const s = this.inline(ch).trim(); if (s) inner.push('— ' + s); }
      else this.block(ch, inner);
    });
    const body = inner.join('\n\n');
    if (body.trim()) out.push(body.split('\n').map((l) => (l ? '> ' + l : '>')).join('\n'));
  }

  inline(node) {
    let s = '';
    node.childNodes.forEach((n) => {
      if (n.nodeType === 3) { s += escapeMd(n.nodeValue); return; }
      if (n.nodeType !== 1) return;
      switch (n.localName) {
        case 'emphasis': case 'i': s += '*' + this.inline(n) + '*'; break;
        case 'strong': case 'b': s += '**' + this.inline(n) + '**'; break;
        case 'strikethrough': s += '~~' + this.inline(n) + '~~'; break;
        case 'code': s += '`' + (n.textContent || '') + '`'; break;
        case 'sub': s += '<sub>' + this.inline(n) + '</sub>'; break;
        case 'sup': s += '<sup>' + this.inline(n) + '</sup>'; break;
        case 'a': s += this.link(n); break;
        case 'image': { const e = this.imageEmbed(n); if (e) s += e; break; }
        default: s += this.inline(n); // style и прочее — прозрачно
      }
    });
    return s;
  }

  link(a) {
    const href = getHref(a);
    const type = (a.getAttribute('type') || '').toLowerCase();
    const text = this.inline(a);
    if (href.startsWith('#')) {
      const id = href.slice(1);
      if (type === 'note' || this.noteSectionIds.has(id)) {
        // сноска инлайном: вместо маркера [1] — её текст в скобках курсивом.
        // notesById ещё пуст, пока собираются сами сноски (перекрёстные ссылки) — тогда маркер
        const md = this.notesById && this.notesById[id];
        return md ? ' (*' + md + '*)' : text;
      }
      return text;
    }
    if (/^https?:/i.test(href)) return '[' + text + '](' + href + ')';
    return text;
  }

  imageEmbed(img) {
    if (!img) return '';
    const href = getHref(img);
    if (!href.startsWith('#')) return '';
    const id = href.slice(1);
    const bin = this.binaries[id];
    if (!bin) return '';
    const ext = extFromContentType(bin.type) || (id.includes('.') ? id.split('.').pop() : 'jpg');
    const filename = this.slug + '__' + slugify(id.replace(/\.[^.]+$/, '')) + '.' + ext;
    if (!this._seenImg.has(id)) {
      this._seenImg.add(id);
      try { this.images.push({ name: filename, bytes: base64ToBytes(bin.data) }); }
      catch (e) { return ''; }
    }
    return '![[' + filename + ']]';
  }

  // тексты сносок: id -> однострочный markdown (для подстановки в скобках на месте ссылки)
  collectNotes(bodies) {
    const notes = {};
    bodies.forEach((b) => {
      const nm = (b.getAttribute('name') || '').toLowerCase();
      if (nm !== 'notes' && nm !== 'comments') return;
      this.childrenByName(b, 'section').forEach((sec) => {
        const id = sec.getAttribute('id');
        if (!id) return;
        const parts = [];
        Array.from(sec.children).forEach((ch) => { if (ch.localName !== 'title') this.block(ch, parts); });
        const md = parts.join(' ').replace(/\s*\n\s*/g, ' ').replace(/\s+/g, ' ').trim();
        if (md) notes[id] = md;
      });
    });
    return notes;
  }

  // хелперы
  childrenByName(node, name) { return Array.from(node.children).filter((c) => c.localName === name); }
  directChild(node, name) { return Array.from(node.children).find((c) => c.localName === name) || null; }
  first(root, name) { const els = root.getElementsByTagName('*'); for (let i = 0; i < els.length; i++) if (els[i].localName === name) return els[i]; return null; }
  textOf(el) { return el ? (el.textContent || '').trim() : ''; }
  blockText(el) {
    const parts = [];
    Array.from(el.children).forEach((ch) => { if (ch.localName !== 'empty-line') parts.push(this.inline(ch).trim()); });
    const joined = parts.filter(Boolean).join(' ');
    return joined || this.inline(el).trim();
  }
  authors(titleInfo) {
    return this.childrenByName(titleInfo, 'author').map((a) => {
      const parts = ['first-name', 'middle-name', 'last-name'].map((k) => this.textOf(this.directChild(a, k)));
      return parts.filter(Boolean).join(' ') || this.textOf(this.directChild(a, 'nickname'));
    }).filter(Boolean);
  }
}

/* ---------- ZIP: минимальный читатель на DecompressionStream ----------
   Своя реализация вместо библиотеки: у плагина нет сборки, а всё нужное
   (raw deflate) с некоторых пор умеет сам браузерный движок. */

async function inflateRaw(bytes) {
  if (typeof DecompressionStream === 'undefined') throw new Error('DecompressionStream недоступен');
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

class ZipReader {
  constructor(buf) {
    this.view = new DataView(buf);
    this.bytes = new Uint8Array(buf);
    this.entries = new Map(); // имя -> {method, csize, local}
  }

  // разбор центрального каталога: он в конце архива и знает смещения всех файлов
  parse() {
    const v = this.view;
    const n = v.byteLength;
    let eocd = -1;
    // 22 байта самой записи + до 65535 байт комментария архива
    const stop = Math.max(0, n - 22 - 65535);
    for (let i = n - 22; i >= stop; i--) {
      if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('ZIP: не найден конец архива');
    const count = v.getUint16(eocd + 10, true);
    let off = v.getUint32(eocd + 16, true);
    const dec = new TextDecoder('utf-8');
    for (let k = 0; k < count && off + 46 <= n; k++) {
      if (v.getUint32(off, true) !== 0x02014b50) break;
      const flags = v.getUint16(off + 8, true);
      const method = v.getUint16(off + 10, true);
      const csize = v.getUint32(off + 20, true);
      const nameLen = v.getUint16(off + 28, true);
      const extraLen = v.getUint16(off + 30, true);
      const commentLen = v.getUint16(off + 32, true);
      const local = v.getUint32(off + 42, true);
      const rawName = this.bytes.subarray(off + 46, off + 46 + nameLen);
      let name = dec.decode(rawName);
      // бит 11 = имена в UTF-8. Не выставлен и текст побился — значит имена
      // в DOS-кодировке (старые архиваторы так пишут кириллицу)
      if (!(flags & 0x800) && name.indexOf('�') >= 0) {
        try { name = new TextDecoder('ibm866').decode(rawName); } catch (e) { /* оставим utf-8 */ }
      }
      this.entries.set(name, { method, csize, local });
      off += 46 + nameLen + extraLen + commentLen;
    }
    if (!this.entries.size) throw new Error('ZIP: архив пуст');
  }

  // имя внутри архива может отличаться от ссылки регистром, экранированием
  // или слэшами — поэтому кроме точного совпадения пробуем нормализованное
  static norm(s) {
    let t = String(s == null ? '' : s).replace(/\\/g, '/');
    try { t = decodeURIComponent(t); } catch (e) { /* уже раскодировано */ }
    return t.toLowerCase().replace(/^\.?\//, '');
  }

  find(name) {
    if (this.entries.has(name)) return name;
    if (!this._norm) {
      this._norm = new Map();
      for (const k of this.entries.keys()) {
        const n = ZipReader.norm(k);
        if (!this._norm.has(n)) this._norm.set(n, k);
      }
    }
    return this._norm.get(ZipReader.norm(name)) || null;
  }

  async data(name) {
    const key = this.find(name);
    const e = key == null ? null : this.entries.get(key);
    if (!e) return null;
    const v = this.view;
    if (v.getUint32(e.local, true) !== 0x04034b50) throw new Error('ZIP: битый заголовок ' + name);
    // длины имени/extra у локального заголовка свои — брать их из каталога нельзя
    const start = e.local + 30 + v.getUint16(e.local + 26, true) + v.getUint16(e.local + 28, true);
    const raw = this.bytes.subarray(start, start + e.csize);
    if (e.method === 0) return raw;             // stored — например, mimetype
    if (e.method !== 8) throw new Error('ZIP: метод сжатия ' + e.method + ' не поддерживается');
    return inflateRaw(raw);
  }

  async text(name) {
    const d = await this.data(name);
    return d ? decodeBuffer(d) : null;
  }
}

/* ---------- EPUB (zip + xhtml) -> Markdown ---------- */

const EPUB_NS_OPS = 'http://www.idpf.org/2007/ops';
// теги, из-за которых контейнер считается блочным (внутрь идём рекурсией, а не как в абзац)
const HTML_BLOCKS = new Set(['p', 'div', 'section', 'article', 'aside', 'figure', 'figcaption',
  'blockquote', 'ul', 'ol', 'li', 'table', 'pre', 'hr', 'header', 'footer', 'main', 'nav',
  'dl', 'dt', 'dd', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']);

// имя тега без namespace-префикса и регистра: разбор XML и HTML даёт разное написание
const HEADING_TAGS = /^h[1-6]$/;
function tagName(el) {
  return String((el && (el.localName || el.tagName)) || '').toLowerCase().split(':').pop();
}
function tags(root, name) {
  const out = [];
  const want = name.toLowerCase();
  const els = root && root.getElementsByTagName ? root.getElementsByTagName('*') : [];
  for (let i = 0; i < els.length; i++) if (tagName(els[i]) === want) out.push(els[i]);
  return out;
}
function parseXmlLoose(text) {
  if (!text) return null;
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  // кривой XML встречается даже в магазинных книгах — добираем HTML-парсером
  if (doc.getElementsByTagName('parsererror').length) return new DOMParser().parseFromString(text, 'text/html');
  return doc;
}

// Главы книги разбираем КАК XHTML, а не как html. Разница принципиальная: в html
// самозакрывающиеся теги не работают, и одинокий <title/> (а он встречается сплошь
// и рядом) заставляет парсер съесть весь остаток файла как текст заголовка —
// книга превращается в пустой body. На text/html откатываемся, только если
// документ не разобрался как XML.
function parseContentDoc(text) {
  if (!text) return null;
  const xml = new DOMParser().parseFromString(text, 'application/xhtml+xml');
  if (!xml.getElementsByTagName('parsererror').length && tags(xml, 'body').length) return xml;
  return new DOMParser().parseFromString(text, 'text/html');
}

// body/title без опоры на html-специфичные свойства: у XML-документа их может не быть
function docBody(doc) {
  return (doc && doc.body) || tags(doc, 'body')[0] || (doc && doc.documentElement) || null;
}
function docTitle(doc) {
  const el = tags(doc, 'title')[0];
  return el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '';
}
function dirName(p) {
  const i = String(p || '').lastIndexOf('/');
  return i < 0 ? '' : String(p).slice(0, i);
}
// путь внутри архива: ссылки в epub относительны своему документу и URL-кодированы
function zipResolve(base, href) {
  let h = String(href || '').split('#')[0];
  try { h = decodeURIComponent(h); } catch (e) { /* оставляем как есть */ }
  if (!h) return '';
  const parts = (h.startsWith('/') ? [] : String(base || '').split('/')).concat(h.split('/'));
  const out = [];
  for (const p of parts) {
    if (!p || p === '.') continue;
    if (p === '..') { out.pop(); continue; }
    out.push(p);
  }
  return out.join('/');
}

class EpubConverter {
  constructor(slug) {
    this.slug = slug || 'book';
    this.images = [];          // {name, bytes} — то, что реально встретилось в тексте
    this.bookTitle = '';
    this.imgBytes = new Map(); // путь в архиве -> {type, bytes}, распакованы заранее
    this.notes = new Map();    // "путь#id" -> текст сноски одной строкой
    this.noteEls = new Set();  // элементы-сноски: в общий поток не выводим
    this.notesFrom = new Set(); // документы, из которых забрали сноски
    this.coverPath = '';
    this.authorLine = '';
    this._seen = new Map();    // путь в архиве -> имя файла в vault
    this._names = new Set();
    this._inNote = false;
    this.curPath = '';
  }

  async convert(buf) {
    const zip = new ZipReader(buf);
    zip.parse();

    const opfPath = await this.findOpf(zip);
    const opfDoc = parseXmlLoose(await zip.text(opfPath));
    if (!opfDoc) throw new Error('EPUB: не читается OPF');
    const base = dirName(opfPath);

    // манифест: id -> ресурс
    const manifest = new Map();
    tags(opfDoc, 'item').forEach((it) => {
      const id = it.getAttribute('id');
      if (!id) return;
      manifest.set(id, {
        path: zipResolve(base, it.getAttribute('href') || ''),
        type: (it.getAttribute('media-type') || '').toLowerCase(),
        props: it.getAttribute('properties') || '',
      });
    });

    // порядок чтения
    // media-type в манифесте иногда врут или не указывают — тогда смотрим на расширение
    const spine = tags(opfDoc, 'itemref')
      .map((r) => manifest.get(r.getAttribute('idref')))
      .filter((m) => m && (/html/.test(m.type) || /\.x?html?$/i.test(m.path)));
    if (!spine.length) throw new Error('EPUB: пустой spine');

    this.bookTitle = this.metaText(opfDoc, 'title');
    const authors = tags(opfDoc, 'creator').map((c) => (c.textContent || '').trim()).filter(Boolean);
    this.authorLine = authors.join(', ');

    // картинки распаковываем заранее: обход XHTML синхронный, а inflate — асинхронный
    for (const m of manifest.values()) {
      if (m.type.indexOf('image/') !== 0) continue;
      try {
        const b = await zip.data(m.path);
        if (b) this.imgBytes.set(m.path, { type: m.type, bytes: b });
      } catch (e) { /* битую картинку просто пропускаем */ }
    }

    const out = [];
    out.push('# ' + escapeMd(this.bookTitle || this.slug));
    if (authors.length) out.push('*' + escapeMd(authors.join(', ')) + '*');
    const cover = this.coverEmbed(opfDoc, manifest);
    if (cover) out.push(cover);

    const titles = await this.readToc(zip, manifest);

    // разбираем все главы сразу: сноска может лежать в другом документе,
    // а подставить её надо на месте ссылки
    const docs = [];
    const missing = [];
    for (const item of spine) {
      const html = await zip.text(item.path);
      if (html == null) { missing.push(item.path); continue; }
      docs.push({ path: item.path, doc: parseContentDoc(html) });
    }
    // молча отдать книгу из одной обложки — худшее, что можно сделать: пусть лучше
    // будет ошибка, а в консоли — чем именно архив отличается от ожидаемого
    if (missing.length) {
      console.warn('MD Reader: в архиве не найдены главы:', missing,
        '\nЧто есть в архиве:', Array.from(zip.entries.keys()).slice(0, 60));
    }
    if (!docs.length) throw new Error('EPUB: не прочитана ни одна глава из ' + spine.length);

    this.indexNotes(docs);
    let rendered = 0;
    docs.forEach((d) => { if (this.renderDoc(d, titles, out)) rendered++; });
    if (!rendered) {
      console.warn('MD Reader: главы прочитаны, но текста в них не нашлось:', docs.map((d) => d.path));
      throw new Error('EPUB: все ' + docs.length + ' глав оказались пустыми');
    }

    return out.filter((s) => s != null && s !== '').join('\n\n') + '\n';
  }

  async findOpf(zip) {
    const xml = await zip.text('META-INF/container.xml');
    const doc = xml && parseXmlLoose(xml);
    const rf = doc && tags(doc, 'rootfile')[0];
    const p = rf && rf.getAttribute('full-path');
    if (p) return zipResolve('', p);
    for (const name of zip.entries.keys()) if (/\.opf$/i.test(name)) return name; // запасной путь
    throw new Error('EPUB: не найден OPF');
  }

  metaText(opfDoc, name) {
    const el = tags(opfDoc, name)[0];
    return el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '';
  }

  // оглавление: EPUB3 (nav) или EPUB2 (toc.ncx) -> путь документа -> название главы.
  // Нужно для документов без собственного заголовка: без заголовков книгу нечем резать
  async readToc(zip, manifest) {
    const map = new Map();
    const add = (dir, href, label) => {
      const p = zipResolve(dir, href);
      const s = String(label || '').replace(/\s+/g, ' ').trim();
      if (p && s && !map.has(p)) map.set(p, s);
    };
    const nav = Array.from(manifest.values()).find((m) => /(^|\s)nav(\s|$)/.test(m.props));
    if (nav) {
      const html = await zip.text(nav.path).catch(() => null);
      const doc = html && parseContentDoc(html);
      if (doc) doc.querySelectorAll('nav a[href]').forEach((a) => add(dirName(nav.path), a.getAttribute('href'), a.textContent));
    }
    const ncx = Array.from(manifest.values()).find((m) => m.type === 'application/x-dtbncx+xml' || /\.ncx$/i.test(m.path));
    if (ncx) {
      const xml = await zip.text(ncx.path).catch(() => null);
      const doc = xml && parseXmlLoose(xml);
      if (doc) {
        tags(doc, 'navPoint').forEach((np) => {
          const c = tags(np, 'content')[0];
          const l = tags(np, 'navLabel')[0];
          if (c && l) add(dirName(ncx.path), c.getAttribute('src'), l.textContent);
        });
      }
    }
    return map;
  }

  /* --- сноски: как и в FB2, вставляем текст в скобках прямо на месте ссылки --- */
  isNote(el) {
    const et = (el.getAttribute('epub:type') || el.getAttributeNS(EPUB_NS_OPS, 'type') || '').toLowerCase();
    if (/(foot|end|rear)note|(^|\s)note(\s|$)/.test(et)) return true;
    const role = (el.getAttribute('role') || '').toLowerCase();
    if (role === 'doc-footnote' || role === 'doc-endnote') return true;
    return tagName(el) === 'aside';
  }

  // ссылка похожа на маркер сноски: «1», «[2]», «*». Именно так размечено
  // большинство книг, сконвертированных из FB2 — никаких epub:type там нет
  looksLikeNoteRef(a) {
    const txt = (a.textContent || '').trim();
    if (!txt || txt.length > 6) return false;
    if (tagName(a.parentElement || {}) === 'sup') return true;
    return /^[[(]?[\d*†‡§]+[\])]?$/.test(txt);
  }

  // блок, в котором лежит цель ссылки: у <a id> или <span id> берём ближайший блочный предок
  noteHost(el) {
    let cur = el;
    while (cur && !HTML_BLOCKS.has(tagName(cur))) cur = cur.parentElement;
    if (!cur || tagName(cur) === 'body' || tagName(cur) === 'html') return el;
    return cur;
  }

  noteMarkdown(host) {
    this._inNote = true;
    const parts = [];
    if (this.hasBlockChild(host)) Array.from(host.children).forEach((ch) => this.block(ch, parts));
    else parts.push(this.inline(host));
    this._inNote = false;
    return parts.join(' ')
      .replace(/\s+/g, ' ')
      // сноска складывается в одну строку, поэтому разметка блоков в ней не нужна:
      // её номер часто оформлен как заголовок и дал бы «## 1» прямо в скобках
      .replace(/(^|\s)#{1,6}\s+/g, '$1')
      .replace(/(^|\s)>\s+/g, '$1')
      // сноска обычно начинается со своего же номера («1 Текст…») — он лишний
      .replace(/^\\?[[(]?\s*\d{1,3}\s*\\?[\])]?[.:]?\s+/, '')
      .trim();
  }

  registerNote(key, host) {
    if (this.notes.has(key) || !host) return;
    // страховка от «оглавления внутри книги»: если по ссылке лежит глава, а не сноска,
    // её нельзя ни вставлять в скобки, ни убирать из потока
    if (host.querySelector && host.querySelector('h1, h2, h3, h4, h5, h6')) return;
    const raw = (host.textContent || '').trim();
    if (!raw || raw.length > 1500) return;
    const md = this.noteMarkdown(host);
    if (!md) return;
    this.notes.set(key, md);
    this.noteEls.add(host);
    this.notesFrom.add(key.split('#')[0]);
  }

  // Сноски ищем ДВУМЯ путями. По разметке цели (aside, epub:type, role) — так размечен
  // «правильный» EPUB3. И по самим ссылкам — так размечено всё остальное.
  indexNotes(docs) {
    // свой указатель id -> элемент: getElementById на XML-документе работает
    // не всегда (id там формально не является идентификатором без DTD)
    const idMaps = new Map();
    docs.forEach((entry) => {
      const map = new Map();
      entry.doc.querySelectorAll('[id]').forEach((el) => {
        const id = el.getAttribute('id');
        if (id && !map.has(id)) map.set(id, el);
      });
      idMaps.set(entry.path, map);
      this.curPath = entry.path; // картинки внутри сноски адресуются от её документа
      map.forEach((el, id) => { if (this.isNote(el)) this.registerNote(entry.path + '#' + id, el); });
    });

    docs.forEach((entry) => {
      entry.doc.querySelectorAll('a[href]').forEach((a) => {
        const href = (a.getAttribute('href') || '').trim();
        const frag = href.split('#')[1];
        if (!frag || /^(https?|mailto):/i.test(href)) return;
        if (!this.looksLikeNoteRef(a)) return;
        const target = href.startsWith('#') ? entry.path : zipResolve(dirName(entry.path), href);
        const el = (idMaps.get(target) || new Map()).get(frag);
        if (!el) return;
        this.curPath = target;
        this.registerNote(target + '#' + frag, this.noteHost(el));
      });
    });
  }

  // -> true, если документ дал хоть какой-то текст (по этому считаем, что книга не пустая)
  renderDoc(entry, titles, out) {
    this.curPath = entry.path;
    const body = docBody(entry.doc);
    if (!body) return false;
    const blocks = [];
    Array.from(body.children).forEach((ch) => this.block(ch, blocks));
    if (!blocks.length) return false;          // страница-обложка и прочие пустышки
    if (this.isFrontMatter(blocks)) return true;
    // раздел примечаний: всё его содержимое разошлось по тексту в скобках,
    // остался бы только заголовок, ведущий в оглавлении в пустоту
    if (this.notesFrom.has(entry.path) && blocks.every((b) => /^#{1,6} /.test(b))) return true;
    // без заголовка глава сольётся с соседними: ридер режет книгу именно по ним.
    // Смотрим на итог, а не на DOM: заголовок мог получиться из блока class="title"
    if (!blocks.some((b) => /^#{1,6} /.test(b))) {
      const title = titles.get(entry.path) || docTitle(entry.doc);
      if (title) out.push('## ' + escapeMd(title));
    }
    blocks.forEach((b) => out.push(b));
    return true;
  }

  // титульный лист: короткая страница, весь текст которой — это название и автор.
  // Их мы уже вывели в шапке книги, второй раз не нужно
  isFrontMatter(blocks) {
    const text = blocks.join(' ');
    if (!text || text.length > 160) return false;
    const split = (s) => normHeading(s).split(/[^0-9a-zа-яё]+/i).filter(Boolean);
    const known = new Set(split(this.bookTitle + ' ' + (this.authorLine || '')));
    if (!known.size) return false;
    // сравниваем по словам, а не подстрокой: на титуле автор и название
    // обычно идут в другом порядке, чем в метаданных
    const mine = split(text.replace(/^#{1,6}\s*/gm, ''));
    return mine.length > 0 && mine.every((w) => known.has(w));
  }

  hasBlockChild(el) {
    return Array.from(el.children).some((c) => HTML_BLOCKS.has(tagName(c)));
  }

  block(el, out) {
    if (!el || el.nodeType !== 1 || this.noteEls.has(el)) return;
    const tag = tagName(el);
    if (tag === 'script' || tag === 'style' || tag === 'nav' || tag === 'head') return;
    // книги из FB2 размечают эпиграфы и цитаты классами, а не тегом blockquote
    const cls = (el.getAttribute('class') || '').toLowerCase();
    if (/(^|[\s-])(epigraph|cite)($|[\s-])/.test(cls)) { this.quote(el, out); return; }
    // ...а названия глав — блоком class="title"/"title1"/"subtitle", а не h1–h6.
    // Без этого у целой книги не остаётся заголовков: ридеру нечем её резать,
    // и оглавление получается из пяти строк на полмегабайта текста
    const tm = cls.match(/(?:^|[\s-])(sub)?title(\d*)(?:$|[\s-])/);
    if (tm && !HEADING_TAGS.test(tag)) {
      const s = this.titleText(el);
      const depth = tm[1] ? 2 : Math.max(1, parseInt(tm[2], 10) || 1);
      if (s) out.push('#'.repeat(Math.min(depth + 1, 6)) + ' ' + s);
      return;
    }
    const flow = () => {
      if (this.hasBlockChild(el)) Array.from(el.children).forEach((ch) => this.block(ch, out));
      else { const s = this.inline(el).trim(); if (s) out.push(escapeBlockStart(s)); }
    };
    switch (tag) {
      case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': case 'h6': {
        const s = this.inline(el).replace(/\s+/g, ' ').trim();
        // на уровень ниже: единственный # в файле — это название книги
        if (s) out.push('#'.repeat(Math.min(parseInt(tag[1], 10) + 1, 6)) + ' ' + s);
        break;
      }
      case 'p': case 'dt': case 'dd': {
        const s = this.inline(el).trim();
        if (!s) break;
        // подпись под эпиграфом/цитатой — с тире, как в FB2-конвертере
        if (/\btext-author\b/.test(cls) && !/^[—–-]/.test(s)) out.push('— ' + s);
        else out.push(escapeBlockStart(s));
        break;
      }
      case 'blockquote': this.quote(el, out); break;
      case 'ul': case 'ol': this.list(el, out, tag === 'ol', 0); break;
      case 'pre': { const s = (el.textContent || '').replace(/\s+$/, ''); if (s) out.push('```\n' + s + '\n```'); break; }
      case 'hr': out.push('***'); break; // не ---: после абзаца это был бы setext-заголовок
      case 'table': this.table(el, out); break;
      case 'img': case 'image': { const e = this.imageEmbed(el); if (e) out.push(e); break; }
      case 'br': break;
      default: flow();
    }
  }

  // название главы в одну строку. Внутри блока-названия обычно лежит несколько
  // абзацев, и между их тегами не всегда есть пробел — без разделителя
  // соседние слова склеились бы в одно
  titleText(el) {
    let s = '';
    Array.from(el.childNodes).forEach((n) => {
      if (n.nodeType === 1 && HTML_BLOCKS.has(tagName(n))) s += this.titleText(n) + ' ';
      else s += this.inlineNodes([n]);
    });
    return s.replace(/\s+/g, ' ').trim();
  }

  quote(el, out) {
    const inner = [];
    Array.from(el.children).forEach((ch) => this.block(ch, inner));
    const body = inner.length ? inner.join('\n\n') : this.inline(el).trim();
    if (body.trim()) out.push(body.split('\n').map((l) => (l ? '> ' + l : '>')).join('\n'));
  }

  list(el, out, ordered, depth) {
    const pad = '  '.repeat(depth);
    const lines = [];
    let i = 0;
    Array.from(el.children).forEach((li) => {
      if (tagName(li) !== 'li') return;
      i++;
      const nested = [];
      const head = [];
      Array.from(li.childNodes).forEach((n) => {
        const tg = n.nodeType === 1 ? tagName(n) : '';
        if (tg === 'ul' || tg === 'ol') nested.push(n); else head.push(n);
      });
      lines.push(pad + (ordered ? i + '. ' : '- ') + this.inlineNodes(head).replace(/\s+/g, ' ').trim());
      nested.forEach((n) => {
        const sub = [];
        this.list(n, sub, tagName(n) === 'ol', depth + 1);
        if (sub.length) lines.push(sub.join('\n'));
      });
    });
    if (lines.length) out.push(lines.join('\n'));
  }

  table(el, out) {
    const cells = (tr) => Array.from(tr.children)
      .filter((c) => tagName(c) === 'td' || tagName(c) === 'th')
      .map((c) => this.inline(c).replace(/\s+/g, ' ').replace(/\|/g, '\\|').trim());
    const grid = Array.from(el.querySelectorAll('tr')).map(cells).filter((r) => r.length);
    if (!grid.length) return;
    const w = grid.reduce((m, r) => Math.max(m, r.length), 0);
    const row = (r) => '| ' + r.concat(new Array(w - r.length).fill('')).join(' | ') + ' |';
    const md = [row(grid[0]), '| ' + new Array(w).fill('---').join(' | ') + ' |'];
    for (let i = 1; i < grid.length; i++) md.push(row(grid[i]));
    out.push(md.join('\n'));
  }

  inline(node) { return this.inlineNodes(node.childNodes); }

  inlineNodes(nodes) {
    let s = '';
    Array.from(nodes).forEach((n) => {
      // пробелы в HTML схлопываются — иначе переносы из вёрстки порвали бы абзац
      if (n.nodeType === 3) { s += escapeMd(String(n.nodeValue).replace(/\s+/g, ' ')); return; }
      if (n.nodeType !== 1 || this.noteEls.has(n)) return;
      const tag = tagName(n);
      const wrap = (mark) => { const x = this.inline(n).trim(); return x ? mark + x + mark : ''; };
      switch (tag) {
        case 'br': s += '  \n'; break;
        case 'em': case 'i': case 'cite': case 'dfn': s += wrap('*'); break;
        case 'strong': case 'b': s += wrap('**'); break;
        case 's': case 'del': case 'strike': s += wrap('~~'); break;
        case 'code': case 'kbd': case 'samp': case 'tt': s += '`' + (n.textContent || '') + '`'; break;
        case 'sub': s += '<sub>' + this.inline(n) + '</sub>'; break;
        case 'sup': s += '<sup>' + this.inline(n) + '</sup>'; break;
        case 'a': s += this.link(n); break;
        case 'img': case 'image': s += this.imageEmbed(n); break;
        case 'script': case 'style': break;
        default: s += this.inline(n);
      }
    });
    return s;
  }

  link(a) {
    const text = this.inline(a);
    const href = (a.getAttribute('href') || getHref(a) || '').trim();
    if (!href) return text;
    if (/^(https?|mailto):/i.test(href)) return '[' + text + '](' + href + ')';
    if (!this._inNote) {
      const frag = href.split('#')[1] || '';
      const target = href.startsWith('#') ? this.curPath : zipResolve(dirName(this.curPath), href);
      const md = this.notes.get(target + '#' + frag);
      // сноска инлайном: маркер [1] бесполезен, определение уедет в другой блок рендера
      if (md) return ' (*' + md + '*)';
    }
    return text; // прочие внутренние ссылки — просто текст
  }

  coverEmbed(opfDoc, manifest) {
    let id = '';
    tags(opfDoc, 'meta').forEach((m) => {
      if ((m.getAttribute('name') || '').toLowerCase() === 'cover') id = m.getAttribute('content') || id;
    });
    let item = id ? manifest.get(id) : null;
    if (!item || item.type.indexOf('image/') !== 0) {
      item = Array.from(manifest.values()).find((m) => /cover-image/.test(m.props));
    }
    if (!item) return '';
    this.coverPath = item.path;
    return this.embedByPath(item.path);
  }

  imageEmbed(el) {
    const src = (el.getAttribute('src') || getHref(el) || '').trim();
    if (!src || /^(data|https?):/i.test(src)) return '';
    return this.embedByPath(zipResolve(dirName(this.curPath), src));
  }

  embedByPath(path) {
    if (!path) return '';
    // обложку показываем один раз: страница-обложка обычно ещё и отдельный раздел spine
    if (this._seen.has(path)) return path === this.coverPath ? '' : '![[' + this._seen.get(path) + ']]';
    const rec = this.imgBytes.get(path);
    if (!rec) return '';
    const stem = (path.split('/').pop() || 'img').replace(/\.[^.]+$/, '');
    const ext = extFromContentType(rec.type) || (path.split('.').pop() || 'jpg').toLowerCase();
    let name = this.slug + '__' + slugify(stem) + '.' + ext;
    // в разных папках архива имена файлов повторяются, а в vault они лягут в одну
    for (let i = 2; this._names.has(name); i++) name = this.slug + '__' + slugify(stem) + '_' + i + '.' + ext;
    this._names.add(name);
    this._seen.set(path, name);
    this.images.push({ name, bytes: rec.bytes });
    return '![[' + name + ']]';
  }
}

/* ---------- TXT -> Markdown ---------- */
function txtToMarkdown(text, base) {
  text = text.replace(/\r\n?/g, '\n').replace(/ /g, ' ');
  const lines = text.split('\n');
  const nonEmpty = lines.filter((l) => l.trim());
  const blanks = lines.length - nonEmpty.length;
  const avgLen = nonEmpty.reduce((a, l) => a + l.length, 0) / (nonEmpty.length || 1);
  // стиль файла: абзац-на-строку (мало пустых строк, длинные строки) vs перенос по словам
  const paraPerLine = blanks < nonEmpty.length * 0.1 && avgLen > 60;
  // граница слова тут именно через (?!\p{L}), а НЕ через \b: \b считает словом
  // только [A-Za-z0-9_], поэтому после «глава» никакой границы нет и русские
  // названия глав не распознавались вовсе — книга уезжала в импорт без оглавления
  const chapterRe = /^\s*((?:глава|часть|книга|том|chapter|book|part)(?!\p{L}).{0,60}|[IVXLCDM]{1,7}|\d{1,3}\.?)\s*$/iu;

  const blocks = [];
  let para = [];
  const flush = () => { if (para.length) { blocks.push({ h: false, text: para.join(' ').trim() }); para = []; } };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) { flush(); continue; }
    const prevBlank = i === 0 || !lines[i - 1].trim();
    const nextBlank = i === lines.length - 1 || !lines[i + 1].trim();
    if ((prevBlank || paraPerLine) && (nextBlank || paraPerLine) && line.length <= 60 && chapterRe.test(line)) {
      flush();
      blocks.push({ h: true, text: line });
      continue;
    }
    para.push(line);
    if (paraPerLine) flush();
  }
  flush();

  const body = blocks.map((b) => b.h
    ? '## ' + escapeMd(b.text)
    : escapeBlockStart(escapeMd(b.text))).join('\n\n');

  return { markdown: '# ' + escapeMd(base) + '\n\n' + body + '\n', images: [] };
}

/* ============================================================
   Plugin
   ============================================================ */
class MdReaderPlugin extends Plugin {
  async onload() {
    const loaded = (await this.loadData()) || {};
    // берём ТОЛЬКО известные ключи: иначе настройки от старых версий (и позиции с
    // библиотекой, лежащие в том же файле) навсегда оседали бы в data.json
    this.settings = Object.assign({}, DEFAULT_SETTINGS);
    for (const k of Object.keys(DEFAULT_SETTINGS)) {
      if (loaded[k] !== undefined) this.settings[k] = loaded[k];
    }
    this.db = loaded.positions || {};
    this.library = Array.isArray(loaded.library) ? loaded.library : []; // заметки, добавленные в библиотеку вручную
    // самозамеры, а не настройки: rate — скорость раскладки этой машины (мс на символ,
    // по нему подбирается размер блока рендера), cpm — скорость чтения хозяина
    // (символов в минуту, из неё считается «сколько осталось»)
    this.perf = (loaded.perf && typeof loaded.perf === 'object')
      ? { rate: loaded.perf.rate, cpm: loaded.perf.cpm }
      : {};
    // положение боковых панелей ДО того, как ридер их свернул. Переживает перезапуск:
    // иначе закрытая с книгой программа возвращалась бы уже без панелей (см. collapseSidebars)
    const sp = loaded.sidebarPrev;
    this.sidebarPrev = (sp && typeof sp === 'object') ? { left: !!sp.left, right: !!sp.right } : null;
    this.lastSaved = JSON.stringify(this.dataBlob());
    // «в памяти есть несохранённое»: без него автосохранение каждые две секунды
    // сериализовало всю базу позиций впустую — даже когда ридер закрыт
    this._dirty = false;

    this.registerView(VIEW_TYPE_READER, (leaf) => new ReaderView(leaf, this));

    // единственная ribbon-кнопка: открывает библиотеку (книги + импорт + добавление заметок)
    this.addRibbonIcon('book-open', t('ribbonLib'), () => this.openLibrary());

    this.addCommand({ id: 'open-library', name: t('cmdLibrary'), callback: () => this.openLibrary() });

    // вернуться к последней книге одной командой, минуя список
    this.addCommand({ id: 'continue-reading', name: t('cmdContinue'), callback: () => this.continueReading() });

    this.addCommand({
      id: 'open-current-in-reader',
      name: t('cmdOpen'),
      checkCallback: (checking) => {
        const f = this.app.workspace.getActiveFile();
        if (f && f.extension === 'md') {
          if (!checking) this.openReader(f);
          return true;
        }
        return false;
      },
    });

    // команды, доступные только когда активна вкладка ридера
    const readerCmd = (id, name, fn) => this.addCommand({
      id,
      name,
      checkCallback: (checking) => {
        const v = this.app.workspace.getActiveViewOfType(ReaderView);
        if (!v) return false;
        if (!checking) fn(v);
        return true;
      },
    });
    readerCmd('open-toc', t('cmdToc'), (v) => v.openToc());
    readerCmd('search-book', t('cmdSearch'), (v) => v.openSearch());
    readerCmd('toggle-bookmark', t('cmdBookmark'), (v) => v.toggleBookmark());
    readerCmd('open-bookmarks', t('cmdBookmarks'), (v) => v.openBookmarks());
    readerCmd('appearance', t('cmdAppearance'), (v) => v.openAppearance());
    readerCmd('next-chapter', t('cmdNextChapter'), (v) => v.stepChapter(1));
    readerCmd('prev-chapter', t('cmdPrevChapter'), (v) => v.stepChapter(-1));
    readerCmd('edit-note', t('cmdEdit'), (v) => v.openInEditor());
    readerCmd('exit-reader', t('cmdExit'), (v) => this.exitReader(v.leaf));
    readerCmd('jump-back', t('menuBack'), (v) => v.jumpBack());
    readerCmd('font-bigger', t('cmdFontBigger'), () => this.stepFontSize(1));
    readerCmd('font-smaller', t('cmdFontSmaller'), () => this.stepFontSize(-1));
    if (Platform.isDesktop) {
      readerCmd('toggle-fullscreen', t('cmdFullscreen'), (v) => this.toggleFullscreen(v.contentEl.ownerDocument));
    }

    // тонировку удобно менять на ходу (вечером — «Ночь»), не лазая в настройки
    this.addCommand({ id: 'cycle-tint', name: t('cmdTint'), callback: () => this.cycleTint() });

    // импорт книги через системный выбор файла — работает и вне vault, и на мобиле
    this.addCommand({ id: 'import-book', name: t('cmdImport'), callback: () => this.importBook() });

    // конвертация файла книги, лежащего в vault (доступно, если он виден в проводнике)
    this.registerEvent(this.app.workspace.on('file-menu', (menu, file) => {
      if (file instanceof TFile && CONVERTERS[file.extension.toLowerCase()]) {
        menu.addItem((i) => i
          .setTitle(t('menuConvert'))
          .setIcon('book-open')
          .onClick(() => this.convertVaultFile(file)));
      }
    }));

    this.registerEvent(this.app.workspace.on('file-menu', (menu, file) => {
      if (file instanceof TFile && file.extension === 'md') {
        menu.addItem((i) => i
          .setTitle(t('menuOpen'))
          .setIcon('book-open')
          .onClick(() => this.openReader(file)));
      }
    }));

    this.addSettingTab(new ReaderSettingTab(this.app, this));

    this.registerEvent(this.app.workspace.on('active-leaf-change', (leaf) => this.applyImmersive(leaf)));

    this.registerEvent(this.app.vault.on('rename', (file, oldPath) => {
      // перенести сохранённые позиции: сам объект и (если переименовали ПАПКУ) файлы внутри
      const move = (from, to) => { if (this.db[from]) { this.db[to] = this.db[from]; delete this.db[from]; } };
      move(oldPath, file.path);
      const prefix = oldPath + '/';
      for (const key of Object.keys(this.db)) {
        if (key.startsWith(prefix)) move(key, file.path + '/' + key.slice(prefix.length));
      }
      // список библиотеки хранит пути — обновить их так же (файл и содержимое папки)
      this.library = this.library.map((p) =>
        p === oldPath ? file.path : (p.startsWith(prefix) ? file.path + '/' + p.slice(prefix.length) : p));
      // синхронизировать путь открытых ридеров с актуальным TFile.path (Obsidian уже
      // обновил его — это покрывает и переименование самого файла, и его папки), иначе
      // getState() сохранит устаревший filePath и после перезапуска заметка «не найдётся»
      this.app.workspace.getLeavesOfType(VIEW_TYPE_READER).forEach((l) => {
        const v = l.view;
        if (v && v.file) v.filePath = v.file.path;
      });
    }));
    // заметку правят в соседней вкладке — ридер догоняет, а не показывает старый текст
    this.registerEvent(this.app.vault.on('modify', (file) => {
      this.app.workspace.getLeavesOfType(VIEW_TYPE_READER).forEach((l) => {
        // у отложенной (ещё не открытой) вкладки вместо вьюхи заглушка — instanceof обязателен
        const v = l.view;
        if (v instanceof ReaderView && v.file === file) v.scheduleReload();
      });
    }));
    this.registerEvent(this.app.vault.on('delete', (file) => {
      if (this.db[file.path]) delete this.db[file.path];
      this.library = this.library.filter((p) => p !== file.path && !p.startsWith(file.path + '/'));
      // если удалённая заметка открыта в ридере — прервать идущий рендер (иначе он
      // упадёт на this.file.basename), обнулить ссылки, чтобы savePos/goTo не
      // воскресили ключ в db и getState() не сохранил путь мёртвого файла
      this.app.workspace.getLeavesOfType(VIEW_TYPE_READER).forEach((l) => {
        const v = l.view;
        if (v && v.filePath === file.path) {
          v._renderGen++;
          v.file = null;
          v.filePath = null;
          v.chapters = null;
          v.toc = [];
          if (v.clearCache) v.clearCache();
          if (v.content) { v.content.empty(); v.content.createDiv('hr-empty').setText(t('notFound')); }
        }
      });
    }));

    this.registerInterval(window.setInterval(() => {
      if (!this._dirty) return;
      this._dirty = false;
      const s = JSON.stringify(this.dataBlob());
      if (s !== this.lastSaved) { this.saveData(JSON.parse(s)); this.lastSaved = s; }
    }, 2000));
  }

  // отложить запись на диск: ползунок настроек шлёт onChange на каждый шаг, и
  // сохранять файл на каждый — значит писать его десятками раз за одну протяжку
  queueSave() {
    this._dirty = true;
    this.refreshOpenViews();
  }

  onunload() {
    // do NOT detach leaves here (keeps layout intact across plugin updates)
    // панели вернуть ДО записи: иначе выключение плагина посреди книги оставило бы
    // их свёрнутыми, и вернуть их было бы уже некому
    this.restoreSidebars();
    this.saveData(this.dataBlob());
    this.setSysStatusBar(false); // вернуть системную панель, если прятали
    this.setFullscreen(document, false); // и окно из полного экрана
    if (this._immersiveDoc && this._immersiveDoc !== document) this.setFullscreen(this._immersiveDoc, false);
    if (this._tabsEl && this._tabsEl.classList) this._tabsEl.classList.remove('hr-reader-tabs');
    this._tabsEl = null;
    document.body.classList.remove('hr-immersive', 'hr-chrome-hidden');
    // а также с документа попап-окна, если классы висели там и оно ещё живо
    if (this._immersiveDoc && this._immersiveDoc !== document && this._immersiveDoc.body) {
      this._immersiveDoc.body.classList.remove('hr-immersive', 'hr-chrome-hidden');
    }
    this._immersiveDoc = null;
  }

  dataBlob() {
    return Object.assign({}, this.settings, {
      positions: this.db, library: this.library, perf: this.perf, sidebarPrev: this.sidebarPrev,
    });
  }

  async saveAll() {
    const blob = this.dataBlob();
    this._dirty = false;
    await this.saveData(blob);
    this.lastSaved = JSON.stringify(blob);
  }

  async openReader(file) {
    // заходим в книгу — значит заходим и в иммерсив, даже если в прошлый раз
    // хром был показан руками
    this._chromeShown = false;
    // книга уже открыта в ридере — показать ту вкладку, а не плодить копии.
    // Путь берём из состояния ЛИСТА, а не из view: у отложенной (ещё не открытой
    // после перезапуска) вкладки вместо вьюхи лежит заглушка без наших полей
    const open = this.app.workspace.getLeavesOfType(VIEW_TYPE_READER).find((l) => {
      const st = l.getViewState();
      return !!(st && st.state && st.state.filePath === file.path);
    });
    if (open) {
      await this.app.workspace.revealLeaf(open);
      if (open.loadIfDeferred) await open.loadIfDeferred();
      this.applyImmersive(open);
      if (this.settings.fullscreen && Platform.isDesktop) this.setFullscreen(this.docForLeaf(open), true);
      this.db[file.path] = Object.assign({}, this.db[file.path], { t: Date.now() });
      this._dirty = true;
      return;
    }

    const mode = this.settings.openIn;
    let leaf;
    if (mode === 'current') leaf = this.app.workspace.getLeaf(false);
    else if (mode === 'split') leaf = this.app.workspace.getLeaf('split');
    else if (mode === 'window') leaf = this.app.workspace.getLeaf('window');
    else leaf = this.app.workspace.getLeaf('tab');

    await leaf.setViewState({ type: VIEW_TYPE_READER, active: true, state: { filePath: file.path } });
    this.app.workspace.revealLeaf(leaf);
    this.applyImmersive(leaf);
    // включаем полный экран именно здесь: сюда мы попадаем по клику или команде,
    // а запрос на полный экран разрешён только из пользовательского жеста
    if (this.settings.fullscreen && Platform.isDesktop) this.setFullscreen(this.docForLeaf(leaf), true);
    // отметить время открытия (даже если ни разу не листнули) — для порядка в библиотеке
    this.db[file.path] = Object.assign({}, this.db[file.path], { t: Date.now() });
  }

  async cycleTint() {
    const order = ['none'].concat(TINTS);
    const i = order.indexOf(this.settings.tint);
    this.settings.tint = order[(i + 1) % order.length];
    await this.saveAll();
    this.refreshOpenViews();
    new Notice(t('sTint') + ': ' + t(TINT_LABEL[this.settings.tint]));
  }

  /* ---------- library ---------- */

  openLibrary() { new LibraryModal(this.app, this).open(); }

  // содержимое библиотеки: .md из папки импорта + добавленные вручную; свежие сверху
  libraryFiles() {
    const out = [];
    const seen = new Set();
    // пустая настройка = корень vault; его НЕ листаем — там весь vault, а не библиотека.
    // Ищем без учёта регистра: «books» в настройке и «Books» в хранилище — одна папка
    const folder = this.settings.importFolder ? this.resolvePath(this.settings.importFolder) : null;
    if (folder instanceof TFolder) {
      // вместе с подпапками: книги удобно раскладывать по авторам/сериям.
      // Папки картинок (…​.assets) пропускаем — .md там всё равно нет
      const walk = (dir) => dir.children.forEach((f) => {
        if (f instanceof TFolder) { if (!f.name.endsWith('.assets')) walk(f); }
        else if (f instanceof TFile && f.extension === 'md') { out.push({ file: f, registered: false }); seen.add(f.path); }
      });
      walk(folder);
    }
    this.library.forEach((p) => {
      if (seen.has(p)) return;
      const f = this.app.vault.getAbstractFileByPath(p);
      if (f instanceof TFile) { out.push({ file: f, registered: true }); seen.add(p); }
    });
    // «недавнее»: заметки, которые читали ридером, но которых нет ни в папке книг,
    // ни в добавленных вручную. Берём только записи со временем — у легаси-позиций
    // (v1.1) его нет, и «недавним» такое называть нечестно
    const recents = [];
    Object.keys(this.db).forEach((p) => {
      if (seen.has(p)) return;
      const rec = this.db[p];
      if (!rec || !rec.t) return;
      const f = this.app.vault.getAbstractFileByPath(p);
      if (f instanceof TFile) recents.push({ file: f, recent: true, t: rec.t });
    });
    recents.sort((a, b) => b.t - a.t);
    recents.slice(0, 15).forEach((r) => { out.push(r); seen.add(r.file.path); });
    // последняя читанная — сверху; не открывавшиеся ридером — по времени изменения файла
    const lastRead = (f) => {
      const pos = this.db[f.path];
      return (pos && pos.t) || f.stat.mtime;
    };
    out.sort((a, b) => lastRead(b.file) - lastRead(a.file));
    return out;
  }

  // последняя книга, которую действительно читали (по времени из позиций)
  lastReadFile() {
    let best = null, bestT = 0;
    for (const path of Object.keys(this.db)) {
      const rec = this.db[path];
      if (!rec || !rec.t || rec.t <= bestT) continue;
      const f = this.app.vault.getAbstractFileByPath(path);
      if (f instanceof TFile) { best = f; bestT = rec.t; }
    }
    return best;
  }

  continueReading() {
    const f = this.lastReadFile();
    if (!f) { new Notice(t('noContinue')); return; }
    this.openReader(f);
  }

  async forgetPosition(path) {
    delete this.db[path];
    await this.saveAll();
  }

  /* ---------- подгонка размера блока под машину ---------- */
  // Раскладка колонок линейна по объёму текста (замерено: ~0.28 мс на 1000
  // символов на быстром ПК). Значит, зная реальную скорость ЭТОЙ машины, можно
  // подобрать блок так, чтобы раскладка укладывалась в один кадр: на слабом
  // железе блоки станут меньше сами, без единой настройки.
  noteLayoutRate(ms, chars) {
    if (!(chars > 5000) || !(ms > 0.5)) return; // мелочь и шум не считаем
    const cur = ms / chars;
    const prev = this.perf.rate;
    const next = prev ? prev * 0.7 + cur * 0.3 : cur;
    // на диск пишем, только когда оценка заметно уехала: иначе автосохранение
    // дёргало бы data.json на каждом замере
    if (!prev || Math.abs(next - prev) / prev > 0.15) {
      this.perf.rate = Math.round(next * 1e9) / 1e9;
      this._dirty = true;
    }
  }

  /* ---------- скорость чтения хозяина ---------- */
  // По ней в строке состояния считается «сколько осталось». Копится сама, из
  // обычного листания: подгонять её руками никто не станет
  noteReadSpeed(chars, ms) {
    if (!(chars > 0) || !(ms > 0)) return;
    const cpm = chars / (ms / 60000);
    if (cpm < 200 || cpm > 12000) return; // не чтение: пролистнули или заснули над строкой
    const prev = this.perf.cpm;
    this.perf.cpm = Math.round(prev > 0 ? prev * 0.8 + cpm * 0.2 : cpm);
    this._dirty = true;
  }

  // 1200 символов в минуту ≈ 200 слов — средний темп по прозе. Пока своей оценки нет
  readingSpeed() {
    const cpm = this.perf && this.perf.cpm;
    return cpm > 0 ? cpm : 1200;
  }

  blockTargets() {
    const mobile = Platform.isMobile;
    const rate = this.perf && this.perf.rate;
    let pack = CHAPTER_PACK_TARGET; // запасное значение платформы
    if (rate > 0) {
      const BUDGET = mobile ? 12 : 16; // мс раскладки на блок — примерно один кадр
      const lo = mobile ? 12000 : 20000;
      const hi = mobile ? 60000 : 120000;
      pack = Math.max(lo, Math.min(hi, Math.round(BUDGET / rate / 5000) * 5000));
    }
    // порог «не резать вовсе» — вдвое больше блока: мелкие заметки как были целиком
    return { split: pack * 2, pack, chunk: Math.round(pack * 0.75) };
  }

  // размер шрифта на лету: хоткеи, кнопки панели «Аа», щипок
  stepFontSize(dir) {
    const v = Math.round((this.settings.fontSize + dir * 0.05) * 100) / 100;
    const next = Math.max(0.6, Math.min(2, v));
    if (next === this.settings.fontSize) return;
    this.settings.fontSize = next;
    this.commitFontSize();
  }

  // размер меняют очередями — хоткеем на удержании и щипком; на диск кладём
  // отложенно, чтобы не писать data.json на каждый шаг
  commitFontSize() { this.queueSave(); }

  async addToLibrary(path) {
    if (!this.library.includes(path)) this.library.push(path);
    await this.saveAll();
    this.openLibrary(); // вернуться в библиотеку — добавленная заметка уже в списке
  }

  async removeFromLibrary(path) {
    this.library = this.library.filter((p) => p !== path);
    await this.saveAll();
  }

  /* ---------- book import / conversion ---------- */

  // системный выбор файла (в т.ч. вне vault и на мобиле) -> конвертация
  importBook() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = IMPORT_ACCEPT;
    input.style.display = 'none';
    // отменённый диалог не шлёт change — без этого каждый отказ оставлял бы
    // висеть в body ещё один невидимый input
    input.addEventListener('cancel', () => input.remove(), { once: true });
    input.addEventListener('change', async () => {
      const f = input.files && input.files[0];
      input.remove();
      if (!f) return;
      const ext = (f.name.split('.').pop() || '').toLowerCase();
      if (!CONVERTERS[ext]) { new Notice(t('convertUnsupported')); return; }
      const buf = await f.arrayBuffer();
      await this.runConversion(buf, ext, f.name.replace(/\.[^.]+$/, ''), this.settings.importFolder || '');
    }, { once: true });
    document.body.appendChild(input);
    input.click();
  }

  // конвертация файла книги, уже лежащего в vault (кладём результат рядом с ним)
  async convertVaultFile(file) {
    const ext = file.extension.toLowerCase();
    if (!CONVERTERS[ext]) { new Notice(t('convertUnsupported')); return; }
    const buf = await this.app.vault.readBinary(file);
    await this.runConversion(buf, ext, file.basename, file.parent ? file.parent.path : '');
  }

  async runConversion(buf, ext, base, folder) {
    try {
      new Notice(t('convertStart'));
      let result;
      if (ext === 'fb2') {
        const conv = new Fb2Converter(slugify(base));
        const markdown = conv.convert(decodeBuffer(buf));
        result = { markdown, images: conv.images, title: conv.bookTitle };
      } else if (ext === 'epub') {
        if (typeof DecompressionStream === 'undefined') { new Notice(t('convertNoZip')); return; }
        const conv = new EpubConverter(slugify(base));
        const markdown = await conv.convert(buf);
        result = { markdown, images: conv.images, title: conv.bookTitle };
      } else if (ext === 'txt') {
        result = txtToMarkdown(decodeBuffer(buf), base);
      } else {
        new Notice(t('convertUnsupported'));
        return;
      }

      const title = sanitizeFilename(result.title || base);
      // дальше работаем с папкой в её НАСТОЯЩЕМ регистре: если пользователь написал
      // в настройке «books», а в хранилище лежит «Books», книга должна лечь туда же
      const dir = await this.ensureFolder(folder);

      if (result.images && result.images.length) {
        const assets = await this.ensureFolder((dir ? dir + '/' : '') + slugify(title) + '.assets');
        for (const img of result.images) await this.writeBinarySafe(assets + '/' + img.name, img.bytes);
      }

      const outPath = await this.uniquePath(dir, title, 'md');
      const outFile = await this.app.vault.create(outPath, result.markdown);
      new Notice(t('convertDone'));
      this.openReader(outFile);
    } catch (e) {
      console.error('MD Reader: конвертация не удалась', e);
      new Notice(t('convertFail'));
    }
  }

  /* ---------- пути: регистр ----------
     Obsidian ищет по пути С УЧЁТОМ регистра, а Windows и macOS — без. Значит
     getAbstractFileByPath('books') вернёт null при существующей папке «Books», и
     createFolder('books') полезет создавать её поверх уже существующей — то есть
     в то же самое место на диске. Тот же расклад у vault.create для файлов.
     Поэтому все пути, которые мы собираемся СОЗДАВАТЬ, ищем без учёта регистра. */
  resolvePath(path) {
    if (!path) return null;
    const direct = this.app.vault.getAbstractFileByPath(path);
    if (direct) return direct;
    const want = path.toLowerCase();
    // полный перебор только на промахе — а промах бывает раз в импорт
    return this.app.vault.getAllLoadedFiles().find((f) => f.path.toLowerCase() === want) || null;
  }

  // существующий путь в его настоящем регистре (или исходный, если такого ещё нет)
  realPath(path) {
    const f = this.resolvePath(path);
    return f ? f.path : path;
  }

  // -> путь папки в её настоящем регистре
  async ensureFolder(path) {
    if (!path) return '';
    const found = this.resolvePath(path);
    if (found) return found.path;
    try { await this.app.vault.createFolder(path); } catch (e) { /* уже создана параллельно */ }
    return this.realPath(path);
  }

  async writeBinarySafe(path, bytes) {
    const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    const existing = this.resolvePath(path);
    if (existing instanceof TFile) await this.app.vault.modifyBinary(existing, ab);
    else await this.app.vault.createBinary(path, ab);
  }

  async uniquePath(folder, base, ext) {
    const dir = folder ? folder + '/' : '';
    let name = base;
    let i = 1;
    while (this.resolvePath(dir + name + '.' + ext)) name = base + ' (' + (i++) + ')';
    return dir + name + '.' + ext;
  }

  collapseSidebars() {
    if (!this.settings.collapseSidebars) return;
    const ls = this.app.workspace.leftSplit, rs = this.app.workspace.rightSplit;
    // Запоминаем положение панелей ОДИН раз за заход в чтение — и на диск.
    // Obsidian сохраняет свою раскладку как есть: закрыл программу с открытой книгой —
    // при следующем запуске панели уже свёрнуты, и без записи мы бы посчитали, что
    // такими они и были. Тогда панели не возвращались бы уже никогда
    if (!this.sidebarPrev) {
      this.sidebarPrev = {
        left: ls ? !!ls.collapsed : true,
        right: rs ? !!rs.collapsed : true,
      };
      this._dirty = true;
    }
    if (ls && !ls.collapsed) ls.collapse();
    if (rs && !rs.collapsed) rs.collapse();
  }

  restoreSidebars() {
    // на настройку намеренно НЕ смотрим: если её выключили посреди чтения, панели
    // всё равно надо вернуть — свернули их мы, и больше это сделать некому
    if (!this.sidebarPrev) return;
    const ls = this.app.workspace.leftSplit, rs = this.app.workspace.rightSplit;
    if (ls && this.sidebarPrev.left === false && ls.collapsed) ls.expand();
    if (rs && this.sidebarPrev.right === false && rs.collapsed) rs.expand();
    this.sidebarPrev = null;
    this._dirty = true;
  }

  /* ---------- выход из чтения ---------- */
  // Одно действие вместо трёх: вернуть интерфейс ровно в то положение, в каком он был
  // до книги (панели, шапка, полный экран, системная панель ОС), и закрыть вкладку
  exitReader(leaf) {
    let target = leaf;
    if (!target) {
      const active = this.app.workspace.getActiveViewOfType(ReaderView);
      target = active ? active.leaf : null;
    }
    const doc = this.docForLeaf(target);
    this.setFullscreen(doc, false);
    this.setSysStatusBar(false);
    this._chromeShown = false;
    this.markReaderTabs(null);
    if (doc.body) doc.body.classList.remove('hr-immersive', 'hr-chrome-hidden');
    if (this._immersiveDoc === doc) this._immersiveDoc = null;
    this.restoreSidebars();
    // вкладку закрываем последней: detach уводит активность на соседний лист,
    // а тот через active-leaf-change снова полезет разбираться с иммерсивом
    if (target) target.detach();
  }

  docForLeaf(leaf) {
    const el = leaf && leaf.view && leaf.view.contentEl;
    return (el && el.ownerDocument) || document;
  }

  /* ---------- настоящий полный экран (ПК) ---------- */
  // Разворачиваем ВЕСЬ документ, а не область чтения: у полноэкранного элемента
  // видны только его потомки, а оглавление, поиск и меню живут в body — внутри
  // развёрнутого вьюпорта они бы просто не показались
  isFullscreen(doc) { return !!(doc || document).fullscreenElement; }

  setFullscreen(doc, on) {
    const d = doc || document;
    try {
      if (on) {
        if (d.fullscreenElement || !d.documentElement.requestFullscreen) return;
        // без пользовательского жеста браузер откажет — это нормально, просто молчим
        const p = d.documentElement.requestFullscreen();
        if (p && p.catch) p.catch(() => {});
      } else if (d.fullscreenElement && d.exitFullscreen) {
        const p = d.exitFullscreen();
        if (p && p.catch) p.catch(() => {});
      }
    } catch (e) { /* нет API (мобильный webview) — молча пропускаем */ }
  }

  toggleFullscreen(doc) { this.setFullscreen(doc, !this.isFullscreen(doc)); }

  // Прячет/показывает СИСТЕМНУЮ панель ОС на мобильном через плагин Capacitor StatusBar,
  // который присутствует в сборке Obsidian mobile. Максимально осторожно: если API нет —
  // молча ничего не делаем, так что на десктопе и старых сборках безвредно.
  setSysStatusBar(hide) {
    // класс на body обнуляет зарезервированную под панель safe-area (см. styles.css)
    document.body.classList.toggle('hr-hide-sysbar', !!hide);
    try {
      const cap = window.Capacitor;
      const sb = cap && cap.Plugins && cap.Plugins.StatusBar;
      if (!sb) return;
      const swallow = (p) => { if (p && typeof p.catch === 'function') p.catch(() => {}); };
      // растянуть webview на область панели, чтобы под ней не оставалось пустого отступа
      if (sb.setOverlaysWebView) swallow(sb.setOverlaysWebView({ overlay: !!hide }));
      swallow(hide ? (sb.hide && sb.hide()) : (sb.show && sb.show()));
    } catch (e) { /* API недоступно на этом устройстве */ }
  }

  // Полосу вкладок прячем только у ТОЙ группы, где открыт ридер: селектором от body
  // до неё не добраться, поэтому вешаем метку на элемент группы
  markReaderTabs(leaf) {
    const el = leaf && leaf.view && leaf.view.containerEl;
    const tabs = (el && el.closest) ? el.closest('.workspace-tabs') : null;
    const prev = this._tabsEl;
    if (prev && prev !== tabs && prev.classList) prev.classList.remove('hr-reader-tabs');
    if (tabs) tabs.classList.add('hr-reader-tabs');
    this._tabsEl = tabs;
  }

  applyImmersive(leaf) {
    // без аргумента (обновление настроек) спрашиваем активный ридер, а не
    // устаревшее workspace.activeLeaf: активна не наша вьюха — иммерсив и не нужен
    if (!leaf) {
      const active = this.app.workspace.getActiveViewOfType(ReaderView);
      leaf = active ? active.leaf : null;
    }
    const isReader = !!(leaf && leaf.view && typeof leaf.view.getViewType === 'function'
      && leaf.view.getViewType() === VIEW_TYPE_READER);
    const on = isReader && this.settings.immersive;
    // классы вешаем на body ДОКУМЕНТА листа — в попап-окне (openIn=window) это его
    // собственный body, а не главного окна; иначе иммерсив в попапе не работает и
    // портит вкладки главного окна
    const doc = this.docForLeaf(leaf);
    this.markReaderTabs(on ? leaf : null);
    if (on) {
      // переносим иммерсив на документ этого листа; снимаем с прежнего, только если
      // он другой и ещё жив (у закрытого попап-документа body === null)
      const prev = this._immersiveDoc;
      if (prev && prev !== doc && prev.body) prev.body.classList.remove('hr-immersive', 'hr-chrome-hidden');
      if (doc.body) {
        doc.body.classList.add('hr-immersive');
        // хром, показанный вручную (тап по центру или Escape), больше не прячется сам:
        // раньше переключение вкладок туда-обратно возвращало его в спрятанное состояние
        doc.body.classList.toggle('hr-chrome-hidden', !this._chromeShown);
      }
      this._immersiveDoc = doc;
    } else {
      // ушли из ридера в ЭТОМ документе — снимаем классы только здесь. Чужой
      // _immersiveDoc НЕ трогаем: в другом окне может быть свой активный ридер
      if (doc.body) doc.body.classList.remove('hr-immersive', 'hr-chrome-hidden');
      if (this._immersiveDoc === doc) this._immersiveDoc = null;
    }
    // боковые панели: свёрнуты пока активен ридер, возвращаются когда уходишь из него.
    // Возврат вне проверки настройки — её могли выключить, пока панели уже свёрнуты нами
    if (isReader) this.collapseSidebars();
    else this.restoreSidebars();
    // системная панель ОС (моб.): прячем пока активен иммерсивный ридер и включена опция
    if (Platform.isMobile) this.setSysStatusBar(on && this.settings.hideMobileBar);
    // ушли из ридера — вернуть окно из полного экрана (на выход жест не нужен)
    if (Platform.isDesktop && !isReader) this.setFullscreen(doc, false);
  }

  refreshOpenViews() {
    this.app.workspace.getLeavesOfType(VIEW_TYPE_READER).forEach((l) => {
      const v = l.view;
      if (v && v.applySettings) {
        v.applySettings();
        if (v._debouncedRemeasure) v._debouncedRemeasure();
      }
    });
    this.applyImmersive();
  }
}

module.exports = MdReaderPlugin;
