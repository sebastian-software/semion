import { describe, expect, it } from "vitest";
import { parseSync } from "oxc-parser";

import { IconTransformError, transformIcons, type IconAsset } from "../src/transform.js";

const iconDirectory = "/project/src/icons";
const icons = new Map<string, IconAsset>([
  ["search", { file: iconDirectory + "/search.svg" }],
  ["user", { file: iconDirectory + "/user.svg" }],
]);

describe("Icon source transform", () => {
  it("rewrites an aliased marker and leaves unrelated and shadowed bindings alone", () => {
    const source =
      'import { Icon as Glyph, type IconName } from "semion";\n' +
      'import { Icon as ForeignIcon } from "other-library";\n' +
      'const direct = <Glyph name="search" aria-label="Find" />;\n' +
      "function local(Glyph: unknown) { return <Glyph name=\"missing\" />; }\n" +
      'const unrelated = <ForeignIcon name="missing" />;\n';
    const result = transformIcons(source, "/project/src/view.tsx", icons);

    expect(result).not.toBeNull();
    expect(result?.code).toContain('from "./icons/search.svg?no-inline"');
    expect(result?.code).toContain('import "virtual:semion/styles.css";');
    expect(result?.code).toContain("<span {...");
    expect(result?.code).toContain('import { type IconName } from "semion";');
    expect(result?.code).toContain('<Glyph name="missing" />');
    expect(result?.code).toContain('<ForeignIcon name="missing" />');
    expect(result?.code).not.toContain('import { Icon as Glyph');
    expect(parseSync("output.tsx", result?.code ?? "", { lang: "tsx" }).errors).toEqual([]);
  });

  it("resolves names statically and reports the source offset for bad uses", () => {
    const unknown =
      'import { Icon } from "semion";\nconst x = <Icon name="missing" />;';
    const unknownError = getTransformError(unknown);
    expect(unknownError.message).toContain('Unknown icon "missing"');
    expect(unknownError.pos).toBe(unknown.indexOf('name="missing"'));

    const dynamic =
      'import { Icon } from "semion";\nconst x = <Icon name={iconName} />;';
    const dynamicError = getTransformError(dynamic);
    expect(dynamicError.message).toContain("string literals");
    expect(dynamicError.pos).toBe(dynamic.indexOf("name={iconName}"));
  });

  it("keeps dynamic props and makes a later spread unable to change the selected icon", () => {
    const source =
      'import { Icon } from "semion";\n' +
      "const result = <Icon {...before} name=\"search\" {...after} className={className} " +
      'style={customStyle} aria-label="Search" />;';
    const result = transformIcons(source, "/project/src/view.tsx", icons);

    expect(result?.code.match(/search[.]svg[?]no-inline/g)).toHaveLength(1);
    expect(result?.code.match(/virtual:semion\/styles[.]css/g)).toHaveLength(1);
    expect(result?.code).toContain("...before");
    expect(result?.code).toContain("...after");
    expect(result?.code).toContain('["className"]: className');
    expect(result?.code).toContain('["style"]: customStyle');
    expect(result?.code).toContain('["aria-label"]: "Search"');
    expect(result?.code).toContain("delete result.name;");
    expect(result?.code).toContain("maskImage: mask, WebkitMaskImage: mask");
    expect(parseSync("output.tsx", result?.code ?? "", { lang: "tsx" }).errors).toEqual([]);
  });

  it("deduplicates a repeated icon import in one module and preserves source-map content", () => {
    const source =
      'const marker = "🧪";\n' +
      'import { Icon } from "semion";\n' +
      'export const view = <><Icon name="search" /><Icon name={"search"} /></>;\n';
    const result = transformIcons(source, "/project/src/view.tsx", icons);

    expect(result?.code.match(/search[.]svg[?]no-inline/g)).toHaveLength(1);
    expect(result?.map.sourcesContent).toEqual([source]);
    expect(result?.map.mappings.length).toBeGreaterThan(0);
    expect(parseSync("output.tsx", result?.code ?? "", { lang: "tsx" }).errors).toEqual([]);
  });

  it("keeps generated imports after a hashbang line", () => {
    const source =
      "#!/usr/bin/env node\n" +
      'import { Icon } from "semion";\n' +
      'export const view = <Icon name="search" />;\n';
    const result = transformIcons(source, "/project/src/view.tsx", icons);

    expect(result?.code.startsWith("#!/usr/bin/env node\n")).toBe(true);
    expect(parseSync("output.tsx", result?.code ?? "", { lang: "tsx" }).errors).toEqual([]);
  });

  it("does not change a module when every Icon reference is shadowed", () => {
    const source =
      'import { Icon } from "semion";\n' +
      "export function local(Icon: unknown) { return <Icon name=\"missing\" />; }\n";
    expect(transformIcons(source, "/project/src/view.tsx", icons)).toBeNull();
  });

  it("keeps the marker import when the imported binding also escapes JSX", () => {
    const source =
      'import { Icon } from "semion";\n' +
      "const savedMarker = Icon;\n" +
      'export const view = <Icon name="search" />;\n';
    const result = transformIcons(source, "/project/src/view.tsx", icons);

    expect(result?.code).toContain('import { Icon } from "semion";');
    expect(result?.code).toContain("const savedMarker = Icon;");
    expect(result?.code).toContain('from "./icons/search.svg?no-inline"');
  });
});

function getTransformError(source: string): IconTransformError {
  try {
    transformIcons(source, "/project/src/view.tsx", icons);
  } catch (error) {
    if (error instanceof IconTransformError) return error;
    throw error;
  }
  throw new Error("Expected Icon source to be rejected.");
}
