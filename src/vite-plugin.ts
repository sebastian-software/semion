import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";

import { transformIcons, type IconAsset } from "./transform.js";

export interface SemionOptions {
  /**
   * Directory containing top-level SVG files. The file stem is the JSX name.
   * Defaults to src/icons.
   */
  iconDir?: string;
  /**
   * Generated TypeScript module augmentation.
   * Defaults to src/semion.generated.d.ts.
   */
  typesFile?: string;
}

const PACKAGE_ID = "semion";
const SCRIPT_ID = /\.[cm]?[jt]sx?$/;
const STYLE_MODULE_ID = "virtual:semion/styles.css";
const RESOLVED_STYLE_MODULE_ID = "\0" + STYLE_MODULE_ID;
const ICON_STYLES = `
:where(.semion-icon) {
  display: inline-block;
  width: 1em;
  height: 1em;
  vertical-align: -0.125em;
  background-color: currentColor;
  mask-repeat: no-repeat;
  mask-position: center;
  mask-size: contain;
  -webkit-mask-repeat: no-repeat;
  -webkit-mask-position: center;
  -webkit-mask-size: contain;
}
`;

export function semion(options: SemionOptions = {}): Plugin {
  let root = process.cwd();
  let iconDir = path.resolve(root, options.iconDir ?? "src/icons");
  let typesFile = path.resolve(
    root,
    options.typesFile ?? "src/semion.generated.d.ts",
  );
  let icons = new Map<string, IconAsset>();

  function refresh(): void {
    let files: string[];
    try {
      files = readdirSync(iconDir, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith(".svg"))
        .map((entry) => entry.name)
        .sort();
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error("Could not read SVG icon directory " + iconDir + ": " + reason);
    }

    const nextIcons = new Map<string, IconAsset>();
    for (const filename of files) {
      const name = filename.slice(0, -4);
      if (nextIcons.has(name)) {
        throw new Error("Duplicate SVG icon name " + JSON.stringify(name) + " in " + iconDir);
      }
      nextIcons.set(name, {
        file: path.join(iconDir, filename),
      });
    }
    icons = nextIcons;

    const declaration =
      'import "semion";\n' +
      'declare module "semion" {\n' +
      "  interface IconNameRegistry {\n" +
      [...icons.keys()]
        .map((name) => "    " + JSON.stringify(name) + ": true;\n")
        .join("") +
      "  }\n" +
      "}\n";
    mkdirSync(path.dirname(typesFile), { recursive: true });
    let previous = "";
    try {
      previous = readFileSync(typesFile, "utf8");
    } catch {}
    if (previous !== declaration) writeFileSync(typesFile, declaration);
  }

  return {
    name: "vite-plugin-semion",
    enforce: "pre",

    resolveId(id) {
      if (id === STYLE_MODULE_ID) return RESOLVED_STYLE_MODULE_ID;
    },

    load(id) {
      if (id === RESOLVED_STYLE_MODULE_ID) return ICON_STYLES;
    },

    configResolved(config) {
      root = config.root;
      iconDir = path.resolve(root, options.iconDir ?? "src/icons");
      typesFile = path.resolve(
        root,
        options.typesFile ?? "src/semion.generated.d.ts",
      );
      refresh();
    },

    buildStart() {
      refresh();
      for (const icon of icons.values()) this.addWatchFile(icon.file);
    },

    watchChange(id) {
      const file = id.split("?", 1)[0] ?? id;
      if (file === iconDir || path.dirname(file) === iconDir) refresh();
    },

    transform: {
      filter: {
        id: SCRIPT_ID,
        code: [PACKAGE_ID],
      },
      handler(source, id) {
        const filename = id.split("?", 1)[0] ?? id;
        if (!SCRIPT_ID.test(filename) || !source.includes(PACKAGE_ID)) return null;
        try {
          return transformIcons(source, filename, icons);
        } catch (error) {
          if (error && typeof error === "object" && "pos" in error) {
            const diagnostic = error as Error & { pos: number };
            this.error(diagnostic.message, diagnostic.pos);
          }
          this.error(error instanceof Error ? error.message : String(error));
        }
      },
    },
  };
}
