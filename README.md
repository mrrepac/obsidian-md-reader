# MD Reader

Read your Obsidian notes — and your books — like an e-book.

MD Reader renders a note into fixed-size **pages** and lets you flip through them **sideways** — by swiping, tapping the screen edges, or using the arrow keys — instead of scrolling vertically. Choose a single page or a two-page book spread. Works on **desktop and mobile**.

It also **imports FB2, EPUB and TXT books into Markdown**, so a whole library lives inside your vault as ordinary notes you can link, quote and search like anything else.

## Fixed in 2.0.1

Remove the extra space above the text on phones when immersive reading hides
Obsidian's floating header, while preserving space for the system status bar.
See the [2.0.1 release notes](release-notes/2.0.1.md).

## New in 2.0.0

- Collect quotes in **Books/Quotes**, with one note per book and links to the source.
- Open **Menu** and **Aa** directly from the reading controls. Adjust side margins,
  choose an appearance preset, or reset the appearance while keeping the book visible.
- Restore reading positions and bookmarks by a text fragment, with percentage-based
  restoration as a fallback. Existing saved progress remains supported.
- Choose which progress indicators to display, including the time left.
- Fix the jump to 100% when reopening from the library, narrow-pane clipping,
  theme-dependent bottom margins and color swatches.

See the [2.0.0 release notes](release-notes/2.0.0.md) for details.

## Features

### Reading

- **Horizontal page flip.** Swipe (mobile), tap the left/right third of the screen, use `←` / `→`, `A` / `D`, `Space` / `Shift+Space`, `PageUp` / `PageDown`, `Home` / `End`, the mouse wheel, or the on-screen `‹` `›` buttons.
- **Single page or two-page spread.** Two pages on wide screens, one on narrow windows and phones — or force a mode.
- **Remembers the text you were reading.** Positions and new bookmarks carry a short text anchor with surrounding context, so changing the font, window width or chapter splitting can return to the same passage. Inserting text before that passage is supported too. If the passage can no longer be found, the saved percentage is the fallback. Older saved positions and bookmarks still work.
- **Table of contents, full-book search and bookmarks.** Open **Menu** beside the progress indicator (also available as commands).
- **Scrub the progress bar.** Drag it to move anywhere in the book; the percentage and the chapter you are heading for follow your finger. Landed in the wrong place? One step back returns you.
- **Chapter at a time.** `Shift+←` / `Shift+→` step through the table of contents, not through internal render blocks. Stepping back from the middle of a chapter returns to its start first, as e-readers do.
- **Time left.** The status bar says roughly how long the rest of the book will take, from *your* measured reading speed — it learns as you read, with no setting to set.
- **Open the note for editing.** Spotted a typo in your own note? The menu opens the source in a tab at the current chapter. Edits made anywhere in Obsidian show up in the reader by themselves.
- **Reading progress** in the status bar, weighted across the whole book, with the **current chapter** next to it — a bare number tells you nothing in a thousand-page novel.
- **Choose your progress indicators.** In **Aa → Reading progress** or the plugin settings, independently hide the progress bar, page number/percentage, chapter name and time left. Menu and appearance buttons remain available with every indicator off. These choices are saved and are not reset by appearance presets.
- **Hyphenation follows the book,** not the interface: an English novel is not hyphenated by Russian rules just because Obsidian is in Russian.
- **Appearance panel.** Open **Aa** beside the progress indicator. Change font, line height, vertical and side margins, page width, tint, brightness and page mode while the book remains visible. Start with **Book**, **Compact** or **Night**, or reset appearance without changing the library, progress or reading behaviour. On a narrow screen the panel opens as a bottom sheet.
- **Font size on the fly.** `Ctrl/Cmd` `+` / `−` on the desktop, pinch with two fingers on the phone.
- **Back to where I was.** Jumped off to a heading, a search hit or a bookmark — one step returns you to the page you were reading (`Backspace`, `Alt+←`, or the menu).
- **The end.** The last page says so, and offers the library, or a way out, instead of a page that just won't turn.
- **Leaving puts everything back.** One action — the menu, a command, the end screen, or `Esc` twice — closes the reader and returns the workspace exactly as it was: side panels, header, tab bar, full screen, the OS status bar on a phone. The panel state is kept on disk, so it survives quitting Obsidian with a book open.
- **Immersive reading.** Hides the app header and the mobile/desktop bars so only the text remains. Tap the center of the page to bring them back. On desktop it can go into **real full screen**.
- **Big books stay fast — and it tunes itself.** Long files are rendered one block at a time. Column layout is strictly linear in the amount of text, so the reader times its own layout and picks the block size that fits in about one frame **on your machine**: roughly 55 000 characters on a fast desktop, down to 20 000 on a slow one, without a setting to fiddle with. The next block is prepared in the background — but only once you are past the middle of the current one, and only while the main thread is idle. Blocks you have already read stay parsed, so paging back costs nothing. A 3 MB novel opens and flips without freezing, on the phone too.
- **Reading comfort.** Reading font, page tint (sepia, cream, gray, night), brightness, justified text with hyphenation, adjustable margins, line height and page width.
- **Collapses the side panels** when you open a note, and restores them when you close the reader.
- **Theme-aware.** Uses your theme's fonts and colors unless you override them.
- **No vertical scrolling, no manual page breaks** — pagination is computed from the rendered Markdown automatically and re-flows on resize.

