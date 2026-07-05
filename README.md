# MD Reader

Read your Obsidian notes like an e-book.

MD Reader renders a note into fixed-size **pages** and lets you flip through them **sideways** — by swiping, tapping the screen edges, or using the arrow keys — instead of scrolling vertically. Choose a single page or a two-page book spread. Works on **desktop and mobile**.

There was no plugin that paginates your *own* Markdown notes into flippable pages (the existing "reader" plugins all open EPUB/PDF files), so this one fills that gap.

## Features

- **Horizontal page flip.** Swipe (mobile), tap the left/right third of the screen, use `←` / `→`, `Space` / `Shift+Space`, `PageUp` / `PageDown`, `Home` / `End`, the mouse wheel, or the on-screen `‹` `›` buttons.
- **Single page or two-page spread.** Two pages on wide screens, one on narrow windows and phones — or force a mode.
- **Remembers your place** in every note. The position is stored as a fraction, so it survives font-size, width and theme changes.
- **Immersive reading.** Hides the app header and the mobile/desktop bars so only the text remains. Tap the center of the page to bring them back.
- **Collapses the side panels** when you open a note, and restores them when you close the reader.
- **Theme-aware.** Uses your theme's fonts and colors.
- **Configurable.** Page mode, max page width, font size, line height, page gap, flip animation, tap zones, where to open, and more.
- **No vertical scrolling, no manual page breaks** — pagination is computed from the rendered Markdown automatically and re-flows on resize.

## How to use

Open a note in the reader in any of these ways:

- Click the **book icon** in the left ribbon.
- Run the command **"Open current note in MD Reader"** from the command palette.
- **Right-click** a note → **Open in MD Reader**.

Then:

- **Turn pages:** swipe, tap the left/right edge, arrow keys, `Space`, mouse wheel, or the `‹` `›` buttons.
- **Toggle the interface:** tap the center of the page.
- The bottom bar shows your progress (`page X / N`).

## Settings

| Setting | What it does |
| --- | --- |
| Page mode | Auto (two pages on a wide screen, one on a narrow one), Always one, or Always two. |
| Max page width | Width of a single page; smaller is a narrower, more comfortable column. |
| Font size | Multiplier relative to your theme's reading font. |
| Line height | Line spacing. |
| Page gap | Space between pages. |
| Flip animation | Animate page turns on/off. |
| Tap zones | Tap left/right to flip, center to toggle the interface. |
| Remember position | Reopen each note where you left off. |
| Show note title | Show the note title on the first page. |
| Open in | New tab, current tab, split, or new window. |
| Collapse side panels | Hide the side panels while reading. |
| Immersive | Hide the app chrome for full-screen reading. |
| Hide the system status bar (mobile) | On a phone, also hide the OS status bar (clock, notifications) while reading. Experimental. |

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
