import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import vm from "node:vm";
import { fileURLToPath, pathToFileURL } from "node:url";

import { codeToHtml } from "@ferriki/core";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const appDirectory = path.resolve(scriptDirectory, "..");
const repositoryDirectory = path.resolve(appDirectory, "../..");
const sourcePath = path.join(appDirectory, "src/pipeline-example.tsx");
const source = readFileSync(sourcePath, "utf8");
const styles = readFileSync(path.join(appDirectory, "src/styles.css"), "utf8");
const assetToken = "__SEMION_ASSET_URL__";
const assetPath = path.join(appDirectory, "src/icons/search.svg");

const { transformIcons } = await import(
  pathToFileURL(path.join(repositoryDirectory, "dist/transform.js"))
);
const transformed = transformIcons(
  source,
  sourcePath,
  new Map([["search", { file: assetPath }]]),
);

if (!transformed) {
  throw new Error("The pipeline example did not produce a Semion transform.");
}

for (const className of ["icon-button", "button-icon"]) {
  if (!styles.includes(`.${className}`)) {
    throw new Error(`The pipeline example class .${className} has no stylesheet rule.`);
  }
}

if (!transformed.code.includes('["className"]: "button-icon"')) {
  throw new Error("The transformed example no longer forwards button-icon.");
}

const assetImports = [
  ...transformed.code.matchAll(
    /^import (\w+) from "([^"]+\.svg\?no-inline)";\s*$/gm,
  ),
];
if (assetImports.length !== 1) {
  throw new Error(`Expected one emitted SVG import, found ${assetImports.length}.`);
}

const executableSource = transformed.code
  .replace(/^import (\w+) from "[^"]+\.svg\?no-inline";\s*$/gm, (_, name) =>
    `const ${name} = ${JSON.stringify(assetToken)};`,
  )
  .replace(/^import "virtual:semion\/styles\.css";\s*$/gm, "");

const appRequire = createRequire(path.join(appDirectory, "package.json"));
const typescript = appRequire("typescript");
const compiled = typescript.transpileModule(executableSource, {
  compilerOptions: {
    jsx: typescript.JsxEmit.ReactJSX,
    module: typescript.ModuleKind.CommonJS,
    target: typescript.ScriptTarget.ES2022,
  },
  fileName: sourcePath,
}).outputText;
const renderedModule = { exports: {} };
const runModule = vm.runInNewContext(
  `(function(require, module, exports) { ${compiled}\n})`,
  { console },
);
runModule(appRequire, renderedModule, renderedModule.exports);

const { renderToStaticMarkup } = appRequire("react-dom/server");
const rendered = renderToStaticMarkup(
  renderedModule.exports.SearchButton({
    pressed: false,
    onPress() {},
  }),
);
const formattedRendered = rendered
  .replace("<button ", "<button\n  ")
  .replace(" type=", "\n  type=")
  .replace(" aria-label=", "\n  aria-label=")
  .replace(" aria-pressed=", "\n  aria-pressed=")
  .replace("><span ", ">\n  <span\n    ")
  .replace(" aria-hidden=", "\n    aria-hidden=")
  .replace(' class="semion-icon', '\n    class="semion-icon')
  .replace(' style="mask-image:', '\n    style="mask-image:')
  .replace(";-webkit-mask-image:", ";\n      -webkit-mask-image:")
  .replace("</span></button>", "\n  </span>\n</button>");

for (const expected of [
  'class="icon-button"',
  'aria-label="Search preview"',
  'aria-pressed="false"',
  'class="semion-icon button-icon"',
  assetToken,
]) {
  if (!rendered.includes(expected)) {
    throw new Error(`The rendered example is missing ${JSON.stringify(expected)}.`);
  }
}
if (rendered.includes("<svg")) {
  throw new Error("The rendered example unexpectedly inlines SVG path data.");
}

const highlighted = {
  source: await codeToHtml(source, {
    lang: "tsx",
    theme: "github-dark-default",
  }),
  transformed: await codeToHtml(transformed.code, {
    lang: "tsx",
    theme: "github-dark-default",
  }),
  rendered: await codeToHtml(formattedRendered, {
    lang: "html",
    theme: "github-dark-default",
  }),
};

const outputPath = path.join(appDirectory, "src/pipeline-examples.generated.ts");
writeFileSync(
  outputPath,
  `// Generated from pipeline-example.tsx by prepare-pipeline.mjs.\n` +
    `export const pipelineExamples = ${JSON.stringify(highlighted)} as const;\n`,
);
