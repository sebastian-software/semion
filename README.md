# Semion

Some name-based icon APIs rely on a shared runtime registry or embed SVG markup
in JavaScript. Importing SVG files one by one keeps the asset choice explicit,
but means wiring each path into JSX yourself. Semion keeps the concise
`<Icon name="search" />` authoring style: Vite resolves each static name at
build time, imports only that module's used SVGs as external assets, and
rewrites the marker to a small span whose mask points to the selected asset.
The SVG paths stay in the external files, not in generated JavaScript or DOM.

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

The current source preview automatically imports Semion's base styles. The
published npm release is still `0.0.1` and requires a manual
`import "semion/style.css"`; no newer release has been published.

## Use the API

Put SVG files in `src/icons`. Semion uses each top-level filename without the
`.svg` suffix as the icon name:

```tsx
import { Icon } from "semion";

export function SearchButton() {
  return (
    <button className="icon-button" type="button" aria-label="Search">
      <Icon name="search" aria-hidden="true" className="button-icon" />
    </button>
  );
}
```

The icon inherits the button's color through `currentColor`. Set its size with
an ordinary class:

```css
.icon-button {
  color: #2458d3;
}

.button-icon {
  width: 1.5rem;
  height: 1.5rem;
  mask-size: cover;
}

.icon-button:hover {
  color: #b4235a;
}

.icon-button:disabled {
  color: #98a2b3;
}
```

You can also override a default inline style directly:

```tsx
<Icon name="search" style={{ width: "2rem", height: "2rem" }} />
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

By default, the plugin scans `src/icons` and writes
`src/semion.generated.d.ts` when Vite starts; it refreshes the declaration
during builds and icon changes. Each top-level SVG filename without `.svg` is
an icon name. Include the generated file in the TypeScript project for
`Icon` name completion and validation. A project that includes `src` already
picks it up; if `tsconfig.json` has a narrower `include`, add the generated
file there. If you set `typesFile`, include that path instead. Before Vite has
generated the declaration, `IconName` falls back to `string`, so TypeScript
cannot catch a misspelled name yet.

## Run the example

The interactive React and Vite [source preview app](examples/vite-react) uses
local Lucide search, settings, and heart SVGs. It demonstrates generated name
completion, class and style-prop sizing, inherited color, hover, pressed, and
disabled states, plus the JSX-to-HTML transform. Its GitHub Pages target is the
[Semion site](https://sebastian-software.github.io/semion/); manual deployment
of a source ref becomes available when the Pages dispatch workflow is present
on the default branch. The preview reflects this repository's source; it is
not the published npm `0.0.1` package.

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
  removes any runtime `name` value and sets the selected `maskImage` and
  `WebkitMaskImage` after the caller's style, so a spread cannot change which
  icon the module uses.
- The transform imports one shared virtual stylesheet automatically. Vite
  deduplicates it across transformed modules. Its base rules use
  `:where(.semion-icon)`, which has zero specificity, so ordinary unlayered
  app classes can override size, alignment, and mask sizing. No package CSS
  import or mask setup is needed.
- The icon uses `currentColor`, so app CSS can set color for hover, active,
  disabled, and theme states. A React `style` prop can override CSS defaults;
  the selected mask URL remains fixed.
- Semion's base rules are unlayered. Normal rules inside a CSS cascade layer
  cannot override unlayered rules, regardless of selector specificity. Put
  overrides that need to win in unlayered app CSS; Semion does not change the
  app's layer configuration.
- The plugin runs in Vite's `pre` tier, before the React JSX transform. It does
  not change Vite's global asset inlining setting.

Put button or link semantics on the containing control. For decorative icons,
pass `aria-hidden="true"`; for informative icons, provide an accessible name
or nearby text.

## From JSX to HTML

For the search button above, the Semion transform runs before React's JSX
transform. It removes the marker import, adds the external SVG import, and
imports the shared virtual stylesheet. It replaces `<Icon>` with a span. This
is the generated module the React JSX transform receives:

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
    <button className="icon-button" type="button" aria-label="Search">
      <span {...__semionIconProps({["aria-hidden"]: "true", ["className"]: "button-icon"}, __semionIcon0)} />
    </button>
  );
}
```

The React JSX transform compiles the span, and React renders HTML like this.
The selected SVG is an external asset, so its production hash varies between
builds:

```html
<button class="icon-button" type="button" aria-label="Search"><span aria-hidden="true" class="semion-icon button-icon" style="mask-image:url(&quot;/assets/search-abc123.svg&quot;);-webkit-mask-image:url(&quot;/assets/search-abc123.svg&quot;)"></span></button>
```

The SVG paths stay in the external asset, not in the DOM. The virtual
stylesheet supplies the span's base size, color, and mask defaults; the
button's color flows through `currentColor`.

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
