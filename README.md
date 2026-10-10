# Pixel UI — under construction

Static page, no build step, no dependencies.

```
index.html
css/style.css
js/main.js
fonts/   Geist, Geist Mono, Instrument Serif (woff2, SIL OFL)
og-image.png                         social preview (1200×630)
favicon.{ico,svg}, favicon-32x32.png, apple-touch-icon.png, icon-{192,512}.png, site.webmanifest
```

## Run locally

Fonts are preloaded, so open it through a local server (not `file://`):

```
python3 -m http.server 8000
# → http://localhost:8000
```

## Edit

- Email: `index.html` → `mailto:` link, its text and `data-copy` on the copy button.
- X handle: the `.cta` link in `index.html`.
- Rotating words: the `.word` spans in `index.html` (the box resizes itself).
- Accent colour: `--accent` in `css/style.css` (the background picks it up too).

## Deploy

Drop the folder on any static host (Cloudflare Pages, Netlify, GitHub Pages).
