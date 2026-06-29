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
} = require('obsidian');

const VIEW_TYPE_READER = 'horizontal-reader-view';

const DEFAULT_SETTINGS = {
  fontSize: 1.0,          // multiplier of theme font -> --hr-font-size (em)
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
};

/* ---------- i18n: English by default, Russian when Obsidian language is ru ---------- */
const STRINGS = {
  en: {
    fallbackTitle: 'MD Reader',
    aria: 'Paginated reader. Use arrow keys or swipe to turn pages.',
    notFound: 'Note not found.',
    ribbonOpen: 'Open in MD Reader',
    needMd: 'Open a note (.md) to read it in MD Reader',
    cmdOpen: 'Open current note in MD Reader',
    menuOpen: 'Open in MD Reader',
    settingsTitle: 'MD Reader',
    sPageMode: 'Page mode',
    sPageModeDesc: 'How many pages to show on screen',
    optAuto: 'Auto (two on a wide screen, one on a narrow one)',
    optSingle: 'Always one',
    optDouble: 'Always two (book spread)',
    sMaxWidth: 'Max page width, px',
    sMaxWidthDesc: 'Width of a single page. Smaller is a narrower, more comfortable column. 0 = no limit',
    sFontSize: 'Font size',
    sFontSizeDesc: "Multiplier relative to your theme's font",
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
  },
  ru: {
    fallbackTitle: 'MD Reader',
    aria: 'Постраничный ридер. Стрелки или свайп — листать страницы.',
    notFound: 'Заметка не найдена.',
    ribbonOpen: 'Открыть в MD Reader',
    needMd: 'Откройте заметку (.md), чтобы читать её в MD Reader',
    cmdOpen: 'Открыть текущую заметку в MD Reader',
    menuOpen: 'Открыть в MD Reader',
    settingsTitle: 'MD Reader',
    sPageMode: 'Режим страниц',
    sPageModeDesc: 'Сколько страниц показывать на экране',
    optAuto: 'Авто (две на широком экране, одна на узком)',
    optSingle: 'Всегда одна',
    optDouble: 'Всегда две (книжный разворот)',
    sMaxWidth: 'Макс. ширина страницы, px',
    sMaxWidthDesc: 'Ширина одной страницы. Меньше — уже колонка, комфортнее читать. 0 — без ограничения',
    sFontSize: 'Размер шрифта',
    sFontSizeDesc: 'Множитель относительно шрифта темы',
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
    this.colGap = 0;
    this.spreadMode = false;

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
    vp.setAttribute('aria-label', t('aria'));

    this.stage = vp.createDiv('hr-stage');
    this.content = this.stage.createDiv('hr-content');

    this.prevBtn = vp.createEl('button', { cls: 'hr-nav-btn hr-prev hr-ui', attr: { 'aria-label': 'Prev' } });
    this.prevBtn.setText('‹');
    this.nextBtn = vp.createEl('button', { cls: 'hr-nav-btn hr-next hr-ui', attr: { 'aria-label': 'Next' } });
    this.nextBtn.setText('›');

    const bar = vp.createDiv('hr-statusbar hr-ui');
    bar.setAttribute('aria-live', 'polite');
    this.progress = bar.createDiv('hr-progress');
    this.progressFill = this.progress.createDiv('hr-progress-fill');
    this.statusText = bar.createDiv('hr-status-text');
    this.statusText.setText('1 / 1');

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
    if (this.ro) { this.ro.disconnect(); this.ro = null; }
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = 0; }
    if (this._repaginateTimer) { clearTimeout(this._repaginateTimer); this._repaginateTimer = null; }
    this.savePos();
    if (this.renderChild) { this.removeChild(this.renderChild); this.renderChild = null; }
    if (this.contentEl) this.contentEl.empty();
  }

  /* ---------- render ---------- */
  async renderFile() {
    if (!this.content) return;
    if (!this.file) {
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

    if (this.renderChild) { this.removeChild(this.renderChild); this.renderChild = null; }
    this.renderChild = new Component();
    this.addChild(this.renderChild);

    this.content.empty();
    this.content.style.transform = 'translateX(0px)';
    this.page = 0;

    await MarkdownRenderer.render(this.app, body, this.content, this.file.path, this.renderChild);
    if (gen !== this._renderGen) return;

    if (this.plugin.settings.showTitle) {
      const first = this.content.firstElementChild;
      if (!(first && first.tagName === 'H1')) {
        const tt = this.content.createEl('h1', { cls: 'hr-title', text: this.file.basename });
        this.content.insertBefore(tt, this.content.firstChild);
      }
    }

    const saved = this.plugin.settings.rememberPosition && this.plugin.db[this.file.path];
    this._pendingFraction = saved ? (this.plugin.db[this.file.path].fraction || 0) : 0;

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
      this.measure();
      if (this._pendingFraction) {
        this.goTo(Math.round(this._pendingFraction * (this.totalPages - 1)));
        this._pendingFraction = 0;
      }
      this.updateStatus();
    });

    if (this.viewport) this.viewport.focus();
    if (this.leaf && this.leaf.updateHeader) this.leaf.updateHeader();
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
    this.spreadMode = n === 2;

    this.stage.style.width = stageW + 'px';
    this.stage.classList.toggle('hr-two', n === 2);
    this.content.style.width = stageW + 'px';
    this.content.style.columnWidth = pageW + 'px';

    this.colGap = gap;
    this.pageStride = stageW + gap;

    const sw = this.content.scrollWidth;
    this.totalPages = Math.max(1, Math.round((sw + gap) / this.pageStride));
    if (this.page > this.totalPages - 1) this.page = this.totalPages - 1;
    if (this.page < 0) this.page = 0;

    this.applyTransform();
    this.updateStatus();
  }

  applyTransform() {
    if (this.content) {
      this.content.style.transform = 'translateX(' + (-this.page * this.pageStride) + 'px)';
    }
  }

  goTo(p) {
    const np = Math.max(0, Math.min(p, this.totalPages - 1));
    this.page = isFinite(np) ? np : 0;
    this.applyTransform();
    this.updateStatus();
    this.savePos();
  }
  next() { this.goTo(this.page + 1); }
  prev() { this.goTo(this.page - 1); }

  updateStatus() {
    if (this.statusText) this.statusText.setText((this.page + 1) + ' / ' + this.totalPages);
    if (this.progressFill) {
      const pct = this.totalPages > 0 ? ((this.page + 1) / this.totalPages) * 100 : 0;
      this.progressFill.style.width = pct + '%';
    }
  }

  savePos() {
    const s = this.plugin.settings;
    if (!s.rememberPosition || !this.file) return;
    this.plugin.db[this.file.path] = {
      fraction: this.totalPages > 1 ? this.page / (this.totalPages - 1) : 0,
    };
  }

  applySettings() {
    const s = this.plugin.settings;
    const c = this.content;
    if (!c) return;
    c.style.setProperty('--hr-font-size', s.fontSize + 'em');
    c.style.setProperty('--hr-line-height', String(s.lineHeight));
    c.style.setProperty('--hr-col-gap', s.columnGap + 'em');
    c.style.transition = s.animate ? 'transform 0.2s ease' : 'none';
  }

  setupRepagination() {
    const repaginate = () => {
      if (this._repaginateTimer) clearTimeout(this._repaginateTimer);
      this._repaginateTimer = setTimeout(() => {
        this._repaginateTimer = null;
        if (!this.content || !this.content.isConnected) return;
        const frac = this.totalPages > 1 ? this.page / (this.totalPages - 1) : 0;
        this.measure();
        this.goTo(Math.round(frac * (this.totalPages - 1)));
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
      document.body.classList.toggle('hr-chrome-hidden');
    } else if (this.viewport) {
      this.viewport.classList.toggle('hr-hide-ui');
    }
  }

  exitReadingChrome() {
    // Esc: «дочитал» — вернуть весь интерфейс (боковые панели + хром Obsidian + наши контролы)
    document.body.classList.remove('hr-chrome-hidden');
    if (this.viewport) this.viewport.classList.remove('hr-hide-ui');
    if (this.plugin && this.plugin.restoreSidebars) this.plugin.restoreSidebars();
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
    reg([], 'Home', () => this.goTo(0));
    reg([], 'End', () => this.goTo(this.totalPages - 1));
    reg([], 'Escape', () => this.exitReadingChrome());
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

    const abortDrag = () => {
      if (dragging) {
        dragging = false; decided = false; horizontal = false;
        this.content.style.transition = this.plugin.settings.animate ? 'transform 0.2s ease' : 'none';
        this.applyTransform();
      }
    };

    const interactive = (tg) => !!(tg && tg.closest && tg.closest(
      'a, input, button, textarea, select, [contenteditable], .task-list-item-checkbox, .callout-fold, .footnote-link, audio, video, .hr-ui'
    ));

    this.registerDomEvent(vp, 'touchstart', (e) => {
      if (e.touches.length !== 1) { abortDrag(); return; }
      const tc = e.touches[0];
      if (Math.min(tc.clientX, window.innerWidth - tc.clientX) < OS_EDGE) { abortDrag(); return; }
      x0 = tc.clientX; y0 = tc.clientY; t0 = Date.now();
      dragging = true; decided = false; horizontal = false;
      this.content.style.transition = 'none';
    }, { capture: true, passive: true });

    this.registerDomEvent(vp, 'touchmove', (e) => {
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
    this.registerDomEvent(vp, 'touchcancel', () => abortDrag(), { capture: true, passive: true });

    this.registerDomEvent(vp, 'click', (e) => {
      if (this._lastTouch && Date.now() - this._lastTouch < 700) return;
      if (interactive(e.target)) return;
      if (!this.plugin.settings.tapZones) return;
      const r = vp.getBoundingClientRect();
      const x = e.clientX - r.left, w = vp.clientWidth;
      if (x < w * 0.3) this.prev();
      else if (x > w * 0.7) this.next();
      else this.toggleControls();
    });

    if (Platform.isDesktop) {
      let wheelLock = false;
      this.registerDomEvent(vp, 'wheel', (e) => {
        const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        if (Math.abs(d) < 20) return;
        e.preventDefault();
        if (wheelLock) return;
        wheelLock = true;
        setTimeout(() => { wheelLock = false; }, 350);
        this.goTo(this.page + (d > 0 ? 1 : -1));
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
    containerEl.createEl('h3', { text: t('settingsTitle') });

    const save = async () => {
      await this.plugin.saveAll();
      this.plugin.refreshOpenViews();
    };

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
        .setDynamicTooltip().onChange(async (v) => { this.plugin.settings.maxPageWidth = v; await save(); }));

    new Setting(containerEl)
      .setName(t('sFontSize'))
      .setDesc(t('sFontSizeDesc'))
      .addSlider((sl) => sl.setLimits(0.6, 2.0, 0.05).setValue(this.plugin.settings.fontSize)
        .setDynamicTooltip().onChange(async (v) => { this.plugin.settings.fontSize = v; await save(); }));

    new Setting(containerEl)
      .setName(t('sLineHeight'))
      .addSlider((sl) => sl.setLimits(1.2, 2.4, 0.05).setValue(this.plugin.settings.lineHeight)
        .setDynamicTooltip().onChange(async (v) => { this.plugin.settings.lineHeight = v; await save(); }));

    new Setting(containerEl)
      .setName(t('sGap'))
      .addSlider((sl) => sl.setLimits(0.5, 5, 0.25).setValue(this.plugin.settings.columnGap)
        .setDynamicTooltip().onChange(async (v) => { this.plugin.settings.columnGap = v; await save(); }));

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
  }
}

/* ============================================================
   Plugin
   ============================================================ */
class MdReaderPlugin extends Plugin {
  async onload() {
    const loaded = (await this.loadData()) || {};
    this.settings = Object.assign({}, DEFAULT_SETTINGS, loaded);
    this.db = loaded.positions || {};
    delete this.settings.positions;
    this.lastSaved = JSON.stringify(this.dataBlob());

    this.registerView(VIEW_TYPE_READER, (leaf) => new ReaderView(leaf, this));

    this.addRibbonIcon('book-open', t('ribbonOpen'), () => {
      const f = this.app.workspace.getActiveFile();
      if (f && f.extension === 'md') this.openReader(f);
      else new Notice(t('needMd'));
    });

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
      if (this.db[oldPath]) { this.db[file.path] = this.db[oldPath]; delete this.db[oldPath]; }
    }));
    this.registerEvent(this.app.vault.on('delete', (file) => {
      if (this.db[file.path]) delete this.db[file.path];
    }));

    this.registerInterval(window.setInterval(() => {
      const s = JSON.stringify(this.dataBlob());
      if (s !== this.lastSaved) { this.saveData(JSON.parse(s)); this.lastSaved = s; }
    }, 2000));
  }

  onunload() {
    // do NOT detach leaves here (keeps layout intact across plugin updates)
    this.saveData(this.dataBlob());
    document.body.classList.remove('hr-immersive');
    document.body.classList.remove('hr-chrome-hidden');
  }

  dataBlob() {
    return Object.assign({}, this.settings, { positions: this.db });
  }

  async saveAll() {
    const blob = this.dataBlob();
    await this.saveData(blob);
    this.lastSaved = JSON.stringify(blob);
  }

  async openReader(file) {
    const mode = this.settings.openIn;
    let leaf;
    if (mode === 'current') leaf = this.app.workspace.getLeaf(false);
    else if (mode === 'split') leaf = this.app.workspace.getLeaf('split');
    else if (mode === 'window') leaf = this.app.workspace.getLeaf('window');
    else leaf = this.app.workspace.getLeaf('tab');

    await leaf.setViewState({ type: VIEW_TYPE_READER, active: true, state: { filePath: file.path } });
    this.app.workspace.revealLeaf(leaf);
    this.applyImmersive(leaf);
  }

  collapseSidebars() {
    if (!this.settings.collapseSidebars) return;
    const ls = this.app.workspace.leftSplit, rs = this.app.workspace.rightSplit;
    if (!this._sidebarPrev) {
      this._sidebarPrev = {
        left: ls ? ls.collapsed : true,
        right: rs ? rs.collapsed : true,
      };
    }
    if (ls && !ls.collapsed) ls.collapse();
    if (rs && !rs.collapsed) rs.collapse();
  }

  restoreSidebars() {
    if (!this.settings.collapseSidebars || !this._sidebarPrev) return;
    const ls = this.app.workspace.leftSplit, rs = this.app.workspace.rightSplit;
    if (ls && this._sidebarPrev.left === false && ls.collapsed) ls.expand();
    if (rs && this._sidebarPrev.right === false && rs.collapsed) rs.expand();
    this._sidebarPrev = null;
  }

  applyImmersive(leaf) {
    leaf = leaf || this.app.workspace.activeLeaf;
    const isReader = !!(leaf && leaf.view && typeof leaf.view.getViewType === 'function'
      && leaf.view.getViewType() === VIEW_TYPE_READER);
    const on = isReader && this.settings.immersive;
    document.body.classList.toggle('hr-immersive', on);
    if (on) document.body.classList.add('hr-chrome-hidden');
    else document.body.classList.remove('hr-chrome-hidden');
    // боковые панели: свёрнуты пока активен ридер, возвращаются когда уходишь из него
    if (this.settings.collapseSidebars) {
      if (isReader) this.collapseSidebars();
      else this.restoreSidebars();
    }
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
