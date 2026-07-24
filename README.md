# MD Reader

Read your Obsidian notes — and your books — like an e-book.

MD Reader renders a note into fixed-size **pages** and lets you flip through them **sideways** — by swiping, tapping the screen edges, or using the arrow keys — instead of scrolling vertically. Choose a single page or a two-page book spread. Works on **desktop and mobile**.

It also **imports FB2, EPUB and TXT books into Markdown**, so a whole library lives inside your vault as ordinary notes you can link, quote and search like anything else.

## Features

### Reading

- **Horizontal page flip.** Swipe (mobile), tap the left/right third of the screen, use `←` / `→`, `Space` / `Shift+Space`, `PageUp` / `PageDown`, `Home` / `End`, the mouse wheel, or the on-screen `‹` `›` buttons.
- **Single page or two-page spread.** Two pages on wide screens, one on narrow windows and phones — or force a mode.
- **Remembers your place** in every note, as a fraction of the whole book — so it survives font-size, width and theme changes, and matches up between desktop and phone.
- **Table of contents, full-book search and bookmarks.** Tap the progress percentage in the status bar to open the menu (also available as commands).
- **Reading progress** in the status bar, weighted across the whole book.
- **Immersive reading.** Hides the app header and the mobile/desktop bars so only the text remains. Tap the center of the page to bring them back. On desktop it can go into **real full screen**.
- **Big books stay fast.** Long files are split into chapter-sized blocks that render one at a time, and the next block is prepared in the background while you read — a 3 MB novel opens and flips without freezing, on the phone too.
- **Reading comfort.** Reading font, page tint (sepia, cream, gray, night), brightness, justified text with hyphenation, adjustable margins, line height and page width.
- **Collapses the side panels** when you open a note, and restores them when you close the reader.
- **Theme-aware.** Uses your theme's fonts and colors unless you override them.
- **No vertical scrolling, no manual page breaks** — pagination is computed from the rendered Markdown automatically and re-flows on resize.

### Library and import

- **Library.** One ribbon icon opens a list of your books: everything in the import folder plus any notes you add by hand, each with its reading percentage, sorted by when you last read it.
- **Import books to Markdown.** `.fb2`, `.epub` and `.txt` are converted into a single `.md` file (chapters become headings, so the table of contents works) plus a folder with the book's images. Footnotes are inlined, epigraphs become quotes, the cover is kept. Cyrillic encodings such as windows-1251 are detected automatically.
- **No dependencies, no build step.** The converters — including the EPUB unzipper — are plain JavaScript in the plugin itself.

## How to use

- Click the **book icon** in the left ribbon to open the **Library**, then pick a book.
- Or open the current note: command **"Open current note in MD Reader"**, or **right-click** a note → **Open in MD Reader**.
- To import a book: the **import** button at the bottom of the Library, the command **"Import book to Markdown (fb2, epub, txt)…"**, the button in settings, or **right-click** a `.fb2` / `.epub` / `.txt` file in the vault → **Convert to Markdown**.

While reading:

- **Turn pages:** swipe, tap the left/right edge, arrow keys, `Space`, mouse wheel, or the `‹` `›` buttons.
- **Toggle the interface:** tap the center of the page.
- **Menu:** tap the percentage in the status bar → table of contents, search, add/remove bookmark, bookmarks.

### Commands

| Command | What it does |
| --- | --- |
| Open library | The list of your books. |
| Open current note in MD Reader | Opens the active note in the reader. |
| Open table of contents | Jump to any heading in the book. |
| Search in this book | Search the whole book and jump to a hit. |
| Add / remove bookmark | Bookmark the current page. |
| Open bookmarks | Jump to a bookmark. |
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

### Manual

Copy `main.js`, `manifest.json` and `styles.css` into
`<your vault>/.obsidian/plugins/md-reader/` and enable the plugin in
Settings → Community plugins.

## Development

The plugin is plain JavaScript with **no build step** — `main.js` is the source and ships as-is. To work on it, edit the files in the plugin folder and reload Obsidian (`Ctrl/Cmd-P` → "Reload app without saving").

## License

[MIT](LICENSE) © mrrepac
