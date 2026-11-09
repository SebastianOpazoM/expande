# Expande brand implementation

The user-supplied six-page `Manual marca Expande.pdf` is the authority for this visual update. The manual was rendered and inspected in full before implementation. Its original file and the immutable source package were not changed. The app's existing routes, content, permissions and visitor activity remain intact; no API, schema or catalogue edit was needed.

## Artwork and provenance

The three approved lockups on page 2 contain outlined vector paths. `scripts/extract-brand-assets.py` exports those exact paths, per-object matrices, fill rules and fill colours into colour, white and black SVGs. It omits the page headings and the black presentation rectangle behind the white logo. The complete **expande / somos FCh** lockup is preserved in every variant. No image generation or typographic reconstruction was used.

The magenta X comes directly from the colour logo, with a square viewport and padding for the favicon. The plus signs are extracted from page 3. Seven SVG assets and the Rubik licence live in `public/brands/expande/`; source SHA, page/object indices, dimensions and output hashes are recorded in `content/expande-brand-assets.json`. The supplied manual's SHA-256 is `0761214134f87947757d290d0d1fdbcb5aef2d91440048b6b1ed723fcf6660d6`.

To reproduce the extraction with Python, pypdf and pypdfium2 installed:

```powershell
python scripts/extract-brand-assets.py 'C:/Users/sebas/Desktop/Manual marca Expande.pdf'
```

The source colour lockup is used in the app header; the white lockup is used on the welcome gradient. The outer desktop framing has no logo. A shared `BrandLogo` component supplies intrinsic sizing and accessible descriptions, with decorative duplicates ignored by screen readers. Header logos display at 120px and the welcome logo at 200px, with automatic height preserving the SVG proportions. A shared `PhoneStage` presents the 393px app surface inside a dark 417px hardware shell on desktop, with a bezel, speaker, home indicator and side controls hidden from assistive technology. At browser widths up to 500px the hardware decoration disappears and the app returns to a full-viewport mobile surface. The supplied PDF does not prescribe app-specific spacing, minimum digital sizes or simulated-device hardware; those dimensions and surrounding treatments are app adaptations.

## Colour system

The PDF's spot-colour Separation resources include RGB alternatives. Rounding their channels to eight bits produces the values below; these match the rendered swatches and are the equivalents from this supplied PDF, rather than values taken from an unrelated online conversion table.

| Manual colour | RGB equivalent | App use |
| --- | --- | --- |
| Pantone 220 C | `#AB1254` | Primary actions, selected controls, links, saved state |
| Pantone 2189 C | `#053349` | Main text, navigation, dark panels and theme colour |
| Pantone 351 C | `#A4D2B4` | Supporting accents and welcome motif |
| Pantone 7548 C | `#FDC500` | Highlights, dark-surface focus and welcome motif |

`src/style.css` contains named brand and semantic tokens. App adaptations include white cards, `#F5F8F7` page background, muted text `#52666F`, decorative borders `#D9E3E5`, control borders `#7A919A`, and primary hover `#890E43`. Selected tabs include a magenta indicator, so selection does not depend on a faint surface difference. Saved controls have 44px targets. Mint/yellow backgrounds use dark text. Formación badges remain distinct, using magenta, yellow and navy treatments with their text labels.

Functional success, warning and error colours remain distinguishable. Third-party Google, Apple and Microsoft marks retain their original assets and colours. All 47 existing content illustrations and the video were preserved byte-for-byte; the local comparison is `.local/brand-media-baseline.json` (48 files).

## Typography and surfaces

Rubik Variable 5.3.0 replaces Inter. Latin and Latin Extended WOFF2 files are bundled locally through Fontsource; there is no Google Fonts request at runtime. The original SIL Open Font License is retained. Body/forms use 400, controls 500 and headings 600. The welcome display uses 300 with a 500 emphasis, following the manual's light/medium approach. Variable-font ranges prevent synthetic weight substitution.

Welcome uses the manual's navy/magenta direction, original X and plus motifs. Decorative images are hidden from assistive technology and do not intercept clicks. Home and Explore use restrained brand tints; Innovación keeps its full-width Explore card. Existing catalogue media was deliberately retained in this first identity update. Browser theme colour and favicon use the supplied identity.

## Verification approach

The browser checks load the real production build and cover welcome/access, home, Explore, account, company/profile/team forms and modal, challenges, innovation, Formación, calendar, financing, alliances, applications and preferences at 360/390/430px. They verify local font loading with Spanish text, logo variants/sizing, visible text contrast, input boundaries and focus outlines, and horizontal overflow. Desktop framing and all vector assets are also checked. The original interaction suite remains in place.

Measured base contrast ratios:

| Combination | Ratio |
| --- | --- |
| White on magenta | 7.13:1 |
| Navy on white | 13.32:1 |
| Navy on mint | 7.90:1 |
| Navy on yellow | 8.35:1 |
| Muted text on page background | 5.63:1 |
| Control border on white / page background | 3.31:1 / 3.10:1 |
| Success on mint tint | 6.12:1 |
| Error on error tint | 6.72:1 |
| Warning on yellow tint | 6.56:1 |

These checks are targeted evidence rather than a complete WCAG audit of every possible state. Disabled controls are excluded from the active contrast thresholds; purely decorative artwork is not treated as text. Brand assets and representative mobile/desktop screenshots are visually compared with the manual. No full nested-view Figma or Docker fidelity claim is made.

Final results: production build, all 45 unit/API/CLI/location/catalogue tests and all 40 browser tests passed. The seven live SVG URLs return HTTP 200. The source PDF and all 48 content-media files match their SHA-256 baselines. Evidence: `.local/brand-preservation-verification.json`, `.local/brand-media-baseline.json`, and `.local/screenshots/brand-*`, including logo variants, mobile screen families, modal and desktop framing. Browser catalogue fixtures use their separate `.local/e2e.sqlite`; no live data batch was needed for this brand update.
