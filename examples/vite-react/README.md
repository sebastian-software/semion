# Semion with Lucide

This small Vite app uses three Lucide SVG files from its own
src/icons directory. The Semion library has no dependency on Lucide and does
not ship these files.

From the repository root, install dependencies and run:

```sh
pnpm install
pnpm --filter semion build
pnpm --filter semion-vite-react-example dev
```

The buttons demonstrate inherited icon color, hover, pressed, and disabled
states. The heart button also demonstrates an accessible pressed state.

The selected SVGs are from the [Lucide repository](https://github.com/lucide-icons/lucide).
Search is derived from Feather and uses its MIT terms; settings and heart use
Lucide's ISC terms. The upstream license text is included in
`LUCIDE-LICENSE.txt`, and the source links are listed in
`THIRD_PARTY_NOTICES.md`. Identical copies in `public/` are served with the
Pages demo so the deployed icon assets keep their notices available.
