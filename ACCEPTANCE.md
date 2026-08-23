# Acceptance record — Eternal Sunflower

## Passed in this workspace

| Check | Result |
| --- | --- |
| Dependency installation | Passed with pnpm 11.19.0 |
| `pnpm run test` | Passed: 3/3 tests |
| Typed particle attributes | Passed: `position`, start, colour, size, birth, duration, phase, role |
| Golden Angle formula | Passed: `Math.PI * (3 - Math.sqrt(5))` |
| `pnpm run build` | Passed with Vite 7.3.6 |
| Static deploy output | Generated under `dist/` with relative asset paths |
| WebGL completed-bloom view | Passed at 390×844 and 1366×768 |
| Forced Canvas 2D renderer | Passed at 390×844 with `?renderer=canvas2d&complete=1` |
| Tap-to-begin | Passed: opening removed, gift started, no console errors |
| Responsive overflow | Passed: document width equals viewport width at 390px and 1366px |
| Hidden UI regression | Passed: fallback and `•••` menu remain `display: none` until needed |

## Preview artifacts

The final completed-bloom screenshots are `artifacts/preview-mobile.png` and `artifacts/preview-desktop.png`.

The browser-error screen shown earlier was traced to an author CSS rule overriding the HTML `hidden` attribute. The global `[hidden]` rule now prevents that overlay and the closed menu from appearing. A Canvas 2D renderer also consumes the same procedural particle arrays when WebGL genuinely cannot initialize.
