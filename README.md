# Eternal Sunflower

`Eternal Sunflower` is a static Vite + Three.js birthday gift: a bouquet of procedurally generated 3D sunflower particles that grows from darkness, blooms asynchronously, and continues to turn gently.

No image sprites, external 3D models, trackers, login, or backend are used. Every disc floret, tapered petal, sepal, stem, leaf, wrapping fold, ribbon, filler bloom, and sparkle is generated in the browser.

## Personalise it

Edit only [`src/config.js`](src/config.js). The `text` section contains the recipient, opening line, birthday wish, and signature. The same file holds the Golden Hour palette, bloom timing, flower count, rotation speed, and mobile/desktop particle budgets.

## Run locally

Requires Node.js 20+.

Do **not** double-click `dist/index.html`. That opens a `file://` URL, and browsers intentionally restrict the ES modules that make the Three.js scene run; the result looks like unstyled raw HTML. Serve the project over HTTP instead:

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:4173/` in Chrome. On Windows, [`Open-Eternal-Sunflower.bat`](Open-Eternal-Sunflower.bat) starts the local Vite server and opens that URL for you. Tap/click **Tap to begin**. Drag the bouquet for a gentle rotation; tap it for a small golden burst. Tap five times for the small hidden message. The `•••` button contains replay and about controls.

## Verify and package

```bash
npm test
npm run build
npm run screenshot
```

The screenshot command produces `artifacts/preview-mobile.png` at 390×844 and `artifacts/preview-desktop.png` at 1366×768. It deliberately exits with an error if the browser falls back because WebGL is disabled, so a fallback page can never be mistaken for a completed flower preview. On a fresh machine, install the matching browser once before this command:

```bash
npx playwright install chromium
```

`dist/` is the deployable static site. Because `vite.config.js` uses `base: './'`, it works on GitHub Pages project sites, Vercel, and Netlify without a path rewrite.

## Accessibility and performance

- Mobile is the primary layout; the desktop code panel appears at 900px and up.
- It uses `100dvh`, iPhone safe-area insets, no scrolling, touch drag, and an unclipped landscape composition.
- `prefers-reduced-motion` keeps the complete bouquet, compresses the bloom, and stops rotation/parallax.
- A low-spec mobile profile preserves the Fibonacci flower centres at a lower particle count; sustained low frame rate reduces pixel ratio before touching the flower geometry.
- If WebGL cannot start, the same generated particle data is animated by a Canvas 2D renderer; the opening, bloom, eternal rotation, message, replay, drag, and golden tap burst still work. The quiet browser message is reserved for the rare case where neither renderer is available.

## Design notes and attribution

The independent WebGL implementation in this repository was designed after studying the visual ideas in [Ling-Ta’s **eternal-rose-code**](https://github.com/Ling-Ta/eternal-rose-code): typed particle attributes, start/final interpolation, staggered bloom, a slow shared rotation, glow, and a restrained desktop code panel. That reference is MIT licensed. No Python/Pygame code, assets, or flower geometry were copied; this project writes an original sunflower generator around Golden Angle / Fibonacci phyllotaxis and its own Three.js shaders.

The project itself is released under the [MIT License](LICENSE).
