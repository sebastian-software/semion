import {
  mkdtempSync,
  mkdirSync,
  copyFileSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import react from "@vitejs/plugin-react";
import ts from "typescript";
import { build } from "vite";

import { semion } from "../src/vite-plugin.js";

const temporaryRoots: string[] = [];
const packageRoot = path.resolve(".");
const dependencies = path.join(packageRoot, "node_modules");

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("Semion Vite integration", () => {
  it("emits only referenced icons as external assets across eager and lazy routes", async () => {
    const root = createFixture();
    const entry = path.join(root, "dist");
    const result = await build({
      root,
      configFile: false,
      base: "/nested/app/",
      plugins: [semion({ iconDir: "src/icons" }), react()],
      build: {
        outDir: entry,
        emptyOutDir: true,
        cssCodeSplit: true,
      },
    });

    const outputs = outputFiles(result);
    const chunks = outputs.filter((output): output is TestChunk => output.type === "chunk");
    const assets = outputs.filter((output): output is TestAsset => output.type === "asset");
    const svgAssets = assets.filter((asset) => asset.fileName.endsWith(".svg"));
    const cssAssets = assets.filter((asset) => asset.fileName.endsWith(".css"));
    const entryChunk = chunks.find((chunk) => chunk.isEntry);
    const lazyChunk = chunks.find((chunk) => chunk.isDynamicEntry);

    expect(entryChunk).toBeDefined();
    expect(lazyChunk).toBeDefined();
    expect(svgAssets.map((asset) => asset.fileName).sort()).toHaveLength(2);
    expect(svgAssets.map((asset) => asset.source).join(" ")).not.toContain("unused-shape");
    expect(svgAssets.map((asset) => asset.fileName).join(" ")).not.toContain("unused");

    const eagerAsset = svgAssets.find((asset) =>
      String(asset.source).includes("eager-search"),
    );
    const lazyAsset = svgAssets.find((asset) => String(asset.source).includes("lazy-user"));
    expect(eagerAsset).toBeDefined();
    expect(lazyAsset).toBeDefined();
    expect(entryChunk?.code).toContain("/nested/app/" + eagerAsset?.fileName);
    expect(lazyChunk?.code).toContain("/nested/app/" + lazyAsset?.fileName);
    expect(entryChunk?.code).not.toContain(lazyAsset?.fileName);
    expect(entryChunk?.code).not.toContain("data:image/svg+xml");
    expect(lazyChunk?.code).not.toContain("data:image/svg+xml");
    expect(chunks.map((chunk) => chunk.code).join("\n")).not.toContain("<svg");

    expect(cssAssets).toHaveLength(1);
    const emittedCss = String(cssAssets[0]?.source);
    expect(emittedCss).toContain(".semion-icon");
    expect(emittedCss).toContain("background-color:currentColor");
    expect(emittedCss).toContain("mask-size:contain");

    const generatedTypes = readGeneratedTypes(root);
    expect(generatedTypes).toContain('"search": true;');
    expect(generatedTypes).toContain('"user": true;');
    expect(generatedTypes).toContain('"unused": true;');

    const typeSource = path.join(root, "src/type-check.tsx");
    writeFileSync(
      typeSource,
      'import { Icon, type IconName } from "semion";\n' +
        'type Equal<Actual, Expected> = (<T>() => T extends Actual ? 1 : 2) extends (<T>() => T extends Expected ? 1 : 2) ? true : false;\n' +
        'type Assert<T extends true> = T;\n' +
        'type IconNameAutocomplete = Assert<Equal<IconName, "search" | "user" | "unused">>;\n' +
        'const validName: IconName = "search";\n' +
        'const valid = <Icon name={validName} className="large" aria-label="Search" />;\n' +
        '// @ts-expect-error Unknown names are rejected after Vite generates the declaration.\n' +
        'const invalidName: IconName = "not-found";\n' +
        '// @ts-expect-error JSX name props use the same generated union.\n' +
        'const invalid = <Icon name="not-found" />;\n',
    );
    const typeProgram = ts.createProgram(
      [typeSource, path.join(root, "src/semion.generated.d.ts")],
      {
        jsx: ts.JsxEmit.ReactJSX,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        noEmit: true,
        strict: true,
        skipLibCheck: true,
        typeRoots: [path.join(root, "node_modules/@types")],
      },
    );
    const typeErrors = ts.getPreEmitDiagnostics(typeProgram);
    expect(typeErrors).toHaveLength(0);
  });

  it("builds the Lucide React example with three external SVG assets", async () => {
    const root = path.join(packageRoot, "examples/vite-react");
    const result = await build({
      root,
      configFile: path.join(root, "vite.config.ts"),
      logLevel: "silent",
      build: {
        write: false,
        assetsInlineLimit: 0,
      },
    });

    const outputs = outputFiles(result);
    const svgAssets = outputs.filter(
      (output): output is TestAsset =>
        output.type === "asset" && output.fileName.endsWith(".svg"),
    );
    const cssAssets = outputs.filter(
      (output): output is TestAsset =>
        output.type === "asset" && output.fileName.endsWith(".css"),
    );
    const svgSources = svgAssets.map((asset) => String(asset.source));
    const expectedSources = ["heart.svg", "search.svg", "settings.svg"].map((filename) =>
      readFileSync(path.join(root, "src/icons", filename), "utf8"),
    );

    expect(svgAssets).toHaveLength(3);
    expect(svgSources.sort()).toEqual(expectedSources.sort());
    expect(cssAssets).toHaveLength(1);
    expect(String(cssAssets[0]?.source)).toContain(".semion-icon");
    expect(String(cssAssets[0]?.source)).toContain("background-color:currentColor");
  });
});

function createFixture(): string {
  const root = mkdtempSync(path.join(os.tmpdir(), "semion-vite-"));
  temporaryRoots.push(root);
  mkdirSync(path.join(root, "src/icons"), { recursive: true });
  mkdirSync(path.join(root, "node_modules"), { recursive: true });
  mkdirSync(path.join(root, "node_modules/@types"), { recursive: true });

  for (const dependency of ["react", "react-dom"]) {
    symlinkSync(path.join(dependencies, dependency), path.join(root, "node_modules", dependency), "dir");
  }
  symlinkSync(
    path.join(dependencies, "@types/react"),
    path.join(root, "node_modules/@types/react"),
    "dir",
  );
  symlinkSync(
    path.join(dependencies, "@types/node"),
    path.join(root, "node_modules/@types/node"),
    "dir",
  );
  symlinkSync(packageRoot, path.join(root, "node_modules/semion"), "dir");

  for (const filename of ["search.svg", "user.svg", "unused.svg"]) {
    copyFileSync(
      path.join(packageRoot, "test/fixtures/icons", filename),
      path.join(root, "src/icons", filename),
    );
  }

  writeFileSync(
    path.join(root, "index.html"),
    '<div id="root"></div><script type="module" src="/src/main.tsx"></script>',
  );
  writeFileSync(
    path.join(root, "src/main.tsx"),
    'import { Icon } from "semion";\n' +
      'import "./app.css";\n' +
      'import { createRoot } from "react-dom/client";\n' +
      'export function App() { return <button className="icon-button" onClick={() => { void import("./lazy.tsx"); }}><Icon name="search" aria-label="Search" /></button>; }\n' +
      'const root = document.getElementById("root");\n' +
      'if (root) createRoot(root).render(<App />);\n',
  );
  writeFileSync(
    path.join(root, "src/lazy.tsx"),
    'import { Icon } from "semion";\n' +
      'export function Lazy() { return <Icon name="user" aria-hidden="true" />; }\n',
  );
  writeFileSync(
    path.join(root, "src/app.css"),
    ".icon-button { color: rgb(21, 67, 119); } .icon-button:hover { color: rgb(180, 32, 72); }",
  );
  return root;
}

interface TestChunk {
  type: "chunk";
  code: string;
  fileName: string;
  isEntry: boolean;
  isDynamicEntry: boolean;
}

interface TestAsset {
  type: "asset";
  fileName: string;
  source: string | Uint8Array;
}

function outputFiles(result: unknown): Array<TestChunk | TestAsset> {
  const outputs = Array.isArray(result)
    ? result.flatMap((output) => (output as { output: Array<TestChunk | TestAsset> }).output)
    : (result as { output: Array<TestChunk | TestAsset> }).output;
  return outputs;
}

function readGeneratedTypes(root: string): string {
  return readFileSync(path.join(root, "src/semion.generated.d.ts"), "utf8");
}
