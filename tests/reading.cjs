/* Chromium integration tests for reading anchors, appearance and visible controls.
 * Uses real DOM/layout, with only the Obsidian host and Markdown rendering stubbed.
 * Environment: PLAYWRIGHT_MODULE, CHROMIUM_PATH; optional READER_SCREENSHOT. */
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const source = readFileSync(join(__dirname, '../main.js'), 'utf8');
const css = readFileSync(join(__dirname, '../styles.css'), 'utf8');

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 780 } });
    await page.setContent(`<style>
      * { box-sizing: border-box; } body { margin: 0; font: 18px Georgia; }
      body { --font-text: Georgia; --font-text-size: 18px; --background-primary: #faf8f3;
        --background-modifier-border: #ccc; --text-normal: #262421; --text-muted: #666; --interactive-accent: #6b5d9c; }
      .workspace-leaf-content { height: 100vh; } .modal-container { z-index: 100; position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; }
      .modal-bg { position: absolute; inset: 0; background: #000; opacity: .6; }
      .modal { position: relative; background: white; padding: 20px; border: 1px solid #ccc; overflow: auto; border-radius: 12px; }
      .modal-title { font: bold 22px sans-serif; margin-bottom: 12px; } .setting-item { display: flex; justify-content: space-between; gap: 12px; }
      button, select, input { font: 14px sans-serif; } button { border: 1px solid #ccc; border-radius: 6px; padding: 7px; cursor: pointer; }
      button:not(.clickable-icon) { background: #eef0f4; }
      button:not(.clickable-icon):hover { background: #ddd; }
      .hr-ap { font: 14px sans-serif; } p { margin: 0 0 1em; }
    </style><style>${css}</style><body></body>`);
    await page.evaluate(({ source }) => {
      HTMLElement.prototype.createEl = function(tag, options = {}) {
        if (typeof options === 'string') options = { cls: options };
        const el = document.createElement(tag);
        el.className = options.cls || '';
        if (options.text) el.textContent = options.text;
        for (const [key, value] of Object.entries(options.attr || {})) el.setAttribute(key, value);
        this.append(el); return el;
      };
      HTMLElement.prototype.createDiv = function(o) { return this.createEl('div', o); };
      HTMLElement.prototype.createSpan = function(o) { return this.createEl('span', o); };
      HTMLElement.prototype.empty = function() { this.replaceChildren(); };
      HTMLElement.prototype.setText = function(t) { this.textContent = t; };
      HTMLElement.prototype.addClass = function(c) { this.classList.add(c); };
      HTMLElement.prototype.removeClass = function(c) { this.classList.remove(c); };
      HTMLElement.prototype.toggleClass = function(c, v) { this.classList.toggle(c, v); };
      class Stub {}
      class ItemView {
        constructor(leaf) {
          this.leaf = leaf; this.app = leaf.app;
          this.containerEl = document.body.createDiv('workspace-leaf-content');
          this.containerEl.dataset.type = 'horizontal-reader-view';
          this.contentEl = this.containerEl.createDiv('view-content');
        }
        registerDomEvent(el, type, fn) { el.addEventListener(type, fn); }
        registerEvent() {} addChild() {} removeChild() {}
        async setState() {}
      }
      class TFile { constructor(path) { this.path = path; this.basename = path.replace(/\.md$/, ''); this.extension = 'md'; } }
      class Modal {
        constructor(app) {
          this.app = app;
          this.containerEl = document.body.createDiv('modal-container');
          this.containerEl.createDiv('modal-bg');
          this.modalEl = this.containerEl.createDiv('modal');
          this.titleEl = this.modalEl.createDiv('modal-title');
          this.contentEl = this.modalEl.createDiv('modal-content');
        }
        open() { window.lastModal = this; this.onOpen(); }
        close() { this.onClose(); this.containerEl.remove(); }
      }
      class Setting {
        constructor(el) { this.el = el.createDiv('setting-item'); this.name = this.el.createSpan('setting-item-info'); this.controls = this.el.createDiv('setting-item-control'); }
        setName(n) { this.name.textContent = n; return this; }
        setDesc() { return this; }
        setHeading() { return this; }
        addSlider(cb) { return this.control('input', 'range', cb); }
        addToggle(cb) { return this.control('input', 'checkbox', cb); }
        addDropdown(cb) { return this.control('select', '', cb); }
        addText(cb) { return this.control('input', 'text', cb); }
        control(tag, type, cb) {
          const el = this.controls.createEl(tag); if (type) el.type = type;
          el.setAttribute('aria-label', this.name.textContent);
          const chain = {
            setLimits(min, max, step) { Object.assign(el, { min, max, step }); return chain; },
            setValue(value) { el.value = value; el.checked = !!value; return chain; },
            setDynamicTooltip() { return chain; }, setPlaceholder(p) { el.placeholder = p; return chain; },
            addOptions(options) { for (const [value, label] of Object.entries(options)) el.add(new Option(label, value)); return chain; },
            onChange(fn) { el.addEventListener('input', () => fn(type === 'range' ? Number(el.value) : type === 'checkbox' ? el.checked : el.value)); return chain; },
          }; cb(chain); return this;
        }
      }
      class Menu {
        addItem(cb) { const item = { setTitle() { return item; }, setIcon() { return item; }, onClick() { return item; } }; cb(item); }
        addSeparator() {} showAtPosition(p) { window.menuPosition = p; }
      }
      const api = new Proxy({ ItemView, Modal, Setting, Menu, TFile,
        Platform: { isDesktop: true, isMobile: false },
        MarkdownRenderer: { async render(app, text, el) {
          for (const paragraph of text.split(/\n\s*\n/)) el.createEl('p', { text: paragraph });
        } },
      }, { get: (o, k) => o[k] || Stub });
      const exports = new Function('require', 'module', source + '\nreturn { ReaderView, MdReaderPlugin, DEFAULT_SETTINGS, anchorMatch, anchorSourceText };')(() => api, { exports: {} });
      Object.assign(window, exports);
      window.rawBook = Array.from({ length: 180 }, (_, i) => `Paragraph ${i}: ` + `This is passage number ${i}, with enough ordinary text to fill a reading line. `.repeat(8)).join('\n\n');
      const bookFile = new TFile('book.md');
      const app = { vault: { cachedRead: async () => window.rawBook, getAbstractFileByPath: () => bookFile }, metadataCache: { getFileCache: () => null },
        workspace: { getLeavesOfType: () => [window.leaf], on() {} } };
      const plugin = Object.create(exports.MdReaderPlugin.prototype);
      Object.assign(plugin, { app, settings: { ...exports.DEFAULT_SETTINGS, immersive: false, animate: false }, db: {}, perf: {},
        blockTargets: () => ({ split: 200000, pack: 60000 }), noteLayoutRate() {}, saveAll: async () => {},
        applyImmersive() {}, isFullscreen: () => false, queueSave() { this.refreshOpenViews(); },
      });
      const leaf = { app };
      const view = new exports.ReaderView(leaf, plugin); leaf.view = view;
      Object.assign(view, { buildScope() {}, setupInput() {}, pushScope() {}, popScope() {}, schedulePrefetch() {},
        file: bookFile });
      Object.assign(window, { view, plugin, leaf, bookFile });
    }, { source });
    const results = [];
    const check = async (name, fn) => {
      const result = await page.evaluate(fn);
      if (result !== true) throw new Error(name + ': ' + JSON.stringify(result));
      results.push(name);
    };
    await page.evaluate(async () => { await view.onOpen(); await view.renderFile(); });
    await page.waitForTimeout(400);
    await check('capture a character inside a continued paragraph', () => {
      view.goTo(12); window.original = view.captureAnchor();
      return !!original && view.anchorPage(original) === 12 && original.quote.length === 96;
    });
    await page.evaluate(() => {
      window.quotePage = view.page;
      const index = view.textIndex();
      const at = index.text.indexOf(original.quote);
      const range = index.rangeAt(at);
      const end = index.rangeAt(at + 30);
      range.setEnd(end.endContainer, end.endOffset);
      const selection = document.getSelection(); selection.removeAllRanges(); selection.addRange(range);
      window.expectedQuote = selection.toString();
      plugin.saveQuote = async (quote) => { window.savedQuote = quote; return { path: 'Books/Quotes/book.md' }; };
    });
    await page.getByRole('button', { name: 'Save selected text as a quote', exact: true }).click();
    await check('quote button saves the selection without changing pages', () => savedQuote.text === expectedQuote && savedQuote.file === bookFile && view.page === quotePage);
    await check('quote links to the heading before the selection, not a later heading', () => {
      const local = Object.create(ReaderView.prototype);
      local.content = document.body.createDiv(); local.file = bookFile; local.chapterIndex = 0;
      local.content.innerHTML = '<h2>First</h2><p>Selected passage.</p><h2>Second</h2><p>Later passage.</p>';
      local.toc = [{ chapter: 0, hIndex: 0, text: 'First' }, { chapter: 0, hIndex: 1, text: 'Second' }];
      const range = document.createRange(); range.selectNodeContents(local.content.querySelector('p'));
      const selection = document.getSelection(); selection.removeAllRanges(); selection.addRange(range);
      const snapshot = local.selectedQuote(); local.content.remove(); selection.removeAllRanges();
      return snapshot.heading === 'First' && snapshot.text === 'Selected passage.';
    });
    await page.evaluate(() => { document.getSelection().removeAllRanges(); });
    await page.getByRole('button', { name: 'Appearance', exact: true }).click();
    await check('swatches keep their colors over host button styles', () => {
      const expected = ['rgb(244, 236, 216)', 'rgb(251, 246, 234)', 'rgb(233, 233, 230)', 'rgb(12, 12, 14)'];
      const actual = [...document.querySelectorAll('.hr-ap-tint')].slice(1).map(el => getComputedStyle(el).backgroundColor);
      return JSON.stringify(actual) === JSON.stringify(expected) || actual;
    });
    await page.locator('.hr-ap-tint-night').hover();
    await check('hover preserves the night swatch color', () => getComputedStyle(document.querySelector('.hr-ap-tint-night')).backgroundColor === 'rgb(12, 12, 14)');
    await page.locator('.hr-ap-tint-night').click();
    await check('selecting a swatch changes the book tint', () => plugin.settings.tint === 'night' && getComputedStyle(view.viewport).backgroundColor === 'rgb(12, 12, 14)');
    await page.getByLabel('Show time left', { exact: true }).uncheck();
    await check('issue #2: time can be hidden independently', () => getComputedStyle(view._statusEls.left).display === 'none' && getComputedStyle(view.scrubEl).display !== 'none');
    await page.getByLabel('Show progress bar', { exact: true }).uncheck();
    await page.getByLabel('Show page number and percentage', { exact: true }).uncheck();
    await page.getByLabel('Show chapter name', { exact: true }).uncheck();
    await page.waitForTimeout(350);
    await check('issue #2: all indicators can be hidden while controls remain accessible', () =>
      getComputedStyle(view.scrubEl).display === 'none' && getComputedStyle(view.statusText).visibility === 'hidden' &&
      getComputedStyle(document.querySelector('.hr-reader-menu')).visibility === 'visible' &&
      getComputedStyle(document.querySelector('.hr-reader-appearance')).visibility === 'visible');
    await page.getByRole('button', { name: 'Compact', exact: true }).click();
    await page.waitForTimeout(350);
    await check('preset applies live and keeps the same text visible', () => plugin.settings.horizontalPadding === 12 && view.anchorPage(original) === view.page);
    await check('presets do not undo hidden progress preferences', () => !plugin.settings.showProgressBar && !plugin.settings.showTimeLeft);
    for (const name of ['Show time left', 'Show progress bar', 'Show page number and percentage', 'Show chapter name']) {
      await page.getByLabel(name, { exact: true }).check();
    }
    await page.waitForTimeout(350);
    await check('issue #2: indicators can be shown again without losing position', () =>
      getComputedStyle(view.scrubEl).display !== 'none' && getComputedStyle(view._statusEls.left).display !== 'none' && view.anchorPage(original) === view.page);
    await page.getByLabel('Side margins, px', { exact: true }).fill('60');
    await page.waitForTimeout(350);
    await check('side margins change live', () => {
      const vp = view.viewport.getBoundingClientRect(), stage = view.stage.getBoundingClientRect();
      return plugin.settings.horizontalPadding === 60 && stage.left - vp.left >= 59 && view.anchorPage(original) === view.page;
    });
    if (process.env.READER_SCREENSHOT) await page.screenshot({ path: process.env.READER_SCREENSHOT });
    await page.getByRole('button', { name: 'Reset appearance', exact: true }).click();
    await page.waitForTimeout(350);
    await check('reset preserves reading preferences and progress', () => plugin.settings.horizontalPadding === 24 && plugin.settings.immersive === false && view.anchorPage(original) === view.page);
    await page.evaluate(() => { lastModal.close(); view.toggleBookmark(); window.bookmark = view.bookmarks()[0]; });
    await check('new bookmarks contain a text anchor', () => !!bookmark.anchor);
    await page.evaluate(async () => {
      view._keepG = view.currentG(); view._keepAnchor = view._readingAnchor;
      rawBook = 'A newly inserted preface. '.repeat(900) + '\n\n' + rawBook;
      plugin.blockTargets = () => ({ split: 5000, pack: 4500 });
      await view.renderFile();
    });
    await page.waitForTimeout(400);
    await check('edits and different chapter splitting retain the original quote', () => view.chapters.length > 2 && view.anchorPage(original) === view.page);
    await page.evaluate(async () => { await view.renderFile(); });
    await page.waitForTimeout(350);
    await check('reopening uses the saved text anchor', () => view.anchorPage(original) === view.page && !!plugin.db['book.md'].anchor);
    await page.evaluate(() => { view.goToG(0); });
    await page.waitForTimeout(350);
    await page.evaluate(() => { view.goToBookmark(bookmark); });
    await page.waitForTimeout(350);
    await check('bookmark survives inserted text and re-splitting', () => view.anchorPage(bookmark.anchor) === view.page);
    await page.setViewportSize({ width: 375, height: 720 });
    await page.waitForTimeout(400);
    await check('narrow viewport preserves the anchored text', () => view.anchorPage(bookmark.anchor) === view.page);
    await check('issue #2: enabled time is also visible on a narrow screen', () => getComputedStyle(view._statusEls.left).display !== 'none');
    await page.getByRole('button', { name: 'Appearance', exact: true }).click();
    if (process.env.READER_SCREENSHOT) await page.screenshot({ path: process.env.READER_SCREENSHOT.replace(/\.png$/, '-mobile.png') });
    await page.evaluate(() => lastModal.close());
    await page.getByRole('button', { name: 'Navigation', exact: true }).focus();
    await page.keyboard.press('Enter');
    await check('menu opens at its visible button from the keyboard', () => !!window.menuPosition && menuPosition.y > 100);
    await page.evaluate(async () => { plugin.db['book.md'] = { g: 0.4, b: [{ g: 0.2, label: 'Old bookmark' }] }; await view.renderFile(); });
    await page.waitForTimeout(350);
    await check('legacy positions and bookmarks still load', () => Math.abs(view.currentG() - 0.4) < 0.05 && view.bookmarks()[0].label === 'Old bookmark');
    await page.evaluate(async () => { plugin.db['book.md'] = { g: 0.6, anchor: { v: 1, quote: 'This passage was deleted from the book.', prefix: '', hint: 0.6 } }; await view.renderFile(); });
    await page.waitForTimeout(350);
    await check('deleted anchored passage restores the fallback percentage', () => Math.abs(view.currentG() - 0.6) < 0.05 && !view._pendingAnchor);
    await page.evaluate(() => { window.pinchAnchor = view._readingAnchor; view.previewFontSize(1.6); });
    await page.waitForTimeout(350);
    await check('pinch font changes preserve the text anchor', () => view.anchorPage(pinchAnchor) === view.page);
    await page.evaluate(() => view.viewport.classList.add('hr-hide-ui'));
    await check('hidden controls cannot capture invisible clicks', () => getComputedStyle(document.querySelector('.hr-reader-menu')).visibility === 'hidden');
    await page.evaluate(() => view.viewport.classList.remove('hr-hide-ui'));
    await check('missing quote gracefully has no match', () => anchorMatch('changed text', { quote: 'removed paragraph' }) === null);
    // Issue #1: a fresh library-opened view can receive its initial resize
    // while cachedRead is pending. An empty page must not overwrite progress.
    await page.evaluate(async () => {
      window.beforeReopen = structuredClone(plugin.db['book.md']);
      await view.onClose(); view.containerEl.remove();
      plugin.libraryFiles = () => [{ file: bookFile }];
      plugin.lastReadFile = () => bookFile;
      plugin.app.workspace.getLeavesOfType = () => [];
      plugin.app.workspace.revealLeaf = async () => {};
      plugin.app.vault.cachedRead = () => new Promise(resolve => { window.finishRead = () => resolve(rawBook); });
      plugin.app.workspace.getLeaf = () => {
        const fresh = { app: plugin.app, getViewState: () => ({ state: { filePath: 'book.md' } }),
          async setViewState(state) {
            const reader = new ReaderView(fresh, plugin); fresh.view = reader; window.view = reader;
            Object.assign(reader, { buildScope() {}, setupInput() {}, pushScope() {}, popScope() {}, schedulePrefetch() {} });
            await reader.onOpen(); await reader.setState(state.state, {});
          },
        };
        return fresh;
      };
      plugin.openLibrary();
    });
    await page.locator('.hr-lib-row').click();
    await page.waitForTimeout(400);
    await check('issue #1: pending library read does not overwrite saved progress', () => plugin.db['book.md'].g === beforeReopen.g);
    await page.evaluate(() => finishRead());
    await page.waitForTimeout(400);
    await check('issue #1: library reopen restores the same passage', () => !!beforeReopen.anchor && view.anchorPage(beforeReopen.anchor) === view.page && view.currentG() < 0.95);
    await page.evaluate(async () => {
      window.beforeInterruptedRead = structuredClone(plugin.db['book.md']);
      window.beforeInterruptedMarkup = view.content.innerHTML;
      window.pendingRead = view.renderFile();
      await view.onClose(); view.containerEl.remove();
      finishRead(); await pendingRead;
    });
    await check('issue #1: closing during a read also preserves saved progress', () =>
      JSON.stringify(plugin.db['book.md']) === JSON.stringify(beforeInterruptedRead) && !view.content.isConnected && view.content.innerHTML === beforeInterruptedMarkup);
    console.log(`${results.length} reading integration checks passed`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
