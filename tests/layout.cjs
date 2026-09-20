/* Real Chromium layout checks. Install playwright, then run node tests/layout.cjs.
 * Optional: PLAYWRIGHT_MODULE, CHROMIUM_PATH, READER_THEMES_DIR, READER_SOURCE. */
const { readFileSync, readdirSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = join(__dirname, '..');
const source = readFileSync(process.env.READER_SOURCE || join(root, 'main.js'), 'utf8');
const css = readFileSync(join(root, 'styles.css'), 'utf8');

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  let checks = 0;
  const failures = [];
  try {
    const page = await browser.newPage();
    const themes = [['base', '']];
    if (process.env.READER_THEMES_DIR) {
      for (const name of readdirSync(process.env.READER_THEMES_DIR)) {
        themes.push([name, readFileSync(join(process.env.READER_THEMES_DIR, name, 'theme.css'), 'utf8')]);
      }
    }
    for (const [theme, themeCss] of themes) {
      for (const width of [100, 140, 320, 768, 1024, 1600]) {
        for (const mode of ['auto', 'single', 'double']) {
        for (const variant of ['default', 'small-font', 'stage-font']) {
          await page.setViewportSize({ width, height: 700 });
          await page.setContent(`<style>
            * { box-sizing: border-box; }
            body { margin: 0; --font-text: Arial; --font-text-size: 16px; font-size: 16px; }
            .workspace-leaf-content { height: 700px; }
          </style><style>${themeCss}</style><style>${css}</style>
          <body class="theme-light"><div class="workspace-leaf-content" data-type="horizontal-reader-view">
            <div class="view-content hr-view-content"><div class="hr-viewport">
              <div class="hr-stage"><div class="hr-content"></div></div>
              <div class="hr-statusbar"><div class="hr-reader-tools"><button>Menu</button><div class="hr-status-text">10% — Chapter</div><button>Aa</button></div></div>
            </div></div></div></body>`);
          const result = await page.evaluate(({ source, variant, mode }) => {
            const Stub = class {};
            const api = new Proxy({ Platform: { isDesktop: true, isMobile: false } }, { get: (o, k) => o[k] || Stub });
            const { ReaderView, DEFAULT_SETTINGS } = new Function('require', 'module', source + '\nreturn { ReaderView, DEFAULT_SETTINGS };')(() => api, { exports: {} });
            const view = Object.create(ReaderView.prototype);
            const settings = { ...DEFAULT_SETTINGS, pageMode: mode, animate: false, verticalPadding: 0, fontSize: variant === 'small-font' ? 0.75 : 1 };
            Object.assign(view, {
              viewport: document.querySelector('.hr-viewport'), stage: document.querySelector('.hr-stage'),
              content: document.querySelector('.hr-content'), statusBar: document.querySelector('.hr-statusbar'),
              plugin: { settings, noteLayoutRate() {} }, chapterChars: [1000], chapterIndex: 0, page: 0,
              indexHeadingPages() {}, updateStatus() {}, savePos() {}, schedulePrefetch() {},
            });
            if (variant === 'stage-font') view.stage.style.fontSize = '0.7em';
            view.content.innerHTML = '<p>' + 'Reading text with ordinary words. '.repeat(500) + '</p>';
            view.applySettings();
            view.measure();
            window.layoutTestView = view;
            const vp = view.viewport.getBoundingClientRect();
            const stage = view.stage.getBoundingClientRect();
            const content = view.content.getBoundingClientRect();
            const style = getComputedStyle(view.content);
            const footer = view.statusBar.getBoundingClientRect();
            return {
              left: stage.left - vp.left, right: vp.right - stage.right,
              footerClearance: parseFloat(style.paddingBottom) - footer.height,
              stageWidth: stage.width, contentWidth: content.width, pages: view.totalPages,
            };
          }, { source, variant, mode });
          checks++;
          try {
            assert.ok(result.left >= -1 && result.right >= -1, 'page must fit the viewport');
            assert.ok(Math.abs(result.left - result.right) < 1, 'side margins must be symmetric');
            assert.ok(result.footerClearance >= 3.5, 'text must clear the footer by 4px');
            assert.ok(Math.abs(result.stageWidth - result.contentWidth) < 1, 'column container must match the book');
            assert.ok(result.pages > 1 && Number.isFinite(result.pages), 'long text must paginate');
          } catch (error) { failures.push({ theme, width, mode, variant, reason: error.message, ...result }); }
        }
        }
      }
    }
    // A footer can grow without a viewport resize. Exercise the real observer
    // and debounce instead of manually calling applySettings a second time.
    const dynamic = await page.evaluate(async () => {
      const view = window.layoutTestView;
      view.app = { workspace: { on() {} } };
      view.registerEvent = () => {};
      view.setupRepagination();
      view.statusBar.style.fontSize = '40px';
      await new Promise(resolve => setTimeout(resolve, 450));
      const clearance = parseFloat(getComputedStyle(view.content).paddingBottom) - view.statusBar.offsetHeight;
      view.ro.disconnect();
      clearTimeout(view._repaginateTimer);
      return clearance;
    });
    checks++;
    if (dynamic < 3.5) failures.push({ reason: 'footer resize must update bottom clearance', clearance: dynamic });
    console.log(JSON.stringify({ checks, failures }, null, 2));
    process.exitCode = failures.length ? 1 : 0;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
