# The Lightsmith – Claude Code Instructions

## Project overview
Static marketing website for The Lightsmith, a mobile headlight restoration business based in Caldwell, ID serving the Treasure Valley. Deployed via GitHub Pages at `https://lightsmith.llc/`.

## Stack
- Plain HTML, CSS, and vanilla JavaScript — no build tools, no frameworks, no npm
- Each page is a self-contained `.html` file; shared styles live in `style.css` and shared JS in `site.js`
- `header.html` and `footer.html` are injected at runtime by `site.js` (fetch + innerHTML)

## Pages
| File | Purpose |
|------|---------|
| `index.html` | Home / hero |
| `about.html` | About page |
| `book.html` | Booking page |
| `care.html` | Aftercare instructions |
| `contact.html` | Contact form (Web3Forms) |
| `reviews.html` | Google Reviews carousel |
| `thank-you.html` | Post-booking / form confirmation |

## Key integrations
- **Google Places API** – pulls live reviews; API key + Place ID stored as `<meta>` tags in `index.html` and `reviews.html`
- **Web3Forms** – handles contact form submissions with file attachment support
- **Google Fonts** – Inter + Poppins loaded via `<link>`
- **Font Awesome 6.5** – icon library via CDN

## Development
No build step needed. Serve the root folder with any static server:
```
python -m http.server
# or VS Code Live Server
```

## Conventions
- Keep all pages free of frameworks and build tools
- Inline `<style>` blocks in individual pages are acceptable for page-specific overrides
- Images: JPEGs for photos, PNGs for logos/favicons
- Gallery images live in `images/gallery/` (1600×1200 JPEG)
- Favicons and PWA assets live in `images/`
- Prefer editing existing files over creating new ones

## SEO / metadata
- Each page has its own `<title>`, `<meta name="description">`, and Open Graph tags
- `sitemap.xml` and `robots.txt` are included — update `sitemap.xml` when adding pages
- Structured data (LocalBusiness + FAQPage JSON-LD) is embedded in relevant pages
