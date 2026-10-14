# Semion

Semion is a small React and Vite prototype for compile-time SVG mask icons.
Import the `Icon` marker in TSX, and Semion rewrites each static use to a span
with a per-file SVG URL import. The Vite plugin supplies the shared mask styles
automatically, so the app does not need a Semion CSS import.

The Vite adapter is written in TypeScript and uses the existing native
`oxc-parser` package to parse JSX and TSX. It edits the original module and
returns a source map. It does not build or ship a custom Rust addon.

## Install

Semion is an ESM package for React projects using Vite. It requires Node.js
20.19+ or 22.12+, React 18+, and Vite 8+.

```sh
npm install semion react
npm install --save-dev vite @vitejs/plugin-react @types/react
```

## Use the API

Put SVG files in `src/icons`. Semion uses each top-level filename without the
`.svg` suffix as the icon name:

```tsx
import { Icon } from "semion";

export function SearchButton() {
  return (
    <button type="button" aria-label="Search">
      <Icon name="search" aria-hidden="true" className="button-icon" />
    </button>
  );
}
```

Register the plugin before the React plugin in `vite.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { semion } from "semion/vite";

export default defineConfig({
  plugins: [semion(), react()],
});
```

Put SVG files in `src/icons`; each top-level filename without `.svg` is an
available icon name. The plugin writes `src/semion.generated.d.ts` when Vite
starts, then refreshes it during builds and icon changes. Include that file in
the TypeScript project for `Icon` name completion and validation. A project
that includes `src` already picks it up; if `tsconfig.json` has a narrower
`include`, add the generated file there. If you set `typesFile`, include that
path instead. Before Vite has generated the declaration, `IconName` falls back
to `string`, so TypeScript cannot catch a misspelled name yet.

## Run the example

The [React and Vite example](examples/vite-react) uses local Lucide search,
settings, and heart SVGs. It demonstrates inherited color and hover, pressed,
and disabled styles.

```sh
pnpm install
pnpm --filter semion build
pnpm --filter semion-vite-react-example dev
```

The example assets and their upstream license notices are in
`examples/vite-react`.

The default icon directory is `src/icons`. Set `iconDir` to change it. Set
`typesFile` to change the generated TypeScript declaration path. The plugin
writes `src/semion.generated.d.ts` by default, providing `Icon` name completion
from the configured SVG files.

## What the transform does

- `name` must be a string literal such as `name="search"`. Unknown names and
  dynamic names fail the Vite transform with a source location.
- Every used SVG is imported from its source module with `?no-inline`. Vite
  keeps the SVG outside JavaScript even when the file is tiny. Unused SVG files
  do not enter the bundle.
- Repeated uses in one source module share one generated import. An icon used
  only by a lazy module stays in that module's dependency graph.
- Other JSX props keep their order and are evaluated once. Semion preserves
  spreads, `className`, `style`, and accessibility attributes. Its helper
  removes any runtime `name` value and forces the selected mask URL after
  spreads and user style, so a spread cannot change the static icon choice.
- The transform imports one shared virtual stylesheet. Vite deduplicates it
  across transformed modules and includes its sizing, mask alignment, and
  `currentColor` rules in the app's CSS output. No Semion CSS import or manual
  mask styling is needed. Use regular app CSS for button and link states, size
  overrides, and theme colors.
- The plugin runs in Vite's `pre` tier, before the React JSX transform. It does
  not change Vite's global asset inlining setting.

Put button or link semantics on the containing control. For decorative icons,
pass `aria-hidden="true"`; for informative icons, provide an accessible name
or nearby text.

## From JSX to HTML

For the search button above, the Semion transform runs before React's JSX
transform. It removes the marker import, adds the external SVG and virtual CSS
imports, and replaces `<Icon>` with a span. The generated helper preserves
other props and applies the mask URL:

```tsx
import __semionIcon0 from "./icons/search.svg?no-inline";
import "virtual:semion/styles.css";

function __semionIconProps(props, asset) {
  const result = { ...props };
  delete result.name;
  const mask = "url(" + JSON.stringify(asset) + ")";
  return {
    ...result,
    className: result.className ? "semion-icon " + result.className : "semion-icon",
    style: { ...result.style, maskImage: mask, WebkitMaskImage: mask },
  };
}

export function SearchButton() {
  return (
    <button type="button" aria-label="Search">
      <span {...__semionIconProps({["aria-hidden"]: "true"}, __semionIcon0)} />
    </button>
  );
}
```

React receives a span, not the `Icon` marker. A production render looks like
this; the SVG asset hash varies between builds:

```html
<button type="button" aria-label="Search"><span aria-hidden="true" class="semion-icon" style="mask-image:url(&quot;/assets/search-abc123.svg&quot;);-webkit-mask-image:url(&quot;/assets/search-abc123.svg&quot;)"></span></button>
```

The SVG paths stay in the external asset, not in the DOM. The span uses the
button's `currentColor` for its mask.

## Prototype boundaries

This prototype handles named imports of `Icon` from `semion` in JSX or TSX.
The icon directory is scanned at the top level; duplicate filename stems are
rejected. It does not edit SVG paths at runtime, manage icon packs, provide
other framework adapters, or ship a rendering registry. The marker throws if
it reaches React without the Vite plugin.

Semion is published as an ESM-only package. The `semion` entry exports the
React marker and types, and `semion/vite` exports the Vite plugin. The package
is dual-licensed under MIT OR Apache-2.0; users may choose either license for
Semion's first-party code. Its tarball includes the built JavaScript,
declarations, README, and both license texts. Example Lucide and Feather
assets retain their separate upstream terms and are excluded from the npm
package.