### Library and import

- **Library.** One ribbon icon opens a list of your books: everything in the import folder, any notes you add by hand, and the notes you have recently read, each with a progress bar, sorted by when you last read it. **Continue** at the top reopens the last book straight away; a filter appears once the list grows.
- **Import books to Markdown.** `.fb2`, `.epub` and `.txt` are converted into a single `.md` file (chapters become headings, so the table of contents works) plus a folder with the book's images. Footnotes are inlined, epigraphs become quotes, the cover is kept. Cyrillic encodings such as windows-1251 are detected automatically.
- **No dependencies, no build step.** The converters — including the EPUB unzipper — are plain JavaScript in the plugin itself.

## How to use

- Click the **book icon** in the left ribbon to open the **Library**, then pick a book.
- Or open the current note: command **"Open current note in MD Reader"**, or **right-click** a note → **Open in MD Reader**.
- To import a book: the **import** button at the bottom of the Library, the command **"Import book to Markdown (fb2, epub, txt)…"**, the button in settings, or **right-click** a `.fb2` / `.epub` / `.txt` file in the vault → **Convert to Markdown**.

While reading:

- **Turn pages:** swipe, tap the left/right edge, arrow keys, `A` / `D`, `Space`, mouse wheel, or the `‹` `›` buttons.
- **Toggle the interface:** tap the center of the page.
- **Menu:** press **Menu** beside the progress indicator (or tap the percentage) → table of contents, search, previous/next chapter, back to where you were, appearance, library, open the note for editing, add/remove bookmark, bookmarks, leave the reader. **Aa** opens appearance directly. Both buttons support keyboard focus and activation.
- **Leave:** `Esc` once brings the interface back without leaving the book; `Esc` again closes the reader and restores the workspace. Also in the menu, as a command, and on the end screen.
- **Jump anywhere:** drag the progress bar at the very bottom. `Home` / `End` go to the start and the end of the whole book.
- **Resize the text:** `Ctrl/Cmd` `+` / `−`, or pinch with two fingers.
- **Select and copy** with the mouse — dragging across the text no longer flips the page.
- **Save a quote.** Select text in the book and press the **❞** button beside the reading controls, right-click → **Save selected text as a quote**, or use the command of the same name. The quote is appended to a Markdown note for that book, with a link to the source and its heading when available. Reading stays on the same page.

Quotes go to **`Books/Quotes`** by default; the folder is created on the first save. Change **Quotes folder** in the MD Reader settings to use another folder inside the vault. Each book gets its own note, and books with identical names get separate files. An unrelated existing note is never overwritten. The configured quotes subfolder is excluded from automatic library discovery; you can still add a quote note to the library manually.

### Commands

