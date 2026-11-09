# Expande brand assets

Original vector artwork extracted from the user-supplied `Manual marca Expande.pdf` (six pages). Source SHA-256: `0761214134f87947757d290d0d1fdbcb5aef2d91440048b6b1ed723fcf6660d6`.

- `logo-color.svg`, `logo-white.svg`, `logo-black.svg`: page 2, complete Expande / somos FCh lockups.
- `mark-x.svg`: original magenta X from the colour logo, given a square viewport for the favicon/decorative motif.
- `plus-magenta.svg`, `plus-yellow.svg`, `plus-mint.svg`: page 3 visual elements.
- `Rubik-OFL.txt`: unmodified SIL Open Font License distributed with `@fontsource-variable/rubik@5.3.0`. The fonts are bundled locally by Vite from that package.

`scripts/extract-brand-assets.py` exports the source paths, transforms, fill rules and colours through PDFium. It does not reconstruct the lettering, trace pixels or generate a replacement logo. `content/expande-brand-assets.json` records source page/object selections, viewports, hashes and the embedded RGB colour equivalents.

Use complete lockups in their original proportions. Use the colour version on light surfaces and white on dark/gradient surfaces. Spacing and display sizes in this app are digital adaptations because the supplied document does not specify minimum sizes or exclusion zones. No endorsement or authorship of catalogue content is implied by these assets.