| Command | What it does |
| --- | --- |
| Open library | The list of your books. |
| Continue reading | Reopens the last book you read, where you left off. |
| Open current note in MD Reader | Opens the active note in the reader. |
| Open table of contents | Jump to any heading in the book. |
| Search in this book | Search the whole book and jump to a hit. |
| Next / Previous chapter | Step through the table of contents (`Shift+→` / `Shift+←`). |
| Open the note for editing | Opens the source in a tab, at the current chapter. |
| Leave the reader | Closes the book and puts the panels and the app chrome back. |
| Back to where I was | Undo a jump to a heading, hit or bookmark. |
| Appearance: font, tint, margins | The reading settings, without leaving the book. |
| Increase / Decrease font size | Same as `Ctrl/Cmd` `+` / `−` while reading. |
| Add / remove bookmark | Bookmark the current page. |
| Open bookmarks | Jump to a bookmark. |
| Save selected text as a quote | Append the selection to the book's quote note, with a source link. |
| Toggle full screen | Desktop only. |
| Cycle page tint | Switch tint on the fly — handy in the evening. |
| Import book to Markdown (fb2, epub, txt)… | Pick a file and convert it. |

## Settings

| Setting | What it does |
| --- | --- |
| Page mode | Auto (two pages on a wide screen, one on a narrow one), Always one, or Always two. |
| Max page width | Width of a single page; smaller is a narrower, more comfortable column. 0 = no limit. |
| Font size | Multiplier relative to your theme's font. |
| Reading font | Typeface for the page text — only inside the reader. Includes a custom CSS `font-family` option. |
| Page tint | Sepia, cream, gray or night. Only the reader changes; the rest of Obsidian keeps your theme. |
| Brightness | Dim the page for reading in the dark. |
| Line height | Line spacing. |
| Gap between pages | Space between the two pages of a spread. |
| Vertical margins | Empty space at the top and bottom of the page. |
| Side margins | Minimum outside space on each side, in pixels. The maximum page width can leave additional space; very narrow panes reduce the margin to keep the page inside the viewport. |
| Reading progress | Separate switches for the progress bar, page number/percentage, chapter name and time left. |
| Quotes folder | Destination for quote notes, one per book. Default: `Books/Quotes`. |
| Justify text | Align paragraphs to both edges, with hyphenation where the platform supports it. |
| Page-flip animation | Animate page turns on/off. |
| Tap zones | Tap left/right to flip, center to toggle the interface. |
| Remember position | Reopen each note where you left off. |
| Show note title | Show the note title on the first page. |
| Open in | New tab, current tab, split, or new window. |
| Collapse side panels | Hide the side panels while reading. |
| Immersive reading | Hide the app chrome for full-screen reading. |
| Full screen while reading | Desktop: open books in real full screen; `Esc` leaves at any time. |
| Folder for imported books | Where converted books and their images are saved. |
| Hide the system status bar (mobile) | On a phone, also hide the OS status bar (clock, notifications) while reading. Experimental. |

Interface language follows Obsidian — English and Russian.

## Installation

### From the Community Plugins catalog

Settings → Community plugins → Browse → search **"MD Reader"** → Install → Enable.

If it is already installed, check for updates in Community plugins. Updating keeps
your settings, saved positions and bookmarks.

### Manual

Copy `main.js`, `manifest.json` and `styles.css` into
`<your vault>/.obsidian/plugins/md-reader/` and enable the plugin in
Settings → Community plugins.

When updating manually, replace those three files and keep `data.json`.

## Development

The plugin is plain JavaScript with **no build step** — `main.js` is the source and ships as-is. To work on it, edit the files in the plugin folder and reload Obsidian (`Ctrl/Cmd-P` → "Reload app without saving").

The logic and UI smoke tests stub the `obsidian` module (and a minimal DOM) and run on bare Node, with no dependencies to install:

```
node tests/logic.mjs
node tests/ui.mjs
```

`logic.mjs` covers chapter splitting, text anchors, appearance presets, reading position, navigation, encodings and the TXT converter. `ui.mjs` checks the library, settings, workspace restoration and quote storage, including concurrent appends and filename collisions.

Browser tests use Playwright and Chromium (`npm install --no-save --package-lock=false playwright`, then `npx playwright install chromium`):

```
node tests/layout.cjs
node tests/reading.cjs
```

`layout.cjs` checks page geometry and footer clearance across widths, fonts and page modes. Set `READER_THEMES_DIR` to an Obsidian themes directory to include its themes. `reading.cjs` exercises the reader with a stubbed Obsidian host: delayed library reopening, text anchors after edits/reflow, bookmarks, legacy data, presets, color swatches, progress controls, quote selection and keyboard menu access. These tests do not replace testing in Obsidian on an actual phone. `PLAYWRIGHT_MODULE` and `CHROMIUM_PATH` can point to existing installations.

## License

[MIT](LICENSE) © mrrepac
